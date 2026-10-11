import assert from 'node:assert/strict';
import { test } from 'node:test';
import { get } from 'svelte/store';
import { createReadinessNoticeSession, readinessNoticeScope, observeReadinessNoticeScope } from '../src/lib/features/dashboard/business-settings/readiness-notice-session.ts';

test('deadline does not restart on recheck or remount and expiry acknowledges', () => {
	const session = createReadinessNoticeSession();
	assert.equal(session.forScope('owner').start(1000), 9000);
	assert.equal(session.forScope('owner').start(5000), 9000);
	assert.equal(session.forScope('owner').start(9000), null);
	assert.equal(get(session.forScope('owner')).acknowledged, true);
	assert.equal(session.forScope('owner').start(20000), null);
});

test('close suppresses all later advice only in that owner/session scope', () => {
	const session = createReadinessNoticeSession();
	session.forScope('owner').acknowledge();
	assert.equal(session.forScope('owner').start(0), null);
	assert.equal(session.forScope('other-owner').start(0), 8000);
	assert.equal(session.forScope('new-session').start(0), 8000);
});

test('reload preserves acknowledgment and original deadline without storing identity', async () => {
	const values = new Map();
	const storage = { getItem: (key) => values.get(key), setItem: (key, value) => values.set(key, value) };
	const scope = await readinessNoticeScope('synthetic-user', 'synthetic-merchant', 'synthetic-session');
	const first = createReadinessNoticeSession(storage).forScope(scope);
	first.start(1000);
	assert.equal(createReadinessNoticeSession(storage).forScope(scope).start(4000), 9000);
	first.acknowledge();
	assert.equal(createReadinessNoticeSession(storage).forScope(scope).start(5000), null);
	assert.match(scope, /^[a-f0-9]{64}$/);
	assert.equal(JSON.stringify([...values]).includes('synthetic'), false);
	assert.notEqual(scope, await readinessNoticeScope('synthetic-user', 'synthetic-merchant', 'new-session'));
	assert.notEqual(scope, await readinessNoticeScope('synthetic-user', 'other-merchant', 'synthetic-session'));
	assert.notEqual(scope, await readinessNoticeScope('other-user', 'synthetic-merchant', 'synthetic-session'));
});

test('blocked or malformed storage does not break the in-memory fallback', () => {
	for (const storage of [{ getItem() { throw Error(); }, setItem() { throw Error(); } }, { getItem: () => '{', setItem() {} }]) {
		const record = createReadinessNoticeSession(storage).forScope('owner');
		assert.equal(record.start(0), 8000);
		record.acknowledge();
		assert.equal(record.start(1), null);
	}
});

test('auth refresh preserves scope; sign-out and stale async results cannot restore it', async () => {
	const token = (sessionId, extra = '') => ({ user: { id: 'user' }, access_token: `header.${btoa(JSON.stringify({ session_id: sessionId, extra }))}.signature` });
	let callback;
	let unsubscribed = false;
	let completeInitial;
	const auth = {
		onAuthStateChange(handler) { callback = handler; return { data: { subscription: { unsubscribe() { unsubscribed = true; } } } }; },
		getSession: () => new Promise(resolve => { completeInitial = resolve; })
	};
	const changes = [];
	let notify;
	const nextChange = () => new Promise(resolve => { notify = resolve; });
	const stop = observeReadinessNoticeScope(auth, { userId: 'user', merchantId: 'merchant' }, scope => { changes.push(scope); notify?.(scope); });
	let next = nextChange();
	callback('SIGNED_IN', token('first'));
	const first = await next;
	completeInitial({ data: { session: token('stale-initial') } });
	await Promise.resolve();
	next = nextChange();
	callback('TOKEN_REFRESHED', token('first', 'new-access-token'));
	assert.equal(await next, first);
	next = nextChange();
	callback('SIGNED_IN', token('second'));
	assert.notEqual(await next, first);
	callback('SIGNED_OUT', null);
	assert.equal(changes.at(-1), null);
	callback('SIGNED_IN', { ...token('other'), user: { id: 'other-user' } });
	assert.equal(changes.at(-1), null);
	callback('SIGNED_IN', token(undefined));
	assert.equal(changes.at(-1), null);
	callback('SIGNED_IN', token('stale-async'));
	callback('SIGNED_OUT', null);
	await new Promise(resolve => setImmediate(resolve));
	assert.equal(changes.at(-1), null);
	stop();
	assert.equal(unsubscribed, true);
	const count = changes.length;
	callback('SIGNED_IN', token('after-destroy'));
	await new Promise(resolve => setImmediate(resolve));
	assert.equal(changes.length, count);
});