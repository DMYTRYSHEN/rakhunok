-- LOCAL CANDIDATE. Provider adapters must verify signatures BEFORE invoking RPC.
begin;
create table checkout_private.settlements (
  provider text not null,
  event_id text not null,
  attempt_id uuid not null references checkout_private.attempts(id),
  event jsonb not null,
  outcome text not null check(outcome in ('paid','review')),
  received_at timestamptz not null default clock_timestamp(),
  primary key(provider,event_id)
);
create unique index checkout_one_paid_attempt on checkout_private.settlements(attempt_id) where outcome='paid';
alter table checkout_private.settlements enable row level security;
create trigger checkout_settlement_immutable before update or delete or truncate on checkout_private.settlements
for each statement execute function checkout_private.immutable_attempt();
revoke all on checkout_private.settlements from public,anon,authenticated;

create function public.checkout_record_settlement(p_provider text,p_event_id text,p_attempt uuid,
  p_amount_minor bigint,p_currency text,p_iban text,p_reference text,p_occurred_at timestamptz)
returns jsonb language plpgsql security definer set search_path='' as $$
declare a checkout_private.attempts; o public.orders; prior checkout_private.settlements; event jsonb; outcome text;
begin
  perform checkout_private.gate();
  if p_provider is null or p_provider !~ '^[a-z0-9_-]{1,32}$' or p_event_id is null or length(p_event_id) not between 1 and 128
    or p_attempt is null or p_amount_minor is null or p_amount_minor not between 1 and 9007199254740991
    or p_currency is distinct from 'UAH' or p_iban is null or p_reference is null or length(p_reference) not between 1 and 100
    or p_occurred_at is null or p_occurred_at>clock_timestamp()+interval '1 minute' then raise exception 'checkout_invalid_settlement'; end if;
  event:=jsonb_build_object('attemptId',p_attempt,'amountMinor',p_amount_minor,'currency',p_currency,
    'iban',p_iban,'reference',p_reference,'occurredAt',p_occurred_at);
  select * into prior from checkout_private.settlements where provider=p_provider and event_id=p_event_id;
  if found then
    if prior.event<>event then raise exception 'checkout_settlement_identity_conflict'; end if;
    return jsonb_build_object('outcome',prior.outcome,'replayed',true);
  end if;
  select * into a from checkout_private.attempts where id=p_attempt;
  if not found then raise exception 'checkout_unknown_attempt'; end if;
  if (a.quote->>'amountMinor')::bigint is distinct from p_amount_minor
    or (a.quote->>'currency') is distinct from p_currency
    or (a.quote#>>'{recipient,iban}') is distinct from p_iban then raise exception 'checkout_settlement_quote_mismatch'; end if;
  select * into o from public.orders where id=(a.quote->>'orderId')::uuid for update;
  -- Conservative policy: late/changed/deleted/already-paid orders enter immutable
  -- manual review, never overwrite financial state or declare a second success.
  outcome:='review';
  if o.id is not null and o.status in ('pending','ready') and o.checkout_revision=(a.quote->>'orderRevision')::bigint
    and p_occurred_at>=a.created_at and p_occurred_at<=(a.quote->>'expiresAt')::timestamptz
    and clock_timestamp()<=(a.quote->>'expiresAt')::timestamptz then
    outcome:='paid';
    update public.orders set status='paid',paid_at=p_occurred_at,paid_amount=p_amount_minor/100.0,
      payment_reference=p_reference where id=o.id;
  end if;
  insert into checkout_private.settlements(provider,event_id,attempt_id,event,outcome)
    values(p_provider,p_event_id,p_attempt,event,outcome);
  return jsonb_build_object('outcome',outcome,'replayed',false);
end $$;
revoke all on function public.checkout_record_settlement(text,text,uuid,bigint,text,text,text,timestamptz) from public,anon,authenticated;
grant execute on function public.checkout_record_settlement(text,text,uuid,bigint,text,text,text,timestamptz) to service_role;
commit;