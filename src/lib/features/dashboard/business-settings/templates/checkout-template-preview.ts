import {
	CHECKOUT_TEMPLATE_SCENARIOS,
	isCheckoutTemplateScenario,
	type CheckoutScenarioConfig,
	type CheckoutTemplateScenario
} from '$lib/features/shared/checkout-scenario-config';
import { resolveCheckoutConfig } from '$lib/features/shared/checkout-scenario-defaults';

export { CHECKOUT_TEMPLATE_SCENARIOS, isCheckoutTemplateScenario };
export type { CheckoutTemplateScenario };
export type CheckoutPreviewStep = 'checkout' | 'payment' | 'success';

export interface CheckoutPreviewModel {
	scenario: CheckoutTemplateScenario;
	config: CheckoutScenarioConfig;
	merchantName: string;
	contextLabel: string;
	amount: number;
	isOpenAmount: boolean;
	quickAmounts: number[];
	tipPresets: number[];
	ctaText: string;
}

const SCENARIO_PRESENTATION: Record<
	CheckoutTemplateScenario,
	Pick<CheckoutPreviewModel, 'merchantName' | 'contextLabel' | 'amount'>
> = {
	fixed: { merchantName: 'Rahunok Market', contextLabel: 'Замовлення #1048', amount: 1240 },
	table: { merchantName: 'Кав’ярня Центральна', contextLabel: 'Столик 12', amount: 860 },
	delivery: {
		merchantName: 'Rahunok Market',
		contextLabel: 'Замовлення з доставкою',
		amount: 1240
	},
	tips: { merchantName: 'Кав’ярня Центральна', contextLabel: 'Чайові офіціанту', amount: 100 },
	open_amount: { merchantName: 'Rahunok', contextLabel: 'Введіть суму до сплати', amount: 0 },
	fuel_station: { merchantName: 'Rahunok АЗС', contextLabel: 'Колонка · пальне · об’єм', amount: 1190 }
};

export function buildCheckoutPreviewModel(
	scenario: CheckoutTemplateScenario,
	config?: Partial<CheckoutScenarioConfig> | null
): CheckoutPreviewModel {
	const resolved = resolveCheckoutConfig(scenario, config);
	return {
		scenario,
		config: resolved,
		...SCENARIO_PRESENTATION[scenario],
		isOpenAmount: scenario === 'open_amount',
		quickAmounts: resolved.quick_amounts ?? [],
		tipPresets: resolved.tip_presets ?? [],
		ctaText: resolved.cta_text?.trim() || 'Перейти до оплати'
	};
}
