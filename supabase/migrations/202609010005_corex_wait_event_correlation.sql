create or replace function public.corex_enqueue_workflow_event(
  p_run_id uuid,
  p_owner_user_id uuid,
  p_event_id uuid,
  p_event_type text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_run public.corex_runs;
  active_wait public.corex_run_events;
  existing_request public.corex_external_event_requests;
  inserted_request_count integer;
  wait_event_type text;
begin
  if p_event_type !~ '^[a-zA-Z_][a-zA-Z0-9_-]{0,99}$'
    or lower(p_event_type) like 'corex-%'
    or pg_catalog.pg_column_size(coalesce(p_payload, 'null'::jsonb)) > 65536
  then
    raise exception 'Invalid external event' using errcode = '22023';
  end if;

  select * into existing_request
  from public.corex_external_event_requests
  where owner_user_id = p_owner_user_id
    and event_id = p_event_id
  for update;

  if existing_request.event_id is not null then
    if existing_request.run_id <> p_run_id
      or existing_request.event_type <> p_event_type
      or existing_request.payload <> coalesce(p_payload, 'null'::jsonb)
    then
      raise exception 'External event ID conflicts' using errcode = 'PT409';
    end if;

    return jsonb_build_object('accepted', true, 'eventId', p_event_id);
  end if;

  select * into target_run
  from public.corex_runs
  where id = p_run_id
    and owner_user_id = p_owner_user_id
  for update;

  if target_run.id is null then
    raise exception 'Corex run is missing' using errcode = 'PT404';
  end if;

  if target_run.status <> 'waiting' then
    raise exception 'Run cannot accept events' using errcode = 'PT409';
  end if;

  select * into active_wait
  from public.corex_run_events event
  where event.run_id = target_run.id
  order by event.sequence desc
  limit 1;

  wait_event_type := active_wait.payload ->> 'waitEventType';
  if active_wait.id is null
    or active_wait.event_type <> 'step_started'
    or active_wait.payload ->> 'stepType' <> 'wait-event'
    or active_wait.payload ->> 'eventType' <> p_event_type
    or wait_event_type !~ '^corex-wait-[a-zA-Z0-9_-]+-[0-9]+$'
  then
    raise exception 'Run is not waiting for this event' using errcode = 'PT409';
  end if;

  insert into public.corex_external_event_requests (
    owner_user_id, event_id, run_id, event_type, payload
  ) values (
    p_owner_user_id, p_event_id, p_run_id, p_event_type, coalesce(p_payload, 'null'::jsonb)
  ) on conflict (owner_user_id, event_id) do nothing;
  get diagnostics inserted_request_count = row_count;

  if inserted_request_count = 0 then
    select * into existing_request
    from public.corex_external_event_requests
    where owner_user_id = p_owner_user_id
      and event_id = p_event_id
    for update;

    if existing_request.run_id <> p_run_id
      or existing_request.event_type <> p_event_type
      or existing_request.payload <> coalesce(p_payload, 'null'::jsonb)
    then
      raise exception 'External event ID conflicts' using errcode = 'PT409';
    end if;

    return jsonb_build_object('accepted', true, 'eventId', p_event_id);
  end if;

  insert into public.corex_outbox (
    owner_user_id, run_id, kind, semantic_key, workflow_instance_id, payload
  ) values (
    p_owner_user_id,
    target_run.id,
    'workflow_event',
    'workflow_event:external:' || p_owner_user_id::text || ':' || p_event_id::text,
    target_run.workflow_instance_id,
    jsonb_build_object('type', wait_event_type, 'payload', coalesce(p_payload, 'null'::jsonb))
  ) on conflict (semantic_key) do nothing;

  return jsonb_build_object('accepted', true, 'eventId', p_event_id);
end;
$$;

create or replace function public.corex_decide_approval_task(
  p_run_id uuid,
  p_actor_user_id uuid,
  p_decision text,
  p_comment text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_task public.corex_approval_tasks;
  target_run public.corex_runs;
  active_wait public.corex_run_events;
  wait_event_type text;
begin
  if p_decision not in ('approved', 'rejected') or length(coalesce(p_comment, '')) > 2000 then
    raise exception 'Invalid approval decision' using errcode = '22023';
  end if;

  select * into target_task
  from public.corex_approval_tasks
  where run_id = p_run_id
    and assignee_user_id = p_actor_user_id
  order by created_at desc
  limit 1
  for update;

  if target_task.id is null then
    raise exception 'Approval task is missing' using errcode = 'P0002';
  end if;

  if target_task.status = 'pending' and target_task.deadline_at <= now() then
    update public.corex_approval_tasks set status = 'expired' where id = target_task.id;
    raise exception 'Approval task expired' using errcode = '23505';
  end if;

  if target_task.status <> 'pending' and (
    target_task.status::text <> p_decision
    or target_task.decided_by is distinct from p_actor_user_id
    or target_task.decision_comment is distinct from nullif(p_comment, '')
  ) then
    raise exception 'Approval task already decided' using errcode = '23505';
  end if;

  select * into target_run
  from public.corex_runs
  where id = target_task.run_id
  for update;

  if target_run.id is null then
    raise exception 'Run cannot accept approval' using errcode = '23505';
  end if;

  if target_task.status <> 'pending' and target_run.status <> 'waiting' then
    return jsonb_build_object('accepted', true);
  end if;

  if target_run.status <> 'waiting' then
    raise exception 'Run cannot accept approval' using errcode = '23505';
  end if;

  select * into active_wait
  from public.corex_run_events event
  where event.run_id = target_task.run_id
  order by event.sequence desc
  limit 1;

  wait_event_type := active_wait.payload ->> 'waitEventType';
  if active_wait.id is null
    or active_wait.event_type <> 'step_started'
    or active_wait.step_name is distinct from target_task.step_name
    or active_wait.payload ->> 'stepType' <> 'approval'
    or wait_event_type !~ '^corex-wait-[a-zA-Z0-9_-]+-[0-9]+$'
  then
    raise exception 'Approval step correlation is invalid' using errcode = '22023';
  end if;

  if target_task.status = 'pending' then
    update public.corex_approval_tasks
    set status = p_decision::public.corex_approval_status,
        decision_comment = nullif(p_comment, ''),
        decided_by = p_actor_user_id,
        decided_at = now()
    where id = target_task.id
    returning * into target_task;
  end if;

  insert into public.corex_outbox (
    owner_user_id, run_id, kind, semantic_key, workflow_instance_id, payload
  ) values (
    target_run.owner_user_id,
    target_run.id,
    'workflow_event',
    'workflow_event:approval:' || target_task.id::text,
    target_run.workflow_instance_id,
    jsonb_build_object(
      'type', wait_event_type,
      'payload', jsonb_build_object(
        'decision', target_task.status::text,
        'comment', target_task.decision_comment,
        'actorUserId', target_task.decided_by,
        'taskId', target_task.id
      )
    )
  ) on conflict (semantic_key) do nothing;

  return jsonb_build_object('accepted', true);
end;
$$;

revoke all on function public.corex_enqueue_workflow_event(uuid, uuid, uuid, text, jsonb) from public, anon, authenticated;
revoke all on function public.corex_decide_approval_task(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.corex_enqueue_workflow_event(uuid, uuid, uuid, text, jsonb) to service_role;
grant execute on function public.corex_decide_approval_task(uuid, uuid, text, text) to service_role;