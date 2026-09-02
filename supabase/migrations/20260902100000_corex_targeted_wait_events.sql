alter table public.corex_external_event_requests
  add column step_id text
    check (step_id is null or step_id ~ '^[a-zA-Z_][a-zA-Z0-9_-]{0,99}$');

create table public.corex_active_waits (
  run_id uuid not null references public.corex_runs(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  execution_generation integer not null check (execution_generation > 0),
  step_id text not null check (step_id ~ '^[a-zA-Z_][a-zA-Z0-9_-]{0,99}$'),
  visit integer not null check (visit >= 0),
  event_type text not null check (event_type ~ '^[a-zA-Z_][a-zA-Z0-9_-]{0,99}$'),
  wait_event_type text not null check (wait_event_type ~ '^corex-wait-[a-zA-Z0-9_-]+$'),
  durable_step_name text not null check (char_length(durable_step_name) between 1 and 500),
  status text not null default 'active' check (status in ('active', 'completed')),
  registered_at timestamptz not null default statement_timestamp(),
  completed_at timestamptz,
  primary key (run_id, execution_generation, step_id, visit),
  check ((status = 'active' and completed_at is null) or (status = 'completed' and completed_at is not null))
);

create index corex_active_waits_delivery_idx
  on public.corex_active_waits (run_id, execution_generation, event_type, status);

alter table public.corex_approval_tasks
  add column step_id text
    check (step_id is null or step_id ~ '^[a-zA-Z_][a-zA-Z0-9_-]{0,99}$'),
  add column visit integer
    check (visit is null or visit >= 0);

create unique index corex_approval_tasks_branch_identity_idx
  on public.corex_approval_tasks (run_id, execution_generation, step_id, visit)
  where step_id is not null and visit is not null;

create function public.corex_register_active_wait(
  p_run_id uuid,
  p_owner_user_id uuid,
  p_execution_generation integer,
  p_step_id text,
  p_visit integer,
  p_event_type text,
  p_wait_event_type text,
  p_durable_step_name text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_run public.corex_runs;
  existing_wait public.corex_active_waits;
begin
  if p_execution_generation <= 0
    or p_visit < 0
    or p_step_id !~ '^[a-zA-Z_][a-zA-Z0-9_-]{0,99}$'
    or p_event_type !~ '^[a-zA-Z_][a-zA-Z0-9_-]{0,99}$'
    or lower(p_event_type) like 'corex-%'
    or p_wait_event_type !~ '^corex-wait-[a-zA-Z0-9_-]+$'
    or char_length(p_durable_step_name) not between 1 and 500
  then
    raise exception 'Invalid active wait' using errcode = '22023';
  end if;

  select * into target_run
  from public.corex_runs
  where id = p_run_id
    and owner_user_id = p_owner_user_id
  for update;

  if target_run.id is null then
    raise exception 'Corex run is missing' using errcode = 'PT404';
  end if;
  if target_run.execution_generation <> p_execution_generation then
    raise exception 'Corex run generation changed' using errcode = 'PT409';
  end if;

  select * into existing_wait
  from public.corex_active_waits
  where run_id = p_run_id
    and execution_generation = p_execution_generation
    and step_id = p_step_id
    and visit = p_visit;

  if existing_wait.run_id is not null then
    if existing_wait.owner_user_id <> p_owner_user_id
      or existing_wait.event_type <> p_event_type
      or existing_wait.wait_event_type <> p_wait_event_type
      or existing_wait.durable_step_name <> p_durable_step_name
    then
      raise exception 'Active wait identity conflicts' using errcode = 'PT409';
    end if;
    return jsonb_build_object('status', existing_wait.status);
  end if;

  insert into public.corex_active_waits (
    run_id, owner_user_id, execution_generation, step_id, visit,
    event_type, wait_event_type, durable_step_name
  ) values (
    p_run_id, p_owner_user_id, p_execution_generation, p_step_id, p_visit,
    p_event_type, p_wait_event_type, p_durable_step_name
  );

  return jsonb_build_object('status', 'active');
end;
$$;

create function public.corex_complete_active_wait(
  p_run_id uuid,
  p_owner_user_id uuid,
  p_execution_generation integer,
  p_step_id text,
  p_visit integer
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_run public.corex_runs;
  active_wait public.corex_active_waits;
begin
  select * into target_run
  from public.corex_runs
  where id = p_run_id
    and owner_user_id = p_owner_user_id
  for update;

  if target_run.id is null then
    raise exception 'Corex run is missing' using errcode = 'PT404';
  end if;
  if target_run.execution_generation <> p_execution_generation then
    raise exception 'Corex run generation changed' using errcode = 'PT409';
  end if;

  select * into active_wait
  from public.corex_active_waits
  where run_id = p_run_id
    and owner_user_id = p_owner_user_id
    and execution_generation = p_execution_generation
    and step_id = p_step_id
    and visit = p_visit
  for update;

  if active_wait.run_id is null then
    raise exception 'Active wait is missing' using errcode = 'PT404';
  end if;

  if active_wait.status = 'active' then
    update public.corex_active_waits
    set status = 'completed', completed_at = statement_timestamp()
    where run_id = p_run_id
      and execution_generation = p_execution_generation
      and step_id = p_step_id
      and visit = p_visit;

    if active_wait.event_type = 'approval' then
      update public.corex_approval_tasks
      set status = 'expired', decided_at = statement_timestamp()
      where run_id = p_run_id
        and owner_user_id = p_owner_user_id
        and execution_generation = p_execution_generation
        and step_id = p_step_id
        and visit = p_visit
        and status = 'pending';
    end if;
  end if;

  return jsonb_build_object('status', 'completed');
end;
$$;

revoke all on function public.corex_register_active_wait(uuid, uuid, integer, text, integer, text, text, text)
  from public, anon, authenticated;
grant execute on function public.corex_register_active_wait(uuid, uuid, integer, text, integer, text, text, text)
  to service_role;
revoke all on function public.corex_complete_active_wait(uuid, uuid, integer, text, integer)
  from public, anon, authenticated;
grant execute on function public.corex_complete_active_wait(uuid, uuid, integer, text, integer)
  to service_role;

create function public.corex_register_active_approval(
  p_run_id uuid,
  p_owner_user_id uuid,
  p_execution_generation integer,
  p_step_id text,
  p_visit integer,
  p_wait_event_type text,
  p_durable_step_name text,
  p_assignee_user_id uuid,
  p_timeout_ms integer
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_run public.corex_runs;
  target_task public.corex_approval_tasks;
begin
  if p_timeout_ms <= 0 then
    raise exception 'Invalid active approval' using errcode = '22023';
  end if;

  perform public.corex_register_active_wait(
    p_run_id,
    p_owner_user_id,
    p_execution_generation,
    p_step_id,
    p_visit,
    'approval',
    p_wait_event_type,
    p_durable_step_name
  );

  select * into target_run
  from public.corex_runs
  where id = p_run_id
    and owner_user_id = p_owner_user_id;

  insert into public.corex_approval_tasks (
    run_id, process_id, owner_user_id, assignee_user_id, execution_generation,
    step_name, step_id, visit, deadline_at
  ) values (
    p_run_id, target_run.process_id, p_owner_user_id, p_assignee_user_id, p_execution_generation,
    p_durable_step_name, p_step_id, p_visit,
    statement_timestamp() + make_interval(secs => p_timeout_ms / 1000.0)
  )
  on conflict (run_id, execution_generation, step_id, visit)
    where step_id is not null and visit is not null
  do nothing;

  select * into target_task
  from public.corex_approval_tasks
  where run_id = p_run_id
    and execution_generation = p_execution_generation
    and step_id = p_step_id
    and visit = p_visit;

  if target_task.id is null
    or target_task.owner_user_id <> p_owner_user_id
    or target_task.assignee_user_id <> p_assignee_user_id
    or target_task.step_name <> p_durable_step_name
  then
    raise exception 'Active approval identity conflicts' using errcode = 'PT409';
  end if;

  return jsonb_build_object('status', target_task.status, 'taskId', target_task.id);
end;
$$;

revoke all on function public.corex_register_active_approval(uuid, uuid, integer, text, integer, text, text, uuid, integer)
  from public, anon, authenticated;
grant execute on function public.corex_register_active_approval(uuid, uuid, integer, text, integer, text, text, uuid, integer)
  to service_role;

drop function public.corex_enqueue_workflow_event(uuid, uuid, uuid, text, jsonb);

create function public.corex_enqueue_workflow_event(
  p_run_id uuid,
  p_owner_user_id uuid,
  p_event_id uuid,
  p_step_id text,
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
  active_wait public.corex_active_waits;
  existing_request public.corex_external_event_requests;
  active_wait_count integer;
  inserted_request_count integer;
  wait_event_type text;
begin
  if p_event_type !~ '^[a-zA-Z_][a-zA-Z0-9_-]{0,99}$'
    or lower(p_event_type) like 'corex-%'
    or (p_step_id is not null and p_step_id !~ '^[a-zA-Z_][a-zA-Z0-9_-]{0,99}$')
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
      or existing_request.step_id is distinct from p_step_id
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

  select count(*) into active_wait_count
  from public.corex_active_waits wait
  where wait.run_id = target_run.id
    and wait.owner_user_id = p_owner_user_id
    and wait.execution_generation = target_run.execution_generation
    and wait.event_type = p_event_type
    and wait.status = 'active'
    and (p_step_id is null or wait.step_id = p_step_id);

  if active_wait_count = 1 then
    select * into active_wait
    from public.corex_active_waits wait
    where wait.run_id = target_run.id
      and wait.owner_user_id = p_owner_user_id
      and wait.execution_generation = target_run.execution_generation
      and wait.event_type = p_event_type
      and wait.status = 'active'
      and (p_step_id is null or wait.step_id = p_step_id);
  end if;

  wait_event_type := active_wait.wait_event_type;
  if active_wait_count <> 1
    or active_wait.status <> 'active'
    or wait_event_type !~ '^corex-wait-[a-zA-Z0-9_-]+$'
  then
    raise exception 'Run is not waiting for this event' using errcode = 'PT409';
  end if;

  insert into public.corex_external_event_requests (
    owner_user_id, event_id, run_id, step_id, event_type, payload
  ) values (
    p_owner_user_id, p_event_id, p_run_id, p_step_id, p_event_type,
    coalesce(p_payload, 'null'::jsonb)
  ) on conflict (owner_user_id, event_id) do nothing;
  get diagnostics inserted_request_count = row_count;

  if inserted_request_count = 0 then
    select * into existing_request
    from public.corex_external_event_requests
    where owner_user_id = p_owner_user_id
      and event_id = p_event_id
    for update;

    if existing_request.run_id <> p_run_id
      or existing_request.step_id is distinct from p_step_id
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

revoke all on function public.corex_enqueue_workflow_event(uuid, uuid, uuid, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.corex_enqueue_workflow_event(uuid, uuid, uuid, text, text, jsonb)
  to service_role;

drop function public.corex_decide_approval_task(uuid, uuid, text, text);

create function public.corex_decide_approval_task(
  p_run_id uuid,
  p_task_id uuid,
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
  registered_wait public.corex_active_waits;
  wait_event_type text;
begin
  if p_decision not in ('approved', 'rejected') or length(coalesce(p_comment, '')) > 2000 then
    raise exception 'Invalid approval decision' using errcode = '22023';
  end if;

  select * into target_run
  from public.corex_runs
  where id = p_run_id
  for update;

  if target_run.id is null or target_run.status <> 'waiting' then
    raise exception 'Run cannot accept approval' using errcode = '23505';
  end if;

  select * into target_task
  from public.corex_approval_tasks
  where id = p_task_id
    and run_id = p_run_id
    and execution_generation = target_run.execution_generation
    and assignee_user_id = p_actor_user_id
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

  if target_task.step_id is not null and target_task.visit is not null then
    select * into registered_wait
    from public.corex_active_waits wait
    where wait.run_id = target_task.run_id
      and wait.owner_user_id = target_task.owner_user_id
      and wait.execution_generation = target_task.execution_generation
      and wait.step_id = target_task.step_id
      and wait.visit = target_task.visit
      and wait.event_type = 'approval'
      and wait.status = 'active';
    wait_event_type := registered_wait.wait_event_type;
  else
    select * into active_wait
    from public.corex_run_events event
    where event.run_id = target_task.run_id
      and event.execution_generation = target_run.execution_generation
    order by event.sequence desc
    limit 1;
    wait_event_type := active_wait.payload ->> 'waitEventType';
    if active_wait.id is null
      or active_wait.event_type <> 'step_started'
      or active_wait.step_name is distinct from target_task.step_name
      or active_wait.payload ->> 'stepType' <> 'approval'
    then
      raise exception 'Approval step correlation is invalid' using errcode = '22023';
    end if;
  end if;

  if wait_event_type !~ '^corex-wait-[a-zA-Z0-9_-]+$' then
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

revoke all on function public.corex_decide_approval_task(uuid, uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.corex_decide_approval_task(uuid, uuid, uuid, text, text)
  to service_role;