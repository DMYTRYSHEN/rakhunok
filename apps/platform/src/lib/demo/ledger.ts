import Papa from 'papaparse';
import { seedState, type Entry, type Persona } from './gateway';
import { can, sellerIds, type WorkflowState, type WorkflowEvent, type WorkflowResult } from './workflow';

export type LedgerInput = { id: string; kind: 'customer' | 'income'; courierId: string; amountMinor: number; currency: 'UAH'; occurredAt: string; activity: string; adjustment?: 'refund' | 'cancel' | 'correction' | 'reassign'; originalId?: string; reason?: string; targetCourierId?: string };
export type LedgerEvent = LedgerInput & { receivedAt: string; actorId: string };
export type ImportResult = { status: 'processed' | 'replayed' | 'rejected'; error?: string; rows: { id: string; kind: LedgerInput['kind']; status: 'processed' | 'replayed'; receipt: string; receivedAt: string }[] };
export type DemoKey = { id: string; scopes: ('customer' | 'income')[]; status: 'active' | 'revoked'; environment: 'test' };
export type LedgerState = { events: Record<string, LedgerEvent[]>; keys: Record<string, DemoKey[]> };
export type LedgerCommand =
	| { type: 'key.create'; id: string; scopes: DemoKey['scopes']; environment: 'test' | 'live' }
	| { type: 'key.revoke'; id: string }
	| { type: 'key.rotate'; id: string; replacementId: string }
	| { type: 'ledger.import'; rows: LedgerInput[]; keyId?: string };
export const emptyLedger = (): LedgerState => ({ events: {}, keys: {} });
const failure = (error: string): WorkflowResult => ({ ok: false, error });
export function canonicalRow(raw: LedgerInput): LedgerInput {
	return { id: raw.id, kind: raw.kind, courierId: raw.courierId, amountMinor: raw.amountMinor, currency: raw.currency, occurredAt: raw.occurredAt, activity: raw.activity, ...(raw.adjustment ? { adjustment: raw.adjustment, originalId: raw.originalId, reason: raw.reason, ...(raw.targetCourierId ? { targetCourierId: raw.targetCourierId } : {}) } : {}) };
}
export function validateRow(row: LedgerInput, operatorId: string, relationships = sellerIds(operatorId)): string | null {
	if (!row || typeof row.id !== 'string' || !/^DEMO-[a-z0-9_-]{1,64}$/i.test(row.id)) return 'INVALID_ID';
	if (!['customer', 'income'].includes(row.kind) || !relationships.includes(row.courierId)) return 'INVALID_RELATIONSHIP';
	if (row.currency !== 'UAH' || !Number.isSafeInteger(row.amountMinor) || Math.abs(row.amountMinor) > 1_000_000_000 || row.amountMinor === 0) return 'INVALID_MONEY';
	if (typeof row.occurredAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(row.occurredAt) || !Number.isFinite(Date.parse(row.occurredAt)) || new Date(row.occurredAt).toISOString() !== row.occurredAt || typeof row.activity !== 'string' || !row.activity.trim() || row.activity.length > 120) return 'INVALID_EVENT';
	if (!row.adjustment && row.amountMinor < 0) return 'NEGATIVE_ORIGINAL';
	if (row.adjustment && (!['refund', 'cancel', 'correction', 'reassign'].includes(row.adjustment) || typeof row.reason !== 'string' || !row.reason.trim() || row.reason.length > 500 || !row.originalId)) return 'INVALID_ADJUSTMENT';
	return null;
}
export function applyLedger(state: WorkflowState, event: WorkflowEvent, actor: Persona): WorkflowResult {
	const command = event.command as LedgerCommand;
	if (!can(actor, event.operatorId, command.type === 'ledger.import' && !command.keyId ? 'finance' : 'integrations')) return failure('FORBIDDEN');
	const next = structuredClone(state);
	const keys = next.ledger.keys[event.operatorId] ??= [];
	if (command.type === 'key.create') {
		if (command.environment !== 'test' || !/^DEMO-key-[a-z0-9-]{1,40}$/.test(command.id) || !Array.isArray(command.scopes) || !command.scopes.length || command.scopes.some(scope => !['customer', 'income'].includes(scope))) return failure('INVALID_KEY');
		if (keys.some(key => key.id === command.id)) return failure('DUPLICATE_KEY');
		keys.push({ id: command.id, scopes: [...new Set(command.scopes)], status: 'active', environment: 'test' });
	} else if (command.type === 'key.revoke' || command.type === 'key.rotate') {
		const key = keys.find(item => item.id === command.id);
		if (!key) return failure('UNKNOWN_KEY');
		if (command.type === 'key.rotate') {
			if (key.status !== 'active' || !/^DEMO-key-[a-z0-9-]{1,40}$/.test(command.replacementId) || keys.some(item => item.id === command.replacementId)) return failure('INVALID_KEY');
			keys.push({ ...key, id: command.replacementId });
		}
		key.status = 'revoked';
	} else if (command.type === 'ledger.import') {
		if (!Array.isArray(command.rows) || !command.rows.length || command.rows.length > 100) return failure('IMPORT_LIMIT');
		const key = command.keyId ? keys.find(item => item.id === command.keyId && item.status === 'active') : null;
		if (command.keyId && !key) return failure('KEY_REVOKED_OR_UNKNOWN');
		const events = next.ledger.events[event.operatorId] ??= [];
		let added = 0;
		for (const [index, raw] of command.rows.entries()) {
			const error = validateRow(raw, event.operatorId, sellerIds(event.operatorId, state));
			if (error) return failure(`ROW_${index + 1}:${error}`);
			const row = canonicalRow(raw);
			if (key && !key.scopes.includes(row.kind)) return failure('KEY_SCOPE');
			const previous = events.find(item => item.id === row.id && item.kind === row.kind);
			if (previous) {
				if (JSON.stringify(canonicalRow(previous)) !== JSON.stringify(row)) return failure('IDEMPOTENCY_CONFLICT');
				continue;
			}
			if (row.adjustment) {
				const original = events.find(item => item.id === row.originalId && item.kind === row.kind && !item.adjustment);
				if (!original || original.courierId !== row.courierId) return failure('ORIGINAL_NOT_FOUND');
				const remaining = original.amountMinor + events.filter(item => item.originalId === original.id && item.kind === original.kind).reduce((sum, item) => sum + item.amountMinor, 0);
				if (remaining + row.amountMinor < 0 || ['cancel', 'reassign'].includes(row.adjustment) && row.amountMinor !== -remaining || row.adjustment === 'refund' && row.amountMinor >= 0) return failure('ADJUSTMENT_EXCEEDS_ORIGINAL');
				if (row.adjustment === 'reassign' && (!sellerIds(event.operatorId, state).includes(row.targetCourierId ?? '') || row.targetCourierId === row.courierId)) return failure('INVALID_TARGET');
			}
			events.push({ ...row, actorId: actor.id, receivedAt: event.at }); added++;
		}
		if (!added) return { ok: true, state };
		if (events.length > 1000) return failure('LEDGER_LIMIT');
	} else return failure('UNKNOWN_COMMAND');
	return { ok: true, state: next };
}
export function ledgerEntries(state: WorkflowState): Entry[] {
	return [...seedState().entries, ...Object.entries(state.ledger.events).flatMap(([operatorId, events]) => events.flatMap(event => {
		const entry = { id: `${event.kind}:${event.id}`, operatorId, courierId: event.courierId, period: event.occurredAt.slice(0, 7), customerMinor: event.kind === 'customer' ? event.amountMinor : 0, incomeMinor: event.kind === 'income' ? event.amountMinor : 0, paidMinor: 0 };
		return event.adjustment === 'reassign' ? [entry, { ...entry, id: `${entry.id}:target`, courierId: event.targetCourierId!, customerMinor: -entry.customerMinor, incomeMinor: -entry.incomeMinor }] : [entry];
	}))];
}
export function parseImport(text: string, format: 'json' | 'csv', mapping: Record<string, string> = {}) {
	const errors: string[] = [];
	let records: Record<string, unknown>[] = [];
	if (new TextEncoder().encode(text).length > 100_000) return { rows: [] as LedgerInput[], errors: ['FILE_LIMIT_100KB'] };
	try {
		if (format === 'json') { const parsed = JSON.parse(text); if (!Array.isArray(parsed)) throw new Error('JSON_ARRAY_REQUIRED'); records = parsed; }
		else { const parsed = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: 'greedy' }); records = parsed.data; errors.push(...parsed.errors.map(error => `ROW_${(error.row ?? 0) + 2}:${error.code}`)); }
		if (records.length > 100) errors.push('ROW_LIMIT_100');
		const rows = records.slice(0, 100).map((record, index) => {
			if (!record || typeof record !== 'object') { errors.push(`ROW_${index + 1}:OBJECT_REQUIRED`); return {} as LedgerInput; }
			const mapped: Record<string, unknown> = {};
			for (const key of ['id', 'kind', 'courierId', 'amountMinor', 'currency', 'occurredAt', 'activity', 'adjustment', 'originalId', 'reason', 'targetCourierId']) mapped[key] = record[mapping[key] || key];
			const amount = mapped.amountMinor;
			mapped.amountMinor = typeof amount === 'string' && /^-?\d+$/.test(amount) ? Number(amount) : amount;
			return canonicalRow(mapped as LedgerInput);
		});
		return { rows, errors };
	} catch { return { rows: [] as LedgerInput[], errors: ['INVALID_INPUT'] }; }
}
export function exportCsv(rows: object[]) { return Papa.unparse(rows, { escapeFormulae: true }); }