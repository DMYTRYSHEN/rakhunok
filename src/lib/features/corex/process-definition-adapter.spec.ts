import { describe, expect, it } from 'vitest';
import { flowScenarioToProcessDefinition } from './process-definition-adapter';
import { validateProcessDefinition } from './process-definition';
import { flowScenarios } from './flow-scenarios';

describe('flowScenarioToProcessDefinition', () => {
	it('converts checkout-table into a valid ProcessDefinition', () => {
		const checkoutTable = flowScenarios.find((s) => s.id === 'checkout-table');
		expect(checkoutTable).toBeDefined();

		const definition = flowScenarioToProcessDefinition(checkoutTable!);
		expect(definition.id).toBe('draft-checkout-table');
		expect(definition.name).toBe(checkoutTable!.label);
		expect(definition.lifecycle).toBe('draft');
		expect(definition.nodes.length).toBeGreaterThan(0);
		expect(definition.edges.length).toBeGreaterThan(0);

		const trigger = definition.nodes.find((n) => n.type === 'trigger-http');
		expect(trigger).toBeDefined();

		const validation = validateProcessDefinition(definition);
		expect(validation.valid).toBe(true);
		expect(validation.issues).toEqual([]);
	});

	it('converts onboarding scenario into a valid ProcessDefinition', () => {
		const onboarding = flowScenarios.find((s) => s.id === 'onboarding');
		expect(onboarding).toBeDefined();

		const definition = flowScenarioToProcessDefinition(onboarding!);
		expect(definition.id).toBe('draft-onboarding');

		const validation = validateProcessDefinition(definition);
		expect(validation.valid).toBe(true);
		expect(validation.issues).toEqual([]);
	});

	it('converts login scenario into a valid ProcessDefinition', () => {
		const login = flowScenarios.find((s) => s.id === 'login');
		expect(login).toBeDefined();

		const definition = flowScenarioToProcessDefinition(login!);
		expect(definition.id).toBe('draft-login');

		const validation = validateProcessDefinition(definition);
		expect(validation.valid).toBe(true);
		expect(validation.issues).toEqual([]);
	});

	it('converts key business scenarios into valid executable ProcessDefinitions', () => {
		const targetScenarioIds = [
			'checkout-fixed',
			'checkout-open_amount',
			'checkout-delivery',
			'create-table',
			'create-delivery',
			'pwa-boot',
			'bank-catalogue',
			'payment-initiation',
			'webhook-status'
		];

		for (const id of targetScenarioIds) {
			const scenario = flowScenarios.find((s) => s.id === id);
			if (!scenario) continue;
			const definition = flowScenarioToProcessDefinition(scenario);
			const validation = validateProcessDefinition(definition);
			expect(validation.valid, `Validation failed for scenario ${id}: ${JSON.stringify(validation.issues)}`).toBe(true);
		}
	});
});
