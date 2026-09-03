create table public.merchant_api_keys (
	id uuid primary key default gen_random_uuid(),
	merchant_id uuid not null references public.merchants(id) on delete cascade,
	name text not null check (char_length(name) between 1 and 80),
	key_prefix text not null check (key_prefix ~ '^rhk_live_[a-f0-9]{8}$'),
	secret_hash text not null unique check (secret_hash ~ '^[a-f0-9]{64}$'),
	scopes text[] not null default array['orders:read', 'orders:write', 'stats:read']::text[],
	created_by uuid not null references auth.users(id) on delete restrict default auth.uid(),
	created_at timestamptz not null default now(),
	expires_at timestamptz,
	last_used_at timestamptz,
	revoked_at timestamptz,
	check (cardinality(scopes) between 1 and 16),
	check (expires_at is null or expires_at > created_at),
	check (last_used_at is null or last_used_at >= created_at),
	check (revoked_at is null or revoked_at >= created_at)
);

create index merchant_api_keys_merchant_created_idx
	on public.merchant_api_keys (merchant_id, created_at desc);
create index merchant_api_keys_active_prefix_idx
	on public.merchant_api_keys (key_prefix)
	where revoked_at is null;

create function public.enforce_merchant_api_key_revocation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
	if old.revoked_at is not null then
		raise exception 'A revoked merchant API key cannot be changed';
	end if;

	if new.revoked_at is null then
		raise exception 'Merchant API key revocation requires revoked_at';
	end if;

	return new;
end;
$$;

create trigger enforce_merchant_api_key_revocation
	before update on public.merchant_api_keys
	for each row execute function public.enforce_merchant_api_key_revocation();

alter table public.merchant_api_keys enable row level security;

create policy "merchant owners read API keys"
	on public.merchant_api_keys for select to authenticated
	using (
		exists (
			select 1
			from public.merchants merchant
			where merchant.id = merchant_id
				and merchant.user_id = (select auth.uid())
		)
	);

create policy "merchant owners create API keys"
	on public.merchant_api_keys for insert to authenticated
	with check (
		created_by = (select auth.uid())
		and exists (
			select 1
			from public.merchants merchant
			where merchant.id = merchant_id
				and merchant.user_id = (select auth.uid())
		)
	);

create policy "merchant owners revoke API keys"
	on public.merchant_api_keys for update to authenticated
	using (
		exists (
			select 1
			from public.merchants merchant
			where merchant.id = merchant_id
				and merchant.user_id = (select auth.uid())
		)
	)
	with check (
		revoked_at is not null
		and exists (
			select 1
			from public.merchants merchant
			where merchant.id = merchant_id
				and merchant.user_id = (select auth.uid())
		)
	);

revoke all on public.merchant_api_keys from public, anon, authenticated;
grant select, insert on public.merchant_api_keys to authenticated;
grant update (revoked_at) on public.merchant_api_keys to authenticated;
grant select, insert, update, delete on public.merchant_api_keys to service_role;
