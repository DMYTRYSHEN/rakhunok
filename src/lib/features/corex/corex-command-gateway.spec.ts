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
