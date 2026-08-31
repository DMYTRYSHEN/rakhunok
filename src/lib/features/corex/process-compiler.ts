import {
	type ApprovalNode,
	type ConditionNode,
	type EventWaitNode,
	type HttpRequestNode,
	type ProcessDefinition,
	type SuccessNode,
	type TransformNode,
	type WaitNode,
	validateProcessDefinition
} from './process-definition.ts';

type LinearExecutionNode = { id: string; name: string; next: string };
export type HttpExecutionNode = LinearExecutionNode & { type: 'http-request'; config: HttpRequestNode['config'] };
export type WaitExecutionNode = LinearExecutionNode & { type: 'wait'; config: WaitNode['config'] };
export type EventWaitExecutionNode = LinearExecutionNode & { type: 'wait-event'; config: EventWaitNode['config'] };
export type ApprovalExecutionNode = LinearExecutionNode & { type: 'approval'; config: ApprovalNode['config'] };
export type TransformExecutionNode = LinearExecutionNode & { type: 'transform'; config: TransformNode['config'] };
export type ConditionExecutionNode = {
	id: string;
	name: string;
	type: 'condition';
	config: ConditionNode['config'];
	whenTrue: string;
	whenFalse: string;
};
export type SuccessExecutionNode = { id: string; name: string; type: 'end-success'; config: SuccessNode['config'] };
export type ProcessExecutionNode = HttpExecutionNode | WaitExecutionNode | EventWaitExecutionNode | ApprovalExecutionNode | TransformExecutionNode | ConditionExecutionNode | SuccessExecutionNode;

export type ProcessExecutionPlan = {
	schemaVersion: 1;
	processId: string;
	revision: number;
	trigger: {
		method: string;
		path: string;
	};
	entryNodeId: string;
	nodes: ProcessExecutionNode[];
};

export type ProcessCompilationResult =
	| { ok: true; plan: ProcessExecutionPlan }
	| { ok: false; errors: string[] };

export function compileProcessDefinition(definition: ProcessDefinition): ProcessCompilationResult {
	const validation = validateProcessDefinition(definition);
	if (!validation.valid) return { ok: false, errors: validation.issues.map((issue) => issue.message) };

	const trigger = definition.nodes.find((node) => node.type === 'trigger-http');
	if (!trigger) return { ok: false, errors: ['The process has no HTTP trigger.'] };

	const targetsById = new Map(definition.nodes.map((node) => [
		node.id,
		definition.edges.filter((edge) => edge.source === node.id)
	]));
	const errors: string[] = [];
	for (const node of definition.nodes) {
		if (node.type === 'end-success' || node.type === 'condition') continue;
		if (targetsById.get(node.id)?.length !== 1) {
			errors.push(`Step "${node.name}" must have exactly one outgoing connection.`);
		}
	}
	if (errors.length > 0) return { ok: false, errors };

	const entryNodeId = targetsById.get(trigger.id)?.[0]?.target;
	if (!entryNodeId) return { ok: false, errors: ['The trigger has no execution entry.'] };

	const nodes: ProcessExecutionNode[] = [];
	for (const node of definition.nodes) {
		if (node.type === 'trigger-http') continue;
		if (node.type === 'end-success') {
			nodes.push({ id: node.id, name: node.name, type: node.type, config: { ...node.config } });
			continue;
		}
		if (node.type === 'condition') {
			const branches = targetsById.get(node.id) ?? [];
			nodes.push({
				id: node.id,
				name: node.name,
				type: node.type,
				config: { ...node.config },
				whenTrue: branches.find((edge) => edge.when === true)!.target,
				whenFalse: branches.find((edge) => edge.when === false)!.target
			});
			continue;
		}
		const next = targetsById.get(node.id)![0].target;
		if (node.type === 'http-request') {
			nodes.push({ id: node.id, name: node.name, type: node.type, config: { ...node.config }, next });
		} else if (node.type === 'wait') {
			nodes.push({ id: node.id, name: node.name, type: node.type, config: { ...node.config }, next });
		} else if (node.type === 'wait-event') {
			nodes.push({ id: node.id, name: node.name, type: node.type, config: { ...node.config }, next });
		} else if (node.type === 'approval') {
			nodes.push({ id: node.id, name: node.name, type: node.type, config: { ...node.config }, next });
		} else {
			nodes.push({ id: node.id, name: node.name, type: node.type, config: { ...node.config }, next });
		}
	}

	return {
		ok: true,
		plan: {
			schemaVersion: 1,
			processId: definition.id,
			revision: definition.revision,
			trigger: { ...trigger.config },
			entryNodeId,
			nodes
		}
	};
}