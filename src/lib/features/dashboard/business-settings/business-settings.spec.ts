import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BusinessEntity } from '../types';
import {
	businessDraftScope, businessInvoicePreview, businessSettingsPrefixAlphabet, copySellerRules, defaultBusinessDraft,
	defaultSellerDraft, loadBusinessDraft, saveBusinessDraft, settingsHref, validateBusinessDraft,
	BusinessDraftConflictError, isBusinessDraftStorageEvent, loadBusinessDraftSnapshot, reconcileBusinessEntities
} from './business-settings';

const entity: BusinessEntity = {
	id: 'seller-a', businessType: 'tov', businessName: 'Seller A', displayName: 'A',
	taxId: '12345678', iban: `UA${'1'.repeat(27)}`, bankName: 'Bank', isActive: true
};
const scope = businessDraftScope('user', 'merchant', false);
let values: Map<string, string>;
let storage: { getItem: ReturnType<typeof vi.fn>; setItem: ReturnType<typeof vi.fn> };

beforeEach(() => {
	values = new Map();
	storage = {
		getItem: vi.fn((key: string) => values.get(key) ?? null),
		setItem: vi.fn((key: string, value: string) => { values.set(key, value); })
	};
	vi.stubGlobal('window', { localStorage: storage });
});
afterEach(() => vi.unstubAllGlobals());

function fixture() {
	return { ...defaultBusinessDraft(), selectedSellerId: entity.id,
		sellers: { [entity.id]: defaultSellerDraft(entity) } };
}
function seed(raw: string) {
	loadBusinessDraft(scope);
	values.set(storage.getItem.mock.lastCall![0], raw);
}

describe('business settings local draft boundary', () => {
	it('accepts exactly the explicit ASCII/Ukrainian prefix alphabet and length boundary', () => {
		const expected = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789АБВГҐДЕЄЖЗИІЇЙКЛМНОПРСТУФХЦЧШЩЬЮЯабвгґдеєжзиіїйклмнопрстуфхцчшщьюя_-';
		expect(businessSettingsPrefixAlphabet).toBe(expected);
		for (const prefix of ['', ...expected, 'ІЇЄҐіїєґ_Ab09-', 'Я'.repeat(20)]) {
			const draft = fixture(); draft.sellers[entity.id].prefix = prefix;
			expect(validateBusinessDraft(draft).sellers[entity.id].prefix).toBe(prefix);
		}
	});
	it.each(['é', '漢', '١', '²', 'Ⅷ', 'Ａ', '９', 'Ы', 'ы', 'Э', 'э', 'Ъ', 'ъ', 'Ё', 'ё',
		'\u0345', '\u05b0', '\u{10400}', '\u{1d7ce}', 'І\u0308', 'a b', 'a.b', 'a/b', '😀', 'Я'.repeat(21)])('rejects unsupported prefix %s without writing', (prefix) => {
		const draft = fixture(); draft.sellers[entity.id].prefix = prefix;
		expect(() => saveBusinessDraft(scope, draft)).toThrow(/префікс/);
		expect(storage.setItem).not.toHaveBeenCalled();
	});
	it.each([1, 2] as const)('preserves incompatible legacy v%s bytes until explicit correction', (version) => {
		const draft = { ...fixture(), version, ...(version === 2 ? { financePurposeTemplate: '{business_purpose}' } : {}) };
		draft.sellers[entity.id].prefix = '漢é١';
		const raw = JSON.stringify(draft);
		seed(raw);
		expect(() => loadBusinessDraft(scope)).toThrow(/префікс/);
		expect([...values.values()]).toEqual([raw]);
		expect(storage.setItem).not.toHaveBeenCalled();
		draft.sellers[entity.id].prefix = 'Рахунок_09-';
		saveBusinessDraft(scope, draft, raw);
		expect(loadBusinessDraft(scope).sellers[entity.id].prefix).toBe('Рахунок_09-');
	});
	it('reconciles additions, removals and refreshed entities without losing dirty fields', () => {
		const draft = fixture();
		const edited = draft.sellers[entity.id];
		edited.prefix = 'DIRTY'; edited.nextNumber = NaN;
		draft.financeName = 'Unsaved finance';
		const second = { ...entity, id: 'seller-b' };
		reconcileBusinessEntities(draft, [second, { ...entity, businessName: 'Renamed' }]);
		expect(draft.selectedSellerId).toBe(entity.id);
		expect(draft.sellers[entity.id]).toBe(edited);
		expect(draft.sellers['seller-b']).toEqual(defaultSellerDraft(second));
		reconcileBusinessEntities(draft, [second]);
		expect(draft.selectedSellerId).toBe(second.id);
		expect(draft.sellers[entity.id]).toBe(edited);
		reconcileBusinessEntities(draft, []);
		expect(draft.selectedSellerId).toBe('');
		reconcileBusinessEntities(draft, [entity]);
		expect(draft.selectedSellerId).toBe(entity.id);
		expect(draft.sellers[entity.id].prefix).toBe('DIRTY');
		expect(draft.sellers[entity.id].nextNumber).toBeNaN();
		expect(draft.financeName).toBe('Unsaved finance');
		expect(storage.getItem).not.toHaveBeenCalled();
		expect(storage.setItem).not.toHaveBeenCalled();
	});
	it('initializes asynchronously available sellers and ignores unsafe entity IDs', () => {
		const draft = defaultBusinessDraft();
		reconcileBusinessEntities(draft, [{ ...entity, id: '__proto__' }, entity]);
		expect(draft.selectedSellerId).toBe(entity.id);
		expect(Object.keys(draft.sellers)).toEqual([entity.id]);
	});
	it('captures exact baseline with a single read and advances it after successful saves', () => {
		const first = loadBusinessDraftSnapshot(scope);
		expect(first.baseline).toBeNull();
		expect(storage.getItem).toHaveBeenCalledTimes(1);
		const encoded = saveBusinessDraft(scope, fixture(), first.baseline);
		const snapshot = loadBusinessDraftSnapshot(scope);
		expect(snapshot.baseline).toBe(encoded);
		snapshot.draft.financeName = 'Updated';
		const next = saveBusinessDraft(scope, snapshot.draft, snapshot.baseline);
		expect(next).not.toBe(encoded);
		expect(loadBusinessDraftSnapshot(scope).baseline).toBe(next);
	});
	it.each(['write', 'delete', 'clear', 'corrupt'] as const)('refuses a stale save after another tab performs %s', (operation) => {
		saveBusinessDraft(scope, fixture());
		const snapshot = loadBusinessDraftSnapshot(scope);
		const key = storage.getItem.mock.lastCall![0];
		snapshot.draft.financeName = 'My unsaved edits';
		if (operation === 'write') values.set(key, JSON.stringify({ ...fixture(), financeName: 'Other tab' }));
		else if (operation === 'delete') values.delete(key);
		else if (operation === 'clear') values.clear();
		else values.set(key, '{broken');
		const external = values.get(key);
		expect(() => saveBusinessDraft(scope, snapshot.draft, snapshot.baseline)).toThrow(BusinessDraftConflictError);
		expect(values.get(key)).toBe(external);
		expect(snapshot.draft.financeName).toBe('My unsaved edits');
		expect(storage.setItem).toHaveBeenCalledTimes(1);
	});
	it('protects an initially absent draft and permits saving only with a newly read baseline', () => {
		const empty = loadBusinessDraftSnapshot(scope);
		saveBusinessDraft(scope, fixture());
		expect(() => saveBusinessDraft(scope, empty.draft, empty.baseline)).toThrow(BusinessDraftConflictError);
		const current = loadBusinessDraftSnapshot(scope);
		current.draft.financeName = 'Explicitly reloaded';
		expect(() => saveBusinessDraft(scope, current.draft, current.baseline)).not.toThrow();
	});
	it('never writes when the optimistic baseline read fails', () => {
		storage.getItem.mockImplementation(() => { throw new Error('blocked'); });
		expect(() => saveBusinessDraft(scope, fixture(), null)).toThrow(/Не вдалося зберегти/);
		expect(storage.setItem).not.toHaveBeenCalled();
	});
	it('filters storage events by storage area and exact user/business/demo scope, including clear', () => {
		loadBusinessDraft(scope);
		const key = storage.getItem.mock.lastCall![0];
		const local = storage as unknown as Storage;
		expect(isBusinessDraftStorageEvent({ key, storageArea: local }, scope)).toBe(true);
		expect(isBusinessDraftStorageEvent({ key: null, storageArea: local }, scope)).toBe(true);
		expect(isBusinessDraftStorageEvent({ key, storageArea: null }, scope)).toBe(false);
		expect(isBusinessDraftStorageEvent({ key: null, storageArea: {} as Storage }, scope)).toBe(false);
		for (const other of [businessDraftScope('other', 'merchant', false),
			businessDraftScope('user', 'other', false), businessDraftScope('user', 'merchant', true)]) {
			loadBusinessDraft(other);
			expect(isBusinessDraftStorageEvent({ key: storage.getItem.mock.lastCall![0], storageArea: local }, scope)).toBe(false);
		}
		expect(isBusinessDraftStorageEvent({ key: `${key}-extra`, storageArea: local }, scope)).toBe(false);
		expect(isBusinessDraftStorageEvent({ key: 'rahunok.invoice-rules.v1', storageArea: local }, scope)).toBe(false);
	});
	it.each(['EPAY/MP2B', 'OTHR/GDDS', 'ZZ99/0000'])('accepts QR draft syntax %s without certifying ISO validity', (qrCategory) => {
		const draft = fixture(); draft.sellers[entity.id].qrCategory = qrCategory;
		saveBusinessDraft(scope, draft);
		expect(loadBusinessDraft(scope).sellers[entity.id].qrCategory).toBe(qrCategory);
		expect(businessInvoicePreview(draft, entity).verified).toBe(false);
	});
	it.each(['epay/MP2B', 'EPAY/MP2', 'EPAY/MP2BB', 'EPAY-MP2B', 'EPAY/MP B', ' EPAY/MP2B'])('rejects malformed QR syntax %s', (qrCategory) => {
		const draft = fixture(); draft.sellers[entity.id].qrCategory = qrCategory;
		expect(() => validateBusinessDraft(draft)).toThrow(/категорія QR/);
	});
	it.each(['tov', 'fop', 'self_employed', 'ngo'] as const)('never infers VAT for %s', (businessType) => {
		expect(defaultSellerDraft({ ...entity, businessType })).toMatchObject({ vatStatus: 'unknown', nextNumber: 1, providerSellerId: '' });
	});
	it('does not write on initial load or invent sellers', () => {
		expect(loadBusinessDraft(scope)).toEqual(defaultBusinessDraft());
		expect(storage.setItem).not.toHaveBeenCalled();
	});
	it('keeps seller drafts and defaults independent', () => {
		const first = defaultSellerDraft(entity);
		const second = defaultSellerDraft({ ...entity, id: 'seller-b' });
		first.providerSellerId = 'provider-a'; first.nextNumber = 80;
		expect(second).toMatchObject({ providerSellerId: '', nextNumber: 1 });
		const draft = fixture(); draft.sellers[entity.id] = first; draft.sellers['seller-b'] = second;
		saveBusinessDraft(scope, draft);
		expect(loadBusinessDraft(scope).sellers).toEqual(draft.sellers);
	});
	it('separates demo, users, merchants and encoded delimiter collisions', () => {
		const scopes = [businessDraftScope('a/b', 'c', false), businessDraftScope('a', 'b/c', false),
			businessDraftScope('a', 'b/c', true), businessDraftScope('a', 'other', false), businessDraftScope('other', 'b/c', false)];
		expect(new Set(scopes).size).toBe(5);
		for (const item of scopes) saveBusinessDraft(item, fixture());
		expect(values.size).toBe(5);
		expect([...values.keys()].every((key) => !key.includes('/'))).toBe(true);
	});
	it('roundtrips strict valid draft without touching legacy keys', () => {
		values.set('rahunok.invoice-rules.v1', 'legacy-rules');
		values.set('rahunok.payment-methods.v1', 'legacy-payments');
		const draft = fixture(); draft.mode = 'finance-company'; draft.financeIban = entity.iban;
		draft.financeTaxId = '12345678'; draft.financeName = 'Finance';
		saveBusinessDraft(scope, draft);
		expect(loadBusinessDraft(scope)).toEqual(draft);
		expect(values.get('rahunok.invoice-rules.v1')).toBe('legacy-rules');
		expect(values.get('rahunok.payment-methods.v1')).toBe('legacy-payments');
		expect(storage.getItem.mock.calls.every(([key]) => key.startsWith('rahunok.business-settings.draft.v1:'))).toBe(true);
		expect(storage.setItem.mock.calls.every(([key]) => key.startsWith('rahunok.business-settings.draft.v1:'))).toBe(true);
	});
	it.each(['{', 'null', '[]', '{}', '42', '"text"'])('rejects malformed storage %s without overwrite', (raw) => {
		seed(raw);
		expect(() => loadBusinessDraft(scope)).toThrow(/Некоректна локальна чернетка/);
		expect(storage.setItem).not.toHaveBeenCalled();
	});
	it.each([
		{ version: 2 }, { mode: 'verified' }, { financeIban: 'invalid' }, { financeTaxId: 'abc' },
		{ selectedSellerId: '__proto__' }, { sellers: [] }, { apiKey: 'not-allowed' }, { financeName: '\u0000' }
	])('rejects invalid root fields %j', (patch) => {
		seed(JSON.stringify({ ...fixture(), ...patch }));
		expect(() => loadBusinessDraft(scope)).toThrow(/Некоректна/);
	});
	it.each([
		{ vatStatus: 'approved' }, { nextNumber: 0 }, { nextNumber: 1.2 }, { nextNumber: '3' },
		{ nextNumber: 1e15 }, { padding: 13 }, { padding: null }, { qrFunction: 'BAD' },
		{ qrCategory: 'bad' }, { allowAmountEdit: 'false' }, { purposeTemplate: '{secret}' },
		{ purposeTemplate: '' }, { prefix: '<script>' }, { providerSellerId: {} }, { token: 'forbidden' }
	])('rejects malformed seller fields %j', (patch) => {
		const draft = fixture();
		seed(JSON.stringify({ ...draft, sellers: { [entity.id]: { ...draft.sellers[entity.id], ...patch } } }));
		expect(() => loadBusinessDraft(scope)).toThrow(/Некоректна/);
	});
	it.each(['__proto__', 'constructor', 'prototype'])('rejects prototype pollution key %s', (key) => {
		seed(JSON.stringify(fixture()).replace('"sellers":{', `"sellers":{"${key}":{},`));
		expect(() => loadBusinessDraft(scope)).toThrow(/Некоректна/);
		expect(Object.prototype).not.toHaveProperty('polluted');
	});
	it('rejects nested extra keys, missing fields and inherited data', () => {
		const draft = fixture();
		const raw = JSON.stringify(draft).replace('"vatStatus":', '"__proto__":{"polluted":true},"vatStatus":');
		seed(raw); expect(() => loadBusinessDraft(scope)).toThrow();
		const { mode: omitted, ...missing } = draft;
		expect(omitted).toBe('unconfigured');
		expect(() => validateBusinessDraft(missing)).toThrow();
		expect(() => validateBusinessDraft(Object.create(draft))).toThrow();
	});
	it('validates before saving and leaves previous data intact', () => {
		const draft = fixture(); saveBusinessDraft(scope, draft);
		draft.sellers[entity.id].nextNumber = NaN;
		expect(() => saveBusinessDraft(scope, draft)).toThrow();
		expect(loadBusinessDraft(scope).sellers[entity.id].nextNumber).toBe(1);
		expect(storage.setItem).toHaveBeenCalledTimes(1);
	});
	it('reports blocked reads, quota failures and unavailable browser storage', () => {
		storage.getItem.mockImplementation(() => { throw new Error('SecurityError'); });
		expect(() => loadBusinessDraft(scope)).toThrow(/сховище|Сховище/);
		storage.setItem.mockImplementation(() => { throw new Error('QuotaExceededError'); });
		expect(() => saveBusinessDraft(scope, fixture())).toThrow(/Не вдалося зберегти/);
		vi.stubGlobal('window', undefined);
		expect(() => loadBusinessDraft(scope)).toThrow(/недоступне/);
	});
	it('handles a throwing storage getter', () => {
		vi.stubGlobal('window', Object.defineProperty({}, 'localStorage', { get() { throw new Error('blocked'); } }));
		expect(() => loadBusinessDraft(scope)).toThrow(/недоступне/);
	});
	it('copies only rules, preserving VAT, provider identity and next number', () => {
		const source = { ...defaultSellerDraft(entity), prefix: 'SOURCE', padding: 4, nextNumber: 90,
			vatStatus: 'vat' as const, providerSellerId: 'source-id', providerCode: 'source-code', allowAmountEdit: true };
		const target = { ...defaultSellerDraft(entity), nextNumber: 7, providerSellerId: 'target-id', contractReference: 'target-contract' };
		const copy = copySellerRules(source, target);
		expect(copy).toMatchObject({ prefix: 'SOURCE', padding: 4, allowAmountEdit: true, nextNumber: 7,
			vatStatus: 'unknown', providerSellerId: 'target-id', providerCode: '', contractReference: 'target-contract' });
		expect(target.prefix).toBe('RHK');
	});
	it('builds encoded crosslinks with demo and seller context', () => {
		const url = new URL(settingsHref('invoice-rules', 'seller/a & b', true), 'https://local.invalid');
		expect(url.pathname).toBe('/dashboard/invoice-rules');
		expect(url.searchParams.get('entityId')).toBe('seller/a & b');
		expect(url.searchParams.get('demo')).toBe('1');
		expect(settingsHref('structure', '', false)).toBe('/dashboard/structure');
		expect(settingsHref('payment-methods', '__proto__', false)).not.toContain('entityId');
	});
	it('exports immutable non-atomic preview without mutating the draft or verifying IDs', () => {
		const draft = fixture(); draft.mode = 'direct';
		const before = JSON.stringify(draft);
		const preview = businessInvoicePreview(draft, entity, new Date('2026-09-08T12:00:00Z'));
		expect(preview).toMatchObject({ number: 'RHK-000001', iban: entity.iban, verified: false, draftOnly: true });
		expect(preview.businessPurpose).toContain('[ПДВ не визначено]');
		expect(preview.finalPurpose).toBe(preview.businessPurpose);
		expect(Object.isFrozen(preview)).toBe(true);
		expect(JSON.stringify(draft)).toBe(before);
		draft.mode = 'finance-company'; draft.financeName = 'Finance'; draft.sellers[entity.id].providerSellerId = 'entered-id';
		const finance = businessInvoicePreview(draft, entity);
		expect(finance.finalPurpose).toContain('entered-id');
		expect(finance.finalPurpose).toContain('[не задано: provider_code]');
		expect(finance.finalPurpose).toContain('не реальний ID');
		expect(finance.verified).toBe(false);
		expect(finance.payee).toBe('Finance');
	});
	it('keeps legal seller identity and own IBAN distinct from finance recipient in illustration only', () => {
		const draft = fixture(); draft.mode = 'finance-company';
		draft.financeName = 'Finance recipient'; draft.financeIban = `UA${'2'.repeat(27)}`;
		const before = JSON.stringify(draft);
		const preview = businessInvoicePreview(draft, entity);
		expect(preview.finalPurpose).toContain(`Юридична назва продавця: ${entity.businessName}`);
		expect(preview.finalPurpose).toContain(`власний IBAN продавця: ${entity.iban}`);
		expect(preview.finalPurpose).not.toContain(draft.financeIban);
		expect(preview.finalPurpose).toContain('не платіжний payload');
		expect(preview).toMatchObject({ payee: draft.financeName, iban: draft.financeIban, verified: false, draftOnly: true });
		expect(preview).not.toHaveProperty('payload');
		expect(preview).not.toHaveProperty('qr');
		expect(JSON.stringify(draft)).toBe(before);
		const missing = businessInvoicePreview(draft, { ...entity, businessName: '', iban: '' });
		expect(missing.finalPurpose).toContain('[не задано: seller_name]');
		expect(missing.finalPurpose).toContain('[не задано: seller_iban]');
	});
});