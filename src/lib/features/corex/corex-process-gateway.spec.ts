import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { createStarterProcessDefinition } from './process-definition';
import { CorexDraftConflictError, createCorexProcessGateway } from './corex-process-gateway';

function processRow() {
	return {
		id: 'process-1',
		owner_user_id: 'user-1',
		slug: 'payment-callback',
		name: 'Payment callback draft',
		description: 'Description',
		lifecycle: 'draft',
		revision: 2,
		draft_definition: createStarterProcessDefinition(),
		published_version: null,
		updated_at: '2026-08-30T12:00:00.000Z'
	};
}

function query(result: { data: unknown; error: unknown }) {
	const builder = {
		select: vi.fn(() => builder),
		insert: vi.fn(() => builder),
		update: vi.fn(() => builder),
		eq: vi.fn(() => builder),
		order: vi.fn(() => builder),
		single: vi.fn(async () => result),
		maybeSingle: vi.fn(async () => result),
		then: (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve)
	};
	return builder;
}

describe('Corex process gateway', () => {
	it('lists only the requested owner processes in updated order', async () => {
		const builder = query({ data: [processRow()], error: null });
		const client = { from: vi.fn(() => builder) } as unknown as SupabaseClient;

		const result = await createCorexProcessGateway(client).listProcesses('user-1');

		expect(builder.eq).toHaveBeenCalledWith('owner_user_id', 'user-1');
		expect(builder.order).toHaveBeenCalledWith('updated_at', { ascending: false });
		expect(result[0]).toMatchObject({ id: 'process-1', ownerUserId: 'user-1', revision: 2 });
	});

	it('creates a draft without privileged lifecycle or revision columns', async () => {
		const builder = query({ data: processRow(), error: null });
		const client = { from: vi.fn(() => builder) } as unknown as SupabaseClient;
		const definition = createStarterProcessDefinition();

		await createCorexProcessGateway(client).createProcess('user-1', 'payment-callback', definition);

		expect(builder.insert).toHaveBeenCalledWith({
			owner_user_id: 'user-1',
			slug: 'payment-callback',
			name: definition.name,
			description: definition.description,
			draft_definition: definition
		});
	});

	it('saves with the expected revision and maps revision conflicts', async () => {
		const savedBuilder = query({ data: processRow(), error: null });
		const conflictBuilder = query({ data: null, error: null });
		const from = vi.fn().mockReturnValueOnce(savedBuilder).mockReturnValueOnce(conflictBuilder);
		const gateway = createCorexProcessGateway({ from } as unknown as SupabaseClient);
		const process = {
			id: 'process-1',
			ownerUserId: 'user-1',
			slug: 'payment-callback',
			name: 'Draft',
			description: '',
			lifecycle: 'draft' as const,
			revision: 1,
			draftDefinition: createStarterProcessDefinition(),
			publishedVersion: null,
			updatedAt: '2026-08-30T12:00:00.000Z'
		};

		await expect(gateway.saveDraft(process, process.draftDefinition)).resolves.toMatchObject({
			revision: 2
		});
		expect(savedBuilder.update).toHaveBeenCalledWith({
			name: process.draftDefinition.name,
			description: process.draftDefinition.description,
			draft_definition: process.draftDefinition
		});
		expect(savedBuilder.eq).toHaveBeenNthCalledWith(1, 'id', 'process-1');
		expect(savedBuilder.eq).toHaveBeenNthCalledWith(2, 'owner_user_id', 'user-1');
		expect(savedBuilder.eq).toHaveBeenNthCalledWith(3, 'revision', 1);
		await expect(gateway.saveDraft(process, process.draftDefinition)).rejects.toBeInstanceOf(
			CorexDraftConflictError
		);
	});

	it('lists process runs newest first through the owner-scoped table', async () => {
		const builder = query({
			data: [
				{
					id: 'run-1',
					process_id: 'process-1',
					process_version_id: 'version-1',
					workflow_instance_id: 'workflow-1',
					parent_run_id: 'parent-run',
					parent_step_id: 'charge',
					depth: 2,
					execution_generation: 3,
					status: 'running',
					input: { paymentId: 'pay-42' },
					output: null,
					error: null,
					rollback_outcome: null,
					rollback_error: null,
					archived_at: '2026-09-01T05:00:00.000Z',
					started_at: '2026-08-30T12:01:00.000Z',
					finished_at: null,
					created_at: '2026-08-30T12:00:00.000Z'
				}
			],
			error: null
		});
		const client = { from: vi.fn(() => builder) } as unknown as SupabaseClient;

		const result = await createCorexProcessGateway(client).listRuns('process-1');

		expect(client.from).toHaveBeenCalledWith('corex_runs');
		expect(builder.eq).toHaveBeenCalledWith('process_id', 'process-1');
		expect(builder.order).toHaveBeenCalledWith('created_at', { ascending: false });
		expect(result[0]).toMatchObject({
			id: 'run-1',
			processId: 'process-1',
			workflowInstanceId: 'workflow-1',
			parentRunId: 'parent-run',
			parentStepId: 'charge',
			depth: 2,
			executionGeneration: 3,
			status: 'running',
			rollbackOutcome: null,
			rollbackError: null,
			archivedAt: '2026-09-01T05:00:00.000Z'
		});
	});

	it('lists run events in deterministic generation and sequence order', async () => {
		const builder = query({
			data: [
				{
					id: 9,
					run_id: 'run-1',
					execution_generation: 3,
					sequence: 2,
					event_type: 'step_completed',
					step_name: 'resolve',
					attempt: 1,
					payload: { status: 200 },
					created_at: '2026-08-30T12:02:00.000Z'
				}
			],
			error: null
		});
		const client = { from: vi.fn(() => builder) } as unknown as SupabaseClient;

		const result = await createCorexProcessGateway(client).listRunEvents('run-1');

		expect(client.from).toHaveBeenCalledWith('corex_run_events');
		expect(builder.eq).toHaveBeenCalledWith('run_id', 'run-1');
		expect(builder.order).toHaveBeenNthCalledWith(1, 'execution_generation', { ascending: true });
		expect(builder.order).toHaveBeenNthCalledWith(2, 'sequence', { ascending: true });
		expect(result[0]).toMatchObject({
			id: 9,
			runId: 'run-1',
			executionGeneration: 3,
			sequence: 2,
			eventType: 'step_completed',
			stepName: 'resolve'
		});
	});

	it('lists step attempts in deterministic execution order', async () => {
		const builder = query({
			data: [
				{
					run_id: 'run-1',
					execution_generation: 3,
					step_id: 'forward',
					visit: 2,
					durable_step_name: 'forward-payment [visit 2]',
					kind: 'compensation',
					attempt: 2,
					started_at: '2026-09-01T08:00:00.000Z',
					finished_at: '2026-09-01T08:00:01.000Z',
					outcome: 'complete',
					retry: { limit: 3, backoff: 'exponential', timeoutMs: 30_000 },
					output: {
						status: 202,
						contentType: 'application/json',
						bytes: 17,
						value: { accepted: true }
					},
					error: null
				},
				{
					run_id: 'run-1',
					execution_generation: 3,
					step_id: 'shape',
					visit: 0,
					durable_step_name: 'shape-result',
					kind: 'forward',
					attempt: 1,
					started_at: '2026-09-01T08:00:02.000Z',
					finished_at: '2026-09-01T08:00:02.010Z',
					outcome: 'complete',
					retry: { limit: 0, backoff: 'constant', timeoutMs: 0 },
					output: { type: 'object', bytes: 42, value: { normalizedId: 'pay-42' } },
					error: null
				},
				{
					run_id: 'run-1',
					execution_generation: 3,
					step_id: 'approval',
					visit: 0,
					durable_step_name: 'review-payment',
					kind: 'forward',
					attempt: 1,
					started_at: '2026-09-01T08:00:03.000Z',
					finished_at: '2026-09-01T08:00:04.000Z',
					outcome: 'complete',
					retry: { limit: 0, backoff: 'constant', timeoutMs: 86_400_000 },
					output: { type: 'redacted' },
					error: null
				}
			],
			error: null
		});
		const client = { from: vi.fn(() => builder) } as unknown as SupabaseClient;

		const result = await createCorexProcessGateway(client).listStepAttempts('run-1');

		expect(client.from).toHaveBeenCalledWith('corex_step_attempts');
		expect(builder.eq).toHaveBeenCalledWith('run_id', 'run-1');
		expect(builder.order).toHaveBeenNthCalledWith(1, 'execution_generation', { ascending: true });
		expect(builder.order).toHaveBeenNthCalledWith(2, 'started_at', { ascending: true });
		expect(builder.order).toHaveBeenNthCalledWith(3, 'attempt', { ascending: true });
		expect(result[0]).toEqual({
			runId: 'run-1',
			executionGeneration: 3,
			stepId: 'forward',
			visit: 2,
			durableStepName: 'forward-payment [visit 2]',
			kind: 'compensation',
			attempt: 2,
			startedAt: '2026-09-01T08:00:00.000Z',
			finishedAt: '2026-09-01T08:00:01.000Z',
			outcome: 'complete',
			retry: { limit: 3, backoff: 'exponential', timeoutMs: 30_000 },
			output: {
				status: 202,
				contentType: 'application/json',
				bytes: 17,
				value: { accepted: true }
			},
			error: null
		});
		expect(result[1]?.output).toEqual({
			type: 'object',
			bytes: 42,
			value: { normalizedId: 'pay-42' }
		});
		expect(result[2]?.output).toEqual({ type: 'redacted' });
	});

	it('lists approval tasks assigned to the authenticated user', async () => {
		const builder = query({
			data: [
				{
					id: 'task-1',
					run_id: 'run-1',
					process_id: 'process-1',
					execution_generation: 3,
					step_name: 'review-payment',
					status: 'pending',
					deadline_at: '2026-09-01T12:00:00.000Z',
					decision_comment: null,
					decided_at: null,
					created_at: '2026-08-31T12:00:00.000Z'
				}
			],
			error: null
		});
		const client = { from: vi.fn(() => builder) } as unknown as SupabaseClient;

		const result = await createCorexProcessGateway(client).listApprovalTasks('user-1');

		expect(client.from).toHaveBeenCalledWith('corex_approval_tasks');
		expect(builder.eq).toHaveBeenCalledWith('assignee_user_id', 'user-1');
		expect(result[0]).toMatchObject({
			id: 'task-1',
			runId: 'run-1',
			executionGeneration: 3,
			status: 'pending'
		});
	});
});
