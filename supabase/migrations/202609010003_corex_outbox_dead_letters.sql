alter table public.corex_outbox
  add column dead_lettered_at timestamptz;

update public.corex_outbox
set dead_lettered_at = now(),
    claim_token = null,
    lease_expires_at = null
where delivered_at is null
  and attempts >= 8;

drop index public.corex_outbox_pending_idx;

create index corex_outbox_pending_idx
  on public.corex_outbox (available_at, created_at)
  where delivered_at is null and dead_lettered_at is null;

create index corex_outbox_dead_lettered_idx
  on public.corex_outbox (dead_lettered_at desc)
  where dead_lettered_at is not null;

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
    and dead_lettered_at is null
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
  failed_item public.corex_outbox;
begin
  update public.corex_outbox
  set available_at = case
        when attempts >= 8 then available_at
        else now() + make_interval(secs => least(300, greatest(5, attempts * attempts * 5)))
      end,
      claim_token = null,
      lease_expires_at = null,
      dead_lettered_at = case when attempts >= 8 then now() else null end,
      last_error = jsonb_build_object('code', coalesce(p_error ->> 'code', 'delivery_failed'))
  where id = p_outbox_id
    and claim_token = p_claim_token
    and delivered_at is null
    and dead_lettered_at is null
    and lease_expires_at > now()
  returning * into failed_item;

  if failed_item.id is null then
    raise exception 'Corex outbox lease is stale' using errcode = '40001';
  end if;
  return jsonb_build_object(
    'accepted', true,
    'deadLettered', failed_item.dead_lettered_at is not null
  );
end;
$$;

create or replace function public.corex_retry_outbox(
  p_outbox_id uuid,
  p_owner_user_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  retried_id uuid;
begin
  update public.corex_outbox
  set attempts = 0,
      available_at = now(),
      claim_token = null,
      lease_expires_at = null,
      dead_lettered_at = null,
      last_error = null
  where id = p_outbox_id
    and owner_user_id = p_owner_user_id
    and delivered_at is null
    and dead_lettered_at is not null
  returning id into retried_id;

  if retried_id is null then
    raise exception 'Corex dead letter is missing' using errcode = 'P0002';
  end if;
  return jsonb_build_object('accepted', true, 'id', retried_id);
end;
$$;

create or replace function public.corex_get_outbox_health()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'pendingCount', count(*) filter (
      where delivered_at is null and dead_lettered_at is null
    ),
    'availableCount', count(*) filter (
      where delivered_at is null
        and dead_lettered_at is null
        and available_at <= now()
        and (lease_expires_at is null or lease_expires_at <= now())
    ),
    'leasedCount', count(*) filter (
      where delivered_at is null
        and dead_lettered_at is null
        and lease_expires_at > now()
    ),
    'retryingCount', count(*) filter (
      where delivered_at is null
        and dead_lettered_at is null
        and attempts > 0
    ),
    'deadLetteredCount', count(*) filter (where dead_lettered_at is not null),
    'deliveredLast24Hours', count(*) filter (where delivered_at >= now() - interval '24 hours'),
    'oldestPendingAt', min(created_at) filter (
      where delivered_at is null and dead_lettered_at is null
    )
  )
  from public.corex_outbox;
$$;

revoke all on function public.corex_claim_outbox(integer, integer) from public, anon, authenticated;
revoke all on function public.corex_ack_outbox(uuid, uuid) from public, anon, authenticated;
revoke all on function public.corex_fail_outbox(uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.corex_retry_outbox(uuid, uuid) from public, anon, authenticated;
revoke all on function public.corex_get_outbox_health() from public, anon, authenticated;
grant execute on function public.corex_claim_outbox(integer, integer) to service_role;
grant execute on function public.corex_ack_outbox(uuid, uuid) to service_role;
grant execute on function public.corex_fail_outbox(uuid, uuid, jsonb) to service_role;
grant execute on function public.corex_retry_outbox(uuid, uuid) to service_role;
grant execute on function public.corex_get_outbox_health() to service_role;