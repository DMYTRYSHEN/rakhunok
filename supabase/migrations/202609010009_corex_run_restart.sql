alter table public.corex_runs
  add column execution_generation integer not null default 1
    check (execution_generation > 0);

alter table public.corex_run_events
  add column execution_generation integer not null default 1
    check (execution_generation > 0),
  drop constraint corex_run_events_run_id_sequence_key,
  add unique (run_id, execution_generation, sequence);

alter table public.corex_approval_tasks
  add column execution_generation integer not null default 1
    check (execution_generation > 0),
  drop constraint corex_approval_tasks_run_id_step_name_key,
  add unique (run_id, execution_generation, step_name);

alter table public.corex_outbox
  drop constraint corex_outbox_kind_check,
  add constraint corex_outbox_kind_check check (
    kind in (
      'terminate_workflow',
      'workflow_event',
      'parent_callback',
      'pause_workflow',
      'resume_workflow',
      'restart_workflow'
    )
  );

create table public.corex_run_restart_requests (
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  run_id uuid not null references public.corex_runs(id) on delete cascade,
  from_step jsonb,
  result_generation integer not null check (result_generation > 1),
  created_at timestamptz not null default now(),
  primary key (owner_user_id, request_id)
);

alter table public.corex_run_restart_requests enable row level security;
revoke all on public.corex_run_restart_requests from public, anon, authenticated;

create or replace function public.corex_request_run_restart(
  p_run_id uuid,
  p_owner_user_id uuid,
  p_request_id uuid,
  p_from jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  existing_request public.corex_run_restart_requests;
  target_run public.corex_runs;
  normalized_from jsonb;
  restart_sequence integer;
  next_generation integer;
begin
  if p_from is not null then
    if jsonb_typeof(p_from) <> 'object'
      or not (p_from ? 'name')
      or p_from ->> 'name' !~ '^[^[:cntrl:]]{1,100}$'
      or p_from - array['name', 'count', 'type'] <> '{}'::jsonb
      or (p_from ? 'count' and (
        jsonb_typeof(p_from -> 'count') <> 'number'
        or (p_from ->> 'count') !~ '^[1-9][0-9]*$'
        or (p_from ->> 'count')::numeric > 2147483647
      ))
      or (p_from ? 'type' and (
        jsonb_typeof(p_from -> 'type') <> 'string'
        or p_from ->> 'type' not in ('do', 'sleep', 'waitForEvent')
      ))
    then
      raise exception 'Invalid Corex restart step' using errcode = '22023';
    end if;

    normalized_from := jsonb_strip_nulls(jsonb_build_object(
      'name', p_from ->> 'name',
      'count', case when p_from ? 'count' then (p_from ->> 'count')::integer else null end,
      'type', case when p_from ? 'type' then p_from ->> 'type' else null end
    ));
  end if;

  select * into existing_request
  from public.corex_run_restart_requests
  where owner_user_id = p_owner_user_id
    and request_id = p_request_id
  for update;

  if existing_request.request_id is not null then
    if existing_request.run_id <> p_run_id
      or existing_request.from_step is distinct from normalized_from
    then
      raise exception 'Corex restart request conflicts' using errcode = 'PT409';
    end if;

    return jsonb_build_object(
      'id', existing_request.run_id,
      'status', 'queued',
      'executionGeneration', existing_request.result_generation,
      'accepted', true
    );
  end if;

  select * into target_run
  from public.corex_runs
  where id = p_run_id
    and owner_user_id = p_owner_user_id
  for update;

  if target_run.id is null then
    raise exception 'Corex run is missing' using errcode = 'PT404';
  end if;

  select * into existing_request
  from public.corex_run_restart_requests
  where owner_user_id = p_owner_user_id
    and request_id = p_request_id
  for update;

  if existing_request.request_id is not null then
    if existing_request.run_id <> p_run_id
      or existing_request.from_step is distinct from normalized_from
    then
      raise exception 'Corex restart request conflicts' using errcode = 'PT409';
    end if;

    return jsonb_build_object(
      'id', existing_request.run_id,
      'status', 'queued',
      'executionGeneration', existing_request.result_generation,
      'accepted', true
    );
  end if;

  if target_run.status not in ('complete', 'errored', 'terminated') then
    raise exception 'Corex run cannot be restarted' using errcode = 'PT409';
  end if;

  select coalesce(max(sequence) + 1, 0) into restart_sequence
  from public.corex_run_events
  where run_id = target_run.id
    and execution_generation = target_run.execution_generation;

  insert into public.corex_run_events (
    run_id, owner_user_id, execution_generation, sequence, event_type, payload
  ) values (
    target_run.id,
    p_owner_user_id,
    target_run.execution_generation,
    restart_sequence,
    'run_restart_requested',
    jsonb_strip_nulls(jsonb_build_object('requestId', p_request_id, 'from', normalized_from))
  );

  next_generation := target_run.execution_generation + 1;

  update public.corex_approval_tasks
  set status = 'expired'
  where run_id = target_run.id
    and execution_generation = target_run.execution_generation
    and status = 'pending';

  update public.corex_runs
  set status = 'queued',
      execution_generation = target_run.execution_generation + 1,
      output = null,
      error = null,
      started_at = null,
      finished_at = null
  where id = target_run.id;

  insert into public.corex_run_restart_requests (
    owner_user_id, request_id, run_id, from_step, result_generation
  ) values (
    p_owner_user_id, p_request_id, target_run.id, normalized_from, next_generation
  );

  insert into public.corex_outbox (
    owner_user_id, run_id, kind, semantic_key, workflow_instance_id, payload
  ) values (
    p_owner_user_id,
    target_run.id,
    'restart_workflow',
    'restart_workflow:' || p_owner_user_id::text || ':' || p_request_id::text,
    target_run.workflow_instance_id,
    jsonb_strip_nulls(jsonb_build_object(
      'requestId', p_request_id,
      'from', normalized_from,
      'executionGeneration', next_generation
    ))
  );

  return jsonb_build_object(
    'id', target_run.id,
    'status', 'queued',
    'executionGeneration', next_generation,
    'accepted', true
  );
end;
$$;

revoke all on function public.corex_request_run_restart(uuid, uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.corex_request_run_restart(uuid, uuid, uuid, jsonb) to service_role;

create or replace function public.corex_get_run_execution_generation(
  p_run_id uuid,
  p_owner_user_id uuid
)
returns integer
language sql
stable
security invoker
set search_path = ''
as $$
  select execution_generation
  from public.corex_runs
  where id = p_run_id
    and owner_user_id = p_owner_user_id;
$$;

revoke all on function public.corex_get_run_execution_generation(uuid, uuid) from public, anon, authenticated;
grant execute on function public.corex_get_run_execution_generation(uuid, uuid) to service_role;

create or replace function public.corex_assign_run_event_generation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  select execution_generation into new.execution_generation
  from public.corex_runs
  where id = new.run_id;

  if new.execution_generation is null then
    raise exception 'Corex run is missing' using errcode = 'P0002';
  end if;
  return new;
end;
$$;

create trigger corex_run_event_assigns_generation
before insert on public.corex_run_events
for each row execute function public.corex_assign_run_event_generation();

create or replace function public.corex_create_approval_task_from_event()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_run public.corex_runs;
begin
  if new.event_type <> 'step_started' or new.payload ->> 'stepType' <> 'approval' then
    return new;
  end if;

  select * into target_run from public.corex_runs where id = new.run_id;

  insert into public.corex_approval_tasks (
    run_id,
    process_id,
    owner_user_id,
    assignee_user_id,
    execution_generation,
    step_name,
    deadline_at
  ) values (
    new.run_id,
    target_run.process_id,
    new.owner_user_id,
    (new.payload ->> 'assigneeUserId')::uuid,
    new.execution_generation,
    new.step_name,
    now() + make_interval(secs => ((new.payload ->> 'timeoutMs')::bigint / 1000.0))
  )
  on conflict (run_id, execution_generation, step_name) do nothing;

  return new;
end;
$$;

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
    and event.execution_generation = target_run.execution_generation
  order by event.sequence desc
  limit 1;

  wait_event_type := active_wait.payload ->> 'waitEventType';
  if active_wait.id is null
    or active_wait.event_type <> 'step_started'
    or active_wait.payload ->> 'stepType' <> 'wait-event'
    or active_wait.payload ->> 'eventType' <> p_event_type
    or wait_event_type !~ '^corex-wait-[a-zA-Z0-9_-]+-[0-9]+-[0-9]+$'
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

  select * into target_run
  from public.corex_runs
  where id = p_run_id
  for update;

  if target_run.id is null or target_run.status <> 'waiting' then
    raise exception 'Run cannot accept approval' using errcode = '23505';
  end if;

  select * into target_task
  from public.corex_approval_tasks
  where run_id = p_run_id
    and execution_generation = target_run.execution_generation
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
    or wait_event_type !~ '^corex-wait-[a-zA-Z0-9_-]+-[0-9]+-[0-9]+$'
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

create or replace function public.corex_record_run_event(
  p_run_id uuid,
  p_owner_user_id uuid,
  p_sequence integer,
  p_status public.corex_run_status,
  p_event_type text,
  p_step_name text,
  p_payload jsonb,
  p_output jsonb,
  p_error jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_run public.corex_runs;
  parent_run public.corex_runs;
  existing_event public.corex_run_events;
  persisted_status public.corex_run_status;
begin
  if p_sequence < 0 or p_event_type !~ '^[a-zA-Z0-9_][a-zA-Z0-9_-]*$' then
    raise exception 'Invalid Corex run event' using errcode = '22023';
  end if;

  select * into target_run
  from public.corex_runs
  where id = p_run_id
    and owner_user_id = p_owner_user_id
  for update;

  if target_run.id is null then
    raise exception 'Corex run is missing' using errcode = 'P0002';
  end if;

  select * into existing_event
  from public.corex_run_events
  where run_id = target_run.id
    and execution_generation = target_run.execution_generation
    and sequence = p_sequence;

  if existing_event.id is not null then
    if existing_event.event_type <> p_event_type
      or existing_event.step_name is distinct from p_step_name
      or existing_event.payload <> coalesce(p_payload, '{}'::jsonb)
    then
      raise exception 'Conflicting Corex run event' using errcode = '22023';
    end if;

    return jsonb_build_object(
      'id', target_run.id,
      'status', target_run.status,
      'executionGeneration', target_run.execution_generation
    );
  end if;

  if not (
    target_run.status = p_status
    or (target_run.status = 'queued' and p_status = 'running')
    or (target_run.status = 'running' and p_status in ('waiting', 'complete', 'errored'))
    or (target_run.status = 'waiting' and p_status in ('running', 'errored'))
    or (
      target_run.status = 'waiting_for_pause'
      and p_status in ('running', 'waiting', 'complete', 'errored')
    )
  ) then
    raise exception 'Invalid Corex run status transition' using errcode = '22023';
  end if;

  insert into public.corex_run_events (
    run_id, owner_user_id, execution_generation, sequence, event_type, step_name, payload
  ) values (
    target_run.id,
    target_run.owner_user_id,
    target_run.execution_generation,
    p_sequence,
    p_event_type,
    p_step_name,
    coalesce(p_payload, '{}'::jsonb)
  );

  persisted_status := case
    when target_run.status = 'waiting_for_pause' and p_status in ('running', 'waiting')
      then 'waiting_for_pause'::public.corex_run_status
    else p_status
  end;

  update public.corex_runs
  set status = persisted_status,
      started_at = case when p_status = 'running' then coalesce(started_at, now()) else started_at end,
      finished_at = case when p_status in ('complete', 'errored') then coalesce(finished_at, now()) else finished_at end,
      output = case when p_status = 'complete' then p_output else output end,
      error = case when p_status = 'errored' then p_error else error end
  where id = target_run.id
  returning * into target_run;

  if target_run.parent_run_id is not null and p_status in ('complete', 'errored') then
    select * into parent_run
    from public.corex_runs
    where id = target_run.parent_run_id
      and owner_user_id = target_run.owner_user_id;

    if parent_run.id is null then
      raise exception 'Corex parent run is missing' using errcode = 'P0002';
    end if;

    insert into public.corex_outbox (
      owner_user_id, run_id, kind, semantic_key, workflow_instance_id, payload
    ) values (
      target_run.owner_user_id,
      target_run.id,
      'parent_callback',
      'parent_callback:' || target_run.id::text || ':' || target_run.execution_generation::text,
      parent_run.workflow_instance_id,
      jsonb_build_object(
        'type', 'corex-subprocess-result:' || target_run.id::text,
        'payload', jsonb_strip_nulls(jsonb_build_object(
          'childRunId', target_run.id,
          'status', p_status::text,
          'output', case when p_status = 'complete' then p_output else null end
        ))
      )
    ) on conflict (semantic_key) do nothing;
  end if;

  return jsonb_build_object(
    'id', target_run.id,
    'status', target_run.status,
    'executionGeneration', target_run.execution_generation
  );
end;
$$;

revoke all on function public.corex_record_run_event(uuid, uuid, integer, public.corex_run_status, text, text, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.corex_record_run_event(uuid, uuid, integer, public.corex_run_status, text, text, jsonb, jsonb, jsonb) to service_role;