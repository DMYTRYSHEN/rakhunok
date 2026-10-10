import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { nearbyPoints } from './src/lib/server/tracking/nearby-points.ts';

const city = '11111111-1111-1111-1111-111111111111';
const location = { latitude: 50.45, longitude: 30.52 };
const near = { ref: 'near', cityRef: city, latitude: 50.451, longitude: 30.52, status: 'Working', category: 'Branch', maxWeight: 30 };

test('directory endpoint and nearby service have no database dependency', () => {
	for (const path of ['./src/routes/api/v1/nova-poshta/directory/+server.ts', './src/lib/server/tracking/nearby-points.ts']) {
		assert.doesNotMatch(readFileSync(new URL(path, import.meta.url), 'utf8'), /trackingRuntime|DirectoryStore|directory\.(save|nearby)|libsql/);
	}
});

test('provider lookup returns only suitable points within one kilometre', async () => {
	let calls = 0;
	const result = await nearbyPoints(city, location, 5, { async warehousesPage(ref, search, page) {
		assert.equal(ref, city); assert.equal(search, ''); assert.equal(page, ++calls);
		return { data: page === 1 ? [{ ...near, ref: 'far', latitude: 50.48 }] : [near, { ...near, ref: 'small', maxWeight: 2 }], hasMore: page === 1 };
	} });
	assert.equal(calls, 2);
	assert.equal(result.source, 'nova_poshta');
	assert.deepEqual(result.data, [near]);
});

test('invalid coordinates, city or weight fail before database or provider access', async () => {
	const provider = { async warehousesPage() { assert.fail('Unexpected provider call'); } };
	for (const [ref, gps, weight] of [['bad', location, 5], [city, { ...location, latitude: NaN }, 5], [city, { ...location, longitude: 0 }, 5], [city, location, 0]]) {
		await assert.rejects(nearbyPoints(ref, gps, weight, provider), { status: 400 });
	}
});

test('empty fallback stays bounded and performs no write', async () => {
	let calls = 0;
	const result = await nearbyPoints(city, location, 5, { async warehousesPage() { calls++; return { data: [{ ...near, latitude: 50.48 }], hasMore: true }; } });
	assert.equal(calls, 30);
	assert.deepEqual(result.data, []);
	assert.equal(result.hasMore, true);
});