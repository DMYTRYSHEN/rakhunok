import type { BusinessEntity } from '../types';
import type { BusinessDraft } from './business-settings';
import { ibanBank, normalizePhone, validContactEmail } from '../auth/onboarding';

export type InvoiceReadinessIssue = {
	entityId: string | null;
	label: string;
	section: 'structure' | 'payment-methods' | 'invoice-rules';
	severity: 'blocker' | 'advisory';
};

type ReadinessField = { key: string; label: string; value: string; valid: boolean };

function fieldIssue(fields: ReadinessField[], entityId: string | null, name: string, section: InvoiceReadinessIssue['section'], severity: InvoiceReadinessIssue['severity']): InvoiceReadinessIssue[] {
	const missing = fields.filter((field) => !field.value.trim()).map((field) => field.label);
	const invalid = fields.filter((field) => field.value.trim() && !field.valid).map((field) => field.label);
	const details = [missing.length ? `не заповнено: ${missing.join(', ')}` : '', invalid.length ? `перевірте формат: ${invalid.join(', ')}` : ''].filter(Boolean).join('; ');
	return details ? [{ entityId, label: `${name}: ${details}`, section, severity }] : [];
}

function recipientFields(name: string, iban: string, taxId: string): ReadinessField[] {
	return [
		{ key: 'name', label: 'юридична назва', value: name, valid: Boolean(name.trim()) },
		{ key: 'iban', label: 'IBAN', value: iban, valid: /^UA\d{27}$/.test(iban.replaceAll(' ', '').toUpperCase()) },
		{ key: 'tax', label: 'податковий код (8 або 10 цифр)', value: taxId, valid: /^(\d{8}|\d{10})$/.test(taxId) }
	];
}

export function invoiceReadiness(entities: readonly BusinessEntity[], draft: BusinessDraft): InvoiceReadinessIssue[] {
	const active = entities.filter((entity) => entity.isActive);
	if (!active.length) return [{ entityId: null, label: 'Додайте активного продавця', section: 'structure', severity: 'blocker' }];
	const issues: InvoiceReadinessIssue[] = [];
	if (draft.mode === 'unconfigured') issues.push({ entityId: null, label: 'Оберіть модель отримання платежів', section: 'payment-methods', severity: 'blocker' });
	if (draft.mode === 'finance-company') {
		const fields = recipientFields(draft.financeName, draft.financeIban, draft.financeTaxId);
		issues.push(...fieldIssue(fields, null, 'Одержувач платежів', 'payment-methods', 'blocker'));
		if (fields[1].valid && !ibanBank(draft.financeIban)) issues.push(...fieldIssue([{ ...fields[1], valid: false }], null, 'Одержувач платежів', 'payment-methods', 'advisory'));
	}
	for (const entity of active) {
		const name = entity.displayName || entity.businessName || 'Продавець';
		const personal = ['fop', 'self_employed'].includes(entity.businessType);
		const recipient = recipientFields(entity.businessName, entity.iban, entity.taxId);
		const blocking = draft.mode === 'direct' ? recipient.filter((field) => !field.valid) : [];
		issues.push(...fieldIssue(blocking, entity.id, name, 'structure', 'blocker'));
		const fields = [
			{ key: 'name', label: 'юридична назва', value: entity.businessName, valid: Boolean(entity.businessName.trim()) },
			{ key: 'tax', label: personal ? 'РНОКПП (10 цифр)' : 'ЄДРПОУ (8 цифр)', value: entity.taxId, valid: (personal ? /^\d{10}$/ : /^\d{8}$/).test(entity.taxId) },
			{ key: 'iban', label: 'IBAN', value: entity.iban, valid: Boolean(ibanBank(entity.iban)) },
			{ key: 'bank', label: 'назва банку', value: entity.bankName, valid: Boolean(entity.bankName.trim()) },
			{ key: 'phone', label: 'телефон', value: entity.phone ?? '', valid: Boolean(normalizePhone(entity.phone ?? '')) },
			{ key: 'email', label: 'контактний email', value: entity.contactEmail ?? '', valid: validContactEmail(entity.contactEmail ?? '') }
		];
		issues.push(...fieldIssue(fields.filter((field) => !blocking.some((blocked) => blocked.key === field.key)), entity.id, name, 'structure', 'advisory'));
		const seller = draft.sellers[entity.id];
		if (!seller || seller.vatStatus === 'unknown') issues.push({ entityId: entity.id, label: `${name}: ${seller ? 'підтвердьте статус ПДВ' : 'збережіть налаштування продавця та підтвердьте статус ПДВ'}`, section: 'invoice-rules', severity: 'blocker' });
	}
	return issues;
}