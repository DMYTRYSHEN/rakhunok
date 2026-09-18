create table if not exists public.appointments (
	id uuid primary key default gen_random_uuid(),
	merchant_id uuid not null references public.merchants(id) on delete cascade,
	order_id uuid references public.orders(id) on delete set null,
	service_id text not null,
	service_name text not null,
	customer_name text,
	customer_phone text,
	vehicle_info text,
	scheduled_at timestamptz not null,
	duration_minutes integer not null default 45 check (duration_minutes > 0),
	deposit_amount numeric(12,2) not null default 0,
	total_amount numeric(12,2) not null default 0,
	status text not null default 'reserved' check (status in ('reserved', 'confirmed', 'cancelled', 'completed')),
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

create index if not exists appointments_merchant_scheduled_idx 
	on public.appointments (merchant_id, scheduled_at);

create index if not exists appointments_order_id_idx 
	on public.appointments (order_id);

drop trigger if exists handle_updated_at on public.appointments;
create trigger handle_updated_at before update on public.appointments
	for each row execute function public.set_updated_at();

alter table public.appointments enable row level security;

-- Мерчанти бачать свої записи з усіма контактами
create policy "Merchants can view their own appointments"
	on public.appointments for select to authenticated
	using (
		merchant_id in (
			select merchant_id from public.merchant_memberships where user_id = auth.uid()
			union
			select id from public.merchants where user_id = auth.uid()
		)
	);

-- Мерчанти можуть змінювати свої записи
create policy "Merchants can manage their own appointments"
	on public.appointments for all to authenticated
	using (
		merchant_id in (
			select merchant_id from public.merchant_memberships where user_id = auth.uid() and role in ('owner', 'manager')
			union
			select id from public.merchants where user_id = auth.uid()
		)
	);

-- Анонімні покупці на сторінці чекауту можуть читати зайнятий час (щоб показати вільні слоти)
create policy "Anon can view scheduled slots without personal data"
	on public.appointments for select to anon
	using (status in ('reserved', 'confirmed'));

-- Анонімні покупці можуть резервувати слот при чекауті
create policy "Anon can reserve appointment on checkout"
	on public.appointments for insert to anon
	with check (status = 'reserved');
