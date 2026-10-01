begin;

create or replace function public.enforce_merchant_api_key_revocation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
	if old.revoked_at is not null then
		raise exception 'A revoked merchant API key cannot be changed';
	end if;
	if current_user = 'service_role'
		and (to_jsonb(new) - 'last_used_at') = (to_jsonb(old) - 'last_used_at')
		and new.last_used_at is not null
		and new.last_used_at >= coalesce(old.last_used_at, old.created_at) then
		return new;
	end if;
	if new.revoked_at is null then
		raise exception 'Merchant API key revocation requires revoked_at';
	end if;
	return new;
end;
$$;

create function public.create_merchant_api_invoice(
	p_owner_id uuid,
	p_merchant_id uuid,
	p_entity_id uuid,
	p_type text,
	p_title text,
	p_description text,
	p_base_amount numeric,
	p_delivery_fee numeric,
	p_table_number integer,
	p_terminal_id uuid,
	p_scenario_config jsonb,
	p_expires_at timestamptz
)
returns public.orders
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
	settings public.business_settings%rowtype;
	seller public.business_settings_sellers%rowtype;
	entity public.business_entities%rowtype;
	mode text;
	invoice_number text;
	scenario_label text;
	business_purpose text;
	final_purpose text;
	server_payment_id text := gen_random_uuid()::text;
	recipient_name text;
	recipient_iban text;
	recipient_tax_id text;
	tax_text text;
	result public.orders%rowtype;
begin
	if current_user <> 'service_role' then
		raise insufficient_privilege;
	end if;
	if p_type not in ('fixed', 'open_amount', 'table', 'delivery')
		or p_base_amount is null or p_delivery_fee is null
		or p_base_amount < 0 or p_delivery_fee < 0
		or (p_type <> 'open_amount' and p_base_amount + p_delivery_fee <= 0) then
		raise exception 'Invalid invoice input' using errcode = '22023';
	end if;
	if p_entity_id is null
		or (p_type = 'table' and (p_terminal_id is null or p_table_number is null)) then
		raise exception 'Invalid invoice terminal or seller' using errcode = '22023';
	end if;

	perform 1 from public.merchants where id = p_merchant_id and user_id = p_owner_id;
	if not found then
		raise exception 'Invoice creation unavailable' using errcode = '42501';
	end if;

	select * into settings
	from public.business_settings
	where merchant_id = p_merchant_id and owner_user_id = p_owner_id
	for share;
	if not found then
		raise exception 'Invoice payment settings are not configured' using errcode = '22023';
	end if;

	mode := settings.config ->> 'mode';
	if mode not in ('direct', 'finance-company') then
		raise exception 'Invoice payment settings are not configured' using errcode = '22023';
	end if;

	select * into seller
	from public.business_settings_sellers
	where merchant_id = p_merchant_id and entity_id = p_entity_id and owner_user_id = p_owner_id
	for update;
	if not found then
		raise exception 'Invoice seller settings are not configured' using errcode = '22023';
	end if;

	select * into entity
	from public.business_entities
	where id = p_entity_id and user_id = p_owner_id and is_active = true;
	if not found then
		raise exception 'Invoice seller unavailable' using errcode = '42501';
	end if;

	if p_terminal_id is not null and not exists (
		select 1 from public.terminals
		where id = p_terminal_id and entity_id = p_entity_id and user_id = p_owner_id and is_active = true
	) then
		raise exception 'Invoice terminal unavailable' using errcode = '42501';
	end if;

	if seller.config ->> 'vatStatus' not in ('vat', 'no-vat') then
		raise exception 'Invoice VAT status is not configured' using errcode = '22023';
	end if;

	invoice_number := concat(
		seller.config ->> 'prefix',
		case when seller.config ->> 'prefix' = '' then '' else '-' end,
		lpad(seller.config ->> 'nextNumber', (seller.config ->> 'padding')::integer, '0')
	);
	tax_text := case seller.config ->> 'vatStatus' when 'vat' then 'у т.ч. ПДВ' else 'без ПДВ' end;
	scenario_label := case p_type
		when 'table' then 'послуги закладу'
		when 'delivery' then 'товари та доставку'
		else 'товари/послуги'
	end;
	business_purpose := btrim(regexp_replace(
		replace(replace(replace(replace(replace(replace(replace(
			seller.config ->> 'purposeTemplate',
			'{number}', invoice_number),
			'{date}', to_char(current_date, 'DD.MM.YYYY')),
			'{scenario}', scenario_label),
			'{amount}', case when p_base_amount + p_delivery_fee = 0 then ''
				else to_char(p_base_amount + p_delivery_fee, 'FM999999999999990.00') end),
			'{customer}', ''),
			'{contract}', seller.config ->> 'contractReference'),
			'{tax}', tax_text),
		'\s+', ' ', 'g'));

	if mode = 'direct' then
		recipient_name := entity.business_name;
		recipient_iban := upper(replace(entity.iban, ' ', ''));
		recipient_tax_id := entity.tax_id;
		final_purpose := business_purpose;
	else
		recipient_name := settings.config ->> 'financeName';
		recipient_iban := upper(replace(settings.config ->> 'financeIban', ' ', ''));
		recipient_tax_id := settings.config ->> 'financeTaxId';
		final_purpose := settings.config ->> 'financePurposeTemplate';
		if final_purpose in (
			'{business_purpose} | Юридична назва продавця: {seller_name}; власний IBAN продавця: {seller_iban}; Код провайдера: {provider_code}; ID продавця: {provider_seller_id}; код продавця: {seller_tax_id}; договір: {contract_reference}; ID платежу: {payment_id}',
			'{business_purpose} Продавець: {seller_name}, ЄДРПОУ {seller_tax_id}, IBAN {seller_iban}; дог. {contract_reference}; {provider_seller_id}; {provider_code}.'
		) then
			final_purpose := business_purpose
				|| ' Продавець: ' || entity.business_name
				|| ', ЄДРПОУ ' || entity.tax_id
				|| ', IBAN ' || upper(replace(entity.iban, ' ', ''))
				|| case when nullif(btrim(seller.config ->> 'contractReference'), '') is not null
					then '; дог. ' || btrim(seller.config ->> 'contractReference') else '' end
				|| case when nullif(btrim(seller.config ->> 'providerSellerId'), '') is not null
					then '; ' || btrim(seller.config ->> 'providerSellerId') else '' end
				|| case when nullif(btrim(seller.config ->> 'providerCode'), '') is not null
					then '; ' || btrim(seller.config ->> 'providerCode') else '' end
				|| '.';
		else
			final_purpose := replace(final_purpose, '{business_purpose}', business_purpose);
			final_purpose := replace(final_purpose, '{seller_name}', entity.business_name);
			final_purpose := replace(final_purpose, '{seller_iban}', upper(replace(entity.iban, ' ', '')));
			final_purpose := replace(final_purpose, '{seller_tax_id}', entity.tax_id);
			final_purpose := replace(final_purpose, '{provider_code}', seller.config ->> 'providerCode');
			final_purpose := replace(final_purpose, '{provider_seller_id}', seller.config ->> 'providerSellerId');
			final_purpose := replace(final_purpose, '{contract_reference}', seller.config ->> 'contractReference');
			final_purpose := replace(final_purpose, '{payment_id}', server_payment_id);
		end if;
	end if;

	if recipient_name is null or btrim(recipient_name) = ''
		or recipient_iban !~ '^UA[0-9]{27}$'
		or recipient_tax_id !~ '^([0-9]{8}|[0-9]{10})$'
		or final_purpose is null or btrim(final_purpose) = ''
		or char_length(final_purpose) > (case when mode = 'finance-company' then 408 else 420 end) then
		raise exception 'Invoice payment settings are incomplete' using errcode = '22023';
	end if;

	update public.business_settings_sellers
	set config = jsonb_set(config, '{nextNumber}', to_jsonb((config ->> 'nextNumber')::bigint + 1))
	where merchant_id = p_merchant_id and entity_id = p_entity_id;

	insert into public.orders (
		merchant_id, entity_id, terminal_id, type, order_number, title, description,
		base_amount, delivery_fee, total_amount, currency, table_number, status, expires_at,
		scenario_config, payment_acceptance_mode, payment_recipient_name,
		payment_recipient_iban, payment_recipient_tax_id, payment_purpose,
		payment_id, payment_settings_revision
	) values (
		p_merchant_id, p_entity_id, p_terminal_id, p_type, invoice_number,
		coalesce(nullif(btrim(p_title), ''), 'Рахунок ' || invoice_number), p_description,
		p_base_amount, p_delivery_fee, p_base_amount + p_delivery_fee, 'UAH', p_table_number,
		case when p_type = 'table' then 'preparing' else 'pending' end,
		case when p_type = 'table' then p_expires_at else null end,
		p_scenario_config, mode, recipient_name, recipient_iban, recipient_tax_id,
		final_purpose, server_payment_id, settings.revision
	)
	returning * into result;

	return result;
end
$$;

revoke all on function public.create_merchant_api_invoice(uuid, uuid, uuid, text, text, text, numeric, numeric, integer, uuid, jsonb, timestamptz) from public, anon, authenticated;
grant execute on function public.create_merchant_api_invoice(uuid, uuid, uuid, text, text, text, numeric, numeric, integer, uuid, jsonb, timestamptz) to service_role;
grant usage on schema business_settings_private to service_role;
grant execute on function business_settings_private.valid_seller(jsonb) to service_role;
grant execute on function business_settings_private.valid_text(jsonb, integer) to service_role;
grant execute on function business_settings_private.valid_template(jsonb, integer, text) to service_role;

create function public.merchant_api_key_orders(
	p_secret_hash text,
	p_method text,
	p_order_id text default null,
	p_query jsonb default '{}'::jsonb,
	p_body jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
	api_key public.merchant_api_keys%rowtype;
	owner_id uuid;
	required_scope text;
	result public.orders%rowtype;
	output jsonb;
	page_limit integer;
	page_offset integer;
begin
	if current_user <> 'service_role' then
		raise insufficient_privilege;
	end if;
	select * into api_key from public.merchant_api_keys
	where secret_hash = p_secret_hash for update;
	if not found or api_key.revoked_at is not null
		or (api_key.expires_at is not null and api_key.expires_at <= clock_timestamp()) then
		return jsonb_build_object('status', 401, 'body', jsonb_build_object('error', 'Unauthorized'));
	end if;
	if p_method = 'GET' then required_scope := 'orders:read';
	elsif p_method = 'POST' and p_order_id is null then
		required_scope := 'orders:write';
	else
		return jsonb_build_object('status', 403, 'body', jsonb_build_object('error', 'Forbidden'));
	end if;
	if not (required_scope = any(api_key.scopes)) then
		return jsonb_build_object('status', 403, 'body', jsonb_build_object('error', 'Forbidden'));
	end if;
	select user_id into owner_id from public.merchants where id = api_key.merchant_id;
	if owner_id is null or owner_id <> api_key.created_by then
		return jsonb_build_object('status', 401, 'body', jsonb_build_object('error', 'Unauthorized'));
	end if;
	if (p_body ? 'merchant_id' and p_body ->> 'merchant_id' is distinct from api_key.merchant_id::text)
		or (p_query ? 'merchant_id' and p_query ->> 'merchant_id' is distinct from api_key.merchant_id::text) then
		return jsonb_build_object('status', 403, 'body', jsonb_build_object('error', 'Forbidden'));
	end if;
	update public.merchant_api_keys set last_used_at = clock_timestamp() where id = api_key.id;

	begin
		if jsonb_typeof(p_body) is distinct from 'object' or jsonb_typeof(p_query) is distinct from 'object' then
			raise invalid_parameter_value;
		end if;
		if p_method = 'GET' and p_order_id is null then
			page_limit := coalesce((p_query ->> 'limit')::integer, 50);
			page_offset := coalesce((p_query ->> 'offset')::integer, 0);
			if page_limit not between 1 and 100 or page_offset < 0 then raise invalid_parameter_value; end if;
			select coalesce(jsonb_agg(to_jsonb(page)), '[]'::jsonb) into output from (
				select * from public.orders
				where merchant_id = api_key.merchant_id
					and (nullif(p_query ->> 'status', '') is null or status::text = p_query ->> 'status')
				order by created_at desc, id desc limit page_limit offset page_offset
			) page;
			return jsonb_build_object('status', 200, 'body', jsonb_build_object(
				'orders', output, 'total', jsonb_array_length(output), 'limit', page_limit, 'offset', page_offset));
		elsif p_method = 'POST' then
			select * into result from public.create_merchant_api_invoice(
				owner_id, api_key.merchant_id, (p_body ->> 'entity_id')::uuid,
				coalesce(nullif(p_body ->> 'type', ''), 'fixed'), coalesce(p_body ->> 'title', ''), p_body ->> 'description',
				coalesce((p_body ->> 'amount')::numeric, (p_body ->> 'base_amount')::numeric, 0),
				coalesce((p_body ->> 'delivery_fee')::numeric, 0), (p_body ->> 'table_number')::integer,
				(p_body ->> 'terminal_id')::uuid, p_body -> 'scenario_config',
				case when p_body ->> 'type' = 'table' then (p_body ->> 'expires_at')::timestamptz else null end
			);
		else
			select * into result from public.orders
			where id::text = p_order_id and merchant_id = api_key.merchant_id for update;
			if not found then
				return jsonb_build_object('status', 404, 'body', jsonb_build_object('error', 'Order not found'));
			end if;
			if p_method = 'GET' then
				select to_jsonb(result) || jsonb_build_object(
					'merchants', (select to_jsonb(merchant) from public.merchants merchant where id = api_key.merchant_id),
					'business_entities', (select to_jsonb(entity) from public.business_entities entity
						where id = result.entity_id and user_id = owner_id)
				) into output;
				return jsonb_build_object('status', 200, 'body', output);
			end if;
		end if;
		return jsonb_build_object('status', 200, 'body', jsonb_build_object('success', true, 'order', to_jsonb(result)));
	exception
		when insufficient_privilege then
			return jsonb_build_object('status', 403, 'body', jsonb_build_object('error', 'Forbidden'));
		when unique_violation then
			return jsonb_build_object('status', 409, 'body', jsonb_build_object('error', 'Conflict'));
		when data_exception or integrity_constraint_violation then
			return jsonb_build_object('status', 422, 'body', jsonb_build_object('error', 'Unprocessable entity'));
	end;
end;
$$;

revoke all on function public.merchant_api_key_orders(text, text, text, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.merchant_api_key_orders(text, text, text, jsonb, jsonb) to service_role;

commit;
