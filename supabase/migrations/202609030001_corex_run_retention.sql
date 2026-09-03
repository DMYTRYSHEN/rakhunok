create table public.corex_run_purge_jobs (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null,
  owner_user_id uuid not null,
  reason text not null check (reason = 'retention'),
  retention_days integer not null check (retention_days between 1 and 3650),
  status text not null default 'pending' check (status in ('pending', 'processing', 'complete')),
  object_keys text[] not null default '{}',
  attempts integer not null default 0 check (attempts between 0 and 8),
  available_at timestamptz not null default now(),
  claim_token uuid,
  lease_expires_at timestamptz,
  last_error jsonb,
  run_archived_at timestamptz not null,
  run_terminal_status text not null check (run_terminal_status in ('complete', 'errored', 'terminated')),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (run_id),
  check (
    (status = 'processing' and claim_token is not null and lease_expires_at is not null)
    or (status <> 'processing' and claim_token is null and lease_expires_at is null)
  ),
  check ((status = 'complete' and completed_at is not null) or (status <> 'complete' and completed_at is null))
);

create index corex_run_purge_jobs_claim_idx
  on public.corex_run_purge_jobs (available_at, created_at)
  where status <> 'complete' and attempts < 8;

alter table public.corex_run_purge_jobs enable row level security;
revoke all on public.corex_run_purge_jobs from public, anon, authenticated;
grant select, insert, update on public.corex_run_purge_jobs to service_role;

create or replace function public.corex_claim_retention_purges(
  p_limit integer default 10,
  p_lease_seconds integer default 120,
  p_retention_days integer default 30
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  claimed jsonb;
begin
  if p_limit not between 1 and 50
    or p_lease_seconds not between 30 and 300
    or p_retention_days not between 1 and 3650 then
    raise exception 'Invalid Corex retention purge bounds' using errcode = '22023';
  end if;

  insert into public.corex_run_purge_jobs (
    run_id, owner_user_id, reason, retention_days, object_keys, run_archived_at, run_terminal_status
  )
  select run.id,
    run.owner_user_id,
    'retention',
    p_retention_days,
    coalesce(array_agg(distinct attempt.output #>> '{external,key}')
      filter (where attempt.output #>> '{external,key}' is not null), '{}'),
    run.archived_at,
    run.status::text
  from public.corex_runs run
  left join public.corex_step_attempts attempt on attempt.run_id = run.id
  where run.archived_at <= now() - make_interval(days => p_retention_days)
    and run.status in ('complete', 'errored', 'terminated')
    and not exists (select 1 from public.corex_runs child where child.parent_run_id = run.id)
    and not exists (
      select 1 from public.corex_active_waits active_wait
      where active_wait.run_id = run.id and active_wait.status = 'active'
    )
    and not exists (
      select 1 from public.corex_outbox outbox
      where outbox.run_id = run.id and outbox.delivered_at is null
    )
  group by run.id, run.owner_user_id, run.archived_at, run.status
  on conflict (run_id) do nothing;

  with candidates as (
    select job.id
    from public.corex_run_purge_jobs job
    where job.status <> 'complete'
      and job.attempts < 8
      and job.available_at <= now()
      and (job.lease_expires_at is null or job.lease_expires_at <= now())
    order by job.available_at, job.created_at
    limit p_limit
    for update skip locked
  ), leased as (
    update public.corex_run_purge_jobs job
    set status = 'processing',
      attempts = job.attempts + 1,
      claim_token = gen_random_uuid(),
      lease_expires_at = now() + make_interval(secs => p_lease_seconds),
      last_error = null
    from candidates
    where job.id = candidates.id
    returning job.*
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', leased.id,
    'runId', leased.run_id,
    'objectKeys', to_jsonb(leased.object_keys),
    'attempts', leased.attempts,
    'claimToken', leased.claim_token
  ) order by leased.created_at), '[]'::jsonb)
  into claimed
  from leased;

  return claimed;
end;
$$;

create or replace function public.corex_complete_retention_purge(
  p_job_id uuid,
  p_claim_token uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_job public.corex_run_purge_jobs;
begin
  select * into target_job
  from public.corex_run_purge_jobs
  where id = p_job_id
  for update;

  if target_job.id is null then
    raise exception 'Corex purge job is missing' using errcode = 'PT404';
  end if;
  if target_job.status = 'complete' then
    return jsonb_build_object('accepted', true);
  end if;
  if target_job.status <> 'processing'
    or target_job.claim_token <> p_claim_token
    or target_job.lease_expires_at <= now() then
    raise exception 'Corex purge claim is stale' using errcode = 'PT409';
  end if;

  delete from public.corex_runs where id = target_job.run_id;

  update public.corex_run_purge_jobs
  set status = 'complete',
    completed_at = now(),
    claim_token = null,
    lease_expires_at = null,
    last_error = null
  where id = target_job.id;

  return jsonb_build_object('accepted', true);
end;
$$;

create or replace function public.corex_fail_retention_purge(
  p_job_id uuid,
  p_claim_token uuid,
  p_error jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  failed_job public.corex_run_purge_jobs;
begin
  if jsonb_typeof(p_error) <> 'object'
    or jsonb_typeof(p_error -> 'code') <> 'string'
    or length(p_error ->> 'code') not between 1 and 80 then
    raise exception 'Invalid Corex purge failure' using errcode = '22023';
  end if;

  update public.corex_run_purge_jobs
  set status = 'pending',
    available_at = now() + make_interval(secs => least(300, 5 * power(2, greatest(attempts - 1, 0))::integer)),
    claim_token = null,
    lease_expires_at = null,
    last_error = p_error
  where id = p_job_id
    and status = 'processing'
    and claim_token = p_claim_token
    and lease_expires_at > now()
  returning * into failed_job;

  if failed_job.id is null then
    raise exception 'Corex purge claim is stale' using errcode = 'PT409';
  end if;

  return jsonb_build_object('accepted', true, 'deadLettered', failed_job.attempts >= 8);
end;
$$;

revoke all on function public.corex_claim_retention_purges(integer, integer, integer) from public, anon, authenticated;
revoke all on function public.corex_complete_retention_purge(uuid, uuid) from public, anon, authenticated;
revoke all on function public.corex_fail_retention_purge(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.corex_claim_retention_purges(integer, integer, integer) to service_role;
grant execute on function public.corex_complete_retention_purge(uuid, uuid) to service_role;
grant execute on function public.corex_fail_retention_purge(uuid, uuid, jsonb) to service_role;