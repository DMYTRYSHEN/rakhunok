import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createClient } from '@libsql/client';
import { migrateLocal } from './migrate-local.mjs';

test('005 preserves pre-Meest shipments/events, constraints, indexes and immutable history on repeat migration', async context => {
	const directory = await mkdtemp(join(tmpdir(), 'meest-upgrade-'));
	const url = `file:${join(directory, 'tracking.db')}`;
	const client = createClient({ url });
	context.after(async () => { client.close(); global.gc?.(); await rm(directory, { recursive: true, force: true, maxRetries: 8, retryDelay: 40 }); });
	await client.executeMultiple(await readFile(new URL('./migrations/001_tracking.sql', import.meta.url), 'utf8'));
	await client.executeMultiple(await readFile(new URL('./migrations/002_np_integration.sql', import.meta.url), 'utf8'));
	await client.executeMultiple("CREATE TABLE tracking_migrations (name TEXT PRIMARY KEY); INSERT INTO tracking_migrations VALUES ('002_np_integration');");
	await client.execute({ sql: `INSERT INTO delivery_shipments VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		args: ['existing', 'alice', 'ukrposhta', '1234567890123', 'active', 'in_transit', '300', 'In transit',
			'2026-01-01', '2026-01-01', '2026-01-02', 7, 2, 'lease', '2026-01-03', '2025-12-31', '{"safe":true}'] });
	await client.execute("INSERT INTO delivery_events VALUES ('alice','existing','old-event','in_transit','In transit',NULL,'2026-01-01')");
	const shipments = (await client.execute('SELECT * FROM delivery_shipments')).rows;
	const events = (await client.execute('SELECT * FROM delivery_events')).rows;
	await migrateLocal(url);
	await migrateLocal(url);
	assert.deepEqual((await client.execute('SELECT * FROM delivery_shipments')).rows, shipments);
	assert.deepEqual((await client.execute('SELECT * FROM delivery_events')).rows, events);
	assert.deepEqual((await client.execute('PRAGMA foreign_key_check')).rows, []);
	assert.equal((await client.execute("SELECT name FROM tracking_migrations WHERE name='005_meest_tracking'")).rows.length, 1);
	assert.equal((await client.execute("SELECT name FROM sqlite_master WHERE type='index' AND name IN ('delivery_shipments_due','delivery_shipments_owner')")).rows.length, 2);
	await assert.rejects(client.execute("UPDATE delivery_events SET label='changed'"), /immutable/);
	await assert.rejects(client.execute("INSERT INTO delivery_events VALUES ('bob','existing','bad','delivered','Delivered',NULL,'now')"), /FOREIGN KEY/);
	await client.execute("INSERT INTO delivery_shipments (id,owner_id,carrier,tracking_number,created_at) VALUES ('meest','alice','meest','TAC-2550636','now')");
	await assert.rejects(client.execute("INSERT INTO delivery_shipments (id,owner_id,carrier,tracking_number,created_at) VALUES ('duplicate','alice','meest','TAC-2550636','now')"), /UNIQUE/);
	await client.execute("DELETE FROM delivery_shipments WHERE id='existing'");
	assert.equal((await client.execute('SELECT * FROM delivery_events')).rows.length, 0);
});