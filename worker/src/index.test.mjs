import assert from 'node:assert/strict';
import test from 'node:test';

import { routeWebRequest } from './index.ts';

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

test('buildBankRedirect generates valid deep link schemes for Monobank and IziBank', async () => {
	const { buildBankRedirect } = await import('./index.ts');

	const mono = buildBankRedirect('MONO', 'dummyPayload', 'ios');
	assert.equal(mono.redirectUrl, 'https://mbnk.app/qr/dummyPayload');

	const izi = buildBankRedirect('TASB', 'dummyPayload', 'android');
	assert.equal(izi.redirectUrl, 'izibank://bank.gov.ua/qr/dummyPayload');

	const abank = buildBankRedirect('ABUA', 'dummyPayload', 'ios');
	assert.equal(abank.redirectUrl, 'a-bank://qr/dummyPayload');
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
	assert.ok(body.redirect_url.startsWith('https://mbnk.app/qr/'));
	assert.ok(body.nbu_raw_string.includes('ФОП ДМИТРИШЕН'));
	assert.ok(body.nbu_raw_string.includes('UA12345678987654321345562'));
	assert.ok(body.nbu_payload_base64);
});