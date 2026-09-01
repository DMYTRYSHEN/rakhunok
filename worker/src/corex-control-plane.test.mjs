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
	const draft = {
		...createStarterProcessDefinition(),
		id: command.processId,
		revision: command.expectedRevision
	};
	const fetcher = async (input, init) => {
		requests.push({ url: String(input), init });
		if (String(input).endsWith('/auth/v1/user')) {
			return Response.json({ id: '018f47a2-8391-7b1c-8f7a-f1d27670f099' });
		}
		if (String(input).includes('/rest/v1/corex_processes?')) {
			return Response.json([{ revision: command.expectedRevision, draft_definition: draft }]);
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
	assert.equal(requests.length, 3);
	assert.equal(requests[0].url, 'https://project.supabase.co/auth/v1/user');
	assert.equal(requests[0].init.headers.Authorization, 'Bearer user-token');
	assert.equal(requests[0].init.headers.apikey, 'publishable-key');
	assert.match(requests[1].url, /\/rest\/v1\/corex_processes\?/);
	assert.equal(requests[1].init.headers.Authorization, 'Bearer service-role-key');
	assert.equal(requests[2].url, 'https://project.supabase.co/rest/v1/rpc/corex_publish_process');
	assert.equal(requests[2].init.headers.Authorization, 'Bearer service-role-key');
	assert.equal(requests[2].init.headers.apikey, 'service-role-key');
	assert.deepEqual(JSON.parse(requests[2].init.body), {
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

test('rejects an invalid persisted draft before calling the publish RPC', async () => {
	const requests = [];
	const controlPlane = createSupabaseCorexControlPlane({
		url: 'https://project.supabase.co',
		publishableKey: 'publishable-key',
		serviceRoleKey: 'service-role-key',
		fetcher: async (input, init) => {
			requests.push({ url: String(input), init });
			if (String(input).endsWith('/auth/v1/user')) {
				return Response.json({ id: '018f47a2-8391-7b1c-8f7a-f1d27670f099' });
			}
			return Response.json([
				{
					revision: command.expectedRevision,
					draft_definition: { schemaVersion: 1, nodes: 'not-an-array', edges: [] }
				}
			]);
		}
	});

	await assert.rejects(
		controlPlane.publish(command),
		(error) => error instanceof CorexControlPlaneError && error.status === 422
	);
	assert.equal(requests.length, 2);
	assert.match(requests[1].url, /\/rest\/v1\/corex_processes\?/);
	const query = new URL(requests[1].url).searchParams;
	assert.equal(query.get('id'), `eq.${command.processId}`);
	assert.equal(query.get('owner_user_id'), 'eq.018f47a2-8391-7b1c-8f7a-f1d27670f099');
	assert.equal(query.get('revision'), `eq.${command.expectedRevision}`);
	assert.ok(!requests.some((request) => request.url.endsWith('/rpc/corex_publish_process')));
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
	assert.equal(workflowCalls[0].params.workflowInstanceId, 'workflow-1');
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
		controlPlane.start({
			accessToken: command.accessToken,
			processId: command.processId,
			input: {}
		}),
		(error) =>
			error instanceof CorexControlPlaneError &&
			error.status === 503 &&
			error.message === 'Workflow could not be started.'
	);
	assert.equal(calls, 3);
});

test('enqueues an owned external event through the durable RPC without direct delivery', async () => {
	const requests = [];
	const responses = [
		Response.json({ id: '018f47a2-8391-7b1c-8f7a-f1d27670f099' }),
		Response.json({ accepted: true })
	];
	const controlPlane = createSupabaseCorexControlPlane({
		url: 'https://project.supabase.co',
		publishableKey: 'publishable-key',
		serviceRoleKey: 'service-role-key',
		fetcher: async (input, init) => {
			requests.push({ url: String(input), init });
			return responses.shift();
		}
	});

	const result = await controlPlane.signal({
		accessToken: 'user-token',
		runId: '018f47a2-8391-7b1c-8f7a-f1d27670f062',
		eventId: '018f47a2-8391-7b1c-8f7a-f1d27670f064',
		type: 'payment-approved',
		payload: { approved: true }
	});

	assert.deepEqual(result, { accepted: true });
	assert.match(requests[1].url, /\/rest\/v1\/rpc\/corex_enqueue_workflow_event$/);
	assert.deepEqual(JSON.parse(requests[1].init.body), {
		p_run_id: '018f47a2-8391-7b1c-8f7a-f1d27670f062',
		p_owner_user_id: '018f47a2-8391-7b1c-8f7a-f1d27670f099',
		p_event_id: '018f47a2-8391-7b1c-8f7a-f1d27670f064',
		p_event_type: 'payment-approved',
		p_payload: { approved: true }
	});
});

test('does not reveal or signal a run outside the authenticated owner scope', async () => {
	let workflowCalls = 0;
	const responses = [
		Response.json({ id: '018f47a2-8391-7b1c-8f7a-f1d27670f099' }),
		Response.json({ error: 'missing' }, { status: 404 })
	];
	const controlPlane = createSupabaseCorexControlPlane({
		url: 'https://project.supabase.co',
		publishableKey: 'publishable-key',
		serviceRoleKey: 'service-role-key',
		fetcher: async () => responses.shift(),
		workflow: {
			async create() {
				throw new Error('not used');
			},
			async get() {
				workflowCalls += 1;
				throw new Error('must not run');
			}
		}
	});

	await assert.rejects(
		controlPlane.signal({
			accessToken: 'user-token',
			runId: '018f47a2-8391-7b1c-8f7a-f1d27670f062',
			eventId: '018f47a2-8391-7b1c-8f7a-f1d27670f064',
			type: 'payment-approved',
			payload: {}
		}),
		(error) => error instanceof CorexControlPlaneError && error.status === 404
	);
	assert.equal(workflowCalls, 0);
});

test('accepts canonical approval decisions through the durable RPC without direct delivery', async () => {
	const requests = [];
	const controlPlane = createSupabaseCorexControlPlane({
		url: 'https://project.supabase.co',
		publishableKey: 'publishable',
		serviceRoleKey: 'service-role',
		fetcher: async (url, init) => {
			requests.push({ url: String(url), init });
			if (url.endsWith('/auth/v1/user')) return Response.json({ id: 'user-1' });
			return Response.json({ accepted: true });
		}
	});

	await controlPlane.signal({
		accessToken: 'token',
		runId: 'run-1',
		type: 'corex-approval',
		payload: { decision: 'rejected', comment: 'Missing invoice', actorUserId: 'forged' }
	});
	assert.match(requests[1].url, /\/rest\/v1\/rpc\/corex_decide_approval_task$/);
	assert.deepEqual(JSON.parse(requests[1].init.body), {
		p_run_id: 'run-1',
		p_actor_user_id: 'user-1',
		p_decision: 'rejected',
		p_comment: 'Missing invoice'
	});
	await assert.rejects(
		controlPlane.signal({
			accessToken: 'token',
			runId: 'run-1',
			type: 'corex-approval',
			payload: { decision: 'maybe' }
		}),
		(error) => error.status === 400
	);
});

test('requests recursive cancellation atomically before terminating Workflow instances', async () => {
	const requests = [];
	const workflowCalls = [];
	const responses = [
		Response.json({ id: 'owner-1' }),
		Response.json({
			id: 'run-1',
			status: 'terminated',
			accepted: true,
			workflowInstanceIds: ['child-workflow', 'root-workflow']
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
			async create() {
				throw new Error('not used');
			},
			async get(id) {
				workflowCalls.push(['get', id]);
				return {
					async status() {
						return { status: 'running' };
					},
					async terminate(options) {
						workflowCalls.push(['terminate', id, options]);
					},
					async sendEvent() {
						throw new Error('not used');
					}
				};
			}
		}
	});

	const result = await controlPlane.cancel({
		accessToken: 'user-token',
		runId: 'run-1',
		requestId: '018f47a2-8391-7b1c-8f7a-f1d27670f063'
	});

	assert.deepEqual(result, { id: 'run-1', status: 'terminated', accepted: true });
	assert.equal(
		requests[1].url,
		'https://project.supabase.co/rest/v1/rpc/corex_request_run_cancellation'
	);
	assert.deepEqual(JSON.parse(requests[1].init.body), {
		p_run_id: 'run-1',
		p_owner_user_id: 'owner-1',
		p_request_id: '018f47a2-8391-7b1c-8f7a-f1d27670f063'
	});
	assert.deepEqual(workflowCalls, [
		['get', 'child-workflow'],
		['terminate', 'child-workflow', undefined],
		['get', 'root-workflow'],
		['terminate', 'root-workflow', undefined]
	]);
});

test('persists a lifecycle intent without calling Workflow directly', async () => {
	const requests = [];
	let workflowCalls = 0;
	const responses = [
		Response.json({ id: 'owner-1' }),
		Response.json({ id: 'run-1', status: 'waiting_for_pause', accepted: true })
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
				workflowCalls += 1;
			},
			async get() {
				workflowCalls += 1;
			}
		}
	});

	await assert.doesNotReject(
		controlPlane.lifecycle({
			accessToken: 'user-token',
			runId: 'run-1',
			requestId: '018f47a2-8391-7b1c-8f7a-f1d27670f063',
			action: 'pause'
		})
	);
	assert.equal(
		requests[1].url,
		'https://project.supabase.co/rest/v1/rpc/corex_request_run_lifecycle'
	);
	assert.deepEqual(JSON.parse(requests[1].init.body), {
		p_run_id: 'run-1',
		p_owner_user_id: 'owner-1',
		p_request_id: '018f47a2-8391-7b1c-8f7a-f1d27670f063',
		p_command: 'pause'
	});
	assert.equal(workflowCalls, 0);
});

test('persists a restart intent without calling Workflow directly', async () => {
	const requests = [];
	let workflowCalls = 0;
	const responses = [
		Response.json({ id: 'owner-1' }),
		Response.json({ id: 'run-1', status: 'queued', executionGeneration: 2, accepted: true })
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
				workflowCalls += 1;
			},
			async get() {
				workflowCalls += 1;
			}
		}
	});

	const result = await controlPlane.restart({
		accessToken: 'user-token',
		runId: 'run-1',
		requestId: '018f47a2-8391-7b1c-8f7a-f1d27670f063',
		from: { name: 'charge-card', count: 2, type: 'do' }
	});

	assert.deepEqual(result, {
		id: 'run-1',
		status: 'queued',
		executionGeneration: 2,
		accepted: true
	});
	assert.equal(
		requests[1].url,
		'https://project.supabase.co/rest/v1/rpc/corex_request_run_restart'
	);
	assert.deepEqual(JSON.parse(requests[1].init.body), {
		p_run_id: 'run-1',
		p_owner_user_id: 'owner-1',
		p_request_id: '018f47a2-8391-7b1c-8f7a-f1d27670f063',
		p_from: { name: 'charge-card', count: 2, type: 'do' }
	});
	assert.equal(workflowCalls, 0);
});

test('persists a rollback intent without calling Workflow directly', async () => {
	const requests = [];
	let workflowCalls = 0;
	const responses = [
		Response.json({ id: 'owner-1' }),
		Response.json({ id: 'run-1', status: 'rolling_back', accepted: true })
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
				workflowCalls += 1;
			},
			async get() {
				workflowCalls += 1;
			}
		}
	});

	const result = await controlPlane.rollback({
		accessToken: 'user-token',
		runId: 'run-1',
		requestId: '018f47a2-8391-7b1c-8f7a-f1d27670f063'
	});

	assert.deepEqual(result, { id: 'run-1', status: 'rolling_back', accepted: true });
	assert.equal(
		requests[1].url,
		'https://project.supabase.co/rest/v1/rpc/corex_request_run_rollback'
	);
	assert.deepEqual(JSON.parse(requests[1].init.body), {
		p_run_id: 'run-1',
		p_owner_user_id: 'owner-1',
		p_request_id: '018f47a2-8391-7b1c-8f7a-f1d27670f063'
	});
	assert.equal(workflowCalls, 0);
});

test('archives a terminal run without calling Workflow directly', async () => {
	const requests = [];
	let workflowCalls = 0;
	const responses = [
		Response.json({ id: 'owner-1' }),
		Response.json({
			id: 'run-1',
			status: 'complete',
			archivedAt: '2026-09-01T05:00:00.000Z',
			accepted: true
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
			async create() {
				workflowCalls += 1;
			},
			async get() {
				workflowCalls += 1;
			}
		}
	});

	const result = await controlPlane.archive({
		accessToken: 'user-token',
		runId: 'run-1',
		requestId: '018f47a2-8391-7b1c-8f7a-f1d27670f063'
	});

	assert.deepEqual(result, {
		id: 'run-1',
		status: 'complete',
		archivedAt: '2026-09-01T05:00:00.000Z',
		accepted: true
	});
	assert.equal(
		requests[1].url,
		'https://project.supabase.co/rest/v1/rpc/corex_request_run_archive'
	);
	assert.deepEqual(JSON.parse(requests[1].init.body), {
		p_run_id: 'run-1',
		p_owner_user_id: 'owner-1',
		p_request_id: '018f47a2-8391-7b1c-8f7a-f1d27670f063'
	});
	assert.equal(workflowCalls, 0);
});
