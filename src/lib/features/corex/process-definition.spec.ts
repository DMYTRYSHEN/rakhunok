import { describe, expect, it } from 'vitest';
import {
	PROCESS_DEFINITION_SCHEMA_VERSION,
	createStarterProcessDefinition,
	type ProcessDefinition,
	validateProcessDefinition
} from './process-definition';
import { processDefinitionToFlowScenario } from './process-definition-adapter';
import { compileProcessDefinition } from './process-compiler';

function validDefinition(): ProcessDefinition {
	return {
		schemaVersion: PROCESS_DEFINITION_SCHEMA_VERSION,
		id: 'payment-callback',
		name: 'Payment callback',
		description: 'Accept and forward a verified payment callback.',
		revision: 1,
		lifecycle: 'draft',
		nodes: [
			{
				id: 'trigger',
				name: 'accept-callback',
				type: 'trigger-http',
				position: { x: 0, y: 0 },
				config: { method: 'POST', path: '/callbacks/payment' }
			},
			{
				id: 'forward',
				name: 'forward-callback',
				type: 'http-request',
				position: { x: 280, y: 0 },
				config: {
					method: 'POST',
					url: 'https://api.example.com/payments',
					timeoutMs: 30_000,
					retry: { limit: 3, backoff: 'exponential' },
					idempotencyKey: '$.paymentId'
				}
			},
			{
				id: 'success',
				name: 'return-success',
				type: 'end-success',
				position: { x: 560, y: 0 },
				config: { outputExpression: '$.forward.response' }
			}
		],
		edges: [
			{ id: 'trigger-forward', source: 'trigger', target: 'forward' },
			{ id: 'forward-success', source: 'forward', target: 'success' }
		]
	};
}

describe('validateProcessDefinition', () => {
	it('accepts the initial executable HTTP workflow subset', () => {
		expect(validateProcessDefinition(validDefinition())).toEqual({ valid: true, issues: [] });
	});

	it('rejects cycles and nodes that are unreachable from the trigger', () => {
		const definition = validDefinition();
		definition.nodes.push({
			id: 'orphan',
			name: 'orphan-action',
			type: 'http-request',
			position: { x: 280, y: 180 },
			config: {
				method: 'POST',
				url: 'https://api.example.com/orphan',
				timeoutMs: 10_000,
				retry: { limit: 0, backoff: 'constant' }
			}
		});
		definition.edges.push({ id: 'success-forward', source: 'success', target: 'forward' });

		const result = validateProcessDefinition(definition);
		expect(result.valid).toBe(false);
		expect(result.issues.map((issue) => issue.code)).toEqual(
			expect.arrayContaining(['cycle', 'terminal-has-output', 'unreachable-node'])
		);
	});

	it('rejects unsafe connector and retry configuration', () => {
		const definition = validDefinition();
		const action = definition.nodes[1];
		if (action.type !== 'http-request') throw new Error('Expected HTTP action fixture.');
		action.config.url = 'http://internal.example.com';
		action.config.timeoutMs = 1_800_001;
		action.config.retry.limit = 11;

		const result = validateProcessDefinition(definition);
		expect(result.valid).toBe(false);
		expect(result.issues.map((issue) => issue.code)).toEqual(
			expect.arrayContaining(['invalid-http-url', 'invalid-timeout', 'invalid-retry-limit'])
		);
	});

	it('rejects clearly non-public HTTP targets', () => {
		const definition = validDefinition();
		const action = definition.nodes[1];
		if (action.type !== 'http-request') throw new Error('Expected HTTP action fixture.');
		action.config.url = 'https://127.0.0.1/admin';

		const result = validateProcessDefinition(definition);
		expect(result.valid).toBe(false);
		expect(result.issues.map((issue) => issue.code)).toContain('invalid-http-host');
	});

	it('validates condition branches, durable waits, and safe transforms', () => {
		const definition = validDefinition();
		definition.nodes.splice(1, 1,
			{ id: 'transform', name: 'shape-payment', type: 'transform', position: { x: 220, y: 0 }, config: { mode: 'merge', mappings: { paymentId: '$.paymentId' } } },
			{ id: 'condition', name: 'is-large-payment', type: 'condition', position: { x: 440, y: 0 }, config: { path: '$.amount', operator: 'greater-than', value: 100 } },
			{ id: 'wait', name: 'brief-delay', type: 'wait', position: { x: 660, y: -100 }, config: { durationMs: 5_000 } }
		);
		definition.edges = [
			{ id: 'trigger-transform', source: 'trigger', target: 'transform' },
			{ id: 'transform-condition', source: 'transform', target: 'condition' },
			{ id: 'condition-wait', source: 'condition', target: 'wait', when: true },
			{ id: 'condition-success', source: 'condition', target: 'success', when: false },
			{ id: 'wait-success', source: 'wait', target: 'success' }
		];

		expect(validateProcessDefinition(definition)).toEqual({ valid: true, issues: [] });
		const scenario = processDefinitionToFlowScenario(definition);
		expect(scenario.nodes.map((node) => node.workflow?.type)).toEqual([
			'trigger-http', 'data-transform', 'if', 'step-sleep', 'end-success'
		]);
		expect(scenario.edges.find((edge) => edge.id === 'condition-wait')).toMatchObject({ label: 'true', tone: 'success' });
	});

	it('rejects malformed conditions, waits, and transforms', () => {
		const definition = validDefinition();
		definition.nodes.splice(1, 1,
			{ id: 'condition', name: 'invalid-condition', type: 'condition', position: { x: 220, y: 0 }, config: { path: 'input.amount', operator: 'equals' } },
			{ id: 'wait', name: 'invalid-wait', type: 'wait', position: { x: 440, y: 0 }, config: { durationMs: 0 } },
			{ id: 'transform', name: 'invalid-transform', type: 'transform', position: { x: 660, y: 0 }, config: { mode: 'merge', mappings: { 'bad key': 'input.value' } } }
		);
		definition.edges = [
			{ id: 'trigger-condition', source: 'trigger', target: 'condition' },
			{ id: 'condition-wait', source: 'condition', target: 'wait', when: true },
			{ id: 'wait-transform', source: 'wait', target: 'transform' },
			{ id: 'transform-success', source: 'transform', target: 'success' }
		];

		const result = validateProcessDefinition(definition);
		expect(result.valid).toBe(false);
		expect(result.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining(['invalid-condition', 'invalid-wait', 'invalid-transform']));
	});

	it('validates, renders, and compiles durable event waits', () => {
		const definition = validDefinition();
		definition.nodes.splice(1, 1, {
			id: 'approval', name: 'wait-for-approval', type: 'wait-event', position: { x: 280, y: 0 },
			config: { eventType: 'payment-approved', timeoutMs: 86_400_000, resultKey: 'approval' }
		});
		definition.edges = [
			{ id: 'trigger-approval', source: 'trigger', target: 'approval' },
			{ id: 'approval-success', source: 'approval', target: 'success' }
		];

		expect(validateProcessDefinition(definition)).toEqual({ valid: true, issues: [] });
		expect(processDefinitionToFlowScenario(definition).nodes[1]).toMatchObject({
			meta: 'payment-approved · 86400000 ms',
			workflow: { type: 'step-wait-for-event', eventType: 'payment-approved' }
		});
		const compiled = compileProcessDefinition(definition);
		expect(compiled.ok).toBe(true);
		if (!compiled.ok) return;
		expect(compiled.plan.nodes[0]).toMatchObject({
			type: 'wait-event',
			config: { eventType: 'payment-approved', timeoutMs: 86_400_000, resultKey: 'approval' },
			next: 'success'
		});

		const wait = definition.nodes[1];
		if (wait.type !== 'wait-event') throw new Error('Expected event wait fixture.');
		wait.config.eventType = 'unsafe event type';
		wait.config.timeoutMs = 0;
		expect(validateProcessDefinition(definition).issues.map((issue) => issue.code)).toContain('invalid-wait');
	});

	it('validates, renders, and compiles human approvals', () => {
		const definition = validDefinition();
		definition.nodes.splice(1, 1, {
			id: 'approval', name: 'review-payment', type: 'approval', position: { x: 280, y: 0 },
			config: { assigneeUserId: '018f47a2-8391-7b1c-8f7a-f1d27670f099', timeoutMs: 86_400_000, resultKey: 'approval' }
		});
		definition.edges = [
			{ id: 'trigger-approval', source: 'trigger', target: 'approval' },
			{ id: 'approval-success', source: 'approval', target: 'success' }
		];

		expect(validateProcessDefinition(definition)).toEqual({ valid: true, issues: [] });
		expect(processDefinitionToFlowScenario(definition).nodes[1]).toMatchObject({
			eyebrow: 'Human approval',
			workflow: { type: 'human-approval', eventType: 'corex-approval' }
		});
		const compiled = compileProcessDefinition(definition);
		expect(compiled.ok).toBe(true);
		if (!compiled.ok) return;
		expect(compiled.plan.nodes[0]).toMatchObject({
			type: 'approval', config: { assigneeUserId: '018f47a2-8391-7b1c-8f7a-f1d27670f099', timeoutMs: 86_400_000, resultKey: 'approval' }, next: 'success'
		});
	});

	it('compiles a validated linear definition into a deterministic execution plan', () => {
		const result = compileProcessDefinition(validDefinition());

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.plan.entryNodeId).toBe('forward');
		expect(result.plan.nodes.map((node) => node.name)).toEqual(['forward-callback', 'return-success']);
		expect(result.plan.nodes[0]).toMatchObject({ type: 'http-request', next: 'success' });
	});

	it('compiles explicit true and false condition transitions', () => {
		const definition = validDefinition();
		definition.nodes.splice(1, 1, {
			id: 'condition', name: 'is-large-payment', type: 'condition', position: { x: 280, y: 0 },
			config: { path: '$.amount', operator: 'greater-than', value: 100 }
		});
		definition.nodes.push({ id: 'alternate-success', name: 'return-alternate', type: 'end-success', position: { x: 560, y: 180 }, config: {} });
		definition.edges = [
			{ id: 'trigger-condition', source: 'trigger', target: 'condition' },
			{ id: 'condition-success', source: 'condition', target: 'success', when: true },
			{ id: 'condition-alternate', source: 'condition', target: 'alternate-success', when: false }
		];

		const result = compileProcessDefinition(definition);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.plan.nodes[0]).toMatchObject({ type: 'condition', whenTrue: 'success', whenFalse: 'alternate-success' });
	});

	it('refuses ambiguous branches until the runtime has an explicit branch node', () => {
		const definition = validDefinition();
		definition.nodes.push({
			id: 'alternate-success',
			name: 'return-alternate-success',
			type: 'end-success',
			position: { x: 560, y: 180 },
			config: {}
		});
		definition.edges.push({ id: 'forward-alternate', source: 'forward', target: 'alternate-success' });

		expect(compileProcessDefinition(definition)).toEqual({
			ok: false,
			errors: ['Step "forward-callback" must have exactly one outgoing connection.']
		});
	});

	it('renders a starter definition through the existing canvas contract', () => {
		const definition = createStarterProcessDefinition();
		const scenario = processDefinitionToFlowScenario(definition);

		expect(validateProcessDefinition(definition)).toEqual({ valid: true, issues: [] });
		expect(scenario.entrypoint).toBe('POST /callbacks/payment');
		expect(scenario.nodes.map((node) => node.workflow?.type)).toEqual([
			'trigger-http',
			'http-request',
			'end-success'
		]);
		expect(scenario.edges).toEqual(definition.edges);
	});
});