import assert from 'node:assert/strict';
import test from 'node:test';

import { routeCorexRequest } from './corex.ts';

function createEnv() {
	const paths = [];
	return {
		paths,
		env: {
			ASSETS: {
				async fetch(request) {
					paths.push(new URL(request.url).pathname);
					return new Response('<html>Corex</html>', {
						headers: { 'Content-Type': 'text/html; charset=utf-8' }
					});
				}
			}
		}
	};
}

test('serves the Corex shell for exact and nested routes', async () => {
	for (const pathname of ['/corex', '/corex/', '/corex/flow']) {
		const { env, paths } = createEnv();
		const response = await routeCorexRequest(new Request(`https://example.com${pathname}`), env);

		assert.equal(response.status, 200);
		assert.deepEqual(paths, ['/200']);
	}
});

test('serves shared build assets in preview', async () => {
	const { env, paths } = createEnv();
	const response = await routeCorexRequest(
		new Request('https://example.com/_app/immutable/entry/start.js'),
		env
	);

	assert.equal(response.status, 200);
	assert.deepEqual(paths, ['/_app/immutable/entry/start.js']);
});

test('rejects paths outside Corex ownership', async () => {
	for (const pathname of ['/dashboard', '/corexyz', '/api/v1/checkout/demo-1', '/']) {
		const { env, paths } = createEnv();
		const response = await routeCorexRequest(new Request(`https://example.com${pathname}`), env);

		assert.equal(response.status, 404);
		assert.equal(response.headers.get('X-Robots-Tag'), 'noindex');
		assert.deepEqual(paths, []);
	}
});