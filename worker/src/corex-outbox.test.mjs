import assert from 'node:assert/strict';
import test from 'node:test';

import { drainCorexOutbox } from './corex-outbox.ts';

function createOptions({ status = 'running', terminateError } = {}) {
	const requests = [];
	const workflowCalls = [];
	const statuses = Array.isArray(status) ? [...status] : [status];
	const responses = [
		Response.json([
			{
				id: 'outbox-1',
				kind: 'terminate_workflow',
				workflowInstanceId: 'workflow-1',
				attempts: 1,
				claimToken: '018f47a2-8391-7b1c-8f7a-f1d27670f064'
			}
		]),
		Response.json({ accepted: true })
	];
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
							const value = statuses.shift() ?? statuses.at(-1) ?? 'running';
							workflowCalls.push(['status', id, value]);
							return { status: value };
						},
						async terminate(options) {
							workflowCalls.push(['terminate', id, options]);
							if (terminateError) throw terminateError;
						}
					};
				}
			}
		}
	};
}

test('claims termination intents and acknowledges successful delivery', async () => {
	const fixture = createOptions();
	const result = await drainCorexOutbox(fixture.options);

	assert.deepEqual(result, { claimed: 1, delivered: 1, failed: 0 });
	assert.match(fixture.requests[0].url, /corex_claim_outbox$/);
	assert.deepEqual(fixture.requests[0].body, { p_limit: 25, p_lease_seconds: 60 });
	assert.match(fixture.requests[1].url, /corex_ack_outbox$/);
	assert.deepEqual(fixture.requests[1].body, {
		p_outbox_id: 'outbox-1',
		p_claim_token: '018f47a2-8391-7b1c-8f7a-f1d27670f064'
	});
	assert.deepEqual(fixture.workflowCalls, [
		['get', 'workflow-1'],
		['status', 'workflow-1', 'running'],
		['terminate', 'workflow-1', undefined]
	]);
});

test('acknowledges an ambiguous termination when the instance became terminal', async () => {
	const fixture = createOptions({
		status: ['running', 'terminated'],
		terminateError: new Error('timeout')
	});
	const result = await drainCorexOutbox(fixture.options);

	assert.deepEqual(result, { claimed: 1, delivered: 1, failed: 0 });
	assert.match(fixture.requests[1].url, /corex_ack_outbox$/);
	assert.deepEqual(fixture.workflowCalls.at(-1), ['status', 'workflow-1', 'terminated']);
});

test('releases failed intents with a sanitized error code', async () => {
	const fixture = createOptions({
		status: ['running', 'running'],
		terminateError: new Error('secret upstream detail')
	});
	const result = await drainCorexOutbox(fixture.options);

	assert.deepEqual(result, { claimed: 1, delivered: 0, failed: 1 });
	assert.match(fixture.requests[1].url, /corex_fail_outbox$/);
	assert.deepEqual(fixture.requests[1].body, {
		p_outbox_id: 'outbox-1',
		p_claim_token: '018f47a2-8391-7b1c-8f7a-f1d27670f064',
		p_error: { code: 'workflow_termination_failed' }
	});
	assert.doesNotMatch(JSON.stringify(fixture.requests), /secret upstream detail/);
});

function createRollbackOptions({
	payload = { requestId: '018f47a2-8391-7b1c-8f7a-f1d27670f064' },
	statuses,
	delivered,
	terminateError
}) {
	const requests = [];
	const workflowCalls = [];
	const statusQueue = [...statuses];
	const responses = [
		Response.json([
			{
				id: 'outbox-rollback-1',
				kind: 'rollback_workflow',
				workflowInstanceId: 'workflow-1',
				payload,
				attempts: 1,
				claimToken: '018f47a2-8391-7b1c-8f7a-f1d27670f065'
			}
		]),
		Response.json({ accepted: true, delivered })
	];
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
							const result = statusQueue.shift();
							workflowCalls.push(['status', id, result]);
							return result;
						},
						async terminate(options) {
							workflowCalls.push(['terminate', id, options]);
							if (terminateError) throw terminateError;
						}
					};
				}
			}
		}
	};
}

test('starts rollback once and keeps polling while Cloudflare reports running', async () => {
	const fixture = createRollbackOptions({
		statuses: [
			{ status: 'running', rollback: null },
			{ status: 'running', rollback: null }
		],
		delivered: false
	});
	const result = await drainCorexOutbox(fixture.options);

	assert.deepEqual(result, { claimed: 1, delivered: 0, failed: 0 });
	assert.deepEqual(fixture.workflowCalls[2], ['terminate', 'workflow-1', { rollback: true }]);
	assert.match(fixture.requests[1].url, /corex_reconcile_rollback_outbox$/);
	assert.equal(fixture.requests[1].body.p_platform_accepted, true);
});

test('polls an accepted rollback without dispatching it again and persists its outcome', async () => {
	const rollback = { outcome: 'complete', error: null };
	const fixture = createRollbackOptions({
		payload: { requestId: '018f47a2-8391-7b1c-8f7a-f1d27670f064', platformAccepted: true },
		statuses: [{ status: 'terminated', rollback }],
		delivered: true
	});
	const result = await drainCorexOutbox(fixture.options);

	assert.deepEqual(result, { claimed: 1, delivered: 1, failed: 0 });
	assert.equal(
		fixture.workflowCalls.some(([operation]) => operation === 'terminate'),
		false
	);
	assert.equal(fixture.requests[1].body.p_workflow_status, 'terminated');
	assert.deepEqual(fixture.requests[1].body.p_rollback, rollback);
});

test('reconciles an ambiguous rollback response when its terminal outcome is visible', async () => {
	const rollback = { outcome: 'failed', error: { name: 'Error', message: 'compensation failed' } };
	const fixture = createRollbackOptions({
		statuses: [
			{ status: 'running', rollback: null },
			{ status: 'terminated', rollback },
			{ status: 'terminated', rollback }
		],
		terminateError: new Error('timeout'),
		delivered: true
	});
	const result = await drainCorexOutbox(fixture.options);

	assert.deepEqual(result, { claimed: 1, delivered: 1, failed: 0 });
	assert.match(fixture.requests[1].url, /corex_reconcile_rollback_outbox$/);
	assert.deepEqual(fixture.requests[1].body.p_rollback, rollback);
});

function createLifecycleOptions({ kind, statuses, operationError, delivered = true }) {
	const requests = [];
	const workflowCalls = [];
	const statusQueue = [...statuses];
	const responses = [
		Response.json([
			{
				id: 'outbox-lifecycle-1',
				kind,
				workflowInstanceId: 'workflow-1',
				attempts: 1,
				claimToken: '018f47a2-8391-7b1c-8f7a-f1d27670f064'
			}
		]),
		Response.json({ accepted: true, delivered })
	];
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
							const status = statusQueue.shift();
							workflowCalls.push(['status', id, status]);
							return { status };
						},
						async pause() {
							workflowCalls.push(['pause', id]);
							if (operationError) throw operationError;
						},
						async resume() {
							workflowCalls.push(['resume', id]);
							if (operationError) throw operationError;
						}
					};
				}
			}
		}
	};
}

test('pauses a Workflow and atomically reconciles the paused run status', async () => {
	const fixture = createLifecycleOptions({
		kind: 'pause_workflow',
		statuses: ['running', 'paused']
	});
	const result = await drainCorexOutbox(fixture.options);

	assert.deepEqual(result, { claimed: 1, delivered: 1, failed: 0 });
	assert.deepEqual(fixture.workflowCalls, [
		['get', 'workflow-1'],
		['status', 'workflow-1', 'running'],
		['pause', 'workflow-1'],
		['status', 'workflow-1', 'paused']
	]);
	assert.match(fixture.requests[1].url, /corex_reconcile_lifecycle_outbox$/);
	assert.equal(fixture.requests[1].body.p_workflow_status, 'paused');
});

test('keeps an accepted pause pending while the Workflow is waitingForPause', async () => {
	const fixture = createLifecycleOptions({
		kind: 'pause_workflow',
		statuses: ['running', 'waitingForPause'],
		delivered: false
	});
	const result = await drainCorexOutbox(fixture.options);

	assert.deepEqual(result, { claimed: 1, delivered: 0, failed: 0 });
	assert.equal(fixture.requests[1].body.p_workflow_status, 'waitingForPause');
});

test('reconciles an ambiguous pause when the Workflow reached paused', async () => {
	const fixture = createLifecycleOptions({
		kind: 'pause_workflow',
		statuses: ['running', 'paused'],
		operationError: new Error('timeout')
	});
	const result = await drainCorexOutbox(fixture.options);

	assert.deepEqual(result, { claimed: 1, delivered: 1, failed: 0 });
	assert.match(fixture.requests[1].url, /corex_reconcile_lifecycle_outbox$/);
});

test('releases an unreconciled resume with a sanitized error code', async () => {
	const fixture = createLifecycleOptions({
		kind: 'resume_workflow',
		statuses: ['paused', 'paused'],
		operationError: new Error('secret upstream detail')
	});
	const result = await drainCorexOutbox(fixture.options);

	assert.deepEqual(result, { claimed: 1, delivered: 0, failed: 1 });
	assert.match(fixture.requests[1].url, /corex_fail_outbox$/);
	assert.deepEqual(fixture.requests[1].body.p_error, { code: 'workflow_resume_failed' });
	assert.doesNotMatch(JSON.stringify(fixture.requests), /secret upstream detail/);
});

test('restarts a Workflow from an exact durable step and acknowledges delivery', async () => {
	const requests = [];
	const workflowCalls = [];
	const responses = [
		Response.json([
			{
				id: 'outbox-restart-1',
				kind: 'restart_workflow',
				workflowInstanceId: 'workflow-1',
				payload: {
					requestId: '018f47a2-8391-7b1c-8f7a-f1d27670f064',
					executionGeneration: 2,
					from: { name: 'charge-card', count: 2, type: 'do' }
				},
				attempts: 1,
				claimToken: '018f47a2-8391-7b1c-8f7a-f1d27670f065'
			}
		]),
		Response.json({ accepted: true })
	];
	const result = await drainCorexOutbox({
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
					async restart(options) {
						workflowCalls.push(['restart', id, options]);
					}
				};
			}
		}
	});

	assert.deepEqual(result, { claimed: 1, delivered: 1, failed: 0 });
	assert.deepEqual(workflowCalls, [
		['get', 'workflow-1'],
		['restart', 'workflow-1', { from: { name: 'charge-card', count: 2, type: 'do' } }]
	]);
	assert.match(requests[1].url, /corex_ack_outbox$/);
});

test('releases a failed Workflow restart with a sanitized error code', async () => {
	const requests = [];
	const responses = [
		Response.json([
			{
				id: 'outbox-restart-1',
				kind: 'restart_workflow',
				workflowInstanceId: 'workflow-1',
				payload: {
					requestId: '018f47a2-8391-7b1c-8f7a-f1d27670f064',
					executionGeneration: 2
				},
				attempts: 1,
				claimToken: '018f47a2-8391-7b1c-8f7a-f1d27670f065'
			}
		]),
		Response.json({ accepted: true })
	];
	const result = await drainCorexOutbox({
		url: 'https://project.supabase.co',
		serviceRoleKey: 'service-role-key',
		fetcher: async (input, init) => {
			requests.push({ url: String(input), body: JSON.parse(init.body) });
			return responses.shift();
		},
		workflow: {
			async get() {
				return {
					async restart() {
						throw new Error('secret upstream detail');
					}
				};
			}
		}
	});

	assert.deepEqual(result, { claimed: 1, delivered: 0, failed: 1 });
	assert.match(requests[1].url, /corex_fail_outbox$/);
	assert.deepEqual(requests[1].body.p_error, { code: 'workflow_restart_failed' });
	assert.doesNotMatch(JSON.stringify(requests), /secret upstream detail/);
});

test('delivers claimed workflow events and acknowledges them', async () => {
	const requests = [];
	const workflowCalls = [];
	const responses = [
		Response.json([
			{
				id: 'outbox-event-1',
				kind: 'workflow_event',
				workflowInstanceId: 'workflow-1',
				payload: {
					type: 'corex-wait-018f47a2-8391-7b1c-8f7a-f1d27670f064-3',
					payload: { decision: 'approved', actorUserId: 'user-1', taskId: 'task-1' }
				},
				attempts: 1,
				claimToken: '018f47a2-8391-7b1c-8f7a-f1d27670f065'
			}
		]),
		Response.json({ accepted: true })
	];
	const result = await drainCorexOutbox({
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
					async sendEvent(event) {
						workflowCalls.push(['sendEvent', id, event]);
					}
				};
			}
		}
	});

	assert.deepEqual(result, { claimed: 1, delivered: 1, failed: 0 });
	assert.deepEqual(workflowCalls, [
		['get', 'workflow-1'],
		[
			'sendEvent',
			'workflow-1',
			{
				type: 'corex-wait-018f47a2-8391-7b1c-8f7a-f1d27670f064-3',
				payload: { decision: 'approved', actorUserId: 'user-1', taskId: 'task-1' }
			}
		]
	]);
	assert.match(requests[1].url, /corex_ack_outbox$/);
});

test('releases failed workflow events with a sanitized error code', async () => {
	const requests = [];
	const responses = [
		Response.json([
			{
				id: 'outbox-event-1',
				kind: 'workflow_event',
				workflowInstanceId: 'workflow-1',
				payload: {
					type: 'corex-wait-018f47a2-8391-7b1c-8f7a-f1d27670f064-3',
					payload: { taskId: 'task-1' }
				},
				attempts: 1,
				claimToken: '018f47a2-8391-7b1c-8f7a-f1d27670f065'
			}
		]),
		Response.json({ accepted: true })
	];
	const result = await drainCorexOutbox({
		url: 'https://project.supabase.co',
		serviceRoleKey: 'service-role-key',
		fetcher: async (input, init) => {
			requests.push({ url: String(input), body: JSON.parse(init.body) });
			return responses.shift();
		},
		workflow: {
			async get() {
				return {
					async sendEvent() {
						throw new Error('secret upstream detail');
					}
				};
			}
		}
	});

	assert.deepEqual(result, { claimed: 1, delivered: 0, failed: 1 });
	assert.deepEqual(requests[1].body.p_error, { code: 'workflow_event_delivery_failed' });
	assert.doesNotMatch(JSON.stringify(requests), /secret upstream detail/);
});

test('delivers a claimed parent callback and acknowledges it', async () => {
	const requests = [];
	const workflowCalls = [];
	const childRunId = '018f47a2-8391-7b1c-8f7a-f1d27670f099';
	const responses = [
		Response.json([
			{
				id: 'outbox-callback-1',
				kind: 'parent_callback',
				workflowInstanceId: 'parent-workflow',
				payload: {
					type: `corex-subprocess-result:${childRunId}`,
					payload: { childRunId, status: 'complete', output: { invoiceId: 'inv-1' } }
				},
				attempts: 1,
				claimToken: '018f47a2-8391-7b1c-8f7a-f1d27670f066'
			}
		]),
		Response.json({ accepted: true })
	];
	const result = await drainCorexOutbox({
		url: 'https://project.supabase.co',
		serviceRoleKey: 'service-role-key',
		fetcher: async (input, init) => {
			requests.push({ url: String(input), body: JSON.parse(init.body) });
			return responses.shift();
		},
		workflow: {
			async get(id) {
				return {
					async sendEvent(event) {
						workflowCalls.push(['sendEvent', id, event]);
					}
				};
			}
		}
	});

	assert.deepEqual(result, { claimed: 1, delivered: 1, failed: 0 });
	assert.equal(workflowCalls[0][1], 'parent-workflow');
	assert.equal(workflowCalls[0][2].payload.childRunId, childRunId);
	assert.match(requests[1].url, /corex_ack_outbox$/);
});
