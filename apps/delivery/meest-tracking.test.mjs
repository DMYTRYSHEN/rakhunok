import assert from 'node:assert/strict';
import { test } from 'node:test';
import { track } from './src/lib/server/tracking/carriers.ts';

const number = 'TAC-2550636';
const config = { MEEST_TRACKING_TOKEN: 'mock-meest-token' };
const event = (eventCode = 606, extra = {}) => ({ parcelNumber: number, barCode: '711-2550636',
	eventDateTime: '2019-05-02 11:21:42', eventCode, ...extra });
const payload = events => ({ status: 'ok', info: { fieldName: '', message: '', messageDetails: '' }, result: events });
const lookup = events => track('meest', number, config, async () => Response.json(payload(events)));

test('Meest uses fixed HTTPS read-only GET, header token and sanitized official event schema', async () => {
	const result = await track('meest', number, config, async (url, options) => {
		assert.equal(url, `https://api.meest.com/v3.0/openAPI/tracking/${number}`);
		assert.equal(options.method, 'GET');
		assert.equal(options.redirect, 'manual');
		assert.equal(options.body, undefined);
		assert.ok(options.signal instanceof AbortSignal);
		assert.deepEqual(options.headers, { 'Content-Type': 'application/json', Accept: 'application/json', token: config.MEEST_TRACKING_TOKEN });
		return Response.json(payload([event(606, { eventDescr: { descrEN: 'PRIVATE' }, phone: 'PRIVATE', address: 'PRIVATE' })]));
	});
	assert.equal(result.trackingState, 'active');
	assert.equal(result.deliveryStatus, 'accepted');
	assert.equal(result.events[0].occurredAt, null);
	assert.equal(/PRIVATE|mock-meest-token|711-2550636/.test(JSON.stringify(result)), false);
});

test('verified Meest codes normalize conservatively and provider descriptions never decide status', async () => {
	for (const [provider, expected] of Object.entries({ 2: 'label_created', 3: 'cancelled', 606: 'accepted', 303: 'in_transit',
		109: 'return_in_transit', 1216: 'ready_for_pickup', 1315: 'out_for_delivery', 1601: 'delivery_attempt_failed',
		1620: 'refused', 1622: 'delivered', 1629: 'lost', 1630: 'exception', 1825: 'returned', 2225: 'customs',
		5700: 'cancelled', 310: 'unknown', 316: 'unknown', 1213: 'unknown', 2226: 'unknown', 99999: 'unknown' })) {
		const result = await lookup([event(Number(provider), { eventDescr: { descrEN: 'PRIVATE Delivered' } })]);
		assert.equal(result.trackingState, 'active');
		assert.equal(result.deliveryStatus, expected, provider);
		assert.equal(result.providerStatusCode, provider);
		assert.doesNotMatch(JSON.stringify(result), /PRIVATE/);
	}
});

test('Meest matches either exact documented identity and orders/deduplicates timezone-free history', async () => {
	const result = await lookup([event(1622, { eventDateTime: '2019-05-03 11:21:42' }), event(), event()]);
	assert.equal(result.deliveryStatus, 'delivered');
	assert.equal(result.events.length, 2);
	assert.ok(result.events.every(item => item.occurredAt === null));
	assert.equal((await track('meest', '711-2550636', config, async () => Response.json(payload([event()])))).trackingState, 'active');
});

test('Meest rejects malformed envelope, mixed identities, invalid clocks and ambiguous latest status', async () => {
	for (const body of [null, [], {}, { ...payload([event()]), status: 'error', info: { message: 'PRIVATE' } },
		{ ...payload([event()]), info: null }, { ...payload([event()]), info: { message: 'PRIVATE' } }, payload([]), payload(Array(1001).fill(event())),
		payload([event(606, { parcelNumber: 'OTHER', barCode: 'OTHER' })]), payload([event(), event(606, { barCode: 'OTHER' })]),
		payload([event(606, { parcelNumber: 'tac-2550636' })]), payload([event(606, { eventCode: '606' })]),
		payload([event(606, { eventCode: -1 })]), payload([event(606, { eventCode: 1.5 })]),
		payload([event(606, { eventDateTime: '2019-02-30 11:21:42' })]), payload([event(606, { eventDateTime: '2019-05-02 24:21:42' })]),
		payload([event(606, { eventDateTime: 'PRIVATE' })]), payload([event(606), event(1622)])]) {
		const result = await track('meest', number, config, async () => Response.json(body));
		assert.equal(result.trackingState, 'provider_unavailable');
		assert.doesNotMatch(JSON.stringify(result), /PRIVATE/);
	}
});

test('missing Meest token and unsafe number do not issue requests', async () => {
	for (const token of [undefined, '', ' ', 'token\r\nPRIVATE', 'token\n']) {
		assert.equal((await track('meest', number, { MEEST_TRACKING_TOKEN: token }, () => assert.fail('No request'))).trackingState, 'access_denied');
	}
	for (const value of ['', '../secret', 'A--1', 'A/1', 'A?1', 'A#1', 'A%2F1', 'A'.repeat(65)]) {
		assert.equal((await track('meest', value, config, () => assert.fail('No request'))).trackingState, 'needs_verification');
	}
});

test('Meest error responses, redirects, malformed JSON and bounded bodies never expose provider data', async () => {
	for (const status of [301, 302, 307, 308, 400, 404, 500, 503, 401, 403, 429]) {
		const result = await track('meest', number, config, async () => new Response('PRIVATE', { status, headers: { 'Retry-After': '120' } }));
		assert.equal(result.trackingState, status === 429 ? 'rate_limited' : [401, 403].includes(status) ? 'access_denied' : 'provider_unavailable');
		if (status === 429) assert.equal(result.retryAfterSeconds, 120);
		assert.doesNotMatch(JSON.stringify(result), /PRIVATE/);
	}
	for (const response of [() => new Response('PRIVATE'), () => new Response('{}', { headers: { 'Content-Length': '1048576' } }),
		() => new Response(new Uint8Array(1048576)), () => new Response(new Uint8Array([255])), () => new Response(null),
		() => { const response = Response.json(payload([event()])); Object.defineProperty(response, 'redirected', { value: true }); return response; }]) {
		assert.equal((await track('meest', number, config, async () => response())).trackingState, 'provider_unavailable');
	}
	assert.equal((await track('meest', number, config, async () => { throw new Error('PRIVATE'); })).trackingState, 'provider_unavailable');
});

test('Meest timeout aborts fetch and cancels a stalled bounded body', async context => {
	context.mock.timers.enable({ apis: ['setTimeout'] });
	let signal;
	const pending = track('meest', number, config, async (_url, options) => {
		signal = options.signal;
		return new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new Error('PRIVATE')), { once: true }));
	});
	context.mock.timers.tick(8000);
	assert.equal((await pending).trackingState, 'provider_unavailable');
	assert.equal(signal.aborted, true);
	let cancelled = false;
	const stalled = track('meest', number, config, async () => new Response(new ReadableStream({ cancel() { cancelled = true; } })));
	await Promise.resolve(); await Promise.resolve();
	context.mock.timers.tick(8000);
	assert.equal((await stalled).trackingState, 'provider_unavailable');
	assert.equal(cancelled, true);
});