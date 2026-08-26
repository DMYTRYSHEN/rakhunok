import type { SupabaseClient } from '@supabase/supabase-js';

export type BusinessEntity = {
	id: string;
	name: string;
};

export type Terminal = {
	id: string;
	name: string;
	code: string;
	type: 'table' | 'kasa' | 'dynamic_qr' | 'nfc_tag' | 'courier';
	entityId: string;
};

export type MerchantStructure = {
	entities: BusinessEntity[];
	terminals: Terminal[];
};

export type OrderSummary = {
	id: string;
	amount: number;
	status: string;
	createdAt: string;
	orderNumber: string;
	type: string;
	shareUrl: string;
};

type EntityRow = {
	id: string;
	business_name: string;
	display_name: string | null;
};

type TerminalRow = {
	id: string;
	name: string;
	code: string;
	type: Terminal['type'];
	entity_id: string;
};

type OrderRow = {
	id: string;
	total_amount: number;
	status: string;
	created_at: string;
	order_number: string;
	type: string;
	share_url: string;
};

export function createMerchantDataGateway(client: SupabaseClient, fetcher: typeof fetch = fetch) {
	async function workerRequest(path: string, init: RequestInit) {
		const session = await client.auth.getSession();
		const accessToken = session.data.session?.access_token;
		if (session.error || !accessToken) throw new Error('Сесію втрачено. Увійдіть ще раз.');
		const response = await fetcher(path, {
			...init,
			headers: {
				Authorization: `Bearer ${accessToken}`,
				'Content-Type': 'application/json',
				...init.headers
			}
		});
		if (!response.ok) throw new Error('Не вдалося скасувати рахунок.');
	}

	return {
		async getStructure(userId: string): Promise<MerchantStructure> {
			const [entityResult, terminalResult] = await Promise.all([
				client
					.from('business_entities')
					.select('id, business_name, display_name')
					.eq('user_id', userId)
					.eq('is_active', true)
					.order('created_at', { ascending: true }),
				client
					.from('terminals')
					.select('id, name, code, type, entity_id')
					.eq('user_id', userId)
					.eq('is_active', true)
					.order('created_at', { ascending: true })
			]);

			if (entityResult.error || terminalResult.error) {
				throw new Error('Не вдалося завантажити каси та столи.');
			}

			return {
				entities: ((entityResult.data ?? []) as EntityRow[]).map((entity) => ({
					id: entity.id,
					name: entity.display_name || entity.business_name
				})),
				terminals: ((terminalResult.data ?? []) as TerminalRow[]).map((terminal) => ({
					id: terminal.id,
					name: terminal.name,
					code: terminal.code,
					type: terminal.type,
					entityId: terminal.entity_id
				}))
			};
		},

		async listOrders(merchantId: string, createdAfter?: string): Promise<OrderSummary[]> {
			let query = client
				.from('orders')
				.select('id, total_amount, status, created_at, order_number, type, share_url')
				.eq('merchant_id', merchantId);
			if (createdAfter) query = query.gte('created_at', createdAfter);
			const result = await query
				.order('created_at', { ascending: false })
				.limit(250);
			if (result.error) throw new Error('Не вдалося завантажити історію оплат.');
			return ((result.data ?? []) as OrderRow[]).map((order) => ({
				id: order.id,
				amount: Number(order.total_amount) || 0,
				status: order.status,
				createdAt: order.created_at,
				orderNumber: order.order_number,
				type: order.type,
				shareUrl: order.share_url
			}));
		},

		async cancelOrder(orderId: string): Promise<void> {
			await workerRequest(`/api/v1/orders/${encodeURIComponent(orderId)}`, {
				method: 'PATCH',
				body: JSON.stringify({ status: 'cancelled' })
			});
		},

		subscribeOrders(merchantId: string, onChange: () => void): () => void {
			const channel = client
				.channel(`merchant-app-orders-${merchantId}`)
				.on(
					'postgres_changes',
					{ event: '*', schema: 'public', table: 'orders', filter: `merchant_id=eq.${merchantId}` },
					onChange
				)
				.subscribe();
			return () => void client.removeChannel(channel);
		}
	};
}

export type MerchantDataGateway = ReturnType<typeof createMerchantDataGateway>;