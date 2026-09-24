import { describe, expect, it } from 'vitest';
import { demoFlowScenarios, flowScenarios } from './flow-scenarios';
import { terminalCashOrderCanvasScenario } from './terminal-cash-order-flow';

describe('terminal and cash desk Demo journey', () => {
	it('keeps the two Demo journeys first and separate from standard scenarios', () => {
		expect(demoFlowScenarios.map((scenario) => scenario.id)).toEqual([
			'merchant-payment-demo',
			'terminal-cash-order-demo'
		]);
		expect(flowScenarios.slice(0, 2)).toEqual(demoFlowScenarios);
		expect(demoFlowScenarios.every((scenario) => scenario.category === 'Demo journeys')).toBe(true);
	});

	it('requires authenticated, matched bank evidence before confirmation', () => {
		const scenario = terminalCashOrderCanvasScenario;
		const nodeIds = new Set(scenario.nodes.map((node) => node.id));
		expect(nodeIds.size).toBe(scenario.nodes.length);
		expect(scenario.nodes.every((node) => node.status === 'waiting' && !node.workflow)).toBe(true);
		for (const edge of scenario.edges) {
			expect(nodeIds.has(edge.source) && nodeIds.has(edge.target)).toBe(true);
		}
		expect(scenario.nodes.find((node) => node.id === 'reconcile')?.detail).toContain('short_id');
		expect(
			scenario.edges.filter((edge) => edge.target === 'confirm').map((edge) => edge.source)
		).toEqual(['reconcile']);
		for (const terminal of ['untrusted', 'review', 'paid']) {
			expect(scenario.edges.some((edge) => edge.source === terminal)).toBe(false);
		}
		expect(scenario.edges).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ source: 'authenticate', target: 'untrusted' }),
				expect.objectContaining({ source: 'reconcile', target: 'review' }),
				expect.objectContaining({ source: 'webhook-configured', target: 'paid' }),
				expect.objectContaining({ source: 'webhook-configured', target: 'notify' })
			])
		);
	});

	it('separates Dashboard point selection, cancellation and cash from proposed bank payment', () => {
		const scenario = terminalCashOrderCanvasScenario;
		const node = (id: string) => scenario.nodes.find((item) => item.id === id);
		expect(node('cash-draft')?.detail).toContain('local, terminal-specific draft');
		expect(node('persist')?.detail).toContain('terminal_id');
		expect(node('pos-actions')?.detail).toContain('another pending order');
		expect(node('pos-cancel')?.detail).toContain('No separate unassign action');
		expect(node('pos-cash')?.detail).toContain('CASH');
		expect(scenario.edges.filter((edge) => edge.source === 'pos-actions')).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ target: 'pos-cancel' }),
				expect.objectContaining({ target: 'pos-cash' }),
				expect.objectContaining({ target: 'link', label: 'proposed bank payment' })
			])
		);
		for (const id of ['pos-cancel', 'pos-cash']) {
			expect(scenario.edges.some((edge) => edge.source === id)).toBe(false);
		}
	});
});
