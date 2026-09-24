import type { FlowEdge, FlowNode, FlowScenario } from './types';

type DemoNode = Pick<FlowNode, 'id' | 'title' | 'detail' | 'layer' | 'kind'> & {
	position: FlowNode['position'];
};

function demoNode(input: DemoNode): FlowNode {
	return { ...input, eyebrow: 'Demo blueprint', status: 'waiting', meta: 'Demo · not connected' };
}

function demoEdge(
	source: string,
	target: string,
	label?: string,
	tone?: FlowEdge['tone']
): FlowEdge {
	return { id: `${source}-${target}`, source, target, label, tone };
}

export const terminalCashOrderCanvasScenario: FlowScenario = {
	id: 'terminal-cash-order-demo',
	category: 'Demo journeys',
	label: 'Terminal & cash desk · New order',
	title: 'Draft order to bank confirmation and merchant webhook',
	description:
		'Demo blueprint: select a table or cash desk for a local draft, create its linked invoice, then model proposed bank confirmation and optional merchant notification. Cancellation is a separate POS exit.',
	entrypoint: 'Demo only · select a table or cash desk',
	nodes: [
		demoNode({
			id: 'cash-draft',
			title: 'Select table / cash desk',
			detail:
				'Dashboard selects an active table or cash desk and opens its local, terminal-specific draft. Switching points retains each local draft; nothing is assigned on the server yet.',
			layer: 'browser',
			kind: 'trigger',
			position: { x: 40, y: 100 }
		}),
		demoNode({
			id: 'order-details',
			title: 'Fill or clear local draft',
			detail:
				'Enter an amount or items, then review the selected point and total. Clear resets only this local draft; closing it does not cancel a persisted order. No payable link exists yet.',
			layer: 'browser',
			kind: 'action',
			position: { x: 400, y: 100 }
		}),
		demoNode({
			id: 'submit',
			title: 'Create order for selected point',
			detail:
				'Dashboard requires an active point, positive amount and no pending order for the same terminal before posting the TABLE-type POS invoice. Kasa has no expiry; table uses its configured TTL. This Demo does not change server authorization or locked invoice scenarios.',
			layer: 'worker',
			kind: 'action',
			position: { x: 760, y: 100 }
		}),
		demoNode({
			id: 'persist',
			title: 'Persist terminal-linked invoice',
			detail:
				'Dashboard POSTs a pending POS order with terminal_id, amount and expiry; terminal identity is fixed for the invoice. The proposed bank flow must reconcile against persisted short_id, actual recipient and checkout configuration.',
			layer: 'database',
			kind: 'action',
			position: { x: 1120, y: 100 }
		}),
		demoNode({
			id: 'pos-actions',
			title: 'Pending order: pay or cancel?',
			detail:
				'Dashboard shows pending, preparing and ready as unpaid. The POS board offers cash payment or cancellation; it blocks another pending order for this point. Bank payment below is a proposed extension, not a current POS action.',
			layer: 'browser',
			kind: 'decision',
			position: { x: 1480, y: 100 }
		}),
		demoNode({
			id: 'pos-cancel',
			title: 'Cancel order; point reusable',
			detail:
				'Current Dashboard asks for confirmation, PATCHes the order to cancelled and refreshes the board. No separate unassign action exists; the terminal_id remains on the old order, while a new draft can use the point.',
			layer: 'browser',
			kind: 'terminal',
			position: { x: 1480, y: 400 }
		}),
		demoNode({
			id: 'pos-cash',
			title: 'Cash paid; point reusable',
			detail:
				'Current Dashboard marks the order paid with bank code CASH and refreshes the board; the paid receipt stays accessible and a new local draft can open on the same point. This bypasses bank and merchant webhooks.',
			layer: 'browser',
			kind: 'terminal',
			position: { x: 1480, y: 720 }
		}),
		demoNode({
			id: 'link',
			title: 'Show payment link / QR',
			detail:
				'The linked invoice can be opened from Dashboard. The proposed bank path exposes its payment link / QR for checkout; a displayed QR is not payment evidence.',
			layer: 'browser',
			kind: 'action',
			position: { x: 1120, y: 400 }
		}),
		demoNode({
			id: 'bank-handoff',
			title: 'Customer authorizes at bank',
			detail:
				'The customer authorizes payment in a bank app. A browser return or handoff leaves the invoice pending.',
			layer: 'external',
			kind: 'action',
			position: { x: 760, y: 400 }
		}),
		demoNode({
			id: 'bank-webhook',
			title: 'Receive incoming bank webhook',
			detail:
				'A-Bank is the first planned provider; its status 70 represents successful credit only after the sender is authenticated. Other banks require their own adapters.',
			layer: 'worker',
			kind: 'action',
			position: { x: 400, y: 400 }
		}),
		demoNode({
			id: 'authenticate',
			title: 'Authenticate bank event?',
			detail:
				'Verify the bank connection and provider authentication before trusting any field. A-Bank webhook authentication is not yet established for Live.',
			layer: 'worker',
			kind: 'decision',
			position: { x: 40, y: 400 }
		}),
		demoNode({
			id: 'reconcile',
			title: 'Credit matches order?',
			detail:
				'Require final provider status, purpose = invoice short_id, exact amount, currency, recipient, unique bank transaction and eligible invoice state. Never substitute payment_id.',
			layer: 'worker',
			kind: 'decision',
			position: { x: 40, y: 720 }
		}),
		demoNode({
			id: 'confirm',
			title: 'Confirm invoice atomically',
			detail:
				'Target behavior: deduplicate evidence and persist the paid transition with a durable outgoing notification intent. This Demo performs no financial writes.',
			layer: 'database',
			kind: 'action',
			position: { x: 400, y: 720 }
		}),
		demoNode({
			id: 'webhook-configured',
			title: 'Merchant webhook configured?',
			detail:
				'An outgoing merchant webhook is optional and separate from the incoming bank webhook. Use a verified merchant-scoped destination.',
			layer: 'worker',
			kind: 'decision',
			position: { x: 760, y: 720 }
		}),
		demoNode({
			id: 'notify',
			title: 'Queue merchant webhook',
			detail:
				'Deliver a signed payment-confirmed event with stable event ID, independent retries and redacted payer data. Receiver HTTP 200 does not change bank evidence.',
			layer: 'external',
			kind: 'action',
			position: { x: 1120, y: 720 }
		}),
		demoNode({
			id: 'paid',
			title: 'Paid; track delivery separately',
			detail:
				'In the proposed bank path the invoice stays paid even if merchant delivery fails. Once paid, the POS point can take a new draft; the old invoice keeps its terminal_id.',
			layer: 'browser',
			kind: 'terminal',
			position: { x: 1120, y: 1040 }
		}),
		demoNode({
			id: 'untrusted',
			title: 'Reject untrusted event',
			detail: 'Do not mark the invoice paid or send a merchant notification.',
			layer: 'worker',
			kind: 'terminal',
			position: { x: 400, y: 1040 }
		}),
		demoNode({
			id: 'review',
			title: 'Pending / manual review',
			detail:
				'Unknown or mismatched evidence cannot confirm payment. Duplicate confirmed transactions are no-ops; discrepancies require review.',
			layer: 'worker',
			kind: 'terminal',
			position: { x: 40, y: 1040 }
		})
	],
	edges: [
		demoEdge('cash-draft', 'order-details'),
		demoEdge('order-details', 'submit'),
		demoEdge('submit', 'persist'),
		demoEdge('persist', 'pos-actions'),
		demoEdge('pos-actions', 'pos-cancel', 'cancel', 'danger'),
		demoEdge('pos-actions', 'pos-cash', 'cash paid', 'success'),
		demoEdge('pos-actions', 'link', 'proposed bank payment'),
		demoEdge('link', 'bank-handoff'),
		demoEdge('bank-handoff', 'bank-webhook'),
		demoEdge('bank-webhook', 'authenticate'),
		demoEdge('authenticate', 'reconcile', 'authenticated', 'success'),
		demoEdge('authenticate', 'untrusted', 'invalid', 'danger'),
		demoEdge('reconcile', 'confirm', 'matched', 'success'),
		demoEdge('reconcile', 'review', 'not matched / duplicate', 'danger'),
		demoEdge('confirm', 'webhook-configured'),
		demoEdge('webhook-configured', 'notify', 'enabled', 'success'),
		demoEdge('webhook-configured', 'paid', 'disabled'),
		demoEdge('notify', 'paid', 'queued / continue')
	]
};
