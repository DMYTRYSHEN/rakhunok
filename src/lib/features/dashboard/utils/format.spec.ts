import { describe, expect, it } from 'vitest';
import { formatInvoiceDate, formatMoney } from './format';

describe('dashboard formatters', () => {
	it('formats money as Ukrainian hryvnia with two decimals', () => {
		expect(formatMoney(128420)).toMatch(/^128[\s\u00a0]420,00[\s\u00a0]₴$/);
	});

	it('formats invoice timestamps for the Ukrainian locale', () => {
		expect(formatInvoiceDate('2026-08-25T12:42:00+03:00')).toMatch(/25.*серп.*12:42/i);
	});
});
