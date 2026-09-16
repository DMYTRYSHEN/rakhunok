create table if not exists public.checkout_templates (
	id uuid primary key default gen_random_uuid(),
	merchant_id uuid not null references public.merchants(id) on delete cascade,
	name text not null,
	scenario_type text not null,
	scenario_config jsonb not null default '{}'::jsonb,
	is_default boolean not null default false,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

create unique index if not exists checkout_templates_merchant_default_idx 
on public.checkout_templates (merchant_id) 
where is_default = true;

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists handle_updated_at on public.checkout_templates;
create trigger handle_updated_at before update on public.checkout_templates
  for each row execute function public.set_updated_at();

alter table public.checkout_templates enable row level security;

create policy "Merchants can view their own templates"
	on public.checkout_templates for select
	using (
		merchant_id in (
			select merchant_id from public.merchant_memberships where user_id = auth.uid()
			union
			select id from public.merchants where user_id = auth.uid()
		)
	);

create policy "Merchants can insert their own templates"
	on public.checkout_templates for insert
	with check (
		merchant_id in (
			select merchant_id from public.merchant_memberships where user_id = auth.uid() and role in ('owner', 'admin')
			union
			select id from public.merchants where user_id = auth.uid()
		)
	);

create policy "Merchants can update their own templates"
	on public.checkout_templates for update
	using (
		merchant_id in (
			select merchant_id from public.merchant_memberships where user_id = auth.uid() and role in ('owner', 'admin')
			union
			select id from public.merchants where user_id = auth.uid()
		)
	);

create policy "Merchants can delete their own templates"
	on public.checkout_templates for delete
	using (
		merchant_id in (
			select merchant_id from public.merchant_memberships where user_id = auth.uid() and role in ('owner', 'admin')
			union
			select id from public.merchants where user_id = auth.uid()
		)
	);
