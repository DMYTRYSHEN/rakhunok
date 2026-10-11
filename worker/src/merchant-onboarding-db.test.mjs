import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';

const candidate = await readFile(new URL('../../supabase/candidates/merchant-onboarding.sql', import.meta.url), 'utf8');
const settingsCandidate = await readFile(new URL('../../supabase/candidates/business-settings.sql', import.meta.url), 'utf8');
const shortIdSql = await readFile(new URL('../../supabase/migrations/20260922120000_order_short_id_authority.sql', import.meta.url), 'utf8');
const snapshotSql = await readFile(new URL('../../supabase/migrations/20260922140000_invoice_payment_snapshots.sql', import.meta.url), 'utf8');
const owner = '00000000-0000-0000-0000-000000000001';
const other = '00000000-0000-0000-0000-000000000002';
const input = {
	business_type: 'fop', business_name: 'Synthetic Shop', display_name: 'Shop', tax_id: '1234567890',
	iban: 'UA663052990000026007123456789', bank_name: 'Synthetic Bank', phone: '+380671234567',
	contact_email: 'owner@example.com', website: 'https://example.com/', vat_status: 'no-vat'
};
const baseline = `
CREATE ROLE authenticated NOLOGIN NOSUPERUSER NOBYPASSRLS;
CREATE ROLE anon NOLOGIN NOSUPERUSER NOBYPASSRLS;
CREATE SCHEMA auth;
CREATE TABLE auth.users (id uuid PRIMARY KEY);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE SET search_path = ''
AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
INSERT INTO auth.users VALUES ('${owner}'), ('${other}');
CREATE TABLE public.merchants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id),
  business_type varchar(20) NOT NULL DEFAULT 'fop', business_name varchar(200) NOT NULL,
  display_name varchar(100) NOT NULL, tax_id varchar(20) NOT NULL, iban varchar(34) NOT NULL,
  bank_name varchar(100), onboarding_completed boolean NOT NULL DEFAULT false,
  CONSTRAINT uq_merchants_user_id UNIQUE (user_id),
  CONSTRAINT merchants_business_type_check CHECK (business_type IN ('fop','tov','ngo'))
);
CREATE TABLE public.business_entities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id),
  business_type varchar(20) NOT NULL DEFAULT 'fop', business_name varchar(200) NOT NULL,
  display_name varchar(100) NOT NULL, tax_id varchar(20) NOT NULL, iban varchar(34) NOT NULL,
  bank_name varchar(100) NOT NULL, is_active boolean NOT NULL DEFAULT true,
  CONSTRAINT business_entities_business_type_check CHECK (business_type IN ('fop','tov','self_employed','ngo'))
);
ALTER TABLE public.merchants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_entities ENABLE ROW LEVEL SECURITY;
CREATE POLICY entity_public ON public.business_entities FOR SELECT TO public USING (is_active);
CREATE POLICY merchant_owner ON public.merchants FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY entity_owner ON public.business_entities FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
GRANT USAGE ON SCHEMA auth, public TO authenticated, anon;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.merchants, public.business_entities TO authenticated;
GRANT SELECT ON public.business_entities TO anon;
`;

async function identity(db, user = owner) {
	await db.exec('RESET ROLE');
	await db.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [user ?? '']);
	await db.exec('SET ROLE authenticated');
}
async function complete(db, payload = input) {
	return (await db.query('SELECT public.complete_merchant_onboarding($1::jsonb) AS result', [JSON.stringify(payload)])).rows[0].result;
}
async function settings(db, merchantId) {
	return (await db.query('SELECT public.read_business_settings($1) AS result', [merchantId])).rows[0].result;
}
async function setup() {
	const db = new PGlite();
	await db.exec(baseline);
	await db.exec(settingsCandidate);
	await db.exec(candidate);
	await identity(db);
	return db;
}

test('onboarding DB candidate initializes every legal form and persists owner/contact readback', async () => {
	for (const business_type of ['fop', 'tov', 'self_employed', 'ngo']) {
		const db = await setup();
		try {
			const result = await complete(db, { ...input, business_type, tax_id: ['fop', 'self_employed'].includes(business_type) ? '1234567890' : '12345678', user_id: other });
			assert.equal(result.created, true);
			assert.equal(result.merchant.user_id, owner);
			assert.equal(result.entity.user_id, owner);
			assert.equal(result.entity.business_type, business_type);
			const saved = (await db.query('SELECT * FROM public.business_entity_contacts')).rows;
			assert.equal(saved.length, 1);
			assert.equal(saved[0].phone, input.phone);
			assert.equal(saved[0].contact_email, input.contact_email);
			assert.equal(saved[0].website, input.website);
			await identity(db, other);
			assert.equal((await db.query('SELECT * FROM public.business_entities')).rows.length, 1);
			assert.equal((await db.query('SELECT * FROM public.business_entity_contacts')).rows.length, 0);
			await assert.rejects(db.query(`INSERT INTO public.business_entity_contacts (entity_id, user_id) VALUES ('${result.entity.id}', '${other}')`), /row-level security/);
			await db.exec('RESET ROLE; SET ROLE anon');
			const publicEntity = (await db.query('SELECT * FROM public.business_entities')).rows[0];
			assert.equal(publicEntity.iban, input.iban);
			assert.equal('phone' in publicEntity, false);
			assert.equal('contact_email' in publicEntity, false);
			assert.equal('website' in publicEntity, false);
			await assert.rejects(db.query('SELECT * FROM public.business_entity_contacts'), /permission denied/);
		} finally { await db.close(); }
	}
});

test('onboarding initializes settings through owner RPC without direct table access', async () => {
	const db = await setup();
	try {
		const result = await complete(db);
		const saved = (await db.query('SELECT public.read_business_settings($1) AS result', [result.merchant.id])).rows[0].result;
		assert.equal(saved.revision, 1);
		assert.equal(saved.document.mode, 'direct');
		assert.equal(saved.document.sellers[result.entity.id].vatStatus, 'no-vat');
		assert.equal(saved.document.sellers[result.entity.id].nextNumber, 1);
		await assert.rejects(db.query('SELECT * FROM public.business_settings'), /permission denied/);
		await assert.rejects(db.query('SELECT * FROM public.business_settings_sellers'), /permission denied/);
		await identity(db, other);
		await assert.rejects(db.query('SELECT public.read_business_settings($1)', [result.merchant.id]), /unavailable/);
	} finally { await db.close(); }
});

test('business entity contact edits are atomic, owner-bound and preserve omitted fields', async () => {
	const db = await setup();
	try {
		const first = await complete(db);
		const save = async (entityId, payload) => db.query('SELECT public.save_business_entity($1::uuid, $2::jsonb)', [entityId, JSON.stringify(payload)]);
		const { contact_email, ...withoutEmail } = input;
		await save(first.entity.id, { ...withoutEmail, phone: null, website: null });
		assert.deepEqual((await db.query('SELECT phone, contact_email, website FROM public.business_entity_contacts')).rows[0], {
			phone: null, contact_email, website: null
		});
		await identity(db, other);
		await assert.rejects(save(first.entity.id, input), /unavailable/);
		await identity(db);
		await db.exec('RESET ROLE');
		await db.exec("ALTER TABLE public.business_entity_contacts ADD CONSTRAINT synthetic_contact_failure CHECK (phone <> '+380501234567')");
		await identity(db);
		await assert.rejects(save(null, { ...input, phone: '+380501234567' }), /synthetic_contact_failure/);
		assert.equal((await db.query('SELECT * FROM public.business_entities')).rows.length, 1);
		await assert.rejects(save(first.entity.id, { ...input, business_name: 'Changed', phone: '+380501234567' }), /synthetic_contact_failure/);
		assert.equal((await db.query('SELECT business_name FROM public.business_entities')).rows[0].business_name, input.business_name);
	} finally { await db.close(); }
});

test('onboarding DB retries and changed submissions never duplicate or overwrite existing data', async () => {
	const db = await setup();
	try {
		const first = await complete(db);
		const original = await settings(db, first.merchant.id);
		original.document.sellers[first.entity.id].prefix = 'CUSTOM';
		original.document.sellers[first.entity.id].nextNumber = 42;
		const saved = (await db.query('SELECT public.save_business_settings($1, $2, $3::jsonb) AS result',
			[first.merchant.id, original.revision, JSON.stringify(original.document)])).rows[0].result;
		const retry = await complete(db, { ...input, business_name: 'Changed', phone: '+380501234567', vat_status: 'vat' });
		assert.equal(retry.created, false);
		assert.equal(retry.merchant.id, first.merchant.id);
		assert.equal(retry.merchant.business_name, input.business_name);
		assert.equal(retry.entity, null);
		assert.equal((await db.query('SELECT * FROM public.business_entities')).rows.length, 1);
		assert.equal((await db.query('SELECT phone FROM public.business_entity_contacts')).rows[0].phone, input.phone);
		assert.deepEqual(await settings(db, first.merchant.id), saved);
	} finally { await db.close(); }
});

test('onboarding DB entity failure rolls back merchant creation', async () => {
	const db = await setup();
	try {
		await db.exec('RESET ROLE');
		await db.exec("ALTER TABLE public.business_entities ADD CONSTRAINT synthetic_failure CHECK (business_name <> 'Synthetic Shop')");
		await identity(db);
		await assert.rejects(complete(db), /synthetic_failure/);
		assert.equal((await db.query('SELECT * FROM public.merchants')).rows.length, 0);
	} finally { await db.close(); }
});

test('onboarding DB rejects missing identity, invalid input and anonymous function access', async () => {
	const db = await setup();
	try {
		await identity(db, null);
		await assert.rejects(complete(db), /Authentication required/);
		await identity(db);
		for (const invalid of [{}, { ...input, tax_id: 'bad' }, { ...input, iban: 'UA003052990000026007123456789' },
			{ ...input, vat_status: undefined }, { ...input, vat_status: 'unknown' }]) {
			await assert.rejects(complete(db, invalid), /Invalid/);
		}
		assert.equal((await db.query('SELECT * FROM public.merchants')).rows.length, 0);
		await db.exec('RESET ROLE; SET ROLE anon');
		await assert.rejects(complete(db), /permission denied/);
	} finally { await db.close(); }
});

test('missing settings RPC fails closed and rolls back merchant, entity and contacts', async () => {
	const db = await setup();
	try {
		await db.exec('RESET ROLE; DROP FUNCTION public.save_business_settings(uuid, integer, jsonb)');
		await identity(db);
		await assert.rejects(complete(db), /does not exist/);
		for (const table of ['merchants', 'business_entities', 'business_entity_contacts']) {
			assert.equal((await db.query(`SELECT * FROM public.${table}`)).rows.length, 0);
		}
	} finally { await db.close(); }
});

test('settings seller failure rolls back the entire onboarding aggregate', async () => {
	const db = await setup();
	try {
		await db.exec("RESET ROLE; ALTER TABLE public.business_settings_sellers ADD CONSTRAINT synthetic_settings_failure CHECK (config->>'prefix' <> 'RHK')");
		await identity(db);
		await assert.rejects(complete(db), /synthetic_settings_failure/);
		await db.exec('RESET ROLE');
		for (const table of ['merchants', 'business_entities', 'business_entity_contacts', 'business_settings', 'business_settings_sellers']) {
			assert.equal((await db.query(`SELECT * FROM public.${table}`)).rows.length, 0);
		}
	} finally { await db.close(); }
});

test('new onboarding creates the first authoritative invoice for either explicit VAT status', async () => {
	for (const vatStatus of ['vat', 'no-vat']) {
		const db = await setup();
		try {
			await db.exec(`RESET ROLE;
				CREATE TABLE public.terminals (id uuid PRIMARY KEY, entity_id uuid NOT NULL, user_id uuid NOT NULL, is_active boolean NOT NULL DEFAULT true);
				CREATE TABLE public.orders (
					id uuid PRIMARY KEY DEFAULT gen_random_uuid(), merchant_id uuid NOT NULL, entity_id uuid,
					terminal_id uuid, type text NOT NULL, order_number text NOT NULL, title text NOT NULL,
					description text, base_amount numeric NOT NULL, delivery_fee numeric NOT NULL,
					total_amount numeric NOT NULL, currency text NOT NULL, table_number integer, status text NOT NULL,
					expires_at timestamptz, scenario_config jsonb, short_id text, created_at timestamptz DEFAULT now(),
					updated_at timestamptz, paid_at timestamptz, paid_bank_code text, paid_amount numeric
				)`);
			await db.exec(shortIdSql);
			await db.exec(snapshotSql);
			const authorityHash = (await db.query(`SELECT md5(replace(replace(prosrc, E'\\r\\n', E'\\n'), E'\\t', '  ')) AS hash
				FROM pg_proc WHERE oid = 'public.create_authoritative_invoice(uuid,uuid,text,text,text,numeric,numeric,integer,uuid,jsonb,timestamptz)'::regprocedure`)).rows[0].hash;
			assert.equal(authorityHash, 'fc9a9a2a228173ee8ab2bc4644352e4c');
			await identity(db);
			const result = await complete(db, { ...input, vat_status: vatStatus });
			const invoice = (await db.query(`SELECT result.* FROM public.create_authoritative_invoice(
				$1, $2, 'fixed', 'First invoice', NULL, 100, 0, NULL, NULL, '{}'::jsonb, NULL
			) AS result`, [result.merchant.id, result.entity.id])).rows[0];
			assert.equal(invoice.order_number, 'RHK-000001');
			assert.equal(invoice.merchant_id, result.merchant.id);
			assert.equal(invoice.entity_id, result.entity.id);
			assert.equal(invoice.payment_acceptance_mode, 'direct');
			assert.equal(invoice.payment_recipient_iban, input.iban);
			assert.equal(invoice.payment_recipient_name, input.business_name);
			assert.equal(invoice.payment_recipient_tax_id, input.tax_id);
			assert.equal(invoice.currency, 'UAH');
			assert.equal(invoice.status, 'pending');
			assert.equal(Number(invoice.total_amount), 100);
			assert.match(invoice.short_id, /^[A-Za-z0-9]{6}$/);
			assert.ok(invoice.payment_purpose.includes(vatStatus === 'vat' ? 'у т.ч. ПДВ' : 'без ПДВ'));
			assert.equal((await settings(db, result.merchant.id)).document.sellers[result.entity.id].nextNumber, 2);
			await db.exec('RESET ROLE');
			assert.equal((await db.query('SELECT * FROM public.orders')).rows.length, 1);
		} finally { await db.close(); }
	}
});

test('explicit VAT onboarding migration matches candidate, preserves invoker and initializes readiness', async () => {
	const migration = await readFile(new URL('../../supabase/migrations/20261011150000_onboarding_explicit_vat_settings.sql', import.meta.url), 'utf8');
	const currentCandidate = await readFile(new URL('../../supabase/candidates/merchant-onboarding.sql', import.meta.url), 'utf8');
	const functionPattern = /CREATE OR REPLACE FUNCTION public\.complete_merchant_onboarding\(p_input jsonb\)[\s\S]*?AS \$\$([\s\S]*?)\$\$;/;
	const candidateFunction = currentCandidate.replace(/\r\n/g, '\n').match(functionPattern);
	const migrationFunction = migration.replace(/\r\n/g, '\n').match(functionPattern);
	assert.ok(candidateFunction);
	assert.ok(migrationFunction);
	assert.equal(migrationFunction[0], candidateFunction[0]);
	assert.match(migration, /^BEGIN;\s+SET LOCAL lock_timeout = '2s';\s+SET LOCAL statement_timeout = '30s';/);
	assert.match(migration, /COMMIT;\s*$/);
	assert.doesNotMatch(migration, /(?:CREATE|ALTER|DROP)\s+TABLE|create_authoritative_invoice/i);
	const db = await setup();
	try {
		await db.exec(`RESET ROLE;
			CREATE OR REPLACE FUNCTION public.complete_merchant_onboarding(p_input jsonb)
			RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
			AS $$ BEGIN RAISE EXCEPTION 'Migration was not installed'; END; $$`);
		await db.exec(migration);
		const installed = (await db.query(`SELECT prosrc, prosecdef, proconfig,
			has_function_privilege('authenticated', oid, 'EXECUTE') AS authenticated_execute,
			has_function_privilege('anon', oid, 'EXECUTE') AS anon_execute,
			EXISTS (SELECT 1 FROM pg_catalog.aclexplode(proacl) WHERE grantee = 0 AND privilege_type = 'EXECUTE') AS public_execute
			FROM pg_catalog.pg_proc WHERE oid = 'public.complete_merchant_onboarding(jsonb)'::regprocedure`)).rows[0];
		assert.equal(installed.prosrc.replace(/\r\n/g, '\n'), candidateFunction[1]);
		assert.equal(installed.prosecdef, false);
		assert.deepEqual(installed.proconfig, ['search_path=""']);
		assert.equal(installed.authenticated_execute, true);
		assert.equal(installed.anon_execute, false);
		assert.equal(installed.public_execute, false);
		for (const [user, vatStatus] of [[owner, 'vat'], [other, 'no-vat']]) {
			await identity(db, user);
			for (const invalidVat of [undefined, 'unknown']) {
				await assert.rejects(complete(db, { ...input, vat_status: invalidVat }), /Invalid onboarding input/);
			}
			const result = await complete(db, { ...input, vat_status: vatStatus });
			assert.equal(result.created, true);
			assert.equal(result.merchant.onboarding_completed, true);
			assert.equal(result.entity.is_active, true);
			assert.equal(result.entity.iban, input.iban);
			const saved = await settings(db, result.merchant.id);
			assert.equal(saved.revision, 1);
			assert.equal(saved.document.version, 2);
			assert.equal(saved.document.mode, 'direct');
			assert.deepEqual(Object.keys(saved.document.sellers), [result.entity.id]);
			assert.deepEqual(saved.document.sellers[result.entity.id], {
				vatStatus, prefix: 'RHK', nextNumber: 1, padding: 6,
				purposeTemplate: '\u041e\u043f\u043b\u0430\u0442\u0430 \u0437\u0430 \u0442\u043e\u0432\u0430\u0440\u0438/\u043f\u043e\u0441\u043b\u0443\u0433\u0438, \u0440\u0430\u0445\u0443\u043d\u043e\u043a {number} \u0432\u0456\u0434 {date}, {tax}.',
				providerSellerId: '', providerCode: '', contractReference: '',
				qrCategory: 'OTHR/GDDS', qrFunction: 'ICT', allowAmountEdit: false
			});
			assert.deepEqual(await complete(db, { ...input, vat_status: vatStatus === 'vat' ? 'no-vat' : 'vat' }), {
				merchant: result.merchant, entity: null, created: false
			});
			assert.deepEqual(await settings(db, result.merchant.id), saved);
		}
		await db.exec('RESET ROLE; SET ROLE anon');
		await assert.rejects(complete(db), /permission denied/);
		await db.exec('RESET ROLE');
		const dependencies = [
			['ALTER FUNCTION public.save_business_settings(uuid, integer, jsonb) RENAME TO unavailable_settings',
				'ALTER FUNCTION public.unavailable_settings(uuid, integer, jsonb) RENAME TO save_business_settings', /save_business_settings.*missing/],
			...['entity_id', 'user_id', 'phone', 'contact_email', 'website'].map(column => [
				`ALTER TABLE public.business_entity_contacts RENAME COLUMN ${column} TO unavailable_column`,
				`ALTER TABLE public.business_entity_contacts RENAME COLUMN unavailable_column TO ${column}`, /contacts columns.*missing or incompatible/
			]),
			['ALTER TABLE public.business_entity_contacts RENAME TO unavailable_contacts',
				'ALTER TABLE public.unavailable_contacts RENAME TO business_entity_contacts', /contacts columns.*missing or incompatible/],
			['ALTER TABLE public.business_entity_contacts ALTER COLUMN phone TYPE integer USING NULL::integer',
				'ALTER TABLE public.business_entity_contacts ALTER COLUMN phone TYPE text USING phone::text', /contacts columns.*missing or incompatible/]
		];
		for (const [remove, restore, expectedError] of dependencies) {
			await db.exec(remove);
			await assert.rejects(db.exec(migration), expectedError);
			await db.exec('ROLLBACK');
			assert.equal((await db.query(`SELECT prosrc FROM pg_catalog.pg_proc
				WHERE oid = 'public.complete_merchant_onboarding(jsonb)'::regprocedure`)).rows[0].prosrc, installed.prosrc);
			await db.exec(restore);
		}
		await db.exec(migration);
		assert.equal((await db.query('SELECT count(*)::integer AS total FROM public.merchants')).rows[0].total, 2);
	} finally { await db.close(); }
});