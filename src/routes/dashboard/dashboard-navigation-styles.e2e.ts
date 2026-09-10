import { expect, test, type Locator } from '@playwright/test';

async function appearance(locator: Locator) {
	return locator.evaluate((element) => {
		const style = getComputedStyle(element);
		return {
			background: style.backgroundColor,
			color: style.color,
			border: style.borderTopWidth,
			borderColor: style.borderTopColor,
			radius: style.borderRadius,
			fontSize: style.fontSize,
			fontWeight: style.fontWeight,
			lineHeight: style.lineHeight
		};
	});
}

for (const theme of ['light', 'dark']) {
	for (const width of [390, 1440]) {
		test(`landing navigation preserves dashboard controls (${theme}, ${width}px)`, async ({ page }) => {
			test.setTimeout(60_000);
			await page.addInitScript((value) => localStorage.setItem('rahunok_theme', value), theme);
			await page.setViewportSize({ width, height: 900 });
			await page.goto('/dashboard/pos?demo=1');
			const cash = page.getByRole('button', { name: 'Готівкою', exact: true });
			const cancel = page.getByRole('button', { name: 'Скасувати замовлення', exact: true });
			const draft = page.getByRole('button', { name: 'Нове замовлення (чернетка)' }).first();
			await expect(cash).toBeVisible();
			const baseline = await Promise.all([appearance(cash), appearance(cancel), appearance(draft)]);
			expect(baseline[0].background).not.toBe('rgba(0, 0, 0, 0)');
			expect(baseline[1].border).toBe('1px');

			await page.goto('/?lang=uk');
			await expect(page.locator('.site-header')).toBeVisible();
			// Wait for hydration through an observable interaction, not a timer.
			const themeToggle = page.locator('.site-header .theme-toggle');
			await themeToggle.click();
			await expect(themeToggle).toHaveAttribute('aria-pressed', 'false');
			await themeToggle.click();
			await expect(themeToggle).toHaveAttribute('aria-pressed', 'true');
			if (width < 768) await page.getByRole('button', { name: 'Відкрити меню', exact: true }).click();
			// Use the real visible internal account link with a no-write demo fixture.
			const account = page.locator('.site-header a[href*="dashboard"]:visible').first();
			await account.evaluate((element) => {
				element.setAttribute('href', '/dashboard/pos?demo=1');
				document.documentElement.dataset.navigationStyleProbe = 'same-document';
			});
			await account.click();
			await expect(cash).toBeVisible();
			await expect(page.locator('html')).toHaveAttribute('data-navigation-style-probe', 'same-document');
			for (const [index, control] of [cash, cancel, draft].entries()) {
				await expect.poll(() => appearance(control), { message: `Control ${index} changed after SPA navigation` })
					.toEqual(baseline[index]);
			}
			await expect(cash).toBeEnabled();
			await expect(cancel).toBeEnabled();
			expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);

			await page.reload();
			await expect(cash).toBeVisible();
			expect(await Promise.all([appearance(cash), appearance(cancel), appearance(draft)])).toEqual(baseline);
		});
	}
}