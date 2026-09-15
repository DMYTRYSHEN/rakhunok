import { describe, expect, it } from 'vitest';
import type { BusinessEntity } from '../types';
import type { BusinessDraft } from '../business-settings/business-settings';
import {
	calculateLineTotal,
	calculateProformaTotals,
	createInitialProformaDraft,
	formatCurrencySign,
	formatProformaMoney
} from './proforma-calc';

describe('proforma-calc', () => {
	const mockEntities: BusinessEntity[] = [
		{
			id: 'seller-tov',
			isActive: true,
			businessName: 'ТОВ «Агротех»',
			displayName: 'Агротех ТОВ',
			businessType: 'tov',
			taxId: '12345678',
			iban: 'UA1130000000000000000000001',
			bankName: 'ПриватБанк'
		},
		{
			id: 'seller-fop',
			isActive: true,
			businessName: 'ФОП Шевченко Т.Г.',
			displayName: 'ФОП Шевченко',
			businessType: 'fop',
			taxId: '2912345678',
			iban: 'UA2230000000000000000000002',
			bankName: 'Монобанк'
		}
	];

	it('calculates line total with discount accurately', () => {
		expect(calculateLineTotal(100, 2, 0)).toBe(200);
		expect(calculateLineTotal(100, 2, 10)).toBe(180);
		expect(calculateLineTotal(50, 3, 50)).toBe(75);
	});

	it('calculates proforma totals with 20% VAT and 0% VAT', () => {
		const items = [
			{ id: '1', type: 'item' as const, name: 'Item 1', price: 1000, quantity: 1, unit: 'шт.', discountPercent: 0, total: 1000 },
			{ id: '2', type: 'item' as const, name: 'Item 2', price: 500, quantity: 2, unit: 'шт.', discountPercent: 10, total: 900 }
		];

		const totalsWithVat = calculateProformaTotals(items, 20, 0);
		expect(totalsWithVat.subtotal).toBe(2000);
		expect(totalsWithVat.discountTotal).toBe(100);
		// Taxable base = 1900; 20% VAT = 380
		expect(totalsWithVat.taxAmount).toBe(380);
		expect(totalsWithVat.total).toBe(1900);

		const totalsNoVat = calculateProformaTotals(items, 0, 0);
		expect(totalsNoVat.taxAmount).toBe(0);
		expect(totalsNoVat.total).toBe(1900);
	});

	it('formats money and currency signs in Ukrainian format', () => {
		expect(formatCurrencySign('UAH')).toBe('₴');
		expect(formatCurrencySign('USD')).toBe('$');
		expect(formatCurrencySign('EUR')).toBe('€');

		const formatted = formatProformaMoney(12500.5, 'UAH');
		expect(formatted).toContain('12');
		expect(formatted).toContain('500');
		expect(formatted).toContain('₴');
	});

	it('pulls seller details, 20% VAT and numbering from business settings (Direct IBAN mode)', () => {
		const businessDraft: BusinessDraft = {
			version: 2,
			selectedSellerId: 'seller-tov',
			mode: 'direct',
			financeName: '',
			financeIban: '',
			financeTaxId: '',
			sellers: {
				'seller-tov': {
					vatStatus: 'vat',
					prefix: 'AGRO',
					nextNumber: 42,
					padding: 4,
					purposeTemplate: 'Оплата за послуги, рах. {number}, {tax}.',
					providerSellerId: '',
					providerCode: '',
					contractReference: '',
					qrCategory: 'OTHR/GDDS',
					qrFunction: 'UCT',
					allowAmountEdit: false
				}
			}
		};

		const draft = createInitialProformaDraft(mockEntities, undefined, businessDraft);

		expect(draft.seller.entityId).toBe('seller-tov');
		expect(draft.seller.name).toBe('Агротех ТОВ');
		expect(draft.seller.taxId).toBe('12345678');
		expect(draft.seller.vatStatus).toBe('vat');
		expect(draft.taxRate).toBe(20);
		expect(draft.number).toBe('AGRO-0042');
		expect(draft.paymentMethod.name).toBe('Безготівковий розрахунок (Власний IBAN)');
		expect(draft.paymentMethod.details).toContain('UA1130000000000000000000001');
	});

	it('configures Finance Company payment method when mode is finance-company', () => {
		const businessDraft: BusinessDraft = {
			version: 2,
			selectedSellerId: 'seller-fop',
			mode: 'finance-company',
			financeName: 'ФК «Платіжний Стандарт»',
			financeIban: 'UA9930000000000000000000099',
			financeTaxId: '99887766',
			sellers: {
				'seller-fop': {
					vatStatus: 'no-vat',
					prefix: 'SHV',
					nextNumber: 5,
					padding: 3,
					purposeTemplate: 'Оплата за товари',
					providerSellerId: 'prov-seller-101',
					providerCode: 'SHV-CODE',
					contractReference: 'DOG-2026/01',
					qrCategory: 'OTHR/GDDS',
					qrFunction: 'UCT',
					allowAmountEdit: false
				}
			}
		};

		const draft = createInitialProformaDraft(mockEntities, undefined, businessDraft);

		expect(draft.seller.entityId).toBe('seller-fop');
		expect(draft.seller.vatStatus).toBe('no-vat');
		expect(draft.taxRate).toBe(0);
		expect(draft.number).toBe('SHV-005');
		expect(draft.paymentMethod.name).toContain('Оплата через фінкомпанію');
		expect(draft.paymentMethod.name).toContain('ФК «Платіжний Стандарт»');
		expect(draft.paymentMethod.details).toContain('UA9930000000000000000000099');
		expect(draft.paymentMethod.details).toContain('99887766');
	});
});
