import assert from 'node:assert/strict';
import test from 'node:test';
import { cachedDirectory } from './src/lib/directory-cache.ts';

test('browser cache avoids repeated requests, isolates users and expires', async () => {
	const values = new Map();
	const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
	const original = globalThis.fetch;
	let calls = 0;
	globalThis.fetch = async () => { calls++; return Response.json({ data: [{ ref: 'point' }], hasMore: false }); };
	try {
		const url = '/api/v1/nova-poshta/directory?kind=nearby&cityRef=city&latitude=50.45&longitude=30.52&weight=1';
		await cachedDirectory(url, 'first', 15000, storage);
		await cachedDirectory(url, 'first', 15000, storage);
		assert.equal(calls, 1);
		await cachedDirectory(url, 'second', 15000, storage);
		assert.equal(calls, 2);
		const key = 'delivery:directory:v1:first';
		const entries = JSON.parse(values.get(key));
		entries[0].expires = 0; values.set(key, JSON.stringify(entries));
		await cachedDirectory(url, 'first', 15000, storage);
		assert.equal(calls, 3);
		assert.ok(values.get(key).length * 2 <= 1024 * 1024);
	} finally { globalThis.fetch = original; }
});

test('disabled storage does not prevent directory lookup', async () => {
	const original = globalThis.fetch;
	globalThis.fetch = async () => Response.json({ data: [] });
	try {
		const result = await cachedDirectory('/directory?kind=warehouses', 'user', 15000, {
			getItem() { throw new Error('Denied'); }, setItem() { throw new Error('Denied'); }
		});
		assert.deepEqual(result.data, []);
	} finally { globalThis.fetch = original; }
});