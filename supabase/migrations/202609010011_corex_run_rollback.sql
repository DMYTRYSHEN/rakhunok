alter table public.corex_runs
  add column rollback_outcome text check (rollback_outcome in ('complete', 'failed')),
  add column rollback_error jsonb;

alter table public.corex_outbox
  drop constraint corex_outbox_kind_check,
  add constraint corex_outbox_kind_check check (
    kind in (
      'terminate_workflow',
      'workflow_event',
      'parent_callback',
      'pause_workflow',
      'resume_workflow',
      'restart_workflow',
      'rollback_workflow'
    )
  );

create table public.corex_run_rollback_requests (
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  run_id uuid not null references public.corex_runs(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (owner_user_id, request_id)
);

alter table public.corex_run_rollback_requests enable row level security;
revoke all on public.corex_run_rollback_requests from public, anon, authenticated;

create or replace function public.corex_request_run_rollback(
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
  existing_request public.corex_run_rollback_requests;
  target_run public.corex_runs;
begin
  select * into existing_request
  from public.corex_run_rollback_requests
  where owner_user_id = p_owner_user_id
    and request_id = p_request_id
  for update;

  if existing_request.request_id is not null then
    if existing_request.run_id <> p_run_id then
      raise exception 'Corex rollback request conflicts' using errcode = 'PT409';
    end if;

    select * into target_run
    from public.corex_runs
    where id = existing_request.run_id
      and owner_user_id = p_owner_user_id;

    return jsonb_strip_nulls(jsonb_build_object(
      'id', existing_request.run_id,
      'status', target_run.status,
      'rollbackOutcome', target_run.rollback_outcome,
      'accepted', true
    ));
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
  from public.corex_run_rollback_requests
  where owner_user_id = p_owner_user_id
    and request_id = p_request_id
  for update;

  if existing_request.request_id is not null then
    if existing_request.run_id <> p_run_id then
      raise exception 'Corex rollback request conflicts' using errcode = 'PT409';
    end if;

    return jsonb_strip_nulls(jsonb_build_object(
      'id', existing_request.run_id,
      'status', target_run.status,
      'rollbackOutcome', target_run.rollback_outcome,
      'accepted', true
    ));
  end if;

  if target_run.status not in ('queued', 'running', 'waiting', 'waiting_for_pause', 'paused') then
    raise exception 'Corex run cannot be rolled back' using errcode = 'PT409';
  end if;

  insert into public.corex_run_rollback_requests (owner_user_id, request_id, run_id)
  values (p_owner_user_id, p_request_id, target_run.id);

  update public.corex_approval_tasks
  set status = 'expired'
  where run_id = target_run.id
    and execution_generation = target_run.execution_generation
    and status = 'pending';

  update public.corex_runs
  set status = 'rolling_back',
      rollback_outcome = null,
      rollback_error = null
  where id = target_run.id;

  insert into public.corex_outbox (
    owner_user_id, run_id, kind, semantic_key, workflow_instance_id, payload
  ) values (
    p_owner_user_id,
    target_run.id,
    'rollback_workflow',
    'rollback_workflow:' || p_owner_user_id::text || ':' || p_request_id::text,
    target_run.workflow_instance_id,
    jsonb_build_object('requestId', p_request_id)
  );

  insert into public.corex_run_events (
    run_id, owner_user_id, execution_generation, sequence, event_type, payload
  ) values (
    target_run.id,
    p_owner_user_id,
    target_run.execution_generation,
    coalesce((
      select max(sequence) + 1
      from public.corex_run_events
      where run_id = target_run.id
        and execution_generation = target_run.execution_generation
    ), 0),
    'run_rollback_requested',
    jsonb_build_object('requestId', p_request_id)
  );

  return jsonb_build_object(
    'id', target_run.id,
    'status', 'rolling_back',
    'accepted', true
  );
end;
$$;

create or replace function public.corex_reconcile_rollback_outbox(
  p_outbox_id uuid,
  p_claim_token uuid,
  p_workflow_status text,
  p_rollback jsonb,
  p_platform_accepted boolean
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_item public.corex_outbox;
  resolved_rollback_outcome text;
  resolved_rollback_error jsonb;
  next_sequence integer;
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

  if target_item.kind <> 'rollback_workflow' then
    raise exception 'Corex outbox item is not a rollback' using errcode = 'PT409';
  end if;

  if p_workflow_status = 'running' and p_rollback is null then
    update public.corex_outbox
    set attempts = greatest(attempts - 1, 0),
        available_at = now() + interval '5 seconds',
        payload = case
          when p_platform_accepted then payload || '{"platformAccepted":true}'::jsonb
          else payload
        end,
        claim_token = null,
        lease_expires_at = null,
        last_error = null
    where id = target_item.id;

    return jsonb_build_object('accepted', true, 'delivered', false, 'status', 'rolling_back');
  end if;

  if p_workflow_status <> 'terminated'
    or jsonb_typeof(p_rollback) <> 'object'
    or p_rollback ->> 'outcome' not in ('complete', 'failed')
    or (
      p_rollback ->> 'outcome' = 'complete'
      and coalesce(p_rollback -> 'error', 'null'::jsonb) <> 'null'::jsonb
    )
    or (
      p_rollback ->> 'outcome' = 'failed'
      and (
        jsonb_typeof(p_rollback -> 'error') <> 'object'
        or jsonb_typeof(p_rollback -> 'error' -> 'name') <> 'string'
        or jsonb_typeof(p_rollback -> 'error' -> 'message') <> 'string'
      )
    )
  then
    raise exception 'Workflow rollback is not reconciled' using errcode = 'PT409';
  end if;

  resolved_rollback_outcome := p_rollback ->> 'outcome';
  resolved_rollback_error := case
    when resolved_rollback_outcome = 'failed' then p_rollback -> 'error'
    else null
  end;

  update public.corex_runs
  set status = 'terminated',
      rollback_outcome = resolved_rollback_outcome,
      rollback_error = resolved_rollback_error,
      finished_at = coalesce(finished_at, now())
  where id = target_item.run_id
    and owner_user_id = target_item.owner_user_id
    and status = 'rolling_back';

  if not found then
    raise exception 'Corex run rollback changed' using errcode = '40001';
  end if;

  select coalesce(max(sequence) + 1, 0) into next_sequence
  from public.corex_run_events
  where run_id = target_item.run_id
    and execution_generation = (
      select execution_generation from public.corex_runs where id = target_item.run_id
    );

  insert into public.corex_run_events (
    run_id, owner_user_id, execution_generation, sequence, event_type, payload
  )
  select id,
    owner_user_id,
    execution_generation,
    next_sequence,
    case when resolved_rollback_outcome = 'complete' then 'run_rollback_completed' else 'run_rollback_failed' end,
    jsonb_strip_nulls(jsonb_build_object(
      'outcome', resolved_rollback_outcome,
      'error', resolved_rollback_error
    ))
  from public.corex_runs
  where id = target_item.run_id;

  update public.corex_outbox
  set delivered_at = now(),
      claim_token = null,
      lease_expires_at = null,
      last_error = null
  where id = target_item.id;

  return jsonb_build_object(
    'accepted', true,
    'delivered', true,
    'status', 'terminated',
    'rollbackOutcome', resolved_rollback_outcome
  );
end;
$$;

revoke all on function public.corex_request_run_rollback(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.corex_reconcile_rollback_outbox(uuid, uuid, text, jsonb, boolean) from public, anon, authenticated;
grant execute on function public.corex_request_run_rollback(uuid, uuid, uuid) to service_role;
grant execute on function public.corex_reconcile_rollback_outbox(uuid, uuid, text, jsonb, boolean) to service_role;