import type { TelegramInvoiceRenderData } from './telegram-invoice-renderer.ts';

type Row = Record<string, unknown>;
const DISPLAY_TTL_MS = 72 * 60 * 60 * 1000;
export const CARD_EXPIRY_NOTE = '(строк картки; актуальні умови — за посиланням)';

/** Bound UTF-16 length without splitting graphemes; strip untrusted format controls. */
export function captionLabel(value: unknown, limit: number): string {
	if (typeof value !== 'string') return '';
	const clean = value.normalize('NFC').replace(/[\p{Cc}\p{Zl}\p{Zp}]/gu, ' ')
		.replace(/[^\P{Cf}\u200c\u200d]/gu, '').replace(/\s+/gu, ' ').trim();
	if (clean.length <= limit) return clean;
	let shortened = '';
	for (const { segment } of new Intl.Segmenter('uk', { granularity: 'grapheme' }).segment(clean)) {
		if (shortened.length + segment.length > limit - 1) break;
		shortened += segment;
	}
	return `${shortened.trimEnd()}…`;
}

/** Postgres timestamptz (including microseconds), never numeric/local/rolled-over dates. */
export function timestamp(value: unknown): number {
	if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,6})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.test(value)) throw new Error('date');
	const time = Date.parse(value);
	const day = new Date(`${value.slice(0, 10)}T00:00:00Z`);
	if (!Number.isFinite(time) || !Number.isFinite(day.getTime()) || day.toISOString().slice(0, 10) !== value.slice(0, 10)) throw new Error('date');
	return time;
}

export function legalRecipient(row: Row, entity: boolean): string {
	if (row.is_active !== true || typeof row.business_name !== 'string') throw new Error('recipient');
	const name = captionLabel(row.business_name, 512);
	if (!name) throw new Error('recipient');
	// MerchantRow in dashboard-gateway has no business_type: do not select or invent it.
	if (!entity) return name;
	let prefix: string;
	switch (row.business_type) {
		case 'fop': prefix = 'ФОП'; break;
		case 'tov': prefix = 'ТОВ'; break;
		case 'ngo': prefix = 'ГО'; break;
		case 'self_employed': return name;
		default: throw new Error('legal type');
	}
	const existing = /^(ФОП|ТОВ|ГО)(?=\s|[«"“„]|$)/iu.exec(name);
	if (existing) {
		if (existing[1].toUpperCase() !== prefix) throw new Error('legal type mismatch');
		return prefix + name.slice(existing[1].length);
	}
	return `${prefix} ${name}`;
}

function buildInvoiceCard(order: Row, recipient: string, amount: bigint, origin: string, now: number, checkoutPath: string): TelegramInvoiceRenderData {
	if (typeof order.order_number !== 'string' || !captionLabel(order.order_number, 128)) throw new Error('reference');
	// Missing projected fields are a schema failure, not silently invented defaults.
	if (!Object.hasOwn(order, 'short_id')) throw new Error('short_id');
	const issued = timestamp(order.created_at);
	const expiry = order.expires_at === null ? now + DISPLAY_TTL_MS : Math.min(timestamp(order.expires_at), now + DISPLAY_TTL_MS);
	if (!Number.isFinite(now) || issued > now || expiry <= now) throw new Error('date');
	return {
		amount: `${amount / 100n}.${String(amount % 100n).padStart(2, '0')}`,
		reference: captionLabel(order.order_number, 128), recipient,
		issuedAt: new Date(issued).toISOString(), displayExpiresAt: new Date(expiry).toISOString(),
		checkoutUrl: `${origin}${checkoutPath}`
	};
}

export function invoiceCard(order: Row, recipient: string, amount: bigint, origin: string, now: number): TelegramInvoiceRenderData {
	const alias = typeof order.short_id === 'string' && /^[A-Za-z0-9-]{3,36}$/.test(order.short_id) ? order.short_id : order.id;
	return buildInvoiceCard(order, recipient, amount, origin, now, `/o/${alias}`);
}

export function merchantInvoiceCard(order: Row, recipient: string, amount: bigint, origin: string, now: number): TelegramInvoiceRenderData {
	if (typeof order.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(order.id)) throw new Error('order id');
	return buildInvoiceCard(order, recipient, amount, origin, now, `/pay/${order.id}`);
}