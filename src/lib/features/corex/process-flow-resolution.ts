import type { CorexProcess, CorexProcessVersion } from './corex-process-gateway';
import {
	validateProcessFlowDefinition,
	type ProcessFlowDefinition,
	type ProcessFlowParticipant,
	type ProcessFlowValidationIssue
} from './process-flow-definition';

export type ResolvedProcessFlowParticipant =
	| Exclude<ProcessFlowParticipant, { kind: 'process' }>
	| (ProcessFlowParticipant & {
			kind: 'process';
			processId: string;
			processVersionId: string;
			processVersion: number;
	  });

export type ResolvedProcessFlowDefinition = Omit<ProcessFlowDefinition, 'participants'> & {
	participants: ResolvedProcessFlowParticipant[];
};

export type ProcessFlowResolutionIssue =
	| ProcessFlowValidationIssue
	| {
			code: 'unknown-process' | 'unpublished-process' | 'missing-published-version';
			participantId: string;
			processId: string;
			processVersion?: number;
	  };

export type ProcessFlowResolutionResult =
	| { resolved: true; definition: ResolvedProcessFlowDefinition; issues: [] }
	| { resolved: false; issues: ProcessFlowResolutionIssue[] };

export function resolveProcessFlowDefinition(
	definition: ProcessFlowDefinition,
	ownerUserId: string,
	processes: readonly CorexProcess[],
	versions: readonly CorexProcessVersion[]
): ProcessFlowResolutionResult {
	const validation = validateProcessFlowDefinition(definition);
	if (!validation.valid) return { resolved: false, issues: validation.issues };

	const ownedProcesses = new Map(
		processes
			.filter((process) => process.ownerUserId === ownerUserId)
			.map((process) => [process.id, process])
	);
	const resolvedParticipants: ResolvedProcessFlowParticipant[] = [];
	const issues: ProcessFlowResolutionIssue[] = [];

	for (const participant of definition.participants) {
		if (participant.kind !== 'process') {
			resolvedParticipants.push(participant);
			continue;
		}

		const processId = participant.processId!;
		const process = ownedProcesses.get(processId);
		if (!process) {
			issues.push({ code: 'unknown-process', participantId: participant.id, processId });
			continue;
		}
		if (process.publishedVersion === null) {
			issues.push({ code: 'unpublished-process', participantId: participant.id, processId });
			continue;
		}

		const version = versions.find(
			(candidate) =>
				candidate.processId === processId && candidate.version === process.publishedVersion
		);
		if (!version) {
			issues.push({
				code: 'missing-published-version',
				participantId: participant.id,
				processId,
				processVersion: process.publishedVersion
			});
			continue;
		}

		resolvedParticipants.push({
			...participant,
			kind: 'process',
			processId,
			processVersionId: version.id,
			processVersion: version.version
		});
	}

	if (issues.length > 0) return { resolved: false, issues };
	return {
		resolved: true,
		definition: { ...definition, participants: resolvedParticipants },
		issues: []
	};
}
