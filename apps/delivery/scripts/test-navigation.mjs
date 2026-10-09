import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { access, mkdir } from 'node:fs/promises';

const origin = 'http://127.0.0.1:5173';
const browser = await chromium.launch();
try {
	const errors = [];
	const publicPage = await browser.newPage();
	publicPage.on('pageerror', error => errors.push(error.message));
	await publicPage.goto(origin);
	await publicPage.locator('.header-search').click();
	await expect(publicPage.locator('#tracking-number')).toBeFocused();
	await publicPage.locator('#tracking-number').fill('FOCUS123');
	await publicPage.locator('.header-search').click();
	await expect(publicPage.locator('#tracking-number')).toBeFocused();
	await expect(publicPage.locator('#tracking-number')).toHaveValue('FOCUS123');
	await publicPage.locator('.business-link').click();
	await expect(publicPage).toHaveURL(`${origin}/login`);
	await publicPage.locator('a.brand').click();
	await expect(publicPage).toHaveURL(`${origin}/`);
	await publicPage.close();
	const historyPage = await browser.newPage();
	historyPage.on('pageerror', error => errors.push(error.message));
	await historyPage.route('**/src/routes/(public)/+page.svelte', async route => {
		const response = await route.fetch();
		const source = await response.text();
		const body = source.replace(/from\s+["'][^"']*\/runtime\/app\/navigation(?:\/index)?\.js[^"']*["']/, 'from "/__history_navigation.js"');
		assert.notEqual(body, source);
		await route.fulfill({ response, body });
	});
	await historyPage.route('**/__history_navigation.js', route => route.fulfill({ contentType: 'text/javascript', body: 'export async function goto(path) { window.history.pushState({}, "", path); }' }));
	await historyPage.route(`${origin}/`, route => route.fulfill({ contentType: 'text/html', body: `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/src/app.css"></head><body><div id="app"></div><script type="module">
		import { mount } from '/node_modules/.vite/deps/svelte.js';
		import Home from '/src/routes/(public)/+page.svelte';
		mount(Home, { target: document.getElementById('app'), props: { data: { guestHistoryEnabled: false } } });
	</script></body></html>` }));
	await historyPage.goto(origin);
	await historyPage.evaluate(() => localStorage.setItem('delivery.guest-tracking.v1', JSON.stringify([{ number: 'HISTORY123', checkedAt: Date.now() - 60000 }])));
	await historyPage.reload();
	await expect(historyPage.locator('.history-open')).toHaveText('HISTORY123');
	await historyPage.locator('.history-open').click();
	await expect(historyPage).toHaveURL(`${origin}/HISTORY123`);
	await expect.poll(() => historyPage.evaluate(() => JSON.parse(localStorage.getItem('delivery.guest-tracking.v1'))[0].checkedAt)).toBeGreaterThan(Date.now() - 30000);
	await historyPage.goto(origin);
	await historyPage.setViewportSize({ width: 390, height: 844 });
	await expect(historyPage.locator('.history-open')).toBeVisible();
	await historyPage.locator('.history-remove').click();
	await expect(historyPage.locator('.recent-tracking')).toHaveCount(0);
	await historyPage.locator('#tracking-number').fill('NEWSEARCH456');
	await historyPage.locator('.search-submit').click();
	await expect(historyPage).toHaveURL(`${origin}/NEWSEARCH456`);
	await historyPage.goto(origin);
	await expect(historyPage.locator('.history-open')).toHaveText('NEWSEARCH456');
	assert.ok(await historyPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
	await historyPage.close();
	const page = await browser.newPage();
	page.on('pageerror', error => errors.push(error.message));
	await page.route('**/src/routes/(business)/business/+layout.svelte', async route => {
		const response = await route.fetch();
		const source = await response.text();
		const body = source.replace(/from\s+["'][^"']*\/runtime\/app\/state(?:\/index)?\.js[^"']*["']/, 'from "/__navigation_state.js"');
		assert.notEqual(body, source);
		await route.fulfill({ response, body });
	});
	await page.route('**/__navigation_state.js', route => route.fulfill({ contentType: 'text/javascript', body: 'export const page = { url: new URL(location.href) };' }));
	await page.route(`${origin}/business**`, async route => {
		assert.equal(route.request().method(), 'GET', 'Navigation must not mutate data');
		const pathname = new URL(route.request().url()).pathname;
		const suffix = pathname.slice('/business'.length);
		await access(new URL(`../src/routes/(business)/business${suffix}/+page.svelte`, import.meta.url));
		const sender = suffix === '/settings/sender';
		await route.fulfill({ contentType: 'text/html', body: `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/src/app.css"></head><body><div id="app"></div><script type="module">
		import { mount, unmount, createRawSnippet } from '/node_modules/.vite/deps/svelte.js';
		import Layout from '/src/routes/(business)/business/+layout.svelte';
		${sender ? "import Sender from '/src/routes/(business)/business/settings/sender/+page.svelte';" : ''}
		const children = createRawSnippet(() => ({ render: () => '<main data-route="${pathname}"></main>', setup: element => {
		${sender ? "const component = mount(Sender, { target: element, props: { data: { senders: [], contacts: [], defaultSenderRef: '', defaultContactRef: '', accountError: '', defaultsWarning: '' }, form: null } }); return () => unmount(component);" : "element.textContent = location.pathname;"}
		} }));
		mount(Layout, { target: document.getElementById('app'), props: { children } });
		</script></body></html>` });
	});
	await page.setViewportSize({ width: 1440, height: 900 });
	await page.goto(`${origin}/business`);
	await expect(page.locator('.delivery-business-sidebar nav a')).toHaveCount(8);
	const paths = await page.locator('.delivery-business-sidebar nav a').evaluateAll(links => links.map(link => new URL(link.href).pathname));
	assert.ok(paths.includes('/business/settings/sender'));
	for (const pathname of paths) {
		await page.locator(`.delivery-business-sidebar nav a[href="${pathname}"]`).click();
		await expect(page).toHaveURL(`${origin}${pathname}`);
		await expect(page.locator('.delivery-business-sidebar nav a[aria-current="page"]')).toHaveAttribute('href', pathname);
		if (!['/business/settings', '/business/attention', '/business/analytics'].includes(pathname)) {
			await expect(page.locator(`[data-route="${pathname}"]`)).toBeVisible();
		}
		assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
	}
	await expect(page.locator('select[name="senderRef"]')).toBeVisible();
	await page.locator('main a[href="/business/settings"]').click();
	for (const pathname of ['/business/settings/sender', '/business/integrations', '/business/customers']) {
		await page.locator(`nav[aria-label="Налаштування доставки"] a[href="${pathname}"]`).click();
		await expect(page).toHaveURL(`${origin}${pathname}`);
		await page.locator('.delivery-business-sidebar nav a[href="/business/settings"]').click();
	}
	await page.goto(`${origin}/business/new`);
	await expect(page.locator('.delivery-business-sidebar nav a[aria-current="page"]')).toHaveAttribute('href', '/business');
	await expect(page.locator('[data-route="/business/new"]')).toBeVisible();
	await page.setViewportSize({ width: 390, height: 844 });
	for (const pathname of paths.slice(3)) {
		await page.locator('.mobile-tabs button').click();
		await expect(page.locator('dialog')).toBeVisible();
		await page.locator(`dialog nav a[href="${pathname}"]`).click();
		await expect(page).toHaveURL(`${origin}${pathname}`);
		await expect(page.locator('dialog')).not.toBeVisible();
		await expect(page.locator('.mobile-tabs button')).toHaveClass(/active/);
		assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
	}
	await expect(page.locator('select[name="senderRef"]')).toBeVisible();
	const screenshots = new URL('../test-results/', import.meta.url);
	await mkdir(screenshots, { recursive: true });
	await page.screenshot({ path: new URL('navigation-sender-mobile.png', screenshots).pathname.replace(/^\/(\w:)/, '$1'), fullPage: true });
	await page.locator('main a[href="/business/new"]').click();
	await expect(page).toHaveURL(`${origin}/business/new`);
	await page.setViewportSize({ width: 1440, height: 900 });
	await page.goto(`${origin}/business/settings`);
	await expect(page.locator('.tracking-api-example')).toBeVisible();
	await expect(page.locator('pre[aria-label="Публічний запит curl"]')).toContainText(`${origin}/api/v1/tracking/20450000000000?carrier=nova_poshta`);
	await expect(page.locator('pre[aria-label="Публічний запит curl"]')).not.toContainText('Authorization');
	await expect(page.locator('pre[aria-label="Публічна JSON-відповідь"]')).toContainText('"checkedAt"');
	await expect(page.locator('pre[aria-label="Приклад запиту curl"]')).toContainText(`${origin}/api/v1/shipments/12345678-1234-1234-1234-123456789abc/refresh`);
	await expect(page.locator('pre[aria-label="Приклад JSON-відповіді"]')).toContainText('"trackingState": "active"');
	await page.setViewportSize({ width: 390, height: 844 });
	assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
	await page.setViewportSize({ width: 1440, height: 900 });
	await page.screenshot({ path: new URL('navigation-settings-desktop.png', screenshots).pathname.replace(/^\/(\w:)/, '$1'), fullPage: true });
	assert.deepEqual(errors, []);
	console.log('PASS: all business menu targets exist; desktop/mobile navigation, settings links, sender controls, nested active item, back links and responsive fit. Layout and sender component real; authenticated loaders/actions not exercised.');
} finally { await browser.close(); }