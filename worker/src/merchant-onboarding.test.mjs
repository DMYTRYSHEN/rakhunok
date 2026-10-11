import assert from 'node:assert/strict';
import test from 'node:test';
import { handleMerchantOnboarding } from './merchant-onboarding.ts';

const owner = '00000000-0000-0000-0000-000000000001';
const merchant = { id: '00000000-0000-0000-0000-000000000101', user_id: owner };
const entity = { id: '00000000-0000-0000-0000-000000000201', user_id: owner };
const input = {
	business_type: 'fop', business_name: ' Shop ', tax_id: '1234567890',
	iban: 'UA663052990000026007123456789', phone: '067 123-45-67',
	contact_email: ' Owner@Example.com ', website: 'example.com', vat_status: 'no-vat'
};
const config = { url: 'https://example.supabase.co/', publishableKey: 'synthetic-public-key' };
function request(body = input, authorization = 'Bearer synthetic-token') {
	return new Request('https://example.com/api/v1/merchant/onboarding', {
		method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: authorization },
		body: JSON.stringify(body)
	});
}

test('onboarding verifies owner and uses one authenticated atomic RPC without trusting body owner/bank', async () => {
	const calls = [];
	const response = await handleMerchantOnboarding(request({ ...input, user_id: 'attacker', bank_name: 'Untrusted' }), config, async (url, init) => {
		calls.push({ url, init });
		return Response.json(calls.length === 1 ? { id: owner } : { merchant, entity, created: true });
	});
	assert.equal(response.status, 200);
	assert.equal(calls.length, 2);
	assert.equal(calls[0].url, 'https://example.supabase.co/auth/v1/user');
	assert.equal(calls[1].url, 'https://example.supabase.co/rest/v1/rpc/complete_merchant_onboarding');
	assert.equal(calls[1].init.headers.Authorization, 'Bearer synthetic-token');
	const payload = JSON.parse(calls[1].init.body).p_input;
	assert.equal(payload.business_name, 'Shop');
	assert.equal(payload.phone, '+380671234567');
	assert.equal(payload.contact_email, 'owner@example.com');
	assert.equal(payload.website, 'https://example.com/');
	assert.equal(payload.vat_status, 'no-vat');
	assert.notEqual(payload.bank_name, 'Untrusted');
	assert.equal('user_id' in payload, false);
	assert.deepEqual(await response.json(), { success: true, merchant, entity, created: true });
});

for (const authResult of [() => new Response('private', { status: 401 }), () => Response.json({}), () => Response.json({ id: 'forged' })]) {
	test('onboarding rejects unverified identity before business write', async () => {
		let calls = 0;
		const response = await handleMerchantOnboarding(request(), config, async () => { calls++; return authResult(); });
		assert.equal(response.status, 401);
		assert.equal(calls, 1);
	});
}

for (const invalid of [{}, null, { ...input, tax_id: '123' }, { ...input, iban: 'UA123' },
	{ ...input, business_type: 'unknown' }, { ...input, phone: '' }, { ...input, contact_email: '' },
	{ ...input, website: 'javascript://example.com' }, { ...input, vat_status: undefined },
	{ ...input, vat_status: 'unknown' }, { ...input, vat_status: true }]) {
	test(`onboarding rejects invalid legal/contact input ${JSON.stringify(invalid)}`, async () => {
		const response = await handleMerchantOnboarding(request(invalid), config, async () => { throw new Error('No IO allowed'); });
		assert.equal(response.status, 422);
	});
}

for (const result of [{ merchant: { ...merchant, user_id: 'other' }, entity, created: true },
	{ merchant, entity: null, created: true }, { merchant, entity: { ...entity, user_id: 'other' }, created: true },
	{ merchant, entity: { ...entity, user_id: 'other' }, created: false },
	[], { merchant, entity, created: 'true' }]) {
	test('onboarding rejects unconfirmed or cross-owner persisted representation', async () => {
		const response = await handleMerchantOnboarding(request(), config, async (url) => Response.json(url.includes('/auth/') ? { id: owner } : result));
		assert.equal(response.status, 503);
	});
}

test('onboarding reconciles an existing merchant without requiring or inventing a new entity', async () => {
	const response = await handleMerchantOnboarding(request(), config, async (url) => Response.json(url.includes('/auth/') ? { id: owner } : { merchant, entity: null, created: false }));
	assert.deepEqual(await response.json(), { success: true, merchant, entity: null, created: false });
});

test('onboarding missing RPC fails closed and never falls back to partial writes', async () => {
	const calls = [];
	const response = await handleMerchantOnboarding(request(), config, async (url) => {
		calls.push(url);
		return url.includes('/auth/') ? Response.json({ id: owner }) : new Response('private schema cache', { status: 404 });
	});
	assert.equal(response.status, 503);
	assert.equal(calls.length, 2);
	assert.deepEqual(await response.json(), { error: 'Service unavailable' });
});

for (const authorization of ['', 'Basic synthetic', 'Bearer one two']) {
	test('onboarding malformed bearer never reaches Auth or persistence', async () => {
		const response = await handleMerchantOnboarding(request(input, authorization), config, async () => { throw new Error('No IO allowed'); });
		assert.equal(response.status, 401);
	});
}

test('onboarding invalid JSON is a client error without IO', async () => {
	const response = await handleMerchantOnboarding(new Request('https://example.com', {
		method: 'POST', headers: { Authorization: 'Bearer synthetic' }, body: '{'
	}), config, async () => { throw new Error('No IO allowed'); });
	assert.equal(response.status, 400);
});

test('onboarding forwards the explicitly selected VAT payer status unchanged', async () => {
	let payload;
	const response = await handleMerchantOnboarding(request({ ...input, vat_status: 'vat' }), config, async (url, init) => {
		if (url.includes('/auth/')) return Response.json({ id: owner });
		payload = JSON.parse(init.body).p_input;
		return Response.json({ merchant, entity, created: true });
	});
	assert.equal(response.status, 200);
	assert.equal(payload.vat_status, 'vat');
});