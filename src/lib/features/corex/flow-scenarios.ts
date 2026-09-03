import { mockFlowEdges as deployEdges, mockFlowNodes as deployNodes } from './mock-flow';
import { extendedFlowScenarios } from './extended-flow-scenarios';
import { ksoSandboxScenario, ksoTargetScenario } from './kso-flow-scenarios';
import { generatedFlowScenarios } from './process-manifest';
import type { FlowEdge, FlowNode, FlowNodeLayer, FlowScenario } from './types';

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

const login: FlowScenario = {
	id: 'login',
	category: 'Access',
	label: 'Login',
	title: 'Google login and session restore',
	description:
		'How a merchant moves from the browser through OAuth to an RLS-scoped Rahunok session.',
	entrypoint: 'GET /corex',
	nodes: [
		node({
			id: 'login-click',
			eyebrow: 'Browser',
			title: 'Sign in with Google',
			detail: 'The user starts OAuth from the protected Rahunok screen.',
			status: 'complete',
			meta: 'user action',
			layer: 'browser',
			request: 'signInWithOAuth()',
			input: 'redirectTo: /corex',
			output: 'OAuth redirect',
			kind: 'trigger',
			x: 40
		}),
		node({
			id: 'supabase-oauth',
			eyebrow: 'Supabase Auth',
			title: 'Create OAuth request',
			detail: 'Supabase creates the authorization request and tracks the callback state.',
			status: 'complete',
			meta: 'PKCE + state',
			layer: 'auth',
			request: 'OAuth authorize',
			operation: 'Persist verifier',
			input: 'provider: google',
			output: '302 Google',
			x: 340
		}),
		node({
			id: 'google-consent',
			eyebrow: 'External',
			title: 'Google consent',
			detail: 'Google authenticates the person and returns an authorization code.',
			status: 'complete',
			meta: 'identity provider',
			layer: 'external',
			request: 'accounts.google.com',
			input: 'OAuth request',
			output: 'authorization code',
			x: 640
		}),
		node({
			id: 'auth-callback',
			eyebrow: 'Supabase Auth',
			title: 'Exchange code',
			detail: 'The callback exchanges the code for a browser session.',
			status: 'complete',
			meta: 'access + refresh token',
			layer: 'auth',
			request: 'GET /corex?code=…',
			operation: 'Verify PKCE',
			output: 'Supabase session',
			x: 940
		}),
		node({
			id: 'restore-session',
			eyebrow: 'Browser',
			title: 'Restore session',
			detail:
				'The dashboard gateway reads the persisted session before rendering protected content.',
			status: 'running',
			meta: 'auth.getSession()',
			layer: 'browser',
			request: 'client.auth.getSession()',
			output: 'user.id + JWT',
			x: 1240
		}),
		node({
			id: 'merchant-profile',
			eyebrow: 'PostgreSQL + RLS',
			title: 'Load merchant',
			detail: 'RLS allows the signed-in user to read only their merchant profile.',
			status: 'waiting',
			meta: 'table: merchants',
			layer: 'database',
			request: 'SELECT merchants',
			operation: 'user_id = auth.uid()',
			input: 'session.user.id',
			output: 'merchant profile',
			x: 1540
		}),
		node({
			id: 'merchant-exists',
			eyebrow: 'Condition',
			title: 'Merchant exists?',
			detail: 'Existing merchants enter Corex; new users continue to onboarding.',
			status: 'waiting',
			meta: 'maybeSingle()',
			layer: 'worker',
			operation: 'Branch by profile',
			kind: 'decision',
			x: 1840
		}),
		node({
			id: 'corex-ready',
			eyebrow: 'Terminal',
			title: 'Corex ready',
			detail: 'The authenticated merchant can inspect backend journeys.',
			status: 'waiting',
			meta: 'status: ready',
			layer: 'browser',
			output: 'protected UI',
			kind: 'terminal',
			x: 2140,
			y: 100
		}),
		node({
			id: 'onboarding',
			eyebrow: 'Browser + DB',
			title: 'Merchant onboarding',
			detail: 'Business details are validated and inserted into merchants.',
			status: 'waiting',
			meta: 'new merchant',
			layer: 'database',
			request: 'POST merchant profile',
			operation: 'INSERT merchants',
			kind: 'terminal',
			x: 2140,
			y: 420
		})
	],
	edges: [
		edge('login-click', 'supabase-oauth'),
		edge('supabase-oauth', 'google-consent'),
		edge('google-consent', 'auth-callback'),
		edge('auth-callback', 'restore-session'),
		edge('restore-session', 'merchant-profile'),
		edge('merchant-profile', 'merchant-exists'),
		edge('merchant-exists', 'corex-ready', 'yes', 'success'),
		edge('merchant-exists', 'onboarding', 'no', 'danger')
	]
};

function invoiceScenario(type: 'fixed' | 'open_amount'): FlowScenario {
	const open = type === 'open_amount';
	return {
		id: type,
		category: 'Invoices',
		label: open ? 'Open amount' : 'Fixed invoice',
		title: open ? 'Create an open-amount payment link' : 'Create a fixed invoice and payment link',
		description:
			'The real dashboard-to-Worker path, database write, NBU QR generation and public share URL.',
		entrypoint: 'POST /api/v1/orders',
		nodes: [
			node({
				id: 'invoice-form',
				eyebrow: 'Browser',
				title: open ? 'Enter link details' : 'Fill invoice form',
				detail: open
					? 'The merchant names a reusable open-amount request.'
					: 'The merchant enters reference, amount and purpose.',
				status: 'complete',
				meta: `type: ${type}`,
				layer: 'browser',
				input: open ? 'title + reference' : 'title + amount + reference',
				kind: 'trigger',
				x: 40
			}),
			node({
				id: 'orders-api',
				eyebrow: 'Worker API',
				title: 'Create order',
				detail: 'The dashboard sends a bearer-authenticated request to the Rahunok Worker.',
				status: 'complete',
				meta: 'HTTP 201',
				layer: 'worker',
				request: 'POST /api/v1/orders',
				input: `{ type: ${type}, … }`,
				output: 'order + share + nbuQr',
				x: 340
			}),
			node({
				id: 'verify-jwt',
				eyebrow: 'Worker',
				title: 'Verify merchant JWT',
				detail: 'The Worker rejects anonymous creation and resolves the authenticated user.',
				status: 'complete',
				meta: 'Authorization: Bearer',
				layer: 'auth',
				operation: 'Verify Supabase JWT',
				output: 'user.id',
				x: 640
			}),
			node({
				id: 'read-merchant',
				eyebrow: 'PostgreSQL',
				title: 'Read payment details',
				detail: 'The Worker loads business name, tax ID and IBAN for the payment payload.',
				status: 'complete',
				meta: 'table: merchants',
				layer: 'database',
				operation: 'SELECT merchants',
				input: 'user_id',
				output: 'IBAN + tax_id',
				x: 940
			}),
			node({
				id: 'build-order',
				eyebrow: 'Worker',
				title: 'Build order payload',
				detail: 'Totals, lifecycle status and the NBU 003 QR payload are generated.',
				status: 'running',
				meta: open ? 'amount supplied later' : 'status: pending',
				layer: 'worker',
				operation: 'Calculate total + NBU QR',
				input: open ? 'amount: 0' : 'base_amount',
				output: 'newOrderPayload',
				x: 1240
			}),
			node({
				id: 'insert-order',
				eyebrow: 'PostgreSQL + RLS',
				title: 'Insert order',
				detail: 'The invoice becomes a durable orders row owned by the merchant.',
				status: 'waiting',
				meta: 'table: orders',
				layer: 'database',
				operation: 'INSERT orders',
				input: 'newOrderPayload',
				output: 'createdOrder.id',
				x: 1540
			}),
			node({
				id: 'share-link',
				eyebrow: 'Worker response',
				title: 'Generate share links',
				detail: open
					? 'The primary short route is /t/:shortId, with /pay/:id as fallback.'
					: 'The primary short route is /o/:shortId, with /pay/:id as fallback.',
				status: 'waiting',
				meta: open ? '/t/:shortId' : '/o/:shortId',
				layer: 'worker',
				operation: 'buildOrderShareData()',
				output: 'web + Telegram + Viber + WhatsApp',
				x: 1840
			}),
			node({
				id: 'invoice-ready',
				eyebrow: 'Terminal',
				title: 'Invoice ready',
				detail: 'Dashboard opens the invoice detail and can copy or share its checkout URL.',
				status: 'waiting',
				meta: 'public checkout link',
				layer: 'browser',
				output: 'redirect to invoice detail',
				kind: 'terminal',
				x: 2140
			})
		],
		edges: [
			edge('invoice-form', 'orders-api'),
			edge('orders-api', 'verify-jwt'),
			edge('verify-jwt', 'read-merchant'),
			edge('read-merchant', 'build-order'),
			edge('build-order', 'insert-order'),
			edge('insert-order', 'share-link'),
			edge('share-link', 'invoice-ready')
		]
	};
}

const tablePos: FlowScenario = {
	id: 'table-pos',
	category: 'POS',
	label: 'Table / POS',
	title: 'Table QR and POS order lifecycle',
	description:
		'How a reusable terminal route resolves a table and creates a customer-specific order.',
	entrypoint: 'GET /tag/:terminalCode',
	nodes: [
		node({
			id: 'scan-tag',
			eyebrow: 'Customer browser',
			title: 'Scan table QR',
			detail: 'A reusable QR opens the terminal route for a table or cash desk.',
			status: 'complete',
			meta: '/tag/table-22',
			layer: 'browser',
			request: 'GET /tag/:code',
			kind: 'trigger',
			x: 40
		}),
		node({
			id: 'edge-resolve',
			eyebrow: 'Cloudflare Worker',
			title: 'Resolve terminal',
			detail: 'The clean route is resolved before the checkout application is served.',
			status: 'complete',
			meta: 'short-route resolver',
			layer: 'worker',
			request: 'GET /tag/:code',
			output: 'terminal + active order',
			x: 340
		}),
		node({
			id: 'terminal-db',
			eyebrow: 'PostgreSQL',
			title: 'Read terminal',
			detail: 'Public RLS resolves only active terminal records by code.',
			status: 'complete',
			meta: 'table: terminals',
			layer: 'database',
			operation: 'SELECT terminals',
			input: 'code + is_active',
			output: 'terminal.id',
			x: 640
		}),
		node({
			id: 'active-order',
			eyebrow: 'PostgreSQL',
			title: 'Find active order',
			detail: 'The backend looks for the latest payable order attached to this terminal.',
			status: 'running',
			meta: 'table: orders',
			layer: 'database',
			operation: 'SELECT orders',
			input: 'terminal_id + active status',
			output: 'order or empty',
			x: 940
		}),
		node({
			id: 'has-order',
			eyebrow: 'Condition',
			title: 'Active order?',
			detail: 'An existing order opens checkout; otherwise the merchant creates one in POS.',
			status: 'waiting',
			meta: 'branch',
			layer: 'worker',
			kind: 'decision',
			x: 1240
		}),
		node({
			id: 'pos-create',
			eyebrow: 'Merchant POS',
			title: 'Create table order',
			detail: 'POS inserts a table order with preparing status and terminal ownership.',
			status: 'waiting',
			meta: 'type: table',
			layer: 'database',
			operation: 'INSERT orders',
			input: 'terminal_id + table_number',
			output: 'status: preparing',
			x: 1540,
			y: 420
		}),
		node({
			id: 'table-checkout',
			eyebrow: 'Customer browser',
			title: 'Open checkout',
			detail: 'The one-time /pos/:id receipt or reusable table route displays the payable order.',
			status: 'waiting',
			meta: '/pos/:shortId',
			layer: 'browser',
			output: 'checkout UI',
			kind: 'terminal',
			x: 1540,
			y: 100
		})
	],
	edges: [
		edge('scan-tag', 'edge-resolve'),
		edge('edge-resolve', 'terminal-db'),
		edge('terminal-db', 'active-order'),
		edge('active-order', 'has-order'),
		edge('has-order', 'table-checkout', 'yes', 'success'),
		edge('has-order', 'pos-create', 'no', 'danger'),
		edge('pos-create', 'table-checkout')
	]
};

const payment: FlowScenario = {
	id: 'payment',
	category: 'Payments',
	label: 'Payment',
	title: 'Public checkout and payment confirmation',
	description:
		'From opening a share URL to bank redirect, webhook processing and dashboard realtime update.',
	entrypoint: 'GET /pay/:orderId',
	nodes: [
		node({
			id: 'open-link',
			eyebrow: 'Customer browser',
			title: 'Open payment link',
			detail: 'The customer opens /o, /t, /pos or the canonical /pay route.',
			status: 'complete',
			meta: 'public route',
			layer: 'browser',
			request: 'GET /pay/:orderId',
			kind: 'trigger',
			x: 40
		}),
		node({
			id: 'checkout-api',
			eyebrow: 'Worker API',
			title: 'Load checkout',
			detail: 'The public checkout API returns only an active payable order.',
			status: 'complete',
			meta: 'public endpoint',
			layer: 'worker',
			request: 'GET /api/v1/checkout/:id',
			output: 'order + merchant',
			x: 340
		}),
		node({
			id: 'checkout-db',
			eyebrow: 'PostgreSQL + RLS',
			title: 'Read active order',
			detail: 'Public RLS permits pending, preparing, ready and paid orders.',
			status: 'complete',
			meta: 'table: orders',
			layer: 'database',
			operation: 'SELECT orders',
			input: 'id or order_number',
			output: 'checkout model',
			x: 640
		}),
		node({
			id: 'select-bank',
			eyebrow: 'Customer browser',
			title: 'Select bank',
			detail: 'The payer chooses a supported bank and confirms the payment action.',
			status: 'running',
			meta: 'bank_code',
			layer: 'browser',
			input: 'bank + captcha token',
			x: 940
		}),
		node({
			id: 'initiate-api',
			eyebrow: 'Worker API',
			title: 'Initiate payment',
			detail: 'The Worker validates the request and resolves the bank deep-link target.',
			status: 'waiting',
			meta: 'payment_initiated',
			layer: 'worker',
			request: 'POST /api/v1/checkout/:id/initiate',
			output: 'redirect_url',
			x: 1240
		}),
		node({
			id: 'bank-app',
			eyebrow: 'External bank',
			title: 'Bank payment',
			detail: 'The bank app or web page executes the transfer outside Rahunok.',
			status: 'waiting',
			meta: 'external handoff',
			layer: 'external',
			request: 'bank deep link',
			output: 'bank transaction',
			x: 1540
		}),
		node({
			id: 'webhook',
			eyebrow: 'Worker API',
			title: 'Receive webhook',
			detail: 'The bank calls the protected ingestion endpoint with its payment result.',
			status: 'waiting',
			meta: 'signed callback',
			layer: 'worker',
			request: 'POST /api/v1/webhooks/:bank',
			input: 'status + reference',
			x: 1840
		}),
		node({
			id: 'payment-update',
			eyebrow: 'PostgreSQL',
			title: 'Persist result',
			detail: 'Order status, payment reference, webhook log and timeline event are stored.',
			status: 'waiting',
			meta: 'atomic lifecycle',
			layer: 'database',
			operation: 'UPDATE orders + INSERT events',
			output: 'paid or failed',
			x: 2140
		}),
		node({
			id: 'paid',
			eyebrow: 'Realtime',
			title: 'Dashboard updates',
			detail: 'Supabase Realtime refreshes the invoice and the customer status poll completes.',
			status: 'waiting',
			meta: 'payment_succeeded',
			layer: 'browser',
			output: 'paid UI',
			kind: 'terminal',
			x: 2440,
			y: 100
		}),
		node({
			id: 'failed',
			eyebrow: 'Recovery',
			title: 'Payment failed',
			detail: 'The order remains payable and the failure is visible in its event timeline.',
			status: 'waiting',
			meta: 'retry available',
			layer: 'browser',
			output: 'failed event',
			kind: 'terminal',
			x: 2440,
			y: 420
		})
	],
	edges: [
		edge('open-link', 'checkout-api'),
		edge('checkout-api', 'checkout-db'),
		edge('checkout-db', 'select-bank'),
		edge('select-bank', 'initiate-api'),
		edge('initiate-api', 'bank-app'),
		edge('bank-app', 'webhook'),
		edge('webhook', 'payment-update'),
		edge('payment-update', 'paid', 'success', 'success'),
		edge('payment-update', 'failed', 'failed', 'danger')
	]
};

const deploy: FlowScenario = {
	id: 'deploy',
	category: 'Operations',
	label: 'Deploy',
	title: 'Build, review and protected deployment',
	description:
		'The existing isolated release pipeline. Mutation controls remain locked until readiness is explicitly approved.',
	entrypoint: 'release request',
	nodes: deployNodes.map((item) => ({
		...item,
		layer:
			item.id === 'publish' || item.id === 'health'
				? ('deploy' as FlowNodeLayer)
				: (item.layer ?? 'deploy')
	})),
	edges: deployEdges
};

export const rahunokFlowScenarios: FlowScenario[] = [
	login,
	...extendedFlowScenarios,
	invoiceScenario('fixed'),
	invoiceScenario('open_amount'),
	tablePos,
	payment,
	ksoSandboxScenario,
	ksoTargetScenario,
	deploy
];

export const flowScenarios: FlowScenario[] = [...rahunokFlowScenarios, ...generatedFlowScenarios];
