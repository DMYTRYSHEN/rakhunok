import {
	PROCESS_FLOW_SCHEMA_VERSION,
	type ProcessFlowDefinition,
	type ProcessFlowScenario
} from './process-flow-definition';

export const merchantPaymentFlow: ProcessFlowDefinition = {
	schemaVersion: PROCESS_FLOW_SCHEMA_VERSION,
	id: 'merchant-payment',
	name: 'Merchant payment journey',
	description: 'From merchant onboarding to confirmed incoming credit.',
	capabilities: [
		{ id: 'delivery', name: 'Delivery' },
		{ id: 'loyalty', name: 'Loyalty' }
	],
	scenarios: [
		{
			id: 'payment-basic',
			name: 'Payment',
			flowId: 'merchant-payment',
			enabledCapabilities: []
		},
		{
			id: 'payment-delivery',
			name: 'Payment with delivery',
			flowId: 'merchant-payment',
			enabledCapabilities: ['delivery']
		},
		{
			id: 'payment-delivery-loyalty',
			name: 'Payment with delivery and loyalty',
			flowId: 'merchant-payment',
			enabledCapabilities: ['delivery', 'loyalty']
		}
	],
	participants: [
		{ id: 'merchant', name: 'Merchant', kind: 'actor' },
		{ id: 'customer', name: 'Customer', kind: 'actor' },
		{
			id: 'onboarding',
			name: 'Onboarding Worker',
			kind: 'process',
			processId: '10000000-0000-4000-8000-000000000001'
		},
		{
			id: 'invoice',
			name: 'Invoice Worker',
			kind: 'process',
			processId: '10000000-0000-4000-8000-000000000002'
		},
		{
			id: 'delivery',
			name: 'Delivery Worker',
			kind: 'process',
			processId: '10000000-0000-4000-8000-000000000003'
		},
		{
			id: 'loyalty',
			name: 'Loyalty Worker',
			kind: 'process',
			processId: '10000000-0000-4000-8000-000000000004'
		},
		{
			id: 'checkout',
			name: 'Checkout Worker',
			kind: 'process',
			processId: '10000000-0000-4000-8000-000000000005'
		},
		{ id: 'bank', name: 'Bank', kind: 'external' },
		{
			id: 'payment',
			name: 'Payment Worker',
			kind: 'process',
			processId: '10000000-0000-4000-8000-000000000006'
		},
		{
			id: 'settlement',
			name: 'Settlement Worker',
			kind: 'process',
			processId: '10000000-0000-4000-8000-000000000007'
		}
	],
	stages: [
		{ id: 'register', order: 10, from: 'merchant', to: 'onboarding', message: 'Register merchant' },
		{
			id: 'activate',
			order: 20,
			from: 'onboarding',
			to: 'merchant',
			message: 'Merchant activated',
			kind: 'response'
		},
		{ id: 'create-invoice', order: 30, from: 'merchant', to: 'invoice', message: 'Create invoice' },
		{
			id: 'apply-loyalty',
			order: 40,
			from: 'invoice',
			to: 'loyalty',
			message: 'Apply loyalty benefits',
			requires: ['loyalty']
		},
		{
			id: 'arrange-delivery',
			order: 50,
			from: 'invoice',
			to: 'delivery',
			message: 'Arrange delivery',
			requires: ['delivery']
		},
		{ id: 'share', order: 60, from: 'merchant', to: 'customer', message: 'Share payment link' },
		{ id: 'open', order: 70, from: 'customer', to: 'checkout', message: 'Open checkout' },
		{ id: 'authorize', order: 80, from: 'checkout', to: 'bank', message: 'Authorize payment' },
		{
			id: 'callback',
			order: 90,
			from: 'bank',
			to: 'payment',
			message: 'Payment callback',
			kind: 'event'
		},
		{
			id: 'verify',
			order: 100,
			from: 'payment',
			to: 'settlement',
			message: 'Verify incoming credit'
		},
		{
			id: 'credited',
			order: 110,
			from: 'settlement',
			to: 'invoice',
			message: 'Credit confirmed',
			kind: 'event'
		},
		{
			id: 'complete',
			order: 120,
			from: 'invoice',
			to: 'merchant',
			message: 'Invoice paid',
			kind: 'response'
		}
	]
};

export const merchantPaymentScenarios: ProcessFlowScenario[] = merchantPaymentFlow.scenarios;
