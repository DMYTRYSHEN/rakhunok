import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(new URL('../../package.json', import.meta.url));
const { chromium } = require('@playwright/test');
const browser = await chromium.launch();
try {
	const page = await browser.newPage();
	await page.goto('http://127.0.0.1:5173/business/points');
	await page.waitForLoadState('networkidle');
	const button = page.locator('button[aria-expanded]').first();
	await button.click();
	await page.locator('button[aria-expanded="true"]').waitFor();
	const frame = page.locator('iframe');
	await frame.waitFor();
	const url = new URL(await frame.getAttribute('src'));
	assert.equal(url.pathname, '/maps/embed/v1/place');
	assert.equal(url.searchParams.get('zoom'), '11');
	assert.ok(url.searchParams.get('q'));
	assert.ok(url.searchParams.get('key').startsWith('AIza'));
	await button.click();
	assert.equal(await page.locator('iframe').count(), 0);
	console.log('PASS points: address map opens and closes; query, key and zoom valid');
	await page.goto('http://127.0.0.1:5173/20450000000000');
	await page.locator('iframe').waitFor();
	assert.equal(await page.locator('iframe').getAttribute('loading'), 'lazy');
	console.log('PASS tracking: pickup address map present with lazy loading');
} finally {
	await browser.close();
}