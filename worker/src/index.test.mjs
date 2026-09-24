import assert from 'node:assert/strict';
import test, { beforeEach, afterEach } from 'node:test';

import { routeWebRequest } from './index.ts';

// These routing/QR fixtures must never contact the real database.
let originalFetch;
beforeEach(() => {
	originalFetch = globalThis.fetch;
	globalThis.fetch = async () => Response.json([]);
});
afterEach(() => {
	globalThis.fetch = originalFetch;
});

function createEnv() {
	const requests = [];
	return {
		requests,
		env: {
			ASSETS: {
				fetch(request) {
					requests.push(new URL(request.url).pathname);
					return new Response('asset');
				}
			}
		}
	};
}

test('redirects /docs once and serves the API documentation directory index', async () => {
	const redirect = await routeWebRequest(new Request('https://example.com/docs'), createEnv().env);
	assert.equal(redirect.status, 308);
	assert.equal(redirect.headers.get('location'), 'https://example.com/docs/');

	const { env, requests } = createEnv();
	const response = await routeWebRequest(new Request('https://example.com/docs/'), env);
	assert.equal(response.status, 200);
	assert.deepEqual(requests, ['/docs/']);
});

test('serves only the canonical OpenAPI file below /docs', async () => {
	const { env, requests } = createEnv();
	const response = await routeWebRequest(
		new Request('https://example.com/docs/openapi.yaml'),
		env
	);

	assert.equal(response.status, 200);
	assert.deepEqual(requests, ['/docs/openapi.yaml']);

	const missing = await routeWebRequest(
		new Request('https://example.com/docs/private.txt'),
		env
	);
	assert.equal(missing.status, 404);
});

test('anonymous order listing and detail require authentication without querying persistence', async () => {
	let queries = 0;
	globalThis.fetch = async () => {
		queries += 1;
		return Response.json([{ id: 'private-order' }]);
	};
	for (const path of ['/api/v1/orders', '/api/v1/orders/private-order']) {
		const response = await routeWebRequest(new Request(`https://example.com${path}`), createEnv().env);
		assert.equal(response.status, 401);
	}
	assert.equal(queries, 0);
});

test('authenticated order listing forwards the bearer token to persistence', async () => {
	const requests = [];
	globalThis.fetch = async (url, options) => {
		requests.push({ url: String(url), authorization: options.headers.Authorization });
		return Response.json([]);
	};
	const response = await routeWebRequest(new Request('https://example.com/api/v1/orders', {
		headers: { Authorization: 'Bearer merchant-token' }
	}), createEnv().env);
	assert.equal(response.status, 200);
	assert.equal(requests.length, 1);
	assert.match(requests[0].url, /\/rest\/v1\/orders\?/);
	assert.equal(requests[0].authorization, 'Bearer merchant-token');
});

test('public checkout reads only the requested invoice without listing orders', async () => {
	const requests = [];
	globalThis.fetch = async (url) => {
		requests.push(String(url));
		return Response.json([{ id: 'invoice-123', short_id: 'ABC123', base_amount: 12, total_amount: 12 }]);
	};
	const response = await routeWebRequest(new Request('https://example.com/api/v1/checkout/invoice-123'), createEnv().env);
	assert.equal(response.status, 200);
	assert.equal((await response.json()).id, 'invoice-123');
	assert.equal(requests.length, 1);
	assert.match(requests[0], /or=\(short_id\.eq\.invoice-123,order_number\.eq\.invoice-123\)/);
	assert.match(requests[0], /limit=1/);
});

test('buildMerchantInfo prioritizes business_entities over merchants', async () => {
	const { buildMerchantInfo } = await import('./index.ts');

	const rowWithEntity = {
		merchants: {
			business_name: 'ТОВ Рахунок',
			display_name: 'Кав’ярня Рахунок',
			iban: 'UA000000000000000000000000000',
			tax_id: '12345678',
			bank_name: 'ПриватБанк'
		},
		business_entities: {
			business_name: 'ФОП ДМИТРИШЕН',
			display_name: 'BARCODE',
			iban: 'UA12345678987654321345562',
			tax_id: '11212121212',
			bank_name: 'А-Банк'
		}
	};

	const result = buildMerchantInfo(rowWithEntity);
	assert.deepEqual(result, {
		business_name: 'ФОП ДМИТРИШЕН',
		display_name: 'BARCODE',
		iban: 'UA12345678987654321345562',
		tax_id: '11212121212',
		bank_name: 'А-Банк'
	});
});

test('buildMerchantInfo falls back to merchants if business_entities is null', async () => {
	const { buildMerchantInfo } = await import('./index.ts');

	const rowWithoutEntity = {
		merchants: {
			business_name: 'ТОВ Рахунок',
			display_name: 'Кав’ярня Рахунок',
			iban: 'UA000000000000000000000000000',
			tax_id: '12345678',
			bank_name: 'ПриватБанк'
		},
		business_entities: null
	};

	const result = buildMerchantInfo(rowWithoutEntity);
	assert.deepEqual(result, {
		business_name: 'ТОВ Рахунок',
		display_name: 'Кав’ярня Рахунок',
		iban: 'UA000000000000000000000000000',
		tax_id: '12345678',
		bank_name: 'ПриватБанк'
	});
});

test('generateNbuQrPayload creates standard 17-line NBU 003 string and payload', async () => {
	const { generateNbuQrPayload } = await import('./index.ts');

	const qr = generateNbuQrPayload({
		amount: 386.0,
		recipientName: 'ФОП ДМИТРИШЕН',
		recipientIban: 'UA12345678987654321345562',
		recipientTaxId: '11212121212',
		purpose: 'Оплата рахунку №118',
		orderNumber: '№118'
	});

	assert.ok(qr.rawString);
	assert.ok(qr.rawString.startsWith('BCD\n003\n1\nICT\n\nФОП ДМИТРИШЕН\nUA12345678987654321345562\nUAH386.00\n11212121212\nOTHR/GDDS\n№118\nОплата рахунку №118\n'));
	assert.ok(qr.base64UrlPayload);
	assert.ok(qr.standardQrUrl.startsWith('https://qr.bank.gov.ua/'));
});

test('buildBankRedirect prefers Monobank universal links and preserves platform-specific fallbacks for other banks', async () => {
	const { buildBankRedirect } = await import('./index.ts');

	for (const os of ['ios', 'android', 'desktop']) {
		const mono = buildBankRedirect(os === 'android' ? 'UNJS' : 'MONO', 'dummyPayload', os);
		assert.equal(mono.redirectUrl, 'https://mbnk.app/qr/dummyPayload');
		assert.equal(mono.fallbackUrl, 'https://mbnk.app/qr/dummyPayload');
	}

	const iziIos = buildBankRedirect('TASB', 'dummyPayload', 'ios');
	assert.equal(iziIos.redirectUrl, 'izibank://bank.gov.ua/qr/dummyPayload');

	const iziAndroid = buildBankRedirect('TASB', 'dummyPayload', 'android');
	assert.ok(iziAndroid.redirectUrl.startsWith('intent://bank.gov.ua/qr/dummyPayload'));

	const abank = buildBankRedirect('ABUA', 'dummyPayload', 'ios');
	assert.equal(abank.redirectUrl, 'https://abank24.page.link/qr/dummyPayload');
});

test('routeWebRequest handles POST /api/v1/checkout/:id/initiate', async () => {
	const { routeWebRequest } = await import('./index.ts');

	const request = new Request('https://letsrealtalk.com/api/v1/checkout/demo-sc1/initiate', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			bank_code: 'MONO',
			amount: 1240.0,
			merchantName: 'ФОП ДМИТРИШЕН',
			merchantIban: 'UA12345678987654321345562',
			merchantTaxId: '11212121212',
			purpose: 'Оплата замовлення №4092-A'
		})
	});

	const response = await routeWebRequest(request, { ASSETS: { fetch: async () => new Response('mock') } });
	assert.equal(response.status, 200);

	const body = await response.json();
	assert.equal(body.success, true);
	assert.equal(body.redirect_url, `https://mbnk.app/qr/${body.nbu_payload_base64}`);
	assert.equal(body.fallback_url, `https://mbnk.app/qr/${body.nbu_payload_base64}`);
	assert.ok(body.nbu_raw_string.includes('ФОП ДМИТРИШЕН'));
	assert.ok(body.nbu_raw_string.includes('UA12345678987654321345562'));
	assert.ok(body.nbu_payload_base64);
});

test('resolved invoice short_id is authoritative for NBU field 11', async () => {
	const { routeWebRequest } = await import('./index.ts');
	globalThis.fetch = async () => Response.json([{
		id: '4d88e808-e209-4190-a9e2-3299e5d757ee',
		short_id: 'tinOSq',
		order_number: 'INV-4092',
		type: 'fixed',
		title: 'Рахунок INV-4092',
		description: 'Оплата рахунку INV-4092',
		base_amount: 1240,
		total_amount: 1240,
		currency: 'UAH',
		status: 'pending',
		merchants: {
			business_name: 'ФОП ДМИТРИШЕН',
			iban: 'UA12345678987654321345562',
			tax_id: '11212121212'
		},
		business_entities: null
	}]);

	const response = await routeWebRequest(new Request('https://letsrealtalk.com/api/v1/checkout/tinOSq/initiate', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			bank_code: 'MONO',
			amount: 1,
			merchantName: 'CLIENT NAME',
			merchantIban: 'UA000000000000000000000000000',
			merchantTaxId: '0000000000',
			purpose: 'CLIENT PURPOSE',
			orderNumber: 'CLIENT-CONTROLLED-REFERENCE'
		})
	}), { ASSETS: { fetch: async () => new Response('mock') } });

	assert.equal(response.status, 200);
	const body = await response.json();
	const fields = body.nbu_raw_string.split('\n');
	assert.equal(fields[7], 'UAH1240.00');
	assert.equal(fields[10], 'tinOSq');
	assert.ok(!body.nbu_raw_string.includes('CLIENT-CONTROLLED-REFERENCE'));
	assert.ok(!body.nbu_raw_string.includes('CLIENT NAME'));
	assert.ok(!body.nbu_raw_string.includes('UA000000000000000000000000000'));
	assert.ok(!body.nbu_raw_string.includes('CLIENT PURPOSE'));
});

test('payment snapshot is authoritative for NBU recipient and purpose fields', async () => {
	const { routeWebRequest } = await import('./index.ts');
	globalThis.fetch = async () => Response.json([{
		id: '4d88e808-e209-4190-a9e2-3299e5d757ef',
		short_id: 'finOSq',
		order_number: 'FIN-0007',
		type: 'fixed',
		title: 'Legacy title',
		description: 'Legacy description',
		base_amount: 750,
		total_amount: 750,
		currency: 'UAH',
		status: 'pending',
		payment_acceptance_mode: 'finance-company',
		payment_recipient_name: 'ТОВ Фінансова компанія',
		payment_recipient_iban: 'UA987654321098765432109876543',
		payment_recipient_tax_id: '87654321',
		payment_purpose: 'Оплата продавцю ТОВ Продавець; payment=server-payment-id',
		payment_id: '10000000-0000-4000-8000-000000000001',
		payment_settings_revision: 2,
		merchants: {
			business_name: 'CLIENT-FALLBACK-NAME',
			iban: 'UA000000000000000000000000000',
			tax_id: '0000000000'
		},
		business_entities: null
	}]);

	const response = await routeWebRequest(new Request('https://letsrealtalk.com/api/v1/checkout/finOSq/initiate', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ purpose: 'CLIENT PURPOSE' })
	}), { ASSETS: { fetch: async () => new Response('mock') } });

	assert.equal(response.status, 200);
	const fields = (await response.json()).nbu_raw_string.split('\n');
	assert.equal(fields[5], 'ТОВ Фінансова компанія');
	assert.equal(fields[6], 'UA987654321098765432109876543');
	assert.equal(fields[8], '87654321');
	assert.equal(fields[11], 'Оплата продавцю ТОВ Продавець; payment=server-payment-id');
});

test('partial payment snapshot fails closed instead of mixing payment authorities', async () => {
	const { routeWebRequest } = await import('./index.ts');
	globalThis.fetch = async () => Response.json([{
		id: '4d88e808-e209-4190-a9e2-3299e5d757f0',
		short_id: 'badOSq',
		order_number: 'INV-0010',
		type: 'fixed',
		base_amount: 100,
		total_amount: 100,
		status: 'pending',
		payment_acceptance_mode: 'direct',
		payment_recipient_name: 'ТОВ Продавець',
		payment_recipient_iban: null,
		payment_recipient_tax_id: '12345678',
		payment_purpose: 'Рахунок INV-0010',
		payment_id: '10000000-0000-4000-8000-000000000001',
		payment_settings_revision: 1,
		merchants: {
			business_name: 'Fallback recipient',
			iban: 'UA123456789012345678901234567',
			tax_id: '12345678'
		},
		business_entities: null
	}]);

	const response = await routeWebRequest(new Request('https://letsrealtalk.com/api/v1/checkout/badOSq/initiate', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: '{}'
	}), { ASSETS: { fetch: async () => new Response('mock') } });

	assert.equal(response.status, 409);
	assert.deepEqual(await response.json(), { error: 'Invoice payment snapshot unavailable' });
});

test('routeWebRequest handles health check', async () => {
	const { routeWebRequest } = await import('./index.ts');
	const res = await routeWebRequest(
		new Request('https://letsrealtalk.com/api/v1/health'),
		{ ASSETS: { fetch: async () => new Response('mock') } }
	);
	assert.equal(res.status, 200);
	const data = await res.json();
	assert.equal(data.status, 'ok');
	assert.equal(data.service, 'Rahunok Edge API');
});

test('routeWebRequest handles banks catalog and logos', async () => {
	const { routeWebRequest } = await import('./index.ts');
	const banksRes = await routeWebRequest(
		new Request('https://letsrealtalk.com/api/v1/banks'),
		{ ASSETS: { fetch: async () => new Response('mock') } }
	);
	assert.equal(banksRes.status, 200);
	const banks = await banksRes.json();
	assert.ok(Array.isArray(banks));
	assert.ok(banks.some((b) => b.code === 'UNJS'));

	const singleBankRes = await routeWebRequest(
		new Request('https://letsrealtalk.com/api/v1/banks/pban'),
		{ ASSETS: { fetch: async () => new Response('mock') } }
	);
	assert.equal(singleBankRes.status, 200);
	const singleBank = await singleBankRes.json();
	assert.equal(singleBank.code, 'PBAN');

	const logosRes = await routeWebRequest(
		new Request('https://letsrealtalk.com/api/v1/logos'),
		{ ASSETS: { fetch: async () => new Response('mock') } }
	);
	assert.equal(logosRes.status, 200);
	const logos = await logosRes.json();
	assert.ok(logos.MONO);
	assert.ok(logos.PBAN);
});

test('routeWebRequest reads the bank catalog from Supabase without mutating it', async () => {
	const { routeWebRequest } = await import('./index.ts');
	const requests = [];
	globalThis.fetch = async (input, init = {}) => {
		requests.push({ input: String(input), init });
		return Response.json([
			{ id: 'grant', code: 'GRNT', name: 'Банк Грант', active: true }
		]);
	};

	const env = {
		ASSETS: { fetch: async () => new Response('mock') },
		SUPABASE_URL: 'https://catalog.supabase.co',
		SUPABASE_ANON_KEY: 'publishable-test-key'
	};
	const response = await routeWebRequest(
		new Request('https://letsrealtalk.com/api/v1/banks/grnt'),
		env
	);

	assert.equal(response.status, 200);
	assert.equal((await response.json()).id, 'grant');
	assert.equal(requests.length, 1);
	assert.equal(
		requests[0].input,
		'https://catalog.supabase.co/rest/v1/banklink?select=*&order=name.asc'
	);
	assert.equal(requests[0].init.method, 'GET');
	assert.equal(requests[0].init.headers.apikey, 'publishable-test-key');
	assert.equal(requests[0].init.body, undefined);
});

test('routeWebRequest preserves the fallback bank catalog when Supabase is unavailable or invalid', async () => {
	const { routeWebRequest } = await import('./index.ts');
	const env = {
		ASSETS: { fetch: async () => new Response('mock') },
		SUPABASE_URL: 'https://catalog.supabase.co',
		SUPABASE_ANON_KEY: 'publishable-test-key'
	};
	const upstreamResponses = [
		new Response('unavailable', { status: 500 }),
		Response.json([]),
		Response.json([{ id: 'broken', code: '', name: 'Broken Bank' }])
	];

	for (const upstreamResponse of upstreamResponses) {
		globalThis.fetch = async () => upstreamResponse;
		const response = await routeWebRequest(
			new Request('https://letsrealtalk.com/api/v1/banks/pban'),
			env
		);

		assert.equal(response.status, 200);
		assert.equal((await response.json()).code, 'PBAN');
	}
});

test('routeWebRequest handles auth and merchant onboarding', async () => {
	const { routeWebRequest } = await import('./index.ts');
	const authRes = await routeWebRequest(
		new Request('https://letsrealtalk.com/api/v1/auth/config'),
		{ ASSETS: { fetch: async () => new Response('mock') } }
	);
	assert.equal(authRes.status, 200);

	const demoRes = await routeWebRequest(
		new Request('https://letsrealtalk.com/api/v1/auth/demo-session', { method: 'POST' }),
		{ ASSETS: { fetch: async () => new Response('mock') } }
	);
	assert.equal(demoRes.status, 200);
	const demo = await demoRes.json();
	assert.equal(demo.success, true);

	const onboardRes = await routeWebRequest(
		new Request('https://letsrealtalk.com/api/v1/merchant/onboarding', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				business_name: 'ФОП Тест',
				business_type: 'fop',
				tax_id: '1234567890',
				iban: 'UA123456789012345678901234567',
				display_name: 'Тестова Кав’ярня'
			})
		}),
		{ ASSETS: { fetch: async () => new Response('mock') } }
	);
	assert.equal(onboardRes.status, 401);
	const onboard = await onboardRes.json();
	assert.deepEqual(onboard, { error: 'Unauthorized' });
});

test('routeWebRequest handles sandbox simulation', async () => {
	const { routeWebRequest } = await import('./index.ts');
	const res = await routeWebRequest(
		new Request('https://letsrealtalk.com/dashboard/api/sandbox/simulate', { method: 'POST' }),
		{ ASSETS: { fetch: async () => new Response('mock') } }
	);
	assert.equal(res.status, 200);
	const result = await res.json();
	assert.equal(result.verified, true);
	assert.equal(result.event.eventType, 'payment.succeeded');
});

test('routeWebRequest handles PATCH /api/v1/orders/:id and promo/delivery/callback', async () => {
	const { routeWebRequest } = await import('./index.ts');

	// 1. PATCH order (cancel)
	const patchRes = await routeWebRequest(
		new Request('https://letsrealtalk.com/api/v1/orders/ord-test-123', {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ status: 'cancelled' })
		}),
		{ ASSETS: { fetch: async () => new Response('mock') } }
	);
	assert.equal(patchRes.status, 401);
	const patchData = await patchRes.json();
	assert.deepEqual(patchData, { error: 'Unauthorized' });

	// 2. Callback
	const callbackRes = await routeWebRequest(
		new Request('https://letsrealtalk.com/api/v1/checkout/ord-test-123/callback', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ status: 'paid' })
		}),
		{ ASSETS: { fetch: async () => new Response('mock') } }
	);
	assert.equal(callbackRes.status, 200);
	const callbackData = await callbackRes.json();
	assert.equal(callbackData.success, true);
	assert.equal(callbackData.status, 'paid');

	// 3. Promo
	const promoRes = await routeWebRequest(
		new Request('https://letsrealtalk.com/api/v1/checkout/ord-test-123/apply-promo', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ promo_code: 'SALE10' })
		}),
		{ ASSETS: { fetch: async () => new Response('mock') } }
	);
	assert.equal(promoRes.status, 200);
	const promoData = await promoRes.json();
	assert.equal(promoData.success, true);
	assert.equal(promoData.discount_amount, 10);
});

test('routeWebRequest handles telegram webhook and phone verification flow', async () => {
	const dummyEnv = { ASSETS: { fetch: async () => new Response('mock') } };

	// 1. Initial status check (should be false)
	const initialStatusRes = await routeWebRequest(
		new Request('https://letsrealtalk.com/api/v1/verification/status?token=test_token_456'),
		dummyEnv
	);
	assert.equal(initialStatusRes.status, 200);
	const initialData = await initialStatusRes.json();
	assert.equal(initialData.verified, false);

	// 2. Telegram /start with verify token
	const startWebhookRes = await routeWebRequest(
		new Request('https://letsrealtalk.com/api/v1/telegram/webhook', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				update_id: 1001,
				message: {
					message_id: 1,
					chat: { id: 777123, type: 'private' },
					from: { id: 777123, is_bot: false, first_name: 'TestUser' },
					text: '/start verify_test_token_456'
				}
			})
		}),
		dummyEnv
	);
	assert.equal(startWebhookRes.status, 200);

	// 3. Telegram user shares contact
	const contactWebhookRes = await routeWebRequest(
		new Request('https://letsrealtalk.com/api/v1/telegram/webhook', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				update_id: 1002,
				message: {
					message_id: 2,
					chat: { id: 777123, type: 'private' },
					from: { id: 777123, is_bot: false, first_name: 'TestUser', username: 'test_tg_user' },
					contact: {
						phone_number: '380981234567',
						first_name: 'TestUser',
						user_id: 777123
					}
				}
			})
		}),
		dummyEnv
	);
	assert.equal(contactWebhookRes.status, 200);

	// 4. Status check again (should be verified now)
	const verifiedStatusRes = await routeWebRequest(
		new Request('https://letsrealtalk.com/api/v1/verification/status?token=test_token_456'),
		dummyEnv
	);
	assert.equal(verifiedStatusRes.status, 200);
	const verifiedData = await verifiedStatusRes.json();
	assert.equal(verifiedData.verified, true);
	assert.equal(verifiedData.phone, '+380981234567');
	assert.equal(verifiedData.telegramId, 777123);
	assert.equal(verifiedData.telegramUsername, 'test_tg_user');
	assert.equal(
		verifiedData.avatarUrl,
		'/api/v1/telegram/avatar?user_id=777123&username=test_tg_user'
	);

	// 5. Test telegram notify endpoint
	const notifyRes = await routeWebRequest(
		new Request('https://letsrealtalk.com/api/v1/telegram/notify', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ telegram_id: 777123, text: 'Hello from Rahunok!' })
		}),
		dummyEnv
	);
	assert.equal(notifyRes.status, 200);

	// 6. Test telegram avatar endpoint
	const noUserAvatarRes = await routeWebRequest(
		new Request('https://letsrealtalk.com/api/v1/telegram/avatar'),
		dummyEnv
	);
	assert.equal(noUserAvatarRes.status, 400);
});