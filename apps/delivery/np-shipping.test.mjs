import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePreparation, validatePoint, buildEstimatePayload, prepareShipment, ShippingValidationError } from './src/lib/server/tracking/np-shipping.ts';

const senderCityRef = '11111111-1111-1111-1111-111111111111';
const recipientCityRef = '22222222-2222-2222-2222-222222222222';
const senderWarehouseRef = '33333333-3333-3333-3333-333333333333';
const recipientWarehouseRef = '44444444-4444-4444-4444-444444444444';
const input = { senderCityRef, recipientCityRef, senderWarehouseRef, recipientWarehouseRef,
	recipientName: 'Test Recipient', recipientPhone: '0671234567', description: 'Books',
	seats: [{ weight: 2, length: 30, width: 20, height: 10 }], declaredCost: 500, payer: 'Recipient', paymentMethod: 'Cash' };
const warehouse = (side, extra = {}) => ({ Ref: side === 'sender' ? senderWarehouseRef : recipientWarehouseRef,
	CityRef: side === 'sender' ? senderCityRef : recipientCityRef, Description: 'Branch 1',
	CategoryOfWarehouse: 'Warehouse', WarehouseStatus: 'Working', PlaceMaxWeightAllowed: '30', ...extra });

test('validates JSON seats, normalizes phone and rejects malformed independent inputs', () => {
	assert.equal(validatePreparation({ ...input, seats: JSON.stringify(input.seats) }).recipientPhone, '+380671234567');
	for (const patch of [{ senderCityRef: 'fake' }, { recipientName: 'Single' }, { recipientPhone: '+123' },
		{ payer: 'Other' }, { paymentMethod: 'Card' }, { declaredCost: 0 }, { declaredCost: 0.001 },
		{ seats: 'null' }, { seats: [] }, { seats: Array(21).fill(input.seats[0]) },
		{ seats: [{ ...input.seats[0], weight: -1 }] }, { seats: [{ ...input.seats[0], length: 'Infinity' }] },
		{ description: 'Books\nsecret' }]) assert.throws(() => validatePreparation({ ...input, ...patch }), ShippingValidationError);
});

test('rejects mismatched refs/cities, inactive/unknown points and weight/dimension limits', () => {
	const valid = validatePreparation(input);
	for (const patch of [{ Ref: recipientWarehouseRef }, { CityRef: recipientCityRef }, { WarehouseStatus: 'Closed' },
		{ CategoryOfWarehouse: 'Unknown' }, { PlaceMaxWeightAllowed: '1' }, { TotalMaxWeightAllowed: '1' },
		{ SendingLimitationsOnDimensions: { Width: '5', Height: '10', Length: '15' } }]) {
		assert.throws(() => validatePoint(warehouse('sender', patch), valid, 'sender'), ShippingValidationError);
	}
	assert.throws(() => validatePoint(warehouse('sender', { PlaceMaxWeightAllowed: 'broken' }), valid, 'sender'));
	assert.equal(validatePoint(warehouse('sender', { PlaceMaxWeightAllowed: '0' }), valid, 'sender').category, 'Warehouse');
	assert.equal(validatePoint(warehouse('sender', { CategoryOfWarehouse: 'Branch' }), valid, 'sender').category, 'Warehouse');
});

test('locker accepts fitting rotated seat, rejects multiple seats, overweight and oversized cargo', () => {
	const raw = warehouse('recipient', { CategoryOfWarehouse: 'Postomat' });
	assert.equal(validatePoint(raw, validatePreparation(input), 'recipient').category, 'Postomat');
	for (const seats of [[...input.seats, ...input.seats], [{ weight: 21, length: 30, width: 20, height: 10 }],
		[{ weight: 2, length: 61, width: 20, height: 10 }]]) {
		assert.throws(() => validatePoint(raw, validatePreparation({ ...input, seats }), 'recipient'), ShippingValidationError);
	}
});

test('estimate payload contains cargo only, uses warehouse service for both branch and locker', () => {
	const valid = validatePreparation(input);
	const sender = validatePoint(warehouse('sender'), valid, 'sender');
	const recipient = validatePoint(warehouse('recipient', { CategoryOfWarehouse: 'Postomat' }), valid, 'recipient');
	const payload = buildEstimatePayload(valid, sender, recipient);
	assert.equal(payload.ServiceType, 'WarehouseWarehouse');
	assert.equal(payload.OptionsSeat[0].volumetricVolume, 0.006);
	assert.equal(payload.Weight, 2);
	assert.equal(payload.SeatsAmount, 1);
	for (const forbidden of ['apiKey', 'Recipient', 'RecipientsPhone', 'Description', 'Sender', 'ContactSender']) assert.equal(forbidden in payload, false);
});

test('re-resolves exact warehouse Ref and only calls allowed read-only methods', async () => {
	const calls = [];
	const api = { async call(model, method, properties, key) {
		calls.push({ model, method, properties, key });
		if (method === 'getWarehouses') return [warehouse(properties.Ref === senderWarehouseRef ? 'sender' : 'recipient')];
		if (method === 'getDocumentPrice') return [{ Cost: '95.5', privateData: 'hidden' }];
		return [{ DeliveryDate: '10.10.2026', privateData: 'hidden' }];
	} };
	const result = await prepareShipment(api, input, 'server-only-secret', new Date('2026-10-08T10:00:00Z'));
	assert.deepEqual(calls.map(call => call.method), ['getWarehouses', 'getWarehouses', 'getDocumentPrice', 'getDocumentDeliveryDate']);
	assert.deepEqual(calls[0].properties, { Ref: senderWarehouseRef, Language: 'UA' });
	assert.equal(result.status, 'prepared_not_issued');
	assert.equal(result.cost, 95.5);
	assert.equal(result.estimatedDeliveryDate, '2026-10-10');
	assert.equal(calls[3].properties.DateTime, '08.10.2026');
	for (const secret of ['server-only-secret', 'hidden', input.recipientName, input.recipientPhone]) assert.equal(JSON.stringify(result).includes(secret), false);
	assert.ok(result.missingOwnerSetup.includes('senderAccount'));
});

test('fails closed before estimating if exact warehouse is absent or belongs to another city', async () => {
	for (const rows of [[], [warehouse('sender'), warehouse('sender')], [warehouse('sender', { CityRef: recipientCityRef })]]) {
		const methods = [];
		await assert.rejects(prepareShipment({ async call(model, method) { methods.push(method); return rows; } }, input), ShippingValidationError);
		assert.equal(methods.includes('getDocumentPrice'), false);
	}
});

test('estimate failures and invalid dates never fabricate price/date or expose provider errors', async () => {
	for (const throws of [false, true]) {
		const result = await prepareShipment({ async call(model, method, properties) {
			if (method === 'getWarehouses') return [warehouse(properties.Ref === senderWarehouseRef ? 'sender' : 'recipient')];
			if (throws) throw new Error('private phone and key');
			return method === 'getDocumentPrice' ? [{ Cost: '-1' }] : [{ DeliveryDate: '31.02.2026' }];
		} }, input);
		assert.equal(result.cost, null);
		assert.equal(result.estimatedDeliveryDate, null);
		assert.equal(JSON.stringify(result).includes('private'), false);
	}
});