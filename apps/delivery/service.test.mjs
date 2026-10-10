import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createClient } from '@libsql/client';
import { migrateLocal } from './migrate-local.mjs';
import { TrackingStore } from './src/lib/server/tracking/store.ts';
import { TrackingService } from './src/lib/server/tracking/service.ts';
import { sanitizeNovaPoshta } from './src/lib/server/tracking/np-details.ts';

async function fixture(context) {
	const directory = await mkdtemp(join(tmpdir(), 'delivery-service-'));
	const url = `file:${join(directory, 'tracking.db')}`;
	await migrateLocal(url);
	const client = createClient({ url, timeout: 1000 });
	let time = Date.parse('2026-10-07T12:00:00Z');
	const clock = () => new Date(time);
	context.after(async () => {
		client.close();
		global.gc?.();
		await rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
	});
	return { client, url, store: new TrackingStore(client, clock), clock, advance: seconds => { time += seconds * 1000; } };
}

function tracked(shipment, clock, overrides = {}) {
	return {
		carrier: shipment.carrier, trackingNumber: shipment.trackingNumber,
		trackingState: 'active', deliveryStatus: 'in_transit', providerStatusCode: '4',
		providerStatusLabel: 'In transit', checkedAt: clock().toISOString(), events: [], ...overrides
	};
}

test('Meest shipment creation, owner isolation and service refresh persist sanitized tracking', async context => {
	const { store, clock, client } = await fixture(context);
	const shipment = await store.create('alice', 'meest', 'TAC-2550636');
	assert.equal((await store.create('alice', 'meest', 'TAC-2550636')).id, shipment.id);
	assert.equal(await store.get(shipment.id, 'bob'), null);
	for (const number of ['../secret', 'TAC--1', '-TAC', 'TAC-', 'A'.repeat(65)]) {
		await assert.rejects(store.create('alice', 'meest', number), /Invalid/);
	}
	await assert.rejects(client.execute("INSERT INTO delivery_shipments (id,owner_id,carrier,tracking_number,created_at) VALUES ('bad','alice','other','123','now')"), /CHECK/);
	const service = new TrackingService(store, async (carrier, number, ownerId) => {
		assert.equal(ownerId, 'alice');
		assert.equal(carrier, 'meest'); assert.equal(number, shipment.trackingNumber);
		return tracked(shipment, clock, { deliveryStatus: 'delivered', providerStatusCode: '1622',
			providerStatusLabel: 'PRIVATE', events: [{ key: 'meest:1622:2019-05-02 11:21:42', deliveryStatus: 'delivered', label: 'PRIVATE', occurredAt: null }] });
	}, clock);
	const saved = await service.refresh(shipment.id, 'alice');
	assert.equal(saved.trackingState, 'completed');
	assert.equal(saved.deliveryStatus, 'delivered');
	assert.doesNotMatch(JSON.stringify(saved), /PRIVATE/);
	assert.deepEqual((await client.execute('PRAGMA foreign_key_check')).rows, []);
});

test('owner isolation and idempotent create, refresh and delete', async context => {
	const { store, clock } = await fixture(context);
	const shipment = await store.create('alice', 'nova_poshta', 'MOCK0001');
	assert.equal((await store.create('alice', 'nova_poshta', 'MOCK0001')).id, shipment.id);
	const other = await store.create('bob', 'nova_poshta', 'MOCK0001');
	assert.notEqual(other.id, shipment.id);
	assert.equal(await store.get(shipment.id, 'bob'), null);
	assert.equal(await store.delete(shipment.id, 'bob'), false);
	assert.equal(await store.refresh(shipment.id, 'bob', tracked(shipment, clock)), null);
	assert.equal(await store.pause(shipment.id, 'bob'), null);
	let calls = 0;
	const service = new TrackingService(store, async () => { calls++; return tracked(shipment, clock); }, clock);
	assert.equal(await service.refresh(shipment.id, 'bob'), null);
	assert.equal(calls, 0);
	assert.equal((await store.list('alice')).length, 1);
	assert.equal(await store.delete(shipment.id, 'alice'), true);
	assert.equal(await store.get(shipment.id, 'alice'), null);
	assert.ok(await store.get(other.id, 'bob'));
});

test('observed snapshots, historical dedupe and immutable PII-free events', async context => {
	const { store, clock, client, advance } = await fixture(context);
	const shipment = await store.create('alice', 'nova_poshta', 'MOCK0002');
	let saved = await store.refresh(shipment.id, 'alice', tracked(shipment, clock));
	assert.equal(saved.events.length, 1);
	assert.equal(saved.events[0].occurredAt, null);
	advance(1);
	saved = await store.refresh(shipment.id, 'alice', tracked(shipment, clock));
	assert.equal(saved.events.length, 1);
	const event = { key: 'provider-key-person@example.com', deliveryStatus: 'accepted', label: 'Private person', occurredAt: '2026-10-06T10:00:00Z' };
	const result = tracked(shipment, clock, { providerStatusLabel: 'Private person', events: [event, event], raw: { phone: 'secret-phone' } });
	saved = await store.refresh(shipment.id, 'alice', result);
	await store.refresh(shipment.id, 'alice', result);
	assert.equal(saved.events.length, 2);
	assert.equal((await store.get(shipment.id, 'alice')).events.length, 2);
	assert.equal(saved.providerStatusLabel, 'In transit');
	const persisted = JSON.stringify((await client.execute('SELECT * FROM delivery_events')).rows);
	assert.doesNotMatch(persisted, /Private person|person@example.com|secret-phone/);
	await assert.rejects(client.execute("UPDATE delivery_events SET label = 'changed'"), /immutable/);
	await store.delete(shipment.id, 'alice');
	assert.equal((await client.execute('SELECT * FROM delivery_events')).rows.length, 0);
});

test('failure preserves snapshot and thrown carrier errors become scheduled transient failures', async context => {
	const { store, clock, advance } = await fixture(context);
	const shipment = await store.create('alice', 'nova_poshta', 'MOCK0003');
	const success = await store.refresh(shipment.id, 'alice', tracked(shipment, clock));
	advance(10);
	const service = new TrackingService(store, async () => { throw new Error('secret provider payload'); }, clock);
	const failed = await service.refresh(shipment.id, 'alice');
	assert.equal(failed.trackingState, 'provider_unavailable');
	for (const key of ['deliveryStatus', 'providerStatusCode', 'providerStatusLabel', 'lastSuccessAt', 'events']) {
		assert.deepEqual(failed[key], success[key]);
	}
	assert.equal(failed.lastCheckedAt, clock().toISOString());
	assert.equal(Date.parse(failed.nextCheckAt) - clock().getTime(), 60_000);
	assert.equal(failed.revision, success.revision + 1);
});

test('competing connections, expired leases and stale revisions cannot overwrite snapshots', async context => {
	const { store, clock, advance, url } = await fixture(context);
	const competitorClient = createClient({ url, timeout: 1000 });
	const competitor = new TrackingStore(competitorClient, clock);
	try {
		const shipment = await store.create('alice', 'nova_poshta', 'LEASE0001');
		const claims = await Promise.all([store.getDue('alice'), competitor.getDue('alice')]);
		assert.equal(claims.flat().length, 1);
		const first = claims.flat()[0];
		assert.equal(await competitor.claim(shipment.id, 'alice'), null);
		advance(29);
		assert.deepEqual(await competitor.getDue('alice'), []);
		advance(1);
		const [second] = await competitor.getDue('alice');
		assert.ok(second);
		assert.notEqual(second.leaseToken, first.leaseToken);
		assert.equal(await store.refresh(shipment.id, 'alice', tracked(shipment, clock), first.leaseToken), null);
		const updated = await competitor.refresh(shipment.id, 'alice', tracked(shipment, clock), second.leaseToken);
		assert.equal(updated.revision, 1);
		assert.equal(await store.refresh(shipment.id, 'alice', tracked(shipment, clock), second.leaseToken), null);
		const claim = await store.claim(shipment.id, 'alice');
		await store.pause(shipment.id, 'alice');
		assert.equal(await store.refresh(shipment.id, 'alice', tracked(shipment, clock), claim.leaseToken), null);
		assert.equal((await store.get(shipment.id, 'alice')).trackingState, 'paused');
	} finally {
		competitorClient.close();
	}
});

test('SQL schedule survives restart, respects pause and stops only for actual terminal statuses', async context => {
	const { store, clock, advance, url } = await fixture(context);
	const shipment = await store.create('alice', 'nova_poshta', 'SCHEDULE1');
	const paused = await store.pause(shipment.id, 'alice');
	assert.equal(paused.nextCheckAt, null);
	assert.deepEqual(await store.getDue('alice'), []);
	assert.equal(await store.claim(shipment.id, 'alice'), null);
	await store.pause(shipment.id, 'alice', false);
	for (const status of ['refused', 'return_in_transit', 'lost', 'damaged', 'exception']) {
		const updated = await store.refresh(shipment.id, 'alice', tracked(shipment, clock, { deliveryStatus: status }));
		assert.equal(updated.trackingState, 'active');
		assert.equal(Date.parse(updated.nextCheckAt) - clock().getTime(), 900_000);
	}
	advance(900);
	const freshClient = createClient({ url });
	try {
		const restarted = new TrackingStore(freshClient, clock);
		const [claim] = await restarted.getDue('alice');
		assert.equal(claim.id, shipment.id);
		await restarted.refresh(shipment.id, 'alice', tracked(shipment, clock), claim.leaseToken);
	} finally {
		freshClient.close();
	}
	for (const status of ['delivered', 'returned', 'cancelled']) {
		const terminal = await store.create('alice', 'nova_poshta', `STOP${status}`);
		const finished = await store.refresh(terminal.id, 'alice', tracked(terminal, clock, { deliveryStatus: status }));
		assert.equal(finished.trackingState, 'completed');
		assert.equal(finished.nextCheckAt, null);
		const unknown = await store.refresh(terminal.id, 'alice', tracked(terminal, clock, { deliveryStatus: 'unknown', providerStatusCode: '999999' }));
		assert.equal(unknown.deliveryStatus, status);
		assert.equal(unknown.providerStatusCode, finished.providerStatusCode);
		assert.equal(unknown.events.length, finished.events.length);
		assert.equal(unknown.nextCheckAt, null);
	}
	assert.deepEqual(await store.getDue('alice'), []);
});

test('bounded exponential retry and provider Retry-After clamps reset after success', async context => {
	const { store, clock, advance } = await fixture(context);
	const shipment = await store.create('alice', 'nova_poshta', 'RETRY0001');
	const failure = overrides => tracked(shipment, clock, { trackingState: 'rate_limited', deliveryStatus: 'unknown', ...overrides });
	for (const [attempt, expected] of [[1, 60], [2, 120], [3, 240], [4, 480]]) {
		const saved = await store.refresh(shipment.id, 'alice', failure({ retryAfterSeconds: 1 }));
		assert.equal(Date.parse(saved.nextCheckAt) - clock().getTime(), expected * 1000, `attempt ${attempt}`);
		advance(expected);
	}
	const bounded = await store.refresh(shipment.id, 'alice', failure({ retryAfterSeconds: 999999999 }));
	assert.equal(Date.parse(bounded.nextCheckAt) - clock().getTime(), 86400_000);
	await store.refresh(shipment.id, 'alice', tracked(shipment, clock));
	const reset = await store.refresh(shipment.id, 'alice', failure({ retryAfterSeconds: -100 }));
	assert.equal(Date.parse(reset.nextCheckAt) - clock().getTime(), 60_000);
	const providerMinimum = await store.refresh(shipment.id, 'alice', failure({ retryAfterSeconds: 3600 }));
	assert.equal(Date.parse(providerMinimum.nextCheckAt) - clock().getTime(), 3600_000);
	for (let attempt = 0; attempt < 15; attempt++) {
		const saved = await store.refresh(shipment.id, 'alice', failure({ retryAfterSeconds: NaN }));
		const seconds = (Date.parse(saved.nextCheckAt) - clock().getTime()) / 1000;
		assert.ok(seconds >= 60 && seconds <= 86400);
	}
	const unavailable = await store.refresh(shipment.id, 'alice', failure({ trackingState: 'access_denied' }));
	assert.equal(unavailable.nextCheckAt, new Date(clock().getTime() + 86400_000).toISOString());
});

test('scheduler isolates per-job errors, awaits work, scopes owner and caps claims at ten', async context => {
	const { store, clock, advance } = await fixture(context);
	for (let index = 0; index < 12; index++) {
		await store.create('alice', 'nova_poshta', `BATCH${index}`);
		advance(1);
	}
	await store.create('bob', 'nova_poshta', 'OTHEROWNER');
	let calls = 0;
	const service = new TrackingService(store, async (carrier, trackingNumber) => {
		calls++;
		if (trackingNumber === 'BATCH0') return tracked({ carrier, trackingNumber }, clock, { carrier: 'ukrposhta' });
		if (trackingNumber === 'BATCH1') throw new Error('provider failure');
		return tracked({ carrier, trackingNumber }, clock);
	}, clock);
	await assert.rejects(service.runDue('alice', 11), /limit/);
	const results = await service.runDue('alice');
	assert.equal(results.length, 10);
	assert.equal(calls, 10);
	assert.equal(results.filter(result => result.error).length, 1);
	assert.equal(results.filter(result => result.shipment?.trackingState === 'provider_unavailable').length, 1);
	assert.equal((await store.list('bob'))[0].revision, 0);
	assert.equal((await service.runDue('alice')).length, 2);
	assert.equal(calls, 12);
});

test('local migration is additive, repeatable and rejects remote or existing local.db targets', async () => {
	for (const url of ['libsql://remote', 'https://remote', 'file://host/path', 'file:./local.db', 'file:./LOCAL.DB', 'file:./tracking.db?syncUrl=https://remote']) {
		await assert.rejects(migrateLocal(url));
	}
	const directory = await mkdtemp(join(tmpdir(), 'delivery-migration-'));
	const url = `file:${join(directory, 'tracking.db')}`;
	const client = createClient({ url });
	try {
		await client.execute('CREATE TABLE unrelated (value TEXT)');
		await client.execute("INSERT INTO unrelated VALUES ('preserved')");
		await migrateLocal(url);
		await migrateLocal(url);
		assert.equal((await client.execute('SELECT value FROM unrelated')).rows[0].value, 'preserved');
		const tables = (await client.execute("SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'delivery_%'")).rows;
		assert.deepEqual(tables.map(row => row.name).sort(), ['delivery_carrier_credentials', 'delivery_customers', 'delivery_directory_points', 'delivery_events', 'delivery_np_documents', 'delivery_np_sender_defaults', 'delivery_shipments', 'delivery_shipping_drafts']);
	} finally {
		client.close();
		global.gc?.();
		await rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
	}
});

test('rich NP snapshot and original status survive failures and repeated migrations', async context => {
	const { store, clock, url } = await fixture(context);
	const shipment = await store.create('alice', 'nova_poshta', 'RICHMOCK1');
	const details = sanitizeNovaPoshta({ Status: 'At test branch', CityRecipient: 'Test City', DocumentWeight: '2.5' });
	const saved = await store.refresh(shipment.id, 'alice', tracked(shipment, clock, { details }));
	assert.equal(saved.providerStatusLabel, 'At test branch');
	assert.deepEqual(saved.details, details);
	await migrateLocal(url);
	const failed = await store.refresh(shipment.id, 'alice', tracked(shipment, clock, { trackingState: 'provider_unavailable' }));
	assert.deepEqual(failed.details, details);
	assert.equal(failed.providerStatusLabel, saved.providerStatusLabel);
	assert.equal(await store.get(shipment.id, 'bob'), null);
});