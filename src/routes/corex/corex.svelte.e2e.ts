import { expect, test } from '@playwright/test';

test('does not expose the Corex editor without an authenticated session', async ({ page }) => {
	await page.goto('/corex');

	await expect(page.getByRole('heading', { name: 'Вхід у Rahunok' })).toBeVisible();
	await expect(page.getByLabel('Полотно процесу')).not.toBeVisible();
	await expect(page.getByRole('button', { name: 'Опублікувати' })).not.toBeVisible();
});