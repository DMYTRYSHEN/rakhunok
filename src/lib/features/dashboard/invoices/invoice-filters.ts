import type { InvoiceRecord, InvoiceStatus, InvoiceType } from '../types';

export type InvoiceFilters = {
	search: string;
	status: InvoiceStatus | 'all';
	type: InvoiceType | 'all';
	period: '7' | '30' | 'all';
};

export function filterInvoices(
	invoices: InvoiceRecord[],
	filters: InvoiceFilters,
	now = new Date()
): InvoiceRecord[] {
	const query = filters.search.trim().toLocaleLowerCase('uk-UA');
	const numericQuery = Number(query.replace(',', '.'));
	const periodStart =
		filters.period === 'all'
			? null
			: new Date(now.getTime() - Number(filters.period) * 24 * 60 * 60 * 1000);

	return invoices.filter((invoice) => {
		const matchesSearch =
			!query ||
			invoice.reference.toLocaleLowerCase('uk-UA').includes(query) ||
			invoice.title.toLocaleLowerCase('uk-UA').includes(query) ||
			(Number.isFinite(numericQuery) && invoice.amount === numericQuery);
		const matchesStatus = filters.status === 'all' || invoice.status === filters.status;
		const matchesType = filters.type === 'all' || invoice.type === filters.type;
		const matchesPeriod = !periodStart || new Date(invoice.createdAt) >= periodStart;

		return matchesSearch && matchesStatus && matchesType && matchesPeriod;
	});
}
