import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSettingsRepository, SettingsConflictError } from './settings-repository';
import { defaultBusinessDraft, defaultSellerDraft, validateBusinessDraft } from './business-settings';
import { defaultFinancePurposeTemplate, previewFinancePurpose, validateFinancePurposeTemplate } from './finance-purpose';

const context = { userId: 'owner', merchantId: 'merchant', demo: false };
const draft = () => ({ ...defaultBusinessDraft(), version: 2 as const, financePurposeTemplate: defaultFinancePurposeTemplate });
const response = (revision = 1) => {
	const { selectedSellerId: _id, ...document } = draft();
	return { revision, document };
};
afterEach(() => vi.unstubAllGlobals());
describe('account settings repository', () => {
	it('rejects unsupported prefixes before RPC and rejects incompatible server documents without fallback', async () => {
		const rpc = vi.fn();
		const repository = createSettingsRepository(() => ({ rpc }));
		const entity = { id: 'abcdef00-0000-0000-0000-000000000001', businessType: 'tov' as const,
			businessName: 'Synthetic seller', displayName: '', taxId: '', iban: '', bankName: '', isActive: true };
		const value = { ...draft(), sellers: { [entity.id]: { ...defaultSellerDraft(entity), prefix: '漢é١' } } };
		await expect(repository.save(context, value, null, 0)).rejects.toThrow(/префікс/);
		expect(rpc).not.toHaveBeenCalled();
		const { selectedSellerId: _id, ...document } = value;
		expect(_id).toBe('');
		rpc.mockResolvedValue({ data: { revision: 1, document }, error: null });
		await expect(repository.load(context)).rejects.toThrow(/префікс/);
		expect(rpc).toHaveBeenCalledTimes(1);
	});
	it('loads coherent snapshots and omits UI selection on atomic save', async () => {
		const rpc = vi.fn().mockResolvedValue({ data: response(), error: null });
		const repository = createSettingsRepository(() => ({ rpc }));
		expect((await repository.load(context)).revision).toBe(1);
		await repository.save(context, { ...draft(), selectedSellerId: 'ui-only' }, null, 0);
		expect(rpc.mock.lastCall?.[0]).toBe('save_business_settings');
		expect(rpc.mock.lastCall?.[1]).toMatchObject({ p_merchant_id: 'merchant', p_expected_revision: 0 });
		expect(rpc.mock.lastCall?.[1].p_document).not.toHaveProperty('selectedSellerId');
	});
	it('treats absent configuration separately from unavailable schema', async () => {
		const rpc = vi.fn().mockResolvedValue({ data: { revision: 0, document: null }, error: null });
		const repository = createSettingsRepository(() => ({ rpc }));
		expect((await repository.load(context)).draft.version).toBe(2);
		rpc.mockResolvedValue({ data: null, error: { code: 'PGRST202' } });
		await expect(repository.load(context)).rejects.toThrow('ще не встановлено');
	});
	it('never silently replaces failed account writes with browser storage', async () => {
		const getItem = vi.fn(), setItem = vi.fn();
		vi.stubGlobal('window', { localStorage: { getItem, setItem } });
		const repository = createSettingsRepository(() => ({ rpc: vi.fn().mockResolvedValue({ data: null, error: { code: '40001' } }) }));
		await expect(repository.save(context, draft(), null, 1)).rejects.toBeInstanceOf(SettingsConflictError);
		expect(getItem).not.toHaveBeenCalled(); expect(setItem).not.toHaveBeenCalled();
	});
	it('demo makes zero client calls and keeps v1 compatibility', async () => {
		const values = new Map<string, string>();
		vi.stubGlobal('window', { localStorage: { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) } });
		const getClient = vi.fn();
		const repository = createSettingsRepository(getClient);
		const demo = { ...context, demo: true };
		const snapshot = await repository.load(demo);
		expect(snapshot.draft.version).toBe(1);
		await repository.save(demo, snapshot.draft, snapshot.baseline, 0);
		expect((await repository.load(demo)).draft.version).toBe(1);
		expect(getClient).not.toHaveBeenCalled();
	});
	it.each([null, {}, { revision: -1, document: null }, { revision: 1, document: null },
		{ ...response(), extra: true }, { revision: 1, document: { ...response().document, selectedSellerId: 'injected' } }])('rejects malformed response %#', async (data) => {
		const repository = createSettingsRepository(() => ({ rpc: vi.fn().mockResolvedValue({ data, error: null }) }));
		await expect(repository.load(context)).rejects.toThrow();
	});
});
describe('finance template v2', () => {
	it.each(['{unknown}', '{{seller_name}}', '{seller_name', '}', '\ufeff', 'a\u0085b', 'a\nb', 'x'.repeat(1001)])('rejects invalid template %#', (value) => {
		expect(() => validateFinancePurposeTemplate(value)).toThrow();
	});
	it('substitutes once, marks missing fields and cannot fabricate a payment ID', () => {
		const text = previewFinancePurpose('{seller_name} {seller_iban} {payment_id}', { seller_name: '{provider_code}', payment_id: 'fake' });
		expect(text).toContain('{provider_code}');
		expect(text).toContain('[не задано: seller_iban]');
		expect(text).toContain('не реальний ID'); expect(text).not.toContain('fake');
	});
	it('supports deliberate v2 edits without mutating legacy data', () => {
		const old = defaultBusinessDraft();
		expect(validateBusinessDraft(old).version).toBe(1);
		expect(validateBusinessDraft({ ...old, version: 2, financePurposeTemplate: '{seller_name}' }).version).toBe(2);
		expect(old).not.toHaveProperty('financePurposeTemplate');
		expect(() => validateBusinessDraft({ ...old, financePurposeTemplate: '{seller_name}' })).toThrow();
	});
	it('enforces UTF16 limits and C1 controls consistently with SQL', () => {
		expect(() => validateBusinessDraft({ ...draft(), financeName: '😀'.repeat(101) })).toThrow();
		expect(() => validateBusinessDraft({ ...draft(), financeName: 'a\u0085b' })).toThrow();
	});
});