import { describe, expect, it } from 'vitest';
import { defaultBusinessDraft, defaultSellerDraft } from './business-settings';
import { invoiceReadiness } from './invoice-readiness';
import type { BusinessEntity } from '../types';

const entity: BusinessEntity = { id: 'seller', businessType: 'fop', businessName: 'Shop', displayName: 'Shop', taxId: '1234567890', iban: 'UA663052990000026007123456789', bankName: 'Bank', phone: '+380671234567', contactEmail: 'owner@example.com', isActive: true };

describe('existing client invoice readiness', () => {
	it('asks for missing configuration without changing the document', () => {
		const draft = defaultBusinessDraft();
		const before = structuredClone(draft);
		expect(invoiceReadiness([entity], draft).map((issue) => issue.section)).toEqual(['payment-methods', 'invoice-rules']);
		expect(draft).toEqual(before);
	});
	it('accepts either confirmed VAT status and preserves customized settings', () => {
		for (const vatStatus of ['vat', 'no-vat'] as const) {
			const draft = defaultBusinessDraft();
			draft.mode = 'direct';
			draft.sellers.seller = { ...defaultSellerDraft(entity), vatStatus, prefix: 'CUSTOM', nextNumber: 42 };
			const before = structuredClone(draft);
			expect(invoiceReadiness([entity], draft)).toEqual([]);
			expect(draft).toEqual(before);
		}
	});
	it('asks for incomplete contacts and legal details', () => {
		expect(invoiceReadiness([{ ...entity, phone: '', iban: 'UA123' }], defaultBusinessDraft()).find((issue) => issue.section === 'structure')?.label).toBe('Shop: не заповнено: телефон; перевірте формат: IBAN');
	});
	it('names only absent contacts when legal requisites are complete', () => {
		expect(invoiceReadiness([{ ...entity, phone: undefined, contactEmail: undefined }], defaultBusinessDraft()).find((issue) => issue.section === 'structure')?.label).toBe('Shop: не заповнено: телефон, контактний email');
	});
	it('distinguishes invalid contacts from absent fields and names the legal identifier', () => {
		expect(invoiceReadiness([{ ...entity, businessType: 'tov', taxId: '123', phone: 'bad', contactEmail: 'bad' }], defaultBusinessDraft()).find((issue) => issue.section === 'structure')?.label).toBe('Shop: перевірте формат: ЄДРПОУ (8 цифр), телефон, контактний email');
	});
	it('ignores inactive sellers and checks finance recipient independently', () => {
		const draft = defaultBusinessDraft();
		draft.mode = 'finance-company';
		draft.sellers.seller = { ...defaultSellerDraft(entity), vatStatus: 'vat' };
		expect(invoiceReadiness([entity, { ...entity, id: 'inactive', isActive: false }], draft).map((issue) => issue.section)).toEqual(['payment-methods']);
	});
	it('keeps contacts and bank name advisory-only in direct mode', () => {
		const draft = defaultBusinessDraft();
		draft.mode = 'direct';
		draft.sellers.seller = { ...defaultSellerDraft(entity), vatStatus: 'no-vat' };
		const issues = invoiceReadiness([{ ...entity, phone: '', contactEmail: '', bankName: '' }], draft);
		expect(issues.map((issue) => issue.severity)).toEqual(['advisory']);
		expect(issues[0].label).toBe('Shop: не заповнено: назва банку, телефон, контактний email');
	});
	it('identifies missing direct recipient fields separately from completion advice', () => {
		const draft = defaultBusinessDraft();
		draft.mode = 'direct';
		draft.sellers.seller = { ...defaultSellerDraft(entity), vatStatus: 'vat' };
		const issues = invoiceReadiness([{ ...entity, businessName: '', taxId: '', iban: '', phone: '' }], draft);
		expect(issues.filter((issue) => issue.severity === 'blocker').map((issue) => issue.label)).toEqual(['Shop: не заповнено: юридична назва, IBAN, податковий код (8 або 10 цифр)']);
		expect(issues.filter((issue) => issue.severity === 'advisory').map((issue) => issue.label)).toEqual(['Shop: не заповнено: телефон']);
	});
	it('uses finance recipient rather than seller requisites and still blocks unknown VAT', () => {
		const draft = defaultBusinessDraft();
		draft.mode = 'finance-company';
		draft.financeName = 'Finance';
		draft.financeIban = entity.iban;
		draft.financeTaxId = '12345678';
		draft.sellers.seller = defaultSellerDraft(entity);
		const issues = invoiceReadiness([{ ...entity, businessName: '', iban: '', taxId: '' }], draft);
		expect(issues.filter((issue) => issue.severity === 'blocker').map((issue) => issue.section)).toEqual(['invoice-rules']);
		expect(issues.find((issue) => issue.section === 'structure')?.severity).toBe('advisory');
	});
	it('names missing and malformed finance recipient fields', () => {
		const draft = defaultBusinessDraft();
		draft.mode = 'finance-company';
		draft.financeIban = 'UA123';
		draft.financeTaxId = 'bad';
		expect(invoiceReadiness([entity], draft)[0]).toMatchObject({ severity: 'blocker', label: 'Одержувач платежів: не заповнено: юридична назва; перевірте формат: IBAN, податковий код (8 або 10 цифр)' });
	});
	it('does not promote stricter onboarding checksum or legal-form checks into RPC blockers', () => {
		const draft = defaultBusinessDraft();
		draft.mode = 'direct';
		draft.sellers.seller = { ...defaultSellerDraft(entity), vatStatus: 'vat' };
		expect(invoiceReadiness([{ ...entity, taxId: '12345678', iban: 'UA003052990000026007123456789' }], draft).map((issue) => issue.severity)).toEqual(['advisory']);
	});
	it('keeps unavailable sellers and missing seller settings blocking', () => {
		expect(invoiceReadiness([{ ...entity, isActive: false }], defaultBusinessDraft())).toEqual([{ entityId: null, label: 'Додайте активного продавця', section: 'structure', severity: 'blocker' }]);
		for (const mode of ['direct', 'finance-company'] as const) {
			const draft = defaultBusinessDraft();
			draft.mode = mode;
			expect(invoiceReadiness([entity], draft).find((issue) => issue.section === 'invoice-rules')).toMatchObject({ severity: 'blocker', label: 'Shop: збережіть налаштування продавця та підтвердьте статус ПДВ' });
		}
	});
	it('uses authority IBAN normalization rather than the broader onboarding whitespace rule', () => {
		const draft = defaultBusinessDraft();
		draft.mode = 'direct';
		draft.sellers.seller = { ...defaultSellerDraft(entity), vatStatus: 'vat' };
		expect(invoiceReadiness([{ ...entity, iban: entity.iban.replace('UA', 'ua ') }], draft)).toEqual([]);
		expect(invoiceReadiness([{ ...entity, iban: entity.iban.replace('UA', 'UA\t') }], draft)).toEqual([{ entityId: 'seller', section: 'structure', severity: 'blocker', label: 'Shop: перевірте формат: IBAN' }]);
	});
});