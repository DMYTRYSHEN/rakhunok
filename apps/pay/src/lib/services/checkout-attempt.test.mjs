import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { checkoutPost, createCheckoutAttempt, decodeAccepted, selectLocalInvoice } from './checkout-attempt.ts';
import { createCheckoutSync } from './checkout-sync.ts';

const orderId = '10000000-0000-4000-8000-000000000001';
const attemptId = '20000000-0000-4000-8000-000000000001';
const resource = { kind: 'invoice', id: orderId };
const binding = { orderId, orderRevision: 1 };
const token = 't'.repeat(43);
const bootstrap = 'b'.repeat(43);
const accepted = () => ({ kind: 'accepted', attemptId, replayed: false, quote: {
  ...binding, amountMinor: 12345, currency: 'UAH',
  recipient: { iban: 'UA213223130000026007233566001', name: 'Synthetic recipient', taxId: '12345678' },
  purpose: 'LOCAL SYNTHETIC', expiresAt: '2027-01-01T00:00:00Z'
} });
const response = (value, status = 200) => Response.json(value, { status });
function harness(fetcher = async () => response(accepted(), 201), overrides = {}) {
  const requests = [];
  const abort = new AbortController();
  let preflights = 0;
  let keys = 0;
  const client = createCheckoutAttempt({ resource, token, bootstrap, signal: abort.signal,
    revalidateBeforePayment: async () => { preflights++; return { ...binding }; },
    newKey: () => `synthetic-key-${++keys}`,
    fetcher: async (...args) => { requests.push(args); return fetcher(...args); }, ...overrides });
  return { client, requests, abort, preflights: () => preflights, keys: () => keys };
}

test('local context selects invoice by kind, regardless of terminal position; fails closed on ambiguity', () => {
  const invoice = { resource, token };
  const terminal = { resource: { kind: 'terminal', id: attemptId }, token };
  for (const contexts of [[invoice, terminal], [terminal, invoice]]) assert.deepEqual(selectLocalInvoice(contexts), invoice);
  for (const contexts of [null, [], [terminal], [invoice, invoice], [{ ...invoice, token: 'bad' }]]) {
    assert.throws(() => selectLocalInvoice(contexts));
  }
});

test('attempt sends only frozen binding, bearer and one key; hardened request options; no implicit delivery', async () => {
  const mutable = { ...binding, amountMinor: 999, recipient: 'injected' };
  const h = harness(async (_url, init) => {
    mutable.orderRevision = 9;
    assert.deepEqual(JSON.parse(init.body), binding);
    return response(accepted(), 201);
  }, { revalidateBeforePayment: async () => mutable });
  const result = await h.client.create();
  assert.equal(result.attemptId, attemptId);
  assert.ok(Object.isFrozen(result.quote.recipient));
  assert.equal(h.requests.length, 1);
  const [url, init] = h.requests[0];
  assert.equal(url, `/api/checkout/v1/invoice/${orderId}/attempts`);
  assert.equal(init.method, 'POST');
  assert.deepEqual(init.headers, { Authorization: `Bearer ${token}`, 'Idempotency-Key': 'synthetic-key-1', 'Content-Type': 'application/json' });
  assert.equal(init.cache, 'no-store'); assert.equal(init.redirect, 'error'); assert.equal(init.credentials, 'omit');
  assert.ok(init.signal instanceof AbortSignal);
  assert.equal(await h.client.create(), result);
  assert.equal(h.requests.length, 1);
});

test('failed preflight never POSTs or allocates key; subsequent action can revalidate', async () => {
  let valid = false;
  const h = harness(undefined, { revalidateBeforePayment: async () => valid ? binding : null });
  await assert.rejects(h.client.create(), /binding_changed/);
  assert.equal(h.requests.length, 0); assert.equal(h.keys(), 0); assert.equal(h.client.hasPending(), false);
  valid = true;
  await h.client.create();
  assert.equal(h.requests.length, 1);
});

for (const [name, fail] of [
  ['network failure', () => { throw new TypeError('connection lost'); }],
  ['503', () => response({ error: 'checkout_unavailable' }, 503)],
  ['409', () => response({ error: 'conflict' }, 409)],
  ['403', () => response({ error: 'inaccessible' }, 403)],
  ['invalid JSON', () => new Response('{')],
  ['invalid acceptance', () => response({ ...accepted(), paid: true })],
  ['mismatched revision', () => { const v = accepted(); v.quote.orderRevision++; return response(v); }],
  ['oversized body', () => new Response(' '.repeat(65537))],
  ['invalid UTF-8', () => new Response(new Uint8Array([0xff]))]
]) test(`${name} preserves SAME key and original binding on explicit retry`, async () => {
  let first = true;
  const h = harness(() => { if (first) { first = false; return fail(); } return response({ ...accepted(), replayed: true }); });
  await assert.rejects(h.client.create());
  assert.equal(h.client.hasPending(), true);
  const result = await h.client.create();
  assert.equal(result.replayed, true);
  assert.equal(h.preflights(), 1); assert.equal(h.keys(), 1);
  assert.equal(h.requests[0][1].headers['Idempotency-Key'], h.requests[1][1].headers['Idempotency-Key']);
  assert.equal(h.requests[0][1].body, h.requests[1][1].body);
});

test('strict shared accepted decoder rejects malformed quote and recipient data', () => {
  assert.equal(decodeAccepted(accepted(), orderId, 1).attemptId, attemptId);
  for (const mutate of [
    v => { v.attemptId = 'bad'; }, v => { v.replayed = 1; },
    v => { v.quote.amountMinor = 0; }, v => { v.quote.currency = 'USD'; },
    v => { v.quote.orderId = attemptId; }, v => { v.quote.expiresAt = 'tomorrow'; },
    v => { v.quote.recipient.iban = 'UA003223130000026007233566001'; },
    v => { v.quote.recipient.name = ' '; }, v => { v.quote.recipient.taxId = '123'; },
    v => { v.quote.recipient.extra = true; }
  ]) { const value = accepted(); mutate(value); assert.throws(() => decodeAccepted(value, orderId, 1)); }
});

test('delivery requires acceptance, sends same attempt on retries, accepts paid/review only as receipts', async () => {
  let deliveries = 0;
  const h = harness(url => {
    if (url.endsWith('/attempts')) return response(accepted());
    if (++deliveries === 1) throw new Error('ambiguous delivery');
    return response({ synthetic: true, outcome: deliveries === 2 ? 'review' : 'paid', replayed: deliveries > 2 });
  });
  await assert.rejects(h.client.deliver(), /attempt_required/); assert.equal(h.requests.length, 0);
  await h.client.create();
  await assert.rejects(h.client.deliver());
  assert.deepEqual(await h.client.deliver(), { synthetic: true, outcome: 'review', replayed: false });
  assert.deepEqual(await h.client.deliver(), { synthetic: true, outcome: 'paid', replayed: true });
  for (const [url, init] of h.requests.slice(1)) {
    assert.equal(url, '/__local/bank/deliver');
    assert.deepEqual(JSON.parse(init.body), { attemptId });
    assert.deepEqual(init.headers, { Authorization: `Bearer ${token}`, 'X-Local-Bootstrap': bootstrap, 'Content-Type': 'application/json' });
    assert.equal(init.cache, 'no-store'); assert.equal(init.redirect, 'error'); assert.equal(init.credentials, 'omit');
  }
});

test('malformed delivery receipts fail closed without losing original attempt', async () => {
  for (const receipt of [{ synthetic: false, outcome: 'paid', replayed: false },
    { synthetic: true, outcome: 'paid', replayed: 'false' },
    { synthetic: true, outcome: 'unknown', replayed: false },
    { synthetic: true, outcome: 'paid', replayed: false, state: 'paid' }]) {
    const h = harness(url => response(url.endsWith('/attempts') ? accepted() : receipt));
    await h.client.create(); await assert.rejects(h.client.deliver(), /invalid_delivery_receipt/);
    assert.equal((await h.client.create()).attemptId, attemptId);
  }
});

test('busy guard prevents duplicate clicks while preflight is pending', async () => {
  let resolve;
  const h = harness(undefined, { revalidateBeforePayment: () => new Promise(done => { resolve = done; }) });
  const first = h.client.create();
  await assert.rejects(h.client.create(), /checkout_busy/);
  await assert.rejects(h.client.deliver(), /checkout_busy/);
  resolve(binding); await first;
  assert.equal(h.requests.length, 1);
});

test('8 second deadline aborts hung attempt and retry retains same key', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let first = true;
  const h = harness(() => { if (first) { first = false; return new Promise(() => {}); } return response(accepted()); });
  const request = h.client.create();
  const rejected = assert.rejects(request, /checkout_timeout/);
  await Promise.resolve();
  t.mock.timers.tick(7999); assert.equal(h.requests[0][1].signal.aborted, false);
  t.mock.timers.tick(1); await rejected;
  assert.equal(h.requests[0][1].signal.aborted, true);
  await h.client.create();
  assert.equal(h.keys(), 1); assert.equal(h.preflights(), 1);
  assert.equal(h.requests[0][1].body, h.requests[1][1].body);
});

test('deadline covers stalled response body too', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const abort = new AbortController();
  const request = checkoutPost('/test', {}, {}, abort.signal, async () => new Response(new ReadableStream({ start() {} })));
  const rejected = assert.rejects(request, /checkout_timeout/);
  await Promise.resolve(); t.mock.timers.tick(8000); await rejected;
});

test('unmount abort rejects in-flight mutation and prevents later requests', async () => {
  const h = harness(() => new Promise(() => {}));
  const request = h.client.create();
  const rejected = assert.rejects(request);
  await Promise.resolve(); h.abort.abort(); await rejected;
  assert.equal(h.requests[0][1].signal.aborted, true);
  await assert.rejects(h.client.create()); assert.equal(h.requests.length, 1);
});

test('paid delivery receipt cannot change sync state; only next authoritative snapshot can', async () => {
  let state = 'payable'; let revision = 1;
  const sync = createCheckoutSync({ resource,
    clock: { now: () => 0, schedule: () => () => {} },
    reader: { read: async () => ({ kind: 'snapshot', value: {
      documentType: 'snapshot', schemaVersion: 1, resource, revision, source: 'authoritative',
      observedAt: '2026-09-08T00:00:00Z', state, canInitiate: state === 'payable',
      order: { id: orderId, revision, amountMinor: 12345, currency: 'UAH', expiresAt: null }
    } }) }
  });
  try {
    await sync.start();
    const h = harness(url => response(url.endsWith('/attempts') ? accepted() : { synthetic: true, outcome: 'paid', replayed: false }),
      { revalidateBeforePayment: () => sync.revalidateBeforePayment() });
    await h.client.create(); await h.client.deliver();
    assert.equal(sync.view().snapshot.state, 'payable');
    await sync.refresh(); assert.equal(sync.view().snapshot.state, 'payable');
    state = 'paid'; revision++;
    await sync.refresh(); assert.equal(sync.view().snapshot.state, 'paid'); assert.equal(sync.view().canInitiate, false);
  } finally { sync.dispose(); }
});

test('UI exposes separate controls and receipt; authoritative state comes from snapshot only', () => {
  const source = readFileSync(new URL('../../LocalCheckout.svelte', import.meta.url), 'utf8');
  for (const id of ['create-attempt', 'deliver-webhook', 'attempt-id', 'delivery-receipt', 'authoritative-state']) assert.ok(source.includes(`data-testid="${id}"`));
  assert.match(source, /selectLocalInvoice\(contexts\)/);
  assert.doesNotMatch(source, /contexts\[1\]|state\s*=\s*['"]paid['"]|view\s*=\s*result/);
  assert.match(source, /let busy = \$state\(false\)/);
  assert.match(source, /data-testid="authoritative-state">\{view\?\.snapshot\?\.state/);
  assert.match(source, /busy \|\| paid \|\| view\?\.transport/);
});