import { expect, test } from '@playwright/test';

test('serves the Rahunok landing with preserved navigation', async ({ page }) => {
	await page.goto('/');

	await expect(page).toHaveTitle(
		'Rahunok — миттєві A2A платежі для бізнесу · PayByBank без термінала'
	);
	await expect(page.locator('html')).toHaveAttribute('lang', 'uk');
	await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
		'href',
		'https://letsrealtalk.com'
	);
	await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
	await expect(page.locator('#payment-flow')).toBeVisible();
	await expect(page.locator('#pricing')).toBeVisible();
	await expect(page.getByRole('link', { name: 'Каса', exact: true }).first()).toHaveAttribute(
		'href',
		'/app/'
	);
	await expect(page.getByRole('link', { name: 'Особистий кабінет' }).first()).toHaveAttribute(
		'href',
		'/dashboard/'
	);

	const footer = page.locator('.site-footer');
	await expect(
		footer.getByText('Сучасна платіжна інфраструктура A2A оплат для бізнесу в Україні.')
	).toBeVisible();
	await expect(footer.getByRole('link', { name: 'Особистий кабінет' })).toHaveAttribute(
		'href',
		'/dashboard/'
	);
	await expect(footer.getByRole('link', { name: '+380 67 669 60 60' })).toHaveAttribute(
		'href',
		'tel:+380676696060'
	);
	await expect(footer.getByRole('link', { name: 'rahunok@rahunok.com' })).toHaveAttribute(
		'href',
		'mailto:rahunok@rahunok.com'
	);
});

test('runs the local demo, calculator, and signup flow', async ({ page }) => {
	await page.goto('/');

	// Demo flow
	await page.getByRole('button', { name: 'Створити платіж' }).click();
	await expect(page.getByText('850 ₴').first()).toBeVisible();
	await page.getByRole('button', { name: 'Акцептувати у А-Банк' }).click();
	await expect(page.getByRole('button', { name: 'Оплату підтверджено ✓' })).toBeVisible({
		timeout: 4_000
	});

	// Calculator verification
	await expect(page.getByText('99 600 ₴').first()).toBeVisible();

	// Signup flow
	await page.getByRole('button', { name: 'Спробувати пілот', exact: true }).first().click();
	const signupDialog = page.getByRole('dialog');
	await expect(signupDialog).toBeVisible();
	await expect(signupDialog.getByText(/демонстраційна форма без мережевого запиту/i)).toBeVisible();
	await signupDialog.getByLabel('Ваше ім’я').fill('Тест');
	await signupDialog.getByLabel('Номер телефону').fill('+380501234567');
	await signupDialog.getByLabel('Назва компанії або закладу').fill('Тестовий бізнес');
	await signupDialog.getByRole('button', { name: 'Надіслати заявку' }).click();
	await expect(signupDialog.getByRole('heading', { name: 'Демо-форма спрацювала' })).toBeVisible();
});
