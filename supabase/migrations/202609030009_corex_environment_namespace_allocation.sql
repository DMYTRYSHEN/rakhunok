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
    and environment_key = normalized_environment_key;

  return target_environment;
end;
$$;

revoke all on function public.corex_ensure_environment(uuid, text)
  from public, anon, authenticated;
grant execute on function public.corex_ensure_environment(uuid, text) to service_role;

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
  for key share;

  if target_environment.id is null then
    raise exception 'Corex environment not found' using errcode = 'P0002';
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
    and owner_user_id = target_environment.owner_user_id;

  return target_namespace;
end;
$$;

revoke all on function public.corex_ensure_route_namespace(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.corex_ensure_route_namespace(uuid, uuid, text) to service_role;
