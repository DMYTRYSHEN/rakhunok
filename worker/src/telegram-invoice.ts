/** Isolated operator-only self test. No KV, creation, payment mutation or send retries. */
import { renderInvoicePng, formatInvoiceDate } from './telegram-invoice-renderer.ts';
import { captionLabel, legalRecipient, invoiceCard, timestamp, CARD_EXPIRY_NOTE } from './telegram-invoice-metadata.ts';
export { renderInvoicePng } from './telegram-invoice-renderer.ts';

export interface TelegramInvoiceEnv {
	SUPABASE_URL?: string;
	SUPABASE_ANON_KEY?: string;
	TELEGRAM_BOT_TOKEN?: string;
	TELEGRAM_INVOICE_SELF_TEST_ENABLED?: string;
	TELEGRAM_INVOICE_TEST_CHAT_ID?: string;
	TELEGRAM_INVOICE_TEST_USER_ID?: string;
	TELEGRAM_INVOICE_PUBLIC_ORIGIN?: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TIMEOUT_MS = 8_000;
const ORDER_FIELDS = 'id,merchant_id,order_number,created_at,short_id,entity_id,title,description,type,status,currency,base_amount,delivery_fee,discount_amount,total_amount,paid_amount,is_split_payment,expires_at';
type Row = Record<string, unknown>;
const record = (value: unknown): value is Row => !!value && typeof value === 'object' && !Array.isArray(value);
const uuid = (value: unknown): value is string => typeof value === 'string' && UUID.test(value);

function reply(status: number, data: Row): Response {
	return Response.json(data, { status, headers: {
		'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'
	} });
}

function failure(status: number, error: string, message: string): Response {
	return reply(status, { ok: false, error, message });
}

function settings(env: TelegramInvoiceEnv) {
	if (env.TELEGRAM_INVOICE_SELF_TEST_ENABLED !== 'true' ||
		!uuid(env.TELEGRAM_INVOICE_TEST_USER_ID) ||
		!env.TELEGRAM_INVOICE_TEST_CHAT_ID || !/^[1-9]\d*$/.test(env.TELEGRAM_INVOICE_TEST_CHAT_ID) ||
		!Number.isSafeInteger(Number(env.TELEGRAM_INVOICE_TEST_CHAT_ID)) ||
		!['https://letsrealtalk.com', 'https://rakhunok.com'].includes(env.TELEGRAM_INVOICE_PUBLIC_ORIGIN ?? '') ||
		!env.TELEGRAM_BOT_TOKEN || !/^\d+:[A-Za-z0-9_-]{20,}$/.test(env.TELEGRAM_BOT_TOKEN) ||
		!env.SUPABASE_ANON_KEY || !/^[A-Za-z0-9_.-]+$/.test(env.SUPABASE_ANON_KEY) ||
		!env.SUPABASE_URL) return null;
	try {
		const url = new URL(env.SUPABASE_URL);
		if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash ||
			url.pathname !== '/' || (env.SUPABASE_URL !== url.origin && env.SUPABASE_URL !== `${url.origin}/`)) return null;
		return { supabase: url.origin, apikey: env.SUPABASE_ANON_KEY,
			bot: env.TELEGRAM_BOT_TOKEN, chat: Number(env.TELEGRAM_INVOICE_TEST_CHAT_ID),
			user: env.TELEGRAM_INVOICE_TEST_USER_ID.toLowerCase(), origin: env.TELEGRAM_INVOICE_PUBLIC_ORIGIN! };
	} catch { return null; }
}

/** Decimal parsing, never floating-point multiplication or rounding of fractional cents. */
function cents(value: unknown): bigint | null {
	if (typeof value !== 'number' && typeof value !== 'string') return null;
	const text = String(value);
	if (!/^(0|[1-9]\d{0,13})(\.\d{1,2})?$/.test(text)) return null;
	const [whole, fraction = ''] = text.split('.');
	const amount = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
	// JSON numbers at large magnitudes can already have lost fractional cents.
	if (amount > BigInt(Number.MAX_SAFE_INTEGER) ||
		(typeof value === 'number' && value > 1_000_000_000)) return null;
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

/** Deadline covers headers AND body. Redirects must never forward credentials. */
async function remote(url: string, init: RequestInit): Promise<{ status: number; data: unknown }> {
	const controller = new AbortController();
	let timer: ReturnType<typeof setTimeout> | undefined;
	const deadline = new Promise<never>((_, reject) => {
		timer = setTimeout(() => { controller.abort(); reject(new Error('timeout')); }, TIMEOUT_MS);
	});
	try {
		return await Promise.race([deadline, (async () => {
			const res = await fetch(url, { ...init, redirect: 'manual', signal: controller.signal });
			if (res.status !== 200) {
				await res.body?.cancel();
				return { status: res.status, data: null };
			}
			return { status: res.status, data: await boundedJson(res.body, 32_768) };
		})()]);
	} finally { clearTimeout(timer); }
}

function one(data: unknown): Row | null {
	return Array.isArray(data) && data.length === 1 && record(data[0]) ? data[0] : null;
}

function validateOrder(row: Row, now: number): bigint | null {
	if (row.type !== 'fixed' || row.status !== 'pending' || row.currency !== 'UAH' ||
		row.is_split_payment !== false || !(row.paid_amount === null || cents(row.paid_amount) === 0n)) return null;
	try { if (row.expires_at !== null && timestamp(row.expires_at) <= now) return null; }
	catch { return null; }
	const base = cents(row.base_amount), delivery = cents(row.delivery_fee);
	const discount = cents(row.discount_amount), total = cents(row.total_amount);
	if (base === null || delivery === null || discount === null || total === null ||
		base <= 0n || total <= 0n || discount > base || base + delivery - discount !== total) return null;
	return total;
}

/** Optional legacy labels may be absent, but malformed database types fail closed. */
function optionalText(value: unknown): boolean {
	return value === undefined || value === null || typeof value === 'string';
}

function escapeHtml(value: string): string {
	return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** Shared authorization/read path: preview cannot reach rendering or Telegram. */
async function readInvoice(request: Request, env: TelegramInvoiceEnv) {
	const now = Date.now();
	if (request.method !== 'POST') return new Response(null, { status: 405, headers: { Allow: 'POST' } });
	const config = settings(env);
	if (!config) return failure(503, 'self_test_unavailable', 'Telegram self-test is not configured. Contact the operator.');
	const authorization = request.headers.get('Authorization');
	if (!authorization || !/^Bearer [A-Za-z0-9._~-]+$/i.test(authorization) || authorization.length > 8192)
		return failure(401, 'unauthorized', 'Sign in to send this invoice.');
	let body: unknown;
	try { body = await boundedJson(request.body, 1024); } catch {
		return failure(400, 'invalid_request', 'Send only the existing order_id.');
	}
	if (!record(body) || Object.keys(body).length !== 1 || !uuid(body.order_id) || new URL(request.url).search)
		return failure(400, 'invalid_request', 'Send only the existing order_id.');
	const orderId = body.order_id.toLowerCase();
	const headers = { apikey: config.apikey, Authorization: authorization, 'Cache-Control': 'no-store' };
	try {
		const auth = await remote(`${config.supabase}/auth/v1/user`, { headers });
		if (auth.status === 401 || auth.status === 403) return failure(403, 'forbidden', 'The signed-in user is not authorized for this self-test.');
		if (auth.status !== 200 || !record(auth.data) || !uuid(auth.data.id)) throw new Error('auth');
		if (auth.data.id.toLowerCase() !== config.user) return failure(403, 'forbidden', 'The signed-in user is not authorized for this self-test.');
		const ordersUrl = new URL(`${config.supabase}/rest/v1/orders`);
		ordersUrl.search = new URLSearchParams({ select: ORDER_FIELDS, id: `eq.${orderId}`, limit: '2' }).toString();
		const result = await remote(ordersUrl.href, { headers });
		if (result.status === 401 || result.status === 403) return failure(403, 'forbidden', 'Invoice access denied.');
		if (result.status !== 200) throw new Error('orders');
		if (Array.isArray(result.data) && result.data.length === 0) return failure(404, 'order_not_found', 'The existing invoice was not found.');
		const order = one(result.data);
		if (!order || order.id !== orderId || !uuid(order.merchant_id)) throw new Error('order');
		const merchantsUrl = new URL(`${config.supabase}/rest/v1/merchants`);
		merchantsUrl.search = new URLSearchParams({ select: 'id,user_id,business_name,is_active', id: `eq.${order.merchant_id}`, user_id: `eq.${config.user}`, limit: '2' }).toString();
		const ownership = await remote(merchantsUrl.href, { headers });
		if (ownership.status === 401 || ownership.status === 403 ||
			(Array.isArray(ownership.data) && ownership.data.length === 0)) return failure(403, 'forbidden', 'Only the canonical invoice owner may send this self-test.');
		const merchant = one(ownership.data);
		if (ownership.status !== 200 || !merchant || !uuid(merchant.id) || !uuid(merchant.user_id)) throw new Error('merchant');
		if (merchant.id !== order.merchant_id || merchant.user_id.toLowerCase() !== config.user)
			return failure(403, 'forbidden', 'Only the canonical invoice owner may send this self-test.');
		if (merchant.is_active !== true) return failure(403, 'forbidden', 'The invoice merchant is not active.');
		const validated = validateOrder(order, now);
		if (validated === null) return failure(409, 'invoice_not_deliverable', 'Only an unexpired fixed pending UAH invoice with consistent amounts can be sent. Refresh the invoice.');
		let recipient: string;
		if (order.entity_id === null) recipient = legalRecipient(merchant, false);
		else {
			if (!uuid(order.entity_id)) throw new Error('entity_id');
			const entitiesUrl = new URL(`${config.supabase}/rest/v1/business_entities`);
			entitiesUrl.search = new URLSearchParams({ select: 'id,user_id,business_name,business_type,is_active', id: `eq.${order.entity_id}`, user_id: `eq.${config.user}`, limit: '2' }).toString();
			const result = await remote(entitiesUrl.href, { headers });
			if (result.status === 401 || result.status === 403 || (Array.isArray(result.data) && result.data.length === 0))
				return failure(403, 'forbidden', 'The legal recipient is not available to this owner.');
			const entity = one(result.data);
			if (result.status !== 200 || !entity || !uuid(entity.id) || !uuid(entity.user_id)) throw new Error('entity');
			if (entity.id !== order.entity_id || entity.user_id.toLowerCase() !== config.user || entity.is_active !== true)
				return failure(403, 'forbidden', 'The legal recipient is not active or owned by this user.');
			recipient = legalRecipient(entity, true);
		}
		if (![order.title, order.description].every(optionalText)) throw new Error('labels');
		// Title matches the canonical dashboard purpose; description is a legacy fallback.
		const title = captionLabel(order.title, 200) || captionLabel(order.description, 200) || 'Оплата замовлення';
		return { config, orderId, title, card: invoiceCard(order, recipient, validated, config.origin, now) };
	} catch { return failure(503, 'verification_unavailable', 'Invoice verification is unavailable. Nothing was sent.'); }
}

export async function handleTelegramInvoicePreview(request: Request, env: TelegramInvoiceEnv): Promise<Response> {
	const verified = await readInvoice(request, env);
	if (verified instanceof Response) return verified;
	return reply(200, { ok: true, card: verified.card, self_test: true, order_id: verified.orderId,
		display_expiry_note: CARD_EXPIRY_NOTE });
}

export async function handleTelegramInvoice(request: Request, env: TelegramInvoiceEnv): Promise<Response> {
	const verified = await readInvoice(request, env);
	if (verified instanceof Response) return verified;
	const { config, orderId, title, card } = verified;
	let form: FormData;
	try {
		form = new FormData();
		form.set('chat_id', String(config.chat));
		form.set('photo', await renderInvoicePng(card), 'invoice.png');
		// Bound caption labels independently of the full canonical card recipient.
		form.set('caption', `<b>RAHUNOK · SELF TEST</b>\n<b>${escapeHtml(title)}</b>\nОтримувач: ${escapeHtml(captionLabel(card.recipient, 100))}\nРахунок ${escapeHtml(card.reference)} на <b>${card.amount} UAH</b>\nДіє до ${formatInvoiceDate(card.displayExpiresAt)} ${CARD_EXPIRY_NOTE}\nВідкрийте рахунок, щоб перевірити актуальний стан перед оплатою.`);
		form.set('parse_mode', 'HTML');
		form.set('reply_markup', JSON.stringify({ inline_keyboard: [[{ text: 'Відкрити рахунок', url: card.checkoutUrl }]] }));
	} catch { return failure(503, 'render_unavailable', 'The invoice image could not be prepared. Nothing was sent.'); }
	try {
		const sent = await remote(`https://api.telegram.org/bot${config.bot}/sendPhoto`, { method: 'POST', body: form });
		if (sent.status === 429) return failure(429, 'telegram_rate_limited', 'Telegram is rate limiting delivery. No automatic retry was made.');
		if (sent.status === 200 && record(sent.data) && sent.data.ok === false)
			return failure(502, 'telegram_rejected', 'Telegram rejected the invoice. Check the configured bot and self-test chat.');
		const message = record(sent.data) && sent.data.ok === true && record(sent.data.result) ? sent.data.result : null;
		if (sent.status !== 200 || !message || !Number.isSafeInteger(message.message_id) || Number(message.message_id) <= 0 ||
			!record(message.chat) || message.chat.id !== config.chat) throw new Error('unconfirmed');
		return reply(200, { ok: true, delivery: 'sent', self_test: true, order_id: orderId, message_id: message.message_id });
	} catch {
		return failure(503, 'delivery_unknown', 'Telegram delivery could not be confirmed. Check the test chat before sending again; retrying may create a duplicate.');
	}
}