alter table public.corex_runs
  drop constraint corex_runs_parent_run_id_fkey,
  add constraint corex_runs_parent_run_id_fkey
    foreign key (parent_run_id) references public.corex_runs(id) on delete cascade;

create or replace function corex_private.authorized_process_deletion(p_process_id uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.corex_operation_items item
    join public.corex_operations operation on operation.id = item.operation_id
    join public.corex_privileged_operators operator on operator.user_id = operation.requested_by
    where item.claim_token::text = nullif(current_setting('corex.deletion_claim_token', true), '')
      and item.status = 'processing'
      and item.lease_expires_at > now()
      and item.target_id = p_process_id::text
      and operation.kind = 'process_delete'
      and operator.can_delete_processes
      and (operator.expires_at is null or operator.expires_at > now())
  );
$$;

revoke all on function corex_private.authorized_process_deletion(uuid)
  from public, anon, authenticated;

create or replace function corex_private.reject_version_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' and corex_private.authorized_process_deletion(old.process_id) then
    return old;
  end if;
  raise exception 'Corex process versions are immutable';
end;
$$;

create or replace function corex_private.reject_published_trigger_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' and corex_private.authorized_process_deletion(old.process_id) then
    return old;
  end if;
  raise exception 'Corex published triggers are immutable';
end;
$$;

create or replace function public.corex_submit_batch_operation(
  p_owner_user_id uuid,
  p_requested_by uuid,
  p_request_id uuid,
  p_kind public.corex_operation_kind,
  p_items jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  existing_operation public.corex_operations;
  operation_fingerprint text;
  operation_id uuid;
  item_count integer;
begin
  if p_requested_by <> p_owner_user_id then
    raise exception 'Corex operation owner mismatch' using errcode = 'PT403';
  end if;
  if p_kind not in ('process_create', 'run_terminate', 'workflow_delete') then
    raise exception 'Unsupported Corex batch operation' using errcode = '22023';
  end if;
  if jsonb_typeof(p_items) <> 'array' then
    raise exception 'Corex operation items must be an array' using errcode = '22023';
  end if;
  item_count := jsonb_array_length(p_items);
  if item_count not between 1 and 100 then
    raise exception 'Corex operation item count is out of bounds' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_items) item
    where jsonb_typeof(item) <> 'object'
      or jsonb_typeof(item -> 'targetId') <> 'string'
      or char_length(item ->> 'targetId') not between 1 and 200
      or jsonb_typeof(coalesce(item -> 'payload', '{}'::jsonb)) <> 'object'
  ) then
    raise exception 'Invalid Corex operation item' using errcode = '22023';
  end if;
  if (
    select count(distinct item ->> 'targetId')
    from jsonb_array_elements(p_items) item
  ) <> item_count then
    raise exception 'Duplicate Corex operation target' using errcode = '22023';
  end if;
  if p_kind in ('run_terminate', 'workflow_delete') and exists (
    select 1 from jsonb_array_elements(p_items) item
    where coalesce(item -> 'payload', '{}'::jsonb) <> '{}'::jsonb
  ) then
    raise exception 'Corex batch payload is not allowed' using errcode = '22023';
  end if;

  operation_fingerprint := encode(extensions.digest(
    concat_ws(':', p_kind::text, p_owner_user_id, p_items::text), 'sha256'
  ), 'hex');
  select * into existing_operation
  from public.corex_operations
  where owner_user_id = p_owner_user_id and request_id = p_request_id
  for update;
  if existing_operation.id is not null then
    if existing_operation.kind <> p_kind or existing_operation.fingerprint <> operation_fingerprint then
      raise exception 'Corex operation request conflicts' using errcode = 'PT409';
    end if;
    return jsonb_build_object('id', existing_operation.id, 'status', existing_operation.status,
      'itemCount', existing_operation.item_count);
  end if;

  if p_kind in ('run_terminate', 'workflow_delete') and exists (
    select 1 from jsonb_array_elements(p_items) item
    left join public.corex_runs run
      on run.id::text = item ->> 'targetId' and run.owner_user_id = p_owner_user_id
    where run.id is null
  ) then
    raise exception 'Corex batch run is missing' using errcode = 'PT404';
  end if;
  if p_kind = 'process_create' and exists (
    select 1 from jsonb_array_elements(p_items) item
    left join public.corex_processes process
      on process.id::text = item #>> '{payload,processId}'
      and process.owner_user_id = p_owner_user_id and process.lifecycle = 'published'
    where process.id is null
      or (item ->> 'targetId') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  ) then
    raise exception 'Corex batch process is not executable' using errcode = 'PT422';
  end if;

  insert into public.corex_operations (
    owner_user_id, requested_by, request_id, kind, fingerprint, item_count
  ) values (
    p_owner_user_id, p_requested_by, p_request_id, p_kind, operation_fingerprint, item_count
  ) returning id into operation_id;

  insert into public.corex_operation_items (operation_id, ordinal, target_id, payload)
  select operation_id, ordinality - 1, item ->> 'targetId',
    coalesce(item -> 'payload', '{}'::jsonb) || case
      when p_kind in ('run_terminate', 'workflow_delete') then jsonb_build_object(
        'workflowInstanceId', run.workflow_instance_id
      )
      else '{}'::jsonb
    end
  from jsonb_array_elements(p_items) with ordinality as source(item, ordinality)
  left join public.corex_runs run
    on run.id::text = item ->> 'targetId' and run.owner_user_id = p_owner_user_id;

  return jsonb_build_object('id', operation_id, 'status', 'pending', 'itemCount', item_count);
end;
$$;

create or replace function public.corex_finalize_process_deletion(
  p_item_id uuid,
  p_claim_token uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_item public.corex_operation_items;
  target_operation public.corex_operations;
  target_process public.corex_processes;
  deleted_run_count integer;
  deleted_version_count integer;
begin
  select * into target_item from public.corex_operation_items
  where id = p_item_id
    and status = 'processing'
    and claim_token = p_claim_token
    and lease_expires_at > now()
    and payload ->> 'action' = 'process_finalize'
  for update;
  if target_item.id is null then
    raise exception 'Corex deletion claim is stale' using errcode = 'PT409';
  end if;
  select * into target_operation from public.corex_operations
  where id = target_item.operation_id and kind = 'process_delete'
  for update;
  if target_operation.id is null then
    raise exception 'Corex deletion operation is invalid' using errcode = 'PT409';
  end if;
  if exists (
    select 1 from public.corex_operation_items dependency
    where dependency.operation_id = target_item.operation_id
      and dependency.ordinal < target_item.ordinal
      and dependency.status <> 'complete'
  ) then
    raise exception 'Corex deletion cleanup is incomplete' using errcode = 'PT409';
  end if;
  if not exists (
    select 1 from public.corex_privileged_operators operator
    where operator.user_id = target_operation.requested_by and operator.can_delete_processes
      and (operator.expires_at is null or operator.expires_at > now())
  ) then
    raise exception 'Corex deletion authorization expired' using errcode = 'PT403';
  end if;
  select * into target_process from public.corex_processes
  where id::text = target_item.target_id and owner_user_id = target_operation.owner_user_id
  for update;
  if target_process.id is null then
    raise exception 'Corex process is missing' using errcode = 'PT404';
  end if;
  if target_process.lifecycle <> 'retired' then
    raise exception 'Corex process must remain retired' using errcode = 'PT409';
  end if;
  if exists (select 1 from public.corex_process_legal_holds hold
    where hold.process_id = target_process.id and hold.released_at is null) then
    raise exception 'Corex process is under legal hold' using errcode = 'PT423';
  end if;
  if exists (select 1 from public.corex_active_http_routes route
    where route.process_id = target_process.id) then
    raise exception 'Corex process still has an active route' using errcode = 'PT409';
  end if;
  if exists (select 1 from public.corex_runs run where run.process_id = target_process.id
    and run.status not in ('complete', 'errored', 'terminated')) then
    raise exception 'Corex process has active runs' using errcode = 'PT409';
  end if;

  select count(*) into deleted_run_count from public.corex_runs where process_id = target_process.id;
  select count(*) into deleted_version_count from public.corex_process_versions
    where process_id = target_process.id;
  perform set_config('corex.deletion_claim_token', p_claim_token::text, true);

  delete from public.corex_run_purge_jobs where run_id in (
    select id from public.corex_runs where process_id = target_process.id
  );
  delete from public.corex_http_route_reconciliations where desired_trigger_id in (
    select id from public.corex_published_triggers where process_id = target_process.id
  );
  delete from public.corex_active_http_routes where process_id = target_process.id;
  delete from public.corex_published_trigger_registrations where process_id = target_process.id;
  delete from public.corex_published_triggers where process_id = target_process.id;
  delete from public.corex_runs where process_id = target_process.id;

  insert into public.corex_process_deletion_tombstones (
    process_id, owner_user_id, operation_id, slug, process_name, deleted_by,
    run_count, version_count
  ) values (
    target_process.id, target_process.owner_user_id, target_operation.id,
    target_process.slug, target_process.name, target_operation.requested_by,
    deleted_run_count, deleted_version_count
  );
  delete from public.corex_process_versions where process_id = target_process.id;
  delete from public.corex_processes where id = target_process.id;

  update public.corex_operation_items
  set status = 'complete', result = jsonb_build_object('deleted', true), completed_at = now(),
    claim_token = null, lease_expires_at = null, error_code = null
  where id = target_item.id;
  perform corex_private.refresh_operation(target_operation.id);
  return jsonb_build_object('accepted', true, 'deleted', true);
end;
$$;

revoke all on function public.corex_submit_batch_operation(uuid, uuid, uuid, public.corex_operation_kind, jsonb)
  from public, anon, authenticated;
revoke all on function public.corex_finalize_process_deletion(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.corex_submit_batch_operation(uuid, uuid, uuid, public.corex_operation_kind, jsonb)
  to service_role;
grant execute on function public.corex_finalize_process_deletion(uuid, uuid) to service_role;