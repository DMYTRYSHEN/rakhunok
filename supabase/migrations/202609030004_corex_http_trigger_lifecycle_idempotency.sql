create table public.corex_http_trigger_lifecycle_requests (
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  process_id uuid not null references public.corex_processes(id) on delete cascade,
  action text not null check (action in ('deactivate', 'rollback')),
  expected_version integer not null,
  target_version integer,
  result jsonb,
  created_at timestamptz not null default now(),
  primary key (owner_user_id, request_id),
  check (
    (action = 'deactivate' and target_version is null)
    or (action = 'rollback' and target_version is not null)
  )
);

alter table public.corex_http_trigger_lifecycle_requests enable row level security;
revoke all on public.corex_http_trigger_lifecycle_requests from public, anon, authenticated;

drop function public.corex_deactivate_http_trigger(uuid, uuid, integer);

create or replace function public.corex_deactivate_http_trigger(
  p_process_id uuid,
  p_owner_user_id uuid,
  p_request_id uuid,
  p_expected_version integer
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  existing_request public.corex_http_trigger_lifecycle_requests;
  target_process public.corex_processes;
  operation_result jsonb;
begin
  insert into public.corex_http_trigger_lifecycle_requests (
    owner_user_id,
    request_id,
    process_id,
    action,
    expected_version
  ) values (
    p_owner_user_id,
    p_request_id,
    p_process_id,
    'deactivate',
    p_expected_version
  )
  on conflict (owner_user_id, request_id) do nothing;

  select * into existing_request
  from public.corex_http_trigger_lifecycle_requests
  where owner_user_id = p_owner_user_id
    and request_id = p_request_id
  for update;

  if existing_request.process_id <> p_process_id
    or existing_request.action <> 'deactivate'
    or existing_request.expected_version <> p_expected_version
    or existing_request.target_version is not null then
    raise exception 'Corex HTTP trigger lifecycle request conflicts' using errcode = 'PT409';
  end if;

  if existing_request.result is not null then
    return existing_request.result;
  end if;

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

  operation_result := jsonb_build_object(
    'processId', target_process.id,
    'version', target_process.published_version,
    'active', false
  );

  update public.corex_http_trigger_lifecycle_requests
  set result = operation_result
  where owner_user_id = p_owner_user_id
    and request_id = p_request_id;

  return operation_result;
end;
$$;

revoke all on function public.corex_deactivate_http_trigger(uuid, uuid, uuid, integer)
  from public, anon, authenticated;
grant execute on function public.corex_deactivate_http_trigger(uuid, uuid, uuid, integer) to service_role;

drop function public.corex_rollback_http_trigger(uuid, uuid, integer, integer);

create or replace function public.corex_rollback_http_trigger(
  p_process_id uuid,
  p_owner_user_id uuid,
  p_request_id uuid,
  p_expected_version integer,
  p_target_version integer
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  existing_request public.corex_http_trigger_lifecycle_requests;
  target_process public.corex_processes;
  target_version public.corex_process_versions;
  target_trigger public.corex_published_triggers;
  operation_result jsonb;
begin
  insert into public.corex_http_trigger_lifecycle_requests (
    owner_user_id,
    request_id,
    process_id,
    action,
    expected_version,
    target_version
  ) values (
    p_owner_user_id,
    p_request_id,
    p_process_id,
    'rollback',
    p_expected_version,
    p_target_version
  )
  on conflict (owner_user_id, request_id) do nothing;

  select * into existing_request
  from public.corex_http_trigger_lifecycle_requests
  where owner_user_id = p_owner_user_id
    and request_id = p_request_id
  for update;

  if existing_request.process_id <> p_process_id
    or existing_request.action <> 'rollback'
    or existing_request.expected_version <> p_expected_version
    or existing_request.target_version is distinct from p_target_version then
    raise exception 'Corex HTTP trigger lifecycle request conflicts' using errcode = 'PT409';
  end if;

  if existing_request.result is not null then
    return existing_request.result;
  end if;

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

  operation_result := jsonb_build_object(
    'processId', target_process.id,
    'version', target_version.version,
    'active', true
  );

  update public.corex_http_trigger_lifecycle_requests
  set result = operation_result
  where owner_user_id = p_owner_user_id
    and request_id = p_request_id;

  return operation_result;
end;
$$;

revoke all on function public.corex_rollback_http_trigger(uuid, uuid, uuid, integer, integer)
  from public, anon, authenticated;
grant execute on function public.corex_rollback_http_trigger(uuid, uuid, uuid, integer, integer) to service_role;