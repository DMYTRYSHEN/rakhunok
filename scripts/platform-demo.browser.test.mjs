import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium, expect } from '@playwright/test';
import { createServer } from 'vite';

const root = fileURLToPath(new URL('../apps/platform/', import.meta.url));
const screenshots = fileURLToPath(new URL('../test-results/platform-demo/', import.meta.url));
const storageKey = 'rahunok.platform.demo.v1';
let server, browser, origin;

before(async () => {
	server = await createServer({ root, configFile: `${root}/vite.config.ts`, server: { host: '127.0.0.1', port: 0, strictPort: false, open: false } });
	await server.listen();
	origin = `http://127.0.0.1:${server.httpServer.address().port}`;
	browser = await chromium.launch();
	await mkdir(screenshots, { recursive: true });
});
after(async () => { await browser?.close(); await server?.close(); });

async function fixture(contextTest, width = 1440) {
	const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 1000 }, serviceWorkers: 'block' });
	const page = await context.newPage();
	const businessRequests = [], errors = [];
	page.on('pageerror', error => errors.push(error.message));
	page.on('console', message => { if (message.type() === 'warn' && message.text().includes('[svelte]')) errors.push(message.text()); });
	await context.route('**/*', async route => {
		const request = route.request();
		if (new URL(request.url()).origin !== origin || request.method() !== 'GET' || ['xhr', 'fetch'].includes(request.resourceType())) {
			businessRequests.push(request.url());
			await route.abort();
		} else await route.continue();
	});
	contextTest.after(async () => {
		await context.close();
		assert.deepEqual(businessRequests, [], 'Demo must not call remote/auth/business endpoints');
		assert.deepEqual(errors, [], 'No runtime errors');
	});
	return page;
}

const navigate = (page, query) => page.goto(`${origin}/platform/?demo=1&${query}`);
const button = (page, name) => page.getByRole('button', { name, exact: true });
async function fillOrganizationDetails(page) {
	for (const [key, value] of Object.entries({ registrationId: 'DEMO-company', country: 'UA', address: 'DEMO address' })) await page.locator(`#package-detail-${key}`).fill(value);
	await page.locator('#platform-name-0').fill('DEMO Delivery');
	await page.locator('#platform-url-0').fill('https://delivery.demo.example');
	await page.getByRole('checkbox', { name: 'Доставка', exact: true }).check();
}
async function fillRepresentativeDetails(page) {
	for (const [key, value] of Object.entries({ representativeName: 'DEMO name', capacity: 'Director', mandateReference: 'DEMO mandate' })) await page.locator(`#package-detail-${key}`).fill(value);
}
async function reset(page) {
	await button(page, 'Відновити початкові демодані').click();
	await button(page, 'Відновити демодані').click();
	await expect(page.getByRole('status')).toHaveText('Демодані відновлено.');
}

test('Documents: guided manual entry and confirmed JSON draft import', async contextTest => {
	const page = await fixture(contextTest);
	for (const width of [1440, 390]) {
		await page.setViewportSize({ width, height: 1000 });
		await navigate(page, 'persona=route-owner&section=registration');
		await page.locator('.workflow-guide summary').click();
		await expect(page.locator('.workflow-guide')).toContainText('TXT/JSON');
		const documents = page.getByRole('region', { name: 'Документи', exact: true });
		const id = `DEMO-doc-manual-${width}`;
		await documents.getByLabel('ID документа', { exact: true }).fill(id);
		await documents.getByLabel('Синтетичний вміст', { exact: true }).fill('DEMO manual entry');
		await button(documents, 'Подати версію').click();
		await expect(documents.locator('.document').filter({ hasText: id })).toHaveCount(1);
		const fileInput = documents.getByLabel('Заповнити із файла · TXT або JSON', { exact: true });
		const imported = { id: `DEMO-doc-json-${width}`, category: 'registration', name: 'DEMO-imported.txt', content: 'DEMO imported evidence', expires: '2028-12-31' };
		const file = { name: 'document.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(imported)) };
		await fileInput.setInputFiles(file);
		const preview = documents.getByRole('region', { name: 'Попередній перегляд документа' });
		await expect(preview).toContainText(imported.id);
		await expect(documents.getByLabel('ID документа', { exact: true })).toHaveValue(id);
		await expect(button(documents, 'Подати версію')).toBeDisabled();
		await button(documents, 'Скасувати імпорт').click();
		await expect(preview).toHaveCount(0);
		await expect(documents.getByLabel('ID документа', { exact: true })).toHaveValue(id);
		await fileInput.setInputFiles({ ...file, buffer: Buffer.from('{') });
		await expect(documents.getByRole('alert')).toContainText('Некоректний JSON');
		await expect(documents.getByLabel('ID документа', { exact: true })).toHaveValue(id);
		await fileInput.setInputFiles(file);
		await button(documents, 'Застосувати до форми').click();
		await expect(documents.getByLabel('ID документа', { exact: true })).toHaveValue(imported.id);
		await expect(documents.locator('.document').filter({ hasText: imported.id })).toHaveCount(0);
		await button(documents, 'Подати версію').click();
		await expect(documents.locator('.document').filter({ hasText: imported.id })).toContainText('На перевірці');
		await page.reload();
		await expect(documents.locator('.document').filter({ hasText: imported.id })).toHaveCount(1);
		await button(documents, `Нова версія ${imported.id}`).click();
		await documents.getByLabel('Синтетичний вміст', { exact: true }).fill('DEMO updated evidence');
		await button(documents, 'Подати версію').click();
		await expect(documents.locator('.document').filter({ hasText: imported.id })).toHaveCount(2);
		assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
		await page.screenshot({ path: `${screenshots}/document-guide-${width}.png`, fullPage: true });
	}
});

test('E1: persistence, history, permissions, isolation, filtering and reset', async contextTest => {
	const page = await fixture(contextTest);
	await navigate(page, 'role=platform');
	await expect(page.locator('tbody')).toContainText('850,00');
	await page.evaluate(() => localStorage.setItem('platform-test-unrelated', 'preserved'));
	await button(page, 'Реєстрація').click();
	await page.locator('#operator-contact').fill('browser@varus.example');
	await button(page, 'Зберегти').click();
	await expect(page.getByRole('status')).toHaveText('Демоконтакт збережено.');
	await page.reload();
	await expect(page.locator('#operator-contact')).toHaveValue('browser@varus.example');
	await button(page, 'Журнал').click();
	await expect(page.locator('tbody tr')).toHaveCount(1);
	await page.goBack();
	await expect(page.locator('#operator-contact')).toHaveValue('browser@varus.example');
	await page.goForward();
	await expect(page.locator('h1')).toHaveText('Журнал');
	await page.locator('#demo-persona').selectOption('route-owner');
	await expect(page.locator('tbody')).not.toContainText('VARUS');
	await expect(page.locator('tbody')).toContainText('340,00');
	await page.locator('#demo-persona').selectOption('courier-1');
	await expect(page.locator('tbody tr')).toHaveCount(2);
	await expect(page.locator('.metrics')).toContainText('530,00');
	await page.getByLabel('Платформа', { exact: true }).selectOption('route');
	await expect(page.locator('tbody tr')).toHaveCount(1);
	await page.getByLabel('Період', { exact: true }).selectOption('2026-08');
	await expect(page.locator('.metrics')).not.toContainText('530,00');
	await page.locator('#demo-persona').selectOption('rahunok-admin');
	await expect(button(page, 'Виплати')).toHaveCount(0);
	await expect(page.locator('.metrics')).not.toContainText('530,00');
	await page.locator('#demo-persona').selectOption('varus-integrator');
	await expect(button(page, 'Реєстрація')).toHaveCount(0);
	await navigate(page, 'persona=varus-integrator&section=payouts');
	await expect(page.locator('h1')).toHaveText('Огляд');
	await page.locator('#demo-persona').selectOption('varus-owner');
	await reset(page);
	assert.equal(await page.evaluate(() => localStorage.getItem('platform-test-unrelated')), 'preserved');
	await expect(page.locator('tbody')).toContainText('850,00');
	await button(page, 'Операції').click();
	await page.getByRole('searchbox').fill('missing-event');
	await expect(page.locator('tbody')).toContainText('Записів за вибраними умовами немає.');
	await page.getByRole('searchbox').fill('');
	await page.screenshot({ path: `${screenshots}/desktop.png`, fullPage: true });
});

test('E1: corrupt storage recovery and failure without false success', async contextTest => {
	const page = await fixture(contextTest);
	await navigate(page, 'role=platform');
	await page.evaluate(key => localStorage.setItem(key, '{'), storageKey);
	await page.reload();
	await expect(page.getByRole('alert')).toContainText('пошкоджені');
	assert.equal(await page.evaluate(key => localStorage.getItem(key), storageKey), '{');
	await reset(page);
	await expect(page.getByRole('alert')).toHaveCount(0);
	await button(page, 'Реєстрація').click();
	await page.evaluate(key => {
		const original = Storage.prototype.setItem;
		Storage.prototype.setItem = function(name, value) {
			if (name === key) throw new DOMException('Storage full', 'QuotaExceededError');
			return original.call(this, name, value);
		};
	}, storageKey);
	await page.locator('#operator-contact').fill('failed@varus.example');
	await button(page, 'Зберегти').click();
	await expect(page.getByRole('alert')).toContainText('Зміни не збережено');
	await page.reload();
	await expect(page.locator('#operator-contact')).toHaveValue('operations@varus.example');
});

test('E1: mobile layout, keyboard navigation, legacy admin and explicit SaaS admin', async contextTest => {
	const page = await fixture(contextTest, 390);
	await navigate(page, 'role=platform');
	assert.match(await page.locator('main').evaluate(element => getComputedStyle(element).fontFamily), /Manrope/);
	assert.equal(await page.evaluate(async () => { await document.fonts.ready; return document.fonts.check('13px Manrope', '\u0423\u043a\u0440\u0430\u0457\u043d\u0430'); }), true);
	await expect(page.locator('#demo-persona')).toHaveValue('varus-owner');
	await button(page, 'Операції').focus();
	await page.keyboard.press('Enter');
	await expect(page.locator('h1')).toHaveText('Операції');
	assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'No page overflow');
	await page.screenshot({ path: `${screenshots}/mobile.png`, fullPage: true });
	await navigate(page, 'role=admin');
	await expect(page.locator('#demo-persona')).toHaveCount(0);
	await navigate(page, 'role=admin&persona=rahunok-admin');
	await expect(page.locator('#demo-persona')).toHaveValue('rahunok-admin');
	await page.getByRole('link', { name: 'Попередні демосценарії' }).click();
	await expect(page.locator('#demo-persona')).toHaveCount(0);
});

test('E8: role navigation, viewport bounds and text contrast at desktop and mobile widths', async contextTest => {
	const page = await fixture(contextTest);
	for (const width of [1440, 390]) {
		await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
		for (const persona of ['varus-owner', 'route-owner', 'varus-accountant', 'varus-signer', 'varus-compliance', 'varus-integrator', 'courier-1', 'rahunok-admin']) {
			await navigate(page, `persona=${persona}`);
			const navigation = page.getByRole('navigation', { name: 'Розділи Platform' });
			const sections = await navigation.getByRole('button').allTextContents();
			for (const section of sections) {
				await navigation.getByRole('button', { name: section.trim(), exact: true }).focus();
				await page.keyboard.press('Enter');
				await expect(page.locator('h1')).toHaveText(section.trim());
				const issues = await page.locator('.demo-shell').evaluate(shell => {
					const problems = [];
					if (document.documentElement.scrollWidth > innerWidth) problems.push('page overflow');
					const luminance = channels => channels.map(channel => {
						const value = channel / 255;
						return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
					}).reduce((total, value, index) => total + value * [0.2126, 0.7152, 0.0722][index], 0);
					const colors = new Set();
					for (const element of shell.querySelectorAll('*')) {
						if (!element.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) || element.closest(':disabled') || ![...element.childNodes].some(node => node.nodeType === Node.TEXT_NODE && node.textContent.trim())) continue;
						const style = getComputedStyle(element);
						const foreground = style.color.match(/[\d.]+/g)?.map(Number);
						let ancestor = element;
						let background;
						let complex = false;
						while (ancestor) {
							const parentStyle = getComputedStyle(ancestor);
							const channels = parentStyle.backgroundColor.match(/[\d.]+/g)?.map(Number);
							if (parentStyle.backgroundImage !== 'none' || Number(parentStyle.opacity) !== 1 || channels?.length === 4 && channels[3] > 0 && channels[3] < 1) complex = true;
							if (channels && (channels.length === 3 || channels[3] === 1)) { background = channels.slice(0, 3); break; }
							ancestor = ancestor.parentElement;
						}
						if (complex || !background || !foreground || foreground.length === 4 && foreground[3] !== 1) continue;
						const required = parseFloat(style.fontSize) >= 24 || parseFloat(style.fontSize) >= 18.66 && Number(style.fontWeight) >= 700 ? 3 : 4.5;
						const pair = `${foreground}/${background}/${required}`;
						if (colors.has(pair)) continue;
						colors.add(pair);
						const levels = [luminance(foreground.slice(0, 3)), luminance(background)].sort((first, second) => first - second);
						const ratio = (levels[1] + 0.05) / (levels[0] + 0.05);
						if (ratio < required) problems.push(`contrast ${ratio.toFixed(2)} < ${required}: ${element.textContent.trim().slice(0, 60)} (${pair})`);
					}
					return problems;
				});
				assert.deepEqual(issues, [], `${width}px ${persona} ${section.trim()}`);
			}
		}
	}
});

test('E2: draft reload, independent approval and simulated registration', async contextTest => {
	const page = await fixture(contextTest);
	await navigate(page, 'persona=varus-owner&section=registration');
	for (const key of ['organization', 'platform', 'activity']) await page.locator(`#package-${key}`).fill(`DEMO ${key}`);
	await fillOrganizationDetails(page);
	await button(page, 'Далі').click();
	await fillRepresentativeDetails(page);
	await page.locator('#package-representative').fill('DEMO representative');
	await page.locator('#package-contact').fill('package@varus.example');
	await button(page, 'Далі').click();
	await page.locator('#package-documents').fill('DEMO mandate');
	await button(page, 'Зберегти чернетку').click();
	await page.reload();
	await expect(page.locator('#package-organization')).toHaveValue('DEMO organization');
	await button(page, 'Погодити пакет').click();
	await expect(page.getByRole('alert')).toContainText('SECOND_APPROVER_REQUIRED');
	await page.locator('#demo-persona').selectOption('varus-signer');
	await button(page, 'Реєстрація').click();
	await button(page, 'Погодити пакет').click();
	await expect(page.getByRole('status')).toContainText('збережено');
	await page.locator('#demo-persona').selectOption('varus-owner');
	await button(page, 'Реєстрація').click();
	await button(page, 'Передати в деморозгляд').click();
	await button(page, 'Застосувати деморішення').click();
	await page.reload();
	await expect(page.locator('.registration')).toContainText('registered');
	await expect(page.locator('.registration')).toContainText('DEMO-varus-registration-');
});

test('E3: seller evidence, courier confirmation and invitation acceptance', async contextTest => {
	const page = await fixture(contextTest);
	await navigate(page, 'persona=varus-owner&section=couriers');
	await button(page, 'courier-1').click();
	await button(page, 'Зберегти профіль').click();
	for (const provider of ['diia', 'bankid', 'iban']) {
		await page.locator('#seller-provider').selectOption(provider);
		await button(page, 'Застосувати перевірку').click();
	}
	await page.locator('#demo-persona').selectOption('courier-1');
	await button(page, 'Самозайняті').click();
	await button(page, 'Підтвердити зв’язок · varus').click();
	await expect(page.locator('main')).toContainText('Готово · DEMO');
	await page.locator('#demo-persona').selectOption('varus-owner');
	await button(page, 'Самозайняті').click();
	await page.locator('#courier-readiness').selectOption('ready');
	await expect(button(page, 'courier-1')).toHaveCount(1);
	await expect(button(page, 'courier-2')).toHaveCount(0);
	await page.locator('#courier-readiness').selectOption('blocked');
	await expect(button(page, 'courier-1')).toHaveCount(0);
	await expect(button(page, 'courier-2')).toHaveCount(1);
	await button(page, 'Команда').click();
	await button(page, 'Створити запрошення').click();
	await page.locator('#demo-persona').selectOption('demo-member-new');
	await expect(button(page, 'Операції')).toHaveCount(0);
	await button(page, 'Прийняти демозапрошення').click();
	await expect(button(page, 'Операції')).toHaveCount(1);
	await page.reload();
	await expect(page.locator('#demo-persona')).toHaveValue('demo-member-new');
});

test('E3: taxi onboarding, evidence versions and independent review', async contextTest => {
	const page = await fixture(contextTest, 390);
	await navigate(page, 'persona=varus-owner&section=couriers');
	await page.getByText('Додати самозайнятого', { exact: true }).first().click();
	await page.locator('#participant-id').fill('DEMO-seller-taxi');
	await page.locator('#participant-name').fill('DEMO Taxi');
	await page.locator('#participant-activity').selectOption('taxi');
	await button(page, 'Додати самозайнятого').click();
	await button(page, 'Зберегти профіль').click();
	for (const provider of ['diia', 'bankid', 'iban']) {
		await page.locator('#seller-provider').selectOption(provider);
		await button(page, 'Застосувати перевірку').click();
	}
	await navigate(page, 'persona=DEMO-seller-taxi&section=couriers');
	await button(page, 'Підтвердити зв’язок · varus').click();
	const documents = page.getByRole('region', { name: 'Документи', exact: true });
	await documents.getByLabel('ID документа', { exact: true }).fill('DEMO-doc-taxi');
	await documents.getByLabel('Заповнити із файла · TXT або JSON', { exact: true }).setInputFiles({ name: 'DEMO-taxi.txt', mimeType: 'text/plain', buffer: Buffer.from('DEMO taxi identity v1') });
	await button(documents, 'Застосувати до форми').click();
	await button(page, 'Подати версію').click();
	await expect(page.locator('main')).toContainText('DOCUMENT_SUBMITTED:DEMO-doc-taxi');
	await expect(button(page, 'Прийняти DEMO-doc-taxi')).toHaveCount(0);
	await navigate(page, 'persona=varus-compliance&section=couriers');
	await page.locator('#courier-search').fill('DEMO-seller-taxi');
	await button(page, 'DEMO-seller-taxi').click();
	await button(page, 'Прийняти DEMO-doc-taxi').click();
	await navigate(page, 'persona=DEMO-seller-taxi&section=couriers');
	await expect(page.locator('main')).toContainText('Готово · DEMO');
	await button(page, 'Нова версія DEMO-doc-taxi').click();
	await documents.getByLabel('Синтетичний вміст', { exact: true }).fill('DEMO taxi identity v2');
	await button(page, 'Подати версію').click();
	await expect(page.locator('main')).toContainText('DOCUMENT_SUBMITTED:DEMO-doc-taxi');
	await page.reload();
	await expect(documents.locator('.document')).toHaveCount(2);
	assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
	await page.screenshot({ path: `${screenshots}/self-employed-mobile.png`, fullPage: true });
	await navigate(page, 'persona=route-owner&section=couriers');
	await page.locator('#courier-search').fill('DEMO-seller-taxi');
	await expect(button(page, 'DEMO-seller-taxi')).toHaveCount(0);
});

test('E4: test key, preview, import and replay', async contextTest => {
	const page = await fixture(contextTest);
	await navigate(page, 'persona=varus-owner&section=integrations');
	await button(page, 'Створити тестовий ключ').click();
	await page.locator('#import-key').selectOption('DEMO-key-one');
	await button(page, 'Перевірити імпорт').click();
	await button(page, 'Записати демоподії').click();
	await button(page, 'Записати демоподії').click();
	await button(page, 'Огляд').click();
	await expect(page.locator('.metrics')).toContainText('860,00');
	await page.reload();
	await expect(page.locator('.metrics')).toContainText('860,00');
	await page.locator('#demo-persona').selectOption('route-owner');
	await expect(page.locator('.metrics')).toContainText('340,00');
});

test('E4: custom CSV mapping, preview and source fields', async contextTest => {
	const page = await fixture(contextTest);
	await navigate(page, 'persona=varus-accountant&section=operations');
	await page.locator('#operation-register').selectOption('paidMinor');
	await expect(page.locator('.table-scroll tbody tr')).toHaveCount(3);
	await expect(page.locator('.table-scroll tbody')).not.toContainText('demo-v-002');
	await page.locator('#operation-register').selectOption('incomeMinor');
	await expect(page.locator('.table-scroll tbody tr')).toHaveCount(4);
	await page.locator('#import-format').selectOption('csv');
	await page.locator('#import-column').fill('reference');
	await page.getByText('Відповідність полів', { exact: true }).click();
	for (const [field, column] of [['kind', 'type'], ['courierId', 'seller'], ['amountMinor', 'kopecks'], ['currency', 'ccy'], ['occurredAt', 'time'], ['activity', 'service']]) await page.locator(`#mapping-${field}`).fill(column);
	await page.locator('#import-content').fill('reference,type,seller,kopecks,ccy,time,service\nDEMO-mapped,income,courier-1,250,UAH,2026-09-01T00:00:00.000Z,delivery');
	await button(page, 'Перевірити імпорт').click();
	await expect(page.locator('.module tbody')).toContainText('250');
	await button(page, 'Записати демоподії').click();
	await expect(page.locator('p[role="status"]')).toContainText('записано');
	await expect(page.locator('output')).toContainText('processed');
	const source = page.locator('details').filter({ has: page.getByText('income · DEMO-mapped', { exact: true }) });
	await source.locator('summary').click();
	await expect(source).toContainText('varus-accountant');
	await expect(source).toContainText('2026-09-01T00:00:00.000Z');
	await expect(source).toContainText('250 UAH');
	await button(page, 'Огляд').click();
	await expect(page.locator('.metrics')).toContainText('852,50');
});

test('Design: financial hierarchy, keyboard entry and verified import action', async contextTest => {
	const page = await fixture(contextTest);
	for (const width of [1440, 390]) {
		await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
		await navigate(page, 'persona=route-owner');
		await expect(page.locator('.metrics')).toBeVisible();
		assert.equal(await page.locator('.demo-shell').evaluate(shell => getComputedStyle(shell).backgroundColor), 'rgb(255, 255, 255)');
		assert.equal(await page.locator('.metrics').evaluate(metrics => !!(metrics.compareDocumentPosition(document.querySelector('.task-list')) & Node.DOCUMENT_POSITION_FOLLOWING)), true);
		await page.getByRole('link', { name: 'До вмісту' }).focus();
		await page.keyboard.press('Enter');
		await expect(page.locator('main')).toBeFocused();
		await page.screenshot({ path: `${screenshots}/design-overview-${width}.png`, fullPage: false });
		await page.getByRole('navigation').getByRole('button', { name: 'Інтеграції', exact: true }).click();
		await expect(page.locator('#import-content')).toBeVisible();
		await page.locator('#key-id').fill(`DEMO-key-design-${width}`);
		await button(page, 'Створити тестовий ключ').click();
		await page.locator('#import-key').selectOption(`DEMO-key-design-${width}`);
		const submit = button(page, 'Записати демоподії');
		await expect(submit).toBeDisabled();
		await button(page, 'Перевірити імпорт').click();
		await expect(submit).toBeEnabled();
		await expect(submit).toHaveClass(/primary/);
		const preview = page.getByRole('table', { name: 'Попередній перегляд імпорту' });
		await expect(preview).toBeVisible();
		assert.equal(await preview.evaluate(table => table.getBoundingClientRect().bottom <= table.parentElement.nextElementSibling.getBoundingClientRect().top), true, 'Preview precedes import actions');
		await submit.click();
		await expect(page.getByLabel('Результат імпорту')).toBeVisible();
		await page.locator('#import-content').fill('[]');
		await expect(page.getByLabel('Результат імпорту')).toHaveCount(0);
		await expect(submit).toBeDisabled();
		await expect(preview).toHaveCount(0);
		await page.locator('h1').scrollIntoViewIfNeeded();
		assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
		for (const checkbox of await page.getByRole('checkbox').all()) {
			const bounds = await checkbox.boundingBox();
			assert.equal(bounds.width, 18);
			assert.equal(bounds.height, 18);
		}
		await page.screenshot({ path: `${screenshots}/design-integrations-${width}.png`, fullPage: false });
	}
});

test('E5: eligible batch, approval, unknown and late confirmation', async contextTest => {
	const page = await fixture(contextTest);
	await navigate(page, 'persona=varus-owner&section=couriers');
	await button(page, 'courier-1').click();
	await button(page, 'Зберегти профіль').click();
	for (const provider of ['diia', 'bankid', 'iban']) {
		await page.locator('#seller-provider').selectOption(provider);
		await button(page, 'Застосувати перевірку').click();
	}
	await page.locator('#demo-persona').selectOption('courier-1');
	await button(page, 'Самозайняті').click();
	await button(page, 'Підтвердити зв’язок · varus').click();
	await page.locator('#demo-persona').selectOption('varus-accountant');
	await button(page, 'Виплати').click();
	await page.locator('#external-date').fill('2026-10-17');
	await page.locator('#payout-status').selectOption('rejected');
	await button(page, 'Облікувати зовнішню виплату').click();
	await page.reload();
	await expect(page.locator('.module')).toContainText('2026-10-17T00:00:00.000Z');
	await expect(page.locator('#payout-period')).toHaveValue('2026-09');
	await page.getByRole('checkbox', { name: 'courier-1', exact: true }).check();
	await expect(page.getByLabel('Підсумок батча')).toContainText('150,00');
	await button(page, 'Створити чернетку батча').click();
	await page.locator('#demo-persona').selectOption('varus-signer');
	await button(page, 'Виплати').click();
	await button(page, 'Погодити батч').click();
	await page.locator('#demo-persona').selectOption('varus-accountant');
	await button(page, 'Виплати').click();
	await button(page, 'Застосувати результат · courier-1').click();
	await expect(page.locator('.module')).toContainText('unknown');
	await expect(button(page, 'Повторити інструкцію')).toHaveCount(0);
	await page.locator('#payout-status').selectOption('paid');
	await button(page, 'Застосувати результат · courier-1').click();
	await page.reload();
	await expect(page.locator('.module')).toContainText('paid');
	await expect(button(page, 'Застосувати результат · courier-1')).toHaveCount(0);
	await button(page, 'Огляд').click();
	await expect(page.locator('.metrics')).toContainText('670,00');
	await page.locator('#demo-persona').selectOption('courier-1');
	await button(page, 'Виплати').click();
	await expect(page.locator('.module')).toContainText('Моя виплата');
	await expect(page.locator('.module')).not.toContainText('Підтвердження відсутнє');
	await expect(page.locator('.module')).not.toContainText('результатів:');
});

test('E1: demo exit preserves unrelated session storage without auth requests', async contextTest => {
	const page = await fixture(contextTest);
	await navigate(page, 'role=platform');
	await page.evaluate(() => localStorage.setItem('sb-platform-test-auth-token', 'synthetic-sentinel'));
	await page.route(`${origin}/platform/`, route => route.fulfill({ contentType: 'text/html', body: '<main>Exit destination</main>' }));
	await button(page, 'Вийти з демо').click();
	await expect(page).toHaveURL(`${origin}/platform/`);
	await expect(page.locator('main')).toHaveText('Exit destination');
	assert.equal(await page.evaluate(() => localStorage.getItem('sb-platform-test-auth-token')), 'synthetic-sentinel');
});

test('E8 route A: registration clarification through partial payout and accepted courier statement', async contextTest => {
	const page = await fixture(contextTest);
	await navigate(page, 'persona=varus-owner&section=registration');
	for (const key of ['organization', 'platform', 'activity']) await page.locator(`#package-${key}`).fill(`DEMO ${key}`);
	await fillOrganizationDetails(page);
	await button(page, 'Далі').click();
	await fillRepresentativeDetails(page);
	await page.locator('#package-representative').fill('DEMO representative');
	await page.locator('#package-contact').fill('acceptance@varus.example');
	await button(page, 'Далі').click();
	await page.locator('#package-documents').fill('DEMO initial mandate');
	await button(page, 'Зберегти чернетку').click();
	for (const outcome of ['clarification', 'registered']) {
		await navigate(page, 'persona=varus-signer&section=registration');
		await button(page, 'Погодити пакет').click();
		await navigate(page, 'persona=varus-owner&section=registration');
		await button(page, 'Передати в деморозгляд').click();
		await page.locator('#registration-outcome').selectOption(outcome);
		await button(page, 'Застосувати деморішення').click();
		await expect(page.locator('.registration h3')).toContainText([`· ${outcome} ·`]);
		if (outcome === 'clarification') {
			await button(page, 'Далі').click();
			await button(page, 'Далі').click();
			await page.locator('#package-documents').fill('DEMO clarified mandate');
			await button(page, 'Зберегти чернетку').click();
		}
	}
	await navigate(page, 'persona=varus-integrator&section=integrations');
	await button(page, 'Створити тестовий ключ').click();
	await page.locator('#import-key').selectOption('DEMO-key-one');
	await page.locator('#import-content').fill(JSON.stringify(['courier-1', 'courier-2'].map(courierId => ({
		id: `DEMO-route-a-${courierId}`, kind: 'income', courierId, amountMinor: 1000,
		currency: 'UAH', occurredAt: '2026-09-20T00:00:00.000Z', activity: 'delivery'
	}))));
	await button(page, 'Перевірити імпорт').click();
	await button(page, 'Записати демоподії').click();
	await expect(page.locator('output')).toContainText('processed');
	await navigate(page, 'persona=varus-compliance&section=couriers');
	for (const courierId of ['courier-1', 'courier-2', 'courier-3']) {
		if (courierId === 'courier-3') await button(page, 'Далі').click();
		await button(page, courierId).click();
		await button(page, 'Зберегти профіль').click();
		for (const provider of ['diia', 'bankid', 'iban']) {
			await page.locator('#seller-provider').selectOption(provider);
			await button(page, 'Застосувати перевірку').click();
		}
	}
	await navigate(page, 'persona=courier-1&section=couriers');
	await button(page, 'Підтвердити зв’язок · varus').click();
	await navigate(page, 'persona=varus-accountant&section=payouts');
	for (const courierId of ['courier-1', 'courier-2']) await page.getByRole('checkbox', { name: courierId, exact: true }).check();
	await expect(page.getByLabel('Підсумок батча')).toContainText('170,00');
	await button(page, 'Створити чернетку батча').click();
	await navigate(page, 'persona=varus-signer&section=payouts');
	await button(page, 'Погодити батч').click();
	await navigate(page, 'persona=varus-accountant&section=payouts');
	await page.locator('#payout-status').selectOption('paid');
	await button(page, 'Застосувати результат · courier-1').click();
	await page.locator('#payout-status').selectOption('unknown');
	await button(page, 'Застосувати результат · courier-2').click();
	await page.reload();
	await expect(button(page, 'Застосувати результат · courier-1')).toHaveCount(0);
	await expect(button(page, 'Повторити інструкцію')).toHaveCount(0);
	await page.locator('#payout-status').selectOption('paid');
	await button(page, 'Застосувати результат · courier-2').click();
	await navigate(page, 'persona=varus-accountant&section=reports');
	for (const sellerId of ['courier-1', 'courier-2', 'courier-3']) {
		await page.locator('#assessment-seller').selectOption(sellerId);
		await page.locator('#assessment-outcome').selectOption('reportable');
		await page.locator('#assessment-reason').fill('DEMO quarterly review');
		await page.locator('#assessment-fees').fill('0');
		await page.locator('#assessment-withholding').fill('0');
		await page.locator('#assessment-evidence').fill('DEMO confirmed zero charges');
		await button(page, 'Зберегти оцінку').click();
		await expect(page.getByRole('status')).toContainText('збережено');
	}
	await button(page, 'Створити знімок звіту').click();
	await expect(page.locator('.report')).not.toContainText('PROFILE_MISSING');
	for (const outcome of ['Відхилено · DEMO', 'Прийнято · DEMO']) {
		await navigate(page, 'persona=varus-signer&section=reports');
		await button(page, 'Погодити звіт').click();
		await navigate(page, 'persona=varus-accountant&section=reports');
		await button(page, 'Передати · DEMO').click();
		await expect(button(page, 'Прийнято · DEMO')).toBeDisabled();
		await button(page, 'Технічно отримано · DEMO').click();
		await button(page, outcome).click();
		if (outcome.startsWith('Відхилено')) {
			await page.locator('#report-corrects').selectOption({ index: 1 });
			await page.locator('#report-reason').fill('DEMO corrected submission');
			await button(page, 'Створити знімок звіту').click();
		}
	}
	await page.reload();
	await expect(page.locator('.report')).toHaveCount(2);
	await navigate(page, 'persona=rahunok-admin&section=platforms');
	await expect(page.getByRole('table', { name: 'Технічні проблеми' })).toContainText('Невирішених технічних проблем немає.');
	await navigate(page, 'persona=courier-1&section=reports');
	await page.locator('#report-operator-filter').selectOption('varus');
	await page.locator('#report-quarter-filter').selectOption('2026-Q3');
	await expect(page.locator('.report')).toHaveCount(1);
	await expect(page.locator('.report')).not.toContainText('courier-2');
	const downloaded = page.waitForEvent('download');
	await button(page, 'Завантажити мій витяг').click();
	const download = await downloaded;
	const artifact = JSON.parse(await readFile(await download.path(), 'utf8'));
	assert.equal(artifact.source, 'DEMO-NOT-FOR-SUBMISSION');
	assert.equal(artifact.status, 'accepted');
	assert.equal(artifact.rows.length, 1);
	assert.equal(artifact.rows[0].incomeMinor, 34000);
	assert.equal(artifact.rows[0].paidMinor, 28000);
	assert.ok(artifact.sources.every(entry => entry.courierId === 'courier-1'));
	assert.equal(artifact.author, '');
	assert.equal(artifact.rows[0].assessment, undefined);
	assert.equal(artifact.submission.rows.length, 1);
	assert.equal(artifact.submission.totals.incomeMinor, 34000);
	await page.setViewportSize({ width: 390, height: 844 });
	assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
	await page.screenshot({ path: `${screenshots}/report-mobile.png`, fullPage: true });
});

test('E7 support access: independent approval, scoped read and cross-tab revocation', async contextTest => {
	const page = await fixture(contextTest, 390);
	await navigate(page, 'persona=rahunok-admin&section=audit');
	await page.locator('#access-operator').selectOption('varus');
	await page.locator('#access-seller').fill('courier-1');
	await page.locator('#access-reason').fill('DEMO investigate reconciliation');
	await button(page, 'Запросити доступ').click();
	await expect(button(page, 'Переглянути дані')).toHaveCount(0);
	const owner = await page.context().newPage();
	await navigate(owner, 'persona=route-owner&section=audit');
	await expect(button(owner, 'Погодити доступ')).toHaveCount(0);
	await navigate(owner, 'persona=varus-owner&section=audit');
	await owner.locator('#access-decision').fill('DEMO scoped consent');
	await button(owner, 'Погодити доступ').click();
	await button(page, 'Переглянути дані').click();
	const payload = page.locator('[aria-label="Винятковий доступ підтримки"] pre');
	await expect(payload).toContainText('courier-1');
	await expect(payload).not.toContainText('courier-2');
	await expect(payload).not.toContainText('"profile"');
	await expect(page.getByRole('table', { name: 'Журнал змін' })).toContainText('access.read');
	assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
	await page.screenshot({ path: `${screenshots}/support-mobile.png`, fullPage: true });
	await owner.locator('#access-decision').fill('DEMO investigation complete');
	await button(owner, 'Відкликати доступ').click();
	await expect(payload).toHaveCount(0);
	await expect(button(page, 'Переглянути дані')).toHaveCount(0);
	await page.reload();
	await expect(page.getByRole('table', { name: 'Журнал змін' })).toContainText('access.read');
	await expect(payload).toHaveCount(0);
	await owner.close();
});

test('E8 route B: external payouts, shared courier, replay, conflict, refund, revoked key and reset', async contextTest => {
	const page = await fixture(contextTest);
	for (const persona of ['varus-accountant', 'route-owner']) {
		await navigate(page, `persona=${persona}&section=payouts`);
		await page.locator('#external-id').fill('DEMO-shared-reference');
		await page.locator('#payout-status').selectOption('paid');
		await button(page, 'Облікувати зовнішню виплату').click();
		await expect(page.getByRole('status')).toContainText('збережено');
		const saved = await page.evaluate(key => localStorage.getItem(key), storageKey);
		await button(page, 'Облікувати зовнішню виплату').click();
		assert.equal(await page.evaluate(key => localStorage.getItem(key), storageKey), saved);
		await page.locator('#external-amount').fill('1001');
		await button(page, 'Облікувати зовнішню виплату').click();
		await expect(page.getByRole('alert')).toContainText('CONFLICT');
		assert.equal(await page.evaluate(key => localStorage.getItem(key), storageKey), saved);
	}
	await navigate(page, 'persona=varus-integrator&section=integrations');
	await button(page, 'Створити тестовий ключ').click();
	await page.locator('#import-key').selectOption('DEMO-key-one');
	const income = { id: 'DEMO-route-b-income', kind: 'income', courierId: 'courier-1', amountMinor: 2000, currency: 'UAH', occurredAt: '2026-09-20T00:00:00.000Z', activity: 'delivery' };
	const importRows = async rows => {
		await page.locator('#import-content').fill(JSON.stringify(rows));
		await button(page, 'Перевірити імпорт').click();
		await button(page, 'Записати демоподії').click();
	};
	await importRows([income]);
	await expect(page.locator('output')).toContainText('processed');
	const saved = await page.evaluate(key => localStorage.getItem(key), storageKey);
	await importRows([income]);
	await expect(page.locator('output')).toContainText('replayed');
	assert.equal(await page.evaluate(key => localStorage.getItem(key), storageKey), saved);
	await importRows([{ ...income, amountMinor: 2001 }]);
	await expect(page.locator('output')).toContainText('rejected');
	assert.equal(await page.evaluate(key => localStorage.getItem(key), storageKey), saved);
	await importRows([{ ...income, id: 'DEMO-route-b-refund', amountMinor: -500, adjustment: 'refund', originalId: income.id, reason: 'DEMO partial refund' }]);
	await expect(page.locator('output')).toContainText('processed');
	await button(page, 'Відкликати DEMO-key-one').click();
	await button(page, 'Підтвердити зміну ключа').click();
	await expect(page.locator('#import-key option')).toHaveCount(1);
	await expect(button(page, 'Записати демоподії')).toBeDisabled();
	await page.reload();
	await expect(page.locator('#import-key option')).toHaveCount(1);
	await navigate(page, 'persona=varus-integrator&section=payouts');
	await expect(page.locator('h1')).toHaveText('Огляд');
	await expect(button(page, 'Виплати')).toHaveCount(0);
	await navigate(page, 'persona=courier-1&section=payouts');
	await expect(page.locator('.module tbody tr')).toHaveCount(2);
	for (const [operator, incomeText, paidText] of [['varus', '165,00', '10,00'], ['route', '200,00', '60,00']]) {
		await page.locator('#payout-operator').selectOption(operator);
		await expect(page.locator('.module tbody tr')).toHaveCount(1);
		await expect(page.locator('.module tbody')).toContainText(incomeText);
		await expect(page.locator('.module tbody')).toContainText(paidText);
		await expect(page.locator('.record')).toHaveCount(1);
		await expect(page.locator('.record')).not.toContainText('courier-2');
	}
	await page.reload();
	await expect(page.locator('.module tbody tr')).toHaveCount(2);
	await navigate(page, 'persona=varus-owner');
	await reset(page);
	await expect(page.locator('.metrics')).toContainText('850,00');
	await navigate(page, 'persona=route-owner');
	await expect(page.locator('.metrics')).toContainText('340,00');
	await navigate(page, 'persona=courier-1&section=payouts');
	await expect(page.locator('.record')).toHaveCount(0);
});

test('E7: courier clarification, compliance review and administrator suspension', async contextTest => {
	const page = await fixture(contextTest);
	await navigate(page, 'persona=varus-compliance&section=couriers');
	await button(page, 'courier-1').click();
	await button(page, 'Зберегти профіль').click();
	await button(page, 'Запросити уточнення').click();
	await navigate(page, 'persona=courier-1&section=couriers');
	await button(page, 'Надіслати уточнення · varus').click();
	await expect(page.locator('main')).toContainText('Очікує перевірки');
	await navigate(page, 'persona=varus-compliance&section=couriers');
	await button(page, 'courier-1').click();
	await button(page, 'Прийняти уточнення до перевірки').click();
	await expect(page.locator('#seller-documents')).toHaveValue('DEMO updated document');
	await navigate(page, 'persona=rahunok-admin&section=platforms');
	await expect(page.locator('main')).not.toContainText('DEMO-TIN');
	await button(page, 'Призупинити · varus').click();
	await button(page, 'Підтвердити рішення').click();
	await navigate(page, 'persona=varus-integrator&section=integrations');
	await button(page, 'Створити тестовий ключ').click();
	await expect(page.getByRole('alert')).toContainText('OPERATOR_SUSPENDED');
});

test('E8: delegated reset and cross-tab revocation clear protected views', async contextTest => {
	const page = await fixture(contextTest);
	await navigate(page, 'persona=varus-owner&section=team');
	await button(page, 'Створити запрошення').click();
	await page.locator('#demo-persona').selectOption('demo-member-new');
	await button(page, 'Прийняти демозапрошення').click();
	await reset(page);
	await expect(page.locator('#demo-persona')).toHaveValue('courier-1');
	await navigate(page, 'persona=varus-accountant&section=operations');
	const owner = await page.context().newPage();
	await navigate(owner, 'persona=varus-owner&section=team');
	owner.once('dialog', dialog => dialog.dismiss());
	await owner.locator('.row').filter({ hasText: 'VARUS · бухгалтер' }).getByRole('button', { name: 'Відкликати', exact: true }).click();
	await expect(owner.locator('.row').filter({ hasText: 'VARUS · бухгалтер' })).toContainText('active');
	owner.once('dialog', dialog => dialog.accept());
	await owner.locator('.row').filter({ hasText: 'VARUS · бухгалтер' }).getByRole('button', { name: 'Відкликати', exact: true }).click();
	await expect(page.locator('h1')).toHaveText('Огляд');
	await expect(button(page, 'Операції')).toHaveCount(0);
	await expect(page.locator('tbody')).toHaveCount(0);
	await page.reload();
	await expect(button(page, 'Операції')).toHaveCount(0);
	await owner.close();
});

test('E7: monthly platform payouts, private technical queue, journal and resume', async contextTest => {
	const page = await fixture(contextTest);
	for (const [persona, period, reference] of [['varus-accountant', '2026-08', 'DEMO-august'], ['varus-accountant', '2026-09', 'DEMO-september'], ['route-owner', '2026-09', 'DEMO-route']]) {
		await navigate(page, `persona=${persona}&section=payouts`);
		await page.locator('#payout-period').fill(period);
		await page.locator('#external-id').fill(reference);
		await page.locator('#payout-evidence').fill('DEMO private reconciliation evidence');
		await button(page, 'Облікувати зовнішню виплату').click();
		await expect(page.getByRole('status')).toContainText('збережено');
	}
	await navigate(page, 'persona=courier-1');
	await button(page, 'Виплати на звірці · 2026-08').click();
	await expect(page.locator('.module')).toContainText('DEMO-august');
	await expect(page.locator('.module')).not.toContainText('DEMO-september');
	await page.locator('#payout-period').fill('2026-09');
	await page.locator('#payout-operator').selectOption('route');
	await expect(page.locator('.module')).toContainText('DEMO-route');
	await expect(page.locator('.module')).not.toContainText('DEMO-september');
	await expect(page.locator('.module')).not.toContainText('private reconciliation');
	await page.setViewportSize({ width: 390, height: 844 });
	assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
	await page.screenshot({ path: `${screenshots}/courier-payout-mobile.png`, fullPage: true });
	await navigate(page, 'persona=rahunok-admin&section=platforms');
	await expect(page.getByRole('table', { name: 'Технічні проблеми' }).locator('tbody tr')).toHaveCount(3);
	await expect(page.locator('main')).not.toContainText('private reconciliation');
	await button(page, 'Призупинити · varus').click();
	await button(page, 'Підтвердити рішення').click();
	await navigate(page, 'persona=varus-integrator&section=integrations');
	await button(page, 'Створити тестовий ключ').click();
	await expect(page.getByRole('alert')).toContainText('OPERATOR_SUSPENDED');
	await navigate(page, 'persona=rahunok-admin&section=platforms');
	await button(page, 'Відновити роботу · varus').click();
	await button(page, 'Підтвердити рішення').click();
	await button(page, 'Журнал').click();
	await expect(page.getByRole('table', { name: 'Журнал змін' })).toContainText('varus-accountant');
	await expect(page.getByRole('table', { name: 'Журнал змін' })).toContainText('payout.external');
	await expect(page.getByRole('table', { name: 'Журнал змін' })).toContainText('Застосовано');
	await page.setViewportSize({ width: 1440, height: 1000 });
	await page.screenshot({ path: `${screenshots}/admin-journal-desktop.png`, fullPage: true });
	await navigate(page, 'persona=varus-integrator&section=integrations');
	await button(page, 'Створити тестовий ключ').click();
	await expect(page.getByRole('status')).toContainText('збережено');
	await page.getByRole('button', { name: 'Ротація DEMO-key-one', exact: true }).click();
	await button(page, 'Скасувати').click();
	await expect(page.locator('#import-key option')).toHaveCount(2);
	await page.getByRole('button', { name: 'Відкликати DEMO-key-one', exact: true }).click();
	await button(page, 'Підтвердити зміну ключа').click();
	await expect(page.locator('#import-key option')).toHaveCount(1);
});