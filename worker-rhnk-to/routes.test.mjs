import { test } from 'node:test';
import assert from 'node:assert/strict';
import staticWorker from './static.ts';
import corex from './corex.ts';

test('static products strip only their own prefix and preserve query', async () => {
	let received;
	const env = { BASE_PATH: '/platform', ASSETS: { fetch: async (request) => {
		received = new URL(request.url);
		return new Response('asset');
	} } };
	assert.equal((await staticWorker.fetch(new Request('https://rhnk.to/platform/assets/app.js?v=1'), env)).status, 200);
	assert.equal(received.pathname, '/assets/app.js');
	assert.equal(received.search, '?v=1');
	assert.equal((await staticWorker.fetch(new Request('https://rhnk.to/platform-other'), env)).status, 404);
	assert.equal((await staticWorker.fetch(new Request('https://rhnk.to/platform/', { method: 'POST' }), env)).status, 405);
});

test('custom-domain roots redirect only when explicitly configured', async () => {
	const env = { BASE_PATH: '/dac7', ROOT_REDIRECT: '/dac7/' };
	const response = await staticWorker.fetch(new Request('https://snapshot.rhnk.to/?v=1'), env);
	assert.equal(response.status, 302);
	assert.equal(response.headers.get('location'), 'https://snapshot.rhnk.to/dac7/?v=1');
	assert.equal((await staticWorker.fetch(new Request('https://snapshot.rhnk.to/', { method: 'POST' }), env)).status, 404);
	assert.equal((await staticWorker.fetch(new Request('https://rhnk.to/'), { BASE_PATH: '/platform' })).status, 404);
});

test('Corex assets keep isolated prefix and API uses existing service', async () => {
	const paths = [];
	const env = {
		ASSETS: { fetch: async (request) => { paths.push(new URL(request.url).pathname); return new Response('asset'); } },
		API: { fetch: async () => new Response('api') }
	};
	assert.equal(await (await corex.fetch(new Request('https://rhnk.to/corex/_app/start.js'), env)).text(), 'asset');
	assert.deepEqual(paths, ['/corex/_app/start.js']);
	assert.equal(await (await corex.fetch(new Request('https://rhnk.to/corex/api/processes'), env)).text(), 'api');
	assert.equal((await corex.fetch(new Request('https://rhnk.to/unrelated'), env)).status, 404);
});

test('Corex pages use SvelteKit fallback without hiding missing assets', async () => {
	const paths = [];
	const env = { ASSETS: { fetch: async request => {
		const url = new URL(request.url);
		paths.push(url.pathname + url.search);
		return new Response(url.pathname === '/200' ? 'page' : null, { status: url.pathname === '/200' ? 200 : 404 });
	} } };
	for (const path of ['/corex', '/corex/', '/corex/processes']) {
		assert.equal(await (await corex.fetch(new Request(`https://rhnk.to${path}?v=1`), env)).text(), 'page');
		assert.equal(paths.at(-1), '/200?v=1');
	}
	assert.equal((await corex.fetch(new Request('https://rhnk.to/corex/_app/missing.js'), env)).status, 404);
});