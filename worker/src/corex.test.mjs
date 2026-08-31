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

test('requires authentication before publishing a process', async () => {
	const { env } = createEnv();
	let publishCalls = 0;
	const response = await routeCorexRequest(
		new Request('https://example.com/corex/api/processes/018f47a2-8391-7b1c-8f7a-f1d27670f061/publish', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ expectedRevision: 4 })
		}),
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

test('publishes only a persisted draft revision', async () => {
	const { env } = createEnv();
	const calls = [];
	const api = {
		async publish(command) {
			calls.push(command);
			return { id: 'version-1', version: 1 };
		}
	};
	const url = 'https://example.com/corex/api/processes/018f47a2-8391-7b1c-8f7a-f1d27670f061/publish';

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
	assert.deepEqual(calls, [{
		accessToken: 'user-token',
		processId: '018f47a2-8391-7b1c-8f7a-f1d27670f061',
		expectedRevision: 4
	}]);
});

test('returns sanitized control-plane failures', async () => {
	const { env } = createEnv();
	const response = await routeCorexRequest(
		new Request('https://example.com/corex/api/processes/018f47a2-8391-7b1c-8f7a-f1d27670f061/publish', {
			method: 'POST',
			headers: { Authorization: 'Bearer expired-token', 'Content-Type': 'application/json' },
			body: JSON.stringify({ expectedRevision: 4 })
		}),
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

test('starts a run with input only and rejects browser-authored execution data', async () => {
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
		{ input: {}, workflowInstanceId: 'chosen-by-browser' }
	]) {
		const rejected = await routeCorexRequest(new Request(url, {
			method: 'POST',
			headers,
			body: JSON.stringify(forbidden)
		}), env, api);
		assert.equal(rejected.status, 400);
	}
	assert.equal(calls.length, 0);

	const accepted = await routeCorexRequest(new Request(url, {
		method: 'POST',
		headers,
		body: JSON.stringify({ input: { paymentId: 'pay-42' } })
	}), env, api);
	assert.equal(accepted.status, 202);
	assert.deepEqual(calls, [{
		accessToken: 'user-token',
		processId: '018f47a2-8391-7b1c-8f7a-f1d27670f061',
		input: { paymentId: 'pay-42' }
	}]);
});

test('sends only a typed payload event to an authenticated run', async () => {
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

	const rejected = await routeCorexRequest(new Request(url, {
		method: 'POST', headers,
		body: JSON.stringify({ type: 'payment-approved', payload: {}, workflowInstanceId: 'browser-choice' })
	}), env, api);
	assert.equal(rejected.status, 400);
	assert.equal(calls.length, 0);

	const accepted = await routeCorexRequest(new Request(url, {
		method: 'POST', headers,
		body: JSON.stringify({ type: 'payment-approved', payload: { approved: true } })
	}), env, api);
	assert.equal(accepted.status, 202);
	assert.deepEqual(calls, [{
		accessToken: 'user-token',
		runId: '018f47a2-8391-7b1c-8f7a-f1d27670f062',
		type: 'payment-approved',
		payload: { approved: true }
	}]);
});