import { describe, expect, it } from 'vitest';
import { CHECKOUT_TEMPLATE_SCENARIOS } from '$lib/features/shared/checkout-scenario-config';
import {
	SCENARIO_CAPABILITIES,
	canCreateCheckoutLink,
	getScenarioCapability
} from './scenario-capabilities';

describe('checkout scenario capabilities', () => {
	it('classifies every selectable Dashboard scenario exactly once', () => {
		expect(SCENARIO_CAPABILITIES.map(({ id }) => id)).toEqual(CHECKOUT_TEMPLATE_SCENARIOS);
		expect(new Set(SCENARIO_CAPABILITIES.map(({ id }) => id)).size).toBe(
			CHECKOUT_TEMPLATE_SCENARIOS.length
		);
	});

	it('keeps existing core links available and gates unfinished flows', () => {
		for (const id of ['fixed', 'open_amount', 'table', 'tips']) {
			expect(canCreateCheckoutLink(id)).toBe(true);
		}
		expect(canCreateCheckoutLink('delivery')).toBe(false);
		expect(canCreateCheckoutLink('fuel_station')).toBe(false);
		expect(canCreateCheckoutLink('engine_book')).toBe(false);
		expect(canCreateCheckoutLink('vertical_beauty')).toBe(false);
		expect(canCreateCheckoutLink('unknown')).toBe(false);
		expect(canCreateCheckoutLink('engine_book', true)).toBe(true);
	});

	it('exposes readiness metadata for the Dashboard', () => {
		expect(getScenarioCapability('fuel_station')).toMatchObject({
			group: 'core',
			readiness: 'testing'
		});
		expect(getScenarioCapability('vertical_beauty')).toMatchObject({
			group: 'vertical',
			readiness: 'preview'
		});
	});
});
