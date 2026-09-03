create table public.corex_http_route_reconciliations (
  id uuid not null default gen_random_uuid() unique,
  environment_id uuid not null,
  route_namespace text not null,
  http_method text not null,
  route_path text not null,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  desired_status text not null check (desired_status in ('present', 'absent')),
  desired_trigger_id uuid references public.corex_published_triggers(id) on delete restrict,
  desired_fingerprint text not null check (desired_fingerprint ~ '^[a-f0-9]{64}$'),
  observed_status text not null default 'pending' check (observed_status in ('pending', 'converged', 'failed')),
  observed_fingerprint text check (observed_fingerprint ~ '^[a-f0-9]{64}$'),
  attempts integer not null default 0 check (attempts between 0 and 8),
  available_at timestamptz not null default now(),
  claim_token uuid,
  lease_expires_at timestamptz,
  reconciled_at timestamptz,
  dead_lettered_at timestamptz,
  last_error jsonb,
  desired_at timestamptz not null default now(),
  primary key (environment_id, route_namespace, http_method, route_path),
  foreign key (environment_id, route_namespace, owner_user_id)
    references public.corex_route_namespaces(environment_id, route_namespace, owner_user_id)
    on delete restrict,
  check (
    (desired_status = 'present' and desired_trigger_id is not null)
    or (desired_status = 'absent' and desired_trigger_id is null)
  ),
  check (
    (claim_token is null and lease_expires_at is null)
    or (claim_token is not null and lease_expires_at is not null)
  )
);

create unique index corex_http_route_reconciliations_claim_token_idx
  on public.corex_http_route_reconciliations (claim_token)
  where claim_token is not null;

create index corex_http_route_reconciliations_pending_idx
  on public.corex_http_route_reconciliations (available_at, desired_at)
  where observed_status <> 'converged' and dead_lettered_at is null;

alter table public.corex_http_route_reconciliations enable row level security;
revoke all on public.corex_http_route_reconciliations from public, anon, authenticated;
grant select, insert, update on public.corex_http_route_reconciliations to service_role;

create or replace function corex_private.set_http_route_reconciliation_desired(
  p_environment_id uuid,
  p_route_namespace text,
  p_http_method text,
  p_route_path text,
  p_owner_user_id uuid,
  p_desired_status text,
  p_desired_trigger_id uuid
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  next_fingerprint text;
begin
  next_fingerprint := encode(
    extensions.digest(
      convert_to(
        concat_ws(
          E'\n',
          p_environment_id::text,
          p_route_namespace,
          p_http_method,
          p_route_path,
          p_desired_status,
          coalesce(p_desired_trigger_id::text, '')
        ),
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );

  insert into public.corex_http_route_reconciliations (
    environment_id,
    route_namespace,
    http_method,
    route_path,
    owner_user_id,
    desired_status,
    desired_trigger_id,
    desired_fingerprint
  ) values (
    p_environment_id,
    p_route_namespace,
    p_http_method,
    p_route_path,
    p_owner_user_id,
    p_desired_status,
    p_desired_trigger_id,
    next_fingerprint
  )
  on conflict (environment_id, route_namespace, http_method, route_path) do update
  set owner_user_id = excluded.owner_user_id,
      desired_status = excluded.desired_status,
      desired_trigger_id = excluded.desired_trigger_id,
      desired_fingerprint = excluded.desired_fingerprint,
      observed_status = 'pending',
      attempts = 0,
      available_at = now(),
      claim_token = null,
      lease_expires_at = null,
      reconciled_at = null,
      dead_lettered_at = null,
      last_error = null,
      desired_at = now()
  where public.corex_http_route_reconciliations.desired_fingerprint
    is distinct from excluded.desired_fingerprint;
end;
$$;

revoke all on function corex_private.set_http_route_reconciliation_desired(uuid, text, text, text, uuid, text, uuid)
  from public, anon, authenticated;
grant execute on function corex_private.set_http_route_reconciliation_desired(uuid, text, text, text, uuid, text, uuid)
  to service_role;

create or replace function corex_private.sync_http_route_reconciliation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op in ('DELETE', 'UPDATE') then
    perform corex_private.set_http_route_reconciliation_desired(
      old.environment_id,
      old.route_namespace,
      old.http_method,
      old.route_path,
      old.owner_user_id,
      'absent',
      null
    );
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    perform corex_private.set_http_route_reconciliation_desired(
      new.environment_id,
      new.route_namespace,
      new.http_method,
      new.route_path,
      new.owner_user_id,
      'present',
      new.trigger_id
    );
  end if;

  return null;
end;
$$;

revoke all on function corex_private.sync_http_route_reconciliation()
  from public, anon, authenticated;

insert into public.corex_http_route_reconciliations (
  environment_id,
  route_namespace,
  http_method,
  route_path,
  owner_user_id,
  desired_status,
  desired_trigger_id,
  desired_fingerprint
)
select
  route.environment_id,
  route.route_namespace,
  route.http_method,
  route.route_path,
  route.owner_user_id,
  'present',
  route.trigger_id,
  encode(
    extensions.digest(
      convert_to(
        concat_ws(
          E'\n',
          route.environment_id::text,
          route.route_namespace,
          route.http_method,
          route.route_path,
          'present',
          route.trigger_id::text
        ),
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  )
from public.corex_active_http_routes route;

create trigger corex_active_http_routes_sync_reconciliation
after insert or update or delete on public.corex_active_http_routes
for each row execute function corex_private.sync_http_route_reconciliation();

create or replace function public.corex_claim_http_route_reconciliation(
  p_limit integer default 10,
  p_lease_seconds integer default 120
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  claimed jsonb;
begin
  if p_limit not between 1 and 25 or p_lease_seconds not between 30 and 300 then
    raise exception 'Invalid Corex HTTP route reconciliation claim bounds' using errcode = '22023';
  end if;

  with candidates as (
    select reconciliation.id
    from public.corex_http_route_reconciliations reconciliation
    where reconciliation.observed_status <> 'converged'
      and reconciliation.dead_lettered_at is null
      and reconciliation.attempts < 8
      and reconciliation.available_at <= now()
      and (
        reconciliation.lease_expires_at is null
        or reconciliation.lease_expires_at <= now()
      )
    order by reconciliation.available_at, reconciliation.desired_at
    limit p_limit
    for update skip locked
  ), leased as (
    update public.corex_http_route_reconciliations reconciliation
    set attempts = reconciliation.attempts + 1,
        claim_token = gen_random_uuid(),
        lease_expires_at = now() + make_interval(secs => p_lease_seconds)
    from candidates
    where reconciliation.id = candidates.id
    returning reconciliation.*
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'environmentId', leased.environment_id,
    'routeNamespace', leased.route_namespace,
    'httpMethod', leased.http_method,
    'routePath', leased.route_path,
    'desiredStatus', leased.desired_status,
    'desiredTriggerId', leased.desired_trigger_id,
    'desiredFingerprint', leased.desired_fingerprint,
    'attempts', leased.attempts,
    'claimToken', leased.claim_token
  ) order by leased.desired_at), '[]'::jsonb)
  into claimed
  from leased;

  return claimed;
end;
$$;

create or replace function public.corex_ack_http_route_reconciliation(
  p_claim_token uuid,
  p_observed_fingerprint text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  updated_id uuid;
begin
  update public.corex_http_route_reconciliations
  set observed_status = 'converged',
      observed_fingerprint = p_observed_fingerprint,
      claim_token = null,
      lease_expires_at = null,
      reconciled_at = now(),
      last_error = null
  where claim_token = p_claim_token
    and lease_expires_at > now()
    and desired_fingerprint = p_observed_fingerprint
  returning id into updated_id;

  if updated_id is null then
    raise exception 'Corex HTTP route reconciliation lease is stale or drift remains'
      using errcode = '40001';
  end if;
  return jsonb_build_object('accepted', true);
end;
$$;

create or replace function public.corex_fail_http_route_reconciliation(
  p_claim_token uuid,
  p_error jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  failed_route public.corex_http_route_reconciliations;
begin
  update public.corex_http_route_reconciliations
  set observed_status = 'failed',
      available_at = case
        when attempts >= 8 then available_at
        else now() + make_interval(secs => least(900, attempts * attempts * 15))
      end,
      claim_token = null,
      lease_expires_at = null,
      dead_lettered_at = case when attempts >= 8 then now() else null end,
      last_error = jsonb_build_object(
        'code', coalesce(p_error ->> 'code', 'http_route_reconciliation_failed')
      )
  where claim_token = p_claim_token
    and lease_expires_at > now()
    and dead_lettered_at is null
  returning * into failed_route;

  if failed_route.id is null then
    raise exception 'Corex HTTP route reconciliation lease is stale' using errcode = '40001';
  end if;
  return jsonb_build_object(
    'accepted', true,
    'deadLettered', failed_route.dead_lettered_at is not null
  );
end;
$$;

create or replace function public.corex_get_http_route_reconciliation_health()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'pendingCount', count(*) filter (
      where observed_status <> 'converged' and dead_lettered_at is null
    ),
    'availableCount', count(*) filter (
      where observed_status <> 'converged'
        and dead_lettered_at is null
        and available_at <= now()
        and (lease_expires_at is null or lease_expires_at <= now())
    ),
    'leasedCount', count(*) filter (where lease_expires_at > now()),
    'deadLetteredCount', count(*) filter (where dead_lettered_at is not null),
    'reconciledLast24Hours', count(*) filter (where reconciled_at >= now() - interval '24 hours'),
    'oldestPendingAt', min(desired_at) filter (
      where observed_status <> 'converged' and dead_lettered_at is null
    )
  )
  from public.corex_http_route_reconciliations;
$$;

revoke all on function public.corex_claim_http_route_reconciliation(integer, integer)
  from public, anon, authenticated;
revoke all on function public.corex_ack_http_route_reconciliation(uuid, text)
  from public, anon, authenticated;
revoke all on function public.corex_fail_http_route_reconciliation(uuid, jsonb)
  from public, anon, authenticated;
revoke all on function public.corex_get_http_route_reconciliation_health()
  from public, anon, authenticated;
grant execute on function public.corex_claim_http_route_reconciliation(integer, integer) to service_role;
grant execute on function public.corex_ack_http_route_reconciliation(uuid, text) to service_role;
grant execute on function public.corex_fail_http_route_reconciliation(uuid, jsonb) to service_role;
grant execute on function public.corex_get_http_route_reconciliation_health() to service_role;