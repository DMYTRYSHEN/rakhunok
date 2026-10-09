import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createClient } from '@libsql/client';
import { migrateLocal } from './migrate-local.mjs';
import { NovaPoshtaDocumentStore } from './src/lib/server/tracking/np-document-store.ts';
import { novaPoshtaPdf } from './src/lib/server/tracking/np-print.ts';
import { issueNovaPoshta } from './src/lib/server/tracking/np-issuance.ts';
import { documentPdf, shipmentForm } from './src/lib/server/tracking/np-http.ts';

test('document attempts deduplicate concurrent requests and bind printing to owner and original key', async context => {
	const directory = await mkdtemp(join(tmpdir(), 'delivery-documents-'));
	const url = `file:${join(directory, 'tracking.db')}`;
	await migrateLocal(url);
	await migrateLocal(url);
	const client = createClient({ url });
	context.after(async () => { client.close(); global.gc?.(); await rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); });
	const store = new NovaPoshtaDocumentStore(client);
	const attempts = await Promise.all([store.begin('alice', 'one', { cargo: 1 }, 'key'), store.begin('alice', 'two', { cargo: 1 }, 'key')]);
	assert.equal(attempts.filter(attempt => attempt.started).length, 1);
	assert.equal(attempts[0].id, attempts[1].id);
	const id = attempts[0].id;
	await assert.rejects(store.begin('alice', id, { cargo: 2 }, 'key'));
	assert.equal(await store.printable('alice', id, 'key'), null);
	await store.finish('alice', id, 'ref', '20400000000001');
	assert.equal(await store.printable('alice', id, 'key'), 'ref');
	assert.equal(await store.printable('bob', id, 'key'), null);
	assert.equal(await store.printable('alice', id, 'replacement'), null);
	assert.deepEqual(await store.list('bob'), []);
	await assert.rejects(store.get('bob', id));
	for (let index = 0; index < 101; index++) await store.begin('alice', `later-${index}`, { later: index }, 'key');
	assert.equal((await store.list('alice')).length, 100);
	assert.equal((await store.get('alice', id)).trackingNumber, '20400000000001');
	await store.begin('alice', 'unknown', { cargo: 2 }, 'key');
	await store.finish('alice', 'unknown', null, null);
	assert.equal((await store.begin('alice', 'retry', { cargo: 2 }, 'key')).started, false);
	assert.equal((await store.list('alice')).find(row => row.id === 'unknown').state, 'outcome_unknown');
});

test('official PDF formats use fixed host, reject unsafe responses and never expose key', async () => {
	const ref = '11111111-1111-1111-1111-111111111111';
	const key = 'a'.repeat(32);
	for (const [format, method, type] of [['waybill', 'printDocument', 'pdf'], ['a4', 'printMarking85x85', 'pdf8'], ['zebra', 'printMarking100x100', 'pdf']]) {
		const response = await novaPoshtaPdf(ref, key, format, async (url, options) => {
			assert.equal(new URL(url).origin, 'https://my.novaposhta.ua');
			assert.ok(url.includes(`/orders/${method}/orders[]/${ref}/type/${type}/`));
			assert.equal(options.redirect, 'error');
			return new Response('%PDF-1.7\nmock', { headers: { 'Content-Type': 'application/pdf' } });
		});
		assert.equal(response.status, 200);
		assert.equal(response.headers.get('cache-control'), 'no-store');
		assert.equal(JSON.stringify([...response.headers]).includes(key), false);
	}
	for (const transport of [async () => new Response('<html>secret</html>'), async () => new Response('fake', { headers: { 'Content-Type': 'application/pdf' } }), async () => { throw new Error(key); }, async () => new Response(new Uint8Array(10 * 1024 * 1024 + 1), { headers: { 'Content-Type': 'application/pdf' } })]) {
		const response = await novaPoshtaPdf(ref, key, 'waybill', transport);
		assert.equal(response.status, 503);
		assert.equal((await response.text()).includes(key), false);
	}
});

test('issuance revalidates sender, creates recipient and document once, and never retries ambiguous writes', async () => {
	const ref = number => `${String(number).repeat(8)}-${String(number).repeat(4)}-${String(number).repeat(4)}-${String(number).repeat(4)}-${String(number).repeat(12)}`;
	const input = { attemptId: ref(9), confirm: 'yes', senderRef: ref(5), contactRef: ref(6), senderCityRef: ref(1), recipientCityRef: ref(2), senderWarehouseRef: ref(3), recipientWarehouseRef: ref(4), recipientName: '\u0406\u0432\u0430\u043d\u043e\u0432 \u0406\u0432\u0430\u043d', recipientPhone: '0671234567', description: 'Books', seats: [{ weight: 1, length: 20, width: 20, height: 10 }], declaredCost: 500, payer: 'Recipient', paymentMethod: 'Cash' };
	for (const ambiguous of [false, true]) {
		const writes = [];
		let saved;
		const store = {
			async begin(owner, id) { if (saved) return { started: false, id }; saved = { id, state: 'submitting' }; return { started: true, id }; },
			async finish(owner, id, documentRef, trackingNumber) { saved = { id, state: documentRef ? 'issued' : 'outcome_unknown', documentRef, trackingNumber }; },
			async list() { return saved ? [saved] : []; }
			, async get(owner, id) { assert.equal(saved.id, id); return saved; }
		};
		const api = { async call(model, method, properties, key) {
			assert.equal(key, 'personal');
			if (method === 'getCounterparties') return [{ Ref: ref(5), Description: 'Sender' }];
			if (method === 'getCounterpartyContactPersons') return [{ Ref: properties.Ref === ref(5) ? ref(6) : ref(8), Phones: '380671234567', Description: 'Contact' }];
			if (method === 'getWarehouses') return [{ Ref: properties.Ref, CityRef: properties.Ref === ref(3) ? ref(1) : ref(2), Description: 'Branch', CategoryOfWarehouse: 'Warehouse', WarehouseStatus: 'Working' }];
			if (method !== 'save') return [];
			writes.push(model);
			if (model === 'Counterparty') return [{ Ref: ref(7) }];
			assert.equal(properties.Recipient, ref(7));
			assert.equal(properties.ContactSender, ref(6));
			assert.equal(properties.ContactRecipient, ref(8));
			assert.equal(properties.ServiceType, 'WarehouseWarehouse');
			if (ambiguous) throw new Error('Network timeout with secret');
			return [{ Ref: ref(8), IntDocNumber: '20400000000001' }];
		} };
		await assert.rejects(issueNovaPoshta({ api, store, key: 'personal', owner: 'alice' }, { ...input, confirm: 'no' }));
		await assert.rejects(issueNovaPoshta({ api, store, key: 'personal', owner: 'alice' }, { ...input, senderRef: ref(7) }));
		assert.equal(writes.length, 0);
		const result = await issueNovaPoshta({ api, store, key: 'personal', owner: 'alice' }, input);
		assert.equal(result.state, ambiguous ? 'outcome_unknown' : 'issued');
		await issueNovaPoshta({ api, store, key: 'personal', owner: 'alice' }, input);
		assert.deepEqual(writes, ['Counterparty', 'InternetDocument']);
	}
});

test('print route denies anonymous, other-owner, replaced-key and arbitrary tracking-number access before provider fetch', async () => {
	const id = '11111111-1111-1111-1111-111111111111';
	let calls = 0;
	const dependencies = {
		async authenticate() { return { id: 'alice' }; },
		async key() { return 'a'.repeat(32); },
		async printable(owner, documentId, key) { return owner === 'alice' && documentId === id && key === 'a'.repeat(32) ? id : null; },
		async transport() { calls++; return new Response('%PDF-1.7', { headers: { 'content-type': 'application/pdf' } }); }
	};
	const request = new Request('https://delivery.test/print');
	for (const overrides of [{ authenticate: async () => { throw new Error('unauthenticated'); } }, { authenticate: async () => ({ id: 'bob' }) }, { key: async () => 'b'.repeat(32) }]) {
		assert.notEqual((await documentPdf(request, id, 'waybill', { ...dependencies, ...overrides })).status, 200);
	}
	assert.notEqual((await documentPdf(request, '20400000000001', 'waybill', dependencies)).status, 200);
	assert.notEqual((await documentPdf(request, id, 'constructor', dependencies)).status, 200);
	assert.equal(calls, 0);
	assert.equal((await documentPdf(request, id, 'a4', dependencies)).status, 200);
	assert.equal(calls, 1);
});

test('shipment form bounds actual body, enforces origin and rejects duplicate fields', async () => {
	const url = new URL('https://delivery.test/business/new');
	const request = (body, origin = url.origin) => new Request(url, { method: 'POST', headers: { origin, 'content-type': 'application/x-www-form-urlencoded' }, body });
	assert.deepEqual(await shipmentForm(request('confirm=yes'), url), { confirm: 'yes' });
	await assert.rejects(shipmentForm(request('confirm=yes', 'https://evil.test'), url));
	await assert.rejects(shipmentForm(request('confirm=yes&confirm=no'), url));
	await assert.rejects(shipmentForm(request(`field=${'x'.repeat(32768)}`), url));
	await assert.rejects(shipmentForm(request('__proto__=bad'), url));
});