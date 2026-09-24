import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createMerchantDataGateway } from './merchant-data-gateway';
import { createSessionFence } from '../auth/session-fence';

function deferred<T>() {
	let resolve!: (value: T) => void;
	let reject!: (error: Error) => void;
	const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
	return { promise, resolve, reject };
}

function sessionResult(userId = 'user-1', accessToken = 'refreshed-token') {
	return { data: { session: { access_token: accessToken, user: { id: userId } } }, error: null };
}

const orderInput = {
	type: 'fixed' as const,
	amount: 125.5,
	orderNumber: 'APP-1',
	title: 'Рахунок APP-1',
	merchantId: 'merchant-1',
	entityId: 'entity-1',
	terminalId: 'terminal-1'
};
const orderRow = {
	id: 'order-1', total_amount: 125.5, status: 'pending', created_at: '2026-08-28T08:00:00Z',
	order_number: 'APP-1', type: 'fixed', share_url: 'https://example.test/pay/order-1', terminal_id: 'terminal-1'
};

describe.each(['create', 'cancel'] as const)('%s order dispatch session fence', (operation) => {
	function start(gateway: ReturnType<typeof createMerchantDataGateway>, isCurrent: () => boolean, userId = 'user-1') {
		return operation === 'create'
			? gateway.createOrder(orderInput, userId, isCurrent)
			: gateway.cancelOrder('order/1', userId, isCurrent);
	}

	function setup() {
		const session = deferred<Awaited<ReturnType<SupabaseClient['auth']['getSession']>>>();
		const getSession = vi.fn(() => session.promise);
		const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ order: orderRow })));
		const client = { auth: { getSession } } as unknown as SupabaseClient;
		const gateway = createMerchantDataGateway(client, fetcher);
		const resolveSession = (result: unknown) => session.resolve(result as Awaited<typeof session.promise>);
		return { gateway, fetcher, getSession, resolveSession };
	}

	it('rejects a different user returned by deferred getSession without fetching', async () => {
		const app = setup();
		const task = start(app.gateway, () => true);
		expect(app.getSession).toHaveBeenCalledTimes(1);
		expect(app.fetcher).not.toHaveBeenCalled();
		app.resolveSession(sessionResult('user-2'));
		await expect(task).rejects.toThrow('Сесію втрачено');
		expect(app.fetcher).not.toHaveBeenCalled();
	});

	it.each([
		['logout', { data: { session: null }, error: null }],
		['missing user', { data: { session: { access_token: 'token' } }, error: null }],
		['missing token', sessionResult('user-1', '')],
		['session error', { ...sessionResult(), error: new Error('session failed') }]
	])('rejects %s during deferred getSession without fetching', async (_reason, result) => {
		const app = setup();
		const task = start(app.gateway, () => true);
		app.resolveSession(result);
		await expect(task).rejects.toThrow('Сесію втрачено');
		expect(app.fetcher).not.toHaveBeenCalled();
	});

	it.each(['logout begun', 'same-identity restore', 'A → B → A', 'disposal'])('rejects the old generation after %s even if getSession returns the same user', async (reason) => {
		const app = setup();
		const fence = createSessionFence();
		const generation = fence.capture();
		const isCurrent = vi.fn(() => fence.isCurrent(generation));
		const task = start(app.gateway, isCurrent);
		fence.advance();
		if (reason === 'A → B → A') fence.advance();
		app.resolveSession(sessionResult());
		await expect(task).rejects.toThrow('Сесію втрачено');
		expect(isCurrent).toHaveBeenCalledTimes(1);
		expect(app.fetcher).not.toHaveBeenCalled();
	});

	it('accepts a refreshed token for the same user in the current generation with unchanged payload', async () => {
		const app = setup();
		const fence = createSessionFence();
		const generation = fence.capture();
		const task = start(app.gateway, () => fence.isCurrent(generation));
		app.resolveSession(sessionResult());
		await task;
		expect(app.fetcher).toHaveBeenCalledExactlyOnceWith(
			operation === 'create' ? '/app/api/v1/orders' : '/app/api/v1/orders/order%2F1',
			{
				method: operation === 'create' ? 'POST' : 'PATCH',
				headers: { Authorization: 'Bearer refreshed-token', 'Content-Type': 'application/json' },
				body: JSON.stringify(operation === 'create'
					? {
						type: 'fixed',
						order_number: 'APP-1',
						title: 'Рахунок APP-1',
						merchant_id: 'merchant-1',
						entity_id: 'entity-1',
						terminal_id: 'terminal-1',
						amount: 125.5
					}
					: { status: 'cancelled' })
			}
		);
	});

	it('rejects an empty expected identity without fetching', async () => {
		const app = setup();
		const task = start(app.gateway, () => true, '');
		app.resolveSession(sessionResult());
		await expect(task).rejects.toThrow('Сесію втрачено');
		expect(app.fetcher).not.toHaveBeenCalled();
	});

	it.each(['success', 'api error', 'network error'] as const)('retains an already-dispatched %s after generation changes, without retrying', async (outcome) => {
		const app = setup();
		const response = deferred<Response>();
		const dispatched = deferred<void>();
		app.fetcher.mockImplementation(() => { dispatched.resolve(); return response.promise; });
		const fence = createSessionFence();
		const generation = fence.capture();
		const isCurrent = vi.fn(() => fence.isCurrent(generation));
		const task = start(app.gateway, isCurrent);
		app.resolveSession(sessionResult());
		await dispatched.promise;
		fence.advance();
		if (outcome === 'success') {
			response.resolve(new Response(JSON.stringify({ order: orderRow })));
			if (operation === 'create') await expect(task).resolves.toMatchObject({ id: 'order-1', amount: 125.5 });
			else await expect(task).resolves.toBeUndefined();
		} else if (outcome === 'api error') {
			response.resolve(new Response(JSON.stringify({ message: 'Original API failure' }), { status: 409 }));
			await expect(task).rejects.toThrow('Original API failure');
		} else {
			const error = new Error('Original network failure');
			response.reject(error);
			await expect(task).rejects.toBe(error);
		}
		expect(app.fetcher).toHaveBeenCalledTimes(1);
		expect(isCurrent).toHaveBeenCalledTimes(1);
	});
});

function query(data: unknown[] | null, error: Error | null = null) {
	const chain = {
		select: vi.fn(() => chain),
		eq: vi.fn(() => chain),
		gte: vi.fn(() => chain),
		order: vi.fn(() => chain),
		limit: vi.fn(() => Promise.resolve({ data, error })),
		then: (resolve: (value: { data: unknown[] | null; error: Error | null }) => void) =>
			Promise.resolve({ data, error }).then(resolve)
	};
	return chain;
}

describe('merchant data gateway', () => {
	it.each(['fixed', 'open_amount'] as const)('sends a seller without a terminal for %s', async (type) => {
		const getSession = vi.fn().mockResolvedValue(sessionResult('user-1', 'token-1'));
		const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
			order: { ...orderRow, type, total_amount: type === 'open_amount' ? 0 : 125.5, terminal_id: null }
		}), { status: 201 }));
		const client = { auth: { getSession } } as unknown as SupabaseClient;

		await createMerchantDataGateway(client, fetcher).createOrder({
			type, amount: type === 'open_amount' ? 0 : 125.5, orderNumber: 'APP-1',
			title: 'Рахунок APP-1', merchantId: 'merchant-1', entityId: 'entity-1'
		}, 'user-1', () => true);

		const body = JSON.parse((fetcher.mock.calls[0]?.[1] as RequestInit).body as string);
		expect(body).toMatchObject({ type, entity_id: 'entity-1', merchant_id: 'merchant-1' });
		expect(body).not.toHaveProperty('terminal_id');
	});

	it('creates an order through the scoped authenticated Worker API', async () => {
		const getSession = vi.fn().mockResolvedValue({ data: { session: { access_token: 'token-1', user: { id: 'user-1' } } }, error: null });
		const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
			order: {
				id: 'order-1', total_amount: 125.5, status: 'pending', created_at: '2026-08-28T08:00:00Z',
				order_number: 'APP-1', type: 'fixed', share_url: 'https://rakhunok.com/pay/order-1',
				terminal_id: 'terminal-1'
			}
		}), { status: 201 }));
		const client = { auth: { getSession } } as unknown as SupabaseClient;

		const result = await createMerchantDataGateway(client, fetcher).createOrder({
			type: 'fixed', amount: 125.5, orderNumber: 'APP-1', title: 'Рахунок APP-1',
			merchantId: 'merchant-1', entityId: 'entity-1', terminalId: 'terminal-1'
		}, 'user-1', () => true);

		expect(fetcher).toHaveBeenCalledWith('/app/api/v1/orders', expect.objectContaining({
			method: 'POST',
			headers: expect.objectContaining({ Authorization: 'Bearer token-1' }),
			body: JSON.stringify({
				type: 'fixed',
				order_number: 'APP-1',
				title: 'Рахунок APP-1',
				merchant_id: 'merchant-1',
				entity_id: 'entity-1',
				terminal_id: 'terminal-1',
				amount: 125.5
			})
		}));
		expect(result).toEqual({
			id: 'order-1', amount: 125.5, status: 'pending', createdAt: '2026-08-28T08:00:00Z',
			orderNumber: 'APP-1', type: 'fixed', shareUrl: 'https://rakhunok.com/pay/order-1', terminalId: 'terminal-1'
		});
	});

	it.each([undefined, null, 'not-a-number', 0, -1])('rejects an invalid fixed-order response amount: %s', async (totalAmount) => {
		const getSession = vi.fn().mockResolvedValue(sessionResult('user-1', 'token-1'));
		const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
			order: { ...orderRow, total_amount: totalAmount }
		}), { status: 201 }));
		const client = { auth: { getSession } } as unknown as SupabaseClient;

		await expect(createMerchantDataGateway(client, fetcher).createOrder(orderInput, 'user-1', () => true))
			.rejects.toThrow('Сервер повернув некоректну суму рахунку.');
	});

	it('surfaces structured Worker API errors', async () => {
		const getSession = vi.fn().mockResolvedValue({ data: { session: { access_token: 'token-1', user: { id: 'user-1' } } }, error: null });
		const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
			error: true,
			message: 'Реквізити мерчанта не налаштовані.'
		}), { status: 422 }));
		const client = { auth: { getSession } } as unknown as SupabaseClient;

		await expect(createMerchantDataGateway(client, fetcher).createOrder({
			type: 'fixed', amount: 125.5, orderNumber: 'APP-1', title: 'Рахунок APP-1',
			merchantId: 'merchant-1', entityId: 'entity-1', terminalId: 'terminal-1'
		}, 'user-1', () => true)).rejects.toThrow('Реквізити мерчанта не налаштовані.');
	});

	it('scopes active entities and terminals to the authenticated user', async () => {
		const entities = query([{ id: 'entity-1', business_name: 'ТОВ Рахунок', display_name: 'Кавʼярня' }]);
		const terminals = query([{ id: 'terminal-1', name: 'Стіл 1', code: 'table-1', type: 'table', entity_id: 'entity-1' }]);
		const client = {
			from: vi.fn((table: string) => (table === 'business_entities' ? entities : terminals))
		} as unknown as SupabaseClient;

		const result = await createMerchantDataGateway(client).getStructure('user-1');

		expect(entities.eq).toHaveBeenNthCalledWith(1, 'user_id', 'user-1');
		expect(entities.eq).toHaveBeenNthCalledWith(2, 'is_active', true);
		expect(terminals.eq).toHaveBeenNthCalledWith(1, 'user_id', 'user-1');
		expect(terminals.eq).toHaveBeenNthCalledWith(2, 'is_active', true);
		expect(result).toEqual({
			entities: [{ id: 'entity-1', name: 'Кавʼярня' }],
			terminals: [{ id: 'terminal-1', name: 'Стіл 1', code: 'table-1', type: 'table', entityId: 'entity-1' }]
		});
	});

	it('fails the whole read when either scoped query fails', async () => {
		const failedQuery = query(null, new Error('denied'));
		const client = { from: vi.fn(() => failedQuery) } as unknown as SupabaseClient;

		await expect(createMerchantDataGateway(client).getStructure('user-1')).rejects.toThrow(
			'Не вдалося завантажити каси та столи.'
		);
	});

	it('lists recent orders only for the authenticated merchant', async () => {
		const orders = query([{ id: 'order-1', total_amount: 125.5, status: 'paid', created_at: '2026-08-26T10:00:00Z', order_number: 'INV-1', type: 'fixed', share_url: 'https://example.com/pay/order-1' }]);
		const client = { from: vi.fn(() => orders) } as unknown as SupabaseClient;

		const result = await createMerchantDataGateway(client).listOrders('merchant-1', '2026-08-01T00:00:00.000Z');

		expect(orders.eq).toHaveBeenCalledWith('merchant_id', 'merchant-1');
		expect(orders.gte).toHaveBeenCalledWith('created_at', '2026-08-01T00:00:00.000Z');
		expect(orders.limit).toHaveBeenCalledWith(250);
		expect(orders.select).toHaveBeenCalledWith('id, total_amount, status, created_at, order_number, type, share_url, terminal_id');
		expect(result[0]).toEqual({ id: 'order-1', amount: 125.5, status: 'paid', createdAt: '2026-08-26T10:00:00Z', orderNumber: 'INV-1', type: 'fixed', shareUrl: 'https://example.com/pay/order-1' });
	});

	it('cancels an order through the authenticated Worker API', async () => {
		const getSession = vi.fn().mockResolvedValue({ data: { session: { access_token: 'token-1', user: { id: 'user-1' } } }, error: null });
		const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
		const client = { auth: { getSession } } as unknown as SupabaseClient;

		await createMerchantDataGateway(client, fetcher).cancelOrder('order/1', 'user-1', () => true);

		expect(fetcher).toHaveBeenCalledWith('/app/api/v1/orders/order%2F1', expect.objectContaining({
			method: 'PATCH',
			headers: expect.objectContaining({ Authorization: 'Bearer token-1' }),
			body: JSON.stringify({ status: 'cancelled' })
		}));
	});

	it('sends only the order id to the Telegram Worker endpoint with the current session', async () => {
		const getSession = vi.fn().mockResolvedValue(sessionResult());
		const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true, delivery: 'sent' })));
		const client = { auth: { getSession } } as unknown as SupabaseClient;

		await createMerchantDataGateway(client, fetcher).sendTelegramInvoice('order/1', 'user-1', () => true);

		expect(fetcher).toHaveBeenCalledExactlyOnceWith('/app/api/v1/merchant/telegram/invoices/send', {
			method: 'POST',
			headers: { Authorization: 'Bearer refreshed-token', 'Content-Type': 'application/json' },
			body: JSON.stringify({ order_id: 'order/1' })
		});
	});

	it('subscribes to orders for one merchant and removes the channel', () => {
		const channel = { on: vi.fn(), subscribe: vi.fn() };
		channel.on.mockReturnValue(channel);
		channel.subscribe.mockReturnValue(channel);
		const removeChannel = vi.fn();
		const client = { channel: vi.fn(() => channel), removeChannel } as unknown as SupabaseClient;
		const stop = createMerchantDataGateway(client).subscribeOrders('merchant-1', vi.fn());

		expect(channel.on).toHaveBeenCalledWith('postgres_changes', expect.objectContaining({ filter: 'merchant_id=eq.merchant-1' }), expect.any(Function));
		stop();
		expect(removeChannel).toHaveBeenCalledWith(channel);
	});
});