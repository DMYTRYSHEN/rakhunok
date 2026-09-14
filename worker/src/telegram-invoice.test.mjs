import assert from 'node:assert/strict';
import test, { beforeEach, afterEach } from 'node:test';
import { PNG } from 'pngjs';
import jsQR from 'jsqr';
import { handleTelegramInvoice, handleTelegramInvoicePreview, renderInvoicePng } from './telegram-invoice.ts';
import { invoiceCard, CARD_EXPIRY_NOTE } from './telegram-invoice-metadata.ts';
import { formatInvoiceDate } from './telegram-invoice-renderer.ts';
import { routeWebRequest } from './index.ts';

const user = '11111111-1111-4111-8111-111111111111';
const orderId = '22222222-2222-4222-8222-222222222222';
const merchantId = '33333333-3333-4333-8333-333333333333';
const other = '44444444-4444-4444-8444-444444444444';
const bearer = 'Bearer private.jwt.test';
const env = {
	SUPABASE_URL: 'https://database.example', SUPABASE_ANON_KEY: 'private-anon-key',
	TELEGRAM_BOT_TOKEN: '123456:private_bot_token_abcdefghijklmnop',
	TELEGRAM_INVOICE_SELF_TEST_ENABLED: 'true', TELEGRAM_INVOICE_TEST_CHAT_ID: '1234567',
	TELEGRAM_INVOICE_TEST_USER_ID: user, TELEGRAM_INVOICE_PUBLIC_ORIGIN: 'https://letsrealtalk.com',
	ASSETS: { fetch() { throw new Error('Unexpected assets'); } }
};
let calls, responses, originalFetch;
const now = Date.parse('2026-09-14T12:00:00Z');
const merchant = () => ({ id: merchantId, user_id: user, business_name: 'Майстерня Київ', is_active: true });
const order = () => ({ id: orderId, merchant_id: merchantId, type: 'fixed', status: 'pending',
	order_number: 'INV-2026-42', created_at: '2026-09-14T08:15:00+00:00', short_id: null, entity_id: null,
	title: 'Консультація та підготовка проєкту', description: 'Додаткові деталі',
	currency: 'UAH', base_amount: '123.45', delivery_fee: '10.00', discount_amount: '5.00',
	total_amount: '128.45', paid_amount: null, is_split_payment: false, expires_at: null });
const success = () => ({ ok: true, result: { message_id: 42, chat: { id: 1234567 } } });
beforeEach((t) => {
	t.mock.method(Date, 'now', () => now);
	calls = [];
	responses = [{ id: user }, [order()], [merchant()], success()];
	originalFetch = globalThis.fetch;
	globalThis.fetch = async (url, init) => {
		calls.push({ url: String(url), init });
		assert.ok(responses.length, 'Unexpected fetch (including automatic retries)');
		const next = responses.shift();
		return typeof next === 'function' ? next(url, init) : Response.json(next);
	};
});
afterEach(() => { globalThis.fetch = originalFetch; });
function request(body = { order_id: orderId }, auth = bearer, path = '/api/v1/telegram/invoices/send') {
	return new Request(`https://untrusted.example${path}`, { method: 'POST',
		headers: { 'Content-Type': 'application/json', ...(auth === null ? {} : { Authorization: auth }),
			Cookie: 'private-cookie', 'X-Telegram-Id': '999999', Origin: 'https://evil.example' },
		body: typeof body === 'string' ? body : JSON.stringify(body) });
}
async function fail(response, status, code) {
	assert.equal(response.status, status);
	assert.equal(response.headers.get('Cache-Control'), 'no-store');
	const text = await response.text();
	for (const secret of [bearer, env.SUPABASE_ANON_KEY, env.TELEGRAM_BOT_TOKEN, 'private-cookie', 'SECRET'])
		assert.ok(!text.includes(secret));
	const data = JSON.parse(text);
	assert.equal(data.ok, false); assert.equal(data.error, code); assert.ok(data.message);
	return data;
}

for (const key of Object.keys(env).filter((key) => key !== 'ASSETS')) {
	test(`missing configuration ${key} fails before IO`, async () => {
		await fail(await handleTelegramInvoice(request(), { ...env, [key]: undefined }), 503, 'self_test_unavailable');
		assert.equal(calls.length, 0);
	});
}
for (const [key, values] of Object.entries({
	TELEGRAM_INVOICE_SELF_TEST_ENABLED: ['TRUE', '1', 'false'],
	TELEGRAM_INVOICE_TEST_CHAT_ID: ['0', '-123', '1.1', '9007199254740992', '1e3', ' 123', '@name'],
	TELEGRAM_INVOICE_TEST_USER_ID: ['not-uuid', ''],
	TELEGRAM_INVOICE_PUBLIC_ORIGIN: ['https://evil.example', 'https://letsrealtalk.com/', 'http://letsrealtalk.com', 'https://letsrealtalk.com.evil.example', 'https://rakhunok.com:443'],
	SUPABASE_URL: ['http://database.example', 'https://user:secret@database.example', 'https://database.example/path', 'https://database.example?x=1'],
	SUPABASE_ANON_KEY: ['bad\nkey'], TELEGRAM_BOT_TOKEN: ['bad', '123:bad/token']
})) for (const value of values) {
	test(`invalid configuration ${key}=${value} fails closed`, async () => {
		await fail(await handleTelegramInvoice(request(), { ...env, [key]: value }), 503, 'self_test_unavailable');
		assert.equal(calls.length, 0);
	});
}
for (const auth of [null, 'Basic abc', 'Bearer', 'Bearer a b']) {
	test(`requires bearer: ${auth}`, async () => {
		await fail(await handleTelegramInvoice(request(), { ...env, TELEGRAM_INVOICE_SELF_TEST_ENABLED: undefined }), 503, 'self_test_unavailable');
		await fail(await handleTelegramInvoice(request({ order_id: orderId }, auth), env), 401, 'unauthorized');
		assert.equal(calls.length, 0);
	});
}
for (const key of ['telegram_id', 'chat_id', 'url', 'amount', 'photo', 'merchant_id', 'user_id', 'delivery_fee', 'discount_amount', 'title', 'description', 'display_name', 'merchant_name', 'caption']) {
	test(`rejects browser field ${key} before IO`, async () => {
		await fail(await handleTelegramInvoice(request({ order_id: orderId, [key]: 'arbitrary' }), env), 400, 'invalid_request');
		assert.equal(calls.length, 0);
	});
}
for (const body of ['{', '{}', 'null', '[]', '{"order_id":42}', JSON.stringify({ order_id: '../evil' }), ' '.repeat(1025)]) {
	test(`rejects invalid body ${body.slice(0, 40)}`, async () => {
		await fail(await handleTelegramInvoice(request(body), env), 400, 'invalid_request'); assert.equal(calls.length, 0);
	});
}
test('rejects recipient/query overrides', async () => {
	await fail(await handleTelegramInvoice(request(undefined, bearer, '/api/v1/telegram/invoices/send?chat_id=9'), env), 400, 'invalid_request');
	assert.equal(calls.length, 0);
});
test('route dispatches only POST; method errors do not perform IO', async () => {
	const res = await routeWebRequest(new Request('https://example.com/api/v1/telegram/invoices/send'), env);
	assert.equal(res.status, 405); assert.equal(res.headers.get('Allow'), 'POST'); assert.equal(calls.length, 0);
});
for (const status of [401, 403]) test(`bad JWT auth HTTP ${status} stops at auth`, async () => {
	responses[0] = () => new Response('SECRET', { status });
	await fail(await handleTelegramInvoice(request(), env), 403, 'forbidden'); assert.equal(calls.length, 1);
});
test('verified user must match operator user', async () => {
	responses[0] = { id: other };
	await fail(await handleTelegramInvoice(request(), env), 403, 'forbidden'); assert.equal(calls.length, 1);
});
for (const payload of [null, {}, { id: 'bad' }, [{ id: user }]]) test(`malformed auth ${JSON.stringify(payload)}`, async () => {
	responses[0] = payload;
	await fail(await handleTelegramInvoice(request(), env), 503, 'verification_unavailable'); assert.equal(calls.length, 1);
});
for (const payload of [[], [{ id: merchantId, user_id: other }], [{ id: other, user_id: user }]]) {
	test(`canonical owner mismatch ${JSON.stringify(payload)}`, async () => {
		responses[2] = payload;
		await fail(await handleTelegramInvoice(request(), env), 403, 'forbidden'); assert.equal(calls.length, 3);
	});
}
for (const index of [1, 2]) for (const payload of [null, {}, [null], [{}], [{}, {}]]) {
	test(`malformed database step ${index}: ${JSON.stringify(payload)}`, async () => {
		responses[index] = payload;
		await fail(await handleTelegramInvoice(request(), env), 503, 'verification_unavailable'); assert.equal(calls.length, index + 1);
	});
}
test('missing persisted order is 404, no creation or fallback', async () => {
	responses[1] = []; await fail(await handleTelegramInvoice(request(), env), 404, 'order_not_found'); assert.equal(calls.length, 2);
});
test('wrong returned order ID fails closed', async () => {
	responses[1] = [{ ...order(), id: other }];
	await fail(await handleTelegramInvoice(request(), env), 503, 'verification_unavailable'); assert.equal(calls.length, 2);
});
for (const [key, values] of Object.entries({
	type: ['table', 'donation', null], status: ['paid', 'draft', 'preparing', 'cancelled', 'expired'],
	currency: ['USD', null], is_split_payment: [true, null, undefined], paid_amount: ['0.01', undefined],
	base_amount: ['123.451', '-1', null, '999', '1e2', '90071992547410.00', 1000000000.01],
	delivery_fee: ['11', null, '-1'], discount_amount: ['6', null, '-1', '999'],
	total_amount: ['0', '-1', '128.451', '128.46', null, true, ' 128.45'],
	expires_at: ['2000-01-01T00:00:00Z', 'invalid', undefined]
})) for (const value of values) {
	test(`fixed pending consistency ${key}=${value}`, async () => {
		responses[1] = [{ ...order(), [key]: value }];
		await fail(await handleTelegramInvoice(request(), env), 409, 'invoice_not_deliverable'); assert.equal(calls.length, 3);
	});
}
for (const step of [0, 1, 2]) for (const status of [302, 500]) {
	test(`upstream ${step} HTTP ${status} sanitized`, async () => {
		responses[step] = () => new Response('SECRET', { status, headers: { Location: 'https://evil.example' } });
		await fail(await handleTelegramInvoice(request(), env), 503, 'verification_unavailable'); assert.equal(calls.length, step + 1);
	});
}
for (const step of [1, 2]) for (const status of [401, 403]) test(`database ${step} access ${status}`, async () => {
	responses[step] = () => new Response('SECRET', { status });
	await fail(await handleTelegramInvoice(request(), env), 403, 'forbidden'); assert.equal(calls.length, step + 1);
});
test('malformed upstream JSON fails closed', async () => {
	responses[1] = () => new Response('{');
	await fail(await handleTelegramInvoice(request(), env), 503, 'verification_unavailable');
});
test('oversized upstream body fails closed', async () => {
	responses[0] = () => new Response(JSON.stringify({ id: user, extra: 'x'.repeat(32768) }));
	await fail(await handleTelegramInvoice(request(), env), 503, 'verification_unavailable');
});
test('success route uses caller JWT, exact owner filters, configured recipient and actual PNG', async () => {
	const res = await routeWebRequest(request(), env);
	assert.equal(res.status, 200);
	assert.deepEqual(await res.json(), { ok: true, delivery: 'sent', self_test: true, order_id: orderId, message_id: 42 });
	assert.equal(calls.length, 4);
	assert.equal(calls[0].url, 'https://database.example/auth/v1/user');
	for (const call of calls) { assert.equal(call.init.redirect, 'manual'); assert.ok(call.init.signal instanceof AbortSignal); }
	for (const call of calls.slice(0, 3)) {
		assert.equal(call.init.method ?? 'GET', 'GET');
		assert.deepEqual(call.init.headers, { apikey: env.SUPABASE_ANON_KEY, Authorization: bearer, 'Cache-Control': 'no-store' });
	}
	const orders = new URL(calls[1].url), merchants = new URL(calls[2].url);
	assert.equal(orders.pathname, '/rest/v1/orders'); assert.equal(orders.searchParams.get('id'), `eq.${orderId}`);
	assert.equal(orders.searchParams.get('select'), 'id,merchant_id,order_number,created_at,short_id,entity_id,title,description,type,status,currency,base_amount,delivery_fee,discount_amount,total_amount,paid_amount,is_split_payment,expires_at');
	assert.equal(merchants.searchParams.get('select'), 'id,user_id,business_name,is_active');
	assert.equal(merchants.searchParams.get('id'), `eq.${merchantId}`); assert.equal(merchants.searchParams.get('user_id'), `eq.${user}`);
	const send = calls[3]; assert.equal(send.url, `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendPhoto`);
	assert.equal(send.init.method, 'POST'); assert.equal(send.init.headers, undefined);
	const form = send.init.body;
	assert.equal(form.get('chat_id'), '1234567'); assert.equal(form.get('parse_mode'), 'HTML');
	assert.equal(form.get('caption'), `<b>RAHUNOK · SELF TEST</b>\n<b>Консультація та підготовка проєкту</b>\nОтримувач: Майстерня Київ\nРахунок INV-2026-42 на <b>128.45 UAH</b>\nДіє до 17.09.2026 ${CARD_EXPIRY_NOTE}\nВідкрийте рахунок, щоб перевірити актуальний стан перед оплатою.`);
	assert.deepEqual(JSON.parse(form.get('reply_markup')), { inline_keyboard: [[{ text: 'Відкрити рахунок', url: `https://letsrealtalk.com/o/${orderId}` }]] });
	const photo = form.get('photo'); assert.equal(photo.type, 'image/png');
	assert.deepEqual([...new Uint8Array(await photo.arrayBuffer()).slice(0, 8)], [137,80,78,71,13,10,26,10]);
});
test('production origin is accepted only when explicitly configured', async () => {
	assert.equal((await handleTelegramInvoice(request(), { ...env, TELEGRAM_INVOICE_PUBLIC_ORIGIN: 'https://rakhunok.com' })).status, 200);
	assert.ok(calls[3].init.body.get('reply_markup').includes(`https://rakhunok.com/o/${orderId}`));
});
test('precise numeric cents are accepted without floating point multiplication', async () => {
	responses[1] = [{ ...order(), base_amount: 0.29, delivery_fee: 0, discount_amount: 0, total_amount: 0.29 }];
	assert.equal((await handleTelegramInvoice(request(), env)).status, 200);
	assert.ok(calls[3].init.body.get('caption').includes('0.29 UAH'));
});

test('caption escapes canonical HTML and does not promote stored text into Telegram markup', async () => {
	responses[1][0].title = '<a href="https://evil.example">Послуга & \'тест\'</a>';
	responses[2][0].business_name = '<b>Київ & "Ко"</b>';
	assert.equal((await handleTelegramInvoice(request(), env)).status, 200);
	const caption = calls[3].init.body.get('caption');
	assert.ok(caption.includes('<b>&lt;a href=&quot;https://evil.example&quot;&gt;Послуга &amp; &#39;тест&#39;&lt;/a&gt;</b>'));
	assert.ok(caption.includes('Отримувач: &lt;b&gt;Київ &amp; &quot;Ко&quot;&lt;/b&gt;'));
	assert.ok(!caption.includes('<a '));
	assert.equal(calls.length, 4);
});

test('caption collapses control/newline text and removes bidi and invisible format controls', async () => {
	responses[1][0].title = '  Оплата\u0000\tза\r\nпослуги\u0085\u2028Київ\u2029!\u202e\u2066\u200b\ufeff  ';
	responses[2][0].business_name = '\u200eМайстерня\u200f\n\tКиїв\u007f';
	assert.equal((await handleTelegramInvoice(request(), env)).status, 200);
	const caption = calls[3].init.body.get('caption');
	assert.equal(caption.split('\n')[1], '<b>Оплата за послуги Київ !</b>');
	assert.equal(caption.split('\n')[2], 'Отримувач: Майстерня Київ');
	assert.equal(caption.split('\n').length, 6);
});

for (const absent of [undefined, null, '', ' \t\u200b\u202e\n']) {
	test(`legacy absent optional labels have sensible fallback: ${JSON.stringify(absent)}`, async () => {
		responses[1][0].description = absent;
		responses[2][0].display_name = absent;
		assert.equal((await handleTelegramInvoice(request(), env)).status, 200);
		assert.ok(calls[3].init.body.get('caption').includes(`<b>${order().title}</b>\nОтримувач: Майстерня Київ`));
	});
}

test('missing title falls back to escaped server description, then a generic invoice label', async () => {
	delete responses[1][0].title;
	responses[1][0].description = 'Підготовка <проєкту>';
	assert.equal((await handleTelegramInvoice(request(), env)).status, 200);
	assert.ok(calls[3].init.body.get('caption').includes('<b>Підготовка &lt;проєкту&gt;</b>'));
	responses.push({ id: user }, [{ ...order(), title: null, description: null }], [merchant()], success());
	assert.equal((await handleTelegramInvoice(request(), env)).status, 200);
	assert.ok(calls[7].init.body.get('caption').includes('<b>Оплата замовлення</b>\nОтримувач: Майстерня Київ'));
});

for (const field of ['title', 'description', 'business_name']) for (const value of [42, false, [], {}]) {
	test(`malformed canonical ${field} type fails closed: ${JSON.stringify(value)}`, async () => {
		responses[field === 'business_name' ? 2 : 1][0][field] = value;
		await fail(await handleTelegramInvoice(request(), env), 503, 'verification_unavailable');
		assert.equal(calls.length, 3);
	});
}

for (const glyph of ['😀', '👩🏽‍💻', '🇺🇦', 'е\u0301']) {
	test(`caption truncates whole Unicode graphemes: ${glyph}`, async () => {
		responses[1][0].title = glyph.repeat(240);
		responses[2][0].business_name = glyph.repeat(140);
		assert.equal((await handleTelegramInvoice(request(), env)).status, 200);
		const caption = calls[3].init.body.get('caption');
		const normalized = glyph.normalize('NFC');
		assert.equal(caption.split('\n')[1], `<b>${normalized.repeat(Math.floor(199 / normalized.length))}…</b>`);
		assert.equal(caption.split('\n')[2], `Отримувач: ${normalized.repeat(Math.floor(99 / normalized.length))}…`);
		assert.ok(caption.length < 1024);
	});
}

test('caption bounds labels before HTML entity expansion, without broken entities', async () => {
	responses[1][0].title = '&'.repeat(201);
	responses[2][0].business_name = '"'.repeat(101);
	assert.equal((await handleTelegramInvoice(request(), env)).status, 200);
	const caption = calls[3].init.body.get('caption');
	assert.equal(caption.split('\n')[1], `<b>${'&amp;'.repeat(199)}…</b>`);
	assert.equal(caption.split('\n')[2], `Отримувач: ${'&quot;'.repeat(99)}…`);
	const parsed = caption.replace(/<\/?b>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"');
	assert.ok(parsed.length < 1024, 'Telegram limit applies after entity parsing');
});

test('exact label limits remain untruncated', async () => {
	responses[1][0].title = 'Ї'.repeat(200);
	responses[2][0].business_name = 'Я'.repeat(100);
	assert.equal((await handleTelegramInvoice(request(), env)).status, 200);
	const caption = calls[3].init.body.get('caption');
	assert.ok(caption.includes(`<b>${'Ї'.repeat(200)}</b>`));
	assert.ok(caption.includes(`Отримувач: ${'Я'.repeat(100)}\n`));
	assert.ok(!caption.includes('…'));
});

for (const [base, delivery, discount, total] of [
	['123.45', '0', '0', '123.45'], ['123.45', '10', '0', '133.45'],
	['123.45', '0', '5', '118.45'], ['123.45', '10', '123.45', '10.00']
]) test(`fixed invoice supports canonical delivery/discount ${delivery}/${discount}`, async () => {
	responses[1] = [{ ...order(), base_amount: base, delivery_fee: delivery, discount_amount: discount, total_amount: total }];
	assert.equal((await handleTelegramInvoice(request(), env)).status, 200);
	assert.ok(calls[3].init.body.get('caption').includes(`<b>${total} UAH</b>`));
	const actual = Buffer.from(await calls[3].init.body.get('photo').arrayBuffer());
	const expected = Buffer.from(await (await renderInvoicePng({ ...invoiceCard(order(), merchant().business_name, 12845n, env.TELEGRAM_INVOICE_PUBLIC_ORIGIN, now), amount: total })).arrayBuffer());
	assert.deepEqual(actual, expected, 'PNG and caption use the same validated total');
});
test('Telegram HTTP 200 ok:false is not success', async () => {
	responses[3] = { ok: false, description: 'SECRET', error_code: 400 };
	await fail(await handleTelegramInvoice(request(), env), 502, 'telegram_rejected'); assert.equal(calls.length, 4);
});
test('Telegram HTTP 429 is not retried or reflected', async () => {
	responses[3] = () => new Response('SECRET', { status: 429, headers: { 'Retry-After': '123' } });
	await fail(await handleTelegramInvoice(request(), env), 429, 'telegram_rate_limited'); assert.equal(calls.length, 4);
});
for (const payload of [null, {}, { ok: true }, { ok: 'true', result: success().result },
	{ ok: true, result: { message_id: 0, chat: { id: 1234567 } } },
	{ ok: true, result: { message_id: 1.5, chat: { id: 1234567 } } },
	{ ok: true, result: { message_id: 9007199254740992, chat: { id: 1234567 } } },
	{ ok: true, result: { message_id: 42, chat: { id: other } } },
	{ ok: true, result: { message_id: 42, chat: { id: '1234567' } } }]) {
	test(`ambiguous Telegram response ${JSON.stringify(payload)}`, async () => {
		responses[3] = payload;
		const data = await fail(await handleTelegramInvoice(request(), env), 503, 'delivery_unknown');
		assert.match(data.message, /duplicate/); assert.equal(calls.length, 4);
	});
}
for (const status of [302, 400, 403, 500]) test(`Telegram HTTP ${status} is conservatively unknown`, async () => {
	responses[3] = () => new Response('SECRET', { status });
	await fail(await handleTelegramInvoice(request(), env), 503, 'delivery_unknown'); assert.equal(calls.length, 4);
});
test('send exception sanitized and never logged or retried', async (t) => {
	for (const method of ['log', 'error', 'warn', 'info']) t.mock.method(console, method, () => { assert.fail('Must not log secrets'); });
	responses[3] = () => { throw new Error(`${bearer} ${env.TELEGRAM_BOT_TOKEN} SECRET`); };
	await fail(await handleTelegramInvoice(request(), env), 503, 'delivery_unknown'); assert.equal(calls.length, 4);
});
for (const bodyStall of [false, true]) test(`send timeout covers ${bodyStall ? 'body' : 'headers'}, never retries`, async (t) => {
	let entered;
	const waiting = new Promise((resolve) => { entered = resolve; });
	// Enable fake time before remote starts; PNG compression itself uses no JS timeout.
	responses[3] = () => { entered(); return bodyStall ? new Response(new ReadableStream({ start() {} })) : new Promise(() => {}); };
	t.mock.timers.enable({ apis: ['setTimeout'] });
	const pending = handleTelegramInvoice(request(), env);
	await waiting; t.mock.timers.tick(8001);
	await fail(await pending, 503, 'delivery_unknown'); assert.equal(calls.length, 4); assert.ok(calls[3].init.signal.aborted);
});
test('PNG handles maximum-width amounts and rejects arbitrary renderer text', async () => {
	const card = invoiceCard(order(), merchant().business_name, 12845n, env.TELEGRAM_INVOICE_PUBLIC_ORIGIN, now);
	const photo = await renderInvoicePng({ ...card, amount: '90071992547409.91' });
	assert.equal(photo.type, 'image/png'); assert.ok(photo.size < 180000);
	for (const invalid of ['<b>1</b>', '1', '1.001', '-1.00', '1.00 UAH', '1'.repeat(15) + '.00']) {
		await assert.rejects(renderInvoicePng({ ...card, amount: invalid }), /amount/);
	}
});

const previewRequest = (body, auth) => request(body, auth, '/api/v1/telegram/invoices/preview');
function assertReadonly(count = 3) {
	assert.equal(calls.length, count);
	for (const call of calls) {
		assert.equal(new URL(call.url).origin, env.SUPABASE_URL);
		assert.equal(call.init.method ?? 'GET', 'GET');
		assert.equal(call.init.body, undefined);
		assert.equal(call.init.headers.Authorization, bearer);
	}
}

test('preview route returns exact shared metadata, no render/Telegram/mutations', async (t) => {
	t.mock.method(globalThis, 'CompressionStream', () => { throw new Error('Preview must not render'); });
	const response = await routeWebRequest(previewRequest(), env);
	assert.equal(response.status, 200);
	assert.equal(response.headers.get('Cache-Control'), 'no-store');
	assert.deepEqual(await response.json(), {
		ok: true, self_test: true, order_id: orderId, display_expiry_note: CARD_EXPIRY_NOTE,
		card: { amount: '128.45', reference: 'INV-2026-42', recipient: 'Майстерня Київ',
			issuedAt: '2026-09-14T08:15:00.000Z', displayExpiresAt: '2026-09-17T12:00:00.000Z',
			checkoutUrl: `https://letsrealtalk.com/o/${orderId}` }
	});
	assertReadonly();
});

test('preview preserves method, config, bearer, body and verified-user gates', async () => {
	const method = await routeWebRequest(new Request('https://example.com/api/v1/telegram/invoices/preview'), env);
	assert.equal(method.status, 405); assert.equal(method.headers.get('Allow'), 'POST');
	await fail(await handleTelegramInvoicePreview(previewRequest(), { ...env, TELEGRAM_INVOICE_SELF_TEST_ENABLED: 'false' }), 503, 'self_test_unavailable');
	await fail(await handleTelegramInvoicePreview(previewRequest(undefined, null), env), 401, 'unauthorized');
	await fail(await handleTelegramInvoicePreview(previewRequest({ order_id: orderId, recipient: 'fake' }), env), 400, 'invalid_request');
	assert.equal(calls.length, 0);
	responses[0] = { id: other };
	await fail(await handleTelegramInvoicePreview(previewRequest(), env), 403, 'forbidden');
	assertReadonly(1);
});

for (const [expires_at, expected] of [
	[null, '2026-09-17T12:00:00.000Z'],
	['2026-09-15T10:00:00+00:00', '2026-09-15T10:00:00.000Z'],
	['2026-10-15T10:00:00Z', '2026-09-17T12:00:00.000Z'],
	['2026-09-17T12:00:00Z', '2026-09-17T12:00:00.000Z']
]) test(`display date capped from captured server now: ${expires_at}`, async (t) => {
	responses[1][0].expires_at = expires_at;
	responses[0] = () => {
		t.mock.method(Date, 'now', () => now + 24 * 3600000);
		return Response.json({ id: user });
	};
	const response = await handleTelegramInvoicePreview(previewRequest(), env);
	assert.equal(response.status, 200);
	const { card } = await response.json();
	assert.equal(card.displayExpiresAt, expected);
	assert.equal(formatInvoiceDate(card.displayExpiresAt), expected.slice(0, 10).split('-').reverse().join('.'));
	assertReadonly();
});

for (const [field, values] of Object.entries({
	created_at: [null, undefined, 1789388100000, 'invalid', '2026-02-30T12:00:00Z', '2026-09-14', '2026-09-14T25:00:00Z', '2026-09-15T12:00:00Z'],
	order_number: [null, undefined, 42, '', ' \u200b '], entity_id: [undefined, '', 42, 'bad']
})) for (const value of values) test(`canonical ${field} rejects ${JSON.stringify(value)}`, async () => {
	responses[1][0][field] = value;
	await fail(await handleTelegramInvoicePreview(previewRequest(), env), 503, 'verification_unavailable');
	assertReadonly();
});

for (const value of [42, '2026-02-30T12:00:00Z', '2026-09-14', '2026-09-14T12:00:00Z']) test(`invalid expiry fails closed: ${value}`, async () => {
	responses[1][0].expires_at = value;
	await fail(await handleTelegramInvoicePreview(previewRequest(), env), 409, 'invoice_not_deliverable');
	assertReadonly();
});

test('database timestamp microseconds normalize to renderer ISO', async () => {
	responses[1][0].created_at = '2026-09-14T08:15:00.123456+00:00';
	const response = await handleTelegramInvoicePreview(previewRequest(), env);
	assert.equal((await response.json()).card.issuedAt, '2026-09-14T08:15:00.123Z');
	assertReadonly();
});

for (const short_id of ['Ab3-9Q', 'a'.repeat(36), null, '', 'ab', 'a'.repeat(37), '../x', 'abc?x=1', 'abc/x', 'тест', 123, 'https://evil.example']) {
	test(`trusted alias or UUID fallback: ${short_id}`, async () => {
		responses[1][0].short_id = short_id;
		const response = await handleTelegramInvoicePreview(previewRequest(), env);
		assert.equal(response.status, 200);
		const { card } = await response.json();
		const valid = typeof short_id === 'string' && /^[A-Za-z0-9-]{3,36}$/.test(short_id);
		assert.equal(card.checkoutUrl, `https://letsrealtalk.com/o/${valid ? short_id : orderId}`);
		assertReadonly();
	});
}
test('missing projected short_id does not silently invent metadata', async () => {
	delete responses[1][0].short_id;
	await fail(await handleTelegramInvoicePreview(previewRequest(), env), 503, 'verification_unavailable');
	assertReadonly();
});

for (const value of [null, undefined, '', ' \u200b ', 42]) test(`merchant legal name required, never display-name fallback: ${value}`, async () => {
	responses[2][0].business_name = value;
	responses[2][0].display_name = 'NOT A LEGAL RECIPIENT';
	await fail(await handleTelegramInvoicePreview(previewRequest(), env), 503, 'verification_unavailable');
	assertReadonly();
});
for (const value of [false, null, undefined, 'true']) test(`inactive/malformed merchant is forbidden: ${value}`, async () => {
	responses[2][0].is_active = value;
	await fail(await handleTelegramInvoicePreview(previewRequest(), env), 403, 'forbidden');
	assertReadonly();
});

const entity = () => ({ id: other, user_id: user, business_name: 'Коваленко Марія', business_type: 'fop', is_active: true });
function withEntity(row = entity()) {
	responses[1][0].entity_id = other;
	responses.splice(3, 0, [row]);
}
for (const [name, type, expected] of [
	['Коваленко Марія', 'fop', 'ФОП Коваленко Марія'],
	['ФОП Коваленко Марія', 'fop', 'ФОП Коваленко Марія'],
	['фоп Коваленко Марія', 'fop', 'ФОП Коваленко Марія'],
	['«Компанія»', 'tov', 'ТОВ «Компанія»'],
	['ТОВ«Компанія»', 'tov', 'ТОВ«Компанія»'],
	['Спільнота', 'ngo', 'ГО Спільнота'],
	['ГО Спільнота', 'ngo', 'ГО Спільнота'],
	['Коваленко Марія', 'self_employed', 'Коваленко Марія']
]) test(`owned entity canonical type without duplicate prefix: ${name}`, async () => {
	withEntity({ ...entity(), business_name: name, business_type: type });
	const response = await handleTelegramInvoicePreview(previewRequest(), env);
	assert.equal(response.status, 200);
	assert.equal((await response.json()).card.recipient, expected);
	const url = new URL(calls[3].url);
	assert.equal(url.pathname, '/rest/v1/business_entities');
	assert.equal(url.searchParams.get('select'), 'id,user_id,business_name,business_type,is_active');
	assert.equal(url.searchParams.get('id'), `eq.${other}`);
	assert.equal(url.searchParams.get('user_id'), `eq.${user}`);
	assertReadonly(4);
});

for (const [patch, status] of [
	[{ user_id: merchantId }, 403], [{ id: merchantId }, 403], [{ is_active: false }, 403],
	[{ is_active: undefined }, 403], [{ business_name: null }, 503], [{ business_name: '' }, 503],
	[{ business_type: undefined }, 503], [{ business_type: 42 }, 503],
	[{ business_type: 'unknown' }, 503], [{ business_name: 'ТОВ Інша компанія' }, 503]
]) test(`explicit entity fails closed without merchant fallback: ${JSON.stringify(patch)}`, async () => {
	withEntity({ ...entity(), ...patch });
	await fail(await handleTelegramInvoicePreview(previewRequest(), env), status, status === 403 ? 'forbidden' : 'verification_unavailable');
	assertReadonly(4);
});
for (const [payload, status] of [[[], 403], [null, 503], [[entity(), entity()], 503]]) test(`missing/malformed entity: ${JSON.stringify(payload)}`, async () => {
	withEntity(); responses[3] = payload;
	await fail(await handleTelegramInvoicePreview(previewRequest(), env), status, status === 403 ? 'forbidden' : 'verification_unavailable');
	assertReadonly(4);
});
for (const status of [401, 403, 302, 500]) test(`entity upstream HTTP ${status} never falls back`, async () => {
	withEntity(); responses[3] = () => new Response('SECRET', { status });
	await fail(await handleTelegramInvoicePreview(previewRequest(), env), status === 401 || status === 403 ? 403 : 503,
		status === 401 || status === 403 ? 'forbidden' : 'verification_unavailable');
	assertReadonly(4);
});

test('entity send uses exact preview card; actual PNG QR and button resolve identical verified alias', async () => {
	withEntity(); responses[1][0].short_id = 'Ab3-9Q'; responses[1][0].order_number = '<INV & "42">';
	const preview = await handleTelegramInvoicePreview(previewRequest(), env);
	const { card } = await preview.json();
	responses = [{ id: user }, [{ ...order(), entity_id: other, short_id: 'Ab3-9Q', order_number: '<INV & "42">' }], [merchant()], [entity()], success()];
	assert.equal((await handleTelegramInvoice(request(), env)).status, 200);
	const form = calls.at(-1).init.body;
	assert.ok(form.get('caption').includes('Рахунок &lt;INV &amp; &quot;42&quot;&gt;'));
	assert.ok(form.get('caption').includes('Отримувач: ФОП Коваленко Марія'));
	const bytes = Buffer.from(await form.get('photo').arrayBuffer());
	assert.deepEqual(bytes, Buffer.from(await (await renderInvoicePng(card)).arrayBuffer()));
	const image = PNG.sync.read(bytes, { checkCRC: true });
	assert.equal(image.width, 1000); assert.equal(image.height, 600);
	assert.equal(jsQR(new Uint8ClampedArray(image.data), image.width, image.height)?.data, card.checkoutUrl);
	assert.equal(JSON.parse(form.get('reply_markup')).inline_keyboard[0][0].url, card.checkoutUrl);
	assert.equal(calls.filter((call) => (call.init.method ?? 'GET') !== 'GET').length, 1);
});