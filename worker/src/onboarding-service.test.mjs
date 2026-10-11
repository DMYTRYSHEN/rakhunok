import assert from 'node:assert/strict';
import test from 'node:test';
import { routeOnboardingRequest } from './onboarding-service.ts';

const env = { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_ANON_KEY: 'publishable' };

test('internal onboarding service requires exact test host, path and POST', async () => {
	for (const url of [
		'https://rakhunok.com/api/v1/merchant/onboarding',
		'http://letsrealtalk.com/api/v1/merchant/onboarding',
		'https://letsrealtalk.com/api/v1/orders',
		'https://letsrealtalk.com/api/v1/merchant/onboarding/'
	]) {
		assert.equal((await routeOnboardingRequest(new Request(url, { method: 'POST' }), env)).status, 404);
	}
	const url = 'https://letsrealtalk.com/api/v1/merchant/onboarding';
	assert.equal((await routeOnboardingRequest(new Request(url), env)).status, 405);
	const response = await routeOnboardingRequest(new Request(url, { method: 'POST' }), env);
	assert.equal(response.status, 401);
	assert.equal(response.headers.get('Cache-Control'), 'no-store');
	assert.equal(response.headers.has('Access-Control-Allow-Origin'), false);
});