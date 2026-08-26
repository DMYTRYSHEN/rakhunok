import { render } from 'svelte/server';
import { describe, expect, it, vi } from 'vitest';
import InvoiceTimeline from './InvoiceTimeline.svelte';

describe('InvoiceTimeline', () => {
	it('offers a retry action when event loading fails', () => {
		const { body } = render(InvoiceTimeline, {
			props: {
				events: [],
				error: 'Не вдалося завантажити історію рахунку.',
				onRetry: vi.fn()
			}
		});

		expect(body).toContain('role="alert"');
		expect(body).toContain('Не вдалося завантажити історію рахунку.');
		expect(body).toContain('Спробувати ще раз');
	});

	it('prioritizes loading feedback over a stale error', () => {
		const { body } = render(InvoiceTimeline, {
			props: {
				events: [],
				loading: true,
				error: 'Попередня помилка',
				onRetry: vi.fn()
			}
		});

		expect(body).toContain('Завантажуємо історію подій...');
		expect(body).not.toContain('Попередня помилка');
		expect(body).not.toContain('Спробувати ще раз');
	});
});
