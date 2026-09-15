import type { BusinessEntity } from '../types';
import type { InvoiceRules } from '../invoice-rules/invoice-rules';
import { formatInvoiceNumber, formatPaymentPurpose } from '../invoice-rules/invoice-rules';
import type {
	ProformaCurrency,
	ProformaCustomer,
	ProformaDraft,
	ProformaItem,
	ProformaPaymentMethod,
	ProformaSeller,
	ProformaTotals
} from './types';

export function calculateLineTotal(price: number, quantity: number, discountPercent: number): number {
	const subtotal = Math.max(0, price) * Math.max(0, quantity);
	const discount = Math.min(100, Math.max(0, discountPercent)) / 100;
	return Math.round(subtotal * (1 - discount) * 100) / 100;
}

export function calculateProformaTotals(
	items: ProformaItem[],
	taxRate: number = 0,
	adjustment: number = 0
): ProformaTotals {
	let subtotal = 0;
	let discountTotal = 0;

	for (const item of items) {
		if (item.type === 'heading') continue;
		const rawLine = Math.max(0, item.price) * Math.max(0, item.quantity);
		const discount = Math.min(100, Math.max(0, item.discountPercent)) / 100;
		const lineDiscount = rawLine * discount;
		subtotal += rawLine;
		discountTotal += lineDiscount;
	}

	const taxableBase = Math.max(0, subtotal - discountTotal);
	const taxAmount = taxRate > 0 ? Math.round((taxableBase * (taxRate / 100)) * 100) / 100 : 0;
	const total = Math.max(0, Math.round((taxableBase + adjustment) * 100) / 100);

	return {
		subtotal: Math.round(subtotal * 100) / 100,
		discountTotal: Math.round(discountTotal * 100) / 100,
		taxAmount,
		adjustment,
		total
	};
}

export function formatCurrencySign(currency: ProformaCurrency): string {
	switch (currency) {
		case 'USD':
			return '$';
		case 'EUR':
			return '€';
		case 'UAH':
		default:
			return '₴';
	}
}

export function formatProformaMoney(amount: number, currency: ProformaCurrency = 'UAH'): string {
	const sign = formatCurrencySign(currency);
	const formatted = new Intl.NumberFormat('uk-UA', {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2
	}).format(amount);
	return `${formatted} ${sign}`;
}

import type { BusinessDraft } from '../business-settings/business-settings';
import { businessInvoicePreview } from '../business-settings/business-settings';

export function createInitialProformaDraft(
	entities: BusinessEntity[] = [],
	rules?: InvoiceRules,
	businessDraft?: BusinessDraft
): ProformaDraft {
	const defaultEntity =
		(businessDraft?.selectedSellerId &&
			entities.find((e) => e.id === businessDraft.selectedSellerId)) ||
		entities[0];

	const sellerDraft =
		defaultEntity && businessDraft?.sellers ? businessDraft.sellers[defaultEntity.id] : undefined;

	const now = new Date();
	const dueDate = new Date(now);
	dueDate.setDate(dueDate.getDate() + 14);

	const issueDateStr = now.toISOString().slice(0, 10);
	const dueDateStr = dueDate.toISOString().slice(0, 10);

	let generatedNumber = rules ? formatInvoiceNumber(rules, now) : '01-123';
	if (sellerDraft && sellerDraft.prefix) {
		const seq =
			Number.isSafeInteger(sellerDraft.nextNumber) && sellerDraft.nextNumber > 0
				? String(sellerDraft.nextNumber).padStart(Math.min(12, Math.max(1, sellerDraft.padding || 1)), '0')
				: '001';
		generatedNumber = [sellerDraft.prefix, seq].filter(Boolean).join('-');
	}

	const isVat =
		sellerDraft?.vatStatus === 'vat' ||
		(sellerDraft?.vatStatus !== 'no-vat' && defaultEntity?.businessType === 'tov');

	const seller: ProformaSeller = {
		entityId: defaultEntity?.id || '',
		name: defaultEntity?.displayName || defaultEntity?.businessName || 'Моя компанія',
		taxId: defaultEntity?.taxId || '',
		iban: defaultEntity?.iban || '',
		bankName: defaultEntity?.bankName || '',
		vatStatus: isVat ? 'vat' : 'no-vat',
		legalAddress: ''
	};

	const customer: ProformaCustomer = {
		name: '',
		taxId: '',
		email: '',
		phone: '',
		address: ''
	};

	const items: ProformaItem[] = [
		{
			id: 'item-1',
			type: 'item',
			name: 'Розробка Frontend інтерфейсу',
			description: '',
			price: 1800,
			quantity: 14,
			unit: 'год.',
			discountPercent: 0,
			total: 25200
		},
		{
			id: 'item-2',
			type: 'item',
			name: 'Backend розробка та API',
			description: 'Налаштування ендпоінтів та оптимізація запитів до БД.',
			price: 2000,
			quantity: 8,
			unit: 'год.',
			discountPercent: 0,
			total: 16000
		}
	];

	let defaultPurpose = '';
	if (defaultEntity && businessDraft) {
		const prev = businessInvoicePreview(businessDraft, defaultEntity, now);
		defaultPurpose = prev.finalPurpose;
	} else if (rules) {
		defaultPurpose = formatPaymentPurpose(rules, {
			number: generatedNumber,
			date: now,
			scenario: 'fixed',
			customer: customer.name
		});
	} else {
		defaultPurpose = `Оплата згідно рахунку №${generatedNumber} від ${now.toLocaleDateString('uk-UA')}, ${isVat ? 'у т.ч. ПДВ 20%' : 'без ПДВ'}.`;
	}

	let paymentMethod: ProformaPaymentMethod;
	const mode = businessDraft?.mode ?? 'direct';
	if (mode === 'finance-company') {
		paymentMethod = {
			type: 'iban',
			name: `Оплата через фінкомпанію (${businessDraft?.financeName || 'Фінкомпанія'})`,
			details: businessDraft?.financeIban
				? `IBAN: ${businessDraft.financeIban} (ЄДРПОУ: ${businessDraft.financeTaxId})`
				: 'IBAN фінкомпанії не вказано'
		};
	} else {
		paymentMethod = {
			type: 'iban',
			name: 'Безготівковий розрахунок (Власний IBAN)',
			details: seller.iban
				? `IBAN: ${seller.iban}${seller.bankName ? ` (${seller.bankName})` : ''}`
				: 'Обов’язкове поле'
		};
	}

	return {
		id: `proforma-${crypto.randomUUID()}`,
		title: 'Рахунок-фактура',
		number: generatedNumber,
		issueDate: issueDateStr,
		dueDate: dueDateStr,
		currency: 'UAH',
		seller,
		customer,
		items,
		paymentMethod,
		purpose: defaultPurpose,
		notes: '',
		taxRate: isVat ? 20 : 0,
		appearanceTemplate: 'Шаблон №1 • Українська',
		recurrence: 'none',
		projectGroup: 'Без проєкту • Без групи',
		status: 'draft',
		createdAt: now.toISOString()
	};
}
