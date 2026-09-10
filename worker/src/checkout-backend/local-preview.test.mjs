import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { createLocalPreview } from './local-preview.mjs';
import { decodeSnapshot } from '../../../apps/pay/src/lib/services/checkout-contract.ts';

const id = '40000000-0000-4000-8000-000000000005';
const other = '40000000-0000-4000-8000-000000000006';
const token = 'a'.repeat(43);
const context = { resource: { kind: 'invoice', id }, token,
  hash: createHash('sha256').update(token).digest('hex') };
const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
const url = 'http://127.0.0.1:8792/__local/preview';
const request = (options = {}) => new Request(options.url ?? url, {
  method: options.method ?? 'POST', headers: options.headers ?? headers,
  ...(!['GET', 'HEAD'].includes(options.method) ? { body: options.body ?? '{}' } : {})
});
const snapshot = (resourceId = id, revision = 1) => ({ documentType: 'snapshot', schemaVersion: 1,
  resource: { kind: 'invoice', id: resourceId }, revision, source: 'authoritative',
  observedAt: '2026-09-08T12:00:00Z', state: 'payable',
  order: { id: resourceId, revision, amountMinor: 12345, currency: 'UAH', expiresAt: null }, canInitiate: true });

function setup(extraContexts = []) {
  const state = { time: 0, queries: [], reads: [], revoked: false, expired: false,
    deleted: false, exists: true, value: snapshot() };
  const pool = { async query(sql, params) {
    state.queries.push({ sql, params });
    if (state.sqlError) throw new Error('secret database details');
    return state.access ?? { rows: [{ authorized: !state.revoked && !state.expired && !state.deleted && state.exists }] };
  } };
  const db = { async read(params) {
    state.reads.push(params);
    if (state.readError) throw new Error('secret authority details');
    return state.result ?? { kind: 'snapshot', value: state.value };
  } };
  const preview = createLocalPreview({ pool, db, contexts: [context, ...extraContexts], now: () => state.time });
  return { state, preview };
}
async function expectFailure(preview, req, status, error) {
  const res = await preview.handle(req);
  assert.equal(res.status, status);
  assert.deepEqual(await res.json(), { error });
  assert.match(res.headers.get('Cache-Control'), /no-store/);
  assert.match(res.headers.get('Cache-Control'), /private/);
  assert.equal(res.headers.get('Vary'), 'Authorization');
}

test('miss/hit: current SQL every request, one read, immutable decoder-valid preview with real amount', async () => {
  const { state, preview } = setup();
  assert.equal(state.queries.length, 0); // construction starts no background work
  const first = await preview.handle(request());
  assert.equal(first.status, 200);
  const value = decodeSnapshot(await first.json());
  assert.deepEqual(value, { ...snapshot(), source: 'cache', canInitiate: false });
  assert.ok(Object.isFrozen(value) && Object.isFrozen(value.resource) && Object.isFrozen(value.order));
  state.value.order.amountMinor = 99999;
  state.value.resource.id = other;
  const hit = await preview.handle(request());
  assert.deepEqual(await hit.json(), value);
  assert.equal(state.queries.length, 2);
  assert.deepEqual(state.reads, [{ p_kind: 'invoice', p_id: id, p_token_hash: context.hash, p_minimum_revision: 0 }]);
  assert.deepEqual(state.queries[0].params, [context.hash, id]);
  const sql = state.queries[0].sql;
  for (const pattern of [/checkout_private\.capabilities/, /c\.token_hash=\$1/, /c\.kind='invoice'/,
    /c\.resource_id=\$2/, /c\.revoked_at is null/, /c\.expires_at>clock_timestamp\(\)/,
    /r\.kind=c\.kind and r\.id=c\.resource_id/, /public\.orders o on o\.id=r\.id/, /not r\.deleted/]) assert.match(sql, pattern);
  assert.ok(!sql.includes(token) && !sql.includes(context.hash));
  for (const res of [first, hit]) {
    assert.equal(res.headers.get('Vary'), 'Authorization');
    assert.match(res.headers.get('Cache-Control'), /no-store, private/);
    assert.equal(res.headers.get('CDN-Cache-Control'), 'no-store');
    assert.equal(res.headers.get('Cloudflare-CDN-Cache-Control'), 'no-store');
  }
});

for (const [name, property, value] of [['revocation', 'revoked', true], ['expiry', 'expired', true],
  ['tombstone', 'deleted', true], ['missing order', 'exists', false]]) {
  test(`cache hit still denies CURRENT ${name}`, async () => {
    const { state, preview } = setup();
    assert.equal((await preview.handle(request())).status, 200);
    state[property] = value;
    await expectFailure(preview, request(), 403, 'inaccessible');
    assert.equal(state.queries.length, 2);
    assert.equal(state.reads.length, 1);
  });
}

test('TTL is 30 seconds, not sliding; stale paid is only preview; refresh replaces revision', async () => {
  const { state, preview } = setup();
  state.value = { ...snapshot(), state: 'paid', canInitiate: false };
  await preview.handle(request());
  state.value = snapshot(id, 2);
  state.value.order.amountMinor = 76543;
  state.time = 29999;
  const stale = await (await preview.handle(request())).json();
  assert.equal(stale.state, 'paid');
  assert.equal(stale.source, 'cache');
  assert.equal(stale.canInitiate, false);
  assert.equal(state.reads.length, 1);
  state.time = 30000;
  const refreshed = await (await preview.handle(request())).json();
  assert.equal(refreshed.revision, 2);
  assert.equal(refreshed.order.amountMinor, 76543);
  assert.equal(refreshed.canInitiate, false);
  assert.equal(state.reads.length, 2);
  assert.equal(state.queries.length, 3);
});

test('one-entry bound prevents cross-invoice reuse and evicts previous identity', async () => {
  const second = { resource: { kind: 'invoice', id: other }, token: 'b'.repeat(43), hash: 'b'.repeat(64) };
  const { state, preview } = setup([second]);
  await preview.handle(request());
  state.value = snapshot(other);
  const res = await preview.handle(request({ headers: { ...headers, Authorization: `Bearer ${second.token}` } }));
  assert.equal((await res.json()).resource.id, other);
  state.value = snapshot();
  await preview.handle(request());
  assert.equal(state.reads.length, 3);
});

test('malformed method, path, query, header and body rejected before SQL/read', async () => {
  const { state, preview } = setup();
  for (const method of ['GET', 'HEAD', 'PUT', 'DELETE', 'OPTIONS']) {
    await expectFailure(preview, request({ method }), 405, 'method_not_allowed');
  }
  for (const suffix of ['/', '/extra']) await expectFailure(preview, request({ url: url + suffix }), 404, 'not_found');
  for (const suffix of ['?', '?x=1', '?token=secret', '#fragment']) {
    await expectFailure(preview, request({ url: url + suffix }), 400, 'invalid_request');
  }
  for (const type of ['', 'text/plain', 'application/jsonbad', 'application/json, application/json',
    'application/json; charset=latin1', 'application/json; nope']) {
    await expectFailure(preview, request({ headers: { ...headers, 'Content-Type': type } }), 400, 'invalid_request');
  }
  await expectFailure(preview, request({ headers: { Authorization: headers.Authorization } }), 400, 'invalid_request');
  await expectFailure(preview, request({ headers: { ...headers, 'Content-Encoding': 'gzip' } }), 400, 'invalid_request');
  for (const body of ['', 'null', '[]', 'true', '0', '""', '{', '{"id":"x"}', '{"__proto__":{}}']) {
    await expectFailure(preview, request({ body }), 400, 'invalid_request');
  }
  await expectFailure(preview, request({ body: new Uint8Array([123, 255, 125]) }), 400, 'invalid_request');
  await expectFailure(preview, request({ body: '{}'.padEnd(2049) }), 413, 'too_large');
  assert.equal(state.queries.length, 0);
  assert.equal(state.reads.length, 0);
});

test('2048 byte boundary and UTF-8 application/json accepted; overflow stream cancelled', async () => {
  const { preview } = setup();
  assert.equal((await preview.handle(request({ body: '{}'.padEnd(2048),
    headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8' } }))).status, 200);
  let cancelled = false;
  const stream = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(2049)); },
    cancel() { cancelled = true; } });
  await expectFailure(preview, new Request(url, { method: 'POST', headers, body: stream, duplex: 'half' }), 413, 'too_large');
  assert.equal(cancelled, true);
});

test('strict bearer and invoice-only context scope; client cannot choose identity', async () => {
  const terminal = { resource: { kind: 'terminal', id: other }, token: 't'.repeat(43), hash: 'c'.repeat(64) };
  const { state, preview } = setup([terminal]);
  for (const Authorization of ['', token, `bearer ${token}`, `Bearer  ${token}`, `Bearer ${token}, Bearer ${token}`,
    `Bearer ${'a'.repeat(42)}`, `Bearer ${'a'.repeat(129)}`, `Bearer ${token}=`,
    `Bearer ${'z'.repeat(43)}`, `Bearer ${terminal.token}`]) {
    await expectFailure(preview, request({ headers: { ...headers, Authorization } }), 403, 'inaccessible');
  }
  await expectFailure(preview, request({ headers: { 'Content-Type': 'application/json' } }), 403, 'inaccessible');
  await expectFailure(preview, request({ body: JSON.stringify({ resource: { kind: 'invoice', id: other } }) }), 400, 'invalid_request');
  assert.equal(state.queries.length, 0);
  assert.equal(state.reads.length, 0);
});

test('invalid authoritative results sanitized and never cached', async () => {
  const invalid = [null, {}, { kind: 'lag' }, { kind: 'inaccessible', secret: 'leak' },
    { kind: 'snapshot', value: snapshot(), secret: 'leak' },
    ...[v => { v.source = 'cache'; v.canInitiate = false; }, v => { v.resource.id = other; },
      v => { v.resource.kind = 'terminal'; }, v => { v.order.amountMinor = -1; },
      v => { delete v.order.amountMinor; }, v => { v.order.amountMinor = 1.5; },
      v => { v.order.currency = 'USD'; }, v => { v.revision = 0; v.order.revision = 0; },
      v => { v.order.revision = 2; }, v => { v.observedAt = 'bad'; },
      v => { v.secret = 'leak'; }, v => { v.order.secret = 'leak'; }].map(mutate => {
        const value = snapshot(); mutate(value); return { kind: 'snapshot', value };
      })];
  for (const result of invalid) {
    const { state, preview } = setup();
    // null is intentionally supplied through the snapshot value to bypass mock fallback.
    state.result = result === null ? { kind: 'snapshot', value: null } : result;
    await expectFailure(preview, request(), 503, 'checkout_unavailable');
    delete state.result;
    assert.equal((await preview.handle(request())).status, 200);
    assert.equal(state.reads.length, 2);
  }
});

test('malformed current SQL decisions fail closed, including warm cache', async () => {
  for (const access of [{}, { rows: [] }, { rows: [{ authorized: 'true' }] },
    { rows: [{ authorized: 1 }] }, { rows: [{ authorized: true, secret: 'leak' }] },
    { rows: [{ authorized: true }, { authorized: true }] }]) {
    const { state, preview } = setup();
    await preview.handle(request());
    state.access = access;
    await expectFailure(preview, request(), 503, 'checkout_unavailable');
    assert.equal(state.reads.length, 1);
  }
});

test('read-time revocation, SQL/read failures and expired cache never fall back to stale authority', async () => {
  const { state, preview } = setup();
  state.result = { kind: 'inaccessible' };
  await expectFailure(preview, request(), 403, 'inaccessible');
  delete state.result;
  state.readError = true;
  await expectFailure(preview, request(), 503, 'checkout_unavailable');
  state.readError = false;
  await preview.handle(request());
  state.sqlError = true;
  await expectFailure(preview, request(), 503, 'checkout_unavailable');
  state.sqlError = false;
  state.time = 30000;
  state.readError = true;
  await expectFailure(preview, request(), 503, 'checkout_unavailable');
  state.readError = false;
  assert.equal((await preview.handle(request())).status, 200);
  assert.equal(state.reads.length, 5);
});

test('clock rollback evicts rather than extending cache lifetime', async () => {
  const { state, preview } = setup();
  state.time = 100;
  await preview.handle(request());
  state.time = 99;
  await preview.handle(request());
  assert.equal(state.reads.length, 2);
});

test('local-server actual route enforces exact bootstrap before preview and before /api', async () => {
  // Execute only the existing host functions with mocked dependencies: no PG,
  // Vite startup, listening socket, fixture provisioning or secret output.
  const source = await readFile(new URL('./local-server.mjs', import.meta.url), 'utf8');
  const start = source.indexOf('function reply(');
  const end = source.indexOf('// Deliberately prints', start);
  assert.ok(start > 0 && end > start);
  assert.ok(source.indexOf("if(url.pathname==='/__local/preview')") < source.indexOf("if(url.pathname.startsWith('/api/'))"));
  const bootstrap = 's'.repeat(43);
  let route;
  let calls = 0;
  const { timingSafeEqual } = await import('node:crypto');
  runInNewContext(source.slice(start, end), { Buffer, URL, bootstrap, timingSafeEqual,
    origin: 'http://127.0.0.1:8792', server: { on(_event, handler) { route = handler; } },
    rawRequest(req, target) { return new Request(target, { method: req.method, headers: req.headers, body: '{}' }); },
    preview: { async handle(req) { calls++; assert.equal(req.url, url); return Response.json({ preview: true }); } }
  });
  for (const supplied of [undefined, '', bootstrap.slice(1), `${bootstrap} `, 'x'.repeat(43), [bootstrap, bootstrap]]) {
    const res = mockResponse();
    await route({ url: '/__local/preview', method: 'POST', headers: {
      host: '127.0.0.1:8792', 'x-local-bootstrap': supplied } }, res);
    assert.equal(res.status, 403);
    assert.equal(calls, 0);
    assert.equal(res.headers.vary, 'Authorization');
    assert.match(res.headers['cache-control'], /no-store/);
  }
  const res = mockResponse();
  await route({ url: '/__local/preview', method: 'POST', headers: {
    host: '127.0.0.1:8792', 'x-local-bootstrap': bootstrap } }, res);
  assert.equal(res.status, 200);
  assert.equal(calls, 1);
});

function mockResponse() {
  return { headers: {}, setHeader(key, value) { this.headers[key.toLowerCase()] = value; },
    writeHead(status, values) { this.status = status; for (const [key, value] of Object.entries(values)) this.setHeader(key, value); },
    end(body) { this.body = body; } };
}