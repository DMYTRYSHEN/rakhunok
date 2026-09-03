import assert from 'node:assert/strict';
import test from 'node:test';

import { routeCorexRequest } from './corex-router.ts';

function createEnv() {
	const paths = [];
	return {
		paths,
		env: {
			ASSETS: {
				async fetch(request) {
					paths.push(new URL(request.url).pathname);
					return new Response('<html>Corex</html>', {
						headers: { 'Content-Type': 'text/html; charset=utf-8' }
					});
				}
			}
		}
	};
}

test('serves the Corex shell for exact and nested routes', async () => {
	for (const pathname of ['/corex', '/corex/', '/corex/flow']) {
		const { env, paths } = createEnv();
		const response = await routeCorexRequest(new Request(`https://example.com${pathname}`), env);

		assert.equal(response.status, 200);
		assert.deepEqual(paths, ['/200']);
	}
});

test('serves shared build assets in preview', async () => {
	const { env, paths } = createEnv();
	const response = await routeCorexRequest(
		new Request('https://example.com/_app/immutable/entry/start.js'),
		env
	);

	assert.equal(response.status, 200);
	assert.deepEqual(paths, ['/_app/immutable/entry/start.js']);
});

test('rejects paths outside Corex ownership', async () => {
	for (const pathname of ['/dashboard', '/corexyz', '/api/v1/checkout/demo-1', '/']) {
		const { env, paths } = createEnv();
		const response = await routeCorexRequest(new Request(`https://example.com${pathname}`), env);

		assert.equal(response.status, 404);
		assert.equal(response.headers.get('X-Robots-Tag'), 'noindex');
		assert.deepEqual(paths, []);
	}
});

test('submits only validated bounded operations for the authenticated caller', async () => {
	const { env } = createEnv();
	const calls = [];
	const requestId = '018f47a2-8391-7b1c-8f7a-f1d27670f061';
	const targetId = '018f47a2-8391-7b1c-8f7a-f1d27670f062';
	const response = await routeCorexRequest(
		new Request('https://example.com/corex/api/operations', {
			method: 'POST',
			headers: { Authorization: 'Bearer user-token', 'Content-Type': 'application/json' },
			body: JSON.stringify({
				requestId,
				kind: 'workflow_delete',
				items: [{ targetId }]
			})
		}),
		env,
		{
			async submitOperation(command) {
				calls.push(command);
				return { id: requestId, status: 'pending', itemCount: 1 };
			}
		}
	);

	assert.equal(response.status, 202);
	assert.deepEqual(calls, [
		{
			accessToken: 'user-token',
			requestId,
			kind: 'workflow_delete',
			items: [{ targetId }]
		}
	]);
});

test('rejects malformed operation items before reaching the control plane', async () => {
	const { env } = createEnv();
	let calls = 0;
	const response = await routeCorexRequest(
		new Request('https://example.com/corex/api/operations', {
			method: 'POST',
			headers: { Authorization: 'Bearer user-token', 'Content-Type': 'application/json' },
			body: JSON.stringify({
				requestId: '018f47a2-8391-7b1c-8f7a-f1d27670f061',
				kind: 'process_create',
				items: [
					{
						targetId: '018f47a2-8391-7b1c-8f7a-f1d27670f062',
						payload: { processId: 'not-a-uuid', plan: { callerAuthored: true } }
					}
				]
			})
		}),
		env,
		{
			async submitOperation() {
				calls += 1;
			}
		}
	);

	assert.equal(response.status, 400);
	assert.equal(calls, 0);
});

test('routes privileged deletion and owner-scoped operation status separately', async () => {
	const { env } = createEnv();
	const processId = '018f47a2-8391-7b1c-8f7a-f1d27670f061';
	const operationId = '018f47a2-8391-7b1c-8f7a-f1d27670f062';
	const requestId = '018f47a2-8391-7b1c-8f7a-f1d27670f063';
	const calls = [];
	const controlPlane = {
		async deleteProcess(command) {
			calls.push(['delete', command]);
			return { id: operationId, status: 'pending', itemCount: 1 };
		},
		async getOperation(command) {
			calls.push(['get', command]);
			return { id: operationId, status: 'pending', items: [] };
		}
	};
	const deletion = await routeCorexRequest(
		new Request(`https://example.com/corex/api/processes/${processId}/delete`, {
			method: 'POST',
			headers: { Authorization: 'Bearer user-token', 'Content-Type': 'application/json' },
			body: JSON.stringify({ requestId })
		}),
		env,
		controlPlane
	);
	const status = await routeCorexRequest(
		new Request(`https://example.com/corex/api/operations/${operationId}`, {
			headers: { Authorization: 'Bearer user-token' }
		}),
		env,
		controlPlane
	);

	assert.equal(deletion.status, 202);
	assert.equal(status.status, 200);
	assert.deepEqual(calls, [
		['delete', { accessToken: 'user-token', processId, requestId }],
		['get', { accessToken: 'user-token', operationId }]
	]);
});

test('requires authentication before resolving an external step output', async () => {
	const { env } = createEnv();
	env.COREX_OUTPUTS = {
		async get() {
			throw new Error('must not read storage');
		}
	};
	let resolveCalls = 0;
	const response = await routeCorexRequest(
		new Request(
			'https://example.com/corex/api/runs/018f47a2-8391-7b1c-8f7a-f1d27670f062/attempts/2/transform-1/3/1/output'
		),
		env,
		{
			async resolveStepAttemptOutput() {
				resolveCalls += 1;
				throw new Error('must not resolve');
			}
		}
	);

	assert.equal(response.status, 401);
	assert.equal(resolveCalls, 0);
});

test('does not read object storage when the owned external output is not found', async () => {
	const { env } = createEnv();
	let storageReads = 0;
	env.COREX_OUTPUTS = {
		async get() {
			storageReads += 1;
		}
	};
	const response = await routeCorexRequest(
		new Request(
			'https://example.com/corex/api/runs/018f47a2-8391-7b1c-8f7a-f1d27670f062/attempts/2/transform-1/3/1/output',
			{ headers: { Authorization: 'Bearer user-token' } }
		),
		env,
		{
			async resolveStepAttemptOutput() {
				throw Object.assign(new Error('not owned'), { status: 404 });
			}
		}
	);

	assert.equal(response.status, 404);
	assert.equal(storageReads, 0);
});

test('reports unavailable external step output storage before resolving its descriptor', async () => {
	const { env } = createEnv();
	let resolveCalls = 0;
	const response = await routeCorexRequest(
		new Request(
			'https://example.com/corex/api/runs/018f47a2-8391-7b1c-8f7a-f1d27670f062/attempts/2/transform-1/3/1/output',
			{ headers: { Authorization: 'Bearer user-token' } }
		),
		env,
		{
			async resolveStepAttemptOutput() {
				resolveCalls += 1;
				throw new Error('must not resolve');
			}
		}
	);

	assert.equal(response.status, 503);
	assert.equal(resolveCalls, 0);
});

test('hides a missing external step output object behind not found', async () => {
	const { env } = createEnv();
	env.COREX_OUTPUTS = {
		async get() {
			return null;
		}
	};
	let resolveCalls = 0;
	const response = await routeCorexRequest(
		new Request(
			'https://example.com/corex/api/runs/018f47a2-8391-7b1c-8f7a-f1d27670f062/attempts/2/transform-1/3/1/output',
			{ headers: { Authorization: 'Bearer user-token' } }
		),
		env,
		{
			async resolveStepAttemptOutput() {
				resolveCalls += 1;
				return {
					key: 'corex-output/missing.json',
					bytes: 17,
					contentType: 'application/json'
				};
			}
		}
	);

	assert.equal(response.status, 404);
	assert.equal(resolveCalls, 1);
});

test('streams an owner-scoped external step output privately', async () => {
	const { env } = createEnv();
	const storageKeys = [];
	env.COREX_OUTPUTS = {
		async get(key) {
			storageKeys.push(key);
			return { body: JSON.stringify({ approved: true }) };
		}
	};
	const calls = [];
	const response = await routeCorexRequest(
		new Request(
			'https://example.com/corex/api/runs/018f47a2-8391-7b1c-8f7a-f1d27670f062/attempts/2/transform-1/3/1/output',
			{ headers: { Authorization: 'Bearer user-token' } }
		),
		env,
		{
			async resolveStepAttemptOutput(command) {
				calls.push(command);
				return {
					key: 'corex-output/trusted.json',
					bytes: 17,
					contentType: 'application/json'
				};
			}
		}
	);

	assert.equal(response.status, 200);
	assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
	assert.equal(response.headers.get('Content-Type'), 'application/json');
	assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff');
	assert.deepEqual(await response.json(), { approved: true });
	assert.deepEqual(storageKeys, ['corex-output/trusted.json']);
	assert.deepEqual(calls, [
		{
			accessToken: 'user-token',
			runId: '018f47a2-8391-7b1c-8f7a-f1d27670f062',
			executionGeneration: 2,
			stepId: 'transform-1',
			visit: 3,
			attempt: 1
		}
	]);
});

test('requires authentication before publishing a process', async () => {
	const { env } = createEnv();
	let publishCalls = 0;
	const response = await routeCorexRequest(
		new Request(
			'https://example.com/corex/api/processes/018f47a2-8391-7b1c-8f7a-f1d27670f061/publish',
			{
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ expectedRevision: 4 })
			}
		),
		env,
		{
			async publish() {
				publishCalls += 1;
				return { id: 'version-1', version: 1 };
			}
		}
	);

	assert.equal(response.status, 401);
	assert.equal(publishCalls, 0);
});

test('configures a normalized owner-scoped domain target', async () => {
	const { env } = createEnv();
	const calls = [];
	const response = await routeCorexRequest(
		new Request('https://example.com/corex/api/domain-target', {
			method: 'POST',
			headers: { Authorization: 'Bearer user-token', 'Content-Type': 'application/json' },
			body: JSON.stringify({
				environmentKey: ' Production ',
				routeNamespace: ' Public ',
				hostname: 'API.Example.COM.'
			})
		}),
		env,
		{
			async configureDomainTarget(command) {
				calls.push(command);
				return {
					environmentId: '018f47a2-8391-7b1c-8f7a-f1d27670f062',
					environmentKey: command.environmentKey,
					routeNamespace: command.routeNamespace,
					domainTargetId: '018f47a2-8391-7b1c-8f7a-f1d27670f063',
					hostname: command.hostname,
					verificationStatus: 'pending'
				};
			}
		}
	);

	assert.equal(response.status, 200);
	assert.deepEqual(calls, [
		{
			accessToken: 'user-token',
			environmentKey: 'production',
			routeNamespace: 'public',
			hostname: 'api.example.com'
		}
	]);
});

test('rejects invalid domain targets before reaching the control plane', async () => {
	const { env } = createEnv();
	let configurationCalls = 0;
	const response = await routeCorexRequest(
		new Request('https://example.com/corex/api/domain-target', {
			method: 'POST',
			headers: { Authorization: 'Bearer user-token', 'Content-Type': 'application/json' },
			body: JSON.stringify({
				environmentKey: 'production',
				routeNamespace: 'public',
				hostname: 'localhost'
			})
		}),
		env,
		{
			async configureDomainTarget() {
				configurationCalls += 1;
				throw new Error('must not be called');
			}
		}
	);

	assert.equal(response.status, 400);
	assert.equal(configurationCalls, 0);
});

test('returns a sanitized protected domain error', async () => {
	const { env } = createEnv();
	const response = await routeCorexRequest(
		new Request('https://example.com/corex/api/domain-target', {
			method: 'POST',
			headers: { Authorization: 'Bearer user-token', 'Content-Type': 'application/json' },
			body: JSON.stringify({
				environmentKey: 'production',
				routeNamespace: 'public',
				hostname: 'api.rakhunok.com'
			})
		}),
		env,
		{
			async configureDomainTarget() {
				throw Object.assign(new Error('internal policy details'), { status: 403 });
			}
		}
	);

	assert.equal(response.status, 403);
	assert.deepEqual(await response.json(), { error: 'The domain is protected.' });
});

test('publishes only a persisted draft revision', async () => {
	const { env } = createEnv();
	const calls = [];
	const api = {
		async publish(command) {
			calls.push(command);
			return { id: 'version-1', version: 1 };
		}
	};
	const url =
		'https://example.com/corex/api/processes/018f47a2-8391-7b1c-8f7a-f1d27670f061/publish';

	const rejected = await routeCorexRequest(
		new Request(url, {
			method: 'POST',
			headers: { Authorization: 'Bearer user-token', 'Content-Type': 'application/json' },
			body: JSON.stringify({ expectedRevision: 4, definition: {}, plan: { steps: [] } })
		}),
		env,
		api
	);
	assert.equal(rejected.status, 400);
	assert.equal(calls.length, 0);

	const accepted = await routeCorexRequest(
		new Request(url, {
			method: 'POST',
			headers: { Authorization: 'Bearer user-token', 'Content-Type': 'application/json' },
			body: JSON.stringify({ expectedRevision: 4 })
		}),
		env,
		api
	);
	assert.equal(accepted.status, 201);
	assert.deepEqual(calls, [
		{
			accessToken: 'user-token',
			processId: '018f47a2-8391-7b1c-8f7a-f1d27670f061',
			expectedRevision: 4
		}
	]);
});

test('publishes to an explicit environment and route namespace', async () => {
	const { env } = createEnv();
	const calls = [];
	const response = await routeCorexRequest(
		new Request(
			'https://example.com/corex/api/processes/018f47a2-8391-7b1c-8f7a-f1d27670f061/publish',
			{
				method: 'POST',
				headers: { Authorization: 'Bearer user-token', 'Content-Type': 'application/json' },
				body: JSON.stringify({
					expectedRevision: 4,
					environmentId: '018f47a2-8391-7b1c-8f7a-f1d27670f062',
					routeNamespace: 'production'
				})
			}
		),
		env,
		{
			async publish(command) {
				calls.push(command);
				return { id: 'version-1', version: 1 };
			}
		}
	);

	assert.equal(response.status, 201);
	assert.deepEqual(calls, [
		{
			accessToken: 'user-token',
			processId: '018f47a2-8391-7b1c-8f7a-f1d27670f061',
			expectedRevision: 4,
			environmentId: '018f47a2-8391-7b1c-8f7a-f1d27670f062',
			routeNamespace: 'production'
		}
	]);
});

test('rejects incomplete publish targets', async () => {
	const { env } = createEnv();
	let publishCalls = 0;
	const response = await routeCorexRequest(
		new Request(
			'https://example.com/corex/api/processes/018f47a2-8391-7b1c-8f7a-f1d27670f061/publish',
			{
				method: 'POST',
				headers: { Authorization: 'Bearer user-token', 'Content-Type': 'application/json' },
				body: JSON.stringify({
					expectedRevision: 4,
					environmentId: '018f47a2-8391-7b1c-8f7a-f1d27670f062'
				})
			}
		),
		env,
		{
			async publish() {
				publishCalls += 1;
				return { id: 'version-1', version: 1 };
			}
		}
	);

	assert.equal(response.status, 400);
	assert.equal(publishCalls, 0);
});

test('returns sanitized control-plane failures', async () => {
	const { env } = createEnv();
	const response = await routeCorexRequest(
		new Request(
			'https://example.com/corex/api/processes/018f47a2-8391-7b1c-8f7a-f1d27670f061/publish',
			{
				method: 'POST',
				headers: { Authorization: 'Bearer expired-token', 'Content-Type': 'application/json' },
				body: JSON.stringify({ expectedRevision: 4 })
			}
		),
		env,
		{
			async publish() {
				throw Object.assign(new Error('upstream details'), { status: 401 });
			}
		}
	);

	assert.equal(response.status, 401);
	assert.deepEqual(await response.json(), { error: 'Authentication required.' });
});

test('returns a distinct sanitized conflict when an HTTP route is already claimed', async () => {
	const { env } = createEnv();
	const response = await routeCorexRequest(
		new Request(
			'https://example.com/corex/api/processes/018f47a2-8391-7b1c-8f7a-f1d27670f061/publish',
			{
				method: 'POST',
				headers: { Authorization: 'Bearer user-token', 'Content-Type': 'application/json' },
				body: JSON.stringify({ expectedRevision: 4 })
			}
		),
		env,
		{
			async publish() {
				throw Object.assign(new Error('internal conflict details'), {
					status: 409,
					code: 'route_conflict'
				});
			}
		}
	);

	assert.equal(response.status, 409);
	assert.deepEqual(await response.json(), { error: 'HTTP route is already in use.' });
});

test('accepts only version-scoped HTTP trigger lifecycle commands', async () => {
	const { env } = createEnv();
	const calls = [];
	const api = {
		async deactivateTrigger(command) {
			calls.push(command);
			return { processId: command.processId, version: command.expectedVersion, active: false };
		},
		async rollbackTrigger(command) {
			calls.push(command);
			return { processId: command.processId, version: command.targetVersion, active: true };
		}
	};
	const baseUrl =
		'https://example.com/corex/api/processes/018f47a2-8391-7b1c-8f7a-f1d27670f061/trigger';
	const headers = { Authorization: 'Bearer user-token', 'Content-Type': 'application/json' };
	const deactivateRequestId = '018f47a2-8391-7b1c-8f7a-f1d27670f063';
	const rollbackRequestId = '018f47a2-8391-7b1c-8f7a-f1d27670f064';

	const rejected = await routeCorexRequest(
		new Request(`${baseUrl}/rollback`, {
			method: 'POST',
			headers,
			body: JSON.stringify({
				requestId: rollbackRequestId,
				expectedVersion: 4,
				targetVersion: 2,
				route: '/forged'
			})
		}),
		env,
		api
	);
	assert.equal(rejected.status, 400);
	const missingRequestId = await routeCorexRequest(
		new Request(`${baseUrl}/deactivate`, {
			method: 'POST',
			headers,
			body: JSON.stringify({ expectedVersion: 4 })
		}),
		env,
		api
	);
	assert.equal(missingRequestId.status, 400);

	const deactivated = await routeCorexRequest(
		new Request(`${baseUrl}/deactivate`, {
			method: 'POST',
			headers,
			body: JSON.stringify({ requestId: deactivateRequestId, expectedVersion: 4 })
		}),
		env,
		api
	);
	const rolledBack = await routeCorexRequest(
		new Request(`${baseUrl}/rollback`, {
			method: 'POST',
			headers,
			body: JSON.stringify({ requestId: rollbackRequestId, expectedVersion: 4, targetVersion: 2 })
		}),
		env,
		api
	);

	assert.equal(deactivated.status, 200);
	assert.equal(rolledBack.status, 200);
	assert.deepEqual(calls, [
		{
			accessToken: 'user-token',
			processId: '018f47a2-8391-7b1c-8f7a-f1d27670f061',
			requestId: deactivateRequestId,
			expectedVersion: 4
		},
		{
			accessToken: 'user-token',
			processId: '018f47a2-8391-7b1c-8f7a-f1d27670f061',
			requestId: rollbackRequestId,
			expectedVersion: 4,
			targetVersion: 2
		}
	]);
});

test('starts a run with validated instance options and rejects browser-authored execution data', async () => {
	const { env } = createEnv();
	const calls = [];
	const api = {
		async publish() {
			throw new Error('not used');
		},
		async start(command) {
			calls.push(command);
			return { id: 'run-1', workflowInstanceId: 'workflow-1', status: 'queued' };
		}
	};
	const url = 'https://example.com/corex/api/processes/018f47a2-8391-7b1c-8f7a-f1d27670f061/runs';
	const headers = { Authorization: 'Bearer user-token', 'Content-Type': 'application/json' };

	for (const forbidden of [
		{ input: {}, definition: {} },
		{ input: {}, plan: { steps: [] } },
		{ input: {}, version: 7 },
		{ input: {}, workflowInstanceId: 'chosen-by-browser' },
		{ input: {}, instanceId: 'not-a-uuid' },
		{ input: {}, locationHint: 'moon' }
	]) {
		const rejected = await routeCorexRequest(
			new Request(url, {
				method: 'POST',
				headers,
				body: JSON.stringify(forbidden)
			}),
			env,
			api
		);
		assert.equal(rejected.status, 400);
	}
	assert.equal(calls.length, 0);

	const accepted = await routeCorexRequest(
		new Request(url, {
			method: 'POST',
			headers,
			body: JSON.stringify({ input: { paymentId: 'pay-42' } })
		}),
		env,
		api
	);
	assert.equal(accepted.status, 202);
	assert.deepEqual(calls, [
		{
			accessToken: 'user-token',
			processId: '018f47a2-8391-7b1c-8f7a-f1d27670f061',
			input: { paymentId: 'pay-42' }
		}
	]);

	const acceptedWithOptions = await routeCorexRequest(
		new Request(url, {
			method: 'POST',
			headers,
			body: JSON.stringify({
				input: { paymentId: 'pay-43' },
				instanceId: '018f47a2-8391-7b1c-8f7a-f1d27670f062',
				locationHint: 'weur'
			})
		}),
		env,
		api
	);
	assert.equal(acceptedWithOptions.status, 202);
	assert.deepEqual(calls[1], {
		accessToken: 'user-token',
		processId: '018f47a2-8391-7b1c-8f7a-f1d27670f061',
		input: { paymentId: 'pay-43' },
		instanceId: '018f47a2-8391-7b1c-8f7a-f1d27670f062',
		locationHint: 'weur'
	});
});

test('sends only an idempotent typed payload event to an authenticated run', async () => {
	const { env } = createEnv();
	const calls = [];
	const api = {
		async signal(command) {
			calls.push(command);
			return { accepted: true };
		}
	};
	const url = 'https://example.com/corex/api/runs/018f47a2-8391-7b1c-8f7a-f1d27670f062/events';
	const headers = { Authorization: 'Bearer user-token', 'Content-Type': 'application/json' };

	const rejected = await routeCorexRequest(
		new Request(url, {
			method: 'POST',
			headers,
			body: JSON.stringify({
				type: 'payment-approved',
				payload: {},
				workflowInstanceId: 'browser-choice'
			})
		}),
		env,
		api
	);
	assert.equal(rejected.status, 400);
	assert.equal(calls.length, 0);

	const missingEventId = await routeCorexRequest(
		new Request(url, {
			method: 'POST',
			headers,
			body: JSON.stringify({ type: 'payment-approved', payload: {} })
		}),
		env,
		api
	);
	assert.equal(missingEventId.status, 400);
	assert.equal(calls.length, 0);

	const reservedEvent = await routeCorexRequest(
		new Request(url, {
			method: 'POST',
			headers,
			body: JSON.stringify({
				eventId: '018f47a2-8391-7b1c-8f7a-f1d27670f064',
				type: 'Corex-subprocess-result:step-1',
				payload: {}
			})
		}),
		env,
		api
	);
	assert.equal(reservedEvent.status, 400);
	assert.equal(calls.length, 0);

	const accepted = await routeCorexRequest(
		new Request(url, {
			method: 'POST',
			headers,
			body: JSON.stringify({
				eventId: '018f47a2-8391-7b1c-8f7a-f1d27670f064',
				stepId: 'await-payment-approval',
				type: 'payment-approved',
				payload: { approved: true }
			})
		}),
		env,
		api
	);
	assert.equal(accepted.status, 202);
	assert.deepEqual(calls, [
		{
			accessToken: 'user-token',
			runId: '018f47a2-8391-7b1c-8f7a-f1d27670f062',
			eventId: '018f47a2-8391-7b1c-8f7a-f1d27670f064',
			stepId: 'await-payment-approval',
			type: 'payment-approved',
			payload: { approved: true }
		}
	]);
});

test('cancels an authenticated run with only an idempotency request ID', async () => {
	const { env } = createEnv();
	const calls = [];
	const api = {
		async cancel(command) {
			calls.push(command);
			return { id: command.runId, status: 'terminated', accepted: true };
		}
	};
	const url = 'https://example.com/corex/api/runs/018f47a2-8391-7b1c-8f7a-f1d27670f062/cancel';
	const headers = { Authorization: 'Bearer user-token', 'Content-Type': 'application/json' };

	const rejected = await routeCorexRequest(
		new Request(url, {
			method: 'POST',
			headers,
			body: JSON.stringify({
				requestId: '018f47a2-8391-7b1c-8f7a-f1d27670f063',
				workflowInstanceId: 'browser-choice'
			})
		}),
		env,
		api
	);
	assert.equal(rejected.status, 400);
	assert.equal(calls.length, 0);

	const accepted = await routeCorexRequest(
		new Request(url, {
			method: 'POST',
			headers,
			body: JSON.stringify({ requestId: '018f47a2-8391-7b1c-8f7a-f1d27670f063' })
		}),
		env,
		api
	);
	assert.equal(accepted.status, 202);
	assert.deepEqual(calls, [
		{
			accessToken: 'user-token',
			runId: '018f47a2-8391-7b1c-8f7a-f1d27670f062',
			requestId: '018f47a2-8391-7b1c-8f7a-f1d27670f063'
		}
	]);
});

test('requests authenticated pause and resume with only an idempotency request ID', async () => {
	for (const action of ['pause', 'resume']) {
		const { env } = createEnv();
		const calls = [];
		const api = {
			async lifecycle(command) {
				calls.push(command);
				return {
					id: command.runId,
					status: action === 'pause' ? 'waiting_for_pause' : 'paused',
					accepted: true
				};
			}
		};
		const url = `https://example.com/corex/api/runs/018f47a2-8391-7b1c-8f7a-f1d27670f062/${action}`;
		const response = await routeCorexRequest(
			new Request(url, {
				method: 'POST',
				headers: { Authorization: 'Bearer user-token', 'Content-Type': 'application/json' },
				body: JSON.stringify({ requestId: '018f47a2-8391-7b1c-8f7a-f1d27670f063' })
			}),
			env,
			api
		);

		assert.equal(response.status, 202);
		assert.deepEqual(calls, [
			{
				accessToken: 'user-token',
				runId: '018f47a2-8391-7b1c-8f7a-f1d27670f062',
				requestId: '018f47a2-8391-7b1c-8f7a-f1d27670f063',
				action
			}
		]);
	}
});

test('requests an authenticated restart with an optional exact durable step', async () => {
	const { env } = createEnv();
	const calls = [];
	const api = {
		async restart(command) {
			calls.push(command);
			return { id: command.runId, status: 'queued', executionGeneration: 2, accepted: true };
		}
	};
	const url = 'https://example.com/corex/api/runs/018f47a2-8391-7b1c-8f7a-f1d27670f062/restart';
	const headers = { Authorization: 'Bearer user-token', 'Content-Type': 'application/json' };

	const rejected = await routeCorexRequest(
		new Request(url, {
			method: 'POST',
			headers,
			body: JSON.stringify({
				requestId: '018f47a2-8391-7b1c-8f7a-f1d27670f063',
				from: { name: 'charge-card', type: 'step' }
			})
		}),
		env,
		api
	);
	assert.equal(rejected.status, 400);

	const accepted = await routeCorexRequest(
		new Request(url, {
			method: 'POST',
			headers,
			body: JSON.stringify({
				requestId: '018f47a2-8391-7b1c-8f7a-f1d27670f063',
				from: { name: 'charge-card', count: 2, type: 'do' }
			})
		}),
		env,
		api
	);
	assert.equal(accepted.status, 202);
	assert.deepEqual(calls, [
		{
			accessToken: 'user-token',
			runId: '018f47a2-8391-7b1c-8f7a-f1d27670f062',
			requestId: '018f47a2-8391-7b1c-8f7a-f1d27670f063',
			from: { name: 'charge-card', count: 2, type: 'do' }
		}
	]);
});

test('requests authenticated rollback with only an idempotency request ID', async () => {
	const { env } = createEnv();
	const calls = [];
	const api = {
		async rollback(command) {
			calls.push(command);
			return { id: command.runId, status: 'rolling_back', accepted: true };
		}
	};
	const url = 'https://example.com/corex/api/runs/018f47a2-8391-7b1c-8f7a-f1d27670f062/rollback';
	const headers = { Authorization: 'Bearer user-token', 'Content-Type': 'application/json' };

	const rejected = await routeCorexRequest(
		new Request(url, {
			method: 'POST',
			headers,
			body: JSON.stringify({
				requestId: '018f47a2-8391-7b1c-8f7a-f1d27670f063',
				workflowInstanceId: 'browser-choice'
			})
		}),
		env,
		api
	);
	assert.equal(rejected.status, 400);

	const accepted = await routeCorexRequest(
		new Request(url, {
			method: 'POST',
			headers,
			body: JSON.stringify({ requestId: '018f47a2-8391-7b1c-8f7a-f1d27670f063' })
		}),
		env,
		api
	);
	assert.equal(accepted.status, 202);
	assert.deepEqual(calls, [
		{
			accessToken: 'user-token',
			runId: '018f47a2-8391-7b1c-8f7a-f1d27670f062',
			requestId: '018f47a2-8391-7b1c-8f7a-f1d27670f063'
		}
	]);
});

test('requests authenticated archive with only an idempotency request ID', async () => {
	const { env } = createEnv();
	const calls = [];
	const api = {
		async archive(command) {
			calls.push(command);
			return {
				id: command.runId,
				status: 'complete',
				archivedAt: '2026-09-01T05:00:00.000Z',
				accepted: true
			};
		}
	};
	const url = 'https://example.com/corex/api/runs/018f47a2-8391-7b1c-8f7a-f1d27670f062/archive';
	const headers = { Authorization: 'Bearer user-token', 'Content-Type': 'application/json' };

	const rejected = await routeCorexRequest(
		new Request(url, {
			method: 'POST',
			headers,
			body: JSON.stringify({
				requestId: '018f47a2-8391-7b1c-8f7a-f1d27670f063',
				deleteHistory: true
			})
		}),
		env,
		api
	);
	assert.equal(rejected.status, 400);

	const accepted = await routeCorexRequest(
		new Request(url, {
			method: 'POST',
			headers,
			body: JSON.stringify({ requestId: '018f47a2-8391-7b1c-8f7a-f1d27670f063' })
		}),
		env,
		api
	);
	assert.equal(accepted.status, 202);
	assert.deepEqual(calls, [
		{
			accessToken: 'user-token',
			runId: '018f47a2-8391-7b1c-8f7a-f1d27670f062',
			requestId: '018f47a2-8391-7b1c-8f7a-f1d27670f063'
		}
	]);
});

test('requests authenticated process retirement with only an idempotency request ID', async () => {
	const { env } = createEnv();
	const calls = [];
	const api = {
		async retireProcess(command) {
			calls.push(command);
			return {
				id: command.processId,
				lifecycle: 'retired',
				retiredAt: '2026-09-03T08:00:00.000Z',
				accepted: true
			};
		}
	};
	const processId = '018f47a2-8391-7b1c-8f7a-f1d27670f062';
	const url = `https://example.com/corex/api/processes/${processId}/retire`;
	const headers = { Authorization: 'Bearer user-token', 'Content-Type': 'application/json' };

	const rejected = await routeCorexRequest(
		new Request(url, {
			method: 'POST',
			headers,
			body: JSON.stringify({
				requestId: '018f47a2-8391-7b1c-8f7a-f1d27670f063',
				deleteHistory: true
			})
		}),
		env,
		api
	);
	assert.equal(rejected.status, 400);

	const accepted = await routeCorexRequest(
		new Request(url, {
			method: 'POST',
			headers,
			body: JSON.stringify({ requestId: '018f47a2-8391-7b1c-8f7a-f1d27670f063' })
		}),
		env,
		api
	);
	assert.equal(accepted.status, 202);
	assert.deepEqual(calls, [
		{
			accessToken: 'user-token',
			processId,
			requestId: '018f47a2-8391-7b1c-8f7a-f1d27670f063'
		}
	]);
});
