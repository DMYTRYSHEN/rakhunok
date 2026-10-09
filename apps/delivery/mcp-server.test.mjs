import test from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createDeliveryMcp } from './src/lib/server/mcp/server.ts';
import { AuthError } from './src/lib/server/tracking/auth.ts';

const shipmentId = '11111111-1111-4111-8111-111111111111';
async function fixture(context, overrides = {}) {
	const calls = [];
	const server = createDeliveryMcp({
		authenticate: async () => { calls.push(['auth']); return { id: 'alice' }; },
		reads: {
			list: async (...args) => { calls.push(['list', ...args]); return { shipments: [], nextOffset: null }; },
			get: async (owner, id) => { calls.push(['get', owner, id]); return id === shipmentId ? { id, deliveryStatus: 'in_transit' } : null; },
			tracking: async (...args) => { calls.push(['tracking', ...args]); return { source: 'stored_snapshot', events: [] }; }
		},
		points: { warehousesPage: async (...args) => { calls.push(['points', ...args]); return { data: [], hasMore: false }; } },
		...overrides
	});
	const client = new Client({ name: 'delivery-test', version: '1.0.0' });
	const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
	await server.connect(serverTransport);
	await client.connect(clientTransport);
	context.after(async () => { await client.close(); await server.close(); });
	return { client, calls };
}

test('SDK initialize, discovery and tool calls use strict schemas and trusted owner', async context => {
	const { client, calls } = await fixture(context);
	assert.equal(client.getServerVersion().name, 'rahunok-delivery-local');
	const { tools } = await client.listTools();
	assert.deepEqual(tools.map(tool => tool.name), ['list_shipments', 'get_shipment', 'get_tracking', 'find_np_points']);
	assert.ok(tools.every(tool => tool.annotations.readOnlyHint && !tool.annotations.destructiveHint));
	await client.callTool({ name: 'list_shipments', arguments: { limit: 2, offset: 3 } });
	assert.deepEqual(calls.slice(-2), [['auth'], ['list', 'alice', 2, 3]]);
	await client.callTool({ name: 'get_shipment', arguments: { id: shipmentId } });
	await client.callTool({ name: 'get_tracking', arguments: { id: shipmentId } });
	await client.callTool({ name: 'find_np_points', arguments: { cityRef: shipmentId } });
	for (const args of [{ ownerId: 'bob' }, { limit: 51 }, { offset: -1 }, { token: 'secret' }]) {
		const before = calls.length;
		const result = await client.callTool({ name: 'list_shipments', arguments: args });
		assert.equal(result.isError, true);
		assert.equal(calls.length, before);
	}
	const missing = await client.callTool({ name: 'get_shipment', arguments: { id: '22222222-2222-4222-8222-222222222222' } });
	assert.deepEqual(missing.structuredContent, { error: { code: 'NOT_FOUND' } });
});

test('each tool rechecks authentication; errors never expose provider secrets', async context => {
	let authenticated = true;
	const { client } = await fixture(context, {
		authenticate: async () => { if (!authenticated) throw new AuthError('AUTH_INVALID'); return { id: 'alice' }; },
		points: { warehousesPage: async () => { throw new Error('PRIVATE_TOKEN'); } }
	});
	assert.equal((await client.callTool({ name: 'list_shipments', arguments: {} })).isError, undefined);
	authenticated = false;
	assert.deepEqual((await client.callTool({ name: 'get_shipment', arguments: { id: shipmentId } })).structuredContent, { error: { code: 'AUTH_REQUIRED' } });
	authenticated = true;
	const failed = await client.callTool({ name: 'find_np_points', arguments: { cityRef: shipmentId } });
	assert.doesNotMatch(JSON.stringify(failed), /PRIVATE_TOKEN/);
	assert.deepEqual(failed.structuredContent, { error: { code: 'UNAVAILABLE' } });
});

test('local rolling limit rejects excess calls and recovers after a minute', async context => {
	let time = 0;
	const { client } = await fixture(context, { clock: () => time });
	for (let index = 0; index < 60; index++) await client.callTool({ name: 'list_shipments', arguments: {} });
	assert.deepEqual((await client.callTool({ name: 'list_shipments', arguments: {} })).structuredContent, { error: { code: 'RATE_LIMITED' } });
	time = 60000;
	assert.equal((await client.callTool({ name: 'list_shipments', arguments: {} })).isError, undefined);
});