import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { rolldown } from 'rolldown';
import { compile } from 'svelte/compiler';
import { compile as compileCss } from '@tailwindcss/node';
import { chromium } from '@playwright/test';

const root = fileURLToPath(new URL('../', import.meta.url));
const component = resolve(root, 'src/lib/features/dashboard/structure/BusinessStructure.svelte').replaceAll('\\', '/');
const entry = resolve(root, 'scripts/__business_contact_entry.js').replaceAll('\\', '/');
const fixture = resolve(root, 'scripts/__business_contact_fixture.svelte').replaceAll('\\', '/');

test('business contacts create, hydrate, clear and validate on desktop and mobile', async () => {
	const source = await readFile(component, 'utf8');
	const wrapper = `<script>
import Structure from ${JSON.stringify(component)};
let entities = $state([]);
globalThis.contactWrites = [];
async function create(input) { globalThis.contactWrites.push(input); entities = [...entities, {...input, id: 'entity-1', isActive: true}]; }
async function update(id, input) { globalThis.contactWrites.push(input); entities = entities.map(entity => entity.id === id ? {...entity, ...input} : entity); }
</script>
<Structure merchant={{id:'preview',userId:'preview',businessName:'Preview',displayName:'Preview'}} initialEntities={entities} initialTerminals={[]} onCreateEntity={create} onUpdateEntity={update} onUpdateMerchantName={async()=>{}} onDeleteEntity={async()=>{}} onCreateTerminal={async()=>{}} onUpdateTerminal={async()=>{}} onDeleteTerminal={async()=>{}} />`;
	const bundle = await rolldown({
		cwd: root, input: entry, platform: 'browser', resolve: { conditionNames: ['browser', 'import', 'default'] },
		plugins: [{ name: 'business-contact-fixture',
			resolveId(value) { if (value === entry || value === fixture) return value; },
			async load(path) {
				if (path === entry) return `import {mount} from 'svelte'; import Fixture from ${JSON.stringify(fixture)}; mount(Fixture,{target:document.querySelector('#fixture')});`;
				if (path.endsWith('.svelte')) return compile(path === fixture ? wrapper : await readFile(path, 'utf8'), { filename: path, generate: 'client', css: 'injected' }).js.code;
			}
		}]
	});
	const output = await bundle.generate({ format: 'esm', codeSplitting: false });
	await bundle.close();
	const css = await compileCss('@import "tailwindcss";', { base: root, onDependency() {} });
	const styles = css.build([...source.matchAll(/class="([^"]+)"/g)].flatMap(match => match[1].split(/\s+/)));
	const resources = new Map([
		['/', ['text/html; charset=utf-8', '<!doctype html><html lang="uk"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,"><link rel="stylesheet" href="/style.css"><div id="fixture"></div><script type="module" src="/fixture.js"></script></html>']],
		['/style.css', ['text/css', styles]],
		['/fixture.js', ['text/javascript', output.output.find(item => item.type === 'chunk').code]]
	]);
	const server = createServer((request, response) => {
		const resource = resources.get(request.url);
		response.writeHead(resource ? 200 : 404, { 'Content-Type': resource?.[0] ?? 'text/plain', 'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src data:; connect-src 'none'" });
		response.end(resource?.[1] ?? 'Not found');
	});
	await new Promise(accept => server.listen(0, '127.0.0.1', accept));
	const browser = await chromium.launch({ headless: true });
	try {
		for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
			const page = await browser.newPage({ viewport });
			const errors = [];
			page.on('pageerror', error => errors.push(error.message));
			await page.goto(`http://127.0.0.1:${server.address().port}/`);
			await page.getByRole('status').waitFor();
			assert.equal(await page.evaluate(() => globalThis.contactWrites.length), 0);
			await page.getByRole('button', { name: '\u0414\u043e\u0434\u0430\u0442\u0438 \u043f\u0440\u043e\u0434\u0430\u0432\u0446\u044f', exact: true }).click();
			const dialog = page.getByRole('dialog');
			await dialog.locator('select').selectOption('self_employed');
			await dialog.getByLabel('\u041f\u0443\u0431\u043b\u0456\u0447\u043d\u0430 \u043d\u0430\u0437\u0432\u0430').fill('Contact Test');
			await dialog.getByLabel('\u042e\u0440\u0438\u0434\u0438\u0447\u043d\u0430 \u043d\u0430\u0437\u0432\u0430').fill('Test Person');
			await dialog.getByLabel('\u0404\u0414\u0420\u041f\u041e\u0423').fill('1234567890');
			await dialog.getByLabel('\u0411\u0430\u043d\u043a', { exact: true }).fill('Bank');
			await dialog.getByLabel('IBAN').fill('UA663052990000026007123456789');
			await dialog.getByLabel('\u0422\u0435\u043b\u0435\u0444\u043e\u043d', { exact: false }).fill('067 123 45 67');
			await dialog.getByLabel('Email', { exact: false }).fill('owner@example.com');
			await dialog.getByLabel('\u0412\u0435\u0431\u0441\u0430\u0439\u0442', { exact: false }).fill('example.com');
			const save = dialog.getByRole('button', { name: /\u0417\u0431\u0435\u0440\u0435\u0433\u0442\u0438/ });
			await save.click();
			await dialog.waitFor({ state: 'hidden' });
			assert.deepEqual(await page.evaluate(() => globalThis.contactWrites[0]), {
				businessType: 'self_employed', businessName: 'Test Person', displayName: 'Contact Test', taxId: '1234567890', bankName: 'Bank', iban: 'UA663052990000026007123456789', phone: '+380671234567', contactEmail: 'owner@example.com', website: 'https://example.com/'
			});
			await page.getByRole('button', { name: /\u0420\u0435\u0434\u0430\u0433\u0443\u0432\u0430\u0442\u0438/ }).first().click();
			assert.equal(await dialog.getByLabel('Email', { exact: false }).inputValue(), 'owner@example.com');
			assert.equal(await dialog.getByLabel('\u0422\u0435\u043b\u0435\u0444\u043e\u043d', { exact: false }).inputValue(), '+380671234567');
			await dialog.getByLabel('\u0412\u0435\u0431\u0441\u0430\u0439\u0442', { exact: false }).fill('javascript:bad');
			await save.click();
			await dialog.getByRole('alert').waitFor();
			assert.equal(await page.evaluate(() => globalThis.contactWrites.length), 1);
			await dialog.getByLabel('\u0412\u0435\u0431\u0441\u0430\u0439\u0442', { exact: false }).fill('');
			await page.screenshot({ path: `test-results/business-contacts-${viewport.width}.png`, fullPage: true });
			assert.ok(await dialog.evaluate(element => element.clientHeight <= innerHeight));
			await save.click();
			await dialog.waitFor({ state: 'hidden' });
			assert.equal(await page.evaluate(() => globalThis.contactWrites[1].website), '');
			assert.deepEqual(errors, []);
			await page.close();
		}
	} finally {
		await browser.close();
		await new Promise(accept => server.close(accept));
	}
});