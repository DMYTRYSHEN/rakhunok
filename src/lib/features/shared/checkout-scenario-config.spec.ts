import { describe, expect, it } from 'vitest';
import { getScenarioDefaults, resolveCheckoutConfig } from './checkout-scenario-defaults';
import type { CheckoutScenarioConfig } from './checkout-scenario-config';

describe('Checkout Scenario Configuration & Defaults', () => {
	it('provides correct defaults for fixed invoice', () => {
		const config = getScenarioDefaults('fixed');
		expect(config.allow_loyalty).toBe(true);
		expect(config.allow_promo).toBe(true);
		expect(config.allow_roundup).toBe(true);
		expect(config.allow_tips).toBe(false);
		expect(config.allow_split).toBe(false);
		expect(config.allow_bnpl).toBe(true);
		expect(config.allow_upsell).toBe(true);
		expect(config.allow_delivery).toBe(false);
		expect(config.allow_compliance_card).toBe(false);
		expect(config.allow_nps_review).toBe(true);
		expect(config.show_other_banks).toBe(true);
	});

	it('provides correct defaults for table scenario (HoReCa)', () => {
		const config = getScenarioDefaults('table');
		expect(config.allow_tips).toBe(true);
		expect(config.allow_split).toBe(true);
		expect(config.allow_compliance_card).toBe(true);
		expect(config.allow_bnpl).toBe(false);
		expect(config.tip_presets).toEqual([5, 10, 15, 20]);
	});

	it('provides correct defaults for open_amount (cashier / keypad)', () => {
		const config = getScenarioDefaults('open_amount');
		expect(config.allow_loyalty).toBe(false);
		expect(config.allow_promo).toBe(false);
		expect(config.allow_roundup).toBe(false);
		expect(config.allow_bnpl).toBe(false);
		expect(config.allow_upsell).toBe(false);
		expect(config.quick_amounts).toEqual([50, 100, 200, 500]);
	});

	it('provides correct defaults for delivery scenario', () => {
		const config = getScenarioDefaults('delivery');
		expect(config.allow_delivery).toBe(true);
		expect(config.allow_bnpl).toBe(true);
		expect(config.allow_loyalty).toBe(false);
		expect(config.cta_text).toBe('Підтвердити замовлення');
	});

	it('provides correct defaults for tips scenario', () => {
		const config = getScenarioDefaults('tips');
		expect(config.allow_tips).toBe(false);
		expect(config.tip_presets).toEqual([20, 50, 100, 200]);
		expect(config.cta_text).toBe('Подякувати');
	});

	it('provides correct defaults for donation scenario', () => {
		const config = getScenarioDefaults('donation');
		expect(config.allow_promo).toBe(false);
		expect(config.allow_loyalty).toBe(false);
		expect(config.allow_roundup).toBe(false);
		expect(config.cta_text).toBe('Задонатити');
		expect(config.quick_amounts).toEqual([100, 200, 500, 1000]);
	});

	it('resolveCheckoutConfig overrides defaults with merchant values', () => {
		const resolved = resolveCheckoutConfig('fixed', {
			allow_loyalty: false,
			allow_promo: false,
			show_other_banks: false,
			cta_text: 'Купити в 1 клік'
		});

		// Overridden
		expect(resolved.allow_loyalty).toBe(false);
		expect(resolved.allow_promo).toBe(false);
		expect(resolved.show_other_banks).toBe(false);
		expect(resolved.cta_text).toBe('Купити в 1 клік');

		// Retained from defaults
		expect(resolved.allow_roundup).toBe(true);
		expect(resolved.allow_bnpl).toBe(true);
		expect(resolved.allow_upsell).toBe(true);
	});

	it('resolveCheckoutConfig handles null or undefined config gracefully', () => {
		const fromNull = resolveCheckoutConfig('table', null);
		expect(fromNull.allow_tips).toBe(true);
		expect(fromNull.allow_split).toBe(true);

		const fromUndefined = resolveCheckoutConfig('fixed', undefined);
		expect(fromUndefined.allow_loyalty).toBe(true);
	});
});
