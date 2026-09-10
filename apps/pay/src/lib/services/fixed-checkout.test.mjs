import assert from 'node:assert/strict';
import test from 'node:test';
import { createFixedCheckout } from './fixed-checkout.ts';

const orderId = '10000000-0000-4000-8000-000000000001';
const attemptId = '20000000-0000-4000-8000-000000000001';
const resource = { kind: 'invoice', id: orderId };
const bootstrap = 'b'.repeat(43);
const token = 't'.repeat(43);
const snapshot = (revision = 1, state = 'payable') => ({
  documentType: 'snapshot', schemaVersion: 1, resource, revision, source: 'authoritative',
  observedAt: '2026-09-08T00:00:00Z', state, canInitiate: state === 'payable',
  order: { id: orderId, revision, amountMinor: 12345, currency: 'UAH', expiresAt: null }
});
const accepted = () => ({ kind: 'accepted', attemptId, replayed: false, quote: {
  orderId, orderRevision: 1, amountMinor: 12345, currency: 'UAH',
  recipient: { iban: 'UA213223130000026007233566001', name: 'Local recipient', taxId: '12345678' },
  purpose: 'LOCAL', expiresAt: '2027-01-01T00:00:00Z'
} });
const receipt = { synthetic: true, outcome: 'paid', replayed: false };
const preview = (revision = 1, state = 'payable') => ({ ...snapshot(revision, state), source: 'cache', canInitiate: false });
const flush = async () => { for (let i = 0; i < 80; i++) await Promise.resolve(); };
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };

function harness(t, overrides = {}) {
  const requests = [];
  const views = [];
  const timers = new Set();
  let time = 0;
  const state = { snapshot: snapshot(), preview: () => Response.json(preview()), inaccessible: false, session: null, attempt: null, delivery: null, read: null };
  const clock = {
    now: () => time,
    schedule(callback, delay) {
      const entry = { callback, at: time + delay };
      timers.add(entry);
      return () => timers.delete(entry);
    }
  };
  const client = createFixedCheckout({ bootstrap, clock, onChange: v => views.push(v),
    fetcher: async (url, init) => {
      requests.push({ url, init });
      if (url === '/__local/session') return state.session ? state.session() : Response.json([
        { resource: { kind: 'terminal', id: attemptId }, token }, { resource, token }
      ]);
      if (url === '/__local/preview') return state.preview();
      if (url.endsWith('/attempts')) return state.attempt ? state.attempt() : Response.json(accepted());
      if (url === '/__local/bank/deliver') return state.delivery ? state.delivery() : Response.json(receipt);
      assert.match(url, new RegExp(`^/api/checkout/v1/invoice/${orderId}/snapshot\\?minimumRevision=\\d+$`));
      if (state.read) return state.read();
      return state.inaccessible ? Response.json({ error: 'inaccessible' }, { status: 403 }) : Response.json(state.snapshot);
    }, ...overrides });
  t.after(() => client.dispose());
  return { client, state, requests, views, timers, view: () => views.at(-1),
    reads: () => requests.filter(r => r.url.includes('/snapshot?')),
    attempts: () => requests.filter(r => r.url.endsWith('/attempts')),
    deliveries: () => requests.filter(r => r.url === '/__local/bank/deliver'),
    async advance(ms) {
      const target = time + ms;
      for (;;) {
        const entry = [...timers].filter(entry => entry.at <= target).sort((a, b) => a.at - b.at)[0];
        if (!entry) break;
        time = entry.at; timers.delete(entry); entry.callback(); await flush();
      }
      time = target; await flush();
    }
  };
}

test('startup selects invoice and freezes cache preview; only explicit begin starts polling, never attempt or webhook', async t => {
  const h = harness(t);
  assert.equal(h.requests.length, 0);
  await h.client.create(); await h.client.deliver();
  await h.client.start(); await h.client.start();
  assert.equal(h.requests.length, 2);
  assert.deepEqual(h.requests.map(r => r.url), ['/__local/session', '/__local/preview']);
  assert.equal(h.requests[0].init.headers['X-Local-Bootstrap'], bootstrap);
  assert.equal(h.requests[1].init.headers.Authorization, `Bearer ${token}`);
  assert.equal(h.requests[1].init.headers['X-Local-Bootstrap'], bootstrap);
  for (const { init } of h.requests) { assert.equal(init.method, 'POST'); assert.equal(init.body, '{}'); }
  assert.equal(h.view().connected, false);
  assert.equal(h.view().paymentActive, false); assert.equal(h.view().canOpen, true);
  assert.equal(h.view().sync.canInitiate, false);
  assert.deepEqual(h.view().sync.snapshot, preview());
  assert.equal(h.view().busy, false);
  assert.equal(h.view().pending, false);
  for (const value of [h.view(), h.view().sync, h.view().sync.snapshot, h.view().sync.snapshot.order]) assert.ok(Object.isFrozen(value));
  await h.advance(60000);
  await h.client.refresh(); await h.client.create(); await h.client.deliver();
  for (const flag of ['Online', 'Visible']) {
    h.client[`set${flag}`](false); await flush();
    assert.equal(h.view().canOpen, false);
    h.client[`set${flag}`](true); await flush();
    assert.equal(h.view().canOpen, true);
  }
  assert.equal(h.requests.length, 2); assert.equal(h.timers.size, 0);
  assert.equal(h.view().paymentActive, false); assert.equal(h.view().sync.canInitiate, false);
  await h.client.beginPayment();
  assert.equal(h.requests.length, 3); assert.equal(h.reads().length, 1);
  assert.equal(h.reads()[0].init.headers.Authorization, `Bearer ${token}`);
  assert.equal(h.view().connected, true); assert.equal(h.view().sync.canInitiate, true);
  assert.equal(h.view().paymentActive, true); assert.equal(h.view().busy, false);
  await h.advance(5000);
  assert.equal(h.requests.length, 4);
  assert.equal(h.attempts().length, 0); assert.equal(h.deliveries().length, 0);
  assert.equal(h.requests.some(r => r.url.includes('events')), false);
  for (const { init } of h.requests) {
    assert.equal(init.cache, 'no-store'); assert.equal(init.redirect, 'error'); assert.equal(init.credentials, 'omit');
  }
});

for (const existingPoll of [true, false]) test(`close/reopen fences old preflight, existing poll=${existingPoll}`, async t => {
  const h = harness(t);
  await h.client.start(); await h.client.beginPayment();
  const held = deferred();
  h.state.read = () => held.promise;
  if (existingPoll) await h.advance(5000);
  const oldCreate = h.client.create();
  await flush();
  assert.equal(h.attempts().length, 0);
  h.client.closePayment();
  h.state.read = null;
  const reopened = h.client.beginPayment();
  held.resolve(Response.json(snapshot()));
  await Promise.all([oldCreate, reopened]); await flush();
  assert.equal(h.attempts().length, 0);
  assert.equal(h.view().attempt, null);
  assert.equal(h.view().pending, false);
  assert.equal(h.view().busy, false);
  assert.equal(h.view().paymentActive, true);
  assert.equal(h.view().connected, true);
  await h.client.create();
  assert.equal(h.attempts().length, 1);
  assert.equal(h.view().attempt.attemptId, attemptId);
});

test('bootstrap rejects invalid alphabet and lengths without network or credential errors', async t => {
  for (const value of ['', 'a'.repeat(42), 'a'.repeat(129), `${bootstrap}\n`, 'a/'.repeat(30)]) {
    const h = harness(t, { bootstrap: value });
    await h.client.start();
    assert.equal(h.requests.length, 0); assert.equal(h.view().connected, false);
    assert.equal(h.view().error, 'Недійсний локальний доступ до рахунку.');
  }
  const h = harness(t, { bootstrap: '_'.repeat(128) });
  await h.client.start(); assert.equal(h.view().canOpen, true);
  await h.client.beginPayment(); assert.equal(h.view().connected, true);
});

test('preflight revision mismatch never creates attempt; next explicit action may revalidate', async t => {
  const h = harness(t); await h.client.start(); await h.client.beginPayment();
  h.state.snapshot = snapshot(2);
  await h.client.create();
  assert.equal(h.attempts().length, 0);
  assert.equal(h.view().sync.snapshot.revision, 2);
  assert.equal(h.view().pending, false); assert.ok(h.view().error);
});

test('explicit attempt then explicit delivery does not set snapshot paid', async t => {
  const h = harness(t); await h.client.start(); await h.client.beginPayment();
  await h.client.deliver(); assert.equal(h.deliveries().length, 0);
  await h.client.create(); await h.client.create();
  const prior = h.view();
  assert.equal(h.attempts().length, 1); assert.equal(h.deliveries().length, 0);
  assert.equal(prior.pending, false); assert.ok(Object.isFrozen(prior.attempt.quote.recipient));
  await h.client.deliver();
  assert.deepEqual(h.view().receipt, receipt);
  assert.ok(Object.isFrozen(h.view().receipt));
  assert.deepEqual(h.view().sync, prior.sync);
  assert.equal(h.view().sync.snapshot, prior.sync.snapshot);
  assert.equal(h.view().sync.snapshot.state, 'payable');
  assert.equal(prior.receipt, null);
  h.state.snapshot = snapshot(2, 'paid'); await h.client.refresh();
  assert.equal(h.view().sync.snapshot.state, 'paid');
  await h.client.create(); assert.equal(h.attempts().length, 1);
});

test('uncertain retry retains key and binding even when sync is no longer live', async t => {
  const h = harness(t); await h.client.start(); await h.client.beginPayment();
  h.state.attempt = () => { throw new Error(`secret ${bootstrap} ${token}`); };
  await h.client.create();
  assert.equal(h.view().pending, true); assert.equal(h.view().attempt, null);
  assert.equal(h.view().error.includes(bootstrap), false); assert.equal(h.view().error.includes(token), false);
  h.state.read = () => { throw new Error('unavailable'); };
  await h.client.refresh(); assert.equal(h.view().connected, false);
  const count = h.requests.length;
  h.state.attempt = () => Response.json({ ...accepted(), replayed: true });
  await h.client.create();
  assert.equal(h.requests.length, count + 1);
  const [first, second] = h.attempts();
  assert.equal(first.init.headers['Idempotency-Key'], second.init.headers['Idempotency-Key']);
  assert.equal(first.init.body, second.init.body);
  assert.equal(h.view().attempt.replayed, true); assert.equal(h.view().pending, false);
  await h.client.deliver(); assert.equal(h.deliveries().length, 0);
});

test('disposal during bootstrap aborts and never constructs sync or emits late views', async t => {
  const h = harness(t); const gate = deferred();
  h.state.session = () => gate.promise;
  const start = h.client.start();
  h.client.dispose(); const count = h.views.length;
  gate.resolve(Response.json([{ resource, token }])); await start; await flush();
  assert.equal(h.requests[0].init.signal.aborted, true);
  assert.equal(h.requests.length, 1); assert.equal(h.timers.size, 0); assert.equal(h.views.length, count);
  assert.deepEqual(h.view(), { sync: null, attempt: null, receipt: null, busy: false, pending: false, error: null, connected: false, paymentActive: false, canOpen: false });
  await h.client.start(); await h.client.create(); await h.client.deliver(); await h.client.refresh();
  await h.client.beginPayment(); h.client.closePayment();
  h.client.setOnline(false); h.client.setVisible(false); h.client.dispose();
  assert.equal(h.views.length, count); assert.equal(h.requests.length, 1);
});

test('revocation clears accepted quote and receipt and permanently disables actions', async t => {
  const h = harness(t); await h.client.start(); await h.client.beginPayment(); await h.client.create(); await h.client.deliver();
  h.state.inaccessible = true; await h.client.refresh();
  assert.equal(h.view().sync.transport, 'inaccessible'); assert.equal(h.view().sync.snapshot, null);
  assert.equal(h.view().attempt, null); assert.equal(h.view().receipt, null);
  assert.equal(h.view().pending, false); assert.equal(h.view().connected, false);
  const count = h.requests.length;
  await h.client.create(); await h.client.deliver(); await h.client.refresh(); await h.advance(60000);
  assert.equal(h.requests.length, count);
});

for (const flag of ['Online', 'Visible']) test(`${flag} false disables new actions and uncertain retries; resume revalidates`, async t => {
  const h = harness(t); await h.client.start(); await h.client.beginPayment();
  h.state.attempt = () => { throw new Error('lost'); }; await h.client.create();
  h.client[`set${flag}`](false);
  const count = h.requests.length;
  await h.client.create(); await h.client.deliver(); await h.client.refresh(); await h.advance(60000);
  assert.equal(h.requests.length, count); assert.equal(h.view().connected, false);
  h.client[`set${flag}`](true); await flush();
  assert.equal(h.view().connected, true);
  h.state.attempt = () => Response.json(accepted()); await h.client.create();
  h.client[`set${flag}`](false); await h.client.deliver();
  assert.equal(h.deliveries().length, 0);
});

test('initial offline/hidden state permits preview but suppresses authority until both flags and explicit begin', async t => {
  const h = harness(t, { online: false, visible: false }); await h.client.start();
  assert.equal(h.requests.length, 2); assert.equal(h.view().connected, false);
  assert.equal(h.view().canOpen, false); assert.equal(h.view().sync.snapshot.source, 'cache');
  await h.client.beginPayment(); assert.equal(h.view().paymentActive, false);
  h.client.setOnline(true); await flush(); assert.equal(h.requests.length, 2);
  await h.client.beginPayment(); assert.equal(h.view().paymentActive, false);
  h.client.setVisible(true); await flush(); assert.equal(h.requests.length, 2);
  assert.equal(h.view().connected, false); assert.equal(h.view().canOpen, true);
  await h.client.refresh(); await h.client.create(); await h.advance(60000);
  assert.equal(h.reads().length, 0); assert.equal(h.timers.size, 0);
  await h.client.beginPayment(); assert.equal(h.reads().length, 1);
  assert.equal(h.view().connected, true);
});

test('paid snapshot blocks even uncertain attempt retries', async t => {
  const h = harness(t); await h.client.start(); await h.client.beginPayment();
  h.state.attempt = () => { throw new Error('lost'); }; await h.client.create();
  h.state.snapshot = snapshot(2, 'paid'); await h.client.refresh();
  await h.client.create(); assert.equal(h.attempts().length, 1);
});

test('offline during preflight prevents POST; concurrent clicks are ignored', async t => {
  const h = harness(t); await h.client.start(); await h.client.beginPayment(); const gate = deferred();
  h.state.read = () => gate.promise;
  const create = h.client.create(); await flush();
  await h.client.create(); await h.client.deliver();
  h.client.setOnline(false); gate.resolve(Response.json(snapshot())); await create;
  assert.equal(h.attempts().length, 0); assert.equal(h.view().pending, false);
});

for (const action of ['create', 'deliver']) test(`disposal ignores late ${action} response`, async t => {
  const h = harness(t); await h.client.start(); await h.client.beginPayment();
  if (action === 'deliver') await h.client.create();
  const gate = deferred();
  h.state[action === 'create' ? 'attempt' : 'delivery'] = () => gate.promise;
  const operation = h.client[action](); await flush();
  h.client.dispose(); const count = h.views.length;
  gate.resolve(Response.json(action === 'create' ? accepted() : receipt)); await operation; await flush();
  assert.equal(h.views.length, count); assert.equal(h.view().attempt, null); assert.equal(h.view().receipt, null);
  assert.equal(h.timers.size, 0);
});

test('revocation while delivery is in flight cannot restore cleared receipt', async t => {
  const h = harness(t); await h.client.start(); await h.client.beginPayment(); await h.client.create();
  const gate = deferred(); h.state.delivery = () => gate.promise;
  const delivery = h.client.deliver(); await flush();
  h.state.inaccessible = true; await h.client.refresh(); const count = h.views.length;
  gate.resolve(Response.json(receipt)); await delivery; await flush();
  assert.equal(h.views.length, count); assert.equal(h.view().attempt, null);
  assert.equal(h.view().receipt, null); assert.equal(h.view().busy, false);
});

test('duplicate begin is single-flight and close pauses polling until explicit reopen', async t => {
  const h = harness(t); await h.client.start();
  const gate = deferred(); h.state.read = () => gate.promise;
  const begin = h.client.beginPayment(); await flush();
  assert.equal(h.view().busy, true); assert.equal(h.view().paymentActive, true);
  assert.equal(h.view().canOpen, false); assert.equal(h.view().sync.canInitiate, false);
  await h.client.beginPayment(); await h.client.create(); await h.client.deliver();
  assert.equal(h.reads().length, 1); assert.equal(h.attempts().length, 0);
  gate.resolve(Response.json(snapshot())); await begin; await flush();
  assert.equal(h.reads().length, 1); assert.equal(h.view().connected, true);
  h.client.closePayment();
  assert.equal(h.view().paymentActive, false); assert.equal(h.view().busy, false);
  assert.equal(h.view().connected, false); assert.equal(h.view().sync.canInitiate, false);
  assert.equal(h.view().canOpen, true); assert.equal(h.timers.size, 0);
  await h.client.refresh(); await h.client.create(); await h.client.deliver();
  h.client.setVisible(false); h.client.setOnline(false);
  h.client.setOnline(true); h.client.setVisible(true); await h.advance(60000);
  assert.equal(h.reads().length, 1); assert.equal(h.attempts().length, 0);
  h.state.read = null;
  await h.client.beginPayment();
  assert.equal(h.reads().length, 2); assert.equal(h.view().sync.canInitiate, true);
  await h.advance(5000); assert.equal(h.reads().length, 3);
});

test('close during activation aborts the read and ignores late authority across reopen', async t => {
  const h = harness(t); await h.client.start();
  const gate = deferred(); h.state.read = () => gate.promise;
  const begin = h.client.beginPayment(); await flush();
  h.client.closePayment(); await begin;
  assert.equal(h.reads()[0].init.signal.aborted, true);
  assert.equal(h.view().paymentActive, false); assert.equal(h.view().busy, false);
  assert.equal(h.view().sync.snapshot.source, 'cache'); assert.equal(h.view().sync.canInitiate, false);
  assert.equal(h.timers.size, 0);
  await h.advance(60000); assert.equal(h.reads().length, 1);
  const next = deferred(); h.state.read = () => next.promise;
  const reopen = h.client.beginPayment(); await flush();
  const count = h.views.length;
  gate.resolve(Response.json(snapshot(2, 'paid'))); await flush();
  assert.equal(h.views.length, count); assert.equal(h.view().busy, true);
  assert.equal(h.view().sync.snapshot.state, 'payable'); assert.equal(h.view().sync.canInitiate, false);
  next.resolve(Response.json(snapshot())); await reopen;
  assert.equal(h.view().busy, false); assert.equal(h.view().connected, true);
  assert.equal(h.view().sync.snapshot.revision, 1); assert.equal(h.attempts().length, 0);
});

for (const held of ['existing poll', 'started preflight read']) test(`close and immediate reopen fence create awaiting ${held}; only a fresh explicit create may POST`, async t => {
  const h = harness(t); await h.client.start(); await h.client.beginPayment();
  const old = deferred(); h.state.read = () => old.promise;
  if (held === 'existing poll') await h.advance(5000);
  const create = h.client.create(); await flush();
  assert.equal(h.reads().length, 2);
  assert.equal(h.view().busy, true); assert.equal(h.view().pending, false);
  assert.equal(h.attempts().length, 0);

  const fresh = deferred(); h.state.read = () => fresh.promise;
  // No await between close and reopen: the old continuation sees an active new generation.
  h.client.closePayment();
  const reopen = h.client.beginPayment(); await flush();
  assert.equal(h.reads()[1].init.signal.aborted, true);
  assert.equal(h.reads().length, 3);
  assert.equal(h.view().paymentActive, true); assert.equal(h.view().busy, true);
  assert.equal(h.view().sync.canInitiate, false);
  await h.client.create();
  assert.equal(h.attempts().length, 0);

  fresh.resolve(Response.json(snapshot())); await reopen; await flush();
  // Same order/revision deliberately rules out revision mismatch as the protection.
  assert.equal(h.view().connected, true); assert.equal(h.view().sync.canInitiate, true);
  assert.equal(h.view().busy, false); assert.equal(h.reads().length, 3);
  assert.equal(h.attempts().length, 0);
  const count = h.views.length;
  old.resolve(Response.json(snapshot())); await create; await flush();
  assert.equal(h.views.length, count);
  assert.equal(h.reads().length, 3); assert.equal(h.attempts().length, 0);
  assert.equal(h.view().attempt, null); assert.equal(h.view().pending, false);
  assert.equal(h.view().receipt, null); assert.equal(h.view().error, null);
  assert.ok(h.views.every(view => view.attempt === null && !view.pending));

  const explicit = deferred(); h.state.read = () => explicit.promise;
  const nextCreate = h.client.create(); await flush();
  assert.equal(h.reads().length, 4); assert.equal(h.attempts().length, 0);
  assert.equal(h.view().pending, false);
  explicit.resolve(Response.json(snapshot())); await nextCreate;
  assert.equal(h.attempts().length, 1);
  assert.equal(h.attempts()[0].init.method, 'POST');
  assert.deepEqual(JSON.parse(h.attempts()[0].init.body), { orderId, orderRevision: 1 });
  assert.deepEqual(h.view().attempt, accepted());
  assert.equal(h.view().pending, false); assert.equal(h.view().busy, false);
  assert.equal(h.deliveries().length, 0);
});

test('cached paid preview is display-only and never establishes payment authority', async t => {
  const h = harness(t); h.state.preview = () => Response.json(preview(1, 'paid'));
  h.state.snapshot = snapshot(1, 'paid'); await h.client.start();
  assert.equal(h.view().sync.snapshot.state, 'paid'); assert.equal(h.view().sync.snapshot.source, 'cache');
  assert.equal(h.view().connected, false); assert.equal(h.view().sync.canInitiate, false);
  await h.client.create(); await h.client.deliver(); await h.client.refresh(); await h.advance(60000);
  assert.equal(h.reads().length, 0); assert.equal(h.attempts().length, 0); assert.equal(h.deliveries().length, 0);
  const gate = deferred(); h.state.read = () => gate.promise;
  const begin = h.client.beginPayment(); await flush();
  assert.equal(h.view().connected, false); assert.equal(h.view().sync.snapshot.source, 'cache');
  gate.resolve(Response.json(h.state.snapshot)); await begin;
  assert.equal(h.view().connected, true); assert.equal(h.view().sync.snapshot.source, 'authoritative');
  assert.equal(h.view().sync.canInitiate, false);
  await h.client.create(); assert.equal(h.attempts().length, 0);
});

test('activation confirms changed amount, but subsequent preflight revision mismatch prevents POST', async t => {
  const h = harness(t); await h.client.start();
  const cachedView = h.view();
  h.state.snapshot = { ...snapshot(2), order: { ...snapshot(2).order, amountMinor: 23456 } };
  await h.client.beginPayment();
  assert.equal(h.view().sync.snapshot.order.amountMinor, 23456);
  assert.equal(h.view().sync.snapshot.revision, 2); assert.equal(h.view().sync.canInitiate, true);
  assert.equal(cachedView.sync.snapshot.order.amountMinor, 12345);
  assert.equal(cachedView.sync.canInitiate, false); assert.equal(h.attempts().length, 0);
  h.state.snapshot = { ...snapshot(3), order: { ...snapshot(3).order, amountMinor: 34567 } };
  await h.client.create();
  assert.equal(h.reads().length, 2); assert.equal(h.attempts().length, 0);
  assert.equal(h.view().sync.snapshot.order.amountMinor, 34567);
  assert.equal(h.view().sync.snapshot.revision, 3); assert.equal(h.view().pending, false);
  assert.ok(h.view().error); assert.equal(h.view().attempt, null);
  await h.advance(5000); assert.equal(h.attempts().length, 0);
});

test('close with an uncertain attempt keeps recovery polling and the original retry binding', async t => {
  const h = harness(t); await h.client.start(); await h.client.beginPayment();
  h.state.attempt = () => { throw new Error('lost'); }; await h.client.create();
  assert.equal(h.view().pending, true);
  const first = h.attempts()[0]; const reads = h.reads().length;
  h.client.closePayment();
  assert.equal(h.view().paymentActive, true); assert.equal(h.view().pending, true);
  await h.advance(5000); assert.equal(h.reads().length, reads + 1);
  h.state.attempt = () => Response.json({ ...accepted(), replayed: true });
  await h.client.create();
  assert.equal(h.attempts().length, 2); assert.equal(h.reads().length, reads + 1);
  assert.equal(h.attempts()[1].init.body, first.init.body);
  assert.equal(h.attempts()[1].init.headers['Idempotency-Key'], first.init.headers['Idempotency-Key']);
  assert.equal(h.view().pending, false); assert.equal(h.view().attempt.replayed, true);
  h.client.closePayment(); assert.equal(h.view().paymentActive, true);
  assert.equal(h.view().canOpen, false);
  h.state.snapshot = snapshot(2, 'paid'); await h.advance(5000);
  assert.equal(h.view().sync.snapshot.state, 'paid'); assert.equal(h.view().sync.snapshot.source, 'authoritative');
  assert.equal(h.deliveries().length, 0);
});

for (const [name, value] of [
  ['wrong invoice', { ...preview(), resource: { kind: 'invoice', id: attemptId }, order: { ...preview().order, id: attemptId } }],
  ['wrong resource kind', { ...preview(), resource: { kind: 'terminal', id: orderId } }],
  ['authoritative source', snapshot()],
  ['authoritative paid source', snapshot(1, 'paid')],
  ['cache canInitiate', { ...preview(), canInitiate: true }]
]) test(`preview rejects ${name} without constructing sync or enabling actions`, async t => {
  const h = harness(t); h.state.preview = () => Response.json(value);
  await h.client.start();
  assert.equal(h.requests.length, 2); assert.equal(h.view().sync, null);
  assert.equal(h.view().connected, false); assert.equal(h.view().canOpen, false);
  assert.equal(h.view().paymentActive, false); assert.equal(h.view().busy, false);
  assert.equal(h.view().error, 'Не вдалося оновити рахунок. Спробуйте ще раз.');
  await h.client.beginPayment(); await h.client.refresh(); await h.client.create(); await h.client.deliver();
  h.client.setOnline(false); h.client.setOnline(true); h.client.setVisible(false); h.client.setVisible(true);
  await h.advance(60000);
  assert.equal(h.requests.length, 2); assert.equal(h.timers.size, 0);
});

for (const failure of ['network', 'http', 'malformed']) test(`preview ${failure} failure stays closed without credential disclosure`, async t => {
  const h = harness(t);
  h.state.preview = () => {
    if (failure === 'network') throw new Error(`${bootstrap} ${token}`);
    return failure === 'http' ? Response.json({ error: `${bootstrap} ${token}` }, { status: 503 }) : new Response('{');
  };
  await h.client.start();
  assert.equal(h.view().sync, null); assert.equal(h.view().busy, false);
  assert.equal(h.view().connected, false); assert.equal(h.view().canOpen, false);
  assert.equal(h.view().paymentActive, false); assert.equal(h.view().pending, false);
  assert.equal(h.view().error, 'Не вдалося оновити рахунок. Спробуйте ще раз.');
  assert.equal(JSON.stringify(h.views).includes(bootstrap), false); assert.equal(JSON.stringify(h.views).includes(token), false);
  await h.client.start(); await h.client.beginPayment(); await h.client.refresh(); await h.client.create(); await h.client.deliver();
  await h.advance(60000); assert.equal(h.requests.length, 2); assert.equal(h.timers.size, 0);
});

test('disposal during preview aborts and prevents late sync construction', async t => {
  const h = harness(t); const gate = deferred(); h.state.preview = () => gate.promise;
  const start = h.client.start(); await flush();
  assert.equal(h.requests.length, 2);
  h.client.dispose(); const count = h.views.length;
  assert.equal(h.requests[1].init.signal.aborted, true);
  gate.resolve(Response.json(preview())); await start; await flush();
  assert.equal(h.views.length, count); assert.equal(h.view().sync, null);
  assert.equal(h.view().paymentActive, false); assert.equal(h.view().canOpen, false);
  assert.equal(h.timers.size, 0); assert.equal(h.requests.length, 2);
});