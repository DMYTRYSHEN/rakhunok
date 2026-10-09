import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@libsql/client';
import { readFile } from 'node:fs/promises';
import { CustomerStore, CustomerValidationError } from './src/lib/server/tracking/customers.ts';

test('customers persist, normalize and deduplicate phones, isolate owners and support editing/removal', async () => {
	const client = createClient({ url: 'file::memory:' });
	try {
		await client.executeMultiple(await readFile(new URL('./migrations/008_customers.sql', import.meta.url), 'utf8'));
		const store = new CustomerStore(client);
		await store.save('alice', 'Test Person', '067 123-45-67');
		await store.save('alice', 'Other Person', '380671234567');
		const [saved] = await new CustomerStore(client).list('alice');
		assert.equal(saved.phone, '+380671234567');
		assert.equal(saved.name, 'Test Person');
		assert.equal((await store.list('alice')).length, 1);
		assert.deepEqual(await store.list('bob'), []);
		assert.deepEqual(await store.list("alice' OR 1=1 --"), []);
		await assert.rejects(store.save('bob', 'Other Person', '0671234567', saved.id), CustomerValidationError);
		await store.remove('bob', saved.id);
		await store.save('alice', 'Updated Person', '0681234567', saved.id);
		await store.save('alice', 'Second Person', '0691234567');
		await assert.rejects(store.save('alice', 'Updated Person', '0691234567', saved.id), CustomerValidationError);
		await assert.rejects(store.save('alice', '<script>bad</script>', '0671234567'), CustomerValidationError);
		await assert.rejects(store.save('alice', 'Test Person', '123'), CustomerValidationError);
		await store.save('bob', 'Bob Person', '0681234567');
		await store.remove('alice', saved.id);
		assert.equal((await store.list('alice')).length, 1);
		assert.equal((await store.list('bob')).length, 1);
	} finally { client.close(); }
});