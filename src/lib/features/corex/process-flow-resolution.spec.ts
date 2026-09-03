import { describe, expect, it } from 'vitest';
import type { CorexProcess, CorexProcessVersion } from './corex-process-gateway';
import { merchantPaymentFlow } from './merchant-payment-flow';
import { createStarterProcessDefinition } from './process-definition';
import { resolveProcessFlowDefinition } from './process-flow-resolution';

const ownerUserId = 'owner-1';

function process(id: string, publishedVersion: number | null = 1): CorexProcess {
	return {
		id,
		ownerUserId,
		slug: id,
		name: id,
		description: '',
		lifecycle: publishedVersion === null ? 'draft' : 'published',
		revision: 1,
		draftDefinition: createStarterProcessDefinition(),
		publishedVersion,
		updatedAt: '2026-09-03T00:00:00.000Z'
	};
}

function version(processId: string, number = 1): CorexProcessVersion {
	return {
		id: `${processId}-version-${number}`,
		processId,
		version: number,
		definition: createStarterProcessDefinition(),
		definitionSha256: 'sha256',
		publishedAt: '2026-09-03T00:00:00.000Z'
	};
}

const processIds = merchantPaymentFlow.participants.flatMap((participant) =>
	participant.kind === 'process' ? [participant.processId!] : []
);

describe('process flow resolution', () => {
	it('pins every process participant to its exact published version', () => {
		const result = resolveProcessFlowDefinition(
			merchantPaymentFlow,
			ownerUserId,
			processIds.map((id) => process(id)),
			processIds.map((id) => version(id))
		);

		expect(result.resolved).toBe(true);
		if (!result.resolved) return;
		const resolvedProcesses = result.definition.participants.filter(
			(participant) => participant.kind === 'process'
		);
		expect(resolvedProcesses).toHaveLength(processIds.length);
		expect(resolvedProcesses[0]).toMatchObject({
			processId: processIds[0],
			processVersionId: `${processIds[0]}-version-1`,
			processVersion: 1
		});
	});

	it('rejects unknown, cross-owner, unpublished, and missing version references', () => {
		const processes = processIds.slice(1).map((id) => process(id));
		processes[0] = { ...processes[0], ownerUserId: 'another-owner' };
		processes[1] = process(processIds[2], null);

		const result = resolveProcessFlowDefinition(
			merchantPaymentFlow,
			ownerUserId,
			processes,
			processIds.filter((id) => id !== processIds[3]).map((id) => version(id))
		);

		expect(result).toMatchObject({
			resolved: false,
			issues: expect.arrayContaining([
				{ code: 'unknown-process', participantId: 'onboarding', processId: processIds[0] },
				{ code: 'unknown-process', participantId: 'invoice', processId: processIds[1] },
				{ code: 'unpublished-process', participantId: 'delivery', processId: processIds[2] },
				{
					code: 'missing-published-version',
					participantId: 'loyalty',
					processId: processIds[3],
					processVersion: 1
				}
			])
		});
	});
});
