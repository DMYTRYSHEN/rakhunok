import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';

const origin = 'http://localhost:5173';
const browser = await chromium.launch({ headless: true });
const savedText = '\u041a\u043b\u044e\u0447 \u0437\u0431\u0435\u0440\u0435\u0436\u0435\u043d\u043e';
const missingText = '\u041a\u043b\u044e\u0447 \u043d\u0435 \u0437\u0431\u0435\u0440\u0435\u0436\u0435\u043d\u043e';
const unverifiedText = '\u041d\u0435 \u043f\u0435\u0440\u0435\u0432\u0456\u0440\u0435\u043d\u043e \u0443 \u043f\u0435\u0440\u0435\u0432\u0456\u0437\u043d\u0438\u043a\u0430';
const verifiedText = '\u041f\u0435\u0440\u0435\u0432\u0456\u0440\u0435\u043d\u043e \u041d\u043e\u0432\u043e\u044e \u043f\u043e\u0448\u0442\u043e\u044e';
const serverSecret = 'MOCK_EXISTING_SECRET_NEVER_RENDER';
const submittedSecret = 'MOCK_NEW_KEY';

try {
	const context = await browser.newContext();
	await context.addCookies([{ name: 'carrier-harness-session', value: 'mock-session', url: origin }]);
	const page = await context.newPage();
	const errors = [];
	page.on('pageerror', error => errors.push(error.message));
	const requests = [];
	await page.route('**/src/routes/(business)/business/+layout.svelte', async route => {
		const response = await route.fetch();
		const source = await response.text();
		const rewritten = source.replace(/from\s+["'][^"']*\/runtime\/app\/state(?:\/index)?\.js[^"']*["']/, 'from "/__carrier_page_state.js"');
		assert.notEqual(rewritten, source, 'The real layout must use the integration pathname in the test');
		await route.fulfill({ response, body: rewritten });
	});
	await page.route('**/__carrier_page_state.js', route => route.fulfill({ contentType: 'text/javascript', body: `export const page = { url: new URL('${origin}/business/integrations') };` }));
	let failMethod = '';
	let holdPost;
	let releasePost;
	const states = Object.fromEntries(['nova-poshta', 'ukrposhta', 'meest'].map(id => [id, { configured: true, ready: true, verified: id === 'nova-poshta' }]));
	await page.route('**/api/v1/*/credentials', async route => {
		const request = route.request();
		const id = new URL(request.url()).pathname.split('/')[3];
		const method = request.method();
		assert.ok(id in states);
		assert.match(await request.headerValue('cookie') ?? '', /carrier-harness-session=mock-session/);
		requests.push({ id, method });
		if (method === 'POST') {
			assert.deepEqual(request.postDataJSON(), { key: submittedSecret });
			assert.match(await request.headerValue('content-type'), /application\/json/);
			if (holdPost) await holdPost;
		}
		if (method === failMethod) return route.fulfill({ status: 422, json: { error: serverSecret, key: submittedSecret } });
		if (method === 'POST') states[id] = { configured: true, ready: true, verified: id === 'nova-poshta' };
		if (method === 'DELETE') {
			states[id] = { configured: false, ready: false, verified: false };
			return route.fulfill({ status: 204 });
		}
		return route.fulfill({ json: { ...states[id], key: serverSecret } });
	});
	await page.route('**/__carrier_test', route => route.fulfill({ contentType: 'text/html', body: `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/src/app.css"></head><body><div id="app"></div><script type="module">
		import { mount, unmount, createRawSnippet } from '/node_modules/.vite/deps/svelte.js';
		import Layout from '/src/routes/(business)/business/+layout.svelte';
		import Connections from '/src/routes/(business)/business/integrations/+page.svelte';
		const target = document.getElementById('app');
		const props = { children: createRawSnippet(() => ({ render: () => '<div></div>', setup: element => { const child = mount(Connections, { target: element }); return () => unmount(child); } })) };
		let component = mount(Layout, { target, props });
		globalThis.remountCarrierTest = async () => { await unmount(component); component = mount(Layout, { target, props }); };
	</script></body></html>` }));
	await page.goto(`${origin}/__carrier_test`);
	const panel = id => page.locator(`[data-carrier="${id}"]`);
	const noSecrets = async () => {
		const html = await page.locator('#app').innerHTML();
		assert.ok(!html.includes(serverSecret) && !html.includes(submittedSecret));
		assert.deepEqual(await page.evaluate(() => Object.keys(localStorage)), []);
	};
	await expect(panel('nova-poshta')).toContainText(verifiedText);
	await expect(panel('ukrposhta')).toContainText(unverifiedText);
	await expect(panel('meest')).toContainText(unverifiedText);
	for (const input of await page.locator('input').all()) {
		await expect(input).toHaveAttribute('type', 'password');
		await expect(input).toHaveValue('');
		assert.ok(await input.evaluate(element => element.labels.length > 0));
	}
	await noSecrets();
	for (const id of Object.keys(states)) {
		const carrier = panel(id);
		holdPost = new Promise(resolve => { releasePost = resolve; });
		await carrier.locator('input').fill(submittedSecret);
		await carrier.locator('button[type="submit"]').click();
		await expect(carrier.locator('input')).toHaveValue('');
		await expect(carrier.locator('input')).toBeDisabled();
		await expect(carrier).toHaveAttribute('aria-busy', 'true');
		releasePost();
		holdPost = undefined;
		await expect(carrier).toHaveAttribute('aria-busy', 'false');
		await expect(carrier).toContainText(savedText);
		await expect(carrier).toContainText(id === 'nova-poshta' ? verifiedText : unverifiedText);
		await noSecrets();
		failMethod = 'POST';
		await carrier.locator('input').fill(submittedSecret);
		await carrier.locator('button[type="submit"]').click();
		await expect(carrier.getByRole('alert')).toBeVisible();
		await expect(carrier.locator('input')).toHaveValue('');
		await expect(carrier).toContainText(savedText);
		await noSecrets();
		failMethod = 'DELETE';
		await carrier.locator('button').last().click();
		await expect(carrier).toHaveAttribute('aria-busy', 'false');
		await expect(carrier).toContainText(savedText);
		await expect(carrier.getByRole('alert')).toBeVisible();
		failMethod = '';
		await carrier.locator('button').last().click();
		await expect(carrier).toContainText(missingText);
		await expect(carrier.locator('button').last()).toBeDisabled();
		await noSecrets();
	}
	failMethod = 'GET';
	await page.evaluate(() => globalThis.remountCarrierTest());
	await expect(page.getByRole('alert')).toHaveCount(3);
	failMethod = '';
	await panel('nova-poshta').locator('button').nth(1).click();
	await expect(panel('nova-poshta')).toContainText(missingText);
	await panel('meest').locator('input').fill(submittedSecret);
	await page.evaluate(() => globalThis.remountCarrierTest());
	await expect(panel('meest').locator('input')).toHaveValue('');
	await expect(panel('meest')).toHaveAttribute('aria-busy', 'false');
	await noSecrets();
	for (const href of ['https://my.novaposhta.ua/settings/index#apikeys', 'https://www.sat.ua/', 'https://www.delivery-auto.com/']) {
		await expect(page.locator(`a[href="${href}"]`)).toHaveAttribute('rel', 'noopener noreferrer');
	}
	for (const viewport of [{ width: 1280, height: 900 }, { width: 375, height: 812 }]) {
		await page.setViewportSize(viewport);
		assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
	}
	assert.deepEqual(errors, []);
	assert.equal(requests.filter(request => request.method === 'POST').length, 6);
	console.log('PASS: real integration page inside its business layout, all carriers GET/save/failure/delete, verification labels, safe errors, secret clearing and desktop/mobile fit; auth and provider APIs mocked');
} finally {
	await browser.close();
}