import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createMerchantDataGateway } from './merchant-data-gateway';

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
	it('creates an order through the scoped authenticated Worker API', async () => {
		const getSession = vi.fn().mockResolvedValue({ data: { session: { access_token: 'token-1' } }, error: null });
		const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
			order: {
				id: 'order-1', total_amount: 125.5, status: 'pending', created_at: '2026-08-28T08:00:00Z',
				order_number: 'APP-1', type: 'fixed', share_url: 'https://rakhunok.com/pay/order-1'
			}
		}), { status: 201 }));
		const client = { auth: { getSession } } as unknown as SupabaseClient;

		const result = await createMerchantDataGateway(client, fetcher).createOrder({
			type: 'fixed', amount: 125.5, orderNumber: 'APP-1', title: 'Рахунок APP-1'
		});

		expect(fetcher).toHaveBeenCalledWith('/app/api/v1/orders', expect.objectContaining({
			method: 'POST',
			headers: expect.objectContaining({ Authorization: 'Bearer token-1' }),
			body: expect.stringContaining('"amount":125.5')
		}));
		expect(result).toEqual({
			id: 'order-1', amount: 125.5, status: 'pending', createdAt: '2026-08-28T08:00:00Z',
			orderNumber: 'APP-1', type: 'fixed', shareUrl: 'https://rakhunok.com/pay/order-1'
		});
	});

	it('surfaces structured Worker API errors', async () => {
		const getSession = vi.fn().mockResolvedValue({ data: { session: { access_token: 'token-1' } }, error: null });
		const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
			error: true,
			message: 'Реквізити мерчанта не налаштовані.'
		}), { status: 422 }));
		const client = { auth: { getSession } } as unknown as SupabaseClient;

		await expect(createMerchantDataGateway(client, fetcher).createOrder({
			type: 'fixed', amount: 125.5, orderNumber: 'APP-1', title: 'Рахунок APP-1'
		})).rejects.toThrow('Реквізити мерчанта не налаштовані.');
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
		expect(orders.select).toHaveBeenCalledWith('id, total_amount, status, created_at, order_number, type, share_url');
		expect(result[0]).toEqual({ id: 'order-1', amount: 125.5, status: 'paid', createdAt: '2026-08-26T10:00:00Z', orderNumber: 'INV-1', type: 'fixed', shareUrl: 'https://example.com/pay/order-1' });
	});

	it('cancels an order through the authenticated Worker API', async () => {
		const getSession = vi.fn().mockResolvedValue({ data: { session: { access_token: 'token-1' } }, error: null });
		const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
		const client = { auth: { getSession } } as unknown as SupabaseClient;

		await createMerchantDataGateway(client, fetcher).cancelOrder('order/1');

		expect(fetcher).toHaveBeenCalledWith('/app/api/v1/orders/order%2F1', expect.objectContaining({
			method: 'PATCH',
			headers: expect.objectContaining({ Authorization: 'Bearer token-1' }),
			body: JSON.stringify({ status: 'cancelled' })
		}));
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