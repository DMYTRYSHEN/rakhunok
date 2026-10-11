import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile, readdir } from 'node:fs/promises';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { rolldown } from 'rolldown';
import { compile } from 'svelte/compiler';
import { chromium, expect } from '@playwright/test';

const root = fileURLToPath(new URL('../', import.meta.url));
const component = resolve(root, 'src/lib/features/dashboard/invoices/InvoiceCreate.svelte').replaceAll('\\', '/');
const entry = resolve(root, 'scripts/__invoice_focus.js').replaceAll('\\', '/');
const fixture = resolve(root, 'scripts/__invoice_focus.svelte').replaceAll('\\', '/');

test('real invoice amount focus, templates, delivery arithmetic and stable desktop/mobile keypad', async () => {
	const wrapper = `<script>
import Invoice from ${JSON.stringify(component)};
const terminals = [{id:'table-1',name:'Table 1',code:'1',type:'table',isActive:true}];
</script><Invoice {terminals} demo={true} businessContext={{merchantId:'fixture',userId:'fixture',name:'Fixture'}} />`;
	const bundle = await rolldown({ cwd: root, input: entry, platform: 'browser', resolve: { conditionNames: ['browser', 'import', 'default'] },
		plugins: [{ name: 'invoice-focus-fixture',
			resolveId(value) {
				if (value === '$env/dynamic/public') return '\0env';
				if (value.startsWith('$app/')) return '\0' + value;
				if (value.endsWith('/template-repository')) return '\0templates';
				if (value.endsWith('/proforma-repository')) return '\0proformas';
				if (value.startsWith('$lib/')) return resolve(root, 'src/lib', value.slice(5)) + (value.endsWith('.svelte') ? '' : '.ts');
				if (value === entry || value === fixture) return value;
			},
			async load(path) {
				if (path === '\0env') return 'export const env = {};';
				if (path === '\0$app/paths') return 'export const resolve = path => path;';
				if (path === '\0$app/navigation') return 'export const goto = () => {throw new Error("No navigation/write allowed");};';
				if (path === '\0$app/state') return 'export const page = {url:new URL(location.href)};';
				if (path === '\0proformas') return 'export const listProformas = async () => []; export const saveProforma = () => {throw new Error("No writes allowed");};';
				if (path === '\0templates') return `export const listTemplates = async () => ['fixed','table','delivery','open_amount'].map(type => ({id:type,name:'Fixture '+type,scenario_type:type,scenario_config:{},is_default:false}));`;
				if (path === entry) return `import {mount} from 'svelte';import Fixture from ${JSON.stringify(fixture)};mount(Fixture,{target:document.querySelector('#fixture')});`;
				if (path.endsWith('.svelte')) return compile(path === fixture ? wrapper : await readFile(path, 'utf8'), { filename: path, generate: 'client', css: 'injected' }).js.code;
			}
		}]
	});
	const output = await bundle.generate({ format: 'esm', codeSplitting: false });
	await bundle.close();
	const assetDir = resolve(root, 'build/_app/immutable/assets');
	const css = (await Promise.all((await readdir(assetDir)).filter(name => name.endsWith('.css')).map(name => readFile(resolve(assetDir, name), 'utf8')))).join('\n');
	const resources = new Map([
		['/', ['text/html; charset=utf-8', '<!doctype html><html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,"><link rel="stylesheet" href="/fixture.css"><div id="fixture"></div><script type="module" src="/fixture.js"></script></html>']],
		['/fixture.css', ['text/css', css]],
		['/fixture.js', ['text/javascript', output.output.find(item => item.type === 'chunk').code]]
	]);
	const server = createServer((request, response) => {
		const resource = resources.get(request.url.split('?')[0]);
		response.writeHead(resource ? 200 : 404, { 'Content-Type': resource?.[0] ?? 'text/plain' });
		response.end(resource?.[1] ?? 'Not found');
	});
	await new Promise(accept => server.listen(0, '127.0.0.1', accept));
	const browser = await chromium.launch({ headless: true });
	try {
		for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
			for (const scenario of ['fixed', 'table', 'delivery', 'open_amount']) {
				const page = await browser.newPage({ viewport });
				const errors = [];
				page.on('pageerror', error => errors.push(error.message));
				await page.route('**/*', route => route.request().url().startsWith('http://127.0.0.1:') ? route.continue() : route.abort());
				await page.goto(`http://127.0.0.1:${server.address().port}/?type=${scenario}`);
				const target = page.getByRole('textbox', { name: 'Сума рахунку', exact: true });
				const keypad = page.locator('aside').getByRole('button', { name: 'Видалити цифру' });
				const verifyFocus = async type => {
					if (type === 'open_amount') {
						await expect(target).toHaveCount(0);
						await expect(keypad).toHaveCount(0);
						assert.equal(await page.evaluate(() => document.activeElement?.tagName === 'INPUT'), false);
					} else {
						await expect(target).toBeFocused();
						await expect(keypad).toBeVisible();
						assert.deepEqual(await target.evaluate(input => [input.selectionStart, input.selectionEnd]), [0, 1]);
					}
				};
				await verifyFocus(scenario);
				await page.locator('aside').screenshot({ path: `test-results/invoice-focus-panel-${scenario}-${viewport.width}.png` });
				if (scenario === 'open_amount') {
					await page.locator('aside').getByRole('button', { name: 'Переглянути рахунок' }).click();
					await page.getByRole('dialog').press('Escape');
					await verifyFocus(scenario);
				}
				for (const type of ['fixed', 'table', 'delivery', 'open_amount']) {
					const names = {fixed:'Фіксований рахунок', table:'Рахунок за столиком', delivery:'Нова пошта / Доставка', open_amount:'Вільна сума'};
					await page.getByRole('button', { name: names[type], exact: false }).click();
					await verifyFocus(type);
				}
				const templates = page.locator('select').filter({ has: page.locator('option[value="delivery"]') });
				for (const type of ['fixed', 'table', 'delivery', 'open_amount']) {
					await templates.selectOption(type);
					await verifyFocus(type);
					if (type !== 'open_amount') {
						await target.press('4');
						await expect(target).toHaveValue('4');
						await expect(page.getByRole('textbox', { name: type === 'delivery' ? /^Вартість товарів/ : /^Сума до сплати/ })).toHaveValue('4');
						await page.locator('aside').getByRole('button', { name: '.', exact: true }).click();
						await page.locator('aside').getByRole('button', { name: '5', exact: true }).click();
						await expect(target).toHaveValue('4.5');
						await keypad.click();
						await expect(target).toHaveValue('4.');
						await target.focus();
						await target.press('End');
						await target.press('8');
						await expect(target).toHaveValue('4.8');
						await target.press('Backspace');
						await expect(target).toHaveValue('4.');
						await page.locator('aside').getByRole('button', { name: '+100', exact: true }).click();
						await expect(target).toHaveValue('104');
						await expect(page.getByRole('textbox', { name: type === 'delivery' ? /^Вартість товарів/ : /^Сума до сплати/ })).toHaveValue('104');
						await target.focus();
						await target.press('Enter');
						await page.getByRole('dialog').press('Escape');
						await expect(target).toBeFocused();
					}
				}
				await templates.selectOption('delivery');
				await target.fill('0012,5');
				await expect(target).toHaveValue('12.5');
				await expect(page.getByRole('textbox', { name: /^Вартість товарів/ })).toHaveValue('12.5');
				await page.getByRole('textbox', { name: /^Вартість доставки/ }).fill('7.5');
				const total = page.locator('aside strong').first();
				await expect(total).toHaveText(/20/);
				const geometry = () => keypad.evaluate(button => {
					const rect = button.getBoundingClientRect();
					const panel = button.closest('aside').getBoundingClientRect();
					return [rect.x - panel.x, rect.y - panel.y, rect.width, rect.height];
				});
				const before = await geometry();
				await page.locator('aside').getByRole('button', { name: '+50', exact: true }).click();
				await expect(target).toHaveValue('62.5');
				await expect(total).toHaveText(/70/);
				await keypad.click();
				await expect(target).toHaveValue('62.');
				await page.locator('aside').getByRole('button', { name: '5', exact: true }).click();
				await expect(target).toHaveValue('62.5');
				await expect(page.getByRole('textbox', { name: /^Вартість доставки/ })).toHaveValue('7.5');
				await target.focus();
				await target.press('Enter');
				await expect(page.getByRole('dialog')).toBeVisible();
				await page.getByRole('dialog').press('Escape');
				await expect(target).toBeFocused();
				await target.fill('123456789');
				assert.deepEqual(await geometry(), before);
				assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
				assert.equal(await target.evaluate(input => input.getBoundingClientRect().right <= input.closest('aside').getBoundingClientRect().right), true);
				await page.screenshot({ path: `test-results/invoice-focus-${scenario}-${viewport.width}.png`, fullPage: true });
				assert.deepEqual(errors, []);
				await page.close();
			}
		}
	} finally {
		await browser.close();
		await new Promise(accept => server.close(accept));
	}
});