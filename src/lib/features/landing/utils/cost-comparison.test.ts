import { describe, expect, it } from 'vitest';
import { compareMonthlyCosts } from './cost-comparison';

describe('monthly cost comparison', () => {
	it('deducts subscription and negotiated commission', () => {
		expect(compareMonthlyCosts(300000, 1.5, 400, 490, 0.5)).toEqual({ current: 4900, proposed: 1990, difference: 2910 });
	});
	it('does not assume missing fees are zero', () => {
		expect(compareMonthlyCosts(300000, 1.5, 400, undefined, undefined)).toBeNull();
	});
	it('accepts explicitly agreed zero fees', () => {
		expect(compareMonthlyCosts(10000, 1, 0, 0, 0)?.difference).toBe(100);
	});
	it('shows negative differences', () => {
		expect(compareMonthlyCosts(10000, 1, 0, 490, 1)?.difference).toBe(-490);
	});
	it('rejects invalid values', () => {
		for (const value of [-1, NaN, Infinity, undefined]) expect(compareMonthlyCosts(value, 1, 0, 490, 0)).toBeNull();
		expect(compareMonthlyCosts(10000, 101, 0, 490, 0)).toBeNull();
	});
});