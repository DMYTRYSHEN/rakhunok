import assert from 'node:assert/strict';
import { test } from 'node:test';
import { sanitizeNovaPoshta, sanitizeDetails } from './src/lib/server/tracking/np-details.ts';

test('documented date formats and storage facts survive persistence without inventing UTC or history', () => {
	const details = sanitizeNovaPoshta({ DateCreated: '18-11-2021 11:52:42', DateScan: '2026-10-09 13:42:56', DateFirstDayStorage: '09.10.2026', DatePayedKeeping: '2026-10-16', WarehouseRecipientRef: '11111111-1111-1111-1111-111111111111' });
	assert.equal(details.dates.created.value, '18.11.2021 11:52:42');
	assert.equal(details.dates.scanned.value, '09.10.2026 13:42:56');
	assert.equal(details.dates.scanned.semantics, 'provider-local');
	assert.equal(details.dates.paidStorageStarts.value, '16.10.2026');
	assert.equal(details.destination.warehouseRef, '11111111-1111-1111-1111-111111111111');
	assert.deepEqual(sanitizeDetails(JSON.parse(JSON.stringify(details))), details);
	for (const DateScan of ['0001-01-01 00:00:00', '2026-02-30', '2026-10-09 24:00:00', '2026-10-09T12:00:00Z']) assert.equal(sanitizeNovaPoshta({ DateScan }).dates.scanned, null);
	assert.equal(sanitizeDetails({ accessLevel: 'tracking-number-only', dates: {} }).dates.scanned, null);
});

test('NP details whitelist keeps operational data but never implies ownership of a TTN', () => {
	const details = sanitizeNovaPoshta({ Status: 'At pickup point', CityRecipient: 'Test City', RecipientWarehouseRef: '11111111-1111-1111-1111-111111111111', RecipientAddress: 'PRIVATE HOME', RecipientFullName: 'PRIVATE PERSON', PhoneRecipient: '380000000012', CargoDescriptionString: 'PRIVATE GOODS', apiKey: 'PRIVATE SECRET', DocumentWeight: '1.25', DocumentCost: '120.50', ScheduledDeliveryDate: '08.10.2026 12:30:00' });
	assert.equal(details.accessLevel, 'tracking-number-only');
	assert.equal(details.originalStatus, 'At pickup point');
	assert.equal(details.destination.city, 'Test City');
	assert.equal(details.parties.recipient, '***');
	assert.equal(details.parties.recipientPhone, '***12');
	assert.equal(details.amounts.delivery, '120.50');
	assert.deepEqual(details.dates.estimatedDelivery, { value: '08.10.2026 12:30:00', semantics: 'provider-local', timeZone: 'Europe/Kyiv' });
	assert.equal(JSON.stringify(details).includes('PRIVATE'), false);
});

test('invalid dates, refs, markup and unsafe amounts are dropped', () => {
	const details = sanitizeNovaPoshta({ Status: '<script>', RefCityRecipient: 'not-a-ref', DocumentCost: Number.MAX_SAFE_INTEGER + 1, ScheduledDeliveryDate: '30.02.2026', RecipientDateTime: '08.10.2026 24:00:00' });
	assert.equal(details.originalStatus, null);
	assert.equal(details.destination.cityRef, null);
	assert.equal(details.amounts.delivery, null);
	assert.equal(details.dates.estimatedDelivery, null);
	assert.equal(details.dates.received, null);
});