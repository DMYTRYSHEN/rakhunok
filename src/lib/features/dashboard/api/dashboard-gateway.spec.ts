import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatMoney } from '../utils/format';
import { createDashboardGateway } from './dashboard-gateway';

const session = {
	user: {
		id: 'user-1',
		email: 'owner@example.com',
		user_metadata: { full_name: 'Owner' }
	}
} as unknown as Session;

type QueryResult = {
	data: unknown;
	error: Error | null;
	count?: number | null;
};

function query(result: QueryResult) {
	const filters: Array<[string, unknown]> = [];
	const builder = {
		filters,
		select: vi.fn(() => builder),
		eq: vi.fn((column: string, value: unknown) => {
			filters.push([column, value]);
			return builder;
		}),
		gte: vi.fn(() => builder),
		in: vi.fn(() => builder),
		order: vi.fn(() => builder),
		limit: vi.fn(() => builder),
		maybeSingle: vi.fn(async () => result),
		then: (resolve: (value: QueryResult) => unknown) => Promise.resolve(result).then(resolve)
	};
	return builder;
}

function createClient(options?: { merchantError?: Error; merchantMissing?: boolean }) {
	const merchantQuery = query({
		data:
			options?.merchantError || options?.merchantMissing
				? null
				: {
						id: 'merchant-1',
						user_id: 'user-1',
						business_name: 'Test Business',
						display_name: 'Test'
					},
		error: options?.merchantError ?? null
	});
	const todayQuery = query({
		data: [
			{
				id: 'paid',
				order_number: 'INV-1',
				title: 'Paid order',
				total_amount: '100',
				status: 'paid',
				created_at: '2026-08-25T10:00:00.000Z',
				type: 'fixed'
			},
			{
				id: 'pending',
				order_number: 'INV-2',
				title: 'Pending order',
				total_amount: '900',
				status: 'pending',
				created_at: '2026-08-25T11:00:00.000Z',
				type: 'table'
			}
		],
		error: null
	});
	const terminalQuery = query({ data: null, error: null, count: 2 });
	const recentQuery = query({ data: [], error: null });
	let orderQueryIndex = 0;

	const client = {
		auth: {
			getSession: vi.fn(async () => ({ data: { session }, error: null })),
			onAuthStateChange: vi.fn(() => ({
				data: { subscription: { unsubscribe: vi.fn() } }
			})),
			signInWithIdToken: vi.fn(async () => ({ data: { session }, error: null })),
			signOut: vi.fn()
		},
		from: vi.fn((table: string) => {
			if (table === 'merchants') return merchantQuery;
			if (table === 'terminals') return terminalQuery;
			return orderQueryIndex++ === 0 ? todayQuery : recentQuery;
		})
	} as unknown as SupabaseClient;

	return { client, merchantQuery, todayQuery, terminalQuery, recentQuery };
}

afterEach(() => {
	vi.useRealTimers();
});

describe('dashboard gateway', () => {
	it('forwards relevant Supabase auth events and unsubscribes', () => {
		const { client } = createClient();
		const onChange = vi.fn();
		const unsubscribe = vi.fn();
		vi.mocked(client.auth.onAuthStateChange).mockImplementation((callback) => {
			callback('INITIAL_SESSION', session);
			callback('TOKEN_REFRESHED', session);
			callback('SIGNED_IN', session);
			callback('USER_UPDATED', session);
			callback('SIGNED_OUT', null);
			return { data: { subscription: { id: 'auth', callback, unsubscribe } } };
		});

		const stop = createDashboardGateway(client).subscribeAuthChanges(onChange);

		expect(onChange.mock.calls.map(([event]) => event)).toEqual([
			'signed-in',
			'user-updated',
			'signed-out'
		]);
		stop();
		expect(unsubscribe).toHaveBeenCalledOnce();
	});

	it('persists only a hash when creating a merchant API key', async () => {
		let insertedPayload: Record<string, unknown> | null = null;
		const createdRow = {
			id: 'key-1',
			name: 'Production',
			key_prefix: 'rhk_live_12345678',
			scopes: ['orders:read'],
			created_at: '2026-09-03T10:00:00.000Z',
			expires_at: null,
			last_used_at: null,
			revoked_at: null
		};
		const builder = {
			insert: vi.fn((payload: Record<string, unknown>) => {
				insertedPayload = payload;
				return builder;
			}),
			select: vi.fn(() => builder),
			single: vi.fn(async () => ({ data: createdRow, error: null }))
		};
		const client = {
			from: vi.fn(() => builder)
		} as unknown as SupabaseClient;

		const result = await createDashboardGateway(client).createMerchantApiKey('merchant-1', {
			name: 'Production',
			expiresAt: null
		});
		const secretHex = result.apiKey.slice('rhk_live_'.length);
		const expectedHash = Array.from(
			new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(result.apiKey)))
		)
			.map((byte) => byte.toString(16).padStart(2, '0'))
			.join('');

		expect(result.apiKey).toMatch(/^rhk_live_[a-f0-9]{64}$/);
		expect(insertedPayload).toMatchObject({
			merchant_id: 'merchant-1',
			name: 'Production',
			key_prefix: `rhk_live_${secretHex.slice(0, 8)}`,
			secret_hash: expectedHash,
			expires_at: null
		});
		expect(Object.values(insertedPayload ?? {})).not.toContain(result.apiKey);
	});

	it('returns the current access token and expiry for developer testing', async () => {
		const expiringSession = {
			...session,
			access_token: 'short-lived-jwt',
			expires_at: 1_800_000_000
		} as Session;
		const client = {
			auth: {
				getSession: vi.fn(async () => ({ data: { session: expiringSession }, error: null }))
			}
		} as unknown as SupabaseClient;

		await expect(createDashboardGateway(client).getDeveloperSession()).resolves.toEqual({
			accessToken: 'short-lived-jwt',
			expiresAt: 1_800_000_000
		});
	});

	it('exchanges a Google credential and nonce without an OAuth redirect', async () => {
		const { client } = createClient();

		await createDashboardGateway(client).signInWithGoogleIdToken('google-credential', 'nonce');

		expect(client.auth.signInWithIdToken).toHaveBeenCalledWith({
			provider: 'google',
			token: 'google-credential',
			nonce: 'nonce'
		});
	});

	it('returns guest when Supabase has no session', async () => {
		const client = {
			auth: { getSession: vi.fn(async () => ({ data: { session: null }, error: null })) }
		} as unknown as SupabaseClient;

		await expect(createDashboardGateway(client).restore()).resolves.toEqual({ status: 'guest' });
	});

	it('reports a session timeout separately from guest state', async () => {
		vi.useFakeTimers();
		const client = {
			auth: { getSession: vi.fn(() => new Promise(() => undefined)) }
		} as unknown as SupabaseClient;
		const restoration = createDashboardGateway(client, { authTimeoutMs: 20 }).restore();

		await vi.advanceTimersByTimeAsync(20);

		await expect(restoration).resolves.toMatchObject({ status: 'error' });
	});

	it('reports merchant lookup failures without loading overview data', async () => {
		const { client } = createClient({ merchantError: new Error('query failed') });

		await expect(createDashboardGateway(client).restore()).resolves.toEqual({
			status: 'error',
			message: 'Не вдалося завантажити профіль бізнесу.'
		});
		expect(client.from).toHaveBeenCalledTimes(1);
	});

	it('routes an authenticated user without a merchant to onboarding', async () => {
		const { client } = createClient({ merchantMissing: true });

		await expect(createDashboardGateway(client).restore()).resolves.toEqual({
			status: 'onboarding',
			user: { id: 'user-1', email: 'owner@example.com', fullName: 'Owner' }
		});
		expect(client.from).toHaveBeenCalledTimes(1);
	});

	it('submits onboarding once with the current access token', async () => {
		const { client } = createClient({ merchantMissing: true });
		const getSession = vi.mocked(client.auth.getSession);
		getSession.mockResolvedValue({
			data: { session: { ...session, access_token: 'access-token' } as Session },
			error: null
		});
		const fetcher = vi.fn(
			async () => new Response(JSON.stringify({ success: true }), { status: 200 })
		);

		await createDashboardGateway(client, {
			fetcher: fetcher as typeof fetch,
			eventsApiBase: 'https://api.example.com'
		}).onboardMerchant({
			businessName: 'ФОП Тест',
			businessType: 'fop',
			taxId: '1234567890',
			iban: 'ua12 3456 7890 1234 5678 9012 345',
			displayName: 'Тест',
			bankName: 'Тест Банк'
		});

		expect(fetcher).toHaveBeenCalledTimes(1);
		expect(fetcher).toHaveBeenCalledWith(
			'https://api.example.com/api/v1/merchant/onboarding',
			expect.objectContaining({
				method: 'POST',
				headers: expect.objectContaining({ Authorization: 'Bearer access-token' }),
				body: expect.stringContaining('UA1234567890123456789012345')
			})
		);
	});

	it('creates and cancels an invoice with one Worker request per action', async () => {
		const { client } = createClient();
		vi.mocked(client.auth.getSession).mockResolvedValue({
			data: { session: { ...session, access_token: 'access-token' } as Session },
			error: null
		});
		const fetcher = vi
			.fn()
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ success: true, order: { id: 'invoice-new' } }), {
					status: 201
				})
			)
			.mockResolvedValueOnce(new Response(JSON.stringify({ success: true }), { status: 200 }));
		const gateway = createDashboardGateway(client, {
			fetcher: fetcher as typeof fetch,
			eventsApiBase: 'https://api.example.com'
		});

		await expect(
			gateway.createInvoice({
				type: 'delivery',
				reference: 'RHK-1',
				title: 'Оплата замовлення',
				description: 'Київ, відділення 24',
				amount: 100,
				deliveryFee: 20,
				terminalId: 'terminal-1'
			})
		).resolves.toEqual({ id: 'invoice-new' });
		await gateway.cancelInvoice('invoice-new');

		expect(fetcher).toHaveBeenCalledTimes(2);
		expect(fetcher).toHaveBeenNthCalledWith(
			1,
			'https://api.example.com/api/v1/orders',
			expect.objectContaining({
				method: 'POST',
					body: expect.stringContaining('"terminal_id":"terminal-1"')
			})
		);
		expect(fetcher).toHaveBeenNthCalledWith(
			2,
			'https://api.example.com/api/v1/orders/invoice-new',
			expect.objectContaining({ method: 'PATCH', body: '{"status":"cancelled"}' })
		);
	});

	it('loads and saves merchant settings through an owner-keyed row', async () => {
		const filters: Array<[string, unknown]> = [];
		const settingsQuery = {
			select: vi.fn(() => settingsQuery),
			eq: vi.fn((column: string, value: unknown) => {
				filters.push([column, value]);
				return settingsQuery;
			}),
			maybeSingle: vi.fn(async () => ({
				data: { table_order_ttl_seconds: 7_200 },
				error: null
			})),
			upsert: vi.fn(async () => ({ error: null }))
		};
		const client = {
			auth: { getSession: vi.fn() },
			from: vi.fn(() => settingsQuery)
		} as unknown as SupabaseClient;
		const gateway = createDashboardGateway(client);

		await expect(gateway.getMerchantSettings('merchant-1')).resolves.toEqual({
			tableOrderTtlSeconds: 7_200
		});
		await gateway.saveMerchantSettings('merchant-1', { tableOrderTtlSeconds: 18_000 });

		expect(filters).toEqual([['merchant_id', 'merchant-1']]);
		expect(settingsQuery.upsert).toHaveBeenCalledWith(
			{ merchant_id: 'merchant-1', table_order_ttl_seconds: 18_000 },
			{ onConflict: 'merchant_id' }
		);
	});

	it('surfaces the message from a structured Worker error', async () => {
		const { client } = createClient();
		vi.mocked(client.auth.getSession).mockResolvedValue({
			data: { session: { ...session, access_token: 'access-token' } as Session },
			error: null
		});
		const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
			new Response(
				JSON.stringify({
					error: true,
					message: 'Failed to create order',
					details: { message: 'Database rejected the order' }
				}),
				{ status: 500, headers: { 'Content-Type': 'application/json' } }
			)
		);
		const gateway = createDashboardGateway(client, { fetcher });

		await expect(
			gateway.createInvoice({
				type: 'fixed',
				reference: 'INV-1',
				title: 'Test invoice',
				amount: 100
			})
		).rejects.toThrow('Failed to create order');
	});

	it('uses same-origin Worker routes by default', async () => {
		const { client } = createClient();
		vi.mocked(client.auth.getSession).mockResolvedValue({
			data: { session: { ...session, access_token: 'access-token' } as Session },
			error: null
		});
		const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
			new Response(JSON.stringify({ order: { id: 'invoice-1' } }), {
				status: 200,
				headers: { 'Content-Type': 'application/json' }
			})
		);
		const gateway = createDashboardGateway(client, { fetcher });

		await gateway.createInvoice({
			type: 'fixed',
			reference: 'INV-1',
			title: 'Test invoice',
			amount: 100
		});

		expect(fetcher).toHaveBeenCalledOnce();
		expect(fetcher.mock.calls[0]?.[0]).toBe('/api/v1/orders');
	});

	it('writes each POS mutation once and scopes updates by immutable order ID', async () => {
		const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
			new Response(JSON.stringify({ success: true, order: { id: 'order-1' } }), {
				status: 200,
				headers: { 'Content-Type': 'application/json' }
			})
		);
		const client = {
			auth: {
				getSession: vi.fn(async () => ({
					data: { session: { ...session, access_token: 'access-token' } },
					error: null
				}))
			}
		} as unknown as SupabaseClient;
		const gateway = createDashboardGateway(client, { fetcher });
		const payload = {
			merchant_id: 'merchant-1',
			type: 'table' as const,
			order_number: 'table-1',
			title: 'POS Стіл (table-1)',
			base_amount: 100,
			total_amount: 100,
			currency: 'UAH' as const,
			status: 'pending' as const,
			created_at: '2026-08-26T00:00:00.000Z',
			expires_at: '2026-08-26T00:30:00.000Z',
			terminal_id: 'terminal-1'
		};

		await gateway.createPosOrder(payload);
		await gateway.markPosOrderPaid('order-1');
		await gateway.cancelPosOrder('order-2');

		expect(fetcher).toHaveBeenCalledTimes(3);
		expect(fetcher.mock.calls[0]?.[0]).toBe('/api/v1/orders');
		expect(fetcher.mock.calls[0]?.[1]?.body).toContain('"status":"pending"');
		expect(fetcher.mock.calls[0]?.[1]?.body).toContain('"terminal_id":"terminal-1"');
		expect(fetcher.mock.calls[0]?.[1]?.body).toContain('"expires_at":"2026-08-26T00:30:00.000Z"');
		expect(fetcher.mock.calls[1]?.[0]).toBe('/api/v1/orders/order-1');
		expect(fetcher.mock.calls[1]?.[1]?.body).toContain('"paid_bank_code":"CASH"');
		expect(fetcher.mock.calls[2]?.[0]).toBe('/api/v1/orders/order-2');
		expect(fetcher.mock.calls[2]?.[1]?.body).toBe('{"status":"cancelled"}');
	});

	it('writes each structure mutation once and scopes deletes by user and immutable ID', async () => {
		const inserts: unknown[] = [];
		const deleteFilters: Array<[string, unknown]> = [];
		const updateFilters: Array<[string, unknown]> = [];
		const createMutation = (table: string) => {
			const deleteBuilder = {
				eq: vi.fn((column: string, value: unknown) => {
					deleteFilters.push([`${table}.${column}`, value]);
					return deleteBuilder;
				}),
				then: (resolve: (value: QueryResult) => unknown) =>
					Promise.resolve({ data: null, error: null }).then(resolve)
			};
			const updateBuilder = {
				eq: vi.fn((column: string, value: unknown) => {
					updateFilters.push([`${table}.${column}`, value]);
					return updateBuilder;
				}),
				then: (resolve: (value: QueryResult) => unknown) =>
					Promise.resolve({ data: null, error: null }).then(resolve)
			};
			return {
				insert: vi.fn(async (payload: unknown) => {
					inserts.push([table, payload]);
					return { error: null };
				}),
				delete: vi.fn(() => deleteBuilder),
				update: vi.fn(() => updateBuilder)
			};
		};
		const mutations = new Map([
			['merchants', createMutation('merchants')],
			['business_entities', createMutation('business_entities')],
			['terminals', createMutation('terminals')]
		]);
		const client = {
			from: vi.fn((table: string) => mutations.get(table))
		} as unknown as SupabaseClient;
		const gateway = createDashboardGateway(client);

		await gateway.updateMerchantName('merchant-1', 'Нова назва');
		await gateway.createBusinessEntity('user-1', {
			businessType: 'fop',
			businessName: 'ФОП Тест',
			displayName: 'Тест',
			taxId: '1234567890',
			bankName: 'Банк',
			iban: 'UA123456789012345678901234567'
		});
		await gateway.updateBusinessEntity('user-1', 'entity-1', {
			businessType: 'tov',
			businessName: 'ТОВ Тест',
			displayName: 'Тест 2',
			taxId: '12345678',
			bankName: 'Банк',
			iban: 'UA123456789012345678901234567'
		});
		await gateway.deleteBusinessEntity('user-1', 'entity-1');
		await gateway.createTerminal('user-1', {
			entityId: 'entity-1',
			name: 'Стіл 1',
			code: 'table-1',
			type: 'table'
		});
		await gateway.updateTerminal('user-1', 'terminal-1', {
			entityId: 'entity-1',
			name: 'Стіл 2',
			code: 'table-2',
			type: 'table'
		});
		await gateway.deleteTerminal('user-1', 'terminal-1');

		expect(inserts).toHaveLength(2);
		expect(mutations.get('business_entities')?.insert).toHaveBeenCalledTimes(1);
		expect(mutations.get('terminals')?.insert).toHaveBeenCalledTimes(1);
		expect(mutations.get('merchants')?.update).toHaveBeenCalledTimes(1);
		expect(mutations.get('business_entities')?.update).toHaveBeenCalledTimes(1);
		expect(mutations.get('terminals')?.update).toHaveBeenCalledTimes(1);
		expect(deleteFilters).toEqual([
			['business_entities.user_id', 'user-1'],
			['business_entities.id', 'entity-1'],
			['terminals.user_id', 'user-1'],
			['terminals.id', 'terminal-1']
		]);
		expect(updateFilters).toEqual([
			['merchants.id', 'merchant-1'],
			['business_entities.user_id', 'user-1'],
			['business_entities.id', 'entity-1'],
			['terminals.user_id', 'user-1'],
			['terminals.id', 'terminal-1']
		]);
	});

	it('restores the authenticated merchant without loading overview data', async () => {
		const { client, merchantQuery } = createClient();

		const state = await createDashboardGateway(client).restore();

		expect(state.status).toBe('ready');
		expect(merchantQuery.filters).toContainEqual(['user_id', 'user-1']);
		expect(client.from).toHaveBeenCalledTimes(1);
	});

	it('loads scoped overview data and excludes pending orders from revenue', async () => {
		const { client, merchantQuery, todayQuery, terminalQuery, recentQuery } = createClient();
		const gateway = createDashboardGateway(client);
		const state = await gateway.restore();
		if (state.status !== 'ready') throw new Error('Expected ready dashboard state');

		const snapshot = await gateway.getOverview(state.user.id, state.merchant);

		expect(snapshot.metrics[0].value).toBe(formatMoney(100));
		expect(snapshot.metrics[1].value).toBe('1');
		expect(merchantQuery.filters).toContainEqual(['user_id', 'user-1']);
		expect(todayQuery.filters).toContainEqual(['merchant_id', 'merchant-1']);
		expect(recentQuery.filters).toContainEqual(['merchant_id', 'merchant-1']);
		expect(terminalQuery.filters).toEqual([
			['user_id', 'user-1'],
			['is_active', true]
		]);
	});

	it('lists newest invoices within the requested merchant scope', async () => {
		const invoiceQuery = query({
			data: [
				{
					id: 'invoice-1',
					order_number: 'INV-1',
					title: 'Consulting',
					description: null,
					base_amount: '1200.50',
					discount_amount: '100.25',
					delivery_fee: '0',
					total_amount: '1100.25',
					currency: 'UAH',
					status: 'completed',
					created_at: '2026-08-25T10:00:00.000Z',
					type: 'fixed',
					table_number: null,
					paid_at: '2026-08-25T10:01:00.000Z',
					paid_bank_code: 'UNJS',
					expires_at: null
				}
			],
			error: null
		});
		const client = { from: vi.fn(() => invoiceQuery) } as unknown as SupabaseClient;

		const invoices = await createDashboardGateway(client).listInvoices('merchant-7');

		expect(invoiceQuery.filters).toContainEqual(['merchant_id', 'merchant-7']);
		expect(invoiceQuery.order).toHaveBeenCalledWith('created_at', { ascending: false });
		expect(invoices[0]).toMatchObject({
			amount: 1100.25,
			baseAmount: 1200.5,
			discountAmount: 100.25,
			status: 'paid',
			lifecycleStatus: 'paid'
		});
	});

	it('loads invoice detail by both merchant and invoice ID', async () => {
		const invoiceQuery = query({ data: null, error: null });
		const client = { from: vi.fn(() => invoiceQuery) } as unknown as SupabaseClient;

		await expect(
			createDashboardGateway(client).getInvoice('merchant-7', 'invoice-9')
		).resolves.toBeNull();
		expect(invoiceQuery.filters).toEqual([
			['merchant_id', 'merchant-7'],
			['id', 'invoice-9']
		]);
		expect(invoiceQuery.maybeSingle).toHaveBeenCalledOnce();
	});

	it('loads invoice events from the Worker without querying Supabase', async () => {
		const fetcher = vi.fn(
			async () =>
				new Response(
					JSON.stringify({
						events: [
							{
								id: 'event-1',
								event_type: 'checkout_opened',
								created_at: '2026-08-25T10:02:00.000Z'
							}
						]
					}),
					{ status: 200, headers: { 'content-type': 'application/json' } }
				)
		);
		const client = { from: vi.fn() } as unknown as SupabaseClient;

		await expect(
			createDashboardGateway(client, {
				fetcher,
				eventsApiBase: 'https://worker.example'
			}).listInvoiceEvents('invoice/9')
		).resolves.toEqual([
			{
				id: 'event-1',
				type: 'checkout_opened',
				actorName: null,
				bankCode: null,
				previousBankCode: null,
				createdAt: '2026-08-25T10:02:00.000Z'
			}
		]);
		expect(fetcher).toHaveBeenCalledWith(
			'https://worker.example/api/v1/checkout/invoice%2F9/events'
		);
		expect(client.from).not.toHaveBeenCalled();
	});

	it('falls back to order events scoped by invoice ID when the Worker has no events', async () => {
		const eventQuery = query({
			data: [
				{
					id: 'event-2',
					event_type: 'payment_succeeded',
					bank_code: 'UNJS',
					created_at: '2026-08-25T10:03:00.000Z'
				}
			],
			error: null
		});
		const client = { from: vi.fn(() => eventQuery) } as unknown as SupabaseClient;
		const fetcher = vi.fn(
			async () => new Response(JSON.stringify({ events: [] }), { status: 200 })
		);

		const events = await createDashboardGateway(client, { fetcher }).listInvoiceEvents('invoice-9');

		expect(client.from).toHaveBeenCalledWith('order_events');
		expect(eventQuery.filters).toContainEqual(['order_id', 'invoice-9']);
		expect(eventQuery.order).toHaveBeenCalledWith('created_at', { ascending: true });
		expect(events[0]).toMatchObject({ type: 'payment_succeeded', bankCode: 'UNJS' });
	});

	it('loads the POS board within user and merchant ownership scopes', async () => {
		const terminalQuery = query({
			data: [
				{
					id: 'terminal-1',
					name: 'Стіл 1',
					code: 'table-1',
					type: 'table',
					entity_id: 'entity-1',
					is_active: true
				}
			],
			error: null
		});
		const orderQuery = query({
			data: [
				{
					id: 'new-order',
					order_number: 'table-1',
					title: 'Вечеря',
					total_amount: '840',
					status: 'pending',
					created_at: '2026-08-25T20:00:00.000Z',
					terminal_id: 'terminal-1',
					type: 'table'
				},
				{
					id: 'old-order',
					order_number: 'table-1',
					title: 'Обід',
					total_amount: '300',
					status: 'paid',
					created_at: '2026-08-25T12:00:00.000Z',
					terminal_id: 'terminal-1',
					type: 'table'
				}
			],
			error: null
		});
		const client = {
			from: vi.fn((table: string) => (table === 'terminals' ? terminalQuery : orderQuery))
		} as unknown as SupabaseClient;

		const board = await createDashboardGateway(client).getPosBoard('user-1', 'merchant-1');

		expect(terminalQuery.filters).toEqual([
			['user_id', 'user-1'],
			['is_active', true]
		]);
		expect(orderQuery.filters).toContainEqual(['merchant_id', 'merchant-1']);
		expect(orderQuery.in).toHaveBeenCalledWith('status', ['pending', 'paid']);
		expect(board.terminals).toHaveLength(1);
		expect(board.activeOrders).toEqual([
			expect.objectContaining({ id: 'new-order', terminalId: 'terminal-1', amount: 840 })
		]);
	});

	it('scopes POS realtime events and removes the channel during cleanup', () => {
		const channel = {
			on: vi.fn(() => channel),
			subscribe: vi.fn(() => channel)
		};
		const client = {
			channel: vi.fn(() => channel),
			removeChannel: vi.fn(async () => ({ status: 'ok' }))
		} as unknown as SupabaseClient;
		const onChange = vi.fn();

		const cleanup = createDashboardGateway(client).subscribeDashboardUpdates(
			{ view: 'pos', userId: 'user-1', merchantId: 'merchant-1' },
			onChange
		);

		expect(channel.on).toHaveBeenCalledWith(
			'postgres_changes',
			{
				event: '*',
				schema: 'public',
				table: 'orders',
				filter: 'merchant_id=eq.merchant-1'
			},
			expect.any(Function)
		);
		expect(channel.on).toHaveBeenCalledWith(
			'postgres_changes',
			{
				event: '*',
				schema: 'public',
				table: 'terminals',
				filter: 'user_id=eq.user-1'
			},
			expect.any(Function)
		);
		expect(channel.subscribe).toHaveBeenCalledOnce();
		for (const call of channel.on.mock.calls as unknown as Array<[string, object, () => void]>) {
			call[2]();
		}
		expect(onChange).toHaveBeenCalledTimes(2);
		expect(onChange).toHaveBeenNthCalledWith(1, 'pos');
		expect(onChange).toHaveBeenNthCalledWith(2, 'pos');

		cleanup();
		expect(client.removeChannel).toHaveBeenCalledWith(channel);
	});

	it.each([
		{
			scope: { view: 'overview', userId: 'user-1', merchantId: 'merchant-1' } as const,
			listeners: [
				['orders', 'merchant_id=eq.merchant-1'],
				['terminals', 'user_id=eq.user-1']
			]
		},
		{
			scope: { view: 'invoices', merchantId: 'merchant-1' } as const,
			listeners: [['orders', 'merchant_id=eq.merchant-1']]
		},
		{
			scope: { view: 'invoice', merchantId: 'merchant-1', invoiceId: 'invoice-1' } as const,
			listeners: [
				['orders', 'id=eq.invoice-1'],
				['order_events', 'order_id=eq.invoice-1']
			]
		},
		{
			scope: { view: 'invoice-create', userId: 'user-1' } as const,
			listeners: [['terminals', 'user_id=eq.user-1']]
		},
		{
			scope: { view: 'structure', userId: 'user-1', merchantId: 'merchant-1' } as const,
			listeners: [
				['business_entities', 'user_id=eq.user-1'],
				['terminals', 'user_id=eq.user-1'],
				['merchants', 'id=eq.merchant-1']
			]
		}
	])('maps $scope.view realtime scope to owned rows', ({ scope, listeners }) => {
		const channel = {
			on: vi.fn(() => channel),
			subscribe: vi.fn(() => channel)
		};
		const client = {
			channel: vi.fn(() => channel),
			removeChannel: vi.fn()
		} as unknown as SupabaseClient;

		createDashboardGateway(client).subscribeDashboardUpdates(scope, vi.fn());

		expect(channel.on).toHaveBeenCalledTimes(listeners.length);
		for (const [table, filter] of listeners) {
			expect(channel.on).toHaveBeenCalledWith(
				'postgres_changes',
				expect.objectContaining({ table, filter }),
				expect.any(Function)
			);
		}
		expect(channel.subscribe).toHaveBeenCalledOnce();
	});
});
