import { getSupabaseBrowserClient } from '../api/supabase-browser';
import { defaultFinancePurposeTemplate } from './finance-purpose';
import { businessDraftScope, defaultBusinessDraft, loadBusinessDraftSnapshot, saveBusinessDraft,
	validateBusinessDraft, type BusinessDraft } from './business-settings';

export type SettingsContext = { userId: string; merchantId: string; demo: boolean };
export type SettingsSnapshot = { draft: BusinessDraft; baseline: string | null; revision: number };
type RpcClient = { rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { code?: string } | null }> };
export class SettingsConflictError extends Error {
	constructor() { super('Налаштування вже змінено. Ваші правки збережено на екрані; завантажте актуальну версію перед повторним записом.'); }
}
function upgrade(draft: BusinessDraft): BusinessDraft {
	return validateBusinessDraft({ ...draft, version: 2,
		financePurposeTemplate: draft.financePurposeTemplate ?? defaultFinancePurposeTemplate });
}
function decode(data: unknown): SettingsSnapshot {
	if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Некоректна відповідь сховища.');
	const value = data as Record<string, unknown>;
	if (Object.keys(value).length !== 2 || !Object.hasOwn(value, 'document') ||
		!Number.isSafeInteger(value.revision) || Number(value.revision) < 0) throw new Error('Некоректна версія налаштувань.');
	if (value.document === null && value.revision === 0) return { draft: upgrade(defaultBusinessDraft()), baseline: null, revision: 0 };
	if (!value.document || typeof value.document !== 'object' || Array.isArray(value.document) || value.revision === 0 ||
		Object.hasOwn(value.document, 'selectedSellerId') || (value.document as Record<string, unknown>).version !== 2) throw new Error('Некоректний документ налаштувань.');
	return { draft: validateBusinessDraft({ ...value.document, selectedSellerId: '' }), baseline: null, revision: Number(value.revision) };
}
export function createSettingsRepository(getClient: () => RpcClient | null = getSupabaseBrowserClient) {
	async function rpc(context: SettingsContext, name: string, args: Record<string, unknown>) {
		businessDraftScope(context.userId, context.merchantId, context.demo);
		const client = getClient();
		if (!client) throw new Error('Supabase не налаштовано. Локальне сховище не замінює базу даних.');
		const { data, error } = await client.rpc(name, { p_merchant_id: context.merchantId, ...args });
		if (error?.code === '40001') throw new SettingsConflictError();
		if (error?.code === 'PGRST202' || error?.code === '42883') throw new Error('Сховище налаштувань ще не встановлено в цій базі. Потрібне окреме погодження міграції; локальні чернетки не імпортовано.');
		if (error?.code === '42501') throw new Error('Немає доступу до налаштувань цього бізнесу або продавця.');
		if (error) throw new Error('Не вдалося виконати операцію з налаштуваннями. Перевірте з’єднання та права; не повторюйте запис без оновлення версії.');
		return decode(data);
	}
	return {
		async load(context: SettingsContext): Promise<SettingsSnapshot> {
			if (context.demo) return { ...loadBusinessDraftSnapshot(businessDraftScope(context.userId, context.merchantId, true)), revision: 0 };
			return rpc(context, 'read_business_settings', {});
		},
		async save(context: SettingsContext, draft: BusinessDraft, baseline: string | null, revision: number): Promise<SettingsSnapshot> {
			const checked = validateBusinessDraft(draft);
			if (context.demo) return { draft: checked, baseline: saveBusinessDraft(businessDraftScope(context.userId, context.merchantId, true), checked, baseline), revision: 0 };
			if (!Number.isSafeInteger(revision) || revision < 0) throw new Error('Некоректна версія для збереження.');
			const { selectedSellerId: _selection, ...document } = upgrade(checked);
			return rpc(context, 'save_business_settings', { p_expected_revision: revision, p_document: document });
		}
	};
}