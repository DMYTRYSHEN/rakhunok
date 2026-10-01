import { ledgerEntries } from './ledger';
import { totals, type Entry, type Persona } from './gateway';
import { can, sellerBlockers, sellerIds, type WorkflowEvent, type WorkflowResult, type WorkflowState } from './workflow';

export type PayoutStatus = 'pending' | 'paid' | 'rejected' | 'unknown';
export type Instruction = { id: string; courierId: string; amountMinor: number; account: string; status: PayoutStatus; attempts: number; evidence: string; awaitingResult?: boolean };
export type Batch = { id: string; period: string; author: string; approvedBy?: string; at: string; instructions: Instruction[]; cancelled: boolean };
export type ExternalPayout = { id: string; courierId: string; amountMinor: number; period: string; occurredAt: string; status: PayoutStatus; evidence: string; actorId: string; request: string };
export type PayoutState = { batches: Record<string, Batch[]>; external: Record<string, ExternalPayout[]> };
export type PayoutCommand =
	| { type: 'payout.external'; id: string; courierId: string; amountMinor: number; period: string; occurredAt: string; status: PayoutStatus; evidence: string }
	| { type: 'payout.reconcile'; id: string; status: 'paid' | 'rejected'; evidence: string }
	| { type: 'batch.create'; id: string; period: string; courierIds: string[] }
	| { type: 'batch.approve' | 'batch.cancel'; id: string }
	| { type: 'batch.result'; id: string; instructionId: string; status: PayoutStatus; evidence: string }
	| { type: 'batch.retry'; id: string; instructionId: string };
export const emptyPayouts = (): PayoutState => ({ batches: {}, external: {} });
const failure = (error: string): WorkflowResult => ({ ok: false, error });
const validId = (id: string) => typeof id === 'string' && /^DEMO-[a-z0-9_-]{1,64}$/i.test(id);
const validPeriod = (period: string) => /^20\d{2}-(0[1-9]|1[0-2])$/.test(period);
const validTimestamp = (value: string) => typeof value === 'string' && /^20\d{2}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
export function financialEntries(state: WorkflowState): Entry[] {
	const extra: Entry[] = [];
	for (const [operatorId, batches] of Object.entries(state.payouts.batches)) for (const batch of batches) for (const instruction of batch.instructions) if (instruction.status === 'paid') extra.push({ id: instruction.id, operatorId, courierId: instruction.courierId, period: batch.period, customerMinor: 0, incomeMinor: 0, paidMinor: instruction.amountMinor });
	for (const [operatorId, records] of Object.entries(state.payouts.external)) for (const record of records) if (record.status === 'paid') extra.push({ id: `external:${record.id}`, operatorId, courierId: record.courierId, period: record.period, customerMinor: 0, incomeMinor: 0, paidMinor: record.amountMinor });
	return [...ledgerEntries(state), ...extra];
}
export function balance(state: WorkflowState, operatorId: string, courierId: string, period: string) {
	const sums = totals(financialEntries(state).filter(entry => entry.operatorId === operatorId && entry.courierId === courierId && entry.period === period));
	const adjustmentsMinor = (state.ledger.events[operatorId] ?? []).filter(event => event.kind === 'income' && event.adjustment && event.occurredAt.slice(0, 7) === period).reduce((sum, event) => sum + (event.courierId === courierId ? event.amountMinor : 0) - (event.adjustment === 'reassign' && event.targetCourierId === courierId ? event.amountMinor : 0), 0);
	const reserved = (state.payouts.batches[operatorId] ?? []).filter(batch => !batch.cancelled && batch.period === period).flatMap(batch => batch.instructions).filter(item => item.courierId === courierId && ['pending', 'unknown'].includes(item.status)).reduce((sum, item) => sum + item.amountMinor, 0) + (state.payouts.external[operatorId] ?? []).filter(item => item.courierId === courierId && item.period === period && ['pending', 'unknown'].includes(item.status)).reduce((sum, item) => sum + item.amountMinor, 0);
	return { ...sums, accruedMinor: sums.incomeMinor - adjustmentsMinor, adjustmentsMinor, reserved, available: sums.balanceMinor - reserved };
}
export function applyPayout(state: WorkflowState, event: WorkflowEvent, actor: Persona): WorkflowResult {
	const command = event.command as PayoutCommand;
	const documents = event.evidencePolicy === 2 ? state.documents[event.operatorId] ?? [] : [];
	if (!can(actor, event.operatorId, command.type === 'batch.approve' ? 'approve' : 'finance')) return failure('FORBIDDEN');
	const next = structuredClone(state);
	const batches = next.payouts.batches[event.operatorId] ??= [];
	const external = next.payouts.external[event.operatorId] ??= [];
	if (command.type === 'payout.external') {
		if (!validId(command.id) || !sellerIds(event.operatorId, state).includes(command.courierId) || !validPeriod(command.period) || !validTimestamp(command.occurredAt) || !Number.isSafeInteger(command.amountMinor) || command.amountMinor <= 0 || !['pending', 'paid', 'rejected', 'unknown'].includes(command.status) || !command.evidence?.trim() || command.evidence.length > 500) return failure('INVALID_EXTERNAL_PAYOUT');
		const { type, ...fields } = command;
		const previous = external.find(item => item.id === command.id);
		if (previous) return previous.request === JSON.stringify(fields) ? { ok: true, state } : failure('IDEMPOTENCY_CONFLICT');
		if (command.status !== 'rejected' && command.amountMinor > balance(state, event.operatorId, command.courierId, command.period).available) return failure('INSUFFICIENT_BALANCE');
		external.push({ ...fields, actorId: actor.id, request: JSON.stringify(fields) });
	} else if (command.type === 'payout.reconcile') {
		const record = external.find(item => item.id === command.id);
		if (!record || !command.evidence?.trim() || command.evidence.length > 500 || !['paid', 'rejected'].includes(command.status)) return failure('INVALID_RECONCILIATION');
		if (record.status === command.status) return { ok: true, state };
		if (!['pending', 'unknown'].includes(record.status)) return failure('FINAL_RESULT');
		record.status = command.status; record.evidence = command.evidence;
	} else if (command.type === 'batch.create') {
		if (!validId(command.id) || !validPeriod(command.period) || !Array.isArray(command.courierIds) || !command.courierIds.length || new Set(command.courierIds).size !== command.courierIds.length || batches.some(item => item.id === command.id)) return failure('INVALID_BATCH');
		const instructions: Instruction[] = [];
		for (const courierId of command.courierIds) {
			if (!sellerIds(event.operatorId, state).includes(courierId)) return failure('UNKNOWN_RELATIONSHIP');
			const profile = state.sellers[event.operatorId]?.find(item => item.courierId === courierId);
			if (sellerBlockers(profile, event.at, documents).length) return failure(`INELIGIBLE:${courierId}`);
			const amountMinor = balance(state, event.operatorId, courierId, command.period).available;
			if (amountMinor <= 0) return failure('INSUFFICIENT_BALANCE');
			instructions.push({ id: `${command.id}:${courierId}`, courierId, amountMinor, account: profile!.account, status: 'pending', attempts: 0, evidence: '' });
		}
		batches.push({ id: command.id, period: command.period, author: actor.id, at: event.at, instructions, cancelled: false });
	} else {
		const batch = batches.find(item => item.id === command.id);
		if (!batch || batch.cancelled) return failure('UNKNOWN_BATCH');
		if (command.type === 'batch.cancel') {
			if (batch.instructions.some(item => item.attempts > 0 || item.status !== 'pending')) return failure('RECONCILIATION_REQUIRED');
			batch.cancelled = true;
		} else if (command.type === 'batch.approve') {
			if (batch.approvedBy) return batch.approvedBy === actor.id ? { ok: true, state } : failure('ALREADY_APPROVED');
			if (actor.id === batch.author) return failure('SECOND_APPROVER_REQUIRED');
			for (const item of batch.instructions) {
				const profile = state.sellers[event.operatorId]?.find(profile => profile.courierId === item.courierId);
				if (sellerBlockers(profile, event.at, documents).length || profile?.account !== item.account || balance(state, event.operatorId, item.courierId, batch.period).available < 0) return failure('BATCH_STALE');
			}
			batch.approvedBy = actor.id;
		} else if (command.type === 'batch.result' || command.type === 'batch.retry') {
			if (!batch.approvedBy) return failure('APPROVAL_REQUIRED');
			const item = batch.instructions.find(item => item.id === command.instructionId);
			if (!item) return failure('UNKNOWN_INSTRUCTION');
			if (command.type === 'batch.retry') {
				if (item.status !== 'rejected') return failure('RECONCILIATION_REQUIRED');
				const profile = state.sellers[event.operatorId]?.find(profile => profile.courierId === item.courierId);
				if (sellerBlockers(profile, event.at, documents).length || profile?.account !== item.account || balance(state, event.operatorId, item.courierId, batch.period).available < item.amountMinor) return failure('BATCH_STALE');
				item.status = 'pending'; item.evidence = ''; item.awaitingResult = false;
			} else {
				if (!['pending', 'paid', 'rejected', 'unknown'].includes(command.status) || !command.evidence?.trim() || command.evidence.length > 500) return failure('INVALID_RESULT');
				if (item.status === command.status && item.evidence === command.evidence) return { ok: true, state };
				if (['paid', 'rejected'].includes(item.status) || item.status === 'unknown' && !['paid', 'rejected'].includes(command.status)) return failure('FINAL_RESULT');
				if (item.status === 'pending' && !item.awaitingResult) {
					const profile = state.sellers[event.operatorId]?.find(profile => profile.courierId === item.courierId);
					if (sellerBlockers(profile, event.at, documents).length || profile?.account !== item.account || balance(state, event.operatorId, item.courierId, batch.period).available < 0) return failure('BATCH_STALE');
				}
				item.status = command.status; item.evidence = command.evidence; item.attempts++; item.awaitingResult = ['pending', 'unknown'].includes(command.status);
			}
		} else return failure('UNKNOWN_COMMAND');
	}
	return { ok: true, state: next };
}