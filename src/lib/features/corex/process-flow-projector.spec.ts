import { describe, expect, it } from 'vitest';
import {
	merchantPaymentCanvasScenario,
	merchantPaymentFlow,
	merchantPaymentScenarios
} from './merchant-payment-flow';
import { flowScenarios } from './flow-scenarios';
import {
	validateProcessFlowDefinition,
	validateProcessFlowScenario
} from './process-flow-definition';
import {
	projectProcessFlowScenarioMermaid,
	projectProcessFlowSequenceMermaid
} from './process-flow-projector';

describe('process flow sequence projector', () => {
	it('registers the merchant Demo on the main canvas with guarded payment and independent channels', () => {
		const scenario = flowScenarios.find((entry) => entry.id === 'merchant-payment-demo');
		expect(scenario).toBe(merchantPaymentCanvasScenario);
		const nodeIds = new Set(scenario!.nodes.map((node) => node.id));
		expect(nodeIds.size).toBe(scenario!.nodes.length);
		for (const edge of scenario!.edges) {
			expect(nodeIds.has(edge.source)).toBe(true);
			expect(nodeIds.has(edge.target)).toBe(true);
		}
		expect(scenario!.nodes.every((node) => node.status === 'waiting' && !node.workflow)).toBe(true);
		expect(scenario!.nodes.find((node) => node.id === 'reconcile')?.detail).toContain(
			'purpose = short_id'
		);
		expect(
			scenario!.edges.filter((edge) => edge.target === 'paid').map((edge) => edge.source)
		).toEqual(['reconcile']);
		for (const terminal of ['reject', 'review', 'done']) {
			expect(scenario!.edges.some((edge) => edge.source === terminal)).toBe(false);
		}
		expect(scenario!.edges).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ source: 'telegram-enabled', target: 'webhook-enabled' }),
				expect.objectContaining({ source: 'telegram', target: 'webhook-enabled' }),
				expect.objectContaining({ source: 'webhook-enabled', target: 'done' }),
				expect.objectContaining({ source: 'webhook-enabled', target: 'merchant-webhook' })
			])
		);
	});

	it('composes the base journey without optional process participants', () => {
		const projected = projectProcessFlowScenarioMermaid(
			merchantPaymentFlow,
			merchantPaymentScenarios[0]
		);

		expect(projected).toContain('actor participant1 as Merchant');
		expect(projected).toContain('Register merchant');
		expect(projected).toContain('Invoice paid');
		expect(projected).not.toContain('Delivery Worker');
		expect(projected).not.toContain('Loyalty Worker');
		expect(projected).not.toContain('Configured notification channel');
		expect(projected).not.toContain('Queue notification');
	});

	it('orders the merchant solution from onboarding to verified payment and optional notification', () => {
		const scenario = merchantPaymentScenarios.find(
			(candidate) => candidate.id === 'payment-notification'
		)!;
		expect(validateProcessFlowScenario(merchantPaymentFlow, scenario).valid).toBe(true);
		const projected = projectProcessFlowScenarioMermaid(merchantPaymentFlow, scenario);
		const stages = [
			'Register merchant',
			'Submit legal identity and recipient details',
			'Merchant activated',
			'Select allowed checkout scenario',
			'Create invoice with server-owned reference',
			'Return persisted invoice and checkout link',
			'Share payment link',
			'Open checkout',
			'Hand off payment authorization; invoice remains pending',
			'Receive provider evidence for authentication; not payment success',
			'Authenticate evidence; match reference, amount, currency, recipient and unique transaction',
			'Credit confirmed',
			'Invoice paid',
			'Queue notification',
			'Track delivery or retry independently; invoice stays paid'
		];
		let previousIndex = -1;
		for (const stage of stages) {
			const index = projected.indexOf(stage);
			expect(index, stage).toBeGreaterThan(previousIndex);
			previousIndex = index;
		}
		expect(projected).not.toContain('Delivery Worker');
		expect(projected).not.toContain('Loyalty Worker');
	});

	it('adds delivery and loyalty processes for a full scenario', () => {
		const projected = projectProcessFlowScenarioMermaid(
			merchantPaymentFlow,
			merchantPaymentScenarios[2]
		);

		expect(projected).toContain('participant participant5 as Delivery Worker');
		expect(projected).toContain('participant participant6 as Loyalty Worker');
		expect(projected.indexOf('Apply loyalty benefits')).toBeLessThan(
			projected.indexOf('Arrange delivery')
		);
	});

	it('rejects unresolved process and capability references', () => {
		const definition = structuredClone(merchantPaymentFlow);
		definition.participants[2].processId = 'not-a-uuid';
		definition.stages[0].to = 'missing-process';
		definition.stages[0].requires = ['missing-capability'];

		expect(validateProcessFlowDefinition(definition)).toMatchObject({
			valid: false,
			issues: expect.arrayContaining([
				{ code: 'invalid-process-participant', participantId: 'onboarding' },
				{ code: 'unknown-participant', stageId: 'register', participantId: 'missing-process' },
				{ code: 'unknown-capability', stageId: 'register', capabilityId: 'missing-capability' }
			])
		});
	});

	it('escapes authored labels and does not expose persisted IDs', () => {
		const definition = structuredClone(merchantPaymentFlow);
		const previousParticipantId = definition.participants[0].id;
		definition.participants[0].id = 'unsafe\nparticipant Injected';
		definition.participants[0].name = 'Merchant: <script>';
		for (const stage of definition.stages) {
			if (stage.from === previousParticipantId) stage.from = definition.participants[0].id;
			if (stage.to === previousParticipantId) stage.to = definition.participants[0].id;
		}

		const projected = projectProcessFlowSequenceMermaid(definition);

		expect(projected).toContain('Merchant&#58; &lt;script&gt;');
		expect(projected).not.toContain('participant Injected');
		expect(projected).not.toContain('<script>');
	});

	it('rejects scenarios for another flow or with undeclared capabilities', () => {
		const validation = validateProcessFlowScenario(merchantPaymentFlow, {
			id: 'invalid',
			name: 'Invalid',
			flowId: 'another-flow',
			enabledCapabilities: ['unknown']
		});

		expect(validation.valid).toBe(false);
		expect(validation.issues).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ code: 'unknown-flow', participantId: 'another-flow' }),
				expect.objectContaining({ code: 'unknown-capability', capabilityId: 'unknown' })
			])
		);
	});

	it('validates scenarios as part of the versioned Flow definition', () => {
		const definition = structuredClone(merchantPaymentFlow);
		definition.scenarios.push({
			id: definition.scenarios[0].id,
			name: 'Invalid persisted scenario',
			flowId: 'another-flow',
			enabledCapabilities: ['unknown']
		});

		const validation = validateProcessFlowDefinition(definition);
		expect(validation.valid).toBe(false);
		expect(validation.issues).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: 'duplicate-scenario-id',
					scenarioId: definition.scenarios[0].id
				}),
				expect.objectContaining({
					code: 'unknown-flow',
					scenarioId: definition.scenarios[0].id
				}),
				expect.objectContaining({
					code: 'unknown-capability',
					scenarioId: definition.scenarios[0].id
				})
			])
		);
	});
});
