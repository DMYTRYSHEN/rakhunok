import type {
	CheckoutScenarioConfig,
	CheckoutFlowId
} from '$lib/features/shared/checkout-scenario-config';
import type { PersistedInvoiceType } from '../types';

export function templateInvoiceType(scenario: CheckoutFlowId): PersistedInvoiceType {
	if (scenario === 'tips') return 'open_amount';
	if (
		scenario === 'fixed' ||
		scenario === 'open_amount' ||
		scenario === 'table' ||
		scenario === 'delivery'
	) {
		return scenario;
	}
	throw new Error(`Checkout flow is not mapped to an invoice type: ${scenario}`);
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
