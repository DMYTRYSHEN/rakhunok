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
		const fetcher = vi.fn(async () => Response.json({ id: 'version-1', version: 3 }, { status: 201 }));
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
		const fetcher = vi.fn(async () => Response.json({ id: 'run-1', workflowInstanceId: 'workflow-1', status: 'queued' }, { status: 202 }));
		const gateway = createCorexCommandGateway(clientWithToken('access-token'), fetcher);

		await gateway.start('018f47a2-8391-7b1c-8f7a-f1d27670f099', { paymentId: 'pay-42' });

		expect(fetcher).toHaveBeenCalledWith(
			'/corex/api/processes/018f47a2-8391-7b1c-8f7a-f1d27670f099/runs',
			expect.objectContaining({ body: JSON.stringify({ input: { paymentId: 'pay-42' } }) })
		);
	});

	it('signals a run with only a typed event payload', async () => {
		const fetcher = vi.fn(async () => Response.json({ accepted: true }, { status: 202 }));
		const gateway = createCorexCommandGateway(clientWithToken('access-token'), fetcher);

		await expect(gateway.signal('run-1', 'payment-approved', { approved: true })).resolves.toEqual({ accepted: true });
		expect(fetcher).toHaveBeenCalledWith(
			'/corex/api/runs/run-1/events',
			expect.objectContaining({ body: JSON.stringify({ type: 'payment-approved', payload: { approved: true } }) })
		);
	});

	it('maps event conflicts without exposing Worker details', async () => {
		const fetcher = vi.fn(async () => Response.json({ error: 'provider detail' }, { status: 409 }));
		const gateway = createCorexCommandGateway(clientWithToken('access-token'), fetcher);

		await expect(gateway.signal('run-1', 'payment-approved', {})).rejects.toEqual(
			new CorexCommandError('run_not_accepting_event', 409)
		);
	});

	it('does not call the Worker without an active session', async () => {
		const fetcher = vi.fn();
		const gateway = createCorexCommandGateway(clientWithToken(null), fetcher);

		await expect(gateway.publish('process-1', 1)).rejects.toMatchObject({ code: 'authentication_required' });
		expect(fetcher).not.toHaveBeenCalled();
	});

	it('maps sanitized Worker failures without exposing response details', async () => {
		const fetcher = vi.fn(async () => Response.json({ error: 'Internal provider detail' }, { status: 503 }));
		const gateway = createCorexCommandGateway(clientWithToken('access-token'), fetcher);

		await expect(gateway.start('process-1', {})).rejects.toEqual(
			new CorexCommandError('runtime_unavailable', 503)
		);
	});
});