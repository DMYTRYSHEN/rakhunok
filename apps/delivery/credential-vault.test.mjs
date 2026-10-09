import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createClient } from '@libsql/client';
import { migrateLocal } from './migrate-local.mjs';
import { CredentialVault, CredentialVaultError } from './src/lib/server/tracking/credential-vault.ts';
import { TrackingStore } from './src/lib/server/tracking/store.ts';

async function fixture(context) {
	const directory = await mkdtemp(join(tmpdir(), 'delivery-vault-'));
	const url = `file:${join(directory, 'tracking.db')}`;
	await migrateLocal(url);
	const client = createClient({ url });
	context.after(async () => {
		client.close();
		global.gc?.();
		await rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
	});
	const master = randomBytes(32).toString('base64');
	return { client, url, vault: new CredentialVault(client, () => master), master };
}

test('local migration replays without changing tracking data and refuses remote targets', async context => {
	const { client, url } = await fixture(context);
	const store = new TrackingStore(client);
	const shipment = await store.create('alice', 'nova_poshta', 'MOCK0001');
	await migrateLocal(url);
	assert.deepEqual(await store.get(shipment.id, 'alice'), shipment);
	assert.equal((await client.execute("SELECT name FROM tracking_migrations WHERE name = '003_carrier_credentials'")).rows.length, 1);
	for (const target of ['libsql://remote.example', 'https://remote.example', 'file://remote/db', 'file:local.db']) {
		await assert.rejects(migrateLocal(target));
	}
});

test('encrypted storage is nonplaintext, randomized and survives a fresh vault', async context => {
	const { vault, client, master } = await fixture(context);
	const key = randomBytes(16).toString('hex');
	await vault.save('alice', key);
	const first = (await client.execute('SELECT * FROM delivery_carrier_credentials')).rows[0];
	assert.equal(JSON.stringify(first).includes(key), false);
	assert.equal(Buffer.from(first.nonce, 'base64').length, 12);
	assert.equal(await vault.getPersonalNovaPoshtaKey('alice'), key);
	await vault.save('alice', key);
	const second = (await client.execute('SELECT * FROM delivery_carrier_credentials')).rows[0];
	assert.notEqual(first.ciphertext, second.ciphertext);
	assert.notEqual(first.nonce, second.nonce);
	assert.equal(first.created_at, second.created_at);
	assert.equal(await new CredentialVault(client, () => master).getPersonalNovaPoshtaKey('alice'), key);
	assert.deepEqual(await vault.metadata('alice'), { configured: true, ready: true });
});

test('carrier credentials are independently encrypted and bound to carrier and owner', async context => {
	const { vault, client, url } = await fixture(context);
	const npKey = randomBytes(16).toString('hex');
	await vault.save('alice', npKey);
	for (const carrier of ['ukrposhta', 'meest']) {
		await vault.save('alice', `mock-${carrier}-token`, carrier);
		assert.equal(await vault.get('alice', carrier), `mock-${carrier}-token`);
		assert.equal(await vault.get('bob', carrier), undefined);
	}
	await migrateLocal(url);
	assert.equal(await vault.getPersonalNovaPoshtaKey('alice'), npKey);
	await vault.delete('alice', 'ukrposhta');
	assert.equal(await vault.get('alice', 'ukrposhta'), undefined);
	await client.execute("UPDATE delivery_carrier_credentials SET carrier = 'ukrposhta' WHERE carrier = 'meest'");
	await assert.rejects(vault.get('alice', 'ukrposhta'), CredentialVaultError);
	for (const token of ['', ' token', 'token\n', 'a'.repeat(1025)]) await assert.rejects(vault.save('alice', token, 'ukrposhta'));
});

test('owner isolation, SQL injection and owner AAD binding fail closed', async context => {
	const { vault, client } = await fixture(context);
	const key = randomBytes(16).toString('hex');
	await vault.save('alice', key);
	assert.equal(await vault.getPersonalNovaPoshtaKey('bob'), undefined);
	await vault.delete('bob');
	const hostile = "alice' OR 1=1 --";
	assert.equal(await vault.getPersonalNovaPoshtaKey(hostile), undefined);
	await vault.save(hostile, key);
	await vault.delete(hostile);
	assert.equal(await vault.getPersonalNovaPoshtaKey('alice'), key);
	await client.execute("UPDATE delivery_carrier_credentials SET owner_id = 'bob'");
	await assert.rejects(vault.getPersonalNovaPoshtaKey('bob'), CredentialVaultError);
});

test('wrong master key, modified ciphertext/nonce/tag and invalid configuration fail closed', async context => {
	const { vault, client } = await fixture(context);
	const key = randomBytes(16).toString('hex');
	await vault.save('alice', key);
	await assert.rejects(new CredentialVault(client, () => randomBytes(32).toString('base64')).getPersonalNovaPoshtaKey('alice'), CredentialVaultError);
	for (const column of ['ciphertext', 'nonce', 'tag']) {
		await vault.save('alice', key);
		const row = (await client.execute('SELECT * FROM delivery_carrier_credentials')).rows[0];
		const bytes = Buffer.from(row[column], 'base64');
		bytes[0] ^= 1;
		await client.execute({ sql: `UPDATE delivery_carrier_credentials SET ${column} = ? WHERE owner_id = ?`, args: [bytes.toString('base64'), 'alice'] });
		await assert.rejects(vault.getPersonalNovaPoshtaKey('alice'), CredentialVaultError);
	}
	for (const configuration of [undefined, '', 'invalid', randomBytes(31).toString('base64'), randomBytes(33).toString('base64')]) {
		const unavailable = new CredentialVault(client, () => configuration);
		assert.equal(await unavailable.getPersonalNovaPoshtaKey('absent'), undefined);
		await assert.rejects(unavailable.getPersonalNovaPoshtaKey('alice'), CredentialVaultError);
		await assert.rejects(unavailable.save('alice', key), CredentialVaultError);
		await assert.rejects(unavailable.delete('alice'), CredentialVaultError);
		await assert.rejects(unavailable.metadata('absent'), CredentialVaultError);
	}
});

test('all vault SQL uses bound owner/carrier arguments and has no route-time DDL', async () => {
	const statements = [];
	const client = { execute: async statement => { statements.push(statement); return { rows: [] }; } };
	const vault = new CredentialVault(client, () => randomBytes(32).toString('base64'));
	const owner = "owner' OR 1=1 --";
	await vault.save(owner, randomBytes(16).toString('hex'));
	await vault.getPersonalNovaPoshtaKey(owner);
	await vault.delete(owner);
	for (const statement of statements) {
		assert.equal(statement.sql.includes(owner), false);
		assert.ok(statement.args.includes(owner));
		assert.ok(statement.args.includes('nova_poshta'));
		assert.doesNotMatch(statement.sql, /\b(?:CREATE|ALTER|DROP)\b/i);
	}
});

test('direct vault callers receive safe database errors without causes', async () => {
	const secret = randomBytes(16).toString('hex');
	const client = { execute: async () => { throw new Error(secret); } };
	const vault = new CredentialVault(client, () => randomBytes(32).toString('base64'));
	for (const operation of [() => vault.getPersonalNovaPoshtaKey('alice'), () => vault.save('alice', secret), () => vault.delete('alice')]) {
		await assert.rejects(operation(), caught => {
			assert.ok(caught instanceof CredentialVaultError);
			assert.equal(caught.message, 'Credential vault unavailable');
			assert.equal(caught.cause, undefined);
			return true;
		});
	}
});