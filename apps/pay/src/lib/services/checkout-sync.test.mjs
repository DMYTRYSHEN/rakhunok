import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { decodeSnapshot, parseCheckoutEntry, validateResolvedContext } from './checkout-contract.ts';
import { createCheckoutSync } from './checkout-sync.ts';

const fixtures = JSON.parse(readFileSync(new URL('../../../../../docs/checkout-contract/protocol.examples.json', import.meta.url), 'utf8'));
const cached = fixtures[0];
const paid = fixtures[2];
const idle = fixtures[3];
const terminal = fixtures[4];
const confirmed = { ...cached, source: 'authoritative', canInitiate: true };
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };

function harness(resource = cached.resource) {
  let time = 0;
  let serial = 0;
  const timers = new Map();
  const requests = [];
  const views = [];
  const clock = {
    now: () => time,
    schedule(callback, delay) {
      const key = ++serial;
      timers.set(key, { at: time + delay, callback });
      return () => timers.delete(key);
    }
  };
  const sync = createCheckoutSync({ resource, clock, onChange: v => views.push(v), reader: {
    read(input) { return new Promise((resolve, reject) => requests.push({ ...input, resolve, reject })); }
  } });
  async function respond(value, index = requests.length - 1) {
    requests[index].resolve({ kind: 'snapshot', value }); await flush();
  }
  async function advance(ms) {
    const target = time + ms;
    for (;;) {
      const next = [...timers].filter(([, t]) => t.at <= target).sort((a, b) => a[1].at - b[1].at)[0];
      if (!next) break;
      time = next[1].at; timers.delete(next[0]); next[1].callback(); await flush();
    }
    time = target; await flush();
  }
  return { sync, requests, timers, views, respond, advance, jump: ms => { time += ms; } };
}

test('strict decoder accepts proposal fixtures but rejects legacy API responses and extra payloads', () => {
  for (const v of fixtures.filter(v => v.documentType === 'snapshot')) assert.ok(decodeSnapshot(v));
  for (const v of [{ id: cached.order.id, status: 'pending' }, { ...confirmed, bank: {} },
    { ...confirmed, state: 'unknown' }, { ...paid, canInitiate: true },
    { ...cached, canInitiate: true }, { ...cached, revision: 20 },
    { ...cached, order: { ...cached.order, amountMinor: -1 } }]) assert.throws(() => decodeSnapshot(v));
});

test('route parser preserves intent and rejects conflicts rather than paying another invoice', () => {
  for (const path of [`/pay/${cached.resource.id}`, `/pay?id=${cached.resource.id}`, `/pay/?order_id=${cached.resource.id}`, `/checkout/?id=${cached.resource.id}`, `/o/short-id/`]) {
    assert.equal(parseCheckoutEntry(path).kind, 'invoice');
  }
  assert.equal(parseCheckoutEntry('/tag/table-30').kind, 'terminal');
  assert.equal(parseCheckoutEntry('/pos/short').kind, 'ambiguous');
  assert.equal(parseCheckoutEntry('/t/code').kind, 'ambiguous');
  for (const path of ['/pay/a?id=b', '/pay?id=a&id=b', '/pay?id=', '/pay/a/extra', '/pay/a#id=b', '/tag?id=a']) assert.throws(() => parseCheckoutEntry(path));
  assert.throws(() => validateResolvedContext(parseCheckoutEntry(`/pay/${cached.resource.id}`), terminal.resource));
  assert.throws(() => validateResolvedContext(parseCheckoutEntry(`/pay/${cached.resource.id}`), { kind: 'invoice', id: terminal.order.id }));
});

test('cached payable is disabled; same-revision confirmation enables it with exact stored total', async () => {
  const h = harness(); h.sync.start(cached); await flush();
  assert.equal(h.sync.view().canInitiate, false);
  await h.respond(confirmed);
  assert.equal(h.sync.view().transport, 'live');
  assert.equal(h.sync.view().snapshot.order.amountMinor, 44400);
  assert.equal(h.sync.view().canInitiate, true);
  h.sync.dispose();
});

test('serialized authoritative flag cannot bypass revalidation', async () => {
  const h = harness(); h.sync.start(confirmed); await flush();
  assert.equal(h.sync.view().canInitiate, false);
  assert.equal(h.sync.view().snapshot.source, 'cache'); h.sync.dispose();
});

test('same-revision contradiction fails closed and retains last business state', async () => {
  const h = harness(); h.sync.start(cached); await flush();
  await h.respond({ ...confirmed, order: { ...confirmed.order, amountMinor: 1 } });
  assert.equal(h.sync.view().transport, 'error');
  assert.equal(h.sync.view().snapshot.order.amountMinor, 44400); h.sync.dispose();
});

test('revision watermark survives a notification during a read and duplicates do not fan out', async () => {
  const h = harness(); h.sync.start(cached); await flush();
  const change = { ...fixtures[1], revision: 9 };
  h.sync.notify(change); h.sync.notify(change); h.sync.notify({ ...change, revision: 8 });
  assert.equal(h.requests.length, 1);
  await h.respond(paid);
  assert.equal(h.requests.length, 2);
  assert.equal(h.requests[1].minimumRevision, 9);
  assert.equal(h.sync.view().transport, 'stale');
  await h.respond({ ...paid, revision: 9, order: { ...paid.order, revision: 9 } });
  assert.equal(h.sync.view().transport, 'live');
  assert.equal(h.sync.view().snapshot.state, 'paid'); h.sync.dispose();
});

test('wrong resource and regressing snapshots cannot overwrite the invoice', async () => {
  const h = harness(); h.sync.start(); await flush(); await h.respond(paid);
  h.sync.refresh(); await flush(); await h.respond(confirmed);
  assert.equal(h.sync.view().snapshot.revision, 8);
  h.sync.refresh(); await flush(); await h.respond(terminal);
  assert.equal(h.sync.view().snapshot.resource.id, cached.resource.id);
  assert.equal(h.sync.view().canInitiate, false); h.sync.dispose();
});

test('timeout aborts and ignores late response; polling can recover', async () => {
  const h = harness(); h.sync.start(cached); await flush();
  await h.advance(8000);
  assert.equal(h.requests[0].signal.aborted, true);
  await h.respond(confirmed, 0);
  assert.equal(h.sync.view().canInitiate, false);
  await h.advance(10000);
  assert.equal(h.requests.length, 2);
  await h.respond(confirmed, 1);
  assert.equal(h.sync.view().transport, 'live'); h.sync.dispose();
});

test('freshness expires conservatively even if event loop timers are suspended', async () => {
  const h = harness(); h.sync.start(); await flush(); await h.respond(confirmed);
  h.jump(15000);
  assert.equal(h.sync.view().transport, 'stale');
  assert.equal(h.sync.view().canInitiate, false); h.sync.dispose();
});

test('foreground and reconnect read again; old responses cannot affect new request', async () => {
  const h = harness(); h.sync.start(cached); await flush();
  h.sync.setVisible(false); assert.equal(h.requests[0].signal.aborted, true);
  await h.advance(60000); assert.equal(h.requests.length, 1);
  h.sync.setVisible(true); await flush();
  await h.respond(paid, 0); assert.equal(h.sync.view().snapshot.state, 'payable');
  await h.respond(confirmed, 1);
  h.sync.setOnline(false); assert.equal(h.sync.view().transport, 'offline');
  assert.equal(h.sync.view().snapshot.state, 'payable');
  h.sync.setOnline(true); await flush(); await h.respond(paid, 2);
  assert.equal(h.sync.view().snapshot.state, 'paid'); h.sync.dispose();
});

test('revocation purges data and prevents further reads', async () => {
  const h = harness(); h.sync.start(cached); await flush();
  h.requests[0].resolve({ kind: 'inaccessible' }); await flush();
  assert.equal(h.sync.view().snapshot, null);
  assert.equal(h.sync.view().transport, 'inaccessible');
  assert.equal(await h.sync.refresh(), false);
  await h.advance(60000); assert.equal(h.requests.length, 1); h.sync.dispose();
});

test('terminal rollover does not mutate an already returned payment binding', async () => {
  const h = harness(terminal.resource); h.sync.start(); await flush(); await h.respond(terminal);
  const bindingPromise = h.sync.revalidateBeforePayment(); await flush();
  assert.equal(h.requests.length, 2); await h.respond(terminal);
  const binding = await bindingPromise;
  assert.deepEqual(binding, { orderId: terminal.order.id, orderRevision: terminal.order.revision });
  const empty = { ...idle, revision: 14 };
  h.sync.refresh(); await flush(); await h.respond(empty);
  h.sync.refresh(); await flush(); await h.respond({ ...terminal, revision: 15, order: confirmed.order });
  assert.equal(binding.orderId, terminal.order.id);
  assert.equal(h.sync.view().snapshot.order.id, confirmed.order.id);
  assert.ok(Object.isFrozen(binding)); h.sync.dispose();
});

test('payment preflight does not rely on a previously started read', async () => {
  const h = harness(); h.sync.start(cached); await flush();
  const binding = h.sync.revalidateBeforePayment();
  await h.respond(confirmed, 0);
  assert.equal(h.requests.length, 2);
  await h.respond(paid, 1);
  assert.equal(await binding, null); h.sync.dispose();
});

for (const held of ['existing poll', 'started preflight read']) test(`preflight awaiting ${held} returns null across immediate pause/resume, without borrowing fresh authority`, async t => {
  const h = harness(); t.after(() => h.sync.dispose());
  const start = h.sync.start(cached); await flush(); await h.respond(confirmed); await start;
  if (held === 'existing poll') await h.advance(5000);
  const binding = h.sync.revalidateBeforePayment(); await flush();
  assert.equal(h.requests.length, 2);
  assert.equal(h.sync.view().canInitiate, true);
  let result = 'unsettled';
  const settled = binding.then(value => { result = value; });

  // Resume synchronously, before the cancelled flight's await continuation runs.
  const pause = h.sync.setActive(false);
  const resume = h.sync.setActive(true); await flush();
  assert.equal(await pause, false);
  assert.equal(h.requests[1].signal.aborted, true);
  assert.equal(h.requests.length, 3);
  assert.equal(result, null);
  assert.equal(h.sync.view().canInitiate, false);

  await h.respond(confirmed, 2); assert.equal(await resume, true); await settled;
  assert.equal(await binding, null);
  assert.equal(h.sync.view().canInitiate, true);
  assert.equal(h.requests.length, 3, 'cancelled preflight must not queue a read behind resume');
  const count = h.views.length; await h.respond(confirmed, 1);
  assert.equal(h.views.length, count); assert.equal(h.requests.length, 3);

  const explicit = h.sync.revalidateBeforePayment(); await flush();
  assert.equal(h.requests.length, 4);
  await h.respond(confirmed, 3);
  assert.deepEqual(await explicit, { orderId: confirmed.order.id, orderRevision: confirmed.order.revision });
});

test('dispose cancels timers and outstanding reads without cross-page updates', async () => {
  const h = harness(); h.sync.start(cached); await flush(); h.sync.dispose();
  assert.equal(h.timers.size, 0);
  assert.equal(h.requests[0].signal.aborted, true);
  const count = h.views.length; await h.respond(confirmed);
  assert.equal(h.views.length, count);
  assert.equal(h.sync.view().snapshot, null);
});

test('repeated authoritative observations renew freshness without business mutation', async () => {
  const h = harness(); h.sync.start(); await flush(); await h.respond(confirmed);
  await h.advance(5000); await h.respond(confirmed);
  h.jump(11000);
  assert.equal(h.sync.view().transport, 'live'); h.sync.dispose();
});

test('preparing with known positive amount remains blocked', async () => {
  const h = harness(); h.sync.start(); await flush();
  await h.respond({ ...confirmed, state: 'preparing', canInitiate: false });
  assert.equal(h.sync.view().snapshot.order.amountMinor, 44400);
  assert.equal(h.sync.view().canInitiate, false); h.sync.dispose();
});

test('enum arrays cannot masquerade as strings', () => {
  for (const value of [{ ...confirmed, state: ['paid'], canInitiate: false },
    { ...confirmed, source: ['authoritative'] },
    { ...confirmed, resource: { ...confirmed.resource, kind: ['invoice'] } }]) assert.throws(() => decodeSnapshot(value));
});

test('terminal rollover during preflight requires renewed user confirmation', async () => {
  const h = harness(terminal.resource); h.sync.start(); await flush(); await h.respond(terminal);
  const binding = h.sync.revalidateBeforePayment(); await flush();
  await h.respond({ ...terminal, revision: 14, order: confirmed.order });
  assert.equal(await binding, null); h.sync.dispose();
});

test('higher terminal revision cannot hide regressing or contradictory order data', async () => {
  const h = harness(terminal.resource); h.sync.start(); await flush();
  await h.respond({ ...terminal, order: { ...terminal.order, revision: 2 } });
  h.sync.refresh(); await flush(); await h.respond({ ...terminal, revision: 14 });
  assert.equal(h.sync.view().transport, 'error');
  h.sync.refresh(); await flush();
  await h.respond({ ...terminal, revision: 14, order: { ...terminal.order, revision: 2, amountMinor: 1 } });
  assert.equal(h.sync.view().transport, 'error'); h.sync.dispose();
});

test('clock regression cannot resurrect expired freshness', async () => {
  const h = harness(); h.sync.start(); await flush(); await h.respond(confirmed);
  h.jump(16000); assert.equal(h.sync.view().canInitiate, false);
  h.jump(-6000); assert.equal(h.sync.view().canInitiate, false); h.sync.dispose();
});

test('inactive start keeps cache non-authoritative for 60s; refresh, flags and preflight cannot activate', async t => {
  const h = harness(); t.after(() => h.sync.dispose());
  assert.equal(await h.sync.start(cached, false), false);
  assert.equal(h.sync.view().transport, 'stale'); assert.equal(h.sync.view().canInitiate, false);
  assert.equal(h.sync.view().snapshot.source, 'cache'); assert.equal(h.sync.view().snapshot.canInitiate, false);
  assert.equal(h.sync.view().snapshot.order.amountMinor, 44400);
  for (const value of [h.sync.view(), h.sync.view().snapshot, h.sync.view().snapshot.order]) assert.ok(Object.isFrozen(value));
  assert.equal(await h.sync.refresh(), false); assert.equal(await h.sync.revalidateBeforePayment(), null);
  h.sync.setOnline(false); h.sync.setVisible(false);
  h.sync.setOnline(true); h.sync.setVisible(true);
  await h.advance(60000);
  assert.equal(h.requests.length, 0); assert.equal(h.timers.size, 0);
  const activation = h.sync.setActive(true); await flush();
  assert.equal(h.requests.length, 1); assert.equal(h.sync.view().canInitiate, false);
  await h.respond(confirmed); assert.equal(await activation, true);
  assert.equal(h.sync.view().transport, 'live'); assert.equal(h.sync.view().canInitiate, true);
  await h.advance(5000); assert.equal(h.requests.length, 2);
  await h.respond(confirmed);
});

test('inactive serialized paid authority is downgraded until an explicit authoritative read', async t => {
  const h = harness(); t.after(() => h.sync.dispose());
  await h.sync.start(paid, false);
  assert.equal(h.sync.view().snapshot.state, 'paid'); assert.equal(h.sync.view().snapshot.source, 'cache');
  assert.equal(h.sync.view().transport, 'stale'); assert.equal(h.sync.view().canInitiate, false);
  await h.advance(60000); assert.equal(h.requests.length, 0);
  const activation = h.sync.setActive(true); await flush();
  assert.equal(h.sync.view().transport, 'stale');
  await h.respond(paid); assert.equal(await activation, true);
  assert.equal(h.sync.view().snapshot.source, 'authoritative'); assert.equal(h.sync.view().transport, 'live');
  assert.equal(h.sync.view().canInitiate, false);
});

test('inactive notifications preserve watermark without reads; resume requests the latest revision', async t => {
  const h = harness(); t.after(() => h.sync.dispose()); await h.sync.start(cached, false);
  const change = { ...fixtures[1], revision: 9 };
  h.sync.notify(change); h.sync.notify(change); h.sync.notify({ ...change, revision: 8 });
  assert.equal(h.sync.view().watermark, 9);
  await h.advance(60000); assert.equal(h.requests.length, 0); assert.equal(h.timers.size, 0);
  const activation = h.sync.setActive(true); await flush();
  assert.equal(h.requests.length, 1); assert.equal(h.requests[0].minimumRevision, 9);
  await h.respond({ ...paid, revision: 9, order: { ...paid.order, revision: 9 } });
  assert.equal(await activation, true); assert.equal(h.sync.view().transport, 'live');
  assert.equal(h.sync.view().snapshot.revision, 9);
});

test('pausing live sync invalidates authority and cancels timers; resume revalidates before payment', async t => {
  const h = harness(); t.after(() => h.sync.dispose());
  const start = h.sync.start(); await flush(); await h.respond(confirmed); await start;
  assert.equal(h.sync.view().canInitiate, true);
  assert.equal(await h.sync.setActive(false), false);
  assert.equal(h.sync.view().transport, 'stale'); assert.equal(h.sync.view().canInitiate, false);
  assert.equal(h.timers.size, 0);
  assert.equal(await h.sync.refresh(), false); assert.equal(await h.sync.revalidateBeforePayment(), null);
  h.sync.setVisible(false); h.sync.setVisible(true); h.sync.setOnline(false); h.sync.setOnline(true);
  await h.advance(60000); assert.equal(h.requests.length, 1);
  const resume = h.sync.setActive(true); await flush();
  assert.equal(h.requests.length, 2); assert.equal(h.sync.view().canInitiate, false);
  await h.respond(confirmed); assert.equal(await resume, true); assert.equal(h.sync.view().canInitiate, true);
  await h.advance(5000); assert.equal(h.requests.length, 3); await h.respond(confirmed);
});

test('pause during activation aborts flight, clears queued refresh and fences late response after resume', async t => {
  const h = harness(); t.after(() => h.sync.dispose()); await h.sync.start(cached, false);
  const activation = h.sync.setActive(true); await flush();
  const queued = h.sync.refresh(); assert.equal(h.requests.length, 1);
  await h.sync.setActive(false);
  assert.equal(await activation, false); assert.equal(await queued, false);
  assert.equal(h.requests[0].signal.aborted, true); assert.equal(h.timers.size, 0);
  await h.advance(60000); assert.equal(h.requests.length, 1);
  const resume = h.sync.setActive(true); await flush();
  assert.equal(h.requests.length, 2);
  const count = h.views.length; await h.respond(paid, 0);
  assert.equal(h.views.length, count); assert.equal(h.sync.view().snapshot.state, 'payable');
  assert.equal(h.sync.view().canInitiate, false);
  await h.respond(confirmed, 1); assert.equal(await resume, true);
  assert.equal(h.requests.length, 2); assert.equal(h.sync.view().canInitiate, true);
});

test('explicit resume still respects offline and hidden flags', async t => {
  const h = harness(); t.after(() => h.sync.dispose());
  h.sync.setOnline(false); h.sync.setVisible(false); await h.sync.start(cached, false);
  assert.equal(await h.sync.setActive(true), false); assert.equal(h.requests.length, 0);
  h.sync.setOnline(true); await flush(); assert.equal(h.requests.length, 0);
  h.sync.setVisible(true); await flush(); assert.equal(h.requests.length, 1);
  await h.respond(confirmed); assert.equal(h.sync.view().canInitiate, true);
});