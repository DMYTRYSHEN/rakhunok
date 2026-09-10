import type { BusinessEntity } from '../types';
import { defaultFinancePurposeTemplate, previewFinancePurpose, validateFinancePurposeTemplate } from './finance-purpose';

export type BusinessSettingsView = 'structure' | 'invoice-rules' | 'payment-methods';
export type SellerDraft = {
	vatStatus: 'unknown' | 'vat' | 'no-vat';
	prefix: string;
	nextNumber: number;
	padding: number;
	purposeTemplate: string;
	providerSellerId: string;
	providerCode: string;
	contractReference: string;
	qrCategory: string;
	qrFunction: 'UCT' | 'ICT' | 'XCT';
	allowAmountEdit: boolean;
};
export type BusinessDraft = {
	version: 1 | 2;
	financePurposeTemplate?: string;
	selectedSellerId: string;
	mode: 'unconfigured' | 'direct' | 'finance-company';
	financeName: string;
	financeIban: string;
	financeTaxId: string;
	sellers: Record<string, SellerDraft>;
};

const namespace = 'rahunok.business-settings.draft.v1:';
// Literal membership, shared with SQL and checked by the prefix contract tests.
export const businessSettingsPrefixAlphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789АБВГҐДЕЄЖЗИІЇЙКЛМНОПРСТУФХЦЧШЩЬЮЯабвгґдеєжзиіїйклмнопрстуфхцчшщьюя_-';
const forbidden = new Set(['__proto__', 'prototype', 'constructor']);
const invalid = (field: string): never => {
	throw new Error(`Некоректна локальна чернетка: ${field}. Дані не перезаписано.`);
};

function hasControlCharacters(value: string): boolean {
	return Array.from(value).some((character) => character.charCodeAt(0) < 32 || (character.charCodeAt(0) >= 127 && character.charCodeAt(0) <= 159));
}

function text(value: unknown, field: string, max = 200): asserts value is string {
	if (typeof value !== 'string' || value.length > max || hasControlCharacters(value)) {
		invalid(field);
	}
}

export function isSafeSellerId(value: unknown): value is string {
	return typeof value === 'string' && value.length > 0 && value.length <= 200 &&
		!forbidden.has(value) && !hasControlCharacters(value);
}

function record(value: unknown, field: string): asserts value is Record<string, unknown> {
	if (!value || typeof value !== 'object' || Array.isArray(value) ||
		![Object.prototype, null].includes(Object.getPrototypeOf(value))) return invalid(field);
	for (const key of Reflect.ownKeys(value)) {
		if (typeof key !== 'string' || forbidden.has(key) ||
			!Object.getOwnPropertyDescriptor(value, key)?.enumerable ||
			!('value' in Object.getOwnPropertyDescriptor(value, key)!)) invalid(field);
	}
}

function fields(value: Record<string, unknown>, expected: string[], field: string) {
	if (Object.keys(value).length !== expected.length ||
		!expected.every((key) => Object.hasOwn(value, key))) invalid(field);
}

export function defaultBusinessDraft(): BusinessDraft {
	return {
		version: 1, selectedSellerId: '', mode: 'unconfigured', financeName: '',
		financeIban: '', financeTaxId: '', sellers: {}
	};
}

/** Legal form never determines VAT. Entity identity and bank details remain server-owned. */
export function defaultSellerDraft(entity: BusinessEntity): SellerDraft {
	if (!isSafeSellerId(entity.id)) invalid('ідентифікатор продавця');
	return {
		vatStatus: 'unknown', prefix: 'RHK', nextNumber: 1, padding: 6,
		purposeTemplate: 'Оплата за товари/послуги, рахунок {number} від {date}, {tax}.',
		providerSellerId: '', providerCode: '', contractReference: '',
		qrCategory: 'OTHR/GDDS', qrFunction: 'UCT', allowAmountEdit: false
	};
}

/** Reconcile availability only: retain even removed sellers' unsaved edits for recovery. */
export function reconcileBusinessEntities(draft: BusinessDraft, entities: readonly BusinessEntity[]): void {
	const available = entities.filter((entity) => isSafeSellerId(entity.id));
	for (const entity of available) {
		if (!Object.hasOwn(draft.sellers, entity.id)) draft.sellers[entity.id] = defaultSellerDraft(entity);
	}
	if (!available.some((entity) => entity.id === draft.selectedSellerId)) {
		draft.selectedSellerId = available[0]?.id ?? '';
	}
}

function validateSeller(value: unknown): SellerDraft {
	record(value, 'профіль продавця');
	fields(value, ['vatStatus', 'prefix', 'nextNumber', 'padding', 'purposeTemplate',
		'providerSellerId', 'providerCode', 'contractReference', 'qrCategory', 'qrFunction',
		'allowAmountEdit'], 'поля продавця');
	for (const key of ['prefix', 'purposeTemplate', 'providerSellerId', 'providerCode',
		'contractReference', 'qrCategory']) text(value[key], key, key === 'purposeTemplate' ? 420 : 200);
	if (!['unknown', 'vat', 'no-vat'].includes(value.vatStatus as string)) invalid('ПДВ');
	if (!['UCT', 'ICT', 'XCT'].includes(value.qrFunction as string)) invalid('функція QR');
	if (typeof value.allowAmountEdit !== 'boolean') invalid('редагування суми');
	if (!Number.isSafeInteger(value.nextNumber) || (value.nextNumber as number) < 1 ||
		(value.nextNumber as number) > 999999999999) invalid('наступний номер (1–999999999999)');
	if (!Number.isInteger(value.padding) || (value.padding as number) < 1 ||
		(value.padding as number) > 12) invalid('розрядність (1–12)');
	if ((value.prefix as string).length > 20 ||
		Array.from(value.prefix as string).some((character) => !businessSettingsPrefixAlphabet.includes(character))) {
		invalid('префікс: до 20 латинських або українських літер, цифри 0–9, дефіс чи підкреслення');
	}
	// Draft syntax only; this does not certify membership in any ISO code list.
	if (!/^[A-Z0-9]{4}\/[A-Z0-9]{4}$/.test(value.qrCategory as string)) invalid('категорія QR (4 великі латинські літери або цифри / 4 літери або цифри; не перевірка ISO)');
	const template = value.purposeTemplate as string;
	if (!template.trim() || /[{}]/.test(template.replace(/\{(number|date|tax)\}/g, ''))) invalid('шаблон: лише {number}, {date}, {tax}');
	return { ...value } as SellerDraft;
}

/** Strict detached decoder. v1/v2 share the explicit prefix alphabet; no silent legacy rewrite. */
export function validateBusinessDraft(value: unknown): BusinessDraft {
	record(value, 'об’єкт');
	fields(value, ['version', 'selectedSellerId', 'mode', 'financeName', 'financeIban',
		'financeTaxId', 'sellers', ...(value.version === 2 ? ['financePurposeTemplate'] : [])], 'поля бізнесу');
	if (value.version !== 1 && value.version !== 2) invalid('версія');
	if (value.version === 2) validateFinancePurposeTemplate(value.financePurposeTemplate);
	for (const key of ['selectedSellerId', 'financeName', 'financeIban', 'financeTaxId']) text(value[key], key);
	if (value.selectedSellerId !== '' && !isSafeSellerId(value.selectedSellerId)) invalid('вибраний продавець');
	if (!['unconfigured', 'direct', 'finance-company'].includes(value.mode as string)) invalid('модель платежів');
	if (value.financeIban !== '' && !/^UA\d{27}$/.test(value.financeIban as string)) invalid('IBAN фінкомпанії (UA + 27 цифр)');
	if (value.financeTaxId !== '' && !/^(\d{8}|\d{10})$/.test(value.financeTaxId as string)) invalid('код фінкомпанії (8 або 10 цифр)');
	record(value.sellers, 'продавці');
	if (Object.keys(value.sellers).length > 1000) invalid('забагато продавців');
	const sellers: Record<string, SellerDraft> = {};
	for (const [id, seller] of Object.entries(value.sellers)) {
		if (!isSafeSellerId(id)) invalid('ідентифікатор продавця');
		sellers[id] = validateSeller(seller);
	}
	return { ...value, sellers } as BusinessDraft;
}

export function businessDraftScope(userId: string, merchantId: string, demo: boolean): string {
	text(userId, 'користувач');
	text(merchantId, 'бізнес');
	if (!userId || !merchantId || typeof demo !== 'boolean') invalid('контекст');
	return `${demo ? 'demo' : 'live'}/${encodeURIComponent(userId)}/${encodeURIComponent(merchantId)}`;
}

function storageKey(scope: string) {
	text(scope, 'контекст сховища', 4000);
	if (!scope) invalid('порожній контекст сховища');
	return namespace + encodeURIComponent(scope);
}

function browserStorage(): Storage {
	try {
		if (typeof window === 'undefined') throw new Error();
		return window.localStorage;
	} catch {
		throw new Error('Локальне сховище недоступне. Дозвольте зберігання даних у браузері.');
	}
}

/** Only localStorage events for this exact user/business/demo scope (or clear). */
export function isBusinessDraftStorageEvent(
	event: Pick<StorageEvent, 'key' | 'storageArea'>, scope: string
): boolean {
	return event.storageArea === browserStorage() && (event.key === null || event.key === storageKey(scope));
}

export class BusinessDraftConflictError extends Error {
	constructor() {
		super('Чернетку змінено в іншій вкладці. Збереження заблоковано: явно відкиньте локальні правки й завантажте актуальну чернетку.');
		this.name = 'BusinessDraftConflictError';
	}
}

/** Capture the baseline from the same read as the decoded draft, not a second read. */
export function loadBusinessDraftSnapshot(scope: string): { draft: BusinessDraft; baseline: string | null } {
	const key = storageKey(scope);
	let raw: string | null;
	try { raw = browserStorage().getItem(key); } catch {
		throw new Error('Не вдалося прочитати локальну чернетку. Сховище браузера недоступне.');
	}
	if (raw === null) return { draft: defaultBusinessDraft(), baseline: null };
	if (raw.length > 2_000_000) invalid('розмір даних');
	let parsed: unknown;
	try { parsed = JSON.parse(raw); } catch { return invalid('пошкоджений JSON'); }
	return { draft: validateBusinessDraft(parsed), baseline: raw };
}

export function loadBusinessDraft(scope: string): BusinessDraft {
	return loadBusinessDraftSnapshot(scope).draft;
}

/** Optimistic check, not atomic CAS: localStorage cannot lock competing tabs. */
export function saveBusinessDraft(scope: string, draft: BusinessDraft, baseline?: string | null): string {
	const key = storageKey(scope);
	const encoded = JSON.stringify(validateBusinessDraft(draft));
	if (encoded.length > 2_000_000) invalid('розмір даних');
	try {
		const storage = browserStorage();
		if (baseline !== undefined && storage.getItem(key) !== baseline) throw new BusinessDraftConflictError();
		storage.setItem(key, encoded);
	} catch (cause) {
		if (cause instanceof BusinessDraftConflictError) throw cause;
		throw new Error('Не вдалося зберегти чернетку. Перевірте дозвіл і вільне місце у сховищі браузера.');
	}
	return encoded;
}

export function settingsHref(view: BusinessSettingsView, entityId: string, demo: boolean): string {
	if (!['structure', 'invoice-rules', 'payment-methods'].includes(view)) invalid('сторінка');
	const query = new URLSearchParams();
	if (demo) query.set('demo', '1');
	if (isSafeSellerId(entityId)) query.set('entityId', entityId);
	return `/dashboard/${view}${query.size ? `?${query}` : ''}`;
}

/** Copies only invoice/QR rules, not VAT, counters, or connection/contract identity. */
export function copySellerRules(source: SellerDraft, target: SellerDraft): SellerDraft {
	return { ...target, prefix: source.prefix, padding: source.padding,
		purposeTemplate: source.purposeTemplate, qrCategory: source.qrCategory,
		qrFunction: source.qrFunction, allowAmountEdit: source.allowAmountEdit };
}

export type BusinessInvoicePreview = Readonly<{
	number: string;
	businessPurpose: string;
	finalPurpose: string;
	payee: string;
	iban: string;
	verified: false;
	draftOnly: true;
}>;

/** Read-only display helper. Never allocates a number, verifies a payee or constructs a QR. */
export function businessInvoicePreview(
	draft: BusinessDraft, entity: BusinessEntity, date: Date = new Date()
): BusinessInvoicePreview {
	const seller = Object.hasOwn(draft.sellers, entity.id) ? draft.sellers[entity.id] : defaultSellerDraft(entity);
	const sequence = Number.isSafeInteger(seller.nextNumber) && seller.nextNumber > 0
		? String(seller.nextNumber).padStart(Math.min(12, Math.max(1, seller.padding || 1)), '0') : '…';
	const number = [seller.prefix, sequence].filter(Boolean).join('-');
	const replacements: Record<string, string> = {
		number, date: new Intl.DateTimeFormat('uk-UA').format(date),
		tax: seller.vatStatus === 'vat' ? 'у т.ч. ПДВ' : seller.vatStatus === 'no-vat' ? 'без ПДВ' : '[ПДВ не визначено]'
	};
	const businessPurpose = seller.purposeTemplate.replace(/\{(number|date|tax)\}/g, (_, key: string) => replacements[key]);
	const finance = draft.mode === 'finance-company';
	const finalPurpose = finance
		? previewFinancePurpose(draft.financePurposeTemplate ?? defaultFinancePurposeTemplate, {
			business_purpose: businessPurpose, seller_name: entity.businessName, seller_iban: entity.iban,
			seller_tax_id: entity.taxId, provider_code: seller.providerCode,
			provider_seller_id: seller.providerSellerId, contract_reference: seller.contractReference
		})
		: businessPurpose;
	return Object.freeze({ number, businessPurpose, finalPurpose,
		payee: finance ? draft.financeName : draft.mode === 'direct' ? entity.businessName : '',
		iban: finance ? draft.financeIban : draft.mode === 'direct' ? entity.iban : '',
		verified: false, draftOnly: true });
}