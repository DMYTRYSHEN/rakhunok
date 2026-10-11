import { describe, expect, it, vi } from 'vitest';
import { createSupportCabinet } from './support-cabinet';
import { defaultBusinessDraft } from '../business-settings/business-settings';
import { defaultFinancePurposeTemplate } from '../business-settings/finance-purpose';
import { getScenarioDefaults } from '$lib/features/shared/checkout-scenario-defaults';

const actor = { id: 'admin', email: null, fullName: null };
const context = { id: 'context', targetId: 'customer', merchantId: 'merchant', workspace: 'live' as const, expiresAt: '2030-01-01T00:00:00Z' };
const data = { merchant: { id: 'merchant', name: 'Customer business' }, tableTtl: { effectiveSeconds: 1800 }, invoices: [] };
const entity = { id: 'entity', businessType: 'fop', businessName: 'Business', displayName: 'Shop', taxId: '123', bankName: 'Bank', iban: 'UA_TEST', isActive: true };
const terminal = { id: 'terminal', name: 'Desk', code: 'DESK', type: 'kasa', entityId: entity.id, isActive: true };

function fixture(confirmSettings?: Parameters<typeof createSupportCabinet>[3], confirmStructure?: Parameters<typeof createSupportCabinet>[4]) {
	const rpc = vi.fn(async (action: string) => {
		if (action === 'bootstrap') return { actorId: actor.id, context };
		if (action === 'snapshot') return { context, data };
		return { ended: true };
	});
	const cabinet = createSupportCabinet(rpc as Parameters<typeof createSupportCabinet>[0], actor, () => Date.parse('2026-10-05'), confirmSettings, confirmStructure);
	return { rpc, cabinet };
}

describe('support cabinet isolation', () => {
	it('binds template reads and confirmed mutations to the selected customer without owner APIs', async () => {
		const { cabinet, rpc } = fixture(undefined, async () => true);
		await cabinet.gateway.restore();
		const scope = { merchantId: context.merchantId, demo: false };
		const input = { name: 'Customer', scenario_type: 'fixed' as const, scenario_config: getScenarioDefaults('fixed'), is_default: true };
		const row = { ...input, id: 'template', merchant_id: context.merchantId, created_at: '2026-10-05', updated_at: '2026-10-05' };
		rpc.mockClear();
		await expect(cabinet.templateRepository.list({ ...scope, demo: true })).rejects.toThrow();
		await expect(cabinet.templateRepository.list({ ...scope, merchantId: 'other' })).rejects.toThrow();
		await expect(cabinet.templateRepository.create(scope, input)).rejects.toThrow();
		expect(rpc).not.toHaveBeenCalled();
		for (const action of ['templates.create', 'templates.update', 'templates.delete', 'templates.default']) {
			rpc.mockResolvedValueOnce({ context, data: { ...data, templates: [row] } } as never);
			expect(await cabinet.templateRepository.list(scope)).toEqual([row]);
			const fields = { id: action === 'templates.create' ? null : row.id,
				input: ['templates.create', 'templates.update'].includes(action) ? input : null, before: [row] };
			const prepared = { operationId: 'operation', digest: 'a'.repeat(64), expiresAt: '2026-10-05T00:02:00Z',
				payload: { action, contextId: context.id, workspace: context.workspace, actorId: actor.id,
					targetId: context.targetId, merchantId: context.merchantId, fields } };
			rpc.mockResolvedValueOnce({} as never).mockResolvedValueOnce(prepared as never)
				.mockRejectedValueOnce(new Error('Lost response')).mockResolvedValueOnce({ operation: {
					operationId: prepared.operationId, digest: prepared.digest, state: 'committed',
					result: { committed: true, operationId: prepared.operationId, action, template: fields.input ? row : null }
				} } as never);
			if (action === 'templates.create') expect(await cabinet.templateRepository.create(scope, input)).toEqual(row);
			if (action === 'templates.update') expect(await cabinet.templateRepository.update(scope, row.id, input)).toEqual(row);
			if (action === 'templates.delete') await cabinet.templateRepository.remove(scope, row.id);
			if (action === 'templates.default') await cabinet.templateRepository.setDefault(scope, row.id);
			expect(rpc).toHaveBeenCalledWith('prepare', { sessionId: context.id, action, fields });
			await expect(cabinet.templateRepository.remove(scope, row.id)).rejects.toThrow();
		}
		for (const templates of [undefined, [{ ...row, merchant_id: 'foreign' }], [row, row]]) {
			rpc.mockResolvedValueOnce({ context, data: { ...data, templates } } as never);
			await expect(cabinet.templateRepository.list(scope)).rejects.toThrow();
		}
		cabinet.dispose();
		await expect(cabinet.templateRepository.list(scope)).rejects.toThrow();
	});
	it('loads and saves customer settings through confirmed support operations only', async () => {
		const approve = vi.fn(async () => true);
		const { cabinet, rpc } = fixture(undefined, approve);
		await cabinet.gateway.restore();
		const scope = { userId: actor.id, merchantId: context.merchantId, demo: false };
		const draft = { ...defaultBusinessDraft(), version: 2 as const, financePurposeTemplate: defaultFinancePurposeTemplate };
		const { selectedSellerId: _selection, ...document } = draft;
		const settings = { revision: 2, document };
		rpc.mockResolvedValueOnce({ context, data: { ...data, settings } } as never);
		expect(await cabinet.settingsRepository.load(scope)).toEqual({ draft, baseline: null, revision: 2 });
		const fields = { revision: 2, document };
		const prepared = { operationId: 'operation', digest: 'a'.repeat(64), expiresAt: '2026-10-05T00:02:00Z',
			payload: { action: 'settings.business.save', contextId: context.id, workspace: context.workspace,
				actorId: actor.id, targetId: context.targetId, merchantId: context.merchantId, fields } };
		rpc.mockClear();
		rpc.mockResolvedValueOnce({ context, data: { ...data, settings } } as never)
			.mockResolvedValueOnce({} as never).mockResolvedValueOnce(prepared as never)
			.mockResolvedValueOnce({ committed: true, operationId: prepared.operationId,
				action: prepared.payload.action, settings: { revision: 3, document } } as never);
		expect(await cabinet.settingsRepository.save(scope, draft, null, 2)).toEqual({ draft, baseline: null, revision: 3 });
		expect(rpc.mock.calls.map(([action]) => action)).toEqual(['snapshot', 'elevate', 'prepare', 'commit']);
		expect(approve).toHaveBeenCalledWith({ context, action: 'settings.business.save', fields });
		rpc.mockResolvedValueOnce({ context, data: { ...data, settings } } as never);
		await expect(cabinet.settingsRepository.save(scope, draft, null, 1)).rejects.toThrow('Налаштування вже змінено');
		rpc.mockClear();
		for (const invalid of [{ ...scope, demo: true }, { ...scope, merchantId: 'foreign' }, { ...scope, userId: context.targetId }]) {
			await expect(cabinet.settingsRepository.load(invalid)).rejects.toThrow();
			await expect(cabinet.settingsRepository.save(invalid, draft, null, 2)).rejects.toThrow();
		}
		expect(rpc).not.toHaveBeenCalled();
		cabinet.dispose();
		await expect(cabinet.settingsRepository.load(scope)).rejects.toThrow();
	});
	it('opens genuine invoice detail only from the bound snapshot and rejects partial data', async () => {
		const { cabinet, rpc } = fixture();
		await cabinet.gateway.restore();
		const id = '12345678-1234-1234-1234-123456789012';
		const invoice = { id, number: 'CLIENT-42', title: 'Customer goods', status: 'pending', amount: 120,
			type: 'delivery', currency: 'UAH', createdAt: '2026-10-05T00:00:00Z', expiresAt: null };
		const detail = { shortId: 'ABC123', description: 'Stored purpose', baseAmount: 100,
			discountAmount: 0, deliveryFee: 20, tableNumber: null, terminalId: null, terminalCode: null, paidAt: null, paidBankCode: null };
		rpc.mockClear();
		await expect(cabinet.gateway.getInvoice('foreign-merchant', id)).rejects.toThrow();
		await expect(cabinet.gateway.getInvoice(context.merchantId, '../other')).rejects.toThrow();
		expect(rpc).not.toHaveBeenCalled();
		for (const shortId of ['ABC123', 'ABC123xyz789', null]) {
			rpc.mockResolvedValueOnce({ context, data: { ...data, invoices: [{ ...invoice, detail: { ...detail, shortId } }] } } as never);
			await expect(cabinet.gateway.getInvoice(context.merchantId, id)).resolves.toMatchObject({ ...detail, shortId, id });
		}
		for (const invalid of [undefined, {}, { ...detail, shortId: '../other' }, { ...detail, baseAmount: '100' }]) {
			rpc.mockResolvedValueOnce({ context, data: { ...data, invoices: [{ ...invoice, detail: invalid }] } } as never);
			await expect(cabinet.gateway.getInvoice(context.merchantId, id)).rejects.toThrow();
		}
		rpc.mockResolvedValueOnce({ context: { ...context, targetId: 'foreign' }, data } as never);
		await expect(cabinet.gateway.getInvoice(context.merchantId, id)).rejects.toThrow();
		await expect(cabinet.gateway.getInvoice(context.merchantId, id)).resolves.toBeNull();
		cabinet.dispose();
		rpc.mockClear();
		await expect(cabinet.gateway.getInvoice(context.merchantId, id)).rejects.toThrow();
		expect(rpc).not.toHaveBeenCalled();
	});
	it('lists only the bound customer snapshot and denies reads after disposal', async () => {
		const { cabinet, rpc } = fixture();
		await cabinet.gateway.restore();
		const invoice = { id: 'customer-invoice', number: 'CLIENT-42', title: 'Customer goods',
			status: 'pending', amount: 120, type: 'delivery', currency: 'UAH',
			createdAt: '2026-10-05T00:00:00Z', expiresAt: null };
		rpc.mockClear();
		await expect(cabinet.gateway.listInvoices('other-merchant')).rejects.toThrow();
		expect(rpc).not.toHaveBeenCalled();
		rpc.mockResolvedValueOnce({ context, data: { ...data, invoices: [invoice] } } as never);
		const rows = await cabinet.gateway.listInvoices(context.merchantId);
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({ id: invoice.id, reference: invoice.number, title: invoice.title,
			amount: 120, type: 'delivery', status: 'pending', shortId: null });
		expect(rpc).toHaveBeenLastCalledWith('snapshot', { sessionId: context.id });
		rpc.mockResolvedValueOnce({ context: { ...context, targetId: 'another-customer' }, data } as never);
		await expect(cabinet.gateway.listInvoices(context.merchantId)).rejects.toThrow();
		rpc.mockResolvedValueOnce({ context, data: { ...data, invoices: [{ ...invoice, amount: '120' }] } } as never);
		await expect(cabinet.gateway.listInvoices(context.merchantId)).rejects.toThrow();
		cabinet.dispose();
		rpc.mockClear();
		await expect(cabinet.gateway.listInvoices(context.merchantId)).rejects.toThrow();
		expect(rpc).not.toHaveBeenCalled();
	});
	it.each(['open_amount', 'table', 'delivery'] as const)('creates a bound customer %s invoice with exact scenario fields', async (type) => {
		const approve = vi.fn(async () => true);
		const { cabinet, rpc } = fixture(undefined, approve);
		await cabinet.gateway.restore();
		const fields = { type, entityId: 'entity', title: 'Customer purpose', description: 'Customer memo',
			amount: type === 'open_amount' ? 0 : 120, deliveryFee: type === 'delivery' ? 20 : 0,
			terminalId: type === 'table' ? 'terminal' : null, tableNumber: type === 'table' ? 7 : null, scenarioConfig: {} };
		const prepared = { operationId: 'operation', digest: 'a'.repeat(64), expiresAt: '2026-10-05T00:02:00Z',
			payload: { action: 'invoice.create', contextId: context.id, workspace: context.workspace,
				actorId: actor.id, targetId: context.targetId, merchantId: context.merchantId, fields } };
		const invoice = { id: 'invoice', reference: 'CLIENT-42', amount: fields.amount + fields.deliveryFee, shortId: 'ABC123',
			recipientName: 'Customer', recipientIban: 'UA123', recipientTaxId: '12345678', purpose: 'Customer purpose' };
		rpc.mockClear();
		rpc.mockResolvedValueOnce({} as never).mockResolvedValueOnce(prepared as never).mockResolvedValueOnce({
			committed: true, operationId: prepared.operationId, action: 'invoice.create', invoice
		} as never);
		await expect(cabinet.gateway.createInvoice({ ...fields, reference: '', merchantId: context.merchantId,
			terminalId: fields.terminalId ?? undefined, tableNumber: fields.tableNumber ?? undefined })).resolves.toEqual({ id: invoice.id });
		expect(approve).toHaveBeenCalledWith({ context, action: 'invoice.create', fields });
		expect(cabinet.getCreatedInvoice()).toEqual(invoice);
	});
	it('reports only capabilities explicitly supported by the bound server', async () => {
		const { cabinet, rpc } = fixture();
		await cabinet.gateway.restore();
		expect(await cabinet.getInvoiceScenarios()).toEqual([]);
		rpc.mockResolvedValueOnce({ context, data: { ...data, invoiceCreation: { fixed: true } } } as never);
		expect(await cabinet.getInvoiceScenarios()).toEqual(['fixed']);
		rpc.mockResolvedValueOnce({ context, data: { ...data, invoiceCreation: { fixed: true, open_amount: true, table: true, delivery: true } } } as never);
		expect(await cabinet.getInvoiceScenarios()).toEqual(['fixed', 'open_amount', 'table', 'delivery']);
	});
	it('loads payment settings only from the bound customer snapshot without operator defaults', async () => {
		const { cabinet, rpc } = fixture();
		await cabinet.gateway.restore();
		await expect(cabinet.getInvoiceSettings()).rejects.toThrow();
		const draft = { ...defaultBusinessDraft(), mode: 'direct' };
		const { selectedSellerId: _selected, ...document } = draft;
		rpc.mockResolvedValueOnce({ context, data: { ...data, settings: { revision: 2, document } } } as never);
		expect(await cabinet.getInvoiceSettings()).toEqual(draft);
		rpc.mockResolvedValueOnce({ context: { ...context, targetId: 'another-customer' }, data: { ...data, settings: { revision: 2, document } } } as never);
		await expect(cabinet.getInvoiceSettings()).rejects.toThrow();
		cabinet.dispose();
		await expect(cabinet.getInvoiceSettings()).rejects.toThrow();
	});
	it.each(['ABC123', 'ABC123xyz789'])('recovers a fixed customer invoice with short ID %s without replay', async (shortId) => {
		const approve = vi.fn(async () => true);
		const { cabinet, rpc } = fixture(undefined, approve);
		await cabinet.gateway.restore();
		const fields = { entityId: 'entity', title: 'Invoice', description: '', amount: 120, scenarioConfig: {} };
		const prepared = { operationId: 'operation', digest: 'a'.repeat(64), expiresAt: '2026-10-05T00:02:00Z',
			payload: { action: 'invoice.fixed.create', contextId: context.id, workspace: context.workspace,
				actorId: actor.id, targetId: context.targetId, merchantId: context.merchantId, fields } };
		const invoice = { id: 'invoice', reference: 'INV-0007', amount: 120, shortId,
			recipientName: 'Customer', recipientIban: 'UA123', recipientTaxId: '12345678', purpose: 'Payment' };
		const result = { committed: true, operationId: prepared.operationId, action: prepared.payload.action, invoice };
		rpc.mockClear();
		rpc.mockResolvedValueOnce({} as never).mockResolvedValueOnce(prepared as never)
			.mockRejectedValueOnce(new Error('Lost response')).mockResolvedValueOnce({ operation: { ...prepared, state: 'committed', result } } as never);
		expect(await cabinet.gateway.createInvoice({ merchantId: context.merchantId, type: 'fixed', reference: 'ignored',
			title: fields.title, amount: fields.amount, entityId: fields.entityId, scenario_config: {} })).toEqual({ id: invoice.id });
		expect(cabinet.getCreatedInvoice()).toEqual(invoice);
		expect(rpc.mock.calls.map(([action]) => action)).toEqual(['elevate', 'prepare', 'commit', 'operation']);
		expect(approve).toHaveBeenCalledWith({ context, action: 'invoice.fixed.create', fields });
	});
	it('loads invoice sellers only from the bound snapshot and reports missing migration data', async () => {
		const { cabinet, rpc } = fixture();
		await cabinet.gateway.restore();
		expect(await cabinet.getInvoiceCreateStructure()).toBeNull();
		rpc.mockResolvedValueOnce({ context, data: { ...data, structure: { entities: [entity], terminals: [terminal] } } } as never);
		expect(await cabinet.getInvoiceCreateStructure()).toEqual({ entities: [entity], terminals: [terminal] });
		rpc.mockResolvedValueOnce({ context: { ...context, targetId: 'another-customer' }, data } as never);
		await expect(cabinet.getInvoiceCreateStructure()).rejects.toThrow();
		cabinet.dispose();
		await expect(cabinet.getInvoiceCreateStructure()).rejects.toThrow();
	});
	it('confirms structure changes and reconciles a lost response without replay', async () => {
		const approve = vi.fn(async () => true);
		const { cabinet, rpc } = fixture(undefined, approve);
		await cabinet.gateway.restore();
		const fields = { businessName: 'New name' };
		const prepared = { operationId: 'operation', digest: 'a'.repeat(64), expiresAt: '2026-10-05T00:02:00Z',
			payload: { action: 'structure.merchant.rename', contextId: context.id, workspace: context.workspace,
				actorId: actor.id, targetId: context.targetId, merchantId: context.merchantId, fields } };
		const result = { committed: true, operationId: prepared.operationId, action: prepared.payload.action };
		rpc.mockClear();
		rpc.mockResolvedValueOnce({} as never).mockResolvedValueOnce(prepared as never)
			.mockRejectedValueOnce(new Error('Lost response')).mockResolvedValueOnce({ operation: { ...prepared, state: 'committed', result } } as never);
		await cabinet.gateway.updateMerchantName(context.merchantId, fields.businessName);
		expect(approve).toHaveBeenCalledWith({ context, action: prepared.payload.action, fields });
		expect(rpc.mock.calls.map(([action]) => action)).toEqual(['elevate', 'prepare', 'commit', 'operation']);
		expect(rpc).toHaveBeenLastCalledWith('operation', { sessionId: context.id, operationId: prepared.operationId });
	});
	it('rejects substituted structure fields and target before confirmation', async () => {
		for (const override of [{ fields: { id: 'other' } }, { targetId: 'other' }]) {
			const approve = vi.fn(async () => true);
			const { cabinet, rpc } = fixture(undefined, approve);
			await cabinet.gateway.restore();
			const prepared = { operationId: 'operation', digest: 'a'.repeat(64), expiresAt: '2026-10-05T00:02:00Z',
				payload: { action: 'structure.terminal.delete', contextId: context.id, workspace: context.workspace,
					actorId: actor.id, targetId: context.targetId, merchantId: context.merchantId, fields: { id: 'terminal' }, ...override } };
			rpc.mockClear();
			rpc.mockResolvedValueOnce({} as never).mockResolvedValueOnce(prepared as never);
			await expect(cabinet.gateway.deleteTerminal(actor.id, 'terminal')).rejects.toThrow();
			expect(approve).not.toHaveBeenCalled();
			expect(rpc.mock.calls.map(([action]) => action)).toEqual(['elevate', 'prepare']);
		}
	});
	it('cancels declined structure writes and fences disposal during confirmation', async () => {
		for (const dispose of [false, true]) {
			const { cabinet, rpc } = fixture(undefined, async () => {
				if (dispose) cabinet.dispose();
				return dispose;
			});
			await cabinet.gateway.restore();
			const prepared = { operationId: 'operation', digest: 'a'.repeat(64), expiresAt: '2026-10-05T00:02:00Z',
				payload: { action: 'structure.entity.delete', contextId: context.id, workspace: context.workspace,
					actorId: actor.id, targetId: context.targetId, merchantId: context.merchantId, fields: { id: 'entity' } } };
			rpc.mockClear();
			rpc.mockResolvedValueOnce({} as never).mockResolvedValueOnce(prepared as never);
			await expect(cabinet.gateway.deleteBusinessEntity(actor.id, 'entity')).rejects.toThrow();
			expect(rpc.mock.calls.map(([action]) => action)).toEqual(dispose ? ['elevate', 'prepare'] : ['elevate', 'prepare', 'cancel']);
		}
	});
	it('denies customer-ID substitution and missing confirmation without transport', async () => {
		const { cabinet, rpc } = fixture();
		await cabinet.gateway.restore();
		rpc.mockClear();
		await expect(cabinet.gateway.deleteTerminal(context.targetId, 'terminal')).rejects.toThrow();
		await expect(cabinet.gateway.deleteTerminal(actor.id, 'terminal')).rejects.toThrow();
		await expect(cabinet.gateway.updateMerchantName('other', 'Name')).rejects.toThrow();
		expect(rpc).not.toHaveBeenCalled();
	});
	it('keeps actor identity distinct from customer ownership', async () => {
		const { cabinet } = fixture();
		expect(await cabinet.gateway.restore()).toMatchObject({ status: 'ready', user: actor, support: context, merchant: { userId: 'customer' } });
		expect(await cabinet.gateway.getMerchantSettings('merchant')).toEqual({ tableOrderTtlSeconds: 1800 });
		await expect(cabinet.gateway.getMerchantSettings('other')).rejects.toThrow();
	});
	it('denies unlisted actions and payment confirmation without transport calls', async () => {
		const { cabinet, rpc } = fixture();
		await cabinet.gateway.restore();
		rpc.mockClear();
		for (const method of ['markPosOrderPaid', 'getDeveloperSession', 'listTeamMembers', 'signOut'] as const) {
			expect(() => Reflect.apply(cabinet.gateway[method], null, ['anything'])).toThrow();
		}
		await expect(cabinet.gateway.createInvoice({ merchantId: 'other', type: 'fixed', reference: '', title: 'Test', amount: 100 })).rejects.toThrow();
		await expect(cabinet.gateway.saveMerchantSettings('merchant', { tableOrderTtlSeconds: 3600 })).rejects.toThrow();
		expect(rpc).not.toHaveBeenCalled();
	});
	it('confirms a server-bound settings change and recovers a lost commit response', async () => {
		const confirmSettings = vi.fn(async () => true);
		const { cabinet, rpc } = fixture(confirmSettings);
		await cabinet.gateway.restore();
		const prepared = { operationId: 'operation', digest: 'a'.repeat(64), expiresAt: '2026-10-05T00:02:00Z',
			payload: { action: 'settings.table_ttl', contextId: context.id, workspace: context.workspace,
				actorId: actor.id, targetId: context.targetId, merchantId: context.merchantId, previousSeconds: null, nextSeconds: 3600 } };
		const result = { committed: true, operationId: prepared.operationId, tableOrderTtlSeconds: 3600 };
		rpc.mockResolvedValueOnce({} as never).mockResolvedValueOnce(prepared as never)
			.mockRejectedValueOnce(new Error('Lost response')).mockResolvedValueOnce({ operation: { ...prepared, state: 'committed', result } } as never);
		await cabinet.gateway.saveMerchantSettings('merchant', { tableOrderTtlSeconds: 3600 });
		expect(confirmSettings).toHaveBeenCalledWith({ context, previousSeconds: null, nextSeconds: 3600 });
		expect(rpc).toHaveBeenCalledWith('commit', { sessionId: context.id, operationId: prepared.operationId,
			digest: prepared.digest, acknowledgement: 'CHANGE_LIVE_BUSINESS' });
		expect(rpc).toHaveBeenLastCalledWith('operation', { sessionId: context.id, operationId: prepared.operationId });
	});
	it('rejects wrong target and invalid settings before transport', async () => {
		const { cabinet, rpc } = fixture(async () => true);
		await cabinet.gateway.restore();
		rpc.mockClear();
		await expect(cabinet.gateway.saveMerchantSettings('other', { tableOrderTtlSeconds: 3600 })).rejects.toThrow();
		await expect(cabinet.gateway.saveMerchantSettings('merchant', { tableOrderTtlSeconds: 42 })).rejects.toThrow();
		expect(rpc).not.toHaveBeenCalled();
	});
	it('cancels declined settings changes without committing', async () => {
		const { cabinet, rpc } = fixture(async () => false);
		await cabinet.gateway.restore();
		const prepared = { operationId: 'operation', digest: 'a'.repeat(64), expiresAt: '2026-10-05T00:02:00Z',
			payload: { action: 'settings.table_ttl', contextId: context.id, workspace: context.workspace,
				actorId: actor.id, targetId: context.targetId, merchantId: context.merchantId, previousSeconds: 1800, nextSeconds: 3600 } };
		rpc.mockClear();
		rpc.mockResolvedValueOnce({} as never).mockResolvedValueOnce(prepared as never);
		await expect(cabinet.gateway.saveMerchantSettings('merchant', { tableOrderTtlSeconds: 3600 })).rejects.toThrow();
		expect(rpc.mock.calls.map(([action]) => action)).toEqual(['elevate', 'prepare', 'cancel']);
	});
	it('fences concurrent writes and disposal during confirmation', async () => {
		let approve!: (value: boolean) => void;
		const confirmSettings = vi.fn(() => new Promise<boolean>((resolve) => { approve = resolve; }));
		const { cabinet, rpc } = fixture(confirmSettings);
		await cabinet.gateway.restore();
		const prepared = { operationId: 'operation', digest: 'a'.repeat(64), expiresAt: '2026-10-05T00:02:00Z',
			payload: { action: 'settings.table_ttl', contextId: context.id, workspace: context.workspace,
				actorId: actor.id, targetId: context.targetId, merchantId: context.merchantId, previousSeconds: 1800, nextSeconds: 3600 } };
		rpc.mockClear();
		rpc.mockResolvedValueOnce({} as never).mockResolvedValueOnce(prepared as never);
		const pending = cabinet.gateway.saveMerchantSettings('merchant', { tableOrderTtlSeconds: 3600 });
		await vi.waitFor(() => expect(confirmSettings).toHaveBeenCalledOnce());
		await expect(cabinet.gateway.saveMerchantSettings('merchant', { tableOrderTtlSeconds: 7200 })).rejects.toThrow();
		cabinet.dispose();
		approve(true);
		await expect(pending).rejects.toThrow();
		expect(rpc.mock.calls.map(([action]) => action)).toEqual(['elevate', 'prepare']);
	});
	it('does not retry an uncertain commit or accept unrelated recovery results', async () => {
		for (const recovery of [null, { operationId: 'other', digest: 'a'.repeat(64), state: 'committed' },
			{ operationId: 'operation', digest: 'a'.repeat(64), state: 'prepared' }]) {
			const { cabinet, rpc } = fixture(async () => true);
			await cabinet.gateway.restore();
			const prepared = { operationId: 'operation', digest: 'a'.repeat(64), expiresAt: '2026-10-05T00:02:00Z',
				payload: { action: 'settings.table_ttl', contextId: context.id, workspace: context.workspace,
					actorId: actor.id, targetId: context.targetId, merchantId: context.merchantId, previousSeconds: 1800, nextSeconds: 3600 } };
			rpc.mockClear();
			rpc.mockResolvedValueOnce({} as never).mockResolvedValueOnce(prepared as never)
				.mockRejectedValueOnce(new Error('Lost response')).mockResolvedValueOnce({ operation: recovery } as never);
			await expect(cabinet.gateway.saveMerchantSettings('merchant', { tableOrderTtlSeconds: 3600 })).rejects.toThrow('Lost response');
			expect(rpc.mock.calls.map(([action]) => action)).toEqual(['elevate', 'prepare', 'commit', 'operation']);
		}
	});
	it('reads customer structure through the bound support snapshot only', async () => {
		const { cabinet, rpc } = fixture();
		await cabinet.gateway.restore();
		const structure = { entities: [entity], terminals: [terminal] };
		rpc.mockResolvedValueOnce({ context, data: { ...data, structure } } as never);
		expect(await cabinet.gateway.getBusinessStructure(actor.id)).toEqual(structure);
		expect(rpc).toHaveBeenLastCalledWith('snapshot', { sessionId: context.id });
		rpc.mockClear();
		for (const userId of ['other', context.targetId]) {
			await expect(cabinet.gateway.getBusinessStructure(userId)).rejects.toThrow();
		}
		expect(rpc).not.toHaveBeenCalled();
		await expect(cabinet.gateway.getBusinessStructure(actor.id)).rejects.toThrow();
	});
	it('rejects incomplete structure fields, duplicate resources and foreign terminal relations', async () => {
		const { cabinet, rpc } = fixture();
		await cabinet.gateway.restore();
		for (const structure of [
			{ entities: [{ id: entity.id }], terminals: [] },
			{ entities: [entity, entity], terminals: [] },
			{ entities: [entity], terminals: [terminal, terminal] },
			{ entities: [entity], terminals: [{ ...terminal, entityId: 'foreign' }] },
			{ entities: [entity], terminals: [{ ...terminal, entityId: undefined }] },
			{ entities: [entity], terminals: [{ ...terminal, code: undefined }] },
			{ entities: [{ ...entity, phone: 123 }], terminals: [] },
			{ entities: [entity], terminals: [{ ...terminal, type: 'other' }] }
		]) {
			rpc.mockResolvedValueOnce({ context, data: { ...data, structure } } as never);
			await expect(cabinet.gateway.getBusinessStructure(actor.id)).rejects.toThrow();
		}
	});
	it('preserves an unassigned terminal without fabricating an entity association', async () => {
		const { cabinet, rpc } = fixture();
		await cabinet.gateway.restore();
		rpc.mockResolvedValueOnce({ context, data: { ...data, structure: { entities: [], terminals: [{ ...terminal, entityId: null }] } } } as never);
		expect(await cabinet.gateway.getBusinessStructure(actor.id)).toEqual({ entities: [], terminals: [{ ...terminal, entityId: '' }] });
	});
	it('fences a structure response after disposal or context substitution', async () => {
		const { cabinet, rpc } = fixture();
		await cabinet.gateway.restore();
		rpc.mockResolvedValueOnce({ context: { ...context, merchantId: 'foreign' }, data: { ...data, structure: { entities: [entity], terminals: [terminal] } } } as never);
		await expect(cabinet.gateway.getBusinessStructure(actor.id)).rejects.toThrow();
		let finish!: (value: unknown) => void;
		rpc.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve as typeof finish; }));
		const pending = cabinet.gateway.getBusinessStructure(actor.id);
		cabinet.dispose();
		finish({ context, data: { ...data, structure: { entities: [entity], terminals: [terminal] } } });
		await expect(pending).rejects.toThrow();
	});
	it('rejects stale snapshot completion after disposal', async () => {
		const { cabinet, rpc } = fixture();
		await cabinet.gateway.restore();
		let finish!: (value: { context: typeof context; data: typeof data }) => void;
		rpc.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
		const pending = cabinet.gateway.getMerchantSettings('merchant');
		cabinet.dispose();
		finish({ context, data });
		await expect(pending).rejects.toThrow();
	});
	it('fails closed for a different actor, customer, expired context or snapshot', async () => {
		for (const override of [{ actorId: 'other', context }, { actorId: actor.id, context: { ...context, expiresAt: '2020-01-01' } }, { actorId: actor.id, context: { ...context, targetId: actor.id } }]) {
			const { cabinet, rpc } = fixture();
			rpc.mockResolvedValueOnce(override);
			await expect(cabinet.gateway.restore()).rejects.toThrow();
		}
		const { cabinet, rpc } = fixture();
		await cabinet.gateway.restore();
		rpc.mockResolvedValueOnce({ context: { ...context, targetId: 'other' }, data });
		await expect(cabinet.gateway.getMerchantSettings('merchant')).rejects.toThrow();
	});
	it('ends the exact server context without signing out and remains closed', async () => {
		const { cabinet, rpc } = fixture();
		await cabinet.gateway.restore();
		await cabinet.end();
		expect(rpc).toHaveBeenLastCalledWith('end', { sessionId: 'context' });
		await expect(cabinet.gateway.restore()).rejects.toThrow();
	});
});