begin;

alter table public.orders
	add column if not exists payment_acceptance_mode text,
	add column if not exists payment_recipient_name text,
	add column if not exists payment_recipient_iban text,
	add column if not exists payment_recipient_tax_id text,
	add column if not exists payment_purpose text,
	add column if not exists payment_id text,
	add column if not exists payment_settings_revision integer;

alter table public.orders
	drop constraint if exists orders_payment_snapshot_check,
	add constraint orders_payment_snapshot_check check (
		(payment_acceptance_mode is null
			and payment_recipient_name is null
			and payment_recipient_iban is null
			and payment_recipient_tax_id is null
			and payment_purpose is null
			and payment_id is null
			and payment_settings_revision is null)
		or
		(payment_acceptance_mode in ('direct', 'finance-company')
			and btrim(payment_recipient_name) <> ''
			and payment_recipient_iban ~ '^UA[0-9]{27}$'
			and payment_recipient_tax_id ~ '^([0-9]{8}|[0-9]{10})$'
			and btrim(payment_purpose) <> ''
			and char_length(payment_purpose) <= 420
			and payment_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
			and payment_settings_revision > 0)
	);

create or replace function checkout_private.protect_order_payment_snapshot()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
	if new.payment_acceptance_mode is distinct from old.payment_acceptance_mode
		or new.payment_recipient_name is distinct from old.payment_recipient_name
		or new.payment_recipient_iban is distinct from old.payment_recipient_iban
		or new.payment_recipient_tax_id is distinct from old.payment_recipient_tax_id
		or new.payment_purpose is distinct from old.payment_purpose
		or new.payment_id is distinct from old.payment_id
		or new.payment_settings_revision is distinct from old.payment_settings_revision then
		raise exception 'order_payment_snapshot_immutable';
	end if;
	return new;
end
$$;

drop trigger if exists orders_payment_snapshot_immutable on public.orders;
create trigger orders_payment_snapshot_immutable
before update of payment_acceptance_mode, payment_recipient_name, payment_recipient_iban,
	payment_recipient_tax_id, payment_purpose, payment_id, payment_settings_revision
on public.orders
for each row execute function checkout_private.protect_order_payment_snapshot();

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
		if new.payment_acceptance_mode = 'finance-company' and new.payment_purpose is not null then
			new.payment_purpose := 'ID: ' || new.short_id || '. ' || new.payment_purpose;
		end if;
		return new;
	end if;

	if new.short_id is distinct from old.short_id then
		raise exception 'order_short_id_immutable';
	end if;

	return new;
end
$$;

create or replace function public.create_authoritative_invoice(
	p_merchant_id uuid,
	p_entity_id uuid,
	p_type text,
	p_title text,
	p_description text,
	p_base_amount numeric,
	p_delivery_fee numeric default 0,
	p_table_number integer default null,
	p_terminal_id uuid default null,
	p_scenario_config jsonb default null,
	p_expires_at timestamptz default null
)
returns public.orders
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
	actor uuid := auth.uid();
	settings public.business_settings%rowtype;
	seller public.business_settings_sellers%rowtype;
	entity public.business_entities%rowtype;
	mode text;
	invoice_number text;
	business_purpose text;
	final_purpose text;
	server_payment_id text := gen_random_uuid()::text;
	recipient_name text;
	recipient_iban text;
	recipient_tax_id text;
	tax_text text;
	result public.orders%rowtype;
begin
	if actor is null then
		raise exception 'Invoice creation unavailable' using errcode = '42501';
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

	perform 1 from public.merchants where id = p_merchant_id and user_id = actor;
	if not found then
		raise exception 'Invoice creation unavailable' using errcode = '42501';
	end if;

	select * into settings
	from public.business_settings
	where merchant_id = p_merchant_id and owner_user_id = actor
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
	where merchant_id = p_merchant_id and entity_id = p_entity_id and owner_user_id = actor
	for update;
	if not found then
		raise exception 'Invoice seller settings are not configured' using errcode = '22023';
	end if;

	select * into entity
	from public.business_entities
	where id = p_entity_id and user_id = actor and is_active = true;
	if not found then
		raise exception 'Invoice seller unavailable' using errcode = '42501';
	end if;

	if p_terminal_id is not null and not exists (
		select 1 from public.terminals
		where id = p_terminal_id and entity_id = p_entity_id and user_id = actor and is_active = true
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
	business_purpose := replace(replace(replace(
		seller.config ->> 'purposeTemplate',
		'{number}', invoice_number),
		'{date}', to_char(current_date, 'DD.MM.YYYY')),
		'{tax}', tax_text);

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
		or char_length(final_purpose) > case when mode = 'finance-company' then 408 else 420 end then
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

revoke all on function checkout_private.protect_order_payment_snapshot() from public, anon, authenticated;
revoke all on function public.create_authoritative_invoice(uuid, uuid, text, text, text, numeric, numeric, integer, uuid, jsonb, timestamptz)
	from public, anon, authenticated;
grant execute on function public.create_authoritative_invoice(uuid, uuid, text, text, text, numeric, numeric, integer, uuid, jsonb, timestamptz)
	to authenticated;

commit;