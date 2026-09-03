export const PROCESS_FLOW_SCHEMA_VERSION = 1 as const;

export type ProcessFlowParticipant = {
	id: string;
	name: string;
	kind: 'actor' | 'process' | 'external';
	processId?: string;
};

export type ProcessFlowStage = {
	id: string;
	order: number;
	from: string;
	to: string;
	message: string;
	kind?: 'command' | 'event' | 'response';
	requires?: string[];
};

export type ProcessFlowDefinition = {
	schemaVersion: typeof PROCESS_FLOW_SCHEMA_VERSION;
	id: string;
	name: string;
	description: string;
	capabilities: Array<{ id: string; name: string }>;
	scenarios: ProcessFlowScenario[];
	participants: ProcessFlowParticipant[];
	stages: ProcessFlowStage[];
};

export type ProcessFlowScenario = {
	id: string;
	name: string;
	flowId: string;
	enabledCapabilities: string[];
};

export type ProcessFlowValidationIssue = {
	code:
		| 'duplicate-capability-id'
		| 'duplicate-participant-id'
		| 'duplicate-scenario-id'
		| 'duplicate-stage-id'
		| 'duplicate-stage-order'
		| 'invalid-process-participant'
		| 'unknown-capability'
		| 'unknown-flow'
		| 'unknown-participant';
	stageId?: string;
	participantId?: string;
	capabilityId?: string;
	scenarioId?: string;
};

export type ProcessFlowValidationResult =
	{ valid: true; issues: [] } | { valid: false; issues: ProcessFlowValidationIssue[] };

function duplicateValues(values: string[]): Set<string> {
	const seen = new Set<string>();
	const duplicates = new Set<string>();
	for (const value of values) {
		if (seen.has(value)) duplicates.add(value);
		seen.add(value);
	}
	return duplicates;
}

function isUuid(value: string | undefined): value is string {
	return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
		value ?? ''
	);
}

export function validateProcessFlowDefinition(
	definition: ProcessFlowDefinition
): ProcessFlowValidationResult {
	const issues: ProcessFlowValidationIssue[] = [];
	const capabilityIds = new Set(definition.capabilities.map((capability) => capability.id));
	const participantIds = new Set(definition.participants.map((participant) => participant.id));

	for (const capabilityId of duplicateValues(
		definition.capabilities.map((capability) => capability.id)
	)) {
		issues.push({ code: 'duplicate-capability-id', capabilityId });
	}
	for (const participantId of duplicateValues(
		definition.participants.map((participant) => participant.id)
	)) {
		issues.push({ code: 'duplicate-participant-id', participantId });
	}
	for (const scenarioId of duplicateValues(definition.scenarios.map((scenario) => scenario.id))) {
		issues.push({ code: 'duplicate-scenario-id', scenarioId });
	}
	for (const stageId of duplicateValues(definition.stages.map((stage) => stage.id))) {
		issues.push({ code: 'duplicate-stage-id', stageId });
	}
	for (const order of duplicateValues(definition.stages.map((stage) => String(stage.order)))) {
		const stage = definition.stages.find((candidate) => String(candidate.order) === order);
		issues.push({ code: 'duplicate-stage-order', stageId: stage?.id });
	}

	for (const participant of definition.participants) {
		if (participant.kind === 'process' && !isUuid(participant.processId)) {
			issues.push({ code: 'invalid-process-participant', participantId: participant.id });
		}
	}

	for (const stage of definition.stages) {
		for (const participantId of [stage.from, stage.to]) {
			if (!participantIds.has(participantId)) {
				issues.push({ code: 'unknown-participant', stageId: stage.id, participantId });
			}
		}
		for (const capabilityId of stage.requires ?? []) {
			if (!capabilityIds.has(capabilityId)) {
				issues.push({ code: 'unknown-capability', stageId: stage.id, capabilityId });
			}
		}
	}
	for (const scenario of definition.scenarios) {
		issues.push(...validateScenarioReferences(definition, scenario));
	}

	return issues.length === 0 ? { valid: true, issues: [] } : { valid: false, issues };
}

function validateScenarioReferences(
	definition: ProcessFlowDefinition,
	scenario: ProcessFlowScenario
): ProcessFlowValidationIssue[] {
	const issues: ProcessFlowValidationIssue[] = [];
	const capabilityIds = new Set(definition.capabilities.map((capability) => capability.id));
	for (const capabilityId of scenario.enabledCapabilities) {
		if (!capabilityIds.has(capabilityId)) {
			issues.push({ code: 'unknown-capability', capabilityId, scenarioId: scenario.id });
		}
	}
	if (scenario.flowId !== definition.id) {
		issues.push({ code: 'unknown-flow', participantId: scenario.flowId, scenarioId: scenario.id });
	}
	return issues;
}

export function validateProcessFlowScenario(
	definition: ProcessFlowDefinition,
	scenario: ProcessFlowScenario
): ProcessFlowValidationResult {
	const definitionValidation = validateProcessFlowDefinition(definition);
	if (!definitionValidation.valid) return definitionValidation;

	const issues = validateScenarioReferences(definition, scenario);

	return issues.length === 0 ? { valid: true, issues: [] } : { valid: false, issues };
}
