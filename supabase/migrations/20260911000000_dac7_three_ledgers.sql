-- Migration: DAC7 3-Ledger Architecture (VARUS & Platform Compliance)
-- Strict separation: Payment Ledger ≠ Courier Income Ledger ≠ Payout Ledger
-- Compliance: 10% PIT (ПДФО), NO military fee (Військовий збір не застосовується).
-- Immutability: All financial ledger tables are append-only.

begin;

-- Function to enforce strict append-only immutability
create or replace function public.dac7_prevent_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'dac7_ledger_immutable: modifications (UPDATE, DELETE, TRUNCATE) are forbidden on financial ledgers';
end;
$$;

-- 1. Payment Ledger: All customer payments for orders (VARUS / Merchants)
create table if not exists public.dac7_payment_ledger (
  id uuid primary key default gen_random_uuid(),
  order_id text not null,
  merchant_id text not null,
  amount_gross_minor bigint not null check (amount_gross_minor > 0),
  currency text not null default 'UAH' check (currency = 'UAH'),
  gateway_fee_minor bigint not null default 0 check (gateway_fee_minor >= 0),
  status text not null check (status in ('captured', 'refunded', 'disputed')),
  payment_method text not null default 'card',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default clock_timestamp()
);

create index if not exists idx_dac7_payment_order on public.dac7_payment_ledger(order_id);
create index if not exists idx_dac7_payment_merchant on public.dac7_payment_ledger(merchant_id, created_at desc);

alter table public.dac7_payment_ledger enable row level security;

create trigger dac7_payment_ledger_immutable
before update or delete or truncate on public.dac7_payment_ledger
for each statement execute function public.dac7_prevent_mutation();


-- 2. Courier Income Ledger: Generated ONLY when delivery status reaches DELIVERED
create table if not exists public.dac7_courier_income_ledger (
  id uuid primary key default gen_random_uuid(),
  order_id text not null,
  courier_rnokpp text not null check (courier_rnokpp ~ '^[0-9]{10}$'),
  courier_name text not null,
  service_fee_minor bigint not null check (service_fee_minor >= 0),
  distance_bonus_minor bigint not null default 0 check (distance_bonus_minor >= 0),
  tips_minor bigint not null default 0 check (tips_minor >= 0),
  gross_income_minor bigint not null generated always as (service_fee_minor + distance_bonus_minor + tips_minor) stored,
  delivery_status text not null check (delivery_status in ('DELIVERED', 'ADJUSTED')),
  delivery_completed_at timestamptz not null,
  created_at timestamptz not null default clock_timestamp(),
  adjustment_reason text check (adjustment_reason is null or adjustment_reason in (
    'UNDELIVERED_LOST', 'DAMAGED_COURIER_FAULT', 'COURIER_REASSIGNED',
    'CUSTOMER_REJECTED', 'PARTIAL_REFUND', 'BANK_RETURN'
  )),
  original_income_id uuid references public.dac7_courier_income_ledger(id)
);

-- Incidents & Disputes Log: Full audit trail for courier faults, damage claims, reassignments
create table if not exists public.dac7_incidents_log (
  id uuid primary key default gen_random_uuid(),
  order_id text not null,
  incident_type text not null check (incident_type in (
    'UNDELIVERED_LOST', 'DAMAGED_COURIER_FAULT', 'COURIER_REASSIGNED',
    'CUSTOMER_REJECTED', 'PARTIAL_REFUND', 'BANK_RETURN'
  )),
  courier_rnokpp text not null,
  courier_name text not null,
  description text not null,
  customer_refund_minor bigint not null default 0,
  merchant_compensation_minor bigint not null default 0,
  courier_payout_minor bigint not null default 0,
  tax_pit_storno_minor bigint not null default 0,
  status text not null default 'resolved' check (status in ('resolved', 'under_review')),
  resolved_at timestamptz not null default clock_timestamp()
);

create index if not exists idx_dac7_incident_order on public.dac7_incidents_log(order_id);
create index if not exists idx_dac7_incident_courier on public.dac7_incidents_log(courier_rnokpp);
alter table public.dac7_incidents_log enable row level security;
create policy dac7_incidents_service_all on public.dac7_incidents_log for all to service_role using (true) with check (true);
create policy dac7_incidents_auth_read on public.dac7_incidents_log for select to authenticated using (true);

create index if not exists idx_dac7_courier_rnokpp on public.dac7_courier_income_ledger(courier_rnokpp, created_at desc);
create index if not exists idx_dac7_courier_order on public.dac7_courier_income_ledger(order_id);

alter table public.dac7_courier_income_ledger enable row level security;

create trigger dac7_courier_income_ledger_immutable
before update or delete or truncate on public.dac7_courier_income_ledger
for each statement execute function public.dac7_prevent_mutation();


-- 3. Payout Ledger: Actual payouts to courier IBAN with 10% PIT tax withholding (NO military fee)
create table if not exists public.dac7_payout_ledger (
  id uuid primary key default gen_random_uuid(),
  batch_id text not null,
  courier_rnokpp text not null check (courier_rnokpp ~ '^[0-9]{10}$'),
  gross_income_minor bigint not null check (gross_income_minor > 0),
  -- Exactly 10% PIT (ПДФО), rounded to nearest integer (minor units / kopecks)
  pit_tax_minor bigint not null check (pit_tax_minor >= 0),
  -- Net payout = Gross - 10% PIT
  net_payout_minor bigint not null check (net_payout_minor > 0),
  iban text not null check (iban ~ '^UA[0-9]{27}$'),
  bank_name text not null default 'Банк отримувача',
  bank_ref text,
  status text not null check (status in ('scheduled', 'settled', 'rejected', 'on_hold')),
  settled_at timestamptz,
  created_at timestamptz not null default clock_timestamp()
);

create index if not exists idx_dac7_payout_batch on public.dac7_payout_ledger(batch_id);
create index if not exists idx_dac7_payout_courier on public.dac7_payout_ledger(courier_rnokpp, created_at desc);

alter table public.dac7_payout_ledger enable row level security;

create trigger dac7_payout_ledger_immutable
before update or delete or truncate on public.dac7_payout_ledger
for each statement execute function public.dac7_prevent_mutation();


-- 4. Idempotency Registry: Protect against network retries and duplicate webhooks
create table if not exists public.dac7_idempotency_keys (
  key text primary key,
  request_hash text not null,
  response_body jsonb not null,
  status_code int not null default 200,
  created_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null default (clock_timestamp() + interval '24 hours')
);

create index if not exists idx_dac7_idempotency_expires on public.dac7_idempotency_keys(expires_at);

alter table public.dac7_idempotency_keys enable row level security;


-- 5. OECD DPI Quarterly Aggregates (DAC7 compliance cache)
create table if not exists public.dac7_quarterly_aggregates (
  id uuid primary key default gen_random_uuid(),
  fiscal_year int not null check (fiscal_year >= 2024),
  quarter int not null check (quarter between 1 and 4),
  courier_rnokpp text not null check (courier_rnokpp ~ '^[0-9]{10}$'),
  courier_name text not null,
  courier_iban text not null,
  total_gross_income_minor bigint not null default 0,
  total_pit_tax_minor bigint not null default 0,
  transactions_count int not null default 0,
  created_at timestamptz not null default clock_timestamp(),
  unique (fiscal_year, quarter, courier_rnokpp)
);

create index if not exists idx_dac7_quarterly_year on public.dac7_quarterly_aggregates(fiscal_year, quarter);

alter table public.dac7_quarterly_aggregates enable row level security;

-- Basic RLS Policies (Service role full access, read-only for authenticated operators)
create policy dac7_payment_service_all on public.dac7_payment_ledger
  for all to service_role using (true) with check (true);
create policy dac7_payment_auth_read on public.dac7_payment_ledger
  for select to authenticated using (true);

create policy dac7_income_service_all on public.dac7_courier_income_ledger
  for all to service_role using (true) with check (true);
create policy dac7_income_auth_read on public.dac7_courier_income_ledger
  for select to authenticated using (true);

create policy dac7_payout_service_all on public.dac7_payout_ledger
  for all to service_role using (true) with check (true);
create policy dac7_payout_auth_read on public.dac7_payout_ledger
  for select to authenticated using (true);

create policy dac7_idempotency_service_all on public.dac7_idempotency_keys
  for all to service_role using (true) with check (true);

create policy dac7_aggregates_service_all on public.dac7_quarterly_aggregates
  for all to service_role using (true) with check (true);
create policy dac7_aggregates_auth_read on public.dac7_quarterly_aggregates
  for select to authenticated using (true);

commit;
