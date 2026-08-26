import { describe, expect, it } from 'vitest';
import { demoInvoices } from '../data/invoices';
import { filterInvoices, type InvoiceFilters } from './invoice-filters';

const allFilters: InvoiceFilters = {
	search: '',
	status: 'all',
	type: 'all',
	period: 'all'
};

describe('invoice filters', () => {
	it('searches references and titles without case sensitivity', () => {
		expect(filterInvoices(demoInvoices, { ...allFilters, search: 'inv-1048' })).toHaveLength(1);
		expect(
			filterInvoices(demoInvoices, {
				...allFilters,
				search: demoInvoices[0].title.toLocaleUpperCase('uk-UA')
			})[0]?.id
		).toBe(demoInvoices[0].id);
	});

	it('matches a numeric search only to the exact amount', () => {
		const target = demoInvoices[6];
		const matches = filterInvoices(demoInvoices, {
			...allFilters,
			search: String(target.amount).replace('.', ',')
		});

		expect(matches.map((invoice) => invoice.amount)).toEqual([target.amount]);
	});

	it('combines status, type, and date period filters', () => {
		const matches = filterInvoices(
			demoInvoices,
			{ ...allFilters, status: 'paid', type: 'fixed', period: '7' },
			new Date('2026-08-25T23:59:00+03:00')
		);

		expect(matches.length).toBeGreaterThan(0);
		expect(matches.every((invoice) => invoice.status === 'paid')).toBe(true);
		expect(matches.every((invoice) => invoice.type === 'fixed')).toBe(true);
		expect(
			matches.every(
				(invoice) => new Date(invoice.createdAt) >= new Date('2026-08-18T20:59:00.000Z')
			)
		).toBe(true);
	});
});
