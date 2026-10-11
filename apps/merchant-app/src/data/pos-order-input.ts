import type { CreateOrderInput, Terminal } from './merchant-data-gateway';

export function buildPosOrderInput(
	merchantId: string,
	terminal: Terminal,
	amount: number,
	createdAt = new Date(),
	tableOrderTtlSeconds = 1800
): CreateOrderInput {
	const normalizedTtl = Number.isFinite(tableOrderTtlSeconds) && tableOrderTtlSeconds > 0
		? tableOrderTtlSeconds : 1800;
	const ttl = terminal.type === 'kasa' ? null : terminal.type === 'nfc_tag' ? 300 : normalizedTtl;
	const match = terminal.type === 'table' ? terminal.code.match(/\d+/) : null;
	return {
		type: 'table', amount, merchantId,
		entityId: terminal.entityId,
		terminalId: terminal.id,
		orderNumber: terminal.code,
		title: `POS Стіл (${terminal.code})`,
		tableNumber: match ? Number.parseInt(match[0], 10) : null,
		status: 'pending',
		expiresAt: ttl === null ? null : new Date(createdAt.getTime() + ttl * 1000).toISOString()
	};
}