import assert from 'node:assert/strict';
import test from 'node:test';

import { routeDashboardRequest } from './dashboard.ts';
import { signSandboxCallback, verifySandboxCallback } from './sandbox.ts';

function createEnv() {
	const assetPaths = [];
	const apiPaths = [];
	return {
		assetPaths,
		apiPaths,
		env: {
			ASSETS: {
				async fetch(request) {
					assetPaths.push(new URL(request.url).pathname);
					return new Response('<html>Dashboard</html>');
				}
			},
			API: {
				async fetch(request) {
					apiPaths.push(new URL(request.url).pathname);
					return Response.json({ proxied: true });
				}
			}
		}
	};
}

test('signs callbacks and rejects a changed payload', async () => {
	const secret = new TextEncoder().encode('sandbox-secret');
	const timestamp = '1788120000';
	const body = '{"status":"succeeded"}';
	const signature = await signSandboxCallback(secret, timestamp, body);

	assert.equal(await verifySandboxCallback(secret, timestamp, body, signature), true);
	assert.equal(
		await verifySandboxCallback(secret, timestamp, '{"status":"failed"}', signature),
		false
	);
});

test('returns an isolated verified payment simulation', async () => {
	const { env, apiPaths } = createEnv();
	const response = await routeDashboardRequest(
		new Request('https://example.com/dashboard/api/sandbox/simulate', { method: 'POST' }),
		env
	);
	const result = await response.json();

	assert.equal(response.status, 200);
	assert.equal(response.headers.get('Cache-Control'), 'no-store');
	assert.equal(result.verified, true);
	assert.equal(result.event.eventType, 'payment.succeeded');
	assert.equal(result.event.payment.amountMinor, 12500);
	assert.match(result.headers['Rahunok-Signature'], /^v1=[a-f\d]{64}$/);
	assert.deepEqual(apiPaths, []);
});

test('rejects unsupported sandbox methods and preserves API proxying', async () => {
	const { env, apiPaths } = createEnv();
	const rejected = await routeDashboardRequest(
		new Request('https://example.com/dashboard/api/sandbox/simulate'),
		env
	);
	const proxied = await routeDashboardRequest(
		new Request('https://example.com/dashboard/api/v1/orders'),
		env
	);

	assert.equal(rejected.status, 405);
	assert.equal(rejected.headers.get('Allow'), 'POST');
	assert.equal(proxied.status, 200);
	assert.deepEqual(apiPaths, ['/api/v1/orders']);
});
