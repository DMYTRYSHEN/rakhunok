import assert from 'node:assert/strict';
import test from 'node:test';

import { executeCorexWorkflow, executeHttpAction, recordCorexRunEvent } from './corex-runtime.ts';

function action(overrides = {}) {
	return {
		id: 'forward',
		name: 'forward-payment',
		type: 'http-request',
		config: {
			method: 'POST',
			url: 'https://api.example.com/payments',
			timeoutMs: 30_000,
			retry: { limit: 3, backoff: 'exponential' },
			idempotencyKey: '$.paymentId',
			...overrides
		},
		next: 'done'
	};
}

function graphPlan(nodes, entryNodeId = nodes[0].id) {
	return {
		schemaVersion: 1,
		processId: 'process-1',
		revision: 3,
		entryNodeId,
		nodes: [...nodes, { id: 'done', name: 'Done', type: 'end-success', config: {} }]
	};
}

function durableWorkflow() {
	return {
		async do(_name, optionsOrCallback, callback) {
			return (callback ?? optionsOrCallback)();
		}
	};
}

test('executes an HTTP action with JSON input and an idempotency key', async () => {
	let captured;
	const result = await executeHttpAction(action(), { paymentId: 42, amount: 100 }, async (url, init) => {
		captured = { url, init };
		return Response.json({ accepted: true }, { status: 202 });
	});

	assert.equal(captured.url, 'https://api.example.com/payments');
	assert.equal(captured.init.headers.get('Idempotency-Key'), '42');
	assert.equal(captured.init.body, '{"paymentId":42,"amount":100}');
	assert.deepEqual(result, {
		status: 202,
		contentType: 'application/json',
		body: { accepted: true }
	});
});

test('does not send a request body for GET actions', async () => {
	let captured;
	await executeHttpAction(action({ method: 'GET' }), { paymentId: 'pay-1' }, async (_url, init) => {
		captured = init;
		return new Response('', { status: 200 });
	});

	assert.equal('body' in captured, false);
});

test('fails retryably on upstream errors without persisting the response body', async () => {
	await assert.rejects(
		executeHttpAction(action(), {}, async () => new Response('sensitive details', { status: 503 })),
		/HTTP action failed with status 503/
	);
});

test('rejects response bodies larger than the durable output limit', async () => {
	await assert.rejects(
		executeHttpAction(action(), {}, async () => new Response('x'.repeat(64 * 1024 + 1))),
		/exceeds 64 KiB/
	);
});

test('records a run lifecycle event through the service-only RPC', async () => {
	let captured;
	await recordCorexRunEvent(
		{
			url: 'https://project.supabase.co/',
			serviceRoleKey: 'service-role-key'
		},
		{
			runId: 'run-1',
			ownerUserId: 'user-1',
			sequence: 2,
			status: 'running',
			eventType: 'step_completed',
			stepName: 'forward-payment',
			payload: { status: 202 }
		},
		async (url, init) => {
			captured = { url, init };
			return Response.json({ id: 'run-1', status: 'running' });
		}
	);

	assert.equal(captured.url, 'https://project.supabase.co/rest/v1/rpc/corex_record_run_event');
	assert.equal(captured.init.headers.Authorization, 'Bearer service-role-key');
	assert.equal(captured.init.headers.apikey, 'service-role-key');
	assert.deepEqual(JSON.parse(captured.init.body), {
		p_run_id: 'run-1',
		p_owner_user_id: 'user-1',
		p_sequence: 2,
		p_status: 'running',
		p_event_type: 'step_completed',
		p_step_name: 'forward-payment',
		p_payload: { status: 202 },
		p_output: null,
		p_error: null
	});
});

test('fails when the run lifecycle RPC rejects an update', async () => {
	await assert.rejects(
		recordCorexRunEvent(
			{ url: 'https://project.supabase.co', serviceRoleKey: 'service-role-key' },
			{
				runId: 'run-1',
				ownerUserId: 'user-1',
				sequence: 0,
				status: 'running',
				eventType: 'run_started'
			},
			async () => Response.json({ message: 'private details' }, { status: 409 })
		),
		/Could not record the run event/
	);
});

test('executes a plan with deterministic durable lifecycle events', async () => {
	const durableSteps = [];
	const events = [];
	const result = await executeCorexWorkflow(
		{
			runId: 'run-1',
			ownerUserId: 'user-1',
			input: { paymentId: 'pay-42' },
			plan: graphPlan([action()])
		},
		{
			async do(name, optionsOrCallback, callback) {
				durableSteps.push(name);
				return (callback ?? optionsOrCallback)();
			}
		},
		async (event) => events.push(event),
		async () => Response.json({ accepted: true }, { status: 202 })
	);

	assert.deepEqual(durableSteps, [
		'corex:run-started',
		'corex:step-started:0',
		'forward-payment',
		'corex:step-completed:0',
		'corex:run-completed'
	]);
	assert.deepEqual(events.map((event) => [event.sequence, event.status, event.eventType]), [
		[0, 'running', 'run_started'],
		[1, 'running', 'step_started'],
		[2, 'running', 'step_completed'],
		[3, 'complete', 'run_completed']
	]);
	assert.deepEqual(result, { accepted: true });
});

test('projects the completed run output through the success terminal expression', async () => {
	const events = [];
	const plan = graphPlan([
		{
			id: 'shape', name: 'shape-input', type: 'transform', next: 'done',
			config: { mode: 'merge', mappings: { result: '$.payment' } }
		}
	]);
	plan.nodes.at(-1).config.outputExpression = '$.result';

	const output = await executeCorexWorkflow(
		{ runId: 'run-1', ownerUserId: 'user-1', input: { payment: { id: 'pay-42' }, internal: true }, plan },
		durableWorkflow(),
		async (event) => events.push(event)
	);

	assert.deepEqual(output, { id: 'pay-42' });
	assert.deepEqual(events.at(-1).output, { id: 'pay-42' });
});

test('returns the complete context when the success terminal has no output expression', async () => {
	const input = { payment: { id: 'pay-42' } };
	const output = await executeCorexWorkflow(
		{ runId: 'run-1', ownerUserId: 'user-1', input, plan: graphPlan([] , 'done') },
		durableWorkflow(),
		async () => undefined
	);

	assert.deepEqual(output, input);
});

test('transforms context, selects a condition branch, and performs a durable wait', async () => {
	const durableSleeps = [];
	const requests = [];
	const events = [];
	const plan = graphPlan([
		{
			id: 'shape', name: 'shape-input', type: 'transform', next: 'large',
			config: { mode: 'merge', mappings: { normalizedId: '$.payment.id' } }
		},
		{
			id: 'large', name: 'is-large', type: 'condition', whenTrue: 'wait', whenFalse: 'send',
			config: { path: '$.amount', operator: 'greater-than', value: 100 }
		},
		{ id: 'wait', name: 'settlement-delay', type: 'wait', config: { durationMs: 5_000 }, next: 'send' },
		{ ...action(), id: 'send', name: 'send-payment' }
	]);

	const result = await executeCorexWorkflow(
		{ runId: 'run-1', ownerUserId: 'user-1', input: { payment: { id: 'pay-42' }, amount: 125 }, plan },
		{
			async do(_name, optionsOrCallback, callback) { return (callback ?? optionsOrCallback)(); },
			async sleep(name, duration) { durableSleeps.push([name, duration]); }
		},
		async (event) => events.push(event),
		async (_url, init) => {
			requests.push(JSON.parse(init.body));
			return Response.json({ accepted: true });
		}
	);

	assert.deepEqual(durableSleeps, [['settlement-delay', '5000 milliseconds']]);
	assert.deepEqual(requests, [{ payment: { id: 'pay-42' }, amount: 125, normalizedId: 'pay-42' }]);
	assert.deepEqual(events.map((event) => event.sequence), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
	assert.deepEqual(result, { accepted: true });
});

test('takes the false condition branch without sleeping', async () => {
	const durableSleeps = [];
	const plan = graphPlan([
		{
			id: 'large', name: 'is-large', type: 'condition', whenTrue: 'wait', whenFalse: 'send',
			config: { path: '$.amount', operator: 'greater-than', value: 100 }
		},
		{ id: 'wait', name: 'settlement-delay', type: 'wait', config: { durationMs: 5_000 }, next: 'send' },
		{ ...action(), id: 'send', name: 'send-payment' }
	]);

	await executeCorexWorkflow(
		{ runId: 'run-1', ownerUserId: 'user-1', input: { amount: 25 }, plan },
		{
			async do(_name, optionsOrCallback, callback) { return (callback ?? optionsOrCallback)(); },
			async sleep(name, duration) { durableSleeps.push([name, duration]); }
		},
		async () => undefined,
		async () => Response.json({ accepted: true })
	);

	assert.deepEqual(durableSleeps, []);
});

test('waits for an external event and adds its payload to process context', async () => {
	const eventWaits = [];
	const requests = [];
	const plan = graphPlan([
		{
			id: 'approval', name: 'wait-for-approval', type: 'wait-event', next: 'send',
			config: { eventType: 'payment-approved', timeoutMs: 86_400_000, resultKey: 'approval' }
		},
		{ ...action(), id: 'send', name: 'send-payment' }
	]);

	const result = await executeCorexWorkflow(
		{ runId: 'run-1', ownerUserId: 'user-1', input: { paymentId: 'pay-42' }, plan },
		{
			async do(_name, optionsOrCallback, callback) { return (callback ?? optionsOrCallback)(); },
			async sleep() {},
			async waitForEvent(name, options) {
				eventWaits.push([name, options]);
				return { payload: { approved: true, approvedBy: 'owner-1' } };
			}
		},
		async () => undefined,
		async (_url, init) => {
			requests.push(JSON.parse(init.body));
			return Response.json({ accepted: true });
		}
	);

	assert.deepEqual(eventWaits, [[
		'wait-for-approval',
		{ type: 'payment-approved', timeout: '86400000 milliseconds' }
	]]);
	assert.deepEqual(requests, [{
		paymentId: 'pay-42',
		approval: { approved: true, approvedBy: 'owner-1' }
	}]);
	assert.deepEqual(result, { accepted: true });
});

test('records a sanitized terminal event when a process step fails', async () => {
	const events = [];
	await assert.rejects(
		executeCorexWorkflow(
			{
				runId: 'run-1',
				ownerUserId: 'user-1',
				input: {},
				plan: graphPlan([action()])
			},
			{
				async do(_name, optionsOrCallback, callback) {
					return (callback ?? optionsOrCallback)();
				}
			},
			async (event) => events.push(event),
			async () => new Response('secret response', { status: 503 })
		),
		/HTTP action failed with status 503/
	);

	assert.deepEqual(events.at(-1), {
		runId: 'run-1',
		ownerUserId: 'user-1',
		sequence: 2,
		status: 'errored',
		eventType: 'run_failed',
		payload: {},
		error: { code: 'process_step_failed', stepId: 'forward' }
	});
	assert.equal(JSON.stringify(events).includes('secret response'), false);
});

test('waits for and audits a validated human approval decision', async () => {
	const events = [];
	const calls = [];
	const output = await executeCorexWorkflow({
		runId: 'run-approval', ownerUserId: 'user-1', input: { amount: 900 },
		plan: {
			schemaVersion: 1, processId: 'process-1', revision: 1, entryNodeId: 'approval',
			nodes: [
				{ id: 'approval', name: 'review-payment', type: 'approval', config: { assigneeUserId: 'user-1', timeoutMs: 86400000, resultKey: 'approval' }, next: 'success' },
				{ id: 'success', name: 'return-success', type: 'end-success', config: {} }
			]
		}
	}, {
		async do(name, optionsOrCallback, maybeCallback) {
			const callback = maybeCallback ?? optionsOrCallback;
			return callback();
		},
		async sleep() {},
		async waitForEvent(name, options) {
			calls.push([name, options]);
			return { payload: { decision: 'approved', comment: 'Verified', actorUserId: 'user-1' } };
		}
	}, async (event) => events.push(event));

	assert.deepEqual(calls, [['review-payment', { type: 'corex-approval', timeout: '86400000 milliseconds' }]]);
	assert.deepEqual(events[1].payload, { stepId: 'approval', stepType: 'approval', assigneeUserId: 'user-1', timeoutMs: 86400000 });
	assert.deepEqual(output, { amount: 900, approval: { decision: 'approved', comment: 'Verified', actorUserId: 'user-1' } });
	assert.deepEqual(events[2].payload.decision, { decision: 'approved', comment: 'Verified', actorUserId: 'user-1' });
});