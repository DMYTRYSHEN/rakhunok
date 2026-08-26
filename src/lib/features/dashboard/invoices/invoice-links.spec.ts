import { describe, expect, it } from 'vitest';
import { demoInvoices } from '../data/invoices';
import { getInvoiceShareLinks } from './invoice-links';

describe('invoice share links', () => {
	it('uses a short receipt URL for fixed invoices', () => {
		const invoice = demoInvoices.find((item) => item.type === 'fixed');
		if (!invoice) throw new Error('Expected a fixed demo invoice');

		expect(getInvoiceShareLinks(invoice).map((link) => link.path)).toEqual([
			`/o/${invoice.shortId}`,
			`/pay/${invoice.id}`
		]);
	});

	it('uses the transfer URL for open-amount invoices', () => {
		const invoice = demoInvoices.find((item) => item.type === 'open_amount');
		if (!invoice) throw new Error('Expected an open-amount demo invoice');

		expect(getInvoiceShareLinks(invoice)[0].path).toBe(`/t/${invoice.shortId}`);
	});

	it('only exposes an active table tag for pending invoices', () => {
		const invoice = demoInvoices.find((item) => item.type === 'table');
		if (!invoice) throw new Error('Expected a table demo invoice');

		expect(getInvoiceShareLinks({ ...invoice, lifecycleStatus: 'pending' })[0].path).toBe(
			`/tag/${invoice.reference}`
		);
		expect(
			getInvoiceShareLinks({ ...invoice, lifecycleStatus: 'paid' }).some((link) =>
				link.path.startsWith('/tag/')
			)
		).toBe(false);
	});
});
