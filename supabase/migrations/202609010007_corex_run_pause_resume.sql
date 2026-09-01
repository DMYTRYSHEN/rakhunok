alter table public.corex_outbox
  drop constraint corex_outbox_kind_check,
  add constraint corex_outbox_kind_check check (
    kind in (
      'terminate_workflow',
      'workflow_event',
      'parent_callback',
      'pause_workflow',
      'resume_workflow'
    )
  );

create table public.corex_run_lifecycle_requests (
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  run_id uuid not null references public.corex_runs(id) on delete cascade,
  command text not null check (command in ('pause', 'resume')),
  result_status public.corex_run_status not null,
  created_at timestamptz not null default now(),
  primary key (owner_user_id, request_id)
);

alter table public.corex_run_lifecycle_requests enable row level security;
revoke all on public.corex_run_lifecycle_requests from public, anon, authenticated;

create or replace function public.corex_request_run_lifecycle(
  p_run_id uuid,
  p_owner_user_id uuid,
  p_request_id uuid,
  p_command text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  existing_request public.corex_run_lifecycle_requests;
  target_run public.corex_runs;
  next_status public.corex_run_status;
begin
  if p_command not in ('pause', 'resume') then
    raise exception 'Invalid Corex lifecycle command' using errcode = '22023';
  end if;

  select * into existing_request
  from public.corex_run_lifecycle_requests
  where owner_user_id = p_owner_user_id
    and request_id = p_request_id
  for update;

  if existing_request.request_id is not null then
    if existing_request.run_id <> p_run_id or existing_request.command <> p_command then
      raise exception 'Corex lifecycle request conflicts' using errcode = 'PT409';
    end if;
    return jsonb_build_object(
      'id', existing_request.run_id,
      'status', existing_request.result_status,
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
  from public.corex_run_lifecycle_requests
  where owner_user_id = p_owner_user_id
    and request_id = p_request_id
  for update;

  if existing_request.request_id is not null then
    if existing_request.run_id <> p_run_id or existing_request.command <> p_command then
      raise exception 'Corex lifecycle request conflicts' using errcode = 'PT409';
    end if;
    return jsonb_build_object(
      'id', existing_request.run_id,
      'status', existing_request.result_status,
      'accepted', true
    );
  end if;

  if p_command = 'pause' then
    if target_run.status not in ('running', 'waiting') then
      raise exception 'Corex run cannot be paused' using errcode = 'PT409';
    end if;
    next_status := 'waiting_for_pause';
  else
    if target_run.status <> 'paused' then
      raise exception 'Corex run cannot be resumed' using errcode = 'PT409';
    end if;
    next_status := 'paused';
  end if;

  insert into public.corex_run_lifecycle_requests (
    owner_user_id, request_id, run_id, command, result_status
  ) values (
    p_owner_user_id, p_request_id, target_run.id, p_command, next_status
  );

  if p_command = 'pause' then
    update public.corex_runs
    set status = next_status
    where id = target_run.id;
  end if;

  insert into public.corex_outbox (
    owner_user_id, run_id, kind, semantic_key, workflow_instance_id, payload
  ) values (
    p_owner_user_id,
    target_run.id,
    p_command || '_workflow',
    p_command || '_workflow:' || p_owner_user_id::text || ':' || p_request_id::text,
    target_run.workflow_instance_id,
    jsonb_build_object('requestId', p_request_id)
  );

  insert into public.corex_run_events (
    run_id, owner_user_id, sequence, event_type, payload
  ) values (
    target_run.id,
    p_owner_user_id,
    coalesce((select max(sequence) + 1 from public.corex_run_events where run_id = target_run.id), 0),
    'run_' || p_command || '_requested',
    jsonb_build_object('requestId', p_request_id)
  );

  return jsonb_build_object(
    'id', target_run.id,
    'status', next_status,
    'accepted', true
  );
end;
$$;

create or replace function public.corex_claim_outbox(
  p_limit integer default 25,
  p_lease_seconds integer default 60
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  claimed jsonb;
begin
  if p_limit not between 1 and 100 or p_lease_seconds not between 10 and 300 then
    raise exception 'Invalid Corex outbox claim bounds' using errcode = '22023';
  end if;

  with candidates as (
    select id
    from public.corex_outbox
    where delivered_at is null
      and dead_lettered_at is null
      and attempts < 8
      and available_at <= now()
      and (lease_expires_at is null or lease_expires_at <= now())
    order by available_at, created_at
    limit p_limit
    for update skip locked
  ), leased as (
    update public.corex_outbox item
    set attempts = item.attempts + 1,
        claim_token = gen_random_uuid(),
        lease_expires_at = now() + make_interval(secs => p_lease_seconds)
    from candidates
    where item.id = candidates.id
    returning item.*
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', id,
    'kind', kind,
    'workflowInstanceId', workflow_instance_id,
    'payload', payload,
    'attempts', attempts,
    'claimToken', claim_token
  ) order by created_at), '[]'::jsonb)
  into claimed
  from leased;

  return claimed;
end;
$$;

create or replace function public.corex_reconcile_lifecycle_outbox(
  p_outbox_id uuid,
  p_claim_token uuid,
  p_workflow_status text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_item public.corex_outbox;
  reconciled_status public.corex_run_status;
begin
  select * into target_item
  from public.corex_outbox
  where id = p_outbox_id
    and claim_token = p_claim_token
    and delivered_at is null
    and dead_lettered_at is null
    and lease_expires_at > now()
  for update;

  if target_item.id is null then
    raise exception 'Corex outbox lease is stale' using errcode = '40001';
  end if;

  if target_item.kind = 'pause_workflow' then
    if p_workflow_status = 'waitingForPause' then
      reconciled_status := 'waiting_for_pause';
    elsif p_workflow_status = 'paused' then
      reconciled_status := 'paused';
    else
      raise exception 'Workflow pause is not reconciled' using errcode = 'PT409';
    end if;
  elsif target_item.kind = 'resume_workflow' and p_workflow_status = 'running' then
    reconciled_status := 'running';
  else
    raise exception 'Workflow lifecycle intent is not reconciled' using errcode = 'PT409';
  end if;

  update public.corex_runs
  set status = reconciled_status
  where id = target_item.run_id
    and owner_user_id = target_item.owner_user_id
    and status in ('waiting_for_pause', 'paused');

  if not found then
    raise exception 'Corex run lifecycle changed' using errcode = '40001';
  end if;

  if p_workflow_status = 'waitingForPause' then
    update public.corex_outbox
    set attempts = greatest(attempts - 1, 0),
        available_at = now() + interval '5 seconds',
        claim_token = null,
        lease_expires_at = null,
        last_error = null
    where id = target_item.id;

    return jsonb_build_object('accepted', true, 'delivered', false, 'status', reconciled_status);
  end if;

  update public.corex_outbox
  set delivered_at = now(),
      claim_token = null,
      lease_expires_at = null,
      last_error = null
  where id = target_item.id;

  return jsonb_build_object('accepted', true, 'delivered', true, 'status', reconciled_status);
end;
$$;

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
    and sequence = p_sequence;

  if existing_event.id is not null then
    if existing_event.event_type <> p_event_type
      or existing_event.step_name is distinct from p_step_name
      or existing_event.payload <> coalesce(p_payload, '{}'::jsonb)
    then
      raise exception 'Conflicting Corex run event' using errcode = '22023';
    end if;

    return jsonb_build_object('id', target_run.id, 'status', target_run.status);
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
    run_id, owner_user_id, sequence, event_type, step_name, payload
  ) values (
    target_run.id, target_run.owner_user_id, p_sequence, p_event_type, p_step_name,
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
      'parent_callback:' || target_run.id::text,
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

  return jsonb_build_object('id', target_run.id, 'status', target_run.status);
end;
$$;

revoke all on function public.corex_request_run_lifecycle(uuid, uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.corex_claim_outbox(integer, integer) from public, anon, authenticated;
revoke all on function public.corex_reconcile_lifecycle_outbox(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.corex_record_run_event(uuid, uuid, integer, public.corex_run_status, text, text, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.corex_request_run_lifecycle(uuid, uuid, uuid, text) to service_role;
grant execute on function public.corex_claim_outbox(integer, integer) to service_role;
grant execute on function public.corex_reconcile_lifecycle_outbox(uuid, uuid, text) to service_role;
grant execute on function public.corex_record_run_event(uuid, uuid, integer, public.corex_run_status, text, text, jsonb, jsonb, jsonb) to service_role;