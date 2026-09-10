import { readFile } from 'node:fs/promises';

export const candidate = await readFile(new URL('../../../supabase/candidates/business-settings.sql', import.meta.url), 'utf8');
const model = await readFile(new URL('../../../src/lib/features/dashboard/business-settings/business-settings.ts', import.meta.url), 'utf8');
export const prefixAlphabet = model.match(/export const businessSettingsPrefixAlphabet = '([^']+)'/)[1];
export const rejectedPrefixes = ['é', '漢', '١', '²', 'Ⅷ', 'Ａ', '９', 'Ы', 'ы', 'Э', 'э', 'Ъ', 'ъ', 'Ё', 'ё',
  '\u0345', '\u05b0', '\u{10400}', '\u{1d7ce}', 'І\u0308', 'a b', 'a.b', 'a/b', '😀'];
export const ids = {
  user: '10000000-0000-0000-0000-000000000001',
  other: '10000000-0000-0000-0000-000000000002',
  merchant: '20000000-0000-0000-0000-000000000001',
  sibling: '20000000-0000-0000-0000-000000000002',
  foreign: '20000000-0000-0000-0000-000000000003',
  seller: 'abcdef00-0000-0000-0000-000000000001',
  second: 'abcdef00-0000-0000-0000-000000000002',
  foreignSeller: 'abcdef00-0000-0000-0000-000000000003',
  missing: 'ffffffff-ffff-ffff-ffff-ffffffffffff'
};

// Synthetic only. Deliberately no business_entities.merchant_id; broad legacy RLS.
export const fixtureSql = `
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
  $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
GRANT USAGE ON SCHEMA public, auth TO authenticated, anon;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated, anon;
CREATE TABLE public.merchants(id uuid PRIMARY KEY, user_id uuid, status text DEFAULT 'draft');
CREATE TABLE public.business_entities(id uuid PRIMARY KEY, user_id uuid, verified boolean DEFAULT false);
CREATE TABLE public.merchant_settings(merchant_id uuid PRIMARY KEY, table_order_ttl_seconds integer);
CREATE TABLE public.orders(id integer PRIMARY KEY, merchant_id uuid, status text, expires_at timestamptz);
INSERT INTO public.merchants(id,user_id) VALUES
  ('${ids.merchant}','${ids.user}'),('${ids.sibling}','${ids.user}'),('${ids.foreign}','${ids.other}');
INSERT INTO public.business_entities(id,user_id) VALUES
  ('${ids.seller}','${ids.user}'),('${ids.second}','${ids.user}'),('${ids.foreignSeller}','${ids.other}');
INSERT INTO public.merchant_settings VALUES ('${ids.merchant}',1800);
INSERT INTO public.orders VALUES (1,'${ids.merchant}','pending','2026-09-08T12:00:00Z');
ALTER TABLE public.merchants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_entities ENABLE ROW LEVEL SECURITY;
CREATE POLICY legacy_read ON public.merchants FOR SELECT TO authenticated USING(true);
CREATE POLICY legacy_read ON public.business_entities FOR SELECT TO authenticated USING(true);
GRANT SELECT ON public.merchants,public.business_entities TO authenticated;
`;

export function seller(overrides = {}) {
  return { vatStatus: 'unknown', prefix: 'Рахунок_09-', nextNumber: 1, padding: 6,
    purposeTemplate: 'Рахунок {number} від {date}, {tax}', providerSellerId: '',
    providerCode: '', contractReference: '', qrCategory: 'OTHR/GDDS', qrFunction: 'UCT',
    allowAmountEdit: false, ...overrides };
}

export function document(overrides = {}) {
  return { version: 2, mode: 'unconfigured', financeName: '', financeIban: '', financeTaxId: '',
    financePurposeTemplate: '{business_purpose}', sellers: { [ids.seller]: seller() }, ...overrides };
}

export async function identity(db, user = ids.user, role = 'authenticated') {
  if (!['authenticated', 'anon'].includes(role)) throw new Error('Unsafe test role');
  await db.query('RESET ROLE');
  await db.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [user ?? '']);
  await db.query(`SET ROLE ${role}`);
  const { rows } = await db.query('SELECT current_user AS role');
  if (rows[0].role !== role) throw new Error('SET ROLE did not take effect');
}

export async function read(db, merchant = ids.merchant) {
  return (await db.query('SELECT public.read_business_settings($1::uuid) AS result', [merchant])).rows[0].result;
}

export async function save(db, revision = 0, value = document(), merchant = ids.merchant) {
  return (await db.query('SELECT public.save_business_settings($1::uuid,$2::integer,$3::jsonb) AS result',
    [merchant, revision, JSON.stringify(value)])).rows[0].result;
}

export async function operativeSnapshot(db) {
  await db.query('RESET ROLE');
  const result = {};
  for (const table of ['merchants', 'business_entities', 'merchant_settings', 'orders']) {
    // Include tuple xmin: a no-op UPDATE is a forbidden operative write too.
    result[table] = (await db.query(`SELECT row_to_json(t) AS row, xmin::text FROM public.${table} t ORDER BY 1::text`)).rows;
  }
  return result;
}

export async function settingsSnapshot(db) {
  await db.query('RESET ROLE');
  const result = {};
  for (const table of ['business_settings', 'business_settings_sellers']) {
    result[table] = (await db.query(`SELECT row_to_json(t) AS row, xmin::text FROM public.${table} t ORDER BY 1::text`)).rows;
  }
  return result;
}