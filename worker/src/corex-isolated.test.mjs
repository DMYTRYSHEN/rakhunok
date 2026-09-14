import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import test from 'node:test';
import { routeCorexRequest } from './corex-router.ts';

// Node lacks cloudflare:workers. Stub only the Workflow export; execute the real fetch handler.
const hooks = registerHooks({
	resolve(specifier, context, nextResolve) {
		if (specifier === './corex-workflow.ts' && context.parentURL === new URL('./corex.ts', import.meta.url).href) {
			return { url: 'data:text/javascript,export class CorexProcessWorkflow {}', shortCircuit: true };
		}
		return nextResolve(specifier, context);
	}
});
const { default: worker } = await import('./corex.ts');
hooks.deregister();

function fixture() {
	const requests = [];
	return {
		requests,
		env: {
			SUPABASE_URL: 'https://unused.invalid',
			SUPABASE_PUBLISHABLE_KEY: 'test',
			ASSETS: { async fetch(request) {
				requests.push(request);
				return new Response(null, { status: new URL(request.url).pathname.includes('missing') ? 404 : 200 });
			} }
		}
	};
}

test('serves scoped assets verbatim before fallback and without reading DB configuration', async () => {
	for (const path of ['/corex/_app', '/corex/_app/env.js', '/corex/_app/version.json', '/corex/_app/immutable/entry/start.js?v=1', '/corex/_app/immutable/missing.js']) {
		const { env, requests } = fixture();
		Object.defineProperty(env, 'SUPABASE_URL', { get() { throw new Error('Assets must not touch the control plane'); } });
		const request = new Request(`https://letsrealtalk.com${path}`, { method: 'HEAD', headers: { 'If-None-Match': 'test' } });
		const response = await worker.fetch(request, env);
		assert.equal(response.status, path.includes('missing') ? 404 : 200);
		assert.deepEqual(requests, [request]);
	}
});

test('keeps shells mapped to /200 and API authentication outside assets', async () => {
	for (const path of ['/corex', '/corex/', '/corex/flow', '/corex/_application']) {
		const { env, requests } = fixture();
		await worker.fetch(new Request(`https://letsrealtalk.com${path}?id=1`), env);
		assert.equal(new URL(requests[0].url).pathname, '/200');
		assert.equal(new URL(requests[0].url).search, '?id=1');
	}
	const { env, requests } = fixture();
	const response = await worker.fetch(new Request('https://letsrealtalk.com/corex/api/operations', { method: 'POST' }), env);
	assert.equal(response.status, 401);
	assert.equal(requests.length, 0);
});

test('production and other hosts retain the unchanged router behavior', async () => {
	for (const host of ['rakhunok.com', 'www.rakhunok.com', 'example.com']) {
		for (const path of ['/corex', '/corex/_app/env.js', '/_app/env.js', '/dashboard', '/corexyz']) {
			const actual = fixture();
			const baseline = fixture();
			const request = new Request(`https://${host}${path}`);
			const response = await worker.fetch(request, actual.env);
			const expected = await routeCorexRequest(request, baseline.env);
			assert.equal(response.status, expected.status);
			assert.deepEqual(actual.requests.map((r) => r.url), baseline.requests.map((r) => r.url));
		}
	}
});

test('the asset branch precedes control-plane creation', () => {
	const source = readFileSync(new URL('./corex.ts', import.meta.url), 'utf8');
	assert.ok(source.indexOf('return env.ASSETS.fetch(request)') < source.indexOf('const controlPlane ='));
});