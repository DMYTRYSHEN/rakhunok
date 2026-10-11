import assert from 'node:assert/strict';
import { test } from 'node:test';
import { acceptanceConfig, cleanupFixtures } from './onboarding-jwt-acceptance.mjs';

const config = {
	ONBOARDING_TEST_PROJECT: 'isolated-test', ONBOARDING_TEST_URL: 'https://isolated-test.supabase.co',
	ONBOARDING_TEST_KEY: 'sb_publishable_test', ONBOARDING_ALLOW_TEST_WRITES: 'yes',
	ONBOARDING_NEW_OWNER_ID: '11111111-1111-4111-8111-111111111111',
	ONBOARDING_EXISTING_OWNER_ID: '22222222-2222-4222-8222-222222222222'
};

test('JWT acceptance rejects shared targets, secret keys and unapproved identities before browser login', () => {
	assert.equal(acceptanceConfig(config).url, config.ONBOARDING_TEST_URL);
	for (const patch of [
		{ ONBOARDING_TEST_PROJECT: 'mwaeazabpvbxqfrceogr', ONBOARDING_TEST_URL: 'https://mwaeazabpvbxqfrceogr.supabase.co' },
		{ ONBOARDING_TEST_URL: 'https://another.supabase.co' },
		{ ONBOARDING_TEST_URL: 'http://isolated-test.supabase.co' },
		{ ONBOARDING_TEST_URL: 'https://isolated-test.supabase.co/rest/v1' },
		{ ONBOARDING_TEST_URL: 'https://secret@isolated-test.supabase.co' },
		{ ONBOARDING_ALLOW_TEST_WRITES: '' },
		{ ONBOARDING_TEST_KEY: 'sb_secret_do_not_use' },
		{ ONBOARDING_NEW_OWNER_ID: '' },
		{ ONBOARDING_EXISTING_OWNER_ID: config.ONBOARDING_NEW_OWNER_ID }
	]) assert.throws(() => acceptanceConfig({ ...config, ...patch }));
});

test('cleanup attempts every exact owner-bound fixture even after a failure', async () => {
	const calls = [];
	const session = { supabase: { from(table) {
		const filters = {};
		const query = {
			delete() { return query; },
			eq(key, value) { filters[key] = value; return query; },
			async select(columns) {
				calls.push({ table, filters, columns });
				if (filters.id === 'second') throw new Error('Untrusted failure containing secret material');
				return { error: null, data: [{ id: filters.id }] };
			}
		};
		return query;
	} } };
	const outstanding = await cleanupFixtures([[session, 'owner', 'first'], [session, 'owner', 'second']],
		{ session, owner: 'owner', id: 'merchant' });
	assert.deepEqual(outstanding, [{ table: 'business_entities', id: 'second', owner: 'owner' }]);
	assert.deepEqual(calls, [
		{ table: 'business_entities', filters: { id: 'second', user_id: 'owner' }, columns: 'id' },
		{ table: 'business_entities', filters: { id: 'first', user_id: 'owner' }, columns: 'id' },
		{ table: 'merchants', filters: { id: 'merchant', user_id: 'owner' }, columns: 'id' }
	]);
});

test('cleanup requires the exact returned ID and preserves its input list', async () => {
	const query = { delete() { return query; }, eq() { return query; },
		async select() { return { error: null, data: [{ id: 'different' }] }; } };
	const session = { supabase: { from() { return query; } } };
	const fixtures = [[session, 'owner', 'expected']];
	assert.deepEqual(await cleanupFixtures(fixtures, null), [{ table: 'business_entities', id: 'expected', owner: 'owner' }]);
	assert.equal(fixtures[0][2], 'expected');
});