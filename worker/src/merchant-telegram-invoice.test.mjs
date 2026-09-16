import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { handleMerchantTelegramInvoice } from './merchant-telegram-invoice.ts';

const env = {
	SUPABASE_URL: 'https://project.supabase.co',
	SUPABASE_ANON_KEY: 'anon-key',
	TELEGRAM_BOT_TOKEN: '123456:private_bot_token_abcdefghijklmnop',
	TELEGRAM_INVOICE_PUBLIC_ORIGIN: 'https://letsrealtalk.com'
};
const orderId = '11111111-1111-4111-8111-111111111111';
const userId = '22222222-2222-4222-8222-222222222222';
const merchantId = '33333333-3333-4333-8333-333333333333';
const identityId = '44444444-4444-4444-8444-444444444444';
const originalFetch = globalThis.fetch;
const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

afterEach(() => { globalThis.fetch = originalFetch; });

function request(body = { order_id: orderId }) {
	return new Request('https://letsrealtalk.com/api/v1/merchant/telegram/invoices/send', {
		method: 'POST',
		headers: { Authorization: 'Bearer caller.jwt.token', 'Content-Type': 'application/json' },
		body: JSON.stringify(body)
	});
}

function response(data, status = 200) {
	return Response.json(data, { status });
}

function user(identities) {
	return { id: userId, identities };
}

function telegramIdentity(id = '987654321') {
	return { identity_id: identityId, user_id: userId, provider: 'custom:telegram', id };
}

function order(type = 'fixed') {
	return {
		id: orderId,
		merchant_id: merchantId,
		order_number: 'INV<&>42',
		created_at: '2026-09-16T08:00:00.000Z',
		short_id: 'short-42',
		entity_id: null,
		title: 'Кава <велика>',
		description: null,
		type,
		status: 'pending',
		currency: 'UAH',
		base_amount: 125.5,
		delivery_fee: 0,
		discount_amount: 0,
		total_amount: 125.5,
		paid_amount: 0,
		is_split_payment: false,
		expires_at: '2099-09-16T09:00:00.000Z'
	};
}

function merchant() {
	return { id: merchantId, user_id: userId, business_name: 'Кав’ярня & Друзі', is_active: true };
}

test('rejects browser-provided chat_id before authentication', async () => {
	let calls = 0;
	globalThis.fetch = async () => { calls += 1; throw new Error('must not fetch'); };
	const result = await handleMerchantTelegramInvoice(request({ order_id: orderId, chat_id: 123 }), env);
	assert.equal(result.status, 400);
	assert.equal(calls, 0);
});

test('rejects missing, malformed, or duplicate Telegram identity before reading the order', async (t) => {
	for (const [name, identities] of [
		['missing', []],
		['malformed', [telegramIdentity('not-a-chat')]],
		['conflicting ids', [{ ...telegramIdentity(), provider_id: '123456789' }]],
		['duplicate', [telegramIdentity(), { ...telegramIdentity(), identity_id: '55555555-5555-4555-8555-555555555555' }]]
	]) {
		await t.test(name, async () => {
			const urls = [];
			globalThis.fetch = async (url) => {
				urls.push(String(url));
				return response(user(identities));
			};
			const result = await handleMerchantTelegramInvoice(request(), env);
			assert.equal(result.status, 409);
			assert.equal(urls.length, 1);
			assert.match(urls[0], /\/auth\/v1\/user$/);
		});
	}
});

test('sends a fixed invoice image with escaped caption and canonical pay button', async () => {
	const calls = [];
	globalThis.fetch = async (url, init = {}) => {
		calls.push({ url: String(url), init });
		if (String(url).endsWith('/auth/v1/user')) return response(user([telegramIdentity()]));
		if (String(url).includes('/rest/v1/orders?')) return response([order()]);
		if (String(url).includes('/rest/v1/merchants?')) return response([merchant()]);
		if (String(url).includes('/sendPhoto')) return response({ ok: true, result: { message_id: 42, chat: { id: 987654321 } } });
		throw new Error(`unexpected ${url}`);
	};
	const result = await handleMerchantTelegramInvoice(request(), env);
	assert.equal(result.status, 200);
	assert.deepEqual(await result.json(), { ok: true, delivery: 'sent', order_id: orderId, message_id: 42 });
	assert.equal(calls.length, 4);
	const botCall = calls.at(-1);
	assert.match(botCall.url, /^https:\/\/api\.telegram\.org\/bot[^/]+\/sendPhoto$/);
	assert.equal(botCall.init.method, 'POST');
	assert.equal(botCall.init.body.get('chat_id'), '987654321');
	assert.equal(botCall.init.body.get('parse_mode'), 'HTML');
	assert.match(botCall.init.body.get('caption'), /Кава &lt;велика&gt;/);
	assert.doesNotMatch(botCall.init.body.get('caption'), /Кава <велика>/);
	assert.deepEqual(JSON.parse(botCall.init.body.get('reply_markup')), {
		inline_keyboard: [[{ text: 'Відкрити рахунок', url: `https://letsrealtalk.com/pay/${orderId}` }]]
	});
	const photo = botCall.init.body.get('photo');
	assert.equal(photo.type, 'image/png');
	assert.ok(photo.size > png.length);
});

test('supports TABLE invoices and does not retry an unknown bot delivery', async () => {
	let botCalls = 0;
	globalThis.fetch = async (url) => {
		if (String(url).endsWith('/auth/v1/user')) return response(user([telegramIdentity()]));
		if (String(url).includes('/rest/v1/orders?')) return response([order('table')]);
		if (String(url).includes('/rest/v1/merchants?')) return response([merchant()]);
		if (String(url).includes('/sendPhoto')) { botCalls += 1; throw new Error('connection reset'); }
		throw new Error(`unexpected ${url}`);
	};
	const result = await handleMerchantTelegramInvoice(request(), env);
	assert.equal(result.status, 503);
	assert.equal((await result.json()).error, 'delivery_unknown');
	assert.equal(botCalls, 1);
});

test('rejects zero-total and expired invoices before Telegram delivery', async (t) => {
	for (const [name, invalidOrder] of [
		['zero total', { ...order(), base_amount: 0, total_amount: 0 }],
		['expired', { ...order(), expires_at: '2020-09-16T09:00:00.000Z' }]
	]) {
		await t.test(name, async () => {
			let botCalls = 0;
			globalThis.fetch = async (url) => {
				if (String(url).endsWith('/auth/v1/user')) return response(user([telegramIdentity()]));
				if (String(url).includes('/rest/v1/orders?')) return response([invalidOrder]);
				if (String(url).includes('/rest/v1/merchants?')) return response([merchant()]);
				if (String(url).includes('/sendPhoto')) { botCalls += 1; }
				throw new Error(`unexpected ${url}`);
			};
			const result = await handleMerchantTelegramInvoice(request(), env);
			assert.equal(result.status, 409);
			assert.equal((await result.json()).error, 'invoice_not_deliverable');
			assert.equal(botCalls, 0);
		});
	}
});

test('rejects merchant and entity ownership failures before Telegram delivery', async (t) => {
	for (const [name, selectedOrder, merchants, entities] of [
		['merchant hidden by RLS', order(), [], null],
		['entity hidden by RLS', { ...order('table'), entity_id: '55555555-5555-4555-8555-555555555555' }, [merchant()], []]
	]) {
		await t.test(name, async () => {
			let botCalls = 0;
			globalThis.fetch = async (url) => {
				if (String(url).endsWith('/auth/v1/user')) return response(user([telegramIdentity()]));
				if (String(url).includes('/rest/v1/orders?')) return response([selectedOrder]);
				if (String(url).includes('/rest/v1/merchants?')) return response(merchants);
				if (String(url).includes('/rest/v1/business_entities?')) return response(entities);
				if (String(url).includes('/sendPhoto')) { botCalls += 1; }
				throw new Error(`unexpected ${url}`);
			};
			const result = await handleMerchantTelegramInvoice(request(), env);
			assert.equal(result.status, 403);
			assert.equal((await result.json()).error, 'forbidden');
			assert.equal(botCalls, 0);
		});
	}
});

test('reports Telegram rate limiting and explicit rejection without retrying', async (t) => {
	for (const [name, telegramResponse, status, error] of [
		['rate limited', null, 429, 'telegram_rate_limited'],
		['rejected', { ok: false, description: 'bot was blocked' }, 502, 'telegram_rejected']
	]) {
		await t.test(name, async () => {
			let botCalls = 0;
			globalThis.fetch = async (url) => {
				if (String(url).endsWith('/auth/v1/user')) return response(user([telegramIdentity()]));
				if (String(url).includes('/rest/v1/orders?')) return response([order()]);
				if (String(url).includes('/rest/v1/merchants?')) return response([merchant()]);
				if (String(url).includes('/sendPhoto')) {
					botCalls += 1;
					return response(telegramResponse, status === 429 ? 429 : 200);
				}
				throw new Error(`unexpected ${url}`);
			};
			const result = await handleMerchantTelegramInvoice(request(), env);
			assert.equal(result.status, status);
			assert.equal((await result.json()).error, error);
			assert.equal(botCalls, 1);
		});
	}
});
