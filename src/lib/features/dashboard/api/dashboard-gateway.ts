import type { Session, SupabaseClient } from '@supabase/supabase-js';
import type {
	DashboardMerchant,
	DashboardSessionState,
	DashboardUser,
	BusinessEntity,
	BusinessEntityInput,
	BusinessStructureData,
	InvoiceEvent,
	InvoiceCreateInput,
	InvoiceRecord,
	InvoiceStatus,
	InvoiceSummary,
	InvoiceType,
	MerchantOnboardingInput,
	OverviewSnapshot,
	PosActiveOrder,
	PosBoard,
	PosTerminal
	, TerminalInput
} from '../types';
import { formatMoney } from '../utils/format';
import type { LegacyPosOrderInsert } from '../pos/pos-order-contract';

const AUTH_TIMEOUT_MS = 5_000;

type MerchantRow = {
	id: string;
	user_id: string;
	business_name: string;
	display_name: string;
};

type OrderRow = {
	id: string;
	short_id?: string | null;
	order_number: string;
	title: string | null;
	description?: string | null;
	base_amount?: number | string | null;
	discount_amount?: number | string | null;
	delivery_fee?: number | string | null;
	total_amount: number | string | null;
	currency?: string | null;
	status: string;
	created_at: string;
	type: string | null;
	table_number?: number | null;
	terminal_id?: string | null;
	paid_at?: string | null;
	paid_bank_code?: string | null;
	expires_at?: string | null;
};

type OrderEventRow = {
	id?: string;
	event_type: string;
	actor_name?: string | null;
	bank_code?: string | null;
	previous_bank_code?: string | null;
	created_at: string;
};

type TerminalRow = {
	id: string;
	name: string;
	code: string;
	type: PosTerminal['type'];
	entity_id: string;
	is_active: boolean;
};

type BusinessEntityRow = {
	id: string;
	business_type: BusinessEntity['businessType'];
	business_name: string;
	display_name: string;
	tax_id: string;
	bank_name: string;
	iban: string;
	is_active: boolean;
};

const INVOICE_FIELDS =
	'id, short_id, order_number, title, description, base_amount, discount_amount, delivery_fee, total_amount, currency, status, created_at, type, table_number, terminal_id, paid_at, paid_bank_code, expires_at';

export type DashboardGateway = {
	restore(): Promise<DashboardSessionState>;
	getOverview(userId: string, merchant: DashboardMerchant): Promise<OverviewSnapshot>;
	onboardMerchant(input: MerchantOnboardingInput): Promise<void>;
	createInvoice(input: InvoiceCreateInput): Promise<{ id: string }>;
	cancelInvoice(invoiceId: string): Promise<void>;
	createPosOrder(payload: LegacyPosOrderInsert): Promise<void>;
	markPosOrderPaid(orderId: string): Promise<void>;
	cancelPosOrder(orderId: string): Promise<void>;
	getBusinessStructure(userId: string): Promise<BusinessStructureData>;
	updateMerchantName(merchantId: string, name: string): Promise<void>;
	createBusinessEntity(userId: string, input: BusinessEntityInput): Promise<void>;
	updateBusinessEntity(userId: string, entityId: string, input: BusinessEntityInput): Promise<void>;
	deleteBusinessEntity(userId: string, entityId: string): Promise<void>;
	createTerminal(userId: string, input: TerminalInput): Promise<void>;
	updateTerminal(userId: string, terminalId: string, input: TerminalInput): Promise<void>;
	deleteTerminal(userId: string, terminalId: string): Promise<void>;
	listInvoices(merchantId: string): Promise<InvoiceRecord[]>;
	getInvoice(merchantId: string, invoiceId: string): Promise<InvoiceRecord | null>;
	listInvoiceEvents(invoiceId: string): Promise<InvoiceEvent[]>;
	getPosBoard(userId: string, merchantId: string): Promise<PosBoard>;
	subscribeDashboardUpdates(
		scope: DashboardRealtimeScope,
		onChange: (resource: DashboardRealtimeResource) => void
	): () => void;
	signInWithGoogle(redirectTo: string): Promise<void>;
	signOut(): Promise<void>;
};

export type DashboardRealtimeResource =
	| 'overview'
	| 'invoices'
	| 'invoice'
	| 'events'
	| 'pos'
	| 'structure'
	| 'terminals';

export type DashboardRealtimeScope =
	| { view: 'overview'; userId: string; merchantId: string }
	| { view: 'invoices'; merchantId: string }
	| { view: 'invoice'; merchantId: string; invoiceId: string }
	| { view: 'invoice-create'; userId: string }
	| { view: 'pos'; userId: string; merchantId: string }
	| { view: 'structure'; userId: string; merchantId: string };

type GatewayOptions = {
	authTimeoutMs?: number;
	fetcher?: typeof fetch;
	eventsApiBase?: string;
};

async function withTimeout<T>(promise: Promise<T>, milliseconds: number): Promise<T> {
	let timeoutId: ReturnType<typeof setTimeout> | undefined;
	try {
		return await Promise.race([
			promise,
			new Promise<never>((_, reject) => {
				timeoutId = setTimeout(() => reject(new Error('AUTH_TIMEOUT')), milliseconds);
			})
		]);
	} finally {
		if (timeoutId) clearTimeout(timeoutId);
	}
}

function mapUser(session: Session): DashboardUser {
	return {
		id: session.user.id,
		email: session.user.email ?? null,
		fullName:
			typeof session.user.user_metadata?.full_name === 'string'
				? session.user.user_metadata.full_name
				: null
	};
}

function mapMerchant(row: MerchantRow): DashboardMerchant {
	return {
		id: row.id,
		userId: row.user_id,
		businessName: row.business_name,
		displayName: row.display_name
	};
}

function mapStatus(status: string): InvoiceStatus {
	if (status === 'paid' || status === 'completed') return 'paid';
	if (status === 'cancelled' || status === 'expired') return 'cancelled';
	if (status === 'failed') return 'failed';
	return 'pending';
}

function mapChannel(type: string | null): InvoiceSummary['channel'] {
	if (type === 'table') return 'POS';
	if (type === 'delivery') return 'Link';
	return 'QR';
}

function mapInvoice(row: OrderRow): InvoiceSummary {
	return {
		id: row.id,
		reference: row.order_number,
		title: row.title || row.order_number,
		amount: Number(row.total_amount) || 0,
		status: mapStatus(row.status),
		createdAt: row.created_at,
		channel: mapChannel(row.type)
	};
}

function mapInvoiceType(type: string | null): InvoiceType {
	if (type === 'open_amount' || type === 'table' || type === 'delivery') return type;
	return 'fixed';
}

function mapInvoiceRecord(row: OrderRow): InvoiceRecord {
	return {
		...mapInvoice(row),
		shortId: row.short_id ?? null,
		type: mapInvoiceType(row.type),
		lifecycleStatus:
			row.status === 'completed' ? 'paid' : (row.status as InvoiceRecord['lifecycleStatus']),
		description: row.description ?? null,
		baseAmount: Number(row.base_amount) || 0,
		discountAmount: Number(row.discount_amount) || 0,
		deliveryFee: Number(row.delivery_fee) || 0,
		currency: row.currency || 'UAH',
		tableNumber: row.table_number ?? null,
		terminalId: row.terminal_id ?? null,
		paidAt: row.paid_at ?? null,
		paidBankCode: row.paid_bank_code ?? null,
		expiresAt: row.expires_at ?? null
	};
}

function mapInvoiceEvent(row: OrderEventRow, index: number): InvoiceEvent {
	return {
		id: row.id || `${row.event_type}-${row.created_at}-${index}`,
		type: row.event_type,
		actorName: row.actor_name ?? null,
		bankCode: row.bank_code ?? null,
		previousBankCode: row.previous_bank_code ?? null,
		createdAt: row.created_at
	};
}

function mapPosTerminal(row: TerminalRow): PosTerminal {
	return {
		id: row.id,
		name: row.name,
		code: row.code,
		type: row.type,
		entityId: row.entity_id,
		isActive: row.is_active
	};
}

function mapBusinessEntity(row: BusinessEntityRow): BusinessEntity {
	return {
		id: row.id,
		businessType: row.business_type,
		businessName: row.business_name,
		displayName: row.display_name,
		taxId: row.tax_id,
		bankName: row.bank_name,
		iban: row.iban,
		isActive: row.is_active
	};
}

function mapPosOrder(row: OrderRow): PosActiveOrder | null {
	if (!row.terminal_id || (row.status !== 'pending' && row.status !== 'paid')) return null;
	return {
		id: row.id,
		terminalId: row.terminal_id,
		title: row.title || row.order_number,
		amount: Number(row.total_amount) || 0,
		status: row.status,
		createdAt: row.created_at
	};
}

function createSnapshot(
	merchant: DashboardMerchant,
	todayOrders: OrderRow[],
	terminalCount: number,
	recentOrders: OrderRow[]
): OverviewSnapshot {
	const paidOrders = todayOrders.filter((order) => mapStatus(order.status) === 'paid');
	const revenue = paidOrders.reduce((total, order) => total + (Number(order.total_amount) || 0), 0);
	const average = paidOrders.length > 0 ? revenue / paidOrders.length : 0;

	return {
		merchantName: merchant.businessName || merchant.displayName,
		metrics: [
			{
				label: 'Виручка сьогодні',
				value: formatMoney(revenue),
				detail: 'Лише підтверджені оплати',
				tone: 'success'
			},
			{
				label: 'Успішні оплати',
				value: String(paidOrders.length),
				detail: 'Статус paid',
				tone: 'primary'
			},
			{
				label: 'Середній чек',
				value: formatMoney(average),
				detail: 'За поточний день',
				tone: 'neutral'
			},
			{
				label: 'Активні термінали',
				value: String(terminalCount),
				detail: 'Доступні користувачу',
				tone: 'neutral'
			}
		],
		recentInvoices: recentOrders.map(mapInvoice)
	};
}

export function createDashboardGateway(
	client: SupabaseClient,
	options: GatewayOptions = {}
): DashboardGateway {
	const fetcher = options.fetcher ?? fetch;
	const eventsApiBase = options.eventsApiBase ?? '';

	async function getAccessToken() {
		const result = await client.auth.getSession();
		const accessToken = result.data.session?.access_token;
		if (result.error || !accessToken) {
			throw new Error('Сесію втрачено. Увійдіть через Google ще раз.');
		}
		return accessToken;
	}

	async function workerRequest(path: string, init: RequestInit) {
		const accessToken = await getAccessToken();
		let response: Response;
		try {
			response = await fetcher(`${eventsApiBase}${path}`, {
				...init,
				headers: {
					Authorization: `Bearer ${accessToken}`,
					'Content-Type': 'application/json',
					...init.headers
				}
			});
		} catch {
			throw new Error('API рахунків недоступне. Перевірте підключення або запуск локального Worker.');
		}
		if (!response.ok) {
			const payload = (await response.json().catch(() => null)) as { error?: string } | null;
			throw new Error(payload?.error || 'Запит не виконано.');
		}
		return response;
	}

	return {
		async restore() {
			let session: Session | null;

			try {
				const result = await withTimeout(
					client.auth.getSession(),
					options.authTimeoutMs ?? AUTH_TIMEOUT_MS
				);

				if (result.error) throw result.error;
				session = result.data.session;
			} catch (error) {
				if (error instanceof Error && error.message === 'AUTH_TIMEOUT') {
					return {
						status: 'error',
						message: 'Не вдалося відновити сесію. Перевірте з’єднання та спробуйте ще раз.'
					};
				}

				return { status: 'error', message: 'Помилка перевірки сесії Supabase.' };
			}

			if (!session) return { status: 'guest' };

			const merchantResult = await client
				.from('merchants')
				.select('id, user_id, business_name, display_name')
				.eq('user_id', session.user.id)
				.maybeSingle<MerchantRow>();

			if (merchantResult.error) {
				return { status: 'error', message: 'Не вдалося завантажити профіль бізнесу.' };
			}

			if (!merchantResult.data) {
				return { status: 'onboarding', user: mapUser(session) };
			}

			const merchant = mapMerchant(merchantResult.data);
			return {
				status: 'ready',
				user: mapUser(session),
				merchant,
				snapshot: createSnapshot(merchant, [], 0, [])
			};
		},

		async getOverview(userId, merchant) {
			const today = new Date();
			today.setHours(0, 0, 0, 0);

			const [todayResult, terminalResult, recentResult] = await Promise.all([
				client
					.from('orders')
					.select('id, order_number, title, total_amount, status, created_at, type')
					.eq('merchant_id', merchant.id)
					.gte('created_at', today.toISOString()),
				client
					.from('terminals')
					.select('id', { count: 'exact', head: true })
					.eq('user_id', userId)
					.eq('is_active', true),
				client
					.from('orders')
					.select('id, order_number, title, total_amount, status, created_at, type')
					.eq('merchant_id', merchant.id)
					.order('created_at', { ascending: false })
					.limit(5)
			]);

			if (todayResult.error || terminalResult.error || recentResult.error) {
				throw new Error('Не вдалося завантажити фінансовий огляд.');
			}

			return createSnapshot(
				merchant,
				(todayResult.data ?? []) as OrderRow[],
				terminalResult.count ?? 0,
				(recentResult.data ?? []) as OrderRow[]
			);
		},

		async onboardMerchant(input) {
			await workerRequest('/api/v1/merchant/onboarding', {
				method: 'POST',
				body: JSON.stringify({
					business_name: input.businessName,
					business_type: input.businessType,
					tax_id: input.taxId,
					iban: input.iban.replace(/\s+/g, '').toUpperCase(),
					display_name: input.displayName || input.businessName,
					bank_name: input.bankName
				})
			});
		},

		async createInvoice(input) {
			const response = await workerRequest('/api/v1/orders', {
				method: 'POST',
				body: JSON.stringify({
					type: input.type,
					order_number: input.reference,
					title: input.title,
					description: input.description,
					amount: input.amount,
					delivery_fee: input.deliveryFee ?? 0,
					table_number: input.tableNumber
				})
			});
			const payload = (await response.json()) as { order?: { id?: string } };
			if (!payload.order?.id) throw new Error('Worker не повернув створений рахунок.');
			return { id: payload.order.id };
		},

		async cancelInvoice(invoiceId) {
			await workerRequest(`/api/v1/orders/${encodeURIComponent(invoiceId)}`, {
				method: 'PATCH',
				body: JSON.stringify({ status: 'cancelled' })
			});
		},

		async createPosOrder(payload) {
			const result = await client.from('orders').insert(payload);
			if (result.error) throw new Error('Не вдалося створити POS-замовлення.');
		},

		async markPosOrderPaid(orderId) {
			const result = await client
				.from('orders')
				.update({
					status: 'paid',
					paid_at: new Date().toISOString(),
					paid_bank_code: 'CASH'
				})
				.eq('id', orderId);
			if (result.error) throw new Error('Не вдалося підтвердити готівкову оплату.');
		},

		async cancelPosOrder(orderId) {
			const result = await client
				.from('orders')
				.update({ status: 'cancelled' })
				.eq('id', orderId);
			if (result.error) throw new Error('Не вдалося скасувати POS-замовлення.');
		},

		async getBusinessStructure(userId) {
			const [entityResult, terminalResult] = await Promise.all([
				client.from('business_entities').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
				client.from('terminals').select('id, name, code, type, entity_id, is_active').eq('user_id', userId).order('created_at', { ascending: false })
			]);
			if (entityResult.error || terminalResult.error) throw new Error('Не вдалося завантажити структуру бізнесу.');
			return {
				entities: ((entityResult.data ?? []) as BusinessEntityRow[]).map(mapBusinessEntity),
				terminals: ((terminalResult.data ?? []) as TerminalRow[]).map(mapPosTerminal)
			};
		},

		async updateMerchantName(merchantId, name) {
			const result = await client.from('merchants').update({ business_name: name, display_name: name }).eq('id', merchantId);
			if (result.error) throw new Error('Не вдалося зберегти назву бізнесу.');
		},

		async createBusinessEntity(userId, input) {
			const result = await client.from('business_entities').insert({
				user_id: userId, business_type: input.businessType, business_name: input.businessName,
				display_name: input.displayName, tax_id: input.taxId, bank_name: input.bankName,
				iban: input.iban, is_active: true
			});
			if (result.error) throw new Error('Не вдалося створити юридичну особу.');
		},

		async updateBusinessEntity(userId, entityId, input) {
			const result = await client.from('business_entities').update({
				business_type: input.businessType, business_name: input.businessName,
				display_name: input.displayName, tax_id: input.taxId, bank_name: input.bankName,
				iban: input.iban
			}).eq('user_id', userId).eq('id', entityId);
			if (result.error) throw new Error('Не вдалося оновити юридичну особу.');
		},

		async deleteBusinessEntity(userId, entityId) {
			const result = await client.from('business_entities').delete().eq('user_id', userId).eq('id', entityId);
			if (result.error) throw new Error('Не вдалося видалити юридичну особу. Перевірте пов’язані термінали.');
		},

		async createTerminal(userId, input) {
			const result = await client.from('terminals').insert({
				user_id: userId, entity_id: input.entityId, name: input.name, code: input.code,
				type: input.type, is_active: true
			});
			if (result.error) throw new Error('Не вдалося створити робоче місце. Код має бути унікальним.');
		},

		async updateTerminal(userId, terminalId, input) {
			const result = await client.from('terminals').update({
				entity_id: input.entityId, name: input.name, code: input.code, type: input.type
			}).eq('user_id', userId).eq('id', terminalId);
			if (result.error) throw new Error('Не вдалося оновити робоче місце. Код має бути унікальним.');
		},

		async deleteTerminal(userId, terminalId) {
			const result = await client.from('terminals').delete().eq('user_id', userId).eq('id', terminalId);
			if (result.error) throw new Error('Не вдалося видалити робоче місце.');
		},

		async listInvoices(merchantId) {
			const result = await client
				.from('orders')
				.select(INVOICE_FIELDS)
				.eq('merchant_id', merchantId)
				.order('created_at', { ascending: false });

			if (result.error) throw new Error('Не вдалося завантажити рахунки.');
			return ((result.data ?? []) as OrderRow[]).map(mapInvoiceRecord);
		},

		async getInvoice(merchantId, invoiceId) {
			const result = await client
				.from('orders')
				.select(INVOICE_FIELDS)
				.eq('merchant_id', merchantId)
				.eq('id', invoiceId)
				.maybeSingle<OrderRow>();

			if (result.error) throw new Error('Не вдалося завантажити рахунок.');
			return result.data ? mapInvoiceRecord(result.data) : null;
		},

		async listInvoiceEvents(invoiceId) {
			try {
				const response = await fetcher(
					`${eventsApiBase}/api/v1/checkout/${encodeURIComponent(invoiceId)}/events`
				);
				if (response.ok) {
					const payload = (await response.json()) as { events?: OrderEventRow[] };
					if (payload.events?.length) return payload.events.map(mapInvoiceEvent);
				}
			} catch {
				// Fall through to the existing Supabase read path.
			}

			const result = await client
				.from('order_events')
				.select('id, event_type, actor_name, bank_code, previous_bank_code, created_at')
				.eq('order_id', invoiceId)
				.order('created_at', { ascending: true });

			if (result.error) throw new Error('Не вдалося завантажити історію рахунку.');
			return ((result.data ?? []) as OrderEventRow[]).map(mapInvoiceEvent);
		},

		async getPosBoard(userId, merchantId) {
			const [terminalResult, orderResult] = await Promise.all([
				client
					.from('terminals')
					.select('id, name, code, type, entity_id, is_active')
					.eq('user_id', userId)
					.eq('is_active', true)
					.order('name', { ascending: true }),
				client
					.from('orders')
					.select('id, order_number, title, total_amount, status, created_at, terminal_id')
					.eq('merchant_id', merchantId)
					.in('status', ['pending', 'paid'])
					.order('created_at', { ascending: false })
					.limit(50)
			]);

			if (terminalResult.error || orderResult.error) {
				throw new Error('Не вдалося завантажити стан каси.');
			}

			const latestOrders = new Map<string, PosActiveOrder>();
			for (const row of (orderResult.data ?? []) as OrderRow[]) {
				const order = mapPosOrder(row);
				if (order && !latestOrders.has(order.terminalId)) {
					latestOrders.set(order.terminalId, order);
				}
			}

			return {
				terminals: ((terminalResult.data ?? []) as TerminalRow[]).map(mapPosTerminal),
				activeOrders: [...latestOrders.values()]
			};
		},

		subscribeDashboardUpdates(scope, onChange) {
			const scopeId =
				scope.view === 'invoice'
					? scope.invoiceId
					: 'merchantId' in scope
						? scope.merchantId
						: scope.userId;
			let channel = client.channel(`dashboard-${scope.view}-${scopeId}`);

			if (scope.view === 'overview') {
				channel = channel
					.on(
						'postgres_changes',
						{
							event: '*',
							schema: 'public',
							table: 'orders',
							filter: `merchant_id=eq.${scope.merchantId}`
						},
						() => onChange('overview')
					)
					.on(
						'postgres_changes',
						{
							event: '*',
							schema: 'public',
							table: 'terminals',
							filter: `user_id=eq.${scope.userId}`
						},
						() => onChange('overview')
					);
			} else if (scope.view === 'invoices') {
				channel = channel.on(
					'postgres_changes',
					{
						event: '*',
						schema: 'public',
						table: 'orders',
						filter: `merchant_id=eq.${scope.merchantId}`
					},
					() => onChange('invoices')
				);
			} else if (scope.view === 'invoice') {
				channel = channel
					.on(
						'postgres_changes',
						{
							event: '*',
							schema: 'public',
							table: 'orders',
							filter: `id=eq.${scope.invoiceId}`
						},
						() => onChange('invoice')
					)
					.on(
						'postgres_changes',
						{
							event: '*',
							schema: 'public',
							table: 'order_events',
							filter: `order_id=eq.${scope.invoiceId}`
						},
						() => onChange('events')
					);
			} else if (scope.view === 'invoice-create') {
				channel = channel.on(
					'postgres_changes',
					{
						event: '*',
						schema: 'public',
						table: 'terminals',
						filter: `user_id=eq.${scope.userId}`
					},
					() => onChange('terminals')
				);
			} else if (scope.view === 'pos') {
				channel = channel
					.on(
						'postgres_changes',
						{
							event: '*',
							schema: 'public',
							table: 'orders',
							filter: `merchant_id=eq.${scope.merchantId}`
						},
						() => onChange('pos')
					)
					.on(
						'postgres_changes',
						{
							event: '*',
							schema: 'public',
							table: 'terminals',
							filter: `user_id=eq.${scope.userId}`
						},
						() => onChange('pos')
					);
			} else {
				channel = channel
					.on(
						'postgres_changes',
						{
							event: '*',
							schema: 'public',
							table: 'business_entities',
							filter: `user_id=eq.${scope.userId}`
						},
						() => onChange('structure')
					)
					.on(
						'postgres_changes',
						{
							event: '*',
							schema: 'public',
							table: 'terminals',
							filter: `user_id=eq.${scope.userId}`
						},
						() => onChange('structure')
					)
					.on(
						'postgres_changes',
						{
							event: '*',
							schema: 'public',
							table: 'merchants',
							filter: `id=eq.${scope.merchantId}`
						},
						() => onChange('structure')
					);
			}

			channel.subscribe();

			return () => {
				void client.removeChannel(channel);
			};
		},

		async signInWithGoogle(redirectTo) {
			const { error } = await client.auth.signInWithOAuth({
				provider: 'google',
				options: { redirectTo }
			});
			if (error) throw error;
		},

		async signOut() {
			const { error } = await client.auth.signOut();
			if (error) throw error;
		}
	};
}
