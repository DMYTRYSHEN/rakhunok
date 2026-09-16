import { getSupabaseBrowserClient } from '../api/supabase-browser';
import {
	CHECKOUT_CONFIG_BOOLEAN_KEYS,
	CHECKOUT_FLOW_CONTRACT_VERSION,
	isCheckoutFlowId,
	isCheckoutTemplateScenario,
	type CheckoutScenarioConfig
} from '$lib/features/shared/checkout-scenario-config';
import type { CheckoutTemplate, TemplateCreateInput } from '../types';
import {
	FUEL_STATION_FLOW_ID,
	validateFuelStationFlowData
} from '$lib/features/shared/fuel-station-flow';

export type TemplateRepositoryContext = { merchantId: string; demo: boolean };
type RepositoryClient = NonNullable<ReturnType<typeof getSupabaseBrowserClient>>;
type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

const STORAGE_PREFIX = 'corex:checkout-templates:v1:';
const optionalNumberArrays = ['tip_presets', 'quick_amounts'] as const;

function message(cause: unknown, fallback: string) {
	return cause instanceof Error ? cause.message : fallback;
}

function validateConfig(value: unknown): CheckoutScenarioConfig {
	if (!value || typeof value !== 'object' || Array.isArray(value))
		throw new Error('Некоректна конфігурація шаблону.');
	const config = value as Record<string, unknown>;
	for (const key of CHECKOUT_CONFIG_BOOLEAN_KEYS) {
		if (typeof config[key] !== 'boolean') throw new Error(`Некоректне поле конфігурації: ${key}.`);
	}
	for (const key of optionalNumberArrays) {
		if (
			config[key] !== undefined &&
			(!Array.isArray(config[key]) ||
				config[key].length > 12 ||
				config[key].some((item) => typeof item !== 'number' || !Number.isFinite(item) || item < 0))
		) {
			throw new Error(`Некоректне поле конфігурації: ${key}.`);
		}
	}
	if (
		config.promo_discount !== undefined &&
		(typeof config.promo_discount !== 'number' ||
			!Number.isFinite(config.promo_discount) ||
			config.promo_discount < 0)
	) {
		throw new Error('Некоректна знижка шаблону.');
	}
	if (
		config.cta_text !== undefined &&
		(typeof config.cta_text !== 'string' ||
			config.cta_text.trim().length === 0 ||
			config.cta_text.length > 80)
	) {
		throw new Error('Некоректний текст кнопки шаблону.');
	}
	if (config.theme !== undefined && config.theme !== 'dark' && config.theme !== 'light')
		throw new Error('Некоректна тема шаблону.');
	if (config.checkout_flow !== undefined) {
		if (
			!config.checkout_flow ||
			typeof config.checkout_flow !== 'object' ||
			Array.isArray(config.checkout_flow) ||
			!isCheckoutFlowId((config.checkout_flow as Record<string, unknown>).id) ||
			(config.checkout_flow as Record<string, unknown>).version !==
				CHECKOUT_FLOW_CONTRACT_VERSION ||
			((config.checkout_flow as Record<string, unknown>).invoice_type !== undefined &&
				!['fixed', 'open_amount', 'table', 'delivery'].includes(
					(config.checkout_flow as Record<string, unknown>).invoice_type as string
				))
		) {
			throw new Error('Некоректне посилання на сценарій чекауту.');
		}
	}
	if (
		config.flow_data !== undefined &&
		(!config.flow_data || typeof config.flow_data !== 'object' || Array.isArray(config.flow_data))
	) {
		throw new Error('Некоректні дані сценарію чекауту.');
	}
	if ((config.checkout_flow as { id?: unknown } | undefined)?.id === FUEL_STATION_FLOW_ID) {
		validateFuelStationFlowData(config.flow_data, { templateOnly: true });
	}
	return { ...config } as CheckoutScenarioConfig;
}

export function validateTemplateInput(input: TemplateCreateInput): TemplateCreateInput {
	const name = input.name.trim();
	if (!name || name.length > 120)
		throw new Error('Назва шаблону має містити від 1 до 120 символів.');
	if (!isCheckoutFlowId(input.scenario_type)) throw new Error('Непідтримуваний сценарій шаблону.');
	if (typeof input.is_default !== 'boolean')
		throw new Error('Некоректна ознака основного шаблону.');
	const scenarioConfig = validateConfig(input.scenario_config);
	if (
		scenarioConfig.checkout_flow?.id !== undefined &&
		scenarioConfig.checkout_flow.id !== input.scenario_type
	)
		throw new Error('Сценарій шаблону не відповідає сценарію конфігурації.');
	if (
		(input.scenario_type === FUEL_STATION_FLOW_ID ||
			!isCheckoutTemplateScenario(input.scenario_type)) &&
		(!scenarioConfig.checkout_flow || !scenarioConfig.checkout_flow.invoice_type)
	) {
		throw new Error('Для розширеного сценарію не визначено потік чекауту та тип рахунку.');
	}
	return {
		name,
		scenario_type: input.scenario_type,
		scenario_config: scenarioConfig,
		is_default: input.is_default
	};
}

function decodeTemplate(value: unknown, merchantId: string): CheckoutTemplate {
	if (!value || typeof value !== 'object' || Array.isArray(value))
		throw new Error('Некоректна відповідь сховища шаблонів.');
	const row = value as Record<string, unknown>;
	if (
		typeof row.id !== 'string' ||
		row.merchant_id !== merchantId ||
		typeof row.created_at !== 'string' ||
		typeof row.updated_at !== 'string'
	) {
		throw new Error('Некоректна відповідь сховища шаблонів.');
	}
	const input = validateTemplateInput({
		name: row.name as string,
		scenario_type: row.scenario_type as TemplateCreateInput['scenario_type'],
		scenario_config: row.scenario_config as CheckoutScenarioConfig,
		is_default: row.is_default as boolean
	});
	return {
		id: row.id,
		merchant_id: merchantId,
		created_at: row.created_at,
		updated_at: row.updated_at,
		...input
	};
}

function storageKey(merchantId: string) {
	if (!merchantId.trim()) throw new Error('Не визначено бізнес для шаблонів.');
	return `${STORAGE_PREFIX}${merchantId}`;
}

function defaultStorage(): StorageLike | null {
	return typeof window === 'undefined' ? null : window.localStorage;
}

function readDemo(storage: StorageLike | null, merchantId: string): CheckoutTemplate[] {
	if (!storage) throw new Error('Локальне сховище недоступне.');
	const raw = storage.getItem(storageKey(merchantId));
	if (!raw) return [];
	try {
		const value: unknown = JSON.parse(raw);
		if (!Array.isArray(value)) throw new Error();
		const templates = value.map((item) => decodeTemplate(item, merchantId));
		if (templates.filter((item) => item.is_default).length > 1) throw new Error();
		return templates;
	} catch (cause) {
		throw new Error(message(cause, 'Пошкоджено локальне сховище шаблонів.'), { cause });
	}
}

function writeDemo(storage: StorageLike | null, merchantId: string, templates: CheckoutTemplate[]) {
	if (!storage) throw new Error('Локальне сховище недоступне.');
	storage.setItem(storageKey(merchantId), JSON.stringify(templates));
}

export function createTemplateRepository(
	getClient: () => RepositoryClient | null = getSupabaseBrowserClient,
	getStorage: () => StorageLike | null = defaultStorage,
	now: () => Date = () => new Date(),
	createId: () => string = () => crypto.randomUUID()
) {
	function client() {
		const value = getClient();
		if (!value) throw new Error('Supabase не налаштовано.');
		return value;
	}
	async function rpc(
		context: TemplateRepositoryContext,
		name: string,
		args: Record<string, unknown>
	) {
		const { data, error } = await client().rpc(name, {
			p_merchant_id: context.merchantId,
			...args
		});
		if (error?.code === 'PGRST202' || error?.code === '42883')
			throw new Error('Сховище шаблонів ще не оновлено. Потрібна погоджена міграція.');
		if (error?.code === '42501') throw new Error('Немає доступу до шаблонів цього бізнесу.');
		if (error) throw new Error('Не вдалося зберегти шаблон. Перевірте з’єднання та повторіть дію.');
		return data;
	}
	return {
		async list(context: TemplateRepositoryContext): Promise<CheckoutTemplate[]> {
			if (context.demo)
				return readDemo(getStorage(), context.merchantId).sort((left, right) =>
					right.created_at.localeCompare(left.created_at)
				);
			const { data, error } = await client()
				.from('checkout_templates')
				.select('*')
				.eq('merchant_id', context.merchantId)
				.order('created_at', { ascending: false });
			if (error) throw error;
			if (!Array.isArray(data)) throw new Error('Некоректна відповідь сховища шаблонів.');
			return data.map((item) => decodeTemplate(item, context.merchantId));
		},
		async create(
			context: TemplateRepositoryContext,
			value: TemplateCreateInput
		): Promise<CheckoutTemplate> {
			const input = validateTemplateInput(value);
			if (context.demo) {
				const templates = readDemo(getStorage(), context.merchantId);
				const timestamp = now().toISOString();
				const created = {
					id: createId(),
					merchant_id: context.merchantId,
					created_at: timestamp,
					updated_at: timestamp,
					...input
				};
				writeDemo(
					getStorage(),
					context.merchantId,
					input.is_default
						? templates.map((item) => ({ ...item, is_default: false })).concat(created)
						: templates.concat(created)
				);
				return created;
			}
			return decodeTemplate(
				await rpc(context, 'create_checkout_template', { p_input: input }),
				context.merchantId
			);
		},
		async update(
			context: TemplateRepositoryContext,
			id: string,
			value: TemplateCreateInput
		): Promise<CheckoutTemplate> {
			const input = validateTemplateInput(value);
			if (context.demo) {
				const templates = readDemo(getStorage(), context.merchantId);
				const existing = templates.find((item) => item.id === id);
				if (!existing) throw new Error('Шаблон не знайдено.');
				const updated = { ...existing, ...input, updated_at: now().toISOString() };
				writeDemo(
					getStorage(),
					context.merchantId,
					templates.map((item) =>
						item.id === id ? updated : input.is_default ? { ...item, is_default: false } : item
					)
				);
				return updated;
			}
			return decodeTemplate(
				await rpc(context, 'update_checkout_template', { p_template_id: id, p_input: input }),
				context.merchantId
			);
		},
		async remove(context: TemplateRepositoryContext, id: string): Promise<void> {
			if (context.demo) {
				const templates = readDemo(getStorage(), context.merchantId);
				if (!templates.some((item) => item.id === id)) throw new Error('Шаблон не знайдено.');
				writeDemo(
					getStorage(),
					context.merchantId,
					templates.filter((item) => item.id !== id)
				);
				return;
			}
			await rpc(context, 'delete_checkout_template', { p_template_id: id });
		},
		async setDefault(context: TemplateRepositoryContext, id: string): Promise<void> {
			if (context.demo) {
				const templates = readDemo(getStorage(), context.merchantId);
				if (!templates.some((item) => item.id === id)) throw new Error('Шаблон не знайдено.');
				writeDemo(
					getStorage(),
					context.merchantId,
					templates.map((item) => ({
						...item,
						is_default: item.id === id,
						updated_at: item.id === id ? now().toISOString() : item.updated_at
					}))
				);
				return;
			}
			await rpc(context, 'set_checkout_template_default', { p_template_id: id });
		}
	};
}

const repository = createTemplateRepository();
export const listTemplates = (merchantId: string, demo = false) =>
	repository.list({ merchantId, demo });
export const createTemplate = (merchantId: string, input: TemplateCreateInput, demo = false) =>
	repository.create({ merchantId, demo }, input);
export const updateTemplate = (
	merchantId: string,
	id: string,
	input: TemplateCreateInput,
	demo = false
) => repository.update({ merchantId, demo }, id, input);
export const deleteTemplate = (merchantId: string, id: string, demo = false) =>
	repository.remove({ merchantId, demo }, id);
export const setDefaultTemplate = (merchantId: string, id: string, demo = false) =>
	repository.setDefault({ merchantId, demo }, id);
