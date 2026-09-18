import type {
	CheckoutScenarioConfig,
	CheckoutFlowId
} from '$lib/features/shared/checkout-scenario-config';
import type { PersistedInvoiceType } from '../types';

export function templateInvoiceType(scenario: CheckoutFlowId): PersistedInvoiceType {
	if (scenario === 'tips' || scenario === 'open_amount' || scenario === 'fuel_station') {
		return 'open_amount';
	}
	if (scenario === 'table' || scenario === 'engine_split') {
		return 'table';
	}
	if (scenario === 'delivery' || scenario === 'engine_deliver' || scenario === 'vertical_delivery' || scenario === 'vertical_food') {
		return 'delivery';
	}
	if (
		scenario === 'fixed' ||
		scenario.startsWith('engine_') ||
		scenario.startsWith('vertical_')
	) {
		return 'fixed';
	}
	return 'fixed';
}

export function buildTemplateInvoiceScenario(
	scenario: CheckoutFlowId,
	config: CheckoutScenarioConfig
): { type: PersistedInvoiceType; config: CheckoutScenarioConfig } {
	const type = config.checkout_flow?.invoice_type ?? templateInvoiceType(scenario);
	return {
		type,
		config: {
			...config,
			checkout_flow: { ...config.checkout_flow, id: scenario, version: 1, invoice_type: type }
		}
	};
}
