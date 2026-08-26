import { describe, expect, it } from 'vitest';
import type { InvoiceRecord } from '../types';
import { buildLegacyInvoiceCancellation } from './invoice-cancellation-contract';

const invoice: InvoiceRecord = {
	id: 'invoice-1',
	reference: 'INV-1',
	title: 'Рахунок',
	amount: 100,
	status: 'pending',
	createdAt: '2026-08-26T09:00:00.000Z',
	channel: 'POS',
	shortId: 'short-1',
	type: 'fixed',
	lifecycleStatus: 'pending',
	description: null,
	baseAmount: 100,
	discountAmount: 0,
	deliveryFee: 0,
	currency: 'UAH',
	tableNumber: null,
	terminalId: null,
	paidAt: null,
	paidBankCode: null,
	expiresAt: null
};

describe('legacy invoice cancellation contract', () => {
	it('builds the canonical status update for a pending fixed invoice', () => {
		expect(buildLegacyInvoiceCancellation(invoice)).toEqual({
			eligible: true,
			invoiceId: 'invoice-1',
			update: { status: 'cancelled' }
		});
	});

	it('allows an unexpired pending table invoice', () => {
		expect(
			buildLegacyInvoiceCancellation(
				{ ...invoice, type: 'table', expiresAt: '2026-08-26T10:00:00.000Z' },
				new Date('2026-08-26T09:30:00.000Z')
			)
		).toMatchObject({ eligible: true });
	});

	it('rejects expired table invoices', () => {
		expect(
			buildLegacyInvoiceCancellation(
				{ ...invoice, type: 'table', expiresAt: '2026-08-26T09:00:00.000Z' },
				new Date('2026-08-26T09:30:00.000Z')
			)
		).toEqual({ eligible: false, reason: 'expired' });
	});

	it('rejects paid and unsupported invoice types', () => {
		expect(
			buildLegacyInvoiceCancellation({
				...invoice,
				status: 'paid',
				lifecycleStatus: 'paid'
			})
		).toEqual({ eligible: false, reason: 'not-pending' });
		expect(buildLegacyInvoiceCancellation({ ...invoice, type: 'open_amount' })).toEqual({
			eligible: false,
			reason: 'unsupported-type'
		});
	});
});
