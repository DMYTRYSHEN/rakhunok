import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';
import { createSupportApiServer, SUPPORT_PROJECT_REF } from './support-api-local-server.mjs';

test('local API forwards fixed invoice preparation to authentication without creating an invoice', async () => {
  let calls = 0;
  const input = { action: 'invoice.fixed.create', fields: {} };
  const server = createSupportApiServer(async (url, init) => {
    calls += 1;
    assert.equal(url, `https://${SUPPORT_PROJECT_REF}.supabase.co/rest/v1/rpc/support_dispatch`);
    assert.equal(init.headers.Authorization, 'Bearer invalid.test.jwt');
    assert.deepEqual(JSON.parse(init.body), { p_action: 'prepare', p_input: input });
    return Response.json({ message: 'Invalid JWT' }, { status: 401 });
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/dashboard/api/support/prepare`, {
      method: 'POST', headers: { Origin: 'http://localhost:5173', Authorization: 'Bearer invalid.test.jwt',
        'Content-Type': 'application/json' }, body: JSON.stringify(input)
    });
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { error: 'SUPPORT_AUTH_REQUIRED' });
    assert.equal(calls, 1);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});

test('local API preserves admin JWT and pins the existing project through both frontend origins', async () => {
  let calls = 0;
  const server = createSupportApiServer(async (url, init) => {
    calls += 1;
    assert.equal(url, `https://${SUPPORT_PROJECT_REF}.supabase.co/rest/v1/rpc/support_dispatch`);
    assert.equal(init.headers.Authorization, 'Bearer original.admin.jwt');
    assert.deepEqual(JSON.parse(init.body), { p_action: 'bootstrap', p_input: {} });
    return Response.json({ available: true });
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const health = await fetch(`${base}/health`);
    assert.deepEqual(await health.json(), {
      backend: 'running', projectRef: SUPPORT_PROJECT_REF, databaseVerified: false
    });
    assert.equal(calls, 0);
    for (const origin of ['http://localhost:5173', 'http://127.0.0.1:5173']) {
      const response = await fetch(`${base}/dashboard/api/support/bootstrap`, {
        method: 'POST', headers: { Host: new URL(origin).host, Origin: origin, Authorization: 'Bearer original.admin.jwt',
          'Content-Type': 'application/json' }, body: '{}'
      });
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('Cache-Control'), 'no-store');
    }
    for (const [origin, action, authorization, expected] of [
      ['https://attacker.test', 'bootstrap', 'Bearer original.admin.jwt', 403],
      ['http://localhost:5173', 'payment.confirm', 'Bearer original.admin.jwt', 404],
      ['http://localhost:5173', 'bootstrap', '', 401]
    ]) {
      const response = await fetch(`${base}/dashboard/api/support/${action}`, {
        method: 'POST', headers: { Origin: origin, Authorization: authorization,
          'Content-Type': 'application/json' }, body: '{}'
      });
      assert.equal(response.status, expected);
    }
    assert.equal(calls, 2);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});