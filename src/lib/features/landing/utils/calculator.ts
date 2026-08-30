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
	const formatted = new Intl.NumberFormat('uk-UA', {
		minimumFractionDigits: 0,
		maximumFractionDigits: 2
	}).format(value);
	return `${formatted} ₴`;
}
