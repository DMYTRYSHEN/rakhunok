import assert from 'node:assert/strict';
import test from 'node:test';

import {
	executeCorexWorkflow,
	executeHttpAction,
	recordCorexRunEvent,
	recordCorexStepAttempt
} from './corex-runtime.ts';

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
	const result = await executeHttpAction(
		action(),
		{ paymentId: 42, amount: 100 },
		async (url, init) => {
			captured = { url, init };
			return Response.json({ accepted: true }, { status: 202 });
		}
	);

	assert.equal(captured.url, 'https://api.example.com/payments');
	assert.equal(captured.init.headers.get('Idempotency-Key'), '42');
	assert.equal(captured.init.body, '{"paymentId":42,"amount":100}');
	assert.deepEqual(result, {
		status: 202,
		contentType: 'application/json',
		bytes: 17,
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

test('records HTTP retry attempts with stable identity and sanitized metadata', async () => {
	const attempts = [];
	let requestCount = 0;
	const workflow = {
		async do(_name, optionsOrCallback, callback) {
			const operation = callback ?? optionsOrCallback;
			if (!callback) return operation({ step: { name: _name, count: 1 }, attempt: 1, config: {} });
			try {
				return await operation({ step: { name: _name, count: 1 }, attempt: 1, config: {} });
			} catch {
				return operation({ step: { name: _name, count: 1 }, attempt: 2, config: {} });
			}
		}
	};

	const result = await executeCorexWorkflow(
		{
			runId: 'run-1',
			ownerUserId: 'user-1',
			input: { paymentId: 'pay-42' },
			plan: graphPlan([action()])
		},
		workflow,
		async () => undefined,
		async () => {
			requestCount += 1;
			return requestCount === 1
				? new Response('private upstream failure', { status: 503 })
				: Response.json({ accepted: true }, { status: 202 });
		},
		undefined,
		undefined,
		4,
		async (attempt) => attempts.push(attempt)
	);

	assert.deepEqual(result, { accepted: true });
	assert.equal(attempts.length, 2);
	assert.deepEqual(
		attempts.map(({ startedAt, finishedAt, ...attempt }) => attempt),
		[
			{
				runId: 'run-1',
				ownerUserId: 'user-1',
				executionGeneration: 4,
				stepId: 'forward',
				visit: 0,
				durableStepName: 'forward-payment',
				attempt: 1,
				outcome: 'failed',
				retry: { limit: 3, backoff: 'exponential', timeoutMs: 30_000 },
				error: { code: 'http_action_failed' }
			},
			{
				runId: 'run-1',
				ownerUserId: 'user-1',
				executionGeneration: 4,
				stepId: 'forward',
				visit: 0,
				durableStepName: 'forward-payment',
				attempt: 2,
				outcome: 'complete',
				retry: { limit: 3, backoff: 'exponential', timeoutMs: 30_000 },
				output: { status: 202, contentType: 'application/json', bytes: 17 }
			}
		]
	);
	assert.equal(JSON.stringify(attempts).includes('private upstream failure'), false);
	assert.equal(attempts.every((attempt) => Date.parse(attempt.finishedAt) >= Date.parse(attempt.startedAt)), true);
});

test('ignores an attempt recorder failure after one successful HTTP side effect', async () => {
	let requestCount = 0;
	const result = await executeCorexWorkflow(
		{ runId: 'run-1', ownerUserId: 'user-1', input: {}, plan: graphPlan([action()]) },
		{
			async do(name, optionsOrCallback, callback) {
				return (callback ?? optionsOrCallback)({
					step: { name, count: 1 }, attempt: 1, config: {}
				});
			}
		},
		async () => undefined,
		async () => {
			requestCount += 1;
			return Response.json({ accepted: true });
		},
		undefined,
		undefined,
		1,
		async () => {
			throw new Error('telemetry unavailable');
		}
	);

	assert.deepEqual(result, { accepted: true });
	assert.equal(requestCount, 1);
});

test('preserves the HTTP action failure when failed-attempt recording also fails', async () => {
	await assert.rejects(
		executeCorexWorkflow(
			{ runId: 'run-1', ownerUserId: 'user-1', input: {}, plan: graphPlan([action()]) },
			{
				async do(name, optionsOrCallback, callback) {
					return (callback ?? optionsOrCallback)({
						step: { name, count: 1 }, attempt: 1, config: {}
					});
				}
			},
			async () => undefined,
			async () => new Response('private upstream failure', { status: 503 }),
			undefined,
			undefined,
			1,
			async () => {
				throw new Error('telemetry unavailable');
			}
		),
		/HTTP action failed with status 503/
	);
});

test('records a step attempt through the service-only RPC', async () => {
	let request;
	await recordCorexStepAttempt(
		{ url: 'https://project.supabase.co/', serviceRoleKey: 'secret' },
		{
			runId: 'run-1', ownerUserId: 'user-1', executionGeneration: 2,
			stepId: 'forward', visit: 3, durableStepName: 'forward-payment [visit 3]', attempt: 2,
			startedAt: '2026-09-01T08:00:00.000Z', finishedAt: '2026-09-01T08:00:01.000Z',
			outcome: 'complete', retry: { limit: 3, backoff: 'exponential', timeoutMs: 30_000 },
			output: { status: 202, contentType: 'application/json', bytes: 17 }
		},
		async (url, init) => {
			request = { url, init };
			return Response.json({ accepted: true });
		}
	);

	assert.equal(request.url, 'https://project.supabase.co/rest/v1/rpc/corex_record_step_attempt');
	assert.equal(request.init.headers.Authorization, 'Bearer secret');
	assert.deepEqual(JSON.parse(request.init.body), {
		p_run_id: 'run-1', p_owner_user_id: 'user-1', p_execution_generation: 2,
		p_step_id: 'forward', p_visit: 3, p_durable_step_name: 'forward-payment [visit 3]',
		p_attempt: 2, p_started_at: '2026-09-01T08:00:00.000Z',
		p_finished_at: '2026-09-01T08:00:01.000Z', p_outcome: 'complete',
		p_retry: { limit: 3, backoff: 'exponential', timeoutMs: 30_000 },
		p_output: { status: 202, contentType: 'application/json', bytes: 17 }, p_error: null
	});
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
	assert.deepEqual(
		events.map((event) => [event.sequence, event.status, event.eventType]),
		[
			[0, 'running', 'run_started'],
			[1, 'running', 'step_started'],
			[2, 'running', 'step_completed'],
			[3, 'complete', 'run_completed']
		]
	);
	assert.deepEqual(result, { accepted: true });
});

test('executes parallel branches concurrently and merges results in configured order', async () => {
	const durableSteps = [];
	const events = [];
	const releases = new Map();
	const started = [];
	const plan = graphPlan([
		{
			id: 'parallel',
			name: 'prepare-payment',
			type: 'parallel',
			config: { branches: [{ id: 'risk' }, { id: 'receipt' }], resultKey: 'preparation' },
			branchTargets: { risk: 'risk', receipt: 'receipt' },
			joinTarget: 'join',
			continuationTarget: 'finish'
		},
		{
			id: 'risk',
			name: 'calculate-risk',
			type: 'http-request',
			config: {
				method: 'POST',
				url: 'https://api.example.com/risk',
				timeoutMs: 30_000,
				retry: { limit: 1, backoff: 'constant' }
			},
			next: 'join'
		},
		{
			id: 'receipt',
			name: 'prepare-receipt',
			type: 'http-request',
			config: {
				method: 'POST',
				url: 'https://api.example.com/receipt',
				timeoutMs: 30_000,
				retry: { limit: 1, backoff: 'constant' }
			},
			next: 'join'
		},
		{
			id: 'finish',
			name: 'finish-payment',
			type: 'transform',
			config: { mode: 'merge', mappings: { finished: '$.paymentId' } },
			next: 'done'
		}
	]);

	const execution = executeCorexWorkflow(
		{ runId: 'run-parallel', ownerUserId: 'user-1', input: { paymentId: 'pay-42' }, plan },
		{
			async do(name, optionsOrCallback, callback) {
				durableSteps.push(name);
				return (callback ?? optionsOrCallback)();
			}
		},
		async (event) => events.push(event),
		async (url, init) => {
			const branch = url.endsWith('/risk') ? 'risk' : 'receipt';
			started.push(branch);
			assert.deepEqual(JSON.parse(init.body), { paymentId: 'pay-42' });
			await new Promise((resolve) => releases.set(branch, resolve));
			return Response.json({ branch });
		}
	);

	while (started.length < 2) await new Promise((resolve) => setImmediate(resolve));
	assert.deepEqual(started, ['risk', 'receipt']);
	assert.equal(events.some((event) => event.eventType === 'run_completed'), false);
	for (const branch of ['receipt', 'risk']) releases.get(branch)();

	const output = await execution;
	assert.deepEqual(Object.keys(output.preparation), ['risk', 'receipt']);
	assert.deepEqual(output, {
		paymentId: 'pay-42',
		preparation: {
			risk: { branch: 'risk' },
			receipt: { branch: 'receipt' }
		},
		finished: 'pay-42'
	});
	assert.equal(events.filter((event) => event.stepName === 'finish-payment').length, 2);
	assert.deepEqual(events[2].payload.branches, ['risk', 'receipt']);
	assert.deepEqual(events[2].payload.starts, [
		{ id: 'risk', index: 0 },
		{ id: 'receipt', index: 1 }
	]);
	assert.deepEqual(events[2].payload.resolves, [
		{ id: 'receipt', index: 0 },
		{ id: 'risk', index: 1 }
	]);
	assert.equal(durableSteps.includes('prepare-payment:parallel-risk:calculate-risk'), true);
	assert.equal(durableSteps.includes('prepare-payment:parallel-receipt:prepare-receipt'), true);
});

test('projects the completed run output through the success terminal expression', async () => {
	const events = [];
	const plan = graphPlan([
		{
			id: 'shape',
			name: 'shape-input',
			type: 'transform',
			next: 'done',
			config: { mode: 'merge', mappings: { result: '$.payment' } }
		}
	]);
	plan.nodes.at(-1).config.outputExpression = '$.result';

	const output = await executeCorexWorkflow(
		{
			runId: 'run-1',
			ownerUserId: 'user-1',
			input: { payment: { id: 'pay-42' }, internal: true },
			plan
		},
		durableWorkflow(),
		async (event) => events.push(event)
	);

	assert.deepEqual(output, { id: 'pay-42' });
	assert.deepEqual(events.at(-1).output, { id: 'pay-42' });
});

test('returns the complete context when the success terminal has no output expression', async () => {
	const input = { payment: { id: 'pay-42' } };
	const output = await executeCorexWorkflow(
		{ runId: 'run-1', ownerUserId: 'user-1', input, plan: graphPlan([], 'done') },
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
			id: 'shape',
			name: 'shape-input',
			type: 'transform',
			next: 'large',
			config: { mode: 'merge', mappings: { normalizedId: '$.payment.id' } }
		},
		{
			id: 'large',
			name: 'is-large',
			type: 'condition',
			whenTrue: 'wait',
			whenFalse: 'send',
			config: { path: '$.amount', operator: 'greater-than', value: 100 }
		},
		{
			id: 'wait',
			name: 'settlement-delay',
			type: 'wait',
			config: { durationMs: 5_000 },
			next: 'send'
		},
		{ ...action(), id: 'send', name: 'send-payment' }
	]);

	const result = await executeCorexWorkflow(
		{
			runId: 'run-1',
			ownerUserId: 'user-1',
			input: { payment: { id: 'pay-42' }, amount: 125 },
			plan
		},
		{
			async do(_name, optionsOrCallback, callback) {
				return (callback ?? optionsOrCallback)();
			},
			async sleep(name, duration) {
				durableSleeps.push([name, duration]);
			}
		},
		async (event) => events.push(event),
		async (_url, init) => {
			requests.push(JSON.parse(init.body));
			return Response.json({ accepted: true });
		}
	);

	assert.deepEqual(durableSleeps, [['settlement-delay', '5000 milliseconds']]);
	assert.deepEqual(requests, [{ payment: { id: 'pay-42' }, amount: 125, normalizedId: 'pay-42' }]);
	assert.deepEqual(
		events.map((event) => event.sequence),
		[0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
	);
	assert.deepEqual(result, { accepted: true });
});

test('selects typed switch cases and falls back to the default route', async () => {
	const switchStep = {
		id: 'currency-switch',
		name: 'route-by-currency',
		type: 'switch',
		config: {
			path: '$.currency',
			cases: [
				{ id: 'uah', value: 'UAH' },
				{ id: 'numeric', value: 980 }
			]
		},
		targets: { uah: 'uah-result', numeric: 'numeric-result' },
		defaultTarget: 'default-result'
	};
	const terminal = (id, outputExpression) => ({
		id,
		name: id,
		type: 'end-success',
		config: { outputExpression }
	});
	const plan = {
		schemaVersion: 1,
		processId: 'process-1',
		revision: 1,
		entryNodeId: switchStep.id,
		nodes: [
			switchStep,
			terminal('uah-result', '$.uah'),
			terminal('numeric-result', '$.numeric'),
			terminal('default-result', '$.fallback')
		]
	};

	const matched = await executeCorexWorkflow(
		{
			runId: 'run-uah',
			ownerUserId: 'user-1',
			input: { currency: 'UAH', uah: 'matched', fallback: 'default' },
			plan
		},
		durableWorkflow(),
		async () => undefined
	);
	const defaulted = await executeCorexWorkflow(
		{
			runId: 'run-default',
			ownerUserId: 'user-1',
			input: { currency: '980', numeric: 'wrong-type', fallback: 'default' },
			plan
		},
		durableWorkflow(),
		async () => undefined
	);

	assert.equal(matched, 'matched');
	assert.equal(defaulted, 'default');
});

test('executes bounded loops with deterministic visit identities', async () => {
	const durableSteps = [];
	const events = [];
	const plan = graphPlan([
		{
			id: 'loop',
			name: 'bounded-loop',
			type: 'loop',
			config: { maxIterations: 3 },
			bodyTarget: 'body',
			exitTarget: 'done'
		},
		{
			id: 'body',
			name: 'loop-body',
			type: 'transform',
			config: { mode: 'merge', mappings: { value: '$.value' } },
			next: 'loop'
		}
	]);

	const output = await executeCorexWorkflow(
		{ runId: 'run-loop', ownerUserId: 'user-1', input: { value: 42 }, plan },
		{
			async do(name, optionsOrCallback, callback) {
				durableSteps.push(name);
				return (callback ?? optionsOrCallback)();
			}
		},
		async (event) => events.push(event)
	);

	assert.deepEqual(output, { value: 42 });
	assert.deepEqual(
		durableSteps.filter((name) => name === 'bounded-loop' || name.startsWith('bounded-loop:')),
		[
			'bounded-loop',
			'bounded-loop:visit-1',
			'bounded-loop:visit-2',
			'bounded-loop:visit-3'
		]
	);
	assert.equal(events.filter((event) => event.stepName === 'loop-body').length, 6);
});

test('break exits its referenced loop immediately', async () => {
	const visited = [];
	const plan = graphPlan([
		{
			id: 'loop',
			name: 'bounded-loop',
			type: 'loop',
			config: { maxIterations: 10 },
			bodyTarget: 'break',
			exitTarget: 'done'
		},
		{
			id: 'break',
			name: 'leave-loop',
			type: 'break',
			loopId: 'loop',
			exitTarget: 'done'
		}
	]);

	await executeCorexWorkflow(
		{ runId: 'run-break', ownerUserId: 'user-1', input: {}, plan },
		{
			async do(name, optionsOrCallback, callback) {
				visited.push(name);
				return (callback ?? optionsOrCallback)();
			}
		},
		async () => undefined
	);

	assert.ok(visited.includes('bounded-loop'));
	assert.ok(visited.includes('leave-loop'));
	assert.equal(visited.some((name) => name.startsWith('bounded-loop:visit-')), false);
});

test('performs an absolute durable wait and records it as waiting', async () => {
	const durableSleeps = [];
	const events = [];
	const timestamp = '2026-09-02T08:30:00.000Z';
	const plan = graphPlan([
		{
			id: 'deadline',
			name: 'settlement-window',
			type: 'wait-until',
			config: { timestamp },
			next: 'done'
		}
	]);

	await executeCorexWorkflow(
		{ runId: 'run-1', ownerUserId: 'user-1', input: {}, plan },
		{
			async do(_name, optionsOrCallback, callback) {
				return (callback ?? optionsOrCallback)();
			},
			async sleepUntil(name, deadline) {
				durableSleeps.push([name, deadline]);
			}
		},
		async (event) => events.push(event)
	);

	assert.equal(durableSleeps.length, 1);
	assert.equal(durableSleeps[0][0], 'settlement-window');
	assert.ok(durableSleeps[0][1] instanceof Date);
	assert.equal(durableSleeps[0][1].toISOString(), timestamp);
	assert.equal(events.find((event) => event.stepName === 'settlement-window').status, 'waiting');
});

test('takes the false condition branch without sleeping', async () => {
	const durableSleeps = [];
	const plan = graphPlan([
		{
			id: 'large',
			name: 'is-large',
			type: 'condition',
			whenTrue: 'wait',
			whenFalse: 'send',
			config: { path: '$.amount', operator: 'greater-than', value: 100 }
		},
		{
			id: 'wait',
			name: 'settlement-delay',
			type: 'wait',
			config: { durationMs: 5_000 },
			next: 'send'
		},
		{ ...action(), id: 'send', name: 'send-payment' }
	]);

	await executeCorexWorkflow(
		{ runId: 'run-1', ownerUserId: 'user-1', input: { amount: 25 }, plan },
		{
			async do(_name, optionsOrCallback, callback) {
				return (callback ?? optionsOrCallback)();
			},
			async sleep(name, duration) {
				durableSleeps.push([name, duration]);
			}
		},
		async () => undefined,
		async () => Response.json({ accepted: true })
	);

	assert.deepEqual(durableSleeps, []);
});

test('waits for an external event and adds its payload to process context', async () => {
	const eventWaits = [];
	const events = [];
	const requests = [];
	const plan = graphPlan([
		{
			id: 'approval',
			name: 'wait-for-approval',
			type: 'wait-event',
			next: 'send',
			config: { eventType: 'payment-approved', timeoutMs: 86_400_000, resultKey: 'approval' }
		},
		{ ...action(), id: 'send', name: 'send-payment' }
	]);

	const result = await executeCorexWorkflow(
		{ runId: 'run-1', ownerUserId: 'user-1', input: { paymentId: 'pay-42' }, plan },
		{
			async do(_name, optionsOrCallback, callback) {
				return (callback ?? optionsOrCallback)();
			},
			async sleep() {},
			async waitForEvent(name, options) {
				eventWaits.push([name, options]);
				return { payload: { approved: true, approvedBy: 'owner-1' } };
			}
		},
		async (event) => events.push(event),
		async (_url, init) => {
			requests.push(JSON.parse(init.body));
			return Response.json({ accepted: true });
		}
	);

	assert.deepEqual(eventWaits, [
		['wait-for-approval', { type: 'corex-wait-run-1-1-1', timeout: '86400000 milliseconds' }]
	]);
	assert.deepEqual(events[1].payload, {
		stepId: 'approval',
		stepType: 'wait-event',
		eventType: 'payment-approved',
		waitEventType: 'corex-wait-run-1-1-1'
	});
	assert.deepEqual(requests, [
		{
			paymentId: 'pay-42',
			approval: { approved: true, approvedBy: 'owner-1' }
		}
	]);
	assert.deepEqual(result, { accepted: true });
});

test('starts a subprocess and waits durably for its correlated result', async () => {
	const starts = [];
	const waits = [];
	const plan = graphPlan([
		{
			id: 'invoice',
			name: 'create-invoice',
			type: 'invoke-process',
			next: 'done',
			config: {
				processId: '018f47a2-8391-7b1c-8f7a-f1d27670f099',
				inputPath: '$.payment',
				resultKey: 'invoice',
				timeoutMs: 2_592_000_000
			}
		}
	]);
	plan.nodes.at(-1).config.outputExpression = '$.invoice';

	const output = await executeCorexWorkflow(
		{ runId: 'parent-run', ownerUserId: 'user-1', input: { payment: { id: 'pay-42' } }, plan },
		{
			async do(_name, optionsOrCallback, callback) {
				return (callback ?? optionsOrCallback)();
			},
			async waitForEvent(name, options) {
				waits.push([name, options]);
				return {
					payload: { childRunId: 'child-run', status: 'complete', output: { id: 'inv-1' } }
				};
			}
		},
		async () => undefined,
		fetch,
		async (step, input, parent) => {
			starts.push({ step, input, parent });
			return { childRunId: 'child-run', workflowInstanceId: 'child-workflow' };
		}
	);

	assert.deepEqual(starts[0].input, { id: 'pay-42' });
	assert.deepEqual(starts[0].parent, { runId: 'parent-run', ownerUserId: 'user-1' });
	assert.deepEqual(waits, [
		[
			'create-invoice:result',
			{ type: 'corex-subprocess-result:child-run', timeout: '2592000000 milliseconds' }
		]
	]);
	assert.deepEqual(output, { id: 'inv-1' });
});

test('terminates a child durably when waiting for its result fails', async () => {
	const durableSteps = [];
	const terminations = [];
	const events = [];
	const plan = graphPlan([
		{
			id: 'invoice',
			name: 'create-invoice',
			type: 'invoke-process',
			next: 'done',
			config: {
				processId: '018f47a2-8391-7b1c-8f7a-f1d27670f099',
				inputPath: '$',
				resultKey: 'invoice',
				timeoutMs: 60_000
			}
		}
	]);

	await assert.rejects(
		executeCorexWorkflow(
			{ runId: 'parent-run', ownerUserId: 'user-1', input: {}, plan },
			{
				async do(name, optionsOrCallback, callback) {
					durableSteps.push(name);
					return (callback ?? optionsOrCallback)();
				},
				async waitForEvent() {
					throw new Error('private timeout details');
				}
			},
			async (event) => events.push(event),
			fetch,
			async () => ({ childRunId: 'child-run', workflowInstanceId: 'child-workflow' }),
			async (step, child, parent) => terminations.push({ stepId: step.id, child, parent })
		),
		/private timeout details/
	);

	assert.deepEqual(terminations, [
		{
			stepId: 'invoice',
			child: { childRunId: 'child-run', workflowInstanceId: 'child-workflow' },
			parent: { runId: 'parent-run', ownerUserId: 'user-1' }
		}
	]);
	assert.equal(durableSteps.includes('create-invoice:terminate-child'), true);
	assert.deepEqual(events.at(-1).error, { code: 'process_step_failed', stepId: 'invoice' });
	assert.equal(JSON.stringify(events).includes('private timeout details'), false);
});

test('fails the parent without exposing subprocess error details', async () => {
	const events = [];
	let terminationCount = 0;
	const plan = graphPlan([
		{
			id: 'invoice',
			name: 'create-invoice',
			type: 'invoke-process',
			next: 'done',
			config: {
				processId: '018f47a2-8391-7b1c-8f7a-f1d27670f099',
				inputPath: '$',
				resultKey: 'invoice',
				timeoutMs: 86_400_000
			}
		}
	]);

	await assert.rejects(
		executeCorexWorkflow(
			{ runId: 'parent-run', ownerUserId: 'user-1', input: {}, plan },
			{
				async do(_name, optionsOrCallback, callback) {
					return (callback ?? optionsOrCallback)();
				},
				async waitForEvent() {
					return {
						payload: { childRunId: 'child-run', status: 'errored', error: 'secret child error' }
					};
				}
			},
			async (event) => events.push(event),
			fetch,
			async () => ({ childRunId: 'child-run', workflowInstanceId: 'child-workflow' }),
			async () => {
				terminationCount += 1;
			}
		),
		/Subprocess failed\./
	);

	assert.equal(JSON.stringify(events).includes('secret child error'), false);
	assert.deepEqual(events.at(-1).error, { code: 'process_step_failed', stepId: 'invoice' });
	assert.equal(terminationCount, 0);
});

test('preserves the original wait failure when child cleanup fails', async () => {
	const plan = graphPlan([
		{
			id: 'invoice',
			name: 'create-invoice',
			type: 'invoke-process',
			next: 'done',
			config: {
				processId: '018f47a2-8391-7b1c-8f7a-f1d27670f099',
				inputPath: '$',
				resultKey: 'invoice',
				timeoutMs: 60_000
			}
		}
	]);

	await assert.rejects(
		executeCorexWorkflow(
			{ runId: 'parent-run', ownerUserId: 'user-1', input: {}, plan },
			{
				async do(_name, optionsOrCallback, callback) {
					return (callback ?? optionsOrCallback)();
				},
				async waitForEvent() {
					throw new Error('original wait timeout');
				}
			},
			async () => undefined,
			fetch,
			async () => ({ childRunId: 'child-run', workflowInstanceId: 'child-workflow' }),
			async () => {
				throw new Error('private cleanup failure');
			}
		),
		/original wait timeout/
	);
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

test('ends a process through an explicit failure terminal without duplicate lifecycle events', async () => {
	const events = [];
	const plan = graphPlan([
		{
			id: 'failure',
			name: 'reject-payment',
			type: 'end-failure',
			config: { code: 'payment_rejected', message: 'Payment policy rejected the request.' }
		}
	]);

	await assert.rejects(
		executeCorexWorkflow(
			{ runId: 'run-1', ownerUserId: 'user-1', input: {}, plan },
			durableWorkflow(),
			async (event) => events.push(event)
		),
		/Payment policy rejected the request\./
	);

	assert.deepEqual(events, [
		{
			runId: 'run-1',
			ownerUserId: 'user-1',
			sequence: 0,
			status: 'running',
			eventType: 'run_started',
			payload: {}
		},
		{
			runId: 'run-1',
			ownerUserId: 'user-1',
			sequence: 1,
			status: 'errored',
			eventType: 'run_failed',
			stepName: 'reject-payment',
			payload: { message: 'Payment policy rejected the request.' },
			error: { code: 'payment_rejected', stepId: 'failure' }
		}
	]);
});

test('waits for and audits a validated human approval decision', async () => {
	const events = [];
	const calls = [];
	const output = await executeCorexWorkflow(
		{
			runId: 'run-approval',
			ownerUserId: 'user-1',
			input: { amount: 900 },
			plan: {
				schemaVersion: 1,
				processId: 'process-1',
				revision: 1,
				entryNodeId: 'approval',
				nodes: [
					{
						id: 'approval',
						name: 'review-payment',
						type: 'approval',
						config: { assigneeUserId: 'user-1', timeoutMs: 86400000, resultKey: 'approval' },
						whenApproved: 'success',
						whenRejected: 'rejected'
					},
					{
						id: 'success',
						name: 'return-success',
						type: 'end-success',
						config: { outputExpression: '$.approval.decision' }
					},
					{ id: 'rejected', name: 'return-rejected', type: 'end-success', config: {} }
				]
			}
		},
		{
			async do(name, optionsOrCallback, maybeCallback) {
				const callback = maybeCallback ?? optionsOrCallback;
				return callback();
			},
			async sleep() {},
			async waitForEvent(name, options) {
				calls.push([name, options]);
				return { payload: { decision: 'approved', comment: 'Verified', actorUserId: 'user-1' } };
			}
		},
		async (event) => events.push(event)
	);

	assert.deepEqual(calls, [
		['review-payment', { type: 'corex-wait-run-approval-1-1', timeout: '86400000 milliseconds' }]
	]);
	assert.deepEqual(events[1].payload, {
		stepId: 'approval',
		stepType: 'approval',
		assigneeUserId: 'user-1',
		timeoutMs: 86400000,
		waitEventType: 'corex-wait-run-approval-1-1'
	});
	assert.equal(output, 'approved');
	assert.deepEqual(events[2].payload.decision, {
		decision: 'approved',
		comment: 'Verified',
		actorUserId: 'user-1'
	});
	assert.equal(events[2].payload.nextNodeId, 'success');
});

test('routes a rejected human approval through the rejected transition', async () => {
	const events = [];
	const output = await executeCorexWorkflow(
		{
			runId: 'run-rejected',
			ownerUserId: 'user-1',
			input: { amount: 900 },
			plan: {
				schemaVersion: 1,
				processId: 'process-1',
				revision: 1,
				entryNodeId: 'approval',
				nodes: [
					{
						id: 'approval',
						name: 'review-payment',
						type: 'approval',
						config: { assigneeUserId: 'user-1', timeoutMs: 86400000, resultKey: 'approval' },
						whenApproved: 'approved',
						whenRejected: 'rejected'
					},
					{ id: 'approved', name: 'return-approved', type: 'end-success', config: {} },
					{
						id: 'rejected',
						name: 'return-rejected',
						type: 'end-success',
						config: { outputExpression: '$.approval.decision' }
					}
				]
			}
		},
		{
			async do(name, optionsOrCallback, maybeCallback) {
				const callback = maybeCallback ?? optionsOrCallback;
				return callback();
			},
			async sleep() {},
			async waitForEvent() {
				return {
					payload: { decision: 'rejected', comment: 'Missing invoice', actorUserId: 'user-1' }
				};
			}
		},
		async (event) => events.push(event)
	);

	assert.equal(output, 'rejected');
	assert.equal(events[2].payload.nextNodeId, 'rejected');
	assert.deepEqual(events[2].payload.decision, {
		decision: 'rejected',
		comment: 'Missing invoice',
		actorUserId: 'user-1'
	});
});
