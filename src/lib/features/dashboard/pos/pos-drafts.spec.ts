import { describe, expect, it } from 'vitest';
import {
	createPosDraftsState,
	getPosDraft,
	getPosDraftTotal,
	reducePosDrafts,
	type PosDraftAction,
	type PosDraftsState
} from './pos-drafts';

function apply(state: PosDraftsState, ...actions: PosDraftAction[]) {
	return actions.reduce(reducePosDrafts, state);
}

describe('POS drafts', () => {
	it('keeps an independent draft for every terminal', () => {
		const state = apply(
			createPosDraftsState(),
			{ type: 'select-terminal', terminalId: 'table-1' },
			{ type: 'press-key', key: '5' },
			{ type: 'add-item', item: { id: 'coffee', name: 'Кава', price: 80 } },
			{ type: 'select-terminal', terminalId: 'table-2' },
			{ type: 'press-key', key: '9' },
			{ type: 'select-terminal', terminalId: 'table-1' }
		);

		expect(getPosDraft(state)).toMatchObject({ inputAmount: '5' });
		expect(getPosDraft(state).items).toEqual([
			{ id: 'coffee', name: 'Кава', price: 80, quantity: 1 }
		]);
		expect(getPosDraft(state, 'table-2').inputAmount).toBe('9');
	});

	it('calculates keypad expressions and starts fresh after a result', () => {
		const state = apply(
			createPosDraftsState(),
			{ type: 'press-key', key: '2' },
			{ type: 'press-key', key: '+' },
			{ type: 'press-key', key: '3' },
			{ type: 'press-key', key: '×' },
			{ type: 'press-key', key: '4' },
			{ type: 'press-key', key: '=' }
		);

		expect(getPosDraft(state)).toMatchObject({ inputAmount: '14', hasEvaluated: true });
		expect(getPosDraft(apply(state, { type: 'press-key', key: '7' }))).toMatchObject({
			inputAmount: '7',
			formula: '',
			hasEvaluated: false
		});
	});

	it('updates quantities immutably and removes an item at zero', () => {
		const initial = apply(createPosDraftsState(), {
			type: 'add-item',
			item: { id: 'tea', name: 'Чай', price: 120 }
		});
		const increased = apply(initial, {
			type: 'add-item',
			item: { id: 'tea', name: 'Чай', price: 120 }
		});
		const removed = apply(increased, { type: 'change-quantity', itemId: 'tea', delta: -2 });

		expect(getPosDraft(initial).items[0].quantity).toBe(1);
		expect(getPosDraftTotal(getPosDraft(increased))).toBe(240);
		expect(getPosDraft(removed).items).toEqual([]);
	});

	it('uses cart total before the manually entered amount', () => {
		const amountOnly = apply(createPosDraftsState(), { type: 'add-amount', amount: 150 });
		const withItem = apply(amountOnly, {
			type: 'add-item',
			item: { id: 'croissant', name: 'Круасан', price: 95 }
		});

		expect(getPosDraftTotal(getPosDraft(amountOnly))).toBe(150);
		expect(getPosDraftTotal(getPosDraft(withItem))).toBe(95);
	});
});
