import type { CorexRunEvent } from './corex-process-gateway';
import type { ProcessDefinition, ProcessEdge, ProcessNode } from './process-definition';

function escapeLabel(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;')
		.replaceAll('|', '&#124;')
		.replace(/[\r\n]+/g, ' ');
}

function nodeDeclaration(identifier: string, node: ProcessNode): string {
	const label = `${escapeLabel(node.name)} · ${escapeLabel(node.type)}`;
	if (node.type.startsWith('trigger-')) return `${identifier}(["${label}"])`;
	if (node.type === 'end-success' || node.type === 'end-failure') {
		return `${identifier}(["${label}"])`;
	}
	if (node.type === 'condition' || node.type === 'switch') return `${identifier}{"${label}"}`;
	return `${identifier}["${label}"]`;
}

function edgeLabel(edge: ProcessEdge): string | null {
	if (edge.compensation) return 'compensation';
	if (edge.when !== undefined) return edge.when ? 'true' : 'false';
	if (edge.case !== undefined) return edge.case;
	if (edge.loop !== undefined) return edge.loop;
	if (edge.loopBack !== undefined) return `back:${edge.loopBack}`;
	if (edge.parallel !== undefined) return edge.parallel;
	if (edge.try !== undefined) return edge.try;
	if (edge.function !== undefined) return edge.function;
	if (edge.block !== undefined) return edge.block;
	return null;
}

export function projectDefinitionMermaid(definition: ProcessDefinition): string {
	const nodes = [...definition.nodes].sort((left, right) => left.id.localeCompare(right.id));
	const identifiers = new Map(nodes.map((node, index) => [node.id, `node${index + 1}`]));
	const lines = ['flowchart LR'];

	if (nodes.length === 0) return [...lines, '\tempty["No process steps"]'].join('\n');

	for (const node of nodes) lines.push(`\t${nodeDeclaration(identifiers.get(node.id)!, node)}`);
	for (const edge of [...definition.edges].sort((left, right) => left.id.localeCompare(right.id))) {
		const source = identifiers.get(edge.source);
		const target = identifiers.get(edge.target);
		if (!source || !target) continue;
		const label = edgeLabel(edge);
		lines.push(`\t${source} ${label === null ? '-->' : `-->|${escapeLabel(label)}|`} ${target}`);
	}

	return lines.join('\n');
}

export function projectRunSequenceMermaid(events: CorexRunEvent[]): string {
	const lines = ['sequenceDiagram', '\tparticipant Corex'];
	const orderedEvents = [...events].sort(
		(left, right) =>
			left.executionGeneration - right.executionGeneration ||
			left.sequence - right.sequence ||
			left.id - right.id
	);

	if (orderedEvents.length === 0) {
		lines.push('\tNote over Corex: No run events');
		return lines.join('\n');
	}

	for (const event of orderedEvents) {
		const step = event.stepName ? ` · ${event.stepName}` : '';
		const attempt = event.attempt === null ? '' : ` · attempt ${event.attempt}`;
		lines.push(
			`\tCorex->>Corex: ${escapeLabel(`#${event.sequence} ${event.eventType}${step}${attempt}`)}`
		);
	}

	return lines.join('\n');
}
