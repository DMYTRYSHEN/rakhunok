import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { rolldown } from 'rolldown';
import { compile } from 'svelte/compiler';
import { chromium } from '@playwright/test';

const root = fileURLToPath(new URL('../', import.meta.url));
const component = resolve(root, 'src/lib/features/dashboard/business-settings/InvoiceReadinessNotice.svelte').replaceAll('\\', '/');
const entry = resolve(root, 'scripts/__readiness_test.js').replaceAll('\\', '/');
const fixture = resolve(root, 'scripts/__readiness_test.svelte').replaceAll('\\', '/');

test('real readiness notice links existing forms and supports retry on desktop and mobile', async () => {
	const wrapper = `<script>
import Notice from ${JSON.stringify(component)};
let issues = $state([
 {entityId:null,label:'Payment model',section:'payment-methods',severity:'blocker'},
 {entityId:'seller /?',label:'Seller contacts',section:'structure',severity:'advisory'},
 {entityId:'seller /?',label:'Confirm VAT',section:'invoice-rules',severity:'blocker'}
]);
let pending = $state(false);
let error = $state('');
let visible = $state(true);
let scope = $state(sessionStorage.getItem('fixture-scope') ?? 'synthetic-session');
globalThis.setScope = (value) => { scope = value; sessionStorage.setItem('fixture-scope', value); };
globalThis.checks = 0;
globalThis.setIssues = (value) => { issues = value; };
globalThis.setVisible = (value) => { visible = value; };
function check() {
 pending = true;
 globalThis.checks++;
 globalThis.finishCheck = (failed) => { pending = false; error = failed ? 'Synthetic read failure' : ''; if (!failed) issues = []; };
}
</script>
{#if visible}<Notice {scope} {issues} {pending} {error} onCheck={check}/>{/if}`;
	const bundle = await rolldown({
		cwd: root, input: entry, platform: 'browser', resolve: { conditionNames: ['browser', 'import', 'default'] },
		plugins: [{ name: 'readiness-fixture',
			resolveId(value) { if (value === '$app/paths') return '\0paths'; if (value === entry || value === fixture) return value; },
			async load(path) {
				if (path === '\0paths') return 'export const resolve = (path) => path;';
				if (path === entry) return `import {mount} from 'svelte';import Fixture from ${JSON.stringify(fixture)};mount(Fixture,{target:document.querySelector('#fixture')});`;
				if (path.endsWith('.svelte')) return compile(path === fixture ? wrapper : await readFile(path, 'utf8'), { filename: path, generate: 'client', css: 'injected' }).js.code;
			}
		}]
	});
	const output = await bundle.generate({ format: 'esm', codeSplitting: false });
	await bundle.close();
	const resources = new Map([
		['/', ['text/html; charset=utf-8', '<!doctype html><html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,"><style>body{margin:16px;font-family:sans-serif}*{box-sizing:border-box}section{max-width:100%}li{overflow-wrap:anywhere}button{min-height:40px}svg{width:16px}</style><div id="fixture"></div><script type="module" src="/fixture.js"></script></html>']],
		['/fixture.js', ['text/javascript', output.output.find(item => item.type === 'chunk').code]]
	]);
	const server = createServer((request, response) => {
		const resource = resources.get(request.url);
		response.writeHead(resource ? 200 : 404, { 'Content-Type': resource?.[0] ?? 'text/plain' });
		response.end(resource?.[1] ?? 'Not found');
	});
	await new Promise(accept => server.listen(0, '127.0.0.1', accept));
	const browser = await chromium.launch({ headless: true });
	try {
		for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
			const page = await browser.newPage({ viewport });
			const errors = [];
			page.on('pageerror', error => errors.push(error.message));
			const clockTime = new Date('2026-10-11T12:00:00Z');
			await page.clock.install({ time: clockTime });
			await page.clock.pauseAt(clockTime);
			await page.goto(`http://127.0.0.1:${server.address().port}/`);
			assert.deepEqual(await page.locator('section a').evaluateAll(links => links.map(link => link.getAttribute('href'))), [
				'/dashboard/payment-methods', '/dashboard/invoice-rules?entityId=seller%20%2F%3F', '/dashboard/structure?entityId=seller%20%2F%3F'
			]);
			assert.equal(await page.locator('.readiness-blockers strong').count(), 2);
			assert.deepEqual(await page.locator('.readiness-blockers').evaluate(element => ({ border: getComputedStyle(element).borderLeftWidth, background: getComputedStyle(element).backgroundColor })), { border: '4px', background: 'rgb(254, 242, 242)' });
			await page.screenshot({ path: `test-results/invoice-readiness-${viewport.width}.png`, fullPage: true });
			await page.clock.runFor(7999);
			assert.equal(await page.getByText('Seller contacts', { exact: true }).isVisible(), true);
			await page.clock.runFor(1);
			await page.evaluate(() => Promise.resolve());
			await page.clock.runFor(200);
			assert.equal(await page.evaluate(() => JSON.parse(sessionStorage.getItem('dashboard:readiness:v1:synthetic-session')).acknowledged), true);
			await page.clock.runFor(400);
			await page.locator('.readiness-advisories').waitFor({ state: 'detached' });
			await page.clock.runFor(60000);
			assert.equal(await page.locator('.readiness-blockers strong').count(), 2);
			const button = page.getByRole('button', { name: /Перевір/ });
			await button.click();
			assert.equal(await button.isDisabled(), true);
			await page.evaluate(() => globalThis.finishCheck(true));
			await page.getByRole('alert').waitFor();
			await page.clock.runFor(60000);
			assert.equal(await page.getByRole('alert').isVisible(), true);
			assert.equal(await button.isEnabled(), true);
			assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
			await page.screenshot({ path: `test-results/invoice-readiness-error-${viewport.width}.png`, fullPage: true });
			await button.click();
			await page.evaluate(() => globalThis.finishCheck(false));
			await page.locator('section').waitFor({ state: 'detached' });
			assert.equal(await page.evaluate(() => globalThis.checks), 2);
			await page.evaluate(() => globalThis.setIssues([{ entityId: 'seller', label: 'Optional phone', section: 'structure', severity: 'advisory' }]));
			assert.equal(await page.locator('.readiness-advisories').count(), 0);
			await page.evaluate(() => globalThis.setScope('new-session'));
			await page.getByText('Optional phone', { exact: true }).waitFor();
			await page.clock.runFor(4000);
			await page.evaluate(() => globalThis.setIssues([{ entityId: 'seller', label: 'Optional bank', section: 'structure', severity: 'advisory' }]));
			await page.getByText('Optional bank', { exact: true }).waitFor();
			await page.clock.runFor(4000);
			await page.clock.runFor(200);
			await page.locator('section').waitFor({ state: 'detached' });
			await page.evaluate(() => globalThis.setScope('close-session'));
			await page.evaluate(() => globalThis.setIssues([{ entityId: 'seller', label: 'Optional email', section: 'structure', severity: 'advisory' }]));
			await page.getByText('Optional email', { exact: true }).waitFor();
			await button.click();
			await page.clock.runFor(8000);
			assert.equal(await button.isDisabled(), true);
			assert.equal(await page.locator('section').isVisible(), true);
			await page.evaluate(() => globalThis.finishCheck(true));
			await page.getByRole('alert').waitFor();
			await page.clock.runFor(60000);
			assert.equal(await page.getByRole('alert').isVisible(), true);
			await button.click();
			await page.evaluate(() => globalThis.finishCheck(false));
			await page.locator('section').waitFor({ state: 'detached' });
			await page.evaluate(() => globalThis.setIssues([{ entityId: 'seller', label: 'Unmount advice', section: 'structure', severity: 'advisory' }]));
			assert.equal(await page.locator('.readiness-advisories').count(), 0);
			await page.evaluate(() => globalThis.setScope('remount-session'));
			await page.getByText('Unmount advice', { exact: true }).waitFor();
			await page.clock.runFor(4000);
			await page.evaluate(() => globalThis.setVisible(false));
			await page.locator('section').waitFor({ state: 'detached' });
			await page.clock.runFor(1000);
			await page.evaluate(() => globalThis.setVisible(true));
			await page.getByText('Unmount advice', { exact: true }).waitFor();
			await page.clock.runFor(4000);
			await page.clock.runFor(200);
			await page.locator('section').waitFor({ state: 'detached' });
			await page.evaluate(() => globalThis.setScope('keyboard-close-session'));
			await page.getByText('Unmount advice', { exact: true }).waitFor();
			const close = page.getByRole('button', { name: 'Закрити рекомендації' });
			assert.equal(await close.getAttribute('title'), 'Закрити рекомендації');
			assert.equal((await close.boundingBox()).width, 44);
			await close.focus();
			await close.press('Enter');
			await page.clock.runFor(200);
			await page.locator('section').waitFor({ state: 'detached' });
			await page.reload();
			await page.locator('.readiness-blockers').waitFor();
			assert.equal(await page.locator('.readiness-advisories').count(), 0);
			await page.emulateMedia({ reducedMotion: 'reduce' });
			await page.evaluate(() => globalThis.setScope('reduced-motion-session'));
			await page.locator('.readiness-advisories').waitFor();
			assert.equal(await page.locator('.readiness-advisories').evaluate(element => element.getAnimations().length), 0);
			await page.getByRole('button', { name: 'Закрити рекомендації' }).click();
			await page.locator('.readiness-advisories').waitFor({ state: 'detached' });
			assert.equal(await page.locator('.readiness-blockers strong').count(), 2);
			assert.deepEqual(errors, []);
			await page.close();
		}
	} finally {
		await browser.close();
		await new Promise(accept => server.close(accept));
	}
});