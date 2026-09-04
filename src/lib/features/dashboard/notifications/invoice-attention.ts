import type { InvoiceRecord } from '../types';

export function selectExpiredPendingInvoices(invoices: InvoiceRecord[], now = new Date()) {
	const nowTime = now.getTime();

	return invoices
		.filter((invoice) => {
			if (invoice.lifecycleStatus !== 'pending' || !invoice.expiresAt) return false;
			const expiresAt = new Date(invoice.expiresAt).getTime();
			return Number.isFinite(expiresAt) && expiresAt < nowTime;
		})
		.sort((left, right) =>
			String(left.expiresAt).localeCompare(String(right.expiresAt))
		);
}