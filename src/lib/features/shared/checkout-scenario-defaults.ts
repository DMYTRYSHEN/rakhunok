import type { CheckoutScenarioConfig } from './checkout-scenario-config';

/**
 * Default checkout configuration per scenario type.
 *
 * When a merchant selects a scenario in the Dashboard constructor,
 * these defaults are applied automatically. The merchant can then
 * toggle individual flags on/off before creating the invoice.
 *
 * When apps/pay reads an order without certain config keys,
 * it falls back to these defaults based on `order.type`.
 */

const BASE_DEFAULTS: CheckoutScenarioConfig = {
	allow_loyalty: true,
	allow_promo: true,
	allow_roundup: true,
	allow_tips: false,
	allow_split: false,
	allow_bnpl: true,
	allow_upsell: true,
	allow_delivery: false,
	allow_compliance_card: false,
	allow_nps_review: true,
	show_other_banks: true,
	promo_discount: 4.0,
	cta_text: 'Перейти до оплати',
	theme: 'dark'
};

const SCENARIO_OVERRIDES: Record<string, Partial<CheckoutScenarioConfig>> = {
	fixed: {
		// Fixed invoice — full e-commerce checkout
	},

	open_amount: {
		allow_loyalty: false,
		allow_promo: false,
		allow_roundup: false,
		allow_bnpl: false,
		allow_upsell: false,
		allow_compliance_card: false,
		quick_amounts: [50, 100, 200, 500],
		cta_text: 'Перейти до оплати'
	},

	table: {
		allow_tips: true,
		allow_split: true,
		allow_bnpl: false,
		allow_compliance_card: true,
		tip_presets: [5, 10, 15, 20],
		cta_text: 'Перейти до оплати'
	},

	delivery: {
		allow_loyalty: false,
		allow_delivery: true,
		allow_bnpl: true,
		allow_upsell: false,
		allow_compliance_card: false,
		cta_text: 'Підтвердити замовлення'
	},

	tips: {
		allow_loyalty: false,
		allow_promo: false,
		allow_roundup: false,
		allow_bnpl: false,
		allow_upsell: false,
		allow_split: false,
		allow_delivery: false,
		allow_compliance_card: false,
		tip_presets: [20, 50, 100, 200],
		cta_text: 'Подякувати'
	},

	fuel_station: {
		allow_loyalty: false,
		allow_promo: true,
		allow_roundup: false,
		allow_tips: false,
		allow_split: false,
		allow_bnpl: false,
		allow_upsell: false,
		allow_delivery: false,
		allow_compliance_card: false,
		checkout_flow: {
			id: 'fuel_station',
			version: 1,
			invoice_type: 'open_amount'
		},
		flow_data: {
			policy: {
				allowed_input_modes: ['liters', 'amount'],
				default_input_mode: 'liters',
				require_connected_nozzle: true,
				price_change_policy: 'lock_quote',
				quote_ttl_seconds: 60
			}
		},
		cta_text: 'Перейти до оплати'
	},

	donation: {
		allow_loyalty: false,
		allow_promo: false,
		allow_roundup: false,
		allow_bnpl: false,
		allow_upsell: false,
		allow_split: false,
		allow_tips: false,
		allow_delivery: false,
		allow_compliance_card: false,
		quick_amounts: [100, 200, 500, 1000],
		cta_text: 'Задонатити'
	},

	recurring: {
		allow_loyalty: false,
		allow_promo: false,
		allow_roundup: false,
		allow_bnpl: false,
		allow_upsell: false,
		allow_split: false,
		allow_tips: false,
		allow_delivery: false,
		allow_compliance_card: false,
		cta_text: 'Підписатися'
	},

	rtp: {
		allow_loyalty: false,
		allow_promo: false,
		allow_roundup: false,
		allow_bnpl: false,
		allow_upsell: false,
		allow_split: false,
		allow_tips: false,
		allow_delivery: false,
		allow_compliance_card: false,
		cta_text: 'Оплатити запит'
	},

	// --- ⚙️ ENGINES ---
	engine_buy: {
		allow_loyalty: true,
		allow_promo: true,
		allow_delivery: true,
		allow_upsell: true,
		cta_text: 'Оплатити замовлення'
	},
	engine_order: {
		allow_loyalty: true,
		allow_promo: true,
		allow_delivery: true,
		allow_upsell: true,
		cta_text: 'Замовити та оплатити'
	},
	engine_book: {
		allow_loyalty: true,
		allow_promo: true,
		allow_delivery: false,
		allow_upsell: true,
		allow_split: false,
		cta_text: 'Забронювати (передоплата)'
	},
	engine_quote: {
		allow_loyalty: false,
		allow_promo: true,
		allow_delivery: false,
		cta_text: 'Оплатити рахунок'
	},
	engine_deliver: {
		allow_loyalty: false,
		allow_promo: true,
		allow_delivery: true,
		allow_upsell: false,
		cta_text: 'Оплатити доставку'
	},
	engine_split: {
		allow_split: true,
		allow_tips: true,
		allow_loyalty: true,
		cta_text: 'Сплатити свою частку'
	},

	// --- 🚀 VERTICALS ---
	vertical_food: {
		allow_loyalty: true,
		allow_promo: true,
		allow_delivery: true,
		allow_tips: true,
		allow_upsell: true,
		cta_text: 'Оплатити замовлення'
	},
	vertical_flowers: {
		allow_loyalty: true,
		allow_promo: true,
		allow_delivery: true,
		allow_tips: true,
		allow_upsell: true, // Listivky, etc.
		cta_text: 'Замовити букет'
	},
	vertical_auto: {
		allow_loyalty: true,
		allow_promo: false,
		allow_delivery: false,
		allow_upsell: true, // Zapasni chastyny
		cta_text: 'Сплатити послуги'
	},
	vertical_beauty: {
		allow_loyalty: true,
		allow_promo: true,
		allow_tips: true,
		allow_upsell: true, // Kosmetyka
		cta_text: 'Підтвердити запис'
	},
	vertical_cleaning: {
		allow_promo: true,
		allow_delivery: false,
		allow_tips: true,
		allow_upsell: true, // Vikna, duhovka
		cta_text: 'Замовити клінінг'
	},
	vertical_pets: {
		allow_loyalty: true,
		allow_promo: true,
		allow_tips: true,
		allow_upsell: true,
		cta_text: 'Сплатити прийом'
	},
	vertical_rental: {
		allow_promo: true,
		allow_delivery: true, // Delivery of equipment
		allow_upsell: true,
		cta_text: 'Оплатити оренду'
	},
	vertical_education: {
		allow_loyalty: false,
		allow_promo: true,
		allow_upsell: true, // Packages
		cta_text: 'Оплатити заняття'
	},
	vertical_services: {
		allow_promo: true,
		allow_tips: true,
		allow_upsell: true,
		cta_text: 'Сплатити послугу'
	},
	vertical_delivery: {
		allow_promo: true,
		allow_delivery: true,
		cta_text: 'Оплатити перевезення'
	},
	vertical_print: {
		allow_promo: true,
		allow_delivery: true,
		allow_upsell: true, // Laminaciya, etc.
		cta_text: 'Оплатити друк'
	},
	vertical_gifts: {
		allow_promo: true,
		allow_delivery: true,
		allow_upsell: true, // Upakovka
		cta_text: 'Оплатити подарунок'
	}
};

/**
 * Returns the full set of checkout config defaults for a given scenario type.
 * Merges base defaults with scenario-specific overrides.
 */
export function getScenarioDefaults(scenarioType: string): CheckoutScenarioConfig {
	const overrides = SCENARIO_OVERRIDES[scenarioType] || {};
	return { ...BASE_DEFAULTS, ...overrides };
}

/**
 * Resolves the effective checkout config for an order:
 * 1. Start with base defaults for the scenario type
 * 2. Override with any explicit values from the order's scenario_config
 *
 * Used by apps/pay to get the final config.
 */
export function resolveCheckoutConfig(
	scenarioType: string,
	orderConfig?: Partial<CheckoutScenarioConfig> | Record<string, unknown> | null
): CheckoutScenarioConfig {
	const defaults = getScenarioDefaults(scenarioType);
	if (!orderConfig) return defaults;
	return { ...defaults, ...orderConfig } as CheckoutScenarioConfig;
}
