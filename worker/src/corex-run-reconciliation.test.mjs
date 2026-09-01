import assert from 'node:assert/strict';
import test from 'node:test';

import { reconcileQueuedCorexRuns } from './corex-run-reconciliation.ts';

const definition = {
	schemaVersion: 1,
	id: 'payment-callback',
	name: 'Payment callback',
	description: '',
	revision: 1,
	lifecycle: 'published',
	nodes: [
		{
			id: 'trigger',
			name: 'accept-callback',
			type: 'trigger-http',
			position: { x: 0, y: 0 },
			config: { method: 'POST', path: '/callbacks/payment' }
		},
		{
			id: 'success',
			name: 'return-success',
			type: 'end-success',
			position: { x: 280, y: 0 },
			config: {}
		}
	],
	edges: [{ id: 'trigger-success', source: 'trigger', target: 'success' }]
};

function createFixture({ status = 'unknown', createError } = {}) {
	const requests = [];
	const workflowCalls = [];
	const claim = {
		id: 'run-1',
		workflowInstanceId: 'workflow-1',
		ownerUserId: 'owner-1',
		definition,
		input: { invoiceId: 'inv-1' },
		parentRunId: null,
		parentWorkflowInstanceId: null,
		parentStepId: null,
		attempts: 1,
		claimToken: '018f47a2-8391-7b1c-8f7a-f1d27670f064'
	};
	const responses = [Response.json([claim]), Response.json({ accepted: true })];
	return {
		requests,
		workflowCalls,
		options: {
			url: 'https://project.supabase.co',
			serviceRoleKey: 'service-role-key',
			fetcher: async (input, init) => {
				requests.push({ url: String(input), body: JSON.parse(init.body) });
				return responses.shift();
			},
			workflow: {
				async get(id) {
					workflowCalls.push(['get', id]);
					return {
						async status() {
							workflowCalls.push(['status', id, status]);
							return { status };
						}
					};
				},
				async create(options) {
					workflowCalls.push(['create', options]);
					if (createError) throw createError;
				}
			}
		}
	};
}

test('creates a missing Workflow with the claimed immutable run payload', async () => {
	const fixture = createFixture();
	const result = await reconcileQueuedCorexRuns(fixture.options);

	assert.deepEqual(result, { claimed: 1, reconciled: 1, failed: 0 });
	assert.deepEqual(fixture.requests[0].body, {
		p_limit: 10,
		p_lease_seconds: 120,
		p_grace_seconds: 60
	});
	assert.equal(fixture.workflowCalls[2][0], 'create');
	assert.equal(fixture.workflowCalls[2][1].id, 'workflow-1');
	assert.equal(fixture.workflowCalls[2][1].params.runId, 'run-1');
	assert.equal(fixture.workflowCalls[2][1].params.plan.processId, 'payment-callback');
	assert.match(fixture.requests[1].url, /corex_ack_queued_run_reconciliation$/);
});

test('acknowledges a known Workflow instance without creating a duplicate', async () => {
	const fixture = createFixture({ status: 'running' });
	const result = await reconcileQueuedCorexRuns(fixture.options);

	assert.deepEqual(result, { claimed: 1, reconciled: 1, failed: 0 });
	assert.deepEqual(fixture.workflowCalls, [
		['get', 'workflow-1'],
		['status', 'workflow-1', 'running']
	]);
	assert.match(fixture.requests[1].url, /corex_ack_queued_run_reconciliation$/);
});

test('releases a failed creation with only a sanitized error code', async () => {
	const fixture = createFixture({ createError: new Error('secret upstream detail') });
	const result = await reconcileQueuedCorexRuns(fixture.options);

	assert.deepEqual(result, { claimed: 1, reconciled: 0, failed: 1 });
	assert.match(fixture.requests[1].url, /corex_fail_queued_run_reconciliation$/);
	assert.deepEqual(fixture.requests[1].body, {
		p_run_id: 'run-1',
		p_claim_token: '018f47a2-8391-7b1c-8f7a-f1d27670f064',
		p_error: { code: 'workflow_reconciliation_failed' }
	});
	assert.doesNotMatch(JSON.stringify(fixture.requests), /secret upstream detail/);
});