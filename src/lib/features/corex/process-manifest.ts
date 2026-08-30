import manifestData from './generated/process-manifest.json';
import type { FlowNode, FlowScenario, WorkflowTriggerConfig } from './types';

export type ProcessRouteState = 'implemented' | 'planned';

export type ProcessManifestRoute = {
	method: string;
	path: string;
	status: ProcessRouteState;
	source: string;
	match?: 'exact' | 'prefix';
	operationId?: string | null;
	summary?: string | null;
	tags?: string[];
};

export type ProcessManifest = {
	schemaVersion: 1;
	workers: Array<{
		id: string;
		name: string;
		entrypoint: string;
		config: string;
		publicRoutes: string[];
		bindings: Array<{ name: string; type: string; target: string }>;
		routes: ProcessManifestRoute[];
	}>;
	contracts: Array<{
		id: string;
		title: string;
		version: string;
		servers: string[];
		routes: ProcessManifestRoute[];
	}>;
};

export const processManifest = manifestData as ProcessManifest;

function triggerMethod(method: string): WorkflowTriggerConfig['method'] {
	return method === 'ANY' ? undefined : (method as WorkflowTriggerConfig['method']);
}

function routeNode(route: ProcessManifestRoute, index: number): FlowNode {
	const implemented = route.status === 'implemented';
	return {
		id: `route-${index}`,
		eyebrow: implemented ? 'Worker route' : 'OpenAPI contract',
		title: route.operationId ?? `${route.method} ${route.path}`,
		detail: route.summary ?? `${route.match ?? 'contract'} route discovered from ${route.source}.`,
		status: implemented ? 'complete' : 'blocked',
		meta: `${route.status} · ${route.source}`,
		kind: index === 0 ? 'trigger' : 'action',
		position: { x: 80 + (index % 4) * 300, y: 100 + Math.floor(index / 4) * 190 },
		layer: 'worker',
		request: `${route.method} ${route.path}`,
		operation: route.operationId ?? undefined,
		workflow: {
			name: route.operationId ?? `${route.method} ${route.path}`,
			type: 'trigger-http',
			family: 'trigger',
			trigger: { kind: 'http', method: triggerMethod(route.method), path: route.path }
		}
	};
}

export const generatedFlowScenarios: FlowScenario[] = [
	...processManifest.workers.map((worker): FlowScenario => ({
		id: `inventory-${worker.id}`,
		category: 'Routing',
		label: worker.name,
		title: `${worker.name} route inventory`,
		description: `Generated from ${worker.entrypoint} and ${worker.config}. Public routes: ${worker.publicRoutes.join(', ') || 'workers.dev only'}. Bindings: ${worker.bindings.map((binding) => `${binding.name} → ${binding.target}`).join(', ') || 'none'}.`,
		entrypoint: worker.publicRoutes[0] ?? worker.name,
		nodes: worker.routes.map(routeNode),
		edges: []
	})),
	...processManifest.contracts.map((contract): FlowScenario => ({
		id: `contract-${contract.id}`,
		category: 'Operations',
		label: contract.title,
		title: `${contract.title} contract inventory`,
		description: `Generated from OpenAPI ${contract.version}. Contract-only operations remain blocked until a matching Worker route is implemented.`,
		entrypoint: contract.servers[0] ?? contract.id,
		nodes: contract.routes.map(routeNode),
		edges: []
	}))
];
