import assert from 'node:assert/strict';
import test, { beforeEach, afterEach } from 'node:test';
import { routeWebRequest } from './index.ts';

const env = { ASSETS: { fetch: async () => { throw new Error('Unexpected asset fetch'); } } };
const authorization = 'Bearer local-test-token';
const endpoints = [
	['PUT', '/api/v1/merchant/me'],
	['POST', '/api/v1/merchant/onboarding'],
	['POST', '/api/v1/orders'],
	['PATCH', '/api/v1/orders/order-test']
];
let originalFetch;
let calls;
let respond;

beforeEach(() => {
	originalFetch = globalThis.fetch;
	calls = [];
	respond = () => { throw new Error('Unexpected mocked fetch'); };
	globalThis.fetch = async (url, init) => {
		calls.push({ url: String(url), init });
		return respond(String(url), init);
	};
});
afterEach(() => { globalThis.fetch = originalFetch; });

function request(method, path, body = { merchant_id: 'merchant-test' }, auth = authorization) {
	return new Request(`https://example.com${path}`, {
		method,
		headers: { 'Content-Type': 'application/json', ...(auth === null ? {} : { Authorization: auth }) },
		body: typeof body === 'string' ? body : JSON.stringify(body)
	});
}

async function failure(response, status, error) {
	assert.equal(response.status, status);
	assert.deepEqual(await response.json(), { error });
}

for (const [method, path] of endpoints) {
	for (const auth of [null, 'Basic abc', 'Bearer', 'Bearer token extra']) {
		test(`${method} ${path}: rejects ${auth ?? 'missing auth'} before IO`, async () => {
			await failure(await routeWebRequest(request(method, path, '{', auth), env), 401, 'Unauthorized');
			assert.equal(calls.length, 0);
		});
	}

	test(`${method} ${path}: invalid client JSON remains 400`, async () => {
		await failure(await routeWebRequest(request(method, path, '{'), env), 400, 'Invalid JSON payload');
		assert.equal(calls.length, 0);
	});

	for (const [status, expected, error] of [
		[401, 401, 'Unauthorized'], [403, 403, 'Forbidden'], [409, 409, 'Conflict'],
		[422, 422, 'Unprocessable entity'], [400, 503, 'Service unavailable'],
		[404, 503, 'Service unavailable'], [500, 503, 'Service unavailable'],
		[503, 503, 'Service unavailable']
	]) {
		test(`${method} ${path}: sanitizes downstream ${status}`, async () => {
			respond = () => new Response('private SQL / credentials / policy details', { status });
			await failure(await routeWebRequest(request(method, path), env), expected, error);
			assert.equal(calls.length, 1);
			assert.equal(calls[0].init.headers.Authorization, authorization);
		});
	}

	for (const [label, response] of [
		['network', () => { throw new Error('private network details'); }],
		['invalid JSON', () => new Response('{')],
		['empty body', () => new Response(null, { status: 204 })],
		['object instead of array', () => Response.json({ id: 'order-test' })],
		['null', () => Response.json(null)],
		['null row', () => Response.json([null])],
		['missing id', () => Response.json([{}])],
		['invalid id', () => Response.json([{ id: 123 }])],
		['blank id', () => Response.json([{ id: ' ' }])],
		['multiple rows', () => Response.json([{ id: 'order-test' }, { id: 'other' }])]
	]) {
		test(`${method} ${path}: ${label} is 503, not success/400`, async () => {
			respond = response;
			await failure(await routeWebRequest(request(method, path), env), 503, 'Service unavailable');
		});
	}

	test(`${method} ${path}: zero rows never succeeds`, async () => {
		respond = () => Response.json([]);
		await failure(await routeWebRequest(request(method, path), env),
			method === 'PATCH' ? 404 : 503,
			method === 'PATCH' ? 'Order not found' : 'Service unavailable');
	});
}

for (const [method, path] of endpoints.slice(0, 2)) {
	test(`${method} ${path}: awaits persisted representation and preserves write payload`, async () => {
		let release;
		let started;
		const entered = new Promise((resolve) => { started = resolve; });
		const pending = new Promise((resolve) => { release = resolve; });
		respond = () => { started(); return pending; };
		let finished = false;
		const result = routeWebRequest(request(method, path, {
			business_name: ' Shop ', iban: 'ua 123', tax_id: ' 123 ', user_id: 'unchanged-ignored'
		}), env).then((response) => { finished = true; return response; });
		await entered;
		assert.equal(finished, false);
		const payload = JSON.parse(calls[0].init.body);
		assert.deepEqual(payload, {
			business_name: 'Shop', business_type: 'fop', tax_id: '123', iban: 'UA123',
			display_name: 'Shop', bank_name: 'А-Банк', onboarding_completed: true,
			updated_at: payload.updated_at
		});
		assert.ok(Number.isFinite(Date.parse(payload.updated_at)));
		assert.equal(calls[0].init.method, 'POST');
		assert.equal(calls[0].init.headers.Prefer, 'resolution=merge-duplicates,return=representation');
		const merchant = { ...payload, id: 'persisted-merchant', server_field: true };
		release(Response.json([merchant]));
		const response = await result;
		assert.equal(response.status, 200);
		assert.deepEqual(await response.json(), { success: true, merchant });
	});
}

for (const path of ['/api/v1/orders/', '/api/v1/orders/future', '/api/v1/orders/order-test/pay', '/api/v1/orders-extra']) {
	test(`POST ${path}: does not dispatch to collection creation`, async () => {
		const response = await routeWebRequest(request('POST', path), env);
		assert.equal(response.status, 404);
		assert.equal(calls.length, 0);
	});
}

for (const [label, response, status, error] of [
	['missing merchant', () => Response.json([]), 404, 'Merchant not found'],
	['forbidden', () => new Response('private', { status: 403 }), 403, 'Forbidden'],
	['DB unavailable', () => new Response('private', { status: 503 }), 503, 'Service unavailable'],
	['network', () => { throw new Error('private'); }, 503, 'Service unavailable'],
	['malformed JSON', () => new Response('{'), 503, 'Service unavailable'],
	['malformed row', () => Response.json([{}]), 503, 'Service unavailable'],
	['non-array', () => Response.json({ id: 'merchant-test' }), 503, 'Service unavailable']
]) {
	test(`POST orders merchant lookup: ${label} stops insertion`, async () => {
		respond = response;
		await failure(await routeWebRequest(request('POST', '/api/v1/orders', {}), env), status, error);
		assert.equal(calls.length, 1);
		assert.ok(calls[0].url.endsWith('/merchants?select=id&limit=1'));
	});
}

for (const explicitMerchant of [true, false]) {
	test(`POST orders: confirmed success, explicit merchant=${explicitMerchant}`, async () => {
		let inserted;
		respond = (url, init) => {
			assert.equal(init.headers.Authorization, authorization);
			if (url.includes('/merchants?')) return Response.json([{ id: 'merchant-test' }]);
			assert.ok(url.endsWith('/rest/v1/orders'));
			assert.equal(init.method, 'POST');
			assert.equal(init.headers.Prefer, 'return=representation');
			const payload = JSON.parse(init.body);
			assert.deepEqual(payload, {
				id: payload.id, merchant_id: 'merchant-test', entity_id: 'entity-test', type: 'table',
				order_number: 'TEST-1', title: 'Test', description: 'Description', base_amount: 12,
				delivery_fee: 3, total_amount: 15, status: 'preparing', table_number: 4,
				terminal_id: 'terminal-test', currency: 'UAH', scenario_config: { existing: true }
			});
			inserted = { ...payload, created_at: 'server-time' };
			return Response.json([inserted], { status: 201 });
		};
		const response = await routeWebRequest(request('POST', '/api/v1/orders', {
			...(explicitMerchant ? { merchant_id: 'merchant-test' } : {}),
			entity_id: 'entity-test', type: 'table', order_number: 'TEST-1', title: 'Test',
			description: 'Description', amount: 12, delivery_fee: 3, table_number: '4',
			terminal_id: 'terminal-test', scenario_config: { existing: true }
		}), env);
		assert.equal(response.status, 200);
		assert.deepEqual(await response.json(), {
			success: true, order: { ...inserted, share_url: `https://example.com/pay/${inserted.id}` }
		});
		assert.equal(calls.length, explicitMerchant ? 1 : 2);
	});
}

test('PATCH rejects a different returned row id', async () => {
	respond = () => Response.json([{ id: 'wrong-order', status: 'cancelled' }]);
	await failure(await routeWebRequest(request('PATCH', '/api/v1/orders/order-test', { status: 'cancelled' }), env),
		503, 'Service unavailable');
});

test('PATCH preserves the existing paid payload and successful representation', async () => {
	let updated;
	respond = (url, init) => {
		assert.ok(url.endsWith('/orders?id=eq.order-test'));
		assert.equal(init.method, 'PATCH');
		const payload = JSON.parse(init.body);
		assert.deepEqual(payload, {
			updated_at: payload.updated_at, status: 'paid', paid_at: '2026-09-13T00:00:00Z',
			paid_bank_code: 'MONO', paid_amount: 42, base_amount: 42, total_amount: 42
		});
		updated = { id: 'order-test', ...payload, server_field: true };
		return Response.json([updated]);
	};
	const response = await routeWebRequest(request('PATCH', '/api/v1/orders/order-test', {
		status: 'paid', paid_at: '2026-09-13T00:00:00Z', paid_bank_code: 'MONO', paid_amount: 42, amount: 42
	}), env);
	assert.equal(response.status, 200);
	assert.deepEqual(await response.json(), { success: true, order: updated });
});

test('PATCH leaves cached aliases unchanged until confirmed success, then invalidates only that order', async () => {
	const id = '10000000-0000-4000-8000-000000000001';
	const otherId = '10000000-0000-4000-8000-000000000002';
	let row = { id, short_id: 'cache-short', order_number: 'cache-number', status: 'pending', base_amount: 10, total_amount: 10 };
	respond = (url) => Response.json([url.includes(otherId) ? { ...row, id: otherId, short_id: 'other-short' } : row]);
	const read = (key) => routeWebRequest(new Request(`https://example.com/api/v1/checkout/${key}`), env);
	for (const key of [id, 'cache-number', otherId]) assert.equal((await read(key)).status, 200);
	const cachedRead = async (key, status) => {
		const count = calls.length;
		assert.equal((await (await read(key)).json()).status, status);
		assert.equal(calls.length, count, 'expected cached read');
	};
	for (const response of [
		() => new Response('private', { status: 403 }),
		() => Response.json([]),
		() => Response.json([{ id: 'wrong-order' }]),
		() => new Response('{'),
		() => { throw new Error('network'); }
	]) {
		respond = response;
		const result = await routeWebRequest(request('PATCH', `/api/v1/orders/${id}`, { status: 'cancelled' }), env);
		assert.ok(result.status >= 400);
		for (const key of [id, 'cache-short', 'cache-number']) await cachedRead(key, 'pending');
	}
	let release;
	let started;
	const entered = new Promise((resolve) => { started = resolve; });
	respond = () => { started(); return new Promise((resolve) => { release = resolve; }); };
	const pending = routeWebRequest(request('PATCH', `/api/v1/orders/${id}`, { status: 'cancelled' }), env);
	await entered;
	for (const key of [id, 'cache-short', 'cache-number']) await cachedRead(key, 'pending');
	row = { ...row, status: 'cancelled' };
	release(Response.json([row]));
	assert.equal((await pending).status, 200);
	respond = () => Response.json([row]);
	// Probe each alias through the non-caching order GET so none can re-prime another.
	for (const key of [id, 'cache-short', 'cache-number']) {
		const count = calls.length;
		const result = await routeWebRequest(new Request(`https://example.com/api/v1/orders/${key}`), env);
		assert.equal((await result.json()).status, 'cancelled');
		assert.equal(calls.length, count + 1, 'confirmed write must invalidate every local alias');
	}
	await cachedRead(otherId, 'pending');
});