import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createClient } from '@libsql/client';
import { migrateLocal } from './migrate-local.mjs';
import { TrackingStore } from './src/lib/server/tracking/store.ts';
import { createReadModel } from './src/lib/server/mcp/read-model.ts';

test('MCP reads are bounded, owner-scoped, privacy-safe and do not write', async context => {
	const directory = await mkdtemp(join(tmpdir(), 'delivery-mcp-'));
	const url = `file:${join(directory, 'tracking.db')}`;
	await migrateLocal(url);
	const client = createClient({ url });
	context.after(async () => { client.close(); global.gc?.(); await rm(directory, { recursive: true, force: true, maxRetries: 5 }); });
	const store = new TrackingStore(client);
	const first = await store.create('alice', 'nova_poshta', 'MOCK0001');
	await store.create('alice', 'nova_poshta', 'MOCK0002');
	const other = await store.create('bob', 'nova_poshta', 'MOCK0003');
	await client.execute({ sql: 'UPDATE delivery_shipments SET provider_status_label = ?, details_json = ? WHERE id = ?',
		args: ['PRIVATE', JSON.stringify({ parties: { sender: 'PRIVATE' } }), first.id] });
	for (let index = 0; index < 6; index++) await client.execute({
		sql: 'INSERT INTO delivery_events (owner_id, shipment_id, event_key, delivery_status, label, observed_at) VALUES (?, ?, ?, ?, ?, ?)',
		args: ['alice', first.id, `event-${index}`, `status-${index}`, 'PRIVATE', '2026-10-08T00:00:00Z']
	});
	const model = createReadModel(client);
	const page = await model.list('alice', 1, 0);
	assert.equal(page.shipments.length, 1);
	assert.equal(page.nextOffset, 1);
	assert.equal((await model.list('alice', 1, 1)).nextOffset, null);
	assert.equal(await model.get('alice', other.id), null);
	assert.equal(await model.tracking('alice', other.id, 10, 0), null);
	assert.equal(await model.get('alice', "' OR 1=1 --"), null);
	assert.doesNotMatch(JSON.stringify(await model.tracking('alice', first.id, 10, 0)), /PRIVATE|details|owner|lease/);
	const history = await model.tracking('alice', first.id, 2, 0);
	assert.deepEqual(history.events.map(event => event.deliveryStatus), ['status-0', 'status-1']);
	assert.equal(history.nextOffset, 2);
	assert.deepEqual((await model.tracking('alice', first.id, 2, 2)).events.map(event => event.deliveryStatus), ['status-2', 'status-3']);
	assert.equal((await model.tracking('alice', first.id, 2, 4)).nextOffset, null);
	await client.execute('PRAGMA query_only = ON');
	await assert.rejects(client.execute('DELETE FROM delivery_shipments'));
	assert.equal((await model.list('alice', 10, 0)).shipments.length, 2);
	for (const limit of [0, 51, 1.5]) await assert.rejects(model.list('alice', limit, 0));
	await assert.rejects(model.list('alice', 10, 10001));
	assert.equal((await client.execute('SELECT SUM(revision) AS total FROM delivery_shipments')).rows[0].total, 0);
});