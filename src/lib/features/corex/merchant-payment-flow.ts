import {
	PROCESS_FLOW_SCHEMA_VERSION,
	type ProcessFlowDefinition,
	type ProcessFlowScenario
} from './process-flow-definition';
import type { FlowNode, FlowScenario } from './types';

export const merchantPaymentFlow: ProcessFlowDefinition = {
	schemaVersion: PROCESS_FLOW_SCHEMA_VERSION,
	id: 'merchant-payment',
	name: 'Merchant payment journey',
	description:
		'Demo blueprint: onboarding, recipient details, configured checkout, verified credit and optional notification. Process IDs are fixtures, not live bindings.',
	capabilities: [
		{ id: 'delivery', name: 'Delivery' },
		{ id: 'loyalty', name: 'Loyalty' },
		{ id: 'merchant-notification', name: 'Merchant notification' }
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
		},
		{
			id: 'payment-notification',
			name: 'Payment with merchant notification',
			flowId: 'merchant-payment',
			enabledCapabilities: ['merchant-notification']
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
		},
		{ id: 'notification', name: 'Configured notification channel', kind: 'external' }
	],
	stages: [
		{ id: 'register', order: 10, from: 'merchant', to: 'onboarding', message: 'Register merchant' },
		{
			id: 'recipient-details',
			order: 15,
			from: 'merchant',
			to: 'onboarding',
			message: 'Submit legal identity and recipient details for server validation',
			kind: 'command'
		},
		{
			id: 'activate',
			order: 20,
			from: 'onboarding',
			to: 'merchant',
			message: 'Merchant activated',
			kind: 'response'
		},
		{
			id: 'configure-checkout',
			order: 25,
			from: 'merchant',
			to: 'invoice',
			message: 'Select allowed checkout scenario and presentation parameters',
			kind: 'command'
		},
		{
			id: 'create-invoice',
			order: 30,
			from: 'merchant',
			to: 'invoice',
			message: 'Create invoice with server-owned reference, amount and recipient snapshot'
		},
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
		{
			id: 'invoice-created',
			order: 55,
			from: 'invoice',
			to: 'merchant',
			message: 'Return persisted invoice and checkout link',
			kind: 'response'
		},
		{ id: 'share', order: 60, from: 'merchant', to: 'customer', message: 'Share payment link' },
		{ id: 'open', order: 70, from: 'customer', to: 'checkout', message: 'Open checkout' },
		{
			id: 'authorize',
			order: 80,
			from: 'checkout',
			to: 'bank',
			message: 'Hand off payment authorization; invoice remains pending'
		},
		{
			id: 'callback',
			order: 90,
			from: 'bank',
			to: 'payment',
			message: 'Receive provider evidence for authentication; not payment success',
			kind: 'event'
		},
		{
			id: 'verify',
			order: 100,
			from: 'payment',
			to: 'settlement',
			message:
				'Authenticate evidence; match reference, amount, currency, recipient and unique transaction'
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
		},
		{
			id: 'notify-merchant',
			order: 130,
			from: 'invoice',
			to: 'notification',
			message: 'Queue notification with tenant-scoped destination and deduplication key',
			kind: 'command',
			requires: ['merchant-notification']
		},
		{
			id: 'notification-result',
			order: 140,
			from: 'notification',
			to: 'merchant',
			message: 'Track delivery or retry independently; invoice stays paid',
			kind: 'response',
			requires: ['merchant-notification']
		}
	]
};

export const merchantPaymentScenarios: ProcessFlowScenario[] = merchantPaymentFlow.scenarios;

type CanvasStep = Pick<FlowNode, 'id' | 'title' | 'detail' | 'layer' | 'kind'>;

const paymentCanvasSteps: CanvasStep[] = [
	{
		id: 'onboard',
		title: 'Merchant onboarding',
		layer: 'browser',
		kind: 'trigger',
		detail:
			'Demo prerequisite: identify and activate the merchant once, then reuse the profile for invoices.'
	},
	{
		id: 'recipient',
		title: 'Recipient details',
		layer: 'worker',
		kind: 'action',
		detail:
			'Validate legal identity and recipient IBAN server-side. Bind the bank connection to the merchant.'
	},
	{
		id: 'configure',
		title: 'Configure checkout',
		layer: 'browser',
		kind: 'action',
		detail:
			'Choose an allowed invoice scenario and checkout presentation. No pilot scenario is selected by this Demo.'
	},
	{
		id: 'invoice',
		title: 'Create invoice',
		layer: 'database',
		kind: 'action',
		detail:
			'Persist short_id, server-owned amount, currency, recipient and immutable checkout snapshot.'
	},
	{
		id: 'share',
		title: 'Share payment link',
		layer: 'browser',
		kind: 'action',
		detail: 'Return the persisted invoice link to the merchant for sharing with the customer.'
	},
	{
		id: 'checkout',
		title: 'Customer opens checkout',
		layer: 'browser',
		kind: 'action',
		detail:
			'Load the authoritative invoice and its configured checkout. Present the amount and recipient.'
	},
	{
		id: 'bank',
		title: 'Authorize in bank',
		layer: 'external',
		kind: 'action',
		detail:
			'Hand off to the payer bank. A browser return or bank launch does not confirm payment; invoice remains pending.'
	},
	{
		id: 'evidence',
		title: 'A-Bank incoming webhook',
		layer: 'worker',
		kind: 'action',
		detail:
			'Receive provider evidence. A-Bank is the first planned adapter; status 70 means successful credit per the confirmed contract.'
	},
	{
		id: 'authenticate',
		title: 'Authentic bank evidence?',
		layer: 'worker',
		kind: 'decision',
		detail:
			'Verify the provider authentication contract before trusting payload fields. Authentication mechanism is still a Live blocker.'
	},
	{
		id: 'reconcile',
		title: 'Credit matches invoice?',
		layer: 'worker',
		kind: 'decision',
		detail:
			'Require status 70, exact purpose = short_id within the trusted bank connection, amount, currency, recipient, unique bank transaction and eligible invoice state. Never fall back to payment_id.'
	},
	{
		id: 'paid',
		title: 'Persist paid + notification intents',
		layer: 'database',
		kind: 'action',
		detail:
			'Target atomic operation: deduplicate bank evidence, confirm the invoice and persist durable intents for configured notification channels. Not implemented by this Demo.'
	},
	{
		id: 'telegram-enabled',
		title: 'Telegram enabled?',
		layer: 'worker',
		kind: 'decision',
		detail:
			'Check the merchant-scoped Telegram destination. This channel is optional and independent of the outgoing webhook.'
	},
	{
		id: 'webhook-enabled',
		title: 'Merchant webhook enabled?',
		layer: 'worker',
		kind: 'decision',
		detail:
			'Check the merchant-scoped outgoing webhook destination, independently of Telegram. This is not the incoming bank webhook.'
	},
	{
		id: 'done',
		title: 'Invoice paid',
		layer: 'browser',
		kind: 'terminal',
		detail:
			'Payment remains confirmed whether notifications are disabled, delivered or retrying. Notification failures never regress paid.'
	}
];

export const merchantPaymentCanvasScenario: FlowScenario = {
	id: 'merchant-payment-demo',
	category: 'Demo journeys',
	label: 'Merchant journey · Demo',
	title: 'Merchant onboarding to confirmed payment and notifications',
	description:
		'Demo blueprint, not a live integration: onboarding, recipient details, configured checkout, A-Bank evidence and optional Telegram / merchant webhook.',
	entrypoint: 'Demo only · no live endpoint',
	nodes: [
		...paymentCanvasSteps.map((step, index): FlowNode => ({
			...step,
			eyebrow: 'Demo blueprint',
			status: 'waiting',
			meta: 'Demo · not connected',
			position: {
				x: 40 + (Math.floor(index / 4) % 2 === 0 ? index % 4 : 3 - (index % 4)) * 380,
				y: 80 + Math.floor(index / 4) * 380
			}
		})),
		...(
			[
				{
					id: 'reject',
					title: 'Reject untrusted event',
					detail: 'Do not change invoice status or notify the merchant.',
					layer: 'worker',
					kind: 'terminal',
					position: { x: 40, y: 1190 }
				},
				{
					id: 'review',
					title: 'No new payment confirmation',
					detail:
						'Unmatched or non-final evidence does not mark paid. A duplicate confirmed transaction is a no-op; discrepancies require review.',
					layer: 'worker',
					kind: 'terminal',
					position: { x: 420, y: 1190 }
				},
				{
					id: 'telegram',
					title: 'Queue Telegram delivery',
					detail:
						'Enqueue the configured Telegram intent with independent delivery tracking and retries. Continue without waiting for delivery.',
					layer: 'external',
					kind: 'action',
					position: { x: 1560, y: 840 }
				},
				{
					id: 'merchant-webhook',
					title: 'Queue merchant webhook',
					detail:
						'Enqueue the configured outgoing webhook intent with its own deduplication and retry state. Continue without waiting for delivery.',
					layer: 'external',
					kind: 'action',
					position: { x: 1560, y: 1220 }
				}
			] satisfies Array<CanvasStep & Pick<FlowNode, 'position'>>
		).map((step): FlowNode => ({
			...step,
			eyebrow: 'Demo blueprint',
			status: 'waiting',
			meta: 'Demo · not connected'
		}))
	],
	edges: [
		...paymentCanvasSteps.slice(0, -1).map((step, index) => ({
			id: `${step.id}-${paymentCanvasSteps[index + 1].id}`,
			source: step.id,
			target: paymentCanvasSteps[index + 1].id,
			label:
				step.kind === 'decision'
					? step.id.endsWith('-enabled')
						? 'disabled / continue'
						: 'verified'
					: undefined
		})),
		{
			id: 'authenticate-reject',
			source: 'authenticate',
			target: 'reject',
			label: 'invalid',
			tone: 'danger'
		},
		{
			id: 'reconcile-review',
			source: 'reconcile',
			target: 'review',
			label: 'not matched / duplicate',
			tone: 'danger'
		},
		{
			id: 'telegram-enabled-telegram',
			source: 'telegram-enabled',
			target: 'telegram',
			label: 'enabled'
		},
		{
			id: 'telegram-webhook-enabled',
			source: 'telegram',
			target: 'webhook-enabled',
			label: 'queued / continue'
		},
		{
			id: 'webhook-enabled-merchant-webhook',
			source: 'webhook-enabled',
			target: 'merchant-webhook',
			label: 'enabled'
		},
		{
			id: 'merchant-webhook-done',
			source: 'merchant-webhook',
			target: 'done',
			label: 'queued / continue'
		}
	]
};
