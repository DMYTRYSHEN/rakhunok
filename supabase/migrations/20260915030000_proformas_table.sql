create table if not exists public.proformas (
	id uuid primary key default gen_random_uuid(),
	merchant_id uuid not null references public.merchants(id) on delete cascade,
	invoice_id uuid references public.orders(id) on delete set null,
	number text not null,
	title text not null default 'Рахунок-фактура',
	issue_date date not null default current_date,
	due_date date not null default (current_date + interval '14 days'),
	status text not null default 'draft' check (status in ('draft', 'invoice_created', 'cancelled')),
	currency text not null default 'UAH' check (currency in ('UAH', 'USD', 'EUR')),
	seller jsonb not null default '{}'::jsonb,
	customer jsonb not null default '{}'::jsonb,
	items jsonb not null default '[]'::jsonb,
	payment_method jsonb not null default '{}'::jsonb,
	purpose text not null default '',
	notes text not null default '',
	tax_rate numeric(5, 2) not null default 0,
	adjustment numeric(12, 2) not null default 0,
	subtotal numeric(12, 2) not null default 0,
	discount_total numeric(12, 2) not null default 0,
	tax_amount numeric(12, 2) not null default 0,
	total numeric(12, 2) not null default 0,
	appearance_template text not null default 'Шаблон №1 • Українська',
	recurrence text not null default 'none',
	project_group text not null default 'Без проєкту • Без групи',
	created_at timestamptz not null default clock_timestamp(),
	updated_at timestamptz not null default clock_timestamp()
);

create index if not exists proformas_merchant_id_idx on public.proformas(merchant_id);
create index if not exists proformas_invoice_id_idx on public.proformas(invoice_id) where invoice_id is not null;
create index if not exists proformas_created_at_idx on public.proformas(merchant_id, created_at desc);

alter table public.proformas enable row level security;

create policy "merchant owners manage proformas"
	on public.proformas for all to authenticated
	using (
		exists (
			select 1
			from public.merchants merchant
			where merchant.id = merchant_id
				and merchant.user_id = (select auth.uid())
		)
	)
	with check (
		exists (
			select 1
			from public.merchants merchant
			where merchant.id = merchant_id
				and merchant.user_id = (select auth.uid())
		)
	);

revoke all on public.proformas from public, anon;
grant select, insert, update, delete on public.proformas to authenticated;
grant all on public.proformas to service_role;
