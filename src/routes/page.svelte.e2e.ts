import { expect, test } from '@playwright/test';

test('serves the Rahunok landing with preserved navigation', async ({ page }) => {
	await page.goto('/');

	await expect(page).toHaveTitle('Rahunok — оплата напряму на рахунок бізнесу');
	await expect(page.getByRole('heading', { level: 1 })).toContainText('Оплата одразу');
	await expect(page.locator('#payment-flow')).toBeVisible();
	await expect(page.locator('#pricing')).toBeVisible();
	await expect(page.getByRole('link', { name: 'TelegramApp' }).first()).toHaveAttribute(
		'href',
		'/app/'
	);
	await expect(page.getByRole('link', { name: 'Особистий кабінет' }).first()).toHaveAttribute(
		'href',
		'/dashboard/'
	);
});

test('runs the local demo, calculator, and signup flow', async ({ page }) => {
	await page.goto('/');

	await page.getByRole('button', { name: 'Створити QR-рахунок' }).click();
	await expect(page.getByText('₴850').last()).toBeVisible();
	await page.getByRole('button', { name: 'Обрати банк і підтвердити' }).click();
	await expect(page.getByText('Оплату підтверджено').last()).toBeVisible({ timeout: 3_000 });

	await expect(page.getByText('99 600 грн').first()).toBeVisible();

	await page.getByRole('button', { name: 'Створити касу' }).click();
	await expect(page.getByRole('dialog')).toBeVisible();
	await page.getByLabel('Ім’я').fill('Тест');
	await page.getByLabel('Телефон або Telegram').fill('+380501234567');
	await page.getByLabel('Тип бізнесу').selectOption({ label: 'Магазин' });
	await page.getByLabel(/Погоджуюся/).check();
	await page.getByRole('button', { name: 'Надіслати заявку' }).click();
	await expect(page.getByRole('heading', { name: 'Заявку збережено' })).toBeVisible();
});
