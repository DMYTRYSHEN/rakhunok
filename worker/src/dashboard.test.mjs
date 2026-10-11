import assert from 'node:assert/strict';
import test from 'node:test';

import { routeDashboardRequest } from './dashboard.ts';
import { signSandboxCallback, verifySandboxCallback } from './sandbox.ts';

test('serves isolated assets before the dashboard shell, preserving the request and response', async () => {
	for (const path of [
		'/dashboard/_app/immutable/entry/start.js?v=1',
		'/dashboard/_app/env.js',
		'/dashboard/_app/version.json',
		'/dashboard/_app'
	]) {
		for (const method of ['GET', 'HEAD']) {
			const request = new Request(`https://letsrealtalk.com${path}`, { method });
			const asset = new Response(null, {
				status: 404,
				headers: { 'Content-Type': 'text/plain' }
			});
			const response = await routeDashboardRequest(request, {
				ASSETS: {
					fetch: (received) => {
						assert.equal(new URL(received.url).pathname, new URL(request.url).pathname.slice('/dashboard'.length));
						assert.equal(new URL(received.url).search, new URL(request.url).search);
						assert.equal(received.method, request.method);
						return asset;
					}
				},
				API: { fetch: () => assert.fail('Assets must not reach the API') }
			});
			assert.equal(response, asset);
		}
	}
});

test('preserves shell routes, legacy asset handling and unrelated path rejection', async () => {
	for (const path of [
		'/dashboard',
		'/dashboard/',
		'/dashboard/invoices/new',
		'/dashboard/_application'
	]) {
		const { env, assetPaths } = createEnv();
		assert.equal(
			(await routeDashboardRequest(new Request(`https://example.com${path}`), env)).status,
			200
		);
		assert.deepEqual(assetPaths, ['/200']);
	}
	for (const path of ['/_app/immutable/entry/start.js', '/favicon.ico']) {
		const { env, assetPaths } = createEnv();
		await routeDashboardRequest(new Request(`https://example.com${path}`), env);
		assert.deepEqual(assetPaths, [path]);
	}
	for (const path of ['/', '/app', '/pay', '/corex', '/dashboard-other']) {
		const { env, assetPaths, apiPaths } = createEnv();
		assert.equal(
			(await routeDashboardRequest(new Request(`https://example.com${path}`), env)).status,
			404
		);
		assert.deepEqual(assetPaths, []);
		assert.deepEqual(apiPaths, []);
	}
});

test('preserves API method, query, body and authorization without touching assets', async () => {
	const request = new Request('https://letsrealtalk.com/dashboard/api/v1/orders?limit=2', {
		method: 'POST',
		headers: { Authorization: 'Bearer local-test' },
		body: '{"test":true}'
	});
	const response = await routeDashboardRequest(request, {
		ASSETS: { fetch: () => assert.fail('API must not reach assets') },
		API: {
			async fetch(proxied) {
				assert.equal(proxied.url, 'https://letsrealtalk.com/api/v1/orders?limit=2');
				assert.equal(proxied.method, 'POST');
				assert.equal(proxied.headers.get('Authorization'), 'Bearer local-test');
				assert.equal(await proxied.text(), '{"test":true}');
				return Response.json({ ok: true });
			}
		}
	});
	assert.equal(response.status, 200);
});

test('shell keeps root route base but scopes every bootstrap asset to Dashboard', async () => {
	const response = await routeDashboardRequest(new Request('https://letsrealtalk.com/dashboard/'), {
		ASSETS: { fetch: async () => new Response('<link href="/_app/style.css"><script>base: ""; import("/_app/start.js")</script>') }
	});
	const html = await response.text();
	assert.ok(html.includes('href="/dashboard/_app/style.css"'));
	assert.ok(html.includes('import("/dashboard/_app/start.js")'));
	assert.ok(html.includes('base: ""'));
	assert.equal(response.headers.get('Cache-Control'), 'no-store');
});

test('canonicalizes only test Dashboard GET and HEAD without touching bindings', async () => {
	for (const method of ['GET', 'HEAD']) {
		const response = await routeDashboardRequest(
			new Request('https://letsrealtalk.com/dashboard?source=landing&next=%2Fdashboard%2Fstructure', { method }),
			{ ASSETS: { fetch: () => assert.fail('Redirect must not fetch assets') },
				API: { fetch: () => assert.fail('Redirect must not reach API') } }
		);
		assert.equal(response.status, 307);
		assert.equal(response.headers.get('Location'),
			'https://letsrealtalk.com/dashboard/?source=landing&next=%2Fdashboard%2Fstructure');
		assert.equal(response.headers.get('Cache-Control'), 'no-store');
		assert.equal(await response.text(), '');
	}
	for (const [url, method] of [
		['https://letsrealtalk.com/dashboard/', 'GET'],
		['https://letsrealtalk.com/dashboard', 'POST'],
		['https://rakhunok.com/dashboard', 'GET'],
		['https://letsrealtalk.com/dashboard/structure', 'GET']
	]) {
		const { env, assetPaths } = createEnv();
		const response = await routeDashboardRequest(new Request(url, { method }), env);
		assert.equal(response.status, 200);
		assert.equal(response.headers.has('Location'), false);
		assert.deepEqual(assetPaths, ['/200']);
	}
});

test('isolates test onboarding and never falls back after dispatch or missing binding', async () => {
	const request = () => new Request('https://letsrealtalk.com/dashboard/api/v1/merchant/onboarding?source=dashboard', {
		method: 'POST', headers: { Authorization: 'Bearer caller' }, body: '{"input":true}'
	});
	const env = {
		ASSETS: { fetch: () => assert.fail('No asset access') },
		API: { fetch: () => assert.fail('No ordinary API fallback') }
	};
	assert.equal((await routeDashboardRequest(request(), env)).status, 503);
	assert.equal((await routeDashboardRequest(request(), {
		...env, ONBOARDING: { fetch: () => { throw new Error('unavailable'); } }
	})).status, 503);
	const response = await routeDashboardRequest(request(), {
		...env, ONBOARDING: { async fetch(proxied) {
			assert.equal(proxied.url, 'https://letsrealtalk.com/api/v1/merchant/onboarding?source=dashboard');
			assert.equal(proxied.headers.get('Authorization'), 'Bearer caller');
			assert.equal(proxied.method, 'POST');
			assert.equal(await proxied.text(), '{"input":true}');
			return Response.json({ created: false });
		} }
	});
	assert.equal(response.status, 200);
	for (const method of ['GET', 'PUT', 'OPTIONS']) {
		assert.equal((await routeDashboardRequest(new Request(request().url, { method }), env)).status, 405);
	}
	for (const url of [
		'https://example.com/dashboard/api/v1/merchant/onboarding',
		'https://letsrealtalk.com/dashboard/api/v1/merchant/onboarding/other',
		'https://letsrealtalk.com/dashboard/api/merchant/onboarding'
	]) {
		const { env: ordinary, apiPaths } = createEnv();
		await routeDashboardRequest(new Request(url, { method: 'POST' }), ordinary);
		assert.equal(apiPaths.length, 1);
	}
});

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
