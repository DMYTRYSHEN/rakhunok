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
			id: 'process-1', ownerUserId: 'user-1', slug: 'payment-callback', name: 'Draft', description: '',
			lifecycle: 'draft' as const, revision: 1, draftDefinition: createStarterProcessDefinition(),
			publishedVersion: null, updatedAt: '2026-08-30T12:00:00.000Z'
		};

		await expect(gateway.saveDraft(process, process.draftDefinition)).resolves.toMatchObject({ revision: 2 });
		expect(savedBuilder.update).toHaveBeenCalledWith({
			name: process.draftDefinition.name,
			description: process.draftDefinition.description,
			draft_definition: process.draftDefinition
		});
		expect(savedBuilder.eq).toHaveBeenNthCalledWith(1, 'id', 'process-1');
		expect(savedBuilder.eq).toHaveBeenNthCalledWith(2, 'owner_user_id', 'user-1');
		expect(savedBuilder.eq).toHaveBeenNthCalledWith(3, 'revision', 1);
		await expect(gateway.saveDraft(process, process.draftDefinition)).rejects.toBeInstanceOf(CorexDraftConflictError);
	});

	it('lists process runs newest first through the owner-scoped table', async () => {
		const builder = query({
			data: [{
				id: 'run-1', process_id: 'process-1', process_version_id: 'version-1',
				workflow_instance_id: 'workflow-1', status: 'running', input: { paymentId: 'pay-42' },
				output: null, error: null, started_at: '2026-08-30T12:01:00.000Z',
				finished_at: null, created_at: '2026-08-30T12:00:00.000Z'
			}],
			error: null
		});
		const client = { from: vi.fn(() => builder) } as unknown as SupabaseClient;

		const result = await createCorexProcessGateway(client).listRuns('process-1');

		expect(client.from).toHaveBeenCalledWith('corex_runs');
		expect(builder.eq).toHaveBeenCalledWith('process_id', 'process-1');
		expect(builder.order).toHaveBeenCalledWith('created_at', { ascending: false });
		expect(result[0]).toMatchObject({ id: 'run-1', processId: 'process-1', workflowInstanceId: 'workflow-1', status: 'running' });
	});

	it('lists run events in deterministic sequence order', async () => {
		const builder = query({
			data: [{
				id: 9, run_id: 'run-1', sequence: 2, event_type: 'step_completed', step_name: 'resolve',
				attempt: 1, payload: { status: 200 }, created_at: '2026-08-30T12:02:00.000Z'
			}],
			error: null
		});
		const client = { from: vi.fn(() => builder) } as unknown as SupabaseClient;

		const result = await createCorexProcessGateway(client).listRunEvents('run-1');

		expect(client.from).toHaveBeenCalledWith('corex_run_events');
		expect(builder.eq).toHaveBeenCalledWith('run_id', 'run-1');
		expect(builder.order).toHaveBeenCalledWith('sequence', { ascending: true });
		expect(result[0]).toMatchObject({ id: 9, runId: 'run-1', sequence: 2, eventType: 'step_completed', stepName: 'resolve' });
	});

	it('lists approval tasks assigned to the authenticated user', async () => {
		const builder = query({
			data: [{
				id: 'task-1', run_id: 'run-1', process_id: 'process-1', step_name: 'review-payment',
				status: 'pending', deadline_at: '2026-09-01T12:00:00.000Z', decision_comment: null,
				decided_at: null, created_at: '2026-08-31T12:00:00.000Z'
			}], error: null
		});
		const client = { from: vi.fn(() => builder) } as unknown as SupabaseClient;

		const result = await createCorexProcessGateway(client).listApprovalTasks('user-1');

		expect(client.from).toHaveBeenCalledWith('corex_approval_tasks');
		expect(builder.eq).toHaveBeenCalledWith('assignee_user_id', 'user-1');
		expect(result[0]).toMatchObject({ id: 'task-1', runId: 'run-1', status: 'pending' });
	});
});