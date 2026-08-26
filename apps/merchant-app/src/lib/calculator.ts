const OPERATORS = new Set(['+', '-', '*', '/']);

export function evaluateAmount(expression: string): number | null {
	const normalized = expression
		.replace(/\s/g, '')
		.replace(/−/g, '-')
		.replace(/×/g, '*')
		.replace(/÷/g, '/')
		.replace(/[+\-*/]+$/, '');
	if (!normalized || !/^\d+(?:\.\d{0,2})?(?:[+\-*/]\d+(?:\.\d{0,2})?)*$/.test(normalized)) {
		return normalized ? null : 0;
	}

	const tokens = normalized.split(/([+\-*/])/);
	const values = tokens.filter((_, index) => index % 2 === 0).map(Number);
	const operators = tokens.filter((_, index) => index % 2 === 1);
	if (values.some((value) => !Number.isFinite(value)) || operators.some((operator) => !OPERATORS.has(operator))) return null;

	for (let index = 0; index < operators.length; ) {
		const operator = operators[index];
		if (operator !== '*' && operator !== '/') {
			index += 1;
			continue;
		}
		if (operator === '/' && values[index + 1] === 0) return null;
		const value = operator === '*' ? values[index] * values[index + 1] : values[index] / values[index + 1];
		values.splice(index, 2, value);
		operators.splice(index, 1);
	}

	let total = values[0];
	operators.forEach((operator, index) => {
		total = operator === '+' ? total + values[index + 1] : total - values[index + 1];
	});

	return Number.isFinite(total) && total >= 0 ? Math.round(total * 100) / 100 : null;
}

export function formatAmount(value: string): string {
	if (!value) return '0';
	if (/[+\-×÷]/.test(value.slice(1))) return value.replaceAll('-', '−');
	const [whole, decimal] = value.split('.');
	const formattedWhole = Number(whole || 0).toLocaleString('uk-UA');
	return decimal === undefined ? formattedWhole : `${formattedWhole}.${decimal}`;
}