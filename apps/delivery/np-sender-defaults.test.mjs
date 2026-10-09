import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@libsql/client';
import { readFile } from 'node:fs/promises';
import { NovaPoshtaSenderDefaults, defaultSenderAccount } from './src/lib/server/tracking/np-sender-defaults.ts';

test('sender defaults persist by owner and key, validate ownership, update and clear independently', async () => {
	const client = createClient({ url: 'file::memory:' });
	const sender = '11111111-1111-1111-1111-111111111111';
	const contact = '22222222-2222-2222-2222-222222222222';
	const other = '33333333-3333-3333-3333-333333333333';
	const api = { async call(model, method) {
		return method === 'getCounterparties' ? [{ Ref: sender, Description: 'Sender' }]
			: [{ Ref: contact, Description: 'Contact', Phones: '+380671234567' }];
	} };
	try {
		await client.executeMultiple(await readFile(new URL('./migrations/007_np_sender_defaults.sql', import.meta.url), 'utf8'));
		const store = new NovaPoshtaSenderDefaults(client);
		assert.equal(await store.get('alice', 'key'), null);
		await store.save('alice', 'key', sender, contact, api);
		assert.deepEqual(await new NovaPoshtaSenderDefaults(client).get('alice', 'key'), { senderRef: sender, contactRef: contact });
		assert.equal(await store.get('bob', 'key'), null);
		assert.equal(await store.get("alice' OR 1=1 --", 'key'), null);
		assert.equal(await store.get('alice', 'changed-key'), null);
		await assert.rejects(store.save('alice', 'key', other, contact, api));
		await assert.rejects(store.save('alice', 'key', sender, other, api));
		await assert.rejects(store.save('alice', 'key', 'invalid', contact, api));
		await assert.rejects(store.save('alice', 'key', sender, contact, { async call() { throw new Error('offline'); } }));
		assert.deepEqual(await store.get('alice', 'key'), { senderRef: sender, contactRef: contact });
		const defaults = await defaultSenderAccount(store, 'alice', 'key', api);
		assert.equal(defaults.defaultSenderRef, sender);
		assert.equal(defaults.defaultContactRef, contact);
		assert.equal(defaults.contacts[0].phone, '+380671234567');
		const deletedContact = await defaultSenderAccount(store, 'alice', 'key', { async call(model, method) {
			return method === 'getCounterparties' ? [{ Ref: sender, Description: 'Sender' }] : [];
		} });
		assert.equal(deletedContact.defaultContactRef, '');
		assert.ok(deletedContact.defaultsWarning);
		const deletedSender = await defaultSenderAccount(store, 'alice', 'key', { async call() { return []; } });
		assert.equal(deletedSender.defaultSenderRef, '');
		assert.ok(deletedSender.defaultsWarning);
		const rotated = await defaultSenderAccount(store, 'alice', 'changed-key', api);
		assert.equal(rotated.defaultSenderRef, '');
		assert.deepEqual(rotated.contacts, []);
		await store.save('bob', 'key', sender, contact, api);
		await store.save('alice', 'new-key', sender, contact, api);
		assert.equal(await store.get('alice', 'key'), null);
		await store.clear('alice');
		assert.equal(await store.get('alice', 'new-key'), null);
		assert.ok(await store.get('bob', 'key'));
	} finally { client.close(); }
});