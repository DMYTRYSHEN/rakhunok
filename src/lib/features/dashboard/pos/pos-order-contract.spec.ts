import { describe, expect, it } from 'vitest';
import type { PosTerminal } from '../types';
import { createPosDraft, type PosDraft } from './pos-drafts';
import { buildLegacyPosOrderInsert, decideLegacyPosOrderCreation } from './pos-order-contract';

const terminal: PosTerminal = {
	id: 'terminal-1',
	name: 'Стіл 1',
	code: 'table-1',
	type: 'table',
	entityId: 'entity-1',
	isActive: true
};

describe('legacy POS order contract', () => {
	it('matches the canonical browser-side Supabase insert shape', () => {
		const draft: PosDraft = {
			...createPosDraft(),
			items: [{ id: 'coffee', name: 'Капучино', price: 150, quantity: 2 }],
			memo: 'Без цукру'
		};

		expect(
			buildLegacyPosOrderInsert('merchant-1', terminal, draft, new Date('2026-08-26T09:30:00.000Z'))
		).toEqual({
			ok: true,
			payload: {
				merchant_id: 'merchant-1',
				type: 'table',
				order_number: 'table-1',
				title: 'POS Стіл (table-1)',
				base_amount: 300,
				total_amount: 300,
				currency: 'UAH',
				status: 'pending',
				created_at: '2026-08-26T09:30:00.000Z',
				terminal_id: 'terminal-1'
			}
		});
	});

	it('rejects empty drafts before any write can be attempted', () => {
		expect(buildLegacyPosOrderInsert('merchant-1', terminal, createPosDraft())).toEqual({
			ok: false,
			reason: 'empty-order'
		});
	});

	it('rejects inactive terminals', () => {
		expect(
			buildLegacyPosOrderInsert(
				'merchant-1',
				{ ...terminal, isActive: false },
				{
					...createPosDraft(),
					inputAmount: '100'
				}
			)
		).toEqual({ ok: false, reason: 'inactive-terminal' });
	});

	it('blocks creation with the newest pending order for the same terminal', () => {
		const draft = { ...createPosDraft(), inputAmount: '100' };
		const newestPending = {
			id: 'pending-new',
			terminalId: terminal.id,
			title: 'Новий рахунок',
			amount: 250,
			status: 'pending' as const,
			createdAt: '2026-08-26T09:20:00.000Z'
		};

		expect(
			decideLegacyPosOrderCreation('merchant-1', terminal, draft, [
				{ ...newestPending, id: 'paid', status: 'paid' },
				{ ...newestPending, id: 'other-terminal', terminalId: 'terminal-2' },
				{ ...newestPending, id: 'pending-old', createdAt: '2026-08-26T09:10:00.000Z' },
				newestPending
			])
		).toEqual({ status: 'blocked', reason: 'active-order', order: newestPending });
	});

	it('returns the insert payload when no matching pending order exists', () => {
		const draft = { ...createPosDraft(), inputAmount: '100' };

		expect(
			decideLegacyPosOrderCreation(
				'merchant-1',
				terminal,
				draft,
				[],
				new Date('2026-08-26T09:30:00.000Z')
			)
		).toMatchObject({
			status: 'ready',
			payload: {
				merchant_id: 'merchant-1',
				terminal_id: terminal.id,
				total_amount: 100
			}
		});
	});
});
