import type { InvoiceRecord } from '../types';

export type InvoiceShareLink = {
	label: string;
	path: string;
};

export function getInvoiceShareLinks(invoice: InvoiceRecord): InvoiceShareLink[] {
	const shortReference = invoice.shortId || invoice.id;
	const links: InvoiceShareLink[] = [];
	const isTerminalInvoice =
		invoice.type === 'table' ||
		invoice.terminalId !== null ||
		/^(table-|kasa-|bar-)/.test(invoice.reference);

	if (isTerminalInvoice) {
		if (invoice.lifecycleStatus === 'pending') {
			links.push({
				label: 'Багаторазовий QR терміналу або столу',
				path: `/tag/${invoice.reference}`
			});
		}
		links.push({ label: 'Одноразовий чек для клієнта', path: `/pos/${shortReference}` });
	} else if (invoice.type === 'open_amount') {
		links.push({ label: 'Вільна сума або переказ', path: `/t/${shortReference}` });
	} else {
		links.push({ label: 'Коротке посилання на чек', path: `/o/${shortReference}` });
	}

	links.push({ label: 'Повне посилання', path: `/pay/${invoice.id}` });
	return links;
}
