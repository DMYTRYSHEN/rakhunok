import type { InvoiceRecord } from '../types';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Match the backend's decimal rules; never round fractional kopecks. */
export function invoiceAmountCents(value: unknown): bigint | null {
	if (typeof value !== 'number' && typeof value !== 'string') return null;
	if (typeof value === 'number' && value > 1_000_000_000) return null;
	const text = String(value);
	if (!/^(0|[1-9]\d{0,13})(\.\d{1,2})?$/.test(text)) return null;
	const [whole, fraction = ''] = text.split('.');
	const cents = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
	return cents <= BigInt(Number.MAX_SAFE_INTEGER) ? cents : null;
}

export function eligibleTelegramInvoices(invoices: InvoiceRecord[], now = Date.now()): InvoiceRecord[] {
	return invoices.filter((invoice) => {
		if (!UUID.test(invoice.id) || invoice.type !== 'fixed' || invoice.status !== 'pending' ||
			invoice.lifecycleStatus !== 'pending' || invoice.currency !== 'UAH' || invoice.paidAt !== null) return false;
		if (invoice.expiresAt !== null && (!Number.isFinite(Date.parse(invoice.expiresAt)) ||
			Date.parse(invoice.expiresAt) <= now)) return false;
		const total = invoiceAmountCents(invoice.amount);
		const base = invoiceAmountCents(invoice.baseAmount);
		const fee = invoiceAmountCents(invoice.deliveryFee);
		const discount = invoiceAmountCents(invoice.discountAmount);
		return total !== null && base !== null && fee !== null && discount !== null &&
			total > 0n && base > 0n && discount <= base && base + fee - discount === total;
	});
}

export function formatTelegramInvoiceAmount(amount: number | string): string {
	const cents = invoiceAmountCents(amount);
	if (cents === null) return '—';
	return `${String(cents / 100n).replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0')},${String(cents % 100n).padStart(2, '0')}`;
}

export interface TelegramInvoiceCard {
	amount: string;
	reference: string;
	recipient: string;
	issuedAt: string;
	displayExpiresAt: string;
	checkoutUrl: string;
	displayExpiryNote: string;
}

export type TelegramPreviewErrorCode = 'invalid_request' | 'unauthorized' | 'forbidden' |
	'order_not_found' | 'invoice_not_deliverable' | 'self_test_unavailable' |
	'verification_unavailable' | 'local_api_unavailable' | 'invalid_response' | 'network' | 'unavailable';

const previewFailures: Record<TelegramPreviewErrorCode, string> = {
	invalid_request: 'Некоректний запит попереднього перегляду.',
	unauthorized: 'Увійдіть до кабінету для перегляду рахунку.',
	forbidden: 'Немає доступу до перегляду цього self-test рахунку.',
	order_not_found: 'Рахунок не знайдено. Оновіть список.',
	invoice_not_deliverable: 'Рахунок більше не доступний для надсилання. Оновіть список.',
	self_test_unavailable: 'Telegram self-test не налаштовано. Зверніться до оператора.',
	verification_unavailable: 'Сервер не зміг перевірити дані рахунку. Оновіть перегляд.',
	local_api_unavailable: 'Локальний API (порт 8787) не запущено. Перегляд недоступний.',
	invalid_response: 'Сервер повернув некоректні дані картки. Оновіть перегляд.',
	network: 'Не вдалося завантажити перегляд. Перевірте з’єднання.',
	unavailable: 'Попередній перегляд тимчасово недоступний.'
};

/** Read-only failures never imply uncertain Telegram delivery. */
export class TelegramInvoicePreviewError extends Error {
	readonly deliveryUncertain = false;
	constructor(readonly code: TelegramPreviewErrorCode) {
		super(`${previewFailures[code]} Цей запит нічого не надсилає до Telegram.`);
		this.name = 'TelegramInvoicePreviewError';
	}
}

const asRecord = (value: unknown): Record<string, unknown> | null =>
	value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;

function canonicalDate(value: unknown): value is string {
	if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return false;
	const date = new Date(value);
	return Number.isFinite(date.getTime()) && date.toISOString() === value;
}

function canonicalLabel(value: unknown, limit: number): value is string {
	return typeof value === 'string' && value.length > 0 && value.length <= limit &&
		value === value.trim() && !/[\p{Cc}\p{Zl}\p{Zp}]|[^\P{Cf}\u200c\u200d]/u.test(value);
}

export function formatTelegramInvoiceDate(value: string): string {
	return new Intl.DateTimeFormat('uk-UA', {
		timeZone: 'Europe/Kyiv', day: '2-digit', month: '2-digit', year: 'numeric'
	}).format(new Date(value));
}

export function decodeTelegramInvoicePreview(data: unknown, orderId: string): TelegramInvoiceCard {
	const body = asRecord(data), card = asRecord(body?.card);
	const invalid = () => new TelegramInvoicePreviewError('invalid_response');
	if (!UUID.test(orderId) || body?.ok !== true || body.self_test !== true ||
		body.order_id !== orderId.toLowerCase() || !card ||
		typeof card.amount !== 'string' || !/^(0|[1-9]\d{0,13})\.\d{2}$/.test(card.amount) ||
		(invoiceAmountCents(card.amount) ?? 0n) <= 0n ||
		!canonicalLabel(card.reference, 128) || !canonicalLabel(card.recipient, 512) ||
		!canonicalLabel(body.display_expiry_note, 512) ||
		!canonicalDate(card.issuedAt) || !canonicalDate(card.displayExpiresAt) ||
		Date.parse(card.displayExpiresAt) <= Date.parse(card.issuedAt) ||
		typeof card.checkoutUrl !== 'string') throw invalid();
	// Exact bytes: reject URL normalization, credentials, ports, queries, fragments and escapes.
	const link = /^https:\/\/(?:letsrealtalk\.com|rakhunok\.com)\/o\/([A-Za-z0-9-]{3,36})$/.exec(card.checkoutUrl);
	if (!link || (UUID.test(link[1]) && link[1].toLowerCase() !== orderId.toLowerCase())) throw invalid();
	// No client-clock check: server owns creation/expiry policy and client clocks may drift.
	return Object.freeze({
		amount: card.amount, reference: card.reference, recipient: card.recipient,
		issuedAt: card.issuedAt, displayExpiresAt: card.displayExpiresAt,
		checkoutUrl: card.checkoutUrl, displayExpiryNote: body.display_expiry_note
	});
}

export async function previewTelegramInvoice({ fetcher, accessToken, orderId, apiBase = '/dashboard' }: {
	fetcher: typeof fetch; accessToken: string; orderId: string; apiBase?: string;
}): Promise<TelegramInvoiceCard> {
	if (!accessToken || !/^[A-Za-z0-9._~-]+$/.test(accessToken) || accessToken.length > 8185)
		throw new TelegramInvoicePreviewError('unauthorized');
	if (!UUID.test(orderId) || !/^(?:\/[A-Za-z0-9_-]+)*\/?$/.test(apiBase))
		throw new TelegramInvoicePreviewError('invalid_request');
	let response: Response;
	try {
		response = await fetcher(`${apiBase.replace(/\/$/, '')}/api/v1/telegram/invoices/preview`, {
			method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
			body: JSON.stringify({ order_id: orderId }), redirect: 'error', cache: 'no-store',
			credentials: 'omit', signal: AbortSignal.timeout(45_000)
		});
	} catch { throw new TelegramInvoicePreviewError('network'); }
	let data: unknown;
	try { data = await response.json(); }
	catch { throw new TelegramInvoicePreviewError('invalid_response'); }
	if (response.status === 200) return decodeTelegramInvoicePreview(data, orderId);
	const body = asRecord(data);
	if (response.status === 503 && body && Object.keys(body).length === 1 &&
		body.error === 'Worker dev server (port 8787) is not running')
		throw new TelegramInvoicePreviewError('local_api_unavailable');
	if (body?.ok === false && typeof body.error === 'string' && Object.hasOwn(previewFailures, body.error))
		throw new TelegramInvoicePreviewError(body.error as TelegramPreviewErrorCode);
	throw new TelegramInvoicePreviewError('unavailable');
}

export const TELEGRAM_DELIVERY_WARNING = 'Доставку не підтверджено. Перевірте self-test чат у Telegram перед повторною спробою: картка вже могла надійти, повтор може створити дублікат.';

export class TelegramInvoiceError extends Error {
	readonly deliveryUncertain: boolean;
	constructor(message: string, deliveryUncertain = false) {
		super(message);
		this.name = 'TelegramInvoiceError';
		this.deliveryUncertain = deliveryUncertain;
	}
}

const failures: Record<string, string> = {
	self_test_unavailable: 'Telegram self-test не налаштовано. Зверніться до оператора.',
	unauthorized: 'Увійдіть до кабінету, щоб надіслати рахунок.',
	forbidden: 'Цей акаунт не має доступу до надсилання self-test рахунку.',
	invalid_request: 'Некоректний ідентифікатор рахунку.',
	order_not_found: 'Рахунок не знайдено. Оновіть список.',
	invoice_not_deliverable: 'Рахунок більше не підходить для надсилання. Оновіть список: потрібен неоплачений фіксований рахунок у гривні.',
	verification_unavailable: 'Перевірка рахунку тимчасово недоступна. Нічого не надіслано.',
	render_unavailable: 'Не вдалося підготувати картку. Нічого не надіслано.',
	telegram_rate_limited: 'Telegram обмежив частоту запитів. Спробуйте пізніше; автоматичного повтору не було.',
	telegram_rejected: 'Telegram відхилив картку. Перевірте налаштування бота та self-test чату.'
};

export async function sendTelegramInvoice({ fetcher, accessToken, orderId, apiBase = '/dashboard' }: {
	fetcher: typeof fetch;
	accessToken: string;
	orderId: string;
	apiBase?: string;
}): Promise<void> {
	if (!accessToken || !/^[A-Za-z0-9._~-]+$/.test(accessToken) || accessToken.length > 8185) {
		throw new TelegramInvoiceError(failures.unauthorized);
	}
	if (!UUID.test(orderId)) throw new TelegramInvoiceError(failures.invalid_request);
	// Local absolute paths only. Never guess a remote host or retry a different endpoint.
	if (!/^(?:\/[A-Za-z0-9_-]+)*\/?$/.test(apiBase)) {
		throw new TelegramInvoiceError('Некоректний локальний шлях API.');
	}
	let response: Response;
	let data: unknown;
	try {
		response = await fetcher(`${apiBase.replace(/\/$/, '')}/api/v1/telegram/invoices/send`, {
			method: 'POST',
			headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
			body: JSON.stringify({ order_id: orderId }),
			redirect: 'error',
			cache: 'no-store',
			credentials: 'omit',
			signal: AbortSignal.timeout(45_000)
		});
		data = await response.json();
	} catch {
		throw new TelegramInvoiceError(TELEGRAM_DELIVERY_WARNING, true);
	}
	const body = data && typeof data === 'object' && !Array.isArray(data)
		? data as Record<string, unknown> : null;
	if (response.status === 200 && body?.ok === true && body.delivery === 'sent' &&
		body.self_test === true && body.order_id === orderId.toLowerCase() &&
		Number.isSafeInteger(body.message_id) && Number(body.message_id) > 0) return;
	// The exact legacy proxy response is accepted only during dev-server hot reloads.
	// A generic 503 (or transport failure) cannot prove that nothing was sent.
	if (response.status === 503 && body && (
		(body.ok === false && body.error === 'local_api_unavailable') ||
		(Object.keys(body).length === 1 && body.error === 'Worker dev server (port 8787) is not running')
	)) {
		throw new TelegramInvoiceError('Локальний API (порт 8787) не запущено. Нічого не надіслано.');
	}
	if (body?.ok === false && typeof body.error === 'string' && Object.hasOwn(failures, body.error)) {
		throw new TelegramInvoiceError(failures[body.error]);
	}
	if (response.status === 429 && body?.error !== 'delivery_unknown') {
		throw new TelegramInvoiceError(failures.telegram_rate_limited);
	}
	throw new TelegramInvoiceError(TELEGRAM_DELIVERY_WARNING, true);
}