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