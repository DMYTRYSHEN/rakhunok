import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import test from 'node:test';
import { chromium } from '@playwright/test';
import { routeCheckoutRequest } from './checkout.js';

const root = new URL('../../', import.meta.url);
const dist = new URL('apps/pay/.active-guard-dist/', root);
const id = '11111111-1111-4111-8111-111111111111';
const invoice = {
  id, order_number: 'Original invoice', type: 'table', status: 'pending',
  total_amount: 100, base_amount: 100, currency: 'UAH',
  created_at: new Date().toISOString(), expires_at: new Date(Date.now() + 600_000).toISOString(),
  items: [{ id: 'one', name: 'Original item', price: 100, qty: 1 }],
  merchant: { display_name: 'Original merchant' }
};

test('original full checkout browser: terminal waiting/active/error/rollover, no realtime, unchanged UI', async () => {
  for (const path of ['apps/pay/src/App.svelte', 'apps/pay/src/lib/scenarios/TableScenario.svelte']) {
    const before = execFileSync('git', ['show', `HEAD:${path}`], { cwd: root, encoding: 'utf8' });
    const after = await readFile(new URL(path, root), 'utf8');
    assert.equal(after.split('</script>')[1].replaceAll('\r\n', '\n'), before.split('</script>')[1].replaceAll('\r\n', '\n'), `${path}: markup/styles unchanged`);
  }
  let mode = 'idle';
  let current = { ...invoice };
  const calls = [];
  const errors = [];
  const external = [];
  const env = {
    ORDERS_KV: { get() { throw Error('unexpected KV'); }, put() { throw Error('unexpected KV'); } },
    API: { async fetch(request) {
      const path = new URL(request.url).pathname;
      calls.push(path);
      if (path === '/api/v1/checkout/terminal/table-30') {
        if (mode === 'error') return new Response('', { status: 503 });
        return Response.json({ kind: mode, terminal: { code: 'table-30', name: 'Table 30' }, order: mode === 'active' ? current : null });
      }
      if (path === `/api/v1/checkout/${current.id}`) return Response.json(current);
      if (path === '/api/v1/banks') return Response.json([]);
      if (path === '/api/v1/logos') return Response.json({});
      throw Error(`Unexpected API: ${path}`);
    } },
    ASSETS: { async fetch(request) {
      let path = new URL(request.url).pathname.replace(/^\/(pay|checkout)\//, '');
      if (path === 'index.html' || !path) path = 'index.html';
      try {
        const bytes = await readFile(new URL(path, dist));
        const type = path.endsWith('.js') ? 'text/javascript' : path.endsWith('.css') ? 'text/css' : path.endsWith('.html') ? 'text/html' : path.endsWith('.svg') ? 'image/svg+xml' : 'application/octet-stream';
        return new Response(bytes, { headers: { 'Content-Type': type } });
      } catch { return new Response('', { status: 404 }); }
    } }
  };
  const server = createServer(async (req, res) => {
    try {
      const response = await routeCheckoutRequest(new Request(`http://127.0.0.1:${server.address().port}${req.url}`), env);
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(Buffer.from(await response.arrayBuffer()));
    } catch (error) { errors.push(String(error)); res.writeHead(500); res.end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext();
    await context.route('**/*', route => {
      if (new URL(route.request().url()).origin === origin) return route.continue();
      external.push(route.request().url()); return route.abort();
    });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    const sockets = []; page.on('websocket', socket => sockets.push(socket.url()));
    await page.addInitScript(() => { window.__INITIAL_ORDER__ = { id: 'stale', status: 'pending', total_amount: 9999 }; });
    const response = await page.goto(`${origin}/tag/table-30?id=stale&demo=table`);
    assert.equal(response.headers()['cache-control'], 'no-store');
    await page.locator('.waiting-wrap').waitFor();
    assert.equal(calls.some(path => path === '/api/v1/checkout/table-30'), false);
    mode = 'active';
    await page.getByText('Original item', { exact: true }).waitFor();
    await page.locator('.table-split-header').click();
    await page.locator('.table-split-body').waitFor();
    await page.waitForFunction(() => document.querySelector('.order-hero-amount .d-col')?.style.transform === 'translateY(-5em)');
    assert.match(await page.locator('.split-hint').innerText(), /50/);
    mode = 'error';
    await page.getByText('Не вдалося перевірити рахунок', { exact: true }).waitFor();
    assert.equal(await page.locator('.table-items-card').count(), 0);
    mode = 'active'; current = { ...invoice, id: '22222222-2222-4222-8222-222222222222' };
    await page.getByText('Original item', { exact: true }).waitFor();
    await page.waitForFunction(() => document.querySelector('.order-hero-amount .d-col')?.style.transform === 'translateY(-1em)');
    assert.equal(await page.locator('.order-hero-amount .d-col').count(), 5);
    current = { ...current, status: 'preparing' };
    await page.locator('.waiting-wrap').waitFor();
    assert.equal(await page.locator('.order-hero').count(), 0);
    mode = 'idle';
    await page.getByRole('button', { name: 'Оновити статус' }).click();
    assert.equal(sockets.length, 0, 'no legacy realtime connections');
    assert.equal(external.some(url => /supabase|realtime/.test(url)), false);
    assert.deepEqual(errors, []);
    console.log('Original markup/styles identical; waiting, active, split, error, rollover, preparing and no realtime PASS');
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
});