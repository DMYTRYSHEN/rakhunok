import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

test('PWA caches only public assets and keeps private requests network-only', async () => {
	const source = await readFile(new URL('./src/service-worker/index.ts', import.meta.url), 'utf8');
	const handlers = new Map();
	const entries = new Map();
	const fetched = [];
	const cache = {
		async addAll(urls) {
			for (const url of urls) entries.set(url, new Response('<base href="../"><a href="./business">Retry</a>'));
		},
		async match(url) { return entries.get(url)?.clone(); }
	};
	const worker = {
		location: { href: 'https://example.test/delivery/service-worker.js' },
		clients: { async claim() {} },
		addEventListener(name, handler) { handlers.set(name, handler); }
	};
	const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
	runInNewContext(output, {
		exports: {}, URL, Response,
		require(name) { return name === '$app/service-worker' ? { self: worker } : { version: 'test' }; },
		caches: { async open() { return cache; }, async keys() { return []; } },
		async fetch(request) { fetched.push(request.url); throw new TypeError('Offline'); }
	});
	let installed;
	handlers.get('install')({ waitUntil(promise) { installed = promise; } });
	await installed;
	assert.equal(entries.size, 4);
	assert.ok([...entries.keys()].every(url => /\/delivery\/(pwa\/|manifest.webmanifest)/.test(url)));
	for (const request of [
		{ method: 'POST', mode: 'navigate', url: 'https://example.test/delivery/' },
		{ method: 'GET', mode: 'cors', url: 'https://example.test/delivery/api/v1/shipments' },
		{ method: 'GET', mode: 'cors', url: 'https://example.test/delivery/business/__data.json' },
		{ method: 'GET', mode: 'navigate', url: 'https://example.test/dashboard' }
	]) {
		handlers.get('fetch')({ request, respondWith() { assert.fail('Private request intercepted'); } });
	}
	let responsePromise;
	handlers.get('fetch')({
		request: { method: 'GET', mode: 'navigate', url: 'https://example.test/delivery/business/attention' },
		respondWith(promise) { responsePromise = promise; }
	});
	const response = await responsePromise;
	assert.match(await response.text(), /<base href="\/delivery\/">/);
	assert.equal(response.headers.get('cache-control'), 'no-store');
	assert.equal(fetched.length, 1);
	assert.equal(entries.size, 4);
});