import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { createLocalSupportServer } from './support-local-server.mjs';

test('local support UI: scenarios, settings, isolation, confirmation, reload, audit and exit', async () => {
  const server = createLocalSupportServer({ port: 0 });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ headless: true });
  const origin = `http://127.0.0.1:${server.address().port}`;
  const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
  const failures = [];
  const external = [];
  page.on('pageerror', error => failures.push(error.message));
  page.on('console', message => { if (message.type() === 'error') failures.push(message.text()); });
  page.on('request', request => { if (!request.url().startsWith(origin)) external.push(request.url()); });
  async function open(workspace) {
    await page.locator(`[name=workspace][value=${workspace}]`).check();
    await page.locator('#open-form button').click();
    await page.locator('#workspace').waitFor({ state: 'visible' });
  }
  async function confirm() {
    await page.locator('#acknowledged').check();
    await page.locator('#commit').click();
    await page.locator('#confirm-dialog').waitFor({ state: 'hidden' });
  }
  try {
    await page.goto(origin);
    await open('sandbox');
    for (const scenario of ['fixed', 'open_amount', 'table', 'delivery']) {
      await page.locator('#new-invoice').click();
      await page.locator('#invoice-form [name=scenario]').selectOption(scenario);
      if (['table', 'delivery'].includes(scenario)) await page.locator('[name=reference]').fill('Demo reference');
      await page.locator('#invoice-form button[type=submit]').click();
      assert.equal(await page.locator('#commit').isDisabled(), true);
      await confirm();
    }
    assert.equal(await page.locator('#invoice-count').innerText(), '4');
    await page.locator('[data-tab=settings]').click();
    await page.locator('[name=lifetime]').fill('90');
    await page.locator('#settings-form button').click();
    await confirm();
    assert.equal(await page.locator('[name=lifetime]').inputValue(), '90');
    await page.reload();
    await page.locator('#workspace').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#invoice-count').innerText(), '4');
    await page.locator('[data-tab=audit]').click();
    assert.ok((await page.locator('#audit').innerText()).includes('settings.update'));
    await page.setViewportSize({ width: 375, height: 667 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.locator('[data-tab=settings]').click();
    assert.equal(await page.locator('[name=prefix]').evaluate(input => input.checkValidity()), true);
    await page.locator('#exit').click();
    await open('live');
    assert.equal(await page.locator('#invoice-count').innerText(), '0');
    assert.equal(await page.locator('#new-invoice').isDisabled(), true);
    await page.locator('#elevate').click();
    await page.locator('#approve-elevation').click();
    await page.locator('#new-invoice').click();
    await page.locator('#invoice-form button[type=submit]').click();
    await page.locator('#cancel-confirm').click();
    await page.locator('#confirm-dialog').waitFor({ state: 'hidden' });
    assert.equal(await page.locator('#invoice-count').innerText(), '0');
    await page.locator('#exit').click();
    await page.locator('#entry').waitFor({ state: 'visible' });
    assert.ok((await page.locator('#notice').innerText()).includes('власному контексті'));
    assert.deepEqual(failures, []);
    assert.deepEqual(external, []);
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
});