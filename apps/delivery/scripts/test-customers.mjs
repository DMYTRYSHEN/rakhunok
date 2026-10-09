import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { createClient } from '@libsql/client';
import { readFile } from 'node:fs/promises';
import { CustomerStore } from '../src/lib/server/tracking/customers.ts';
import { shipmentForm } from '../src/lib/server/tracking/np-http.ts';

const client = createClient({ url: 'file::memory:' });
const browser = await chromium.launch();
const origin = 'http://127.0.0.1:5173';
try {
	await client.executeMultiple(await readFile(new URL('../migrations/008_customers.sql', import.meta.url), 'utf8'));
	const store = new CustomerStore(client);
	const page = await browser.newPage();
	const errors = [];
	page.on('pageerror', error => errors.push(error.message));
	page.on('dialog', dialog => dialog.accept());
	const html = (component, data) => `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/src/app.css"></head><body><div id="app"></div><script type="module">
	import { mount } from '/node_modules/.vite/deps/svelte.js';
	import Component from '/src/routes/(business)/business/${component}/+page.svelte';
	mount(Component, { target: document.getElementById('app'), props: { data: ${JSON.stringify(data).replaceAll('<', '\\u003c')}, form: null } });
	</script></body></html>`;
	await page.route('**/__customers_test', async route => {
		const request = route.request();
		if (request.method() === 'POST') {
			const input = await shipmentForm(new Request(request.url(), { method: 'POST', headers: { origin, 'content-type': 'application/x-www-form-urlencoded' }, body: request.postData() }), new URL(request.url()));
			if (input.intent === 'delete') await store.remove('alice', input.id);
			else await store.save('alice', input.name, input.phone, input.id || undefined);
		}
		await route.fulfill({ contentType: 'text/html', body: html('customers', { customers: await store.list('alice'), customersError: '' }) });
	});
	await page.goto(`${origin}/__customers_test`);
	await page.locator('.editor [name="name"]').fill('Test Person');
	await page.locator('.editor [name="phone"]').fill('0671234567');
	await page.locator('button[value="save"]').click();
	await expect(page.locator('li strong')).toHaveText('Test Person');
	await page.reload();
	await expect(page.locator('li a')).toHaveText('+380671234567');
	await page.locator('li button[type="button"]').click();
	await expect(page.locator('.editor [name="name"]')).toHaveValue('Test Person');
	await page.locator('.editor [name="name"]').fill('Updated Person');
	await page.locator('button[value="save"]').click();
	await expect(page.locator('li strong')).toHaveText('Updated Person');
	await page.locator('input[type="search"]').fill('no-match');
	await expect(page.locator('li')).toHaveCount(0);
	await page.locator('input[type="search"]').fill('0671234567');
	await expect(page.locator('li')).toHaveCount(1);
	for (const width of [1440, 390]) {
		await page.setViewportSize({ width, height: 900 });
		assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
	}
	const customers = await store.list('alice');
	await page.locator('button[value="delete"]').click();
	await expect(page.locator('li')).toHaveCount(0);
	assert.deepEqual(await store.list('alice'), []);
	assert.deepEqual(await store.list('bob'), []);
	const ref = '11111111-1111-1111-1111-111111111111';
	await page.route('**/api/v1/nova-poshta/directory?**', route => route.fulfill({ json: { data: new URL(route.request().url()).searchParams.get('kind') === 'cities'
		? [{ ref, name: 'Kyiv', area: '' }]
		: [{ ref, cityRef: ref, name: 'Branch', category: 'Warehouse', status: 'Working', number: '1', address: '', maxWeight: 100 }], hasMore: false } }));
	await page.route('**/__customer_wizard_test', route => route.fulfill({ contentType: 'text/html', body: html('new', { userId: 'alice', customers, customersError: '', senders: [{ ref, name: 'Sender' }], defaultSenderRef: ref, defaultContactRef: ref, contacts: [{ ref, name: 'Contact', phone: '+380671234567' }], documents: [], attemptId: crypto.randomUUID(), accountError: '', documentsError: '', defaultsWarning: '' }) }));
	await page.goto(`${origin}/__customer_wizard_test`);
	await page.locator('#sender-city-query').fill('Kyiv');
	await page.locator('#sender-city-query').press('Enter');
	await page.locator('#sender-city').selectOption(ref);
	await page.locator('#sender-point').selectOption(ref);
	await page.locator('.wizard-actions .primary').click();
	await page.locator('fieldset[data-step="1"] select:not([name])').selectOption(customers[0].id);
	await expect(page.locator('[name="recipientName"]')).toHaveValue('Updated Person');
	await expect(page.locator('[name="recipientPhone"]')).toHaveValue('+380671234567');
	await page.locator('[name="recipientName"]').fill('Manual Person');
	assert.equal(customers[0].name, 'Updated Person');
	assert.deepEqual(errors, []);
	console.log('PASS: customer CRUD with temporary libSQL, reload persistence, search, isolation, desktop/mobile layout and wizard prefill. Auth and carrier issuance not exercised.');
} finally { await browser.close(); client.close(); }