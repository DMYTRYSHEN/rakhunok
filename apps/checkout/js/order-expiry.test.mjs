import assert from 'node:assert/strict';
import test from 'node:test';

import {
	formatRemainingTime,
	getOrderRemainingSeconds,
	getOrderTotalTtlSeconds,
	isOrderFresh
} from './order-expiry.js';

const now = new Date('2026-08-26T10:00:00.000Z').getTime();

test('uses expires_at as the canonical deadline', () => {
	const order = {
		created_at: '2026-08-26T09:00:00.000Z',
		expires_at: '2026-08-26T10:30:00.000Z'
	};

	assert.equal(getOrderRemainingSeconds(order, now), 1800);
	assert.equal(getOrderTotalTtlSeconds(order), 5400);
	assert.equal(isOrderFresh(order, now), true);
	assert.equal(isOrderFresh(order, new Date('2026-08-26T10:30:00.000Z').getTime()), false);
});

test('falls back to 30 minutes from created_at for legacy orders', () => {
	const order = { created_at: '2026-08-26T09:45:00.000Z' };

	assert.equal(getOrderRemainingSeconds(order, now), 900);
	assert.equal(getOrderTotalTtlSeconds(order), 1800);
});

test('supports an explicit legacy fallback in minutes', () => {
	const order = { created_at: '2026-08-26T09:00:00.000Z' };
	assert.equal(getOrderRemainingSeconds(order, now, 120), 3600);
});

test('formats minute and hour durations', () => {
	assert.equal(formatRemainingTime(65), '01:05');
	assert.equal(formatRemainingTime(3665), '01:01:05');
});

test('treats an explicit null expiry as unlimited', () => {
	const order = {
		created_at: '2026-08-26T09:00:00.000Z',
		expires_at: null
	};

	assert.equal(getOrderRemainingSeconds(order, now), Number.POSITIVE_INFINITY);
	assert.equal(getOrderTotalTtlSeconds(order), Number.POSITIVE_INFINITY);
	assert.equal(isOrderFresh(order, now), true);
});
