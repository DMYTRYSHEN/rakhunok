import test from 'node:test';
import assert from 'node:assert/strict';
import { createRefreshHandler } from './src/lib/server/tracking/refresh-api.ts';
import { AuthError } from './src/lib/server/tracking/auth.ts';

const id = '12345678-1234-1234-1234-123456789abc';
const url = new URL(`https://delivery.example/api/v1/shipments/${id}/refresh`);
const request = (origin = url.origin) => new Request(url, { method: 'POST', headers: { origin } });

test('fresh check uses trusted owner and returns only status fields, including provider failure', async () => {
	for (const trackingState of ['active', 'provider_unavailable']) {
		const calls = [];
		const shipment = { id, carrier: 'nova_poshta', trackingNumber: '20450000000000', trackingState,
			deliveryStatus: 'in_transit', providerStatusCode: '5', providerStatusLabel: 'In transit',
			lastCheckedAt: '2026-10-09T10:00:00.000Z', lastSuccessAt: '2026-10-09T09:00:00.000Z' };
		const handle = createRefreshHandler({ authenticate: async () => ({ id: 'trusted-owner' }),
			refresh: async (...args) => { calls.push(args); return { ...shipment, details: { private: 'hidden' }, events: [] }; } });
		const response = await handle(request(), url, id);
		assert.equal(response.status, 200);
		assert.deepEqual(calls, [[id, 'trusted-owner']]);
		assert.deepEqual(await response.json(), { data: shipment });
		assert.equal(response.headers.get('cache-control'), 'no-store');
	}
});

test('origin, malformed id, unavailable shipment and authentication prevent unsafe refreshes', async () => {
	let calls = 0;
	const dependencies = { authenticate: async () => ({ id: 'owner' }), refresh: async () => { calls++; return null; } };
	const handle = createRefreshHandler(dependencies);
	assert.equal((await handle(request('https://evil.example'), url, id)).status, 403);
	assert.equal((await handle(request(''), url, id)).status, 403);
	assert.equal((await handle(request(), url, 'bad-id')).status, 400);
	assert.equal(calls, 0);
	assert.equal((await handle(request(), url, id)).status, 409);
	assert.equal(calls, 1);
	const denied = createRefreshHandler({ ...dependencies, authenticate: async () => { throw new AuthError('AUTH_REQUIRED'); } });
	assert.equal((await denied(request(), url, id)).status, 401);
	assert.equal(calls, 1);
	const failed = createRefreshHandler({ ...dependencies, refresh: async () => { throw new Error('SECRET'); } });
	const response = await failed(request(), url, id);
	assert.equal(response.status, 503);
	assert.ok(!(await response.text()).includes('SECRET'));
});