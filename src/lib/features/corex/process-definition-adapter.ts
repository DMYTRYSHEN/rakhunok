import type { FlowNode, FlowScenario } from './types';
import type { ProcessDefinition, ProcessNode } from './process-definition';

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
	const trigger = definition.nodes.find((node) => node.type === 'trigger-http');
	return {
		id: definition.id,
		category: 'Operations',
		label: definition.name,
		title: definition.name,
		description: definition.description,
		entrypoint: trigger ? `${trigger.config.method} ${trigger.config.path}` : 'No trigger',
		nodes: definition.nodes.map(toFlowNode),
		edges: definition.edges.map((edge) => ({
			id: edge.id,
			source: edge.source,
			target: edge.target,
			...(edge.case !== undefined
				? { label: edge.case, tone: edge.case === 'default' ? ('danger' as const) : ('success' as const) }
				: edge.when === undefined
				? {}
				: {
						label: edge.when ? 'true' : 'false',
						tone: edge.when ? ('success' as const) : ('danger' as const)
					})
		}))
	};
}
