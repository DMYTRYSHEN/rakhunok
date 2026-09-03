import assert from 'node:assert/strict';
import test from 'node:test';

import {
	corexParallelBranchStepName,
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

function recordedDurableWorkflow() {
	return {
		async do(name, optionsOrCallback, callback) {
			return (callback ?? optionsOrCallback)({
				step: { name, count: 1 },
				attempt: 1,
				config: {}
			});
		}
	};
}

test('preserves top-level parallel durable step names', async () => {
	assert.equal(
		await corexParallelBranchStepName(
			[{ parallelName: 'prepare-details', branchId: 'risk' }],
			'prepare-risk',
			0
		),
		'prepare-details:parallel-risk:prepare-risk'
	);
	assert.equal(
		await corexParallelBranchStepName(
			[{ parallelName: 'prepare-details', branchId: 'risk' }],
			'prepare-risk',
			2
		),
		'prepare-details:parallel-risk:prepare-risk:visit-2'
	);
});

test('qualifies nested parallel durable step names with the complete branch path', async () => {
	assert.equal(
		await corexParallelBranchStepName(
			[
				{ parallelName: 'prepare-details', branchId: 'risk' },
				{ parallelName: 'collect-signals', branchId: 'fraud' }
			],
			'load-score',
			1
		),
		'prepare-details:parallel-risk/collect-signals:parallel-fraud:load-score:visit-1'
	);
});

test('bounds long parallel identities with a deterministic collision-resistant suffix', async () => {
	const boundaryName = await corexParallelBranchStepName(
		[{ parallelName: 'a'.repeat(487), branchId: 'b' }],
		's',
		0
	);
	const unicodeBoundaryName = await corexParallelBranchStepName(
		[{ parallelName: 'a'.repeat(486) + '😀', branchId: 'b' }],
		's',
		0
	);
	const sharedPath = [
		{ parallelName: `prepare-${'a'.repeat(300)}`, branchId: `risk-${'b'.repeat(300)}` }
	];
	const first = await corexParallelBranchStepName(sharedPath, 'load-score-a', 7);
	const replay = await corexParallelBranchStepName(sharedPath, 'load-score-a', 7);
	const differentStep = await corexParallelBranchStepName(sharedPath, 'load-score-b', 7);
	const differentVisit = await corexParallelBranchStepName(sharedPath, 'load-score-a', 8);
	const ambiguousDisplayPath = await corexParallelBranchStepName(
		[
			{ parallelName: `prepare-${'a'.repeat(300)}`, branchId: 'risk' },
			{ parallelName: `b-${'b'.repeat(300)}`, branchId: 'c' }
		],
		'load-score-a',
		7
	);

	assert.equal(boundaryName.length, 500);
	assert.doesNotMatch(boundaryName, /:sha256:/);
	assert.equal(Array.from(unicodeBoundaryName).length, 500);
	assert.doesNotMatch(unicodeBoundaryName, /:sha256:/);
	assert.equal(first.length, 500);
	assert.match(first, /:sha256:[a-f0-9]{64}$/);
	assert.equal(replay, first);
	assert.notEqual(differentStep, first);
	assert.notEqual(differentVisit, first);
	assert.notEqual(ambiguousDisplayPath, first);
});

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

test('registers HTTP compensation without invoking it during normal execution', async () => {
	let rollbackOptions;
	const requests = [];
	const attempts = [];
	const workflow = {
		async do(name, optionsOrCallback, callback, rollback) {
			if (name === 'forward-payment') rollbackOptions = rollback;
			return (callback ?? optionsOrCallback)({ step: { name, count: 1 }, attempt: 1, config: {} });
		}
	};
	const plan = graphPlan([
		{
			...action(),
			compensation: {
				id: 'refund',
				name: 'refund-payment',
				config: {
					method: 'POST',
					url: 'https://api.example.com/refunds',
					timeoutMs: 10_000,
					retry: { limit: 5, backoff: 'linear' },
					idempotencyKey: '$.input.paymentId'
				}
			}
		}
	]);
	const fetcher = async (url, init) => {
		requests.push({
			url: String(url),
			body: init.body,
			idempotencyKey: init.headers.get('Idempotency-Key')
		});
		return Response.json({ accepted: true }, { status: 202 });
	};

	await executeCorexWorkflow(
		{ runId: 'run-compensation', ownerUserId: 'user-1', input: { paymentId: 'pay-1' }, plan },
		workflow,
		async () => undefined,
		fetcher,
		undefined,
		undefined,
		3,
		async (attempt) => attempts.push(attempt)
	);

	assert.equal(requests.length, 1);
	assert.equal(attempts.length, 1);
	assert.deepEqual(rollbackOptions.rollbackConfig, {
		retries: { limit: 5, delay: 1_000, backoff: 'linear' },
		timeout: 10_000
	});
	await rollbackOptions.rollback({
		ctx: { step: { name: 'forward-payment', count: 1 }, attempt: 2, config: {} },
		error: new Error('downstream failed'),
		output: { status: 202, contentType: 'application/json', bytes: 17, body: { accepted: true } }
	});
	assert.equal(requests.length, 2);
	assert.equal(requests[1].url, 'https://api.example.com/refunds');
	assert.equal(requests[1].idempotencyKey, 'pay-1');
	assert.deepEqual(JSON.parse(requests[1].body), {
		input: { paymentId: 'pay-1' },
		output: {
			status: 202,
			contentType: 'application/json',
			bytes: 17,
			body: { accepted: true }
		},
		error: { name: 'Error', message: 'downstream failed' }
	});
	assert.equal(attempts.length, 2);
	const { startedAt, finishedAt, ...rollbackAttempt } = attempts[1];
	assert.deepEqual(rollbackAttempt, {
		runId: 'run-compensation',
		ownerUserId: 'user-1',
		executionGeneration: 3,
		stepId: 'refund',
		visit: 0,
		durableStepName: 'forward-payment:rollback:refund-payment',
		kind: 'compensation',
		attempt: 2,
		outcome: 'complete',
		retry: { limit: 5, backoff: 'linear', timeoutMs: 10_000 },
		output: { status: 202, contentType: 'application/json', bytes: 17 }
	});
});

test('registers a transform compensation with isolated rollback context', async () => {
	let rollbackOptions;
	const attempts = [];
	const workflow = {
		async do(name, optionsOrCallback, callback, rollback) {
			if (name === 'forward-payment') rollbackOptions = rollback;
			return (callback ?? optionsOrCallback)({ step: { name, count: 1 }, attempt: 1, config: {} });
		}
	};
	const plan = graphPlan([
		{
			...action(),
			compensation: {
				id: 'restore-context',
				name: 'restore-payment-context',
				type: 'transform',
				config: {
					mode: 'replace',
					mappings: {
						paymentId: '$.input.paymentId',
						failureName: '$.error.name',
						forwardStatus: '$.output.status'
					}
				}
			}
		}
	]);

	await executeCorexWorkflow(
		{
			runId: 'run-transform-compensation',
			ownerUserId: 'user-1',
			input: { paymentId: 'pay-1' },
			plan
		},
		workflow,
		async () => undefined,
		async () => Response.json({ accepted: true }, { status: 202 }),
		undefined,
		undefined,
		4,
		async (attempt) => attempts.push(attempt)
	);

	assert.equal(attempts.length, 1);
	assert.equal(rollbackOptions.rollbackConfig, undefined);
	await rollbackOptions.rollback({
		ctx: { step: { name: 'forward-payment', count: 1 }, attempt: 2, config: {} },
		error: new Error('downstream failed'),
		output: { status: 202, contentType: 'application/json', bytes: 17, body: { accepted: true } }
	});

	assert.equal(attempts.length, 2);
	const { startedAt, finishedAt, ...rollbackAttempt } = attempts[1];
	assert.deepEqual(rollbackAttempt, {
		runId: 'run-transform-compensation',
		ownerUserId: 'user-1',
		executionGeneration: 4,
		stepId: 'restore-context',
		visit: 0,
		durableStepName: 'forward-payment:rollback:restore-payment-context',
		kind: 'compensation',
		attempt: 2,
		outcome: 'complete',
		retry: { limit: 0, backoff: 'constant', timeoutMs: 0 },
		output: { type: 'object', bytes: 63 }
	});
});

test('registers transform compensation for a transform action', async () => {
	let rollbackOptions;
	const attempts = [];
	const workflow = {
		async do(name, optionsOrCallback, callback, rollback) {
			if (name === 'shape-payment') rollbackOptions = rollback;
			return (callback ?? optionsOrCallback)({ step: { name, count: 1 }, attempt: 1, config: {} });
		}
	};
	const plan = graphPlan([
		{
			id: 'shape',
			name: 'shape-payment',
			type: 'transform',
			next: 'done',
			config: { mode: 'merge', mappings: { normalizedId: '$.paymentId' } },
			compensation: {
				id: 'restore-context',
				name: 'restore-payment-context',
				type: 'transform',
				config: { mode: 'replace', mappings: { paymentId: '$.input.paymentId' } }
			}
		}
	]);

	await executeCorexWorkflow(
		{
			runId: 'run-transform-action-rollback',
			ownerUserId: 'user-1',
			input: { paymentId: 'pay-1' },
			plan
		},
		workflow,
		async () => undefined,
		async () => Response.json({ accepted: true }),
		undefined,
		undefined,
		5,
		async (attempt) => attempts.push(attempt)
	);

	assert.ok(rollbackOptions);
	await rollbackOptions.rollback({
		ctx: { step: { name: 'shape-payment', count: 1 }, attempt: 2, config: {} },
		error: new Error('downstream failed'),
		output: { paymentId: 'pay-1', normalizedId: 'pay-1' }
	});
	const { startedAt, finishedAt, ...rollbackAttempt } = attempts[1];
	assert.deepEqual(rollbackAttempt, {
		runId: 'run-transform-action-rollback',
		ownerUserId: 'user-1',
		executionGeneration: 5,
		stepId: 'restore-context',
		visit: 0,
		durableStepName: 'shape-payment:rollback:restore-payment-context',
		kind: 'compensation',
		attempt: 2,
		outcome: 'complete',
		retry: { limit: 0, backoff: 'constant', timeoutMs: 0 },
		output: { type: 'object', bytes: 21 }
	});
});

test('registers HTTP compensation for a transform action', async () => {
	let rollbackOptions;
	const attempts = [];
	const requests = [];
	const workflow = {
		async do(name, optionsOrCallback, callback, rollback) {
			if (name === 'shape-payment') rollbackOptions = rollback;
			return (callback ?? optionsOrCallback)({ step: { name, count: 1 }, attempt: 1, config: {} });
		}
	};
	const plan = graphPlan([
		{
			id: 'shape',
			name: 'shape-payment',
			type: 'transform',
			next: 'done',
			config: { mode: 'merge', mappings: { normalizedId: '$.paymentId' } },
			compensation: {
				id: 'reverse-payment',
				name: 'reverse-payment',
				type: 'http-request',
				config: {
					method: 'POST',
					url: 'https://api.example.test/payments/reverse',
					timeoutMs: 5_000,
					retry: { limit: 2, backoff: 'exponential' }
				}
			}
		}
	]);
	const fetcher = async (url, init) => {
		requests.push({ url, body: JSON.parse(init.body) });
		return Response.json({ reversed: true });
	};

	await executeCorexWorkflow(
		{
			runId: 'run-transform-http-rollback',
			ownerUserId: 'user-1',
			input: { paymentId: 'pay-1' },
			plan
		},
		workflow,
		async () => undefined,
		fetcher,
		undefined,
		undefined,
		6,
		async (attempt) => attempts.push(attempt)
	);

	assert.equal(requests.length, 0);
	assert.ok(rollbackOptions);
	await rollbackOptions.rollback({
		ctx: { step: { name: 'shape-payment', count: 1 }, attempt: 2, config: {} },
		error: new Error('downstream failed'),
		output: { paymentId: 'pay-1', normalizedId: 'pay-1' }
	});
	assert.deepEqual(requests, [
		{
			url: 'https://api.example.test/payments/reverse',
			body: {
				input: { paymentId: 'pay-1' },
				output: { paymentId: 'pay-1', normalizedId: 'pay-1' },
				error: { name: 'Error', message: 'downstream failed' }
			}
		}
	]);
	const { startedAt, finishedAt, ...rollbackAttempt } = attempts[1];
	assert.deepEqual(rollbackAttempt, {
		runId: 'run-transform-http-rollback',
		ownerUserId: 'user-1',
		executionGeneration: 6,
		stepId: 'reverse-payment',
		visit: 0,
		durableStepName: 'shape-payment:rollback:reverse-payment',
		kind: 'compensation',
		attempt: 2,
		outcome: 'complete',
		retry: { limit: 2, backoff: 'exponential', timeoutMs: 5_000 },
		output: { status: 200, contentType: 'application/json', bytes: 17 }
	});
});

test('records sanitized transform compensation failures without masking the rollback error', async () => {
	let rollbackOptions;
	const attempts = [];
	const workflow = {
		async do(name, optionsOrCallback, callback, rollback) {
			if (name === 'forward-payment') rollbackOptions = rollback;
			return (callback ?? optionsOrCallback)({ step: { name, count: 1 }, attempt: 1, config: {} });
		}
	};
	const plan = graphPlan([
		{
			...action(),
			compensation: {
				id: 'restore-context',
				name: 'restore-payment-context',
				type: 'transform',
				config: { mode: 'replace', mappings: null }
			}
		}
	]);

	await executeCorexWorkflow(
		{ runId: 'run-failed-transform-compensation', ownerUserId: 'user-1', input: {}, plan },
		workflow,
		async () => undefined,
		async () => Response.json({ accepted: true }, { status: 202 }),
		undefined,
		undefined,
		5,
		async (attempt) => attempts.push(attempt)
	);

	await assert.rejects(
		rollbackOptions.rollback({
			ctx: { step: { name: 'forward-payment', count: 1 }, attempt: 3, config: {} },
			error: new Error('sensitive downstream details'),
			output: { status: 202, contentType: 'application/json', bytes: 17, body: {} }
		}),
		/undefined or null/
	);
	const { startedAt, finishedAt, ...rollbackAttempt } = attempts[1];
	assert.deepEqual(rollbackAttempt, {
		runId: 'run-failed-transform-compensation',
		ownerUserId: 'user-1',
		executionGeneration: 5,
		stepId: 'restore-context',
		visit: 0,
		durableStepName: 'forward-payment:rollback:restore-payment-context',
		kind: 'compensation',
		attempt: 3,
		outcome: 'failed',
		retry: { limit: 0, backoff: 'constant', timeoutMs: 0 },
		error: { code: 'transform_step_failed' }
	});
	assert.equal(JSON.stringify(rollbackAttempt).includes('sensitive downstream details'), false);
});

test('records failed HTTP compensation attempts without masking the rollback error', async () => {
	let rollbackOptions;
	const attempts = [];
	let requestCount = 0;
	const workflow = {
		async do(name, optionsOrCallback, callback, rollback) {
			if (name === 'forward-payment') rollbackOptions = rollback;
			return (callback ?? optionsOrCallback)({ step: { name, count: 1 }, attempt: 1, config: {} });
		}
	};
	const plan = graphPlan([
		{
			...action(),
			compensation: {
				id: 'refund',
				name: 'refund-payment',
				config: {
					method: 'POST',
					url: 'https://api.example.com/refunds',
					timeoutMs: 10_000,
					retry: { limit: 5, backoff: 'linear' },
					idempotencyKey: '$.input.paymentId'
				}
			}
		}
	]);
	const fetcher = async () => {
		requestCount += 1;
		return requestCount === 1
			? Response.json({ accepted: true }, { status: 202 })
			: new Response('sensitive rollback details', { status: 503 });
	};

	await executeCorexWorkflow(
		{
			runId: 'run-failed-compensation',
			ownerUserId: 'user-1',
			input: { paymentId: 'pay-1' },
			plan
		},
		workflow,
		async () => undefined,
		fetcher,
		undefined,
		undefined,
		4,
		async (attempt) => attempts.push(attempt)
	);

	await assert.rejects(
		rollbackOptions.rollback({
			ctx: { step: { name: 'forward-payment', count: 1 }, attempt: 3, config: {} },
			error: new Error('downstream failed'),
			output: { status: 202, contentType: 'application/json', bytes: 17, body: { accepted: true } }
		}),
		/HTTP action failed with status 503/
	);
	const { startedAt, finishedAt, ...rollbackAttempt } = attempts[1];
	assert.deepEqual(rollbackAttempt, {
		runId: 'run-failed-compensation',
		ownerUserId: 'user-1',
		executionGeneration: 4,
		stepId: 'refund',
		visit: 0,
		durableStepName: 'forward-payment:rollback:refund-payment',
		kind: 'compensation',
		attempt: 3,
		outcome: 'failed',
		retry: { limit: 5, backoff: 'linear', timeoutMs: 10_000 },
		error: { code: 'http_action_failed' }
	});
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
				kind: 'forward',
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
				kind: 'forward',
				attempt: 2,
				outcome: 'complete',
				retry: { limit: 3, backoff: 'exponential', timeoutMs: 30_000 },
				output: { status: 202, contentType: 'application/json', bytes: 17 }
			}
		]
	);
	assert.equal(JSON.stringify(attempts).includes('private upstream failure'), false);
	assert.equal(
		attempts.every((attempt) => Date.parse(attempt.finishedAt) >= Date.parse(attempt.startedAt)),
		true
	);
});

test('records HTTP JSON output inline when the configured byte limit permits it', async () => {
	const attempts = [];
	const body = { accepted: true };

	await executeCorexWorkflow(
		{
			runId: 'run-inline-http',
			ownerUserId: 'user-1',
			input: { paymentId: 'pay-42' },
			plan: graphPlan([action({ outputPolicy: { mode: 'inline', maxBytes: 1024 } })])
		},
		recordedDurableWorkflow(),
		async () => undefined,
		async () => Response.json(body, { status: 202 }),
		undefined,
		undefined,
		1,
		async (attempt) => attempts.push(attempt)
	);

	assert.deepEqual(attempts[0].output, {
		status: 202,
		contentType: 'application/json',
		bytes: new TextEncoder().encode(JSON.stringify(body)).byteLength,
		value: body
	});
});

test('redacts configured HTTP JSON output paths without mutating the response body', async () => {
	const attempts = [];
	const body = { accepted: true, customer: { email: 'private@example.com', name: 'Ada' } };

	await executeCorexWorkflow(
		{
			runId: 'run-redacted-http',
			ownerUserId: 'user-1',
			input: { paymentId: 'pay-42' },
			plan: graphPlan([
				action({
					outputPolicy: {
						mode: 'inline',
						maxBytes: 1024,
						redactPaths: ['$.customer.email']
					}
				})
			])
		},
		recordedDurableWorkflow(),
		async () => undefined,
		async () => Response.json(body, { status: 202 }),
		undefined,
		undefined,
		1,
		async (attempt) => attempts.push(attempt)
	);

	assert.deepEqual(attempts[0].output.value, {
		accepted: true,
		customer: { email: '[REDACTED]', name: 'Ada' }
	});
	assert.equal(body.customer.email, 'private@example.com');
});

test('applies the HTTP inline size limit after redaction', async () => {
	const attempts = [];
	const body = { secret: 'x'.repeat(200) };

	await executeCorexWorkflow(
		{
			runId: 'run-redacted-http-size',
			ownerUserId: 'user-1',
			input: {},
			plan: graphPlan([
				action({
					outputPolicy: { mode: 'inline', maxBytes: 32, redactPaths: ['$.secret'] }
				})
			])
		},
		recordedDurableWorkflow(),
		async () => undefined,
		async () => Response.json(body),
		undefined,
		undefined,
		1,
		async (attempt) => attempts.push(attempt)
	);

	assert.deepEqual(attempts[0].output, {
		status: 200,
		contentType: 'application/json',
		bytes: new TextEncoder().encode(JSON.stringify(body)).byteLength,
		value: { secret: '[REDACTED]' }
	});
});

test('falls back to HTTP metadata when inline output exceeds the configured limit', async () => {
	const attempts = [];
	const body = { payload: 'private details' };

	await executeCorexWorkflow(
		{
			runId: 'run-truncated-http',
			ownerUserId: 'user-1',
			input: { paymentId: 'pay-42' },
			plan: graphPlan([action({ outputPolicy: { mode: 'inline', maxBytes: 8 } })])
		},
		recordedDurableWorkflow(),
		async () => undefined,
		async () => Response.json(body),
		undefined,
		undefined,
		1,
		async (attempt) => attempts.push(attempt)
	);

	assert.deepEqual(attempts[0].output, {
		status: 200,
		contentType: 'application/json',
		bytes: new TextEncoder().encode(JSON.stringify(body)).byteLength,
		truncated: true
	});
	assert.equal('value' in attempts[0].output, false);
});

test('keeps non-JSON HTTP output as metadata when inline output is enabled', async () => {
	const attempts = [];

	await executeCorexWorkflow(
		{
			runId: 'run-text-http',
			ownerUserId: 'user-1',
			input: { paymentId: 'pay-42' },
			plan: graphPlan([action({ outputPolicy: { mode: 'inline', maxBytes: 1024 } })])
		},
		recordedDurableWorkflow(),
		async () => undefined,
		async () => new Response('accepted', { headers: { 'Content-Type': 'text/plain' } }),
		undefined,
		undefined,
		1,
		async (attempt) => attempts.push(attempt)
	);

	assert.deepEqual(attempts[0].output, {
		status: 200,
		contentType: 'text/plain',
		bytes: 8
	});
});

test('stores redacted HTTP JSON output externally without mutating the response body', async () => {
	const attempts = [];
	const stored = [];
	const body = { accepted: true, customer: { email: 'private@example.com', name: 'Ada' } };

	const result = await executeCorexWorkflow(
		{
			runId: 'run-external-http',
			ownerUserId: 'user-1',
			input: { paymentId: 'pay-42' },
			plan: graphPlan([
				action({
					outputPolicy: {
						mode: 'external',
						maxBytes: 1024,
						redactPaths: ['$.customer.email']
					}
				})
			])
		},
		recordedDurableWorkflow(),
		async () => undefined,
		async () => Response.json(body, { status: 202 }),
		undefined,
		undefined,
		2,
		async (attempt) => attempts.push(attempt),
		undefined,
		undefined,
		undefined,
		async (object) => stored.push(object)
	);

	assert.equal(result.customer.email, 'private@example.com');
	assert.equal(stored.length, 1);
	assert.match(stored[0].key, /^corex-output\/[a-f0-9]{64}\.json$/);
	assert.deepEqual(JSON.parse(new TextDecoder().decode(stored[0].body)), {
		accepted: true,
		customer: { email: '[REDACTED]', name: 'Ada' }
	});
	assert.deepEqual(attempts[0].output, {
		status: 202,
		contentType: 'application/json',
		bytes: new TextEncoder().encode(JSON.stringify(body)).byteLength,
		external: {
			key: stored[0].key,
			bytes: stored[0].body.byteLength,
			contentType: 'application/json'
		}
	});
});

test('does not store HTTP JSON output above the external byte limit', async () => {
	const attempts = [];
	const stored = [];
	const body = { payload: 'private details' };

	await executeCorexWorkflow(
		{
			runId: 'run-external-http-limit',
			ownerUserId: 'user-1',
			input: {},
			plan: graphPlan([action({ outputPolicy: { mode: 'external', maxBytes: 8 } })])
		},
		recordedDurableWorkflow(),
		async () => undefined,
		async () => Response.json(body),
		undefined,
		undefined,
		1,
		async (attempt) => attempts.push(attempt),
		undefined,
		undefined,
		undefined,
		async (object) => stored.push(object)
	);

	assert.equal(stored.length, 0);
	assert.deepEqual(attempts[0].output, {
		status: 200,
		contentType: 'application/json',
		bytes: new TextEncoder().encode(JSON.stringify(body)).byteLength,
		truncated: true
	});
});

test('ignores an attempt recorder failure after one successful HTTP side effect', async () => {
	let requestCount = 0;
	const result = await executeCorexWorkflow(
		{ runId: 'run-1', ownerUserId: 'user-1', input: {}, plan: graphPlan([action()]) },
		{
			async do(name, optionsOrCallback, callback) {
				return (callback ?? optionsOrCallback)({
					step: { name, count: 1 },
					attempt: 1,
					config: {}
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
						step: { name, count: 1 },
						attempt: 1,
						config: {}
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
			runId: 'run-1',
			ownerUserId: 'user-1',
			executionGeneration: 2,
			stepId: 'forward',
			visit: 3,
			durableStepName: 'forward-payment [visit 3]',
			kind: 'forward',
			attempt: 2,
			startedAt: '2026-09-01T08:00:00.000Z',
			finishedAt: '2026-09-01T08:00:01.000Z',
			outcome: 'complete',
			retry: { limit: 3, backoff: 'exponential', timeoutMs: 30_000 },
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
		p_run_id: 'run-1',
		p_owner_user_id: 'user-1',
		p_execution_generation: 2,
		p_step_id: 'forward',
		p_visit: 3,
		p_durable_step_name: 'forward-payment [visit 3]',
		p_kind: 'forward',
		p_attempt: 2,
		p_started_at: '2026-09-01T08:00:00.000Z',
		p_finished_at: '2026-09-01T08:00:01.000Z',
		p_outcome: 'complete',
		p_retry: { limit: 3, backoff: 'exponential', timeoutMs: 30_000 },
		p_output: { status: 202, contentType: 'application/json', bytes: 17 },
		p_error: null
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
	const attempts = [];
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
				return (callback ?? optionsOrCallback)({
					step: { name, count: 1 },
					attempt: 1,
					config: {}
				});
			}
		},
		async (event) => events.push(event),
		async (url, init) => {
			const branch = url.endsWith('/risk') ? 'risk' : 'receipt';
			started.push(branch);
			assert.deepEqual(JSON.parse(init.body), { paymentId: 'pay-42' });
			await new Promise((resolve) => releases.set(branch, resolve));
			return Response.json({ branch });
		},
		undefined,
		undefined,
		1,
		async (attempt) => attempts.push(attempt)
	);

	while (started.length < 2) await new Promise((resolve) => setImmediate(resolve));
	assert.deepEqual(started, ['risk', 'receipt']);
	assert.equal(
		events.some((event) => event.eventType === 'run_completed'),
		false
	);
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
	assert.deepEqual(
		attempts
			.filter((attempt) => attempt.durableStepName.startsWith('prepare-payment:parallel-'))
			.map(({ startedAt, finishedAt, output, ...attempt }) => ({ ...attempt, output }))
			.sort((left, right) => left.stepId.localeCompare(right.stepId)),
		[
			{
				runId: 'run-parallel',
				ownerUserId: 'user-1',
				executionGeneration: 1,
				stepId: 'receipt',
				visit: 0,
				durableStepName: 'prepare-payment:parallel-receipt:prepare-receipt',
				kind: 'forward',
				attempt: 1,
				outcome: 'complete',
				retry: { limit: 1, backoff: 'constant', timeoutMs: 30_000 },
				output: { status: 200, contentType: 'application/json', bytes: 20 }
			},
			{
				runId: 'run-parallel',
				ownerUserId: 'user-1',
				executionGeneration: 1,
				stepId: 'risk',
				visit: 0,
				durableStepName: 'prepare-payment:parallel-risk:calculate-risk',
				kind: 'forward',
				attempt: 1,
				outcome: 'complete',
				retry: { limit: 1, backoff: 'constant', timeoutMs: 30_000 },
				output: { status: 200, contentType: 'application/json', bytes: 17 }
			}
		]
	);
});

test('executes nested parallel branches with complete branch-path identities', async () => {
	const durableSteps = [];
	const plan = graphPlan([
		{
			id: 'outer',
			name: 'prepare-payment',
			type: 'parallel',
			config: { branches: [{ id: 'risk' }], resultKey: 'preparation' },
			branchTargets: { risk: 'inner' },
			joinTarget: 'outer-join',
			continuationTarget: 'done'
		},
		{
			id: 'inner',
			name: 'collect-signals',
			type: 'parallel',
			config: { branches: [{ id: 'fraud' }, { id: 'credit' }], resultKey: 'signals' },
			branchTargets: { fraud: 'fraud', credit: 'credit' },
			joinTarget: 'inner-join',
			continuationTarget: 'outer-join'
		},
		{
			id: 'fraud',
			name: 'load-fraud',
			type: 'transform',
			config: { mode: 'merge', mappings: { signal: '$.paymentId' } },
			next: 'inner-join'
		},
		{
			id: 'credit',
			name: 'load-credit',
			type: 'transform',
			config: { mode: 'merge', mappings: { signal: '$.paymentId' } },
			next: 'inner-join'
		}
	]);

	const output = await executeCorexWorkflow(
		{ runId: 'run-nested-parallel', ownerUserId: 'user-1', input: { paymentId: 'pay-42' }, plan },
		{
			async do(name, optionsOrCallback, callback) {
				durableSteps.push(name);
				return (callback ?? optionsOrCallback)({
					step: { name, count: 1 },
					attempt: 1,
					config: {}
				});
			}
		},
		async () => undefined
	);

	assert.deepEqual(output, {
		paymentId: 'pay-42',
		preparation: {
			risk: {
				paymentId: 'pay-42',
				signals: {
					fraud: { paymentId: 'pay-42', signal: 'pay-42' },
					credit: { paymentId: 'pay-42', signal: 'pay-42' }
				}
			}
		}
	});
	assert.equal(
		durableSteps.includes(
			'prepare-payment:parallel-risk/collect-signals:parallel-fraud:load-fraud'
		),
		true
	);
	assert.equal(
		durableSteps.includes(
			'prepare-payment:parallel-risk/collect-signals:parallel-credit:load-credit'
		),
		true
	);
});

test('records branch-qualified attempts for parallel decisions', async () => {
	const attempts = [];
	const plan = graphPlan([
		{
			id: 'parallel',
			name: 'route-payment',
			type: 'parallel',
			config: { branches: [{ id: 'eligibility' }, { id: 'currency' }], resultKey: 'routes' },
			branchTargets: { eligibility: 'eligible', currency: 'currency' },
			joinTarget: 'join',
			continuationTarget: 'done'
		},
		{
			id: 'eligible',
			name: 'check-eligibility',
			type: 'condition',
			config: { path: '$.eligible', operator: 'equals', value: true },
			whenTrue: 'join',
			whenFalse: 'join'
		},
		{
			id: 'currency',
			name: 'route-currency',
			type: 'switch',
			config: { path: '$.currency', cases: [{ id: 'uah', value: 'UAH' }] },
			targets: { uah: 'join' },
			defaultTarget: 'join'
		}
	]);

	await executeCorexWorkflow(
		{
			runId: 'run-parallel-decisions',
			ownerUserId: 'user-1',
			input: { eligible: true, currency: 'UAH', secret: 'private' },
			plan
		},
		{
			async do(name, optionsOrCallback, callback) {
				return (callback ?? optionsOrCallback)({
					step: { name, count: 1 },
					attempt: 1,
					config: {}
				});
			}
		},
		async () => undefined,
		fetch,
		undefined,
		undefined,
		2,
		async (attempt) => attempts.push(attempt)
	);

	assert.deepEqual(
		attempts.map(({ startedAt, finishedAt, ...attempt }) => attempt),
		[
			{
				runId: 'run-parallel-decisions',
				ownerUserId: 'user-1',
				executionGeneration: 2,
				stepId: 'eligible',
				visit: 0,
				durableStepName: 'route-payment:parallel-eligibility:check-eligibility',
				kind: 'forward',
				attempt: 1,
				outcome: 'complete',
				retry: { limit: 0, backoff: 'constant', timeoutMs: 0 },
				output: { type: 'none' }
			},
			{
				runId: 'run-parallel-decisions',
				ownerUserId: 'user-1',
				executionGeneration: 2,
				stepId: 'currency',
				visit: 0,
				durableStepName: 'route-payment:parallel-currency:route-currency',
				kind: 'forward',
				attempt: 1,
				outcome: 'complete',
				retry: { limit: 0, backoff: 'constant', timeoutMs: 0 },
				output: { type: 'none' }
			}
		]
	);
	assert.equal(JSON.stringify(attempts).includes('private'), false);
});

test('records branch-qualified attempts for parallel loop control', async () => {
	const attempts = [];
	const plan = graphPlan([
		{
			id: 'parallel',
			name: 'parallel-control',
			type: 'parallel',
			config: { branches: [{ id: 'bounded' }, { id: 'skip' }], resultKey: 'branches' },
			branchTargets: { bounded: 'loop', skip: 'skip' },
			joinTarget: 'join',
			continuationTarget: 'done'
		},
		{
			id: 'loop',
			name: 'bounded-loop',
			type: 'loop',
			config: { maxIterations: 3 },
			bodyTarget: 'break',
			exitTarget: 'join'
		},
		{
			id: 'break',
			name: 'leave-loop',
			type: 'break',
			loopId: 'loop',
			exitTarget: 'join'
		},
		{
			id: 'skip',
			name: 'skip-branch',
			type: 'condition',
			config: { path: '$.skip', operator: 'equals', value: true },
			whenTrue: 'join',
			whenFalse: 'join'
		}
	]);

	await executeCorexWorkflow(
		{ runId: 'run-parallel-control', ownerUserId: 'user-1', input: { skip: true }, plan },
		{
			async do(name, optionsOrCallback, callback) {
				return (callback ?? optionsOrCallback)({
					step: { name, count: 1 },
					attempt: 1,
					config: {}
				});
			}
		},
		async () => undefined,
		fetch,
		undefined,
		undefined,
		4,
		async (attempt) => attempts.push(attempt)
	);

	assert.deepEqual(
		attempts
			.filter((attempt) => attempt.stepId === 'loop' || attempt.stepId === 'break')
			.map(({ startedAt, finishedAt, ...attempt }) => attempt),
		[
			{
				runId: 'run-parallel-control',
				ownerUserId: 'user-1',
				executionGeneration: 4,
				stepId: 'loop',
				visit: 0,
				durableStepName: 'parallel-control:parallel-bounded:bounded-loop',
				kind: 'forward',
				attempt: 1,
				outcome: 'complete',
				retry: { limit: 0, backoff: 'constant', timeoutMs: 0 },
				output: { type: 'none' }
			},
			{
				runId: 'run-parallel-control',
				ownerUserId: 'user-1',
				executionGeneration: 4,
				stepId: 'break',
				visit: 0,
				durableStepName: 'parallel-control:parallel-bounded:leave-loop',
				kind: 'forward',
				attempt: 1,
				outcome: 'complete',
				retry: { limit: 0, backoff: 'constant', timeoutMs: 0 },
				output: { type: 'none' }
			}
		]
	);
});

test('records sanitized transform failures inside parallel branches', async () => {
	const attempts = [];
	const plan = graphPlan([
		{
			id: 'parallel',
			name: 'parallel-shape',
			type: 'parallel',
			config: { branches: [{ id: 'broken' }], resultKey: 'branches' },
			branchTargets: { broken: 'shape' },
			joinTarget: 'join',
			continuationTarget: 'done'
		},
		{
			id: 'shape',
			name: 'shape-invalid',
			type: 'transform',
			config: { mode: 'replace', mappings: undefined },
			next: 'join'
		}
	]);

	await assert.rejects(
		executeCorexWorkflow(
			{ runId: 'run-parallel-transform', ownerUserId: 'user-1', input: {}, plan },
			{
				async do(name, optionsOrCallback, callback) {
					return (callback ?? optionsOrCallback)({
						step: { name, count: 1 },
						attempt: 1,
						config: {}
					});
				}
			},
			async () => undefined,
			fetch,
			undefined,
			undefined,
			3,
			async (attempt) => attempts.push(attempt)
		),
		/Cannot convert undefined or null to object/
	);

	assert.equal(attempts.length, 1);
	const { startedAt, finishedAt, ...attempt } = attempts[0];
	assert.deepEqual(attempt, {
		runId: 'run-parallel-transform',
		ownerUserId: 'user-1',
		executionGeneration: 3,
		stepId: 'shape',
		visit: 0,
		durableStepName: 'parallel-shape:parallel-broken:shape-invalid',
		kind: 'forward',
		attempt: 1,
		outcome: 'failed',
		retry: { limit: 0, backoff: 'constant', timeoutMs: 0 },
		error: { code: 'transform_step_failed' }
	});
	assert.equal(Date.parse(finishedAt) >= Date.parse(startedAt), true);
	assert.equal(JSON.stringify(attempts).includes('Cannot convert'), false);
});

test('records bounded transform output metadata inside parallel branches', async () => {
	const attempts = [];
	const plan = graphPlan([
		{
			id: 'parallel',
			name: 'parallel-shape',
			type: 'parallel',
			config: { branches: [{ id: 'shape' }], resultKey: 'branches' },
			branchTargets: { shape: 'shape' },
			joinTarget: 'join',
			continuationTarget: 'done'
		},
		{
			id: 'shape',
			name: 'shape-private-input',
			type: 'transform',
			config: { mode: 'replace', mappings: { normalizedId: '$.payment.id' } },
			next: 'join'
		}
	]);

	await executeCorexWorkflow(
		{
			runId: 'run-parallel-transform',
			ownerUserId: 'user-1',
			input: { payment: { id: 'pay-42' }, secret: 'private' },
			plan
		},
		{
			async do(name, optionsOrCallback, callback) {
				return (callback ?? optionsOrCallback)({
					step: { name, count: 1 },
					attempt: 1,
					config: {}
				});
			}
		},
		async () => undefined,
		fetch,
		undefined,
		undefined,
		3,
		async (attempt) => attempts.push(attempt)
	);

	assert.deepEqual(attempts[0].output, {
		type: 'object',
		bytes: new TextEncoder().encode(JSON.stringify({ normalizedId: 'pay-42' })).byteLength
	});
	assert.equal(JSON.stringify(attempts[0].output).includes('private'), false);
	assert.equal(JSON.stringify(attempts[0].output).includes('pay-42'), false);
});

test('performs relative waits inside parallel branches with branch-qualified attempts', async () => {
	const durableSleeps = [];
	const attempts = [];
	const completedRollbacks = [];
	const plan = graphPlan(
		[
			{
				id: 'parallel',
				name: 'payment-work',
				type: 'parallel',
				config: { branches: [{ id: 'delay' }], resultKey: 'results' },
				branchTargets: { delay: 'delay' },
				joinTarget: 'join',
				continuationTarget: 'done'
			},
			{
				id: 'delay',
				name: 'settlement-delay',
				type: 'wait',
				config: { durationMs: 5_000 },
				compensation: {
					id: 'restore-delay',
					name: 'restore-delay',
					type: 'transform',
					config: { mode: 'merge', mappings: { paymentId: '$.input.paymentId' } }
				},
				next: 'join'
			}
		],
		'parallel'
	);

	await executeCorexWorkflow(
		{ runId: 'run-parallel-wait', ownerUserId: 'user-1', input: { paymentId: 'pay-2' }, plan },
		{
			async do(name, optionsOrCallback, callback, rollback) {
				if (name.endsWith(':completed')) completedRollbacks.push({ name, rollback });
				return (callback ?? optionsOrCallback)({
					step: { name: 'step', count: 1 },
					attempt: 1,
					config: {}
				});
			},
			async sleep(name, duration) {
				durableSleeps.push([name, duration]);
			}
		},
		async () => undefined,
		fetch,
		undefined,
		undefined,
		8,
		async (attempt) => attempts.push(attempt)
	);

	assert.deepEqual(durableSleeps, [
		['payment-work:parallel-delay:settlement-delay', '5000 milliseconds']
	]);
	assert.deepEqual(
		completedRollbacks.map(({ name }) => name),
		['payment-work:parallel-delay:settlement-delay:completed']
	);
	assert.ok(completedRollbacks[0].rollback);
	const { startedAt, finishedAt, ...waitAttempt } = attempts[0];
	assert.deepEqual(waitAttempt, {
		runId: 'run-parallel-wait',
		ownerUserId: 'user-1',
		executionGeneration: 8,
		stepId: 'delay',
		visit: 0,
		durableStepName: 'payment-work:parallel-delay:settlement-delay',
		kind: 'forward',
		attempt: 1,
		outcome: 'complete',
		retry: { limit: 0, backoff: 'constant', timeoutMs: 0 },
		output: { type: 'none' }
	});
});

test('performs absolute waits inside parallel branches with branch-qualified attempts', async () => {
	const durableSleeps = [];
	const attempts = [];
	const plan = graphPlan(
		[
			{
				id: 'parallel',
				name: 'payment-work',
				type: 'parallel',
				config: { branches: [{ id: 'delay' }], resultKey: 'results' },
				branchTargets: { delay: 'delay' },
				joinTarget: 'join',
				continuationTarget: 'done'
			},
			{
				id: 'delay',
				name: 'settlement-window',
				type: 'wait-until',
				config: { timestamp: '2030-01-01T00:00:00.000Z' },
				next: 'join'
			}
		],
		'parallel'
	);

	await executeCorexWorkflow(
		{
			runId: 'run-parallel-wait-until',
			ownerUserId: 'user-1',
			input: { paymentId: 'pay-2' },
			plan
		},
		{
			async do(_name, optionsOrCallback, callback) {
				return (callback ?? optionsOrCallback)({
					step: { name: 'step', count: 1 },
					attempt: 1,
					config: {}
				});
			},
			async sleepUntil(name, timestamp) {
				durableSleeps.push([name, timestamp.toISOString()]);
			}
		},
		async () => undefined,
		fetch,
		undefined,
		undefined,
		9,
		async (attempt) => attempts.push(attempt)
	);

	assert.deepEqual(durableSleeps, [
		['payment-work:parallel-delay:settlement-window', '2030-01-01T00:00:00.000Z']
	]);
	const { startedAt, finishedAt, ...waitAttempt } = attempts[0];
	assert.deepEqual(waitAttempt, {
		runId: 'run-parallel-wait-until',
		ownerUserId: 'user-1',
		executionGeneration: 9,
		stepId: 'delay',
		visit: 0,
		durableStepName: 'payment-work:parallel-delay:settlement-window',
		kind: 'forward',
		attempt: 1,
		outcome: 'complete',
		retry: { limit: 0, backoff: 'constant', timeoutMs: 0 },
		output: { type: 'none' }
	});
});

test('registers and completes independent external-event waits inside parallel branches', async () => {
	const registrations = [];
	const completions = [];
	const waits = [];
	const attempts = [];
	const plan = graphPlan(
		[
			{
				id: 'parallel',
				name: 'collect-confirmations',
				type: 'parallel',
				config: { branches: [{ id: 'buyer' }, { id: 'seller' }], resultKey: 'results' },
				branchTargets: { buyer: 'buyer-confirmed', seller: 'seller-confirmed' },
				joinTarget: 'join',
				continuationTarget: 'done'
			},
			{
				id: 'buyer-confirmed',
				name: 'wait-for-buyer',
				type: 'wait-event',
				config: {
					eventType: 'buyer_confirmed',
					timeoutMs: 60_000,
					resultKey: 'confirmation',
					outputPolicy: { mode: 'inline', maxBytes: 1_024, redactPaths: ['$.source'] }
				},
				next: 'join'
			},
			{
				id: 'seller-confirmed',
				name: 'wait-for-seller',
				type: 'wait-event',
				config: { eventType: 'seller_confirmed', timeoutMs: 60_000, resultKey: 'confirmation' },
				next: 'join'
			}
		],
		'parallel'
	);

	const output = await executeCorexWorkflow(
		{ runId: 'run-parallel-events', ownerUserId: 'user-1', input: { orderId: 'ord-1' }, plan },
		{
			async do(name, optionsOrCallback, callback) {
				return (callback ?? optionsOrCallback)({
					step: { name, count: 1 },
					attempt: 1,
					config: {}
				});
			},
			async waitForEvent(name, options) {
				waits.push({ name, options });
				if (options.type.includes('buyer-confirmed')) await Promise.resolve();
				return {
					payload: { source: options.type.includes('buyer-confirmed') ? 'buyer' : 'seller' }
				};
			}
		},
		async () => undefined,
		fetch,
		undefined,
		undefined,
		4,
		async (attempt) => attempts.push(attempt),
		async (wait) => registrations.push(wait),
		async (wait) => completions.push(wait)
	);

	assert.deepEqual(
		registrations.map(({ stepId, eventType, waitEventType, durableStepName }) => ({
			stepId,
			eventType,
			waitEventType,
			durableStepName
		})),
		[
			{
				stepId: 'buyer-confirmed',
				eventType: 'buyer_confirmed',
				waitEventType: 'corex-wait-run-parallel-events-4-buyer-confirmed-0',
				durableStepName: 'collect-confirmations:parallel-buyer:wait-for-buyer'
			},
			{
				stepId: 'seller-confirmed',
				eventType: 'seller_confirmed',
				waitEventType: 'corex-wait-run-parallel-events-4-seller-confirmed-0',
				durableStepName: 'collect-confirmations:parallel-seller:wait-for-seller'
			}
		]
	);
	assert.deepEqual(
		waits.map(({ options }) => options.type),
		registrations.map((wait) => wait.waitEventType)
	);
	assert.deepEqual(
		new Set(completions.map((wait) => wait.stepId)),
		new Set(['buyer-confirmed', 'seller-confirmed'])
	);
	assert.deepEqual(output.results, {
		buyer: { orderId: 'ord-1', confirmation: { source: 'buyer' } },
		seller: { orderId: 'ord-1', confirmation: { source: 'seller' } }
	});
	assert.deepEqual(
		new Set(attempts.map((attempt) => attempt.stepId)),
		new Set(['buyer-confirmed', 'seller-confirmed'])
	);
	assert.deepEqual(
		attempts
			.map(({ stepId, output }) => ({ stepId, output }))
			.sort((left, right) => left.stepId.localeCompare(right.stepId)),
		[
			{
				stepId: 'buyer-confirmed',
				output: { type: 'object', bytes: 18, value: { source: '[REDACTED]' } }
			},
			{ stepId: 'seller-confirmed', output: { type: 'redacted' } }
		]
	);
});

test('awaits parallel active-wait persistence and propagates completion failures', async () => {
	let releaseRegistration;
	let waitStarted = false;
	const registration = new Promise((resolve) => {
		releaseRegistration = resolve;
	});
	const plan = graphPlan(
		[
			{
				id: 'parallel',
				name: 'collect-confirmations',
				type: 'parallel',
				config: { branches: [{ id: 'buyer' }], resultKey: 'results' },
				branchTargets: { buyer: 'buyer-confirmed' },
				joinTarget: 'join',
				continuationTarget: 'done'
			},
			{
				id: 'buyer-confirmed',
				name: 'wait-for-buyer',
				type: 'wait-event',
				config: { eventType: 'buyer_confirmed', timeoutMs: 60_000, resultKey: 'confirmation' },
				next: 'join'
			}
		],
		'parallel'
	);
	const execution = executeCorexWorkflow(
		{ runId: 'run-persisted-wait', ownerUserId: 'user-1', input: {}, plan },
		{
			async do(name, optionsOrCallback, callback) {
				return (callback ?? optionsOrCallback)({
					step: { name, count: 1 },
					attempt: 1,
					config: {}
				});
			},
			async waitForEvent() {
				waitStarted = true;
				return { payload: { source: 'buyer' } };
			}
		},
		async () => undefined,
		fetch,
		undefined,
		undefined,
		1,
		async () => undefined,
		async () => registration,
		async () => {
			throw new Error('completion persistence failed');
		}
	);

	await Promise.resolve();
	assert.equal(waitStarted, false);
	releaseRegistration();
	await assert.rejects(execution, /completion persistence failed/);
	assert.equal(waitStarted, true);
});

test('routes independent approval decisions inside parallel branches', async () => {
	const registrations = [];
	const completions = [];
	const attempts = [];
	const completedRollbacks = [];
	const plan = graphPlan(
		[
			{
				id: 'parallel',
				name: 'collect-reviews',
				type: 'parallel',
				config: { branches: [{ id: 'finance' }, { id: 'legal' }], resultKey: 'results' },
				branchTargets: { finance: 'finance-review', legal: 'legal-review' },
				joinTarget: 'join',
				continuationTarget: 'done'
			},
			{
				id: 'finance-review',
				name: 'review-finance',
				type: 'approval',
				config: {
					assigneeUserId: 'reviewer-1',
					timeoutMs: 60_000,
					resultKey: 'decision',
					outputPolicy: { mode: 'inline', maxBytes: 1_024, redactPaths: ['$.actorUserId'] }
				},
				whenApproved: 'finance-result',
				whenRejected: 'finance-result',
				compensation: {
					id: 'restore-finance-review',
					name: 'restore-finance-review',
					type: 'transform',
					config: { mode: 'merge', mappings: { decision: '$.output.decision' } }
				}
			},
			{
				id: 'finance-result',
				name: 'store-finance',
				type: 'transform',
				config: { mode: 'merge', mappings: { routed: '$.decision.decision' } },
				next: 'join'
			},
			{
				id: 'legal-review',
				name: 'review-legal',
				type: 'approval',
				config: { assigneeUserId: 'reviewer-1', timeoutMs: 60_000, resultKey: 'decision' },
				whenApproved: 'legal-result',
				whenRejected: 'legal-result'
			},
			{
				id: 'legal-result',
				name: 'store-legal',
				type: 'transform',
				config: { mode: 'merge', mappings: { routed: '$.decision.decision' } },
				next: 'join'
			}
		],
		'parallel'
	);

	const output = await executeCorexWorkflow(
		{ runId: 'run-parallel-approvals', ownerUserId: 'user-1', input: {}, plan },
		{
			async do(name, optionsOrCallback, callback, rollback) {
				if (name.endsWith(':completed')) completedRollbacks.push({ name, rollback });
				return (callback ?? optionsOrCallback)({
					step: { name, count: 1 },
					attempt: 1,
					config: {}
				});
			},
			async waitForEvent(_name, options) {
				const decision = options.type.includes('finance-review') ? 'approved' : 'rejected';
				return { payload: { decision, actorUserId: 'reviewer-1' } };
			}
		},
		async () => undefined,
		fetch,
		undefined,
		undefined,
		3,
		async (attempt) => attempts.push(attempt),
		async () => undefined,
		async (wait) => completions.push(wait),
		async (approval) => registrations.push(approval)
	);

	assert.deepEqual(
		registrations.map(({ stepId, assigneeUserId, waitEventType }) => ({
			stepId,
			assigneeUserId,
			waitEventType
		})),
		[
			{
				stepId: 'finance-review',
				assigneeUserId: 'reviewer-1',
				waitEventType: 'corex-wait-run-parallel-approvals-3-finance-review-0'
			},
			{
				stepId: 'legal-review',
				assigneeUserId: 'reviewer-1',
				waitEventType: 'corex-wait-run-parallel-approvals-3-legal-review-0'
			}
		]
	);
	assert.deepEqual(
		new Set(completions.map((wait) => wait.stepId)),
		new Set(['finance-review', 'legal-review'])
	);
	assert.equal(output.results.finance.routed, 'approved');
	assert.equal(output.results.legal.routed, 'rejected');
	assert.deepEqual(
		completedRollbacks.map(({ name }) => name),
		['collect-reviews:parallel-finance:review-finance:completed']
	);
	assert.ok(completedRollbacks[0].rollback);
	assert.deepEqual(
		attempts
			.filter((attempt) => attempt.stepId.endsWith('-review'))
			.map(({ stepId, output }) => ({ stepId, output }))
			.sort((left, right) => left.stepId.localeCompare(right.stepId)),
		[
			{
				stepId: 'finance-review',
				output: {
					type: 'object',
					bytes: 50,
					value: { decision: 'approved', actorUserId: '[REDACTED]' }
				}
			},
			{ stepId: 'legal-review', output: { type: 'redacted' } }
		]
	);
});

test('correlates parallel subprocesses and preserves configured result order', async () => {
	const starts = [];
	const resolutions = [];
	const attempts = [];
	const plan = graphPlan(
		[
			{
				id: 'parallel',
				name: 'generate-documents',
				type: 'parallel',
				config: { branches: [{ id: 'invoice' }, { id: 'receipt' }], resultKey: 'documents' },
				branchTargets: { invoice: 'invoice-process', receipt: 'receipt-process' },
				joinTarget: 'join',
				continuationTarget: 'done'
			},
			{
				id: 'invoice-process',
				name: 'create-invoice',
				type: 'invoke-process',
				next: 'join',
				config: {
					processId: '018f47a2-8391-7b1c-8f7a-f1d27670f099',
					inputPath: '$',
					resultKey: 'invoice',
					timeoutMs: 60_000
				}
			},
			{
				id: 'receipt-process',
				name: 'create-receipt',
				type: 'invoke-process',
				next: 'join',
				config: {
					processId: '018f47a2-8391-7b1c-8f7a-f1d27670f100',
					inputPath: '$',
					resultKey: 'receipt',
					timeoutMs: 60_000
				}
			}
		],
		'parallel'
	);
	let releaseInvoice;
	const invoiceResult = new Promise((resolve) => {
		releaseInvoice = resolve;
	});

	const output = await executeCorexWorkflow(
		{ runId: 'run-parallel-subprocess', ownerUserId: 'user-1', input: { orderId: 'ord-1' }, plan },
		{
			async do(name, optionsOrCallback, callback) {
				return (callback ?? optionsOrCallback)({
					step: { name, count: 1 },
					attempt: 1,
					config: {}
				});
			},
			async waitForEvent(_name, options) {
				const childRunId = options.type.endsWith('child-invoice')
					? 'child-invoice'
					: 'child-receipt';
				if (childRunId === 'child-invoice') await invoiceResult;
				else releaseInvoice();
				resolutions.push(childRunId);
				return { payload: { childRunId, status: 'complete', output: { childRunId } } };
			}
		},
		async () => undefined,
		fetch,
		async (step, _input, parent) => {
			starts.push({ stepId: step.id, parent });
			return {
				childRunId: step.id === 'invoice-process' ? 'child-invoice' : 'child-receipt',
				workflowInstanceId: `workflow-${step.id}`
			};
		},
		undefined,
		6,
		async (attempt) => attempts.push(attempt)
	);

	assert.deepEqual(resolutions, ['child-receipt', 'child-invoice']);
	assert.deepEqual(
		starts.map(({ stepId, parent }) => ({ stepId, invocationKey: parent.invocationKey })),
		[
			{ stepId: 'invoice-process', invocationKey: '6:invoice-process:0' },
			{ stepId: 'receipt-process', invocationKey: '6:receipt-process:0' }
		]
	);
	assert.deepEqual(Object.keys(output.documents), ['invoice', 'receipt']);
	assert.equal(output.documents.invoice.invoice.childRunId, 'child-invoice');
	assert.equal(output.documents.receipt.receipt.childRunId, 'child-receipt');
	assert.deepEqual(
		new Set(attempts.map((attempt) => attempt.stepId)),
		new Set(['invoice-process', 'receipt-process'])
	);
	assert.equal(
		attempts.every(
			(attempt) =>
				attempt.output.type === 'object' &&
				typeof attempt.output.bytes === 'number' &&
				!('value' in attempt.output)
		),
		true
	);
});

test('terminates only the timed-out subprocess inside a parallel branch', async () => {
	const terminations = [];
	const compensationCheckpoints = [];
	const plan = graphPlan(
		[
			{
				id: 'parallel',
				name: 'run-children',
				type: 'parallel',
				config: { branches: [{ id: 'slow' }, { id: 'fast' }], resultKey: 'children' },
				branchTargets: { slow: 'slow-process', fast: 'fast-process' },
				joinTarget: 'join',
				continuationTarget: 'done'
			},
			{
				id: 'slow-process',
				name: 'run-slow',
				type: 'invoke-process',
				next: 'join',
				config: {
					processId: '018f47a2-8391-7b1c-8f7a-f1d27670f099',
					inputPath: '$',
					resultKey: 'slow',
					timeoutMs: 1_000
				},
				compensation: {
					id: 'restore-slow-context',
					name: 'restore-slow-context',
					type: 'transform',
					config: { mode: 'replace', mappings: {} }
				}
			},
			{
				id: 'fast-process',
				name: 'run-fast',
				type: 'invoke-process',
				next: 'join',
				config: {
					processId: '018f47a2-8391-7b1c-8f7a-f1d27670f100',
					inputPath: '$',
					resultKey: 'fast',
					timeoutMs: 1_000
				}
			}
		],
		'parallel'
	);

	await assert.rejects(
		executeCorexWorkflow(
			{ runId: 'run-parallel-timeout', ownerUserId: 'user-1', input: {}, plan },
			{
				async do(name, optionsOrCallback, callback, rollback) {
					if (rollback) compensationCheckpoints.push(name);
					return (callback ?? optionsOrCallback)({
						step: { name, count: 1 },
						attempt: 1,
						config: {}
					});
				},
				async waitForEvent(_name, options) {
					if (options.type.endsWith('child-slow')) throw new Error('slow child timeout');
					return {
						payload: { childRunId: 'child-fast', status: 'complete', output: { ok: true } }
					};
				}
			},
			async () => undefined,
			fetch,
			async (step) => ({
				childRunId: step.id === 'slow-process' ? 'child-slow' : 'child-fast',
				workflowInstanceId: `workflow-${step.id}`
			}),
			async (step, child, parent) => terminations.push({ stepId: step.id, child, parent }),
			4
		),
		/slow child timeout/
	);

	assert.deepEqual(terminations, [
		{
			stepId: 'slow-process',
			child: { childRunId: 'child-slow', workflowInstanceId: 'workflow-slow-process' },
			parent: {
				runId: 'run-parallel-timeout',
				ownerUserId: 'user-1',
				invocationKey: '4:slow-process:0'
			}
		}
	]);
	assert.equal(
		compensationCheckpoints.includes('run-children:parallel-slow:run-slow:completed'),
		false
	);
});

test('registers compensation for an HTTP action inside a parallel branch', async () => {
	let rollbackOptions;
	const requests = [];
	const workflow = {
		async do(name, optionsOrCallback, callback, rollback) {
			if (name.includes('charge-card')) rollbackOptions = rollback;
			return (callback ?? optionsOrCallback)({ step: { name, count: 1 }, attempt: 1, config: {} });
		}
	};
	const branchAction = {
		...action(),
		id: 'charge',
		name: 'charge-card',
		next: 'join',
		compensation: {
			id: 'refund',
			name: 'refund-card',
			config: {
				method: 'POST',
				url: 'https://api.example.com/refunds',
				timeoutMs: 8_000,
				retry: { limit: 2, backoff: 'constant' },
				idempotencyKey: '$.input.paymentId'
			}
		}
	};
	const plan = graphPlan(
		[
			{
				id: 'parallel',
				name: 'payment-work',
				type: 'parallel',
				config: { branches: [{ id: 'charge' }], resultKey: 'results' },
				branchTargets: { charge: 'charge' },
				joinTarget: 'join',
				continuationTarget: 'done'
			},
			branchAction
		],
		'parallel'
	);
	const fetcher = async (url, init) => {
		requests.push({
			url: String(url),
			body: init.body,
			idempotencyKey: init.headers.get('Idempotency-Key')
		});
		return Response.json({ accepted: true }, { status: 202 });
	};

	await executeCorexWorkflow(
		{
			runId: 'run-parallel-compensation',
			ownerUserId: 'user-1',
			input: { paymentId: 'pay-2' },
			plan
		},
		workflow,
		async () => undefined,
		fetcher
	);

	assert.equal(requests.length, 1);
	assert.deepEqual(rollbackOptions.rollbackConfig, {
		retries: { limit: 2, delay: 1_000, backoff: 'constant' },
		timeout: 8_000
	});
	await rollbackOptions.rollback({
		ctx: { step: { name: 'charge-card', count: 1 }, attempt: 1, config: {} },
		error: new Error('later branch failed'),
		output: { accepted: true }
	});
	assert.equal(requests[1].url, 'https://api.example.com/refunds');
	assert.equal(requests[1].idempotencyKey, 'pay-2');
	assert.deepEqual(JSON.parse(requests[1].body).input, { paymentId: 'pay-2' });
});

test('records branch-qualified transform compensation inside a parallel branch', async () => {
	let rollbackOptions;
	const attempts = [];
	const workflow = {
		async do(name, optionsOrCallback, callback, rollback) {
			if (name.includes('charge-card')) rollbackOptions = rollback;
			return (callback ?? optionsOrCallback)({ step: { name, count: 1 }, attempt: 1, config: {} });
		}
	};
	const plan = graphPlan(
		[
			{
				id: 'parallel',
				name: 'payment-work',
				type: 'parallel',
				config: { branches: [{ id: 'charge' }], resultKey: 'results' },
				branchTargets: { charge: 'charge' },
				joinTarget: 'join',
				continuationTarget: 'done'
			},
			{
				...action(),
				id: 'charge',
				name: 'charge-card',
				next: 'join',
				compensation: {
					id: 'restore-context',
					name: 'restore-payment-context',
					type: 'transform',
					config: { mode: 'replace', mappings: { paymentId: '$.input.paymentId' } }
				}
			}
		],
		'parallel'
	);

	await executeCorexWorkflow(
		{
			runId: 'run-parallel-transform-rollback',
			ownerUserId: 'user-1',
			input: { paymentId: 'pay-2' },
			plan
		},
		workflow,
		async () => undefined,
		async () => Response.json({ accepted: true }, { status: 202 }),
		undefined,
		undefined,
		6,
		async (attempt) => attempts.push(attempt)
	);

	await rollbackOptions.rollback({
		ctx: { step: { name: 'charge-card', count: 1 }, attempt: 2, config: {} },
		error: new Error('later branch failed'),
		output: { status: 202, contentType: 'application/json', bytes: 17, body: { accepted: true } }
	});
	const { startedAt, finishedAt, ...rollbackAttempt } = attempts[1];
	assert.deepEqual(rollbackAttempt, {
		runId: 'run-parallel-transform-rollback',
		ownerUserId: 'user-1',
		executionGeneration: 6,
		stepId: 'restore-context',
		visit: 0,
		durableStepName: 'payment-work:parallel-charge:charge-card:rollback:restore-payment-context',
		kind: 'compensation',
		attempt: 2,
		outcome: 'complete',
		retry: { limit: 0, backoff: 'constant', timeoutMs: 0 },
		output: { type: 'object', bytes: 21 }
	});
});

test('records branch-qualified compensation for a transform action inside a parallel branch', async () => {
	let rollbackOptions;
	const attempts = [];
	const workflow = {
		async do(name, optionsOrCallback, callback, rollback) {
			if (name.includes('shape-payment')) rollbackOptions = rollback;
			return (callback ?? optionsOrCallback)({ step: { name, count: 1 }, attempt: 1, config: {} });
		}
	};
	const plan = graphPlan(
		[
			{
				id: 'parallel',
				name: 'payment-work',
				type: 'parallel',
				config: { branches: [{ id: 'shape' }], resultKey: 'results' },
				branchTargets: { shape: 'shape' },
				joinTarget: 'join',
				continuationTarget: 'done'
			},
			{
				id: 'shape',
				name: 'shape-payment',
				type: 'transform',
				next: 'join',
				config: { mode: 'merge', mappings: { normalizedId: '$.paymentId' } },
				compensation: {
					id: 'restore-context',
					name: 'restore-payment-context',
					type: 'transform',
					config: { mode: 'replace', mappings: { paymentId: '$.input.paymentId' } }
				}
			}
		],
		'parallel'
	);

	await executeCorexWorkflow(
		{
			runId: 'run-parallel-transform-action-rollback',
			ownerUserId: 'user-1',
			input: { paymentId: 'pay-2' },
			plan
		},
		workflow,
		async () => undefined,
		fetch,
		undefined,
		undefined,
		7,
		async (attempt) => attempts.push(attempt)
	);

	assert.ok(rollbackOptions);
	await rollbackOptions.rollback({
		ctx: { step: { name: 'shape-payment', count: 1 }, attempt: 2, config: {} },
		error: new Error('later branch failed'),
		output: { paymentId: 'pay-2', normalizedId: 'pay-2' }
	});
	const { startedAt, finishedAt, ...rollbackAttempt } = attempts[1];
	assert.deepEqual(rollbackAttempt, {
		runId: 'run-parallel-transform-action-rollback',
		ownerUserId: 'user-1',
		executionGeneration: 7,
		stepId: 'restore-context',
		visit: 0,
		durableStepName: 'payment-work:parallel-shape:shape-payment:rollback:restore-payment-context',
		kind: 'compensation',
		attempt: 2,
		outcome: 'complete',
		retry: { limit: 0, backoff: 'constant', timeoutMs: 0 },
		output: { type: 'object', bytes: 21 }
	});
});

test('records branch-qualified HTTP compensation for a transform action inside a parallel branch', async () => {
	let rollbackOptions;
	const attempts = [];
	const requests = [];
	const workflow = {
		async do(name, optionsOrCallback, callback, rollback) {
			if (name.includes('shape-payment')) rollbackOptions = rollback;
			return (callback ?? optionsOrCallback)({ step: { name, count: 1 }, attempt: 1, config: {} });
		}
	};
	const plan = graphPlan(
		[
			{
				id: 'parallel',
				name: 'payment-work',
				type: 'parallel',
				config: { branches: [{ id: 'shape' }], resultKey: 'results' },
				branchTargets: { shape: 'shape' },
				joinTarget: 'join',
				continuationTarget: 'done'
			},
			{
				id: 'shape',
				name: 'shape-payment',
				type: 'transform',
				next: 'join',
				config: { mode: 'merge', mappings: { normalizedId: '$.paymentId' } },
				compensation: {
					id: 'reverse-payment',
					name: 'reverse-payment',
					type: 'http-request',
					config: {
						method: 'POST',
						url: 'https://api.example.test/payments/reverse',
						timeoutMs: 5_000,
						retry: { limit: 1, backoff: 'constant' }
					}
				}
			}
		],
		'parallel'
	);
	const fetcher = async (url) => {
		requests.push(url);
		return Response.json({ reversed: true });
	};

	await executeCorexWorkflow(
		{
			runId: 'run-parallel-transform-http-rollback',
			ownerUserId: 'user-1',
			input: { paymentId: 'pay-2' },
			plan
		},
		workflow,
		async () => undefined,
		fetcher,
		undefined,
		undefined,
		8,
		async (attempt) => attempts.push(attempt)
	);

	assert.ok(rollbackOptions);
	await rollbackOptions.rollback({
		ctx: { step: { name: 'shape-payment', count: 1 }, attempt: 2, config: {} },
		error: new Error('later branch failed'),
		output: { paymentId: 'pay-2', normalizedId: 'pay-2' }
	});
	assert.deepEqual(requests, ['https://api.example.test/payments/reverse']);
	const { startedAt, finishedAt, ...rollbackAttempt } = attempts[1];
	assert.equal(
		rollbackAttempt.durableStepName,
		'payment-work:parallel-shape:shape-payment:rollback:reverse-payment'
	);
	assert.equal(rollbackAttempt.kind, 'compensation');
	assert.equal(rollbackAttempt.outcome, 'complete');
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
	const attempts = [];
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
		},
		undefined,
		undefined,
		1,
		async (attempt) => attempts.push(attempt)
	);

	assert.deepEqual(durableSleeps, [['settlement-delay', '5000 milliseconds']]);
	assert.deepEqual(requests, [{ payment: { id: 'pay-42' }, amount: 125, normalizedId: 'pay-42' }]);
	assert.deepEqual(
		events.map((event) => event.sequence),
		[0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
	);
	assert.deepEqual(
		attempts
			.filter((attempt) => attempt.stepId === 'wait')
			.map(({ startedAt, finishedAt, ...attempt }) => attempt),
		[
			{
				runId: 'run-1',
				ownerUserId: 'user-1',
				executionGeneration: 1,
				stepId: 'wait',
				visit: 0,
				durableStepName: 'settlement-delay',
				kind: 'forward',
				attempt: 1,
				outcome: 'complete',
				retry: { limit: 0, backoff: 'constant', timeoutMs: 0 },
				output: { type: 'none' }
			}
		]
	);
	assert.deepEqual(result, { accepted: true });
});

test('records transform attempts without persisting transformed context', async () => {
	const attempts = [];
	const plan = graphPlan([
		{
			id: 'shape',
			name: 'shape-input',
			type: 'transform',
			next: 'done',
			config: { mode: 'merge', mappings: { normalizedId: '$.payment.id' } }
		}
	]);

	const result = await executeCorexWorkflow(
		{
			runId: 'run-transform',
			ownerUserId: 'user-1',
			input: { payment: { id: 'pay-42' }, secret: 'private' },
			plan
		},
		{
			async do(name, optionsOrCallback, callback) {
				return (callback ?? optionsOrCallback)({
					step: { name, count: 1 },
					attempt: 1,
					config: {}
				});
			}
		},
		async () => undefined,
		fetch,
		undefined,
		undefined,
		2,
		async (attempt) => attempts.push(attempt)
	);

	assert.deepEqual(result, {
		payment: { id: 'pay-42' },
		secret: 'private',
		normalizedId: 'pay-42'
	});
	assert.equal(attempts.length, 1);
	const { startedAt, finishedAt, ...attempt } = attempts[0];
	assert.deepEqual(attempt, {
		runId: 'run-transform',
		ownerUserId: 'user-1',
		executionGeneration: 2,
		stepId: 'shape',
		visit: 0,
		durableStepName: 'shape-input',
		kind: 'forward',
		attempt: 1,
		outcome: 'complete',
		retry: { limit: 0, backoff: 'constant', timeoutMs: 0 },
		output: { type: 'object', bytes: new TextEncoder().encode(JSON.stringify(result)).byteLength }
	});
	assert.equal(Date.parse(finishedAt) >= Date.parse(startedAt), true);
	assert.equal(JSON.stringify(attempts).includes('private'), false);
});

test('records transform output inline when the configured byte limit permits it', async () => {
	const attempts = [];
	const plan = graphPlan([
		{
			id: 'shape',
			name: 'shape-inline-output',
			type: 'transform',
			next: 'done',
			config: {
				mode: 'replace',
				mappings: { normalizedId: '$.payment.id' },
				outputPolicy: { mode: 'inline', maxBytes: 128 }
			}
		}
	]);

	await executeCorexWorkflow(
		{
			runId: 'run-inline-transform',
			ownerUserId: 'user-1',
			input: { payment: { id: 'pay-42' } },
			plan
		},
		{
			async do(name, optionsOrCallback, callback) {
				return (callback ?? optionsOrCallback)({
					step: { name, count: 1 },
					attempt: 1,
					config: {}
				});
			}
		},
		async () => undefined,
		fetch,
		undefined,
		undefined,
		1,
		async (attempt) => attempts.push(attempt)
	);

	const value = { normalizedId: 'pay-42' };
	assert.deepEqual(attempts[0].output, {
		type: 'object',
		bytes: new TextEncoder().encode(JSON.stringify(value)).byteLength,
		value
	});
});

test('redacts configured transform output paths without mutating execution output', async () => {
	const attempts = [];
	const plan = graphPlan([
		{
			id: 'shape',
			name: 'shape-redacted-output',
			type: 'transform',
			next: 'done',
			config: {
				mode: 'replace',
				mappings: { customer: '$.customer' },
				outputPolicy: {
					mode: 'inline',
					maxBytes: 128,
					redactPaths: ['$.customer.email']
				}
			}
		}
	]);
	const input = { customer: { email: 'private@example.com', name: 'Ada' } };

	const result = await executeCorexWorkflow(
		{ runId: 'run-redacted-transform', ownerUserId: 'user-1', input, plan },
		recordedDurableWorkflow(),
		async () => undefined,
		fetch,
		undefined,
		undefined,
		1,
		async (attempt) => attempts.push(attempt)
	);

	assert.deepEqual(attempts[0].output.value, {
		customer: { email: '[REDACTED]', name: 'Ada' }
	});
	assert.equal(result.customer.email, 'private@example.com');
});

test('applies the transform inline size limit after redaction', async () => {
	const attempts = [];
	const plan = graphPlan([
		{
			id: 'shape',
			name: 'shape-redacted-size',
			type: 'transform',
			next: 'done',
			config: {
				mode: 'replace',
				mappings: { secret: '$.secret' },
				outputPolicy: { mode: 'inline', maxBytes: 32, redactPaths: ['$.secret'] }
			}
		}
	]);
	const value = { secret: 'x'.repeat(200) };

	await executeCorexWorkflow(
		{ runId: 'run-redacted-transform-size', ownerUserId: 'user-1', input: value, plan },
		recordedDurableWorkflow(),
		async () => undefined,
		fetch,
		undefined,
		undefined,
		1,
		async (attempt) => attempts.push(attempt)
	);

	assert.deepEqual(attempts[0].output, {
		type: 'object',
		bytes: new TextEncoder().encode(JSON.stringify(value)).byteLength,
		value: { secret: '[REDACTED]' }
	});
});

test('falls back to transform output metadata when inline output exceeds the configured limit', async () => {
	const attempts = [];
	const plan = graphPlan([
		{
			id: 'shape',
			name: 'shape-oversized-output',
			type: 'transform',
			next: 'done',
			config: {
				mode: 'replace',
				mappings: { normalizedId: '$.payment.id' },
				outputPolicy: { mode: 'inline', maxBytes: 8 }
			}
		}
	]);

	await executeCorexWorkflow(
		{
			runId: 'run-oversized-transform',
			ownerUserId: 'user-1',
			input: { payment: { id: 'pay-42' } },
			plan
		},
		{
			async do(name, optionsOrCallback, callback) {
				return (callback ?? optionsOrCallback)({
					step: { name, count: 1 },
					attempt: 1,
					config: {}
				});
			}
		},
		async () => undefined,
		fetch,
		undefined,
		undefined,
		1,
		async (attempt) => attempts.push(attempt)
	);

	const value = { normalizedId: 'pay-42' };
	assert.deepEqual(attempts[0].output, {
		type: 'object',
		bytes: new TextEncoder().encode(JSON.stringify(value)).byteLength,
		truncated: true
	});
	assert.equal('value' in attempts[0].output, false);
});

test('stores redacted transform output externally without mutating execution output', async () => {
	const attempts = [];
	const stored = [];
	const input = { customer: { email: 'private@example.com', name: 'Ada' } };
	const plan = graphPlan([
		{
			id: 'shape',
			name: 'shape-external-output',
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
		}
	]);

	const result = await executeCorexWorkflow(
		{ runId: 'run-external-transform', ownerUserId: 'user-1', input, plan },
		recordedDurableWorkflow(),
		async () => undefined,
		fetch,
		undefined,
		undefined,
		3,
		async (attempt) => attempts.push(attempt),
		undefined,
		undefined,
		undefined,
		async (object) => stored.push(object)
	);

	assert.equal(result.customer.email, 'private@example.com');
	assert.equal(stored.length, 1);
	assert.equal(
		stored[0].key,
		'corex-output/2c5c272c9a65ed1d7303c80b3a9a332267d5afc2b2c91e59b4dbcb42061a48a6.json'
	);
	assert.deepEqual(JSON.parse(new TextDecoder().decode(stored[0].body)), {
		customer: { email: '[REDACTED]', name: 'Ada' }
	});
	assert.equal(JSON.stringify(stored).includes('private@example.com'), false);
	assert.deepEqual(attempts[0].output, {
		type: 'object',
		bytes: new TextEncoder().encode(JSON.stringify(result)).byteLength,
		external: {
			key: stored[0].key,
			bytes: stored[0].body.byteLength,
			contentType: 'application/json'
		}
	});
});

test('falls back to transform metadata when external output storage fails', async () => {
	const attempts = [];
	const plan = graphPlan([
		{
			id: 'shape',
			name: 'shape-external-fallback',
			type: 'transform',
			next: 'done',
			config: {
				mode: 'replace',
				mappings: { normalizedId: '$.payment.id' },
				outputPolicy: { mode: 'external', maxBytes: 1024 }
			}
		}
	]);

	const result = await executeCorexWorkflow(
		{
			runId: 'run-external-fallback',
			ownerUserId: 'user-1',
			input: { payment: { id: 'pay-42' } },
			plan
		},
		recordedDurableWorkflow(),
		async () => undefined,
		fetch,
		undefined,
		undefined,
		1,
		async (attempt) => attempts.push(attempt),
		undefined,
		undefined,
		undefined,
		async () => {
			throw new Error('storage unavailable');
		}
	);

	assert.deepEqual(result, { normalizedId: 'pay-42' });
	assert.deepEqual(attempts[0].output, {
		type: 'object',
		bytes: new TextEncoder().encode(JSON.stringify(result)).byteLength,
		truncated: true
	});
});

test('stores transform output externally inside a parallel branch', async () => {
	const attempts = [];
	const stored = [];
	const plan = graphPlan([
		{
			id: 'parallel',
			name: 'collect',
			type: 'parallel',
			config: { branches: [{ id: 'buyer' }], resultKey: 'results' },
			branchTargets: { buyer: 'shape' },
			joinTarget: 'join',
			continuationTarget: 'done'
		},
		{
			id: 'shape',
			name: 'shape-buyer',
			type: 'transform',
			next: 'join',
			config: {
				mode: 'replace',
				mappings: { id: '$.id' },
				outputPolicy: { mode: 'external', maxBytes: 1024 }
			}
		}
	]);

	await executeCorexWorkflow(
		{ runId: 'run-parallel-external', ownerUserId: 'user-1', input: { id: 'buyer-1' }, plan },
		recordedDurableWorkflow(),
		async () => undefined,
		fetch,
		undefined,
		undefined,
		1,
		async (attempt) => attempts.push(attempt),
		undefined,
		undefined,
		undefined,
		async (object) => stored.push(object)
	);

	assert.equal(stored.length, 1);
	assert.equal(
		attempts.find((attempt) => attempt.stepId === 'shape').output.external.key,
		stored[0].key
	);
});

test('records sanitized transform failures from a malformed trusted plan', async () => {
	const attempts = [];
	const plan = graphPlan([
		{
			id: 'shape',
			name: 'shape-input',
			type: 'transform',
			next: 'done',
			config: { mode: 'merge', mappings: null }
		}
	]);

	await assert.rejects(
		executeCorexWorkflow(
			{ runId: 'run-transform', ownerUserId: 'user-1', input: {}, plan },
			{
				async do(name, optionsOrCallback, callback) {
					return (callback ?? optionsOrCallback)({
						step: { name, count: 1 },
						attempt: 1,
						config: {}
					});
				}
			},
			async () => undefined,
			fetch,
			undefined,
			undefined,
			1,
			async (attempt) => attempts.push(attempt)
		),
		/Cannot convert undefined or null to object/
	);

	assert.equal(attempts.length, 1);
	const { startedAt, finishedAt, ...attempt } = attempts[0];
	assert.deepEqual(attempt, {
		runId: 'run-transform',
		ownerUserId: 'user-1',
		executionGeneration: 1,
		stepId: 'shape',
		visit: 0,
		durableStepName: 'shape-input',
		kind: 'forward',
		attempt: 1,
		outcome: 'failed',
		retry: { limit: 0, backoff: 'constant', timeoutMs: 0 },
		error: { code: 'transform_step_failed' }
	});
	assert.equal(Date.parse(finishedAt) >= Date.parse(startedAt), true);
	assert.equal(JSON.stringify(attempts).includes('Cannot convert'), false);
});

test('ignores an attempt recorder failure after a successful transform', async () => {
	const plan = graphPlan([
		{
			id: 'shape',
			name: 'shape-input',
			type: 'transform',
			next: 'done',
			config: { mode: 'merge', mappings: { normalizedId: '$.payment.id' } }
		}
	]);

	const result = await executeCorexWorkflow(
		{ runId: 'run-transform', ownerUserId: 'user-1', input: { payment: { id: 'pay-42' } }, plan },
		{
			async do(name, optionsOrCallback, callback) {
				return (callback ?? optionsOrCallback)({
					step: { name, count: 1 },
					attempt: 1,
					config: {}
				});
			}
		},
		async () => undefined,
		fetch,
		undefined,
		undefined,
		1,
		async () => {
			throw new Error('telemetry unavailable');
		}
	);

	assert.deepEqual(result, { payment: { id: 'pay-42' }, normalizedId: 'pay-42' });
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

test('records bounded attempts for condition and switch decisions', async () => {
	const attempts = [];
	const plan = graphPlan([
		{
			id: 'eligible',
			name: 'check-eligibility',
			type: 'condition',
			config: { path: '$.eligible', operator: 'equals', value: true },
			whenTrue: 'currency',
			whenFalse: 'done'
		},
		{
			id: 'currency',
			name: 'route-currency',
			type: 'switch',
			config: { path: '$.currency', cases: [{ id: 'uah', value: 'UAH' }] },
			targets: { uah: 'done' },
			defaultTarget: 'done'
		}
	]);

	await executeCorexWorkflow(
		{
			runId: 'run-decisions',
			ownerUserId: 'user-1',
			input: { eligible: true, currency: 'UAH', secret: 'private' },
			plan
		},
		{
			async do(name, optionsOrCallback, callback) {
				return (callback ?? optionsOrCallback)({
					step: { name, count: 1 },
					attempt: 1,
					config: {}
				});
			}
		},
		async () => undefined,
		fetch,
		undefined,
		undefined,
		3,
		async (attempt) => attempts.push(attempt)
	);

	assert.equal(attempts.length, 2);
	assert.deepEqual(
		attempts.map(({ startedAt, finishedAt, ...attempt }) => attempt),
		['eligible', 'currency'].map((stepId, index) => ({
			runId: 'run-decisions',
			ownerUserId: 'user-1',
			executionGeneration: 3,
			stepId,
			visit: 0,
			durableStepName: index === 0 ? 'check-eligibility' : 'route-currency',
			kind: 'forward',
			attempt: 1,
			outcome: 'complete',
			retry: { limit: 0, backoff: 'constant', timeoutMs: 0 },
			output: { type: 'none' }
		}))
	);
	assert.equal(JSON.stringify(attempts).includes('private'), false);
});

test('executes bounded loops with deterministic visit identities', async () => {
	const durableSteps = [];
	const events = [];
	const attempts = [];
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
				return (callback ?? optionsOrCallback)({
					step: { name, count: 1 },
					attempt: 1,
					config: {}
				});
			}
		},
		async (event) => events.push(event),
		fetch,
		undefined,
		undefined,
		2,
		async (attempt) => attempts.push(attempt)
	);

	assert.deepEqual(output, { value: 42 });
	assert.deepEqual(
		durableSteps.filter((name) => name === 'bounded-loop' || name.startsWith('bounded-loop:')),
		['bounded-loop', 'bounded-loop:visit-1', 'bounded-loop:visit-2', 'bounded-loop:visit-3']
	);
	assert.equal(events.filter((event) => event.stepName === 'loop-body').length, 6);
	assert.deepEqual(
		attempts
			.filter((attempt) => attempt.stepId === 'loop')
			.map(({ startedAt, finishedAt, ...attempt }) => attempt),
		[0, 1, 2, 3].map((visit) => ({
			runId: 'run-loop',
			ownerUserId: 'user-1',
			executionGeneration: 2,
			stepId: 'loop',
			visit,
			durableStepName: visit === 0 ? 'bounded-loop' : `bounded-loop:visit-${visit}`,
			kind: 'forward',
			attempt: 1,
			outcome: 'complete',
			retry: { limit: 0, backoff: 'constant', timeoutMs: 0 },
			output: { type: 'none' }
		}))
	);
});

test('executes a reusable local function serially without starting subprocesses', async () => {
	const attempts = [];
	const plan = graphPlan([
		{
			id: 'first-call',
			name: 'normalize-first',
			type: 'local-call',
			config: { inputPath: '$.first', resultKey: 'firstResult' },
			bodyTarget: 'normalize-body',
			returnTarget: 'normalize-return',
			next: 'second-call'
		},
		{
			id: 'second-call',
			name: 'normalize-second',
			type: 'local-call',
			config: { inputPath: '$.second', resultKey: 'secondResult' },
			bodyTarget: 'normalize-body',
			returnTarget: 'normalize-return',
			next: 'done'
		},
		{
			id: 'normalize-body',
			name: 'normalize-value',
			type: 'transform',
			config: { mode: 'replace', mappings: { value: '$.value' } },
			next: 'normalize-return'
		}
	]);
	let subprocessStarts = 0;

	const output = await executeCorexWorkflow(
		{
			runId: 'run-local-call',
			ownerUserId: 'user-1',
			input: { first: { value: 1 }, second: { value: 2 } },
			plan
		},
		recordedDurableWorkflow(),
		async () => undefined,
		fetch,
		async () => {
			subprocessStarts += 1;
			throw new Error('Local calls must not start subprocesses.');
		},
		undefined,
		1,
		async (attempt) => attempts.push(attempt)
	);

	assert.deepEqual(output, {
		first: { value: 1 },
		second: { value: 2 },
		firstResult: { value: 1 },
		secondResult: { value: 2 }
	});
	assert.equal(subprocessStarts, 0);
	assert.deepEqual(
		attempts.map((attempt) => ({
			stepId: attempt.stepId,
			visit: attempt.visit,
			durableStepName: attempt.durableStepName
		})),
		[
			{ stepId: 'first-call', visit: 0, durableStepName: 'normalize-first' },
			{ stepId: 'normalize-body', visit: 0, durableStepName: 'normalize-value' },
			{ stepId: 'second-call', visit: 0, durableStepName: 'normalize-second' },
			{ stepId: 'normalize-body', visit: 1, durableStepName: 'normalize-value:visit-1' }
		]
	);
});

test('executes a terminating recursive local function with isolated call frames', async () => {
	const attempts = [];
	const plan = graphPlan([
		{
			id: 'entry-call',
			name: 'walk-list',
			type: 'local-call',
			config: { inputPath: '$', resultKey: 'result' },
			bodyTarget: 'has-next',
			returnTarget: 'walk-return',
			next: 'done'
		},
		{
			id: 'has-next',
			name: 'has-next-item',
			type: 'condition',
			config: { path: '$.next', operator: 'exists' },
			whenTrue: 'recursive-call',
			whenFalse: 'walk-return'
		},
		{
			id: 'recursive-call',
			name: 'walk-next',
			type: 'local-call',
			config: { inputPath: '$.next', resultKey: 'child' },
			bodyTarget: 'has-next',
			returnTarget: 'walk-return',
			next: 'walk-return'
		}
	]);

	const output = await executeCorexWorkflow(
		{
			runId: 'run-recursive-local-call',
			ownerUserId: 'user-1',
			input: { value: 1, next: { value: 2, next: { value: 3 } } },
			plan
		},
		recordedDurableWorkflow(),
		async () => undefined,
		fetch,
		undefined,
		undefined,
		1,
		async (attempt) => attempts.push(attempt)
	);

	assert.deepEqual(output.result, {
		value: 1,
		next: { value: 2, next: { value: 3 } },
		child: {
			value: 2,
			next: { value: 3 },
			child: { value: 3 }
		}
	});
	assert.deepEqual(
		attempts
			.filter((attempt) => attempt.stepId === 'recursive-call')
			.map((attempt) => attempt.visit),
		[0, 1]
	);
});

test('rejects recursive local functions that exceed the call depth limit', async () => {
	const plan = graphPlan([
		{
			id: 'recursive-call',
			name: 'recurse-forever',
			type: 'local-call',
			config: { inputPath: '$', resultKey: 'result' },
			bodyTarget: 'recursive-call',
			returnTarget: 'recursive-return',
			next: 'done'
		}
	]);

	await assert.rejects(
		executeCorexWorkflow(
			{ runId: 'run-recursion-limit', ownerUserId: 'user-1', input: {}, plan },
			recordedDurableWorkflow(),
			async () => undefined
		),
		/Local function call depth exceeded 64\./
	);
});

test('executes reusable local functions with isolated contexts inside parallel branches', async () => {
	const attempts = [];
	const plan = graphPlan([
		{
			id: 'parallel',
			name: 'normalize-inputs',
			type: 'parallel',
			config: { branches: [{ id: 'first' }, { id: 'second' }], resultKey: 'normalized' },
			branchTargets: { first: 'first-call', second: 'second-call' },
			joinTarget: 'join',
			continuationTarget: 'done'
		},
		{
			id: 'first-call',
			name: 'normalize-first',
			type: 'local-call',
			config: { inputPath: '$.first', resultKey: 'result' },
			bodyTarget: 'normalize-body',
			returnTarget: 'normalize-return',
			next: 'join'
		},
		{
			id: 'second-call',
			name: 'normalize-second',
			type: 'local-call',
			config: { inputPath: '$.second', resultKey: 'result' },
			bodyTarget: 'normalize-body',
			returnTarget: 'normalize-return',
			next: 'join'
		},
		{
			id: 'normalize-body',
			name: 'normalize-value',
			type: 'transform',
			config: { mode: 'replace', mappings: { value: '$.value' } },
			next: 'normalize-return'
		}
	]);
	let subprocessStarts = 0;

	const output = await executeCorexWorkflow(
		{
			runId: 'run-parallel-local-call',
			ownerUserId: 'user-1',
			input: { first: { value: 1 }, second: { value: 2 } },
			plan
		},
		recordedDurableWorkflow(),
		async () => undefined,
		fetch,
		async () => {
			subprocessStarts += 1;
			throw new Error('Local calls must not start subprocesses.');
		},
		undefined,
		1,
		async (attempt) => attempts.push(attempt)
	);

	assert.deepEqual(output, {
		first: { value: 1 },
		second: { value: 2 },
		normalized: {
			first: { first: { value: 1 }, second: { value: 2 }, result: { value: 1 } },
			second: { first: { value: 1 }, second: { value: 2 }, result: { value: 2 } }
		}
	});
	assert.equal(subprocessStarts, 0);
	assert.deepEqual(
		attempts
			.map((attempt) => ({ stepId: attempt.stepId, durableStepName: attempt.durableStepName }))
			.sort((left, right) => left.durableStepName.localeCompare(right.durableStepName)),
		[
			{ stepId: 'first-call', durableStepName: 'normalize-inputs:parallel-first:normalize-first' },
			{
				stepId: 'normalize-body',
				durableStepName: 'normalize-inputs:parallel-first:normalize-value'
			},
			{
				stepId: 'second-call',
				durableStepName: 'normalize-inputs:parallel-second:normalize-second'
			},
			{
				stepId: 'normalize-body',
				durableStepName: 'normalize-inputs:parallel-second:normalize-value'
			}
		].sort((left, right) => left.durableStepName.localeCompare(right.durableStepName))
	);
});

test('executes a serial block body before its continuation without starting a subprocess', async () => {
	const attempts = [];
	const plan = graphPlan([
		{
			id: 'prepare-block',
			name: 'prepare-payment',
			type: 'block',
			config: {},
			bodyTarget: 'normalize-body',
			continuationTarget: 'prepare-result'
		},
		{
			id: 'normalize-body',
			name: 'normalize-payment',
			type: 'transform',
			config: { mode: 'merge', mappings: { paymentId: '$.payment.id' } },
			next: 'prepare-result'
		},
		{
			id: 'prepare-result',
			name: 'prepare-result',
			type: 'transform',
			config: { mode: 'merge', mappings: { result: '$.paymentId' } },
			next: 'done'
		}
	]);
	let subprocessStarts = 0;

	const output = await executeCorexWorkflow(
		{
			runId: 'run-block',
			ownerUserId: 'user-1',
			input: { payment: { id: 'payment-1' } },
			plan
		},
		recordedDurableWorkflow(),
		async () => undefined,
		fetch,
		async () => {
			subprocessStarts += 1;
			throw new Error('Blocks must not start subprocesses.');
		},
		undefined,
		1,
		async (attempt) => attempts.push(attempt)
	);

	assert.deepEqual(output, {
		payment: { id: 'payment-1' },
		paymentId: 'payment-1',
		result: 'payment-1'
	});
	assert.equal(subprocessStarts, 0);
	assert.deepEqual(
		attempts.map((attempt) => attempt.stepId),
		['normalize-body', 'prepare-result']
	);
});

test('executes parallel branches inside a block body before its continuation', async () => {
	const attempts = [];
	const plan = graphPlan([
		{
			id: 'prepare-block',
			name: 'prepare-payment',
			type: 'block',
			config: {},
			bodyTarget: 'parallel',
			continuationTarget: 'finish'
		},
		{
			id: 'parallel',
			name: 'prepare-details',
			type: 'parallel',
			config: { branches: [{ id: 'risk' }, { id: 'receipt' }], resultKey: 'preparation' },
			branchTargets: { risk: 'risk', receipt: 'receipt' },
			joinTarget: 'join',
			continuationTarget: 'finish'
		},
		{
			id: 'risk',
			name: 'prepare-risk',
			type: 'transform',
			config: { mode: 'merge', mappings: { riskPaymentId: '$.payment.id' } },
			next: 'join'
		},
		{
			id: 'receipt',
			name: 'prepare-receipt',
			type: 'transform',
			config: { mode: 'merge', mappings: { receiptPaymentId: '$.payment.id' } },
			next: 'join'
		},
		{
			id: 'finish',
			name: 'finish-payment',
			type: 'transform',
			config: { mode: 'merge', mappings: { result: '$.preparation.risk.riskPaymentId' } },
			next: 'done'
		}
	]);
	let subprocessStarts = 0;

	const output = await executeCorexWorkflow(
		{
			runId: 'run-parallel-block',
			ownerUserId: 'user-1',
			input: { payment: { id: 'payment-1' } },
			plan
		},
		recordedDurableWorkflow(),
		async () => undefined,
		fetch,
		async () => {
			subprocessStarts += 1;
			throw new Error('Blocks must not start subprocesses.');
		},
		undefined,
		1,
		async (attempt) => attempts.push(attempt)
	);

	assert.deepEqual(output, {
		payment: { id: 'payment-1' },
		preparation: {
			risk: { payment: { id: 'payment-1' }, riskPaymentId: 'payment-1' },
			receipt: { payment: { id: 'payment-1' }, receiptPaymentId: 'payment-1' }
		},
		result: 'payment-1'
	});
	assert.equal(subprocessStarts, 0);
	assert.deepEqual(
		attempts.map((attempt) => ({
			stepId: attempt.stepId,
			durableStepName: attempt.durableStepName
		})),
		[
			{ stepId: 'risk', durableStepName: 'prepare-details:parallel-risk:prepare-risk' },
			{ stepId: 'receipt', durableStepName: 'prepare-details:parallel-receipt:prepare-receipt' },
			{ stepId: 'finish', durableStepName: 'finish-payment' }
		]
	);
});

test('executes nested serial block bodies in continuation order', async () => {
	const attempts = [];
	const plan = graphPlan([
		{
			id: 'outer-block',
			name: 'prepare-payment',
			type: 'block',
			config: {},
			bodyTarget: 'inner-block',
			continuationTarget: 'outer-result'
		},
		{
			id: 'inner-block',
			name: 'normalize-payment',
			type: 'block',
			config: {},
			bodyTarget: 'inner-body',
			continuationTarget: 'inner-result'
		},
		{
			id: 'inner-body',
			name: 'copy-payment-id',
			type: 'transform',
			config: { mode: 'merge', mappings: { paymentId: '$.payment.id' } },
			next: 'inner-result'
		},
		{
			id: 'inner-result',
			name: 'mark-normalized',
			type: 'transform',
			config: { mode: 'merge', mappings: { normalizedId: '$.paymentId' } },
			next: 'outer-result'
		},
		{
			id: 'outer-result',
			name: 'prepare-result',
			type: 'transform',
			config: { mode: 'merge', mappings: { result: '$.normalizedId' } },
			next: 'done'
		}
	]);
	let subprocessStarts = 0;

	const output = await executeCorexWorkflow(
		{
			runId: 'run-nested-block',
			ownerUserId: 'user-1',
			input: { payment: { id: 'payment-1' } },
			plan
		},
		recordedDurableWorkflow(),
		async () => undefined,
		fetch,
		async () => {
			subprocessStarts += 1;
			throw new Error('Nested blocks must not start subprocesses.');
		},
		undefined,
		1,
		async (attempt) => attempts.push(attempt)
	);

	assert.deepEqual(output, {
		payment: { id: 'payment-1' },
		paymentId: 'payment-1',
		normalizedId: 'payment-1',
		result: 'payment-1'
	});
	assert.equal(subprocessStarts, 0);
	assert.deepEqual(
		attempts.map((attempt) => attempt.stepId),
		['inner-body', 'inner-result', 'outer-result']
	);
});

test('executes a serial block inside a parallel branch', async () => {
	const attempts = [];
	const plan = graphPlan(
		[
			{
				id: 'parallel',
				name: 'prepare-payments',
				type: 'parallel',
				config: { branches: [{ id: 'payment' }], resultKey: 'prepared' },
				branchTargets: { payment: 'prepare-block' },
				joinTarget: 'join',
				continuationTarget: 'done'
			},
			{
				id: 'prepare-block',
				name: 'prepare-payment',
				type: 'block',
				config: {},
				bodyTarget: 'normalize-body',
				continuationTarget: 'prepare-result'
			},
			{
				id: 'normalize-body',
				name: 'normalize-payment',
				type: 'transform',
				config: { mode: 'merge', mappings: { paymentId: '$.payment.id' } },
				next: 'prepare-result'
			},
			{
				id: 'prepare-result',
				name: 'prepare-result',
				type: 'transform',
				config: { mode: 'merge', mappings: { result: '$.paymentId' } },
				next: 'join'
			}
		],
		'parallel'
	);

	const output = await executeCorexWorkflow(
		{
			runId: 'run-parallel-block',
			ownerUserId: 'user-1',
			input: { payment: { id: 'payment-1' } },
			plan
		},
		recordedDurableWorkflow(),
		async () => undefined,
		fetch,
		undefined,
		undefined,
		1,
		async (attempt) => attempts.push(attempt)
	);

	assert.deepEqual(output, {
		payment: { id: 'payment-1' },
		prepared: {
			payment: {
				payment: { id: 'payment-1' },
				paymentId: 'payment-1',
				result: 'payment-1'
			}
		}
	});
	assert.deepEqual(
		attempts.map((attempt) => attempt.stepId),
		['normalize-body', 'prepare-result']
	);
});

test('break exits its referenced loop immediately', async () => {
	const visited = [];
	const attempts = [];
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
				return (callback ?? optionsOrCallback)({
					step: { name, count: 1 },
					attempt: 1,
					config: {}
				});
			}
		},
		async () => undefined,
		fetch,
		undefined,
		undefined,
		1,
		async (attempt) => attempts.push(attempt)
	);

	assert.ok(visited.includes('bounded-loop'));
	assert.ok(visited.includes('leave-loop'));
	assert.equal(
		visited.some((name) => name.startsWith('bounded-loop:visit-')),
		false
	);
	assert.deepEqual(
		attempts.map(({ startedAt, finishedAt, ...attempt }) => attempt),
		['loop', 'break'].map((stepId, index) => ({
			runId: 'run-break',
			ownerUserId: 'user-1',
			executionGeneration: 1,
			stepId,
			visit: 0,
			durableStepName: index === 0 ? 'bounded-loop' : 'leave-loop',
			kind: 'forward',
			attempt: 1,
			outcome: 'complete',
			retry: { limit: 0, backoff: 'constant', timeoutMs: 0 },
			output: { type: 'none' }
		}))
	);
});

test('performs an absolute durable wait and records it as waiting', async () => {
	const durableSleeps = [];
	const events = [];
	const attempts = [];
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
		async (event) => events.push(event),
		fetch,
		undefined,
		undefined,
		1,
		async (attempt) => attempts.push(attempt)
	);

	assert.equal(durableSleeps.length, 1);
	assert.equal(durableSleeps[0][0], 'settlement-window');
	assert.ok(durableSleeps[0][1] instanceof Date);
	assert.equal(durableSleeps[0][1].toISOString(), timestamp);
	assert.equal(events.find((event) => event.stepName === 'settlement-window').status, 'waiting');
	assert.deepEqual(
		attempts.map(({ startedAt, finishedAt, ...attempt }) => attempt),
		[
			{
				runId: 'run-1',
				ownerUserId: 'user-1',
				executionGeneration: 1,
				stepId: 'deadline',
				visit: 0,
				durableStepName: 'settlement-window',
				kind: 'forward',
				attempt: 1,
				outcome: 'complete',
				retry: { limit: 0, backoff: 'constant', timeoutMs: 0 },
				output: { type: 'none' }
			}
		]
	);
});

test('registers timer compensation only after a durable wait completes', async () => {
	let rollbackOptions;
	const attempts = [];
	const completedNames = [];
	const compensatedPlan = graphPlan([
		{
			id: 'wait',
			name: 'settlement-delay',
			type: 'wait',
			config: { durationMs: 5_000 },
			compensation: {
				id: 'restore-wait',
				name: 'restore-wait',
				type: 'transform',
				config: {
					mode: 'replace',
					mappings: { amount: '$.input.amount', failure: '$.error.message' },
					outputPolicy: { mode: 'inline', maxBytes: 1_024 }
				}
			},
			next: 'done'
		}
	]);

	await executeCorexWorkflow(
		{
			runId: 'run-wait-compensation',
			ownerUserId: 'user-1',
			input: { amount: 900 },
			plan: compensatedPlan
		},
		{
			async do(name, optionsOrCallback, callback, rollback) {
				if (name.endsWith(':completed')) {
					completedNames.push(name);
					rollbackOptions = rollback;
				}
				return (callback ?? optionsOrCallback)({
					step: { name, count: 1 },
					attempt: 1,
					config: {}
				});
			},
			async sleep() {}
		},
		async () => undefined,
		fetch,
		undefined,
		undefined,
		1,
		async (attempt) => attempts.push(attempt)
	);

	assert.deepEqual(completedNames, ['settlement-delay:completed']);
	assert.ok(rollbackOptions);
	await rollbackOptions.rollback({
		ctx: { step: { name: 'settlement-delay:completed', count: 1 }, attempt: 1, config: {} },
		error: new Error('later step failed'),
		output: undefined
	});
	assert.deepEqual(attempts.find((attempt) => attempt.kind === 'compensation').output.value, {
		amount: 900,
		failure: 'later step failed'
	});

	completedNames.length = 0;
	await assert.rejects(
		executeCorexWorkflow(
			{ runId: 'run-wait-failed', ownerUserId: 'user-1', input: {}, plan: compensatedPlan },
			{
				async do(name, optionsOrCallback, callback) {
					if (name.endsWith(':completed')) completedNames.push(name);
					return (callback ?? optionsOrCallback)();
				},
				async sleep() {
					throw new Error('sleep failed');
				}
			},
			async () => undefined
		),
		/sleep failed/
	);
	assert.deepEqual(completedNames, []);
});

test('ignores an attempt recorder failure after a completed durable wait', async () => {
	const plan = graphPlan([
		{
			id: 'wait',
			name: 'settlement-delay',
			type: 'wait',
			config: { durationMs: 5_000 },
			next: 'done'
		}
	]);

	const result = await executeCorexWorkflow(
		{ runId: 'run-wait', ownerUserId: 'user-1', input: { accepted: true }, plan },
		{
			async do(_name, optionsOrCallback, callback) {
				return (callback ?? optionsOrCallback)();
			},
			async sleep() {}
		},
		async () => undefined,
		fetch,
		undefined,
		undefined,
		1,
		async () => {
			throw new Error('attempt storage unavailable');
		}
	);

	assert.deepEqual(result, { accepted: true });
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
	const attempts = [];
	const plan = graphPlan([
		{
			id: 'approval',
			name: 'wait-for-approval',
			type: 'wait-event',
			next: 'send',
			config: {
				eventType: 'payment-approved',
				timeoutMs: 86_400_000,
				resultKey: 'approval',
				outputPolicy: { mode: 'inline', maxBytes: 1_024, redactPaths: ['$.approvedBy'] }
			}
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
		},
		undefined,
		undefined,
		1,
		async (attempt) => attempts.push(attempt)
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
	const waitAttempt = attempts.find((attempt) => attempt.stepId === 'approval');
	assert.deepEqual((({ startedAt, finishedAt, ...attempt }) => attempt)(waitAttempt), {
		runId: 'run-1',
		ownerUserId: 'user-1',
		executionGeneration: 1,
		stepId: 'approval',
		visit: 0,
		durableStepName: 'wait-for-approval',
		kind: 'forward',
		attempt: 1,
		outcome: 'complete',
		retry: { limit: 0, backoff: 'constant', timeoutMs: 86_400_000 },
		output: {
			type: 'object',
			bytes: 40,
			value: { approved: true, approvedBy: '[REDACTED]' }
		}
	});
	assert.deepEqual(result, { accepted: true });
});

test('registers transform compensation after an external event arrives', async () => {
	let rollbackOptions;
	const attempts = [];
	const plan = graphPlan([
		{
			id: 'payment-event',
			name: 'wait-for-payment',
			type: 'wait-event',
			next: 'done',
			config: {
				eventType: 'payment-completed',
				timeoutMs: 60_000,
				resultKey: 'payment',
				outputPolicy: { mode: 'metadata', maxBytes: 16_384 }
			},
			compensation: {
				id: 'restore-payment',
				name: 'restore-payment',
				type: 'transform',
				config: {
					mode: 'replace',
					mappings: {
						paymentId: '$.input.paymentId',
						providerId: '$.output.providerId',
						failure: '$.error.message'
					},
					outputPolicy: { mode: 'inline', maxBytes: 1_024 }
				}
			}
		}
	]);

	await executeCorexWorkflow(
		{
			runId: 'run-event-compensation',
			ownerUserId: 'user-1',
			input: { paymentId: 'pay-42' },
			plan
		},
		{
			async do(name, optionsOrCallback, callback, rollback) {
				if (name === 'wait-for-payment:completed') rollbackOptions = rollback;
				return (callback ?? optionsOrCallback)({
					step: { name, count: 1 },
					attempt: 1,
					config: {}
				});
			},
			async waitForEvent() {
				return { payload: { providerId: 'provider-7' } };
			}
		},
		async () => undefined,
		fetch,
		undefined,
		undefined,
		1,
		async (attempt) => attempts.push(attempt)
	);

	assert.ok(rollbackOptions);
	await rollbackOptions.rollback({
		ctx: { step: { name: 'wait-for-payment:completed', count: 1 }, attempt: 1, config: {} },
		error: new Error('later step failed'),
		output: { providerId: 'provider-7' }
	});
	const compensationAttempt = attempts.find((attempt) => attempt.kind === 'compensation');
	assert.deepEqual(compensationAttempt.output.value, {
		paymentId: 'pay-42',
		providerId: 'provider-7',
		failure: 'later step failed'
	});
});

test('registers branch-qualified event compensation only after a parallel event arrives', async () => {
	let rollbackOptions;
	const checkpoints = [];
	const plan = graphPlan(
		[
			{
				id: 'parallel',
				name: 'event-work',
				type: 'parallel',
				config: { branches: [{ id: 'payment' }], resultKey: 'results' },
				branchTargets: { payment: 'payment-event' },
				joinTarget: 'join',
				continuationTarget: 'done'
			},
			{
				id: 'payment-event',
				name: 'wait-for-payment',
				type: 'wait-event',
				next: 'join',
				config: {
					eventType: 'payment-completed',
					timeoutMs: 60_000,
					resultKey: 'payment',
					outputPolicy: { mode: 'metadata', maxBytes: 16_384 }
				},
				compensation: {
					id: 'restore-payment',
					name: 'restore-payment',
					type: 'transform',
					config: {
						mode: 'replace',
						mappings: {},
						outputPolicy: { mode: 'metadata', maxBytes: 16_384 }
					}
				}
			}
		],
		'parallel'
	);
	const execute = (failWait) =>
		executeCorexWorkflow(
			{ runId: 'run-parallel-event', ownerUserId: 'user-1', input: {}, plan },
			{
				async do(name, optionsOrCallback, callback, rollback) {
					if (name.endsWith(':completed')) {
						checkpoints.push(name);
						rollbackOptions = rollback;
					}
					return (callback ?? optionsOrCallback)({
						step: { name, count: 1 },
						attempt: 1,
						config: {}
					});
				},
				async waitForEvent() {
					if (failWait) throw new Error('event timeout');
					return { payload: { providerId: 'provider-7' } };
				}
			},
			async () => undefined,
			fetch,
			undefined,
			undefined,
			1,
			undefined,
			async () => undefined,
			async () => undefined
		);

	await execute(false);
	assert.deepEqual(checkpoints, ['event-work:parallel-payment:wait-for-payment:completed']);
	assert.ok(rollbackOptions);
	checkpoints.length = 0;
	rollbackOptions = undefined;
	await assert.rejects(execute(true), /event timeout/);
	assert.deepEqual(checkpoints, []);
	assert.equal(rollbackOptions, undefined);
});

test('stores redacted external-event payload externally without mutating process context', async () => {
	const attempts = [];
	const stored = [];
	const plan = graphPlan([
		{
			id: 'payment-event',
			name: 'wait-for-payment',
			type: 'wait-event',
			next: 'done',
			config: {
				eventType: 'payment-approved',
				timeoutMs: 60_000,
				resultKey: 'payment',
				outputPolicy: { mode: 'external', maxBytes: 1024, redactPaths: ['$.token'] }
			}
		}
	]);
	plan.nodes.at(-1).config.outputExpression = '$.payment';

	const output = await executeCorexWorkflow(
		{ runId: 'run-event', ownerUserId: 'user-1', input: {}, plan },
		{
			async do(_name, optionsOrCallback, callback) {
				return (callback ?? optionsOrCallback)();
			},
			async waitForEvent() {
				return { payload: { approved: true, token: 'private' } };
			}
		},
		async () => undefined,
		fetch,
		undefined,
		undefined,
		1,
		async (attempt) => attempts.push(attempt),
		undefined,
		undefined,
		undefined,
		async (object) => stored.push(object)
	);

	assert.deepEqual(output, { approved: true, token: 'private' });
	assert.equal(stored.length, 1);
	assert.deepEqual(JSON.parse(new TextDecoder().decode(stored[0].body)), {
		approved: true,
		token: '[REDACTED]'
	});
	assert.deepEqual(attempts[0].output, {
		type: 'object',
		bytes: 35,
		external: {
			key: stored[0].key,
			bytes: 38,
			contentType: 'application/json'
		}
	});
});

test('ignores an attempt recorder failure after a completed external event wait', async () => {
	const plan = graphPlan([
		{
			id: 'event',
			name: 'wait-for-event',
			type: 'wait-event',
			next: 'done',
			config: { eventType: 'payment-approved', timeoutMs: 60_000, resultKey: 'event' }
		}
	]);

	const result = await executeCorexWorkflow(
		{ runId: 'run-event', ownerUserId: 'user-1', input: {}, plan },
		{
			async do(_name, optionsOrCallback, callback) {
				return (callback ?? optionsOrCallback)();
			},
			async waitForEvent() {
				return { payload: { accepted: true } };
			}
		},
		async () => undefined,
		fetch,
		undefined,
		undefined,
		1,
		async () => {
			throw new Error('attempt storage unavailable');
		}
	);

	assert.deepEqual(result, { event: { accepted: true } });
});

test('starts a subprocess and waits durably for its correlated result', async () => {
	const starts = [];
	const waits = [];
	const attempts = [];
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
				timeoutMs: 2_592_000_000,
				outputPolicy: { mode: 'inline', maxBytes: 128, redactPaths: ['$.token'] }
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
					payload: {
						childRunId: 'child-run',
						status: 'complete',
						output: { id: 'inv-1', token: 'private' }
					}
				};
			}
		},
		async () => undefined,
		fetch,
		async (step, input, parent) => {
			starts.push({ step, input, parent });
			return { childRunId: 'child-run', workflowInstanceId: 'child-workflow' };
		},
		undefined,
		1,
		async (attempt) => attempts.push(attempt)
	);

	assert.deepEqual(starts[0].input, { id: 'pay-42' });
	assert.deepEqual(starts[0].parent, {
		runId: 'parent-run',
		ownerUserId: 'user-1',
		invocationKey: '1:invoice:0'
	});
	assert.deepEqual(waits, [
		[
			'create-invoice:result',
			{ type: 'corex-subprocess-result:child-run', timeout: '2592000000 milliseconds' }
		]
	]);
	assert.deepEqual(output, { id: 'inv-1', token: 'private' });
	assert.deepEqual(
		attempts.map(({ startedAt, finishedAt, ...attempt }) => attempt),
		[
			{
				runId: 'parent-run',
				ownerUserId: 'user-1',
				executionGeneration: 1,
				stepId: 'invoice',
				visit: 0,
				durableStepName: 'create-invoice',
				kind: 'forward',
				attempt: 1,
				outcome: 'complete',
				retry: { limit: 0, backoff: 'constant', timeoutMs: 2_592_000_000 },
				output: {
					type: 'object',
					bytes: 32,
					value: { id: 'inv-1', token: '[REDACTED]' }
				}
			}
		]
	);
	assert.equal(JSON.stringify(attempts).includes('private'), false);
});

test('falls back to subprocess output metadata above the inline limit', async () => {
	const attempts = [];
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
				timeoutMs: 60_000,
				outputPolicy: { mode: 'inline', maxBytes: 4 }
			}
		}
	]);

	await executeCorexWorkflow(
		{ runId: 'parent-run', ownerUserId: 'user-1', input: {}, plan },
		{
			async do(_name, optionsOrCallback, callback) {
				return (callback ?? optionsOrCallback)();
			},
			async waitForEvent() {
				return {
					payload: { childRunId: 'child-run', status: 'complete', output: { id: 'inv-1' } }
				};
			}
		},
		async () => undefined,
		fetch,
		async () => ({ childRunId: 'child-run', workflowInstanceId: 'child-workflow' }),
		undefined,
		1,
		async (attempt) => attempts.push(attempt)
	);

	assert.deepEqual(attempts[0].output, { type: 'object', bytes: 14, truncated: true });
	assert.equal(JSON.stringify(attempts).includes('inv-1'), false);
});

test('stores redacted subprocess business output externally without storing correlation data', async () => {
	const attempts = [];
	const stored = [];
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
				timeoutMs: 60_000,
				outputPolicy: { mode: 'external', maxBytes: 1024, redactPaths: ['$.token'] }
			}
		}
	]);
	plan.nodes.at(-1).config.outputExpression = '$.invoice';

	const output = await executeCorexWorkflow(
		{ runId: 'parent-run', ownerUserId: 'user-1', input: {}, plan },
		{
			async do(_name, optionsOrCallback, callback) {
				return (callback ?? optionsOrCallback)();
			},
			async waitForEvent() {
				return {
					payload: {
						childRunId: 'child-run',
						status: 'complete',
						output: { id: 'inv-1', token: 'private' }
					}
				};
			}
		},
		async () => undefined,
		fetch,
		async () => ({ childRunId: 'child-run', workflowInstanceId: 'child-workflow' }),
		undefined,
		1,
		async (attempt) => attempts.push(attempt),
		undefined,
		undefined,
		undefined,
		async (object) => stored.push(object)
	);

	assert.deepEqual(output, { id: 'inv-1', token: 'private' });
	assert.equal(stored.length, 1);
	assert.deepEqual(JSON.parse(new TextDecoder().decode(stored[0].body)), {
		id: 'inv-1',
		token: '[REDACTED]'
	});
	assert.equal(JSON.stringify(stored).includes('child-run'), false);
	assert.deepEqual(attempts[0].output, {
		type: 'object',
		bytes: 32,
		external: {
			key: stored[0].key,
			bytes: 35,
			contentType: 'application/json'
		}
	});
});

test('registers transform compensation after a subprocess completes', async () => {
	let rollbackOptions;
	const durableNames = [];
	const attempts = [];
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
			},
			compensation: {
				id: 'restore-context',
				name: 'restore-invoice-context',
				type: 'transform',
				config: { mode: 'replace', mappings: { orderId: '$.input.orderId' } }
			}
		}
	]);

	await executeCorexWorkflow(
		{ runId: 'parent-run', ownerUserId: 'user-1', input: { orderId: 'ord-1' }, plan },
		{
			async do(name, optionsOrCallback, callback, rollback) {
				durableNames.push(name);
				if (name === 'create-invoice:completed') rollbackOptions = rollback;
				return (callback ?? optionsOrCallback)({
					step: { name, count: 1 },
					attempt: 1,
					config: {}
				});
			},
			async waitForEvent() {
				return {
					payload: { childRunId: 'child-run', status: 'complete', output: { id: 'inv-1' } }
				};
			}
		},
		async () => undefined,
		fetch,
		async () => ({ childRunId: 'child-run', workflowInstanceId: 'child-workflow' }),
		undefined,
		3,
		async (attempt) => attempts.push(attempt)
	);

	assert.deepEqual(
		durableNames.filter((name) => name.startsWith('create-invoice')),
		['create-invoice', 'create-invoice:completed']
	);
	assert.ok(rollbackOptions);
	await rollbackOptions.rollback({
		ctx: { step: { name: 'create-invoice:completed', count: 1 }, attempt: 2, config: {} },
		error: new Error('later action failed'),
		output: { childRunId: 'child-run', status: 'complete', output: { id: 'inv-1' } }
	});
	const { startedAt, finishedAt, ...rollbackAttempt } = attempts[1];
	assert.deepEqual(rollbackAttempt, {
		runId: 'parent-run',
		ownerUserId: 'user-1',
		executionGeneration: 3,
		stepId: 'restore-context',
		visit: 0,
		durableStepName: 'create-invoice:rollback:restore-invoice-context',
		kind: 'compensation',
		attempt: 2,
		outcome: 'complete',
		retry: { limit: 0, backoff: 'constant', timeoutMs: 0 },
		output: { type: 'object', bytes: 19 }
	});
});

test('registers HTTP compensation after a subprocess completes', async () => {
	let rollbackOptions;
	const requests = [];
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
			},
			compensation: {
				id: 'cancel-invoice',
				name: 'cancel-invoice',
				type: 'http-request',
				config: {
					method: 'POST',
					url: 'https://api.example.com/invoices/cancel',
					timeoutMs: 8_000,
					retry: { limit: 3, backoff: 'exponential' },
					idempotencyKey: '$.output.childRunId'
				}
			}
		}
	]);
	const fetcher = async (url, init) => {
		requests.push({
			url: String(url),
			body: JSON.parse(init.body),
			idempotencyKey: init.headers.get('Idempotency-Key')
		});
		return Response.json({ cancelled: true }, { status: 202 });
	};

	await executeCorexWorkflow(
		{ runId: 'parent-run', ownerUserId: 'user-1', input: { orderId: 'ord-1' }, plan },
		{
			async do(name, optionsOrCallback, callback, rollback) {
				if (name === 'create-invoice:completed') rollbackOptions = rollback;
				return (callback ?? optionsOrCallback)({
					step: { name, count: 1 },
					attempt: 1,
					config: {}
				});
			},
			async waitForEvent() {
				return {
					payload: { childRunId: 'child-run', status: 'complete', output: { id: 'inv-1' } }
				};
			}
		},
		async () => undefined,
		fetcher,
		async () => ({ childRunId: 'child-run', workflowInstanceId: 'child-workflow' })
	);

	assert.deepEqual(rollbackOptions.rollbackConfig, {
		retries: { limit: 3, delay: 1_000, backoff: 'exponential' },
		timeout: 8_000
	});
	await rollbackOptions.rollback({
		ctx: { step: { name: 'create-invoice:completed', count: 1 }, attempt: 1, config: {} },
		error: new Error('later action failed'),
		output: { childRunId: 'child-run', status: 'complete', output: { id: 'inv-1' } }
	});
	assert.deepEqual(requests, [
		{
			url: 'https://api.example.com/invoices/cancel',
			idempotencyKey: 'child-run',
			body: {
				input: { orderId: 'ord-1' },
				output: { childRunId: 'child-run', status: 'complete', output: { id: 'inv-1' } },
				error: { name: 'Error', message: 'later action failed' }
			}
		}
	]);
});

test('ignores an attempt recorder failure after a completed subprocess', async () => {
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
	plan.nodes.at(-1).config.outputExpression = '$.invoice';

	const output = await executeCorexWorkflow(
		{ runId: 'parent-run', ownerUserId: 'user-1', input: {}, plan },
		{
			async do(_name, optionsOrCallback, callback) {
				return (callback ?? optionsOrCallback)();
			},
			async waitForEvent() {
				return {
					payload: { childRunId: 'child-run', status: 'complete', output: { id: 'inv-1' } }
				};
			}
		},
		async () => undefined,
		fetch,
		async () => ({ childRunId: 'child-run', workflowInstanceId: 'child-workflow' }),
		undefined,
		1,
		async () => {
			throw new Error('attempt storage unavailable');
		}
	);

	assert.deepEqual(output, { id: 'inv-1' });
});

test('terminates a child durably when waiting for its result fails', async () => {
	const durableSteps = [];
	const terminations = [];
	const events = [];
	const attempts = [];
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
			async (step, child, parent) => terminations.push({ stepId: step.id, child, parent }),
			1,
			async (attempt) => attempts.push(attempt)
		),
		/private timeout details/
	);

	assert.deepEqual(terminations, [
		{
			stepId: 'invoice',
			child: { childRunId: 'child-run', workflowInstanceId: 'child-workflow' },
			parent: { runId: 'parent-run', ownerUserId: 'user-1', invocationKey: '1:invoice:0' }
		}
	]);
	assert.equal(durableSteps.includes('create-invoice:terminate-child'), true);
	assert.deepEqual(events.at(-1).error, { code: 'process_step_failed', stepId: 'invoice' });
	assert.equal(JSON.stringify(events).includes('private timeout details'), false);
	assert.equal(attempts.length, 1);
	const { startedAt, finishedAt, ...attempt } = attempts[0];
	assert.deepEqual(attempt, {
		runId: 'parent-run',
		ownerUserId: 'user-1',
		executionGeneration: 1,
		stepId: 'invoice',
		visit: 0,
		durableStepName: 'create-invoice',
		kind: 'forward',
		attempt: 1,
		outcome: 'failed',
		retry: { limit: 0, backoff: 'constant', timeoutMs: 60_000 },
		error: { code: 'subprocess_failed' }
	});
	assert.equal(JSON.stringify(attempts).includes('private timeout details'), false);
});

test('fails the parent without exposing subprocess error details', async () => {
	const events = [];
	const attempts = [];
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
			},
			1,
			async (attempt) => attempts.push(attempt)
		),
		/Subprocess failed\./
	);

	assert.equal(JSON.stringify(events).includes('secret child error'), false);
	assert.deepEqual(events.at(-1).error, { code: 'process_step_failed', stepId: 'invoice' });
	assert.equal(terminationCount, 0);
	assert.equal(attempts.length, 1);
	assert.deepEqual(attempts[0].error, { code: 'subprocess_failed' });
	assert.equal(JSON.stringify(attempts).includes('secret child error'), false);
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

test('routes an operational failure through catch and finally before continuing', async () => {
	const events = [];
	const plan = graphPlan(
		[
			{
				id: 'try-payment',
				name: 'protect-payment',
				type: 'try',
				config: {},
				bodyTarget: 'forward',
				catchTarget: 'catch-payment',
				finallyTarget: 'finally-payment',
				continuationTarget: 'continue-payment'
			},
			{ ...action({ retry: { limit: 0, backoff: 'constant' } }), next: 'finally-payment' },
			{
				id: 'catch-payment',
				name: 'record-error',
				type: 'transform',
				config: { mode: 'merge', mappings: { caught: '$.paymentId' } },
				next: 'finally-payment'
			},
			{
				id: 'finally-payment',
				name: 'record-finish',
				type: 'transform',
				config: { mode: 'merge', mappings: { finalized: '$.paymentId' } },
				next: 'continue-payment'
			},
			{
				id: 'continue-payment',
				name: 'continue-payment',
				type: 'transform',
				config: { mode: 'merge', mappings: { continued: '$.paymentId' } },
				next: 'done'
			}
		],
		'try-payment'
	);

	const output = await executeCorexWorkflow(
		{ runId: 'run-try', ownerUserId: 'user-1', input: { paymentId: 'pay-1' }, plan },
		durableWorkflow(),
		async (event) => events.push(event),
		async () => new Response('private failure', { status: 503 })
	);

	assert.deepEqual(output, {
		paymentId: 'pay-1',
		caught: 'pay-1',
		finalized: 'pay-1',
		continued: 'pay-1'
	});
	assert.deepEqual(
		events.filter((event) => event.eventType === 'step_started').map((event) => event.stepName),
		['protect-payment', 'forward-payment', 'record-error', 'record-finish', 'continue-payment']
	);
	assert.equal(
		events.some((event) => event.eventType === 'run_failed'),
		false
	);
});

test('runs finally before rethrowing an operational failure when catch is absent', async () => {
	const events = [];
	const plan = graphPlan(
		[
			{
				id: 'try-payment',
				name: 'protect-payment',
				type: 'try',
				config: {},
				bodyTarget: 'forward',
				finallyTarget: 'finally-payment',
				continuationTarget: 'done'
			},
			{ ...action({ retry: { limit: 0, backoff: 'constant' } }), next: 'finally-payment' },
			{
				id: 'finally-payment',
				name: 'record-finish',
				type: 'transform',
				config: { mode: 'merge', mappings: { finalized: '$.paymentId' } },
				next: 'done'
			}
		],
		'try-payment'
	);

	await assert.rejects(
		executeCorexWorkflow(
			{ runId: 'run-finally', ownerUserId: 'user-1', input: { paymentId: 'pay-1' }, plan },
			durableWorkflow(),
			async (event) => events.push(event),
			async () => new Response('private failure', { status: 503 })
		),
		/HTTP action failed with status 503/
	);

	assert.equal(
		events.some(
			(event) => event.eventType === 'step_completed' && event.stepName === 'record-finish'
		),
		true
	);
	assert.deepEqual(events.at(-1).error, { code: 'process_step_failed', stepId: 'forward' });
});

test('does not catch an explicit failure terminal', async () => {
	const events = [];
	const plan = graphPlan(
		[
			{
				id: 'try-payment',
				name: 'protect-payment',
				type: 'try',
				config: {},
				bodyTarget: 'failure',
				catchTarget: 'catch-payment',
				continuationTarget: 'done'
			},
			{
				id: 'failure',
				name: 'reject-payment',
				type: 'end-failure',
				config: { code: 'payment_rejected', message: 'Payment policy rejected the request.' }
			},
			{
				id: 'catch-payment',
				name: 'record-error',
				type: 'transform',
				config: { mode: 'merge', mappings: { caught: '$.paymentId' } },
				next: 'done'
			}
		],
		'try-payment'
	);

	await assert.rejects(
		executeCorexWorkflow(
			{ runId: 'run-terminal', ownerUserId: 'user-1', input: { paymentId: 'pay-1' }, plan },
			durableWorkflow(),
			async (event) => events.push(event)
		),
		/Payment policy rejected the request\./
	);

	assert.equal(
		events.some((event) => event.stepName === 'record-error'),
		false
	);
	assert.equal(events.filter((event) => event.eventType === 'run_failed').length, 1);
	assert.deepEqual(events.at(-1).error, { code: 'payment_rejected', stepId: 'failure' });
});

test('unwinds an exhausted inner try into the outer catch', async () => {
	const events = [];
	const plan = graphPlan(
		[
			{
				id: 'outer-try',
				name: 'outer-protection',
				type: 'try',
				config: {},
				bodyTarget: 'inner-try',
				catchTarget: 'outer-catch',
				continuationTarget: 'done'
			},
			{
				id: 'inner-try',
				name: 'inner-protection',
				type: 'try',
				config: {},
				bodyTarget: 'forward',
				finallyTarget: 'inner-finally',
				continuationTarget: 'done'
			},
			{ ...action({ retry: { limit: 0, backoff: 'constant' } }), next: 'inner-finally' },
			{
				id: 'inner-finally',
				name: 'inner-cleanup',
				type: 'transform',
				config: { mode: 'merge', mappings: { cleaned: '$.paymentId' } },
				next: 'done'
			},
			{
				id: 'outer-catch',
				name: 'outer-recovery',
				type: 'transform',
				config: { mode: 'merge', mappings: { recovered: '$.paymentId' } },
				next: 'done'
			}
		],
		'outer-try'
	);

	const output = await executeCorexWorkflow(
		{ runId: 'run-nested', ownerUserId: 'user-1', input: { paymentId: 'pay-1' }, plan },
		durableWorkflow(),
		async (event) => events.push(event),
		async () => new Response('private failure', { status: 503 })
	);

	assert.deepEqual(output, { paymentId: 'pay-1', cleaned: 'pay-1', recovered: 'pay-1' });
	assert.equal(
		events.some((event) => event.eventType === 'run_failed'),
		false
	);
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
	const attempts = [];
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
						config: {
							assigneeUserId: 'user-1',
							timeoutMs: 86400000,
							resultKey: 'approval',
							outputPolicy: { mode: 'inline', maxBytes: 1_024, redactPaths: ['$.actorUserId'] }
						},
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
		async (event) => events.push(event),
		fetch,
		undefined,
		undefined,
		1,
		async (attempt) => attempts.push(attempt)
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
	assert.deepEqual(
		attempts.map(({ startedAt, finishedAt, ...attempt }) => attempt),
		[
			{
				runId: 'run-approval',
				ownerUserId: 'user-1',
				executionGeneration: 1,
				stepId: 'approval',
				visit: 0,
				durableStepName: 'review-payment',
				kind: 'forward',
				attempt: 1,
				outcome: 'complete',
				retry: { limit: 0, backoff: 'constant', timeoutMs: 86_400_000 },
				output: {
					type: 'object',
					bytes: 67,
					value: { decision: 'approved', comment: 'Verified', actorUserId: '[REDACTED]' }
				}
			}
		]
	);
});

test('registers approval compensation without changing the decision route', async () => {
	let rollbackOptions;
	const attempts = [];
	const plan = graphPlan([
		{
			id: 'approval',
			name: 'review-payment',
			type: 'approval',
			config: {
				assigneeUserId: 'user-1',
				timeoutMs: 60_000,
				resultKey: 'approval',
				outputPolicy: { mode: 'metadata', maxBytes: 16_384 }
			},
			whenApproved: 'approved',
			whenRejected: 'rejected',
			compensation: {
				id: 'restore-approval',
				name: 'restore-approval',
				type: 'transform',
				config: {
					mode: 'replace',
					mappings: {
						amount: '$.input.amount',
						decision: '$.output.decision',
						failure: '$.error.message'
					},
					outputPolicy: { mode: 'inline', maxBytes: 1_024 }
				}
			}
		},
		{
			id: 'approved',
			name: 'approved',
			type: 'end-success',
			config: { outputExpression: '$.approval.decision' }
		},
		{ id: 'rejected', name: 'rejected', type: 'end-success', config: {} }
	]);

	const output = await executeCorexWorkflow(
		{ runId: 'run-approval-compensation', ownerUserId: 'user-1', input: { amount: 900 }, plan },
		{
			async do(name, optionsOrCallback, callback, rollback) {
				if (name === 'review-payment:completed') rollbackOptions = rollback;
				return (callback ?? optionsOrCallback)({
					step: { name, count: 1 },
					attempt: 1,
					config: {}
				});
			},
			async waitForEvent() {
				return { payload: { decision: 'approved', actorUserId: 'user-1' } };
			}
		},
		async () => undefined,
		fetch,
		undefined,
		undefined,
		1,
		async (attempt) => attempts.push(attempt)
	);

	assert.equal(output, 'approved');
	assert.ok(rollbackOptions);
	await rollbackOptions.rollback({
		ctx: { step: { name: 'review-payment:completed', count: 1 }, attempt: 1, config: {} },
		error: new Error('later step failed'),
		output: { decision: 'approved', actorUserId: 'user-1' }
	});
	const compensationAttempt = attempts.find((attempt) => attempt.kind === 'compensation');
	assert.deepEqual(compensationAttempt.output.value, {
		amount: 900,
		decision: 'approved',
		failure: 'later step failed'
	});
});

test('stores a redacted approval decision externally without changing its route or context', async () => {
	const attempts = [];
	const stored = [];
	const plan = graphPlan([
		{
			id: 'approval',
			name: 'review-payment',
			type: 'approval',
			config: {
				assigneeUserId: 'user-1',
				timeoutMs: 60_000,
				resultKey: 'approval',
				outputPolicy: { mode: 'external', maxBytes: 1_024, redactPaths: ['$.actorUserId'] }
			},
			whenApproved: 'done',
			whenRejected: 'done'
		}
	]);
	plan.nodes.at(-1).config.outputExpression = '$.approval';

	const output = await executeCorexWorkflow(
		{ runId: 'run-approval', ownerUserId: 'user-1', input: {}, plan },
		{
			async do(_name, optionsOrCallback, callback) {
				return (callback ?? optionsOrCallback)();
			},
			async waitForEvent() {
				return {
					payload: { decision: 'approved', comment: 'Verified', actorUserId: 'user-1' }
				};
			}
		},
		async () => undefined,
		fetch,
		undefined,
		undefined,
		1,
		async (attempt) => attempts.push(attempt),
		undefined,
		undefined,
		undefined,
		async (object) => stored.push(object)
	);

	assert.deepEqual(output, {
		decision: 'approved',
		comment: 'Verified',
		actorUserId: 'user-1'
	});
	assert.equal(stored.length, 1);
	assert.deepEqual(JSON.parse(new TextDecoder().decode(stored[0].body)), {
		decision: 'approved',
		comment: 'Verified',
		actorUserId: '[REDACTED]'
	});
	assert.equal(attempts[0].output.external.key, stored[0].key);
	assert.equal(attempts[0].output.external.bytes, stored[0].body.byteLength);
});

test('records a sanitized failed attempt for an invalid approval event', async () => {
	const attempts = [];
	const stepNames = [];
	const plan = graphPlan([
		{
			id: 'approval',
			name: 'review-payment',
			type: 'approval',
			config: { assigneeUserId: 'user-1', timeoutMs: 60_000, resultKey: 'approval' },
			whenApproved: 'done',
			whenRejected: 'done'
		}
	]);

	await assert.rejects(
		executeCorexWorkflow(
			{ runId: 'run-approval', ownerUserId: 'user-1', input: {}, plan },
			{
				async do(name, optionsOrCallback, callback) {
					stepNames.push(name);
					return (callback ?? optionsOrCallback)();
				},
				async waitForEvent() {
					return { payload: { decision: 'approved', private: 'do not persist' } };
				}
			},
			async () => undefined,
			fetch,
			undefined,
			undefined,
			1,
			async (attempt) => attempts.push(attempt)
		),
		/Approval event payload is invalid/
	);

	assert.equal(attempts.length, 1);
	const { startedAt, finishedAt, ...attempt } = attempts[0];
	assert.deepEqual(attempt, {
		runId: 'run-approval',
		ownerUserId: 'user-1',
		executionGeneration: 1,
		stepId: 'approval',
		visit: 0,
		durableStepName: 'review-payment',
		kind: 'forward',
		attempt: 1,
		outcome: 'failed',
		retry: { limit: 0, backoff: 'constant', timeoutMs: 60_000 },
		error: { code: 'approval_failed' }
	});
	assert.equal(JSON.stringify(attempts).includes('do not persist'), false);
	assert.equal(
		stepNames.some((name) => name.endsWith(':completed')),
		false
	);
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
