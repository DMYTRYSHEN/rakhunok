create table public.corex_published_triggers (
  id uuid primary key default gen_random_uuid(),
  process_version_id uuid not null unique references public.corex_process_versions(id) on delete restrict,
  process_id uuid not null references public.corex_processes(id) on delete restrict,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind = 'http'),
  route_namespace text not null check (route_namespace ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  http_method text not null check (http_method in ('GET', 'POST', 'PUT', 'PATCH', 'DELETE')),
  route_path text not null check (
    route_path ~ '^/[A-Za-z0-9._~!$&''()*+,;=:@%/-]*$'
    and route_path !~ '//'
    and char_length(route_path) <= 1024
  ),
  created_at timestamptz not null default now(),
  foreign key (process_version_id, process_id, owner_user_id)
    references public.corex_process_versions(id, process_id, owner_user_id) on delete restrict
);

create unique index corex_published_triggers_route_identity_idx
  on public.corex_published_triggers (route_namespace, http_method, route_path, id);

create table public.corex_active_http_routes (
  route_namespace text not null,
  http_method text not null,
  route_path text not null,
  trigger_id uuid not null unique references public.corex_published_triggers(id) on delete restrict,
  process_id uuid not null unique references public.corex_processes(id) on delete restrict,
  activated_at timestamptz not null default now(),
  primary key (route_namespace, http_method, route_path),
  foreign key (route_namespace, http_method, route_path, trigger_id)
    references public.corex_published_triggers(route_namespace, http_method, route_path, id)
    on delete restrict
);

alter table public.corex_published_triggers enable row level security;
alter table public.corex_active_http_routes enable row level security;
revoke all on public.corex_published_triggers from public, anon, authenticated;
revoke all on public.corex_active_http_routes from public, anon, authenticated;
grant select, insert on public.corex_published_triggers to service_role;
grant select, insert, update, delete on public.corex_active_http_routes to service_role;

create or replace function corex_private.reject_published_trigger_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Corex published triggers are immutable';
end;
$$;

revoke all on function corex_private.reject_published_trigger_mutation() from public, anon, authenticated;

create trigger corex_published_triggers_immutable
before update or delete on public.corex_published_triggers
for each row execute function corex_private.reject_published_trigger_mutation();

create or replace function public.corex_publish_process(
  p_process_id uuid,
  p_owner_user_id uuid,
  p_expected_revision bigint
)
returns public.corex_process_versions
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_process public.corex_processes;
  published_definition jsonb;
  published_sha256 text;
  next_version integer;
  published public.corex_process_versions;
  trigger_node jsonb;
  trigger_count integer;
  published_trigger public.corex_published_triggers;
  route_namespace constant text := 'default';
  route_method text;
  route_path text;
begin
  select * into target_process
  from public.corex_processes
  where id = p_process_id
    and owner_user_id = p_owner_user_id
  for update;

  if target_process.id is null or target_process.revision <> p_expected_revision then
    raise exception 'Corex publish revision conflict' using errcode = '40001';
  end if;

  select count(*), jsonb_agg(node) -> 0
  into trigger_count, trigger_node
  from jsonb_array_elements(target_process.draft_definition -> 'nodes') node
  where node ->> 'type' = 'trigger-http';

  if trigger_count <> 1 then
    raise exception 'Corex publish requires exactly one HTTP trigger' using errcode = '22023';
  end if;

  route_method := trigger_node #>> '{config,method}';
  route_path := trigger_node #>> '{config,path}';
  if route_method not in ('GET', 'POST', 'PUT', 'PATCH', 'DELETE')
    or route_path is null
    or route_path !~ '^/[A-Za-z0-9._~!$&''()*+,;=:@%/-]*$'
    or route_path ~ '//'
    or char_length(route_path) > 1024 then
    raise exception 'Corex HTTP trigger route is invalid' using errcode = '22023';
  end if;

  published_definition := jsonb_set(
    jsonb_set(
      target_process.draft_definition,
      '{revision}',
      to_jsonb(target_process.revision),
      true
    ),
    '{lifecycle}',
    to_jsonb('published'::text),
    true
  );
  published_sha256 := encode(
    extensions.digest(convert_to(published_definition::text, 'UTF8'), 'sha256'),
    'hex'
  );

  if target_process.published_version is not null then
    select * into published
    from public.corex_process_versions
    where process_id = target_process.id
      and version = target_process.published_version
      and definition_sha256 = published_sha256;
  end if;

  if published.id is null then
    select coalesce(max(version), 0) + 1 into next_version
    from public.corex_process_versions
    where process_id = target_process.id;

    insert into public.corex_process_versions (
      process_id,
      owner_user_id,
      version,
      definition,
      definition_sha256,
      published_by
    ) values (
      target_process.id,
      target_process.owner_user_id,
      next_version,
      published_definition,
      published_sha256,
      p_owner_user_id
    )
    returning * into published;
  end if;

  insert into public.corex_published_triggers (
    process_version_id,
    process_id,
    owner_user_id,
    kind,
    route_namespace,
    http_method,
    route_path
  ) values (
    published.id,
    target_process.id,
    target_process.owner_user_id,
    'http',
    route_namespace,
    route_method,
    route_path
  )
  on conflict (process_version_id) do nothing;

  select * into published_trigger
  from public.corex_published_triggers
  where process_version_id = published.id;

  delete from public.corex_active_http_routes
  where process_id = target_process.id;

  begin
    insert into public.corex_active_http_routes (
      route_namespace,
      http_method,
      route_path,
      trigger_id,
      process_id
    ) values (
      published_trigger.route_namespace,
      published_trigger.http_method,
      published_trigger.route_path,
      published_trigger.id,
      target_process.id
    );
  exception
    when unique_violation then
      raise exception 'Corex HTTP route conflict' using errcode = '23505';
  end;

  update public.corex_processes
  set lifecycle = 'published',
      published_version = published.version,
      updated_at = now()
  where id = target_process.id;

  return published;
end;
$$;

revoke all on function public.corex_publish_process(uuid, uuid, bigint) from public, anon, authenticated;
grant execute on function public.corex_publish_process(uuid, uuid, bigint) to service_role;