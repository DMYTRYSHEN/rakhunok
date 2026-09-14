import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { routeTelegramRequest } from './telegram.ts';
import { routeDashboardRequest } from './dashboard.ts';

const path = '/api/v1/telegram/invoices/';
const config = JSON.parse(readFileSync(new URL('../wrangler.telegram.jsonc', import.meta.url), 'utf8'));

test('Telegram deployment is private, test-only and has no privileged bindings', () => {
	assert.equal(config.name, 'letsrealtalk-telegram');
	assert.equal(config.main, 'src/telegram.ts');
	assert.equal(config.workers_dev, false);
	assert.equal(config.preview_urls, false);
	assert.deepEqual(config.routes, []);
	for (const key of ['route', 'env', 'services', 'kv_namespaces', 'triggers', 'workflows', 'assets'])
		assert.equal(config[key], undefined);
	assert.equal(config.vars.TELEGRAM_INVOICE_PUBLIC_ORIGIN, 'https://letsrealtalk.com');
	assert.deepEqual(config.secrets.required, [
		'SUPABASE_URL', 'SUPABASE_ANON_KEY', 'TELEGRAM_BOT_TOKEN',
		'TELEGRAM_INVOICE_TEST_USER_ID', 'TELEGRAM_INVOICE_TEST_CHAT_ID'
	]);
});

test('private entrypoint rejects other hosts and paths before IO', async () => {
	for (const url of ['https://rakhunok.com' + path + 'preview',
		'https://letsrealtalk.com/api/v1/telegram/notify', 'https://letsrealtalk.com' + path + 'send/']) {
		const response = await routeTelegramRequest(new Request(url, { method: 'POST' }), {});
		assert.equal(response.status, 404);
	}
});

test('private entrypoint rejects production origin configuration and missing settings', async () => {
	for (const suffix of ['preview', 'send']) {
		for (const origin of ['https://rakhunok.com', 'https://letsrealtalk.com']) {
			const response = await routeTelegramRequest(new Request('https://letsrealtalk.com' + path + suffix,
				{ method: 'POST' }), { TELEGRAM_INVOICE_PUBLIC_ORIGIN: origin });
			assert.equal(response.status, 503);
			assert.equal((await response.json()).error, 'self_test_unavailable');
		}
	}
});

for (const suffix of ['preview', 'send']) {
	test(`Dashboard forwards ${suffix} exactly once to private service`, async () => {
		let calls = 0;
		const response = Response.json({ ok: false, error: 'forbidden' }, { status: 403 });
		const result = await routeDashboardRequest(new Request('https://letsrealtalk.com/dashboard' + path + suffix + '?bad=1', {
			method: 'POST', headers: { Authorization: 'Bearer test.jwt' }, body: '{"order_id":"test"}'
		}), {
			ASSETS: { fetch: () => assert.fail('No assets') }, API: { fetch: () => assert.fail('No shared API') },
			TELEGRAM: { async fetch(request) {
				calls++;
				assert.equal(request.url, 'https://letsrealtalk.com' + path + suffix + '?bad=1');
				assert.equal(request.method, 'POST');
				assert.equal(request.headers.get('Authorization'), 'Bearer test.jwt');
				assert.equal(await request.text(), '{"order_id":"test"}');
				return response;
			} }
		});
		assert.equal(result, response);
		assert.equal(calls, 1);
	});

	test(`Dashboard ${suffix} fails closed without binding and never retries dispatch errors`, async () => {
		for (const binding of [undefined, { fetch: () => { throw new Error('private detail'); } }]) {
			const response = await routeDashboardRequest(new Request('https://letsrealtalk.com/dashboard' + path + suffix,
				{ method: 'POST' }), {
				ASSETS: { fetch: () => assert.fail('No assets') }, API: { fetch: () => assert.fail('No fallback') },
				TELEGRAM: binding
			});
			assert.equal(response.status, 503);
			assert.equal(response.headers.get('Cache-Control'), 'no-store');
			assert.deepEqual(await response.json(), { ok: false, error: !binding ? 'self_test_unavailable'
				: suffix === 'send' ? 'delivery_unknown' : 'verification_unavailable' });
		}
	});
}

test('production and unrelated Dashboard APIs retain their existing shared route', async () => {
	for (const url of ['https://rakhunok.com/dashboard' + path + 'preview',
		'https://rakhunok.com/dashboard' + path + 'send',
		'https://letsrealtalk.com/dashboard/api/v1/orders',
		'https://letsrealtalk.com/dashboard/api/v1/telegram/notify']) {
		let calls = 0;
		await routeDashboardRequest(new Request(url), {
			ASSETS: { fetch: () => assert.fail('No assets') },
			TELEGRAM: { fetch: () => assert.fail('No Telegram interception') },
			API: { fetch: () => { calls++; return Response.json({ ok: true }); } }
		});
		assert.equal(calls, 1);
	}
});