import { render } from 'svelte/server';
import { describe, expect, it, vi } from 'vitest';
import LiquidPaymentButton from './LiquidPaymentButton.svelte';

const waitingOrder = {
	id: 'order-123',
	amount: 500,
	status: 'pending',
	createdAt: '2026-09-16T10:00:00Z',
	orderNumber: 'APP-123',
	type: 'table',
	shareUrl: 'https://example.com/pay/order-123',
	terminalId: 'terminal-1'
};

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

	it('renders all three table invoice entry QR routes as a carousel', () => {
		const output = render(LiquidPaymentButton, {
			props: {
				amount: 500,
				formattedAmount: '500',
				scenario: 'table',
				open: true,
				selectedOrder: waitingOrder,
				terminals: [{ id: 'terminal-1', name: 'Стіл 1', code: 'table-1', type: 'table', entityId: 'entity-1' }],
				origin: 'https://example.com',
				onSubmitOrder: vi.fn()
			}
		}).body;

		expect(output).toContain('Очікуємо оплату');
		expect(output).toContain('https://example.com/tag/table-1');
		expect(output).toContain('https://example.com/pos/order-123');
		expect(output).toContain('https://example.com/pay/order-123');
		expect(output).toContain('1 / 3');
		expect(output.match(/Показати /g)).toHaveLength(3);
		expect(output).toContain('Поділитися');
		expect(output).toContain('Надіслати в Telegram');
	});

	it.each([
		['fixed', 'o'],
		['open_amount', 't']
	])('renders only invoice-specific entries for %s orders', (type, route) => {
		const output = render(LiquidPaymentButton, {
			props: {
				amount: type === 'open_amount' ? 0 : 500,
				formattedAmount: type === 'open_amount' ? '0' : '500',
				scenario: type === 'open_amount' ? 'open' : 'fixed',
				open: true,
				selectedOrder: { ...waitingOrder, type, terminalId: undefined },
				origin: 'https://example.com',
				onSubmitOrder: vi.fn()
			}
		}).body;

		expect(output).toContain(`https://example.com/${route}/order-123`);
		expect(output).toContain('https://example.com/pay/order-123');
		expect(output).toContain('1 / 2');
		expect(output).not.toContain('/tag/');
		expect(output).not.toContain('/pos/');
	});

	it('renders a confirmed state for paid orders', () => {
		const output = render(LiquidPaymentButton, {
			props: {
				amount: 500,
				formattedAmount: '500',
				scenario: 'table',
				open: true,
				selectedOrder: { ...waitingOrder, status: 'paid' },
				onSubmitOrder: vi.fn()
			}
		}).body;

		expect(output).toContain('Оплату отримано');
		expect(output).toContain('Платіж підтверджено');
	});

	it.each([
		['sending', 'Надсилаємо...', 'Перевіряємо доставку'],
		['sent', 'Надіслано', 'Рахунок надіслано в Telegram.'],
		['unknown', 'Надіслати в Telegram', 'Перевірте чат перед повтором']
	] as const)('renders the Telegram %s state independently from generic sharing', (telegramAction, buttonText, message) => {
		const output = render(LiquidPaymentButton, {
			props: {
				amount: 500,
				formattedAmount: '500',
				scenario: 'fixed',
				open: true,
				selectedOrder: { ...waitingOrder, type: 'fixed', terminalId: undefined },
				telegramAction,
				telegramActionMessage: message,
				onSubmitOrder: vi.fn()
			}
		}).body;

		expect(output).toContain(buttonText);
		expect(output).toContain(message);
		expect(output).toContain('Поділитися');
		if (telegramAction === 'sending') expect(output).toContain('disabled');
		if (telegramAction === 'unknown') expect(output).toContain('telegram-unknown');
	});

	it('hides payment QR and actions for cancelled orders', () => {
		const output = render(LiquidPaymentButton, {
			props: {
				amount: 500,
				formattedAmount: '500',
				scenario: 'table',
				open: true,
				selectedOrder: { ...waitingOrder, status: 'cancelled' },
				onSubmitOrder: vi.fn()
			}
		}).body;

		expect(output).toContain('Скасовано');
		expect(output).not.toContain('payment-qr-frame');
		expect(output).not.toContain('qr-carousel');
		expect(output).not.toContain('Поділитися');
		expect(output).not.toContain('Надіслати в Telegram');
		expect(output).not.toContain('Копіювати');
	});
});
