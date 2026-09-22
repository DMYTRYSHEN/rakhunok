import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test, { after, before } from 'node:test';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
const settingsSql = await readFile(
	new URL('../../../supabase/candidates/business-settings.sql', import.meta.url),
	'utf8'
);
const snapshotSql = await readFile(
	new URL('../../../supabase/migrations/20260922140000_invoice_payment_snapshots.sql', import.meta.url),
	'utf8'
);
const shortIdSql = await readFile(
	new URL('../../../supabase/migrations/20260922120000_order_short_id_authority.sql', import.meta.url),
	'utf8'
);
const ids = {
	user: '10000000-0000-0000-0000-000000000001',
	other: '10000000-0000-0000-0000-000000000002',
	merchant: '20000000-0000-0000-0000-000000000001',
	entity: '30000000-0000-0000-0000-000000000001'
};
const seller = {
	vatStatus: 'vat',
	prefix: 'INV',
	nextNumber: 7,
	padding: 4,
	purposeTemplate: 'Рахунок {number} від {date}, {tax}',
	providerSellerId: 'seller-42',
	providerCode: 'provider-1',
	contractReference: 'contract-9',
	qrCategory: 'OTHR/GDDS',
	qrFunction: 'UCT',
	allowAmountEdit: false
};

async function identity(user = ids.user) {
	await db.exec('reset role');
	await db.query("select set_config('request.jwt.claim.sub', $1, false)", [user]);
	await db.exec('set role authenticated');
}

async function save(document, revision = 0) {
	await identity();
	return db.query('select public.save_business_settings($1, $2, $3::jsonb)', [
		ids.merchant,
		revision,
		JSON.stringify(document)
	]);
}

async function createInvoice() {
	return (await db.query(
		`select (public.create_authoritative_invoice(
			$1, $2, 'fixed', 'Client title', 'Delivery note', 100, 20, null, null, '{"allow_tips":false}'
		)).*`,
		[ids.merchant, ids.entity]
	)).rows[0];
}

async function createScenarioInvoice(type, { baseAmount, deliveryFee = 0, tableNumber = null, terminalId = null, expiresAt = null }) {
	return (await db.query(
		`select (public.create_authoritative_invoice(
			$1, $2, $3, 'Scenario invoice', null, $4, $5, $6, $7, null, $8
		)).*`,
		[ids.merchant, ids.entity, type, baseAmount, deliveryFee, tableNumber, terminalId, expiresAt]
	)).rows[0];
}

before(async () => {
	await db.exec(`
		create role anon;
		create role authenticated;
		create schema auth;
		create schema checkout_private;
		create function auth.uid() returns uuid language sql stable set search_path = '' as
			$$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
		create table public.merchants (
			id uuid primary key, user_id uuid not null, business_name text,
			display_name text, tax_id text, iban text
		);
		create table public.business_entities (
			id uuid primary key, user_id uuid not null, business_name text not null,
			display_name text, tax_id text not null, iban text not null, is_active boolean not null default true
		);
		create table public.terminals (
			id uuid primary key, entity_id uuid not null, user_id uuid not null,
			is_active boolean not null default true
		);
		create table public.orders (
			id uuid primary key default gen_random_uuid(), merchant_id uuid not null,
			entity_id uuid, terminal_id uuid, type text not null, order_number text not null,
			title text not null, description text, base_amount numeric not null,
			delivery_fee numeric not null, total_amount numeric not null, currency text not null,
			table_number integer, status text not null, expires_at timestamptz,
			scenario_config jsonb, short_id text
		);
		insert into public.merchants values (
			'${ids.merchant}', '${ids.user}', 'Merchant', 'Merchant', '12345678',
			'UA123456789012345678901234567'
		);
		insert into public.business_entities values (
			'${ids.entity}', '${ids.user}', 'ТОВ Продавець', 'Продавець', '12345678',
			'UA123456789012345678901234567', true
		);
		grant usage on schema public, auth to authenticated, anon;
		grant execute on function auth.uid() to authenticated, anon;
		grant select on public.merchants, public.business_entities to authenticated;
	`);
	await db.exec(settingsSql);
	await db.exec(shortIdSql);
	await db.exec(snapshotSql);
	await save({
		version: 2,
		mode: 'direct',
		financeName: '',
		financeIban: '',
		financeTaxId: '',
		financePurposeTemplate: '{business_purpose}',
		sellers: { [ids.entity]: seller }
	});
});

after(() => db.close());

test('direct mode snapshots seller recipient and atomically reserves numbers', async () => {
	await identity();
	const first = await createInvoice();
	const second = await createInvoice();
	assert.equal(first.order_number, 'INV-0007');
	assert.equal(second.order_number, 'INV-0008');
	assert.equal(first.payment_acceptance_mode, 'direct');
	assert.equal(first.payment_recipient_name, 'ТОВ Продавець');
	assert.equal(first.payment_recipient_iban, 'UA123456789012345678901234567');
	assert.equal(first.payment_recipient_tax_id, '12345678');
	assert.match(first.payment_purpose, /^Рахунок INV-0007 від \d{2}\.\d{2}\.\d{4}, у т\.ч\. ПДВ$/);
	assert.equal(first.title, 'Client title');
	assert.equal(first.description, 'Delivery note');
	assert.deepEqual(first.scenario_config, { allow_tips: false });
});

test('concurrent creation reserves distinct invoice numbers', async () => {
	await identity();
	const orders = await Promise.all(Array.from({ length: 8 }, () => createInvoice()));
	const numbers = orders.map((order) => Number(order.order_number.replace('INV-', ''))).sort((a, b) => a - b);
	assert.equal(new Set(numbers).size, numbers.length);
	assert.deepEqual(numbers, Array.from({ length: 8 }, (_, index) => numbers[0] + index));
});

test('all approved invoice scenarios receive authoritative payment snapshots', async () => {
	await identity();
	await db.query(
		`insert into public.terminals (id, entity_id, user_id, is_active)
		 values ($1, $2, $3, true) on conflict (id) do nothing`,
		['40000000-0000-0000-0000-000000000001', ids.entity, ids.user]
	);
	const expiresAt = '2026-09-22T12:30:00.000Z';
	const rows = [
		await createScenarioInvoice('fixed', { baseAmount: 10, expiresAt }),
		await createScenarioInvoice('open_amount', { baseAmount: 0 }),
		await createScenarioInvoice('table', {
			baseAmount: 12,
			tableNumber: 4,
			terminalId: '40000000-0000-0000-0000-000000000001',
			expiresAt
		}),
		await createScenarioInvoice('delivery', { baseAmount: 10, deliveryFee: 3 })
	];

	for (const row of rows) {
		assert.equal(row.payment_acceptance_mode, 'direct');
		assert.equal(row.payment_recipient_name, 'ТОВ Продавець');
		assert.match(row.payment_purpose, /^Рахунок INV-/);
	}
	assert.equal(Number(rows[1].total_amount), 0);
	assert.equal(Number(rows[3].total_amount), 13);
	assert.equal(rows[0].expires_at, null);
	assert.equal(new Date(rows[2].expires_at).toISOString(), expiresAt);
});

test('finance-company mode snapshots the actual recipient and real payment ID', async () => {
	await save({
		version: 2,
		mode: 'finance-company',
		financeName: 'ТОВ Фінансова компанія',
		financeIban: 'UA987654321098765432109876543',
		financeTaxId: '87654321',
		financePurposeTemplate: '{business_purpose} | Юридична назва продавця: {seller_name}; власний IBAN продавця: {seller_iban}; Код провайдера: {provider_code}; ID продавця: {provider_seller_id}; код продавця: {seller_tax_id}; договір: {contract_reference}; ID платежу: {payment_id}',
		sellers: { [ids.entity]: { ...seller, nextNumber: 9 } }
	}, 1);
	await identity();
	const order = await createInvoice();
	assert.equal(order.payment_recipient_name, 'ТОВ Фінансова компанія');
	assert.equal(order.payment_recipient_iban, 'UA987654321098765432109876543');
	assert.equal(order.payment_recipient_tax_id, '87654321');
	assert.match(order.payment_id, /^[0-9a-f-]{36}$/);
	assert.equal(order.payment_purpose,
		`ID: ${order.short_id}. Рахунок INV-0009 від ${new Intl.DateTimeFormat('uk-UA').format(new Date())}, у т.ч. ПДВ Продавець: ТОВ Продавець, ЄДРПОУ 12345678, IBAN UA123456789012345678901234567; дог. contract-9; seller-42; provider-1.`);
	assert.doesNotMatch(order.payment_purpose, new RegExp(order.payment_id));
});

test('payment snapshots are immutable while legacy rows remain valid', async () => {
	await identity();
	const order = await createInvoice();
	await assert.rejects(
		db.query("update public.orders set payment_purpose = 'forged' where id = $1", [order.id]),
		/order_payment_snapshot_immutable/
	);
	await db.exec('reset role');
	await assert.doesNotReject(db.query(`
		insert into public.orders (
			merchant_id, type, order_number, title, base_amount, delivery_fee,
			total_amount, currency, status
		) values ($1, 'fixed', 'LEGACY-1', 'Legacy', 10, 0, 10, 'UAH', 'pending')
	`, [ids.merchant]));
});

test('unauthorized owners cannot create an invoice', async () => {
	await identity(ids.other);
	await assert.rejects(createInvoice(), /Invoice creation unavailable/);
});

test('purpose that cannot be represented unchanged in NBU field 12 is rejected', async () => {
	await save({
		version: 2,
		mode: 'direct',
		financeName: '',
		financeIban: '',
		financeTaxId: '',
		financePurposeTemplate: '{business_purpose}',
		sellers: { [ids.entity]: { ...seller, purposeTemplate: 'x'.repeat(421) } }
	}, 2);
	await identity();
	await assert.rejects(createInvoice(), /Invoice payment settings are incomplete/);
});

test('finance-company purpose reserves exactly 12 characters for the field 11 short ID', async () => {
	const document = {
		version: 2,
		mode: 'finance-company',
		financeName: 'ТОВ Фінансова компанія',
		financeIban: 'UA987654321098765432109876543',
		financeTaxId: '87654321',
		financePurposeTemplate: 'x'.repeat(408),
		sellers: { [ids.entity]: seller }
	};
	await save(document, 3);
	await identity();
	const order = await createInvoice();
	assert.equal(order.payment_purpose, `ID: ${order.short_id}. ${'x'.repeat(408)}`);
	assert.equal(order.payment_purpose.length, 420);

	await save({ ...document, financePurposeTemplate: 'x'.repeat(409) }, 4);
	await identity();
	await assert.rejects(createInvoice(), /Invoice payment settings are incomplete/);
});