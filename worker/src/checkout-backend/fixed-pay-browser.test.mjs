import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium, expect } from '@playwright/test';
import pg from 'pg';
import { fixture, localDatabaseUrl } from './local-fixture.mjs';

// Opt in against the ALREADY provisioned fixture. Never import local-server or
// provision/reset data here. Only real UI clicks may change financial state.
const browserUrl = process.env.CHECKOUT_FIXED_BROWSER_URL;
const origin = 'http://127.0.0.1:8792';
const snapshotPath = `/api/checkout/v1/invoice/${fixture.order}/snapshot`;
const attemptsPath = `/api/checkout/v1/invoice/${fixture.order}/attempts`;
const deliveryPath = '/__local/bank/deliver';
const responseBodies = new WeakMap();
const collectedPaths = new Set([snapshotPath, attemptsPath, deliveryPath]);

async function jsonBody(response) {
  const captured = responseBodies.get(response);
  assert.ok(captured, `No immediate body collector for ${safePath(response.url())}`);
  const result = await captured;
  if (!result.ok) {
    throw new Error(`JSON body capture failed: ${response.request().method()} ${safePath(response.url())} ` +
      `HTTP ${response.status()}: ${result.error}`);
  }
  return result.value;
}

function redact(value) {
  return String(value)
    .replace(/postgres(?:ql)?:\/\/[^\s"'<>]+/gi, '[database URL redacted]')
    .replace(/#local=[^\s"'<>]*/g, '#local=[redacted]')
    .replace(/[A-Za-z0-9_-]{43,}/g, '[credential redacted]');
}

function safePath(value) {
  try { return redact(new URL(value).pathname); }
  catch { return '[invalid URL]'; }
}

async function launch(t) {
  const failures = [];
  for (const channel of [undefined, 'msedge', 'chrome']) {
    try {
      const browser = await chromium.launch({ headless: true, ...(channel ? { channel } : {}) });
      t.diagnostic(`Headless browser: ${channel ?? 'installed Playwright Chromium'}`);
      return browser;
    } catch (error) {
      failures.push(`${channel ?? 'chromium'}: ${redact(error.message)}`);
    }
  }
  throw new Error(`No installed browser could launch; no browsers were installed.\n${failures.join('\n')}`);
}

async function guardedContext(browser, label, audit) {
  const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 1000 } });
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.protocol === 'data:' || url.origin === origin) return route.continue();
    audit.external.push(`${label}: ${url.protocol}//[nonorigin]${safePath(url.href)}`);
    await route.abort('blockedbyclient');
  });
  // HTTP routing does not intercept WebSockets. Allow only the local Vite
  // development socket; checkout authority itself must remain polling-only.
  await context.routeWebSocket('**/*', socket => {
    const url = new URL(socket.url());
    if (url.origin === 'ws://127.0.0.1:8792' && url.pathname === '/') {
      socket.connectToServer();
      return;
    }
    if (url.origin !== 'ws://127.0.0.1:8792') {
      audit.external.push(`${label}: nonorigin websocket ${safePath(url.href)}`);
    }
    audit.forbidden.push(`${label}: unexpected websocket ${safePath(url.href)}`);
    socket.close();
  });
  context.on('page', page => {
    page.on('request', request => {
      const url = new URL(request.url());
      const path = safePath(url.href);
      audit.requests.push({ label, method: request.method(), path });
      if (request.isNavigationRequest() && request.frame() === page.mainFrame()) {
        audit.navigations.push({ label, method: request.method(), path, phase: audit.phase });
      }
      if (/(?:^|\/)banks(?:\/|$)/i.test(url.pathname) ||
          (/(?:^|\/)checkout\/?$/i.test(url.pathname) && url.search) ||
          /\/state\/checkout\.svelte(?:\.|\/|$)/i.test(url.pathname) ||
          /\/(?:App|BankSheet)\.svelte(?:\.|\/|$)/i.test(url.pathname) ||
          url.pathname === '/__local/events') audit.forbidden.push(`${label}: ${path}`);
    });
    page.on('pageerror', error => audit.errors.push(`${label}: exception: ${redact(error.message)}`));
    page.on('console', message => {
      if (message.type() === 'error') {
        audit.errors.push(`${label}: console: ${redact(message.text())} at ${safePath(message.location().url)}`);
      }
    });
    page.on('response', response => {
      // Start reading at the response event, before UI waits or subsequent polls.
      // Store settled outcomes so unused polling responses cannot reject unhandled.
      // Session responses contain credentials and must never be collected.
      if (collectedPaths.has(new URL(response.url()).pathname)) {
        responseBodies.set(response, response.json().then(
          value => ({ ok: true, value }),
          error => {
            const failure = { label, method: response.request().method(), path: safePath(response.url()),
              status: response.status(), phase: audit.phase,
              error: redact(error instanceof Error ? error.message : error) };
            audit.bodyFailures.push(failure);
            return { ok: false, error: failure.error };
          }
        ));
      }
      if (response.status() >= 400) audit.errors.push(`${label}: HTTP ${response.status()} ${safePath(response.url())}`);
    });
    page.on('websocket', socket => {
      if (new URL(socket.url()).origin !== 'ws://127.0.0.1:8792' || new URL(socket.url()).pathname !== '/') return;
      socket.on('framereceived', ({ payload }) => {
        let type;
        try { type = JSON.parse(typeof payload === 'string' ? payload : payload.toString('utf8'))?.type; }
        catch { type = '[non-JSON]'; }
        const knownTypes = new Set(['connected', 'update', 'full-reload', 'prune', 'error', 'custom', 'ping']);
        audit.hmr.push({ label, type: knownTypes.has(type) ? type : type === '[non-JSON]' ? type : '[unknown]',
          phase: audit.phase });
      });
    });
    page.on('requestfailed', request => {
      // Navigation teardown can cancel an in-flight read without an application error.
      const failure = request.failure()?.errorText ?? 'unknown failure';
      audit.requestFailures.push({ label, method: request.method(), path: safePath(request.url()),
        error: redact(failure), phase: audit.phase });
      if (!failure.includes('ERR_ABORTED')) audit.errors.push(`${label}: ${safePath(request.url())}: ${redact(failure)}`);
    });
  });
  return context;
}

async function stored(pool) {
  // One read-only SQL statement gives a consistent image; no capabilities or
  // bearer credentials are selected or emitted in assertion diagnostics.
  return (await pool.query(`select
    (select coalesce(jsonb_agg(to_jsonb(o) order by o.id),'[]'::jsonb) from public.orders o) as orders,
    (select coalesce(jsonb_agg(to_jsonb(r) order by r.kind,r.id),'[]'::jsonb) from checkout_private.resources r) as resources,
    (select coalesce(jsonb_agg(to_jsonb(e) order by e.id),'[]'::jsonb) from checkout_private.outbox e) as outbox,
    (select coalesce(jsonb_agg(to_jsonb(a) - 'token_hash' - 'idempotency_key' order by a.id),'[]'::jsonb) from checkout_private.attempts a) as attempts,
    (select coalesce(jsonb_agg(to_jsonb(s) order by s.provider,s.event_id),'[]'::jsonb) from checkout_private.settlements s) as settlements
  `)).rows[0];
}

function verifyState(state, status, revision, attempts, settlements) {
  assert.equal(state.orders.length, 1, 'must use the original single-order fixture');
  const order = state.orders[0];
  assert.equal(order.id, fixture.order);
  assert.equal(order.merchant_id, fixture.merchant);
  assert.equal(order.entity_id, fixture.entity);
  assert.equal(order.terminal_id, fixture.terminal);
  assert.equal(Number(order.total_amount), 123.45);
  assert.equal(order.status, status);
  assert.equal(Number(order.checkout_revision), revision);
  const invoice = state.resources.find(resource => resource.kind === 'invoice' && resource.id === fixture.order);
  assert.ok(invoice, 'original invoice authority resource exists');
  assert.equal(Number(invoice.revision), revision);
  assert.equal(state.attempts.length, attempts);
  assert.equal(state.settlements.length, settlements);
  if (status === 'ready') {
    assert.equal(order.paid_at, null);
    assert.equal(order.paid_amount, null);
  } else {
    assert.equal(Number(order.paid_amount), 123.45);
    assert.ok(order.paid_at);
  }
}

async function visibleDocument(page) {
  assert.equal(await page.evaluate(() => document.hidden), false, 'real browser document must be visible');
}

async function fixedFrame(page) {
  await expect(page.getByTestId('fixed-invoice-checkout')).toBeVisible();
  await expect(page.getByTestId('invoice-amount')).toHaveAttribute('aria-label', '123,45 ₴');
  await expect(page.getByRole('img', { name: '123,45 ₴', exact: true })).toBeVisible();
  await expect(page.locator('.order-card .summary-value')).toHaveText(['123,45 ₴', '123,45 ₴']);
  await expect(page.getByTestId('invoice-pay')).toContainText('123,45 ₴');
  // Explanatory scope text is allowed; optional payment controls are not.
  await expect(page.locator('input, select, textarea, iframe')).toHaveCount(0);
  await expect(page.getByRole('button', {
    name: /промокод|чайов|частинами|розділ|бонус|округл|donat|promo|bnpl|split|tips|apple pay|google pay/i
  })).toHaveCount(0);
  await expect(page.locator('.bnpl-badge, .bnpl-sheet, .promo-card, .tips-selector, .bank-sheet')).toHaveCount(0);
}

function responseFor(page, path, method) {
  return page.waitForResponse(response => new URL(response.url()).pathname === path &&
    response.request().method() === method, { timeout: 15000 });
}

test('fixed invoice: real browser payment, polling authority, immutable replay and bootstrap reload', {
  skip: browserUrl === undefined ? 'Set CHECKOUT_FIXED_BROWSER_URL to opt in to the existing local fixture' : false,
  timeout: 90000
}, async t => {
  const audit = { requests: [], external: [], forbidden: [], errors: [], navigations: [], hmr: [],
    requestFailures: [], bodyFailures: [], phase: 'validate existing fixture' };
  let browser;
  let pool;
  try {
    assert.ok(typeof browserUrl === 'string' && /^http:\/\/127\.0\.0\.1:8792\/#local=[A-Za-z0-9_-]{43}$/.test(browserUrl),
      'CHECKOUT_FIXED_BROWSER_URL must be exact loopback root with a 43-character base64url bootstrap');
    let connectionString;
    try { connectionString = localDatabaseUrl(process.env.CHECKOUT_TEST_DATABASE_URL); }
    catch { throw new Error('CHECKOUT_TEST_DATABASE_URL must identify the existing disposable loopback database'); }
    assert.match(new URL(connectionString).pathname, /^\/checkout_test_fixed_pay_[a-zA-Z0-9_]+$/, 'wrong fixture database');
    pool = new pg.Pool({ connectionString, max: 1, connectionTimeoutMillis: 3000,
      statement_timeout: 5000, options: '-c default_transaction_read_only=on' });
    const initial = await stored(pool);
    verifyState(initial, 'ready', 1, 0, 0);

    audit.phase = 'launch payment browser';
    browser = await launch(t);
    const context = await guardedContext(browser, 'payment', audit);
    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    audit.phase = 'initial navigation and first snapshot response';
    const firstRead = responseFor(page, snapshotPath, 'GET');
    const [, firstResponse] = await Promise.all([page.goto(browserUrl, { waitUntil: 'domcontentloaded' }), firstRead]);
    assert.equal(firstResponse.status(), 200);
    audit.phase = 'first snapshot jsonBody(firstResponse)';
    const fresh = await jsonBody(firstResponse);
    audit.phase = 'initial authoritative snapshot and fixed frame assertions';
    assert.equal(fresh.source, 'authoritative');
    assert.equal(fresh.state, 'payable');
    assert.equal(fresh.revision, 1);
    assert.equal(fresh.order.id, fixture.order);
    assert.equal(fresh.order.amountMinor, 12345);
    await visibleDocument(page);
    await fixedFrame(page);
    await expect(page.getByTestId('authoritative-state')).toHaveText('Стан: payable · Ревізія: 1');
    await expect(page.getByTestId('invoice-pay')).toBeEnabled();
    assert.equal(new URL(page.url()).hash, '', 'bootstrap must be consumed without persistence');
    assert.equal(audit.navigations.filter(request => request.label === 'payment').length, 1,
      'bootstrap history.replaceState must not reload the payment document');
    assert.equal(audit.requests.filter(request => request.label === 'payment' &&
      request.path === '/__local/session' && request.method === 'POST').length, 1,
    'bootstrap must create exactly one session');
    assert.deepEqual(await stored(pool), initial, 'opening the invoice must not mutate the fixture');

    audit.phase = 'open confirmation dialog without mutation';
    await page.getByTestId('invoice-pay').click();
    const dialog = page.getByRole('dialog', { name: 'Підтвердьте суму рахунку' });
    await expect(dialog).toBeVisible();
    assert.equal(await dialog.evaluate(element => element instanceof HTMLDialogElement && element.matches(':modal')), true);
    await expect(dialog.getByTestId('sheet-amount')).toHaveText('123,45 ₴');
    assert.deepEqual(await stored(pool), initial, 'opening the native dialog must not create an attempt');

    audit.phase = 'create attempt click and response';
    const [createdResponse] = await Promise.all([
      responseFor(page, attemptsPath, 'POST'), dialog.getByTestId('create-attempt').click()
    ]);
    assert.equal(createdResponse.status(), 201);
    audit.phase = 'attempt jsonBody(createdResponse)';
    const accepted = await jsonBody(createdResponse);
    audit.phase = 'accepted attempt UI and financial assertions';
    assert.equal(accepted.kind, 'accepted');
    assert.equal(accepted.replayed, false);
    assert.equal(accepted.quote.orderId, fixture.order);
    assert.equal(accepted.quote.orderRevision, 1);
    assert.equal(accepted.quote.amountMinor, 12345);
    await expect(dialog).not.toBeVisible();
    await expect(page.getByTestId('attempt-id')).toHaveText(accepted.attemptId);
    await expect(page.getByTestId('authoritative-state')).toHaveText('Стан: payable · Ревізія: 1');
    await expect(page.getByTestId('paid-confirmation')).toHaveCount(0);
    await expect(page.getByTestId('invoice-pay')).toBeDisabled();
    await expect(page.getByTestId('delivery-receipt')).toHaveText('Webhook ще не підтверджено');
    // Observe an actual timer-driven read before delivery, not a forced refresh.
    audit.phase = 'timer-driven payable snapshot response';
    const stillPayableResponse = await responseFor(page, snapshotPath, 'GET');
    audit.phase = 'payable snapshot jsonBody(stillPayableResponse)';
    const stillPayable = await jsonBody(stillPayableResponse);
    audit.phase = 'payable snapshot and unchanged invoice assertions';
    assert.equal(stillPayable.source, 'authoritative');
    assert.equal(stillPayable.state, 'payable');
    const initiated = await stored(pool);
    verifyState(initiated, 'ready', 1, 1, 0);
    assert.equal(initiated.attempts[0].id, accepted.attemptId);
    assert.deepEqual({ ...initiated, attempts: initial.attempts }, initial,
      'creating an attempt cannot settle or otherwise change the invoice');
    assert.equal(audit.requests.filter(request => request.path === deliveryPath).length, 0);

    await visibleDocument(page);
    audit.phase = 'webhook delivery and paid polling response';
    const paidRead = page.waitForResponse(async response => {
      if (new URL(response.url()).pathname !== snapshotPath || response.status() !== 200) return false;
      audit.phase = 'paid polling predicate jsonBody(response)';
      const value = await jsonBody(response);
      audit.phase = 'paid polling predicate state check';
      return value.source === 'authoritative' && value.state === 'paid' && value.revision === 2;
    }, { timeout: 15000 });
    const [deliveryResponse, paidResponse] = await Promise.all([
      responseFor(page, deliveryPath, 'POST'), paidRead, page.getByTestId('deliver-webhook').click()
    ]);
    audit.phase = 'delivery response status';
    assert.equal(deliveryResponse.status(), 200);
    audit.phase = 'delivery jsonBody(deliveryResponse)';
    assert.deepEqual(await jsonBody(deliveryResponse), { synthetic: true, outcome: 'paid', replayed: false });
    audit.phase = 'paid snapshot jsonBody(paidResponse)';
    const paidSnapshot = await jsonBody(paidResponse);
    audit.phase = 'paid snapshot UI and settlement ledger assertions';
    assert.equal(paidSnapshot.order.id, fixture.order);
    assert.equal(paidSnapshot.order.amountMinor, 12345);
    assert.equal(paidSnapshot.order.revision, 2);
    await expect(page.getByTestId('authoritative-state')).toHaveText('Стан: paid · Ревізія: 2');
    await expect(page.getByTestId('paid-confirmation')).toBeVisible();
    await expect(page.getByTestId('delivery-receipt')).toContainText('replayed=false');
    await fixedFrame(page);
    const paid = await stored(pool);
    verifyState(paid, 'paid', 2, 1, 1);
    const ledger = paid.settlements[0];
    assert.equal(ledger.attempt_id, accepted.attemptId);
    assert.equal(ledger.provider, 'local-bank');
    assert.equal(ledger.event_id, `local-${accepted.attemptId}`);
    assert.equal(ledger.outcome, 'paid');
    assert.equal(ledger.event.amountMinor, 12345);
    assert.equal(paid.orders[0].payment_reference, ledger.event_id);

    audit.phase = 'webhook replay click and response';
    const [replayResponse] = await Promise.all([
      responseFor(page, deliveryPath, 'POST'), page.getByTestId('deliver-webhook').click()
    ]);
    assert.equal(replayResponse.status(), 200);
    audit.phase = 'replay jsonBody(replayResponse)';
    assert.deepEqual(await jsonBody(replayResponse), { synthetic: true, outcome: 'paid', replayed: true });
    audit.phase = 'immutable replay assertions';
    await expect(page.getByTestId('delivery-receipt')).toContainText('replayed=true');
    await expect(page.getByTestId('authoritative-state')).toHaveText('Стан: paid · Ревізія: 2');
    await expect(page.getByTestId('attempt-id')).toHaveText(accepted.attemptId);
    assert.deepEqual(await stored(pool), paid, 'replay must preserve all selected persisted rows, revisions and ledger');
    await visibleDocument(page);
    if (process.env.CHECKOUT_FIXED_BROWSER_SCREENSHOT === '1') {
      audit.phase = 'optional payment screenshot';
      const screenshot = new URL('../../.wrangler/fixed-pay-validation.png', import.meta.url);
      await mkdir(new URL('.', screenshot), { recursive: true });
      await page.screenshot({ path: fileURLToPath(screenshot), fullPage: true });
      t.diagnostic('Screenshot saved under worker/.wrangler/fixed-pay-validation.png');
    }
    audit.phase = 'close payment context';
    await context.close();

    audit.phase = 'missing-bootstrap initial navigation';
    const isolated = await guardedContext(browser, 'missing-bootstrap', audit);
    const missing = await isolated.newPage();
    await missing.goto(`${origin}/`, { waitUntil: 'domcontentloaded' });
    async function failClosed() {
      await visibleDocument(missing);
      await expect(missing.getByTestId('fixed-invoice-checkout')).toBeVisible();
      await expect(missing.getByRole('alert')).toHaveText('Недійсний локальний доступ до рахунку.');
      await expect(missing.getByTestId('invoice-pay')).toBeDisabled();
      await expect(missing.getByTestId('attempt-id')).toHaveCount(0);
      await expect(missing.getByTestId('paid-confirmation')).toHaveCount(0);
      await expect(missing.getByTestId('invoice-amount')).toHaveCount(0);
    }
    await failClosed();
    audit.phase = 'missing-bootstrap explicit reload';
    await missing.reload({ waitUntil: 'domcontentloaded' });
    await failClosed();
    audit.phase = 'close missing-bootstrap context';
    await isolated.close();
    audit.phase = 'final financial and network assertions';
    assert.deepEqual(await stored(pool), paid, 'missing bootstrap and reload must not mutate the fixture');
    assert.equal(audit.requests.filter(request => request.label === 'missing-bootstrap' &&
      (request.path.startsWith('/api/') || request.path.startsWith('/__local/'))).length, 0,
    'missing bootstrap must make no session, bank or authority requests');
    assert.equal(audit.requests.filter(request => request.path === attemptsPath && request.method === 'POST').length, 1);
    assert.equal(audit.requests.filter(request => request.path === deliveryPath && request.method === 'POST').length, 2);
    assert.equal(audit.navigations.filter(request => request.label === 'payment').length, 1,
      'payment document must navigate exactly once; history.replaceState must not reload it');
    assert.equal(audit.requests.filter(request => request.path === '/__local/session' &&
      request.method === 'POST').length, 1, 'exactly one session POST across both contexts');
    assert.deepEqual(audit.bodyFailures, [], 'every collected response body must remain readable; body loss is not proof of reload');
    assert.deepEqual(audit.external, [], 'no nonorigin requests');
    assert.deepEqual(audit.forbidden, [], 'no legacy modules, legacy APIs or checkout push streams');
    assert.deepEqual(audit.errors, [], 'browser exceptions, console errors and HTTP failures');
    t.diagnostic('123.45: payable revision 1 -> one attempt, no settlement -> polling paid revision 2 -> replay true, one ledger; missing-bootstrap reload fails closed.');
  } catch (error) {
    t.diagnostic(redact(JSON.stringify({ phase: audit.phase, external: audit.external, forbidden: audit.forbidden,
      browserErrors: audit.errors, navigations: audit.navigations, hmr: audit.hmr,
      requestFailures: audit.requestFailures, bodyFailures: audit.bodyFailures,
      recentRequests: audit.requests.slice(-20) })));
    // Playwright call logs can contain the navigation fragment; never emit it.
    throw new Error(redact(`[${audit.phase}] ${error instanceof Error ? error.message : error}`));
  } finally {
    try { await browser?.close(); }
    finally { await pool?.end(); }
  }
});