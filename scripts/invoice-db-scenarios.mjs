import { randomBytes } from 'node:crypto';

import { createClient } from '@supabase/supabase-js';

const REQUIRED_ENV = [
	'TEST_SUPABASE_URL',
	'TEST_SUPABASE_ANON_KEY',
	'TEST_SUPABASE_SERVICE_ROLE_KEY',
	'TEST_SUPABASE_PROJECT_REF',
	'TEST_MERCHANT_EMAIL',
	'TEST_MERCHANT_IBAN',
	'WORKER_BASE_URL'
];

function requireSafeEnvironment() {
	const missing = REQUIRED_ENV.filter((name) => !process.env[name]);
	if (missing.length > 0) {
		throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
	}

	if (process.env.ALLOW_TEST_DATABASE_WRITES !== '1') {
		throw new Error('Set ALLOW_TEST_DATABASE_WRITES=1 to acknowledge database writes.');
	}

	const supabaseUrl = new URL(process.env.TEST_SUPABASE_URL);
	const projectRef = supabaseUrl.hostname.split('.')[0];
	if (projectRef !== process.env.TEST_SUPABASE_PROJECT_REF) {
		throw new Error('TEST_SUPABASE_PROJECT_REF does not match TEST_SUPABASE_URL.');
	}

	const marker = `${process.env.TEST_MERCHANT_EMAIL} ${process.env.TEST_MERCHANT_NAME ?? ''}`;
	if (!/(test|staging|qa)/i.test(marker)) {
		throw new Error('The merchant email or name must contain test, staging, or qa.');
	}

	const iban = process.env.TEST_MERCHANT_IBAN.replace(/\s+/g, '').toUpperCase();
	if (!/^UA[A-Z0-9]{27}$/.test(iban)) {
		throw new Error('TEST_MERCHANT_IBAN must contain exactly 29 characters and start with UA.');
	}

	return {
		supabaseUrl: supabaseUrl.toString().replace(/\/$/, ''),
		anonKey: process.env.TEST_SUPABASE_ANON_KEY,
		serviceRoleKey: process.env.TEST_SUPABASE_SERVICE_ROLE_KEY,
		workerBaseUrl: process.env.WORKER_BASE_URL.replace(/\/$/, ''),
		email: process.env.TEST_MERCHANT_EMAIL,
		iban,
		merchantName: process.env.TEST_MERCHANT_NAME || 'Rahunok QA Test Merchant'
	};
}

async function findUserByEmail(admin, email) {
	for (let page = 1; page <= 20; page += 1) {
		const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 100 });
		if (error) throw error;
		const user = data.users.find(
			(candidate) => candidate.email?.toLowerCase() === email.toLowerCase()
		);
		if (user) return user;
		if (data.users.length < 100) return null;
	}

	throw new Error('Test user lookup exceeded 2,000 Auth users.');
}

async function provisionTestUser(admin, email) {
	const password = `Rhk-QA-${randomBytes(24).toString('base64url')}`;
	let user = await findUserByEmail(admin, email);

	if (user) {
		const { data, error } = await admin.auth.admin.updateUserById(user.id, {
			password,
			user_metadata: { rahunok_test_merchant: true }
		});
		if (error) throw error;
		user = data.user;
	} else {
		const { data, error } = await admin.auth.admin.createUser({
			email,
			password,
			email_confirm: true,
			user_metadata: { rahunok_test_merchant: true }
		});
		if (error) throw error;
		user = data.user;
	}

	return { user, password };
}

async function requestWorker(baseUrl, accessToken, pathname, init = {}) {
	const response = await fetch(`${baseUrl}${pathname}`, {
		...init,
		headers: {
			Authorization: `Bearer ${accessToken}`,
			'Content-Type': 'application/json',
			...init.headers
		}
	});
	const text = await response.text();
	const payload = text ? JSON.parse(text) : null;
	if (!response.ok) {
		throw new Error(`${init.method ?? 'GET'} ${pathname} failed (${response.status}): ${text}`);
	}
	return payload;
}

function assertEqual(actual, expected, label) {
	if (actual !== expected) {
		throw new Error(
			`${label}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`
		);
	}
}

async function verifyOrder(admin, merchantId, scenario, orderId) {
	const { data: order, error: orderError } = await admin
		.from('orders')
		.select('*')
		.eq('id', orderId)
		.eq('merchant_id', merchantId)
		.single();
	if (orderError) throw orderError;

	assertEqual(order.type, scenario.body.type, `${scenario.name} type`);
	assertEqual(
		Number(order.base_amount),
		scenario.expected.baseAmount,
		`${scenario.name} base amount`
	);
	assertEqual(
		Number(order.total_amount),
		scenario.expected.totalAmount,
		`${scenario.name} total amount`
	);
	assertEqual(order.status, scenario.expected.status, `${scenario.name} initial status`);
	assertEqual(order.table_number, scenario.expected.tableNumber, `${scenario.name} table number`);
	const shareUrl = new URL(order.share_url);
	assertEqual(shareUrl.pathname, `/pay/${orderId}`, `${scenario.name} share URL path`);

	const { data: items, error: itemError } = await admin
		.from('order_items')
		.select('name, quantity, unit_price, total_price, sort_order')
		.eq('order_id', orderId)
		.order('sort_order');
	if (itemError) throw itemError;
	assertEqual(items.length, scenario.expected.itemCount, `${scenario.name} item count`);

	const { count, error: countError } = await admin
		.from('orders')
		.select('id', { count: 'exact', head: true })
		.eq('merchant_id', merchantId)
		.eq('order_number', scenario.body.order_number);
	if (countError) throw countError;
	assertEqual(count, 1, `${scenario.name} persisted order count`);

	for (const [index, expectedItem] of (scenario.body.items ?? []).entries()) {
		const item = items[index];
		assertEqual(item.name, expectedItem.name, `${scenario.name} item ${index + 1} name`);
		assertEqual(
			Number(item.quantity),
			expectedItem.quantity,
			`${scenario.name} item ${index + 1} quantity`
		);
		assertEqual(
			Number(item.unit_price),
			expectedItem.unit_price,
			`${scenario.name} item ${index + 1} price`
		);
		assertEqual(
			Number(item.total_price),
			expectedItem.quantity * expectedItem.unit_price,
			`${scenario.name} item ${index + 1} total`
		);
	}
}

function buildScenarios(runId) {
	return [
		{
			name: 'fixed',
			body: {
				type: 'fixed',
				order_number: `${runId}-FIXED`,
				title: 'QA fixed invoice',
				description: `Automated test ${runId}`,
				amount: 125.5
			},
			expected: {
				baseAmount: 125.5,
				totalAmount: 125.5,
				status: 'pending',
				tableNumber: null,
				itemCount: 0
			}
		},
		{
			name: 'items',
			body: {
				type: 'fixed',
				order_number: `${runId}-ITEMS`,
				title: 'QA itemized invoice',
				amount: 92.5,
				items: [
					{ name: 'QA coffee', quantity: 2, unit_price: 32.5 },
					{ name: 'QA dessert', quantity: 1, unit_price: 27.5 }
				]
			},
			expected: {
				baseAmount: 92.5,
				totalAmount: 92.5,
				status: 'pending',
				tableNumber: null,
				itemCount: 2
			}
		},
		{
			name: 'delivery',
			body: {
				type: 'delivery',
				order_number: `${runId}-DELIVERY`,
				title: 'QA delivery invoice',
				description: `QA delivery ${runId}`,
				amount: 150,
				delivery_fee: 35
			},
			expected: {
				baseAmount: 150,
				totalAmount: 185,
				status: 'pending',
				tableNumber: null,
				itemCount: 0
			}
		},
		{
			name: 'table',
			body: {
				type: 'table',
				order_number: `${runId}-TABLE`,
				title: 'QA table invoice',
				amount: 240,
				table_number: 17
			},
			expected: {
				baseAmount: 240,
				totalAmount: 240,
				status: 'preparing',
				tableNumber: 17,
				itemCount: 0
			}
		}
	];
}

async function main() {
	const config = requireSafeEnvironment();
	const clientOptions = { auth: { autoRefreshToken: false, persistSession: false } };
	const admin = createClient(config.supabaseUrl, config.serviceRoleKey, clientOptions);
	const authClient = createClient(config.supabaseUrl, config.anonKey, clientOptions);
	const { user, password } = await provisionTestUser(admin, config.email);

	const { data: signIn, error: signInError } = await authClient.auth.signInWithPassword({
		email: config.email,
		password
	});
	if (signInError || !signIn.session)
		throw signInError ?? new Error('Test user sign-in returned no session.');

	const onboarding = await requestWorker(
		config.workerBaseUrl,
		signIn.session.access_token,
		'/api/v1/merchant/onboarding',
		{
			method: 'POST',
			body: JSON.stringify({
				business_name: config.merchantName,
				business_type: 'fop',
				tax_id: process.env.TEST_MERCHANT_TAX_ID || '0000000000',
				iban: config.iban,
				display_name: config.merchantName,
				bank_name: 'QA Test Bank'
			})
		}
	);
	const merchantId = onboarding?.merchant?.id;
	if (!merchantId) throw new Error('Onboarding response did not include merchant.id.');

	const { data: merchant, error: merchantError } = await admin
		.from('merchants')
		.select('id, user_id, business_name, onboarding_completed, is_active')
		.eq('id', merchantId)
		.eq('user_id', user.id)
		.single();
	if (merchantError) throw merchantError;
	assertEqual(merchant.business_name, config.merchantName, 'merchant business name');
	assertEqual(merchant.onboarding_completed, true, 'merchant onboarding status');

	const runId = `QA-${Date.now()}`;
	const createdOrderIds = [];
	let generatedShareUrlOrigin = '';
	try {
		for (const scenario of buildScenarios(runId)) {
			const result = await requestWorker(
				config.workerBaseUrl,
				signIn.session.access_token,
				'/api/v1/orders',
				{
					method: 'POST',
					body: JSON.stringify(scenario.body)
				}
			);
			const orderId = result?.order?.id;
			if (!orderId) throw new Error(`${scenario.name} response did not include order.id.`);
			createdOrderIds.push(orderId);
			generatedShareUrlOrigin ||= new URL(result.order.share_url).origin;
			await verifyOrder(admin, merchantId, scenario, orderId);
			const persisted = await requestWorker(
				config.workerBaseUrl,
				signIn.session.access_token,
				`/api/v1/orders/${orderId}`
			);
			assertEqual(persisted.id, orderId, `${scenario.name} GET order id`);
			assertEqual(
				persisted.share_url,
				result.order.share_url,
				`${scenario.name} POST and GET share URL`
			);
			await requestWorker(
				config.workerBaseUrl,
				signIn.session.access_token,
				`/api/v1/orders/${orderId}`,
				{
					method: 'PATCH',
					body: JSON.stringify({ status: 'cancelled' })
				}
			);
			const { data: cancelled, error: cancellationError } = await admin
				.from('orders')
				.select('status')
				.eq('id', orderId)
				.eq('merchant_id', merchantId)
				.single();
			if (cancellationError) throw cancellationError;
			assertEqual(cancelled.status, 'cancelled', `${scenario.name} cancelled status`);
			console.log(`PASS ${scenario.name}: ${orderId}`);
		}
	} finally {
		if (createdOrderIds.length > 0 && process.env.TEST_KEEP_ORDERS !== '1') {
			const { error } = await admin
				.from('orders')
				.delete()
				.in('id', createdOrderIds)
				.eq('merchant_id', merchantId);
			if (error) throw error;
		}
	}

	console.log(`Test merchant ready: ${merchant.id}`);
	console.log(`Verified ${createdOrderIds.length} invoice scenarios.`);
	console.log(`Generated share URL origin: ${generatedShareUrlOrigin}`);
	console.log(
		process.env.TEST_KEEP_ORDERS === '1' ? 'Created orders retained.' : 'Created orders cleaned up.'
	);
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : error);
	process.exitCode = 1;
});
