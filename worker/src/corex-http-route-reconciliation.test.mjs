import assert from 'node:assert/strict';
import test from 'node:test';

import {
	readCorexHttpRouteAdapterBinding,
	reconcileCorexHttpRoutes
} from './corex-http-route-reconciliation.ts';

function createFixture({
	desiredStatus = 'present',
	observedFingerprint = 'a'.repeat(64),
	error
} = {}) {
	const requests = [];
	const adapterCalls = [];
	const desiredFingerprint = 'a'.repeat(64);
	const claim = {
		environmentId: '018f47a2-8391-7b1c-8f7a-f1d27670f061',
		routeNamespace: 'default',
		httpMethod: 'POST',
		routePath: '/callbacks/payment',
		desiredStatus,
		desiredTriggerId: desiredStatus === 'present' ? '018f47a2-8391-7b1c-8f7a-f1d27670f062' : null,
		desiredFingerprint,
		attempts: 1,
		claimToken: '018f47a2-8391-7b1c-8f7a-f1d27670f063'
	};
	const responses = [Response.json([claim]), Response.json({ accepted: true })];
	return {
		requests,
		adapterCalls,
		options: {
			url: 'https://project.supabase.co',
			serviceRoleKey: 'service-role-key',
			fetcher: async (input, init) => {
				requests.push({ url: String(input), body: JSON.parse(init.body) });
				return responses.shift();
			},
			adapter: {
				async reconcile(route) {
					adapterCalls.push(route);
					if (error) throw error;
					return { observedFingerprint };
				}
			}
		}
	};
}

test('acknowledges an exact desired route observed through the adapter', async () => {
	const fixture = createFixture();
	const result = await reconcileCorexHttpRoutes(fixture.options);

	assert.deepEqual(result, { claimed: 1, reconciled: 1, failed: 0 });
	assert.deepEqual(fixture.requests[0].body, { p_limit: 10, p_lease_seconds: 120 });
	assert.equal(fixture.adapterCalls[0].desiredStatus, 'present');
	assert.equal(fixture.adapterCalls[0].desiredTriggerId, '018f47a2-8391-7b1c-8f7a-f1d27670f062');
	assert.match(fixture.requests[1].url, /corex_ack_http_route_reconciliation$/);
	assert.deepEqual(fixture.requests[1].body, {
		p_claim_token: '018f47a2-8391-7b1c-8f7a-f1d27670f063',
		p_observed_fingerprint: 'a'.repeat(64)
	});
});

test('passes desired absence to the adapter without inventing a trigger', async () => {
	const fixture = createFixture({ desiredStatus: 'absent' });
	const result = await reconcileCorexHttpRoutes(fixture.options);

	assert.deepEqual(result, { claimed: 1, reconciled: 1, failed: 0 });
	assert.equal(fixture.adapterCalls[0].desiredStatus, 'absent');
	assert.equal(fixture.adapterCalls[0].desiredTriggerId, null);
});

test('fails drift without leaking adapter details when the fingerprint does not converge', async () => {
	const fixture = createFixture({
		observedFingerprint: 'b'.repeat(64),
		error: new Error('secret platform detail')
	});
	const result = await reconcileCorexHttpRoutes(fixture.options);

	assert.deepEqual(result, { claimed: 1, reconciled: 0, failed: 1 });
	assert.match(fixture.requests[1].url, /corex_fail_http_route_reconciliation$/);
	assert.deepEqual(fixture.requests[1].body, {
		p_claim_token: '018f47a2-8391-7b1c-8f7a-f1d27670f063',
		p_error: { code: 'http_route_reconciliation_failed' }
	});
	assert.doesNotMatch(JSON.stringify(fixture.requests), /secret platform detail/);
});

test('fails when the adapter reports a different observed fingerprint', async () => {
	const fixture = createFixture({ observedFingerprint: 'b'.repeat(64) });
	const result = await reconcileCorexHttpRoutes(fixture.options);

	assert.deepEqual(result, { claimed: 1, reconciled: 0, failed: 1 });
	assert.match(fixture.requests[1].url, /corex_fail_http_route_reconciliation$/);
});

test('recognizes only a configured route adapter binding', () => {
	const adapter = { async reconcile() {} };
	assert.equal(readCorexHttpRouteAdapterBinding({ COREX_HTTP_ROUTE_ADAPTER: adapter }), adapter);
	assert.equal(readCorexHttpRouteAdapterBinding({}), undefined);
	assert.equal(readCorexHttpRouteAdapterBinding({ COREX_HTTP_ROUTE_ADAPTER: {} }), undefined);
});
