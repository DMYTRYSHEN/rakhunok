create or replace function public.corex_request_run_cancellation(
  p_run_id uuid,
  p_owner_user_id uuid,
  p_request_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  existing_request public.corex_run_cancellation_requests;
  root_run public.corex_runs;
  lineage_root_id uuid;
  target_run public.corex_runs;
  workflow_ids text[] := '{}';
begin
  select * into existing_request
  from public.corex_run_cancellation_requests
  where owner_user_id = p_owner_user_id
    and request_id = p_request_id
  for update;

  if existing_request.request_id is not null then
    if existing_request.run_id <> p_run_id then
      raise exception 'Corex cancellation request conflicts' using errcode = '23505';
    end if;
    return jsonb_build_object(
      'id', existing_request.run_id,
      'status', existing_request.result_status,
      'accepted', true,
      'workflowInstanceIds', to_jsonb(existing_request.workflow_instance_ids)
    );
  end if;

  with recursive lineage as (
    select id, parent_run_id from public.corex_runs
    where id = p_run_id and owner_user_id = p_owner_user_id
    union all
    select parent.id, parent.parent_run_id
    from public.corex_runs parent
    join lineage child on child.parent_run_id = parent.id
    where parent.owner_user_id = p_owner_user_id
  )
  select id into lineage_root_id
  from lineage
  where parent_run_id is null;

  if lineage_root_id is null then
    raise exception 'Corex run is missing' using errcode = 'P0002';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(lineage_root_id::text, 0));

  select * into existing_request
  from public.corex_run_cancellation_requests
  where owner_user_id = p_owner_user_id
    and request_id = p_request_id
  for update;

  if existing_request.request_id is not null then
    if existing_request.run_id <> p_run_id then
      raise exception 'Corex cancellation request conflicts' using errcode = '23505';
    end if;
    return jsonb_build_object(
      'id', existing_request.run_id,
      'status', existing_request.result_status,
      'accepted', true,
      'workflowInstanceIds', to_jsonb(existing_request.workflow_instance_ids)
    );
  end if;

  select * into root_run
  from public.corex_runs
  where id = p_run_id
    and owner_user_id = p_owner_user_id
  for update;

  if root_run.id is null then
    raise exception 'Corex run is missing' using errcode = 'P0002';
  end if;

  insert into public.corex_run_cancellation_requests (
    owner_user_id, request_id, run_id, result_status
  ) values (
    p_owner_user_id, p_request_id, root_run.id,
    case when root_run.status in ('queued', 'running', 'waiting', 'waiting_for_pause', 'paused')
      then 'terminated'::public.corex_run_status else root_run.status end
  );

  for target_run in
    with recursive run_tree as (
      select id from public.corex_runs
      where id = root_run.id and owner_user_id = p_owner_user_id
      union all
      select child.id
      from public.corex_runs child
      join run_tree parent on child.parent_run_id = parent.id
      where child.owner_user_id = p_owner_user_id
    )
    select run.*
    from public.corex_runs run
    join run_tree tree on tree.id = run.id
    order by run.depth desc, run.created_at desc
    for update of run
  loop
    if target_run.status in ('queued', 'running', 'waiting', 'waiting_for_pause', 'paused') then
      update public.corex_runs
      set status = 'terminated',
          finished_at = coalesce(finished_at, now()),
          error = '{"code":"run_cancelled"}'::jsonb
      where id = target_run.id;

      insert into public.corex_outbox (
        owner_user_id, run_id, kind, semantic_key, workflow_instance_id, payload
      ) values (
        p_owner_user_id,
        target_run.id,
        'terminate_workflow',
        'terminate_workflow:' || target_run.id::text,
        target_run.workflow_instance_id,
        jsonb_build_object('requestId', p_request_id)
      ) on conflict (semantic_key) do nothing;

      insert into public.corex_run_events (
        run_id, owner_user_id, sequence, event_type, payload
      ) values (
        target_run.id,
        p_owner_user_id,
        coalesce((select max(sequence) + 1 from public.corex_run_events where run_id = target_run.id), 0),
        'run_cancelled',
        jsonb_build_object('requestId', p_request_id)
      );

      workflow_ids := array_append(workflow_ids, target_run.workflow_instance_id);
    end if;
  end loop;

  update public.corex_run_cancellation_requests
  set workflow_instance_ids = workflow_ids
  where owner_user_id = p_owner_user_id
    and request_id = p_request_id;

  return jsonb_build_object(
    'id', root_run.id,
    'status', case when root_run.status in ('queued', 'running', 'waiting', 'waiting_for_pause', 'paused') then 'terminated' else root_run.status::text end,
    'accepted', true,
    'workflowInstanceIds', to_jsonb(workflow_ids)
  );
end;
$$;

revoke all on function public.corex_request_run_cancellation(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.corex_request_run_cancellation(uuid, uuid, uuid) to service_role;

create or replace function public.corex_terminate_subprocess_run(
  p_run_id uuid,
  p_owner_user_id uuid,
  p_parent_run_id uuid,
  p_parent_step_id text,
  p_workflow_instance_id text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  child_run public.corex_runs;
begin
  select * into child_run
  from public.corex_runs
  where id = p_run_id
    and owner_user_id = p_owner_user_id
    and parent_run_id = p_parent_run_id
    and parent_step_id = p_parent_step_id
    and workflow_instance_id = p_workflow_instance_id
  for update;

  if child_run.id is null then
    raise exception 'Corex subprocess run is missing' using errcode = 'P0002';
  end if;

  if child_run.status in ('queued', 'running', 'waiting', 'waiting_for_pause', 'paused') then
    update public.corex_runs
    set status = 'terminated',
        finished_at = coalesce(finished_at, now()),
        error = '{"code":"parent_wait_failed"}'::jsonb
    where id = child_run.id
    returning * into child_run;
  end if;

  return jsonb_build_object(
    'id', child_run.id,
    'status', child_run.status,
    'workflowInstanceId', child_run.workflow_instance_id
  );
end;
$$;

revoke all on function public.corex_terminate_subprocess_run(uuid, uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.corex_terminate_subprocess_run(uuid, uuid, uuid, text, text) to service_role;