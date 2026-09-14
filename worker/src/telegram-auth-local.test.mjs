import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import test from 'node:test';
import { verifyTelegramInitData, TelegramProofError } from './telegram-auth-verifier.ts';
import { handleLocalTelegramAuth } from './telegram-auth-local.ts';

const botId = '123456789';
const botToken = `${botId}:synthetic-test-only-not-a-real-token`;
const config = { botId, botToken };
const now = 1_800_000_000;
const env = { TELEGRAM_AUTH_LOCAL_ENABLED: 'true', TELEGRAM_AUTH_BOT_ID: botId, TELEGRAM_AUTH_BOT_TOKEN: botToken };
function signed(overrides = {}, token = botToken) {
	const values = { auth_date: String(now), user: JSON.stringify({ id: 4503599627370495, first_name: 'Тест', is_bot: false }), query_id: 'synthetic', ...overrides };
	const secret = createHmac('sha256', 'WebAppData').update(token).digest();
	const hash = createHmac('sha256', secret).update(Object.keys(values).sort().map((key) => `${key}=${values[key]}`).join('\n')).digest('hex');
	return new URLSearchParams({ ...values, hash }).toString();
}
const verify = (raw, settings = config, time = now) => verifyTelegramInitData(raw, settings, time);
test('independently signed proof supports Unicode, 52-bit ID and immutable identity only', async () => {
	const proof = await verify(signed());
	assert.deepEqual(proof, { provider: 'telegram-mini-app', telegramUserId: '4503599627370495', botId, authDate: now, expiresAt: now + 300 });
	assert.ok(Object.isFrozen(proof));
});
test('optional signature is included in HMAC and field ordering does not matter', async () => {
	await verify(signed({ signature: 'synthetic-ed25519-value' }).split('&').reverse().join('&'));
});
for (const [name, raw] of Object.entries({
	tampered: signed().replace('synthetic', 'modified'),
	wrongToken: signed({}, `${botId}:different-synthetic-token`),
	expired: signed({ auth_date: String(now - 300) }),
	future: signed({ auth_date: String(now + 31) }),
	duplicate: `${signed()}&user=%7B%22id%22%3A1%7D`,
	encodedDuplicate: `${signed()}&%75ser=x`,
	malformedEncoding: `${signed()}&extra=%ZZ`,
	invalidUtf8: `${signed()}&extra=%FF`,
	newline: signed({ extra: 'a\nb=c' }),
	empty: '', oversized: 'a'.repeat(8193),
	missingHash: signed().replace(/&hash=.*/, ''),
	malformedHash: signed().replace(/hash=.*/, 'hash=invalid'),
	missingUser: signed({ user: '' }),
	badJson: signed({ user: '{' }),
	arrayUser: signed({ user: '[]' }),
	stringId: signed({ user: '{"id":"123"}' }),
	zeroId: signed({ user: '{"id":0}' }),
	negativeId: signed({ user: '{"id":-1}' }),
	unsafeId: signed({ user: '{"id":9007199254740992}' }),
	bot: signed({ user: '{"id":123,"is_bot":true}' }),
	invalidDate: signed({ auth_date: '1e9' }),
	missingDate: signed({ auth_date: '' }),
	emptyPair: `${signed()}&`,
	tooManyFields: signed(Object.fromEntries(Array.from({ length: 33 }, (_, i) => [`field${i}`, 'x'])))
})) test(`rejects ${name}`, async () => { await assert.rejects(verify(raw), TelegramProofError); });
test('bot mismatch and invalid clock fail closed', async () => {
	await assert.rejects(verify(signed(), { ...config, botId: '999' }), TelegramProofError);
	await assert.rejects(verify(signed(), config, NaN), TelegramProofError);
});
test('freshness boundaries and transport plus encoding', async () => {
	await verify(signed({ auth_date: String(now - 299), extra: 'with space' }));
	await verify(signed({ auth_date: String(now + 30) }));
});
function request(body = signed({ auth_date: String(Math.floor(Date.now() / 1000)) }), overrides = {}) {
	return new Request(overrides.url ?? 'http://localhost:8789/app/api/auth/telegram', {
		method: 'POST', headers: { Origin: 'http://localhost:8789', 'Content-Type': 'text/plain', ...overrides.headers }, body, ...overrides.init
	});
}
for (const host of ['https://letsrealtalk.com', 'https://rakhunok.com', 'http://localhost.attacker.example']) {
	test(`never available at ${host}`, async () => {
		assert.equal((await handleLocalTelegramAuth(request('', { url: `${host}/app/api/auth/telegram` }), env)).status, 404);
	});
}
test('disabled or missing config never verifies or authenticates', async () => {
	assert.equal((await handleLocalTelegramAuth(request(), {})).status, 404);
	assert.equal((await handleLocalTelegramAuth(request(), { TELEGRAM_AUTH_LOCAL_ENABLED: 'true' })).status, 503);
});
test('valid proof deliberately issues no session, cookie, tokens or identity disclosure', async () => {
	const response = await handleLocalTelegramAuth(request(), env);
	assert.equal(response.status, 503);
	assert.deepEqual(await response.json(), { ok: false, error: 'session_bridge_not_configured' });
	assert.equal(response.headers.get('Set-Cookie'), null);
	assert.equal(response.headers.get('Cache-Control'), 'no-store');
	assert.equal(response.headers.get('Access-Control-Allow-Origin'), null);
});
test('invalid proof returns generic JSON401', async () => {
	const response = await handleLocalTelegramAuth(request('invalid'), env);
	assert.equal(response.status, 401);
	assert.deepEqual(await response.json(), { ok: false, error: 'invalid_telegram_proof' });
});
test('rejects cross origin, URL data, non-POST, wrong media and oversize bodies', async () => {
	assert.equal((await handleLocalTelegramAuth(request('', { headers: { Origin: 'https://attacker.example' } }), env)).status, 403);
	assert.equal((await handleLocalTelegramAuth(request('', { url: 'http://localhost:8789/app/api/auth/telegram?initData=x' }), env)).status, 404);
	assert.equal((await handleLocalTelegramAuth(request(undefined, { init: { method: 'GET', body: undefined } }), env)).status, 405);
	assert.equal((await handleLocalTelegramAuth(request('', { headers: { 'Content-Type': 'application/json' } }), env)).status, 415);
	assert.equal((await handleLocalTelegramAuth(request('x'.repeat(8193)), env)).status, 413);
});
test('verification is stateless, NOT replay protection', async () => {
	assert.deepEqual(await verify(signed()), await verify(signed()));
});

function streamRequest(stream) {
	return request(stream, { init: { duplex: 'half' } });
}
test('incomplete signed body must time out, never verify the buffered prefix', async () => {
	const stream = new ReadableStream({ start(controller) {
		controller.enqueue(new TextEncoder().encode(signed({ auth_date: String(Math.floor(Date.now() / 1000)) })));
	} });
	assert.equal((await handleLocalTelegramAuth(streamRequest(stream), env)).status, 408);
});
test('bounds work even for endless empty chunks', async () => {
	const stream = new ReadableStream({ pull(controller) { controller.enqueue(new Uint8Array()); } });
	assert.equal((await handleLocalTelegramAuth(streamRequest(stream), env)).status, 400);
});
test('locked body and broken streams fail closed', async () => {
	const locked = request();
	const reader = locked.body.getReader();
	assert.equal((await handleLocalTelegramAuth(locked, env)).status, 400);
	reader.releaseLock();
	const stream = new ReadableStream({ pull(controller) { controller.error(new Error('synthetic')); } });
	assert.equal((await handleLocalTelegramAuth(streamRequest(stream), env)).status, 503);
});
test('strict UTF8 and byte limits ignore forged content length', async () => {
	assert.equal((await handleLocalTelegramAuth(request(new Uint8Array([255])), env)).status, 400);
	assert.equal((await handleLocalTelegramAuth(request('x'.repeat(8193), { headers: { 'Content-Length': '1' } }), env)).status, 413);
});
test('accepts loopback IPv4 and IPv6 only with matching origin', async () => {
	for (const origin of ['http://127.0.0.1:8789', 'http://[::1]:8789']) {
		const response = await handleLocalTelegramAuth(request(undefined, { url: `${origin}/app/api/auth/telegram`, headers: { Origin: origin } }), env);
		assert.equal((await response.json()).error, 'session_bridge_not_configured');
	}
	assert.equal((await handleLocalTelegramAuth(request('', { headers: { Origin: 'null' } }), env)).status, 403);
});