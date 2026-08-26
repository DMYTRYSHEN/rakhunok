import assert from 'node:assert/strict';
import test from 'node:test';

import { fetchCheckoutOrder, getApiBase } from './checkout-api.js';

test('selects the local Worker only for localhost development', () => {
  assert.equal(getApiBase({ hostname: 'localhost', port: '59692' }), 'http://localhost:8787');
  assert.equal(getApiBase({ hostname: 'localhost', port: '8787' }), '');
  assert.equal(getApiBase({ hostname: 'pay.rahunok.ua', port: '' }), '');
});

test('returns checkout order JSON from the Worker API', async () => {
  const result = await fetchCheckoutOrder('order-7', {
    apiBase: '',
    fetchImpl: async (url, init) => {
      assert.equal(url, '/api/v1/checkout/order-7');
      assert.equal(init.headers.Accept, 'application/json');
      return new Response(JSON.stringify({ id: 'order-7', total_amount: 125.5 }));
    }
  });

  assert.equal(result.reason, null);
  assert.equal(result.order.total_amount, 125.5);
});

test('distinguishes not-found, server failure, and offline states', async () => {
  const notFound = await fetchCheckoutOrder('missing', {
    apiBase: '',
    fetchImpl: async () => new Response('', { status: 404 })
  });
  const serverError = await fetchCheckoutOrder('broken', {
    apiBase: '',
    fetchImpl: async () => new Response('', { status: 503 })
  });
  const offline = await fetchCheckoutOrder('offline', {
    apiBase: '',
    fetchImpl: async () => { throw new TypeError('Network unavailable'); }
  });

  assert.equal(notFound.reason, 'not-found');
  assert.equal(serverError.reason, 'server-error');
  assert.equal(serverError.status, 503);
  assert.equal(offline.reason, 'offline');
});