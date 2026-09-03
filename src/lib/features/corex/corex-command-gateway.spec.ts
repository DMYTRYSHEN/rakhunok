import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { CorexCommandError, createCorexCommandGateway } from './corex-command-gateway';

function clientWithToken(accessToken: string | null): SupabaseClient {
	return {
		auth: {
			getSession: vi.fn(async () => ({
				data: { session: accessToken ? { access_token: accessToken } : null },
				error: null
			}))
		}
	} as unknown as SupabaseClient;
}

describe('Corex command gateway', () => {
	it('loads external step output with an authenticated GET and encoded identity', async () => {
		const fetcher = vi.fn(async () => Response.json({ approved: true }));
		const gateway = createCorexCommandGateway(clientWithToken('access-token'), fetcher);

		await expect(
			gateway.getStepAttemptOutput({
				runId: 'run/1',
				executionGeneration: 2,
				stepId: 'transform/a',
				visit: 3,
				attempt: 1
			})
		).resolves.toEqual({ approved: true });
		expect(fetcher).toHaveBeenCalledWith(
			'/corex/api/runs/run%2F1/attempts/2/transform%2Fa/3/1/output',
			{
				method: 'GET',
				headers: { Authorization: 'Bearer access-token' }
			}
		);
	});

	it('maps missing external step output without exposing Worker details', async () => {
		const fetcher = vi.fn(async () => Response.json({ error: 'provider detail' }, { status: 404 }));
		const gateway = createCorexCommandGateway(clientWithToken('access-token'), fetcher);

		await expect(
			gateway.getStepAttemptOutput({
				runId: 'run-1',
				executionGeneration: 1,
				stepId: 'transform-1',
				visit: 1,
				attempt: 1
			})
		).rejects.toEqual(new CorexCommandError('step_output_not_found', 404));
	});

	it('publishes the expected persisted revision with the current session token', async () => {
		const fetcher = vi.fn(async () =>
			Response.json({ id: 'version-1', version: 3 }, { status: 201 })
		);
		const gateway = createCorexCommandGateway(clientWithToken('access-token'), fetcher);

		await expect(gateway.publish('018f47a2-8391-7b1c-8f7a-f1d27670f099', 7)).resolves.toEqual({
			id: 'version-1',
			version: 3
		});
		expect(fetcher).toHaveBeenCalledWith(
			'/corex/api/processes/018f47a2-8391-7b1c-8f7a-f1d27670f099/publish',
			expect.objectContaining({
				method: 'POST',
				body: JSON.stringify({ expectedRevision: 7 }),
				headers: expect.objectContaining({ Authorization: 'Bearer access-token' })
			})
		);
	});

	it('publishes against an explicit environment target', async () => {
		const fetcher = vi.fn(async () =>
			Response.json({ id: 'version-1', version: 3 }, { status: 201 })
		);
		const gateway = createCorexCommandGateway(clientWithToken('access-token'), fetcher);

		await gateway.publish('process-1', 7, {
			environmentId: '018f47a2-8391-7b1c-8f7a-f1d27670f062',
			routeNamespace: 'production'
		});

		expect(fetcher).toHaveBeenCalledWith(
			'/corex/api/processes/process-1/publish',
			expect.objectContaining({
				body: JSON.stringify({
					expectedRevision: 7,
					environmentId: '018f47a2-8391-7b1c-8f7a-f1d27670f062',
					routeNamespace: 'production'
				})
			})
		);
	});

	it('configures a domain target through the authenticated Worker endpoint', async () => {
		const configured = {
			environmentId: '018f47a2-8391-7b1c-8f7a-f1d27670f062',
			environmentKey: 'production',
			routeNamespace: 'public',
			domainTargetId: '018f47a2-8391-7b1c-8f7a-f1d27670f063',
			hostname: 'api.example.com',
			verificationStatus: 'pending'
		};
		const fetcher = vi.fn(async () => Response.json(configured));
		const gateway = createCorexCommandGateway(clientWithToken('access-token'), fetcher);

		await expect(
			gateway.configureDomainTarget({
				environmentKey: 'production',
				routeNamespace: 'public',
				hostname: 'api.example.com'
			})
		).resolves.toEqual(configured);
		expect(fetcher).toHaveBeenCalledWith(
			'/corex/api/domain-target',
			expect.objectContaining({
				body: JSON.stringify({
					environmentKey: 'production',
					routeNamespace: 'public',
					hostname: 'api.example.com'
				})
			})
		);
	});

	it('starts a run with input only', async () => {
		const fetcher = vi.fn(async () =>
			Response.json(
				{ id: 'run-1', workflowInstanceId: 'workflow-1', status: 'queued' },
				{ status: 202 }
			)
		);
		const gateway = createCorexCommandGateway(clientWithToken('access-token'), fetcher);

		await gateway.start('018f47a2-8391-7b1c-8f7a-f1d27670f099', { paymentId: 'pay-42' });

		expect(fetcher).toHaveBeenCalledWith(
			'/corex/api/processes/018f47a2-8391-7b1c-8f7a-f1d27670f099/runs',
			expect.objectContaining({ body: JSON.stringify({ input: { paymentId: 'pay-42' } }) })
		);

		await gateway.start(
			'018f47a2-8391-7b1c-8f7a-f1d27670f099',
			{ paymentId: 'pay-43' },
			{
				instanceId: '018f47a2-8391-7b1c-8f7a-f1d27670f062',
				locationHint: 'weur'
			}
		);
		expect(fetcher).toHaveBeenLastCalledWith(
			'/corex/api/processes/018f47a2-8391-7b1c-8f7a-f1d27670f099/runs',
			expect.objectContaining({
				body: JSON.stringify({
					input: { paymentId: 'pay-43' },
					instanceId: '018f47a2-8391-7b1c-8f7a-f1d27670f062',
					locationHint: 'weur'
				})
			})
		);
	});

	it('signals a run with a stable caller event ID and typed payload', async () => {
		const fetcher = vi.fn(async () => Response.json({ accepted: true }, { status: 202 }));
		const gateway = createCorexCommandGateway(
			clientWithToken('access-token'),
			fetcher,
			() => '018f47a2-8391-7b1c-8f7a-f1d27670f064'
		);

		await expect(
			gateway.signalExternal('run-1', 'payment-approved', { approved: true })
		).resolves.toEqual({ accepted: true });
		expect(fetcher).toHaveBeenCalledWith(
			'/corex/api/runs/run-1/events',
			expect.objectContaining({
				body: JSON.stringify({
					eventId: '018f47a2-8391-7b1c-8f7a-f1d27670f064',
					type: 'payment-approved',
					payload: { approved: true }
				})
			})
		);
	});

	it('decides approvals without a caller event ID', async () => {
		const fetcher = vi.fn(async () => Response.json({ accepted: true }, { status: 202 }));
		const gateway = createCorexCommandGateway(clientWithToken('access-token'), fetcher);

		await gateway.decideApproval('run-1', { decision: 'approved', taskId: 'task-1' });

		expect(fetcher).toHaveBeenCalledWith(
			'/corex/api/runs/run-1/events',
			expect.objectContaining({
				body: JSON.stringify({
					type: 'corex-approval',
					payload: { decision: 'approved', taskId: 'task-1' }
				})
			})
		);
	});

	it('cancels a run with only a stable request ID', async () => {
		const fetcher = vi.fn(async () =>
			Response.json({ id: 'run-1', status: 'terminated', accepted: true }, { status: 202 })
		);
		const gateway = createCorexCommandGateway(clientWithToken('access-token'), fetcher);

		await expect(gateway.cancel('run-1', '018f47a2-8391-7b1c-8f7a-f1d27670f064')).resolves.toEqual({
			id: 'run-1',
			status: 'terminated',
			accepted: true
		});
		expect(fetcher).toHaveBeenCalledWith(
			'/corex/api/runs/run-1/cancel',
			expect.objectContaining({
				body: JSON.stringify({ requestId: '018f47a2-8391-7b1c-8f7a-f1d27670f064' })
			})
		);
	});

	it.each(['pause', 'resume'] as const)(
		'%ss a run with only a stable request ID',
		async (action) => {
			const fetcher = vi.fn(async () =>
				Response.json(
					{
						id: 'run-1',
						status: action === 'pause' ? 'waiting_for_pause' : 'paused',
						accepted: true
					},
					{ status: 202 }
				)
			);
			const gateway = createCorexCommandGateway(clientWithToken('access-token'), fetcher);
			const requestId = '018f47a2-8391-7b1c-8f7a-f1d27670f064';

			await gateway[action]('run-1', requestId);

			expect(fetcher).toHaveBeenCalledWith(
				`/corex/api/runs/run-1/${action}`,
				expect.objectContaining({ body: JSON.stringify({ requestId }) })
			);
		}
	);

	it('restarts a run from an optional exact durable step', async () => {
		const fetcher = vi.fn(async () =>
			Response.json(
				{ id: 'run-1', status: 'queued', executionGeneration: 2, accepted: true },
				{ status: 202 }
			)
		);
		const gateway = createCorexCommandGateway(clientWithToken('access-token'), fetcher);
		const requestId = '018f47a2-8391-7b1c-8f7a-f1d27670f064';

		await expect(
			gateway.restart('run-1', requestId, {
				name: 'charge-card',
				count: 2,
				type: 'do'
			})
		).resolves.toMatchObject({ executionGeneration: 2, accepted: true });
		expect(fetcher).toHaveBeenCalledWith(
			'/corex/api/runs/run-1/restart',
			expect.objectContaining({
				body: JSON.stringify({
					requestId,
					from: { name: 'charge-card', count: 2, type: 'do' }
				})
			})
		);
	});

	it('rolls back a run with only a stable request ID', async () => {
		const fetcher = vi.fn(async () =>
			Response.json({ id: 'run-1', status: 'rolling_back', accepted: true }, { status: 202 })
		);
		const gateway = createCorexCommandGateway(clientWithToken('access-token'), fetcher);
		const requestId = '018f47a2-8391-7b1c-8f7a-f1d27670f064';

		await expect(gateway.rollback('run-1', requestId)).resolves.toEqual({
			id: 'run-1',
			status: 'rolling_back',
			accepted: true
		});
		expect(fetcher).toHaveBeenCalledWith(
			'/corex/api/runs/run-1/rollback',
			expect.objectContaining({ body: JSON.stringify({ requestId }) })
		);
	});

	it('archives a terminal run with only a stable request ID', async () => {
		const fetcher = vi.fn(async () =>
			Response.json(
				{
					id: 'run-1',
					status: 'complete',
					archivedAt: '2026-09-01T05:00:00.000Z',
					accepted: true
				},
				{ status: 202 }
			)
		);
		const gateway = createCorexCommandGateway(clientWithToken('access-token'), fetcher);
		const requestId = '018f47a2-8391-7b1c-8f7a-f1d27670f064';

		await expect(gateway.archive('run-1', requestId)).resolves.toMatchObject({
			archivedAt: '2026-09-01T05:00:00.000Z',
			accepted: true
		});
		expect(fetcher).toHaveBeenCalledWith(
			'/corex/api/runs/run-1/archive',
			expect.objectContaining({ body: JSON.stringify({ requestId }) })
		);
	});

	it('retires a process with only a stable request ID', async () => {
		const fetcher = vi.fn(async () =>
			Response.json(
				{
					id: 'process-1',
					lifecycle: 'retired',
					retiredAt: '2026-09-03T08:00:00.000Z',
					accepted: true
				},
				{ status: 202 }
			)
		);
		const gateway = createCorexCommandGateway(clientWithToken('access-token'), fetcher);
		const requestId = '018f47a2-8391-7b1c-8f7a-f1d27670f063';

		await expect(gateway.retireProcess('process-1', requestId)).resolves.toMatchObject({
			id: 'process-1',
			lifecycle: 'retired',
			accepted: true
		});
		expect(fetcher).toHaveBeenCalledWith(
			'/corex/api/processes/process-1/retire',
			expect.objectContaining({ body: JSON.stringify({ requestId }) })
		);
	});

	it('submits a bounded operation through the authenticated Worker endpoint', async () => {
		const response = { id: 'operation-1', status: 'pending', itemCount: 1 };
		const fetcher = vi.fn(async () => Response.json(response, { status: 202 }));
		const gateway = createCorexCommandGateway(clientWithToken('access-token'), fetcher);
		const operation = {
			requestId: '018f47a2-8391-7b1c-8f7a-f1d27670f061',
			kind: 'workflow_delete' as const,
			items: [{ targetId: '018f47a2-8391-7b1c-8f7a-f1d27670f062' }]
		};

		await expect(gateway.submitOperation(operation)).resolves.toEqual(response);
		expect(fetcher).toHaveBeenCalledWith(
			'/corex/api/operations',
			expect.objectContaining({
				method: 'POST',
				body: JSON.stringify(operation),
				headers: expect.objectContaining({ Authorization: 'Bearer access-token' })
			})
		);
	});

	it('loads operation status through an authenticated encoded path', async () => {
		const operation = {
			id: 'operation/1',
			kind: 'workflow_delete',
			status: 'processing',
			itemCount: 1,
			completedCount: 0,
			failedCount: 0,
			createdAt: '2026-09-03T10:00:00Z',
			startedAt: null,
			completedAt: null,
			items: []
		};
		const fetcher = vi.fn(async () => Response.json(operation));
		const gateway = createCorexCommandGateway(clientWithToken('access-token'), fetcher);

		await expect(gateway.getOperation('operation/1')).resolves.toEqual(operation);
		expect(fetcher).toHaveBeenCalledWith('/corex/api/operations/operation%2F1', {
			method: 'GET',
			headers: { Authorization: 'Bearer access-token' }
		});
	});

	it('requests privileged process deletion with only a stable request ID', async () => {
		const response = { id: 'operation-1', status: 'pending', itemCount: 3 };
		const fetcher = vi.fn(async () => Response.json(response, { status: 202 }));
		const gateway = createCorexCommandGateway(clientWithToken('access-token'), fetcher);
		const requestId = '018f47a2-8391-7b1c-8f7a-f1d27670f061';

		await expect(gateway.deleteProcess('process/1', requestId)).resolves.toEqual(response);
		expect(fetcher).toHaveBeenCalledWith(
			'/corex/api/processes/process%2F1/delete',
			expect.objectContaining({ body: JSON.stringify({ requestId }) })
		);
	});

	it('maps event conflicts without exposing Worker details', async () => {
		const fetcher = vi.fn(async () => Response.json({ error: 'provider detail' }, { status: 409 }));
		const gateway = createCorexCommandGateway(clientWithToken('access-token'), fetcher);

		await expect(gateway.signalExternal('run-1', 'payment-approved', {})).rejects.toEqual(
			new CorexCommandError('run_not_accepting_event', 409)
		);
	});

	it('does not call the Worker without an active session', async () => {
		const fetcher = vi.fn();
		const gateway = createCorexCommandGateway(clientWithToken(null), fetcher);

		await expect(gateway.publish('process-1', 1)).rejects.toMatchObject({
			code: 'authentication_required'
		});
		expect(fetcher).not.toHaveBeenCalled();
	});

	it('maps sanitized Worker failures without exposing response details', async () => {
		const fetcher = vi.fn(async () =>
			Response.json({ error: 'Internal provider detail' }, { status: 503 })
		);
		const gateway = createCorexCommandGateway(clientWithToken('access-token'), fetcher);

		await expect(gateway.start('process-1', {})).rejects.toEqual(
			new CorexCommandError('runtime_unavailable', 503)
		);
	});
});
