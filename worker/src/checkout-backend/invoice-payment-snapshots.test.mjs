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
});

after(() => db.close());

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
