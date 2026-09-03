import assert from 'node:assert/strict';
import test from 'node:test';

import { createStarterProcessDefinition } from '../../src/lib/features/corex/process-definition.ts';
import { runCorexProcessWorkflow } from './corex-workflow-runner.ts';

const childProcessId = '018f47a2-8391-7b1c-8f7a-f1d27670f099';

function subprocessPayload(overrides = {}) {
	return {
		runId: 'parent-run',
		workflowInstanceId: 'parent-workflow',
		ownerUserId: 'owner-1',
		input: { payment: { id: 'pay-42' } },
		plan: {
			schemaVersion: 1,
			processId: 'parent-process',
			revision: 1,
			entryNodeId: 'invoice',
			nodes: [
				{
					id: 'invoice',
					name: 'create-invoice',
					type: 'invoke-process',
					next: 'done',
					config: {
						processId: childProcessId,
						inputPath: '$.payment',
						resultKey: 'invoice',
						timeoutMs: 86_400_000
					}
				},
				{ id: 'done', name: 'done', type: 'end-success', config: { outputExpression: '$.invoice' } }
			]
		},
		...overrides
	};
}

function durableWorkflow(
	result = { childRunId: 'child-run', status: 'complete', output: { id: 'inv-1' } },
	stepNames = []
) {
	return {
		async do(name, optionsOrCallback, callback) {
			stepNames.push(name);
			return (callback ?? optionsOrCallback)();
		},
		async waitForEvent() {
			return { payload: result };
		}
	};
}

function childDefinition() {
	return {
		...createStarterProcessDefinition(),
		id: childProcessId,
		lifecycle: 'published'
	};
}

function createHarness({ created = true, existingStatus = 'running', createError } = {}) {
	const requests = [];
	const creates = [];
	const gets = [];
	const terminations = [];
	const fetcher = async (input, init) => {
		const url = String(input);
		const body = init?.body ? JSON.parse(init.body) : undefined;
		requests.push({ url, body });
		if (url.endsWith('/corex_get_run_execution_generation')) return Response.json(1);
		if (url.endsWith('/corex_start_subprocess_run')) {
			return Response.json({
				id: 'child-run',
				workflowInstanceId: 'child-workflow',
				parentWorkflowInstanceId: 'parent-workflow',
				status: 'queued',
				definition: childDefinition(),
				created
			});
		}
		return Response.json({ ok: true });
	};
	const env = {
		SUPABASE_URL: 'https://project.supabase.co/',
		SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
		COREX_PROCESS_WORKFLOW: {
			async create(options) {
				creates.push(options);
				if (createError) throw createError;
			},
			async get(id) {
				gets.push(id);
				return {
					async status() {
						return { status: existingStatus };
					},
					async terminate(options) {
						terminations.push({ id, options });
					},
					async sendEvent() {}
				};
			}
		}
	};
	return { env, fetcher, requests, creates, gets, terminations };
}

test('creates a child from its server-compiled immutable definition', async () => {
	const harness = createHarness();
	const output = await runCorexProcessWorkflow(
		harness.env,
		subprocessPayload(),
		durableWorkflow(),
		{ fetcher: harness.fetcher, createId: () => 'proposed-workflow' }
	);

	const start = harness.requests.find((request) =>
		request.url.endsWith('/corex_start_subprocess_run')
	);
	assert.deepEqual(start.body, {
		p_process_id: childProcessId,
		p_owner_user_id: 'owner-1',
		p_parent_run_id: 'parent-run',
		p_parent_step_id: '7b4adc74642d8c4dcfcaa3c85b65bbb751bbb6a2466928f11da4ecfd8ff233aa',
		p_workflow_instance_id: 'proposed-workflow',
		p_input: { id: 'pay-42' }
	});
	assert.equal(harness.creates.length, 1);
	assert.equal(harness.creates[0].id, 'child-workflow');
	assert.equal(harness.creates[0].params.plan.processId, childProcessId);
	assert.deepEqual(harness.creates[0].params.parent, {
		runId: 'parent-run',
		workflowInstanceId: 'parent-workflow',
		stepId: 'invoice'
	});
	assert.deepEqual(output, { id: 'inv-1' });
});

test('recreates an idempotent child only when its Workflow status is unknown', async () => {
	const unknown = createHarness({ created: false, existingStatus: 'unknown' });
	await runCorexProcessWorkflow(unknown.env, subprocessPayload(), durableWorkflow(), {
		fetcher: unknown.fetcher
	});
	assert.deepEqual(unknown.gets, ['child-workflow']);
	assert.equal(unknown.creates.length, 1);

	const running = createHarness({ created: false, existingStatus: 'running' });
	await runCorexProcessWorkflow(running.env, subprocessPayload(), durableWorkflow(), {
		fetcher: running.fetcher
	});
	assert.deepEqual(running.gets, ['child-workflow']);
	assert.equal(running.creates.length, 0);
});

test('records child completion and failure without sending a best-effort parent callback', async () => {
	const childPayload = subprocessPayload({
		runId: 'child-run',
		workflowInstanceId: 'child-workflow',
		plan: {
			schemaVersion: 1,
			processId: childProcessId,
			revision: 1,
			entryNodeId: 'done',
			nodes: [{ id: 'done', name: 'done', type: 'end-success', config: {} }]
		},
		input: { invoiceId: 'inv-1' },
		parent: { runId: 'parent-run', workflowInstanceId: 'parent-workflow', stepId: 'invoice' }
	});
	const success = createHarness();
	await runCorexProcessWorkflow(success.env, childPayload, durableWorkflow(), {
		fetcher: success.fetcher
	});
	assert.equal(success.gets.includes('parent-workflow'), false);
	const completion = success.requests.find(
		(request) => request.body?.p_event_type === 'run_completed'
	);
	assert.equal(completion.body.p_status, 'complete');
	assert.deepEqual(completion.body.p_output, { invoiceId: 'inv-1' });

	const failure = createHarness();
	await assert.rejects(
		runCorexProcessWorkflow(
			failure.env,
			{ ...childPayload, plan: { ...childPayload.plan, entryNodeId: 'missing' } },
			durableWorkflow(),
			{ fetcher: failure.fetcher }
		),
		/does not exist/
	);
	assert.equal(failure.gets.includes('parent-workflow'), false);
	const failed = failure.requests.find((request) => request.body?.p_event_type === 'run_failed');
	assert.equal(failed.body.p_status, 'errored');
	assert.equal(JSON.stringify(failed).includes('does not exist'), false);
});

test('compensates a queued child when Workflow creation fails', async () => {
	const harness = createHarness({ createError: new Error('secret provider details') });
	await assert.rejects(
		runCorexProcessWorkflow(harness.env, subprocessPayload(), durableWorkflow(), {
			fetcher: harness.fetcher
		}),
		/secret provider details/
	);
	const compensation = harness.requests.find((request) =>
		request.url.endsWith('/corex_fail_process_run')
	);
	assert.deepEqual(compensation.body, {
		p_run_id: 'child-run',
		p_owner_user_id: 'owner-1',
		p_error: { code: 'workflow_create_failed' }
	});
	assert.equal(JSON.stringify(compensation).includes('secret provider details'), false);
});

test('terminates and reconciles a child when the parent wait times out', async () => {
	const harness = createHarness();
	const stepNames = [];
	const workflow = {
		async do(name, optionsOrCallback, callback) {
			stepNames.push(name);
			return (callback ?? optionsOrCallback)();
		},
		async waitForEvent() {
			throw new Error('private timeout details');
		}
	};

	await assert.rejects(
		runCorexProcessWorkflow(harness.env, subprocessPayload(), workflow, {
			fetcher: harness.fetcher,
			createId: () => 'proposed-workflow'
		}),
		/private timeout details/
	);

	assert.deepEqual(harness.terminations, [{ id: 'child-workflow', options: { rollback: true } }]);
	const termination = harness.requests.find((request) =>
		request.url.endsWith('/corex_terminate_subprocess_run')
	);
	assert.deepEqual(termination.body, {
		p_run_id: 'child-run',
		p_owner_user_id: 'owner-1',
		p_parent_run_id: 'parent-run',
		p_parent_step_id: '7b4adc74642d8c4dcfcaa3c85b65bbb751bbb6a2466928f11da4ecfd8ff233aa',
		p_workflow_instance_id: 'child-workflow'
	});
	assert.equal(stepNames.includes('create-invoice:terminate-child'), true);
	assert.equal(JSON.stringify(harness.requests).includes('private timeout details'), false);
});

test('persists branch-qualified active wait registration and completion', async () => {
	const harness = createHarness();
	const payload = subprocessPayload({
		runId: 'parallel-run',
		workflowInstanceId: 'parallel-workflow',
		plan: {
			schemaVersion: 1,
			processId: 'parallel-process',
			revision: 1,
			entryNodeId: 'parallel',
			nodes: [
				{
					id: 'parallel',
					name: 'collect',
					type: 'parallel',
					config: { branches: [{ id: 'buyer' }], resultKey: 'results' },
					branchTargets: { buyer: 'confirmed' },
					joinTarget: 'join',
					continuationTarget: 'done'
				},
				{
					id: 'confirmed',
					name: 'wait-confirmation',
					type: 'wait-event',
					next: 'join',
					config: { eventType: 'buyer_confirmed', timeoutMs: 60_000, resultKey: 'confirmation' }
				},
				{ id: 'done', name: 'done', type: 'end-success', config: {} }
			]
		}
	});
	const workflow = {
		async do(name, optionsOrCallback, callback) {
			return (callback ?? optionsOrCallback)({ step: { name, count: 1 }, attempt: 1, config: {} });
		},
		async waitForEvent() {
			return { payload: { accepted: true } };
		}
	};

	await runCorexProcessWorkflow(harness.env, payload, workflow, { fetcher: harness.fetcher });

	const registration = harness.requests.find((request) =>
		request.url.endsWith('/corex_register_active_wait')
	);
	assert.deepEqual(registration.body, {
		p_run_id: 'parallel-run',
		p_owner_user_id: 'owner-1',
		p_execution_generation: 1,
		p_step_id: 'confirmed',
		p_visit: 0,
		p_event_type: 'buyer_confirmed',
		p_wait_event_type: 'corex-wait-parallel-run-1-confirmed-0',
		p_durable_step_name: 'collect:parallel-buyer:wait-confirmation'
	});
	const completion = harness.requests.find((request) =>
		request.url.endsWith('/corex_complete_active_wait')
	);
	assert.deepEqual(completion.body, {
		p_run_id: 'parallel-run',
		p_owner_user_id: 'owner-1',
		p_execution_generation: 1,
		p_step_id: 'confirmed',
		p_visit: 0
	});
});

test('persists branch-qualified approval registration and completion', async () => {
	const harness = createHarness();
	const payload = subprocessPayload({
		runId: 'approval-run',
		workflowInstanceId: 'approval-workflow',
		plan: {
			schemaVersion: 1,
			processId: 'approval-process',
			revision: 1,
			entryNodeId: 'parallel',
			nodes: [
				{
					id: 'parallel',
					name: 'collect',
					type: 'parallel',
					config: { branches: [{ id: 'finance' }], resultKey: 'results' },
					branchTargets: { finance: 'review' },
					joinTarget: 'join',
					continuationTarget: 'done'
				},
				{
					id: 'review',
					name: 'review-finance',
					type: 'approval',
					config: { assigneeUserId: 'reviewer-1', timeoutMs: 60_000, resultKey: 'decision' },
					whenApproved: 'join',
					whenRejected: 'join'
				},
				{ id: 'done', name: 'done', type: 'end-success', config: {} }
			]
		}
	});
	const workflow = {
		async do(name, optionsOrCallback, callback) {
			return (callback ?? optionsOrCallback)({ step: { name, count: 1 }, attempt: 1, config: {} });
		},
		async waitForEvent() {
			return { payload: { decision: 'approved', actorUserId: 'reviewer-1' } };
		}
	};

	await runCorexProcessWorkflow(harness.env, payload, workflow, { fetcher: harness.fetcher });

	const registration = harness.requests.find((request) =>
		request.url.endsWith('/corex_register_active_approval')
	);
	assert.deepEqual(registration.body, {
		p_run_id: 'approval-run',
		p_owner_user_id: 'owner-1',
		p_execution_generation: 1,
		p_step_id: 'review',
		p_visit: 0,
		p_wait_event_type: 'corex-wait-approval-run-1-review-0',
		p_durable_step_name: 'collect:parallel-finance:review-finance',
		p_assignee_user_id: 'reviewer-1',
		p_timeout_ms: 60_000
	});
	const completion = harness.requests.find((request) =>
		request.url.endsWith('/corex_complete_active_wait')
	);
	assert.equal(completion.body.p_step_id, 'review');
});

test('stores external transform output through the optional R2 binding', async () => {
	const harness = createHarness();
	const puts = [];
	harness.env.COREX_OUTPUTS = {
		async put(key, value, options) {
			puts.push({ key, value, options });
			return { key };
		}
	};
	const payload = subprocessPayload({
		runId: 'external-output-run',
		plan: {
			schemaVersion: 1,
			processId: 'external-output-process',
			revision: 1,
			entryNodeId: 'shape',
			nodes: [
				{
					id: 'shape',
					name: 'shape-output',
					type: 'transform',
					next: 'done',
					config: {
						mode: 'replace',
						mappings: { customer: '$.customer' },
						outputPolicy: {
							mode: 'external',
							maxBytes: 1024,
							redactPaths: ['$.customer.email']
						}
					}
				},
				{ id: 'done', name: 'done', type: 'end-success', config: {} }
			]
		},
		input: { customer: { email: 'private@example.com', name: 'Ada' } }
	});

	const workflow = {
		async do(name, optionsOrCallback, callback) {
			return (callback ?? optionsOrCallback)({ step: { name, count: 1 }, attempt: 1, config: {} });
		}
	};
	const output = await runCorexProcessWorkflow(harness.env, payload, workflow, {
		fetcher: harness.fetcher
	});

	assert.equal(output.customer.email, 'private@example.com');
	assert.equal(puts.length, 1);
	assert.deepEqual(puts[0].options, { httpMetadata: { contentType: 'application/json' } });
	assert.deepEqual(JSON.parse(new TextDecoder().decode(puts[0].value)), {
		customer: { email: '[REDACTED]', name: 'Ada' }
	});
	const attempt = harness.requests.find((request) =>
		request.url.endsWith('/corex_record_step_attempt')
	);
	assert.deepEqual(attempt.body.p_output.external, {
		key: puts[0].key,
		bytes: puts[0].value.byteLength,
		contentType: 'application/json'
	});
});
