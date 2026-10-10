import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createClient } from '@libsql/client';
import { DirectoryStore } from './src/lib/server/tracking/directory-store.ts';

test('directory persists map fields, updates without duplicates and excludes invalid coordinates', async () => {
	const client = createClient({ url: 'file::memory:' });
	try {
		await client.executeMultiple(await readFile(new URL('./migrations/009_directory_points.sql', import.meta.url), 'utf8'));
		const store = new DirectoryStore(client);
		const point = { ref: 'point', cityRef: 'city', name: 'Branch', address: 'Street', number: '1', category: 'Branch', status: 'Working', typeRef: 'type', maxWeight: 30, latitude: 50.45, longitude: 30.52, schedule: { Monday: '09:00-18:00' } };
		await store.save([point]);
		const original = (await client.execute('SELECT * FROM delivery_directory_points')).rows[0];
		assert.equal(original.latitude, 50.45);
		assert.equal(original.longitude, 30.52);
		assert.deepEqual(JSON.parse(original.schedule_json), point.schedule);
		await store.save([point]);
		assert.equal((await client.execute('SELECT changes() AS changed')).rows[0].changed, 0);
		assert.deepEqual(await store.nearby('city', { latitude: 50.45, longitude: 30.52 }, 5), [point]);
		await store.save([{ ...point, ref: 'far', latitude: 50.48 }, { ...point, ref: 'closed', status: 'Closed' }, { ...point, ref: 'small', maxWeight: 2 }, { ...point, ref: 'other', cityRef: 'other' }]);
		assert.deepEqual((await store.nearby('city', { latitude: 50.45, longitude: 30.52 }, 5)).map(item => item.ref), ['point']);
		assert.deepEqual(await store.nearby('city', { latitude: 50.45, longitude: 30.52 }, 35), []);
		await store.save([{ ...point, address: 'New address', latitude: 0, longitude: 200 }]);
		const rows = (await client.execute('SELECT * FROM delivery_directory_points')).rows;
		assert.equal(rows.length, 5);
		const updated = rows.find(row => row.ref === 'point');
		assert.equal(updated.address, 'New address');
		assert.equal(updated.first_seen_at, original.first_seen_at);
		assert.equal(updated.latitude, null);
		assert.equal(updated.longitude, null);
		await store.save([]);
	} finally { client.close(); }
});