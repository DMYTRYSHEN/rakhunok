import assert from 'node:assert/strict';
import test from 'node:test';

import { purgeRetainedCorexRuns } from './corex-run-retention.ts';

function createFixture({
	objectKeys = ['corex-output/one.json'],
	deleteError,
	outputBucket = true
} = {}) {
	const requests = [];
	const deleted = [];
	const responses = [
		Response.json([
			{
				id: 'job-1',
				runId: 'run-1',
				objectKeys,
				attempts: 1,
				claimToken: 'claim-1'
			}
		]),
		Response.json({ accepted: true })
	];
	return {
		requests,
		deleted,
		options: {
			url: 'https://project.supabase.co',
			serviceRoleKey: 'service-role-key',
			fetcher: async (input, init) => {
				requests.push({ url: String(input), body: JSON.parse(init.body) });
				return responses.shift();
			},
			...(outputBucket
				? {
						outputBucket: {
							async delete(keys) {
								deleted.push(keys);
								if (deleteError) throw deleteError;
							}
						}
					}
				: {})
		}
	};
}

test('returns an empty summary when no retained runs are claimable', async () => {
	const requests = [];
	const result = await purgeRetainedCorexRuns({
		url: 'https://project.supabase.co',
		serviceRoleKey: 'service-role-key',
		fetcher: async (input, init) => {
			requests.push({ url: String(input), body: JSON.parse(init.body) });
			return Response.json([]);
		}
	});

	assert.deepEqual(result, { claimed: 0, purged: 0, failed: 0 });
	assert.equal(requests.length, 1);
});

test('rejects a failed retention claim RPC', async () => {
	await assert.rejects(
		purgeRetainedCorexRuns({
			url: 'https://project.supabase.co',
			serviceRoleKey: 'service-role-key',
			fetcher: async () => Response.json({ message: 'private detail' }, { status: 500 })
		}),
		/Could not claim retained Corex runs for purge/
	);
});

test('deletes authoritative output keys before completing a retained run purge', async () => {
	const fixture = createFixture({ objectKeys: ['corex-output/one.json', 'corex-output/two.json'] });
	const result = await purgeRetainedCorexRuns(fixture.options);

	assert.deepEqual(result, { claimed: 1, purged: 1, failed: 0 });
	assert.deepEqual(fixture.requests[0].body, {
		p_limit: 10,
		p_lease_seconds: 120,
		p_retention_days: 30
	});
	assert.deepEqual(fixture.deleted, [['corex-output/one.json', 'corex-output/two.json']]);
	assert.match(fixture.requests[1].url, /corex_complete_retention_purge$/);
	assert.deepEqual(fixture.requests[1].body, { p_job_id: 'job-1', p_claim_token: 'claim-1' });
});

test('completes a retained run purge without an output binding when no objects exist', async () => {
	const fixture = createFixture({ objectKeys: [], outputBucket: false });
	const result = await purgeRetainedCorexRuns(fixture.options);

	assert.deepEqual(result, { claimed: 1, purged: 1, failed: 0 });
	assert.deepEqual(fixture.deleted, []);
	assert.match(fixture.requests[1].url, /corex_complete_retention_purge$/);
});

test('deletes large authoritative key sets in bounded batches', async () => {
	const objectKeys = Array.from({ length: 1_001 }, (_, index) => `corex-output/${index}.json`);
	const fixture = createFixture({ objectKeys });
	const result = await purgeRetainedCorexRuns(fixture.options);

	assert.deepEqual(result, { claimed: 1, purged: 1, failed: 0 });
	assert.deepEqual(
		fixture.deleted.map((keys) => keys.length),
		[1_000, 1]
	);
});

test('releases a failed output deletion with only a sanitized error code', async () => {
	const fixture = createFixture({ deleteError: new Error('secret R2 detail') });
	const result = await purgeRetainedCorexRuns(fixture.options);

	assert.deepEqual(result, { claimed: 1, purged: 0, failed: 1 });
	assert.match(fixture.requests[1].url, /corex_fail_retention_purge$/);
	assert.deepEqual(fixture.requests[1].body, {
		p_job_id: 'job-1',
		p_claim_token: 'claim-1',
		p_error: { code: 'output_deletion_failed' }
	});
	assert.doesNotMatch(JSON.stringify(fixture.requests), /secret R2 detail/);
});

test('does not finalize object-backed purge work without an output binding', async () => {
	const fixture = createFixture({ outputBucket: false });
	const result = await purgeRetainedCorexRuns(fixture.options);

	assert.deepEqual(result, { claimed: 1, purged: 0, failed: 1 });
	assert.match(fixture.requests[1].url, /corex_fail_retention_purge$/);
	assert.deepEqual(fixture.requests[1].body.p_error, { code: 'output_storage_unavailable' });
});

test('rejects a failed retention state update after object deletion', async () => {
	const fixture = createFixture();
	fixture.options.fetcher = async (input, init) => {
		fixture.requests.push({ url: String(input), body: JSON.parse(init.body) });
		if (fixture.requests.length === 1) {
			return Response.json([
				{
					id: 'job-1',
					runId: 'run-1',
					objectKeys: ['corex-output/one.json'],
					attempts: 1,
					claimToken: 'claim-1'
				}
			]);
		}
		return Response.json({ message: 'stale claim' }, { status: 409 });
	};

	await assert.rejects(
		purgeRetainedCorexRuns(fixture.options),
		/Could not update Corex retention purge state/
	);
	assert.deepEqual(fixture.deleted, [['corex-output/one.json']]);
	assert.match(fixture.requests[1].url, /corex_complete_retention_purge$/);
});

test('rejects malformed purge claims before deleting output', async () => {
	const fixture = createFixture({ objectKeys: ['other-prefix/one.json'] });

	await assert.rejects(
		purgeRetainedCorexRuns(fixture.options),
		/Corex retention purge returned invalid data/
	);
	assert.deepEqual(fixture.deleted, []);
	assert.equal(fixture.requests.length, 1);
});
