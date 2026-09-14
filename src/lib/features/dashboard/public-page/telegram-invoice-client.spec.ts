import { describe, expect, it, vi } from 'vitest';
import type { InvoiceRecord } from '../types';
import { decodeTelegramInvoicePreview, previewTelegramInvoice, formatTelegramInvoiceAmount, formatTelegramInvoiceDate, eligibleTelegramInvoices, invoiceAmountCents, sendTelegramInvoice, TelegramInvoiceError } from './telegram-invoice-client';

const orderId = '11111111-1111-4111-8111-111111111111';
const invoice: InvoiceRecord = {
	id: orderId, reference: 'INV-1', title: 'Консультація', amount: 128.45,
	baseAmount: 130, discountAmount: 2, deliveryFee: .45, currency: 'UAH',
	status: 'pending', lifecycleStatus: 'pending', type: 'fixed', channel: 'Link',
	createdAt: '2026-09-01T00:00:00Z', shortId: null, description: null,
	tableNumber: null, terminalId: null, paidAt: null, paidBankCode: null, expiresAt: null
};
const accepted = { ok: true, delivery: 'sent', self_test: true, order_id: orderId, message_id: 42 };
const request = (fetcher: typeof fetch, extra = {}) => sendTelegramInvoice({ fetcher, accessToken: 'mock-jwt', orderId, ...extra });

const previewResponse = {
	ok: true, self_test: true, order_id: orderId,
	card: { amount: '128.45', reference: 'INV-1', recipient: 'ТОВ «Приклад»',
		issuedAt: '2026-09-01T21:30:00.000Z', displayExpiresAt: '2026-09-17T12:00:00.000Z',
		checkoutUrl: 'https://rakhunok.com/o/Abc-123' },
	display_expiry_note: '(строк картки; актуальні умови — за посиланням)'
};

describe('canonical readonly invoice preview', () => {
	it('decodes server labels, exact amount and note without mutating the response', () => {
		const card = decodeTelegramInvoicePreview(previewResponse, orderId);
		expect(card).toEqual({ ...previewResponse.card, displayExpiryNote: previewResponse.display_expiry_note });
		expect(Object.isFrozen(card)).toBe(true);
	});
	it('formats exact cents without floating point and all dates in Kyiv', () => {
		expect(formatTelegramInvoiceAmount('90071992547409.91')).toBe('90\u00a0071\u00a0992\u00a0547\u00a0409,91');
		expect(formatTelegramInvoiceAmount('0.01')).toBe('0,01');
		expect(formatTelegramInvoiceDate(previewResponse.card.issuedAt)).toBe('02.09.2026');
	});
	it('does not impose client-clock constraints on server creation or display TTL', () => {
		expect(decodeTelegramInvoicePreview({ ...previewResponse, card: { ...previewResponse.card,
			issuedAt: '2099-01-01T00:00:00.000Z', displayExpiresAt: '2099-01-04T00:00:00.000Z'
		} }, orderId).issuedAt).toMatch(/^2099/);
	});
	it.each(['https://letsrealtalk.com/o/abc', `https://rakhunok.com/o/${orderId}`, 'https://rakhunok.com/o/A-9'])('accepts trusted short or scoped UUID link %s', (checkoutUrl) => {
		expect(decodeTelegramInvoicePreview({ ...previewResponse, card: { ...previewResponse.card, checkoutUrl } }, orderId).checkoutUrl).toBe(checkoutUrl);
	});
	it.each([
		'https://rakhunok.com.evil.test/o/abc', 'https://evil.test/o/abc', '//rakhunok.com/o/abc',
		'http://rakhunok.com/o/abc', 'javascript:alert(1)', 'https://rakhunok.com@evil.test/o/abc',
		'https://user@rakhunok.com/o/abc', 'https://rakhunok.com:443/o/abc',
		'https://rakhunok.com/o/abc?next=evil', 'https://rakhunok.com/o/abc#hash',
		'https://rakhunok.com/o/%61bc', 'https://rakhunok.com/o/../abc', 'https://rakhunok.com/o/abc/',
		'https://rakhunok.com/pay/abc', 'https://rakhunok.com/o/a_b', 'https://rakhunok.com/o/ab',
		'https://rakhunok.com/o/' + 'a'.repeat(37), 'https://rakhunok.com/o/abc\n',
		'https://rakhunok.com\\o\\abc', ' https://rakhunok.com/o/abc',
		'https://rakhunok.com/o/22222222-2222-4222-8222-222222222222'
	])('rejects malicious or unscoped link %s', (checkoutUrl) => {
		expect(() => decodeTelegramInvoicePreview({ ...previewResponse, card: { ...previewResponse.card, checkoutUrl } }, orderId)).toThrow();
	});
	it.each([
		{ amount: 128.45 }, { amount: '1.001' }, { amount: '01.00' }, { amount: '1e2' },
		{ amount: '0.00' }, { amount: '-1.00' }, { amount: '90071992547409.92' },
		{ reference: '' }, { reference: 'x'.repeat(129) }, { recipient: null },
		{ recipient: 'x'.repeat(513) }, { recipient: 'ФОП\u202eevil' }, { reference: 'a\nb' },
		{ issuedAt: '2026-02-30T00:00:00.000Z' }, { issuedAt: '2026-09-01' },
		{ issuedAt: '2026-09-01T00:00:00Z' }, { issuedAt: '2026-09-01T24:00:00.000Z' },
		{ displayExpiresAt: '2026-09-01T21:30:00.000Z' }, { displayExpiresAt: null }
	])('rejects malformed card %j', (patch) => {
		expect(() => decodeTelegramInvoicePreview({ ...previewResponse, card: { ...previewResponse.card, ...patch } }, orderId)).toThrow();
	});
	it.each([null, [], {}, { ...previewResponse, self_test: false }, { ...previewResponse, ok: false },
		{ ...previewResponse, order_id: '22222222-2222-4222-8222-222222222222' },
		{ ...previewResponse, display_expiry_note: '' }, { ...previewResponse, card: [] }
	])('rejects invalid envelope %j', (body) => {
		expect(() => decodeTelegramInvoicePreview(body, orderId)).toThrow();
	});
	it('POSTs only id to preview with SDK bearer, no send or fallback', async () => {
		const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json(previewResponse));
		await previewTelegramInvoice({ fetcher, orderId, accessToken: 'mock-jwt' });
		expect(fetcher).toHaveBeenCalledExactlyOnceWith('/dashboard/api/v1/telegram/invoices/preview', expect.objectContaining({
			method: 'POST', body: JSON.stringify({ order_id: orderId }), redirect: 'error', cache: 'no-store', credentials: 'omit',
			headers: { Authorization: 'Bearer mock-jwt', 'Content-Type': 'application/json' }
		}));
	});
	it.each(['unauthorized', 'forbidden', 'order_not_found', 'invoice_not_deliverable', 'self_test_unavailable', 'verification_unavailable', 'local_api_unavailable', 'delivery_unknown'])('classifies %s without delivery uncertainty', async (error) => {
		const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ ok: false, error }, { status: 503 }));
		await expect(previewTelegramInvoice({ fetcher, orderId, accessToken: 'mock-jwt' })).rejects.toMatchObject({
			code: error === 'delivery_unknown' ? 'unavailable' : error, deliveryUncertain: false
		});
		expect(fetcher).toHaveBeenCalledTimes(1);
	});
	it.each(['network', 'json', 'status'])('fails closed on %s without delivery uncertainty', async (failure) => {
		const fetcher = vi.fn<typeof fetch>();
		if (failure === 'network') fetcher.mockRejectedValue(new TypeError('offline'));
		else fetcher.mockResolvedValue(failure === 'json' ? new Response('<html/>') : Response.json(previewResponse, { status: 503 }));
		await expect(previewTelegramInvoice({ fetcher, orderId, accessToken: 'mock-jwt' })).rejects.toMatchObject({ deliveryUncertain: false });
		expect(fetcher).toHaveBeenCalledTimes(1);
	});
	it.each([{ orderId: 'bad' }, { accessToken: '' }, { accessToken: 'bad\r\ntoken' }, { apiBase: '//evil.test' }, { apiBase: '/dashboard/../send' }])('rejects invalid input before network %j', async (patch) => {
		const fetcher = vi.fn<typeof fetch>();
		await expect(previewTelegramInvoice({ fetcher, orderId, accessToken: 'mock-jwt', ...patch })).rejects.toMatchObject({ deliveryUncertain: false });
		expect(fetcher).not.toHaveBeenCalled();
	});
});

describe('Telegram invoice amount and eligibility', () => {
	it.each([[128.45, 12845n], ['0.01', 1n], [0, 0n], ['1000000000.00', 100000000000n]])('parses %s exactly', (value, expected) => {
		expect(invoiceAmountCents(value)).toBe(expected);
	});
	it.each([NaN, Infinity, -1, 1.001, '1e2', '01', ' 1', '1,20', '', null, true, 1000000001, '99999999999999.99'])('rejects unsafe amount %s', (value) => {
		expect(invoiceAmountCents(value)).toBeNull();
	});
	it('keeps authoritative total/title without mutation', () => {
		expect(eligibleTelegramInvoices([invoice])).toEqual([invoice]);
		expect(eligibleTelegramInvoices([invoice])[0]).toBe(invoice);
	});
	it.each([
		{ type: 'open_amount' }, { type: 'table' }, { type: 'delivery' }, { type: 'recurring' },
		{ status: 'paid' }, { status: 'cancelled' }, { lifecycleStatus: 'preparing' },
		{ lifecycleStatus: 'expired' }, { currency: 'USD' }, { amount: 0 }, { amount: 128.451 },
		{ amount: 128.46 }, { baseAmount: 0 }, { discountAmount: 131 }, { deliveryFee: -1 },
		{ id: 'bad' }, { paidAt: '2026-09-01' }, { expiresAt: 'bad' }, { expiresAt: '2026-09-13T00:00:00Z' }
	] satisfies Partial<InvoiceRecord>[])('rejects ineligible %j', (patch) => {
		expect(eligibleTelegramInvoices([{ ...invoice, ...patch }], Date.parse('2026-09-13T00:00:00Z'))).toEqual([]);
	});
	it('accepts a future expiry', () => {
		expect(eligibleTelegramInvoices([{ ...invoice, expiresAt: '2026-09-14T00:00:00Z' }], Date.parse('2026-09-13T00:00:00Z'))).toHaveLength(1);
	});
});

describe('sendTelegramInvoice', () => {
	it.each([
		{ ok: false, error: 'local_api_unavailable' },
		{ error: 'Worker dev server (port 8787) is not running' }
	])('reports definite local unavailability for exact 503 contract %j', async (body) => {
		const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json(body, { status: 503 }));
		await expect(request(fetcher)).rejects.toMatchObject({
			deliveryUncertain: false,
			message: 'Локальний API (порт 8787) не запущено. Нічого не надіслано.'
		});
		expect(fetcher).toHaveBeenCalledTimes(1);
	});
	it.each([
		[503, { error: 'unavailable' }],
		[503, { ok: false, error: 'delivery_unknown' }],
		[503, { error: 'local_api_unavailable' }],
		[503, { ok: true, error: 'local_api_unavailable' }],
		[503, { ok: false, error: 'Worker dev server (port 8787) is not running' }],
		[503, { error: 'Worker dev server (port 8787) is not running', extra: true }],
		[503, { error: 'Worker dev server (port 8787) is not running.' }],
		[502, { error: 'Worker dev server (port 8787) is not running' }],
		[200, { ok: false, error: 'local_api_unavailable' }],
		[502, { ok: false, error: 'local_api_unavailable' }]
	])('keeps unproven local failures uncertain: %s %j', async (status, body) => {
		const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json(body, { status }));
		await expect(request(fetcher)).rejects.toMatchObject({ deliveryUncertain: true });
		expect(fetcher).toHaveBeenCalledTimes(1);
	});
	it('POSTs only order_id to local dashboard API with bearer auth', async () => {
		const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json(accepted));
		await expect(request(fetcher)).resolves.toBeUndefined();
		expect(fetcher).toHaveBeenCalledExactlyOnceWith('/dashboard/api/v1/telegram/invoices/send', expect.objectContaining({
			method: 'POST', headers: { Authorization: 'Bearer mock-jwt', 'Content-Type': 'application/json' },
			body: JSON.stringify({ order_id: orderId }), redirect: 'error', cache: 'no-store', credentials: 'omit'
		}));
	});
	it('supports an explicitly supplied same-origin root without guessing hosts', async () => {
		const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json(accepted));
		await request(fetcher, { apiBase: '' });
		expect(fetcher.mock.calls[0][0]).toBe('/api/v1/telegram/invoices/send');
	});
	it.each(['https://remote.example', '//remote.example', '/dashboard/../api', '/dashboard?x=1', '/dashboard\\api'])('rejects unsafe base %s before fetch', async (apiBase) => {
		const fetcher = vi.fn<typeof fetch>();
		await expect(request(fetcher, { apiBase })).rejects.toBeInstanceOf(TelegramInvoiceError);
		expect(fetcher).not.toHaveBeenCalled();
	});
	it.each([{ accessToken: '' }, { accessToken: 'bad\r\ntoken' }, { orderId: 'bad-id' }])('rejects invalid credentials/id without network', async (extra) => {
		const fetcher = vi.fn<typeof fetch>();
		await expect(request(fetcher, extra)).rejects.toBeInstanceOf(TelegramInvoiceError);
		expect(fetcher).not.toHaveBeenCalled();
	});
	it.each([
		[503, 'self_test_unavailable', false], [503, 'verification_unavailable', false],
		[503, 'delivery_unknown', true], [429, 'telegram_rate_limited', false],
		[502, 'telegram_rejected', false], [409, 'invoice_not_deliverable', false],
		[200, 'unknown_error', true]
	])('handles %s/%s once, in Ukrainian', async (status, error, deliveryUncertain) => {
		const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ ok: false, error, message: 'English upstream text' }, { status }));
		await expect(request(fetcher)).rejects.toMatchObject({ deliveryUncertain, message: expect.stringMatching(/[А-Яа-яІіЇїЄє]/) });
		expect(fetcher).toHaveBeenCalledTimes(1);
	});
	it.each([
		{ ...accepted, message_id: 0 }, { ...accepted, message_id: 1.5 },
		{ ...accepted, message_id: Number.MAX_SAFE_INTEGER + 1 }, { ...accepted, message_id: '42' },
		{ ...accepted, message_id: undefined }, { ...accepted, ok: false },
		{ ...accepted, delivery: 'unknown' }, { ...accepted, self_test: false },
		{ ...accepted, order_id: 'another-order' }, { ok: true, result: { message_id: 42 } }, null, []
	])('does not accept malformed success %j or retry', async (body) => {
		const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json(body));
		await expect(request(fetcher)).rejects.toMatchObject({ deliveryUncertain: true });
		expect(fetcher).toHaveBeenCalledTimes(1);
	});
	it.each([503, 429, 200])('fails closed on non-JSON %s with no fallback', async (status) => {
		const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('<html>proxy error</html>', { status }));
		await expect(request(fetcher)).rejects.toMatchObject({ deliveryUncertain: true });
		expect(fetcher).toHaveBeenCalledTimes(1);
	});
	it('does not accept success under an error HTTP status', async () => {
		const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json(accepted, { status: 503 }));
		await expect(request(fetcher)).rejects.toMatchObject({ deliveryUncertain: true });
		expect(fetcher).toHaveBeenCalledTimes(1);
	});
	it('network rejection is uncertain and never falls back or retries', async () => {
		const fetcher = vi.fn<typeof fetch>().mockRejectedValue(new TypeError('network'));
		await expect(request(fetcher)).rejects.toMatchObject({ deliveryUncertain: true });
		expect(fetcher).toHaveBeenCalledTimes(1);
	});
});