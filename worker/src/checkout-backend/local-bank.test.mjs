import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { createLocalBank, rawRequest } from './local-bank.mjs';

const origin = 'http://127.0.0.1:18792';
const path = '/__local/bank/webhook';
const attemptId = '40000000-0000-4000-8000-000000000005';
const resourceId = '40000000-0000-4000-8000-000000000004';
const key = randomBytes(32);
const context = { token: 'a'.repeat(43), hash: 'b'.repeat(64), resource: { kind: 'terminal', id: resourceId } };
const event = { eventId: `local-${attemptId}`, attemptId, amountMinor: 12345, currency: 'UAH',
  iban: 'UA' + '1'.repeat(27), reference: `local-${attemptId}`, occurredAt: '2026-09-08 12:00:00.123456+00' };
function signed(body = JSON.stringify(event), stamp = Date.now(), route = path) {
  const signature = createHmac('sha256', key).update(`POST\n${route}\n${stamp}\n${body}`).digest('hex');
  return new Request(origin + path, { method: 'POST', headers: { 'Content-Type': 'application/json',
    'X-Settlement-Timestamp': String(stamp), 'X-Settlement-Signature': signature }, body });
}
function fixture(options = {}) {
  const calls = []; const ledger = new Map();
  const attempt = { id: attemptId, token_hash: context.hash,
    request: { kind: 'terminal', resourceId, orderId: attemptId, orderRevision: 1 },
    quote: { orderId: attemptId, amountMinor: 12345, currency: 'UAH', recipient: { iban: event.iban } } };
  const state = { access: 'snapshot', result: null, error: null, attempt };
  const pool = { async query(sql, values) {
    calls.push({ sql, values });
    if (state.error) throw state.error;
    if (sql.includes('checkout_record_settlement')) {
      if (state.result) return { rows: [{ value: state.result }] };
      const id = values[1]; const payload = JSON.stringify(values);
      if (ledger.has(id) && ledger.get(id) !== payload) throw Object.assign(new Error('checkout_settlement_identity_conflict'), { code: 'P0001' });
      const replayed = ledger.has(id); ledger.set(id, payload);
      return { rows: [{ value: { outcome: 'paid', replayed } }] };
    }
    if (sql.includes('clock_timestamp')) return { rows: [{ occurred_at: event.occurredAt }] };
    return { rows: state.attempt ? [state.attempt] : [] };
  } };
  const reads = [];
  const db = { async read(input) { reads.push(input); return { kind: state.access }; } };
  const bank = createLocalBank({ pool, contexts: [context], db, key, origin, enabled: true, ...options });
  return { bank, calls, reads, state, ledger };
}
function delivery(body = { attemptId }, headers = {}) {
  return new Request(origin + '/__local/bank/deliver', { method: 'POST', headers: {
    'Content-Type': 'application/json', Authorization: `Bearer ${context.token}`, ...headers
  }, body: typeof body === 'string' ? body : JSON.stringify(body) });
}

test('signed ingress fixes provider, preserves PG precision, returns strict outcome and replay', async () => {
  const f = fixture();
  assert.deepEqual(await (await f.bank.handle(signed())).json(), { outcome: 'paid', replayed: false });
  assert.deepEqual(await (await f.bank.handle(signed())).json(), { outcome: 'paid', replayed: true });
  assert.equal(f.calls[0].values[0], 'local-bank');
  assert.equal(f.calls[0].values[7], event.occurredAt);
  assert.equal(f.ledger.size, 1);
  const conflict = await f.bank.handle(signed(JSON.stringify({ ...event, reference: 'changed' })));
  assert.equal(conflict.status, 409);
  assert.deepEqual(await conflict.json(), { error: 'settlement_rejected' });
});

test('tampering, wrong path, expired signatures and oversized ingress never reach SQL', async () => {
  const f = fixture();
  const valid = signed();
  const tampered = new Request(valid.url, { method: 'POST', headers: valid.headers, body: JSON.stringify(event) + ' ' });
  for (const req of [tampered, signed(undefined, Date.now(), '/other'), signed(undefined, Date.now() - 300001)]) {
    assert.equal((await f.bank.handle(req)).status, 401);
  }
  assert.equal((await f.bank.handle(signed('x'.repeat(4097)))).status, 413);
  assert.equal((await f.bank.handle(signed('{'))).status, 400);
  assert.equal((await f.bank.handle(signed(JSON.stringify({ ...event, provider: 'override' })))).status, 400);
  assert.equal(f.calls.length, 0);
});

test('disabled routes, methods, content types and queries fail closed', async () => {
  const f = fixture({ enabled: false });
  for (const req of [signed(), delivery()]) assert.equal((await f.bank.handle(req)).status, 403);
  assert.equal(f.calls.length, 0);
  const enabled = fixture().bank;
  assert.equal((await enabled.handle(new Request(origin + path))).status, 405);
  assert.equal((await enabled.handle(new Request(origin + path + '?destination=x', { method: 'POST' }))).status, 400);
  assert.equal((await enabled.handle(delivery({}, { 'Content-Type': 'text/plain' }))).status, 400);
  for (const invalid of ['https://127.0.0.1', 'http://localhost', 'http://example.com', 'http://127.0.0.1/other', 'http://user@127.0.0.1']) {
    assert.throws(() => fixture({ origin: invalid }), /literal_loopback/);
  }
});

test('deliver requires exact body, capability, current DB access and original stored resource scope', async () => {
  const f = fixture();
  assert.equal((await f.bank.handle(delivery({ attemptId }, { Authorization: '' }))).status, 403);
  for (const body of [{ attemptId, amountMinor: 1 }, { attemptId, destination: 'http://example.com' }, [], {}, { attemptId: 'bad' }, '{']) {
    assert.equal((await f.bank.handle(delivery(body))).status, 400);
  }
  assert.equal((await f.bank.handle(delivery('x'.repeat(4097)))).status, 413);
  assert.equal(f.calls.length, 0);
  f.state.access = 'inaccessible';
  assert.equal((await f.bank.handle(delivery())).status, 403);
  assert.equal(f.calls.length, 0);
  f.state.access = 'snapshot';
  for (const change of [
    { token_hash: 'c'.repeat(64) },
    { request: { kind: 'invoice', resourceId } },
    { request: { kind: 'terminal', resourceId: attemptId } }
  ]) {
    f.state.attempt = { ...f.state.attempt, token_hash: context.hash,
      request: { kind: 'terminal', resourceId }, ...change };
    assert.equal((await f.bank.handle(delivery())).status, 403);
  }
  f.state.attempt = null;
  assert.equal((await f.bank.handle(delivery())).status, 403);
  assert.deepEqual(f.reads[0], { p_kind: 'terminal', p_id: resourceId, p_token_hash: context.hash, p_minimum_revision: 0 });
  assert.ok(f.calls.every(c => !c.sql.includes('clock_timestamp') && !c.sql.includes('checkout_record_settlement')));
});

test('malformed RPC responses and unexpected SQL errors never leak details', async () => {
  const f = fixture();
  for (const result of [{ outcome: 'paid', replayed: 'false' }, { outcome: 'paid', replayed: false, secret: key.toString('hex') }, { outcome: 'unknown', replayed: false }]) {
    f.state.result = result;
    const res = await f.bank.handle(signed());
    assert.equal(res.status, 503);
    assert.deepEqual(await res.json(), { error: 'checkout_unavailable' });
  }
  f.state.result = { outcome: 'review', replayed: false };
  assert.deepEqual(await (await f.bank.handle(signed())).json(), f.state.result);
  f.state.error = new Error('password=do-not-leak');
  assert.deepEqual(await (await f.bank.handle(signed())).json(), { error: 'checkout_unavailable' });
});

test('real ephemeral loopback HTTP delivery, concurrent retry, response loss and reauthorization', async t => {
  let bank; let loseResponse = true;
  const received = [];
  const server = createServer(async (req, res) => {
    try {
      const request = rawRequest(req, `http://${req.headers.host}${req.url}`);
      received.push({ body: await request.clone().text(), stamp: req.headers['x-settlement-timestamp'],
        signature: req.headers['x-settlement-signature'], path: req.url });
      const result = await bank.handle(request);
      if (loseResponse) { loseResponse = false; res.destroy(); return; }
      res.writeHead(result.status, Object.fromEntries(result.headers)); res.end(await result.text());
    } catch { res.writeHead(500); res.end(); }
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
  const localOrigin = `http://127.0.0.1:${server.address().port}`;
  const f = fixture({ origin: localOrigin }); bank = f.bank;
  const send = () => {
    const req = delivery();
    return bank.handle(new Request(localOrigin + '/__local/bank/deliver', req));
  };
  assert.equal((await send()).status, 502);
  const replies = await Promise.all([send(), send()]);
  for (const reply of replies) assert.deepEqual(await reply.json(), { synthetic: true, outcome: 'paid', replayed: true });
  assert.equal(received.length, 3);
  assert.equal(new Set(received.map(r => r.body)).size, 1);
  assert.equal(new Set(received.map(r => r.stamp)).size, 3);
  assert.equal(new Set(received.map(r => r.signature)).size, 3);
  assert.ok(received.every(r => r.path === path));
  assert.deepEqual(JSON.parse(received[0].body), event);
  assert.equal(f.calls.filter(c => c.sql.includes('clock_timestamp')).length, 1);
  assert.equal(f.ledger.size, 1);
  f.state.access = 'inaccessible';
  assert.equal((await send()).status, 403);
  assert.equal(received.length, 3);
});

test('server integration keeps bootstrap gate, explicit opt-in, session array and paid amount guard', async () => {
  const source = await readFile(new URL('./local-server.mjs', import.meta.url), 'utf8');
  assert.match(source, /CHECKOUT_LOCAL_BANK_SIMULATOR === '1'/);
  assert.match(source, /pathname==='\/__local\/bank\/deliver' && !bootstrapValid\(req\)/);
  assert.match(source, /bank\.handle\(rawRequest\(req,url\)\)/);
  assert.match(source, /contexts\.map\(\(\{resource,token\}\)=>\(\{resource,token\}\)\)/);
  assert.match(source, /checkout_revision=\$2 and status in \('pending','ready'\)/);
  assert.match(source, /localDatabaseUrl\(process\.env\.CHECKOUT_TEST_DATABASE_URL\)/);
});