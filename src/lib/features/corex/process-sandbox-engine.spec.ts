import { describe, expect, it } from 'vitest';
import type { ProcessDefinition } from './process-definition';
import {
	initSandbox,
	stepSandbox,
	injectSandboxEvent,
	restoreHistorySnapshot,
	retryFromNode,
	SANDBOX_PRESETS
} from './process-sandbox-engine';

describe('process-sandbox-engine', () => {
	const mockDefinition: ProcessDefinition = {
		schemaVersion: 1,
		id: 'proc-test-1',
		name: 'Тестовий платіжний процес',
		description: 'Тест симулятора',
		lifecycle: 'draft',
		revision: 1,
		nodes: [
			{
				id: 'node-trigger',
				name: 'Вхідний платіж',
				type: 'trigger-http',
				position: { x: 0, y: 0 },
				config: { method: 'POST', path: '/api/v1/orders' }
			},
			{
				id: 'node-condition',
				name: 'Перевірка суми',
				type: 'condition',
				position: { x: 200, y: 0 },
				config: { path: '$.amount', operator: 'greater-than', value: 1000 }
			},
			{
				id: 'node-wait',
				name: 'Очікування банку',
				type: 'wait-event',
				position: { x: 400, y: -100 },
				config: { eventType: 'payment_callback', timeoutMs: 60000, resultKey: 'bankResult' }
			},
			{
				id: 'node-end',
				name: 'Завершення',
				type: 'end-success',
				position: { x: 600, y: -100 },
				config: {}
			}
		],
		edges: [
			{ id: 'edge-1', source: 'node-trigger', target: 'node-condition' },
			{ id: 'edge-2', source: 'node-condition', target: 'node-wait', when: true },
			{ id: 'edge-3', source: 'node-wait', target: 'node-end' }
		]
	};

	it('initializes sandbox correctly with preset data', () => {
		const preset = SANDBOX_PRESETS[0];
		const state = initSandbox(mockDefinition, preset.payload);

		expect(state.status).toBe('running');
		expect(state.currentNodeId).toBe('node-trigger');
		expect(state.context.orderId).toBe('ORD-8921');
		expect(state.traversedNodeIds).toContain('node-trigger');
	});

	it('steps through trigger to condition node', () => {
		let state = initSandbox(mockDefinition, { amount: 2500 });
		state = stepSandbox(mockDefinition, state);

		expect(state.currentNodeId).toBe('node-condition');
		expect(state.history.length).toBe(1);
	});

	it('evaluates condition correctly and branches to wait-event', () => {
		let state = initSandbox(mockDefinition, { amount: 2500 });
		state = stepSandbox(mockDefinition, state); // from trigger to condition
		state = stepSandbox(mockDefinition, state); // evaluate condition

		expect(state.currentNodeId).toBe('node-wait');
		expect(state.history.at(-1)?.branchTaken).toBe('true');
	});

	it('pauses at wait-event and resumes with injectSandboxEvent', () => {
		let state = initSandbox(mockDefinition, { amount: 2500 });
		state = stepSandbox(mockDefinition, state); // trigger
		state = stepSandbox(mockDefinition, state); // condition -> wait
		state = stepSandbox(mockDefinition, state); // executes wait -> pauses

		expect(state.status).toBe('waiting_event');
		expect(state.waitingEvent?.eventType).toBe('payment_callback');

		// Inject mock callback from bank
		state = injectSandboxEvent(mockDefinition, state, { status: 'success', bankRef: 'MB-12345' });

		expect(state.status).toBe('running');
		expect(state.currentNodeId).toBe('node-end');
		expect((state.context.bankResult as Record<string, unknown>).bankRef).toBe('MB-12345');

		// Finish
		state = stepSandbox(mockDefinition, state);
		expect(state.status).toBe('complete');
	});

	it('restores historical snapshot accurately (time-travel)', () => {
		let state = initSandbox(mockDefinition, { amount: 2500 });
		state = stepSandbox(mockDefinition, state); // trigger executed, log 0
		state = stepSandbox(mockDefinition, state); // condition executed, log 1
		state = stepSandbox(mockDefinition, state); // wait-event reached

		expect(state.history.length).toBe(3);

		// Time travel back to step 0 (trigger)
		const timeTravelState = restoreHistorySnapshot(mockDefinition, state, 0);
		expect(timeTravelState.currentNodeId).toBe('node-trigger');
		expect(timeTravelState.traversedNodeIds).toEqual(['node-trigger']);
	});

	it('retries from a specific node with clean state', () => {
		let state = initSandbox(mockDefinition, { amount: 2500 });
		state = stepSandbox(mockDefinition, state); // trigger
		state = stepSandbox(mockDefinition, state); // condition

		// Retry from node-condition
		const retried = retryFromNode(mockDefinition, state, 'node-condition');
		expect(retried.status).toBe('running');
		expect(retried.currentNodeId).toBe('node-condition');
		expect(retried.history.at(-1)?.nodeType).toBe('retry-attempt');
	});
});

