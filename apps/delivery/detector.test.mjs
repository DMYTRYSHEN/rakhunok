import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CarrierDetector } from './src/lib/server/services/detector.ts';
import { normalizeTrackingNumber, suggestCarrier } from './src/lib/carrier-detection.ts';

test('business suggestions normalize numbers and leave ambiguous formats for manual selection', () => {
	assert.equal(normalizeTrackingNumber(' ra 123456789 ua '), 'RA123456789UA');
	for (const number of ['20450000000000', '59000000000000', '20 4500 0000 0000']) assert.equal(suggestCarrier(number), 'nova_poshta');
	for (const number of ['0101010101010', 'ra123456789ua']) assert.equal(suggestCarrier(number), 'ukrposhta');
	for (const number of ['', '2045', '99999999999999', 'RA123456789CN', 'CV123456789PL', '123456789', '<script>', '2'.repeat(65)]) assert.equal(suggestCarrier(number), null);
});

test('format candidates are never carrier confirmations', () => {
	for (const number of ['20450000000000', '0101010101010', 'RA123456789UA']) {
		assert.notEqual(CarrierDetector.detect(number).state, 'confirmed');
	}
});

test('unknown carrier hints are rejected', () => {
	assert.equal(CarrierDetector.detect('20450000000000', 'attacker').state, 'unsupported');
	assert.equal(CarrierDetector.detect('20450000000000', 'nova_poshta').carrierCode, 'nova_poshta');
});