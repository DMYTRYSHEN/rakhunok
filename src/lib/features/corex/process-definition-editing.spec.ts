import { describe, expect, it } from 'vitest';
import { insertProcessRegionBefore } from './process-definition-editing';
import {
	PROCESS_DEFINITION_SCHEMA_VERSION,
	type ProcessDefinition,
	type ProcessNode,
	validateProcessDefinition
} from './process-definition';

function definitionWithBlockBody(): ProcessDefinition {
	return {
		schemaVersion: PROCESS_DEFINITION_SCHEMA_VERSION,
		id: 'nested-regions',
		name: 'Nested regions',
		description: 'Editor composition fixture.',
		revision: 1,
		lifecycle: 'draft',
		nodes: [
			{
				id: 'trigger',
				name: 'trigger',
				type: 'trigger-http',
				position: { x: 0, y: 0 },
				config: { method: 'POST', path: '/nested-regions' }
			},
			{ id: 'block', name: 'block', type: 'block', position: { x: 240, y: 0 }, config: {} },
			{
				id: 'body',
				name: 'body',
				type: 'transform',
				position: { x: 480, y: 160 },
				config: { mode: 'merge', mappings: { value: '$.value' } }
			},
			{
				id: 'continuation',
				name: 'continuation',
				type: 'transform',
				position: { x: 720, y: 0 },
				config: { mode: 'merge', mappings: { value: '$.value' } }
			},
			{
				id: 'success',
				name: 'success',
				type: 'end-success',
				position: { x: 960, y: 0 },
				config: {}
			}
		],
		edges: [
			{ id: 'trigger-block', source: 'trigger', target: 'block' },
			{ id: 'block-body', source: 'block', target: 'body', block: 'body' },
			{ id: 'block-continuation', source: 'block', target: 'continuation', block: 'continuation' },
			{ id: 'body-continuation', source: 'body', target: 'continuation' },
			{ id: 'continuation-success', source: 'continuation', target: 'success' }
		]
	};
}

function definitionWithParallelBranch(): ProcessDefinition {
	return {
		schemaVersion: PROCESS_DEFINITION_SCHEMA_VERSION,
		id: 'parallel-regions',
		name: 'Parallel regions',
		description: 'Parallel editor composition fixture.',
		revision: 1,
		lifecycle: 'draft',
		nodes: [
			{
				id: 'trigger',
				name: 'trigger',
				type: 'trigger-http',
				position: { x: 0, y: 0 },
				config: { method: 'POST', path: '/parallel-regions' }
			},
			{
				id: 'parallel',
				name: 'parallel',
				type: 'parallel',
				position: { x: 240, y: 0 },
				config: { branches: [{ id: 'risk' }, { id: 'receipt' }], resultKey: 'results' }
			},
			{
				id: 'risk',
				name: 'risk',
				type: 'transform',
				position: { x: 480, y: -120 },
				config: { mode: 'merge', mappings: { risk: '$.value' } }
			},
			{
				id: 'receipt',
				name: 'receipt',
				type: 'transform',
				position: { x: 480, y: 120 },
				config: { mode: 'merge', mappings: { receipt: '$.value' } }
			},
			{
				id: 'join',
				name: 'join',
				type: 'parallel-join',
				position: { x: 720, y: 0 },
				config: { parallelId: 'parallel' }
			},
			{
				id: 'success',
				name: 'success',
				type: 'end-success',
				position: { x: 960, y: 0 },
				config: {}
			}
		],
		edges: [
			{ id: 'trigger-parallel', source: 'trigger', target: 'parallel' },
			{ id: 'parallel-risk', source: 'parallel', target: 'risk', parallel: 'risk' },
			{ id: 'parallel-receipt', source: 'parallel', target: 'receipt', parallel: 'receipt' },
			{ id: 'risk-join', source: 'risk', target: 'join' },
			{ id: 'receipt-join', source: 'receipt', target: 'join' },
			{ id: 'join-success', source: 'join', target: 'success' }
		]
	};
}

describe('insertProcessRegionBefore', () => {
	it('nests a block before a selected block body and preserves edge metadata', () => {
		const nestedNodes: ProcessNode[] = [
			{
				id: 'nested-block',
				name: 'nested-block',
				type: 'block',
				position: { x: 360, y: 160 },
				config: {}
			},
			{
				id: 'nested-body',
				name: 'nested-body',
				type: 'transform',
				position: { x: 600, y: 300 },
				config: { mode: 'merge', mappings: { value: '$.value' } }
			},
			{
				id: 'nested-continuation',
				name: 'nested-continuation',
				type: 'transform',
				position: { x: 600, y: 160 },
				config: { mode: 'merge', mappings: { value: '$.value' } }
			}
		];
		const result = insertProcessRegionBefore(definitionWithBlockBody(), 'body', {
			nodes: nestedNodes,
			edges: [
				{ id: 'nested-block-body', source: 'nested-block', target: 'nested-body', block: 'body' },
				{
					id: 'nested-block-continuation',
					source: 'nested-block',
					target: 'nested-continuation',
					block: 'continuation'
				},
				{
					id: 'nested-body-continuation',
					source: 'nested-body',
					target: 'nested-continuation'
				}
			],
			entryNodeId: 'nested-block',
			exitNodeId: 'nested-continuation',
			exitEdgeId: 'nested-continuation-anchor'
		});

		expect(result.edges).toContainEqual({
			id: 'block-body',
			source: 'block',
			target: 'nested-block',
			block: 'body'
		});
		expect(result.edges).toContainEqual({
			id: 'nested-continuation-anchor',
			source: 'nested-continuation',
			target: 'body'
		});
		expect(validateProcessDefinition(result)).toEqual({ valid: true, issues: [] });
	});

	it('nests a parallel region before a selected block body', () => {
		const result = insertProcessRegionBefore(definitionWithBlockBody(), 'body', {
			nodes: [
				{
					id: 'parallel',
					name: 'parallel',
					type: 'parallel',
					position: { x: 360, y: 160 },
					config: { branches: [{ id: 'risk' }, { id: 'receipt' }], resultKey: 'results' }
				},
				{
					id: 'risk',
					name: 'risk',
					type: 'transform',
					position: { x: 560, y: 80 },
					config: { mode: 'merge', mappings: { risk: '$.value' } }
				},
				{
					id: 'receipt',
					name: 'receipt',
					type: 'transform',
					position: { x: 560, y: 240 },
					config: { mode: 'merge', mappings: { receipt: '$.value' } }
				},
				{
					id: 'parallel-join',
					name: 'parallel-join',
					type: 'parallel-join',
					position: { x: 760, y: 160 },
					config: { parallelId: 'parallel' }
				}
			],
			edges: [
				{ id: 'parallel-risk', source: 'parallel', target: 'risk', parallel: 'risk' },
				{ id: 'parallel-receipt', source: 'parallel', target: 'receipt', parallel: 'receipt' },
				{ id: 'risk-join', source: 'risk', target: 'parallel-join' },
				{ id: 'receipt-join', source: 'receipt', target: 'parallel-join' }
			],
			entryNodeId: 'parallel',
			exitNodeId: 'parallel-join',
			exitEdgeId: 'parallel-join-anchor'
		});

		expect(result.edges.find((edge) => edge.id === 'block-body')).toMatchObject({
			target: 'parallel',
			block: 'body'
		});
		expect(result.edges).toContainEqual({
			id: 'parallel-join-anchor',
			source: 'parallel-join',
			target: 'body'
		});
		expect(validateProcessDefinition(result)).toEqual({ valid: true, issues: [] });
	});

	it('nests a block before a selected parallel branch node and preserves branch metadata', () => {
		const result = insertProcessRegionBefore(definitionWithParallelBranch(), 'risk', {
			nodes: [
				{
					id: 'branch-block',
					name: 'branch-block',
					type: 'block',
					position: { x: 360, y: -120 },
					config: {}
				},
				{
					id: 'branch-block-body',
					name: 'branch-block-body',
					type: 'transform',
					position: { x: 600, y: -20 },
					config: { mode: 'merge', mappings: { value: '$.value' } }
				},
				{
					id: 'branch-block-continuation',
					name: 'branch-block-continuation',
					type: 'transform',
					position: { x: 600, y: -120 },
					config: { mode: 'merge', mappings: { value: '$.value' } }
				}
			],
			edges: [
				{
					id: 'branch-block-body-edge',
					source: 'branch-block',
					target: 'branch-block-body',
					block: 'body'
				},
				{
					id: 'branch-block-continuation-edge',
					source: 'branch-block',
					target: 'branch-block-continuation',
					block: 'continuation'
				},
				{
					id: 'branch-block-body-continuation',
					source: 'branch-block-body',
					target: 'branch-block-continuation'
				}
			],
			entryNodeId: 'branch-block',
			exitNodeId: 'branch-block-continuation',
			exitEdgeId: 'branch-block-risk'
		});

		expect(result.edges).toContainEqual({
			id: 'parallel-risk',
			source: 'parallel',
			target: 'branch-block',
			parallel: 'risk'
		});
		expect(result.edges).toContainEqual({
			id: 'branch-block-risk',
			source: 'branch-block-continuation',
			target: 'risk'
		});
		expect(validateProcessDefinition(result)).toEqual({ valid: true, issues: [] });
	});

	it('nests a parallel region before a selected parallel branch node', () => {
		const result = insertProcessRegionBefore(definitionWithParallelBranch(), 'risk', {
			nodes: [
				{
					id: 'signals',
					name: 'collect-signals',
					type: 'parallel',
					position: { x: 360, y: -120 },
					config: { branches: [{ id: 'fraud' }, { id: 'credit' }], resultKey: 'signals' }
				},
				{
					id: 'fraud',
					name: 'load-fraud',
					type: 'transform',
					position: { x: 560, y: -180 },
					config: { mode: 'merge', mappings: { signal: '$.value' } }
				},
				{
					id: 'credit',
					name: 'load-credit',
					type: 'transform',
					position: { x: 560, y: -60 },
					config: { mode: 'merge', mappings: { signal: '$.value' } }
				},
				{
					id: 'signals-join',
					name: 'signals-collected',
					type: 'parallel-join',
					position: { x: 760, y: -120 },
					config: { parallelId: 'signals' }
				}
			],
			edges: [
				{ id: 'signals-fraud', source: 'signals', target: 'fraud', parallel: 'fraud' },
				{ id: 'signals-credit', source: 'signals', target: 'credit', parallel: 'credit' },
				{ id: 'fraud-join', source: 'fraud', target: 'signals-join' },
				{ id: 'credit-join', source: 'credit', target: 'signals-join' }
			],
			entryNodeId: 'signals',
			exitNodeId: 'signals-join',
			exitEdgeId: 'signals-risk'
		});

		expect(result.edges).toContainEqual({
			id: 'parallel-risk',
			source: 'parallel',
			target: 'signals',
			parallel: 'risk'
		});
		expect(result.edges).toContainEqual({
			id: 'signals-risk',
			source: 'signals-join',
			target: 'risk'
		});
		expect(validateProcessDefinition(result)).toEqual({ valid: true, issues: [] });
	});

	it('nests a parallel region before a selected block continuation', () => {
		const result = insertProcessRegionBefore(definitionWithBlockBody(), 'continuation', {
			nodes: [
				{
					id: 'continuation-parallel',
					name: 'continuation-parallel',
					type: 'parallel',
					position: { x: 600, y: 0 },
					config: { branches: [{ id: 'risk' }, { id: 'receipt' }], resultKey: 'results' }
				},
				{
					id: 'continuation-risk',
					name: 'continuation-risk',
					type: 'transform',
					position: { x: 800, y: -100 },
					config: { mode: 'merge', mappings: { risk: '$.value' } }
				},
				{
					id: 'continuation-receipt',
					name: 'continuation-receipt',
					type: 'transform',
					position: { x: 800, y: 100 },
					config: { mode: 'merge', mappings: { receipt: '$.value' } }
				},
				{
					id: 'continuation-join',
					name: 'continuation-join',
					type: 'parallel-join',
					position: { x: 1000, y: 0 },
					config: { parallelId: 'continuation-parallel' }
				}
			],
			edges: [
				{
					id: 'continuation-parallel-risk',
					source: 'continuation-parallel',
					target: 'continuation-risk',
					parallel: 'risk'
				},
				{
					id: 'continuation-parallel-receipt',
					source: 'continuation-parallel',
					target: 'continuation-receipt',
					parallel: 'receipt'
				},
				{
					id: 'continuation-risk-join',
					source: 'continuation-risk',
					target: 'continuation-join'
				},
				{
					id: 'continuation-receipt-join',
					source: 'continuation-receipt',
					target: 'continuation-join'
				}
			],
			entryNodeId: 'continuation-parallel',
			exitNodeId: 'continuation-join',
			exitEdgeId: 'continuation-join-anchor'
		});

		expect(result.edges).toContainEqual({
			id: 'block-continuation',
			source: 'block',
			target: 'continuation-parallel',
			block: 'continuation'
		});
		expect(result.edges).toContainEqual({
			id: 'continuation-join-anchor',
			source: 'continuation-join',
			target: 'continuation'
		});
		expect(validateProcessDefinition(result)).toEqual({ valid: true, issues: [] });
	});
});
