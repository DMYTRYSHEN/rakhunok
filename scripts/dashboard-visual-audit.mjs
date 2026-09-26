import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export function inspectVisualState() {
	const canvas = document.createElement('canvas');
	const context = canvas.getContext('2d', { willReadFrequently: true });
	const parse = (color) => {
		context.clearRect(0, 0, 1, 1);
		context.fillStyle = color;
		context.fillRect(0, 0, 1, 1);
		return [...context.getImageData(0, 0, 1, 1).data].map((value) => value / 255);
	};
	const blend = (front, back) =>
		front.slice(0, 3).map((value, index) => value * front[3] + back[index] * (1 - front[3]));
	const luminance = (color) =>
		color
			.slice(0, 3)
			.map((value) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4))
			.reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
	const failures = [];
	const dialog = [
		...document.querySelectorAll('[role="dialog"], dialog[open], main .fixed.inset-0.z-50')
	].find((element) => element.checkVisibility());
	for (const element of (
		dialog ||
		document.querySelector('main') ||
		document.body
	).querySelectorAll('*')) {
		if (
			!(element instanceof HTMLElement) ||
			!element.checkVisibility({ opacityProperty: true, visibilityProperty: true })
		)
			continue;
		if (
			element.closest(
				'[disabled], [aria-disabled="true"], .sr-only, svg, canvas, script, style, input[type="checkbox"], input[type="radio"]'
			)
		)
			continue;
		const text =
			[...element.childNodes]
				.filter((node) => node.nodeType === Node.TEXT_NODE)
				.map((node) => node.textContent)
				.join(' ')
				.trim() ||
			(element.matches('input, textarea, select')
				? element.value || element.getAttribute('placeholder')
				: '');
		if (!text) continue;
		const ancestors = [];
		let ancestor = element;
		while (ancestor) {
			ancestors.unshift(ancestor);
			ancestor = ancestor.parentElement;
		}
		let background = [1, 1, 1];
		let opacity = 1;
		let imageBackground = false;
		for (const parent of ancestors) {
			const style = getComputedStyle(parent);
			background = blend(parse(style.backgroundColor), background);
			opacity *= Number(style.opacity);
			if (style.backgroundImage !== 'none') imageBackground = true;
		}
		if (imageBackground || opacity < 1) continue;
		const style = getComputedStyle(element);
		const foreground = blend(parse(style.color), background);
		const foregroundLuminance = luminance(foreground);
		const backgroundLuminance = luminance(background);
		const ratio =
			(Math.max(foregroundLuminance, backgroundLuminance) + 0.05) /
			(Math.min(foregroundLuminance, backgroundLuminance) + 0.05);
		const large =
			parseFloat(style.fontSize) >= 24 ||
			(parseFloat(style.fontSize) >= 18.66 && Number(style.fontWeight) >= 700);
		if (ratio < (large ? 3 : 4.5))
			failures.push({
				text: text.slice(0, 100),
				ratio: Number(ratio.toFixed(2)),
				tag: element.tagName,
				classes: element.className,
				parent: element.parentElement?.className,
				color: style.color,
				background: background.map((value) => Math.round(value * 255))
			});
	}
	const width = document.documentElement.clientWidth;
	return {
		title: document.title,
		overflow: document.documentElement.scrollWidth > width,
		width,
		scrollWidth: document.documentElement.scrollWidth,
		overflowElements: [...document.querySelectorAll('main *')]
			.filter((element) => element.checkVisibility())
			.filter((element) => element.getBoundingClientRect().right > width + 1)
			.slice(0, 8)
			.map((element) => ({
				classes: element.className,
				text: element.textContent?.trim().slice(0, 50)
			})),
		failures
	};
}

const routes = [
	'',
	'settings',
	'invoices',
	'invoices/demo-1048',
	'invoices/demo-1047',
	'invoices/missing',
	'invoices/new?type=fixed',
	'invoices/new?type=open_amount',
	'invoices/new?type=table',
	'invoices/new?type=delivery',
	'invoices/new?type=recurring',
	'invoices/new?type=rtp',
	'pos',
	'proformas',
	'structure',
	'invoice-rules',
	'payment-methods',
	'checkout-templates',
	'public-page',
	'team',
	'developer-api',
	'sandbox'
].filter((route) => !process.env.AUDIT_ROUTE || route.includes(process.env.AUDIT_ROUTE));
const themes = process.env.AUDIT_THEME ? [process.env.AUDIT_THEME] : ['light', 'dark'];
const widths = process.env.AUDIT_WIDTH ? [Number(process.env.AUDIT_WIDTH)] : [390, 1440];
const output = join(tmpdir(), 'corex-dashboard-visual-audit');
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const results = [];
try {
	for (const theme of themes) {
		for (const width of widths) {
			for (const route of routes) {
				const context = await browser.newContext({
					viewport: { width, height: 1000 },
					hasTouch: width === 390
				});
				await context.route('**/*', (request) => {
					const url = new URL(request.request().url());
					return url.origin === 'http://localhost:5173' &&
						['GET', 'HEAD'].includes(request.request().method())
						? request.continue()
						: request.abort();
				});
				const page = await context.newPage();
				await page.addInitScript((value) => localStorage.setItem('rahunok_theme', value), theme);
				const record = { route, theme, width, states: [] };
				const capture = async (name) => {
					await page.evaluate(() => document.fonts.ready);
					record.states.push({ name, ...(await page.evaluate(inspectVisualState)) });
					await page.screenshot({
						path: join(
							output,
							`${theme}-${width}-${route.replace(/[^a-z0-9]/gi, '_') || 'overview'}-${name}.png`
						),
						fullPage: true
					});
				};
				try {
					await page.goto(
						`http://localhost:5173/dashboard/${route}${route.includes('?') ? '&' : '?'}demo=1`
					);
					await page.locator('main').waitFor();
					await page.getByText('Завантажуємо дані', { exact: true }).waitFor({ state: 'hidden' });
					await page.locator('main h1, main h2').first().waitFor();
					await capture('default');
					if (route === 'invoices') {
						await page.getByRole('combobox', { name: 'Період', exact: true }).selectOption('all');
						await capture('populated');
						if (width === 1440) {
							await page.locator('tbody tr').first().hover();
							await capture('hover');
						}
						await page.getByRole('searchbox').fill('visual-audit-no-match');
						await capture('empty');
						await page.getByRole('button', { name: /Диспетчер розбіжностей/ }).click();
						await capture('discrepancies');
					}
					if (route === 'settings') {
						for (const option of await page.locator('input[name="table-ttl"]').all()) {
							await option.locator('..').click();
							await capture(`duration-${await option.getAttribute('value')}`);
						}
					}
					if (route === 'team') {
						await page.getByRole('button', { name: 'Запросити співробітника' }).click();
						await page
							.getByRole('heading', { name: 'Запросити співробітника', exact: true })
							.waitFor();
						await capture('invite');
					}
					if (route === 'checkout-templates') {
						await page.getByRole('button', { name: '+ Новий шаблон' }).click();
						const editor = page.getByRole('dialog', { name: 'Новий шаблон' });
						await editor.waitFor();
						await capture('editor');
						for (const type of ['fixed', 'open_amount', 'tips', 'fuel_station']) {
							await editor.getByRole('combobox', { name: 'Тип чекауту' }).selectOption(type);
							if (width < 768) await editor.getByRole('button', { name: 'Прев’ю' }).click();
							await editor.getByRole('heading', { name: 'Перевірка вигляду' }).waitFor();
							await capture(`preview-${type}`);
							if (width < 768)
								await editor.getByRole('button', { name: 'Налаштування', exact: true }).click();
						}
					}
					if (route === 'pos') {
						await page.getByRole('button', { name: 'Нове замовлення (чернетка)' }).first().click();
						await capture('draft');
						await page.getByRole('button', { name: 'Товари', exact: true }).click();
						await capture('products');
						if (width === 390) {
							await page.getByRole('button', { name: 'Відкрити поточне замовлення' }).click();
							await capture('receipt');
						}
					}
					if (route === 'proformas') {
						const base = page.url();
						for (const [name, label] of [
							['seller', /Вибрати продавця|Rahunok Coffee/],
							['customer', /Вибрати або створити кому/],
							['payment', /^Змінити$/],
							['recurrence', /Регулярність рахунку/],
							['project', /Проєкти та групи/],
							['preview', /^Передогляд$/],
							['act', /^Акт$/],
							['notes', /Додати примітки/],
							['journal', /Журнал проформ/]
						]) {
							await page.goto('about:blank');
							await page.goto(base);
							await page.locator('main').getByRole('button', { name: label }).first().click();
							await capture(name);
						}
					}
					for (const details of await page.locator('main details').all()) {
						if (!((await details.getAttribute('open')) !== null))
							await details.locator('summary').first().click();
					}
					if (await page.locator('main details').count()) await capture('expanded');
				} catch (error) {
					record.error = error.message;
				}
				results.push(record);
				console.log(
					JSON.stringify({
						route,
						theme,
						width,
						errors: record.error,
						states: record.states.map((state) => ({
							name: state.name,
							failures: state.failures.length,
							overflow: state.overflow
						}))
					})
				);
				await context.close();
			}
		}
	}
} finally {
	await browser.close();
	await writeFile(join(output, 'report.json'), JSON.stringify(results, null, 2));
	console.log(`Audit output: ${output}`);
	const failed = results.filter(
		(record) =>
			record.error || record.states.some((state) => state.overflow || state.failures.length)
	);
	console.log(
		`Checked ${results.reduce((total, record) => total + record.states.length, 0)} states; ${failed.length} route/theme/viewport combinations failed.`
	);
	if (!results.length || failed.length) process.exitCode = 1;
}
