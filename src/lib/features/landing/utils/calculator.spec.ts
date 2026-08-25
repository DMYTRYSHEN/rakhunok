import { describe, expect, it } from 'vitest';
import { calculateAcquiringCosts } from './calculator';

describe('calculateAcquiringCosts', () => {
	it('matches the legacy calculator defaults', () => {
		expect(calculateAcquiringCosts(500_000, 1.5, 2)).toEqual({
			annualCommission: 90_000,
			annualRent: 9_600,
			annualCost: 99_600
		});
	});

	it('allows a zero-terminal scenario', () => {
		expect(calculateAcquiringCosts(50_000, 0.5, 0).annualRent).toBe(0);
	});
});
