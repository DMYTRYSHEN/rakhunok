import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import pg from 'pg';
import { handle } from './index.ts';
import { createLocalBank, rawRequest } from './local-bank.mjs';
import { fixture, localDatabaseUrl, provision } from './local-fixture.mjs';
import { retryTransaction } from './retry.ts';

// Opt-in, NEW disposable literal-loopback database only. No local-server import,
// fixed HTTP port, remote transport, exported signing key or mocked persistence.
const connectionString = process.env.CHECKOUT_TEST_DATABASE_URL;
const skip = !connectionString
  ? 'Set CHECKOUT_TEST_DATABASE_URL to a fresh disposable local PostgreSQL database'
  : false;

test('local bank HTTP + PostgreSQL: paid authority, replay, review and tampering', { skip }, async t => {
  const pool = new pg.Pool({
    connectionString: localDatabaseUrl(connectionString),
    max: 5, connectionTimeoutMillis: 3000, statement_timeout: 5000, lock_timeout: 2000
  });
  let server;
  t.after(async () => {
    try {
      if (server?.listening) {
        await new Promise((resolve, reject) => {
          server.close(error => error ? reject(error) : resolve());
          server.closeAllConnections();
        });
      }
    } finally {
      await pool.end();
    }
  });

  const contexts = await provision(pool);
  const invoice = contexts.find(c => c.resource.kind === 'invoice');
  const terminal = contexts.find(c => c.resource.kind === 'terminal');
  assert.ok(invoice && terminal);
  const rpc = (name, values) => retryTransaction(async () =>
    (await pool.query(
      `select public.${name}(${values.map((_, i) => `$${i + 1}`).join(',')}) as value`, values
    )).rows[0].value);
  const db = {
    read: p => rpc('checkout_read', [p.p_kind, p.p_id, p.p_token_hash, p.p_minimum_revision]),
    initiate: p => rpc('checkout_initiate', [p.p_kind, p.p_id, p.p_token_hash,
      p.p_order_id, p.p_order_revision, p.p_idempotency_key])
  };

  let bank;
  let origin;
  const webhooks = [];
  const serverErrors = [];
  server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, origin);
      const request = rawRequest(req, url);
      if (url.pathname === '/__local/bank/webhook') {
        webhooks.push({ body: await request.clone().text(), headers: new Headers(request.headers) });
      }
      const result = url.pathname.startsWith('/__local/bank/')
        ? await bank.handle(request) : await handle(request, db);
      res.writeHead(result.status, Object.fromEntries(result.headers));
      res.end(await result.text());
    } catch (error) {
      serverErrors.push(error);
      res.writeHead(500);
      res.end();
    }
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  origin = `http://127.0.0.1:${server.address().port}`;
  bank = createLocalBank({ pool, contexts, db, origin, enabled: true });

  async function http(path, options, status = 200) {
    const response = await fetch(new URL(path, origin), {
      ...options, redirect: 'error', signal: AbortSignal.timeout(10000)
    });
    const body = await response.text();
    assert.equal(response.status, status, body);
    return JSON.parse(body);
  }
  const headers = context => ({ Authorization: `Bearer ${context.token}`, 'Content-Type': 'application/json' });
  const route = context => `/api/checkout/v1/${context.resource.kind}/${context.resource.id}`;
  const snapshot = context => http(`${route(context)}/snapshot`, { headers: headers(context) });
  const deliver = (context, attemptId, status = 200) => http('/__local/bank/deliver', {
    method: 'POST', headers: headers(context), body: JSON.stringify({ attemptId })
  }, status);
  async function initiate(context, current, key) {
    const attempt = await http(`${route(context)}/attempts`, {
      method: 'POST', headers: { ...headers(context), 'Idempotency-Key': key },
      body: JSON.stringify({ orderId: current.order.id, orderRevision: current.order.revision })
    }, 201);
    assert.equal(attempt.kind, 'accepted');
    assert.equal(attempt.replayed, false);
    assert.equal(attempt.quote.orderId, current.order.id);
    assert.equal(attempt.quote.orderRevision, current.order.revision);
    assert.equal(attempt.quote.amountMinor, current.order.amountMinor);
    return attempt;
  }
  async function state() {
    // Full persisted rows detect rewrites as well as extra rows/revision changes.
    return (await pool.query(`select
      (select coalesce(jsonb_agg(to_jsonb(o) order by o.id),'[]'::jsonb) from public.orders o) as orders,
      (select coalesce(jsonb_agg(to_jsonb(r) order by r.kind,r.id),'[]'::jsonb) from checkout_private.resources r) as resources,
      (select coalesce(jsonb_agg(to_jsonb(e) order by e.id),'[]'::jsonb) from checkout_private.outbox e) as outbox,
      (select coalesce(jsonb_agg(to_jsonb(a) order by a.id),'[]'::jsonb) from checkout_private.attempts a) as attempts,
      (select coalesce(jsonb_agg(to_jsonb(s) order by s.provider,s.event_id),'[]'::jsonb) from checkout_private.settlements s) as settlements,
      (select coalesce(jsonb_agg(to_jsonb(c) order by c.token_hash),'[]'::jsonb) from checkout_private.capabilities c) as capabilities
    `)).rows[0];
  }
  function counts(value) {
    return Object.fromEntries(['orders', 'resources', 'outbox', 'attempts', 'settlements', 'capabilities']
      .map(name => [name, value[name].length]));
  }
  function ledger(value, attempt, outcome) {
    const rows = value.settlements.filter(s => s.attempt_id === attempt.attemptId);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].provider, 'local-bank');
    assert.equal(rows[0].event_id, `local-${attempt.attemptId}`);
    assert.equal(rows[0].outcome, outcome);
    assert.equal(rows[0].event.amountMinor, attempt.quote.amountMinor);
    assert.equal(rows[0].event.iban, attempt.quote.recipient.iban);
  }

  let paidAttempt;
  await t.test('HTTP attempt and signed delivery produce an authoritative paid snapshot', async () => {
    const before = await snapshot(invoice);
    assert.equal(before.source, 'authoritative');
    assert.equal(before.state, 'payable');
    assert.equal(before.canInitiate, true);
    assert.equal(before.order.amountMinor, 12345);
    assert.equal(before.revision, 1);
    assert.deepEqual(counts(await state()), {
      orders: 1, resources: 2, outbox: 3, attempts: 0, settlements: 0, capabilities: 2
    });
    paidAttempt = await initiate(invoice, before, 'http-suite-paid');
    const initiated = await state();
    assert.equal(initiated.attempts.length, 1);
    assert.equal(initiated.outbox.length, 3);
    assert.equal(initiated.orders[0].status, 'ready');
    assert.deepEqual(await deliver(invoice, paidAttempt.attemptId), {
      synthetic: true, outcome: 'paid', replayed: false
    });
    const paid = await snapshot(invoice);
    assert.equal(paid.source, 'authoritative');
    assert.equal(paid.state, 'paid');
    assert.equal(paid.canInitiate, false);
    assert.equal(paid.order.id, fixture.order);
    assert.equal(paid.order.amountMinor, 12345);
    assert.equal(paid.order.revision, before.order.revision + 1);
    assert.equal(paid.revision, before.revision + 1);
    const stored = await state();
    assert.deepEqual(counts(stored), {
      orders: 1, resources: 2, outbox: 5, attempts: 1, settlements: 1, capabilities: 2
    });
    assert.equal(stored.orders[0].status, 'paid');
    assert.equal(stored.orders[0].paid_amount, 123.45);
    assert.equal(stored.orders[0].payment_reference, `local-${paidAttempt.attemptId}`);
    ledger(stored, paidAttempt, 'paid');
    assert.equal(webhooks.length, 1, 'simulator must traverse the actual HTTP webhook');
  });

  await t.test('same event replay preserves every persisted row and emits no extra outbox events', async () => {
    assert.ok(paidAttempt);
    const before = await state();
    assert.deepEqual(await deliver(invoice, paidAttempt.attemptId), {
      synthetic: true, outcome: 'paid', replayed: true
    });
    assert.deepEqual(await state(), before);
    assert.equal(webhooks.length, 2);
    assert.equal(webhooks[1].body, webhooks[0].body, 'replay retains event bytes and PostgreSQL timestamp precision');
    assert.notEqual(webhooks[1].headers.get('x-settlement-signature'), webhooks[0].headers.get('x-settlement-signature'));
    assert.equal((await snapshot(invoice)).state, 'paid');
  });

  await t.test('fresh same-merchant terminal invoice changed before delivery enters immutable review', async () => {
    const orderId = '40000000-0000-4000-8000-000000000006';
    await pool.query(`insert into public.orders
      (id,merchant_id,entity_id,terminal_id,order_number,total_amount,status,expires_at)
      values($1,$2,$3,$4,'LOCAL-HTTP-REVIEW',123.45,'ready',null)`,
    [orderId, fixture.merchant, fixture.entity, fixture.terminal]);
    // Reuse the fixture's terminal capability, not the first invoice's scope.
    const current = await snapshot(terminal);
    assert.equal(current.source, 'authoritative');
    assert.equal(current.order.id, orderId);
    assert.equal(current.canInitiate, true);
    const attempt = await initiate(terminal, current, 'http-suite-review');
    const beforeWrongScope = await state();
    assert.deepEqual(await deliver(invoice, attempt.attemptId, 403), { error: 'inaccessible' });
    assert.deepEqual(await state(), beforeWrongScope);
    assert.equal(webhooks.length, 2);
    const updated = await pool.query(`update public.orders set total_amount=total_amount+1
      where id=$1 and checkout_revision=$2 and status='ready'`, [orderId, current.order.revision]);
    assert.equal(updated.rowCount, 1);
    const beforeDelivery = await state();
    assert.deepEqual(await deliver(terminal, attempt.attemptId), {
      synthetic: true, outcome: 'review', replayed: false
    });
    const reviewed = await state();
    assert.deepEqual({ ...reviewed, settlements: beforeDelivery.settlements }, beforeDelivery,
      'review only appends a settlement; it must not mutate financial state, attempts or outbox');
    assert.equal(reviewed.settlements.length, beforeDelivery.settlements.length + 1);
    ledger(reviewed, attempt, 'review');
    const actual = await snapshot(terminal);
    assert.equal(actual.source, 'authoritative');
    assert.equal(actual.state, 'payable');
    assert.equal(actual.order.id, orderId);
    assert.equal(actual.order.amountMinor, 12445);
    assert.equal(actual.order.revision, current.order.revision + 1);
    const order = reviewed.orders.find(o => o.id === orderId);
    assert.equal(order.status, 'ready');
    assert.equal(order.paid_amount, null);
    assert.equal(order.paid_at, null);
    assert.deepEqual(await deliver(terminal, attempt.attemptId), {
      synthetic: true, outcome: 'review', replayed: true
    });
    assert.deepEqual(await state(), reviewed);
    assert.equal(webhooks.length, 4);
    assert.equal(webhooks[2].body, webhooks[3].body);
    assert.deepEqual(counts(reviewed), {
      orders: 2, resources: 3, outbox: 9, attempts: 2, settlements: 2, capabilities: 2
    });
  });

  await t.test('tampered signed HTTP event returns 401 with no database writes', async () => {
    assert.ok(webhooks[0]);
    const before = await state();
    // Reuse observed signed bytes/headers; no simulator signing key is exposed.
    const captured = webhooks[0];
    const tamperedHeaders = new Headers({
      'Content-Type': 'application/json',
      'X-Settlement-Timestamp': captured.headers.get('x-settlement-timestamp'),
      'X-Settlement-Signature': captured.headers.get('x-settlement-signature')
    });
    assert.deepEqual(await http('/__local/bank/webhook', {
      method: 'POST', headers: tamperedHeaders, body: captured.body + ' '
    }, 401), { error: 'invalid_signature' });
    assert.deepEqual(await state(), before);
    assert.equal(webhooks.length, 5);
  });

  const final = await state();
  assert.deepEqual(counts(final), {
    orders: 2, resources: 3, outbox: 9, attempts: 2, settlements: 2, capabilities: 2
  });
  const outbox = (await pool.query(`select kind,revision::int as revision,count(*)::int as count
    from checkout_private.outbox group by kind,revision order by kind,revision`)).rows;
  assert.deepEqual(outbox, [
    { kind: 'invoice', revision: 1, count: 2 },
    { kind: 'invoice', revision: 2, count: 2 },
    ...[1, 2, 3, 4, 5].map(revision => ({ kind: 'terminal', revision, count: 1 }))
  ]);
  assert.deepEqual(serverErrors, []);
  t.diagnostic(JSON.stringify({ counts: counts(final),
    outcomes: final.settlements.map(s => s.outcome).sort(), webhookRequests: webhooks.length, outbox }));
});