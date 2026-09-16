import { describe, expect, it } from 'vitest';
import { getScenarioDefaults } from '$lib/features/shared/checkout-scenario-defaults';
import { buildTemplateInvoiceScenario, templateInvoiceType } from './template-invoice';

describe('checkout template invoice integration', () => {
	it.each([
		['fixed', 'fixed'],
		['table', 'table'],
		['delivery', 'delivery'],
		['open_amount', 'open_amount'],
		['tips', 'open_amount']
	] as const)(
		'maps %s templates to the supported %s invoice scenario',
		(templateScenario, invoiceScenario) => {
			expect(templateInvoiceType(templateScenario)).toBe(invoiceScenario);
		}
	);

	it('preserves the template flow identity in versioned checkout JSON', () => {
		const config = { ...getScenarioDefaults('tips'), cta_text: 'Подякувати' };
		expect(buildTemplateInvoiceScenario('tips', config)).toEqual({
			type: 'open_amount',
			config: {
				...config,
				cta_text: 'Подякувати',
				checkout_flow: { id: 'tips', version: 1, invoice_type: 'open_amount' }
			}
		});
	});

	it('uses JSON financial semantics for a future renderer', () => {
		const config = {
			...getScenarioDefaults('fixed'),
			checkout_flow: { id: 'fuel_station', version: 1, invoice_type: 'open_amount' as const },
			flow_data: { quantity: { mode: 'liters' } }
		};
		expect(buildTemplateInvoiceScenario('fuel_station', config)).toEqual({
			type: 'open_amount',
			config: {
				...config,
				checkout_flow: { id: 'fuel_station', version: 1, invoice_type: 'open_amount' },
				flow_data: { quantity: { mode: 'liters' } }
			}
		});
	});
});
