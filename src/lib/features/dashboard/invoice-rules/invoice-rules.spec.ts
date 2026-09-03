import { describe, expect, it } from 'vitest';
import {
	defaultInvoiceRules,
	formatInvoiceNumber,
	formatPaymentPurpose,
	suggestedPurposeTemplate,
	taxIdLabel,
	validateInvoiceRules,
	type InvoiceRules
} from './invoice-rules';

const configuredRules: InvoiceRules = {
	...defaultInvoiceRules,
	taxId: '40720198'
};

describe('invoice rules', () => {
	it('formats a stable yearly invoice reference', () => {
		expect(
			formatInvoiceNumber(
				{ ...configuredRules, invoicePrefix: 'INV', nextNumber: 42, padding: 5 },
				new Date('2026-08-26T10:00:00.000Z')
			)
		).toBe('INV-2026-00042');
	});

	it('adds the month only for monthly reset rules', () => {
		expect(
			formatInvoiceNumber(
				{
					...configuredRules,
					invoicePrefix: 'RHK',
					nextNumber: 7,
					padding: 3,
					resetPeriod: 'monthly'
				},
				new Date('2026-08-26T10:00:00.000Z')
			)
		).toBe('RHK-2026-08-007');
	});

	it('provides distinct VAT and non-VAT recommendations', () => {
		expect(suggestedPurposeTemplate('tov', 'vat')).toContain('у т.ч. ПДВ');
		expect(suggestedPurposeTemplate('fop', 'no-vat')).toContain('без ПДВ');
		expect(suggestedPurposeTemplate('self-employed', 'no-vat')).toContain('без ПДВ');
		expect(taxIdLabel('self-employed')).toBe('РНОКПП');
	});

	it('interpolates invoice and scenario placeholders', () => {
		const purpose = formatPaymentPurpose(
			{
				...configuredRules,
				purposeTemplate: 'Оплата за {scenario}, рахунок {number} від {date}, {tax}.'
			},
			{
				number: 'RHK-2026-001049',
				date: new Date('2026-08-26T10:00:00.000Z'),
				scenario: 'delivery'
			}
		);

		expect(purpose).toBe(
			'Оплата за товари та доставку, рахунок RHK-2026-001049 від 26.08.2026, у т.ч. ПДВ.'
		);
	});

	it.each([
		['recurring', 'регулярні послуги'],
		['rtp', 'запит на оплату']
	] as const)('formats the %s scenario purpose', (scenario, label) => {
		expect(
			formatPaymentPurpose(
				{ ...configuredRules, purposeTemplate: 'Оплата за {scenario}, {tax}.' },
				{ number: 'RHK-2026-001050', date: new Date('2026-08-26T10:00:00.000Z'), scenario }
			)
		).toBe(`Оплата за ${label}, у т.ч. ПДВ.`);
	});

	it('validates QR 003 reference, purpose, and category constraints', () => {
		expect(
			validateInvoiceRules({
				...configuredRules,
				invoicePrefix: 'PREFIX-WITH-MORE-THAN-THIRTY-FIVE-CHARACTERS',
				purposeTemplate: 'x'.repeat(421),
				qrCategory: 'OTHER',
				expiryHours: 0
			})
		).toEqual(
			expect.arrayContaining([
				'Reference перевищує 35 символів для QR формату 003.',
				'Призначення платежу перевищує 420 символів для QR формату 003.',
				'Категорія / ціль має формат CCCC/PPPP.',
				'Строк дії має бути від 1 до 8760 годин або необмеженим.'
			])
		);
	});
});
