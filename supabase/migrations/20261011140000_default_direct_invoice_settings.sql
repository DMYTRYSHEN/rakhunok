begin;
set local lock_timeout = '2s';
set local statement_timeout = '30s';

-- 1. Backfill existing merchants without business_settings: default to mode 'direct'
insert into public.business_settings (merchant_id, owner_user_id, revision, config)
select
  m.id,
  m.user_id,
  1,
  jsonb_build_object(
    'version', 2,
    'mode', 'direct',
    'financeName', '',
    'financeIban', '',
    'financeTaxId', '',
    'financePurposeTemplate', '{business_purpose} Продавець: {seller_name}, ЄДРПОУ {seller_tax_id}, IBAN {seller_iban}; дог. {contract_reference}; {provider_seller_id}; {provider_code}.'
  )
from public.merchants m
where not exists (
  select 1 from public.business_settings bs where bs.merchant_id = m.id
)
on conflict (merchant_id) do nothing;

-- 2. Backfill existing active business_entities without seller settings: default to vatStatus 'no-vat'
insert into public.business_settings_sellers (merchant_id, owner_user_id, entity_id, seller_key, config)
select
  m.id,
  m.user_id,
  e.id,
  e.id::text,
  jsonb_build_object(
    'vatStatus', 'no-vat',
    'prefix', 'RHK',
    'nextNumber', 1,
    'padding', 6,
    'purposeTemplate', 'Оплата за товари/послуги, рахунок {number} від {date}, {tax}.',
    'providerSellerId', '',
    'providerCode', '',
    'contractReference', '',
    'qrCategory', 'OTHR/GDDS',
    'qrFunction', 'ICT',
    'allowAmountEdit', false
  )
from public.merchants m
join public.business_entities e on e.user_id = m.user_id and e.is_active = true
where exists (
  select 1 from public.business_settings bs where bs.merchant_id = m.id
)
and not exists (
  select 1 from public.business_settings_sellers bss
  where bss.merchant_id = m.id and bss.entity_id = e.id
)
on conflict (merchant_id, entity_id) do nothing;

-- 3. Update checkout_private.create_invoice_for_owner to auto-provision direct payment settings & no-vat seller rules on the fly
create or replace function checkout_private.create_invoice_for_owner(
	p_owner uuid,
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
	actor uuid := p_owner;
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

	-- Verify seller entity exists and is active
	select * into entity
	from public.business_entities
	where id = p_entity_id and user_id = actor and is_active = true;
	if not found then
		raise exception 'Invoice seller unavailable' using errcode = '42501';
	end if;

	-- Select or auto-provision business_settings
	select * into settings
	from public.business_settings
	where merchant_id = p_merchant_id and owner_user_id = actor
	for update;
	if not found then
		insert into public.business_settings (merchant_id, owner_user_id, revision, config)
		values (
			p_merchant_id,
			actor,
			1,
			jsonb_build_object(
				'version', 2,
				'mode', 'direct',
				'financeName', '',
				'financeIban', '',
				'financeTaxId', '',
				'financePurposeTemplate', '{business_purpose} Продавець: {seller_name}, ЄДРПОУ {seller_tax_id}, IBAN {seller_iban}; дог. {contract_reference}; {provider_seller_id}; {provider_code}.'
			)
		)
		on conflict (merchant_id) do nothing
		returning * into settings;
		if settings.merchant_id is null then
			select * into settings from public.business_settings where merchant_id = p_merchant_id for update;
		end if;
	end if;

	mode := settings.config ->> 'mode';
	if mode not in ('direct', 'finance-company') then
		mode := 'direct';
		update public.business_settings
		set config = jsonb_set(config, '{mode}', '"direct"')
		where merchant_id = p_merchant_id and owner_user_id = actor;
	end if;

	-- Select or auto-provision business_settings_sellers
	select * into seller
	from public.business_settings_sellers
	where merchant_id = p_merchant_id and entity_id = p_entity_id and owner_user_id = actor
	for update;
	if not found then
		insert into public.business_settings_sellers (merchant_id, owner_user_id, entity_id, seller_key, config)
		values (
			p_merchant_id,
			actor,
			p_entity_id,
			p_entity_id::text,
			jsonb_build_object(
				'vatStatus', 'no-vat',
				'prefix', 'RHK',
				'nextNumber', 1,
				'padding', 6,
				'purposeTemplate', 'Оплата за товари/послуги, рахунок {number} від {date}, {tax}.',
				'providerSellerId', '',
				'providerCode', '',
				'contractReference', '',
				'qrCategory', 'OTHR/GDDS',
				'qrFunction', 'ICT',
				'allowAmountEdit', false
			)
		)
		on conflict (merchant_id, entity_id) do nothing
		returning * into seller;
		if seller.entity_id is null then
			select * into seller from public.business_settings_sellers
			where merchant_id = p_merchant_id and entity_id = p_entity_id for update;
		end if;
	end if;

	if seller.config ->> 'vatStatus' not in ('vat', 'no-vat') then
		seller.config := jsonb_set(seller.config, '{vatStatus}', '"no-vat"');
		update public.business_settings_sellers
		set config = seller.config
		where merchant_id = p_merchant_id and entity_id = p_entity_id and owner_user_id = actor;
	end if;

	if p_terminal_id is not null and not exists (
		select 1 from public.terminals
		where id = p_terminal_id and entity_id = p_entity_id and user_id = actor and is_active = true
	) then
		raise exception 'Invoice terminal unavailable' using errcode = '42501';
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
end;
$$;

revoke all on function checkout_private.create_invoice_for_owner(uuid,uuid,uuid,text,text,text,numeric,numeric,integer,uuid,jsonb,timestamptz) from public,anon,authenticated;

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
language sql
volatile
security definer
set search_path = ''
as $$
	select checkout_private.create_invoice_for_owner(
		auth.uid(),
		p_merchant_id,
		p_entity_id,
		p_type,
		p_title,
		p_description,
		p_base_amount,
		p_delivery_fee,
		p_table_number,
		p_terminal_id,
		p_scenario_config,
		p_expires_at
	);
$$;

revoke all on function public.create_authoritative_invoice(uuid,uuid,text,text,text,numeric,numeric,integer,uuid,jsonb,timestamptz) from public,anon,authenticated;
grant execute on function public.create_authoritative_invoice(uuid,uuid,text,text,text,numeric,numeric,integer,uuid,jsonb,timestamptz) to authenticated;

-- 4. Update complete_merchant_onboarding to auto-provision direct payment settings & no-vat seller rules
CREATE OR REPLACE FUNCTION public.complete_merchant_onboarding(p_input jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  owner_id uuid := auth.uid();
  merchant_row public.merchants%ROWTYPE;
  entity_row public.business_entities%ROWTYPE;
  legal_type text := p_input->>'business_type';
  legal_name text := btrim(p_input->>'business_name');
  display_label text := btrim(p_input->>'display_name');
  tax_number text := btrim(p_input->>'tax_id');
  account_iban text := p_input->>'iban';
  bank_label text := btrim(p_input->>'bank_name');
  contact_phone text := p_input->>'phone';
  contact_email text := p_input->>'contact_email';
  contact_website text := p_input->>'website';
BEGIN
  IF owner_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(p_input) IS DISTINCT FROM 'object'
    OR legal_type IS NULL OR legal_type NOT IN ('fop', 'tov', 'self_employed', 'ngo')
    OR legal_name IS NULL OR length(legal_name) NOT BETWEEN 1 AND 200
    OR display_label IS NULL OR length(display_label) NOT BETWEEN 1 AND 100
    OR tax_number IS NULL
    OR NOT (tax_number ~ CASE WHEN legal_type IN ('fop', 'self_employed') THEN '^[0-9]{10}$' ELSE '^[0-9]{8}$' END)
    OR account_iban IS NULL OR account_iban !~ '^UA[0-9]{27}$'
    OR bank_label IS NULL OR length(bank_label) NOT BETWEEN 1 AND 100
    OR contact_phone IS NULL OR contact_phone !~ '^\+[1-9][0-9]{7,14}$'
    OR contact_email IS NULL OR length(contact_email) > 254
    OR contact_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    OR (contact_website IS NOT NULL AND (length(contact_website) > 2048
      OR contact_website !~ '^https?://[^/@[:space:]]+\.[^/@[:space:]]+([/:?#].*)?$'))
  THEN
    RAISE EXCEPTION 'Invalid onboarding input' USING ERRCODE = '22023';
  END IF;
  IF mod((substr(account_iban, 5) || '3010' || substr(account_iban, 3, 2))::numeric, 97) <> 1 THEN
    RAISE EXCEPTION 'Invalid IBAN' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.merchants
    (user_id, business_type, business_name, display_name, tax_id, iban, bank_name, onboarding_completed)
  VALUES (owner_id, legal_type, legal_name, display_label, tax_number, account_iban, bank_label, true)
  ON CONFLICT (user_id) DO NOTHING
  RETURNING * INTO merchant_row;

  IF merchant_row.id IS NULL THEN
    SELECT * INTO STRICT merchant_row FROM public.merchants WHERE user_id = owner_id;
    INSERT INTO public.business_settings (merchant_id, owner_user_id, revision, config)
    VALUES (
      merchant_row.id,
      owner_id,
      1,
      jsonb_build_object(
        'version', 2,
        'mode', 'direct',
        'financeName', '',
        'financeIban', '',
        'financeTaxId', '',
        'financePurposeTemplate', '{business_purpose} Продавець: {seller_name}, ЄДРПОУ {seller_tax_id}, IBAN {seller_iban}; дог. {contract_reference}; {provider_seller_id}; {provider_code}.'
      )
    )
    ON CONFLICT (merchant_id) DO NOTHING;

    FOR entity_row IN SELECT * FROM public.business_entities WHERE user_id = owner_id AND is_active LOOP
      INSERT INTO public.business_settings_sellers (merchant_id, owner_user_id, entity_id, seller_key, config)
      VALUES (
        merchant_row.id,
        owner_id,
        entity_row.id,
        entity_row.id::text,
        jsonb_build_object(
          'vatStatus', 'no-vat',
          'prefix', 'RHK',
          'nextNumber', 1,
          'padding', 6,
          'purposeTemplate', 'Оплата за товари/послуги, рахунок {number} від {date}, {tax}.',
          'providerSellerId', '',
          'providerCode', '',
          'contractReference', '',
          'qrCategory', 'OTHR/GDDS',
          'qrFunction', 'ICT',
          'allowAmountEdit', false
        )
      )
      ON CONFLICT (merchant_id, entity_id) DO NOTHING;
    END LOOP;

    RETURN jsonb_build_object('merchant', to_jsonb(merchant_row), 'entity', NULL, 'created', false);
  END IF;

  INSERT INTO public.business_entities
    (user_id, business_type, business_name, display_name, tax_id, iban, bank_name, is_active)
  VALUES (owner_id, legal_type, legal_name, display_label, tax_number, account_iban, bank_label, true)
  RETURNING * INTO entity_row;

  INSERT INTO public.business_entity_contacts (entity_id, user_id, phone, contact_email, website)
  VALUES (entity_row.id, owner_id, contact_phone, contact_email, contact_website);

  INSERT INTO public.business_settings (merchant_id, owner_user_id, revision, config)
  VALUES (
    merchant_row.id,
    owner_id,
    1,
    jsonb_build_object(
      'version', 2,
      'mode', 'direct',
      'financeName', '',
      'financeIban', '',
      'financeTaxId', '',
      'financePurposeTemplate', '{business_purpose} Продавець: {seller_name}, ЄДРПОУ {seller_tax_id}, IBAN {seller_iban}; дог. {contract_reference}; {provider_seller_id}; {provider_code}.'
    )
  )
  ON CONFLICT (merchant_id) DO NOTHING;

  INSERT INTO public.business_settings_sellers (merchant_id, owner_user_id, entity_id, seller_key, config)
  VALUES (
    merchant_row.id,
    owner_id,
    entity_row.id,
    entity_row.id::text,
    jsonb_build_object(
      'vatStatus', 'no-vat',
      'prefix', 'RHK',
      'nextNumber', 1,
      'padding', 6,
      'purposeTemplate', 'Оплата за товари/послуги, рахунок {number} від {date}, {tax}.',
      'providerSellerId', '',
      'providerCode', '',
      'contractReference', '',
      'qrCategory', 'OTHR/GDDS',
      'qrFunction', 'ICT',
      'allowAmountEdit', false
    )
  )
  ON CONFLICT (merchant_id, entity_id) DO NOTHING;

  RETURN jsonb_build_object('merchant', to_jsonb(merchant_row), 'entity',
    to_jsonb(entity_row) || jsonb_build_object('phone', contact_phone,
      'contact_email', contact_email, 'website', contact_website), 'created', true);
END;
$$;

REVOKE ALL ON FUNCTION public.complete_merchant_onboarding(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_merchant_onboarding(jsonb) TO authenticated;

commit;
