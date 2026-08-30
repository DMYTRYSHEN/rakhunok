import { expect, test } from '@playwright/test';

test('does not impersonate a merchant without an authenticated session', async ({ page }) => {
	await page.goto('/dashboard/');

	await expect(page.getByRole('heading', { name: 'Вхід у Rahunok' })).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Фінансовий огляд' })).not.toBeVisible();
	await expect(
		page
			.locator('iframe[title*="Google"]')
			.or(page.getByText('Сервіс входу тимчасово недоступний'))
	).toBeAttached();
});

test('renders the dashboard overview with the financial baseline', async ({ page }) => {
	await page.goto('/dashboard/?demo=1');

	await expect(page).toHaveTitle('Огляд бізнесу · Rahunok');
	await expect(page.getByRole('heading', { name: 'Фінансовий огляд' })).toBeVisible();
	await expect(page.getByRole('region', { name: 'Ключові показники' })).toBeVisible();
	await expect(page.getByText('Виручка сьогодні')).toBeVisible();
	await expect(page.getByText('Успішні оплати')).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Останні рахунки' })).toBeVisible();
	await expect(page.getByText('Ознайомчий режим.')).toBeVisible();
	await expect(page.locator('body')).not.toHaveCSS('overflow-x', 'scroll');
});

test('keeps dark theme icons and controls distinguishable', async ({ page }) => {
	await page.addInitScript(() => localStorage.setItem('rahunok_theme', 'dark'));
	await page.goto('/dashboard/team?demo=1');
	await expect(page.getByRole('heading', { name: 'Команда й касири' })).toBeVisible();
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

	const contrastRatio = async (selector: string) =>
		page
			.locator(selector)
			.first()
			.evaluate((element) => {
				const channels = (color: string) => {
					const match = color.match(/[\d.]+/g);
					if (!match || match.length < 3) throw new Error(`Unsupported color: ${color}`);
					return match.slice(0, 3).map(Number);
				};
				const luminance = (color: string) => {
					const linear = channels(color).map((channel) => {
						const value = channel / 255;
						return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
					});
					return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
				};
				const foreground = getComputedStyle(element).color;
				const background = getComputedStyle(element).backgroundColor;
				const lighter = Math.max(luminance(foreground), luminance(background));
				const darker = Math.min(luminance(foreground), luminance(background));
				return (lighter + 0.05) / (darker + 0.05);
			});

	await expect.poll(() => contrastRatio('.bg-zinc-100.text-zinc-700')).toBeGreaterThanOrEqual(3);
	await expect.poll(() => contrastRatio('button:has-text("Запросити")')).toBeGreaterThanOrEqual(3);

	const menuButton = page.getByRole('button', { name: 'Згорнути типи рахунків' });
	await menuButton.focus();
	await expect(menuButton).toBeFocused();
	await expect
		.poll(() => menuButton.evaluate((element) => getComputedStyle(element).outlineStyle))
		.not.toBe('none');
});

test('opens and dismisses the mobile dashboard navigation', async ({ page }) => {
	await page.setViewportSize({ width: 375, height: 812 });
	await page.goto('/dashboard/?demo=1');

	const openNavigation = page.getByRole('button', { name: 'Відкрити навігацію' });
	await openNavigation.click();

	await expect(page.getByRole('navigation', { name: 'Основна навігація' })).toBeVisible();
	await expect(openNavigation).toHaveAttribute('aria-expanded', 'true');
	const homeLink = page.getByRole('link', { name: 'Rahunok, на головну' });
	const merchantMenu = page.getByRole('button', { name: /Rahunok Coffee Власник/ });
	await merchantMenu.focus();
	await page.keyboard.press('Tab');
	await expect(homeLink).toBeFocused();
	await page.keyboard.press('Shift+Tab');
	await expect(merchantMenu).toBeFocused();
	await page.keyboard.press('Escape');
	await expect(openNavigation).toHaveAttribute('aria-expanded', 'false');
	await expect(page.locator('aside')).toHaveAttribute('aria-hidden', 'true');
	await expect(openNavigation).toBeFocused();

	await openNavigation.click();
	await page.getByRole('link', { name: 'Рахунки', exact: true }).click();
	await expect(page).toHaveURL(/\/dashboard\/invoices\?demo=1$/);
	await expect(page.locator('aside')).toHaveAttribute('aria-hidden', 'true');
});

test('opens invoice scenarios from the sidebar and selects the requested form', async ({
	page
}) => {
	await page.goto('/dashboard/?demo=1');

	await expect(page.getByRole('button', { name: 'Згорнути типи рахунків' })).toHaveAttribute(
		'aria-expanded',
		'true'
	);
	const invoiceScenarios = page.locator('#invoice-scenarios');
	await expect(invoiceScenarios.getByRole('link')).toHaveCount(6);
	await expect(invoiceScenarios.getByText('СКОРО')).toHaveCount(2);

	await invoiceScenarios.getByRole('link', { name: /Нова пошта \/ Доставка/ }).click();
	await expect(page).toHaveURL(/\/dashboard\/invoices\/new\?type=delivery&demo=1$/);
	await expect(page.getByRole('button', { name: /Нова пошта \/ Доставка/ })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
	await expect(page.getByRole('textbox', { name: 'Відділення або поштомат' })).toBeVisible();
});

test('adapts payment scenarios to phone and tablet widths', async ({ page }) => {
	for (const viewport of [
		{ width: 390, height: 844, columns: 2 },
		{ width: 820, height: 1180, columns: 3 }
	]) {
		await page.setViewportSize(viewport);
		await page.goto('/dashboard/invoices/new?type=fixed&demo=1');

		const scenarios = page.getByRole('region', { name: 'Бізнес-сценарій оплати' });
		const cards = scenarios.getByRole('button');
		await expect(scenarios).toBeVisible();
		await expect(cards.first()).toHaveAttribute('aria-pressed', 'true');
		await expect(page.getByRole('textbox', { name: 'Номер рахунку' })).toBeVisible();

		const cardRows = await cards.evaluateAll((elements) =>
			elements.slice(0, 3).map((element) => Math.round(element.getBoundingClientRect().top))
		);
		expect(cardRows[0]).toBe(cardRows[1]);
		if (viewport.columns === 3) expect(cardRows[1]).toBe(cardRows[2]);
		else expect(cardRows[2]).toBeGreaterThan(cardRows[1]);
		expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
			viewport.width
		);
	}
});

test('browses, filters, and opens demo invoice details', async ({ page }) => {
	await page.goto('/dashboard/?demo=1');
	await page.getByRole('link', { name: 'Усі рахунки' }).click();

	await expect(page).toHaveURL(/\/dashboard\/invoices\?demo=1$/);
	await expect(page.getByRole('heading', { name: 'Рахунки', exact: true })).toBeVisible();
	await expect(page.getByText('Знайдено:').locator('..')).toContainText('24');
	await expect(page.getByRole('row')).toHaveCount(11);
	const cancellation = page.getByRole('button', { name: 'Скасувати' }).first();
	await expect(cancellation).toBeDisabled();
	await expect(cancellation).toHaveAttribute('title', 'Буде доступно після перевірки політики RLS');

	await page.getByRole('button', { name: 'Наступна сторінка' }).click();
	await expect(page.getByText('2 / 3')).toBeVisible();
	await page.getByRole('searchbox', { name: 'Пошук рахунків' }).fill('INV-1048');
	await expect(page.getByText('Знайдено:').locator('..')).toContainText('1');

	await page.getByRole('link', { name: /INV-1048/ }).click();
	await expect(page).toHaveURL(/\/dashboard\/invoices\/demo-1048\?demo=1$/);
	await expect(page.getByText('INV-1048', { exact: true })).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Замовлення #48' })).toBeVisible();
	await expect(page.getByRole('img', { name: 'QR-код для оплати рахунку' })).toBeVisible();
	await expect(page.getByText('/o/r1048', { exact: true })).toBeVisible();
	await expect(
		page.getByRole('button', { name: 'Скопіювати: Коротке посилання на чек' })
	).toBeVisible();
	const paymentDetails = page.getByRole('region', { name: 'Деталі платежу' });
	await expect(paymentDetails.getByText('Оплачено', { exact: true })).toBeVisible();
	await expect(paymentDetails.getByText('Діє до', { exact: true })).not.toBeVisible();
	await expect(page.getByRole('heading', { name: 'Хронологія рахунку' })).toBeVisible();
	await expect(page.getByText('Оплату підтверджено')).toBeVisible();

	await page.goto('/dashboard/invoices/demo-1047?demo=1');
	const tableDetails = page.getByRole('region', { name: 'Деталі платежу' });
	await expect(tableDetails.getByText('Діє до', { exact: true })).toBeVisible();
	await expect(tableDetails.getByText('Стіл', { exact: true })).toBeVisible();
	await expect(tableDetails.getByText('№2', { exact: true })).toBeVisible();
	await expect(tableDetails.getByText('Оплачено', { exact: true })).not.toBeVisible();
});

test('keeps invoice routes protected outside demo mode', async ({ page }) => {
	await page.goto('/dashboard/invoices');

	await expect(page.getByRole('heading', { name: 'Вхід у Rahunok' })).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Рахунки', exact: true })).not.toBeVisible();
});

test('renders invoice rows without horizontal scrolling on mobile', async ({ page }) => {
	await page.setViewportSize({ width: 375, height: 812 });
	await page.goto('/dashboard/invoices?demo=1');

	await expect(page.getByTestId('mobile-invoice-list')).toBeVisible();
	await expect(page.getByRole('table')).toBeHidden();
	await expect(page.getByTestId('mobile-invoice-list').getByRole('link')).toHaveCount(10);
	await expect(page.locator('body')).not.toHaveCSS('overflow-x', 'scroll');
});

test('saves invoice rules and applies them without overwriting manual edits', async ({ page }) => {
	await page.goto('/dashboard/invoice-rules?demo=1');

	await page.getByRole('button', { name: /Самозайнята особа/ }).click();
	await page.getByRole('textbox', { name: 'РНОКПП' }).fill('1234567890');
	await page.getByRole('button', { name: 'Зберегти правила' }).click();
	await expect(page.getByRole('button', { name: 'Правила збережено' })).toBeVisible();

	await page.goto('/dashboard/invoices/new?demo=1');
	const reference = page.getByRole('textbox', { name: 'Номер рахунку' });
	const purpose = page.getByRole('textbox', { name: 'Призначення платежу' });
	await expect(reference).toHaveValue('RHK-2026-001049');
	await expect(purpose).toHaveValue(/Оплата за товари\/послуги згідно рахунку RHK-2026-001049/);
	await expect(page.getByText(/Автоматично за профілем: Самозайнята особа/)).toBeVisible();

	await reference.fill('ВЛАСНИЙ-7');
	await page.getByRole('button', { name: /Рахунок за столиком/ }).click();
	await expect(reference).toHaveValue('ВЛАСНИЙ-7');
	await expect(purpose).toHaveValue(/Оплата за послуги закладу/);

	await page.getByRole('button', { name: 'Відновити за правилами' }).click();
	await expect(reference).toHaveValue('RHK-2026-001049');
	await expect(page.locator('body')).not.toHaveCSS('overflow-x', 'scroll');
});

test('opens the read-only POS board in demo mode', async ({ page }) => {
	await page.goto('/dashboard/?demo=1');
	await page.getByRole('link', { name: 'Каса', exact: true }).click();

	await expect(page).toHaveURL(/\/dashboard\/pos\?demo=1$/);
	await expect(page.locator('aside')).toHaveAttribute('aria-hidden', 'true');
	await expect(page.getByRole('button', { name: 'Відкрити навігацію' })).toBeVisible();
	await expect(page.getByTestId('dashboard-content')).toHaveCSS('padding-left', '0px');
	await expect(page.getByRole('heading', { name: 'Робочі місця' })).toBeVisible();
	await expect(page.getByRole('region', { name: 'Термінали' })).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Стіл 2' })).toBeVisible();
	await expect(page.getByText('Очікує оплати')).toBeVisible();
	await expect(page.getByText('Локальна демонстрація')).toBeVisible();

	await page.getByRole('button', { name: 'Чернетка замовлення' }).first().click();
	await expect(page.getByRole('region', { name: 'Чернетка замовлення' })).toBeVisible();
	const servicePanel = page.getByRole('complementary', { name: 'Столи та обслуговування' });
	await expect(servicePanel).toBeVisible();
	await expect(servicePanel.getByRole('button', { name: /Стіл 2.*640,00 ₴/ })).toBeVisible();
	await expect(servicePanel.getByLabel('Офіціант')).toBeDisabled();
	await expect(servicePanel.getByText('Буде використано для обліку чайових.')).toBeVisible();
	await expect(servicePanel.getByLabel('Кур’єр')).toBeDisabled();
	await expect(servicePanel.getByText('Буде використано для доставки замовлення.')).toBeVisible();
	await servicePanel.getByRole('button', { name: /Головна каса.*0,00 ₴/ }).click();
	await expect(page.getByRole('heading', { name: 'Головна каса' })).toBeVisible();
	await servicePanel.getByRole('button', { name: /Стіл 1.*0,00 ₴/ }).click();
	await page.getByRole('button', { name: '5', exact: true }).click();
	await expect(page.getByTestId('pos-draft-total')).toHaveText(/5,00\s*(грн|₴)/);
	await page.getByRole('button', { name: 'Товари' }).click();
	await page.getByRole('button', { name: /Капучино/ }).click();
	await expect(page.getByTestId('pos-draft-total')).toHaveText(/150,00\s*(грн|₴)/);
	await expect(page.getByRole('button', { name: 'Створити замовлення' })).toBeVisible();
});

test('keeps the POS route protected outside demo mode', async ({ page }) => {
	await page.goto('/dashboard/pos');

	await expect(page.getByRole('heading', { name: 'Вхід у Rahunok' })).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Робочі місця' })).not.toBeVisible();
});

test('previews the future Device Event Gateway for kasa workplaces', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto('/dashboard/structure?demo=1');
	await page.getByRole('button', { name: /Робочі місця/ }).click();

	const gateway = page.getByRole('region', { name: 'Device Event Gateway' });
	await expect(gateway).toBeVisible();
	await expect(gateway.getByText('ПЛАТНИЙ МОДУЛЬ')).toBeVisible();
	await expect(gateway.getByText('ГОТУЄТЬСЯ', { exact: true })).toBeVisible();
	await expect(gateway.getByText('Головна каса')).toBeVisible();
	await expect(gateway.getByRole('button', { name: 'Підключення готується' })).toBeDisabled();
	await expect(gateway.getByText('Queue → Durable Object')).toBeVisible();
	await expect(gateway.getByText('wss://api.rakhunok.com/device/{deviceId}')).toBeVisible();
	await expect(gateway.getByText('1. Створіть касу.')).toBeVisible();
	await expect(gateway.getByText('"paymentId": "P123456"')).toBeVisible();
	await expect(gateway.getByText('"status": "SUCCESS"')).toBeVisible();
	await expect(gateway.getByText('"client": {')).toBeVisible();
	await expect(gateway.getByText('"returning": true')).toBeVisible();
	await expect(gateway.getByText('client є опціональним:', { exact: false })).toBeVisible();
	await expect(gateway.getByText('25000 означає 250,00 UAH.')).toBeVisible();
	await expect(gateway.getByRole('button', { name: 'Скопіювати WSS endpoint' })).toBeVisible();
	await expect(page.locator('body')).not.toHaveCSS('overflow-x', 'scroll');
});

test('keeps the POS checkout usable on a phone', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto('/dashboard/pos?demo=1');
	await page.getByRole('button', { name: 'Чернетка замовлення' }).first().click();

	await expect(page.getByRole('region', { name: 'Чернетка замовлення' })).toBeVisible();
	await expect(page.getByRole('complementary', { name: 'Столи та обслуговування' })).toBeHidden();
	await page.getByRole('button', { name: 'Товари' }).click();
	await page.getByRole('button', { name: /Капучино/ }).click();
	const openReceipt = page.getByRole('button', { name: 'Відкрити поточне замовлення' });
	await openReceipt.click();

	const mobileReceipt = page.getByRole('dialog', { name: 'Поточне замовлення' });
	await expect(mobileReceipt).toBeVisible();
	await expect(
		page.getByRole('button', { name: 'Закрити поточне замовлення' }).last()
	).toBeFocused();
	await expect(page.locator('body')).toHaveCSS('overflow', 'hidden');
	await expect(page.getByTestId('pos-draft-total').last()).toHaveText(/150,00\s*(грн|₴)/);
	await expect(page.getByRole('button', { name: 'Створити замовлення' }).last()).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(mobileReceipt).toBeHidden();
	await expect(openReceipt).toBeFocused();
	await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden');
	await expect(page.locator('body')).not.toHaveCSS('overflow-x', 'scroll');
});
