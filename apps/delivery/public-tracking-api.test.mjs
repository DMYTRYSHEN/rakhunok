import test from 'node:test';
import assert from 'node:assert/strict';
import { createPublicTrackingHandler } from './src/lib/server/tracking/public-tracking-api.ts';
import { PublicTrackingError } from './src/lib/server/tracking/public-tracking.ts';

const url = new URL('https://delivery.example/api/v1/tracking/20450000000000?carrier=nova_poshta');
const result = { carrier: 'nova_poshta', trackingNumber: '20450000000000', trackingState: 'active',
	deliveryStatus: 'in_transit', checkedAt: '2026-10-09T10:00:00.000Z', providerStatusCode: '5' };

test('edge limiter stops provider calls and fails closed when unavailable', async () => {
	let calls = 0;
	const handle = createPublicTrackingHandler(async () => { calls += 1; return result; });
	const blocked = await handle(result.trackingNumber, url, async () => false);
	assert.equal(blocked.status, 429);
	assert.equal(blocked.headers.get('retry-after'), '60');
	const unavailable = await handle(result.trackingNumber, url, async () => { throw new Error('SECRET'); });
	assert.equal(unavailable.status, 503);
	assert.ok(!(await unavailable.text()).includes('SECRET'));
	assert.equal(calls, 0);
	assert.equal((await handle(result.trackingNumber, url, async () => true)).status, 200);
	assert.equal(calls, 1);
});

test('public lookup needs no identity and allowlists response fields', async () => {
	const handle = createPublicTrackingHandler(async (number, carrier) => {
		assert.equal(number, result.trackingNumber);
		assert.equal(carrier, 'nova_poshta');
		return { ...result, name: 'PRIVATE', phone: 'PRIVATE', details: {}, token: 'SECRET' };
	});
	const response = await handle(result.trackingNumber, url);
	assert.equal(response.status, 200);
	assert.deepEqual(await response.json(), { data: result });
	assert.equal(response.headers.get('cache-control'), 'no-store');
	assert.equal(response.headers.get('access-control-allow-origin'), '*');
});

test('invalid input, throttling and provider failures are explicit and sanitized', async () => {
	for (const [trackingState, status] of [['rate_limited', 429], ['provider_unavailable', 503], ['access_denied', 503], ['not_found', 200]]) {
		const response = await createPublicTrackingHandler(async () => ({ ...result, trackingState }))(result.trackingNumber, url);
		assert.equal(response.status, status);
		if (status === 429) assert.equal(response.headers.get('retry-after'), '60');
	}
	for (const failure of [new PublicTrackingError(), new Error('SECRET')]) {
		const response = await createPublicTrackingHandler(async () => { throw failure; })('bad', url);
		assert.equal(response.status, failure instanceof PublicTrackingError ? 400 : 503);
		assert.ok(!(await response.text()).includes('SECRET'));
	}
	const response = await createPublicTrackingHandler(async () => { throw new Error('Must not run'); })('bad', new URL(`${url}&carrier=meest`));
	assert.equal(response.status, 400);
});