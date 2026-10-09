import assert from 'node:assert/strict';
import { test } from 'node:test';
import { track } from './src/lib/server/tracking/carriers.ts';

const number = 'MOCKONLY0001';
const config = { UKRPOSHTA_TRACKING_TOKEN: 'mock-token' };
const json = payload => async () => Response.json(payload);
const np = (StatusCode, extra = {}) => ({ success: true, data: [{ Number: number, StatusCode, ...extra }], errors: [], errorCodes: [] });
const upEvent = (event, date = '2026-10-07T12:00:00', extra = {}) => ({ barcode: number, event, date, step: 1, ...extra });
const up = events => ({ found: { [number]: events }, notFound: [] });

test('NP uses documented JSON model, minimal documents and optional API key', async () => {
	for (const key of [undefined, 'mock-key']) {
		let calls = 0;
		const result = await track('nova_poshta', number, { NOVA_POSHTA_API_KEY: key }, async (url, options) => {
			calls++;
			assert.equal(url, 'https://api.novaposhta.ua/v2.0/json/');
			assert.equal(options.method, 'POST');
			assert.equal(options.redirect, 'error');
			assert.ok(options.signal instanceof AbortSignal);
			assert.deepEqual(JSON.parse(options.body), {
				...(key ? { apiKey: key } : {}), modelName: 'TrackingDocumentGeneral',
				calledMethod: 'getStatusDocuments', methodProperties: { Documents: [{ DocumentNumber: number }] }
			});
			return Response.json(np('7'));
		});
		assert.equal(calls, 1);
		assert.equal(result.trackingState, 'active');
		assert.equal(result.deliveryStatus, 'ready_for_pickup');
		assert.deepEqual(result.events, []);
		assert.ok(Number.isFinite(Date.parse(result.checkedAt)));
	}
});

test('UP requires token and uses documented read-only history/notFound request', async () => {
	for (const token of [undefined, '', ' ', 'mock\r\ntoken', 'mock-token\n']) {
		assert.equal((await track('ukrposhta', number, { UKRPOSHTA_TRACKING_TOKEN: token }, () => assert.fail('No request allowed'))).trackingState, 'access_denied');
	}
	const result = await track('ukrposhta', number, { UKRPOSHTA_TRACKING_TOKEN: ' mock-token ' }, async (url, options) => {
		assert.equal(url, 'https://www.ukrposhta.ua/status-tracking/0.0.1/statuses/with-not-found');
		assert.equal(options.headers.Authorization, 'Bearer mock-token');
		assert.equal(options.method, 'POST');
		assert.equal(options.redirect, 'error');
		assert.deepEqual(JSON.parse(options.body), [number]);
		return Response.json(up([upEvent(10100)]));
	});
	assert.equal(result.deliveryStatus, 'accepted');
});

test('verified NP status mappings do not confuse refusal, return and payment', async () => {
	for (const [provider, expected] of Object.entries({ 1: 'label_created', 2: 'cancelled', 4: 'in_transit', 41: 'in_transit', 7: 'ready_for_pickup', 8: 'ready_for_pickup', 9: 'delivered', 10: 'delivered', 11: 'delivered', 102: 'refused', 103: 'refused', 106: 'delivered', 111: 'delivery_attempt_failed', 124: 'exception' })) {
		assert.equal((await track('nova_poshta', number, {}, json(np(provider)))).deliveryStatus, expected);
	}
});

test('verified UP mappings and sender-return reason preserve raw code', async () => {
	for (const [provider, expected] of Object.entries({ 10100: 'accepted', 20700: 'in_transit', 21700: 'ready_for_pickup', 29500: 'out_for_delivery', 31100: 'delivery_attempt_failed', 31200: 'return_in_transit', 41000: 'delivered', 41010: 'returned', 48000: 'delivered', 80700: 'customs', 10602: 'cancelled' })) {
		assert.equal((await track('ukrposhta', number, config, json(up([upEvent(provider)])))).deliveryStatus, expected);
	}
	const result = await track('ukrposhta', number, config, json(up([upEvent('41000', undefined, { eventReason_id: 10 })])));
	assert.equal(result.deliveryStatus, 'returned');
	assert.equal(result.providerStatusCode, '41000');
});

test('unknown numeric provider codes remain unknown, never infer status from labels', async () => {
	for (const carrier of ['nova_poshta', 'ukrposhta']) {
		const payload = carrier === 'nova_poshta' ? np('99999', { Status: 'Delivered' }) : up([upEvent('99999', undefined, { eventName: 'Delivered' })]);
		const result = await track(carrier, number, config, json(payload));
		assert.equal(result.trackingState, 'active');
		assert.equal(result.deliveryStatus, 'unknown');
		assert.equal(result.providerStatusCode, '99999');
	}
});

test('not found is only an explicit provider result; generic 404 and failures are outages', async () => {
	assert.equal((await track('nova_poshta', number, {}, json(np(3)))).trackingState, 'not_found');
	assert.equal((await track('ukrposhta', number, config, json({ found: {}, notFound: [number] }))).trackingState, 'not_found');
	assert.equal((await track('ukrposhta', number, config, json({ code: 'UPE02000' }))).trackingState, 'unsupported');
	for (const carrier of ['nova_poshta', 'ukrposhta']) {
		for (const status of [400, 404, 500, 503]) assert.equal((await track(carrier, number, config, async () => new Response('private error', { status }))).trackingState, 'provider_unavailable');
		assert.equal((await track(carrier, number, config, async () => { throw new Error('private'); })).trackingState, 'provider_unavailable');
	}
	assert.equal((await track('nova_poshta', number, {}, json({ success: false, data: [], errors: ['private'] }))).trackingState, 'provider_unavailable');
});

test('401/403 and 429 are separate states with valid Retry-After preserved', async () => {
	for (const carrier of ['nova_poshta', 'ukrposhta']) {
		for (const status of [401, 403]) assert.equal((await track(carrier, number, config, async () => new Response(null, { status }))).trackingState, 'access_denied');
		for (const [header, expected] of [['120', 120], ['999999', 999999], ['9007199254740992', undefined], ['bad', undefined], ['-1', undefined]]) {
			const result = await track(carrier, number, config, async () => new Response(null, { status: 429, headers: { 'Retry-After': header } }));
			assert.equal(result.trackingState, 'rate_limited');
			assert.equal(result.retryAfterSeconds, expected);
		}
	}
	const date = new Date(Date.now() + 60000).toUTCString();
	const result = await track('nova_poshta', number, {}, async () => new Response(null, { status: 429, headers: { 'Retry-After': date } }));
	assert.ok(result.retryAfterSeconds >= 58 && result.retryAfterSeconds <= 60);
});

test('provider history is chronological and only explicitly zoned occurrence times survive', async () => {
	const history = [upEvent(41000, '2026-10-07T14:00:00', { step: 2 }), upEvent(10100, '2026-10-07T12:00:00', { step: 3 })];
	const result = await track('ukrposhta', number, config, json(up(history)));
	assert.equal(result.deliveryStatus, 'delivered');
	assert.deepEqual(result.events.map(event => event.deliveryStatus), ['accepted', 'delivered']);
	assert.ok(result.events.every(event => event.occurredAt === null));
	for (const date of ['2026-10-07T12:00:00Z', '2026-10-07T12:00:00+03:00']) {
		assert.equal((await track('ukrposhta', number, config, json(up([upEvent(10100, date)])))).events[0].occurredAt, date);
	}
	assert.equal((await track('ukrposhta', number, config, json(up([upEvent(10100, '2026-02-30T12:00:00Z')])))).trackingState, 'provider_unavailable');
});

test('invalid clock values and ambiguous latest history do not assert delivery', async () => {
	for (const date of ['2026-10-07T24:00:00Z', '2026-10-07T12:60:00Z', '2026-10-07T12:00:60Z', '2026-10-07T12:00:00+24:00']) {
		assert.equal((await track('ukrposhta', number, config, json(up([upEvent(41000, date)])))).trackingState, 'provider_unavailable');
	}
	const conflict = up([upEvent(41000), upEvent(31200)]);
	assert.equal((await track('ukrposhta', number, config, json(conflict))).trackingState, 'provider_unavailable');
	const mixedZones = up([upEvent(10100), upEvent(41000, '2026-10-07T13:00:00Z')]);
	assert.equal((await track('ukrposhta', number, config, json(mixedZones))).trackingState, 'provider_unavailable');
	const duplicate = upEvent(10100);
	const first = await track('ukrposhta', number, config, json(up([duplicate, duplicate])));
	const second = await track('ukrposhta', number, config, json(up([duplicate])));
	assert.equal(first.events.length, 1);
	assert.equal(first.events[0].key, second.events[0].key);
});

test('PII, route names, secret and payload never escape sanitized result', async () => {
	const privateFields = { eventName: 'PRIVATE', name: 'PRIVATE', PhoneRecipient: 'PRIVATE', RecipientFullName: 'PRIVATE', route: 'PRIVATE', payload: 'PRIVATE' };
	for (const carrier of ['nova_poshta', 'ukrposhta']) {
		const payload = carrier === 'nova_poshta' ? np('7', privateFields) : up([upEvent(21700, undefined, privateFields)]);
		const result = await track(carrier, number, config, json(payload));
		assert.equal(JSON.stringify(result).includes('PRIVATE'), false);
		assert.equal(JSON.stringify(result).includes('mock-token'), false);
		assert.deepEqual(Object.keys(result).sort(), ['carrier', 'trackingNumber', 'trackingState', 'deliveryStatus', 'providerStatusCode', 'providerStatusLabel', 'checkedAt', 'events', ...(carrier === 'nova_poshta' ? ['details'] : [])].sort());
		for (const event of result.events) assert.deepEqual(Object.keys(event).sort(), ['key', 'deliveryStatus', 'label', 'occurredAt'].sort());
	}
});

test('mismatched shipment, malformed envelopes and conflicting absence never activate', async () => {
	for (const payload of [np('7', { Number: 'OTHER' }), { success: true, data: [] }, np('secret text'), { ...np(7), errors: ['error'] }]) {
		assert.equal((await track('nova_poshta', number, {}, json(payload))).trackingState, 'provider_unavailable');
	}
	for (const payload of [[], up([]), up([upEvent(10100, undefined, { barcode: 'OTHER' })]), { ...up([upEvent(10100)]), notFound: [number] }]) {
		assert.equal((await track('ukrposhta', number, config, json(payload))).trackingState, 'provider_unavailable');
	}
});

test('redirects, invalid JSON, declared and streamed 1 MiB responses are rejected', async () => {
	const responses = [
		() => new Response(null, { status: 302 }),
		() => new Response('not JSON'),
		() => new Response('{}', { headers: { 'Content-Length': '1048576' } }),
		() => new Response(new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(524288)); controller.enqueue(new Uint8Array(524288)); controller.close(); } }))
	];
	for (const response of responses) assert.equal((await track('nova_poshta', number, {}, async () => response())).trackingState, 'provider_unavailable');
});

test('timeout aborts both fetch and stalled response body', async context => {
	context.mock.timers.enable({ apis: ['setTimeout'] });
	let signal;
	const pending = track('nova_poshta', number, {}, async (_url, options) => {
		signal = options.signal;
		return new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true }));
	});
	context.mock.timers.tick(8000);
	assert.equal((await pending).trackingState, 'provider_unavailable');
	assert.equal(signal.aborted, true);
	let cancelled = false;
	const stalled = track('nova_poshta', number, {}, async () => new Response(new ReadableStream({ cancel() { cancelled = true; } })));
	await Promise.resolve();
	await Promise.resolve();
	context.mock.timers.tick(8000);
	assert.equal((await stalled).trackingState, 'provider_unavailable');
	assert.equal(cancelled, true);
});

test('input guards are safety bounds, not carrier format confirmation', async () => {
	for (const value of ['', '../secret', 'A'.repeat(65)]) assert.equal((await track('nova_poshta', value, {}, () => assert.fail('No request allowed'))).trackingState, 'needs_verification');
	assert.equal((await track('unsupported', number, {}, () => assert.fail('No request allowed'))).trackingState, 'unsupported');
});

test('UP March 2025 contract covers storage, deletion, customs and international events', async () => {
	const statuses = {
		10601: 'unknown', 10603: 'cancelled', 21400: 'exception',
		80800: 'in_transit', 80821: 'customs', 80829: 'unknown', 80842: 'unknown',
		24100: 'exception', 24200: 'exception', 24300: 'exception',
		24400: 'in_transit', 24500: 'in_transit', 27200: 'in_transit', 27900: 'in_transit',
		29200: 'in_transit', 29300: 'in_transit', 35100: 'in_transit', 35200: 'in_transit',
		35300: 'delivery_attempt_failed', 35400: 'exception', 35600: 'in_transit',
		35700: 'exception', 36000: 'ready_for_pickup', 36200: 'exception',
		36300: 'exception', 36400: 'exception', 36500: 'exception', 55800: 'exception',
		55900: 'exception', 56100: 'exception', 67300: 'in_transit', 77600: 'in_transit',
		97700: 'in_transit', 107400: 'in_transit', 107800: 'in_transit',
		2100: 'in_transit', 2200: 'in_transit', 2201: 'in_transit', 3006: 'in_transit',
		4001: 'in_transit', 4014: 'in_transit', 4021: 'in_transit', 4040: 'in_transit',
		4082: 'return_in_transit', 5003: 'in_transit', 5004: 'returned', 5005: 'customs'
	};
	for (let provider = 80830; provider <= 80841; provider++) statuses[provider] = 'customs';
	for (const [provider, expected] of Object.entries(statuses)) {
		const result = await track('ukrposhta', number, config, json(up([upEvent(provider)])));
		assert.equal(result.deliveryStatus, expected, provider);
		assert.equal(result.providerStatusCode, provider);
	}
});