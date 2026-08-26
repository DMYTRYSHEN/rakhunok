import type { InvoiceRecord } from '../types';

export type LegacyInvoiceCancellationUpdate = {
	status: 'cancelled';
};

export type InvoiceCancellationContract =
	| { eligible: true; invoiceId: string; update: LegacyInvoiceCancellationUpdate }
	| { eligible: false; reason: 'not-pending' | 'unsupported-type' | 'expired' };

export function buildLegacyInvoiceCancellation(
	invoice: InvoiceRecord,
	now = new Date()
): InvoiceCancellationContract {
	if (invoice.lifecycleStatus !== 'pending') {
		return { eligible: false, reason: 'not-pending' };
	}

	if (invoice.type !== 'fixed' && invoice.type !== 'table') {
		return { eligible: false, reason: 'unsupported-type' };
	}

	if (invoice.type === 'table' && invoice.expiresAt && new Date(invoice.expiresAt) < now) {
		return { eligible: false, reason: 'expired' };
	}

	return { eligible: true, invoiceId: invoice.id, update: { status: 'cancelled' } };
}
