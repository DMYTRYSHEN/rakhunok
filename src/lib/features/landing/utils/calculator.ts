export type AcquiringCosts = {
	annualCommission: number;
	annualRent: number;
	annualCost: number;
};

export function calculateAcquiringCosts(
	monthlyTurnover: number,
	feePercent: number,
	terminals: number
): AcquiringCosts {
	const annualCommission = monthlyTurnover * 12 * (feePercent / 100);
	const annualRent = terminals * 400 * 12;

	return {
		annualCommission,
		annualRent,
		annualCost: annualCommission + annualRent
	};
}

export function formatMoney(value: number): string {
	return new Intl.NumberFormat('uk-UA', {
		style: 'currency',
		currency: 'UAH',
		maximumFractionDigits: 0
	}).format(value);
}
