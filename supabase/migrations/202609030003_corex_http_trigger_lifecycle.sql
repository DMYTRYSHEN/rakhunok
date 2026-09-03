create or replace function public.corex_deactivate_http_trigger(
  p_process_id uuid,
  p_owner_user_id uuid,
  p_expected_version integer
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_process public.corex_processes;
begin
  select * into target_process
  from public.corex_processes
  where id = p_process_id
    and owner_user_id = p_owner_user_id
  for update;

  if target_process.id is null
    or target_process.published_version is distinct from p_expected_version then
    raise exception 'Corex trigger lifecycle conflict' using errcode = '40001';
  end if;

  delete from public.corex_active_http_routes
  where process_id = target_process.id;

  return jsonb_build_object(
    'processId', target_process.id,
    'version', target_process.published_version,
    'active', false
  );
end;
$$;

revoke all on function public.corex_deactivate_http_trigger(uuid, uuid, integer)
  from public, anon, authenticated;
grant execute on function public.corex_deactivate_http_trigger(uuid, uuid, integer) to service_role;

create or replace function public.corex_rollback_http_trigger(
  p_process_id uuid,
  p_owner_user_id uuid,
  p_expected_version integer,
  p_target_version integer
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_process public.corex_processes;
  target_version public.corex_process_versions;
  target_trigger public.corex_published_triggers;
begin
  select * into target_process
  from public.corex_processes
  where id = p_process_id
    and owner_user_id = p_owner_user_id
  for update;

  if target_process.id is null
    or target_process.published_version is distinct from p_expected_version then
    raise exception 'Corex trigger lifecycle conflict' using errcode = '40001';
  end if;

  select * into target_version
  from public.corex_process_versions
  where process_id = target_process.id
    and owner_user_id = target_process.owner_user_id
    and version = p_target_version;

  if target_version.id is null then
    raise exception 'Corex rollback version is missing' using errcode = 'P0002';
  end if;

  select * into target_trigger
  from public.corex_published_triggers
  where process_version_id = target_version.id
    and process_id = target_process.id
    and owner_user_id = target_process.owner_user_id;

  if target_trigger.id is null then
    raise exception 'Corex rollback trigger is missing' using errcode = 'P0002';
  end if;

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
      target_trigger.route_namespace,
      target_trigger.http_method,
      target_trigger.route_path,
      target_trigger.id,
      target_process.id
    );
  exception
    when unique_violation then
      raise exception 'Corex HTTP route conflict' using errcode = '23505';
  end;

  update public.corex_processes
  set lifecycle = 'published',
      published_version = target_version.version,
      updated_at = now()
  where id = target_process.id;

  return jsonb_build_object(
    'processId', target_process.id,
    'version', target_version.version,
    'active', true
  );
end;
$$;

revoke all on function public.corex_rollback_http_trigger(uuid, uuid, integer, integer)
  from public, anon, authenticated;
grant execute on function public.corex_rollback_http_trigger(uuid, uuid, integer, integer) to service_role;