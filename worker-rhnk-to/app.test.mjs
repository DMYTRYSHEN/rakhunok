import test from 'node:test';
import assert from 'node:assert/strict';
import { routeApp } from './app.js';

test('ready manual table creation preserves identity and confirms pending', async () => {
  const input = { type: 'table', status: 'pending', terminal_id: 'terminal', entity_id: 'entity', merchant_id: 'merchant', amount: 45 };
  const original = { ...input, id: 'invoice', status: 'preparing', total_amount: 45, expires_at: null };
  const calls = [];
  const env = { SUPABASE_URL: 'https://mwaeazabpvbxqfrceogr.supabase.co', SUPABASE_ANON_KEY: 'public', API: { async fetch(request) {
    calls.push(request);
    return Response.json({ order: original });
  } } };
  const fetcher = async request => {
    calls.push(request);
    const target = new URL(request.url);
    assert.equal(target.searchParams.get('status'), 'eq.preparing');
    assert.match(target.searchParams.get('or'), /expires_at.gt/);
    assert.equal(request.headers.get('Authorization'), 'Bearer owner');
    assert.deepEqual(await request.json(), { status: 'pending' });
    return Response.json([{ ...original, status: 'pending' }]);
  };
  const response = await routeApp(new Request('https://rhnk.to/app/api/v1/orders', {
    method: 'POST', headers: { Authorization: 'Bearer owner' }, body: JSON.stringify(input)
  }), env, fetcher);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).order.status, 'pending');
  assert.equal(calls.length, 2);
});

test('App cancellation is blocked and old hosts cannot enter this wrapper', async () => {
  const env = { API: { fetch() { throw new Error('Unexpected write'); } } };
  assert.equal((await routeApp(new Request('https://rhnk.to/app/api/v1/orders/id', {
    method: 'PATCH', body: JSON.stringify({ status: 'cancelled' })
  }), env)).status, 403);
  assert.equal((await routeApp(new Request('https://letsrealtalk.com/app/'), env)).status, 404);
});

test('zero amount remains preparing without readiness write', async () => {
  const env = { API: { fetch: async () => Response.json({ order: { type: 'table', terminal_id: 'terminal', total_amount: 0, status: 'preparing' } }) } };
  const response = await routeApp(new Request('https://rhnk.to/app/api/v1/orders', {
    method: 'POST', body: JSON.stringify({ type: 'table', status: 'pending', amount: 0, terminal_id: 'terminal' })
  }), env, () => { throw new Error('Unexpected write'); });
  assert.equal((await response.json()).order.status, 'preparing');
});

test('legacy manual creation without optional status confirms readiness', async () => {
  const input = { type: 'table', terminal_id: 'terminal', entity_id: 'entity', merchant_id: 'merchant', amount: 78 };
  const original = { ...input, id: 'invoice', status: 'preparing', total_amount: 78, expires_at: null };
  const env = { SUPABASE_URL: 'https://mwaeazabpvbxqfrceogr.supabase.co', SUPABASE_ANON_KEY: 'public',
    API: { fetch: async () => Response.json({ order: original }) } };
  const response = await routeApp(new Request('https://rhnk.to/app/api/v1/orders/', {
    method: 'POST', headers: { Authorization: 'Bearer owner' }, body: JSON.stringify(input)
  }), env, async request => {
    assert.deepEqual(await request.json(), { status: 'pending' });
    return Response.json([{ ...original, status: 'pending' }]);
  });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).order.status, 'pending');
});

test('persisted invoice determines readiness independently of client amount fields', async () => {
  const original = { id: 'invoice', type: 'table', status: 'preparing', merchant_id: 'merchant',
    entity_id: 'entity', terminal_id: 'terminal', total_amount: 78, expires_at: null };
  const env = { SUPABASE_URL: 'https://mwaeazabpvbxqfrceogr.supabase.co', SUPABASE_ANON_KEY: 'public',
    API: { fetch: async () => Response.json({ order: original }) } };
  const response = await routeApp(new Request('https://rhnk.to/app/api/v1/orders', {
    method: 'POST', headers: { Authorization: 'Bearer owner' }, body: JSON.stringify({ type: 'table', base_amount: 78 })
  }), env, async request => {
    assert.equal(new URL(request.url).searchParams.get('id'), 'eq.invoice');
    return Response.json([{ ...original, status: 'pending' }]);
  });
  assert.equal((await response.json()).order.status, 'pending');
});

test('failed, concurrent and mismatched readiness never report success', async () => {
  const input = { type: 'table', status: 'pending', terminal_id: 'terminal', entity_id: 'entity', merchant_id: 'merchant', amount: 45 };
  const original = { ...input, id: 'invoice', status: 'preparing', total_amount: 45, expires_at: null };
  const env = { SUPABASE_URL: 'https://mwaeazabpvbxqfrceogr.supabase.co', SUPABASE_ANON_KEY: 'public',
    API: { fetch: async () => Response.json({ order: original }) } };
  for (const fetcher of [
    async () => new Response(null, { status: 403 }),
    async () => Response.json([]),
    async () => Response.json([{ ...original, status: 'pending', total_amount: 99 }]),
    async () => { throw new Error('Network failure'); }
  ]) {
    const response = await routeApp(new Request('https://rhnk.to/app/api/v1/orders', {
      method: 'POST', headers: { Authorization: 'Bearer owner' }, body: JSON.stringify(input)
    }), env, fetcher);
    assert.equal(response.status, 503);
  }
});