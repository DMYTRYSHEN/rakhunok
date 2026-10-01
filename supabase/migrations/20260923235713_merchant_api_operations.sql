begin;

create schema merchant_api_private;
revoke all on schema merchant_api_private from public, anon, authenticated;
grant usage on schema merchant_api_private to service_role;

create table merchant_api_private.idempotency (
	merchant_id uuid not null references public.merchants(id) on delete cascade,
	operation text not null,
	idempotency_key text not null check (length(idempotency_key) between 1 and 128),
	request_body jsonb not null,
	response jsonb not null,
	expires_at timestamptz not null,
	primary key (merchant_id, operation, idempotency_key)
);
alter table merchant_api_private.idempotency enable row level security;
revoke all on merchant_api_private.idempotency from public, anon, authenticated;
grant select, insert, update, delete on merchant_api_private.idempotency to service_role;
create index merchant_api_idempotency_expiry on merchant_api_private.idempotency (expires_at);

create table merchant_api_private.rate_limits (
	merchant_id uuid not null references public.merchants(id) on delete cascade,
	bucket text not null,
	window_start timestamptz not null,
	requests integer not null check (requests > 0),
	primary key (merchant_id, bucket)
);
alter table merchant_api_private.rate_limits enable row level security;
revoke all on merchant_api_private.rate_limits from public, anon, authenticated;
grant select, insert, update on merchant_api_private.rate_limits to service_role;

create function public.merchant_api_operations(
	p_secret_hash text,
	p_method text,
	p_resource text,
	p_resource_id text default null,
	p_query jsonb default '{}'::jsonb,
	p_body jsonb default '{}'::jsonb,
	p_idempotency_key text default null
)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
	api_key public.merchant_api_keys%rowtype;
	prior merchant_api_private.idempotency%rowtype;
	output jsonb;
	required_scope text;
	request_count integer;
	request_limit integer;
	bucket_name text;
	window_time timestamptz;
	report_zone text;
	report_from date;
	report_to date;
	filter_entity uuid;
	filter_terminal uuid;
begin
	if current_user <> 'service_role' then raise insufficient_privilege; end if;
	select * into api_key from public.merchant_api_keys where secret_hash = p_secret_hash for update;
	if not found or api_key.revoked_at is not null
		or (api_key.expires_at is not null and api_key.expires_at <= clock_timestamp())
		or not exists (select 1 from public.merchants where id = api_key.merchant_id and user_id = api_key.created_by) then
		return jsonb_build_object('status', 401, 'body', jsonb_build_object('error', 'Unauthorized'));
	end if;
	if p_resource = 'stats' and p_method = 'GET' and p_resource_id is null then required_scope := 'stats:read';
	elsif p_resource = 'orders' and p_method = 'GET' then required_scope := 'orders:read';
	elsif p_resource = 'orders' and p_method = 'POST' and p_resource_id is null then required_scope := 'orders:write';
	else return jsonb_build_object('status', 403, 'body', jsonb_build_object('error', 'Forbidden'));
	end if;
	if not (required_scope = any(api_key.scopes)) or
		(p_body ? 'merchant_id' and p_body ->> 'merchant_id' is distinct from api_key.merchant_id::text) or
		(p_query ? 'merchant_id' and p_query ->> 'merchant_id' is distinct from api_key.merchant_id::text) then
		return jsonb_build_object('status', 403, 'body', jsonb_build_object('error', 'Forbidden'));
	end if;
	if jsonb_typeof(p_body) is distinct from 'object' or jsonb_typeof(p_query) is distinct from 'object' then
		return jsonb_build_object('status', 422, 'body', jsonb_build_object('error', 'Unprocessable entity'));
	end if;
	if p_idempotency_key is not null and (p_resource <> 'orders' or p_method <> 'POST' or p_resource_id is not null
		or p_idempotency_key !~ '^[A-Za-z0-9._:-]{1,128}$') then
		return jsonb_build_object('status', 400, 'body', jsonb_build_object('error', 'Invalid Idempotency-Key'));
	end if;
	bucket_name := case when p_method = 'GET' then 'read' else 'write' end;
	request_limit := case when p_method = 'GET' then 120 else 30 end;
	window_time := date_trunc('minute', clock_timestamp());
	insert into merchant_api_private.rate_limits (merchant_id, bucket, window_start, requests)
	values (api_key.merchant_id, bucket_name, window_time, 1)
	on conflict (merchant_id, bucket) do update set
		requests = case when merchant_api_private.rate_limits.window_start = excluded.window_start
			then least(merchant_api_private.rate_limits.requests + 1, request_limit + 1) else 1 end,
		window_start = excluded.window_start
	returning requests into request_count;
	if request_count > request_limit then
		return jsonb_build_object('status', 429, 'retry_after',
			greatest(1, ceil(extract(epoch from window_time + interval '1 minute' - clock_timestamp()))::integer),
			'body', jsonb_build_object('error', 'Rate limit exceeded'));
	end if;
	update public.merchant_api_keys set last_used_at = clock_timestamp() where id = api_key.id;
	if p_resource = 'stats' then
		begin
			report_zone := coalesce(p_query ->> 'timezone', 'Europe/Kyiv');
			if not exists (select 1 from pg_timezone_names where name = report_zone) then raise invalid_parameter_value; end if;
			report_to := coalesce((p_query ->> 'to')::date, (clock_timestamp() at time zone report_zone)::date);
			report_from := coalesce((p_query ->> 'from')::date, report_to - 29);
			if report_to < report_from or report_to - report_from > 365 then raise invalid_parameter_value; end if;
			filter_entity := (p_query ->> 'entity_id')::uuid;
			filter_terminal := (p_query ->> 'terminal_id')::uuid;
			with filtered as materialized (
				select *, (created_at at time zone report_zone)::date as report_day from public.orders
				where merchant_id = api_key.merchant_id
					and created_at >= (report_from::timestamp at time zone report_zone)
					and created_at < ((report_to + 1)::timestamp at time zone report_zone)
					and (filter_entity is null or entity_id = filter_entity)
					and (filter_terminal is null or terminal_id = filter_terminal)
			), daily as (
				select report_day as day, count(*) as orders, count(*) filter (where status = 'paid') as paid_orders,
					coalesce(sum(total_amount), 0) as invoice_amount,
					coalesce(sum(coalesce(paid_amount, total_amount)) filter (where status = 'paid'), 0) as paid_amount
				from filtered group by report_day
			), statuses as (
				select status, count(*) as count from filtered group by status
			)
			select jsonb_build_object('from', report_from, 'to', report_to, 'timezone', report_zone,
				'basis', 'created_at', 'currency', 'UAH', 'orders', count(*),
				'paid_orders', count(*) filter (where status = 'paid'),
				'invoice_amount', coalesce(sum(total_amount), 0),
				'paid_amount', coalesce(sum(coalesce(paid_amount, total_amount)) filter (where status = 'paid'), 0),
				'statuses', (select coalesce(jsonb_object_agg(status, count), '{}') from statuses),
				'daily', (select coalesce(jsonb_agg(to_jsonb(daily) order by day), '[]') from daily)) into output from filtered;
			return jsonb_build_object('status', 200, 'body', output);
		exception when data_exception then
			return jsonb_build_object('status', 422, 'body', jsonb_build_object('error', 'Invalid report filters'));
		end;
	end if;
	if p_idempotency_key is not null then
		perform pg_advisory_xact_lock(hashtextextended('merchant-api:create:' || api_key.merchant_id::text, 0));
		delete from merchant_api_private.idempotency
		where merchant_id = api_key.merchant_id and expires_at <= clock_timestamp();
		select * into prior from merchant_api_private.idempotency
		where merchant_id = api_key.merchant_id and operation = 'orders:create' and idempotency_key = p_idempotency_key;
		if found then
			if prior.request_body is distinct from p_body then
				return jsonb_build_object('status', 409, 'body', jsonb_build_object('error', 'Idempotency conflict'));
			end if;
			update public.merchant_api_keys set last_used_at = clock_timestamp() where id = api_key.id;
			return prior.response;
		end if;
	end if;
	output := public.merchant_api_key_orders(p_secret_hash, p_method, p_resource_id, p_query, p_body);
	if p_idempotency_key is not null and output ->> 'status' = '200' then
		insert into merchant_api_private.idempotency
			(merchant_id, operation, idempotency_key, request_body, response, expires_at)
		values (api_key.merchant_id, 'orders:create', p_idempotency_key, p_body, output, clock_timestamp() + interval '24 hours');
	end if;
	return output;
end;
$$;

revoke all on function public.merchant_api_operations(text, text, text, text, jsonb, jsonb, text) from public, anon, authenticated;
grant execute on function public.merchant_api_operations(text, text, text, text, jsonb, jsonb, text) to service_role;

commit;
