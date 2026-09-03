import { rahunokFlowScenarios } from './flow-scenarios';
import { processManifest, type ProcessManifest, type ProcessManifestRoute } from './process-manifest';
import type { FlowScenario } from './types';

export type DeployedProcessContractStatus = 'matched' | 'undocumented';

export type DeployedProcessCatalogItem = {
	id: string;
	label: string;
	workerId: string;
	workerName: string;
	route: ProcessManifestRoute;
	contractStatus: DeployedProcessContractStatus;
	contractOperationId: string | null;
	scenario: FlowScenario;
};

function normalizePath(path: string): string {
	return path
		.replace(/:[A-Za-z_][A-Za-z0-9_]*/g, '{}')
		.replace(/\{[^}]+\}/g, '{}')
		.replace(/\/$/, '') || '/';
}

function parseEntrypoint(entrypoint: string): { method: string; path: string } | null {
	const match = /^(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\s+(\/\S+)$/i.exec(entrypoint.trim());
	if (!match || match[2].includes('|')) return null;
	return { method: match[1].toUpperCase(), path: normalizePath(match[2]) };
}

function routeMatches(
	route: ProcessManifestRoute,
	entrypoint: { method: string; path: string }
): boolean {
	return (
		(route.method === 'ANY' || route.method === entrypoint.method) &&
		normalizePath(route.path) === entrypoint.path
	);
}

export function buildDeployedProcessCatalog(
	scenarios: FlowScenario[],
	manifest: ProcessManifest
): DeployedProcessCatalogItem[] {
	return scenarios.flatMap((scenario) => {
		const entrypoint = parseEntrypoint(scenario.entrypoint);
		if (!entrypoint || scenario.nodes.length < 2 || scenario.edges.length < 1) return [];

		const deployedMatch = manifest.workers
			.filter((worker) => worker.publicRoutes.length > 0)
			.map((worker) => ({ worker, route: worker.routes.find((route) => routeMatches(route, entrypoint)) }))
			.find((candidate) => candidate.route);
		if (!deployedMatch?.route) return [];

		const contractRoute = manifest.contracts
			.flatMap((contract) => contract.routes)
			.find((route) => routeMatches(route, entrypoint));

		return [
			{
				id: scenario.id,
				label: scenario.label,
				workerId: deployedMatch.worker.id,
				workerName: deployedMatch.worker.name,
				route: deployedMatch.route,
				contractStatus: contractRoute ? 'matched' : 'undocumented',
				contractOperationId: contractRoute?.operationId ?? null,
				scenario
			}
		];
	});
}

export const deployedProcessCatalog = buildDeployedProcessCatalog(
	rahunokFlowScenarios,
	processManifest
);