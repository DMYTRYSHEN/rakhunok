import assert from 'node:assert/strict';
import test from 'node:test';

import { processCorexOperations } from './corex-operations.ts';
import { createStarterProcessDefinition } from '../../src/lib/features/corex/process-definition.ts';

const ownerUserId = '018f47a2-8391-7b1c-8f7a-f1d27670f099';

function createRpcFetcher(claimed, overrides = {}) {
	const calls = [];
	return {
		calls,
		async fetcher(input, init) {
			const name = String(input).split('/').at(-1);
			const body = JSON.parse(init.body);
			calls.push({ name, body });
			if (name === 'corex_claim_operation_items') return Response.json(claimed);
			if (name in overrides) return Response.json(await overrides[name](body));
			return Response.json({ accepted: true });
		}
	};
}

test('prepares batch starts from the persisted process definition', async () => {
	const item = {
		id: 'item-1',
		operationId: 'operation-1',
		kind: 'process_create',
		ownerUserId,
		targetId: '018f47a2-8391-7b1c-8f7a-f1d27670f061',
		payload: {
			processId: '018f47a2-8391-7b1c-8f7a-f1d27670f062',
			input: { approved: true },
			locationHint: 'weur'
		},
		claimToken: 'claim-1'
	};
	const rpc = createRpcFetcher([item], {
		corex_start_process_run: () => ({
			id: 'run-1',
			workflowInstanceId: `corex:${ownerUserId}:${item.targetId}`,
			definition: createStarterProcessDefinition()
		})
	});
	const batches = [];

	const result = await processCorexOperations({
		url: 'https://project.supabase.co',
		serviceRoleKey: 'service-role-key',
		fetcher: rpc.fetcher,
		workflow: {
			async createBatch(batch) {
				batches.push(batch);
				return batch.map(({ id }) => ({ id }));
			},
			async deleteBatch() {
				throw new Error('not used');
			},
			async get() {
				throw new Error('not used');
			}
		}
	});

	assert.deepEqual(result, { claimed: 1, completed: 1, failed: 0 });
	assert.equal(batches[0][0].id, `corex:${ownerUserId}:${item.targetId}`);
	assert.equal(batches[0][0].locationHint, 'weur');
	assert.deepEqual(batches[0][0].params.input, { approved: true });
	assert.ok(batches[0][0].params.plan);
	assert.equal(rpc.calls.at(-1).name, 'corex_complete_operation_item');
});

test('persists partial Workflow deletion outcomes and accepts already missing state', async () => {
	const claimed = ['run-1', 'run-2', 'run-3'].map((targetId, index) => ({
		id: `item-${index + 1}`,
		operationId: 'operation-1',
		kind: 'workflow_delete',
		ownerUserId,
		targetId,
		payload: { workflowInstanceId: `workflow-${index + 1}` },
		claimToken: `claim-${index + 1}`
	}));
	const rpc = createRpcFetcher(claimed);

	const result = await processCorexOperations({
		url: 'https://project.supabase.co',
		serviceRoleKey: 'service-role-key',
		fetcher: rpc.fetcher,
		workflow: {
			async createBatch() {
				throw new Error('not used');
			},
			async deleteBatch() {
				return {
					deleted: [{ id: 'workflow-1' }],
					errors: [
						{ id: 'workflow-2', code: 404, message: 'missing' },
						{ id: 'workflow-3', code: 500, message: 'unavailable' }
					]
				};
			},
			async get() {
				throw new Error('not used');
			}
		}
	});

	assert.deepEqual(result, { claimed: 3, completed: 2, failed: 1 });
	assert.deepEqual(
		rpc.calls.slice(1).map(({ name }) => name),
		['corex_complete_operation_item', 'corex_complete_operation_item', 'corex_fail_operation_item']
	);
});

test('deletes trusted output keys before Workflow state during process cleanup', async () => {
	const item = {
		id: 'item-1',
		operationId: 'operation-1',
		kind: 'process_delete',
		ownerUserId,
		targetId: 'workflow-1',
		payload: { action: 'run_cleanup', objectKeys: ['corex-output/a', 'corex-output/b'] },
		claimToken: 'claim-1'
	};
	const rpc = createRpcFetcher([item]);
	const events = [];

	const result = await processCorexOperations({
		url: 'https://project.supabase.co',
		serviceRoleKey: 'service-role-key',
		fetcher: rpc.fetcher,
		outputBucket: {
			async delete(keys) {
				events.push(['r2', keys]);
			}
		},
		workflow: {
			async createBatch() {
				throw new Error('not used');
			},
			async deleteBatch(ids) {
				events.push(['workflow', ids]);
				return { deleted: ids.map((id) => ({ id })), errors: [] };
			},
			async get() {
				throw new Error('not used');
			}
		}
	});

	assert.deepEqual(result, { claimed: 1, completed: 1, failed: 0 });
	assert.deepEqual(events, [
		['r2', ['corex-output/a', 'corex-output/b']],
		['workflow', ['workflow-1']]
	]);
});
