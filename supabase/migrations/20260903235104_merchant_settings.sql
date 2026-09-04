create table public.merchant_settings (
	merchant_id uuid primary key references public.merchants(id) on delete cascade,
	table_order_ttl_seconds integer not null default 1800
		check (table_order_ttl_seconds > 0)
);

alter table public.merchant_settings enable row level security;

create policy "merchant owners manage settings"
	on public.merchant_settings for all to authenticated
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

revoke all on public.merchant_settings from public, anon, authenticated;
grant select, insert, update on public.merchant_settings to authenticated;
grant select, insert, update, delete on public.merchant_settings to service_role;
