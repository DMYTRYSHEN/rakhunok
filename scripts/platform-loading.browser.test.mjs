import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { chromium, expect } from '@playwright/test';
import { preview } from 'vite';

const root = fileURLToPath(new URL('../apps/platform/', import.meta.url));
let server, browser, origin;
before(async () => {
	server = await preview({ root, configFile: `${root}/vite.config.ts`, preview: { host: '127.0.0.1', port: 0, strictPort: false, open: false } });
	origin = `http://127.0.0.1:${server.httpServer.address().port}`;
	browser = await chromium.launch();
});
after(async () => {
	await browser?.close();
	await new Promise((resolve, reject) => server.httpServer.close(error => error ? reject(error) : resolve()));
});

async function fixture(contextTest, width = 1440) {
	const context = await browser.newContext({ viewport: { width, height: 1000 }, serviceWorkers: 'block' });
	const page = await context.newPage();
	const requests = [], errors = [];
	page.on('request', request => requests.push(request.url()));
	page.on('pageerror', error => errors.push(error.message));
	await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
	contextTest.after(async () => {
		await context.close();
		assert.deepEqual(errors, []);
		assert.ok(requests.every(url => new URL(url).origin === origin));
	});
	return { page, requests };
}

for (const width of [1440, 390]) test(`production cold overview and cached navigation at ${width}px`, async contextTest => {
	const { page, requests } = await fixture(contextTest, width);
	if (width === 390) {
		const session = await page.context().newCDPSession(page);
		await session.send('Emulation.setCPUThrottlingRate', { rate: 4 });
		await session.send('Network.enable');
		await session.send('Network.emulateNetworkConditions', { offline: false, latency: 40, downloadThroughput: 200_000, uploadThroughput: 100_000 });
	}
	await page.goto(`${origin}/platform/?demo=1&persona=route-owner`);
	await expect(page.locator('.metrics')).toBeVisible();
	const overviewObservedMs = await page.evaluate(() => performance.now());
	await page.evaluate(() => document.fonts.ready);
	const initial = [...new Set(requests.filter(url => /\.js$/.test(url)))];
	assert.ok(!initial.some(url => /AuthWorkspace|Dac7Workspace|Panel-/.test(url)), initial.join('\n'));
	let bytes = 0, gzip = 0;
	for (const url of initial) {
		const source = await readFile(`${root}/dist/${new URL(url).pathname.replace('/platform/', '')}`);
		bytes += source.length;
		gzip += gzipSync(source).length;
	}
	assert.ok(bytes < 180_000, `Initial JS budget exceeded: ${bytes}`);
	assert.ok(gzip < 65_000, `Initial gzip JS budget exceeded: ${gzip}`);
	const measurements = await page.evaluate(() => ({
		fcpMs: performance.getEntriesByName('first-contentful-paint')[0]?.startTime,
		overflow: document.documentElement.scrollWidth > innerWidth,
		font: getComputedStyle(document.querySelector('h1')).fontFamily
	}));
	assert.equal(measurements.overflow, false);
	assert.match(measurements.font, /Manrope/);
	contextTest.diagnostic(JSON.stringify({ width, cpuRate: width === 390 ? 4 : 1, initialJsBytes: bytes, gzipBytes: gzip, overviewObservedMs, ...measurements }));
	await page.getByRole('button', { name: 'Реєстрація', exact: true }).click();
	await expect(page.locator('#package-detail-registrationId')).toBeVisible();
	const panelRequests = requests.filter(url => /RegistrationPanel-.*\.js$/.test(url));
	assert.equal(panelRequests.length, 1);
	await page.getByRole('button', { name: 'Огляд', exact: true }).click();
	await page.getByRole('button', { name: 'Реєстрація', exact: true }).click();
	await expect(page.locator('#package-detail-registrationId')).toBeVisible();
	assert.equal(requests.filter(url => /RegistrationPanel-.*\.js$/.test(url)).length, 1);
});

test('production pending panel cannot render after persona changes', async contextTest => {
	const { page } = await fixture(contextTest);
	let release;
	const hold = new Promise(resolve => { release = resolve; });
	await page.route('**/RegistrationPanel-*.js', async route => { await hold; await route.continue(); });
	contextTest.after(() => release());
	await page.goto(`${origin}/platform/?demo=1&persona=route-owner&section=registration`);
	await expect(page.locator('.panel-loading').first()).toBeVisible();
	await page.locator('#demo-persona').selectOption('courier-1');
	release();
	await expect(page.locator('.metrics')).toBeVisible();
	await expect(page.locator('#package-detail-registrationId')).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'Реєстрація', exact: true })).toHaveCount(0);
});

test('production chunk failure has recoverable reload and preserves storage', async contextTest => {
	const { page } = await fixture(contextTest);
	await page.route('**/RegistrationPanel-*.js', route => route.abort(), { times: 1 });
	await page.goto(`${origin}/platform/?demo=1&persona=route-owner&section=registration`);
	await expect(page.getByRole('alert')).toContainText('Не вдалося завантажити розділ.');
	await page.evaluate(() => localStorage.setItem('platform-loading-preserved', 'yes'));
	await page.getByRole('button', { name: 'Спробувати знову', exact: true }).click();
	await expect(page.locator('#package-detail-registrationId')).toBeVisible();
	assert.equal(await page.evaluate(() => localStorage.getItem('platform-loading-preserved')), 'yes');
});