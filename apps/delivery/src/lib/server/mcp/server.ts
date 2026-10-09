import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { AuthError } from '../tracking/auth.ts';
import type { DeliveryReadModel } from './read-model.ts';
import type { NovaPoshtaApi } from '../tracking/np-api.ts';

const page = { limit: z.number().int().min(1).max(50).default(20), offset: z.number().int().min(0).max(10000).default(0) };
const id = z.string().uuid();
const output = z.object({ data: z.record(z.string(), z.unknown()).optional(), error: z.object({ code: z.string() }).optional() });
const annotations = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };

export function createDeliveryMcp(dependencies: {
	authenticate: () => Promise<{ id: string }>;
	reads: DeliveryReadModel;
	points: Pick<NovaPoshtaApi, 'warehousesPage'>;
	clock?: () => number;
}) {
	const server = new McpServer({ name: 'rahunok-delivery-local', version: '0.1.0' }, { maxToolInputElements: 16 });
	const clock = dependencies.clock ?? Date.now;
	let calls: number[] = [];
	let active = 0;
	const error = (code: string) => ({ isError: true, content: [{ type: 'text' as const, text: code }], structuredContent: { error: { code } } });
	async function run(operation: (ownerId: string) => Promise<Record<string, unknown> | null>) {
		const now = clock();
		calls = calls.filter(time => time > now - 60000);
		if (calls.length >= 60 || active >= 4) return error('RATE_LIMITED');
		calls.push(now);
		active++;
		try {
			const owner = await dependencies.authenticate();
			const data = await operation(owner.id);
			if (!data) return error('NOT_FOUND');
			const structuredContent = { data };
			const text = JSON.stringify(structuredContent);
			if (Buffer.byteLength(text, 'utf8') > 65536) return error('OUTPUT_LIMIT');
			return { content: [{ type: 'text' as const, text }], structuredContent };
		} catch (caught) {
			return error(caught instanceof AuthError ? 'AUTH_REQUIRED' : 'UNAVAILABLE');
		} finally { active--; }
	}
	server.registerTool('list_shipments', {
		description: 'List your saved shipments. Stored snapshots only, no live refresh.',
		inputSchema: z.object(page).strict(), outputSchema: output, annotations
	}, args => run(ownerId => dependencies.reads.list(ownerId, args.limit, args.offset)));
	server.registerTool('get_shipment', {
		description: 'Read a saved shipment owned by your authenticated session. No contact or cargo details.',
		inputSchema: z.object({ id }).strict(), outputSchema: output, annotations
	}, args => run(async ownerId => {
		const shipment = await dependencies.reads.get(ownerId, args.id);
		return shipment ? { shipment } : null;
	}));
	server.registerTool('get_tracking', {
		description: 'Read saved tracking history with pagination. Does not contact carriers or refresh tracking.',
		inputSchema: z.object({ id, ...page }).strict(), outputSchema: output, annotations
	}, args => run(ownerId => dependencies.reads.tracking(ownerId, args.id, args.limit, args.offset)));
	server.registerTool('find_np_points', {
		description: 'Search the public Nova Poshta directory by city reference. No personal carrier key is used.',
		inputSchema: z.object({ cityRef: id, search: z.string().max(100).default(''), page: z.number().int().min(1).max(100).default(1) }).strict(),
		outputSchema: output, annotations: { ...annotations, openWorldHint: true }
	}, args => run(async () => {
		const result = await dependencies.points.warehousesPage(args.cityRef, args.search, args.page);
		return { points: result.data.slice(0, 20).map(point => ({
			ref: point.ref, cityRef: point.cityRef, name: point.name, address: point.address,
			number: point.number, category: point.category, status: point.status,
			latitude: point.latitude, longitude: point.longitude
		})), nextPage: result.hasMore && args.page < 100 ? args.page + 1 : null };
	}));
	return server;
}