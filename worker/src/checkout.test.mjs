import assert from 'node:assert/strict';
import test from 'node:test';

import { routeCheckoutRequest } from './checkout.js';

function createEnv(orderResponse = new Response('', { status: 404 })) {
	const calls = { api: [], assets: [] };
	return {
		calls,
		env: {
			API: {
				async fetch(request) {
					calls.api.push(new URL(request.url).pathname);
					return orderResponse.clone();
				}
			},
			ASSETS: {
				async fetch(request) {
					calls.assets.push(new URL(request.url).pathname);
					return new Response('<html><head></head><body>Checkout</body></html>', {
						headers: { 'Content-Type': 'text/html' }
					});
				}
			}
		}
	};
}

test('rejects paths outside the checkout ownership boundary', async () => {
	const { env, calls } = createEnv();
	const response = await routeCheckoutRequest(new Request('https://example.com/application'), env);

	assert.equal(response.status, 404);
	assert.deepEqual(calls, { api: [], assets: [] });
});

test('proxies only checkout public API dependencies', async () => {
	const { env, calls } = createEnv(new Response('{}'));

	await routeCheckoutRequest(new Request('https://example.com/api/v1/checkout/order-7/status'), env);
	await routeCheckoutRequest(new Request('https://example.com/api/v1/banks'), env);
	await routeCheckoutRequest(new Request('https://example.com/api/v1/logos/mono'), env);

	assert.deepEqual(calls.api, [
		'/api/v1/checkout/order-7/status',
		'/api/v1/banks',
		'/api/v1/logos/mono'
	]);
});

test('hydrates alias routes through the backend service binding', async () => {
	const order = { id: 'order-7', title: '</script><script>alert(1)</script>' };
	const { env, calls } = createEnv(Response.json(order));
	const response = await routeCheckoutRequest(new Request('https://example.com/o/order-7'), env);
	const html = await response.text();

	assert.equal(response.headers.get('X-Edge-Hydration'), 'HIT');
	assert.equal(response.headers.get('Cache-Control'), 'no-cache, no-store, must-revalidate');
	assert.deepEqual(calls.api, ['/api/v1/checkout/order-7']);
	assert.deepEqual(calls.assets, ['/checkout/index.html']);
	assert.match(html, /window\.__INITIAL_ORDER__=/);
	assert.doesNotMatch(html, /<\/script><script>alert/);
	assert.match(html, /\\u003c\/script\\u003e/);
});

test('uses query identifiers and falls back to client loading when lookup misses', async () => {
	const { env, calls } = createEnv(new Response('', { status: 404 }));
	const response = await routeCheckoutRequest(
		new Request('https://example.com/checkout/?order_id=missing'),
		env
	);

	assert.equal(response.headers.get('X-Edge-Hydration'), null);
	assert.deepEqual(calls.api, ['/api/v1/checkout/missing']);
	assert.equal(await response.text(), '<html><head></head><body>Checkout</body></html>');
});

test('serves checkout assets without order lookups', async () => {
	const { env, calls } = createEnv();
	await routeCheckoutRequest(new Request('https://example.com/checkout/js/checkout-api.js'), env);

	assert.deepEqual(calls.assets, ['/checkout/js/checkout-api.js']);
	assert.deepEqual(calls.api, []);
});

test('follows the asset canonical redirect internally before hydration', async () => {
	const { env, calls } = createEnv(Response.json({ id: 'demo-1' }));
	env.ASSETS.fetch = async (request) => {
		const pathname = new URL(request.url).pathname;
		calls.assets.push(pathname);
		if (pathname === '/checkout/index.html') {
			return new Response(null, { status: 307, headers: { Location: '/checkout/' } });
		}
		return new Response('<html><head></head><body>Checkout</body></html>');
	};

	const response = await routeCheckoutRequest(
		new Request('https://example.com/checkout/?id=demo-1'),
		env
	);

	assert.equal(response.status, 200);
	assert.equal(response.headers.get('X-Edge-Hydration'), 'HIT');
	assert.deepEqual(calls.assets, ['/checkout/index.html', '/checkout/']);
});

test('hydrates /pay/ route with Early Hints Link header and initial order', async () => {
	const order = { id: 'demo-sc1', total_amount: 1240.0, title: 'Замовлення Rozetka' };
	const { env, calls } = createEnv(Response.json(order));
	env.ASSETS.fetch = async (request) => {
		const pathname = new URL(request.url).pathname;
		calls.assets.push(pathname);
		return new Response(
			'<html><head><link rel="stylesheet" href="/pay/assets/index.css"></head><body><script src="/pay/assets/index.js"></script></body></html>',
			{ headers: { 'Content-Type': 'text/html' } }
		);
	};

	const response = await routeCheckoutRequest(
		new Request('https://example.com/pay/?id=demo-sc1'),
		env
	);

	assert.equal(response.status, 200);
	assert.equal(response.headers.get('X-Edge-Hydration'), 'HIT');
	const linkHeader = response.headers.get('Link');
	assert.ok(linkHeader);
	assert.ok(linkHeader.includes('</pay/assets/index.js>; rel=modulepreload; as=script'));
	assert.ok(linkHeader.includes('</pay/assets/index.css>; rel=preload; as=style'));
	const html = await response.text();
	assert.ok(html.includes('window.__INITIAL_ORDER__='));
	assert.ok(html.includes('Замовлення Rozetka'));
});

test('uses ORDERS_KV for sub-5ms edge cache HIT without calling backend API', async () => {
	const order = { id: 'order-fast', total_amount: 500, title: 'Edge Fast Order' };
	const { env, calls } = createEnv(new Response('', { status: 500 })); // API would fail
	const kvStore = new Map([['order:order-fast', JSON.stringify(order)]]);
	env.ORDERS_KV = {
		async get(key, type) {
			const val = kvStore.get(key);
			if (!val) return null;
			return type === 'json' ? JSON.parse(val) : val;
		},
		async put(key, value) {
			kvStore.set(key, value);
		}
	};

	const response = await routeCheckoutRequest(new Request('https://example.com/pay/order-fast'), env);
	assert.equal(response.status, 200);
	assert.equal(response.headers.get('X-Edge-Hydration'), 'HIT');
	assert.equal(response.headers.get('X-Edge-Cache'), 'HIT');
	assert.equal(calls.api.length, 0); // No API calls made!
	const html = await response.text();
	assert.ok(html.includes('Edge Fast Order'));
});

test('populates ORDERS_KV on cache MISS for subsequent ultra-fast requests', async () => {
	const order = { id: 'order-populate', total_amount: 750, title: 'Populated Order' };
	const { env, calls } = createEnv(Response.json(order));
	const kvStore = new Map();
	env.ORDERS_KV = {
		async get(key, type) {
			const val = kvStore.get(key);
			if (!val) return null;
			return type === 'json' ? JSON.parse(val) : val;
		},
		async put(key, value) {
			kvStore.set(key, value);
		}
	};

	const response = await routeCheckoutRequest(new Request('https://example.com/pay/order-populate'), env);
	assert.equal(response.status, 200);
	assert.equal(response.headers.get('X-Edge-Hydration'), 'HIT');
	assert.equal(response.headers.get('X-Edge-Cache'), 'MISS');
	assert.equal(calls.api.length, 1);
	assert.ok(kvStore.has('order:order-populate'));
});