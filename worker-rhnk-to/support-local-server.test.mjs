import test from 'node:test';
import assert from 'node:assert/strict';
import { createLocalSupportServer } from './support-local-server.mjs';

test('HTTP boundary rejects unauthenticated and cross-origin writes, and exposes the local workflow', async () => {
  const server = createLocalSupportServer({ port: 0 });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  try {
    assert.equal((await fetch(`${origin}/api/bootstrap`)).status, 403);
    const page = await fetch(origin);
    assert.equal(page.status, 200);
    assert.equal(page.headers.get('cache-control'), 'no-store');
    const cookie = page.headers.get('set-cookie').split(';')[0];
    const bootstrap = await (await fetch(`${origin}/api/bootstrap`, { headers: { cookie } })).json();
    const headers = { cookie, origin, 'Content-Type': 'application/json', 'x-support-csrf': bootstrap.csrf };
    const body = JSON.stringify({ workspace: 'sandbox', reason: 'INVOICE_CREATION' });
    assert.equal((await fetch(`${origin}/api/open`, { method: 'POST', headers: { ...headers, origin: 'https://evil.invalid' }, body })).status, 403);
    assert.equal((await fetch(`${origin}/api/open`, { method: 'POST', headers: { ...headers, 'x-support-csrf': '' }, body })).status, 403);
    const opened = await (await fetch(`${origin}/api/open`, { method: 'POST', headers, body })).json();
    assert.equal(opened.session.workspace, 'sandbox');
    assert.equal((await fetch(`${origin}/api/end`, { method: 'POST', headers, body: JSON.stringify({ sessionId: opened.session.id }) })).status, 200);
    assert.equal((await fetch(`${origin}/api/snapshot`, { method: 'POST', headers, body: JSON.stringify({ sessionId: opened.session.id }) })).status, 400);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});