import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createCredentialHandler, validatePersonalNovaPoshtaKey } from './src/lib/server/tracking/credential-api.ts';
import { CredentialVaultError } from './src/lib/server/tracking/credential-vault.ts';
import { AuthError } from './src/lib/server/tracking/auth.ts';

const url = new URL('https://delivery.example/api/v1/nova-poshta/credentials');
const key = randomBytes(16).toString('hex');
function request(method, body, headers = {}) {
	return new Request(url, { method, headers: { origin: url.origin, 'content-type': 'application/json', ...headers },
		...(body === undefined ? {} : { body: typeof body === 'string' ? body : JSON.stringify(body) }) });
}
function fixture() {
	const calls = [];
	const store = {
		assertReady: () => {},
		metadata: async owner => { calls.push(['metadata', owner]); return { configured: false, ready: false }; },
		save: async (owner, value) => { calls.push(['save', owner, value]); },
		delete: async owner => { calls.push(['delete', owner]); }
	};
	const dependencies = {
		authenticate: async () => { calls.push(['auth']); return { id: 'trusted-owner' }; },
		runtime: () => ({ store }),
		validate: async value => { calls.push(['validate', value]); }
	};
	return { calls, store, dependencies, handle: createCredentialHandler(dependencies) };
}

test('metadata only, validation before save, owner-scoped delete and no key responses', async () => {
	const { handle, calls } = fixture();
	const get = await handle(request('GET'), url);
	assert.deepEqual(await get.json(), { configured: false, ready: false, verified: false });
	const post = await handle(request('POST', { key }), url);
	assert.equal(post.status, 200);
	assert.deepEqual(await post.json(), { configured: true, ready: true, verified: true });
	assert.deepEqual(calls.slice(-2), [['validate', key], ['save', 'trusted-owner', key]]);
	const removed = await handle(request('DELETE'), url);
	assert.deepEqual(await removed.json(), { configured: false, ready: false, verified: false });
	assert.deepEqual(calls.at(-1), ['delete', 'trusted-owner']);
	for (const response of [get, post, removed]) assert.equal(response.headers.get('cache-control'), 'no-store');
});

test('personal tokens remain unverified and are scoped to owner and carrier', async () => {
	for (const carrier of ['ukrposhta', 'meest']) {
		const calls = [];
		const handle = createCredentialHandler({
			carrier,
			authenticate: async () => ({ id: 'trusted-owner' }),
			runtime: () => ({ store: {
				assertReady() {},
				metadata: async (owner, selected) => { calls.push([owner, selected]); return { configured: true, ready: true }; },
				save: async (owner, token, selected) => calls.push([owner, token, selected]),
				delete: async (owner, selected) => calls.push([owner, selected])
			} })
		});
		assert.deepEqual(await (await handle(request('POST', { key: 'mock-token' }), url)).json(), { configured: true, ready: true, verified: false });
		assert.deepEqual(calls.pop(), ['trusted-owner', 'mock-token', carrier]);
		assert.equal((await handle(request('POST', { key: 'token\n' }), url)).status, 400);
		await handle(request('GET'), url);
		assert.deepEqual(calls.pop(), ['trusted-owner', carrier]);
		await handle(request('DELETE'), url);
		assert.deepEqual(calls.pop(), ['trusted-owner', carrier]);
	}
});

test('origin required before auth for all writes; owner injection and invalid keys rejected', async () => {
	for (const method of ['POST', 'DELETE']) {
		for (const origin of ['', 'https://evil.example', 'null']) {
			const { handle, calls } = fixture();
			assert.equal((await handle(request(method, undefined, { origin }), url)).status, 403);
			assert.deepEqual(calls, []);
		}
	}
	for (const body of [{ key, owner_id: 'victim' }, { key: 'invalid' }, { key: `${key} ` }, [], null, { apiKey: key }, '{']) {
		const { handle, calls } = fixture();
		assert.equal((await handle(request('POST', body), url)).status, 400);
		assert.deepEqual(calls, [['auth']]);
	}
});

test('bounded actual bytes reject absent or lying content length including chunked bodies', async () => {
	for (const headers of [{}, { 'content-length': '1' }, { 'content-length': '2049' }, { 'content-length': 'invalid' }]) {
		const { handle, calls } = fixture();
		assert.equal((await handle(request('POST', ' '.repeat(2049), headers), url)).status, 413);
		assert.deepEqual(calls, [['auth']]);
	}
	const { handle, calls } = fixture();
	let cancelled = false;
	const stream = new ReadableStream({
		start(controller) { controller.enqueue(new Uint8Array(1024)); controller.enqueue(new Uint8Array(1025)); },
		cancel() { cancelled = true; }
	});
	const streamed = new Request(url, { method: 'POST', headers: { origin: url.origin, 'content-type': 'application/json' }, body: stream, duplex: 'half' });
	assert.equal((await handle(streamed, url)).status, 413);
	assert.equal(cancelled, true);
	assert.deepEqual(calls, [['auth']]);
	const boundary = JSON.stringify({ key }).padEnd(2048, ' ');
	assert.equal((await handle(request('POST', boundary), url)).status, 200);
	assert.equal((await handle(request('POST', { key }, { 'content-type': 'text/plain' }), url)).status, 415);
});

test('vault config, auth and provider failures never leak or persist keys', async () => {
	for (const stage of ['auth', 'vault', 'provider', 'database']) {
		const { dependencies, store, calls } = fixture();
		if (stage === 'auth') dependencies.authenticate = async () => { throw new AuthError(401, 'AUTH_REQUIRED'); };
		if (stage === 'vault') store.assertReady = () => { throw new CredentialVaultError(); };
		if (stage === 'provider') dependencies.validate = async () => { throw new Error(`provider ${key}`); };
		if (stage === 'database') store.save = async () => { throw new Error(`database ${key}`); };
		const response = await createCredentialHandler(dependencies)(request('POST', { key }), url);
		assert.equal(response.status, stage === 'auth' ? 401 : 503);
		assert.equal(await response.text(), JSON.stringify({ error: { message: 'Credential request failed' } }));
		assert.equal(calls.some(call => call[0] === 'save'), false);
	}
});

test('provided NP key validation is read-only, uncached and discards provider data', async () => {
	let calls = 0;
	const transport = async (target, options) => {
		calls++;
		assert.equal(target, 'https://api.novaposhta.ua/v2.0/json/');
		assert.equal(options.redirect, 'error');
		assert.deepEqual(JSON.parse(options.body), { apiKey: key, modelName: 'Counterparty', calledMethod: 'getCounterparties',
			methodProperties: { CounterpartyProperty: 'Sender', Limit: '1', Page: '1' } });
		return Response.json({ success: true, errors: [], data: [{ private: 'discarded' }] });
	};
	assert.equal(await validatePersonalNovaPoshtaKey(key, transport), undefined);
	assert.equal(await validatePersonalNovaPoshtaKey(key, transport), undefined);
	assert.equal(calls, 2);
	await assert.rejects(validatePersonalNovaPoshtaKey(key, async () => Response.json({ success: false, errors: [key], data: [] })), caught => !caught.message.includes(key));
});

test('stalled body reaches its deadline, cancels stream and never validates or saves', async context => {
	context.mock.timers.enable({ apis: ['setTimeout'] });
	const { handle, calls } = fixture();
	let cancelled = false;
	let started;
	const reading = new Promise(resolve => { started = resolve; });
	const stream = new ReadableStream({ pull() { started(); }, cancel() { cancelled = true; } });
	const stalled = new Request(url, { method: 'POST', headers: { origin: url.origin, 'content-type': 'application/json' }, body: stream, duplex: 'half' });
	const pending = handle(stalled, url);
	await reading;
	await Promise.resolve();
	await Promise.resolve();
	context.mock.timers.tick(5000);
	const response = await pending;
	assert.equal(response.status, 408);
	assert.equal(cancelled, true);
	assert.deepEqual(calls, [['auth']]);
});

test('GET and DELETE fail closed when encryption configuration is missing', async () => {
	for (const method of ['GET', 'DELETE']) {
		const { dependencies, store, calls } = fixture();
		store.assertReady = () => { throw new CredentialVaultError(); };
		const response = await createCredentialHandler(dependencies)(request(method), url);
		assert.equal(response.status, 503);
		assert.deepEqual(calls, [['auth']]);
	}
});

test('GET revalidates the saved owner NP key and preserves it on provider failure', async () => {
	const { dependencies, store, calls } = fixture();
	store.metadata = async () => ({ configured: true, ready: true });
	store.getPersonalNovaPoshtaKey = async owner => { assert.equal(owner, 'trusted-owner'); return key; };
	let response = await createCredentialHandler(dependencies)(request('GET'), url);
	assert.deepEqual(await response.json(), { configured: true, ready: true, verified: true });
	dependencies.validate = async () => { throw new Error(key); };
	response = await createCredentialHandler(dependencies)(request('GET'), url);
	assert.deepEqual(await response.json(), { configured: true, ready: false, verified: false });
	assert.equal(calls.some(call => call[0] === 'delete' || call[0] === 'save'), false);
});