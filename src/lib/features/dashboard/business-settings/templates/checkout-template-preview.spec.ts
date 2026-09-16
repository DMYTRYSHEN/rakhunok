import { describe, expect, it } from 'vitest';
import { buildCheckoutPreviewModel, isCheckoutTemplateScenario } from './checkout-template-preview';

describe('checkout template preview model', () => {
	it.each([
		['fixed', false, 1240],
		['table', false, 860],
		['delivery', false, 1240],
		['tips', false, 100],
		['open_amount', true, 0],
		['fuel_station', false, 1190]
	] as const)('builds the %s payer scenario', (scenario, isOpenAmount, amount) => {
		const model = buildCheckoutPreviewModel(scenario);
		expect(model.isOpenAmount).toBe(isOpenAmount);
		expect(model.amount).toBe(amount);
	});

	it('resolves every editable payer option without mutating defaults', () => {
		const model = buildCheckoutPreviewModel('table', {
			allow_loyalty: false,
			allow_promo: true,
			promo_discount: 17.5,
			allow_tips: false,
			allow_split: false,
			allow_roundup: false,
			allow_bnpl: true,
			show_other_banks: false,
			allow_upsell: false,
			allow_delivery: true,
			allow_compliance_card: false,
			allow_nps_review: false,
			quick_amounts: [25, 75],
			tip_presets: [7, 12],
			cta_text: 'Сплатити зараз',
			theme: 'light'
		});

		expect(model.config).toMatchObject({
			allow_loyalty: false,
			allow_promo: true,
			promo_discount: 17.5,
			allow_tips: false,
			allow_split: false,
			allow_roundup: false,
			allow_bnpl: true,
			show_other_banks: false,
			allow_upsell: false,
			allow_delivery: true,
			allow_compliance_card: false,
			allow_nps_review: false,
			theme: 'light'
		});
		expect(model.quickAmounts).toEqual([25, 75]);
		expect(model.tipPresets).toEqual([7, 12]);
		expect(model.ctaText).toBe('Сплатити зараз');
	});

	it('uses scenario defaults for late-step and scenario-specific controls', () => {
		expect(buildCheckoutPreviewModel('table').config).toMatchObject({ allow_tips: true, allow_split: true, allow_compliance_card: true });
		expect(buildCheckoutPreviewModel('delivery').config.allow_delivery).toBe(true);
		expect(buildCheckoutPreviewModel('open_amount').quickAmounts).toEqual([50, 100, 200, 500]);
		expect(buildCheckoutPreviewModel('tips').tipPresets).toEqual([20, 50, 100, 200]);
		expect(buildCheckoutPreviewModel('fixed').config.allow_nps_review).toBe(true);
	});

	it('narrows only supported template scenarios', () => {
		expect(isCheckoutTemplateScenario('delivery')).toBe(true);
		expect(isCheckoutTemplateScenario('fuel_station')).toBe(true);
		expect(isCheckoutTemplateScenario('donation')).toBe(false);
	});
});