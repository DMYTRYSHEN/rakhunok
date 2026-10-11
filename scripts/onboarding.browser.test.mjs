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
const component = resolve(root, 'src/lib/features/dashboard/auth/MerchantOnboarding.svelte').replaceAll('\\', '/');
const entry = resolve(root, 'scripts/__onboarding_test.js').replaceAll('\\', '/');
const fixture = resolve(root, 'scripts/__onboarding_test.svelte').replaceAll('\\', '/');

test('two-step onboarding preserves failed input, normalizes retry and supports legal forms responsively', async () => {
	const wrapper = `<script>
import Onboarding from ${JSON.stringify(component)};
let complete = $state(false);
globalThis.onboardingWrites = [];
globalThis.accountSwitches = 0;
async function changeAccount() {
 globalThis.accountSwitches++;
 await new Promise(resolve => { globalThis.finishAccountSwitch = resolve; });
 if (globalThis.accountSwitches === 1) throw new Error('Synthetic sign-out failure');
 complete = true;
}
async function submit(input) {
 globalThis.onboardingWrites.push(input);
 if (globalThis.onboardingWrites.length === 1) throw new Error('Synthetic save failure');
 complete = true;
}
</script>
{#if complete}<h1>Saved</h1>{:else}<Onboarding user={{id:'synthetic',email:'owner@example.com',fullName:null}} onComplete={submit} onSignOut={changeAccount}/>{/if}`;
	const bundle = await rolldown({
		cwd: root, input: entry, platform: 'browser', resolve: { conditionNames: ['browser', 'import', 'default'] },
		plugins: [{ name: 'onboarding-test',
			resolveId(value) { if (value === entry || value === fixture) return value; },
			async load(path) {
				if (path === entry) return `import {mount} from 'svelte';import Fixture from ${JSON.stringify(fixture)};mount(Fixture,{target:document.querySelector('#fixture')});`;
				if (path.endsWith('.svelte')) return compile(path === fixture ? wrapper : await readFile(path, 'utf8'), { filename: path, generate: 'client', css: 'injected' }).js.code;
			}
		}]
	});
	const output = await bundle.generate({ format: 'esm', codeSplitting: false });
	await bundle.close();
	const resources = new Map([
		['/', ['text/html; charset=utf-8', '<!doctype html><html lang="uk"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,"><style>body{margin:0}*{box-sizing:border-box}</style><div id="fixture"></div><script type="module" src="/fixture.js"></script></html>']],
		['/fixture.js', ['text/javascript', output.output.find(item => item.type === 'chunk').code]]
	]);
	const server = createServer((request, response) => {
		const resource = resources.get(request.url);
		response.writeHead(resource ? 200 : 404, { 'Content-Type': resource?.[0] ?? 'text/plain', 'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'none'; img-src data:" });
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
			await page.locator('#legal-name').fill('Preserved draft');
			const switchButton = page.locator('.switch-account');
			await switchButton.click();
			assert.equal(await switchButton.isDisabled(), true);
			assert.equal(await page.locator('#legal-name').isDisabled(), true);
			await page.evaluate(() => globalThis.finishAccountSwitch());
			await page.getByRole('alert').waitFor();
			assert.equal(await page.locator('#legal-name').inputValue(), 'Preserved draft');
			assert.equal(await switchButton.isEnabled(), true);
			await switchButton.click();
			await page.evaluate(() => globalThis.finishAccountSwitch());
			await page.getByRole('heading', { name: 'Saved' }).waitFor();
			assert.equal(await page.evaluate(() => globalThis.accountSwitches), 2);
			assert.deepEqual(await page.evaluate(() => globalThis.onboardingWrites), []);
			for (const vatStatus of ['vat', 'no-vat']) {
			await page.reload();
			assert.equal(await page.locator('#vat-status').inputValue(), '');
			for (const businessType of ['fop', 'tov', 'self_employed', 'ngo']) {
				await page.locator('#business-type').selectOption(businessType);
				assert.equal(await page.locator('#tax-id').getAttribute('maxlength'), ['fop', 'self_employed'].includes(businessType) ? '10' : '8');
			}
			await page.locator('#business-type').selectOption('self_employed');
			await page.locator('#legal-name').fill('Synthetic Person');
			await page.locator('#tax-id').fill('1234567890');
			await page.locator('#iban').fill('UA663052990000026007123456789');
			await page.locator('button[type="submit"]').click();
			await page.locator('#vat-error').waitFor();
			assert.equal(await page.locator('#contact-email').count(), 0);
			assert.deepEqual(await page.evaluate(() => globalThis.onboardingWrites), []);
			await page.locator('#vat-status').selectOption(vatStatus);
			await page.locator('button[type="submit"]').click();
			await page.locator('#contact-email').waitFor();
			assert.equal(await page.locator('#contact-email').inputValue(), 'owner@example.com');
			await page.locator('#phone').fill('067 123-45-67');
			await page.locator('#website').fill('example.com');
			await page.locator('.back').click();
			assert.equal(await page.locator('#business-type').inputValue(), 'self_employed');
			assert.equal(await page.locator('#vat-status').inputValue(), vatStatus);
			await page.locator('button[type="submit"]').click();
			await page.locator('button[type="submit"]').click();
			await page.getByRole('alert').waitFor();
			assert.equal(await page.locator('#phone').inputValue(), '067 123-45-67');
			assert.equal(await page.locator('button[type="submit"]').isEnabled(), true);
			assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
			await page.screenshot({ path: `test-results/onboarding-${viewport.width}-${vatStatus}.png`, fullPage: true });
			await page.locator('button[type="submit"]').click();
			await page.getByRole('heading', { name: 'Saved' }).waitFor();
			const writes = await page.evaluate(() => globalThis.onboardingWrites);
			assert.equal(writes.length, 2);
			assert.deepEqual(writes[0], writes[1]);
			assert.equal(writes[1].businessType, 'self_employed');
			assert.equal(writes[1].vatStatus, vatStatus);
			assert.equal(writes[1].phone, '+380671234567');
			assert.equal(writes[1].website, 'https://example.com/');
			assert.deepEqual(errors, []);
			}
			await page.close();
		}
	} finally {
		await browser.close();
		await new Promise(accept => server.close(accept));
	}
});