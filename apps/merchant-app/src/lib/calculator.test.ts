import { describe, expect, it } from 'vitest';
import { evaluateAmount, formatAmount } from './calculator';

describe('evaluateAmount', () => {
	it('returns zero for an empty amount', () => {
		expect(evaluateAmount('')).toBe(0);
	});

	it('evaluates addition and subtraction', () => {
		expect(evaluateAmount('120.50+30-10.25')).toBe(140.25);
	});

	it('evaluates multiplication and division with standard precedence', () => {
		expect(evaluateAmount('10+6×3÷2')).toBe(19);
	});

	it('rejects division by zero', () => {
		expect(evaluateAmount('12÷0')).toBeNull();
	});

	it('accepts an unfinished trailing operator', () => {
		expect(evaluateAmount('25+')).toBe(25);
	});

	it('rounds floating point results to kopiykas', () => {
		expect(evaluateAmount('0.10+0.20')).toBe(0.3);
	});

	it('rejects malformed and negative results', () => {
		expect(evaluateAmount('1.234')).toBeNull();
		expect(evaluateAmount('10-11')).toBeNull();
	});
});

describe('formatAmount', () => {
	it('groups thousands and preserves entered decimals', () => {
		expect(formatAmount('12345.60')).toBe('12 345.60');
	});

	it('keeps expressions visible with a typographic minus', () => {
		expect(formatAmount('120-20')).toBe('120−20');
	});
});