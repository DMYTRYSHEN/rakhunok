create table public.corex_outbox (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  run_id uuid not null references public.corex_runs(id) on delete cascade,
  kind text not null check (kind in ('terminate_workflow', 'workflow_event', 'parent_callback')),
  semantic_key text not null unique,
  workflow_instance_id text not null,
  payload jsonb not null default '{}'::jsonb,
  attempts integer not null default 0 check (attempts >= 0),
  available_at timestamptz not null default now(),
  claim_token uuid,
  lease_expires_at timestamptz,
  delivered_at timestamptz,
  last_error jsonb,
  created_at timestamptz not null default now()
);

create index corex_outbox_pending_idx
  on public.corex_outbox (available_at, created_at)
  where delivered_at is null;

create table public.corex_run_cancellation_requests (
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  run_id uuid not null references public.corex_runs(id) on delete cascade,
  result_status public.corex_run_status not null,
  workflow_instance_ids text[] not null default '{}',
  created_at timestamptz not null default now(),
  primary key (owner_user_id, request_id)
);

alter table public.corex_outbox enable row level security;
alter table public.corex_run_cancellation_requests enable row level security;

revoke all on public.corex_outbox from public, anon, authenticated;
revoke all on public.corex_run_cancellation_requests from public, anon, authenticated;

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
    case when root_run.status in ('queued', 'running', 'waiting', 'paused')
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
    if target_run.status in ('queued', 'running', 'waiting', 'paused') then
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
    'status', case when root_run.status in ('queued', 'running', 'waiting', 'paused') then 'terminated' else root_run.status::text end,
    'accepted', true,
    'workflowInstanceIds', to_jsonb(workflow_ids)
  );
end;
$$;

revoke all on function public.corex_request_run_cancellation(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.corex_request_run_cancellation(uuid, uuid, uuid) to service_role;

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
    'attempts', attempts,
    'claimToken', claim_token
  ) order by created_at), '[]'::jsonb)
  into claimed
  from leased;

  return claimed;
end;
$$;

create or replace function public.corex_ack_outbox(
  p_outbox_id uuid,
  p_claim_token uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  updated_id uuid;
begin
  update public.corex_outbox
  set delivered_at = now(),
      claim_token = null,
      lease_expires_at = null,
      last_error = null
  where id = p_outbox_id
    and claim_token = p_claim_token
    and delivered_at is null
    and lease_expires_at > now()
  returning id into updated_id;

  if updated_id is null then
    raise exception 'Corex outbox lease is stale' using errcode = '40001';
  end if;
  return jsonb_build_object('accepted', true);
end;
$$;

create or replace function public.corex_fail_outbox(
  p_outbox_id uuid,
  p_claim_token uuid,
  p_error jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  updated_id uuid;
begin
  update public.corex_outbox
  set available_at = now() + make_interval(secs => least(300, greatest(5, attempts * attempts * 5))),
      claim_token = null,
      lease_expires_at = null,
      last_error = jsonb_build_object('code', coalesce(p_error ->> 'code', 'delivery_failed'))
  where id = p_outbox_id
    and claim_token = p_claim_token
    and delivered_at is null
    and lease_expires_at > now()
  returning id into updated_id;

  if updated_id is null then
    raise exception 'Corex outbox lease is stale' using errcode = '40001';
  end if;
  return jsonb_build_object('accepted', true);
end;
$$;

revoke all on function public.corex_claim_outbox(integer, integer) from public, anon, authenticated;
revoke all on function public.corex_ack_outbox(uuid, uuid) from public, anon, authenticated;
revoke all on function public.corex_fail_outbox(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.corex_claim_outbox(integer, integer) to service_role;
grant execute on function public.corex_ack_outbox(uuid, uuid) to service_role;
grant execute on function public.corex_fail_outbox(uuid, uuid, jsonb) to service_role;

create or replace function public.corex_start_subprocess_run(
  p_process_id uuid,
  p_owner_user_id uuid,
  p_parent_run_id uuid,
  p_parent_step_id text,
  p_workflow_instance_id text,
  p_input jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  parent_run public.corex_runs;
  lineage_root_id uuid;
  target_process public.corex_processes;
  target_version public.corex_process_versions;
  child_run public.corex_runs;
  was_created boolean := false;
begin
  with recursive lineage as (
    select id, parent_run_id from public.corex_runs
    where id = p_parent_run_id and owner_user_id = p_owner_user_id
    union all
    select parent.id, parent.parent_run_id
    from public.corex_runs parent
    join lineage child on child.parent_run_id = parent.id
    where parent.owner_user_id = p_owner_user_id
  )
  select id into lineage_root_id from lineage where parent_run_id is null;

  if lineage_root_id is null then
    raise exception 'Corex parent run cannot start a subprocess' using errcode = 'P0002';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(lineage_root_id::text, 0));

  select * into parent_run
  from public.corex_runs
  where id = p_parent_run_id
    and owner_user_id = p_owner_user_id
  for update;

  if parent_run.id is null or parent_run.status not in ('running', 'waiting') then
    raise exception 'Corex parent run cannot start a subprocess' using errcode = 'P0002';
  end if;
  if parent_run.depth >= 8 then
    raise exception 'Corex subprocess depth limit reached' using errcode = '54001';
  end if;
  if p_parent_step_id is null or char_length(p_parent_step_id) not between 1 and 120 then
    raise exception 'Invalid Corex subprocess step' using errcode = '22023';
  end if;

  select * into child_run
  from public.corex_runs
  where parent_run_id = parent_run.id
    and parent_step_id = p_parent_step_id;

  if child_run.id is null then
    select * into target_process
    from public.corex_processes
    where id = p_process_id
      and owner_user_id = p_owner_user_id;

    if target_process.id is null or target_process.published_version is null then
      raise exception 'Corex subprocess has no published version' using errcode = 'P0002';
    end if;

    select * into target_version
    from public.corex_process_versions
    where process_id = target_process.id
      and owner_user_id = p_owner_user_id
      and version = target_process.published_version;

    if target_version.id is null then
      raise exception 'Corex subprocess published version is missing' using errcode = 'P0002';
    end if;

    insert into public.corex_runs (
      process_id, process_version_id, owner_user_id, workflow_instance_id,
      input, parent_run_id, parent_step_id, depth
    ) values (
      target_process.id, target_version.id, p_owner_user_id, p_workflow_instance_id,
      coalesce(p_input, '{}'::jsonb), parent_run.id, p_parent_step_id, parent_run.depth + 1
    )
    returning * into child_run;
    was_created := true;
  else
    select * into target_version
    from public.corex_process_versions
    where id = child_run.process_version_id;
  end if;

  return jsonb_build_object(
    'id', child_run.id,
    'workflowInstanceId', child_run.workflow_instance_id,
    'parentWorkflowInstanceId', parent_run.workflow_instance_id,
    'status', child_run.status,
    'definition', target_version.definition,
    'created', was_created
  );
end;
$$;

revoke all on function public.corex_start_subprocess_run(uuid, uuid, uuid, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.corex_start_subprocess_run(uuid, uuid, uuid, text, text, jsonb) to service_role;