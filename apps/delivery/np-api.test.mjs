import test from 'node:test';
import assert from 'node:assert/strict';
import { NovaPoshtaApi } from './src/lib/server/tracking/np-api.ts';

const cityRef = '11111111-1111-1111-1111-111111111111';
const warehouseRef = '22222222-2222-2222-2222-222222222222';
const response = data => Response.json({ success: true, errors: [], data });

test('city queries are bounded, cached and contain no carrier credential', async () => {
	let calls = 0;
	const client = new NovaPoshtaApi(async (url, init) => {
		calls++;
		assert.equal(url, 'https://api.novaposhta.ua/v2.0/json/');
		assert.equal(init.redirect, 'manual');
		assert.deepEqual(JSON.parse(init.body), { modelName: 'Address', calledMethod: 'getCities', methodProperties: { FindByString: 'Kyiv', Page: '1', Limit: '20' } });
		return response([{ Ref: cityRef, Description: 'Kyiv', SecretField: 'excluded' }]);
	});
	const cities = await client.cities('Kyiv');
	assert.deepEqual(cities, [{ ref: cityRef, name: 'Kyiv', area: '' }]);
	cities[0].name = 'changed';
	assert.equal((await client.cities('Kyiv'))[0].name, 'Kyiv');
	assert.equal(calls, 1);
	await assert.rejects(client.cities('K'), { status: 400 });
	await assert.rejects(client.cities('Kyiv', 0), { status: 400 });
});

test('warehouse results stay in requested city and expose an allowlist', async () => {
	const client = new NovaPoshtaApi(async () => response([
		{ Ref: warehouseRef, CityRef: cityRef, Description: 'Locker', ShortAddress: 'Street 1', CategoryOfWarehouse: 'Postomat', WarehouseStatus: 'Working', PlaceMaxWeightAllowed: '20', Schedule: { Monday: '09:00-18:00', secret: 'excluded' }, Phone: 'excluded' },
		{ Ref: warehouseRef, CityRef: warehouseRef, Description: 'Wrong city' }
	]));
	const warehouses = await client.warehouses(cityRef);
	assert.equal(warehouses.length, 1);
	assert.equal(warehouses[0].maxWeight, 20);
	assert.equal(warehouses[0].category, 'Postomat');
	assert.deepEqual(warehouses[0].schedule, { Monday: '09:00-18:00' });
	assert.equal('Phone' in warehouses[0], false);
	await assert.rejects(client.warehouses('invalid'), { status: 400 });
});

test('provider errors, redirects and malformed envelopes fail closed', async () => {
	for (const result of [Response.json({ success: false, errors: ['private data'], data: [] }), Response.json({ success: true, errors: [], data: [null] }), new Response('', { status: 302 })]) {
		const client = new NovaPoshtaApi(async () => result);
		await assert.rejects(client.cities('Kyiv'), error => error.status === 503 && !error.message.includes('private'));
	}
	await assert.rejects(new NovaPoshtaApi(async () => new Response('', { status: 429 })).cities('Kyiv'), { status: 429 });
});

test('pagination uses raw carrier rows before the allowlist filters them', async () => {
	const rows = Array.from({ length: 20 }, (_, index) => ({ Ref: warehouseRef, CityRef: index === 0 ? warehouseRef : cityRef, Description: `Point ${index}` }));
	const client = new NovaPoshtaApi(async () => response(rows));
	const page = await client.warehousesPage(cityRef);
	assert.equal(page.data.length, 19);
	assert.equal(page.hasMore, true);
	const cities = await new NovaPoshtaApi(async () => response([{ Ref: cityRef, Description: 'City' }])).citiesPage('City');
	assert.equal(cities.hasMore, false);
});