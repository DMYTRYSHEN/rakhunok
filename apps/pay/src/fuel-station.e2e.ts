import { expect, test } from '@playwright/test';

test('requires an exact station quote before opening the existing payment sheet', async ({
	page
}) => {
	await page.goto('/pay/?demo=fuel_station');

	await expect(page.getByRole('heading', { name: 'Оберіть колонку' })).toBeVisible();
	await page.getByRole('button', { name: /1 Пістолет підключено/ }).click();
	await page.getByRole('button', { name: 'Продовжити' }).click();

	await expect(page.getByRole('heading', { name: 'Оберіть пальне' })).toBeVisible();
	await page.getByRole('button', { name: /A-95/ }).click();
	await page.getByRole('button', { name: 'Продовжити' }).click();

	const payButton = page.getByRole('button', { name: /Перейти до оплати · 1\s?190,00 ₴/ });
	await expect(payButton).toBeEnabled();
	await page.getByRole('button', { name: 'Збільшити' }).click();
	await expect(page.getByRole('button', { name: 'Очікуємо ціну АЗС' })).toBeDisabled();
	await page.getByRole('button', { name: 'Зменшити' }).click();
	await expect(payButton).toBeEnabled();

	await payButton.click();
	await expect(page.locator('.payment-sheet')).toHaveClass(/open/);
	await expect(page.locator('.payment-sheet .amount').getByRole('status')).toHaveAccessibleName(
		/1\s?190,00 ₴/
	);
	await expect(page.getByText('Інші способи оплати та промокод')).toBeVisible();
});
