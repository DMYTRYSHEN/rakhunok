import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { rolldown } from 'rolldown';
import { compile } from 'svelte/compiler';
import jsQR from 'jsqr';

const root = fileURLToPath(new URL('../', import.meta.url));
const origin = process.env.LAZY_TEST_ORIGIN || 'http://localhost:5173';
let browser;
before(async () => { browser = await chromium.launch(); });
after(async () => { await browser?.close(); });

async function localContext(options = {}) {
	const context = await browser.newContext({ serviceWorkers: 'block', ...options });
	await context.route('**/*', route => {
		const url = new URL(route.request().url());
		if (!['localhost', '127.0.0.1'].includes(url.hostname)) return route.abort();
		if (/\/api\//.test(url.pathname)) return route.fulfill({ status: 404, contentType: 'application/json', body: '{"error":"Synthetic test: no remote API"}' });
		return route.continue();
	});
	return context;
}

for (const [path, width] of [['/app/', 390], ['/pay/', 390], ['/pay/', 1440], ['/pay/?demo=all', 390]]) {
	test(`initial modules ${path} at ${width}px`, async () => {
		const context = await localContext({ viewport: { width, height: 900 } });
		try {
			const page = await context.newPage();
			const errors = [];
			page.on('pageerror', error => errors.push(error.message));
			await page.goto(origin + path, { waitUntil: 'networkidle' });
			if (path.startsWith('/app/')) await page.locator('.identity-open').waitFor();
			assert.deepEqual(errors, []);
			const resources = await page.evaluate(() => performance.getEntriesByType('resource').map(entry => ({ name: entry.name, bytes: entry.decodedBodySize })));
			const prohibited = path.startsWith('/app/')
				? /LiquidPaymentButton|qrcode|voice-command-parser|platform\/speech|@lucide_svelte\.js/
				: width < 768 ? /DesktopCheckout|qrcode|BankSheet/ : /qrcode|BankSheet|ScenarioRenderer/;
			assert.deepEqual(resources.filter(entry => prohibited.test(entry.name)), []);
			assert.equal(await page.locator('#boot-screen').count(), 0);
			assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
			console.log(JSON.stringify({ path, width, decodedKB: Math.round(resources.reduce((total, entry) => total + entry.bytes, 0) / 1024) }));
		} finally { await context.close(); }
	});
}

for (const [scenario, component] of [['fixed', 'OrderScenario'], ['open_amount', 'AmountScenario'], ['table', 'TableScenario'], ['delivery', 'DeliveryScenario']]) {
	test(`Pay preserves ${scenario} renderer and lazy bank sheet`, async () => {
		const context = await localContext({ viewport: { width: 390, height: 844 } });
		try {
			const page = await context.newPage();
			const errors = [];
			page.on('pageerror', error => errors.push(error.message));
			await page.goto(`${origin}/pay/?demo=${scenario}`, { waitUntil: 'networkidle' });
			const resources = await page.evaluate(() => performance.getEntriesByType('resource').map(entry => entry.name));
			assert.ok(resources.some(name => name.includes(`/${component}.svelte`)));
			assert.equal(resources.some(name => /BankSheet|DesktopCheckout|qrcode/.test(name)), false);
			assert.equal(await page.locator('.screen.active').isVisible(), true);
			await page.evaluate(async () => {
				const { checkout } = await import('/pay/src/lib/state/checkout.svelte.ts');
				checkout.isSheetOpen = true;
			});
			await page.waitForFunction(() => performance.getEntriesByType('resource').some(entry => entry.name.includes('/BankSheet.svelte')));
			await page.waitForLoadState('networkidle');
			await page.locator('.payment-sheet.open').waitFor();
			await page.locator('.payment-sheet').evaluate(element => { element.dataset.lazyInstance = 'retained'; });
			assert.deepEqual(errors, []);
			await page.evaluate(async () => {
				const { checkout } = await import('/pay/src/lib/state/checkout.svelte.ts');
				checkout.closePaymentSheet();
			});
			await page.waitForFunction(() => !document.querySelector('.payment-sheet.open'));
			await page.evaluate(async () => {
				const { checkout } = await import('/pay/src/lib/state/checkout.svelte.ts');
				checkout.isSheetOpen = true;
			});
			await page.locator('.payment-sheet.open').waitFor();
			assert.equal(await page.locator('.payment-sheet').getAttribute('data-lazy-instance'), 'retained');
			assert.equal(await page.locator('.screen.active').isVisible(), true);
		} finally { await context.close(); }
	});
}

test('desktop open amount defers QR until amount confirmation', async () => {
	const context = await localContext({ viewport: { width: 1440, height: 900 } });
	try {
		const page = await context.newPage();
		await page.goto(`${origin}/pay/?demo=open_amount`, { waitUntil: 'networkidle' });
		await page.evaluate(async () => {
			const { checkout } = await import('/pay/src/lib/state/checkout.svelte.ts');
			checkout.order.expires_at = new Date(Date.now() + 60_000).toISOString();
		});
		assert.equal(await page.evaluate(() => performance.getEntriesByType('resource').some(entry => /qrcode|qr-a2/.test(entry.name))), false);
		await page.locator('input').first().fill('123.45');
		await page.getByRole('button', { name: 'Підтвердити', exact: true }).click();
		const qr = page.locator('.qr-img');
		await qr.waitFor();
		assert.ok((await qr.getAttribute('src')).startsWith('data:image/svg+xml'));
		assert.equal(await page.evaluate(() => performance.getEntriesByType('resource').some(entry => /qr-a2/.test(entry.name))), true);
		await page.evaluate(async () => {
			const { checkout } = await import('/pay/src/lib/state/checkout.svelte.ts');
			checkout.order.status = 'paid';
		});
		await qr.waitFor({ state: 'detached' });
	} finally { await context.close(); }
});

test('Pay HTML is visible without JavaScript', async () => {
	const context = await localContext({ javaScriptEnabled: false, viewport: { width: 320, height: 640 } });
	try {
		const page = await context.newPage();
		await page.goto(origin + '/pay/');
		assert.equal(await page.locator('#boot-screen').isVisible(), true);
		assert.equal(await page.locator('#boot-screen .boot-brand').textContent(), 'Rahunok');
		assert.equal(await page.locator('noscript').isVisible(), true);
		assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
	} finally { await context.close(); }
});

test('Merchant QR imports on demand and draws only the latest value', async () => {
	const entry = resolve(root, 'scripts/__lazy_entry.js').replaceAll('\\', '/');
	const fixture = resolve(root, 'scripts/__lazy_fixture.svelte').replaceAll('\\', '/');
	const component = resolve(root, 'apps/merchant-app/src/lib/PaymentQr.svelte').replaceAll('\\', '/');
	const wrapper = `<script>
		import PaymentQr from ${JSON.stringify(component)};
		let value = $state('');
		let visible = $state(true);
		globalThis.setQr = (next) => { value = next; };
		globalThis.hideQr = () => { visible = false; };
	</script>{#if visible}<PaymentQr {value} label="Test QR" />{/if}`;
	const bundle = await rolldown({
		cwd: root, input: entry, platform: 'browser', resolve: { conditionNames: ['browser', 'import', 'default'] },
		plugins: [{ name: 'lazy-qr-fixture',
			resolveId(source) { if (source === entry || source === fixture) return source; },
			async load(path) {
				if (path === entry) return `import {mount} from 'svelte';import Fixture from ${JSON.stringify(fixture)};mount(Fixture,{target:document.body});`;
				if (path.endsWith('.svelte')) return compile(path === fixture ? wrapper : await readFile(path, 'utf8'), { filename: path, generate: 'client', css: 'injected' }).js.code;
			}
		}]
	});
	const result = await bundle.generate({ format: 'esm' });
	await bundle.close();
	const chunks = new Map(result.output.filter(output => output.type === 'chunk').map(output => [output.fileName, output]));
	const main = [...chunks.values()].find(chunk => chunk.isEntry);
	const qrChunk = [...chunks.values()].find(chunk => Object.keys(chunk.modules).some(path => /node_modules[/\\]qrcode[/\\]/.test(path)));
	assert.ok(qrChunk);
	assert.notEqual(qrChunk.fileName, main.fileName);
	const context = await browser.newContext();
	try {
		let release;
		const blocked = new Promise(accept => { release = accept; });
		let qrRequested = false;
		await context.route('**/*', async route => {
			const filename = new URL(route.request().url()).pathname.slice(1);
			if (!filename) return route.fulfill({ contentType: 'text/html', body: `<html><body><script type="module" src="/${main.fileName}"></script></body></html>` });
			const chunk = chunks.get(filename);
			if (!chunk) return route.abort();
			if (filename === qrChunk.fileName) { qrRequested = true; await blocked; }
			return route.fulfill({ contentType: 'text/javascript', body: chunk.code });
		});
		const page = await context.newPage();
		await page.goto('http://lazy.test/');
		await page.locator('canvas').waitFor();
		assert.equal(qrRequested, false);
		await page.evaluate(() => globalThis.setQr('https://example.test/pay/old'));
		await page.waitForFunction(() => document.querySelector('[aria-busy="true"]'));
		await page.evaluate(() => globalThis.setQr('https://example.test/pay/current'));
		release();
		await page.waitForFunction(() => document.querySelector('[aria-busy="false"]') && document.querySelector('canvas').width === 232);
		assert.equal(qrRequested, true);
		const pixels = await page.locator('canvas').evaluate(canvas => ({ width: canvas.width, height: canvas.height, data: [...canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data] }));
		assert.equal(jsQR(new Uint8ClampedArray(pixels.data), pixels.width, pixels.height)?.data, 'https://example.test/pay/current');
		await page.evaluate(() => globalThis.setQr(''));
		await page.waitForFunction(() => !document.querySelector('canvas').getContext('2d').getImageData(0, 0, 232, 232).data.some(Boolean));
		await page.evaluate(() => { globalThis.setQr('https://example.test/pay/unmounted'); globalThis.hideQr(); });
		assert.equal(await page.locator('canvas').count(), 0);
	} finally { await context.close(); }
});