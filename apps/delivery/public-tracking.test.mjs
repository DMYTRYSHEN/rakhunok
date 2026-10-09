import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PublicTracking, PublicTrackingError } from './src/lib/server/tracking/public-tracking.ts';

const npNumber = '20400000000001';
const upNumber = '1234567890123';
const config = { NOVA_POSHTA_API_KEY: 'private-np-key', UKRPOSHTA_TRACKING_TOKEN: 'up-token', extra: 'secret' };
const keys = ['carrier', 'checkedAt', 'deliveryStatus', 'providerStatusCode', 'trackingNumber', 'trackingState'];
const noTransport = async () => { throw new Error('Unexpected transport'); };
const successful = async (carrier, trackingNumber) => ({
	carrier, trackingNumber, trackingState: 'active', deliveryStatus: 'in_transit',
	providerStatusCode: '4', providerStatusLabel: 'PRIVATE_LABEL', checkedAt: 'PRIVATE_TIMESTAMP',
	events: [{ key: 'PRIVATE_EVENT', label: 'PRIVATE_ADDRESS' }],
	details: { phone: 'PRIVATE_PHONE', address: 'PRIVATE_ADDRESS' }, original: 'PRIVATE_ORIGINAL'
});
const numbered = index => String(20400000000000 + index);

test('explicit Meest receives only its token and caches separately from auto-detected carrier', async () => {
	const calls = [];
	const service = new PublicTracking(noTransport, async (...args) => { calls.push(args); return successful(...args); }, () => 0);
	const credentials = { ...config, MEEST_TRACKING_TOKEN: 'meest-token' };
	await assert.rejects(service.lookup('TAC-2550636', credentials), PublicTrackingError);
	assert.deepEqual(Object.keys(await service.lookup(' tac-2550636 ', credentials, 'meest')).sort(), keys);
	await service.lookup(npNumber, credentials, 'meest');
	await service.lookup(npNumber, credentials);
	assert.deepEqual(calls.map(args => args.slice(0, 3)), [
		['meest', 'TAC-2550636', { MEEST_TRACKING_TOKEN: 'meest-token' }],
		['meest', npNumber, { MEEST_TRACKING_TOKEN: 'meest-token' }], ['nova_poshta', npNumber, {}]
	]);
	for (const carrier of ['other', '', 42]) await assert.rejects(service.lookup(npNumber, credentials, carrier), PublicTrackingError);
});

test('actual NP parser uses fake transport without global key and exposes only safe scalars', async () => {
	let calls = 0;
	const transport = async (url, options) => {
		calls++;
		assert.equal(url, 'https://api.novaposhta.ua/v2.0/json/');
		const body = JSON.parse(options.body);
		assert.equal(Object.hasOwn(body, 'apiKey'), false);
		assert.deepEqual(body.methodProperties.Documents, [{ DocumentNumber: npNumber }]);
		assert.equal(JSON.stringify(options).includes('private-np-key'), false);
		return Response.json({ success: true, data: [{
			Number: npNumber, StatusCode: '4', Status: 'PRIVATE_LABEL',
			PhoneRecipient: 'PRIVATE_PHONE', RecipientAddress: 'PRIVATE_ADDRESS',
			RecipientFullName: '\u0406\u043c\u0027\u044f'
		}] });
	};
	const service = new PublicTracking(transport, undefined, () => 0);
	assert.deepEqual(await service.lookup(` ${npNumber} `, config), {
		carrier: 'nova_poshta', trackingNumber: npNumber, trackingState: 'active',
		deliveryStatus: 'in_transit', checkedAt: '1970-01-01T00:00:00.000Z', providerStatusCode: '4'
	});
	assert.equal(calls, 1);
});

test('injected tracker receives NP empty config and UP token only with normalized numbers', async () => {
	const calls = [];
	const tracker = async (...args) => { calls.push(args); return successful(...args); };
	const service = new PublicTracking(noTransport, tracker, () => 1000);
	for (const number of [npNumber, upNumber, ' rr123456789ua ']) {
		const result = await service.lookup(number, config);
		assert.deepEqual(Object.keys(result).sort(), keys);
		assert.equal(Object.values(result).every(value => value === null || typeof value === 'string'), true);
		assert.equal(JSON.stringify(result).includes('PRIVATE'), false);
	}
	assert.deepEqual(calls.map(args => args.slice(0, 3)), [
		['nova_poshta', npNumber, {}],
		['ukrposhta', upNumber, { UKRPOSHTA_TRACKING_TOKEN: 'up-token' }],
		['ukrposhta', 'RR123456789UA', { UKRPOSHTA_TRACKING_TOKEN: 'up-token' }]
	]);
	assert.equal(calls.every(args => args[3] === noTransport), true);
});

test('invalid inputs reject with static status 400 error and never call upstream', async () => {
	let calls = 0;
	const service = new PublicTracking(noTransport, async () => { calls++; });
	for (const number of ['', '123', '123456789012345', 'RR12345678UA', 'RR123456789U1',
		'RR123456789UA\nextra', '\u0420\u0420123456789UA', ' '.repeat(65), ` ${npNumber}${' '.repeat(50)}`, null, 123]) {
		await assert.rejects(service.lookup(number, config), error =>
			error instanceof PublicTrackingError && error.status === 400 && error.message === 'Invalid tracking number');
	}
	assert.equal(calls, 0);
});

test('active TTL is 30 seconds and cache returns independent clones', async () => {
	let now = 0;
	let calls = 0;
	const service = new PublicTracking(noTransport, async (...args) => { calls++; return successful(...args); }, () => now);
	const first = await service.lookup(npNumber, config);
	first.deliveryStatus = 'PRIVATE_MUTATION';
	first.details = 'PRIVATE_DETAILS';
	now = 29_999;
	const cached = await service.lookup(npNumber, config);
	assert.equal(cached.deliveryStatus, 'in_transit');
	assert.deepEqual(Object.keys(cached).sort(), keys);
	assert.equal(calls, 1);
	now = 30_000;
	await service.lookup(npNumber, config);
	assert.equal(calls, 2);
});

test('failures and thrown errors are safe and cached for exactly 5 seconds', async () => {
	for (const state of ['not_found', 'access_denied', 'rate_limited', 'throw']) {
		let now = 0;
		let calls = 0;
		const service = new PublicTracking(noTransport, async (...args) => {
			calls++;
			if (state === 'throw') throw new Error('PRIVATE_PHONE');
			return { ...await successful(...args), trackingState: state };
		}, () => now);
		const result = await service.lookup(npNumber, config);
		assert.equal(result.trackingState, state === 'throw' ? 'provider_unavailable' : state);
		assert.equal(JSON.stringify(result).includes('PRIVATE'), false);
		now = 4999;
		await service.lookup(npNumber, config);
		assert.equal(calls, 1);
		now = 5000;
		await service.lookup(npNumber, config);
		assert.equal(calls, 2);
	}
});

test('matching carrier, number and valid enums are required; provider code cannot contain PII', async () => {
	for (const change of [
		{ carrier: 'ukrposhta' }, { trackingNumber: numbered(2) },
		{ trackingState: 'PRIVATE_PHONE' }, { deliveryStatus: 'PRIVATE_ADDRESS' }
	]) {
		const service = new PublicTracking(noTransport, async (...args) => ({ ...await successful(...args), ...change }), () => 0);
		const result = await service.lookup(npNumber, config);
		assert.equal(result.trackingState, 'provider_unavailable');
		assert.equal(result.deliveryStatus, 'unknown');
		assert.equal(result.providerStatusCode, null);
		assert.deepEqual(Object.keys(result).sort(), keys);
	}
	for (const providerStatusCode of ['PRIVATE_PHONE', '1234567890123', 4, null]) {
		const service = new PublicTracking(noTransport, async (...args) => ({
			...await successful(...args), providerStatusCode
		}), () => 0);
		assert.equal((await service.lookup(npNumber, config)).providerStatusCode, null);
	}
});

test('same normalized number coalesces inflight work and isolates every result', async () => {
	let release;
	let calls = 0;
	const gate = new Promise(resolve => { release = resolve; });
	const service = new PublicTracking(noTransport, async (...args) => {
		calls++;
		await gate;
		return successful(...args);
	}, () => 0);
	const requests = Array.from({ length: 120 }, (_, index) => service.lookup(index % 2 ? ` ${npNumber} ` : npNumber, config));
	await Promise.resolve();
	assert.equal(calls, 1);
	release();
	const results = await Promise.all(requests);
	assert.equal(new Set(results).size, 120);
	results[0].trackingState = 'PRIVATE_MUTATION';
	assert.equal(results[1].trackingState, 'active');
	assert.equal((await service.lookup(npNumber, config)).trackingState, 'active');
});

test('global uncached rolling limit is 30 per minute across carriers; cache remains readable', async () => {
	let now = 0;
	let calls = 0;
	const service = new PublicTracking(noTransport, async (...args) => { calls++; return successful(...args); }, () => now);
	for (let index = 1; index <= 29; index++) await service.lookup(numbered(index), config);
	await service.lookup(upNumber, config);
	const limited = await service.lookup('RR123456789UA', config);
	assert.equal(limited.trackingState, 'rate_limited');
	assert.deepEqual(Object.keys(limited).sort(), keys);
	assert.equal(limited.providerStatusCode, null);
	assert.equal((await service.lookup(npNumber, config)).trackingState, 'active');
	now = 59_999;
	assert.equal((await service.lookup(numbered(31), config)).trackingState, 'rate_limited');
	assert.equal(calls, 30);
	now = 60_000;
	assert.equal((await service.lookup(numbered(31), config)).trackingState, 'active');
	assert.equal(calls, 31);
});

test('cache capacity is 100 even when concurrent completions share a timestamp', async () => {
	let now = 0;
	let release;
	let calls = 0;
	const gate = new Promise(resolve => { release = resolve; });
	const service = new PublicTracking(noTransport, async (...args) => {
		calls++;
		await gate;
		return successful(...args);
	}, () => now);
	const pending = [];
	for (let index = 1; index <= 100; index++) {
		if (index % 30 === 1) now += 60_000;
		pending.push(service.lookup(numbered(index), config));
	}
	release();
	await Promise.all(pending);
	assert.equal(calls, 100);
	await service.lookup(numbered(101), config);
	await service.lookup(numbered(2), config);
	assert.equal(calls, 101);
	await service.lookup(numbered(1), config);
	assert.equal(calls, 102);
});

test('inflight capacity is 100; existing work still coalesces and slots are released', async () => {
	let now = 0;
	let release;
	let calls = 0;
	const gate = new Promise(resolve => { release = resolve; });
	const service = new PublicTracking(noTransport, async (...args) => {
		calls++;
		await gate;
		return successful(...args);
	}, () => now);
	const pending = [];
	for (let index = 1; index <= 100; index++) {
		if (index % 30 === 1) now += 60_000;
		pending.push(service.lookup(numbered(index), config));
	}
	assert.equal((await service.lookup(numbered(101), config)).trackingState, 'rate_limited');
	pending.push(service.lookup(npNumber, config));
	await Promise.resolve();
	assert.equal(calls, 100);
	release();
	await Promise.all(pending);
	assert.equal((await service.lookup(numbered(101), config)).trackingState, 'active');
	assert.equal(calls, 101);
});

test('actual Meest public parser exposes only verified scalar status and isolates credentials', async () => {
	const service = new PublicTracking(async (url, options) => {
		assert.equal(url, 'https://api.meest.com/v3.0/openAPI/tracking/711-2550636');
		assert.equal(options.method, 'GET');
		assert.equal(options.headers.token, 'meest-token');
		assert.doesNotMatch(JSON.stringify(options), /private-np-key|up-token|secret/);
		return Response.json({ status: 'ok', info: { fieldName: '', message: '', messageDetails: '' }, result: [{
			parcelNumber: 'TAC-2550636', barCode: '711-2550636', eventCode: 1622, eventDateTime: '2019-05-02 11:21:42',
			eventDescr: { descrEN: 'PRIVATE_NAME' }, eventCityDescr: { descrEN: 'PRIVATE_ADDRESS' }, phone: 'PRIVATE_PHONE'
		}] });
	}, undefined, () => 0);
	assert.deepEqual(await service.lookup('711-2550636', { ...config, MEEST_TRACKING_TOKEN: 'meest-token' }, 'meest'), {
		carrier: 'meest', trackingNumber: '711-2550636', trackingState: 'active', deliveryStatus: 'delivered',
		checkedAt: '1970-01-01T00:00:00.000Z', providerStatusCode: '1622'
	});
	for (const number of ['../private', '711--2550636', '\u0422AC-2550636', 'A'.repeat(65)]) {
		await assert.rejects(service.lookup(number, config, 'meest'), PublicTrackingError);
	}
	const missing = new PublicTracking(() => assert.fail('Missing token must not fetch'));
	assert.equal((await missing.lookup('711-2550636', config, 'meest')).trackingState, 'access_denied');
});