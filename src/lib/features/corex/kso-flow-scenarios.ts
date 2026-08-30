import type { FlowEdge, FlowNode, FlowScenario } from './types';

type NodeInput = Omit<FlowNode, 'kind' | 'position'> & {
	kind?: FlowNode['kind'];
	x: number;
	y?: number;
};

function node({ x, y = 240, kind = 'action', ...value }: NodeInput): FlowNode {
	return { ...value, kind, position: { x, y } };
}

function edge(source: string, target: string, label?: string, tone?: FlowEdge['tone']): FlowEdge {
	return { id: `${source}-${target}`, source, target, label, tone };
}

export const ksoSandboxScenario: FlowScenario = {
	id: 'kso-sandbox', category: 'POS', label: 'KSO sandbox', title: 'Isolated KSO callback simulation',
	description: 'The implemented dashboard sandbox creates and verifies a synthetic signed payment event without calling production services or storage.', entrypoint: 'POST /dashboard/api/sandbox/simulate',
	nodes: [
		node({ id: 'sandbox-action', eyebrow: 'Dashboard', title: 'Simulate payment', detail: 'The merchant starts a model payment from the dedicated sandbox screen.', status: 'complete', meta: '/dashboard/sandbox', layer: 'browser', request: 'POST /dashboard/api/sandbox/simulate', kind: 'trigger', x: 40 }),
		node({ id: 'dashboard-router', eyebrow: 'Dashboard Worker', title: 'Intercept sandbox route', detail: 'The dashboard Worker handles the sandbox path locally before the production Rahunok service binding.', status: 'complete', meta: 'no API binding call', layer: 'worker', operation: 'routeSandboxRequest()', input: 'POST request', output: 'sandbox result', x: 340 }),
		node({ id: 'synthetic-event', eyebrow: 'Web Crypto', title: 'Create payment event', detail: 'Generate random delivery and payment identifiers for a synthetic payment.succeeded event.', status: 'complete', meta: '125.00 UAH · UNJS', layer: 'worker', operation: 'simulateSandboxPayment()', output: 'SandboxEvent', x: 640 }),
		node({ id: 'sign-callback', eyebrow: 'HMAC-SHA256', title: 'Sign callback payload', detail: 'A per-request secret signs the canonical timestamp and serialized event body.', status: 'complete', meta: 'timestamp.body', layer: 'worker', operation: 'crypto.subtle.sign()', input: 'ephemeral secret + payload', output: 'v1 signature', x: 940 }),
		node({ id: 'verify-callback', eyebrow: 'HMAC-SHA256', title: 'Verify callback signature', detail: 'The Worker verifies the exact callback bytes before returning the modeled delivery.', status: 'running', meta: 'crypto.subtle.verify()', layer: 'worker', operation: 'verifySandboxCallback()', input: 'timestamp + body + signature', output: 'verified: boolean', x: 1240 }),
		node({ id: 'isolation-guard', eyebrow: 'Safety boundary', title: 'Keep production isolated', detail: 'The simulation performs no Supabase, KV, settlement, invoice, payout or bank mutation.', status: 'complete', meta: 'stateless · no-store', layer: 'worker', operation: 'Return JSON only', output: 'no durable writes', x: 1540 }),
		node({ id: 'sandbox-result', eyebrow: 'Dashboard', title: 'Show callback result', detail: 'The page displays verification status and keeps at most ten results in the current browser session.', status: 'waiting', meta: 'current tab only', layer: 'browser', output: 'verified event journal', kind: 'terminal', x: 1840 })
	],
	edges: [edge('sandbox-action', 'dashboard-router'), edge('dashboard-router', 'synthetic-event'), edge('synthetic-event', 'sign-callback'), edge('sign-callback', 'verify-callback'), edge('verify-callback', 'isolation-guard', 'verified', 'success'), edge('isolation-guard', 'sandbox-result')]
};

export const ksoTargetScenario: FlowScenario = {
	id: 'kso-target', category: 'POS', label: 'KSO target flow', title: 'KSO identity, loyalty and Pay by Bank target flow',
	description: 'Planned network-neutral process from KSO customer context through loyalty quotation and checkout to authoritative incoming-credit confirmation.', entrypoint: 'POST /kso/customer-sessions',
	nodes: [
		node({ id: 'kso-identify', eyebrow: 'Third-party KSO', title: 'Present customer context', detail: 'A terminal submits an opaque Wallet or network loyalty identifier; the identifier alone never authorizes payment.', status: 'blocked', meta: 'planned partner API', layer: 'external', request: 'POST /kso/customer-sessions', input: 'network + terminal + opaque token', kind: 'trigger', x: 40 }),
		node({ id: 'customer-session', eyebrow: 'KSO adapter', title: 'Resolve customer session', detail: 'A network adapter validates partner context and creates a short-lived KSO customer session.', status: 'blocked', meta: 'planned · no production route', layer: 'worker', operation: 'createKsoCustomerSession', output: 'customer session', x: 340 }),
		node({ id: 'loyalty-quote', eyebrow: 'Loyalty adapter', title: 'Quote basket benefits', detail: 'The retail network remains authoritative for discounts and rewards applied to the basket.', status: 'blocked', meta: 'network-authoritative', layer: 'external', request: 'POST /kso/customer-sessions/:id/quote', input: 'basket + loyalty proof', output: 'final amount', x: 640 }),
		node({ id: 'checkout-request', eyebrow: 'Rahunok Worker', title: 'Create checkout request', detail: 'Create an idempotent, network-neutral Pay by Bank checkout for the final quoted amount.', status: 'blocked', meta: 'planned contract', layer: 'worker', request: 'POST /kso/checkout-requests', input: 'session + order + final amount', output: 'QR, NFC or mobile presentation', x: 940 }),
		node({ id: 'presentation', eyebrow: 'KSO / mobile', title: 'Present payment', detail: 'The KSO displays a dynamic QR, resolves a static NFC tag or pushes the checkout to a linked mobile client.', status: 'blocked', meta: 'qr · nfc · mobile_push', layer: 'browser', output: 'bank handoff', x: 1240 }),
		node({ id: 'bank-authorize', eyebrow: 'Customer bank', title: 'Authorize Pay by Bank', detail: 'Payment authorization happens in the selected bank, never from a scanned loyalty or Wallet identifier.', status: 'blocked', meta: 'external authorization', layer: 'external', output: 'incoming credit', x: 1540 }),
		node({ id: 'credit-confirmation', eyebrow: 'Settlement webhook', title: 'Confirm incoming credit', detail: 'Only a verified incoming-credit event may transition the checkout to paid.', status: 'blocked', meta: 'authoritative paid transition', layer: 'worker', input: 'signed bank event', output: 'payment.succeeded', x: 1840 }),
		node({ id: 'notify-clients', eyebrow: 'Rahunok', title: 'Notify KSO and customer', detail: 'Polling, callback and realtime channels report the confirmed terminal state without becoming payment authority.', status: 'blocked', meta: 'planned delivery contract', layer: 'worker', output: 'paid status', kind: 'terminal', x: 2140 })
	],
	edges: [edge('kso-identify', 'customer-session'), edge('customer-session', 'loyalty-quote'), edge('loyalty-quote', 'checkout-request'), edge('checkout-request', 'presentation'), edge('presentation', 'bank-authorize'), edge('bank-authorize', 'credit-confirmation'), edge('credit-confirmation', 'notify-clients', 'verified credit', 'success')]
};