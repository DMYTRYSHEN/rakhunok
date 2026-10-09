import assert from 'node:assert/strict';
import { mkdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(new URL('../../package.json', import.meta.url));
const { chromium } = require('@playwright/test');
const { compile } = createRequire(import.meta.url)('svelte/compiler');
const browser = await chromium.launch({ headless: true });
const routes = ['/business', '/business/attention', '/business/points', '/business/analytics', '/business/integrations', '/business/settings'];
mkdirSync(new URL('../../test-results/delivery-navigation/', import.meta.url), { recursive: true });
try {
	const page = await browser.newPage();
	for (const width of [1440, 390, 320]) {
		await page.setViewportSize({ width, height: 960 });
		await page.goto('http://127.0.0.1:5173/business');
		const navigation = page.locator('.delivery-business-sidebar nav');
		for (const route of routes) {
			await navigation.locator(`a[href="${route}"]`).click();
			await page.waitForURL(`**${route}`);
			await navigation.locator(`a[href="${route}"][aria-current="page"]`).waitFor();
			assert.equal(await page.locator('aside').count(), 1);
			assert.equal(await navigation.locator('a').count(), 6);
			assert.equal(await navigation.locator('a[aria-current="page"]').count(), 1);
			assert.equal(await navigation.locator('a > svg').count(), 6);
			const iconSizes = await navigation.locator('a > svg').evaluateAll(icons => icons.map(icon => ({ width: icon.getBoundingClientRect().width, height: icon.getBoundingClientRect().height })));
			assert.ok(iconSizes.every(size => size.width === 19 && size.height === 19));
			assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width}: overflow on ${route}`);
			console.log(`PASS ${width}px ${route}: six icons, one active item, no overflow`);
		}
		await page.screenshot({ path: new URL(`../../test-results/delivery-navigation/${width}.png`, import.meta.url).pathname.replace(/^\/(.:)/, '$1'), fullPage: true });
	}
	const source = readFileSync(new URL('./src/routes/(business)/business/+layout.svelte', import.meta.url), 'utf8');
	compile(source, { filename: '+layout.svelte', generate: 'server' });
} finally {
	await browser.close();
}