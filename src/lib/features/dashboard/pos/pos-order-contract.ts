import type { PosActiveOrder, PosTerminal } from '../types';
import { getPosDraftTotal, type PosDraft } from './pos-drafts';

export const DEFAULT_TABLE_ORDER_TTL_SECONDS = 1_800;
export const TAG_ORDER_TTL_SECONDS = 300;

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
	expires_at: string | null;
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
	createdAt = new Date(),
	tableOrderTtlSeconds = DEFAULT_TABLE_ORDER_TTL_SECONDS
): PosOrderContractResult {
	if (!terminal.isActive) return { ok: false, reason: 'inactive-terminal' };

	const amount = getPosDraftTotal(draft);
	if (!Number.isFinite(amount) || amount <= 0) return { ok: false, reason: 'empty-order' };
	const normalizedTableTtlSeconds =
		Number.isFinite(tableOrderTtlSeconds) && tableOrderTtlSeconds > 0
			? tableOrderTtlSeconds
			: DEFAULT_TABLE_ORDER_TTL_SECONDS;
	const ttlSeconds =
		terminal.type === 'kasa'
			? null
			: terminal.type === 'nfc_tag'
				? TAG_ORDER_TTL_SECONDS
				: normalizedTableTtlSeconds;
	const expiresAt = ttlSeconds === null ? null : new Date(createdAt.getTime() + ttlSeconds * 1_000);

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
			expires_at: expiresAt?.toISOString() ?? null,
			terminal_id: terminal.id
		}
	};
}

export function decideLegacyPosOrderCreation(
	merchantId: string,
	terminal: PosTerminal,
	draft: PosDraft,
	activeOrders: PosActiveOrder[],
	createdAt = new Date(),
	tableOrderTtlSeconds = DEFAULT_TABLE_ORDER_TTL_SECONDS
): PosOrderCreationDecision {
	const existingOrder = activeOrders
		.filter((order) => order.terminalId === terminal.id && order.status === 'pending')
		.sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];

	if (existingOrder) return { status: 'blocked', reason: 'active-order', order: existingOrder };

	const contract = buildLegacyPosOrderInsert(
		merchantId,
		terminal,
		draft,
		createdAt,
		tableOrderTtlSeconds
	);
	if (!contract.ok) return { status: 'invalid', reason: contract.reason };

	return { status: 'ready', payload: contract.payload };
}
