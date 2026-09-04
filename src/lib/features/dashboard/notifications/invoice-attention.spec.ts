import { describe, expect, it } from 'vitest';
import type { InvoiceRecord } from '../types';
import { selectExpiredPendingInvoices } from './invoice-attention';

const invoice: InvoiceRecord = {
	id: 'invoice-1',
	shortId: 'short-1',
	reference: 'INV-1',
	title: 'Столик 30',
	amount: 450,
	status: 'pending',
	lifecycleStatus: 'pending',
	createdAt: '2026-09-02T12:00:00.000Z',
	channel: 'POS',
	type: 'table',
	description: null,
	baseAmount: 450,
	discountAmount: 0,
	deliveryFee: 0,
	currency: 'UAH',
	tableNumber: 30,
	terminalId: 'terminal-1',
	paidAt: null,
	paidBankCode: null,
	expiresAt: '2026-09-02T12:30:00.000Z'
};

describe('selectExpiredPendingInvoices', () => {
	it('selects an expired pending invoice', () => {
		expect(selectExpiredPendingInvoices([invoice], new Date('2026-09-04T12:00:00.000Z'))).toEqual([
			invoice
		]);
	});

	it.each([
		['active pending invoice', { expiresAt: '2026-09-05T12:00:00.000Z' }],
		['active terminal without an invoice expiry', { expiresAt: null }],
		['paid invoice', { lifecycleStatus: 'paid' as const }],
		['cancelled invoice', { lifecycleStatus: 'cancelled' as const }]
	])('excludes %s', (_name, update) => {
		expect(
			selectExpiredPendingInvoices([{ ...invoice, ...update }], new Date('2026-09-04T12:00:00.000Z'))
		).toEqual([]);
	});
});