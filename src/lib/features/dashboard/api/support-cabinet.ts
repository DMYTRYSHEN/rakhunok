import type { DashboardGateway } from './dashboard-gateway';
import { decodeTemplate, validateTemplateInput, type TemplateRepository, type TemplateRepositoryContext } from '../templates/template-repository';
import type { TemplateCreateInput } from '../types';
import { defaultBusinessDraft, validateBusinessDraft, type BusinessDraft } from '../business-settings/business-settings';
import { defaultFinancePurposeTemplate } from '../business-settings/finance-purpose';
import { SettingsConflictError, type SettingsContext, type SettingsSnapshot } from '../business-settings/settings-repository';
import type { BusinessStructureData, DashboardSessionState, DashboardUser, InvoiceRecord, OverviewSnapshot, PersistedInvoiceType } from '../types';

export type SupportContext = {
	id: string;
	targetId: string;
	merchantId: string;
	workspace: 'sandbox' | 'live';
	expiresAt: string;
};

type SupportSnapshot = {
	merchant: { id: string; name: string };
	settings?: { revision: number; document: unknown };
	templates?: unknown;
	structure?: unknown;
	invoiceCreation?: Partial<Record<PersistedInvoiceType, boolean>>;
	tableTtl: { effectiveSeconds: number };
	invoices: { id: string; number: string; title: string | null; status: string; amount: number; type: string; currency: string; createdAt: string; expiresAt: string | null; detail?: unknown }[];
};

type SupportTransport = <Result>(action: string, input?: Record<string, unknown>) => Promise<Result>;

export type SupportSettingsConfirmation = {
	context: SupportContext;
	previousSeconds: number | null;
	nextSeconds: number;
};

export type SupportStructureConfirmation = {
	context: SupportContext;
	action: string;
	fields: Record<string, unknown>;
};

export type SupportInvoiceReceipt = {
	id: string;
	reference: string;
	amount: number;
	shortId: string;
	recipientName: string;
	recipientIban: string;
	recipientTaxId: string;
	purpose: string;
};

export const SUPPORT_CABINET_MARKER = 'rahunok_support_cabinet';

export function createSupportCabinet(
	rpc: SupportTransport,
	actor: DashboardUser,
	now: () => number = Date.now,
	confirmSettings?: (change: SupportSettingsConfirmation) => Promise<boolean>,
	confirmStructure?: (change: SupportStructureConfirmation) => Promise<boolean>
) {
	let context: SupportContext | null = null;
	let closed = false;
	let generation = 0;
	let savingSettings = false;

	function deny(): never {
		throw new Error('Ця дія недоступна в режимі підтримки.');
	}

	function parseStructure(value: unknown): BusinessStructureData {
		if (!value || typeof value !== 'object') deny();
		const structure = value as Record<string, unknown>;
		if (!Array.isArray(structure.entities) || !Array.isArray(structure.terminals)) deny();
		const entityIds = new Set<string>();
		const terminalIds = new Set<string>();
		for (const entity of structure.entities) {
			if (!entity || typeof entity !== 'object' ||
				!['id', 'businessName', 'displayName', 'taxId', 'bankName', 'iban'].every((key) => typeof entity[key] === 'string') ||
				!entity.id || entityIds.has(entity.id) ||
				!['fop', 'tov', 'self_employed', 'ngo'].includes(entity.businessType) ||
				typeof entity.isActive !== 'boolean' ||
				!['phone', 'contactEmail', 'website'].every((key) => entity[key] === undefined || typeof entity[key] === 'string')) deny();
			entityIds.add(entity.id);
		}
		for (const terminal of structure.terminals) {
			if (!terminal || typeof terminal !== 'object' ||
				!['id', 'name', 'code'].every((key) => typeof terminal[key] === 'string') ||
				!terminal.id || terminalIds.has(terminal.id) ||
				(terminal.entityId !== null && (typeof terminal.entityId !== 'string' || !entityIds.has(terminal.entityId))) ||
				!['table', 'kasa', 'dynamic_qr', 'nfc_tag', 'courier'].includes(terminal.type) ||
				typeof terminal.isActive !== 'boolean') deny();
			terminalIds.add(terminal.id);
		}
		return {
			entities: structure.entities as BusinessStructureData['entities'],
			terminals: structure.terminals.map((terminal) => ({ ...terminal, entityId: terminal.entityId ?? '' }))
		};
	}

	function assertContext(value: SupportContext | null) {
		if (closed || !value || !value.id || !value.targetId || value.targetId === actor.id ||
			!value.merchantId || !['sandbox', 'live'].includes(value.workspace) ||
			!Number.isFinite(Date.parse(value.expiresAt)) || Date.parse(value.expiresAt) <= now()) {
			throw new Error('Доступ до кабінету клієнта завершено.');
		}
	}

	async function snapshot() {
		assertContext(context);
		const expected = context!;
		const version = generation;
		const result = await rpc<{ context: SupportContext; data: SupportSnapshot }>('snapshot', { sessionId: expected.id });
		assertContext(result.context);
		if (version !== generation || result.context.id !== expected.id ||
			result.context.targetId !== expected.targetId || result.context.merchantId !== expected.merchantId ||
			result.context.workspace !== expected.workspace || result.context.expiresAt !== expected.expiresAt ||
			result.data?.merchant?.id !== expected.merchantId || typeof result.data.merchant.name !== 'string' ||
			!Number.isFinite(result.data.tableTtl?.effectiveSeconds) || !Array.isArray(result.data.invoices)) {
			throw new Error('Контекст кабінету клієнта змінився.');
		}
		return result.data;
	}

	function overview(data: SupportSnapshot): OverviewSnapshot {
		return {
			merchantName: data.merchant.name,
			metrics: [],
			recentInvoices: data.invoices.map((invoice) => ({
				id: invoice.id, reference: invoice.number, title: invoice.title || invoice.number,
				amount: Number(invoice.amount) || 0, createdAt: invoice.createdAt,
				status: invoice.status === 'paid' || invoice.status === 'completed' ? 'paid' :
					invoice.status === 'cancelled' || invoice.status === 'expired' ? 'cancelled' :
						invoice.status === 'failed' ? 'failed' : 'pending',
				channel: invoice.type === 'table' ? 'POS' : invoice.type === 'delivery' ? 'Link' : 'QR'
			}))
		};
	}

	function sameValue(left: unknown, right: unknown): boolean {
		if (left === right) return true;
		if (!left || !right || typeof left !== 'object' || typeof right !== 'object' || Array.isArray(left) !== Array.isArray(right)) return false;
		const entries = Object.entries(left);
		return entries.length === Object.keys(right).length && entries.every(([key, value]) =>
			Object.hasOwn(right, key) && sameValue(value, (right as Record<string, unknown>)[key]));
	}

	let createdInvoice: SupportInvoiceReceipt | null = null;

	async function mutateStructure(action: string, fields: Record<string, unknown>) {
		assertContext(context);
		if (!confirmStructure || savingSettings) deny();
		const expected = { ...context! };
		const version = generation;
		const check = () => {
			assertContext(context);
			if (version !== generation || context!.id !== expected.id) deny();
		};
		savingSettings = true;
		try {
			await rpc('elevate', { sessionId: expected.id });
			check();
			const prepared = await rpc<{
				operationId: string; digest: string; expiresAt: string; payload: Record<string, unknown>;
			}>('prepare', { sessionId: expected.id, action, fields });
			check();
			const payload = prepared?.payload;
			const canonicalFields = payload?.fields;
			if (typeof prepared?.operationId !== 'string' || !prepared.operationId ||
				!/^[a-f0-9]{64}$/.test(prepared.digest) ||
				!Number.isFinite(Date.parse(prepared.expiresAt)) || Date.parse(prepared.expiresAt) <= now() ||
				Date.parse(prepared.expiresAt) > Date.parse(expected.expiresAt) ||
				payload?.action !== action || payload.contextId !== expected.id || payload.workspace !== expected.workspace ||
				payload.actorId !== actor.id || payload.targetId !== expected.targetId || payload.merchantId !== expected.merchantId ||
				!canonicalFields || typeof canonicalFields !== 'object' || Array.isArray(canonicalFields) ||
				Object.keys(canonicalFields).length !== Object.keys(fields).length ||
				!sameValue(canonicalFields, fields)) deny();
			if (!await confirmStructure({ context: expected, action, fields: { ...fields } })) {
				check();
				await rpc('cancel', { sessionId: expected.id, operationId: prepared.operationId });
				check();
				throw new Error('Зміну скасовано.');
			}
			check();
			if (Date.parse(prepared.expiresAt) <= now()) deny();
			let result: { committed: boolean; operationId: string; action: string; invoice?: SupportInvoiceReceipt; settings?: unknown; template?: unknown };
			try {
				result = await rpc('commit', { sessionId: expected.id, operationId: prepared.operationId,
					digest: prepared.digest, acknowledgement: expected.workspace === 'live' ? 'CHANGE_LIVE_BUSINESS' : 'CHANGE_SANDBOX' });
			} catch (error) {
				check();
				const recovered = await rpc<{ operation: { operationId: string; digest: string; state: string; result: typeof result } | null }>(
					'operation', { sessionId: expected.id, operationId: prepared.operationId });
				check();
				if (recovered.operation?.operationId !== prepared.operationId || recovered.operation.digest !== prepared.digest ||
					recovered.operation.state !== 'committed') throw error;
				result = recovered.operation.result;
			}
			check();
			if (result?.committed !== true || result.operationId !== prepared.operationId || result.action !== action) deny();
			return result;
		} finally { savingSettings = false; }
	}

	function assertActor(userId: string) {
		assertContext(context);
		if (userId !== actor.id) deny();
	}

	async function readInvoices(merchantId: string, detailId?: string) {
			assertContext(context);
			if (merchantId !== context!.merchantId) deny();
			const data = await snapshot();
			const ids = new Set<string>();
			return data.invoices.map((invoice): InvoiceRecord => {
				if (!invoice || typeof invoice.id !== 'string' || !invoice.id || ids.has(invoice.id) ||
					typeof invoice.number !== 'string' || (invoice.title !== null && typeof invoice.title !== 'string') ||
					!['fixed', 'open_amount', 'table', 'delivery'].includes(invoice.type) ||
					!['draft', 'pending', 'preparing', 'ready', 'paid', 'completed', 'expired', 'cancelled', 'failed'].includes(invoice.status) ||
					!Number.isFinite(invoice.amount) || invoice.amount < 0 || typeof invoice.currency !== 'string' ||
					!Number.isFinite(Date.parse(invoice.createdAt)) ||
					(invoice.expiresAt !== null && !Number.isFinite(Date.parse(invoice.expiresAt)))) deny();
				ids.add(invoice.id);
				const record: InvoiceRecord = {
					...overview({ ...data, invoices: [invoice] }).recentInvoices[0],
					type: invoice.type as PersistedInvoiceType,
					lifecycleStatus: (invoice.status === 'completed' ? 'paid' : invoice.status) as InvoiceRecord['lifecycleStatus'],
					currency: invoice.currency, expiresAt: invoice.expiresAt,
					shortId: null, description: null, baseAmount: invoice.amount, discountAmount: 0, deliveryFee: 0,
					tableNumber: null, terminalId: null, paidAt: null, paidBankCode: null
				};
				if (invoice.id !== detailId) return record;
				if (!invoice.detail || typeof invoice.detail !== 'object' || Array.isArray(invoice.detail)) {
					throw new Error('Деталі рахунку ще недоступні. Оновіть доступ після активації серверного читання.');
				}
				const detail = invoice.detail as Record<string, unknown>;
				if (!['description', 'shortId', 'terminalId', 'terminalCode', 'paidBankCode'].every((key) =>
					detail[key] === null || typeof detail[key] === 'string') ||
					(detail.shortId !== null && !/^(?:[a-zA-Z0-9]{6}|[a-zA-Z0-9]{12})$/.test(detail.shortId as string)) ||
					!['baseAmount', 'discountAmount', 'deliveryFee'].every((key) =>
						typeof detail[key] === 'number' && Number.isFinite(detail[key]) && detail[key] >= 0) ||
					(detail.tableNumber !== null && (!Number.isSafeInteger(detail.tableNumber) || Number(detail.tableNumber) <= 0)) ||
					(detail.paidAt !== null && (typeof detail.paidAt !== 'string' || !Number.isFinite(Date.parse(detail.paidAt))))) deny();
				return { ...record, shortId: detail.shortId as string | null, description: detail.description as string | null,
					baseAmount: detail.baseAmount as number, discountAmount: detail.discountAmount as number,
					deliveryFee: detail.deliveryFee as number, tableNumber: detail.tableNumber as number | null,
					terminalId: detail.terminalId as string | null, paidAt: detail.paidAt as string | null,
					terminalCode: detail.terminalCode as string | null,
					paidBankCode: detail.paidBankCode as string | null };
			});
	}

	const methods: Partial<DashboardGateway> = {
		listInvoices: (merchantId) => readInvoices(merchantId),
		async getInvoice(merchantId, invoiceId) {
			if (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(invoiceId)) deny();
			return (await readInvoices(merchantId, invoiceId)).find((invoice) => invoice.id === invoiceId) ?? null;
		},
		async createInvoice(input) {
			assertContext(context);
			const deliveryFee = input?.deliveryFee ?? 0;
			const total = Math.round((input?.amount + deliveryFee) * 100) / 100;
			if (!input || input.merchantId !== context!.merchantId || context!.workspace !== 'live' ||
				!['fixed', 'open_amount', 'table', 'delivery'].includes(input.type) || !input.entityId ||
				!Number.isFinite(input.amount) || input.amount < 0 || !Number.isFinite(deliveryFee) || deliveryFee < 0 ||
				(input.type !== 'open_amount' && total <= 0) || (input.type !== 'delivery' && deliveryFee !== 0) ||
				(input.type !== 'table' && (input.terminalId != null || input.tableNumber != null)) ||
				(input.type === 'table' && (!input.terminalId || !Number.isSafeInteger(input.tableNumber) || input.tableNumber! <= 0))) deny();
			createdInvoice = null;
			const fields = {
				entityId: input.entityId, title: input.title, description: input.description ?? '',
				amount: input.amount, scenarioConfig: input.scenario_config ?? {}
			};
			const result = await mutateStructure(input.type === 'fixed' ? 'invoice.fixed.create' : 'invoice.create',
				input.type === 'fixed' ? fields : { ...fields, type: input.type, deliveryFee,
					terminalId: input.terminalId ?? null, tableNumber: input.tableNumber ?? null });
			const invoice = result.invoice;
			if (!invoice || !['id', 'reference', 'shortId', 'recipientName', 'recipientIban', 'recipientTaxId', 'purpose']
				.every((key) => typeof invoice[key as keyof SupportInvoiceReceipt] === 'string' && invoice[key as keyof SupportInvoiceReceipt]) ||
				invoice.amount !== total || !/^(?:[a-zA-Z0-9]{6}|[a-zA-Z0-9]{12})$/.test(invoice.shortId)) deny();
			createdInvoice = { ...invoice };
			return { id: invoice.id };
		},
		async restore(): Promise<DashboardSessionState> {
			if (closed) deny();
			const version = ++generation;
			const result = await rpc<{ actorId: string; context: SupportContext | null }>('bootstrap');
			if (closed || version !== generation || result.actorId !== actor.id) deny();
			assertContext(result.context);
			if (context && (context.id !== result.context!.id || context.targetId !== result.context!.targetId ||
				context.merchantId !== result.context!.merchantId || context.workspace !== result.context!.workspace ||
				context.expiresAt !== result.context!.expiresAt)) deny();
			context = result.context;
			const data = await snapshot();
			return {
				status: 'ready', user: actor, support: { ...context! },
				merchant: { id: context!.merchantId, userId: context!.targetId, businessName: data.merchant.name, displayName: data.merchant.name },
				snapshot: overview(data)
			};
		},
		async getOverview(userId, merchant) {
			assertContext(context);
			if (userId !== actor.id || merchant.id !== context!.merchantId || merchant.userId !== context!.targetId) deny();
			return overview(await snapshot());
		},
		async getMerchantSettings(merchantId) {
			assertContext(context);
			if (merchantId !== context!.merchantId) deny();
			return { tableOrderTtlSeconds: (await snapshot()).tableTtl.effectiveSeconds };
		},
		async saveMerchantSettings(merchantId, settings) {
			assertContext(context);
			if (merchantId !== context!.merchantId || !confirmSettings || savingSettings ||
				!settings || Object.keys(settings).some((key) => key !== 'tableOrderTtlSeconds') ||
				![1800, 3600, 7200, 18000].includes(settings.tableOrderTtlSeconds)) deny();
			const expected = { ...context! };
			const version = generation;
			const check = () => {
				assertContext(context);
				if (version !== generation || context!.id !== expected.id) deny();
			};
			savingSettings = true;
			try {
				await rpc('elevate', { sessionId: expected.id });
				check();
				const prepared = await rpc<{
					operationId: string; digest: string; expiresAt: string;
					payload: Record<string, unknown>;
				}>('prepare', { sessionId: expected.id, action: 'settings.table_ttl', nextSeconds: settings.tableOrderTtlSeconds });
				check();
				const payload = prepared?.payload;
				if (!prepared?.operationId || typeof prepared.operationId !== 'string' ||
					!/^\w{64}$/.test(prepared.digest) || !/^[a-f0-9]+$/.test(prepared.digest) ||
					!Number.isFinite(Date.parse(prepared.expiresAt)) || Date.parse(prepared.expiresAt) <= now() ||
					Date.parse(prepared.expiresAt) > Date.parse(expected.expiresAt) ||
					!payload || payload.action !== 'settings.table_ttl' || payload.contextId !== expected.id ||
					payload.workspace !== expected.workspace || payload.actorId !== actor.id ||
					payload.targetId !== expected.targetId || payload.merchantId !== expected.merchantId ||
					payload.nextSeconds !== settings.tableOrderTtlSeconds ||
					(payload.previousSeconds !== null &&
						(typeof payload.previousSeconds !== 'number' || !Number.isInteger(payload.previousSeconds) || payload.previousSeconds <= 0))) deny();
				const approved = await confirmSettings({ context: expected,
					previousSeconds: payload.previousSeconds as number | null, nextSeconds: settings.tableOrderTtlSeconds });
				check();
				if (!approved) {
					await rpc('cancel', { sessionId: expected.id, operationId: prepared.operationId });
					check();
					throw new Error('Зміну скасовано.');
				}
				if (Date.parse(prepared.expiresAt) <= now()) deny();
				let result: { committed: boolean; operationId: string; tableOrderTtlSeconds: number };
				try {
					result = await rpc('commit', { sessionId: expected.id, operationId: prepared.operationId,
						digest: prepared.digest, acknowledgement: expected.workspace === 'live' ? 'CHANGE_LIVE_BUSINESS' : 'CHANGE_SANDBOX' });
				} catch (error) {
					check();
					const recovered = await rpc<{ operation: { operationId: string; digest: string; state: string; result: typeof result } | null }>(
						'operation', { sessionId: expected.id, operationId: prepared.operationId });
					check();
					if (recovered.operation?.operationId !== prepared.operationId || recovered.operation.digest !== prepared.digest ||
						recovered.operation.state !== 'committed') throw error;
					result = recovered.operation.result;
				}
				check();
				if (result?.committed !== true || result.operationId !== prepared.operationId ||
					result.tableOrderTtlSeconds !== settings.tableOrderTtlSeconds) deny();
			} finally { savingSettings = false; }
		},
		async getBusinessStructure(userId) {
			assertContext(context);
			if (userId !== actor.id) deny();
			const { structure } = await snapshot();
			return parseStructure(structure);
		},
		async updateMerchantName(merchantId, name) {
			assertContext(context);
			if (merchantId !== context!.merchantId) deny();
			await mutateStructure('structure.merchant.rename', { businessName: name });
		},
		async createBusinessEntity(userId, input) {
			assertActor(userId);
			await mutateStructure('structure.entity.create', { ...input });
		},
		async updateBusinessEntity(userId, entityId, input) {
			assertActor(userId);
			await mutateStructure('structure.entity.update', { ...input, id: entityId });
		},
		async deleteBusinessEntity(userId, entityId) {
			assertActor(userId);
			await mutateStructure('structure.entity.delete', { id: entityId });
		},
		async createTerminal(userId, input) {
			assertActor(userId);
			await mutateStructure('structure.terminal.create', { ...input });
		},
		async updateTerminal(userId, terminalId, input) {
			assertActor(userId);
			await mutateStructure('structure.terminal.update', { ...input, id: terminalId });
		},
		async deleteTerminal(userId, terminalId) {
			assertActor(userId);
			await mutateStructure('structure.terminal.delete', { id: terminalId });
		},
		subscribeDashboardUpdates: () => () => {},
		subscribeAuthChanges: () => () => {}
	};

	function decodeSettings(value: unknown): SettingsSnapshot {
		if (!value || typeof value !== 'object' || Array.isArray(value)) deny();
		const settings = value as Record<string, unknown>;
		if (Object.keys(settings).length !== 2 || !Object.hasOwn(settings, 'document') ||
			!Number.isSafeInteger(settings.revision) || Number(settings.revision) < 0) deny();
		if (settings.revision === 0 && settings.document === null) {
			return { draft: validateBusinessDraft({ ...defaultBusinessDraft(), version: 2,
				financePurposeTemplate: defaultFinancePurposeTemplate }), baseline: null, revision: 0 };
		}
		if (!settings.document || typeof settings.document !== 'object' || Array.isArray(settings.document) ||
			settings.revision === 0 || Object.hasOwn(settings.document, 'selectedSellerId') ||
			(settings.document as Record<string, unknown>).version !== 2) deny();
		return { draft: validateBusinessDraft({ ...settings.document, selectedSellerId: '' }),
			baseline: null, revision: Number(settings.revision) };
	}

	function assertSettingsScope(scope: SettingsContext) {
		assertActor(scope.userId);
		if (scope.demo || scope.merchantId !== context!.merchantId) deny();
	}

	const settingsRepository = {
		async load(scope: SettingsContext): Promise<SettingsSnapshot> {
			assertSettingsScope(scope);
			return decodeSettings((await snapshot()).settings);
		},
		async save(scope: SettingsContext, draft: BusinessDraft, baseline: string | null, revision: number): Promise<SettingsSnapshot> {
			assertSettingsScope(scope);
			if (baseline !== null || !Number.isSafeInteger(revision) || revision < 0 || revision >= 2147483647) deny();
			const { selectedSellerId: _selection, ...document } = validateBusinessDraft({ ...validateBusinessDraft(draft),
				version: 2, financePurposeTemplate: draft.financePurposeTemplate ?? defaultFinancePurposeTemplate });
			const current = decodeSettings((await snapshot()).settings);
			if (current.revision !== revision) throw new SettingsConflictError();
			const result = await mutateStructure('settings.business.save', { document, revision });
			const saved = decodeSettings(result.settings);
			const { selectedSellerId: _savedSelection, ...savedDocument } = saved.draft;
			if (saved.revision !== revision + 1 || !sameValue(savedDocument, document)) deny();
			return saved;
		}
	};

	let templateBaseline: { contextId: string; rows: unknown[] } | null = null;
	function assertTemplateScope(scope: TemplateRepositoryContext) {
		assertContext(context);
		if (scope.demo || scope.merchantId !== context!.merchantId) deny();
	}
	async function changeTemplate(scope: TemplateRepositoryContext, action: string, id: string | null, input: TemplateCreateInput | null) {
		assertTemplateScope(scope);
		if (!templateBaseline || templateBaseline.contextId !== context!.id) deny();
		if (id !== null && !templateBaseline.rows.some((row) => (row as { id: string }).id === id)) deny();
		const result = await mutateStructure(action, { id, input, before: templateBaseline.rows });
		templateBaseline = null;
		if (input) {
			const saved = decodeTemplate(result.template, scope.merchantId);
			if ((id !== null && saved.id !== id) || !sameValue(validateTemplateInput(saved), input)) deny();
			return saved;
		}
		return null;
	}
	const templateRepository: TemplateRepository = {
		async list(scope) {
			assertTemplateScope(scope);
			templateBaseline = null;
			const data = await snapshot();
			if (!Array.isArray(data.templates)) deny();
			const rows = data.templates.map((row) => decodeTemplate(row, scope.merchantId));
			if (new Set(rows.map((row) => row.id)).size !== rows.length || rows.filter((row) => row.is_default).length > 1) deny();
			templateBaseline = { contextId: context!.id, rows: structuredClone(data.templates) };
			return rows;
		},
		async create(scope, input) {
			assertTemplateScope(scope);
			return (await changeTemplate(scope, 'templates.create', null, validateTemplateInput(input)))!;
		},
		async update(scope, id, input) {
			assertTemplateScope(scope);
			return (await changeTemplate(scope, 'templates.update', id, validateTemplateInput(input)))!;
		},
		async remove(scope, id) { await changeTemplate(scope, 'templates.delete', id, null); },
		async setDefault(scope, id) { await changeTemplate(scope, 'templates.default', id, null); }
	};

	return {
		settingsRepository,
		templateRepository,
		async getInvoiceSettings() {
			const data = await snapshot();
			if (!data.settings || !Number.isSafeInteger(data.settings.revision) || data.settings.revision < 1 ||
				!data.settings.document || typeof data.settings.document !== 'object') deny();
			return validateBusinessDraft({ ...data.settings.document, selectedSellerId: '' });
		},
		async canCreateFixedInvoice() { return (await snapshot()).invoiceCreation?.fixed === true; },
		async getInvoiceScenarios() {
			const data = await snapshot();
			return (['fixed', 'open_amount', 'table', 'delivery'] as const).filter((type) => data.invoiceCreation?.[type] === true);
		},
		getCreatedInvoice() { assertContext(context); return createdInvoice ? { ...createdInvoice } : null; },
		async getInvoiceCreateStructure() {
			const data = await snapshot();
			return data.structure === undefined ? null : parseStructure(data.structure);
		},
		gateway: new Proxy(methods, { get: (target, key) => Reflect.get(target, key) ?? deny }) as DashboardGateway,
		dispose() { closed = true; generation += 1; createdInvoice = null; },
		async end() {
			closed = true;
			generation += 1;
			if (!context) return;
			const result = await rpc<{ ended: boolean }>('end', { sessionId: context.id });
			if (result.ended !== true) throw new Error('Завершення доступу не підтверджено. Повторіть вихід.');
		}
	};
}