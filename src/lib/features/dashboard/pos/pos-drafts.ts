export type PosDraftItem = {
	id: string;
	name: string;
	price: number;
	quantity: number;
};

export type PosDraft = {
	items: PosDraftItem[];
	inputAmount: string;
	formula: string;
	memo: string;
	hasEvaluated: boolean;
};

export type PosDraftsState = {
	activeTerminalId: string;
	drafts: Record<string, PosDraft>;
};

export type PosDraftAction =
	| { type: 'select-terminal'; terminalId: string }
	| { type: 'press-key'; key: string }
	| { type: 'add-amount'; amount: number }
	| { type: 'set-memo'; memo: string }
	| { type: 'add-item'; item: Omit<PosDraftItem, 'quantity'> }
	| { type: 'change-quantity'; itemId: string; delta: number }
	| { type: 'clear' };

const EMPTY_TERMINAL_ID = '';
const operators = new Set(['+', '−', '×', '÷']);

export function createPosDraft(): PosDraft {
	return { items: [], inputAmount: '0', formula: '', memo: '', hasEvaluated: false };
}

export function createPosDraftsState(): PosDraftsState {
	return { activeTerminalId: EMPTY_TERMINAL_ID, drafts: { [EMPTY_TERMINAL_ID]: createPosDraft() } };
}

export function getPosDraft(state: PosDraftsState, terminalId = state.activeTerminalId): PosDraft {
	return state.drafts[terminalId] ?? createPosDraft();
}

export function getPosDraftTotal(draft: PosDraft): number {
	const itemTotal = draft.items.reduce((total, item) => total + item.price * item.quantity, 0);
	return itemTotal || Number.parseFloat(draft.inputAmount) || 0;
}

export function reducePosDrafts(state: PosDraftsState, action: PosDraftAction): PosDraftsState {
	if (action.type === 'select-terminal') {
		return {
			activeTerminalId: action.terminalId,
			drafts: state.drafts[action.terminalId]
				? state.drafts
				: { ...state.drafts, [action.terminalId]: createPosDraft() }
		};
	}

	const terminalId = state.activeTerminalId;
	const draft = getPosDraft(state);
	let nextDraft = draft;

	switch (action.type) {
		case 'press-key':
			nextDraft = pressCalculatorKey(draft, action.key);
			break;
		case 'add-amount':
			nextDraft = {
				...draft,
				inputAmount: String((Number.parseFloat(draft.inputAmount) || 0) + action.amount),
				hasEvaluated: false
			};
			break;
		case 'set-memo':
			nextDraft = { ...draft, memo: action.memo };
			break;
		case 'add-item': {
			const existing = draft.items.find((item) => item.id === action.item.id);
			nextDraft = {
				...draft,
				items: existing
					? draft.items.map((item) =>
							item.id === action.item.id ? { ...item, quantity: item.quantity + 1 } : item
						)
					: [...draft.items, { ...action.item, quantity: 1 }]
			};
			break;
		}
		case 'change-quantity':
			nextDraft = {
				...draft,
				items: draft.items
					.map((item) =>
						item.id === action.itemId ? { ...item, quantity: item.quantity + action.delta } : item
					)
					.filter((item) => item.quantity > 0)
			};
			break;
		case 'clear':
			nextDraft = createPosDraft();
	}

	return { ...state, drafts: { ...state.drafts, [terminalId]: nextDraft } };
}

function pressCalculatorKey(draft: PosDraft, key: string): PosDraft {
	if (key === 'C') return { ...createPosDraft(), items: draft.items, memo: draft.memo };
	if (key === '⌫') {
		return {
			...draft,
			inputAmount: draft.inputAmount.length > 1 ? draft.inputAmount.slice(0, -1) : '0'
		};
	}
	if (operators.has(key)) {
		return {
			...draft,
			formula: `${draft.formula ? `${draft.formula} ` : ''}${draft.inputAmount} ${key}`,
			inputAmount: '0',
			hasEvaluated: false
		};
	}
	if (key === '=') {
		if (!draft.formula || draft.hasEvaluated) return draft;
		const expression = `${draft.formula} ${draft.inputAmount}`;
		const result = evaluateExpression(expression);
		return result === null
			? draft
			: { ...draft, formula: `${expression} =`, inputAmount: String(result), hasEvaluated: true };
	}
	if (key === '.') {
		return draft.inputAmount.includes('.')
			? draft
			: { ...draft, inputAmount: `${draft.inputAmount}.` };
	}
	if (key === '00') {
		return draft.inputAmount !== '0' && draft.inputAmount.length < 7
			? { ...draft, inputAmount: `${draft.inputAmount}00` }
			: draft;
	}
	if (!/^\d$/.test(key)) return draft;
	if (draft.inputAmount === '0' || draft.hasEvaluated) {
		return {
			...draft,
			inputAmount: key,
			formula: draft.hasEvaluated ? '' : draft.formula,
			hasEvaluated: false
		};
	}
	return draft.inputAmount.length < 8
		? { ...draft, inputAmount: `${draft.inputAmount}${key}` }
		: draft;
}

function evaluateExpression(expression: string): number | null {
	const tokens = expression.trim().split(/\s+/);
	if (tokens.length < 3 || tokens.length % 2 === 0) return null;

	const values: number[] = [];
	const pendingOperators: string[] = [];
	const precedence = (operator: string) => (operator === '×' || operator === '÷' ? 2 : 1);
	const applyTopOperator = () => {
		const right = values.pop();
		const left = values.pop();
		const operator = pendingOperators.pop();
		if (
			left === undefined ||
			right === undefined ||
			!operator ||
			(operator === '÷' && right === 0)
		) {
			return false;
		}
		const result =
			operator === '+'
				? left + right
				: operator === '−'
					? left - right
					: operator === '×'
						? left * right
						: left / right;
		values.push(result);
		return Number.isFinite(result);
	};

	for (let index = 0; index < tokens.length; index += 1) {
		const token = tokens[index];
		if (index % 2 === 0) {
			const value = Number(token);
			if (!Number.isFinite(value)) return null;
			values.push(value);
			continue;
		}
		if (!operators.has(token)) return null;
		while (
			pendingOperators.length &&
			precedence(pendingOperators[pendingOperators.length - 1]) >= precedence(token)
		) {
			if (!applyTopOperator()) return null;
		}
		pendingOperators.push(token);
	}

	while (pendingOperators.length) if (!applyTopOperator()) return null;
	return values.length === 1 ? values[0] : null;
}
