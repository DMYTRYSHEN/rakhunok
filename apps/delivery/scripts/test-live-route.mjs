import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

const origin = 'http://localhost:5173';
const browser = await chromium.launch();
const errors = [];
try {
	await mkdir(new URL('../../../test-results/', import.meta.url), { recursive: true });
	for (const scenario of [
		{ name: 'desktop', width: 1440, status: 'in_transit', stage: 1 },
		{ name: 'mobile', width: 390, status: 'ready_for_pickup', stage: 2 },
		{ name: 'delivered', width: 390, status: 'delivered', stage: 3 },
		{ name: 'unavailable', width: 390, state: 'provider_unavailable', status: 'unknown', stage: -1 },
		{ name: 'returned', width: 390, status: 'returned', stage: -1 },
		{ name: 'keyboard', width: 1440, status: 'in_transit', stage: 1, keyboard: true },
		{ name: 'reduced', width: 390, status: 'in_transit', stage: 1, reduced: true },
		{ name: 'fallback', width: 390, status: 'in_transit', stage: 1, fallback: true }
	]) {
		const page = await browser.newPage({ viewport: { width: scenario.width, height: 900 }, reducedMotion: scenario.reduced ? 'reduce' : 'no-preference' });
		page.on('pageerror', error => errors.push(`${scenario.name}: ${error.message}`));
		await page.addInitScript(({ fallback }) => {
			window.transitionCount = 0;
			window.transitionErrors = [];
			const start = document.startViewTransition?.bind(document);
			document.startViewTransition = fallback ? undefined : callback => {
				window.transitionCount++;
				const transition = start(callback);
				transition.ready.catch(error => window.transitionErrors.push(error.message));
				window.transitionFinished = transition.finished;
				return transition;
			};
		}, { fallback: scenario.fallback ?? false });
		await page.route('**/*', route => {
			const url = new URL(route.request().url());
			if (url.origin !== origin) return route.abort();
			if (url.pathname.endsWith('/__data.json') && url.pathname.includes('20400000000000')) {
				return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ type: 'data', nodes: [null, {
					type: 'data', data: [{ tracking: 1 }, { carrier: 2, trackingNumber: 3, trackingState: 4, deliveryStatus: 5, checkedAt: 6, providerStatusCode: 7 }, 'nova_poshta', '20400000000000', scenario.state ?? 'active', scenario.status, '2026-10-12T10:00:00.000Z', null], uses: { params: ['trackingNumber'] }
				}] }) });
			}
			return route.continue();
		});
		await page.goto(origin);
		await page.locator('#tracking-number').fill('20400000000000');
		await expect(page.locator('.search-submit')).toBeEnabled();
		if (scenario.keyboard) await page.locator('#tracking-number').press('Enter');
		else await page.locator('.search-submit').click();
		await expect(page.locator('.route-stages li')).toHaveCount(4);
		await expect(page.locator('#shipment-number')).toHaveText('20400000000000');
		await page.evaluate(() => window.transitionFinished);
		const animated = !scenario.keyboard && !scenario.reduced;
		assert.equal(await page.evaluate(() => window.transitionCount), animated && !scenario.fallback ? 1 : 0, scenario.name);
		assert.deepEqual(await page.evaluate(() => window.transitionErrors), []);
		await expect(page.locator('.route-stages [aria-current="step"]')).toHaveCount(scenario.stage < 0 ? 0 : 1);
		if (scenario.stage >= 0) await expect(page.locator('.route-stages li').nth(scenario.stage)).toHaveAttribute('aria-current', 'step');
		const animation = await page.locator('.route-stages li').first().evaluate(element => getComputedStyle(element).animationName);
		assert.equal(animation !== 'none', animated, scenario.name);
		await page.evaluate(() => Promise.all(document.getAnimations().map(animation => animation.finished.catch(() => {}))));
		assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${scenario.name}: overflow`);
		await expect(page.locator('.route-node svg')).toHaveCount(4);
		await page.screenshot({ path: new URL(`../../../test-results/delivery-live-${scenario.name}.png`, import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'), fullPage: true });
		await page.locator('.detail-back').click();
		await expect(page.locator('#tracking-number')).toBeVisible();
		await page.evaluate(() => window.transitionFinished);
		assert.deepEqual(await page.evaluate(() => window.transitionErrors), []);
		const beforeLogin = await page.evaluate(() => window.transitionCount);
		await page.locator('.business-link').click();
		await expect(page).toHaveURL(`${origin}/login`);
		assert.equal(await page.evaluate(() => window.transitionCount), beforeLogin, 'Login must not animate');
		await page.close();
		console.log(`PASS live route: ${scenario.name}`);
	}
	assert.deepEqual(errors, []);
} finally {
	await browser.close();
}