import { renderInvoicePng } from './telegram-invoice-renderer.ts';
import { type TelegramInvoiceEnv } from './telegram-invoice.ts';
import { merchantInvoiceCard, legalRecipient } from './telegram-invoice-metadata.ts';

const ORDER_FIELDS = 'id,merchant_id,order_number,created_at,short_id,entity_id,title,description,type,status,currency,base_amount,delivery_fee,discount_amount,total_amount,paid_amount,is_split_payment,expires_at';

async function remote(url: string, init?: RequestInit) {
	const res = await fetch(url, init);
	if (!res.ok) throw new Error('fetch_failed');
	return { status: res.status, data: await res.json() };
}

export async function handleInvoiceImageGet(request: Request, env: TelegramInvoiceEnv): Promise<Response> {
	try {
		const url = new URL(request.url);
		const orderIdMatch = url.pathname.match(/\/api\/v1\/orders\/invoice-image\/([a-zA-Z0-9_-]+)/);
		const orderId = orderIdMatch ? orderIdMatch[1] : null;
		if (!orderId) return new Response('Bad Request', { status: 400 });

		const supabaseUrl = env.SUPABASE_URL;
		const apikey = env.SUPABASE_ANON_KEY;
		if (!supabaseUrl || !apikey) return new Response('Server Error', { status: 500 });

		const headers = { apikey, Authorization: `Bearer ${apikey}`, 'Cache-Control': 'no-store' };
		const ordersUrl = new URL(`${supabaseUrl}/rest/v1/orders`);
		ordersUrl.search = new URLSearchParams({ select: ORDER_FIELDS, id: `eq.${orderId}`, limit: '2' }).toString();
		const orderResult = await remote(ordersUrl.href, { headers });
		
		const data = Array.isArray(orderResult.data) ? orderResult.data : [];
		if (data.length !== 1) return new Response('Not Found', { status: 404 });
		
		const order = data[0];
		
		const merchantsUrl = new URL(`${supabaseUrl}/rest/v1/merchants`);
		merchantsUrl.search = new URLSearchParams({ select: 'id,user_id,business_name,is_active', id: `eq.${order.merchant_id}`, limit: '2' }).toString();
		const merchantResult = await remote(merchantsUrl.href, { headers });
		const mData = Array.isArray(merchantResult.data) ? merchantResult.data : [];
		if (mData.length !== 1) return new Response('Not Found', { status: 404 });
		const merchant = mData[0];
		
		const amountText = String(order.base_amount || order.total_amount || 0);
		const [whole, fraction = ''] = (amountText.includes('.') ? amountText : amountText + '.00').split('.');
		const amount = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
		const recipient = legalRecipient(merchant, false);
		
		const card = merchantInvoiceCard(order, recipient, amount, env.TELEGRAM_INVOICE_PUBLIC_ORIGIN!, Date.now());
		
		const pngBuffer = await renderInvoicePng(card);
		return new Response(pngBuffer, {
			headers: {
				'Content-Type': 'image/png',
				'Cache-Control': 'public, max-age=86400',
				'Access-Control-Allow-Origin': '*'
			}
		});
	} catch {
		return new Response('Not Found', { status: 404 });
	}
}
