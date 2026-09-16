import { renderInvoicePng, formatInvoiceDate } from './telegram-invoice-renderer.ts';
import { captionLabel, legalRecipient, merchantInvoiceCard, timestamp, CARD_EXPIRY_NOTE } from './telegram-invoice-metadata.ts';

export interface MerchantTelegramInvoiceEnv {
	SUPABASE_URL?: string;
	SUPABASE_ANON_KEY?: string;
	TELEGRAM_BOT_TOKEN?: string;
	TELEGRAM_INVOICE_PUBLIC_ORIGIN?: string;
}

type Row = Record<string, unknown>;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TELEGRAM_ID = /^[1-9]\d{0,15}$/;
const TIMEOUT_MS = 8_000;
const ORDER_FIELDS = 'id,merchant_id,order_number,created_at,short_id,entity_id,title,description,type,status,currency,base_amount,delivery_fee,discount_amount,total_amount,paid_amount,is_split_payment,expires_at';

const record = (value: unknown): value is Row => !!value && typeof value === 'object' && !Array.isArray(value);
const uuid = (value: unknown): value is string => typeof value === 'string' && UUID.test(value);

function reply(status: number, data: Row): Response {
	return Response.json(data, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
}

function failure(status: number, error: string, message: string): Response {
	return reply(status, { ok: false, error, message });
}

function settings(env: MerchantTelegramInvoiceEnv) {
	if (!env.TELEGRAM_BOT_TOKEN || !/^\d+:[A-Za-z0-9_-]{20,}$/.test(env.TELEGRAM_BOT_TOKEN) ||
		!env.SUPABASE_ANON_KEY || !/^[A-Za-z0-9_.-]+$/.test(env.SUPABASE_ANON_KEY) || !env.SUPABASE_URL ||
		!['https://letsrealtalk.com', 'https://rakhunok.com'].includes(env.TELEGRAM_INVOICE_PUBLIC_ORIGIN ?? '')) return null;
	try {
		const url = new URL(env.SUPABASE_URL);
		if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash ||
			url.pathname !== '/' || (env.SUPABASE_URL !== url.origin && env.SUPABASE_URL !== `${url.origin}/`)) return null;
		return { supabase: url.origin, apikey: env.SUPABASE_ANON_KEY, bot: env.TELEGRAM_BOT_TOKEN,
			origin: env.TELEGRAM_INVOICE_PUBLIC_ORIGIN! };
	} catch { return null; }
}

function cents(value: unknown): bigint | null {
	if (typeof value !== 'number' && typeof value !== 'string') return null;
	const text = String(value);
	if (!/^(0|[1-9]\d{0,13})(\.\d{1,2})?$/.test(text)) return null;
	const [whole, fraction = ''] = text.split('.');
	const amount = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
	if (amount > BigInt(Number.MAX_SAFE_INTEGER) || (typeof value === 'number' && value > 1_000_000_000)) return null;
	return amount;
}

async function boundedJson(body: ReadableStream<Uint8Array> | null, max: number): Promise<unknown> {
	if (!body) throw new Error('empty');
	const reader = body.getReader();
	const chunks: Uint8Array[] = [];
	let size = 0;
	try {
		for (;;) {
			const { done, value } = await reader.read();
			if (done) break;
			size += value.byteLength;
			if (size > max) { await reader.cancel(); throw new Error('size'); }
			chunks.push(value);
		}
	} finally { reader.releaseLock(); }
	const bytes = new Uint8Array(size);
	let offset = 0;
	for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
	return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
}

async function remote(url: string, init: RequestInit): Promise<{ status: number; data: unknown }> {
	const controller = new AbortController();
	let timer: ReturnType<typeof setTimeout> | undefined;
	const deadline = new Promise<never>((_, reject) => {
		timer = setTimeout(() => { controller.abort(); reject(new Error('timeout')); }, TIMEOUT_MS);
	});
	try {
		return await Promise.race([deadline, (async () => {
			const response = await fetch(url, { ...init, redirect: 'manual', signal: controller.signal });
			if (response.status !== 200) {
				await response.body?.cancel();
				return { status: response.status, data: null };
			}
			return { status: response.status, data: await boundedJson(response.body, 32_768) };
		})()]);
	} finally { clearTimeout(timer); }
}

function one(data: unknown): Row | null {
	return Array.isArray(data) && data.length === 1 && record(data[0]) ? data[0] : null;
}

function telegramRecipient(user: Row): number | null {
	if (!Array.isArray(user.identities)) return null;
	const matches = user.identities.filter((identity): identity is Row => record(identity) && (identity.provider === 'custom:telegram' || identity.provider === 'telegram'));
	if (matches.length !== 1) return null;
	const identity = matches[0];
	if (!uuid(identity.identity_id) || !uuid(identity.user_id) || identity.user_id !== user.id) return null;
	if (identity.provider_id !== undefined && identity.id !== undefined && identity.provider_id !== identity.id) return null;
	const providerId = identity.provider_id ?? identity.id;
	if (typeof providerId !== 'string' || !TELEGRAM_ID.test(providerId)) return null;
	const chatId = Number(providerId);
	return Number.isSafeInteger(chatId) ? chatId : null;
}

function validateOrder(row: Row, now: number): bigint | null {
	if (!['fixed', 'table'].includes(String(row.type)) || row.status !== 'pending' || row.currency !== 'UAH' ||
		row.is_split_payment !== false || !(row.paid_amount === null || cents(row.paid_amount) === 0n)) return null;
	try { if (row.expires_at !== null && timestamp(row.expires_at) <= now) return null; }
	catch { return null; }
	const base = cents(row.base_amount), delivery = cents(row.delivery_fee);
	const discount = cents(row.discount_amount), total = cents(row.total_amount);
	if (base === null || delivery === null || discount === null || total === null || base <= 0n || total <= 0n ||
		discount > base || base + delivery - discount !== total) return null;
	return total;
}

function optionalText(value: unknown): boolean {
	return value === undefined || value === null || typeof value === 'string';
}

function escapeHtml(value: string): string {
	return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export async function handleMerchantTelegramInvoice(request: Request, env: MerchantTelegramInvoiceEnv): Promise<Response> {
	if (request.method !== 'POST') return new Response(null, { status: 405, headers: { Allow: 'POST' } });
	const config = settings(env);
	if (!config) return failure(503, 'telegram_unavailable', 'Надсилання в Telegram зараз не налаштоване.');
	const authorization = request.headers.get('Authorization');
	if (!authorization || !/^Bearer [A-Za-z0-9._~-]+$/i.test(authorization) || authorization.length > 8192)
		return failure(401, 'unauthorized', 'Увійдіть, щоб надіслати рахунок.');
	let body: unknown;
	try { body = await boundedJson(request.body, 1024); } catch {
		return failure(400, 'invalid_request', 'Передайте лише order_id наявного рахунку.');
	}
	if (!record(body) || Object.keys(body).length !== 1 || !uuid(body.order_id) || new URL(request.url).search)
		return failure(400, 'invalid_request', 'Передайте лише order_id наявного рахунку.');
	const orderId = body.order_id.toLowerCase();
	const headers = { apikey: config.apikey, Authorization: authorization, 'Cache-Control': 'no-store' };
	let chatId: number;
	let order: Row;
	let recipient: string;
	let amount: bigint;
	try {
		const auth = await remote(`${config.supabase}/auth/v1/user`, { headers });
		if (auth.status === 401 || auth.status === 403) return failure(403, 'forbidden', 'Сесія більше не має доступу до цього рахунку.');
		if (auth.status !== 200 || !record(auth.data) || !uuid(auth.data.id)) throw new Error('auth');
		const destination = telegramRecipient(auth.data);
		if (destination === null) return failure(409, 'telegram_identity_required', 'Прив’яжіть один Telegram-акаунт у профілі та повторіть спробу.');
		chatId = destination;
		const ordersUrl = new URL(`${config.supabase}/rest/v1/orders`);
		ordersUrl.search = new URLSearchParams({ select: ORDER_FIELDS, id: `eq.${orderId}`, limit: '2' }).toString();
		const orderResult = await remote(ordersUrl.href, { headers });
		if (orderResult.status === 401 || orderResult.status === 403) return failure(403, 'forbidden', 'Немає доступу до цього рахунку.');
		if (orderResult.status !== 200) throw new Error('orders');
		if (Array.isArray(orderResult.data) && orderResult.data.length === 0) return failure(404, 'order_not_found', 'Рахунок не знайдено.');
		const selectedOrder = one(orderResult.data);
		if (!selectedOrder || selectedOrder.id !== orderId || !uuid(selectedOrder.merchant_id)) throw new Error('order');
		order = selectedOrder;
		const merchantsUrl = new URL(`${config.supabase}/rest/v1/merchants`);
		merchantsUrl.search = new URLSearchParams({ select: 'id,user_id,business_name,is_active', id: `eq.${order.merchant_id}`, user_id: `eq.${auth.data.id}`, limit: '2' }).toString();
		const ownership = await remote(merchantsUrl.href, { headers });
		if (ownership.status === 401 || ownership.status === 403 || (Array.isArray(ownership.data) && ownership.data.length === 0))
			return failure(403, 'forbidden', 'Лише власник рахунку може надіслати його.');
		const merchant = one(ownership.data);
		if (ownership.status !== 200 || !merchant || !uuid(merchant.id) || !uuid(merchant.user_id) || merchant.id !== order.merchant_id ||
			merchant.user_id !== auth.data.id || merchant.is_active !== true) return failure(403, 'forbidden', 'Лише активний власник рахунку може надіслати його.');
		const validated = validateOrder(order, Date.now());
		if (validated === null) return failure(409, 'invoice_not_deliverable', 'Можна надіслати лише активний рахунок з фіксованою додатною сумою.');
		amount = validated;
		if (order.entity_id === null) recipient = legalRecipient(merchant, false);
		else {
			if (!uuid(order.entity_id)) throw new Error('entity id');
			const entitiesUrl = new URL(`${config.supabase}/rest/v1/business_entities`);
			entitiesUrl.search = new URLSearchParams({ select: 'id,user_id,business_name,business_type,is_active', id: `eq.${order.entity_id}`, user_id: `eq.${auth.data.id}`, limit: '2' }).toString();
			const entityResult = await remote(entitiesUrl.href, { headers });
			if (entityResult.status === 401 || entityResult.status === 403 || (Array.isArray(entityResult.data) && entityResult.data.length === 0))
				return failure(403, 'forbidden', 'Отримувач рахунку недоступний.');
			const entity = one(entityResult.data);
			if (entityResult.status !== 200 || !entity || entity.id !== order.entity_id || entity.user_id !== auth.data.id || entity.is_active !== true)
				return failure(403, 'forbidden', 'Отримувач рахунку недоступний.');
			recipient = legalRecipient(entity, true);
		}
		if (![order.title, order.description].every(optionalText)) throw new Error('labels');
	} catch { return failure(503, 'verification_unavailable', 'Не вдалося перевірити рахунок. Нічого не надіслано.'); }

	let form: FormData;
	try {
		const card = merchantInvoiceCard(order, recipient, amount, config.origin, Date.now());
		const title = captionLabel(order.title, 200) || captionLabel(order.description, 200) || 'Оплата замовлення';
		form = new FormData();
		form.set('chat_id', String(chatId));
		form.set('photo', await renderInvoicePng(card), 'invoice.png');
		form.set('caption', `<b>RAHUNOK</b>\n<b>${escapeHtml(title)}</b>\nОтримувач: ${escapeHtml(captionLabel(card.recipient, 100))}\nРахунок ${escapeHtml(card.reference)} на <b>${card.amount} UAH</b>\nДіє до ${formatInvoiceDate(card.displayExpiresAt)} ${CARD_EXPIRY_NOTE}\nВідкрийте рахунок, щоб перевірити актуальний стан перед оплатою.`);
		form.set('parse_mode', 'HTML');
		form.set('reply_markup', JSON.stringify({ inline_keyboard: [[{ text: 'Відкрити рахунок', url: card.checkoutUrl }]] }));
	} catch { return failure(503, 'render_unavailable', 'Не вдалося підготувати зображення. Нічого не надіслано.'); }
	try {
		const sent = await remote(`https://api.telegram.org/bot${config.bot}/sendPhoto`, { method: 'POST', body: form });
		if (sent.status === 429) return failure(429, 'telegram_rate_limited', 'Telegram обмежив надсилання. Автоматичного повтору не було.');
		if (sent.status === 200 && record(sent.data) && sent.data.ok === false)
			return failure(502, 'telegram_rejected', 'Telegram відхилив рахунок. Перевірте діалог із ботом.');
		const message = record(sent.data) && sent.data.ok === true && record(sent.data.result) ? sent.data.result : null;
		if (sent.status !== 200 || !message || !Number.isSafeInteger(message.message_id) || Number(message.message_id) <= 0 ||
			!record(message.chat) || message.chat.id !== chatId) throw new Error('unconfirmed');
		return reply(200, { ok: true, delivery: 'sent', order_id: orderId, message_id: message.message_id });
	} catch {
		return failure(503, 'delivery_unknown', 'Не вдалося підтвердити доставку. Перевірте чат із ботом перед повтором, щоб не створити дублікат.');
	}
}
