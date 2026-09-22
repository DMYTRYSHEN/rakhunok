begin;

set local lock_timeout = '2s';
set local statement_timeout = '30s';

do $migration$
begin
  if to_regclass('checkout_private.attempts') is null
    or to_regclass('checkout_private.settlements') is null
    or to_regprocedure('checkout_private.gate()') is null
    or to_regprocedure('public.checkout_record_settlement(text,text,uuid,bigint,text,text,text,timestamptz)') is null then
    return;
  end if;

  execute $function$
create or replace function public.checkout_record_settlement(p_provider text,p_event_id text,p_attempt uuid,
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
  outcome:='review';
  if o.id is not null and o.status in ('pending','ready') and o.checkout_revision=(a.quote->>'orderRevision')::bigint
    and p_reference=o.short_id
    and p_occurred_at>=a.created_at and p_occurred_at<=(a.quote->>'expiresAt')::timestamptz
    and clock_timestamp()<=(a.quote->>'expiresAt')::timestamptz then
    outcome:='paid';
    update public.orders set status='paid',paid_at=p_occurred_at,paid_amount=p_amount_minor/100.0,
      payment_reference=p_reference where id=o.id;
  end if;
  insert into checkout_private.settlements(provider,event_id,attempt_id,event,outcome)
    values(p_provider,p_event_id,p_attempt,event,outcome);
  return jsonb_build_object('outcome',outcome,'replayed',false);
end $$
$function$;

  execute 'revoke all on function public.checkout_record_settlement(text,text,uuid,bigint,text,text,text,timestamptz) from public,anon,authenticated';
  execute 'grant execute on function public.checkout_record_settlement(text,text,uuid,bigint,text,text,text,timestamptz) to service_role';
end
$migration$;

commit;