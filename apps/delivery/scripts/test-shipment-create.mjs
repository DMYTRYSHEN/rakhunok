import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';

const origin = 'http://localhost:5173';
const browser = await chromium.launch({ headless: true });
try {
	const page = await browser.newPage();
	const errors = [];
	page.on('pageerror', error => errors.push(error.message));
	await page.route('**/__shipment_test', route => route.fulfill({ contentType: 'text/html', body: `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/src/app.css"></head><body><div id="app"></div><script type="module">
		import { mount } from '/node_modules/.vite/deps/svelte.js';
		import Shipments from '/src/routes/(business)/business/+page.svelte';
		mount(Shipments, { target: document.getElementById('app'), props: { data: { shipments: [] }, form: null } });
	</script></body></html>` }));
	await page.goto(`${origin}/__shipment_test`);
	for (const width of [1440, 390]) {
		await page.setViewportSize({ width, height: 900 });
		if (width < 1024) await page.locator('.header-actions button').click();
		const form = page.locator(width < 1024 ? 'dialog[open] .create-form' : '.desktop-create');
		const number = form.locator('[name="trackingNumber"]');
		const carrier = form.locator('[name="carrier"]');
		await carrier.selectOption('');
		await number.fill(' 2045 0000 0000 00 ');
		await expect(number).toHaveValue('20450000000000');
		await expect(carrier).toHaveValue('nova_poshta');
		await number.fill('ra 123456789 ua');
		await expect(number).toHaveValue('RA123456789UA');
		await expect(carrier).toHaveValue('ukrposhta');
		await number.fill('unknown');
		await expect(carrier).toHaveValue('');
		await carrier.selectOption('meest');
		await number.fill('20450000000000');
		await expect(carrier).toHaveValue('meest');
		await carrier.selectOption('');
		await number.fill('0500000000000');
		await expect(carrier).toHaveValue('ukrposhta');
		assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
	}
	assert.deepEqual(errors, []);
	console.log('Shipment form: normalization, suggestions, manual override and responsive dialog passed.');
} finally {
	await browser.close();
}