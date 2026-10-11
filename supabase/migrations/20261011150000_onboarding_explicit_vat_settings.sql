BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';

DO $dependencies$
BEGIN
  IF pg_catalog.to_regprocedure('public.save_business_settings(uuid,integer,jsonb)') IS NULL THEN
    RAISE EXCEPTION 'Required dependency public.save_business_settings(uuid,integer,jsonb) is missing';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM (VALUES ('entity_id', 'uuid'), ('user_id', 'uuid'), ('phone', 'text'),
      ('contact_email', 'text'), ('website', 'text')) AS required(column_name, type_name)
    WHERE NOT EXISTS (
      SELECT 1 FROM pg_catalog.pg_attribute attribute
      WHERE attribute.attrelid = pg_catalog.to_regclass('public.business_entity_contacts')
        AND attribute.attname = required.column_name
        AND attribute.atttypid = pg_catalog.to_regtype(required.type_name)
        AND attribute.attnum > 0 AND NOT attribute.attisdropped
    )
  ) THEN
    RAISE EXCEPTION 'Required dependency public.business_entity_contacts columns are missing or incompatible';
  END IF;
END;
$dependencies$;

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
  vat_status text := p_input->>'vat_status';
BEGIN
  IF owner_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(p_input) IS DISTINCT FROM 'object'
    OR legal_type IS NULL OR legal_type NOT IN ('fop', 'tov', 'self_employed', 'ngo')
    OR vat_status IS NULL OR vat_status NOT IN ('vat', 'no-vat')
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
    RETURN jsonb_build_object('merchant', to_jsonb(merchant_row), 'entity', NULL, 'created', false);
  END IF;

  INSERT INTO public.business_entities
    (user_id, business_type, business_name, display_name, tax_id, iban, bank_name, is_active)
  VALUES (owner_id, legal_type, legal_name, display_label, tax_number, account_iban, bank_label, true)
  RETURNING * INTO entity_row;

  INSERT INTO public.business_entity_contacts (entity_id, user_id, phone, contact_email, website)
  VALUES (entity_row.id, owner_id, contact_phone, contact_email, contact_website);

  PERFORM public.save_business_settings(merchant_row.id, 0, jsonb_build_object(
      'version', 2,
      'mode', 'direct',
      'financeName', '',
      'financeIban', '',
      'financeTaxId', '',
      'financePurposeTemplate', '{business_purpose} Продавець: {seller_name}, ЄДРПОУ {seller_tax_id}, IBAN {seller_iban}; дог. {contract_reference}; {provider_seller_id}; {provider_code}.',
      'sellers', jsonb_build_object(entity_row.id::text, jsonb_build_object(
      'vatStatus', vat_status,
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
    ))
  ));

  RETURN jsonb_build_object('merchant', to_jsonb(merchant_row), 'entity',
    to_jsonb(entity_row) || jsonb_build_object('phone', contact_phone,
      'contact_email', contact_email, 'website', contact_website), 'created', true);
END;
$$;

REVOKE ALL ON FUNCTION public.complete_merchant_onboarding(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_merchant_onboarding(jsonb) TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;