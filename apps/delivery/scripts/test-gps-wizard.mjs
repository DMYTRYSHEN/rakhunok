import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const browser = await chromium.launch({ headless: true });
try {
	const context = await browser.newContext({ geolocation: { latitude: 50.45, longitude: 30.52 }, permissions: ['geolocation'] });
	const page = await context.newPage();
	const errors = [];
	page.on('pageerror', error => errors.push(error.message));
	page.on('console', message => { if (message.type() === 'error') console.error(message.text()); });
	const city = { ref: '11111111-1111-1111-1111-111111111111', name: 'Kyiv', area: 'Kyiv' };
	const points = [
		{ ref: 'far', cityRef: city.ref, name: 'Far branch', latitude: 50.5, longitude: 30.6 },
		{ ref: 'near', cityRef: city.ref, name: 'Near locker', latitude: 50.4501, longitude: 30.5201 }
	].map(point => ({ ...point, category: 'Postomat', status: 'Working', number: point.ref, address: '', maxWeight: 20 }));
	points.push({ ...points[1], ref: 'closed', status: 'Closed', name: 'Closed point' });
	points.push({ ...points[1], ref: 'light', maxWeight: 0.5, name: 'Too light' });
	const senderRef = '55555555-5555-5555-5555-555555555555';
	const contactRef = '66666666-6666-6666-6666-666666666666';
	const attemptId = '99999999-9999-9999-9999-999999999999';
	const issuedId = '88888888-8888-8888-8888-888888888888';
	points[0].category = 'Warehouse';
	let accountRequests = 0;
	await page.route('**/api/v1/nova-poshta/account?**', route => {
		accountRequests++;
		return route.fulfill({ json: { contacts: [{ ref: contactRef, name: 'Sender Contact', phone: '+380671234567' }] } });
	});
	await page.route('https://api.bigdatacloud.net/**', route => route.fulfill({ json: { countryCode: 'UA', lookupSource: 'coordinates', city: city.name, locality: city.name, principalSubdivision: city.area } }));
	await page.route('**/api/v1/nova-poshta/directory?**', route => {
		const kind = new URL(route.request().url()).searchParams.get('kind');
		return route.fulfill({ json: { data: kind === 'cities' ? [city] : points, hasMore: false } });
	});
	await page.route('**/__gps_test', route => route.fulfill({ contentType: 'text/html', body: `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/src/app.css"></head><body><div id="app"></div><script type="module">
		import { mount } from '/node_modules/.vite/deps/svelte.js';
		import Wizard from '/src/routes/(business)/business/new/+page.svelte';
		mount(Wizard, { target: document.getElementById('app'), props: { data: { userId: 'gps-test', defaultSenderRef: '${senderRef}', defaultContactRef: '${contactRef}', contacts: [{ ref: '${contactRef}', name: 'Sender Contact', phone: '+380671234567' }], defaultsWarning: '', senders: [{ ref: '${senderRef}', name: 'Test Sender' }], documents: [{ id: '${issuedId}', state: 'issued', trackingNumber: '20400000000001', createdAt: '2026-10-01T10:00:00Z' }, { id: 'unknown', state: 'outcome_unknown', trackingNumber: null, createdAt: '2026-10-01T11:00:00Z' }], accountError: '', documentsError: '', attemptId: '${attemptId}' }, form: null } });
	</script></body></html>` }));
	await page.goto('http://localhost:5173/__gps_test');
	await expect(page.locator('select[name="senderRef"]')).toHaveValue(senderRef);
	await expect(page.locator('select[name="contactRef"]')).toHaveValue(contactRef);
	assert.equal(accountRequests, 0);
	await expect(page.locator('a[href="/business/settings/sender"]')).toBeVisible();
	await page.getByRole('button', { name: '\u041c\u043e\u0454 \u043c\u0456\u0441\u0446\u0435', exact: true }).click();
	await page.locator('.point-choice').first().waitFor();
	assert.equal(await page.locator('#sender-city').inputValue(), city.ref);
	assert.equal(await page.locator('#sender-city-query').inputValue(), city.name);
	assert.match(await page.locator('.point-choice').first().innerText(), /Near locker/);
	assert.equal(await page.locator('.point-choice').count(), 2);
	await expect(page.locator('#sender-point')).toHaveValue('near');
	await page.locator('.point-choice').last().click();
	await expect(page.locator('#sender-point')).toHaveValue('far');
	await page.locator('select[name="senderRef"]').selectOption(senderRef);
	await expect(page.locator('select[name="contactRef"]')).toHaveValue(contactRef);
	assert.equal(accountRequests, 1);
	await page.locator('.wizard-actions .primary').click();
	await page.locator('#recipient-city-query').fill(city.name);
	await page.locator('#recipient-city-query').press('Enter');
	await page.locator('#recipient-city').selectOption(city.ref);
	await page.locator('#recipient-point').selectOption('far');
	await page.locator('[name="recipientName"]').fill('\u0406\u0432\u0430\u043d\u043e\u0432 \u0406\u0432\u0430\u043d');
	await page.locator('[name="recipientPhone"]').fill('0671234567');
	await page.locator('.wizard-actions .primary').click();
	await page.locator('[name="description"]').fill('Books');
	await page.locator('.wizard-actions .primary').click();
	const issueButton = page.locator('button[formaction="?/issue"]');
	await expect(issueButton).toBeDisabled();
	await page.locator('[name="confirm"]').check();
	await expect(issueButton).toBeEnabled();
	const printLinks = page.locator('.document-links a');
	await expect(printLinks).toHaveCount(3);
	for (const format of ['waybill', 'a4', 'zebra']) await expect(page.locator(`.document-links a[href$="format=${format}"]`)).toHaveAttribute('href', `/api/v1/nova-poshta/documents/${issuedId}/print?format=${format}`);
	await expect(page.locator('.document-row').last().locator('.document-links')).toHaveCount(0);
	for (const width of [1440, 390]) {
		await page.setViewportSize({ width, height: 900 });
		assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
		await page.screenshot({ path: fileURLToPath(new URL(`../../../test-results/delivery-wizard-${width}.png`, import.meta.url)), fullPage: true });
	}
	let submissions = 0;
	let release;
	const hold = new Promise(resolve => { release = resolve; });
	await page.route('**/__gps_test?**', async route => {
		submissions++;
		assert.equal(new URL(route.request().url()).search, '?/issue');
		const body = new URLSearchParams(route.request().postData());
		assert.equal(body.get('confirm'), 'yes');
		assert.equal(body.get('attemptId'), attemptId);
		assert.equal(body.get('senderRef'), senderRef);
		assert.equal(body.get('contactRef'), contactRef);
		await hold;
		await route.abort();
	});
	const submitted = page.waitForRequest(request => request.method() === 'POST');
	await issueButton.click();
	await submitted;
	await expect(issueButton).toBeDisabled();
	await expect(page.locator('[name="confirm"]')).toBeDisabled();
	assert.equal(submissions, 1);
	assert.deepEqual(errors, []);
	await page.close();
	release();
	const settingsPage = await context.newPage();
	settingsPage.on('pageerror', error => errors.push(error.message));
	await settingsPage.route('**/__sender_settings_test*', route => {
		if (route.request().method() === 'POST') {
			const body = new URLSearchParams(route.request().postData());
			assert.equal(body.get('intent'), 'save');
			assert.equal(body.get('senderRef'), senderRef);
			assert.equal(body.get('contactRef'), contactRef);
			return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ type: 'failure', status: 400 }) });
		}
		return route.fulfill({ contentType: 'text/html', body: `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/src/app.css"></head><body><div id="app"></div><script type="module">
			import { mount } from '/node_modules/.vite/deps/svelte.js';
			import Settings from '/src/routes/(business)/business/settings/sender/+page.svelte';
			mount(Settings, { target: document.getElementById('app'), props: { data: { senders: [{ ref: '${senderRef}', name: 'Test Sender' }], defaultSenderRef: '${senderRef}', defaultContactRef: '${contactRef}', contacts: [{ ref: '${contactRef}', name: 'Sender Contact', phone: '+380671234567' }], defaultsWarning: '', accountError: '' }, form: null } });
		</script></body></html>` });
	});
	await settingsPage.route('**/api/v1/nova-poshta/account?**', route => route.fulfill({ json: { contacts: [{ ref: contactRef, name: 'Sender Contact', phone: '+380671234567' }] } }));
	await settingsPage.goto('http://localhost:5173/__sender_settings_test');
	await expect(settingsPage.locator('[name="senderRef"]')).toHaveValue(senderRef);
	await expect(settingsPage.locator('[name="contactRef"]')).toHaveValue(contactRef);
	await settingsPage.locator('[name="senderRef"]').selectOption('');
	await expect(settingsPage.locator('[name="contactRef"]')).toHaveValue('');
	await expect(settingsPage.locator('button[value="save"]')).toBeDisabled();
	await settingsPage.locator('[name="senderRef"]').selectOption(senderRef);
	await expect(settingsPage.locator('[name="contactRef"]')).toHaveValue(contactRef);
	for (const width of [1440, 390]) {
		await settingsPage.setViewportSize({ width, height: 900 });
		assert.equal(await settingsPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
	}
	await settingsPage.locator('form').evaluate(form => { form.action = '/__sender_settings_test_action'; });
	const settingsSubmission = settingsPage.waitForRequest(request => request.method() === 'POST');
	await settingsPage.locator('button[value="save"]').click();
	await settingsSubmission;
	await expect(settingsPage.locator('button[value="save"]')).toBeEnabled();
	await expect(settingsPage.locator('[name="contactRef"]')).toHaveValue(contactRef);
	assert.deepEqual(errors, []);
	await settingsPage.close();
	console.log('PASS: GPS, manual override, account/contact selection, confirmation in submitted FormData, duplicate-click lock, persisted PDF links and unknown state at desktop/mobile; all provider writes mocked');
} finally {
	await browser.close();
}