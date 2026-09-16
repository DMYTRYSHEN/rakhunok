import { getSupabaseBrowserClient } from '../api/supabase-browser';
import type { DashboardGateway } from '../api/dashboard-gateway';
import type { ProformaAct, ProformaDraft } from './types';
import { calculateProformaTotals } from './proforma-calc';

const STORAGE_PREFIX = 'rahunok.proformas.v1:';

function getStorageKey(merchantId: string): string {
	return `${STORAGE_PREFIX}${merchantId}`;
}

function loadLocalProformas(merchantId: string): ProformaDraft[] {
	try {
		const raw = localStorage.getItem(getStorageKey(merchantId));
		return raw ? JSON.parse(raw) : [];
	} catch {
		return [];
	}
}

function saveLocalProformas(merchantId: string, list: ProformaDraft[]): void {
	try {
		localStorage.setItem(getStorageKey(merchantId), JSON.stringify(list));
	} catch (e) {
		console.error('Не вдалося зберегти проформи локально', e);
	}
}

export function mapRowToProforma(row: Record<string, unknown>): ProformaDraft {
	return {
		id: String(row.id),
		title: String(row.title || 'Рахунок-фактура'),
		number: String(row.number || ''),
		issueDate: String(row.issue_date || ''),
		dueDate: String(row.due_date || ''),
		currency: (row.currency as ProformaDraft['currency']) || 'UAH',
		seller: (row.seller as ProformaDraft['seller']) || {
			entityId: '',
			name: '',
			taxId: '',
			iban: '',
			bankName: '',
			vatStatus: 'no-vat'
		},
		customer: (row.customer as ProformaDraft['customer']) || { name: '' },
		items: (row.items as ProformaDraft['items']) || [],
		paymentMethod: (row.payment_method as ProformaDraft['paymentMethod']) || {
			type: 'iban',
			name: 'Безготівковий розрахунок за IBAN',
			details: ''
		},
		purpose: String(row.purpose || ''),
		notes: String(row.notes || ''),
		taxRate: Number(row.tax_rate) || 0,
		adjustment: Number(row.adjustment) || 0,
		appearanceTemplate: String(row.appearance_template || 'Шаблон №1 • Українська'),
		recurrence: (row.recurrence as ProformaDraft['recurrence']) || 'none',
		projectGroup: String(row.project_group || 'Без проєкту • Без групи'),
		status: (row.status as ProformaDraft['status']) || 'draft',
		invoiceId: row.invoice_id ? String(row.invoice_id) : undefined,
		totals: row.totals as ProformaDraft['totals'],
		act: (row.act as ProformaDraft['act']) || undefined,
		createdAt: String(row.created_at || new Date().toISOString())
	};
}

export function mapProformaToRow(merchantId: string, proforma: ProformaDraft): Record<string, unknown> {
	const totals = proforma.totals ?? calculateProformaTotals(proforma.items, proforma.taxRate, proforma.adjustment || 0);

	return {
		id: proforma.id,
		merchant_id: merchantId,
		invoice_id: proforma.invoiceId || null,
		number: proforma.number,
		title: proforma.title,
		issue_date: proforma.issueDate,
		due_date: proforma.dueDate,
		status: proforma.status,
		currency: proforma.currency,
		seller: proforma.seller,
		customer: proforma.customer,
		items: proforma.items,
		payment_method: proforma.paymentMethod,
		purpose: proforma.purpose,
		notes: proforma.notes,
		tax_rate: proforma.taxRate,
		adjustment: proforma.adjustment || 0,
		subtotal: totals.subtotal,
		discount_total: totals.discountTotal,
		tax_amount: totals.taxAmount,
		total: totals.total,
		appearance_template: proforma.appearanceTemplate,
		recurrence: proforma.recurrence,
		project_group: proforma.projectGroup,
		act: proforma.act || null,
		updated_at: new Date().toISOString()
	};
}

export async function listProformas(merchantId: string, demo = false): Promise<ProformaDraft[]> {
	if (demo) return loadLocalProformas(merchantId);

	const client = getSupabaseBrowserClient();
	if (!client) return loadLocalProformas(merchantId);

	try {
		const { data, error } = await client
			.from('proformas')
			.select('*')
			.eq('merchant_id', merchantId)
			.order('created_at', { ascending: false });

		if (error) {
			// Fallback to local storage if table is not yet created
			return loadLocalProformas(merchantId);
		}

		const proformas = (data ?? []).map(mapRowToProforma);
		// Sync with local storage
		saveLocalProformas(merchantId, proformas);
		return proformas;
	} catch {
		return loadLocalProformas(merchantId);
	}
}

export async function saveProforma(merchantId: string, proforma: ProformaDraft, demo = false): Promise<void> {
	// Always keep local storage updated
	const localList = loadLocalProformas(merchantId);
	const existingIndex = localList.findIndex((p) => p.id === proforma.id);
	if (existingIndex >= 0) {
		localList[existingIndex] = proforma;
	} else {
		localList.unshift(proforma);
	}
	saveLocalProformas(merchantId, localList);

	if (demo) return;

	const client = getSupabaseBrowserClient();
	if (!client) return;

	try {
		const row = mapProformaToRow(merchantId, proforma);
		await client.from('proformas').upsert(row);
	} catch (e) {
		console.warn('Не вдалося зберегти проформу в Supabase, збережено локально', e);
	}
}

export async function deleteProforma(merchantId: string, proformaId: string, demo = false): Promise<void> {
	const localList = loadLocalProformas(merchantId).filter((p) => p.id !== proformaId);
	saveLocalProformas(merchantId, localList);

	if (demo) return;

	const client = getSupabaseBrowserClient();
	if (!client) return;

	try {
		await client.from('proformas').delete().eq('id', proformaId).eq('merchant_id', merchantId);
	} catch (e) {
		console.warn('Не вдалося видалити проформу з Supabase, видалено локально', e);
	}
}

export async function convertProformaToInvoice(
	merchantId: string,
	proforma: ProformaDraft,
	gateway: DashboardGateway,
	demo = false
): Promise<{ invoiceId: string; proforma: ProformaDraft }> {
	const totals = proforma.totals ?? calculateProformaTotals(proforma.items, proforma.taxRate, proforma.adjustment || 0);

	// 1. Create real payable invoice via Gateway
	const { id: invoiceId } = await gateway.createInvoice({
		merchantId,
		type: 'fixed',
		reference: proforma.number,
		title: `${proforma.title} № ${proforma.number}`,
		description: proforma.purpose || undefined,
		amount: totals.total,
		entityId: proforma.seller.entityId || undefined
	});

	// 2. Update proforma status to 'invoice_created' and record the linked invoiceId
	const updatedProforma: ProformaDraft = {
		...proforma,
		status: 'invoice_created',
		invoiceId,
		totals
	};

	// 3. Persist updated proforma
	await saveProforma(merchantId, updatedProforma, demo);

	return { invoiceId, proforma: updatedProforma };
}

export async function saveProformaAct(
	merchantId: string,
	proformaId: string,
	act: ProformaAct,
	demo = false
): Promise<void> {
	const localList = loadLocalProformas(merchantId);
	const idx = localList.findIndex((p) => p.id === proformaId);
	if (idx >= 0) {
		localList[idx].act = act;
		saveLocalProformas(merchantId, localList);
	}

	if (demo) return;

	const client = getSupabaseBrowserClient();
	if (!client) return;

	try {
		await client
			.from('proformas')
			.update({ act, updated_at: new Date().toISOString() })
			.eq('id', proformaId);
	} catch (e) {
		console.warn('Не вдалося оновити акт у Supabase, збережено локально', e);
	}
}

