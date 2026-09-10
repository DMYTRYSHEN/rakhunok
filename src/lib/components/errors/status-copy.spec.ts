import { describe, expect, it } from 'vitest';
import { statusCopy } from './status-copy';

describe('safe error copy', () => {
	it.each([
		[401, 'Потрібен вхід'],
		[403, 'Доступ обмежено'],
		[404, 'Сторінку не знайдено'],
		[429, 'Забагато запитів'],
		[500, 'Не вдалося відкрити сторінку'],
		[503, 'Не вдалося відкрити сторінку'],
		[400, 'Запит не виконано']
	])('maps HTTP %i to trusted copy', (status, title) => {
		expect(statusCopy(status as number)).toMatchObject({ status, title });
	});
	it.each([NaN, Infinity, -1, 200, 600, 404.5])('normalizes invalid status %s', (status) => {
		expect(statusCopy(status)).toEqual(statusCopy(500));
	});
	it('does not promise an automatic retry for rate limiting', () => {
		expect(statusCopy(429).description).toContain('не оновлюється автоматично');
	});
});