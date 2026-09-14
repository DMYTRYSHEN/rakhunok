import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chromium } from '@playwright/test';

test('local composer: one uncertainty alert, distinct retry error, definite unavailable', async () => {
	const browser = await chromium.launch();
	try {
		const page = await browser.newPage();
		const blocked = [];
		await page.route('**/*', async (route) => {
			const url = new URL(route.request().url());
			if (url.origin !== 'http://localhost:5173' || url.pathname.includes('/api/')) {
				blocked.push(url.pathname);
				await route.abort();
			} else if (url.pathname === '/__telegram_composer_test') {
				await route.fulfill({ contentType: 'text/html', body: '<html><body><main id="test"></main></body></html>' });
			} else await route.continue();
		});
		await page.goto('http://localhost:5173/__telegram_composer_test');
		await page.evaluate(async () => {
			const { default: Composer } = await import('/src/lib/features/dashboard/public-page/TelegramInvoiceComposer.svelte');
			const runtime = performance.getEntriesByType('resource').map((entry) => entry.name)
				.find((url) => /\/svelte\.js\?/.test(url));
			if (!runtime) throw new Error('Missing shared optimized Svelte runtime');
			const { mount, unmount } = await import(runtime);
			const { TelegramInvoiceError, TELEGRAM_DELIVERY_WARNING } = await import('/src/lib/features/dashboard/public-page/telegram-invoice-client.ts');
			const id = '11111111-1111-4111-8111-111111111111';
			const invoice = {
				id, reference: 'TEST-1', title: 'Synthetic invoice', amount: 1, baseAmount: 1,
				discountAmount: 0, deliveryFee: 0, currency: 'UAH', status: 'pending',
				lifecycleStatus: 'pending', type: 'fixed', channel: 'Link', createdAt: '2026-09-01',
				shortId: null, description: null, tableNumber: null, terminalId: null,
				paidAt: null, paidBankCode: null, expiresAt: null
			};
			globalThis.testCalls = 0;
			globalThis.testWarning = TELEGRAM_DELIVERY_WARNING;
			globalThis.testUnavailable = 'Локальний API (порт 8787) не запущено. Нічого не надіслано.';
			let component;
			globalThis.mountComposer = async (uncertainFirst) => {
				if (component) await unmount(component);
				let calls = 0;
				component = mount(Composer, {
					target: document.querySelector('#test'),
					props: {
						sentIds: [], uncertainIds: [], onClose() {}, onLoadInvoices: async () => [invoice],
						onPreviewInvoice: async () => ({
							amount: '1.00', reference: 'TEST-1', recipient: 'Synthetic recipient',
							issuedAt: '2026-09-01T00:00:00.000Z', displayExpiresAt: '2099-01-01T00:00:00.000Z',
							checkoutUrl: `https://rakhunok.com/o/${id}`, displayExpiryNote: 'Synthetic preview only'
						}),
						onSendInvoice: async () => {
							globalThis.testCalls++;
							if (uncertainFirst && calls++ === 0) throw new TelegramInvoiceError(TELEGRAM_DELIVERY_WARNING, true);
							throw new TelegramInvoiceError(globalThis.testUnavailable);
						}
					}
				});
			};
			await globalThis.mountComposer(true);
		});
		const warning = await page.evaluate(() => globalThis.testWarning);
		const unavailable = await page.evaluate(() => globalThis.testUnavailable);
		const select = page.locator('select');
		const send = page.locator('button.send');
		await select.selectOption('11111111-1111-4111-8111-111111111111');
		await send.click();
		await page.locator('.warning').waitFor();
		assert.equal(await page.getByText(warning, { exact: true }).count(), 1);
		assert.equal(await page.locator('.error').count(), 0);
		assert.equal(await send.isDisabled(), true);
		await page.getByRole('checkbox').check();
		await send.click();
		await page.getByText(unavailable, { exact: true }).waitFor();
		assert.equal(await page.getByRole('alert').count(), 2);
		assert.equal(await page.getByText(warning, { exact: true }).count(), 1);
		assert.equal(await send.isDisabled(), true);
		await page.evaluate(() => globalThis.mountComposer(false));
		await select.selectOption('11111111-1111-4111-8111-111111111111');
		await send.click();
		await page.getByText(unavailable, { exact: true }).waitFor();
		assert.equal(await page.locator('.warning').count(), 0);
		assert.equal(await page.getByRole('alert').count(), 1);
		assert.equal(await send.isEnabled(), true);
		assert.equal(await page.evaluate(() => globalThis.testCalls), 3);
		assert.deepEqual(blocked, []);
	} finally {
		await browser.close();
	}
});