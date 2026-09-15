import { render } from 'svelte/server';
import { describe, expect, it, vi } from 'vitest';
import LiquidPaymentButton from './LiquidPaymentButton.svelte';

describe('LiquidPaymentButton SSR and component contract', () => {
	it('renders default button text and amount in fixed scenario', () => {
		const output = render(LiquidPaymentButton, {
			props: {
				amount: 500,
				formattedAmount: '500',
				scenario: 'fixed',
				disabled: false,
				onSubmitOrder: vi.fn()
			}
		}).body;

		expect(output).toContain('500 ₴');
		expect(output).toContain('Створити рахунок');
		expect(output).toContain('dock-pay-btn');
	});

	it('renders free amount scenario text', () => {
		const output = render(LiquidPaymentButton, {
			props: {
				amount: 0,
				formattedAmount: '0',
				scenario: 'open',
				disabled: false,
				onSubmitOrder: vi.fn()
			}
		}).body;

		expect(output).toContain('Вільна сума');
	});

	it('reflects disabled state', () => {
		const output = render(LiquidPaymentButton, {
			props: {
				amount: 0,
				formattedAmount: '0',
				scenario: 'fixed',
				disabled: true,
				onSubmitOrder: vi.fn()
			}
		}).body;

		expect(output).toContain('disabled');
	});

	it('does not render decorative noise layers during SSR', () => {
		const output = render(LiquidPaymentButton, {
			props: {
				amount: 100,
				formattedAmount: '100',
				scenario: 'fixed',
				disabled: false,
				onSubmitOrder: vi.fn()
			}
		}).body;

		expect(output).not.toContain('liquid-specular');
		expect(output).not.toContain('liquid-rim');
		expect(output).not.toContain('liquid-caustic');
		expect(output).not.toContain('droplet');
	});
});
