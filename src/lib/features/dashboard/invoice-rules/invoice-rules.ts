import type { InvoiceType } from '../types';

export type BusinessLegalForm = 'tov' | 'fop' | 'self-employed';
export type VatStatus = 'vat' | 'no-vat';
export type InvoiceResetPeriod = 'never' | 'yearly' | 'monthly';
export type QrTransferFunction = 'UCT' | 'ICT' | 'XCT';

export type InvoiceRules = {
	legalForm: BusinessLegalForm;
	vatStatus: VatStatus;
	taxId: string;
	invoicePrefix: string;
	nextNumber: number;
	padding: number;
	resetPeriod: InvoiceResetPeriod;
	purposeTemplate: string;
	qrFunction: QrTransferFunction;
	qrCategory: string;
	qrEncoding: '1';
	allowAmountEdit: boolean;
	expiryHours: number | null;
};

export type InvoiceRuleContext = {
	number: string;
	date: Date;
	scenario: InvoiceType;
	amount?: number;
	customer?: string;
	contract?: string;
};

export const INVOICE_RULES_STORAGE_KEY = 'rahunok.invoice-rules.v1';

export const defaultInvoiceRules: InvoiceRules = {
	legalForm: 'tov',
	vatStatus: 'vat',
	taxId: '',
	invoicePrefix: 'RHK',
	nextNumber: 1049,
	padding: 6,
	resetPeriod: 'yearly',
	purposeTemplate: 'Оплата за товари/послуги згідно рахунку {number} від {date}, у т.ч. ПДВ.',
	qrFunction: 'UCT',
	qrCategory: 'OTHR/GDDS',
	qrEncoding: '1',
	allowAmountEdit: false,
	expiryHours: 24
};

const scenarioLabels: Record<InvoiceType, string> = {
	fixed: 'товари/послуги',
	open_amount: 'товари/послуги',
	table: 'послуги закладу',
	delivery: 'товари та доставку',
	recurring: 'регулярні послуги',
	rtp: 'запит на оплату'
};

export function suggestedPurposeTemplate(legalForm: BusinessLegalForm, vatStatus: VatStatus) {
	const payment = 'Оплата за {scenario} згідно рахунку {number} від {date}';
	if (vatStatus === 'vat') return `${payment}, у т.ч. ПДВ.`;
	return `${payment}, без ПДВ.`;
}

export function taxIdLabel(legalForm: BusinessLegalForm) {
	return legalForm === 'tov' ? 'ЄДРПОУ' : 'РНОКПП';
}

export function formatInvoiceNumber(rules: InvoiceRules, date: Date = new Date()) {
	const sequence = Math.max(1, Math.trunc(rules.nextNumber)).toString().padStart(rules.padding, '0');
	const parts = [rules.invoicePrefix.trim()];
	if (rules.resetPeriod === 'yearly' || rules.resetPeriod === 'monthly') {
		parts.push(String(date.getFullYear()));
	}
	if (rules.resetPeriod === 'monthly') {
		parts.push(String(date.getMonth() + 1).padStart(2, '0'));
	}
	parts.push(sequence);
	return parts.filter(Boolean).join('-');
}

export function formatPaymentPurpose(rules: InvoiceRules, context: InvoiceRuleContext) {
	const values: Record<string, string> = {
		number: context.number,
		date: new Intl.DateTimeFormat('uk-UA').format(context.date),
		scenario: scenarioLabels[context.scenario],
		amount: context.amount ? context.amount.toFixed(2) : '',
		customer: context.customer?.trim() ?? '',
		contract: context.contract?.trim() ?? '',
		tax: rules.vatStatus === 'vat' ? 'у т.ч. ПДВ' : 'без ПДВ'
	};

	return rules.purposeTemplate
		.replace(/\{(number|date|scenario|amount|customer|contract|tax)\}/g, (_, key: string) => values[key])
		.replace(/\s+/g, ' ')
		.trim();
}

export function validateInvoiceRules(rules: InvoiceRules) {
	const issues: string[] = [];
	const reference = formatInvoiceNumber(rules);
	const samplePurpose = formatPaymentPurpose(rules, {
		number: reference,
		date: new Date(),
		scenario: 'fixed',
		amount: 1250
	});

	if (!rules.invoicePrefix.trim()) issues.push('Додайте префікс рахунку.');
	if (reference.length > 35) issues.push('Reference перевищує 35 символів для QR формату 003.');
	if (!Number.isInteger(rules.nextNumber) || rules.nextNumber < 1) issues.push('Наступний номер має бути цілим числом від 1.');
	if (!Number.isInteger(rules.padding) || rules.padding < 1 || rules.padding > 12) issues.push('Довжина номера має бути від 1 до 12 цифр.');
	if (!rules.taxId.trim()) issues.push(`Вкажіть ${taxIdLabel(rules.legalForm)}.`);
	if (!rules.purposeTemplate.trim()) issues.push('Додайте шаблон призначення платежу.');
	if (samplePurpose.length > 420) issues.push('Призначення платежу перевищує 420 символів для QR формату 003.');
	if (!/^[A-Z]{4}\/[A-Z]{4}$/.test(rules.qrCategory)) issues.push('Категорія / ціль має формат CCCC/PPPP.');
	if (rules.expiryHours !== null && (!Number.isInteger(rules.expiryHours) || rules.expiryHours < 1 || rules.expiryHours > 8760)) {
		issues.push('Строк дії має бути від 1 до 8760 годин або необмеженим.');
	}

	return issues;
}

export function loadInvoiceRules(): InvoiceRules {
	if (typeof localStorage === 'undefined') return { ...defaultInvoiceRules };
	try {
		const stored = JSON.parse(localStorage.getItem(INVOICE_RULES_STORAGE_KEY) ?? '{}') as Partial<InvoiceRules>;
		return { ...defaultInvoiceRules, ...stored };
	} catch {
		return { ...defaultInvoiceRules };
	}
}

export function saveInvoiceRules(rules: InvoiceRules) {
	localStorage.setItem(INVOICE_RULES_STORAGE_KEY, JSON.stringify(rules));
}