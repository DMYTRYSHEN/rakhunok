import test from 'node:test';
import assert from 'node:assert/strict';
import { HISTORY_KEY, HISTORY_TTL, readHistory, rememberTracking } from './src/lib/guest-tracking-history.ts';

function fixture() {
	const values = new Map();
	return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
}

test('history expires exactly after 21 days and removes expired storage', () => {
	const storage = fixture();
	rememberTracking(storage, 'abc123', 1000);
	assert.equal(readHistory(storage, 1000 + HISTORY_TTL - 1).length, 1);
	assert.deepEqual(readHistory(storage, 1000 + HISTORY_TTL), []);
	assert.equal(storage.getItem(HISTORY_KEY), null);
});

test('rechecks renew expiry, normalize and deduplicate; history is bounded', () => {
	const storage = fixture();
	rememberTracking(storage, ' abc123 ', 1000);
	assert.deepEqual(rememberTracking(storage, 'ABC123', 2000), [{ number: 'ABC123', checkedAt: 2000 }]);
	for (let index = 0; index < 40; index++) rememberTracking(storage, `MOCK${index}`, 3000 + index);
	const entries = readHistory(storage, 4000);
	assert.equal(entries.length, 30);
	assert.equal(entries[0].number, 'MOCK39');
});

test('invalid, future, corrupt data and unavailable storage do not break tracking', () => {
	const storage = fixture();
	storage.setItem(HISTORY_KEY, JSON.stringify([{ number: '<script>', checkedAt: 1 }, { number: 'MOCK', checkedAt: 5000 }]));
	assert.deepEqual(readHistory(storage, 1000), []);
	storage.setItem(HISTORY_KEY, '{');
	assert.deepEqual(readHistory(storage), []);
	assert.deepEqual(rememberTracking(storage, 'bad/input'), []);
	const blocked = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); }, removeItem() { throw new Error('blocked'); } };
	assert.doesNotThrow(() => rememberTracking(blocked, 'MOCK'));
});

test('reading unchanged history does not write or renew its timestamp', () => {
	const storage = fixture();
	rememberTracking(storage, 'MOCK', 1000);
	let writes = 0;
	const observed = { ...storage, setItem() { writes++; }, removeItem() { writes++; } };
	assert.deepEqual(readHistory(observed, 2000), [{ number: 'MOCK', checkedAt: 1000 }]);
	assert.equal(writes, 0);
});