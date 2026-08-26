import type { PosActiveOrder, PosTerminal } from '../types';
import { getPosDraftTotal, type PosDraft } from './pos-drafts';

export type LegacyPosOrderInsert = {
	merchant_id: string;
	type: 'table';
	order_number: string;
	title: string;
	base_amount: number;
	total_amount: number;
	currency: 'UAH';
	status: 'pending';
	created_at: string;
	terminal_id: string;
};

export type PosOrderContractResult =
	| { ok: true; payload: LegacyPosOrderInsert }
	| { ok: false; reason: 'empty-order' | 'inactive-terminal' };

export type PosOrderCreationDecision =
	| { status: 'ready'; payload: LegacyPosOrderInsert }
	| { status: 'blocked'; reason: 'active-order'; order: PosActiveOrder }
	| { status: 'invalid'; reason: 'empty-order' | 'inactive-terminal' };

export function buildLegacyPosOrderInsert(
	merchantId: string,
	terminal: PosTerminal,
	draft: PosDraft,
	createdAt = new Date()
): PosOrderContractResult {
	if (!terminal.isActive) return { ok: false, reason: 'inactive-terminal' };

	const amount = getPosDraftTotal(draft);
	if (!Number.isFinite(amount) || amount <= 0) return { ok: false, reason: 'empty-order' };

	return {
		ok: true,
		payload: {
			merchant_id: merchantId,
			type: 'table',
			order_number: terminal.code,
			title: `POS Стіл (${terminal.code})`,
			base_amount: amount,
			total_amount: amount,
			currency: 'UAH',
			status: 'pending',
			created_at: createdAt.toISOString(),
			terminal_id: terminal.id
		}
	};
}

export function decideLegacyPosOrderCreation(
	merchantId: string,
	terminal: PosTerminal,
	draft: PosDraft,
	activeOrders: PosActiveOrder[],
	createdAt = new Date()
): PosOrderCreationDecision {
	const existingOrder = activeOrders
		.filter((order) => order.terminalId === terminal.id && order.status === 'pending')
		.sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];

	if (existingOrder) return { status: 'blocked', reason: 'active-order', order: existingOrder };

	const contract = buildLegacyPosOrderInsert(merchantId, terminal, draft, createdAt);
	if (!contract.ok) return { status: 'invalid', reason: contract.reason };

	return { status: 'ready', payload: contract.payload };
}
