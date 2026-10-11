import test from 'node:test';
import assert from 'node:assert/strict';
import { routeDashboard } from './dashboard.js';

test('support is isolated from the ordinary merchant API and fails closed', async () => {
  const supportRequest = new Request('https://rhnk.to/dashboard/api/support/search', {
    method: 'POST', headers: { Authorization: 'Bearer administrator' }, body: '{"query":"customer"}'
  });
  const env = { API: { fetch() { assert.fail('Support must not use merchant API'); } } };
  assert.equal((await routeDashboard(supportRequest.clone(), env)).status, 503);
  env.SUPPORT = { async fetch(forwarded) {
    assert.equal(forwarded.url, supportRequest.url);
    assert.equal(forwarded.headers.get('Authorization'), 'Bearer administrator');
    assert.equal(await forwarded.text(), '{"query":"customer"}');
    return Response.json({ customers: [] });
  } };
  const response = await routeDashboard(supportRequest.clone(), env);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  env.SUPPORT = { fetch() { throw new Error('Private service unavailable'); } };
  assert.equal((await routeDashboard(supportRequest.clone(), env)).status, 503);
});

const original = { id: 'invoice', type: 'table', status: 'preparing', merchant_id: 'merchant',
  entity_id: 'entity', terminal_id: 'terminal', total_amount: 777,
  expires_at: new Date(Date.now() + 18_000_000).toISOString() };
function request(body = { type: 'table', status: 'pending', amount: 777 }) {
  return new Request('https://rhnk.to/dashboard/api/v1/orders', {
    method: 'POST', headers: { Authorization: 'Bearer owner' }, body: JSON.stringify(body)
  });
}
function environment(order = original) {
  return { SUPABASE_URL: 'https://mwaeazabpvbxqfrceogr.supabase.co', SUPABASE_ANON_KEY: 'public',
    API: { fetch: async forwarded => {
      assert.equal(new URL(forwarded.url).pathname, '/api/v1/orders');
      return Response.json({ success: true, order });
    } } };
}

test('POS confirms pending while preserving amount, terminal and configured expiry', async () => {
  const response = await routeDashboard(request(), environment(), async patch => {
    assert.equal(patch.method, 'PATCH');
    assert.equal(patch.headers.get('Authorization'), 'Bearer owner');
    const target = new URL(patch.url);
    assert.equal(target.searchParams.get('id'), 'eq.invoice');
    assert.equal(target.searchParams.get('merchant_id'), 'eq.merchant');
    assert.equal(target.searchParams.get('terminal_id'), 'eq.terminal');
    assert.equal(target.searchParams.get('status'), 'eq.preparing');
    assert.match(target.searchParams.get('or'), /expires_at.is.null,expires_at.gt/);
    assert.deepEqual(await patch.json(), { status: 'pending' });
    return Response.json([{ ...original, status: 'pending' }]);
  });
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).order, { ...original, status: 'pending' });
});

test('kasa without expiry becomes ready without inventing a TTL', async () => {
  const order = { ...original, expires_at: null };
  const response = await routeDashboard(request(), environment(order), async () =>
    Response.json([{ ...order, status: 'pending' }]));
  assert.equal((await response.json()).order.expires_at, null);
});

test('ordinary invoice creation and already pending orders are unchanged', async () => {
  const unexpected = () => { throw new Error('Unexpected readiness write'); };
  const ordinary = await routeDashboard(request({ type: 'table', amount: 777 }), environment(), unexpected);
  assert.equal((await ordinary.json()).order.status, 'preparing');
  for (const order of [{ ...original, status: 'pending' }, { ...original, total_amount: 0 },
    { ...original, terminal_id: null }, { ...original, type: 'fixed' }]) {
    const response = await routeDashboard(request(), environment(order), unexpected);
    assert.deepEqual((await response.json()).order, order);
  }
});

test('cancelled, expired, concurrent and failed confirmation never report readiness', async () => {
  for (const order of [{ ...original, status: 'cancelled' }, { ...original, expires_at: '2020-01-01T00:00:00Z' }]) {
    assert.equal((await routeDashboard(request(), environment(order), () => {
      throw new Error('Unexpected write');
    })).status, 503);
  }
  for (const fetcher of [async () => Response.json([]), async () => new Response(null, { status: 403 }),
    async () => { throw new Error('Network failure'); },
    async () => Response.json([{ ...original, status: 'pending', total_amount: 1 }]),
    async () => Response.json([{ ...original, status: 'pending', expires_at: null }])]) {
    assert.equal((await routeDashboard(request(), environment(), fetcher)).status, 503);
  }
});

test('Dashboard cancellation is forwarded unchanged and other hosts are rejected', async () => {
  let calls = 0;
  const env = { API: { fetch: async forwarded => {
    calls++;
    assert.equal(new URL(forwarded.url).pathname, '/api/v1/orders/invoice');
    assert.deepEqual(await forwarded.json(), { status: 'cancelled' });
    return Response.json({ success: true });
  } } };
  const response = await routeDashboard(new Request('https://rhnk.to/dashboard/api/v1/orders/invoice', {
    method: 'PATCH', body: JSON.stringify({ status: 'cancelled' })
  }), env);
  assert.equal(response.status, 200);
  assert.equal(calls, 1);
  assert.equal((await routeDashboard(new Request('https://letsrealtalk.com/dashboard/'), env)).status, 404);
});