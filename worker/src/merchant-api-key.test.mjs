import assert from 'node:assert/strict';
import test from 'node:test';
import { handleMerchantApiKey } from './merchant-api-key.ts';
import { routeWebRequest } from './index.ts';

test('malformed merchant key cannot fall through to public order reads', async () => {
	const result = await routeWebRequest(new Request('https://example.com/api/v1/orders', {
		headers: { Authorization: 'Bearer rhk_live_invalid' }
	}), { ASSETS: { fetch() { throw new Error('Unexpected assets'); } } });
	assert.equal(result.status, 401);
});

test('JWT requests remain on the existing path', async () => {
	assert.equal(await handleMerchantApiKey(new Request('https://example.com/api/v1/orders', {
		headers: { Authorization: 'Bearer mock.jwt.token' }
	}), {}), null);
});

test('JWT containing rhk_ is not classified as a merchant key', async () => {
	assert.equal(await handleMerchantApiKey(new Request('https://example.com/api/v1/orders', {
		headers: { Authorization: 'Bearer mock.jwt_rhk_token.signature' }
	}), {}), null);
});

test('JWT order request stays on the legacy route', async (context) => {
	context.mock.method(globalThis, 'fetch', async (url, options) => {
		assert.match(String(url), /\/rest\/v1\/orders\?/);
		assert.equal(options.headers.Authorization, 'Bearer mock.jwt.token');
		return Response.json([]);
	});
	const result = await routeWebRequest(new Request('https://example.com/api/v1/orders', {
		headers: { Authorization: 'Bearer mock.jwt.token' }
	}), { ASSETS: { fetch() { throw new Error('Unexpected assets'); } } });
	assert.equal(result.status, 200);
	assert.deepEqual((await result.json()).orders, []);
});

const token = `rhk_live_${'a'.repeat(64)}`;
const env = { SUPABASE_URL: 'https://database.example.invalid', SUPABASE_SERVICE_ROLE_KEY: 'server-only' };
const invoke = (method, path = '/orders', body = {}) => handleMerchantApiKey(new Request(`https://example.com/api/v1${path}`, {
	method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
	...(method === 'GET' ? {} : { body: JSON.stringify(body) })
}), env);

for (const [method, path, body] of [
	['POST', '/orders', {}],
	['POST', '/orders', { success: false, order: { id: 'order-test' } }],
	['POST', '/orders', { success: true, order: { id: ' ' } }],
	['GET', '/orders/order-test', { id: 'different' }],
	['GET', '/orders', { orders: {} }]
]) {
	test(`rejects invalid successful ${method} representation ${JSON.stringify(body)}`, async (context) => {
		context.mock.method(globalThis, 'fetch', async () => Response.json({ status: 200, body }));
		assert.equal((await invoke(method, path)).status, 503);
	});
}

test('forwards only hashed key using server credentials and adds canonical share link', async (context) => {
	context.mock.method(globalThis, 'fetch', async (url, options) => {
		assert.equal(url, `${env.SUPABASE_URL}/rest/v1/rpc/merchant_api_operations`);
		assert.equal(options.headers.Authorization, 'Bearer server-only');
		assert.equal(options.redirect, 'error');
		assert.equal(options.body.includes(token), false);
		assert.equal(JSON.parse(options.body).p_secret_hash,
			Buffer.from(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))).toString('hex'));
		return Response.json({ status: 200, body: { success: true, order: { id: 'order-test' } } });
	});
	const result = await invoke('POST');
	assert.equal(result.status, 200);
	assert.equal(result.headers.get('Cache-Control'), 'no-store');
	assert.equal((await result.json()).order.share_url, 'https://example.com/pay/order-test');
});

test('main Worker routes merchant key requests through the authenticated RPC', async (context) => {
	context.mock.method(globalThis, 'fetch', async (url, options) => {
		assert.equal(url, `${env.SUPABASE_URL}/rest/v1/rpc/merchant_api_operations`);
		assert.equal(options.headers.Authorization, 'Bearer server-only');
		return Response.json({ status: 200, body: { orders: [], total: 0, limit: 50, offset: 0 } });
	});
	const result = await routeWebRequest(new Request('https://example.com/api/v1/orders', {
		headers: { Authorization: `Bearer ${token}` }
	}), { ...env, ASSETS: { fetch() { throw new Error('Unexpected assets'); } } });
	assert.equal(result.status, 200);
	assert.deepEqual((await result.json()).orders, []);
});

test('merchant key requests fail closed without server credentials', async (context) => {
	const upstream = context.mock.method(globalThis, 'fetch', async () => {
		throw new Error('Unexpected upstream request');
	});
	const result = await routeWebRequest(new Request('https://example.com/api/v1/orders', {
		headers: { Authorization: `Bearer ${token}` }
	}), { ASSETS: { fetch() { throw new Error('Unexpected assets'); } } });
	assert.equal(result.status, 503);
	assert.equal(upstream.mock.callCount(), 0);
});

test('merchant key PATCH cannot reach the privileged RPC', async (context) => {
	const upstream = context.mock.method(globalThis, 'fetch', async () => {
		throw new Error('Unexpected upstream request');
	});
	const workerEnv = { ...env, ASSETS: { fetch() { throw new Error('Unexpected assets'); } } };
	const updated = await routeWebRequest(new Request('https://example.com/api/v1/orders/cache-test-order', {
		method: 'PATCH', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify({ status: 'paid' })
	}), workerEnv);
	assert.equal(updated.status, 403);
	assert.equal(upstream.mock.callCount(), 0);
});

test('forwards idempotency header separately and preserves rate limit retry delay', async (context) => {
	context.mock.method(globalThis, 'fetch', async (url, options) => {
		assert.equal(JSON.parse(options.body).p_idempotency_key, 'sale-123');
		return Response.json({ status: 429, retry_after: 17, body: { error: 'Rate limit exceeded' } });
	});
	const result = await handleMerchantApiKey(new Request('https://example.com/api/v1/orders', {
		method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Idempotency-Key': 'sale-123' }, body: '{}'
	}), env);
	assert.equal(result.status, 429);
	assert.equal(result.headers.get('Retry-After'), '17');
});

test('stats accept a report and reject malformed success', async (context) => {
	context.mock.method(globalThis, 'fetch', async () => Response.json({ status: 200, body: { orders: 0, daily: [], timezone: 'Europe/Kyiv' } }));
	assert.equal((await invoke('GET', '/stats')).status, 200);
	context.mock.method(globalThis, 'fetch', async () => Response.json({ status: 200, body: {} }));
	assert.equal((await invoke('GET', '/stats')).status, 503);
});