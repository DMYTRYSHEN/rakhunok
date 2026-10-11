begin;
set local lock_timeout = '2s';
set local statement_timeout = '30s';

create schema support_private;
revoke all on schema support_private from public, anon, authenticated;

create table support_private.operators (
	user_id uuid primary key references auth.users(id),
	enabled boolean not null default false,
	can_write boolean not null default false
);
create table support_private.contexts (
	id uuid primary key default gen_random_uuid(),
	actor_id uuid not null references auth.users(id),
	auth_session_id uuid not null,
	target_id uuid not null references auth.users(id),
	merchant_id uuid not null references public.merchants(id),
	workspace text not null check (workspace in ('sandbox','live')),
	reason text not null check (length(btrim(reason)) between 10 and 500),
	created_at timestamptz not null default clock_timestamp(),
	expires_at timestamptz not null,
	write_expires_at timestamptz,
	revoked_at timestamptz,
	snapshot jsonb
);
create index support_context_actor_idx on support_private.contexts(actor_id, auth_session_id);
create unique index support_context_active_idx on support_private.contexts(actor_id, auth_session_id)
	where revoked_at is null;
create table support_private.operations (
	id uuid primary key default gen_random_uuid(),
	context_id uuid not null references support_private.contexts(id),
	action text not null check (action = 'settings.table_ttl'),
	payload jsonb not null,
	digest text not null,
	created_at timestamptz not null default clock_timestamp(),
	expires_at timestamptz not null,
	state text not null default 'prepared' check (state in ('prepared','committed','cancelled')),
	result jsonb
);
create index support_operations_context_idx on support_private.operations(context_id, created_at desc, id desc);
create table support_private.audit (
	id uuid primary key default gen_random_uuid(),
	actor_id uuid not null,
	auth_session_id uuid not null,
	context_id uuid references support_private.contexts(id),
	operation_id uuid references support_private.operations(id),
	action text not null,
	occurred_at timestamptz not null default clock_timestamp()
);
create index support_audit_context_idx on support_private.audit(context_id, occurred_at desc);
alter table support_private.operators enable row level security;
alter table support_private.contexts enable row level security;
alter table support_private.audit enable row level security;
alter table support_private.operations enable row level security;
revoke all on all tables in schema support_private from public, anon, authenticated;

create function support_private.snapshot(p_target uuid, p_merchant uuid)
returns jsonb language plpgsql volatile set search_path = '' as $$
begin
	if exists (select 1 from public.business_settings_sellers seller
		left join public.business_entities entity on entity.id = seller.entity_id
		where seller.merchant_id = p_merchant and
			(seller.owner_user_id is distinct from p_target or entity.user_id is distinct from p_target)) then
		raise exception 'Support settings unavailable' using errcode = '42501';
	end if;
	return jsonb_build_object(
		'merchant', (select jsonb_build_object('id', id, 'name', business_name,
			'active', is_active, 'onboardingComplete', onboarding_completed)
			from public.merchants where id = p_merchant and user_id = p_target),
		'settings', (select jsonb_build_object('revision', revision, 'document', config ||
			jsonb_build_object('sellers', coalesce((select jsonb_object_agg(seller_key, config)
				from public.business_settings_sellers where merchant_id = p_merchant and owner_user_id = p_target), '{}'::jsonb)))
			from public.business_settings where merchant_id = p_merchant and owner_user_id = p_target),
		'tableTtl', jsonb_build_object('storedSeconds', (select table_order_ttl_seconds
			from public.merchant_settings where merchant_id = p_merchant),
			'effectiveSeconds', coalesce((select table_order_ttl_seconds
			from public.merchant_settings where merchant_id = p_merchant), 1800)),
		'entities', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'name', business_name,
			'iban', iban, 'taxId', tax_id, 'active', is_active) order by id)
			from public.business_entities where user_id = p_target), '[]'::jsonb),
		'terminals', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'name', name,
			'entityId', entity_id, 'active', is_active) order by id)
			from public.terminals where user_id = p_target), '[]'::jsonb),
		'invoices', coalesce((select jsonb_agg(item order by created_at desc, id desc) from (
			select id, created_at, jsonb_build_object('id', id, 'number', order_number,
				'type', type, 'title', title, 'status', status, 'amount', total_amount,
				'currency', currency, 'createdAt', created_at, 'expiresAt', expires_at) item
			from public.orders where merchant_id = p_merchant order by created_at desc, id desc limit 100
		) recent), '[]'::jsonb));
end
$$;

create function support_private.dispatch(p_action text, p_input jsonb)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
	actor uuid := auth.uid();
	claims jsonb := auth.jwt();
	auth_session uuid;
	session_limit timestamptz;
	fresh boolean;
	current_context support_private.contexts%rowtype;
	target uuid;
	merchant uuid;
	result jsonb;
	query_text text;
	allowed_keys text[];
	write_allowed boolean;
	operation support_private.operations%rowtype;
	previous_ttl integer;
	next_ttl integer;
	canonical_payload jsonb;
begin
	if actor is null or claims ->> 'role' is distinct from 'authenticated' or claims ->> 'aal' is distinct from 'aal2'
		or coalesce((claims ->> 'exp')::numeric, 0) <= extract(epoch from clock_timestamp()) then
		raise exception 'Support forbidden' using errcode = '42501';
	end if;
	auth_session := (claims ->> 'session_id')::uuid;
	select can_write into write_allowed from support_private.operators where user_id = actor and enabled for update;
	if not found then raise exception 'Support forbidden' using errcode = '42501'; end if;
	perform 1 from auth.users where id = actor and deleted_at is null
		and (banned_until is null or banned_until <= clock_timestamp()) for share;
	if not found then raise exception 'Support forbidden' using errcode = '42501'; end if;
	select not_after into session_limit from auth.sessions
		where id = auth_session and user_id = actor and aal = 'aal2'
			and (not_after is null or not_after > clock_timestamp()) for share;
	if not found then raise exception 'Support forbidden' using errcode = '42501'; end if;
	select exists (select 1 from auth.mfa_amr_claims where session_id = auth_session
		and authentication_method in ('totp','phone','webauthn')
		and updated_at > clock_timestamp() - interval '5 minutes'
		and updated_at <= clock_timestamp()) into fresh;
	if p_action is null or p_action not in ('bootstrap','search','open','snapshot','end','elevate','prepare','commit','cancel','operation') then
		raise exception 'Support operation unavailable' using errcode = '42501';
	end if;
	allowed_keys := case p_action when 'bootstrap' then array[]::text[]
		when 'search' then array['query'] when 'open' then array['targetId','merchantId','workspace','reason']
		when 'prepare' then array['sessionId','action','nextSeconds']
		when 'commit' then array['sessionId','operationId','digest','acknowledgement']
		when 'cancel' then array['sessionId','operationId']
		when 'operation' then case when p_input ? 'operationId' then array['sessionId','operationId'] else array['sessionId'] end
		else array['sessionId'] end;
	if jsonb_typeof(p_input) is distinct from 'object' or octet_length(p_input::text) > 32768
		or exists (select 1 from jsonb_object_keys(p_input) key where not key = any(allowed_keys))
		or exists (select 1 from unnest(allowed_keys) key where jsonb_typeof(p_input -> key)
			is distinct from case when key = 'nextSeconds' then 'number' else 'string' end) then
		raise exception 'Invalid support input' using errcode = '22023';
	end if;
	if p_action in ('search','open') and not fresh then
		raise exception 'Fresh MFA required' using errcode = '42501';
	end if;
	if p_action = 'bootstrap' then
		select * into current_context from support_private.contexts where actor_id = actor
			and auth_session_id = auth_session and revoked_at is null and expires_at > clock_timestamp();
		result := jsonb_build_object('actorId', actor, 'freshMfa', fresh, 'canWrite', write_allowed,
			'capabilities', jsonb_build_array('read'),
			'context', case when current_context.id is null then null else jsonb_build_object(
				'id', current_context.id, 'targetId', current_context.target_id, 'merchantId', current_context.merchant_id,
				'workspace', current_context.workspace, 'expiresAt', current_context.expires_at) end);
	elsif p_action = 'search' then
		query_text := btrim(p_input ->> 'query');
		if query_text is null or length(query_text) < 3 or length(query_text) > 254 then
			raise exception 'Exact email or UUID required' using errcode = '22023';
		end if;
		select jsonb_build_object('clients', coalesce(jsonb_agg(item), '[]'::jsonb)) into result from (
			select jsonb_build_object('targetId', users.id, 'merchantId', merchants.id,
				'email', users.email, 'name', merchants.business_name, 'active', merchants.is_active) item
			from auth.users users join public.merchants merchants on merchants.user_id = users.id
			where users.id <> actor and users.deleted_at is null
				and (users.banned_until is null or users.banned_until <= clock_timestamp())
				and (lower(users.email) = lower(query_text) or users.id::text = lower(query_text))
			order by merchants.id limit 20
		) matches;
	elsif p_action = 'open' then
		target := (p_input ->> 'targetId')::uuid;
		merchant := (p_input ->> 'merchantId')::uuid;
		if p_input ->> 'workspace' not in ('sandbox','live') or p_input ->> 'workspace' is null
			or coalesce(length(btrim(p_input ->> 'reason')), 0) not between 10 and 500 then
			raise exception 'Invalid support context' using errcode = '22023';
		end if;
		perform 1 from auth.users where id = target and id <> actor and deleted_at is null
			and (banned_until is null or banned_until <= clock_timestamp()) for share;
		if not found then raise exception 'Support forbidden' using errcode = '42501'; end if;
		perform 1 from public.merchants where id = merchant and user_id = target for share;
		if not found then raise exception 'Support forbidden' using errcode = '42501'; end if;
		update support_private.contexts set revoked_at = clock_timestamp(), snapshot = null
			where actor_id = actor and auth_session_id = auth_session and revoked_at is null
				and expires_at <= clock_timestamp();
		if exists (select 1 from support_private.contexts where actor_id = actor
			and auth_session_id = auth_session and revoked_at is null) then
			raise exception 'Active support context exists' using errcode = '23505';
		end if;
		insert into support_private.contexts(actor_id, auth_session_id, target_id, merchant_id, workspace, reason, expires_at)
			values(actor, auth_session, target, merchant, p_input ->> 'workspace', btrim(p_input ->> 'reason'),
				least(clock_timestamp() + interval '15 minutes', session_limit,
					to_timestamp((claims ->> 'exp')::double precision))) returning * into current_context;
		if current_context.workspace = 'sandbox' then
			update support_private.contexts set snapshot = support_private.snapshot(target, merchant)
				where id = current_context.id;
		end if;
		result := jsonb_build_object('id', current_context.id, 'targetId', target, 'merchantId', merchant,
			'workspace', current_context.workspace, 'expiresAt', current_context.expires_at, 'capabilities', jsonb_build_array('read'));
	else
		select * into current_context from support_private.contexts
			where id = (p_input ->> 'sessionId')::uuid and actor_id = actor and auth_session_id = auth_session for update;
		if not found then raise exception 'Support forbidden' using errcode = '42501'; end if;
		if p_action = 'end' then
			update support_private.contexts set revoked_at = coalesce(revoked_at, clock_timestamp()),
				snapshot = null, write_expires_at = null
				where id = current_context.id;
			update support_private.operations set state = 'cancelled'
				where context_id = current_context.id and state = 'prepared';
			result := jsonb_build_object('ended', true);
		else
			if current_context.revoked_at is not null or current_context.expires_at <= clock_timestamp() then
				raise exception 'Support forbidden' using errcode = '42501';
			end if;
			perform 1 from auth.users where id = current_context.target_id and id <> actor and deleted_at is null
				and (banned_until is null or banned_until <= clock_timestamp()) for share;
			if not found then raise exception 'Support forbidden' using errcode = '42501'; end if;
			perform 1 from public.merchants where id = current_context.merchant_id and user_id = current_context.target_id for share;
			if not found then raise exception 'Support forbidden' using errcode = '42501'; end if;
			if current_context.workspace = 'sandbox' and (
				exists (select 1 from jsonb_array_elements(current_context.snapshot -> 'entities') item
					left join public.business_entities entity on entity.id = (item ->> 'id')::uuid
					where entity.user_id is distinct from current_context.target_id)
				or exists (select 1 from jsonb_array_elements(current_context.snapshot -> 'terminals') item
					left join public.terminals terminal on terminal.id = (item ->> 'id')::uuid
					where terminal.user_id is distinct from current_context.target_id)
			) then
				raise exception 'Support snapshot unavailable' using errcode = '42501';
			end if;
			if p_action = 'snapshot' then
			result := jsonb_build_object('context', jsonb_build_object('id', current_context.id,
				'targetId', current_context.target_id, 'merchantId', current_context.merchant_id,
				'workspace', current_context.workspace, 'expiresAt', current_context.expires_at),
				'data', case when current_context.workspace = 'sandbox' then current_context.snapshot
					else support_private.snapshot(current_context.target_id, current_context.merchant_id) end);
			elsif p_action = 'operation' then
				select * into operation from support_private.operations
					where context_id = current_context.id
						and (not (p_input ? 'operationId') or id = (p_input ->> 'operationId')::uuid)
					order by created_at desc, id desc limit 1;
				if not found and p_input ? 'operationId' then
					raise exception 'Support forbidden' using errcode = '42501';
				end if;
				result := jsonb_build_object('operation', case when operation.id is null then null else
					jsonb_build_object('operationId',operation.id,'digest',operation.digest,
						'payload',operation.payload,'expiresAt',operation.expires_at,
						'state',case when operation.state = 'prepared' and operation.expires_at <= clock_timestamp()
							then 'expired' else operation.state end,'result',operation.result) end);
			elsif p_action = 'cancel' then
				update support_private.operations set state = 'cancelled'
					where id = (p_input ->> 'operationId')::uuid and context_id = current_context.id
						and state <> 'committed' returning * into operation;
				if not found then raise exception 'Support operation conflict' using errcode = '23505'; end if;
				result := jsonb_build_object('cancelled', true, 'operationId', operation.id);
			else
				if not write_allowed or not fresh then
					raise exception 'Support write forbidden' using errcode = '42501';
				end if;
				if p_action = 'elevate' then
					update support_private.contexts set write_expires_at = least(expires_at, clock_timestamp() + interval '5 minutes')
						where id = current_context.id returning * into current_context;
					result := jsonb_build_object('capabilities', jsonb_build_array('settings.table_ttl'),
						'expiresAt', current_context.write_expires_at);
				else
					if current_context.write_expires_at is null or current_context.write_expires_at <= clock_timestamp() then
						raise exception 'Support elevation required' using errcode = '42501';
					end if;
					if p_action = 'prepare' then
						if p_input ->> 'action' <> 'settings.table_ttl' or
							(p_input ->> 'nextSeconds')::numeric not in (1800, 3600, 7200, 18000) then
							raise exception 'Invalid support operation' using errcode = '22023';
						end if;
						next_ttl := (p_input ->> 'nextSeconds')::numeric::integer;
						if current_context.workspace = 'sandbox' then
							previous_ttl := (current_context.snapshot #>> '{tableTtl,storedSeconds}')::integer;
						else
							select table_order_ttl_seconds into previous_ttl from public.merchant_settings
								where merchant_id = current_context.merchant_id;
						end if;
						canonical_payload := jsonb_build_object('action','settings.table_ttl',
							'contextId',current_context.id,'workspace',current_context.workspace,
							'actorId',actor,'authSessionId',auth_session,'targetId',current_context.target_id,
							'merchantId',current_context.merchant_id,'previousSeconds',previous_ttl,'nextSeconds',next_ttl);
						insert into support_private.operations(context_id, action, payload, digest, expires_at)
							values(current_context.id, 'settings.table_ttl', canonical_payload,
								encode(sha256(convert_to(canonical_payload::text, 'UTF8')), 'hex'),
								least(current_context.expires_at, current_context.write_expires_at, clock_timestamp() + interval '2 minutes'))
							returning * into operation;
						result := jsonb_build_object('operationId',operation.id,'digest',operation.digest,
							'payload',operation.payload,'expiresAt',operation.expires_at);
					else
						select * into operation from support_private.operations
							where id = (p_input ->> 'operationId')::uuid and context_id = current_context.id for update;
						if not found or operation.digest <> p_input ->> 'digest' or
							p_input ->> 'acknowledgement' <> (case current_context.workspace
								when 'live' then 'CHANGE_LIVE_BUSINESS' else 'CHANGE_SANDBOX' end) then
							raise exception 'Support confirmation forbidden' using errcode = '42501';
						end if;
						if operation.state = 'committed' then
							result := operation.result;
						else
							if operation.state <> 'prepared' or operation.expires_at <= clock_timestamp() then
								raise exception 'Support operation conflict' using errcode = '23505';
							end if;
							next_ttl := (operation.payload ->> 'nextSeconds')::integer;
							previous_ttl := (operation.payload ->> 'previousSeconds')::integer;
							if current_context.workspace = 'sandbox' then
								if (current_context.snapshot #>> '{tableTtl,storedSeconds}')::integer is distinct from previous_ttl then
									raise exception 'Support settings conflict' using errcode = '23505';
								end if;
								update support_private.contexts set snapshot = jsonb_set(snapshot, '{tableTtl}',
									jsonb_build_object('storedSeconds',next_ttl,'effectiveSeconds',next_ttl)) where id = current_context.id;
							elsif previous_ttl is null then
								insert into public.merchant_settings(merchant_id, table_order_ttl_seconds)
									values(current_context.merchant_id, next_ttl) on conflict (merchant_id) do nothing;
								if not found then raise exception 'Support settings conflict' using errcode = '23505'; end if;
							else
								update public.merchant_settings set table_order_ttl_seconds = next_ttl
									where merchant_id = current_context.merchant_id and table_order_ttl_seconds = previous_ttl;
								if not found then raise exception 'Support settings conflict' using errcode = '23505'; end if;
							end if;
							result := jsonb_build_object('committed',true,'operationId',operation.id,'tableOrderTtlSeconds',next_ttl);
							operation.result := result;
							update support_private.operations set state = 'committed', result = operation.result
								where id = operation.id;
						end if;
					end if;
				end if;
			end if;
		end if;
	end if;
	insert into support_private.audit(actor_id, auth_session_id, context_id, operation_id, action)
		values(actor, auth_session, current_context.id, operation.id, p_action);
	return result;
end
$$;

create function public.support_dispatch(p_action text, p_input jsonb)
returns jsonb language sql volatile security invoker set search_path = '' as $$
	select support_private.dispatch(p_action, p_input)
$$;
revoke all on all functions in schema support_private from public, anon, authenticated;
revoke all on function public.support_dispatch(text, jsonb) from public, anon, authenticated;
grant usage on schema support_private to authenticated;
grant execute on function support_private.dispatch(text, jsonb) to authenticated;
grant execute on function public.support_dispatch(text, jsonb) to authenticated;
commit;
