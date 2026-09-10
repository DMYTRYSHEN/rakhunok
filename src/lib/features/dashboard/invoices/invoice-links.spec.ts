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

	it.each(['pending', 'preparing', 'ready', 'paid', 'cancelled', 'expired'] as const)(
		'exposes the linked terminal for a %s invoice without replacing the receipt', (lifecycleStatus) => {
		const invoice = demoInvoices.find((item) => item.type === 'table');
		if (!invoice) throw new Error('Expected a table demo invoice');

		const links = getInvoiceShareLinks({ ...invoice, reference: 'INV-30', terminalCode: 'table-30', lifecycleStatus });
		expect(links).toEqual([
			{ label: 'Багаторазовий QR терміналу або столу', path: '/tag/table-30' },
			{ label: 'Одноразовий чек для клієнта', path: `/pos/${invoice.shortId}` },
			{ label: 'Повне посилання', path: `/pay/${invoice.id}` }
		]);
	});

	it('does not invent a terminal link from an invoice reference', () => {
		const invoice = demoInvoices[1];
		for (const terminalCode of [undefined, null, '']) {
			expect(getInvoiceShareLinks({ ...invoice, reference: 'table-30', terminalCode })
				.some((link) => link.path.startsWith('/tag/'))).toBe(false);
		}
		expect(getInvoiceShareLinks({ ...invoice, terminalId: null, terminalCode: 'table-30' })
			.some((link) => link.path.startsWith('/tag/'))).toBe(false);
	});
});
