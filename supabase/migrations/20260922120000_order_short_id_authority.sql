begin;

set local lock_timeout = '2s';
set local statement_timeout = '30s';

lock table public.orders in share row exclusive mode;

alter table public.orders
	add column if not exists short_id text;

create schema if not exists checkout_private;
revoke all on schema checkout_private from public;

create table if not exists checkout_private.order_short_id_reservations (
	short_id text primary key,
	reserved_at timestamptz not null default clock_timestamp()
);

alter table checkout_private.order_short_id_reservations enable row level security;
revoke all on checkout_private.order_short_id_reservations from public, anon, authenticated;

insert into checkout_private.order_short_id_reservations(short_id)
select short_id
from public.orders
where short_id is not null and btrim(short_id) <> ''
on conflict (short_id) do nothing;

create or replace function checkout_private.generate_order_short_id()
returns text
language sql
volatile
set search_path = ''
as $$
	select string_agg(
		substr('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
			(floor(random() * 62) + 1)::integer, 1),
		''
	)
	from generate_series(1, 6)
$$;

create or replace function checkout_private.reserve_order_short_id()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
	candidate text;
begin
	for attempt in 1..128 loop
		candidate := checkout_private.generate_order_short_id();
		begin
			insert into checkout_private.order_short_id_reservations(short_id)
			values (candidate);
			return candidate;
		exception when unique_violation then
			null;
		end;
	end loop;

	raise exception 'order_short_id_exhausted';
end
$$;

drop trigger if exists trigger_set_order_short_id on public.orders;
drop trigger if exists orders_short_id_authority on public.orders;

update public.orders
set short_id = checkout_private.reserve_order_short_id()
where short_id is null or btrim(short_id) = '';

alter table public.orders
	alter column short_id set not null;

create unique index if not exists orders_short_id_key
	on public.orders(short_id);

alter table public.orders
	drop constraint if exists orders_short_id_format_check,
	add constraint orders_short_id_format_check
		check (short_id ~ '^[A-Za-z0-9]{6}$');

create or replace function checkout_private.set_order_short_id()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
	if tg_op = 'INSERT' then
		if new.short_id is not null then
			raise exception 'order_short_id_server_generated';
		end if;
		new.short_id := checkout_private.reserve_order_short_id();
		return new;
	end if;

	if new.short_id is distinct from old.short_id then
		raise exception 'order_short_id_immutable';
	end if;

	return new;
end
$$;

create trigger orders_short_id_authority
before insert or update of short_id on public.orders
for each row execute function checkout_private.set_order_short_id();

revoke all on function checkout_private.generate_order_short_id() from public, anon, authenticated;
revoke all on function checkout_private.reserve_order_short_id() from public, anon, authenticated;
revoke all on function checkout_private.set_order_short_id() from public, anon, authenticated;

commit;