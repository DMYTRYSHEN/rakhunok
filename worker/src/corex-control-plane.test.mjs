import assert from 'node:assert/strict';
import test from 'node:test';

import { CorexControlPlaneError, createSupabaseCorexControlPlane } from './corex-control-plane.ts';
import { createStarterProcessDefinition } from '../../src/lib/features/corex/process-definition.ts';

const command = {
	accessToken: 'user-token',
	processId: '018f47a2-8391-7b1c-8f7a-f1d27670f061',
	expectedRevision: 4
};

test('verifies the user before publishing the persisted process revision', async () => {
	const requests = [];
	const fetcher = async (input, init) => {
		requests.push({ url: String(input), init });
		if (String(input).endsWith('/auth/v1/user')) {
			return Response.json({ id: '018f47a2-8391-7b1c-8f7a-f1d27670f099' });
		}
		return Response.json({ id: 'version-1', version: 1 });
	};
	const controlPlane = createSupabaseCorexControlPlane({
		url: 'https://project.supabase.co',
		publishableKey: 'publishable-key',
		serviceRoleKey: 'service-role-key',
		fetcher
	});

	const published = await controlPlane.publish(command);

	assert.deepEqual(published, { id: 'version-1', version: 1 });
	assert.equal(requests.length, 2);
	assert.equal(requests[0].url, 'https://project.supabase.co/auth/v1/user');
	assert.equal(requests[0].init.headers.Authorization, 'Bearer user-token');
	assert.equal(requests[0].init.headers.apikey, 'publishable-key');
	assert.equal(requests[1].url, 'https://project.supabase.co/rest/v1/rpc/corex_publish_process');
	assert.equal(requests[1].init.headers.Authorization, 'Bearer service-role-key');
	assert.equal(requests[1].init.headers.apikey, 'service-role-key');
	assert.deepEqual(JSON.parse(requests[1].init.body), {
		p_process_id: command.processId,
		p_owner_user_id: '018f47a2-8391-7b1c-8f7a-f1d27670f099',
		p_expected_revision: 4
	});
});

test('does not call the publish RPC when the user token is invalid', async () => {
	let calls = 0;
	const controlPlane = createSupabaseCorexControlPlane({
		url: 'https://project.supabase.co',
		publishableKey: 'publishable-key',
		serviceRoleKey: 'service-role-key',
		fetcher: async () => {
			calls += 1;
			return Response.json({ message: 'invalid token' }, { status: 401 });
		}
	});

	await assert.rejects(
		controlPlane.publish(command),
		(error) => error instanceof CorexControlPlaneError && error.status === 401
	);
	assert.equal(calls, 1);
});

test('starts a run from the server-loaded immutable version', async () => {
	const requests = [];
	const workflowCalls = [];
	const definition = {
		...createStarterProcessDefinition(),
		id: command.processId,
		revision: 4,
		lifecycle: 'published'
	};
	const responses = [
		Response.json({ id: '018f47a2-8391-7b1c-8f7a-f1d27670f099' }),
		Response.json({
			id: 'run-1',
			workflowInstanceId: 'workflow-1',
			status: 'queued',
			definition
		})
	];
	const controlPlane = createSupabaseCorexControlPlane({
		url: 'https://project.supabase.co',
		publishableKey: 'publishable-key',
		serviceRoleKey: 'service-role-key',
		fetcher: async (input, init) => {
			requests.push({ url: String(input), init });
			return responses.shift();
		},
		workflow: {
			async create(options) {
				workflowCalls.push(options);
				return { id: options.id };
			}
		},
		createId: () => 'workflow-1'
	});

	const run = await controlPlane.start({
		accessToken: command.accessToken,
		processId: command.processId,
		input: { paymentId: 'pay-42' }
	});

	assert.deepEqual(run, { id: 'run-1', workflowInstanceId: 'workflow-1', status: 'queued' });
	assert.equal(requests[1].url, 'https://project.supabase.co/rest/v1/rpc/corex_start_process_run');
	assert.deepEqual(JSON.parse(requests[1].init.body), {
		p_process_id: command.processId,
		p_owner_user_id: '018f47a2-8391-7b1c-8f7a-f1d27670f099',
		p_workflow_instance_id: 'workflow-1',
		p_input: { paymentId: 'pay-42' }
	});
	assert.equal(workflowCalls.length, 1);
	assert.equal(workflowCalls[0].id, 'workflow-1');
	assert.equal(workflowCalls[0].params.runId, 'run-1');
	assert.equal(workflowCalls[0].params.ownerUserId, '018f47a2-8391-7b1c-8f7a-f1d27670f099');
	assert.equal(workflowCalls[0].params.plan.processId, command.processId);
	assert.deepEqual(workflowCalls[0].params.input, { paymentId: 'pay-42' });
});

test('marks a created run as errored when Workflow creation fails', async () => {
	const requests = [];
	const definition = {
		...createStarterProcessDefinition(),
		id: command.processId,
		revision: 4,
		lifecycle: 'published'
	};
	const responses = [
		Response.json({ id: '018f47a2-8391-7b1c-8f7a-f1d27670f099' }),
		Response.json({
			id: 'run-1',
			workflowInstanceId: 'workflow-1',
			status: 'queued',
			definition
		}),
		Response.json({ id: 'run-1', status: 'errored' })
	];
	const controlPlane = createSupabaseCorexControlPlane({
		url: 'https://project.supabase.co',
		publishableKey: 'publishable-key',
		serviceRoleKey: 'service-role-key',
		fetcher: async (input, init) => {
			requests.push({ url: String(input), init });
			return responses.shift();
		},
		workflow: {
			async create() {
				throw new Error('secret provider details');
			}
		},
		createId: () => 'workflow-1'
	});

	await assert.rejects(
		controlPlane.start({
			accessToken: command.accessToken,
			processId: command.processId,
			input: { paymentId: 'pay-42' }
		}),
		(error) => error instanceof CorexControlPlaneError && error.status === 503
	);

	assert.equal(requests.length, 3);
	assert.equal(requests[2].url, 'https://project.supabase.co/rest/v1/rpc/corex_fail_process_run');
	assert.deepEqual(JSON.parse(requests[2].init.body), {
		p_run_id: 'run-1',
		p_owner_user_id: '018f47a2-8391-7b1c-8f7a-f1d27670f099',
		p_error: { code: 'workflow_create_failed' }
	});
	assert.equal(requests[2].init.body.includes('secret provider details'), false);
});

test('keeps Workflow failures sanitized when run compensation is unavailable', async () => {
	const definition = {
		...createStarterProcessDefinition(),
		id: command.processId,
		revision: 4,
		lifecycle: 'published'
	};
	let calls = 0;
	const controlPlane = createSupabaseCorexControlPlane({
		url: 'https://project.supabase.co',
		publishableKey: 'publishable-key',
		serviceRoleKey: 'service-role-key',
		fetcher: async () => {
			calls += 1;
			if (calls === 1) return Response.json({ id: '018f47a2-8391-7b1c-8f7a-f1d27670f099' });
			if (calls === 2) {
				return Response.json({
					id: 'run-1',
					workflowInstanceId: 'workflow-1',
					status: 'queued',
					definition
				});
			}
			throw new Error('secret database details');
		},
		workflow: {
			async create() {
				throw new Error('secret provider details');
			}
		},
		createId: () => 'workflow-1'
	});

	await assert.rejects(
		controlPlane.start({ accessToken: command.accessToken, processId: command.processId, input: {} }),
		(error) =>
			error instanceof CorexControlPlaneError &&
			error.status === 503 &&
			error.message === 'Workflow could not be started.'
	);
	assert.equal(calls, 3);
});

test('resolves an owned run before sending an event to its Workflow instance', async () => {
	const requests = [];
	const workflowCalls = [];
	const responses = [
		Response.json({ id: '018f47a2-8391-7b1c-8f7a-f1d27670f099' }),
		Response.json([{ workflow_instance_id: 'workflow-1', status: 'waiting' }])
	];
	const controlPlane = createSupabaseCorexControlPlane({
		url: 'https://project.supabase.co',
		publishableKey: 'publishable-key',
		serviceRoleKey: 'service-role-key',
		fetcher: async (input, init) => {
			requests.push({ url: String(input), init });
			return responses.shift();
		},
		workflow: {
			async create() { throw new Error('not used'); },
			async get(id) {
				workflowCalls.push(['get', id]);
				return {
					async sendEvent(event) { workflowCalls.push(['sendEvent', event]); }
				};
			}
		}
	});

	const result = await controlPlane.signal({
		accessToken: 'user-token',
		runId: '018f47a2-8391-7b1c-8f7a-f1d27670f062',
		type: 'payment-approved',
		payload: { approved: true }
	});

	assert.deepEqual(result, { accepted: true });
	assert.match(requests[1].url, /corex_runs\?select=workflow_instance_id%2Cstatus/);
	assert.match(requests[1].url, /owner_user_id=eq\.018f47a2-8391-7b1c-8f7a-f1d27670f099/);
	assert.deepEqual(workflowCalls, [
		['get', 'workflow-1'],
		['sendEvent', { type: 'payment-approved', payload: { approved: true } }]
	]);
});

test('does not reveal or signal a run outside the authenticated owner scope', async () => {
	let workflowCalls = 0;
	const responses = [
		Response.json({ id: '018f47a2-8391-7b1c-8f7a-f1d27670f099' }),
		Response.json([])
	];
	const controlPlane = createSupabaseCorexControlPlane({
		url: 'https://project.supabase.co',
		publishableKey: 'publishable-key',
		serviceRoleKey: 'service-role-key',
		fetcher: async () => responses.shift(),
		workflow: {
			async create() { throw new Error('not used'); },
			async get() { workflowCalls += 1; throw new Error('must not run'); }
		}
	});

	await assert.rejects(
		controlPlane.signal({
			accessToken: 'user-token', runId: '018f47a2-8391-7b1c-8f7a-f1d27670f062',
			type: 'payment-approved', payload: {}
		}),
		(error) => error instanceof CorexControlPlaneError && error.status === 404
	);
	assert.equal(workflowCalls, 0);
});

test('attaches the authenticated actor to canonical approval decisions', async () => {
	const workflowCalls = [];
	const requests = [];
	const controlPlane = createSupabaseCorexControlPlane({
		url: 'https://project.supabase.co', publishableKey: 'publishable', serviceRoleKey: 'service-role',
		fetcher: async (url, init) => {
			requests.push({ url: String(url), init });
			if (url.endsWith('/auth/v1/user')) return Response.json({ id: 'user-1' });
			return Response.json({
				workflowInstanceId: 'workflow-1',
				payload: { decision: 'rejected', comment: 'Missing invoice', actorUserId: 'user-1', taskId: 'task-1' }
			});
		},
		workflow: {
			async create() {},
			async get() { return { async sendEvent(event) { workflowCalls.push(event); } }; }
		}
	});

	await controlPlane.signal({ accessToken: 'token', runId: 'run-1', type: 'corex-approval', payload: { decision: 'rejected', comment: 'Missing invoice', actorUserId: 'forged' } });
	assert.deepEqual(workflowCalls, [{
		type: 'corex-approval',
		payload: { decision: 'rejected', comment: 'Missing invoice', actorUserId: 'user-1', taskId: 'task-1' }
	}]);
	assert.match(requests[1].url, /\/rest\/v1\/rpc\/corex_decide_approval_task$/);
	assert.deepEqual(JSON.parse(requests[1].init.body), {
		p_run_id: 'run-1', p_actor_user_id: 'user-1', p_decision: 'rejected', p_comment: 'Missing invoice'
	});
	await assert.rejects(
		controlPlane.signal({ accessToken: 'token', runId: 'run-1', type: 'corex-approval', payload: { decision: 'maybe' } }),
		(error) => error.status === 400
	);
});