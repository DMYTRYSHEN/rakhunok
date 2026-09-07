export function compareMonthlyCosts(
	turnover: number | undefined,
	currentRate: number | undefined,
	rent: number | undefined,
	fee: number | undefined,
	rate: number | undefined
): { current: number; proposed: number; difference: number } | null {
	const values = [turnover, currentRate, rent, fee, rate];
	if (values.some((value) => value === undefined || !Number.isFinite(value) || value < 0)) return null;
	if (currentRate! > 100 || rate! > 100) return null;
	const current = turnover! * currentRate! / 100 + rent!;
	const proposed = turnover! * rate! / 100 + fee!;
	if (!Number.isFinite(current) || !Number.isFinite(proposed)) return null;
	return { current, proposed, difference: current - proposed };
}