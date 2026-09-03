import {
	validateProcessFlowDefinition,
	validateProcessFlowScenario,
	type ProcessFlowDefinition,
	type ProcessFlowParticipant,
	type ProcessFlowScenario
} from './process-flow-definition';

function escapeSequenceText(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;')
		.replaceAll(':', '&#58;')
		.replace(/[\r\n]+/g, ' ');
}

function participantDeclaration(identifier: string, participant: ProcessFlowParticipant): string {
	const keyword = participant.kind === 'actor' ? 'actor' : 'participant';
	return `\t${keyword} ${identifier} as ${escapeSequenceText(participant.name)}`;
}

export function projectProcessFlowSequenceMermaid(
	definition: ProcessFlowDefinition,
	enabledCapabilities: Iterable<string> = []
): string {
	const validation = validateProcessFlowDefinition(definition);
	if (!validation.valid) throw new Error('Cannot project an invalid process flow definition.');

	const enabled = new Set(enabledCapabilities);
	const stages = [...definition.stages]
		.filter((stage) => (stage.requires ?? []).every((capability) => enabled.has(capability)))
		.sort((left, right) => left.order - right.order || left.id.localeCompare(right.id));
	const usedParticipantIds = new Set(stages.flatMap((stage) => [stage.from, stage.to]));
	const participants = definition.participants.filter((participant) =>
		usedParticipantIds.has(participant.id)
	);
	const identifiers = new Map(
		participants.map((participant, index) => [participant.id, `participant${index + 1}`])
	);
	const lines = ['sequenceDiagram'];

	if (stages.length === 0) return [...lines, '\tNote over Corex: No flow stages'].join('\n');

	for (const participant of participants) {
		lines.push(participantDeclaration(identifiers.get(participant.id)!, participant));
	}
	for (const stage of stages) {
		const source = identifiers.get(stage.from)!;
		const target = identifiers.get(stage.to)!;
		const arrow = stage.kind === 'response' ? '-->>' : '->>';
		lines.push(`\t${source}${arrow}${target}: ${escapeSequenceText(stage.message)}`);
	}

	return lines.join('\n');
}

export function projectProcessFlowScenarioMermaid(
	definition: ProcessFlowDefinition,
	scenario: ProcessFlowScenario
): string {
	if (!validateProcessFlowScenario(definition, scenario).valid) {
		throw new Error('Cannot project an invalid process flow scenario.');
	}
	return projectProcessFlowSequenceMermaid(definition, scenario.enabledCapabilities);
}
