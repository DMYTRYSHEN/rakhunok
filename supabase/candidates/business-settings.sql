-- LOCAL CANDIDATE ONLY. Not a checkout migration; no operative table DDL/DML.
-- Install once as a trusted owner with BYPASSRLS (e.g. postgres).
-- RPC contract (jsonb): {"revision": integer, "document": null | version-2 object}.
-- Missing settings: revision 0/document null. First save expects 0; subsequent saves
-- replace the entire aggregate and increment the server revision, even for no-ops.
-- SQLSTATE: 22023 invalid input, 42501 unavailable/not owned, 40001 CAS conflict.
-- Size means octet_length(document::text) <= 2097152 (canonical jsonb UTF-8).
-- Empty optional strings are allowed; both purpose templates must be nonblank.
-- Tokens use single braces. No activation, verification, numbering or payment side effects.
-- Ownership is pinned to the original saving user: merchant transfer cannot expose
-- an old owner's settings. Entity transfer invalidates the WHOLE aggregate, including
-- replacement attempts. Recovery requires a separately authorized admin workflow.
-- No operative FKs, triggers, writes or row locks. Deletion leaves draft rows and
-- revisions unchanged. Missing/transferred references invalidate the WHOLE draft;
-- even an explicit replacement cannot prune them. No automatic repair is provided.
-- Only settings parents serialize RPCs (SHARE/read, UPDATE/save). First-save races
-- serialize through the settings unique index, never through an operative merchant.
-- READ COMMITTED is required: ownership is checked in one nonlocking snapshot AFTER
-- settings lock waits. Uncommitted/later operative changes are not visible to that
-- snapshot; this is NOT commit-time revocation. Subsequent RPCs recheck ownership.
-- Ordinary SELECT AccessShare table locks remain (may conflict with DDL, not DML).
-- Revision exhaustion aborts settings saves only (40001), never operative deletion.
-- Reads are VOLATILE/primary-transaction RPCs; not suitable for read-only replicas.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';

CREATE SCHEMA business_settings_private;
REVOKE ALL ON SCHEMA business_settings_private FROM PUBLIC, anon, authenticated;

CREATE FUNCTION business_settings_private.valid_text(v jsonb, max_length integer)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT coalesce(jsonb_typeof(v) = 'string'
    -- PostgreSQL counts code points; JS String.length counts UTF-16 code units.
    AND (SELECT coalesce(sum(CASE WHEN ascii(ch) > 65535 THEN 2 ELSE 1 END), 0)
      FROM regexp_split_to_table(v #>> '{}', '') AS chars(ch)) <= max_length
    -- jsonb rejects U+0000 itself; reject the remaining C0, DEL and C1 here.
    AND (v #>> '{}') !~ U&'[\0001-\001F\007F-\009F]', false)
$$;

CREATE FUNCTION business_settings_private.valid_template(v jsonb, max_length integer, tokens text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT business_settings_private.valid_text(v, max_length)
    -- Exact ECMAScript trim set, not locale-dependent POSIX [:space:].
    AND coalesce(btrim(v #>> '{}', U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF') <> ''
      AND regexp_replace(v #>> '{}', '\{(' || tokens || ')\}', '', 'g') !~ '[{}]', false)
$$;

CREATE FUNCTION business_settings_private.valid_seller(v jsonb)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
DECLARE
  k text;
  -- Exact alphabet shared with the model; contract tests prevent drift.
  prefix_alphabet constant text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789АБВГҐДЕЄЖЗИІЇЙКЛМНОПРСТУФХЦЧШЩЬЮЯабвгґдеєжзиіїйклмнопрстуфхцчшщьюя_-';
BEGIN
  IF jsonb_typeof(v) IS DISTINCT FROM 'object' THEN RETURN false; END IF;
  IF NOT (v ?& ARRAY['vatStatus','prefix','nextNumber','padding','purposeTemplate',
      'providerSellerId','providerCode','contractReference','qrCategory','qrFunction','allowAmountEdit'])
    OR (SELECT count(*) FROM jsonb_object_keys(v)) <> 11 THEN RETURN false; END IF;
  FOREACH k IN ARRAY ARRAY['vatStatus','prefix','providerSellerId','providerCode',
      'contractReference','qrCategory','qrFunction'] LOOP
    IF NOT business_settings_private.valid_text(v -> k, 200) THEN RETURN false; END IF;
  END LOOP;
  IF v ->> 'vatStatus' NOT IN ('unknown','vat','no-vat')
    OR v ->> 'qrFunction' NOT IN ('UCT','ICT','XCT')
    OR jsonb_typeof(v -> 'allowAmountEdit') <> 'boolean'
    OR NOT business_settings_private.valid_text(v -> 'prefix', 20)
    -- Literal membership avoids locale/range/Unicode-version classification differences.
    OR translate(v ->> 'prefix', prefix_alphabet, '') <> ''
    OR v ->> 'qrCategory' !~ '^[A-Z0-9]{4}/[A-Z0-9]{4}$'
    OR NOT business_settings_private.valid_template(v -> 'purposeTemplate', 420, 'number|date|tax')
    THEN RETURN false; END IF;
  FOREACH k IN ARRAY ARRAY['nextNumber','padding'] LOOP
    IF jsonb_typeof(v -> k) <> 'number' THEN RETURN false; END IF;
    IF (v ->> k)::numeric <> trunc((v ->> k)::numeric)
      OR (v ->> k)::numeric < 1
      OR (v ->> k)::numeric > (CASE k WHEN 'padding' THEN 12 ELSE 999999999999 END)
      THEN RETURN false; END IF;
  END LOOP;
  RETURN true;
END
$$;

CREATE FUNCTION business_settings_private.valid_document(v jsonb)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
DECLARE k text; item record;
BEGIN
  IF v IS NULL OR octet_length(v::text) > 2097152
    OR jsonb_typeof(v) IS DISTINCT FROM 'object' THEN RETURN false; END IF;
  IF NOT (v ?& ARRAY['version','mode','financeName','financeIban','financeTaxId',
      'financePurposeTemplate','sellers'])
    OR (SELECT count(*) FROM jsonb_object_keys(v)) <> 7
    OR v -> 'version' IS DISTINCT FROM '2'::jsonb THEN RETURN false; END IF;
  FOREACH k IN ARRAY ARRAY['mode','financeName','financeIban','financeTaxId'] LOOP
    IF NOT business_settings_private.valid_text(v -> k, 200) THEN RETURN false; END IF;
  END LOOP;
  IF v ->> 'mode' NOT IN ('unconfigured','direct','finance-company')
    OR (v ->> 'financeIban' <> '' AND v ->> 'financeIban' !~ '^UA[0-9]{27}$')
    OR (v ->> 'financeTaxId' <> '' AND v ->> 'financeTaxId' !~ '^([0-9]{8}|[0-9]{10})$')
    OR NOT business_settings_private.valid_template(v -> 'financePurposeTemplate', 1000,
      'business_purpose|seller_name|seller_iban|seller_tax_id|provider_code|provider_seller_id|contract_reference|payment_id')
    OR jsonb_typeof(v -> 'sellers') IS DISTINCT FROM 'object' THEN RETURN false; END IF;
  IF (SELECT count(*) FROM jsonb_object_keys(v -> 'sellers')) > 1000 THEN RETURN false; END IF;
  FOR item IN SELECT key, value FROM jsonb_each(v -> 'sellers') LOOP
    IF item.key !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      OR NOT business_settings_private.valid_seller(item.value) THEN RETURN false; END IF;
  END LOOP;
  -- Canonical lowercase keys cannot alias the same UUID identity.
  RETURN true;
END
$$;

CREATE TABLE public.business_settings (
  merchant_id uuid PRIMARY KEY,
  owner_user_id uuid NOT NULL,
  revision integer NOT NULL CHECK (revision > 0),
  config jsonb NOT NULL CHECK (business_settings_private.valid_document(config || '{"sellers":{}}'::jsonb)
    AND NOT config ? 'sellers'),
  UNIQUE (merchant_id, owner_user_id)
);

CREATE TABLE public.business_settings_sellers (
  merchant_id uuid NOT NULL,
  owner_user_id uuid NOT NULL,
  entity_id uuid NOT NULL,
  seller_key text NOT NULL CHECK (seller_key ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND seller_key::uuid = entity_id),
  config jsonb NOT NULL CHECK (business_settings_private.valid_seller(config)),
  PRIMARY KEY (merchant_id, entity_id),
  FOREIGN KEY (merchant_id, owner_user_id)
    REFERENCES public.business_settings(merchant_id, owner_user_id) ON DELETE CASCADE
);
CREATE INDEX business_settings_sellers_entity_idx ON public.business_settings_sellers(entity_id);

-- RPC-only surface. No policies intentionally: default-deny RLS also protects
-- against accidentally restored table grants. Definers explicitly authorize below.
ALTER TABLE public.business_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_settings FORCE ROW LEVEL SECURITY;
ALTER TABLE public.business_settings_sellers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_settings_sellers FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.business_settings, public.business_settings_sellers FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.read_business_settings(p_merchant_id uuid)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  actor uuid := auth.uid();
  settings public.business_settings%ROWTYPE;
  available boolean;
  sellers jsonb := '{}'::jsonb;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'Business settings unavailable' USING ERRCODE = '42501'; END IF;
  IF current_setting('transaction_isolation') <> 'read committed' THEN
    RAISE EXCEPTION 'Business settings require READ COMMITTED' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO settings FROM public.business_settings WHERE merchant_id = p_merchant_id FOR SHARE;
  -- One fresh authorization snapshot after any parent wait. No operative row locks.
  SELECT EXISTS (SELECT 1 FROM public.merchants WHERE id = p_merchant_id AND user_id = actor)
    AND NOT EXISTS (
      SELECT 1 FROM public.business_settings_sellers s
      LEFT JOIN public.business_entities e ON e.id = s.entity_id
      WHERE s.merchant_id = p_merchant_id AND e.user_id IS DISTINCT FROM actor
    ) INTO available;
  IF NOT available OR (settings.merchant_id IS NOT NULL AND settings.owner_user_id <> actor) THEN
    RAISE EXCEPTION 'Business settings unavailable' USING ERRCODE = '42501';
  END IF;
  IF settings.merchant_id IS NULL THEN RETURN jsonb_build_object('revision', 0, 'document', NULL); END IF;
  SELECT coalesce(jsonb_object_agg(seller_key, config), '{}'::jsonb) INTO sellers
    FROM public.business_settings_sellers WHERE merchant_id = p_merchant_id;
  RETURN jsonb_build_object('revision', settings.revision,
    'document', settings.config || jsonb_build_object('sellers', sellers));
EXCEPTION WHEN lock_not_available THEN
  RAISE EXCEPTION 'Business settings lock conflict; retry transaction' USING ERRCODE = '40001';
END
$$;

CREATE FUNCTION public.save_business_settings(p_merchant_id uuid, p_expected_revision integer, p_document jsonb)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  actor uuid := auth.uid();
  current_revision integer := 0;
  saved_owner uuid;
  inserted boolean := false;
  available boolean;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'Business settings unavailable' USING ERRCODE = '42501'; END IF;
  IF current_setting('transaction_isolation') <> 'read committed' THEN
    RAISE EXCEPTION 'Business settings require READ COMMITTED' USING ERRCODE = '22023';
  END IF;
  -- Cheap initial rejection only; definitive authorization is repeated after lock waits.
  PERFORM 1 FROM public.merchants WHERE id = p_merchant_id AND user_id = actor;
  IF NOT FOUND THEN RAISE EXCEPTION 'Business settings unavailable' USING ERRCODE = '42501'; END IF;
  IF p_expected_revision IS NULL OR p_expected_revision < 0
    OR NOT business_settings_private.valid_document(p_document) THEN
    RAISE EXCEPTION 'Invalid business settings document or revision' USING ERRCODE = '22023';
  END IF;
  -- The speculative first row is never exposed before commit and rolls back on ANY
  -- later error. DO NOTHING waits for a competing first insert without overwriting it.
  IF p_expected_revision = 0 THEN
    INSERT INTO public.business_settings(merchant_id, owner_user_id, revision, config)
      VALUES (p_merchant_id, actor, 1, p_document - 'sellers')
      ON CONFLICT (merchant_id) DO NOTHING;
    inserted := FOUND;
  END IF;
  SELECT revision, owner_user_id INTO current_revision, saved_owner
    FROM public.business_settings WHERE merchant_id = p_merchant_id FOR UPDATE;
  IF NOT FOUND THEN current_revision := 0;
  ELSIF saved_owner <> actor THEN
    RAISE EXCEPTION 'Business settings unavailable' USING ERRCODE = '42501';
  END IF;
  -- One nonlocking snapshot checks merchant AND BOTH old/new references. Missing
  -- old references also fail: omission cannot bypass transfer/deletion revocation.
  SELECT EXISTS (SELECT 1 FROM public.merchants WHERE id = p_merchant_id AND user_id = actor)
    AND NOT EXISTS (
      SELECT 1 FROM (
        SELECT entity_id FROM public.business_settings_sellers WHERE merchant_id = p_merchant_id
        UNION SELECT key::uuid FROM jsonb_each(p_document -> 'sellers')
      ) refs LEFT JOIN public.business_entities e ON e.id = refs.entity_id
      WHERE e.user_id IS DISTINCT FROM actor
    ) INTO available;
  IF NOT available THEN
    RAISE EXCEPTION 'Business settings unavailable' USING ERRCODE = '42501';
  END IF;
  IF inserted THEN current_revision := 0; END IF;
  IF current_revision <> p_expected_revision OR current_revision = 2147483647 THEN
    RAISE EXCEPTION 'Business settings revision conflict' USING ERRCODE = '40001';
  END IF;
  IF NOT inserted THEN
    UPDATE public.business_settings SET revision = current_revision + 1, config = p_document - 'sellers'
      WHERE merchant_id = p_merchant_id;
  END IF;
  DELETE FROM public.business_settings_sellers WHERE merchant_id = p_merchant_id;
  INSERT INTO public.business_settings_sellers(merchant_id, owner_user_id, entity_id, seller_key, config)
    SELECT p_merchant_id, actor, key::uuid, key, value FROM jsonb_each(p_document -> 'sellers');
  RETURN jsonb_build_object('revision', current_revision + 1, 'document', p_document);
EXCEPTION WHEN lock_not_available THEN
  RAISE EXCEPTION 'Business settings lock conflict; retry transaction' USING ERRCODE = '40001';
END
$$;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA business_settings_private FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.read_business_settings(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.save_business_settings(uuid, integer, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.read_business_settings(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_business_settings(uuid, integer, jsonb) TO authenticated;
COMMIT;