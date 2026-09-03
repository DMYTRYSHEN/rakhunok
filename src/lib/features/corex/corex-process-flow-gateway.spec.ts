import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { merchantPaymentFlow } from './merchant-payment-flow';
import {
	CorexProcessFlowDraftConflictError,
	createCorexProcessFlowGateway
} from './corex-process-flow-gateway';

function flowRow() {
	return {
		id: 'flow-1',
		owner_user_id: 'user-1',
		slug: 'merchant-payment',
		name: merchantPaymentFlow.name,
		description: merchantPaymentFlow.description,
		lifecycle: 'draft',
		revision: 2,
		draft_definition: merchantPaymentFlow,
		published_version: null,
		updated_at: '2026-09-03T12:00:00.000Z'
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

describe('Corex process Flow gateway', () => {
	it('creates and lists owner-scoped authored Flow drafts', async () => {
		const createBuilder = query({ data: flowRow(), error: null });
		const listBuilder = query({ data: [flowRow()], error: null });
		const from = vi.fn().mockReturnValueOnce(createBuilder).mockReturnValueOnce(listBuilder);
		const gateway = createCorexProcessFlowGateway({ from } as unknown as SupabaseClient);

		const created = await gateway.createFlow('user-1', 'merchant-payment', merchantPaymentFlow);
		const listed = await gateway.listFlows('user-1');

		expect(createBuilder.insert).toHaveBeenCalledWith({
			owner_user_id: 'user-1',
			slug: 'merchant-payment',
			name: merchantPaymentFlow.name,
			description: merchantPaymentFlow.description,
			draft_definition: merchantPaymentFlow
		});
		expect(listBuilder.eq).toHaveBeenCalledWith('owner_user_id', 'user-1');
		expect(created).toMatchObject({ id: 'flow-1', ownerUserId: 'user-1', revision: 2 });
		expect(listed).toHaveLength(1);
	});

	it('saves with optimistic revision and maps conflicts', async () => {
		const savedBuilder = query({ data: flowRow(), error: null });
		const conflictBuilder = query({ data: null, error: null });
		const from = vi.fn().mockReturnValueOnce(savedBuilder).mockReturnValueOnce(conflictBuilder);
		const gateway = createCorexProcessFlowGateway({ from } as unknown as SupabaseClient);
		const flow = {
			id: 'flow-1',
			ownerUserId: 'user-1',
			slug: 'merchant-payment',
			name: merchantPaymentFlow.name,
			description: merchantPaymentFlow.description,
			lifecycle: 'draft' as const,
			revision: 1,
			draftDefinition: merchantPaymentFlow,
			publishedVersion: null,
			updatedAt: '2026-09-03T12:00:00.000Z'
		};

		await expect(gateway.saveDraft(flow, merchantPaymentFlow)).resolves.toMatchObject({
			revision: 2
		});
		expect(savedBuilder.eq).toHaveBeenNthCalledWith(1, 'id', 'flow-1');
		expect(savedBuilder.eq).toHaveBeenNthCalledWith(2, 'owner_user_id', 'user-1');
		expect(savedBuilder.eq).toHaveBeenNthCalledWith(3, 'revision', 1);
		await expect(gateway.saveDraft(flow, merchantPaymentFlow)).rejects.toBeInstanceOf(
			CorexProcessFlowDraftConflictError
		);
	});

	it('maps immutable resolved version history', async () => {
		const resolvedDefinition = {
			...merchantPaymentFlow,
			participants: merchantPaymentFlow.participants.map((participant) =>
				participant.kind === 'process'
					? { ...participant, processVersionId: `version-${participant.id}`, processVersion: 1 }
					: participant
			)
		};
		const builder = query({
			data: [
				{
					id: 'flow-version-1',
					flow_id: 'flow-1',
					version: 1,
					resolved_definition: resolvedDefinition,
					definition_sha256: 'a'.repeat(64),
					published_at: '2026-09-03T12:30:00.000Z'
				}
			],
			error: null
		});
		const client = { from: vi.fn(() => builder) } as unknown as SupabaseClient;

		const versions = await createCorexProcessFlowGateway(client).listVersions('flow-1', 'user-1');

		expect(builder.eq).toHaveBeenNthCalledWith(1, 'flow_id', 'flow-1');
		expect(builder.eq).toHaveBeenNthCalledWith(2, 'owner_user_id', 'user-1');
		expect(versions[0]).toMatchObject({
			id: 'flow-version-1',
			flowId: 'flow-1',
			version: 1,
			definitionSha256: 'a'.repeat(64),
			resolvedDefinition
		});
	});

	it('reads owner-scoped Flow run correlation without exposing mutation commands', async () => {
		const runBuilder = query({
			data: [
				{
					id: 'flow-run-1',
					flow_version_id: 'flow-version-1',
					flow_id: 'flow-1',
					owner_user_id: 'user-1',
					request_id: 'request-1',
					scenario_id: 'payment-basic',
					started_at: '2026-09-03T13:00:00.000Z'
				}
			],
			error: null
		});
		const memberBuilder = query({
			data: [
				{
					flow_run_id: 'flow-run-1',
					run_id: 'run-1',
					owner_user_id: 'user-1',
					participant_id: 'payment',
					linked_at: '2026-09-03T13:01:00.000Z'
				}
			],
			error: null
		});
		const from = vi.fn().mockReturnValueOnce(runBuilder).mockReturnValueOnce(memberBuilder);
		const gateway = createCorexProcessFlowGateway({ from } as unknown as SupabaseClient);

		await expect(gateway.listFlowRuns('flow-1', 'user-1')).resolves.toEqual([
			expect.objectContaining({ id: 'flow-run-1', scenarioId: 'payment-basic' })
		]);
		await expect(gateway.listFlowRunMembers('flow-run-1', 'user-1')).resolves.toEqual([
			expect.objectContaining({ runId: 'run-1', participantId: 'payment' })
		]);
		expect(runBuilder.eq).toHaveBeenNthCalledWith(1, 'flow_id', 'flow-1');
		expect(runBuilder.eq).toHaveBeenNthCalledWith(2, 'owner_user_id', 'user-1');
		expect(memberBuilder.eq).toHaveBeenNthCalledWith(1, 'flow_run_id', 'flow-run-1');
		expect(memberBuilder.eq).toHaveBeenNthCalledWith(2, 'owner_user_id', 'user-1');
		expect(gateway).not.toHaveProperty('startFlowRun');
		expect(gateway).not.toHaveProperty('linkFlowRun');
	});
});
