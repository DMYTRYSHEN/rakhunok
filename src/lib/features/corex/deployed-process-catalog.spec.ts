import { describe, expect, it } from 'vitest';
import { buildDeployedProcessCatalog } from './deployed-process-catalog';
import type { ProcessManifest } from './process-manifest';
import type { FlowScenario } from './types';

function scenario(entrypoint: string): FlowScenario {
	return {
		id: 'create-delivery',
		category: 'Invoices',
		label: 'Delivery invoice',
		title: 'Create delivery invoice',
		description: 'A test workflow.',
		entrypoint,
		nodes: [
			{
				id: 'start',
				eyebrow: 'API',
				title: 'Start',
				detail: 'Start request.',
				status: 'complete',
				meta: 'POST',
				kind: 'trigger',
				position: { x: 0, y: 0 }
			},
			{
				id: 'finish',
				eyebrow: 'Worker',
				title: 'Finish',
				detail: 'Finish request.',
				status: 'complete',
				meta: '201',
				kind: 'terminal',
				position: { x: 300, y: 0 }
			}
		],
		edges: [{ id: 'start-finish', source: 'start', target: 'finish' }]
	};
}

function manifest(options: { deployed?: boolean; contract?: boolean } = {}): ProcessManifest {
	return {
		schemaVersion: 1,
		workers: [
			{
				id: 'api',
				name: 'production-api',
				entrypoint: 'worker/src/index.ts',
				config: 'worker/wrangler.jsonc',
				publicRoutes: options.deployed === false ? [] : ['example.com/api/*'],
				bindings: [],
				routes: [
					{
						method: 'POST',
						path: '/api/delivery/:order_id',
						status: 'implemented',
						source: 'worker/src/index.ts'
					}
				]
			}
		],
		contracts: options.contract
			? [
					{
						id: 'api',
						title: 'API',
						version: '1',
						servers: ['https://example.com'],
						routes: [
							{
								method: 'POST',
								path: '/api/delivery/{order_id}',
								status: 'planned',
								source: 'docs/openapi.yaml',
								operationId: 'createDelivery'
							}
						]
					}
				]
			: []
	};
}

describe('deployed process catalog', () => {
	it('includes a workflow backed by a production Worker route and matches OpenAPI parameters', () => {
		const result = buildDeployedProcessCatalog(
			[scenario('POST /api/delivery/:order_id')],
			manifest({ contract: true })
		);

		expect(result).toMatchObject([
			{
				id: 'create-delivery',
				workerId: 'api',
				contractStatus: 'matched',
				contractOperationId: 'createDelivery'
			}
		]);
	});

	it('keeps a deployed workflow visible when its OpenAPI operation is missing', () => {
		expect(
			buildDeployedProcessCatalog([scenario('POST /api/delivery/:order_id')], manifest())
		).toMatchObject([{ contractStatus: 'undocumented' }]);
	});

	it('excludes route-only, workflow-only, and non-production records', () => {
		expect(buildDeployedProcessCatalog([], manifest())).toEqual([]);
		expect(buildDeployedProcessCatalog([scenario('POST /api/missing')], manifest())).toEqual([]);
		expect(
			buildDeployedProcessCatalog(
				[{ ...scenario('POST /api/delivery/:order_id'), edges: [] }],
				manifest()
			)
		).toEqual([]);
		expect(
			buildDeployedProcessCatalog(
				[scenario('POST /api/delivery/:order_id')],
				manifest({ deployed: false })
			)
		).toEqual([]);
	});
});