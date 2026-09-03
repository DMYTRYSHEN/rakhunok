alter table public.corex_environments
  add column lifecycle text not null default 'active'
    check (lifecycle in ('active', 'retired')),
  add column retired_at timestamptz,
  add constraint corex_environments_retirement_consistent check (
    (lifecycle = 'active' and retired_at is null)
    or (lifecycle = 'retired' and retired_at is not null)
  );

alter table public.corex_route_namespaces
  add column lifecycle text not null default 'active'
    check (lifecycle in ('active', 'retired')),
  add column retired_at timestamptz,
  add constraint corex_route_namespaces_retirement_consistent check (
    (lifecycle = 'active' and retired_at is null)
    or (lifecycle = 'retired' and retired_at is not null)
  );

grant update (lifecycle, retired_at) on public.corex_environments to service_role;
grant update (lifecycle, retired_at) on public.corex_route_namespaces to service_role;

create or replace function public.corex_ensure_environment(
  p_owner_user_id uuid,
  p_environment_key text
)
returns public.corex_environments
language plpgsql
security invoker
set search_path = ''
as $$
declare
  normalized_environment_key text := lower(trim(p_environment_key));
  target_environment public.corex_environments;
begin
  if normalized_environment_key is null
    or normalized_environment_key !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    or char_length(normalized_environment_key) > 63 then
    raise exception 'Corex environment key is invalid' using errcode = '22023';
  end if;

  insert into public.corex_environments (owner_user_id, environment_key)
  values (p_owner_user_id, normalized_environment_key)
  on conflict (owner_user_id, environment_key) do nothing;

  select * into target_environment
  from public.corex_environments
  where owner_user_id = p_owner_user_id
    and environment_key = normalized_environment_key
  for update;

  if target_environment.lifecycle <> 'active' then
    raise exception 'Corex environment is retired' using errcode = 'PT409';
  end if;

  return target_environment;
end;
$$;

create or replace function public.corex_ensure_route_namespace(
  p_environment_id uuid,
  p_owner_user_id uuid,
  p_route_namespace text
)
returns public.corex_route_namespaces
language plpgsql
security invoker
set search_path = ''
as $$
declare
  normalized_route_namespace text := lower(trim(p_route_namespace));
  target_environment public.corex_environments;
  target_namespace public.corex_route_namespaces;
begin
  if normalized_route_namespace is null
    or normalized_route_namespace !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    or char_length(normalized_route_namespace) > 63 then
    raise exception 'Corex route namespace is invalid' using errcode = '22023';
  end if;

  select * into target_environment
  from public.corex_environments
  where id = p_environment_id
    and owner_user_id = p_owner_user_id
    and lifecycle = 'active'
  for key share;

  if target_environment.id is null then
    raise exception 'Corex active environment not found' using errcode = 'P0002';
  end if;

  insert into public.corex_route_namespaces (
    environment_id,
    route_namespace,
    owner_user_id
  ) values (
    target_environment.id,
    normalized_route_namespace,
    target_environment.owner_user_id
  )
  on conflict (environment_id, route_namespace) do nothing;

  select * into target_namespace
  from public.corex_route_namespaces
  where environment_id = target_environment.id
    and route_namespace = normalized_route_namespace
    and owner_user_id = target_environment.owner_user_id
  for update;

  if target_namespace.lifecycle <> 'active' then
    raise exception 'Corex route namespace is retired' using errcode = 'PT409';
  end if;

  return target_namespace;
end;
$$;

create or replace function public.corex_retire_route_namespace(
  p_environment_id uuid,
  p_owner_user_id uuid,
  p_route_namespace text
)
returns public.corex_route_namespaces
language plpgsql
security invoker
set search_path = ''
as $$
declare
  normalized_route_namespace text := lower(trim(p_route_namespace));
  target_environment public.corex_environments;
  target_namespace public.corex_route_namespaces;
begin
  select * into target_environment
  from public.corex_environments
  where id = p_environment_id
    and owner_user_id = p_owner_user_id
  for update;

  if target_environment.id is null then
    raise exception 'Corex environment not found' using errcode = 'P0002';
  end if;

  if target_environment.environment_key = 'default'
    and normalized_route_namespace = 'default' then
    raise exception 'Corex default environment namespace cannot be retired' using errcode = 'PT403';
  end if;

  select * into target_namespace
  from public.corex_route_namespaces
  where environment_id = p_environment_id
    and route_namespace = normalized_route_namespace
    and owner_user_id = p_owner_user_id
  for update;

  if target_namespace.environment_id is null then
    raise exception 'Corex route namespace not found' using errcode = 'P0002';
  end if;

  if target_namespace.lifecycle = 'retired' then
    return target_namespace;
  end if;

  if exists (
    select 1
    from public.corex_active_http_routes
    where environment_id = target_namespace.environment_id
      and route_namespace = target_namespace.route_namespace
  ) then
    raise exception 'Corex route namespace is in use' using errcode = 'PT409';
  end if;

  update public.corex_route_namespaces
  set lifecycle = 'retired',
      retired_at = now()
  where environment_id = target_namespace.environment_id
    and route_namespace = target_namespace.route_namespace
  returning * into target_namespace;

  return target_namespace;
end;
$$;

create or replace function public.corex_retire_environment(
  p_environment_id uuid,
  p_owner_user_id uuid
)
returns public.corex_environments
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_environment public.corex_environments;
begin
  select * into target_environment
  from public.corex_environments
  where id = p_environment_id
    and owner_user_id = p_owner_user_id
  for update;

  if target_environment.id is null then
    raise exception 'Corex environment not found' using errcode = 'P0002';
  end if;

  if target_environment.environment_key = 'default' then
    raise exception 'Corex default environment cannot be retired' using errcode = 'PT403';
  end if;

  if target_environment.lifecycle = 'retired' then
    return target_environment;
  end if;

  if exists (
    select 1
    from public.corex_route_namespaces
    where environment_id = target_environment.id
      and lifecycle = 'active'
  ) then
    raise exception 'Corex environment has active route namespaces' using errcode = 'PT409';
  end if;

  update public.corex_environments
  set lifecycle = 'retired',
      retired_at = now()
  where id = target_environment.id
  returning * into target_environment;

  return target_environment;
end;
$$;

revoke all on function public.corex_retire_route_namespace(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.corex_retire_route_namespace(uuid, uuid, text) to service_role;

revoke all on function public.corex_retire_environment(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.corex_retire_environment(uuid, uuid) to service_role;
