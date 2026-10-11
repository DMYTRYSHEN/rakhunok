import assert from 'node:assert/strict';
import test from 'node:test';
import worker, { handleSupport } from './support.js';

const env = { SUPPORT_ORIGIN: 'https://rhnk.to', SUPPORT_PROJECT_REF: 'mwaeazabpvbxqfrceogr',
  SUPABASE_URL: 'https://mwaeazabpvbxqfrceogr.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test' };
test('Cloudflare execution context is not used as a fetch transport', async (context) => {
  context.mock.method(globalThis, 'fetch', async () => Response.json({ available: true }));
  const response = await worker.fetch(request('bootstrap'), env, { waitUntil() {} });
  assert.equal(response.status, 200);
});
function request(action = 'search', input = {}, headers = {}) {
  return new Request(`https://rhnk.to/dashboard/api/support/${action}`, { method: 'POST',
    headers: { Origin: env.SUPPORT_ORIGIN, Authorization: 'Bearer original.admin.jwt',
      'Content-Type': 'application/json', ...headers }, body: JSON.stringify(input) });
}

test('support forwards original actor only to the explicit project RPC', async () => {
  const response = await handleSupport(request('search', { query: 'client@example.test' }), env,
    async (url, init) => {
      assert.equal(url, `${env.SUPABASE_URL}/rest/v1/rpc/support_dispatch`);
      assert.equal(init.headers.Authorization, 'Bearer original.admin.jwt');
      assert.equal(init.headers.apikey, 'sb_publishable_test');
      assert.equal(init.redirect, 'error');
      assert.deepEqual(JSON.parse(init.body), { p_action: 'search', p_input: { query: 'client@example.test' } });
      return Response.json({ clients: [] });
    });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
});

test('support rejects cross-origin, unknown operations, malformed body, and project fallback', async () => {
  const never = () => { assert.fail('must not contact database'); };
  for (const [req, config, status] of [
    [request('search', {}, { Origin: 'https://attacker.test' }), env, 403],
    [request('search', {}, { Authorization: '' }), env, 401],
    [request('refund'), env, 404],
    [request('search', []), env, 400],
    [request('search', { query: 'x'.repeat(33000) }), env, 400],
    [request(), { ...env, SUPPORT_PROJECT_REF: 'mvytjhaujcewqfyivwxf' }, 503],
    [request(), { ...env, SUPABASE_PUBLISHABLE_KEY: 'service-role' }, 503]
  ]) assert.equal((await handleSupport(req, config, never)).status, status);
});

test('support never forwards payment confirmation or unlisted business writes', async () => {
  const never = () => { assert.fail('forbidden action reached database'); };
  for (const action of ['payment.confirm', 'invoice.mark_paid', 'receipt.create', 'ledger.credit', 'webhook.replay', 'unknown.action']) {
    assert.equal((await handleSupport(request(action), env, never)).status, 404);
    const response = await handleSupport(request('prepare', { action, nextSeconds: 3600 }), env, never);
    assert.equal(response.status, 403);
    assert.deepEqual(await response.json(), { error: 'SUPPORT_FORBIDDEN' });
  }
  assert.equal((await handleSupport(request('prepare', { action: 'settings.table_ttl', nextSeconds: 3600 }), env,
    async () => Response.json({ operationId: 'prepared' }))).status, 200);
});

test('support sanitizes database errors and never logs tokens or database messages', async () => {
  for (const [upstream, expected] of [[401, 401], [403, 403], [409, 409], [400, 400], [404, 503], [500, 503]]) {
    const response = await handleSupport(request(), env, async () => Response.json({ secret: 'database detail' }, { status: upstream }));
    assert.equal(response.status, expected);
    assert.doesNotMatch(await response.text(), /database detail/);
  }
  assert.equal((await handleSupport(request(), env, async () => { throw new Error('secret'); })).status, 503);
});

test('support bounds streamed database results and rejects malformed success bodies', async () => {
  for (const body of ['null', '[]', '{', JSON.stringify({ value: 'x'.repeat(4 * 1024 * 1024) })]) {
    const response = await handleSupport(request(), env, async () => new Response(body));
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { error: 'SUPPORT_UNAVAILABLE' });
  }
  let cancelled = false;
  const upstream = new Response(new ReadableStream({
    pull(controller) { controller.enqueue(new Uint8Array(1024 * 1024)); },
    cancel() { cancelled = true; }
  }));
  assert.equal((await handleSupport(request(), env, async () => upstream)).status, 503);
  assert.equal(cancelled, true);
});

test('support operation reconciliation forwards only the original actor and exact input', async () => {
  for (const input of [{ sessionId: 'context' }, { sessionId: 'context', operationId: 'operation' }]) {
    const response = await handleSupport(request('operation', input), env, async (url, init) => {
      assert.equal(url, `${env.SUPABASE_URL}/rest/v1/rpc/support_dispatch`);
      assert.equal(init.headers.Authorization, 'Bearer original.admin.jwt');
      assert.deepEqual(JSON.parse(init.body), { p_action: 'operation', p_input: input });
      return Response.json({ operation: null });
    });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
  }
});

test('support forwards only explicit structure and invoice operations with original actor credentials', async () => {
  for (const action of ['settings.business.save', 'structure.merchant.rename', 'structure.entity.create', 'structure.entity.update',
    'structure.entity.delete', 'structure.terminal.create', 'structure.terminal.update', 'structure.terminal.delete', 'invoice.fixed.create', 'invoice.create',
    'templates.create', 'templates.update', 'templates.delete', 'templates.default']) {
    const input = { sessionId: 'context', action, fields: { name: 'Example' } };
    const response = await handleSupport(request('prepare', input), env, async (url, init) => {
      assert.equal(init.headers.Authorization, 'Bearer original.admin.jwt');
      assert.deepEqual(JSON.parse(init.body), { p_action: 'prepare', p_input: input });
      return Response.json({ operationId: 'prepared' });
    });
    assert.equal(response.status, 200);
  }
});