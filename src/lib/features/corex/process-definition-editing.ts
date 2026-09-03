import type { ProcessDefinition, ProcessEdge, ProcessNode } from './process-definition';

export function insertProcessRegionBefore(
	definition: ProcessDefinition,
	anchorNodeId: string,
	region: {
		nodes: ProcessNode[];
		edges: ProcessEdge[];
		entryNodeId: string;
		exitNodeId: string;
		exitEdgeId: string;
	}
): ProcessDefinition {
	if (!definition.nodes.some((node) => node.id === anchorNodeId)) return definition;
	const incoming = definition.edges.filter((edge) => edge.target === anchorNodeId);
	return {
		...definition,
		nodes: [...definition.nodes, ...region.nodes],
		edges: [
			...definition.edges
				.filter((edge) => edge.target !== anchorNodeId)
				.map((edge) => ({ ...edge })),
			...incoming.map((edge) => ({ ...edge, target: region.entryNodeId })),
			...region.edges,
			{
				id: region.exitEdgeId,
				source: region.exitNodeId,
				target: anchorNodeId
			}
		]
	};
}
