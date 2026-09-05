import type { FlowNode, FlowScenario } from './types';
import {
	PROCESS_DEFINITION_SCHEMA_VERSION,
	isProcessTriggerNode,
	type ProcessDefinition,
	type ProcessEdge,
	type ProcessNode
} from './process-definition';

function toFlowNode(node: ProcessNode): FlowNode {
	if (node.type === 'trigger-http') {
		return {
			id: node.id,
			eyebrow: 'HTTP trigger',
			title: node.name,
			detail: 'Validates an incoming request and starts a durable process instance.',
			status: 'waiting',
			meta: `${node.config.method} ${node.config.path}`,
			kind: 'trigger',
			position: node.position,
			layer: 'worker',
			request: `${node.config.method} ${node.config.path}`,
			output: 'validated process input',
			workflow: {
				name: node.name,
				type: node.type,
				family: 'trigger',
				trigger: { kind: 'http', method: node.config.method, path: node.config.path }
			}
		};
	}

	if (node.type === 'trigger-schedule') {
		return {
			id: node.id,
			eyebrow: 'Schedule trigger',
			title: node.name,
			detail: 'Starts a durable process instance on a published schedule.',
			status: 'waiting',
			meta: `${node.config.cron} · ${node.config.timezone}`,
			kind: 'trigger',
			position: node.position,
			layer: 'worker',
			workflow: {
				name: node.name,
				type: node.type,
				family: 'trigger',
				trigger: { kind: 'schedule', cron: node.config.cron }
			}
		};
	}

	if (node.type === 'trigger-event') {
		return {
			id: node.id,
			eyebrow: 'Event trigger',
			title: node.name,
			detail: 'Starts a durable process instance from a typed platform event.',
			status: 'waiting',
			meta: `${node.config.source} · ${node.config.eventType}`,
			kind: 'trigger',
			position: node.position,
			layer: 'worker',
			workflow: {
				name: node.name,
				type: node.type,
				family: 'trigger',
				trigger: { kind: 'event', eventSource: node.config.source }
			}
		};
	}

	if (node.type === 'http-request') {
		return {
			id: node.id,
			eyebrow: 'Durable action',
			title: node.name,
			detail: 'Runs an idempotent HTTPS request inside a retried durable step.',
			status: 'waiting',
			meta: `${node.config.retry.limit} retries · ${node.config.timeoutMs} ms`,
			kind: 'action',
			position: node.position,
			layer: 'external',
			request: `${node.config.method} ${node.config.url}`,
			input: node.config.idempotencyKey,
			output: 'serializable HTTP response',
			workflow: {
				name: node.name,
				type: node.type,
				family: 'integration',
				timeout: `${node.config.timeoutMs}ms`,
				retries: {
					limit: node.config.retry.limit,
					delay: '1 second',
					backoff: node.config.retry.backoff
				},
				connector: {
					kind: 'http',
					operation: node.config.method,
					resource: node.config.url,
					idempotencyKey: node.config.idempotencyKey
				}
			}
		};
	}

	if (node.type === 'condition') {
		return {
			id: node.id,
			eyebrow: 'Condition',
			title: node.name,
			detail: 'Selects one deterministic branch from the current process context.',
			status: 'waiting',
			meta: `${node.config.path} ${node.config.operator}`,
			kind: 'decision',
			position: node.position,
			layer: 'worker',
			input: node.config.path,
			output: 'true / false branch',
			workflow: {
				name: node.name,
				type: 'if',
				family: 'control',
				expression: `${node.config.path} ${node.config.operator}`,
				branches: ['true', 'false']
			}
		};
	}

	if (node.type === 'switch') {
		return {
			id: node.id,
			eyebrow: 'Switch',
			title: node.name,
			detail: 'Selects one typed scalar case or the required default route.',
			status: 'waiting',
			meta: `${node.config.path} · ${node.config.cases.length} cases`,
			kind: 'decision',
			position: node.position,
			layer: 'worker',
			input: node.config.path,
			output: 'matched case or default branch',
			workflow: {
				name: node.name,
				type: 'switch',
				family: 'control',
				expression: node.config.path,
				branches: [...node.config.cases.map((item) => item.id), 'default']
			}
		};
	}

	if (node.type === 'loop') {
		return {
			id: node.id,
			eyebrow: 'Bounded loop',
			title: node.name,
			detail: 'Repeats its body with a deterministic hard iteration limit.',
			status: 'waiting',
			meta: `max ${node.config.maxIterations} iterations`,
			kind: 'decision',
			position: node.position,
			layer: 'worker',
			output: 'body or exit branch',
			workflow: {
				name: node.name,
				type: 'loop',
				family: 'control',
				branches: ['body', 'exit']
			}
		};
	}

	if (node.type === 'break') {
		return {
			id: node.id,
			eyebrow: 'Break',
			title: node.name,
			detail: 'Leaves the referenced loop through its compiled exit route.',
			status: 'waiting',
			meta: node.config.loopId,
			kind: 'terminal',
			position: node.position,
			layer: 'worker',
			output: 'loop exit',
			workflow: {
				name: node.name,
				type: 'break',
				family: 'control'
			}
		};
	}

	if (node.type === 'parallel') {
		return {
			id: node.id,
			eyebrow: 'Parallel fork',
			title: node.name,
			detail: 'Runs isolated branches concurrently and merges their results deterministically.',
			status: 'waiting',
			meta: `${node.config.branches.length} branches · ${node.config.resultKey}`,
			kind: 'decision',
			position: node.position,
			layer: 'worker',
			output: node.config.resultKey,
			workflow: {
				name: node.name,
				type: 'parallel',
				family: 'control',
				branches: node.config.branches.map((branch) => branch.id)
			}
		};
	}

	if (node.type === 'parallel-join') {
		return {
			id: node.id,
			eyebrow: 'Parallel join',
			title: node.name,
			detail: 'Continues once after every branch of the referenced fork resolves.',
			status: 'waiting',
			meta: node.config.parallelId,
			kind: 'action',
			position: node.position,
			layer: 'worker',
			output: 'merged branch results',
			workflow: { name: node.name, type: 'parallel', family: 'control' }
		};
	}

	if (node.type === 'wait') {
		return {
			id: node.id,
			eyebrow: 'Durable wait',
			title: node.name,
			detail: 'Suspends execution durably without holding Worker compute.',
			status: 'waiting',
			meta: `${node.config.durationMs} ms`,
			kind: 'action',
			position: node.position,
			layer: 'worker',
			output: 'unchanged context',
			workflow: {
				name: node.name,
				type: 'step-sleep',
				family: 'wait',
				duration: `${node.config.durationMs} milliseconds`
			}
		};
	}

	if (node.type === 'wait-until') {
		return {
			id: node.id,
			eyebrow: 'Durable wait',
			title: node.name,
			detail: 'Suspends execution durably until an absolute UTC timestamp.',
			status: 'waiting',
			meta: node.config.timestamp,
			kind: 'action',
			position: node.position,
			layer: 'worker',
			output: 'unchanged context',
			workflow: {
				name: node.name,
				type: 'step-sleep-until',
				family: 'wait',
				timestamp: node.config.timestamp
			}
		};
	}

	if (node.type === 'wait-event') {
		return {
			id: node.id,
			eyebrow: 'Event wait',
			title: node.name,
			detail: 'Suspends execution durably until a matching external event arrives.',
			status: 'waiting',
			meta: `${node.config.eventType} · ${node.config.timeoutMs} ms`,
			kind: 'action',
			position: node.position,
			layer: 'worker',
			input: node.config.eventType,
			output: node.config.resultKey,
			workflow: {
				name: node.name,
				type: 'step-wait-for-event',
				family: 'wait',
				eventType: node.config.eventType,
				timeout: `${node.config.timeoutMs} milliseconds`
			}
		};
	}

	if (node.type === 'approval') {
		return {
			id: node.id,
			eyebrow: 'Human approval',
			title: node.name,
			detail: 'Suspends execution until an authenticated owner approves or rejects the run.',
			status: 'waiting',
			meta: `approve / reject · ${node.config.timeoutMs} ms`,
			kind: 'decision',
			position: node.position,
			layer: 'worker',
			input: 'corex-approval',
			output: node.config.resultKey,
			workflow: {
				name: node.name,
				type: 'human-approval',
				family: 'wait',
				eventType: 'corex-approval',
				timeout: `${node.config.timeoutMs} milliseconds`
			}
		};
	}

	if (node.type === 'transform') {
		return {
			id: node.id,
			eyebrow: 'Data transform',
			title: node.name,
			detail: 'Builds serializable context fields from safe JSON paths.',
			status: 'waiting',
			meta: `${node.config.mode} · ${Object.keys(node.config.mappings).length} mappings`,
			kind: 'action',
			position: node.position,
			layer: 'worker',
			input: Object.values(node.config.mappings).join(', '),
			output: Object.keys(node.config.mappings).join(', '),
			workflow: {
				name: node.name,
				type: 'data-transform',
				family: 'data',
				expression: JSON.stringify(node.config.mappings)
			}
		};
	}

	if (node.type === 'invoke-process') {
		return {
			id: node.id,
			eyebrow: 'Subprocess',
			title: node.name,
			detail: 'Starts an owned published process and waits durably for its correlated result.',
			status: 'waiting',
			meta: `${node.config.resultKey} · ${node.config.timeoutMs} ms`,
			kind: 'action',
			position: node.position,
			layer: 'worker',
			input: node.config.inputPath,
			output: node.config.resultKey,
			workflow: {
				name: node.name,
				type: 'invoke-workflow',
				family: 'integration',
				timeout: `${node.config.timeoutMs} milliseconds`,
				connector: {
					kind: 'workflow',
					operation: 'invoke',
					resource: node.config.processId
				}
			}
		};
	}

	if (node.type === 'local-function') {
		return {
			id: node.id,
			eyebrow: 'Local function',
			title: node.name,
			detail: 'Defines a reusable serial body executed within the current process instance.',
			status: 'waiting',
			meta: 'reusable body',
			kind: 'decision',
			position: node.position,
			layer: 'worker',
			output: 'function body',
			workflow: { name: node.name, type: node.type, family: 'control', branches: ['body'] }
		};
	}

	if (node.type === 'local-call') {
		return {
			id: node.id,
			eyebrow: 'Local call',
			title: node.name,
			detail: 'Runs a reusable serial body without creating a subprocess.',
			status: 'waiting',
			meta: `${node.config.functionId} · ${node.config.resultKey}`,
			kind: 'action',
			position: node.position,
			layer: 'worker',
			input: node.config.inputPath,
			output: node.config.resultKey,
			workflow: {
				name: node.name,
				type: node.type,
				family: 'control',
				expression: node.config.functionId
			}
		};
	}

	if (node.type === 'local-return') {
		return {
			id: node.id,
			eyebrow: 'Function return',
			title: node.name,
			detail: 'Returns the local function context to its caller.',
			status: 'waiting',
			meta: node.config.functionId,
			kind: 'terminal',
			position: node.position,
			layer: 'worker',
			output: 'caller result',
			workflow: { name: node.name, type: node.type, family: 'control' }
		};
	}

	if (node.type === 'block') {
		return {
			id: node.id,
			eyebrow: 'Executable block',
			title: node.name,
			detail: 'Runs an isolated serial body before rejoining the process continuation.',
			status: 'waiting',
			meta: 'serial body',
			kind: 'decision',
			position: node.position,
			layer: 'worker',
			output: 'continuation',
			workflow: { name: node.name, type: node.type, family: 'structure', branches: ['body'] }
		};
	}

	if (node.type === 'end-failure') {
		return {
			id: node.id,
			eyebrow: 'Failure terminal',
			title: node.name,
			detail: node.config.message,
			status: 'failed',
			meta: node.config.code,
			kind: 'terminal',
			position: node.position,
			layer: 'worker',
			output: node.config.message,
			workflow: {
				name: node.name,
				type: node.type,
				family: 'terminal'
			}
		};
	}

	return {
		id: node.id,
		eyebrow: 'Success terminal',
		title: node.name,
		detail: 'Returns the serializable process result after all durable actions complete.',
		status: 'waiting',
		meta: node.config.outputExpression ?? 'empty result',
		kind: 'terminal',
		position: node.position,
		layer: 'worker',
		output: node.config.outputExpression,
		workflow: {
			name: node.name,
			type: node.type,
			family: 'terminal',
			expression: node.config.outputExpression
		}
	};
}

export function processDefinitionToFlowScenario(definition: ProcessDefinition): FlowScenario {
	const trigger = definition.nodes.find(isProcessTriggerNode);
	const entrypoint =
		trigger?.type === 'trigger-http'
			? `${trigger.config.method} ${trigger.config.path}`
			: trigger?.type === 'trigger-schedule'
				? `${trigger.config.cron} · ${trigger.config.timezone}`
				: trigger?.type === 'trigger-event'
					? `${trigger.config.source} · ${trigger.config.eventType}`
					: 'No trigger';
	return {
		id: definition.id,
		category: 'Operations',
		label: definition.name,
		title: definition.name,
		description: definition.description,
		entrypoint,
		nodes: definition.nodes.map(toFlowNode),
		edges: definition.edges.map((edge) => ({
			id: edge.id,
			source: edge.source,
			target: edge.target,
			...(edge.parallel !== undefined
				? { label: edge.parallel, tone: 'success' as const }
				: edge.function !== undefined
					? { label: edge.function, tone: 'success' as const }
					: edge.block !== undefined
						? {
								label: edge.block,
								tone: edge.block === 'body' ? ('success' as const) : ('default' as const)
							}
						: edge.loop !== undefined
							? {
									label: edge.loop,
									tone: edge.loop === 'body' ? ('success' as const) : ('danger' as const)
								}
							: edge.loopBack !== undefined
								? { label: 'repeat', tone: 'default' as const }
								: edge.case !== undefined
									? {
											label: edge.case,
											tone: edge.case === 'default' ? ('danger' as const) : ('success' as const)
										}
									: edge.when === undefined
										? {}
										: {
												label: edge.when ? 'true' : 'false',
												tone: edge.when ? ('success' as const) : ('danger' as const)
											})
		}))
	};
}

function slugify(text: string): string {
	return (
		text
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-|-$/g, '') || 'node'
	);
}

function safeIdentifier(text: string, fallback = 'item'): string {
	const cleaned = text.replace(/[^A-Za-z0-9_-]/g, '_').replace(/^[^A-Za-z_]+/, '_');
	return cleaned || fallback;
}

function parseMethodAndPath(
	raw?: string,
	defaultPath = '/api/v1/resource'
): { method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'; path: string } {
	if (!raw) return { method: 'POST', path: defaultPath };
	const parts = raw.trim().split(/\s+/);
	const validMethods: Array<'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'> = [
		'GET',
		'POST',
		'PUT',
		'PATCH',
		'DELETE'
	];
	if (parts.length >= 2 && validMethods.includes(parts[0].toUpperCase() as any)) {
		const method = parts[0].toUpperCase() as 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
		const cleanPath = parts[1].split('?')[0].replace(/\|.*/, '');
		return { method, path: cleanPath.startsWith('/') ? cleanPath : `/${cleanPath}` };
	}
	return { method: 'POST', path: raw.startsWith('/') ? raw : defaultPath };
}

export function flowScenarioToProcessDefinition(scenario: FlowScenario): ProcessDefinition {
	const rawNodes = scenario.nodes;
	const rawEdges = scenario.edges;

	const incomingCounts = new Map<string, number>();
	for (const edge of rawEdges) {
		incomingCounts.set(edge.target, (incomingCounts.get(edge.target) ?? 0) + 1);
	}
	let triggerNode =
		rawNodes.find((n) => (incomingCounts.get(n.id) ?? 0) === 0 && n.kind === 'trigger') ||
		rawNodes.find((n) => (incomingCounts.get(n.id) ?? 0) === 0) ||
		rawNodes.find((n) => n.kind === 'trigger') ||
		rawNodes[0];

	if (!triggerNode && rawNodes.length > 0) {
		triggerNode = rawNodes[0];
	}

	const adjacency = new Map<string, string[]>();
	for (const edge of rawEdges) {
		if (edge.target === triggerNode.id) continue;
		const list = adjacency.get(edge.source) ?? [];
		list.push(edge.target);
		adjacency.set(edge.source, list);
	}

	const reachable = new Set<string>();
	if (triggerNode) {
		const queue = [triggerNode.id];
		while (queue.length > 0) {
			const current = queue.shift()!;
			if (reachable.has(current)) continue;
			reachable.add(current);
			const neighbors = adjacency.get(current) ?? [];
			for (const next of neighbors) {
				if (!reachable.has(next)) queue.push(next);
			}
		}
	}

	const activeNodes = rawNodes.filter((n) => reachable.has(n.id));
	const activeNodeIds = new Set(activeNodes.map((n) => n.id));

	const visited = new Set<string>();
	const inStack = new Set<string>();
	const safeEdges: Array<{ id: string; source: string; target: string; label?: string; tone?: string }> = [];

	function dfs(nodeId: string) {
		visited.add(nodeId);
		inStack.add(nodeId);
		const outList = rawEdges.filter(
			(e) => e.source === nodeId && activeNodeIds.has(e.target) && e.target !== triggerNode.id
		);
		for (const edge of outList) {
			if (!visited.has(edge.target)) {
				safeEdges.push(edge);
				dfs(edge.target);
			} else if (!inStack.has(edge.target)) {
				safeEdges.push(edge);
			}
		}
		inStack.delete(nodeId);
	}

	if (triggerNode) {
		dfs(triggerNode.id);
	}

	const edgesBySource = new Map<string, typeof safeEdges>();
	for (const edge of safeEdges) {
		const list = edgesBySource.get(edge.source) ?? [];
		list.push(edge);
		edgesBySource.set(edge.source, list);
	}

	const usedNames = new Set<string>();
	function uniqueName(title: string, id: string): string {
		let base = slugify(title) || slugify(id) || 'step';
		if (!usedNames.has(base)) {
			usedNames.add(base);
			return base;
		}
		let index = 2;
		while (usedNames.has(`${base}-${index}`)) {
			index++;
		}
		const unique = `${base}-${index}`;
		usedNames.add(unique);
		return unique;
	}

	const processNodes: ProcessNode[] = [];
	const processEdges: ProcessEdge[] = [];

	const entrypointParsed = parseMethodAndPath(scenario.entrypoint, `/api/v1/${slugify(scenario.id)}`);

	for (const node of activeNodes) {
		const nodeName = uniqueName(node.title, node.id);
		const out = edgesBySource.get(node.id) ?? [];

		if (node.id === triggerNode.id) {
			processNodes.push({
				id: node.id,
				name: nodeName,
				type: 'trigger-http',
				position: { ...node.position },
				config: {
					method: entrypointParsed.method,
					path: entrypointParsed.path
				}
			});

			if (out.length === 0) {
				const successId = `${node.id}-success`;
				processNodes.push({
					id: successId,
					name: uniqueName('success', successId),
					type: 'end-success',
					position: { x: node.position.x + 300, y: node.position.y },
					config: { outputExpression: '$.result' }
				});
				processEdges.push({
					id: `${node.id}-${successId}`,
					source: node.id,
					target: successId
				});
			} else {
				for (const edge of out) {
					processEdges.push({
						id: edge.id || `${edge.source}-${edge.target}`,
						source: edge.source,
						target: edge.target
					});
				}
			}
			continue;
		}

		if (out.length === 0) {
			const isFailure =
				node.status === 'failed' ||
				node.eyebrow?.toLowerCase().includes('error') ||
				node.id.toLowerCase().includes('fail') ||
				node.id.toLowerCase().includes('invalid') ||
				node.id.toLowerCase().includes('missing') ||
				node.id.toLowerCase().includes('denied');

			if (isFailure) {
				processNodes.push({
					id: node.id,
					name: nodeName,
					type: 'end-failure',
					position: { ...node.position },
					config: {
						code: safeIdentifier(node.meta || 'PROCESS_FAILED', 'PROCESS_FAILED'),
						message: node.detail || node.title
					}
				});
			} else {
				processNodes.push({
					id: node.id,
					name: nodeName,
					type: 'end-success',
					position: { ...node.position },
					config: {
						outputExpression: '$.result'
					}
				});
			}
			continue;
		}

		if (out.length === 1) {
			const edge = out[0];
			processEdges.push({
				id: edge.id || `${edge.source}-${edge.target}`,
				source: edge.source,
				target: edge.target
			});

			const isWaitEvent =
				node.title.toLowerCase().includes('wait') ||
				node.title.toLowerCase().includes('webhook') ||
				node.detail?.toLowerCase().includes('webhook') ||
				node.operation?.toLowerCase().includes('wait');

			if (isWaitEvent) {
				processNodes.push({
					id: node.id,
					name: nodeName,
					type: 'wait-event',
					position: { ...node.position },
					config: {
						eventType: safeIdentifier(node.id, 'event'),
						resultKey: 'event_result',
						timeoutMs: 300_000
					}
				});
			} else if (
				node.request ||
				node.layer === 'worker' ||
				node.layer === 'external' ||
				node.eyebrow?.toLowerCase().includes('worker') ||
				node.eyebrow?.toLowerCase().includes('api')
			) {
				const req = parseMethodAndPath(node.request, `/api/v1/${slugify(node.id)}`);
				processNodes.push({
					id: node.id,
					name: nodeName,
					type: 'http-request',
					position: { ...node.position },
					config: {
						method: req.method,
						url: req.path.startsWith('http') ? req.path : `https://api.letsrealtalk.com${req.path}`,
						timeoutMs: 30_000,
						retry: { limit: 3, backoff: 'exponential' }
					}
				});
			} else {
				processNodes.push({
					id: node.id,
					name: nodeName,
					type: 'transform',
					position: { ...node.position },
					config: {
						mode: 'merge',
						mappings: {
							result: '$.input'
						}
					}
				});
			}
			continue;
		}

		if (out.length === 2) {
			processNodes.push({
				id: node.id,
				name: nodeName,
				type: 'condition',
				position: { ...node.position },
				config: {
					path: '$.valid',
					operator: 'equals',
					value: true
				}
			});

			const isNegativeLabel = (label?: string, tone?: string) => {
				const l = (label || '').toLowerCase();
				return (
					tone === 'danger' ||
					l === 'no' ||
					l === 'false' ||
					l === 'invalid' ||
					l === 'failed' ||
					l === 'denied' ||
					l === 'missing' ||
					l === '404' ||
					l === '400' ||
					l === '422' ||
					l === 'network'
				);
			};

			const [e0, e1] = out;
			if (isNegativeLabel(e0.label, e0.tone)) {
				processEdges.push({
					id: e1.id || `${e1.source}-${e1.target}-true`,
					source: e1.source,
					target: e1.target,
					when: true
				});
				processEdges.push({
					id: e0.id || `${e0.source}-${e0.target}-false`,
					source: e0.source,
					target: e0.target,
					when: false
				});
			} else {
				processEdges.push({
					id: e0.id || `${e0.source}-${e0.target}-true`,
					source: e0.source,
					target: e0.target,
					when: true
				});
				processEdges.push({
					id: e1.id || `${e1.source}-${e1.target}-false`,
					source: e1.source,
					target: e1.target,
					when: false
				});
			}
			continue;
		}

		const caseIds: string[] = [];
		const cases: Array<{ id: string; value: string }> = [];
		for (let i = 0; i < out.length - 1; i++) {
			const label = out[i].label || `branch_${i + 1}`;
			let caseId = safeIdentifier(label, `branch_${i + 1}`);
			if (caseId === 'default' || caseIds.includes(caseId)) {
				caseId = `branch_${i + 1}`;
			}
			caseIds.push(caseId);
			cases.push({ id: caseId, value: label });
		}

		processNodes.push({
			id: node.id,
			name: nodeName,
			type: 'switch',
			position: { ...node.position },
			config: {
				path: '$.route',
				cases
			}
		});

		for (let i = 0; i < out.length - 1; i++) {
			const edge = out[i];
			processEdges.push({
				id: edge.id || `${edge.source}-${edge.target}-${cases[i].id}`,
				source: edge.source,
				target: edge.target,
				case: cases[i].id
			});
		}
		const defaultEdge = out[out.length - 1];
		processEdges.push({
			id: defaultEdge.id || `${defaultEdge.source}-${defaultEdge.target}-default`,
			source: defaultEdge.source,
			target: defaultEdge.target,
			case: 'default'
		});
	}

	return {
		schemaVersion: PROCESS_DEFINITION_SCHEMA_VERSION,
		id: `draft-${slugify(scenario.id)}`,
		name: scenario.label || scenario.title,
		description: scenario.description,
		revision: 1,
		lifecycle: 'draft',
		nodes: processNodes,
		edges: processEdges
	};
}
