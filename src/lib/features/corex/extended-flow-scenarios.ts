import type { FlowEdge, FlowNode, FlowScenario } from './types';

type NodeInput = Omit<FlowNode, 'kind' | 'position'> & {
	kind?: FlowNode['kind'];
	x: number;
	y?: number;
};

function node({ x, y = 220, kind = 'action', ...value }: NodeInput): FlowNode {
	return { ...value, kind, position: { x, y } };
}

function edge(source: string, target: string, label?: string, tone?: FlowEdge['tone']): FlowEdge {
	return { id: `${source}-${target}-${label ?? 'next'}`, source, target, label, tone };
}

const onboarding: FlowScenario = {
	id: 'onboarding',
	category: 'Access',
	label: 'Onboarding',
	title: 'Merchant onboarding and validation',
	description:
		'Business profile creation after login, including validation and authorization failures.',
	entrypoint: 'POST /api/v1/merchant/onboarding',
	nodes: [
		node({
			id: 'form',
			eyebrow: 'Browser',
			title: 'Business details',
			detail: 'Collect business name, legal type, tax ID, display name, bank and IBAN.',
			status: 'complete',
			meta: 'merchant form',
			layer: 'browser',
			input: 'businessName + taxId + IBAN',
			kind: 'trigger',
			x: 40
		}),
		node({
			id: 'valid',
			eyebrow: 'Condition',
			title: 'Fields valid?',
			detail: 'Required fields and the 29-character Ukrainian IBAN are checked.',
			status: 'complete',
			meta: 'client + server',
			layer: 'worker',
			kind: 'decision',
			x: 340
		}),
		node({
			id: 'api',
			eyebrow: 'Worker API',
			title: 'Submit profile',
			detail: 'Bearer JWT identifies the owner.',
			status: 'running',
			meta: 'protected',
			layer: 'worker',
			request: 'POST /api/v1/merchant/onboarding',
			x: 640
		}),
		node({
			id: 'upsert',
			eyebrow: 'PostgreSQL',
			title: 'Upsert merchant',
			detail: 'Create one merchant row for the Supabase user.',
			status: 'waiting',
			meta: 'merchants',
			layer: 'database',
			operation: 'UPSERT merchants ON user_id',
			x: 940
		}),
		node({
			id: 'done',
			eyebrow: 'Terminal',
			title: 'Dashboard ready',
			detail: 'Session restore now resolves to ready.',
			status: 'waiting',
			meta: '200',
			layer: 'browser',
			kind: 'terminal',
			x: 1240,
			y: 80
		}),
		node({
			id: 'invalid',
			eyebrow: 'Error',
			title: 'Fix form',
			detail: 'Missing fields or invalid IBAN remain in onboarding.',
			status: 'failed',
			meta: '400 / 422',
			layer: 'browser',
			kind: 'terminal',
			x: 640,
			y: 450
		}),
		node({
			id: 'denied',
			eyebrow: 'Error',
			title: 'Sign in again',
			detail: 'Expired or absent JWT cannot create a merchant.',
			status: 'failed',
			meta: '401 / 403',
			layer: 'auth',
			kind: 'terminal',
			x: 940,
			y: 560
		})
	],
	edges: [
		edge('form', 'valid'),
		edge('valid', 'api', 'valid', 'success'),
		edge('valid', 'invalid', 'invalid', 'danger'),
		edge('api', 'upsert', 'authorized', 'success'),
		edge('api', 'denied', '401 / 403', 'danger'),
		edge('upsert', 'done')
	]
};

const pwaBoot: FlowScenario = {
	id: 'pwa-boot',
	category: 'PWA',
	label: 'PWA boot',
	title: 'PWA shell, offline cache and update',
	description:
		'The /app service worker uses network-first navigation, cached shell fallback and explicit updates.',
	entrypoint: 'GET /app/',
	nodes: [
		node({
			id: 'open',
			eyebrow: 'Browser',
			title: 'Open /app/',
			detail: 'Load the installable merchant app inside its manifest scope.',
			status: 'complete',
			meta: '/app scope',
			layer: 'browser',
			request: 'GET /app/',
			kind: 'trigger',
			x: 40
		}),
		node({
			id: 'controlled',
			eyebrow: 'Condition',
			title: 'SW controls page?',
			detail: 'First visit registers sw.js; installed visits pass through it.',
			status: 'complete',
			meta: 'serviceWorker',
			layer: 'worker',
			kind: 'decision',
			x: 340
		}),
		node({
			id: 'network',
			eyebrow: 'Service Worker',
			title: 'Network-first fetch',
			detail: 'Navigation and assets prefer fresh responses; API and auth bypass cache.',
			status: 'running',
			meta: 'network first',
			layer: 'worker',
			operation: 'fetch(request)',
			x: 640
		}),
		node({
			id: 'online',
			eyebrow: 'Condition',
			title: 'Network available?',
			detail: 'Success refreshes cache; failure attempts cached shell.',
			status: 'waiting',
			meta: 'online / offline',
			layer: 'worker',
			kind: 'decision',
			x: 940
		}),
		node({
			id: 'fresh',
			eyebrow: 'Terminal',
			title: 'Render fresh app',
			detail: 'Start auth and merchant data loading.',
			status: 'waiting',
			meta: 'online',
			layer: 'browser',
			kind: 'terminal',
			x: 1240,
			y: 60
		}),
		node({
			id: 'cached',
			eyebrow: 'Recovery',
			title: 'Render cached shell',
			detail: 'Offline shell starts without caching private API responses.',
			status: 'waiting',
			meta: 'offline fallback',
			layer: 'browser',
			kind: 'terminal',
			x: 1240,
			y: 340
		}),
		node({
			id: 'register',
			eyebrow: 'Browser',
			title: 'Register and precache',
			detail: 'Cache app shell, manifest and icons; clean old cache versions.',
			status: 'waiting',
			meta: 'install / activate',
			layer: 'browser',
			request: 'register(/app/sw.js)',
			x: 640,
			y: 560
		}),
		node({
			id: 'update',
			eyebrow: 'Terminal',
			title: 'Activate update',
			detail: 'A waiting worker updates after user approval and controllerchange.',
			status: 'waiting',
			meta: 'updatefound',
			layer: 'worker',
			kind: 'terminal',
			x: 940,
			y: 560
		})
	],
	edges: [
		edge('open', 'controlled'),
		edge('controlled', 'network', 'yes', 'success'),
		edge('controlled', 'register', 'no'),
		edge('register', 'network'),
		edge('register', 'update'),
		edge('network', 'online'),
		edge('online', 'fresh', 'yes', 'success'),
		edge('online', 'cached', 'no', 'danger')
	]
};

function orderCreation(type: 'table' | 'delivery'): FlowScenario {
	return {
		id: `create-${type}`,
		category: 'Invoices',
		label: type === 'table' ? 'Table invoice' : 'Delivery invoice',
		title: `Create ${type} invoice`,
		description:
			'Typed dashboard request, JWT and merchant guard, total calculation, persistence and share response.',
		entrypoint: 'POST /api/v1/orders',
		nodes: [
			node({
				id: 'draft',
				eyebrow: 'Dashboard / PWA',
				title: 'Build draft',
				detail: 'Merchant enters scenario-specific fields and amount.',
				status: 'complete',
				meta: `type: ${type}`,
				layer: 'browser',
				input: type === 'table' ? 'table + terminal + amount' : 'items + delivery fee',
				kind: 'trigger',
				x: 40
			}),
			node({
				id: 'valid',
				eyebrow: 'Condition',
				title: 'Draft valid?',
				detail: 'Required fields and non-negative total are checked.',
				status: 'complete',
				meta: 'validation',
				layer: 'browser',
				kind: 'decision',
				x: 340
			}),
			node({
				id: 'api',
				eyebrow: 'Worker API',
				title: 'Create order',
				detail: 'Send the normalized draft with Bearer JWT.',
				status: 'running',
				meta: '201 expected',
				layer: 'worker',
				request: 'POST /api/v1/orders',
				input: `{ type: ${type}, ... }`,
				x: 640
			}),
			node({
				id: 'auth',
				eyebrow: 'Condition',
				title: 'JWT and merchant valid?',
				detail: 'Anonymous or unconfigured merchants are rejected.',
				status: 'waiting',
				meta: 'requireAuth()',
				layer: 'auth',
				kind: 'decision',
				x: 940
			}),
			node({
				id: 'calculate',
				eyebrow: 'Worker',
				title: 'Calculate order',
				detail: 'Total, lifecycle status and NBU 003 data are generated.',
				status: 'waiting',
				meta: type === 'table' ? 'preparing' : 'pending',
				layer: 'worker',
				operation: 'max(0, base - discount + delivery)',
				x: 1240
			}),
			node({
				id: 'insert',
				eyebrow: 'PostgreSQL',
				title: 'Persist order',
				detail: 'Store order and optional items.',
				status: 'waiting',
				meta: 'orders + items',
				layer: 'database',
				operation: 'INSERT orders; INSERT order_items',
				x: 1540
			}),
			node({
				id: 'ready',
				eyebrow: 'Terminal',
				title: 'Invoice ready',
				detail: 'Return order, NBU QR and share metadata.',
				status: 'waiting',
				meta: '201',
				layer: 'browser',
				kind: 'terminal',
				x: 1840,
				y: 60
			}),
			node({
				id: 'invalid',
				eyebrow: 'Error',
				title: 'Correct draft',
				detail: 'Invalid input stays in the form.',
				status: 'failed',
				meta: '400 / 422',
				layer: 'browser',
				kind: 'terminal',
				x: 640,
				y: 500
			}),
			node({
				id: 'denied',
				eyebrow: 'Error',
				title: 'Creation blocked',
				detail: 'Auth, merchant or database failure creates no shareable invoice.',
				status: 'failed',
				meta: '401 / 404 / 500',
				layer: 'worker',
				kind: 'terminal',
				x: 1540,
				y: 500
			})
		],
		edges: [
			edge('draft', 'valid'),
			edge('valid', 'api', 'yes', 'success'),
			edge('valid', 'invalid', 'no', 'danger'),
			edge('api', 'auth'),
			edge('auth', 'calculate', 'yes', 'success'),
			edge('auth', 'denied', 'no', 'danger'),
			edge('calculate', 'insert'),
			edge('insert', 'ready', 'stored', 'success'),
			edge('insert', 'denied', 'failed', 'danger')
		]
	};
}

const shortRoutes: FlowScenario = {
	id: 'short-routes',
	category: 'Routing',
	label: 'Short URLs',
	title: 'Resolve public and shortened addresses',
	description: '/o, /t, /tag, /pos, /pay and /checkout resolve orders or reusable terminals.',
	entrypoint: 'GET /o|t|tag|pos|pay|checkout/:id',
	nodes: [
		node({
			id: 'url',
			eyebrow: 'Customer browser',
			title: 'Open public URL',
			detail: 'Path, query or hash carries an order or terminal identifier.',
			status: 'complete',
			meta: 'public alias',
			layer: 'browser',
			request: 'GET public route',
			kind: 'trigger',
			x: 40
		}),
		node({
			id: 'kind',
			eyebrow: 'Condition',
			title: 'Order or terminal?',
			detail: 'o/pay/checkout use order lookup; t/tag/pos can resolve terminal code.',
			status: 'complete',
			meta: 'router',
			layer: 'worker',
			kind: 'decision',
			x: 340
		}),
		node({
			id: 'order',
			eyebrow: 'PostgreSQL',
			title: 'Resolve order',
			detail: 'Try UUID, six-character short_id, then latest order_number.',
			status: 'running',
			meta: 'orders',
			layer: 'database',
			operation: 'SELECT by id | short_id | order_number',
			x: 640,
			y: 60
		}),
		node({
			id: 'terminal',
			eyebrow: 'PostgreSQL',
			title: 'Resolve terminal',
			detail: 'Find active terminal code and newest pending order.',
			status: 'running',
			meta: 'terminals → orders',
			layer: 'database',
			operation: 'SELECT terminal; SELECT latest pending',
			x: 640,
			y: 400
		}),
		node({
			id: 'found',
			eyebrow: 'Condition',
			title: 'Resource found?',
			detail: 'Resolved order hydrates checkout; missing alias terminates.',
			status: 'waiting',
			meta: 'lookup',
			layer: 'worker',
			kind: 'decision',
			x: 940,
			y: 60
		}),
		node({
			id: 'active',
			eyebrow: 'Condition',
			title: 'Active table order?',
			detail: 'Existing bill opens checkout; empty terminal waits for POS.',
			status: 'waiting',
			meta: 'pending?',
			layer: 'worker',
			kind: 'decision',
			x: 940,
			y: 400
		}),
		node({
			id: 'hydrate',
			eyebrow: 'Worker',
			title: 'Hydrate checkout',
			detail: 'Inject initial order and bank data with no-store.',
			status: 'waiting',
			meta: '__INITIAL_ORDER__',
			layer: 'worker',
			operation: 'Inject checkout HTML',
			x: 1240,
			y: 100
		}),
		node({
			id: 'wait',
			eyebrow: 'Terminal',
			title: 'Wait for table order',
			detail: 'Reusable terminal shows preparing until POS creates a bill.',
			status: 'waiting',
			meta: 'empty terminal',
			layer: 'browser',
			kind: 'terminal',
			x: 1240,
			y: 420
		}),
		node({
			id: 'ready',
			eyebrow: 'Terminal',
			title: 'Checkout ready',
			detail: 'Render the resolved payment scenario.',
			status: 'waiting',
			meta: '200',
			layer: 'browser',
			kind: 'terminal',
			x: 1540,
			y: 100
		}),
		node({
			id: 'missing',
			eyebrow: 'Error',
			title: 'Link unavailable',
			detail: 'Definitive 404 shows not found/expired and no fabricated order.',
			status: 'failed',
			meta: '404',
			layer: 'browser',
			kind: 'terminal',
			x: 1240,
			y: 680
		})
	],
	edges: [
		edge('url', 'kind'),
		edge('kind', 'order', 'order'),
		edge('kind', 'terminal', 'terminal'),
		edge('order', 'found'),
		edge('found', 'hydrate', 'yes', 'success'),
		edge('found', 'missing', 'no', 'danger'),
		edge('terminal', 'active'),
		edge('active', 'hydrate', 'yes', 'success'),
		edge('active', 'wait', 'no'),
		edge('hydrate', 'ready')
	]
};

function checkout(type: 'fixed' | 'open_amount' | 'table' | 'delivery'): FlowScenario {
	const labels = {
		fixed: 'Fixed checkout',
		open_amount: 'Open checkout',
		table: 'Table checkout',
		delivery: 'Delivery checkout'
	};
	return {
		id: `checkout-${type}`,
		category: 'Checkout',
		label: labels[type],
		title: labels[type],
		description:
			'Public model loading, scenario input, payable-state guard and offline/not-found branches.',
		entrypoint: 'GET /api/v1/checkout/:id',
		nodes: [
			node({
				id: 'open',
				eyebrow: 'Customer browser',
				title: 'Open checkout',
				detail: 'Route parser reads path, query or hash identifier.',
				status: 'complete',
				meta: type,
				layer: 'browser',
				kind: 'trigger',
				x: 40
			}),
			node({
				id: 'load',
				eyebrow: 'Worker API',
				title: 'Load public model',
				detail: 'Resolve active order and merchant payment details.',
				status: 'complete',
				meta: 'public',
				layer: 'worker',
				request: 'GET /api/v1/checkout/:id',
				x: 340
			}),
			node({
				id: 'available',
				eyebrow: 'Condition',
				title: 'Order available?',
				detail: 'HTTP and network result choose the render path.',
				status: 'running',
				meta: '200 / 404 / offline',
				layer: 'worker',
				kind: 'decision',
				x: 640
			}),
			node({
				id: 'scenario',
				eyebrow: 'Browser',
				title: `Render ${type}`,
				detail:
					type === 'open_amount'
						? 'Customer enters positive UAH amount.'
						: type === 'table'
							? 'Wait for or show current table bill.'
							: type === 'delivery'
								? 'Collect method, address and fee.'
								: 'Show fixed immutable total.',
				status: 'waiting',
				meta: type,
				layer: 'browser',
				operation: 'resolveScenario()',
				x: 940
			}),
			node({
				id: 'payable',
				eyebrow: 'Condition',
				title: 'Input and state payable?',
				detail: 'Validate amount/details and reject closed lifecycle states.',
				status: 'waiting',
				meta: 'guard',
				layer: 'browser',
				kind: 'decision',
				x: 1240
			}),
			node({
				id: 'bank',
				eyebrow: 'Terminal',
				title: 'Choose bank',
				detail: 'Continue to bank catalogue and payment initiation.',
				status: 'waiting',
				meta: 'payment handoff',
				layer: 'browser',
				kind: 'terminal',
				x: 1540,
				y: 60
			}),
			node({
				id: 'offline',
				eyebrow: 'Recovery',
				title: 'Offline read-only',
				detail: 'Cached order can render; private API traffic is not cached.',
				status: 'waiting',
				meta: 'offline',
				layer: 'browser',
				kind: 'terminal',
				x: 940,
				y: 480
			}),
			node({
				id: 'invalid',
				eyebrow: 'Error',
				title: 'Correct input',
				detail: 'Zero amount, absent delivery data or closed order blocks payment.',
				status: 'failed',
				meta: 'validation / 409',
				layer: 'browser',
				kind: 'terminal',
				x: 1540,
				y: 420
			}),
			node({
				id: 'missing',
				eyebrow: 'Error',
				title: 'Invoice unavailable',
				detail: 'Definitive 404 terminates the journey.',
				status: 'failed',
				meta: '404',
				layer: 'browser',
				kind: 'terminal',
				x: 940,
				y: 700
			})
		],
		edges: [
			edge('open', 'load'),
			edge('load', 'available'),
			edge('available', 'scenario', '200', 'success'),
			edge('available', 'offline', 'network', 'danger'),
			edge('available', 'missing', '404', 'danger'),
			edge('scenario', 'payable'),
			edge('payable', 'bank', 'yes', 'success'),
			edge('payable', 'invalid', 'no', 'danger')
		]
	};
}

const bankCatalogue: FlowScenario = {
	id: 'bank-catalogue',
	category: 'Payments',
	label: 'Bank catalogue',
	title: 'Bank catalogue, KV cache and fallback',
	description: 'Lazy bank loading uses upstream data, 24-hour edge cache and bundled fallback.',
	entrypoint: 'GET /api/v1/banks',
	nodes: [
		node({
			id: 'request',
			eyebrow: 'Checkout',
			title: 'Request banks',
			detail: 'Payment-only resources load after checkout render.',
			status: 'complete',
			meta: 'lazy',
			layer: 'browser',
			request: 'GET /api/v1/banks',
			kind: 'trigger',
			x: 40
		}),
		node({
			id: 'cache',
			eyebrow: 'Condition',
			title: 'KV cache fresh?',
			detail: 'BANKS_KV has a 24-hour TTL.',
			status: 'complete',
			meta: '24h',
			layer: 'worker',
			kind: 'decision',
			x: 340
		}),
		node({
			id: 'upstream',
			eyebrow: 'External API',
			title: 'Fetch provider',
			detail: 'Cache miss calls the configured bank provider.',
			status: 'running',
			meta: 'upstream',
			layer: 'external',
			request: 'GET bank provider',
			x: 640,
			y: 340
		}),
		node({
			id: 'ok',
			eyebrow: 'Condition',
			title: 'Provider available?',
			detail: 'Success normalizes and caches; failure uses bundled data.',
			status: 'waiting',
			meta: 'response',
			layer: 'external',
			kind: 'decision',
			x: 940,
			y: 340
		}),
		node({
			id: 'cached',
			eyebrow: 'Worker',
			title: 'Use cached banks',
			detail: 'Return normalized catalogue without upstream latency.',
			status: 'waiting',
			meta: 'KV hit',
			layer: 'worker',
			x: 940,
			y: 60
		}),
		node({
			id: 'store',
			eyebrow: 'Workers KV',
			title: 'Cache catalogue',
			detail: 'Store normalized provider response.',
			status: 'waiting',
			meta: 'BANKS_KV',
			layer: 'database',
			operation: 'KV.put(..., 86400)',
			x: 1240,
			y: 240
		}),
		node({
			id: 'fallback',
			eyebrow: 'Recovery',
			title: 'Bundled banks',
			detail: 'Use /checkout/banks.json if API/provider fails.',
			status: 'waiting',
			meta: 'static fallback',
			layer: 'browser',
			x: 1240,
			y: 540
		}),
		node({
			id: 'render',
			eyebrow: 'Terminal',
			title: 'Render bank choices',
			detail: 'Customer can select a bank.',
			status: 'waiting',
			meta: 'bank list',
			layer: 'browser',
			kind: 'terminal',
			x: 1540,
			y: 140
		})
	],
	edges: [
		edge('request', 'cache'),
		edge('cache', 'cached', 'yes', 'success'),
		edge('cache', 'upstream', 'no'),
		edge('upstream', 'ok'),
		edge('ok', 'store', 'yes', 'success'),
		edge('ok', 'fallback', 'no', 'danger'),
		edge('cached', 'render'),
		edge('store', 'render'),
		edge('fallback', 'render')
	]
};

const paymentInitiation: FlowScenario = {
	id: 'payment-initiation',
	category: 'Payments',
	label: 'Initiate payment',
	title: 'Captcha, payment validation and bank deep link',
	description:
		'Checkout validates payment state and hands off to the bank app with a web/NBU fallback.',
	entrypoint: 'POST /api/v1/checkout/:id/initiate',
	nodes: [
		node({
			id: 'confirm',
			eyebrow: 'Customer',
			title: 'Confirm payment',
			detail: 'Confirm amount and selected bank.',
			status: 'complete',
			meta: 'user action',
			layer: 'browser',
			kind: 'trigger',
			x: 40
		}),
		node({
			id: 'captcha',
			eyebrow: 'External',
			title: 'Get captcha token',
			detail: 'Attempt anti-bot token before initiation.',
			status: 'complete',
			meta: 'reCAPTCHA',
			layer: 'external',
			request: 'grecaptcha.execute()',
			x: 340
		}),
		node({
			id: 'api',
			eyebrow: 'Worker API',
			title: 'Initiate payment',
			detail: 'Validate order, amount and bank.',
			status: 'running',
			meta: 'payment_initiated',
			layer: 'worker',
			request: 'POST /api/v1/checkout/:id/initiate',
			x: 640
		}),
		node({
			id: 'payable',
			eyebrow: 'Condition',
			title: 'Order payable?',
			detail: 'Paid, cancelled, missing or invalid orders are rejected.',
			status: 'waiting',
			meta: 'lifecycle',
			layer: 'worker',
			kind: 'decision',
			x: 940
		}),
		node({
			id: 'route',
			eyebrow: 'Worker',
			title: 'Build bank redirect',
			detail: 'Known bank scheme or qr.bank.gov.ua fallback.',
			status: 'waiting',
			meta: 'router',
			layer: 'worker',
			operation: 'buildBankRedirect()',
			x: 1240
		}),
		node({
			id: 'opened',
			eyebrow: 'Condition',
			title: 'Bank app opened?',
			detail: 'Try native link and retain browser fallback.',
			status: 'waiting',
			meta: 'OS handoff',
			layer: 'browser',
			kind: 'decision',
			x: 1540
		}),
		node({
			id: 'bank',
			eyebrow: 'Terminal',
			title: 'Continue in bank',
			detail: 'Transfer happens outside Rahunok.',
			status: 'waiting',
			meta: 'external',
			layer: 'external',
			kind: 'terminal',
			x: 1840,
			y: 60
		}),
		node({
			id: 'fallback',
			eyebrow: 'Recovery',
			title: 'Open fallback',
			detail: 'Open bank web or NBU QR route.',
			status: 'waiting',
			meta: 'fallback URL',
			layer: 'external',
			kind: 'terminal',
			x: 1840,
			y: 340
		}),
		node({
			id: 'reject',
			eyebrow: 'Error',
			title: 'Stay in checkout',
			detail: 'Validation or upstream failure preserves retry.',
			status: 'failed',
			meta: '400 / 404 / 409 / 5xx',
			layer: 'worker',
			kind: 'terminal',
			x: 1240,
			y: 600
		})
	],
	edges: [
		edge('confirm', 'captcha'),
		edge('captcha', 'api'),
		edge('api', 'payable'),
		edge('payable', 'route', 'yes', 'success'),
		edge('payable', 'reject', 'no', 'danger'),
		edge('route', 'opened'),
		edge('opened', 'bank', 'yes', 'success'),
		edge('opened', 'fallback', 'no', 'danger')
	]
};

const webhook: FlowScenario = {
	id: 'webhook-status',
	category: 'Payments',
	label: 'Webhook & status',
	title: 'Webhook confirmation, polling and realtime',
	description:
		'Server-side confirmation persists payment state; checkout and dashboard observe it.',
	entrypoint: 'POST /api/v1/webhooks/:bank_code',
	nodes: [
		node({
			id: 'callback',
			eyebrow: 'External bank',
			title: 'Send result',
			detail: 'Bank posts reference and status.',
			status: 'complete',
			meta: 'callback',
			layer: 'external',
			request: 'POST /api/v1/webhooks/:bank_code',
			kind: 'trigger',
			x: 40
		}),
		node({
			id: 'parse',
			eyebrow: 'Worker',
			title: 'Parse webhook',
			detail: 'Resolve order_id, orderId or reference.',
			status: 'complete',
			meta: 'normalize',
			layer: 'worker',
			input: 'bank payload',
			x: 340
		}),
		node({
			id: 'known',
			eyebrow: 'Condition',
			title: 'Order identified?',
			detail: 'Unknown references cannot mutate an order.',
			status: 'running',
			meta: 'lookup',
			layer: 'worker',
			kind: 'decision',
			x: 640
		}),
		node({
			id: 'persist',
			eyebrow: 'PostgreSQL',
			title: 'Persist result',
			detail: 'Update order and append webhook/event telemetry.',
			status: 'waiting',
			meta: 'orders + logs + events',
			layer: 'database',
			operation: 'UPDATE orders; INSERT webhook_logs; INSERT order_events',
			x: 940
		}),
		node({
			id: 'success',
			eyebrow: 'Condition',
			title: 'Successful payment?',
			detail: 'Success closes checkout; failure remains retryable when allowed.',
			status: 'waiting',
			meta: 'status',
			layer: 'worker',
			kind: 'decision',
			x: 1240
		}),
		node({
			id: 'notify',
			eyebrow: 'Realtime',
			title: 'Notify clients',
			detail: 'Checkout polls every 2.5s; dashboard receives scoped changes.',
			status: 'waiting',
			meta: 'poll + realtime',
			layer: 'browser',
			request: 'GET /api/v1/checkout/:id/status',
			x: 1540
		}),
		node({
			id: 'paid',
			eyebrow: 'Terminal',
			title: 'Paid UI',
			detail: 'Customer and merchant see paid status.',
			status: 'waiting',
			meta: 'paid',
			layer: 'browser',
			kind: 'terminal',
			x: 1840,
			y: 40
		}),
		node({
			id: 'failed',
			eyebrow: 'Recovery',
			title: 'Failure and retry',
			detail: 'Failure is stored in timeline and checkout may retry.',
			status: 'failed',
			meta: 'failed',
			layer: 'browser',
			kind: 'terminal',
			x: 1540,
			y: 420
		}),
		node({
			id: 'unknown',
			eyebrow: 'Error',
			title: 'Reject callback',
			detail: 'Invalid reference returns error without mutation.',
			status: 'failed',
			meta: '400 / 404',
			layer: 'worker',
			kind: 'terminal',
			x: 940,
			y: 580
		}),
		node({
			id: 'timeout',
			eyebrow: 'Recovery',
			title: 'Polling timeout',
			detail: 'After eight minutes offer manual status retry.',
			status: 'waiting',
			meta: '8 min',
			layer: 'browser',
			kind: 'terminal',
			x: 1840,
			y: 560
		})
	],
	edges: [
		edge('callback', 'parse'),
		edge('parse', 'known'),
		edge('known', 'persist', 'yes', 'success'),
		edge('known', 'unknown', 'no', 'danger'),
		edge('persist', 'success'),
		edge('success', 'notify', 'yes', 'success'),
		edge('success', 'failed', 'no', 'danger'),
		edge('notify', 'paid', 'paid', 'success'),
		edge('notify', 'timeout', 'timeout', 'danger')
	]
};

const invoiceLifecycle: FlowScenario = {
	id: 'invoice-lifecycle',
	category: 'Dashboard',
	label: 'Invoice lifecycle',
	title: 'List, inspect, share and cancel invoices',
	description: 'RLS reads, event timeline, lifecycle actions and ownership/not-found branches.',
	entrypoint: 'GET /dashboard/invoices',
	nodes: [
		node({
			id: 'list',
			eyebrow: 'Dashboard',
			title: 'Open invoices',
			detail: 'Load merchant summaries and filters.',
			status: 'complete',
			meta: 'list',
			layer: 'browser',
			kind: 'trigger',
			x: 40
		}),
		node({
			id: 'read',
			eyebrow: 'PostgreSQL + RLS',
			title: 'Read orders',
			detail: 'Select only merchant-owned rows.',
			status: 'complete',
			meta: 'orders',
			layer: 'database',
			operation: 'SELECT orders WHERE merchant_id',
			x: 340
		}),
		node({
			id: 'found',
			eyebrow: 'Condition',
			title: 'Invoice found?',
			detail: 'Missing/non-owned records remain hidden.',
			status: 'running',
			meta: 'ownership',
			layer: 'database',
			kind: 'decision',
			x: 640
		}),
		node({
			id: 'detail',
			eyebrow: 'Dashboard',
			title: 'Render detail',
			detail: 'Show amount, public links, state and actions.',
			status: 'waiting',
			meta: 'detail',
			layer: 'browser',
			x: 940
		}),
		node({
			id: 'events',
			eyebrow: 'Worker / DB',
			title: 'Load timeline',
			detail: 'Use verified event API with RLS fallback.',
			status: 'waiting',
			meta: 'order_events',
			layer: 'worker',
			request: 'GET /api/v1/checkout/:id/events',
			operation: 'SELECT order_events fallback',
			x: 1240
		}),
		node({
			id: 'action',
			eyebrow: 'Condition',
			title: 'Share or cancel?',
			detail: 'Sharing is read-only; cancellation requires unpaid lifecycle.',
			status: 'waiting',
			meta: 'action',
			layer: 'browser',
			kind: 'decision',
			x: 1540
		}),
		node({
			id: 'share',
			eyebrow: 'Terminal',
			title: 'Share link',
			detail: 'Clipboard, Telegram, Viber or WhatsApp receives the URL.',
			status: 'waiting',
			meta: 'no mutation',
			layer: 'browser',
			kind: 'terminal',
			x: 1840,
			y: 60
		}),
		node({
			id: 'cancel',
			eyebrow: 'Worker API',
			title: 'Cancel invoice',
			detail: 'Authenticated PATCH sets cancelled.',
			status: 'waiting',
			meta: 'mutation',
			layer: 'worker',
			request: 'PATCH /api/v1/orders/:id',
			input: '{ status: cancelled }',
			x: 1840,
			y: 340
		}),
		node({
			id: 'cancelled',
			eyebrow: 'Terminal',
			title: 'Cancelled',
			detail: 'Realtime removes it from payable states.',
			status: 'waiting',
			meta: 'cancelled',
			layer: 'database',
			kind: 'terminal',
			x: 2140,
			y: 240
		}),
		node({
			id: 'missing',
			eyebrow: 'Error',
			title: 'Unavailable',
			detail: '404/RLS does not disclose another merchant invoice.',
			status: 'failed',
			meta: '404 / RLS',
			layer: 'browser',
			kind: 'terminal',
			x: 940,
			y: 560
		}),
		node({
			id: 'conflict',
			eyebrow: 'Error',
			title: 'Cancellation blocked',
			detail: 'Paid, cancelled or expired records cannot be cancelled.',
			status: 'failed',
			meta: '409',
			layer: 'browser',
			kind: 'terminal',
			x: 2140,
			y: 520
		})
	],
	edges: [
		edge('list', 'read'),
		edge('read', 'found'),
		edge('found', 'detail', 'yes', 'success'),
		edge('found', 'missing', 'no', 'danger'),
		edge('detail', 'events'),
		edge('events', 'action'),
		edge('action', 'share', 'share'),
		edge('action', 'cancel', 'cancel'),
		edge('cancel', 'cancelled', 'unpaid', 'success'),
		edge('cancel', 'conflict', 'closed', 'danger')
	]
};

const realtime: FlowScenario = {
	id: 'realtime',
	category: 'Dashboard',
	label: 'Realtime',
	title: 'Realtime subscriptions and hidden-tab queue',
	description: 'Scoped Postgres changes refresh only affected dashboard resources.',
	entrypoint: 'subscribeDashboardUpdates()',
	nodes: [
		node({
			id: 'mount',
			eyebrow: 'Dashboard',
			title: 'Mount view',
			detail: 'Overview, invoices, detail, POS or structure declares scope.',
			status: 'complete',
			meta: 'view scope',
			layer: 'browser',
			kind: 'trigger',
			x: 40
		}),
		node({
			id: 'subscribe',
			eyebrow: 'Supabase',
			title: 'Subscribe',
			detail: 'Listen to orders, events, terminals or entities.',
			status: 'complete',
			meta: 'postgres_changes',
			layer: 'database',
			operation: 'channel.on(...).subscribe()',
			x: 340
		}),
		node({
			id: 'change',
			eyebrow: 'Database',
			title: 'Resource changes',
			detail: 'Webhook, POS or another session mutates watched data.',
			status: 'running',
			meta: 'INSERT / UPDATE / DELETE',
			layer: 'database',
			x: 640
		}),
		node({
			id: 'visible',
			eyebrow: 'Condition',
			title: 'Tab visible?',
			detail: 'Visible refreshes now; hidden queues resource names.',
			status: 'waiting',
			meta: 'visibilityState',
			layer: 'browser',
			kind: 'decision',
			x: 940
		}),
		node({
			id: 'refresh',
			eyebrow: 'Terminal',
			title: 'Refresh focused data',
			detail: 'Reload only the affected view.',
			status: 'waiting',
			meta: 'updated UI',
			layer: 'browser',
			kind: 'terminal',
			x: 1240,
			y: 80
		}),
		node({
			id: 'queue',
			eyebrow: 'Browser',
			title: 'Queue refresh',
			detail: 'Avoid requests while hidden.',
			status: 'waiting',
			meta: 'pending set',
			layer: 'browser',
			x: 1240,
			y: 360
		}),
		node({
			id: 'return',
			eyebrow: 'Browser event',
			title: 'Drain on visibility',
			detail: 'When visible, refresh each queued resource once.',
			status: 'waiting',
			meta: 'visibilitychange',
			layer: 'browser',
			x: 1540,
			y: 360
		})
	],
	edges: [
		edge('mount', 'subscribe'),
		edge('subscribe', 'change'),
		edge('change', 'visible'),
		edge('visible', 'refresh', 'yes', 'success'),
		edge('visible', 'queue', 'no'),
		edge('queue', 'return'),
		edge('return', 'refresh')
	]
};

const promoDelivery: FlowScenario = {
	id: 'promo-delivery',
	category: 'Delivery',
	label: 'Promo & delivery',
	title: 'Promo calculation and delivery persistence',
	description:
		'Dedicated checkout endpoints validate input, recalculate totals and preserve errors.',
	entrypoint: 'POST /api/v1/checkout/:id/apply-promo',
	nodes: [
		node({
			id: 'input',
			eyebrow: 'Customer',
			title: 'Enter checkout option',
			detail: 'Promo code or branch, locker, courier details.',
			status: 'complete',
			meta: 'wizard',
			layer: 'browser',
			kind: 'trigger',
			x: 40
		}),
		node({
			id: 'kind',
			eyebrow: 'Condition',
			title: 'Promo or delivery?',
			detail: 'Choose dedicated endpoint.',
			status: 'complete',
			meta: 'action',
			layer: 'worker',
			kind: 'decision',
			x: 340
		}),
		node({
			id: 'promo',
			eyebrow: 'Worker API',
			title: 'Apply promo',
			detail: 'Validate active code and calculate discount.',
			status: 'running',
			meta: 'promo engine',
			layer: 'worker',
			request: 'POST /api/v1/checkout/:id/apply-promo',
			operation: 'calculatePromoDiscount()',
			x: 640,
			y: 60
		}),
		node({
			id: 'delivery',
			eyebrow: 'Worker API',
			title: 'Save delivery',
			detail: 'Validate method/address and fee.',
			status: 'running',
			meta: 'delivery',
			layer: 'worker',
			request: 'POST /api/v1/checkout/:id/delivery',
			x: 640,
			y: 380
		}),
		node({
			id: 'persist',
			eyebrow: 'PostgreSQL',
			title: 'Persist changes',
			detail: 'Update total and order_deliveries.',
			status: 'waiting',
			meta: 'orders + deliveries',
			layer: 'database',
			operation: 'UPDATE orders; UPSERT order_deliveries',
			x: 940
		}),
		node({
			id: 'accepted',
			eyebrow: 'Condition',
			title: 'Accepted?',
			detail: 'Inactive code, invalid address or missing order fails.',
			status: 'waiting',
			meta: 'result',
			layer: 'worker',
			kind: 'decision',
			x: 1240
		}),
		node({
			id: 'total',
			eyebrow: 'Terminal',
			title: 'Total updated',
			detail: 'Render recalculated payable amount.',
			status: 'waiting',
			meta: 'success',
			layer: 'browser',
			kind: 'terminal',
			x: 1540,
			y: 80
		}),
		node({
			id: 'error',
			eyebrow: 'Error',
			title: 'Keep previous total',
			detail: 'Rejected input does not alter payment amount.',
			status: 'failed',
			meta: '400 / 404 / 422',
			layer: 'browser',
			kind: 'terminal',
			x: 1540,
			y: 400
		})
	],
	edges: [
		edge('input', 'kind'),
		edge('kind', 'promo', 'promo'),
		edge('kind', 'delivery', 'delivery'),
		edge('promo', 'persist'),
		edge('delivery', 'persist'),
		edge('persist', 'accepted'),
		edge('accepted', 'total', 'yes', 'success'),
		edge('accepted', 'error', 'no', 'danger')
	]
};

const errors: FlowScenario = {
	id: 'api-errors',
	category: 'Operations',
	label: 'API errors',
	title: 'Shared API errors and recovery',
	description:
		'A common decision tree for auth, validation, missing state, conflict, offline and server failures.',
	entrypoint: 'Any API request',
	nodes: [
		node({
			id: 'request',
			eyebrow: 'Client',
			title: 'Send request',
			detail: 'Dashboard, PWA or checkout starts an API operation.',
			status: 'complete',
			meta: 'HTTP',
			layer: 'browser',
			kind: 'trigger',
			x: 40
		}),
		node({
			id: 'class',
			eyebrow: 'Condition',
			title: 'Response class?',
			detail: 'Status and network result select recovery.',
			status: 'running',
			meta: '2xx / 4xx / 5xx',
			layer: 'worker',
			kind: 'decision',
			x: 340
		}),
		node({
			id: 'success',
			eyebrow: 'Terminal',
			title: 'Commit UI state',
			detail: 'Only 2xx completes a mutation.',
			status: 'waiting',
			meta: '2xx',
			layer: 'browser',
			kind: 'terminal',
			x: 640,
			y: 0
		}),
		node({
			id: 'auth',
			eyebrow: 'Recovery',
			title: 'Restore or sign in',
			detail: '401/403 returns to auth boundary.',
			status: 'waiting',
			meta: '401 / 403',
			layer: 'auth',
			kind: 'terminal',
			x: 640,
			y: 170
		}),
		node({
			id: 'validation',
			eyebrow: 'Recovery',
			title: 'Correct input',
			detail: '400/422 maps errors to the form.',
			status: 'waiting',
			meta: '400 / 422',
			layer: 'browser',
			kind: 'terminal',
			x: 640,
			y: 340
		}),
		node({
			id: 'missing',
			eyebrow: 'Error',
			title: 'Unavailable',
			detail: '404 never fabricates production data.',
			status: 'failed',
			meta: '404',
			layer: 'browser',
			kind: 'terminal',
			x: 640,
			y: 510
		}),
		node({
			id: 'conflict',
			eyebrow: 'Recovery',
			title: 'Reload state',
			detail: '409 means duplicate/lifecycle state changed.',
			status: 'waiting',
			meta: '409',
			layer: 'browser',
			kind: 'terminal',
			x: 940,
			y: 140
		}),
		node({
			id: 'retry',
			eyebrow: 'Recovery',
			title: 'Retry safely',
			detail: 'Offline, 429 and transient 5xx preserve input.',
			status: 'waiting',
			meta: 'offline / 429 / 5xx',
			layer: 'worker',
			kind: 'terminal',
			x: 940,
			y: 430
		})
	],
	edges: [
		edge('request', 'class'),
		edge('class', 'success', '2xx', 'success'),
		edge('class', 'auth', '401 / 403', 'danger'),
		edge('class', 'validation', '400 / 422', 'danger'),
		edge('class', 'missing', '404', 'danger'),
		edge('class', 'conflict', '409', 'danger'),
		edge('class', 'retry', 'offline / 5xx', 'danger')
	]
};

export const extendedFlowScenarios: FlowScenario[] = [
	onboarding,
	pwaBoot,
	orderCreation('table'),
	orderCreation('delivery'),
	shortRoutes,
	checkout('fixed'),
	checkout('open_amount'),
	checkout('table'),
	checkout('delivery'),
	bankCatalogue,
	paymentInitiation,
	webhook,
	invoiceLifecycle,
	realtime,
	promoDelivery,
	errors
];
