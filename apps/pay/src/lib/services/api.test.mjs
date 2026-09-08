import assert from 'node:assert/strict';
import test, { after, before, mock } from 'node:test';
import { fetchCheckoutOrder, getApiBase, initiateBankPayment } from './api.ts';

// Any accidental use of real fetch fails locally instead of accessing the network.
before(() => mock.method(globalThis, 'fetch', () => {
  assert.fail('Real fetch is forbidden in these tests');
}));
after(() => {
  assert.equal(globalThis.fetch.mock.callCount(), 0);
  mock.restoreAll();
});

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), { status });
}

async function payment(fetchImpl, options = {}) {
  let calls = 0;
  const result = await initiateBankPayment('order/7', 'TASB', 125.5, {
    apiBase: '',
    ...options,
    fetchImpl: async (url, init) => {
      calls++;
      assert.equal(url, '/api/v1/checkout/order%2F7/initiate');
      assert.equal(init.method, 'POST');
      assert.equal(init.cache, 'no-store');
      assert.equal(init.redirect, 'error');
      assert.ok(init.signal instanceof AbortSignal);
      return fetchImpl(url, init);
    }
  });
  assert.equal(calls, 1, 'No retry or fallback request');
  return result;
}

function assertFailed(result) {
  assert.equal(result.success, false);
  assert.equal(typeof result.error, 'string');
  assert.ok(result.error.length > 0);
  for (const field of ['redirect_url', 'fallback_url', 'nbu_raw_string', 'nbu_payload_base64', 'nbu_qr_url']) {
    assert.equal(result[field], undefined, `Failure must not provide ${field}`);
  }
}

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
      assert.equal(init.cache, 'no-store');
      assert.equal(init.redirect, 'error');
      assert.ok(init.signal instanceof AbortSignal);
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
    fetchImpl: async () => {
      throw new TypeError('Network unavailable');
    }
  });

  assert.equal(notFound.reason, 'not-found');
  assert.equal(serverError.reason, 'server-error');
  assert.equal(serverError.status, 503);
  assert.equal(offline.reason, 'offline');
});

test('missing order ID performs no request', async () => {
  assert.deepEqual(await fetchCheckoutOrder('', {
    fetchImpl: async () => assert.fail('Missing ID must not fetch')
  }), { order: null, reason: 'missing-id' });
});

for (const status of [403, 404, 409, 500]) {
  test(`checkout HTTP ${status} makes exactly one configured API request`, async () => {
    let calls = 0;
    const result = await fetchCheckoutOrder('order/7', {
      apiBase: '/configured',
      fetchImpl: async (url) => {
        calls++;
        assert.equal(url, '/configured/api/v1/checkout/order%2F7');
        return new Response('', { status });
      }
    });
    assert.equal(calls, 1);
    assert.equal(result.order, null);
    assert.equal(result.reason, status === 404 ? 'not-found' : 'server-error');
    if (status !== 404) assert.equal(result.status, status);
  });

  test(`payment HTTP ${status} cannot become a successful QR fallback`, async () => {
    const result = await payment(async () => jsonResponse({
      success: true, redirect_url: 'https://bank.example/pay'
    }, status));
    assertFailed(result);
    assert.match(result.error, new RegExp(String(status)));
  });
}

test('checkout network failure stays offline without a remote fallback', async () => {
  const error = new TypeError('Network unavailable');
  let calls = 0;
  const result = await fetchCheckoutOrder('order-7', {
    fetchImpl: async () => { calls++; throw error; }
  });
  assert.equal(calls, 1);
  assert.equal(result.reason, 'offline');
  assert.equal(result.error, error);
});

test('checkout invalid JSON is a server error, not missing or offline', async () => {
  const result = await fetchCheckoutOrder('order-7', {
    fetchImpl: async () => new Response('{')
  });
  assert.equal(result.reason, 'server-error');
  assert.equal(result.status, 200);
});

test('payment network failure fails closed', async () => {
  assertFailed(await payment(async () => { throw new TypeError('Network unavailable'); }));
});

test('unsafe secondary redirect fails closed even with a valid bank URL', async () => {
  for (const fallback_url of ['javascript:alert(1)', 'http://bank.example/pay', '//bank.example/pay', 42]) {
    assertFailed(await payment(async () => jsonResponse({
      success: true, redirect_url: 'https://bank.example/pay', fallback_url
    })));
  }
});

for (const body of ['', '{', 'null', '[]', 'true', '123', '"https://bank.example/pay"']) {
  test(`payment rejects invalid JSON or non-object body ${JSON.stringify(body)}`, async () => {
    assertFailed(await payment(async () => new Response(body)));
  });
}

for (const data of [
  {}, { success: true }, { redirect_url: '' }, { redirect_url: '   ' },
  { redirect_url: null }, { redirect_url: 123 },
  { success: false, redirect_url: 'https://bank.example/pay' },
  { success: false, error: 'Declined', redirect_url: 'https://bank.example/pay', nbu_raw_string: 'QR' }
]) {
  test(`payment rejects missing redirect or explicit failure ${JSON.stringify(data)}`, async () => {
    const result = await payment(async () => jsonResponse(data));
    assertFailed(result);
    if (data.error) assert.equal(result.error, data.error);
  });
}

for (const redirect_url of [
  'javascript:alert(1)', 'JaVaScRiPt://bank.example/pay', 'data:text/html,test',
  'file:///tmp/pay', 'http://bank.example/pay', '/pay', '//bank.example/pay', 'pay',
  'https:bank.example/pay', 'https:///bank.example/pay', 'https://',
  'https://user:password@bank.example/pay', 'https://user@bank.example/pay',
  'https://@bank.example/pay', 'izibank://user:password@bank.gov.ua/qr/test',
  'https://bank.example/\npay', 'https://bank.example/\\pay',
  ' https://bank.example/pay', 'https://bank.example/pay ',
  'ftp://bank.example/pay', 'unknown-app://pay/test',
  'intent://bank.gov.ua/qr/test#Intent;scheme=javascript;package=ua.izibank.app;end',
  'intent://bank.gov.ua/qr/test#Intent;scheme=https;package=untrusted.app;end',
  'intent://bank.gov.ua/qr/test#Intent;scheme=https;package=ua.izibank.app;S.browser_fallback_url=http://unsafe.example;end'
]) {
  test(`payment rejects unsafe redirect ${JSON.stringify(redirect_url)}`, async () => {
    assertFailed(await payment(async () => jsonResponse({ success: true, redirect_url })));
  });
}

for (const redirect_url of [
  'https://bank.example/pay?order=7',
  'izibank://bank.gov.ua/qr/test',
  'novapay-mobile://bank.gov.ua/qr/test',
  'intent://bank.gov.ua/qr/test#Intent;scheme=https;package=ua.izibank.app;end',
  'intent://bank.gov.ua/qr/test#Intent;scheme=https;package=ua.novapay.novapaymobile;end'
]) {
  for (const legacy of [false, true]) {
    test(`payment accepts ${legacy ? 'legacy redirect-only' : 'successful'} ${redirect_url}`, async () => {
      const data = legacy ? { redirect_url } : { success: true, redirect_url };
      assert.deepEqual(await payment(async () => jsonResponse(data)), { ...data, success: true });
    });
  }
}

test('payment preserves the existing request contract and decodes server QR metadata', async () => {
  const raw = 'Оплата замовлення';
  const data = {
    success: true,
    redirect_url: 'https://bank.example/pay',
    nbu_payload_base64: Buffer.from(raw).toString('base64url'),
    nbu_qr_url: 'https://qr.bank.gov.ua/test'
  };
  const result = await payment(async (_url, init) => {
    assert.equal(init.headers['Content-Type'], 'application/json');
    assert.deepEqual(JSON.parse(init.body), {
      bank: 'TASB', bank_code: 'TASB', amount: 125.5, os: 'android',
      recaptcha_token: 'test-token', turnstile_token: 'test-token'
    });
    return jsonResponse(data);
  }, { os: 'android', turnstileToken: 'test-token' });
  assert.deepEqual(result, { ...data, nbu_raw_string: raw });
});

test('malformed optional QR metadata does not replace an accepted backend redirect', async () => {
  const data = { redirect_url: 'https://bank.example/pay', nbu_payload_base64: '!' };
  assert.deepEqual(await payment(async () => jsonResponse(data)), { ...data, success: true });
});

for (const kind of ['checkout', 'payment']) {
  for (const outcome of ['success', 'http-error', 'invalid-json', 'network', 'timeout', 'body-timeout']) {
    test(`${kind} clears its 8s timeout in finally after ${outcome}`, async (t) => {
      let expire;
      let signal;
      const timer = { testTimer: true };
      const set = t.mock.method(globalThis, 'setTimeout', (callback, delay) => {
        assert.equal(delay, 8000);
        expire = callback;
        return timer;
      });
      const clear = t.mock.method(globalThis, 'clearTimeout', (id) => assert.equal(id, timer));
      const fetchImpl = async (_url, init) => {
        signal = init.signal;
        assert.equal(signal.aborted, false);
        assert.equal(clear.mock.callCount(), 0);
        if (outcome === 'network') throw new TypeError('Offline');
        if (outcome === 'timeout') {
          return new Promise((_resolve, reject) => {
            signal.addEventListener('abort', () => reject(signal.reason), { once: true });
            expire();
          });
        }
        return {
          ok: outcome !== 'http-error',
          status: outcome === 'http-error' ? 500 : 200,
          json: async () => {
            assert.equal(clear.mock.callCount(), 0, 'Timeout must cover body parsing');
            if (outcome === 'invalid-json') throw new SyntaxError('Invalid JSON');
            if (outcome === 'body-timeout') {
              expire();
              throw signal.reason;
            }
            return kind === 'checkout' ? { id: 'order-7' } : { redirect_url: 'https://bank.example/pay' };
          }
        };
      };
      const result = kind === 'checkout'
        ? await fetchCheckoutOrder('order-7', { fetchImpl })
        : await payment(fetchImpl);
      assert.equal(set.mock.callCount(), 1);
      assert.equal(clear.mock.callCount(), 1);
      assert.equal(signal.aborted, outcome === 'timeout' || outcome === 'body-timeout');
      if (kind === 'payment') {
        if (outcome === 'success') assert.equal(result.success, true);
        else assertFailed(result);
        if (signal.aborted) assert.match(result.error, /timed out/);
      } else {
        assert.equal(result.reason, outcome === 'success' ? null
          : ['http-error', 'invalid-json'].includes(outcome) ? 'server-error' : 'offline');
      }
    });
  }
}
