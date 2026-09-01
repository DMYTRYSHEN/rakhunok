alter table public.corex_runs
  add column workflow_reconcile_attempts integer not null default 0 check (workflow_reconcile_attempts between 0 and 8),
  add column workflow_reconcile_available_at timestamptz not null default now(),
  add column workflow_reconcile_claim_token uuid,
  add column workflow_reconcile_lease_expires_at timestamptz,
  add column workflow_reconciled_at timestamptz,
  add column workflow_reconcile_dead_lettered_at timestamptz,
  add column workflow_reconcile_last_error jsonb;

alter table public.corex_runs
  add constraint corex_runs_workflow_reconcile_lease_check check (
    (workflow_reconcile_claim_token is null and workflow_reconcile_lease_expires_at is null)
    or (workflow_reconcile_claim_token is not null and workflow_reconcile_lease_expires_at is not null)
  );

create index corex_runs_workflow_reconcile_pending_idx
  on public.corex_runs (workflow_reconcile_available_at, created_at)
  where status = 'queued'
    and workflow_reconciled_at is null
    and workflow_reconcile_dead_lettered_at is null;

create or replace function public.corex_claim_queued_run_reconciliation(
  p_limit integer default 10,
  p_lease_seconds integer default 120,
  p_grace_seconds integer default 60
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  claimed jsonb;
begin
  if p_limit not between 1 and 25
    or p_lease_seconds not between 30 and 300
    or p_grace_seconds not between 30 and 3600 then
    raise exception 'Invalid Corex run reconciliation claim bounds' using errcode = '22023';
  end if;

  with candidates as (
    select run.id
    from public.corex_runs run
    where run.status = 'queued'
      and run.workflow_reconciled_at is null
      and run.workflow_reconcile_dead_lettered_at is null
      and run.workflow_reconcile_attempts < 8
      and run.workflow_reconcile_available_at <= now()
      and run.created_at <= now() - make_interval(secs => p_grace_seconds)
      and (
        run.workflow_reconcile_lease_expires_at is null
        or run.workflow_reconcile_lease_expires_at <= now()
      )
    order by run.workflow_reconcile_available_at, run.created_at
    limit p_limit
    for update skip locked
  ), leased as (
    update public.corex_runs run
    set workflow_reconcile_attempts = run.workflow_reconcile_attempts + 1,
        workflow_reconcile_claim_token = gen_random_uuid(),
        workflow_reconcile_lease_expires_at = now() + make_interval(secs => p_lease_seconds)
    from candidates
    where run.id = candidates.id
    returning run.*
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', leased.id,
    'workflowInstanceId', leased.workflow_instance_id,
    'ownerUserId', leased.owner_user_id,
    'definition', version.definition,
    'input', leased.input,
    'parentRunId', leased.parent_run_id,
    'parentWorkflowInstanceId', parent.workflow_instance_id,
    'parentStepId', leased.parent_step_id,
    'attempts', leased.workflow_reconcile_attempts,
    'claimToken', leased.workflow_reconcile_claim_token
  ) order by leased.created_at), '[]'::jsonb)
  into claimed
  from leased
  join public.corex_process_versions version on version.id = leased.process_version_id
  left join public.corex_runs parent on parent.id = leased.parent_run_id;

  return claimed;
end;
$$;

create or replace function public.corex_ack_queued_run_reconciliation(
  p_run_id uuid,
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
  update public.corex_runs
  set workflow_reconciled_at = now(),
      workflow_reconcile_claim_token = null,
      workflow_reconcile_lease_expires_at = null,
      workflow_reconcile_last_error = null
  where id = p_run_id
    and workflow_reconcile_claim_token = p_claim_token
    and workflow_reconcile_lease_expires_at > now()
  returning id into updated_id;

  if updated_id is null then
    raise exception 'Corex run reconciliation lease is stale' using errcode = '40001';
  end if;
  return jsonb_build_object('accepted', true);
end;
$$;

create or replace function public.corex_fail_queued_run_reconciliation(
  p_run_id uuid,
  p_claim_token uuid,
  p_error jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  failed_run public.corex_runs;
begin
  update public.corex_runs
  set workflow_reconcile_available_at = case
        when workflow_reconcile_attempts >= 8 then workflow_reconcile_available_at
        else now() + make_interval(secs => least(900, workflow_reconcile_attempts * workflow_reconcile_attempts * 15))
      end,
      workflow_reconcile_claim_token = null,
      workflow_reconcile_lease_expires_at = null,
      workflow_reconcile_dead_lettered_at = case
        when workflow_reconcile_attempts >= 8 then now()
        else null
      end,
      workflow_reconcile_last_error = jsonb_build_object(
        'code', coalesce(p_error ->> 'code', 'workflow_reconciliation_failed')
      )
  where id = p_run_id
    and status = 'queued'
    and workflow_reconciled_at is null
    and workflow_reconcile_dead_lettered_at is null
    and workflow_reconcile_claim_token = p_claim_token
    and workflow_reconcile_lease_expires_at > now()
  returning * into failed_run;

  if failed_run.id is null then
    raise exception 'Corex run reconciliation lease is stale' using errcode = '40001';
  end if;
  return jsonb_build_object(
    'accepted', true,
    'deadLettered', failed_run.workflow_reconcile_dead_lettered_at is not null
  );
end;
$$;

create or replace function public.corex_get_run_reconciliation_health()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'pendingCount', count(*) filter (
      where status = 'queued'
        and workflow_reconciled_at is null
        and workflow_reconcile_dead_lettered_at is null
    ),
    'availableCount', count(*) filter (
      where status = 'queued'
        and workflow_reconciled_at is null
        and workflow_reconcile_dead_lettered_at is null
        and workflow_reconcile_available_at <= now()
        and (workflow_reconcile_lease_expires_at is null or workflow_reconcile_lease_expires_at <= now())
    ),
    'leasedCount', count(*) filter (where workflow_reconcile_lease_expires_at > now()),
    'deadLetteredCount', count(*) filter (where workflow_reconcile_dead_lettered_at is not null),
    'reconciledLast24Hours', count(*) filter (where workflow_reconciled_at >= now() - interval '24 hours'),
    'oldestPendingAt', min(created_at) filter (
      where status = 'queued'
        and workflow_reconciled_at is null
        and workflow_reconcile_dead_lettered_at is null
    )
  )
  from public.corex_runs;
$$;

revoke all on function public.corex_claim_queued_run_reconciliation(integer, integer, integer) from public, anon, authenticated;
revoke all on function public.corex_ack_queued_run_reconciliation(uuid, uuid) from public, anon, authenticated;
revoke all on function public.corex_fail_queued_run_reconciliation(uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.corex_get_run_reconciliation_health() from public, anon, authenticated;
grant execute on function public.corex_claim_queued_run_reconciliation(integer, integer, integer) to service_role;
grant execute on function public.corex_ack_queued_run_reconciliation(uuid, uuid) to service_role;
grant execute on function public.corex_fail_queued_run_reconciliation(uuid, uuid, jsonb) to service_role;
grant execute on function public.corex_get_run_reconciliation_health() to service_role;