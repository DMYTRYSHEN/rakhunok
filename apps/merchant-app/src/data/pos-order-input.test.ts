import { describe, expect, it } from 'vitest';
import { buildPosOrderInput } from './pos-order-input';
import { createPosDraft } from '../../../../src/lib/features/dashboard/pos/pos-drafts';
import type { Terminal } from './merchant-data-gateway';

describe('App creation matches Dashboard POS', () => {
	it.each([
		['table', '57g66j'], ['table', 'table-30'], ['table', '7'],
		['table', 'testing'], ['nfc_tag', '57g66j'], ['kasa', '7']
	] as const)('matches %s code %s including configured expiry', async (type, code) => {
		const contractPath = new URL('../../../../src/lib/features/dashboard/pos/pos-order-contract.ts', import.meta.url).href;
		const { buildLegacyPosOrderInsert } = await import(contractPath);
		const terminal: Terminal = { id: 'terminal', entityId: 'entity', name: 'Terminal', type, code };
		const createdAt = new Date('2026-10-05T08:00:00Z');
		const expected = buildLegacyPosOrderInsert('merchant', { ...terminal, isActive: true },
			{ ...createPosDraft(), inputAmount: '66' }, createdAt, 900);
		expect(expected.ok).toBe(true);
		if (!expected.ok) throw new Error('Expected valid POS draft');
		expect(buildPosOrderInput('merchant', terminal, 66, createdAt, 900)).toEqual({
			type: expected.payload.type, amount: expected.payload.base_amount,
			merchantId: expected.payload.merchant_id, entityId: expected.payload.entity_id,
			terminalId: expected.payload.terminal_id, orderNumber: expected.payload.order_number,
			title: expected.payload.title, tableNumber: expected.payload.table_number,
			status: expected.payload.status, expiresAt: expected.payload.expires_at
		});
	});
});