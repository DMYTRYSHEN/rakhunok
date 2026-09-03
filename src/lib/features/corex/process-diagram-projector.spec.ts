import { describe, expect, it } from 'vitest';
import type { CorexRunEvent } from './corex-process-gateway';
import { projectDefinitionMermaid, projectRunSequenceMermaid } from './process-diagram-projector';
import { createStarterProcessDefinition } from './process-definition';

function runEvent(
	id: number,
	sequence: number,
	eventType: string,
	stepName: string | null = null
): CorexRunEvent {
	return {
		id,
		runId: 'run-1',
		executionGeneration: 1,
		sequence,
		eventType,
		stepName,
		attempt: null,
		payload: {},
		createdAt: '2026-09-03T12:00:00.000Z'
	};
}

describe('process diagram projector', () => {
	it('projects topology deterministically with branch labels', () => {
		const definition = createStarterProcessDefinition();
		definition.edges = definition.edges.map((edge, index) => ({
			...edge,
			when: index === 0
		}));
		const projected = projectDefinitionMermaid(definition);
		const reordered = projectDefinitionMermaid({
			...definition,
			nodes: [...definition.nodes].reverse(),
			edges: [...definition.edges].reverse()
		});

		expect(reordered).toBe(projected);
		expect(projected).toContain('flowchart LR');
		expect(projected).toMatch(/-->(?:\|true\|).*node\d+/);
		expect(projected).toMatch(/-->(?:\|false\|).*node\d+/);
	});

	it('escapes labels and never exposes definition IDs as Mermaid identifiers', () => {
		const definition = createStarterProcessDefinition();
		definition.nodes[0].id = 'unsafe-id"]\nclick node2 callback';
		definition.nodes[0].name = 'Start | <script>"';
		definition.edges[0].source = definition.nodes[0].id;

		const projected = projectDefinitionMermaid(definition);

		expect(projected).toContain('Start &#124; &lt;script&gt;&quot;');
		expect(projected).not.toContain('<br/>');
		expect(projected).not.toContain('click node2 callback');
		expect(projected).not.toContain('<script>');
	});

	it('projects run events in generation and sequence order', () => {
		const projected = projectRunSequenceMermaid([
			runEvent(2, 2, 'step_completed', 'Send | receipt'),
			runEvent(1, 1, 'step_started', 'Send\nreceipt')
		]);

		expect(projected).toBe(
			[
				'sequenceDiagram',
				'\tparticipant Corex',
				'\tCorex->>Corex: #1 step_started · Send receipt',
				'\tCorex->>Corex: #2 step_completed · Send &#124; receipt'
			].join('\n')
		);
	});

	it('projects explicit empty states', () => {
		const definition = createStarterProcessDefinition();
		definition.nodes = [];
		definition.edges = [];

		expect(projectDefinitionMermaid(definition)).toContain('No process steps');
		expect(projectRunSequenceMermaid([])).toContain('No run events');
	});
});
