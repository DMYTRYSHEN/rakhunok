create table public.corex_environments (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  environment_key text not null check (environment_key ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  created_at timestamptz not null default now(),
  unique (id, owner_user_id),
  unique (owner_user_id, environment_key)
);

create table public.corex_route_namespaces (
  environment_id uuid not null,
  route_namespace text not null check (route_namespace ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (environment_id, route_namespace),
  unique (environment_id, route_namespace, owner_user_id),
  foreign key (environment_id, owner_user_id)
    references public.corex_environments(id, owner_user_id) on delete restrict
);

alter table public.corex_environments enable row level security;
alter table public.corex_route_namespaces enable row level security;
revoke all on public.corex_environments from public, anon, authenticated;
revoke all on public.corex_route_namespaces from public, anon, authenticated;
grant select, insert on public.corex_environments to service_role;
grant select, insert on public.corex_route_namespaces to service_role;

insert into public.corex_environments (owner_user_id, environment_key)
select distinct owner_user_id, 'default'
from public.corex_published_triggers
on conflict (owner_user_id, environment_key) do nothing;

insert into public.corex_route_namespaces (environment_id, route_namespace, owner_user_id)
select id, 'default', owner_user_id
from public.corex_environments
on conflict (environment_id, route_namespace) do nothing;

alter table public.corex_published_triggers
  add column environment_id uuid;

update public.corex_published_triggers trigger
set environment_id = environment.id
from public.corex_environments environment
where environment.owner_user_id = trigger.owner_user_id
  and environment.environment_key = 'default';

alter table public.corex_published_triggers
  alter column environment_id set not null,
  add foreign key (environment_id, route_namespace, owner_user_id)
    references public.corex_route_namespaces(environment_id, route_namespace, owner_user_id)
    on delete restrict,
  add unique (environment_id, route_namespace, http_method, route_path, id, owner_user_id);

alter table public.corex_active_http_routes
  add column environment_id uuid,
  add column owner_user_id uuid;

update public.corex_active_http_routes active_route
set environment_id = trigger.environment_id,
    owner_user_id = trigger.owner_user_id
from public.corex_published_triggers trigger
where trigger.id = active_route.trigger_id;

alter table public.corex_active_http_routes
  drop constraint corex_active_http_routes_pkey,
  alter column environment_id set not null,
  alter column owner_user_id set not null,
  add primary key (environment_id, route_namespace, http_method, route_path),
  add foreign key (environment_id, route_namespace, owner_user_id)
    references public.corex_route_namespaces(environment_id, route_namespace, owner_user_id)
    on delete restrict,
  add foreign key (
    environment_id,
    route_namespace,
    http_method,
    route_path,
    trigger_id,
    owner_user_id
  ) references public.corex_published_triggers(
    environment_id,
    route_namespace,
    http_method,
    route_path,
    id,
    owner_user_id
  ) on delete restrict;

create or replace function corex_private.is_protected_http_route(p_route_path text)
returns boolean
language sql
immutable
strict
set search_path = ''
as $$
  select p_route_path = '/'
    or p_route_path ~ '^/(api|app|assets|checkout|corex|dashboard|docs|pay|_app)(/|$)'
    or p_route_path ~ '^/\.well-known(/|$)';
$$;

revoke all on function corex_private.is_protected_http_route(text) from public, anon, authenticated;

create or replace function corex_private.prepare_active_http_route_ownership()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  published_trigger public.corex_published_triggers;
begin
  select * into published_trigger
  from public.corex_published_triggers
  where id = new.trigger_id;

  if published_trigger.id is null then
    raise exception 'Corex published trigger is missing' using errcode = '23503';
  end if;

  if (new.environment_id is not null and new.environment_id <> published_trigger.environment_id)
    or (new.owner_user_id is not null and new.owner_user_id <> published_trigger.owner_user_id) then
    raise exception 'Corex HTTP route ownership conflicts' using errcode = '23503';
  end if;

  new.environment_id := published_trigger.environment_id;
  new.owner_user_id := published_trigger.owner_user_id;
  return new;
end;
$$;

revoke all on function corex_private.prepare_active_http_route_ownership()
  from public, anon, authenticated;

create trigger corex_active_http_routes_prepare_ownership
before insert or update on public.corex_active_http_routes
for each row execute function corex_private.prepare_active_http_route_ownership();

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
  target_environment_key constant text := 'default';
  target_route_namespace constant text := 'default';
  target_environment public.corex_environments;
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

  if corex_private.is_protected_http_route(route_path) then
    raise exception 'Corex HTTP route is protected' using errcode = 'PT403';
  end if;

  insert into public.corex_environments (owner_user_id, environment_key)
  values (target_process.owner_user_id, target_environment_key)
  on conflict (owner_user_id, environment_key) do nothing;

  select * into target_environment
  from public.corex_environments
  where owner_user_id = target_process.owner_user_id
    and environment_key = target_environment_key
  for update;

  insert into public.corex_route_namespaces (environment_id, route_namespace, owner_user_id)
  values (target_environment.id, target_route_namespace, target_process.owner_user_id)
  on conflict (environment_id, route_namespace) do nothing;

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
    environment_id,
    route_namespace,
    http_method,
    route_path
  ) values (
    published.id,
    target_process.id,
    target_process.owner_user_id,
    'http',
    target_environment.id,
    target_route_namespace,
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
      environment_id,
      route_namespace,
      http_method,
      route_path,
      trigger_id,
      process_id,
      owner_user_id
    ) values (
      published_trigger.environment_id,
      published_trigger.route_namespace,
      published_trigger.http_method,
      published_trigger.route_path,
      published_trigger.id,
      target_process.id,
      target_process.owner_user_id
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