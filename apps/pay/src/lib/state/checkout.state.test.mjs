// Run: node --test apps/pay/src/lib/state/checkout.state.test.mjs
// Compiles the actual runes module; only imports/browser IO/timers are mocked.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import test from 'node:test';
import { compileModule } from 'svelte/compiler';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const source = readFileSync(new URL('./checkout.svelte.ts', import.meta.url), 'utf8');
const javascript = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext }
}).outputText;
// Server compilation evaluates real derived expressions through getters without a DOM.
const compiled = compileModule(javascript, { filename: 'checkout.svelte.js', generate: 'server' });
const commonjs = ts.transpileModule(compiled.js.code, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  transformers: { before: [context => {
    const visit = node => ts.isMetaProperty(node)
      ? ts.factory.createIdentifier('__importMeta')
      : ts.visitEachChild(node, visit, context);
    return node => ts.visitNode(node, visit);
  }] }
}).outputText;
const expiry = ts.transpileModule(readFileSync(new URL('../services/expiry.ts', import.meta.url), 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }
}).outputText;
const terminalAuthority = ts.transpileModule(readFileSync(new URL('../services/terminal-authority.ts', import.meta.url), 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }
}).outputText;
const deferred = () => {
  let resolve;
  const promise = new Promise(r => { resolve = r; });
  return { promise, resolve };
};
const invoice = (id = 'order-a', extra = {}) => ({
  id, order_number: id, status: 'pending', total_amount: 100, base_amount: 100,
  expires_at: null, ...extra
});

function harness({ dev = false, url = 'https://checkout.invalid/pay/?id=order-a' } = {}) {
  const calls = { initiate: [], launch: [], alerts: [], fetch: [], storage: [] };
  const intervals = new Map();
  const timeouts = new Map();
  let timer = 0;
  const mocks = {
    captcha: async () => 'mock-token',
    load: async () => ({ order: invoice(), reason: null }),
    initiate: async () => ({ success: true, redirect_url: 'https://bank.invalid/pay' }),
    fetch: async () => ({ ok: true, json: async () => ({ status: 'pending' }) })
  };
  const window = { location: new URL(url) };
  const context = vm.createContext({
    exports: {}, __importMeta: { env: { DEV: dev } }, window,
    URLSearchParams, AbortController, console,
    localStorage: { getItem: key => { calls.storage.push(key); return JSON.stringify(invoice()); } },
    alert: message => calls.alerts.push(message),
    setInterval: fn => { const id = ++timer; intervals.set(id, fn); return id; },
    clearInterval: id => intervals.delete(id),
    setTimeout: fn => { const id = ++timer; timeouts.set(id, fn); return id; },
    clearTimeout: id => timeouts.delete(id),
    fetch: (...args) => { calls.fetch.push(args); return mocks.fetch(...args); },
    require: name => {
      if (name.startsWith('svelte/')) return require(name);
      if (name.endsWith('/banks.js')) return { DEFAULT_BANKS: [{ code: 'LVIV', feePct: 0 }] };
      if (name.endsWith('/profiles.js')) return { DEFAULT_PROFILES: {} };
      if (name.endsWith('/scenarios.js')) return { resolveScenario: () => ({ config: {} }) };
      if (name.endsWith('/terminal-authority.js')) {
        const exports = {};
        vm.runInNewContext(terminalAuthority, {
          exports, AbortController,
          setTimeout: context.setTimeout, clearTimeout: context.clearTimeout,
          fetch: context.fetch
        });
        return exports;
      }
      if (name.endsWith('/expiry.js')) {
        const exports = {};
        vm.runInNewContext(expiry, { exports });
        return exports;
      }
      if (name.endsWith('/turnstile.js')) return { executeTurnstile: () => mocks.captcha() };
      if (name.endsWith('/deeplink.js')) return {
        detectOS: () => 'android', launchDeepLink: (...args) => calls.launch.push(args)
      };
      if (name.endsWith('/api.js')) return {
        fetchBanksCatalog: async () => [], fetchCheckoutOrder: (...args) => mocks.load(...args),
        initiateBankPayment: (...args) => { calls.initiate.push(args); return mocks.initiate(...args); }
      };
      throw new Error(`Unmocked import: ${name}`);
    }
  });
  vm.runInContext(commonjs, context, { filename: 'checkout.compiled.cjs' });
  const store = context.exports.checkout;
  store.order = invoice();
  store.orderId = 'order-a';
  store.isLoaded = true;
  return { store, mocks, calls, intervals, timeouts, window };
}

const terminalA = '11111111-1111-4111-8111-111111111111';
const terminalB = '22222222-2222-4222-8222-222222222222';
const terminalOrder = (extra = {}) => invoice(terminalA, {
  currency: 'UAH', type: 'table', expires_at: '2099-01-01T00:00:00Z',
  items: [{ id: 'item', name: 'Original item', qty: 1, price: 100 }],
  merchant: { display_name: 'Original merchant' }, ...extra
});
const selection = (order = terminalOrder()) => ({
  kind: order ? 'active' : 'idle', terminal: { code: 'table-30', name: 'Table 30' }, order
});
function terminalHarness() {
  const h = harness({ url: 'https://checkout.invalid/tag/table-30?id=wrong&demo=table' });
  h.mocks.load = async id => ({ order: terminalOrder({ id }), reason: null });
  h.mocks.fetch = async () => ({ ok: true, json: async () => selection() });
  return h;
}

test('terminal ignores injection/query alias and hydrates original detail by UUID only', async () => {
  const h = terminalHarness(); const ids = [];
  h.window.__INITIAL_ORDER__ = invoice('wrong');
  h.window.__INITIAL_TERMINAL__ = { code: 'wrong', name: 'wrong' };
  h.mocks.load = async (id, options) => {
    ids.push(id); assert.equal(options.apiBase, '');
    return { order: terminalOrder(), reason: null };
  };
  await h.store.init();
  assert.deepEqual(ids, [terminalA]);
  assert.equal(h.store.orderId, terminalA);
  assert.equal(h.store.orderItems[0].name, 'Original item');
  assert.equal(h.store.merchantName, 'Original merchant');
  assert.equal(h.store.forcedScenario, '');
  assert.equal(h.store.terminal.code, 'table-30');
  for (const [url, options] of h.calls.fetch) {
    assert.equal(url, '/api/v1/checkout/terminal/table-30');
    assert.equal(options.cache, 'no-store');
    assert.equal(options.redirect, 'error');
  }
  h.store.startStatusPolling();
  assert.equal(h.intervals.size, 1, 'only terminal authority timer');
});

test('terminal idle uses original table waiting without loading an alias invoice', async () => {
  const h = terminalHarness(); let loads = 0;
  h.mocks.fetch = async () => ({ ok: true, json: async () => selection(null) });
  h.mocks.load = async () => { loads++; throw Error('must not load'); };
  await h.store.init();
  assert.equal(loads, 0); assert.equal(h.store.order, null);
  assert.equal(h.store.stateScreenType, 'loading');
  assert.equal(h.store.terminalMode, true);
  await h.store.executePay(); assert.equal(h.calls.initiate.length, 0);
});

test('terminal rejects inactive, malformed, expired and mismatched authority/detail', async () => {
  for (const extra of [
    { id: 'alias' }, { status: 'paid' }, { status: 'cancelled' },
    { total_amount: -1 }, { total_amount: '100' }, { expires_at: undefined },
    { expires_at: '2000-01-01' }, { expires_at: 'invalid' }
  ]) {
    const h = terminalHarness();
    h.mocks.fetch = async () => ({ ok: true, json: async () => selection(terminalOrder(extra)) });
    await h.store.init(); assert.equal(h.store.order, null, JSON.stringify(extra));
    assert.equal(h.store.stateScreenType, 'error');
  }
  for (const extra of [{ id: terminalB }, { status: 'preparing' }, { total_amount: 101 },
    { expires_at: null }, { currency: 'USD' }]) {
    const h = terminalHarness();
    h.mocks.load = async () => ({ order: terminalOrder(extra), reason: null });
    await h.store.init(); assert.equal(h.store.order, null, JSON.stringify(extra));
    assert.equal(h.store.stateScreenType, 'error');
  }
});

test('preparing positive and pending zero terminal invoices cannot pay', async () => {
  for (const extra of [{ status: 'preparing' }, { total_amount: 0, base_amount: 0, items: [] }]) {
    const h = terminalHarness(); const order = terminalOrder(extra);
    h.mocks.fetch = async () => ({ ok: true, json: async () => selection(order) });
    h.mocks.load = async () => ({ order, reason: null });
    await h.store.init(); await h.store.executePay();
    assert.equal(h.store.order.id, terminalA);
    assert.equal(h.calls.initiate.length, 0);
  }
});

test('terminal poll clears order/items/sheets on idle and errors, then recovers', async () => {
  const h = terminalHarness(); await h.store.init();
  for (const response of [
    async () => ({ ok: true, json: async () => selection(null) }),
    async () => ({ ok: false }), async () => { throw Error('offline'); }
  ]) {
    h.store.openPaymentSheet(); h.store.tipAmount = 10;
    h.mocks.fetch = response; await h.store.refreshTerminal();
    assert.equal(h.store.order, null); assert.equal(h.store.orderId, '');
    assert.equal(h.store.orderItems.length, 0); assert.equal(h.store.isSheetOpen, false);
    assert.equal(h.store.tipAmount, 0);
    h.mocks.fetch = async () => ({ ok: true, json: async () => selection() });
    await h.store.refreshTerminal(); assert.equal(h.store.orderId, terminalA);
  }
});

test('terminal selection rollover during detail read is rejected', async () => {
  const h = terminalHarness(); let reads = 0;
  h.mocks.fetch = async () => ({ ok: true, json: async () => selection(terminalOrder({ id: ++reads === 1 ? terminalA : terminalB })) });
  await h.store.init(); assert.equal(h.store.order, null);
  assert.equal(h.store.stateScreenType, 'error');
});

test('terminal payment rechecks authority after captcha and never pays rollover B', async () => {
  for (const next of [selection(terminalOrder({ id: terminalB })), selection(null), selection(terminalOrder({ total_amount: 101 }))]) {
    const h = terminalHarness(); await h.store.init();
    h.mocks.fetch = async () => ({ ok: true, json: async () => next });
    await h.store.executePay();
    assert.equal(h.calls.initiate.length, 0); assert.equal(h.calls.launch.length, 0);
    assert.equal(h.store.order, null);
  }
  const h = terminalHarness(); await h.store.init(); await h.store.executePay();
  assert.equal(h.calls.initiate.length, 1); assert.equal(h.calls.initiate[0][0], terminalA);
  assert.equal(h.calls.launch.length, 1); assert.equal(h.intervals.size, 1);
});

test('terminal reads are single-flight and disposal/navigation fences pending detail', async () => {
  const h = terminalHarness(); const pending = deferred();
  h.mocks.load = () => pending.promise;
  const first = h.store.init();
  await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
  await h.store.refreshTerminal(); assert.equal(h.calls.fetch.length, 1);
  h.store.disposeTerminal();
  pending.resolve({ order: terminalOrder(), reason: null }); await first;
  assert.equal(h.store.order, null); assert.equal(h.intervals.size, 0);
});

test('terminal expiry tick revokes payment and clears data even during a stalled poll', async () => {
  const h = terminalHarness(); await h.store.init();
  h.store.order.expires_at = '2000-01-01';
  const tick = [...h.intervals.values()][0]; tick();
  assert.equal(h.store.order, null); assert.equal(h.store.stateScreenType, 'error');
  await h.store.executePay(); assert.equal(h.calls.initiate.length, 0);
});

test('terminal poll rollover cancels pending bank response and keeps the replacement UUID', async () => {
  const h = terminalHarness(); await h.store.init();
  const pending = deferred(); const started = deferred();
  h.mocks.initiate = () => { started.resolve(); return pending.promise; };
  const payment = h.store.executePay(); await started.promise;
  h.mocks.fetch = async () => ({ ok: true, json: async () => selection(terminalOrder({ id: terminalB })) });
  await h.store.refreshTerminal();
  pending.resolve({ success: true, redirect_url: 'https://bank.invalid/pay' });
  await payment;
  assert.equal(h.store.orderId, terminalB);
  assert.equal(h.calls.initiate[0][0], terminalA);
  assert.equal(h.calls.initiate.length, 1);
  assert.equal(h.calls.launch.length, 0);
  assert.equal(h.store.isStatusScreenOpen, false);
});

test('terminal preflight network error clears authority without payment', async () => {
  const h = terminalHarness(); await h.store.init();
  h.mocks.fetch = async () => { throw Error('offline'); };
  await h.store.executePay();
  assert.equal(h.store.order, null);
  assert.equal(h.store.stateScreenType, 'error');
  assert.equal(h.calls.initiate.length, 0);
});

test('malformed tag paths never fall back to query IDs or demo invoices', async () => {
  const h = harness({ dev: true, url: 'http://localhost/tag/bad/path?id=order-a&demo=table' });
  h.mocks.load = () => { throw Error('alias fallback forbidden'); };
  await h.store.init();
  assert.equal(h.store.order, null);
  assert.equal(h.store.stateScreenType, 'error');
  assert.equal(h.calls.fetch.length, 0);
});

test('offline cached orders and last order IDs are never consulted', async () => {
  for (const url of ['https://checkout.invalid/pay/?id=order-a', 'https://checkout.invalid/pay/']) {
    const h = harness({ url });
    h.mocks.load = async () => ({ order: null, reason: 'offline' });
    await h.store.init();
    assert.equal(h.store.order, null);
    assert.equal(h.store.stateScreenType, 'error');
    assert.equal(h.calls.storage.length, 0);
    await h.store.executePay();
    assert.equal(h.calls.initiate.length, 0);
  }
});

test('missing recipients stay absent and missing fiscal receipts stay null', async () => {
  const h = harness();
  await h.store.init();
  assert.equal(h.store.order.merchant, undefined);
  assert.equal(h.store.fiscalReceipt, null);
  h.store.openFiscalReceipt();
  assert.equal(h.store.isFiscalReceiptOpen, false);
  const receipt = { fiscal_number: 'actual-server-receipt' };
  h.store.order.fiscal_receipt = receipt;
  assert.equal(h.store.fiscalReceipt, receipt);
  h.store.openFiscalReceipt();
  assert.equal(h.store.isFiscalReceiptOpen, true);
  for (const property of ['nbuQr', 'nbuPayload', 'nbuRawString', 'currentBankRedirect']) {
    assert.equal(property in h.store, false);
  }
});

test('only loaded, fresh, pending, real positive invoices can initiate', async () => {
  const variants = [
    ...['paid', 'cancelled', 'expired', 'preparing', 'new', 'unknown'].map(status => ({ status })),
    { expires_at: '2000-01-01T00:00:00Z' }, { expires_at: undefined },
    { total_amount: 0 }, { total_amount: NaN }, { base_amount: Infinity },
    { id: 'demo-test' }, { id: 'term-test' }, { id: 'profile-test' }
  ];
  for (const extra of variants) {
    const h = harness();
    h.store.order = invoice(extra.id || 'order-a', extra);
    h.store.orderId = h.store.order.id;
    await h.store.executePay();
    assert.equal(h.calls.initiate.length, 0, JSON.stringify(extra));
    assert.equal(h.intervals.size, 0);
  }
  for (const mutate of [s => { s.isLoaded = false; }, s => { s.orderId = 'other'; }, s => { s.forcedScenario = 'fixed'; }]) {
    const h = harness(); mutate(h.store); await h.store.executePay();
    assert.equal(h.calls.initiate.length, 0);
  }
});

for (const stage of ['captcha', 'response']) {
  for (const change of ['id', 'amount', 'object', 'status', 'expiry', 'navigation', 'bank']) {
    test(`${stage}: reject stale ${change}`, async () => {
      const h = harness();
      const pending = deferred();
      const started = deferred();
      if (stage === 'captcha') h.mocks.captcha = () => pending.promise;
      else h.mocks.initiate = () => { started.resolve(); return pending.promise; };
      const payment = h.store.executePay();
      if (stage === 'response') await started.promise;
      if (change === 'id') h.store.orderId = 'order-b';
      if (change === 'amount') h.store.order.base_amount = 200;
      if (change === 'object') h.store.order = invoice();
      if (change === 'status') h.store.order.status = 'paid';
      if (change === 'expiry') h.store.order.expires_at = '2000-01-01';
      if (change === 'navigation') h.window.location = new URL('https://checkout.invalid/pay/?id=order-b');
      if (change === 'bank') h.store.banks = [{ code: 'OTHER' }];
      pending.resolve(stage === 'captcha' ? 'token' : { success: true, redirect_url: 'https://bank.invalid' });
      await payment;
      assert.equal(h.calls.launch.length, 0);
      assert.equal(h.intervals.size, 0);
      assert.equal(h.store.isProcessingPayment, false);
      assert.equal(h.calls.initiate.length, stage === 'captcha' ? 0 : 1);
    });
  }
}

test('successful LVIV initiation stays pending; duplicate clicks do not overlap', async () => {
  const h = harness(); const pending = deferred();
  h.mocks.captcha = () => pending.promise;
  const first = h.store.executePay();
  await h.store.executePay();
  pending.resolve('token'); await first;
  assert.equal(h.calls.initiate.length, 1);
  assert.equal(h.calls.initiate[0][0], 'order-a');
  assert.equal(h.calls.initiate[0][2], 100);
  assert.deepEqual(Object.keys(h.calls.initiate[0][3]).sort(), ['os', 'recaptchaToken', 'turnstileToken']);
  assert.equal(h.calls.launch.length, 1);
  assert.equal(h.store.statusState, 'pending');
  assert.equal(h.intervals.size, 1);
});

test('failed initiation cannot redirect or start polling', async () => {
  for (const result of [{ success: false, redirect_url: 'https://bank.invalid' }, { success: true }]) {
    const h = harness(); h.mocks.initiate = async () => result;
    await h.store.executePay();
    assert.equal(h.calls.launch.length, 0);
    assert.equal(h.intervals.size, 0);
    assert.equal(h.calls.alerts.length, 1);
  }
});

test('polls are single-flight, no-store, redirect:error and paid requires matching response', async () => {
  const h = harness(); const pending = deferred();
  h.mocks.fetch = () => pending.promise;
  h.store.startStatusPolling();
  const tick = [...h.intervals.values()][0];
  const first = tick(); await tick();
  assert.equal(h.calls.fetch.length, 1);
  assert.match(h.calls.fetch[0][0], /order-a\/status$/);
  assert.equal(h.calls.fetch[0][1].cache, 'no-store');
  assert.equal(h.calls.fetch[0][1].redirect, 'error');
  pending.resolve({ ok: true, json: async () => ({ order_id: 'order-b', status: 'paid' }) });
  await first;
  assert.equal(h.store.statusState, 'pending');
  h.mocks.fetch = async () => ({ ok: true, json: async () => ({ order_id: 'order-a', status: 'paid' }) });
  await tick();
  assert.equal(h.store.statusState, 'success');
  assert.equal(h.store.order.status, 'paid');
  assert.equal(h.intervals.size, 0);
  await h.store.executePay();
  assert.equal(h.calls.initiate.length, 0);
});

test('old JSON response and old timeout cannot affect a replacement poll', async () => {
  const h = harness(); const body = deferred();
  h.mocks.fetch = async () => ({ ok: true, json: () => body.promise });
  h.store.startStatusPolling();
  const oldTick = [...h.intervals.values()][0];
  const oldTimeout = [...h.timeouts.values()][0];
  const response = oldTick(); await Promise.resolve();
  h.store.startStatusPolling();
  const nextInterval = h.store.statusPollingInterval;
  body.resolve({ status: 'paid' }); await response; oldTimeout();
  assert.equal(h.store.statusState, 'pending');
  assert.equal(h.store.statusPollingInterval, nextInterval);
  assert.equal(h.intervals.has(nextInterval), true);
  assert.equal(h.calls.fetch[0][1].signal.aborted, true);
});

test('poll ignores navigation during fetch and does not request new order with old timer', async () => {
  const h = harness(); const pending = deferred();
  h.mocks.fetch = () => pending.promise;
  h.store.startStatusPolling(); const tick = [...h.intervals.values()][0];
  const response = tick();
  h.store.orderId = 'order-b'; h.store.order = invoice('order-b');
  pending.resolve({ ok: true, json: async () => ({ status: 'paid' }) }); await response;
  await tick();
  assert.equal(h.store.statusState, 'pending');
  assert.equal(h.calls.fetch.length, 1);
  assert.equal(h.intervals.size, 0);
});

test('cancelled, expired, network failures and poll deadline never synthesize success', async () => {
  for (const status of ['cancelled', 'expired', 'network']) {
    const h = harness();
    h.mocks.fetch = async () => {
      if (status === 'network') throw Error('offline');
      return { ok: true, json: async () => ({ status }) };
    };
    h.store.startStatusPolling(); await [...h.intervals.values()][0]();
    assert.notEqual(h.store.statusState, 'success');
    if (status !== 'network') assert.equal(h.store.order.status, status);
    else { [...h.timeouts.values()][0](); assert.equal(h.store.statusState, 'timeout'); }
    assert.equal(h.intervals.size, 0);
  }
});

test('overlapping init cannot restore an old invoice or injected mismatched invoice', async () => {
  const h = harness(); const first = deferred();
  h.window.__INITIAL_ORDER__ = invoice('wrong');
  h.mocks.load = id => id === 'order-a' ? first.promise : Promise.resolve({ order: invoice(id), reason: null });
  const old = h.store.init();
  h.window.location = new URL('https://checkout.invalid/pay/?id=order-b');
  await h.store.init();
  first.resolve({ order: invoice(), reason: null }); await old;
  assert.equal(h.store.order.id, 'order-b');
});

test('old payment finalizer cannot unlock a newer init session payment', async () => {
  const h = harness(); const oldToken = deferred(); const newToken = deferred();
  h.mocks.captcha = () => oldToken.promise;
  const old = h.store.executePay();
  await h.store.init();
  h.mocks.captcha = () => newToken.promise;
  const current = h.store.executePay();
  oldToken.resolve('old'); await old;
  assert.equal(h.store.isProcessingPayment, true);
  assert.equal(h.calls.initiate.length, 0);
  newToken.resolve('new'); await current;
  assert.equal(h.calls.initiate.length, 1);
});

test('demo generation requires both DEV and local hostname and never initiates payment', async () => {
  for (const [dev, hostname, expected] of [[false, 'localhost', false], [true, 'checkout.invalid', false], [true, 'localhost', true]]) {
    const h = harness({ dev, url: `http://${hostname}/pay/?demo=fixed` });
    await h.store.init();
    assert.equal(Boolean(h.store.order), expected);
    await h.store.executePay();
    assert.equal(h.calls.initiate.length, 0);
  }
});