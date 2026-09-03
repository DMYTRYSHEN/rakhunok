import {
	type ApprovalNode,
	type ConditionNode,
	type BreakNode,
	type BlockNode,
	type EventTriggerNode,
	type EventWaitNode,
	type FailureNode,
	type HttpRequestNode,
	type HttpTriggerNode,
	isProcessTriggerNode,
	type InvokeProcessNode,
	type LocalCallNode,
	type LoopNode,
	type ParallelNode,
	type ProcessDefinition,
	type ScheduleTriggerNode,
	type SuccessNode,
	type SwitchNode,
	type TransformNode,
	type TryNode,
	type WaitNode,
	type WaitUntilNode,
	validateProcessDefinition
} from './process-definition.ts';

type LinearExecutionNode = { id: string; name: string; next: string };
type CompensationExecutionNode =
	| {
			id: string;
			name: string;
			type: 'http-request';
			config: HttpRequestNode['config'];
	  }
	| {
			id: string;
			name: string;
			type: 'transform';
			config: TransformNode['config'];
	  };
export type HttpExecutionNode = LinearExecutionNode & {
	type: 'http-request';
	config: HttpRequestNode['config'];
	compensation?: CompensationExecutionNode;
};
export type WaitExecutionNode = LinearExecutionNode & {
	type: 'wait';
	config: WaitNode['config'];
	compensation?: CompensationExecutionNode;
};
export type WaitUntilExecutionNode = LinearExecutionNode & {
	type: 'wait-until';
	config: WaitUntilNode['config'];
	compensation?: CompensationExecutionNode;
};
export type EventWaitExecutionNode = LinearExecutionNode & {
	type: 'wait-event';
	config: EventWaitNode['config'];
	compensation?: CompensationExecutionNode;
};
export type InvokeProcessExecutionNode = LinearExecutionNode & {
	type: 'invoke-process';
	config: InvokeProcessNode['config'];
	compensation?: CompensationExecutionNode;
};
export type LocalCallExecutionNode = LinearExecutionNode & {
	type: 'local-call';
	config: Pick<LocalCallNode['config'], 'inputPath' | 'resultKey'>;
	bodyTarget: string;
	returnTarget: string;
};
export type BlockExecutionNode = {
	id: string;
	name: string;
	type: 'block';
	config: BlockNode['config'];
	bodyTarget: string;
	continuationTarget: string;
};
export type ApprovalExecutionNode = {
	id: string;
	name: string;
	type: 'approval';
	config: ApprovalNode['config'];
	compensation?: CompensationExecutionNode;
	whenApproved: string;
	whenRejected: string;
};
export type TransformExecutionNode = LinearExecutionNode & {
	type: 'transform';
	config: TransformNode['config'];
	compensation?: CompensationExecutionNode;
};
export type ConditionExecutionNode = {
	id: string;
	name: string;
	type: 'condition';
	config: ConditionNode['config'];
	whenTrue: string;
	whenFalse: string;
};
export type SwitchExecutionNode = {
	id: string;
	name: string;
	type: 'switch';
	config: SwitchNode['config'];
	targets: Record<string, string>;
	defaultTarget: string;
};
export type LoopExecutionNode = {
	id: string;
	name: string;
	type: 'loop';
	config: LoopNode['config'];
	bodyTarget: string;
	exitTarget: string;
};
export type BreakExecutionNode = {
	id: string;
	name: string;
	type: 'break';
	loopId: BreakNode['config']['loopId'];
	exitTarget: string;
};
export type ParallelExecutionNode = {
	id: string;
	name: string;
	type: 'parallel';
	config: ParallelNode['config'];
	branchTargets: Record<string, string>;
	joinTarget: string;
	continuationTarget: string;
};
export type TryExecutionNode = {
	id: string;
	name: string;
	type: 'try';
	config: TryNode['config'];
	bodyTarget: string;
	catchTarget?: string;
	finallyTarget?: string;
	continuationTarget: string;
};
export type SuccessExecutionNode = {
	id: string;
	name: string;
	type: 'end-success';
	config: SuccessNode['config'];
};
export type FailureExecutionNode = {
	id: string;
	name: string;
	type: 'end-failure';
	config: FailureNode['config'];
};
export type ProcessExecutionNode =
	| HttpExecutionNode
	| WaitExecutionNode
	| WaitUntilExecutionNode
	| EventWaitExecutionNode
	| InvokeProcessExecutionNode
	| LocalCallExecutionNode
	| BlockExecutionNode
	| ApprovalExecutionNode
	| TransformExecutionNode
	| ConditionExecutionNode
	| SwitchExecutionNode
	| LoopExecutionNode
	| BreakExecutionNode
	| ParallelExecutionNode
	| TryExecutionNode
	| SuccessExecutionNode
	| FailureExecutionNode;

export type ProcessExecutionPlan = {
	schemaVersion: 1;
	processId: string;
	revision: number;
	trigger:
		| ({ kind: 'http' } & HttpTriggerNode['config'])
		| ({ kind: 'schedule' } & ScheduleTriggerNode['config'])
		| ({ kind: 'event' } & EventTriggerNode['config']);
	entryNodeId: string;
	nodes: ProcessExecutionNode[];
};

export type ProcessCompilationResult =
	{ ok: true; plan: ProcessExecutionPlan } | { ok: false; errors: string[] };

export function compileProcessDefinition(definition: ProcessDefinition): ProcessCompilationResult {
	const validation = validateProcessDefinition(definition);
	if (!validation.valid)
		return { ok: false, errors: validation.issues.map((issue) => issue.message) };

	const trigger = definition.nodes.find(isProcessTriggerNode);
	if (!trigger) return { ok: false, errors: ['The process has no trigger.'] };

	const targetsById = new Map(
		definition.nodes.map((node) => [
			node.id,
			definition.edges.filter((edge) => edge.source === node.id && edge.compensation === undefined)
		])
	);
	const compensationTargetIds = new Set(
		definition.edges.filter((edge) => edge.compensation === true).map((edge) => edge.target)
	);
	const errors: string[] = [];
	for (const node of definition.nodes) {
		if (
			compensationTargetIds.has(node.id) ||
			node.type === 'end-success' ||
			node.type === 'end-failure' ||
			node.type === 'condition' ||
			node.type === 'switch' ||
			node.type === 'loop' ||
			node.type === 'break' ||
			node.type === 'parallel' ||
			node.type === 'block' ||
			node.type === 'local-function' ||
			node.type === 'local-return' ||
			node.type === 'try' ||
			node.type === 'approval'
		)
			continue;
		if (targetsById.get(node.id)?.length !== 1) {
			errors.push(`Step "${node.name}" must have exactly one outgoing connection.`);
		}
	}
	if (errors.length > 0) return { ok: false, errors };

	const entryNodeId = targetsById.get(trigger.id)?.[0]?.target;
	if (!entryNodeId) return { ok: false, errors: ['The trigger has no execution entry.'] };

	const nodes: ProcessExecutionNode[] = [];
	for (const node of definition.nodes) {
		if (
			isProcessTriggerNode(node) ||
			node.type === 'local-function' ||
			node.type === 'local-return' ||
			compensationTargetIds.has(node.id)
		)
			continue;
		if (node.type === 'end-success') {
			nodes.push({ id: node.id, name: node.name, type: node.type, config: { ...node.config } });
			continue;
		}
		if (node.type === 'end-failure') {
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
		if (node.type === 'switch') {
			const branches = targetsById.get(node.id) ?? [];
			nodes.push({
				id: node.id,
				name: node.name,
				type: node.type,
				config: { ...node.config, cases: node.config.cases.map((item) => ({ ...item })) },
				targets: Object.fromEntries(
					node.config.cases.map((item) => [
						item.id,
						branches.find((edge) => edge.case === item.id)!.target
					])
				),
				defaultTarget: branches.find((edge) => edge.case === 'default')!.target
			});
			continue;
		}
		if (node.type === 'loop') {
			const branches = targetsById.get(node.id) ?? [];
			nodes.push({
				id: node.id,
				name: node.name,
				type: node.type,
				config: { ...node.config },
				bodyTarget: branches.find((edge) => edge.loop === 'body')!.target,
				exitTarget: branches.find((edge) => edge.loop === 'exit')!.target
			});
			continue;
		}
		if (node.type === 'break') {
			const loopBranches = targetsById.get(node.config.loopId) ?? [];
			nodes.push({
				id: node.id,
				name: node.name,
				type: node.type,
				loopId: node.config.loopId,
				exitTarget: loopBranches.find((edge) => edge.loop === 'exit')!.target
			});
			continue;
		}
		if (node.type === 'parallel') {
			const branches = targetsById.get(node.id) ?? [];
			const join = definition.nodes.find(
				(candidate) => candidate.type === 'parallel-join' && candidate.config.parallelId === node.id
			)!;
			nodes.push({
				id: node.id,
				name: node.name,
				type: node.type,
				config: {
					branches: node.config.branches.map((branch) => ({ ...branch })),
					resultKey: node.config.resultKey
				},
				branchTargets: Object.fromEntries(
					node.config.branches.map((branch) => [
						branch.id,
						branches.find((edge) => edge.parallel === branch.id)!.target
					])
				),
				joinTarget: join.id,
				continuationTarget: targetsById.get(join.id)![0].target
			});
			continue;
		}
		if (node.type === 'parallel-join') continue;
		if (node.type === 'block') {
			const branches = targetsById.get(node.id) ?? [];
			nodes.push({
				id: node.id,
				name: node.name,
				type: node.type,
				config: {},
				bodyTarget: branches.find((edge) => edge.block === 'body')!.target,
				continuationTarget: branches.find((edge) => edge.block === 'continuation')!.target
			});
			continue;
		}
		if (node.type === 'try') {
			const branches = targetsById.get(node.id) ?? [];
			nodes.push({
				id: node.id,
				name: node.name,
				type: node.type,
				config: {},
				bodyTarget: branches.find((edge) => edge.try === 'body')!.target,
				catchTarget: branches.find((edge) => edge.try === 'catch')?.target,
				finallyTarget: branches.find((edge) => edge.try === 'finally')?.target,
				continuationTarget: branches.find((edge) => edge.try === 'continuation')!.target
			});
			continue;
		}
		if (node.type === 'approval') {
			const branches = targetsById.get(node.id) ?? [];
			const compensationEdge = definition.edges.find(
				(edge) => edge.source === node.id && edge.compensation === true
			);
			const compensation = compensationEdge
				? definition.nodes.find(
						(candidate): candidate is HttpRequestNode | TransformNode =>
							candidate.id === compensationEdge.target &&
							(candidate.type === 'http-request' || candidate.type === 'transform')
					)
				: undefined;
			const compiledCompensation: CompensationExecutionNode | undefined =
				compensation?.type === 'transform'
					? {
							id: compensation.id,
							name: compensation.name,
							type: compensation.type,
							config: { ...compensation.config, mappings: { ...compensation.config.mappings } }
						}
					: compensation?.type === 'http-request'
						? {
								id: compensation.id,
								name: compensation.name,
								type: compensation.type,
								config: { ...compensation.config }
							}
						: undefined;
			nodes.push({
				id: node.id,
				name: node.name,
				type: node.type,
				config: { ...node.config },
				...(compiledCompensation ? { compensation: compiledCompensation } : {}),
				whenApproved: branches.find((edge) => edge.when === true)!.target,
				whenRejected: branches.find((edge) => edge.when === false)!.target
			});
			continue;
		}
		if (node.type === 'local-call') {
			const functionNode = definition.nodes.find(
				(candidate) =>
					candidate.id === node.config.functionId && candidate.type === 'local-function'
			)!;
			const bodyTarget = targetsById.get(functionNode.id)![0].target;
			const returnTarget = definition.nodes.find(
				(candidate) =>
					candidate.type === 'local-return' && candidate.config.functionId === functionNode.id
			)!.id;
			nodes.push({
				id: node.id,
				name: node.name,
				type: node.type,
				config: { inputPath: node.config.inputPath, resultKey: node.config.resultKey },
				bodyTarget,
				returnTarget,
				next: targetsById.get(node.id)![0].target
			});
			continue;
		}
		const next = targetsById.get(node.id)![0].target;
		if (
			node.type === 'http-request' ||
			node.type === 'transform' ||
			node.type === 'invoke-process' ||
			node.type === 'wait-event' ||
			node.type === 'wait' ||
			node.type === 'wait-until'
		) {
			const compensationEdge = definition.edges.find(
				(edge) => edge.source === node.id && edge.compensation === true
			);
			const compensation = compensationEdge
				? definition.nodes.find(
						(candidate): candidate is HttpRequestNode | TransformNode =>
							candidate.id === compensationEdge.target &&
							(candidate.type === 'http-request' || candidate.type === 'transform')
					)
				: undefined;
			const compiledCompensation =
				compensation?.type === 'http-request'
					? {
							id: compensation.id,
							name: compensation.name,
							type: compensation.type,
							config: { ...compensation.config }
						}
					: compensation?.type === 'transform'
						? {
								id: compensation.id,
								name: compensation.name,
								type: compensation.type,
								config: { ...compensation.config, mappings: { ...compensation.config.mappings } }
							}
						: undefined;
			if (node.type === 'transform') {
				nodes.push({
					id: node.id,
					name: node.name,
					type: node.type,
					config: { ...node.config, mappings: { ...node.config.mappings } },
					...(compiledCompensation ? { compensation: compiledCompensation } : {}),
					next
				});
			} else if (node.type === 'http-request') {
				nodes.push({
					id: node.id,
					name: node.name,
					type: node.type,
					config: { ...node.config },
					...(compiledCompensation ? { compensation: compiledCompensation } : {}),
					next
				});
			} else if (node.type === 'wait-event') {
				nodes.push({
					id: node.id,
					name: node.name,
					type: node.type,
					config: { ...node.config },
					...(compiledCompensation ? { compensation: compiledCompensation } : {}),
					next
				});
			} else if (node.type === 'invoke-process') {
				nodes.push({
					id: node.id,
					name: node.name,
					type: node.type,
					config: { ...node.config },
					...(compiledCompensation ? { compensation: compiledCompensation } : {}),
					next
				});
			} else if (node.type === 'wait') {
				nodes.push({
					id: node.id,
					name: node.name,
					type: node.type,
					config: { ...node.config },
					...(compiledCompensation ? { compensation: compiledCompensation } : {}),
					next
				});
			} else if (node.type === 'wait-until') {
				nodes.push({
					id: node.id,
					name: node.name,
					type: node.type,
					config: { ...node.config },
					...(compiledCompensation ? { compensation: compiledCompensation } : {}),
					next
				});
			}
		}
	}

	return {
		ok: true,
		plan: {
			schemaVersion: 1,
			processId: definition.id,
			revision: definition.revision,
			trigger:
				trigger.type === 'trigger-http'
					? { kind: 'http', ...trigger.config }
					: trigger.type === 'trigger-schedule'
						? { kind: 'schedule', ...trigger.config }
						: { kind: 'event', ...trigger.config },
			entryNodeId,
			nodes
		}
	};
}
