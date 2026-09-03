import { describe, expect, it } from 'vitest';
import { merchantPaymentFlow, merchantPaymentScenarios } from './merchant-payment-flow';
import {
	validateProcessFlowDefinition,
	validateProcessFlowScenario
} from './process-flow-definition';
import {
	projectProcessFlowScenarioMermaid,
	projectProcessFlowSequenceMermaid
} from './process-flow-projector';

describe('process flow sequence projector', () => {
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
