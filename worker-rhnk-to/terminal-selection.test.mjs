import test from 'node:test';
import assert from 'node:assert/strict';
import worker, { selectTerminal } from './terminal-selection.js';

const env = { SUPABASE_URL: 'https://mwaeazabpvbxqfrceogr.supabase.co', SUPABASE_ANON_KEY: 'public-test-key' };
const terminalId = '943a81c5-d2f8-4ed9-a531-17434621989e';
const now = Date.parse('2026-10-05T08:44:00Z');
const active = { id: 'b4257f7b-b1de-4db2-8b40-8fbc5d3be266', status: 'preparing', total_amount: 66, currency: 'UAH', expires_at: '2026-10-05T09:35:25Z' };

test('filters expired and cancelled history before selecting the latest live order', async () => {
  const calls = [];
  const fetcher = async target => {
    calls.push(target);
    if (target.pathname.endsWith('/terminals')) return Response.json([{ id: terminalId, code: '57g66j', name: 'Cafe' }]);
    assert.equal(target.searchParams.get('status'), 'in.(pending,preparing)');
    assert.equal(target.searchParams.get('or'), '(expires_at.is.null,expires_at.gt.2026-10-05T08:44:00.000Z)');
    assert.equal(target.searchParams.get('terminal_id'), `eq.${terminalId}`);
    assert.equal(target.searchParams.get('order'), 'created_at.desc,id.desc');
    assert.equal(target.searchParams.get('limit'), '1');
    return Response.json([active]);
  };
  for (const prefix of ['', '/app']) {
    const response = await selectTerminal(new Request(`https://rhnk.to${prefix}/api/v1/checkout/terminal/57g66j`), env, fetcher, now);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    assert.deepEqual(await response.json(), { kind: 'active', terminal: { code: '57g66j', name: 'Cafe' }, order: active });
  }
});

test('does not reinterpret an expired or cancelled selected order as active', async () => {
  for (const order of [{ ...active, status: 'cancelled' }, { ...active, expires_at: '2026-10-05T08:00:00Z' }]) {
    const fetcher = async target => Response.json(target.pathname.endsWith('/terminals')
      ? [{ id: terminalId, code: '57g66j' }] : [order]);
    assert.equal((await selectTerminal(new Request('https://rhnk.to/api/v1/checkout/terminal/57g66j'), env, fetcher, now)).status, 503);
  }
});

test('preserves other hosts and routes and forbids mutations', async () => {
  const fetcher = () => { throw new Error('Unexpected I/O'); };
  assert.equal((await selectTerminal(new Request('https://letsrealtalk.com/api/v1/checkout/terminal/57g66j'), env, fetcher)).status, 404);
  assert.equal((await selectTerminal(new Request('https://rhnk.to/api/v1/checkout/order-id'), env, fetcher)).status, 404);
  assert.equal((await selectTerminal(new Request('https://rhnk.to/api/v1/checkout/terminal/57g66j', { method: 'POST' }), env, fetcher)).status, 405);
});

test('idle, missing terminal, null expiry and upstream errors remain explicit JSON', async () => {
  for (const [terminalRows, orderRows, status, kind] of [
    [[], [], 404, undefined],
    [[{ id: terminalId, code: '57g66j' }], [], 200, 'idle'],
    [[{ id: terminalId, code: '57g66j' }], [{ ...active, expires_at: null }], 200, 'active']
  ]) {
    const response = await selectTerminal(new Request('https://rhnk.to/api/v1/checkout/terminal/57g66j'), env,
      async target => Response.json(target.pathname.endsWith('/terminals') ? terminalRows : orderRows), now);
    assert.equal(response.status, status);
    assert.equal((await response.json()).kind, kind);
  }
  const unavailable = await selectTerminal(new Request('https://rhnk.to/api/v1/checkout/terminal/57g66j'), env,
    async () => new Response('unavailable', { status: 503 }), now);
  assert.equal(unavailable.status, 503);
  assert.match(unavailable.headers.get('Content-Type'), /application\/json/);
  const boundary = await worker.fetch(new Request('https://old.example/api/v1/checkout/terminal/57g66j'), env, { waitUntil() {} });
  assert.equal(boundary.status, 404);
});