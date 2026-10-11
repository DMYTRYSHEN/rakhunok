import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test, { after, before } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { routeWebRequest } from '../index.ts';

const db = new PGlite();
const settingsSql = await readFile(
	new URL('../../../supabase/candidates/business-settings.sql', import.meta.url),
	'utf8'
);
const snapshotSql = await readFile(
	new URL(
		'../../../supabase/migrations/20260922140000_invoice_payment_snapshots.sql',
		import.meta.url
	),
	'utf8'
);
const shortIdSql = await readFile(
	new URL(
		'../../../supabase/migrations/20260922120000_order_short_id_authority.sql',
		import.meta.url
	),
	'utf8'
);
const purposeTokensSql = await readFile(
	new URL(
		'../../../supabase/migrations/20260922135000_business_settings_purpose_tokens.sql',
		import.meta.url
	),
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
	return (
		await db.query(
			`select result.* from public.create_authoritative_invoice(
			$1, $2, 'fixed', 'Client title', 'Delivery note', 100, 20, null, null, '{"allow_tips":false}'
		) as result`,
			[ids.merchant, ids.entity]
		)
	).rows[0];
}

async function createScenarioInvoice(
	type,
	{ baseAmount, deliveryFee = 0, tableNumber = null, terminalId = null, expiresAt = null }
) {
	return (
		await db.query(
			`select result.* from public.create_authoritative_invoice(
			$1, $2, $3, 'Scenario invoice', null, $4, $5, $6, $7, null, $8
		) as result`,
			[ids.merchant, ids.entity, type, baseAmount, deliveryFee, tableNumber, terminalId, expiresAt]
		)
	).rows[0];
}

before(async () => {
	await db.exec(`
		create role anon;
		create role authenticated;
		create role service_role bypassrls;
		create schema auth;
		create table auth.users (id uuid primary key);
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
			scenario_config jsonb, short_id text, created_at timestamptz default now(),
			updated_at timestamptz, paid_at timestamptz, paid_bank_code text, paid_amount numeric
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
	await db.exec("alter table public.business_entities add column business_type text not null default 'tov'");
	await db.exec(shortIdSql);
	await db.exec(purposeTokensSql);
	await db.exec(snapshotSql);
	await db.exec(await readFile(new URL('../../../supabase/migrations/20260903203011_merchant_api_keys.sql', import.meta.url), 'utf8'));
	await db.exec(await readFile(new URL('../../../supabase/migrations/20260923225403_merchant_api_key_orders.sql', import.meta.url), 'utf8'));
	await db.exec(await readFile(new URL('../../../supabase/migrations/20260923235713_merchant_api_operations.sql', import.meta.url), 'utf8'));
	await db.exec(`
		grant usage on schema public, auth to service_role;
		grant select on public.merchants, public.business_entities, public.terminals to service_role;
		grant select, update on public.business_settings to service_role;
		grant select, update on public.business_settings_sellers to service_role;
		grant select, insert, update on public.orders to service_role;
		insert into auth.users values ('${ids.user}');
		insert into public.merchant_api_keys (merchant_id, name, key_prefix, secret_hash, created_by)
		values ('${ids.merchant}', 'Test', 'rhk_live_aaaaaaaa', repeat('a', 64), '${ids.user}');
	`);
	await save({
		version: 2,
		mode: 'direct',
		financeName: '',
		financeIban: '',
		financeTaxId: '',
		financePurposeTemplate: '{business_purpose}',
		sellers: { [ids.entity]: seller }
	});
	await db.exec(`reset role;
		alter table auth.users add column email text, add column deleted_at timestamptz, add column banned_until timestamptz;
		create table auth.sessions(id uuid primary key,user_id uuid,aal text,not_after timestamptz);
		create table auth.mfa_amr_claims(session_id uuid,authentication_method text,updated_at timestamptz);
		create function auth.jwt() returns jsonb language sql as $$ select current_setting('request.jwt.claims',true)::jsonb $$;
		alter table public.merchants add column is_active boolean default true, add column onboarding_completed boolean default true;
		alter table public.business_entities add column bank_name text default 'Customer Bank';
		alter table public.terminals add column name text, add column code text, add column type text;
		create table public.business_entity_contacts(entity_id uuid primary key,user_id uuid,phone text,contact_email text,website text);
		create table public.merchant_settings(merchant_id uuid primary key,table_order_ttl_seconds integer);
	`);
	for (const migration of ['20261005172522_support_customer_context.sql', '20261005180732_support_cabinet_structure_snapshot.sql',
		'20261005183402_support_snapshot_contact_boundary.sql', '20261005185746_support_structure_operations.sql',
		'20261005194910_support_fixed_invoice.sql', '20261005204852_support_preserve_invoice_references.sql',
		'20261005211649_support_invoice_scenarios.sql']) {
		const migrationSql = await readFile(new URL(`../../../supabase/migrations/${migration}`, import.meta.url), 'utf8');
		if (migration === '20261005194910_support_fixed_invoice.sql') {
			const authority = (await db.query(`select pg_get_functiondef(oid) as definition, prosrc as body
				from pg_proc where oid = 'public.create_authoritative_invoice(uuid,uuid,text,text,text,numeric,numeric,integer,uuid,jsonb,timestamptz)'::regprocedure`)).rows[0];
			const remoteBody = authority.body.replace(/\r\n/g, '\n').replace(/\t/g, '  ');
			assert.equal((await db.query('select md5($1) as hash', [remoteBody])).rows[0].hash, 'fc9a9a2a228173ee8ab2bc4644352e4c');
			await db.exec(authority.definition.replace(authority.body, () => remoteBody.replace('actor uuid := auth.uid();', 'actor uuid := null;')));
			await assert.rejects(db.exec(migrationSql), /Unexpected invoice authority definition/);
			await db.exec('rollback');
			await db.exec(authority.definition.replace(authority.body, () => remoteBody));
		}
		await db.exec(migrationSql);
	}
});

after(() => db.close());

test('support creates customer invoices with unchanged actor, audit, conflict checks and idempotency', async () => {
	const sessionId = '40000000-0000-4000-8000-000000000001';
	await db.exec('reset role');
	await db.query('insert into auth.users(id,email) values ($1,$2)', [ids.other, 'operator@example.test']);
	await db.query('insert into auth.sessions values ($1,$2,\'aal2\',null)', [sessionId, ids.other]);
	await db.query("insert into auth.mfa_amr_claims values ($1,'totp',clock_timestamp())", [sessionId]);
	await db.query('insert into support_private.operators(user_id,enabled,can_write) values ($1,true,true)', [ids.other]);
	await db.query("select set_config('request.jwt.claims',$1,false)", [JSON.stringify({ sub: ids.other, session_id: sessionId, role: 'authenticated', aal: 'aal2', exp: Math.floor(Date.now()/1000)+3600 })]);
	await identity(ids.other);
	const call = async (action, input = {}) => (await db.query('select public.support_dispatch($1,$2::jsonb) as result', [action, JSON.stringify(input)])).rows[0].result;
	const context = await call('open', { targetId: ids.user, merchantId: ids.merchant, workspace: 'live', reason: 'Help customer create invoice' });
	assert.equal((await call('snapshot', { sessionId: context.id })).data.invoiceCreation.fixed, true);
	await call('elevate', { sessionId: context.id });
	const fields = { entityId: ids.entity, title: 'Support invoice', description: '', amount: 120, scenarioConfig: {} };
	const prepare = () => call('prepare', { sessionId: context.id, action: 'invoice.fixed.create', fields });
	const commit = operation => call('commit', { sessionId: context.id, operationId: operation.operationId, digest: operation.digest, acknowledgement: 'CHANGE_LIVE_BUSINESS' });
	await assert.rejects(call('prepare', { sessionId: context.id, action: 'invoice.fixed.create', fields: { ...fields, entityId: ids.other } }), /seller/);
	await assert.rejects(db.query('select checkout_private.create_invoice_for_owner($1,$2,$3,\'fixed\',\'test\',null,100)', [ids.user,ids.merchant,ids.entity]), /permission denied/);
	const prepared = await prepare();
	const result = await commit(prepared);
	assert.equal(result.invoice.recipientName, 'ТОВ Продавець');
	assert.equal(result.invoice.amount, 120);
	assert.deepEqual(await commit(prepared), result);
	assert.equal((await db.query('select auth.uid() as actor')).rows[0].actor, ids.other);
	await db.exec('reset role');
	assert.equal((await db.query('select count(*)::int as count from public.orders where id=$1 and merchant_id=$2', [result.invoice.id,ids.merchant])).rows[0].count, 1);
	assert.equal((await db.query("select actor_id from support_private.audit where operation_id=$1 and action='commit'", [prepared.operationId])).rows[0].actor_id, ids.other);
	await identity(ids.other);
	for (const kind of ['entity', 'terminal']) {
		const itemId = '50000000-0000-4000-8000-000000000001';
		await db.exec('reset role; begin');
		try {
			if (kind === 'entity') {
				await db.query(`insert into public.business_entities(id,user_id,business_name,tax_id,iban)
					values ($1,$2,'Historical seller','12345678','UA663052990000026007123456789')`, [itemId, ids.user]);
			} else {
				await db.query(`insert into public.terminals(id,entity_id,user_id,name,code,type)
					values ($1,$2,$3,'Historical terminal','HISTORY','kasa')`, [itemId, ids.entity, ids.user]);
			}
			await identity(ids.other);
			const deletion = await call('prepare', { sessionId: context.id, action: `structure.${kind}.delete`, fields: { id: itemId } });
			await db.exec('reset role');
			await db.query(`update public.orders set ${kind}_id=$1 where id=$2`, [itemId, result.invoice.id]);
			await identity(ids.other);
			await db.exec('savepoint protected_delete');
			await assert.rejects(commit(deletion), /Support invoice reference protected/);
			await db.exec('rollback to savepoint protected_delete; reset role');
			assert.equal((await db.query(`select ${kind}_id as reference from public.orders where id=$1`, [result.invoice.id])).rows[0].reference, itemId);
			assert.equal((await db.query('select state from support_private.operations where id=$1', [deletion.operationId])).rows[0].state, 'prepared');
			assert.equal((await db.query("select count(*)::int as count from support_private.audit where operation_id=$1 and action='commit'", [deletion.operationId])).rows[0].count, 0);
		} finally {
			await db.exec('rollback');
			await identity(ids.other);
		}
	}
	const stale = await prepare();
	for (const type of ['fixed', 'open_amount', 'table', 'delivery']) {
		const terminalId = '60000000-0000-4000-8000-000000000001';
		if (type === 'table') {
			await db.exec('reset role');
			await db.query(`insert into public.terminals(id,entity_id,user_id,name,code,type)
				values ($1,$2,$3,'Table 7','7','table')`, [terminalId, ids.entity, ids.user]);
			await identity(ids.other);
		}
		const scenarioFields = { ...fields, type, amount: type === 'open_amount' ? 0 : 120,
			deliveryFee: type === 'delivery' ? 20 : 0, terminalId: type === 'table' ? terminalId : null,
			tableNumber: type === 'table' ? 7 : null };
		assert.equal((await call('snapshot', { sessionId: context.id })).data.invoiceCreation[type], true);
		const operation = await call('prepare', { sessionId: context.id, action: 'invoice.create', fields: scenarioFields });
		const created = await commit(operation);
		assert.equal(created.invoice.amount, scenarioFields.amount + scenarioFields.deliveryFee);
		assert.deepEqual(await commit(operation), created);
		await db.exec('reset role');
		const saved = (await db.query('select * from public.orders where id=$1', [created.invoice.id])).rows[0];
		assert.equal(saved.type, type);
		assert.equal(saved.terminal_id, scenarioFields.terminalId);
		assert.equal(saved.table_number, scenarioFields.tableNumber);
		assert.equal(saved.description, null);
		assert.equal((await db.query("select actor_id from support_private.audit where operation_id=$1 and action='commit'", [operation.operationId])).rows[0].actor_id, ids.other);
		await identity(ids.other);
		await assert.rejects(call('prepare', { sessionId: context.id, action: 'invoice.create', fields: { ...scenarioFields, entityId: ids.other } }), /seller/);
	}
	await db.exec("reset role; update public.business_entities set bank_name='Changed bank'; set role authenticated");
	await assert.rejects(commit(stale), /conflict/);
	const revoked = await prepare();
	await db.exec('reset role; update support_private.operators set can_write=false; set role authenticated');
	await assert.rejects(commit(revoked), /forbidden/);
	await call('end', { sessionId: context.id });
	await db.exec('reset role; update support_private.operators set can_write=true; set role authenticated');
	const sandbox = await call('open', { targetId: ids.user, merchantId: ids.merchant, workspace: 'sandbox', reason: 'Check sandbox isolation' });
	await call('elevate', { sessionId: sandbox.id });
	await assert.rejects(call('prepare', { sessionId: sandbox.id, action: 'invoice.fixed.create', fields }), /forbidden/);
	await call('end', { sessionId: sandbox.id });
	await db.exec('reset role; delete from public.orders');
	await identity();
	await db.query("update public.business_settings_sellers set config=jsonb_set(config,'{nextNumber}','7'::jsonb)").catch(async () => {
		await db.exec("reset role; update public.business_settings_sellers set config=jsonb_set(config,'{nextNumber}','7'::jsonb)");
	});
});

test('merchant key RPC denies unknown keys and isolates list access', async () => {
	await db.exec('reset role; set role service_role');
	const invoke = async (hash) => (await db.query(
		"select public.merchant_api_key_orders($1, 'GET') as result", [hash]
	)).rows[0].result;
	assert.equal((await invoke('b'.repeat(64))).status, 401);
	assert.equal((await invoke('a'.repeat(64))).status, 200);
	assert.ok((await db.query('select last_used_at from public.merchant_api_keys')).rows[0].last_used_at);
	await db.exec('reset role');
});

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
	const numbers = orders
		.map((order) => Number(order.order_number.replace('INV-', '')))
		.sort((a, b) => a - b);
	assert.equal(new Set(numbers).size, numbers.length);
	assert.deepEqual(
		numbers,
		Array.from({ length: 8 }, (_, index) => numbers[0] + index)
	);
});

test('selected seller snapshots remain correct across four legal forms and four scenarios', async () => {
	await identity();
	const original = await createInvoice();
	await db.exec('reset role; begin');
	try {
		for (const businessType of ['fop', 'tov', 'self_employed', 'ngo']) {
			await db.exec('reset role');
			const taxId = ['fop', 'self_employed'].includes(businessType) ? '9876543210' : '87654321';
			const name = `Selected ${businessType}`;
			const iban = 'UA663052990000026007123456789';
			await db.query('update public.business_entities set business_type=$1, business_name=$2, tax_id=$3, iban=$4 where id=$5',
				[businessType, name, taxId, iban, ids.entity]);
			const terminalId = '40000000-0000-0000-0000-000000000002';
			await db.query('insert into public.terminals values ($1, $2, $3, true) on conflict (id) do nothing',
				[terminalId, ids.entity, ids.user]);
			await identity();
			for (const type of ['fixed', 'open_amount', 'table', 'delivery']) {
				const expiresAt = '2026-10-05T12:30:00.000Z';
				const row = await createScenarioInvoice(type, {
					baseAmount: type === 'open_amount' ? 0 : 10,
					deliveryFee: type === 'delivery' ? 3 : 0,
					tableNumber: type === 'table' ? 4 : null,
					terminalId: type === 'table' ? terminalId : null,
					expiresAt: type === 'table' ? expiresAt : null
				});
				assert.equal(row.entity_id, ids.entity);
				assert.equal(row.type, type);
				assert.equal(row.payment_recipient_name, name);
				assert.equal(row.payment_recipient_tax_id, taxId);
				assert.equal(row.payment_recipient_iban, iban);
				assert.equal(Number(row.total_amount), type === 'open_amount' ? 0 : type === 'delivery' ? 13 : 10);
				assert.equal(row.terminal_id, type === 'table' ? terminalId : null);
				assert.equal(row.expires_at ? new Date(row.expires_at).toISOString() : null, type === 'table' ? expiresAt : null);
			}
			await db.exec('reset role');
			const stored = (await db.query('select * from public.orders where id=$1', [original.id])).rows[0];
			assert.equal(stored.payment_recipient_name, original.payment_recipient_name);
			assert.equal(stored.payment_recipient_iban, original.payment_recipient_iban);
			assert.equal(stored.payment_recipient_tax_id, original.payment_recipient_tax_id);
		}
	} finally {
		await db.exec('rollback; reset role');
	}
});

test('all approved invoice scenarios receive authoritative payment snapshots', async () => {
	await db.exec('reset role');
	await db.query(
		`insert into public.terminals (id, entity_id, user_id, is_active)
		 values ($1, $2, $3, true) on conflict (id) do nothing`,
		['40000000-0000-0000-0000-000000000001', ids.entity, ids.user]
	);
	await identity();
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
	await save(
		{
			version: 2,
			mode: 'finance-company',
			financeName: 'ТОВ Фінансова компанія',
			financeIban: 'UA987654321098765432109876543',
			financeTaxId: '87654321',
			financePurposeTemplate:
				'{business_purpose} | Юридична назва продавця: {seller_name}; власний IBAN продавця: {seller_iban}; Код провайдера: {provider_code}; ID продавця: {provider_seller_id}; код продавця: {seller_tax_id}; договір: {contract_reference}; ID платежу: {payment_id}',
			sellers: { [ids.entity]: { ...seller, nextNumber: 9 } }
		},
		1
	);
	await identity();
	const order = await createInvoice();
	assert.equal(order.payment_recipient_name, 'ТОВ Фінансова компанія');
	assert.equal(order.payment_recipient_iban, 'UA987654321098765432109876543');
	assert.equal(order.payment_recipient_tax_id, '87654321');
	assert.match(order.payment_id, /^[0-9a-f-]{36}$/);
	assert.equal(
		order.payment_purpose,
		`ID: ${order.short_id}. Рахунок INV-0009 від ${new Intl.DateTimeFormat('uk-UA').format(new Date())}, у т.ч. ПДВ Продавець: ТОВ Продавець, ЄДРПОУ 12345678, IBAN UA123456789012345678901234567; дог. contract-9; seller-42; provider-1.`
	);
	assert.doesNotMatch(order.payment_purpose, new RegExp(order.payment_id));
});

test('payment snapshots are immutable while legacy rows remain valid', async () => {
	await identity();
	const order = await createInvoice();
	await db.exec('reset role');
	await assert.rejects(
		db.query("update public.orders set payment_purpose = 'forged' where id = $1", [order.id]),
		/order_payment_snapshot_immutable/
	);
	await assert.doesNotReject(
		db.query(
			`
		insert into public.orders (
			merchant_id, type, order_number, title, base_amount, delivery_fee,
			total_amount, currency, status
		) values ($1, 'fixed', 'LEGACY-1', 'Legacy', 10, 0, 10, 'UAH', 'pending')
	`,
			[ids.merchant]
		)
	);
});

test('unauthorized owners cannot create an invoice', async () => {
	await identity(ids.other);
	await assert.rejects(createInvoice(), /Invoice creation unavailable/);
});

test('purpose that cannot be represented unchanged in NBU field 12 is rejected', async () => {
	await assert.rejects(
		save(
			{
				version: 2,
				mode: 'direct',
				financeName: '',
				financeIban: '',
				financeTaxId: '',
				financePurposeTemplate: '{business_purpose}',
				sellers: { [ids.entity]: { ...seller, purposeTemplate: 'x'.repeat(421) } }
			},
			2
		),
		/Invalid business settings document or revision/
	);
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
	await save(document, 2);
	await identity();
	const order = await createInvoice();
	assert.equal(order.payment_purpose, `ID: ${order.short_id}. ${'x'.repeat(408)}`);
	assert.equal(order.payment_purpose.length, 420);

	await save({ ...document, financePurposeTemplate: 'x'.repeat(409) }, 3);
	await identity();
	await assert.rejects(createInvoice(), /Invoice payment settings are incomplete/);
});

test('authoritative purpose renders every supported seller template token', async () => {
	await db.exec('reset role');
	const revision = Number(
		(
			await db.query('select revision from public.business_settings where merchant_id = $1', [
				ids.merchant
			])
		).rows[0].revision
	);
	await save(
		{
			version: 2,
			mode: 'direct',
			financeName: '',
			financeIban: '',
			financeTaxId: '',
			financePurposeTemplate: '{business_purpose}',
			sellers: {
				[ids.entity]: {
					...seller,
					nextNumber: 42,
					purposeTemplate: '{scenario}; {amount}; {customer}; {contract}; {number}; {date}; {tax}'
				}
			}
		},
		revision
	);
	await identity();
	const order = await createScenarioInvoice('delivery', { baseAmount: 100, deliveryFee: 20 });
	assert.match(
		order.payment_purpose,
		new RegExp(
			`^товари та доставку; 120\\.00; ; contract-9; INV-\\d+; ${new Intl.DateTimeFormat('uk-UA').format(new Date()).replaceAll('.', '\\.')};;? у т\\.ч\\. ПДВ$`
		)
	);
	assert.doesNotMatch(order.payment_purpose, /\{[a-z_]+\}/);
});

test('merchant API keys: Worker to SQL, scopes, isolation, expiry, revocation and grants', async () => {
	await db.exec('reset role');
	const tokens = { full: '1', read: '2', write: '3', expired: '4', revoked: '5', stats: '6' };
	for (const [name, digit] of Object.entries(tokens)) {
		const token = `rhk_live_${digit.repeat(64)}`;
		const hash = Buffer.from(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))).toString('hex');
		await db.query(`insert into public.merchant_api_keys
			(merchant_id, name, key_prefix, secret_hash, created_by, scopes, created_at, expires_at, revoked_at)
			values ($1, $2, $3, $4, $5, $6, now() - interval '2 days',
			case when $2 = 'expired' then now() - interval '1 day' else null end,
			case when $2 = 'revoked' then now() else null end)`,
		[ids.merchant, name, token.slice(0, 17), hash, ids.user,
			name === 'read' ? ['orders:read'] : name === 'write' ? ['orders:write'] :
				name === 'stats' ? ['stats:read'] : ['orders:read', 'orders:write']]);
	}
	const foreignMerchant = '20000000-0000-0000-0000-000000000002';
	await db.query('insert into public.merchants (id, user_id) values ($1, $2)', [foreignMerchant, ids.other]);
	const foreignOrder = (await db.query(`insert into public.orders
		(merchant_id, type, order_number, title, base_amount, delivery_fee, total_amount, currency, status)
		values ($1, 'fixed', 'FOREIGN', 'Foreign', 10, 0, 10, 'UAH', 'pending') returning id`, [foreignMerchant])).rows[0].id;
	const originalFetch = globalThis.fetch;
	const env = { SUPABASE_URL: 'https://database.example.invalid', SUPABASE_SERVICE_ROLE_KEY: 'test-server-only',
		ASSETS: { fetch() { throw new Error('Unexpected assets'); } } };
	globalThis.fetch = async (url, init) => {
		assert.equal(url, `${env.SUPABASE_URL}/rest/v1/rpc/merchant_api_operations`);
		assert.equal(init.headers.Authorization, 'Bearer test-server-only');
		assert.equal(init.body.includes('rhk_live_'), false);
		const args = JSON.parse(init.body);
		await db.exec('reset role; set role service_role');
		await db.query("select set_config('request.jwt.claim.sub', $1, false)", [ids.other]);
		await db.query("select set_config('request.jwt.claims', $1, false)", [JSON.stringify({ sub: ids.other })]);
		const result = (await db.query('select public.merchant_api_operations($1,$2,$3,$4,$5,$6,$7) as result',
			[args.p_secret_hash, args.p_method, args.p_resource, args.p_resource_id, args.p_query, args.p_body, args.p_idempotency_key])).rows[0].result;
		assert.equal((await db.query('select auth.uid() as id')).rows[0].id, ids.other);
		assert.deepEqual((await db.query("select current_setting('request.jwt.claims')::jsonb as claims")).rows[0].claims, { sub: ids.other });
		return Response.json(result);
	};
	const invoke = async (name, method = 'GET', path = '/orders', body) => {
		const result = await routeWebRequest(new Request(`https://example.com/api/v1${path}`, {
			method, headers: { Authorization: `Bearer rhk_live_${tokens[name].repeat(64)}`, 'Content-Type': 'application/json' },
			...(body === undefined ? {} : { body: JSON.stringify(body) })
		}), env);
		return { status: result.status, body: await result.json() };
	};
	try {
		for (const name of ['expired', 'revoked']) assert.equal((await invoke(name)).status, 401);
		assert.equal((await invoke('write')).status, 403);
		assert.equal((await invoke('stats')).status, 403);
		assert.equal((await invoke('read', 'POST', '/orders', {})).status, 403);
		assert.equal((await invoke('full', 'GET', `/orders/${foreignOrder}`)).status, 404);
		assert.equal((await invoke('full', 'PATCH', `/orders/${foreignOrder}`, { status: 'paid' })).status, 403);
		assert.equal((await invoke('full', 'POST', '/orders', { merchant_id: foreignMerchant })).status, 403);
		assert.equal((await invoke('full', 'GET', `/orders?merchant_id=${foreignMerchant}`)).status, 403);
		for (const query of ['limit=0', 'limit=101', 'limit=oops', 'offset=-1']) {
			assert.equal((await invoke('full', 'GET', `/orders?${query}`)).status, 422);
		}
		assert.equal((await invoke('full', 'POST', '/orders', { type: 'fixed', amount: -1, entity_id: ids.entity })).status, 422);
		const orders = [];
		for (const type of ['fixed', 'open_amount', 'table', 'delivery']) {
			const result = await invoke('write', 'POST', '/orders', {
				type, entity_id: ids.entity, amount: type === 'open_amount' ? 0 : 10,
				delivery_fee: type === 'delivery' ? 3 : 0,
				...(type === 'table' ? { terminal_id: '40000000-0000-0000-0000-000000000001', table_number: 4 } : {}),
				user_id: ids.other, order_number: 'FORGED', payment_purpose: 'FORGED'
			});
			assert.equal(result.status, 200, JSON.stringify(result));
			assert.equal(result.body.order.merchant_id, ids.merchant);
			assert.notEqual(result.body.order.order_number, 'FORGED');
			assert.notEqual(result.body.order.payment_purpose, 'FORGED');
			assert.equal(result.body.order.total_amount, type === 'open_amount' ? 0 : type === 'delivery' ? 13 : 10);
			assert.equal(result.body.order.status, type === 'table' ? 'preparing' : 'pending');
			assert.equal(result.body.order.share_url, `https://example.com/pay/${result.body.order.id}`);
			orders.push(result.body.order);
		}
		assert.equal(new Set(orders.map(order => order.order_number)).size, 4);
		for (const order of orders) {
			assert.equal(order.payment_acceptance_mode, 'direct');
			assert.equal(order.payment_recipient_name, 'ТОВ Продавець');
			assert.equal(order.payment_recipient_iban, 'UA123456789012345678901234567');
			assert.equal(order.payment_recipient_tax_id, '12345678');
			assert.match(order.payment_purpose, /; (?:10\.00|13\.00|); ; contract-9; INV-\d+;/);
		}
		const own = await invoke('read', 'GET', `/orders/${orders[0].id}`);
		assert.equal(own.body.id, orders[0].id);
		assert.equal(own.body.merchants.id, ids.merchant);
		const updated = await invoke('write', 'PATCH', `/orders/${orders[0].id}`, { status: 'paid', paid_amount: 10 });
		assert.equal(updated.status, 403);
		const unchanged = await invoke('read', 'GET', `/orders/${orders[0].id}`);
		assert.equal(unchanged.body.status, 'pending');
		assert.equal(unchanged.body.paid_amount, null);
		assert.equal(unchanged.body.payment_purpose, orders[0].payment_purpose);
		const listed = await invoke('read');
		assert.ok(listed.body.orders.length >= 4);
		assert.ok(listed.body.orders.every(order => order.merchant_id === ids.merchant));
		await db.exec('reset role');
		assert.equal((await db.query('select status from public.orders where id = $1', [foreignOrder])).rows[0].status, 'pending');
		for (const role of ['anon', 'authenticated']) {
			await db.exec(`set role ${role}`);
			await assert.rejects(db.query("select public.merchant_api_key_orders(repeat('a',64), 'GET')"), /permission denied/);
			await db.exec('reset role');
		}
		await identity();
		await assert.rejects(db.exec('update public.merchant_api_keys set last_used_at = now()'), /permission denied/);
		await db.exec("update public.merchant_api_keys set revoked_at = now() where name = 'full'");
		assert.equal((await invoke('full')).status, 401);
		await db.exec('reset role; set role service_role');
		await assert.rejects(db.exec("update public.merchant_api_keys set revoked_at = null where name = 'full'"), /revoked/);
	} finally {
		globalThis.fetch = originalFetch;
		await db.exec('reset role');
	}
});

test('Merchant API invoices snapshot finance-company recipient across all scenarios', async () => {
	await db.exec('reset role');
	const revision = Number((await db.query(
		'select revision from public.business_settings where merchant_id = $1', [ids.merchant]
	)).rows[0].revision);
	await save({
		version: 2,
		mode: 'finance-company',
		financeName: 'ТОВ Фінансова компанія',
		financeIban: 'UA987654321098765432109876543',
		financeTaxId: '87654321',
		financePurposeTemplate: '{business_purpose} / {payment_id}',
		sellers: { [ids.entity]: { ...seller, purposeTemplate: '{scenario}; {number}' } }
	}, revision);
	const hash = Buffer.from(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(
		`rhk_live_${'3'.repeat(64)}`
	))).toString('hex');
	await db.exec('reset role; set role service_role');
	for (const type of ['fixed', 'open_amount', 'table', 'delivery']) {
		const result = (await db.query(
			"select public.merchant_api_operations($1, 'POST', 'orders', null, '{}', $2) as result",
			[hash, {
				type, entity_id: ids.entity, amount: type === 'open_amount' ? 0 : 10,
				delivery_fee: type === 'delivery' ? 3 : 0,
				...(type === 'table' ? { terminal_id: '40000000-0000-0000-0000-000000000001', table_number: 4 } : {})
			}]
		)).rows[0].result;
		assert.equal(result.status, 200, JSON.stringify(result));
		const order = result.body.order;
		assert.equal(order.payment_acceptance_mode, 'finance-company');
		assert.equal(order.payment_recipient_name, 'ТОВ Фінансова компанія');
		assert.equal(order.payment_recipient_iban, 'UA987654321098765432109876543');
		assert.equal(order.payment_recipient_tax_id, '87654321');
		assert.ok(order.payment_purpose.includes(order.payment_id));
		assert.match(order.payment_purpose, /INV-\d+/);
		if (type === 'delivery') assert.match(order.payment_purpose, /товари та доставку/);
	}
	await db.exec('reset role');
});

test('API invoice idempotency is atomic, merchant scoped and checks authorization on replay', async () => {
	const hash = Buffer.from(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`rhk_live_${'3'.repeat(64)}`))).toString('hex');
	const payload = { type: 'fixed', entity_id: ids.entity, amount: 42 };
	await db.exec('reset role; set role service_role');
	const call = async (body = payload, key = 'invoice-42') => (await db.query(
		"select public.merchant_api_operations($1, 'POST', 'orders', null, '{}', $2, $3) as result",
		[hash, body, key])).rows[0].result;
	const first = await call();
	assert.equal(first.status, 200, JSON.stringify(first));
	assert.deepEqual(await call({ amount: 42, entity_id: ids.entity, type: 'fixed' }), first);
	assert.equal((await call({ ...payload, amount: 43 })).status, 409);
	assert.equal((await call(payload, '')).status, 400);
	const repeated = await Promise.all(Array.from({ length: 4 }, () => call(payload, 'concurrent-create')));
	assert.ok(repeated.every(result => result.body.order.id === repeated[0].body.order.id));
	assert.notEqual(repeated[0].body.order.id, first.body.order.id);
	await db.exec('reset role');
	assert.equal((await db.query('select count(*)::integer as count from public.orders where id = $1', [first.body.order.id])).rows[0].count, 1);
	for (const role of ['anon', 'authenticated']) {
		await db.exec(`set role ${role}`);
		await assert.rejects(call(), /permission denied/);
		await assert.rejects(db.exec('select * from merchant_api_private.idempotency'), /permission denied/);
		await db.exec('reset role');
	}
	await db.query("update merchant_api_private.idempotency set expires_at = now() - interval '1 second' where idempotency_key = 'invoice-42'");
	await db.exec('set role service_role');
	assert.notEqual((await call()).body.order.id, first.body.order.id);
	await db.exec('reset role');
	await db.query('update public.merchant_api_keys set revoked_at = now() where secret_hash = $1', [hash]);
	await db.exec('set role service_role');
	assert.equal((await call()).status, 401);
	await db.exec('reset role');
});

test('API stats use persisted merchant rows and shared atomic limits', async () => {
	await db.exec('reset role');
	const hash = Buffer.from(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`rhk_live_${'6'.repeat(64)}`))).toString('hex');
	const expected = (await db.query('select count(*)::integer as count from public.orders where merchant_id = $1', [ids.merchant])).rows[0].count;
	await db.exec('set role service_role');
	const call = async (query = {}) => (await db.query("select public.merchant_api_operations($1, 'GET', 'stats', null, $2) as result", [hash, query])).rows[0].result;
	const result = await call();
	assert.equal(result.status, 200, JSON.stringify(result));
	assert.equal(result.body.orders, expected);
	assert.equal(result.body.timezone, 'Europe/Kyiv');
	assert.equal(result.body.daily.reduce((sum, day) => sum + day.orders, 0), expected);
	assert.equal((await call({ timezone: 'invalid/timezone' })).status, 422);
	assert.equal((await call({ from: '2026-01-02', to: '2026-01-01' })).status, 422);
	assert.equal((await call({ merchant_id: 'foreign' })).status, 403);
	assert.equal((await call({ entity_id: ids.other })).body.orders, 0);
	await db.exec('reset role');
	await db.query("update merchant_api_private.rate_limits set requests = 120, window_start = date_trunc('minute', clock_timestamp()) where merchant_id = $1 and bucket = 'read'", [ids.merchant]);
	await db.exec('set role service_role');
	const limited = await call();
	assert.equal(limited.status, 429);
	assert.ok(limited.retry_after >= 1 && limited.retry_after <= 60);
	await db.exec('reset role');
	await db.query("update merchant_api_private.rate_limits set window_start = now() - interval '2 minutes' where merchant_id = $1", [ids.merchant]);
	await db.exec('set role service_role');
	assert.equal((await call()).status, 200);
	await db.exec('reset role');
});
