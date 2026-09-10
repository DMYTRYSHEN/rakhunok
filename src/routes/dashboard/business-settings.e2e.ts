import { expect, test } from '@playwright/test';

test.beforeEach(async ({ context }) => {
	await context.route('**/*', (route) => {
		const url = new URL(route.request().url());
		return url.origin === 'http://localhost:5173' ? route.continue() : route.abort();
	});
	await context.routeWebSocket(/.*/, (socket) => {
		if (new URL(socket.url()).host === 'localhost:5173') socket.connectToServer();
		else socket.close();
	});
});

test('groups business settings in an initially expanded desktop and mobile menu', async ({ page }) => {
	for (const width of [1280, 390]) {
		await page.setViewportSize({ width, height: 844 });
		await page.goto('/dashboard/structure?demo=1');
		await expect(page.getByRole('combobox', { name: 'Продавець', exact: true })).toBeEnabled();
		if (width < 1024) await page.getByRole('button', { name: 'Відкрити навігацію' }).click();
		const nav = page.getByRole('navigation', { name: 'Основна навігація' });
		const group = nav.locator('details').filter({ has: page.locator('summary', { hasText: 'Налаштування бізнесу' }) });
		await expect(group).toHaveAttribute('open', '');
		await expect(group.getByRole('link')).toHaveCount(3);
		await expect(group.getByRole('link', { name: 'Структура бізнесу', exact: true })).toHaveAttribute('aria-current', 'page');
		await expect(group.getByRole('link', { name: 'Правила рахунків', exact: true })).toHaveAttribute('href', '/dashboard/invoice-rules?demo=1');
		await group.locator('summary').click();
		await expect(group.getByRole('link', { name: 'Приймання платежів', exact: true })).not.toBeVisible();
		await group.locator('summary').focus();
		await page.keyboard.press('Enter');
		await group.getByRole('link', { name: 'Приймання платежів', exact: true }).click();
		await expect(page).toHaveURL(/\/dashboard\/payment-methods\?demo=1$/);
		if (width < 1024) {
			await expect(nav).not.toBeVisible();
			await page.getByRole('button', { name: 'Відкрити навігацію' }).click();
		}
		await expect(group.getByRole('link', { name: 'Приймання платежів', exact: true })).toHaveAttribute('aria-current', 'page');
	}
});

test('keeps seller VAT, rules and provider identifiers independent across routes and reloads', async ({ page }) => {
	await page.goto('/dashboard/structure?demo=1');
	const seller = page.getByRole('combobox', { name: 'Продавець', exact: true });
	await seller.selectOption('demo-entity');
	await page.getByLabel('Статус ПДВ — чернетка').selectOption('vat');
	await seller.selectOption('demo-entity-tov');
	await page.getByLabel('Статус ПДВ — чернетка').selectOption('no-vat');
	await seller.selectOption('demo-entity');
	await expect(page.getByLabel('Статус ПДВ — чернетка')).toHaveValue('vat');
	await page.getByRole('button', { name: 'Зберегти всі чернетки' }).click();
	const nav = page.getByRole('navigation', { name: 'Розділи налаштувань бізнесу' });
	await nav.getByRole('link', { name: 'Правила рахунків' }).click();
	await expect(page).toHaveURL(/entityId=demo-entity$/);
	await page.getByLabel('Префікс', { exact: true }).fill('FOP');
	await seller.selectOption('demo-entity-tov');
	await page.getByLabel('Префікс', { exact: true }).fill('TOV');
	await page.getByRole('button', { name: 'Зберегти всі чернетки' }).click();
	await nav.getByRole('link', { name: 'Приймання платежів' }).click();
	await page.getByRole('radio', { name: /Через фінкомпанію/ }).check();
	await page.getByLabel('Назва фінкомпанії').fill('Тестова фінкомпанія');
	await page.getByLabel('ID продавця у провайдера', { exact: true }).fill('TOV-ID');
	await seller.selectOption('demo-entity');
	await expect(page.getByLabel('ID продавця у провайдера', { exact: true })).toHaveValue('');
	await page.getByLabel('ID продавця у провайдера', { exact: true }).fill('FOP-ID');
	await page.getByRole('button', { name: 'Зберегти всі чернетки' }).click();
	await expect(page.getByRole('status')).toContainText('збережено лише в цьому браузері');
	await page.reload();
	await seller.selectOption('demo-entity');
	await expect(page.getByLabel('ID продавця у провайдера', { exact: true })).toHaveValue('FOP-ID');
	await seller.selectOption('demo-entity-tov');
	await expect(page.getByLabel('ID продавця у провайдера', { exact: true })).toHaveValue('TOV-ID');
	await expect(page.getByRole('button', { name: 'Перевірити підключення' })).toBeDisabled();
});

test('protects unsaved navigation and detects another tab writing a draft', async ({ page, context }) => {
	await page.goto('/dashboard/invoice-rules?demo=1');
	await page.getByLabel('Префікс', { exact: true }).fill('UNSAVED');
	page.once('dialog', (dialog) => dialog.dismiss());
	await page.getByRole('navigation', { name: 'Розділи налаштувань бізнесу' }).getByRole('link', { name: 'Приймання платежів' }).click();
	await expect(page).toHaveURL(/invoice-rules/);
	await expect(page.getByLabel('Префікс', { exact: true })).toHaveValue('UNSAVED');
	const other = await context.newPage();
	await other.goto('/dashboard/invoice-rules?demo=1');
	await other.getByLabel('Префікс', { exact: true }).fill('OTHER');
	await other.getByRole('button', { name: 'Зберегти всі чернетки' }).click();
	await expect(page.getByRole('alert')).toContainText('Сховище змінилося або версія застаріла');
	await expect(page.getByLabel('Префікс', { exact: true })).toHaveValue('UNSAVED');
	await expect(page.getByRole('button', { name: 'Зберегти всі чернетки' })).toBeDisabled();
	page.once('dialog', (dialog) => dialog.accept());
	await page.getByRole('button', { name: 'Відкинути локальні правки й завантажити актуальну чернетку' }).click();
	await expect(page.getByLabel('Префікс', { exact: true })).toHaveValue('OTHER');
	await other.close();
});

test('keeps all settings routes within mobile viewport', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	for (const view of ['structure', 'invoice-rules', 'payment-methods']) {
		await page.goto(`/dashboard/${view}?demo=1`);
		await expect(page.getByRole('combobox', { name: 'Продавець', exact: true })).toBeEnabled();
		expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
	}
});

test('saves demo finance-purpose edits and substitutes each seller after reload without activating payments', async ({ page }) => {
	await page.goto('/dashboard/structure?demo=1');
	await expect(page.getByText(/Профіль: локальна демо-чернетка/)).toHaveCount(2);
	await page.getByRole('navigation', { name: 'Розділи налаштувань бізнесу' })
		.getByRole('link', { name: 'Приймання платежів' }).click();
	const seller = page.getByRole('combobox', { name: 'Продавець', exact: true });
	await seller.selectOption('demo-entity');
	await page.getByRole('radio', { name: /Через фінкомпанію/ }).check();
	await page.getByLabel('Назва фінкомпанії').fill('Демо фінкомпанія');
	const template = 'Тест: {seller_name} | {seller_tax_id} | {seller_iban} | {provider_seller_id} | {provider_code} | {contract_reference} | {business_purpose} | {payment_id}';
	const editor = page.getByRole('textbox', { name: 'Шаблон фінкомпанії', exact: true });
	await editor.fill(template);
	for (const [id, prefix] of [['demo-entity', 'FOP'], ['demo-entity-tov', 'TOV']]) {
		await seller.selectOption(id);
		await page.getByLabel('ID продавця у провайдера', { exact: true }).fill(`${prefix}-ID`);
		await page.getByLabel('Код провайдера', { exact: true }).fill(`${prefix}-CODE`);
		await page.getByLabel('Номер договору', { exact: true }).fill(`${prefix}-CONTRACT`);
	}
	const save = page.getByRole('button', { name: 'Зберегти всі чернетки' });
	await editor.fill('{unknown_token}');
	await save.click();
	await expect(page.getByRole('alert')).toContainText('Некоректний шаблон фінкомпанії');
	await expect(editor).toBeEnabled();
	await expect(save).toBeEnabled();
	await editor.fill(template);
	await save.click();
	await expect(page.getByRole('status')).toContainText('збережено лише в цьому браузері');
	await page.reload();
	await expect(editor).toHaveValue(template);
	const rules = page.getByRole('region', { name: 'Правила призначення фінкомпанії' });
	for (const [id, prefix, taxId, iban] of [
		['demo-entity', 'FOP', '1234567890', 'UA123456789012345678901234567'],
		['demo-entity-tov', 'TOV', '12345678', '[не задано: seller_iban]']
	]) {
		await seller.selectOption(id);
		const name = await seller.locator('option:checked').textContent();
		await expect(rules).toContainText(`Тест: ${name} | ${taxId} | ${iban} | ${prefix}-ID | ${prefix}-CODE | ${prefix}-CONTRACT | Оплата за товари/послуги, рахунок RHK-000001`);
		await expect(rules).not.toContainText(prefix === 'FOP' ? 'TOV-ID' : 'FOP-ID');
		await expect(rules).toContainText('Ілюстрація, не платіжний payload');
		await expect(rules).toContainText('[буде створено сервером — не реальний ID]');
		await expect(rules).toContainText('Не погоджено провайдером, не активовано');
	}
	await expect(page.getByText('Ці дані не впливають на створення рахунків, QR або приймання платежів.', { exact: false })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Перевірити підключення' })).toBeDisabled();
	await save.click();
	await expect(page.getByRole('status')).toContainText('збережено лише в цьому браузері');
	await page.goto('/dashboard/invoices/new?demo=1');
	const preview = page.getByRole('complementary', { name: 'Чернетка налаштувань продавця' });
	await expect(preview).toContainText('Вони ще не застосовуються до полів цього рахунку, отримувача або платежу');
	await preview.locator('summary').click();
	await expect(preview).toContainText('Ілюстрація, не платіжний payload: Тест:');
	await expect(preview).toContainText('FOP-ID | FOP-CODE | FOP-CONTRACT');
	await expect(preview).toContainText('Чернетка не дозволяє приймати оплату через фінкомпанію');
});