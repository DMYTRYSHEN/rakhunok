import { expect, test } from '@playwright/test';

test('loads the independently deployed dashboard as a new document', async ({ page }) => {
	await page.goto('/');

	const dashboardLinks = page.locator('a[href$="dashboard"]');
	await expect(dashboardLinks).toHaveCount(2);
	await page.getByRole('button', { name: 'Відкрити меню' }).click();
	await expect(dashboardLinks).toHaveCount(3);
	for (const link of await dashboardLinks.all()) {
		await expect(link).toHaveAttribute('data-sveltekit-reload', '');
		await expect(link).toHaveAttribute('href', /dashboard$/);
	}
});