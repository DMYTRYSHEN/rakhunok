export const PROCESS_DEFINITION_SCHEMA_VERSION = 1 as const;

export type ProcessLifecycle = 'draft' | 'published' | 'retired';

export type ProcessPosition = {
	x: number;
	y: number;
};

type ProcessNodeBase = {
	id: string;
	name: string;
	position: ProcessPosition;
};

export type HttpTriggerNode = ProcessNodeBase & {
	type: 'trigger-http';
	config: {
		method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
		path: string;
	};
};

export type HttpRequestNode = ProcessNodeBase & {
	type: 'http-request';
	config: {
		method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
		url: string;
		timeoutMs: number;
		retry: {
			limit: number;
			backoff: 'constant' | 'linear' | 'exponential';
		};
		idempotencyKey?: string;
	};
};

export type SuccessNode = ProcessNodeBase & {
	type: 'end-success';
	config: {
		outputExpression?: string;
	};
};

export type ConditionNode = ProcessNodeBase & {
	type: 'condition';
	config: {
		path: string;
		operator: 'equals' | 'not-equals' | 'greater-than' | 'less-than' | 'exists';
		value?: string | number | boolean | null;
	};
};

export type SwitchNode = ProcessNodeBase & {
	type: 'switch';
	config: {
		path: string;
		cases: Array<{
			id: string;
			value: string | number | boolean | null;
		}>;
	};
};

export type WaitNode = ProcessNodeBase & {
	type: 'wait';
	config: { durationMs: number };
};

export type WaitUntilNode = ProcessNodeBase & {
	type: 'wait-until';
	config: { timestamp: string };
};

export type EventWaitNode = ProcessNodeBase & {
	type: 'wait-event';
	config: {
		eventType: string;
		timeoutMs: number;
		resultKey: string;
	};
};

export type ApprovalNode = ProcessNodeBase & {
	type: 'approval';
	config: {
		assigneeUserId: string;
		timeoutMs: number;
		resultKey: string;
	};
};

export type TransformNode = ProcessNodeBase & {
	type: 'transform';
	config: {
		mode: 'merge' | 'replace';
		mappings: Record<string, string>;
	};
};

export type InvokeProcessNode = ProcessNodeBase & {
	type: 'invoke-process';
	config: {
		processId: string;
		inputPath: string;
		resultKey: string;
		timeoutMs: number;
	};
};

export type ProcessNode =
	| HttpTriggerNode
	| HttpRequestNode
	| ConditionNode
	| SwitchNode
	| WaitNode
	| WaitUntilNode
	| EventWaitNode
	| ApprovalNode
	| TransformNode
	| InvokeProcessNode
	| SuccessNode;

export type ProcessEdge = {
	id: string;
	source: string;
	target: string;
	when?: boolean;
	case?: string;
};

export type ProcessDefinition = {
	schemaVersion: typeof PROCESS_DEFINITION_SCHEMA_VERSION;
	id: string;
	name: string;
	description: string;
	revision: number;
	lifecycle: ProcessLifecycle;
	nodes: ProcessNode[];
	edges: ProcessEdge[];
};

export type ProcessValidationCode =
	| 'duplicate-edge-id'
	| 'duplicate-node-id'
	| 'duplicate-node-name'
	| 'invalid-edge'
	| 'invalid-http-host'
	| 'invalid-http-path'
	| 'invalid-http-url'
	| 'invalid-approval'
	| 'invalid-condition'
	| 'invalid-output-expression'
	| 'invalid-retry-limit'
	| 'invalid-revision'
	| 'invalid-switch'
	| 'invalid-subprocess'
	| 'invalid-timeout'
	| 'invalid-transform'
	| 'invalid-wait'
	| 'missing-terminal'
	| 'multiple-triggers'
	| 'cycle'
	| 'terminal-has-output'
	| 'trigger-has-input'
	| 'unreachable-node';

export type ProcessValidationIssue = {
	code: ProcessValidationCode;
	message: string;
	nodeId?: string;
	edgeId?: string;
};

export type ProcessValidationResult =
	{ valid: true; issues: [] } | { valid: false; issues: ProcessValidationIssue[] };

const NODE_TYPES = new Set([
	'trigger-http',
	'http-request',
	'condition',
	'switch',
	'wait',
	'wait-until',
	'wait-event',
	'approval',
	'transform',
	'invoke-process',
	'end-success'
]);
const HTTP_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);
const CONDITION_OPERATORS = new Set([
	'equals',
	'not-equals',
	'greater-than',
	'less-than',
	'exists'
]);
const RETRY_BACKOFFS = new Set(['constant', 'linear', 'exponential']);
const TRANSFORM_MODES = new Set(['merge', 'replace']);

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isScalar(value: unknown): value is string | number | boolean | null {
	return value === null || ['string', 'number', 'boolean'].includes(typeof value);
}

function isProcessNode(value: unknown): value is ProcessNode {
	if (
		!isRecord(value) ||
		typeof value.id !== 'string' ||
		typeof value.name !== 'string' ||
		!NODE_TYPES.has(String(value.type))
	)
		return false;
	if (
		!isRecord(value.position) ||
		typeof value.position.x !== 'number' ||
		typeof value.position.y !== 'number' ||
		!isRecord(value.config)
	)
		return false;
	const config = value.config;
	switch (value.type) {
		case 'trigger-http':
			return HTTP_METHODS.has(String(config.method)) && typeof config.path === 'string';
		case 'http-request':
			return (
				HTTP_METHODS.has(String(config.method)) &&
				typeof config.url === 'string' &&
				typeof config.timeoutMs === 'number' &&
				isRecord(config.retry) &&
				typeof config.retry.limit === 'number' &&
				RETRY_BACKOFFS.has(String(config.retry.backoff)) &&
				(config.idempotencyKey === undefined || typeof config.idempotencyKey === 'string')
			);
		case 'condition':
			return (
				typeof config.path === 'string' &&
				CONDITION_OPERATORS.has(String(config.operator)) &&
				(config.value === undefined || isScalar(config.value))
			);
		case 'switch':
			return (
				typeof config.path === 'string' &&
				Array.isArray(config.cases) &&
				config.cases.every(
					(item) =>
						isRecord(item) && typeof item.id === 'string' && isScalar(item.value)
				)
			);
		case 'wait':
			return typeof config.durationMs === 'number';
		case 'wait-until':
			return typeof config.timestamp === 'string';
		case 'wait-event':
			return (
				typeof config.eventType === 'string' &&
				typeof config.timeoutMs === 'number' &&
				typeof config.resultKey === 'string'
			);
		case 'approval':
			return (
				typeof config.assigneeUserId === 'string' &&
				typeof config.timeoutMs === 'number' &&
				typeof config.resultKey === 'string'
			);
		case 'transform':
			return (
				TRANSFORM_MODES.has(String(config.mode)) &&
				isRecord(config.mappings) &&
				Object.values(config.mappings).every((path) => typeof path === 'string')
			);
		case 'invoke-process':
			return (
				typeof config.processId === 'string' &&
				typeof config.inputPath === 'string' &&
				typeof config.resultKey === 'string' &&
				typeof config.timeoutMs === 'number'
			);
		case 'end-success':
			return config.outputExpression === undefined || typeof config.outputExpression === 'string';
		default:
			return false;
	}
}

export function parseProcessDefinition(value: unknown): ProcessDefinition | undefined {
	if (
		!isRecord(value) ||
		value.schemaVersion !== PROCESS_DEFINITION_SCHEMA_VERSION ||
		typeof value.id !== 'string' ||
		typeof value.name !== 'string' ||
		typeof value.description !== 'string'
	)
		return undefined;
	if (
		!Number.isSafeInteger(value.revision) ||
		!['draft', 'published', 'retired'].includes(String(value.lifecycle))
	)
		return undefined;
	if (
		!Array.isArray(value.nodes) ||
		!value.nodes.every(isProcessNode) ||
		!Array.isArray(value.edges)
	)
		return undefined;
	if (
		!value.edges.every(
			(edge) =>
				isRecord(edge) &&
				typeof edge.id === 'string' &&
				typeof edge.source === 'string' &&
				typeof edge.target === 'string' &&
				(edge.when === undefined || typeof edge.when === 'boolean') &&
				(edge.case === undefined || typeof edge.case === 'string')
		)
	)
		return undefined;
	return value as ProcessDefinition;
}

function duplicates(values: string[]): Set<string> {
	const seen = new Set<string>();
	const repeated = new Set<string>();
	for (const value of values) {
		if (seen.has(value)) repeated.add(value);
		seen.add(value);
	}
	return repeated;
}

function parseHttpsUrl(value: string): URL | undefined {
	try {
		const url = new URL(value);
		return url.protocol === 'https:' ? url : undefined;
	} catch {
		return undefined;
	}
}

function isPrivateIpv4(hostname: string): boolean {
	const octets = hostname.split('.').map(Number);
	if (
		octets.length !== 4 ||
		octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)
	)
		return false;
	return (
		octets[0] === 0 ||
		octets[0] === 10 ||
		octets[0] === 127 ||
		(octets[0] === 169 && octets[1] === 254) ||
		(octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
		(octets[0] === 192 && octets[1] === 168) ||
		octets[0] >= 224
	);
}

function isClearlyNonPublicHost(hostname: string): boolean {
	const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
	return (
		host === 'localhost' ||
		host.endsWith('.localhost') ||
		host.endsWith('.local') ||
		isPrivateIpv4(host) ||
		host === '::' ||
		host === '::1' ||
		host.startsWith('fc') ||
		host.startsWith('fd') ||
		host.startsWith('fe8') ||
		host.startsWith('fe9') ||
		host.startsWith('fea') ||
		host.startsWith('feb')
	);
}

const JSON_PATH = /^\$(?:\.[A-Za-z_][A-Za-z0-9_-]*)*$/;
const TRANSFORM_KEY = /^[A-Za-z_][A-Za-z0-9_-]*$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validateProcessDefinition(definition: ProcessDefinition): ProcessValidationResult {
	const issues: ProcessValidationIssue[] = [];
	const nodeIds = new Set(definition.nodes.map((node) => node.id));

	if (!Number.isInteger(definition.revision) || definition.revision < 1) {
		issues.push({ code: 'invalid-revision', message: 'Revision must be a positive integer.' });
	}

	for (const id of duplicates(definition.nodes.map((node) => node.id))) {
		issues.push({
			code: 'duplicate-node-id',
			message: `Node ID "${id}" is not unique.`,
			nodeId: id
		});
	}
	for (const name of duplicates(definition.nodes.map((node) => node.name))) {
		issues.push({ code: 'duplicate-node-name', message: `Step name "${name}" is not unique.` });
	}
	for (const id of duplicates(definition.edges.map((edge) => edge.id))) {
		issues.push({
			code: 'duplicate-edge-id',
			message: `Edge ID "${id}" is not unique.`,
			edgeId: id
		});
	}

	const triggers = definition.nodes.filter((node) => node.type === 'trigger-http');
	if (triggers.length !== 1) {
		issues.push({
			code: 'multiple-triggers',
			message: 'A process must have exactly one HTTP trigger.'
		});
	}
	if (!definition.nodes.some((node) => node.type === 'end-success')) {
		issues.push({
			code: 'missing-terminal',
			message: 'A process must have at least one success terminal.'
		});
	}

	for (const node of definition.nodes) {
		if (
			node.type === 'trigger-http' &&
			(!node.config.path.startsWith('/') || node.config.path.includes('?'))
		) {
			issues.push({
				code: 'invalid-http-path',
				message: 'Trigger path must be an absolute path without a query string.',
				nodeId: node.id
			});
		}
		if (node.type === 'http-request') {
			const actionUrl = parseHttpsUrl(node.config.url);
			if (!actionUrl) {
				issues.push({
					code: 'invalid-http-url',
					message: 'HTTP actions require an HTTPS URL.',
					nodeId: node.id
				});
			} else if (isClearlyNonPublicHost(actionUrl.hostname)) {
				issues.push({
					code: 'invalid-http-host',
					message: 'HTTP actions require a public network target.',
					nodeId: node.id
				});
			}
			if (
				!Number.isInteger(node.config.timeoutMs) ||
				node.config.timeoutMs < 1 ||
				node.config.timeoutMs > 1_800_000
			) {
				issues.push({
					code: 'invalid-timeout',
					message: 'HTTP action timeout must be between 1 ms and 30 minutes.',
					nodeId: node.id
				});
			}
			if (
				!Number.isInteger(node.config.retry.limit) ||
				node.config.retry.limit < 0 ||
				node.config.retry.limit > 10
			) {
				issues.push({
					code: 'invalid-retry-limit',
					message: 'Retry limit must be an integer from 0 to 10.',
					nodeId: node.id
				});
			}
		}
		if (node.type === 'condition') {
			if (
				!JSON_PATH.test(node.config.path) ||
				(node.config.operator !== 'exists' && !Object.hasOwn(node.config, 'value'))
			) {
				issues.push({
					code: 'invalid-condition',
					message: 'Conditions require a safe JSON path and a comparison value.',
					nodeId: node.id
				});
			}
		}
		if (node.type === 'switch') {
			const caseIds = node.config.cases.map((item) => item.id);
			const caseValues = node.config.cases.map((item) => `${typeof item.value}:${String(item.value)}`);
			if (
				!JSON_PATH.test(node.config.path) ||
				node.config.cases.length < 1 ||
				node.config.cases.length > 20 ||
				caseIds.some((id) => !TRANSFORM_KEY.test(id) || id === 'default') ||
				duplicates(caseIds).size > 0 ||
				duplicates(caseValues).size > 0
			) {
				issues.push({
					code: 'invalid-switch',
					message: 'Switches require a safe JSON path and 1 to 20 uniquely named scalar cases.',
					nodeId: node.id
				});
			}
		}
		if (
			node.type === 'end-success' &&
			node.config.outputExpression !== undefined &&
			!JSON_PATH.test(node.config.outputExpression)
		) {
			issues.push({
				code: 'invalid-output-expression',
				message: 'Success output requires a safe JSON path.',
				nodeId: node.id
			});
		}
		if (
			node.type === 'wait' &&
			(!Number.isInteger(node.config.durationMs) ||
				node.config.durationMs < 1 ||
				node.config.durationMs > 31_536_000_000)
		) {
			issues.push({
				code: 'invalid-wait',
				message: 'Wait duration must be between 1 ms and 365 days.',
				nodeId: node.id
			});
		}
		if (node.type === 'wait-until') {
			const timestamp = Date.parse(node.config.timestamp);
			if (
				!Number.isFinite(timestamp) ||
				new Date(timestamp).toISOString() !== node.config.timestamp
			) {
				issues.push({
					code: 'invalid-wait',
					message: 'Absolute waits require a canonical UTC ISO timestamp.',
					nodeId: node.id
				});
			}
		}
		if (
			node.type === 'wait-event' &&
			(!TRANSFORM_KEY.test(node.config.eventType) ||
				!TRANSFORM_KEY.test(node.config.resultKey) ||
				!Number.isInteger(node.config.timeoutMs) ||
				node.config.timeoutMs < 1 ||
				node.config.timeoutMs > 31_536_000_000)
		) {
			issues.push({
				code: 'invalid-wait',
				message:
					'Event waits require safe event/result names and a timeout between 1 ms and 365 days.',
				nodeId: node.id
			});
		}
		if (
			node.type === 'approval' &&
			(!UUID.test(node.config.assigneeUserId) ||
				!TRANSFORM_KEY.test(node.config.resultKey) ||
				!Number.isInteger(node.config.timeoutMs) ||
				node.config.timeoutMs < 1 ||
				node.config.timeoutMs > 31_536_000_000)
		) {
			issues.push({
				code: 'invalid-wait',
				message:
					'Approvals require an assignee user ID, a safe result name, and a timeout between 1 ms and 365 days.',
				nodeId: node.id
			});
		}
		if (node.type === 'transform') {
			const mappings = Object.entries(node.config.mappings);
			if (
				mappings.length === 0 ||
				mappings.some(([key, path]) => !TRANSFORM_KEY.test(key) || !JSON_PATH.test(path))
			) {
				issues.push({
					code: 'invalid-transform',
					message: 'Transforms require safe output keys and JSON path mappings.',
					nodeId: node.id
				});
			}
		}
		if (
			node.type === 'invoke-process' &&
			(!UUID.test(node.config.processId) ||
				!JSON_PATH.test(node.config.inputPath) ||
				!TRANSFORM_KEY.test(node.config.resultKey) ||
				!Number.isInteger(node.config.timeoutMs) ||
				node.config.timeoutMs < 1 ||
				node.config.timeoutMs > 31_536_000_000)
		) {
			issues.push({
				code: 'invalid-subprocess',
				message:
					'Subprocesses require a process ID, safe input/result names, and a timeout between 1 ms and 365 days.',
				nodeId: node.id
			});
		}
	}

	const outgoing = new Map<string, string[]>();
	const incoming = new Map<string, number>();
	for (const node of definition.nodes) {
		outgoing.set(node.id, []);
		incoming.set(node.id, 0);
	}
	for (const edge of definition.edges) {
		if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target) || edge.source === edge.target) {
			issues.push({
				code: 'invalid-edge',
				message: `Edge "${edge.id}" must connect two distinct existing nodes.`,
				edgeId: edge.id
			});
			continue;
		}
		outgoing.get(edge.source)?.push(edge.target);
		incoming.set(edge.target, (incoming.get(edge.target) ?? 0) + 1);
	}

	for (const trigger of triggers) {
		if ((incoming.get(trigger.id) ?? 0) > 0) {
			issues.push({
				code: 'trigger-has-input',
				message: 'An HTTP trigger cannot have incoming edges.',
				nodeId: trigger.id
			});
		}
	}
	for (const terminal of definition.nodes.filter((node) => node.type === 'end-success')) {
		if ((outgoing.get(terminal.id)?.length ?? 0) > 0) {
			issues.push({
				code: 'terminal-has-output',
				message: 'A terminal cannot have outgoing edges.',
				nodeId: terminal.id
			});
		}
	}
	for (const condition of definition.nodes.filter((node) => node.type === 'condition')) {
		const branches = definition.edges.filter((edge) => edge.source === condition.id);
		if (
			branches.length !== 2 ||
			!branches.some((edge) => edge.when === true) ||
			!branches.some((edge) => edge.when === false)
		) {
			issues.push({
				code: 'invalid-condition',
				message: `Condition "${condition.name}" requires one true and one false branch.`,
				nodeId: condition.id
			});
		}
	}
	for (const switchNode of definition.nodes.filter((node) => node.type === 'switch')) {
		const branches = definition.edges.filter((edge) => edge.source === switchNode.id);
		const expectedCases = [...switchNode.config.cases.map((item) => item.id), 'default'];
		if (
			branches.length !== expectedCases.length ||
			expectedCases.some((caseId) => branches.filter((edge) => edge.case === caseId).length !== 1) ||
			branches.some((edge) => edge.when !== undefined)
		) {
			issues.push({
				code: 'invalid-switch',
				message: `Switch "${switchNode.name}" requires one branch per case and one default branch.`,
				nodeId: switchNode.id
			});
		}
	}
	for (const approval of definition.nodes.filter((node) => node.type === 'approval')) {
		const branches = definition.edges.filter((edge) => edge.source === approval.id);
		if (
			branches.length !== 2 ||
			!branches.some((edge) => edge.when === true) ||
			!branches.some((edge) => edge.when === false)
		) {
			issues.push({
				code: 'invalid-approval',
				message: `Approval "${approval.name}" requires one approved and one rejected branch.`,
				nodeId: approval.id
			});
		}
	}

	const visiting = new Set<string>();
	const visited = new Set<string>();
	let hasCycle = false;
	function visit(nodeId: string) {
		if (visiting.has(nodeId)) {
			hasCycle = true;
			return;
		}
		if (visited.has(nodeId)) return;
		visiting.add(nodeId);
		for (const target of outgoing.get(nodeId) ?? []) visit(target);
		visiting.delete(nodeId);
		visited.add(nodeId);
	}
	for (const node of definition.nodes) visit(node.id);
	if (hasCycle)
		issues.push({ code: 'cycle', message: 'Executable process graphs cannot contain cycles.' });

	if (triggers.length === 1) {
		const reachable = new Set<string>();
		const queue = [triggers[0].id];
		while (queue.length > 0) {
			const nodeId = queue.shift();
			if (!nodeId || reachable.has(nodeId)) continue;
			reachable.add(nodeId);
			queue.push(...(outgoing.get(nodeId) ?? []));
		}
		for (const node of definition.nodes) {
			if (!reachable.has(node.id)) {
				issues.push({
					code: 'unreachable-node',
					message: `Node "${node.name}" is not reachable from the trigger.`,
					nodeId: node.id
				});
			}
		}
	}

	return issues.length === 0 ? { valid: true, issues: [] } : { valid: false, issues };
}

export function createStarterProcessDefinition(): ProcessDefinition {
	return {
		schemaVersion: PROCESS_DEFINITION_SCHEMA_VERSION,
		id: 'payment-callback-draft',
		name: 'Payment callback draft',
		description: 'Receive a payment callback, forward it to an HTTPS endpoint, and return success.',
		revision: 1,
		lifecycle: 'draft',
		nodes: [
			{
				id: 'http-trigger',
				name: 'receive-payment-callback',
				type: 'trigger-http',
				position: { x: 60, y: 240 },
				config: { method: 'POST', path: '/callbacks/payment' }
			},
			{
				id: 'http-action',
				name: 'forward-payment-callback',
				type: 'http-request',
				position: { x: 380, y: 240 },
				config: {
					method: 'POST',
					url: 'https://api.example.com/payments',
					timeoutMs: 30_000,
					retry: { limit: 3, backoff: 'exponential' },
					idempotencyKey: '$.paymentId'
				}
			},
			{
				id: 'success',
				name: 'return-success',
				type: 'end-success',
				position: { x: 700, y: 240 },
				config: { outputExpression: '$.http-action.response' }
			}
		],
		edges: [
			{ id: 'trigger-action', source: 'http-trigger', target: 'http-action' },
			{ id: 'action-success', source: 'http-action', target: 'success' }
		]
	};
}
