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

export type WaitNode = ProcessNodeBase & {
	type: 'wait';
	config: { durationMs: number };
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

export type ProcessNode = HttpTriggerNode | HttpRequestNode | ConditionNode | WaitNode | EventWaitNode | ApprovalNode | TransformNode | SuccessNode;

export type ProcessEdge = {
	id: string;
	source: string;
	target: string;
	when?: boolean;
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
	| 'invalid-condition'
	| 'invalid-retry-limit'
	| 'invalid-revision'
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
	| { valid: true; issues: [] }
	| { valid: false; issues: ProcessValidationIssue[] };

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
	if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) return false;
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
		issues.push({ code: 'duplicate-node-id', message: `Node ID "${id}" is not unique.`, nodeId: id });
	}
	for (const name of duplicates(definition.nodes.map((node) => node.name))) {
		issues.push({ code: 'duplicate-node-name', message: `Step name "${name}" is not unique.` });
	}
	for (const id of duplicates(definition.edges.map((edge) => edge.id))) {
		issues.push({ code: 'duplicate-edge-id', message: `Edge ID "${id}" is not unique.`, edgeId: id });
	}

	const triggers = definition.nodes.filter((node) => node.type === 'trigger-http');
	if (triggers.length !== 1) {
		issues.push({ code: 'multiple-triggers', message: 'A process must have exactly one HTTP trigger.' });
	}
	if (!definition.nodes.some((node) => node.type === 'end-success')) {
		issues.push({ code: 'missing-terminal', message: 'A process must have at least one success terminal.' });
	}

	for (const node of definition.nodes) {
		if (node.type === 'trigger-http' && (!node.config.path.startsWith('/') || node.config.path.includes('?'))) {
			issues.push({ code: 'invalid-http-path', message: 'Trigger path must be an absolute path without a query string.', nodeId: node.id });
		}
		if (node.type === 'http-request') {
			const actionUrl = parseHttpsUrl(node.config.url);
			if (!actionUrl) {
				issues.push({ code: 'invalid-http-url', message: 'HTTP actions require an HTTPS URL.', nodeId: node.id });
			} else if (isClearlyNonPublicHost(actionUrl.hostname)) {
				issues.push({ code: 'invalid-http-host', message: 'HTTP actions require a public network target.', nodeId: node.id });
			}
			if (!Number.isInteger(node.config.timeoutMs) || node.config.timeoutMs < 1 || node.config.timeoutMs > 1_800_000) {
				issues.push({ code: 'invalid-timeout', message: 'HTTP action timeout must be between 1 ms and 30 minutes.', nodeId: node.id });
			}
			if (!Number.isInteger(node.config.retry.limit) || node.config.retry.limit < 0 || node.config.retry.limit > 10) {
				issues.push({ code: 'invalid-retry-limit', message: 'Retry limit must be an integer from 0 to 10.', nodeId: node.id });
			}
		}
		if (node.type === 'condition') {
			if (!JSON_PATH.test(node.config.path) || (node.config.operator !== 'exists' && !Object.hasOwn(node.config, 'value'))) {
				issues.push({ code: 'invalid-condition', message: 'Conditions require a safe JSON path and a comparison value.', nodeId: node.id });
			}
		}
		if (node.type === 'wait' && (!Number.isInteger(node.config.durationMs) || node.config.durationMs < 1 || node.config.durationMs > 31_536_000_000)) {
			issues.push({ code: 'invalid-wait', message: 'Wait duration must be between 1 ms and 365 days.', nodeId: node.id });
		}
		if (node.type === 'wait-event' && (
			!TRANSFORM_KEY.test(node.config.eventType) ||
			!TRANSFORM_KEY.test(node.config.resultKey) ||
			!Number.isInteger(node.config.timeoutMs) ||
			node.config.timeoutMs < 1 ||
			node.config.timeoutMs > 31_536_000_000
		)) {
			issues.push({ code: 'invalid-wait', message: 'Event waits require safe event/result names and a timeout between 1 ms and 365 days.', nodeId: node.id });
		}
		if (node.type === 'approval' && (
			!UUID.test(node.config.assigneeUserId) ||
			!TRANSFORM_KEY.test(node.config.resultKey) ||
			!Number.isInteger(node.config.timeoutMs) ||
			node.config.timeoutMs < 1 ||
			node.config.timeoutMs > 31_536_000_000
		)) {
			issues.push({ code: 'invalid-wait', message: 'Approvals require an assignee user ID, a safe result name, and a timeout between 1 ms and 365 days.', nodeId: node.id });
		}
		if (node.type === 'transform') {
			const mappings = Object.entries(node.config.mappings);
			if (mappings.length === 0 || mappings.some(([key, path]) => !TRANSFORM_KEY.test(key) || !JSON_PATH.test(path))) {
				issues.push({ code: 'invalid-transform', message: 'Transforms require safe output keys and JSON path mappings.', nodeId: node.id });
			}
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
			issues.push({ code: 'invalid-edge', message: `Edge "${edge.id}" must connect two distinct existing nodes.`, edgeId: edge.id });
			continue;
		}
		outgoing.get(edge.source)?.push(edge.target);
		incoming.set(edge.target, (incoming.get(edge.target) ?? 0) + 1);
	}

	for (const trigger of triggers) {
		if ((incoming.get(trigger.id) ?? 0) > 0) {
			issues.push({ code: 'trigger-has-input', message: 'An HTTP trigger cannot have incoming edges.', nodeId: trigger.id });
		}
	}
	for (const terminal of definition.nodes.filter((node) => node.type === 'end-success')) {
		if ((outgoing.get(terminal.id)?.length ?? 0) > 0) {
			issues.push({ code: 'terminal-has-output', message: 'A terminal cannot have outgoing edges.', nodeId: terminal.id });
		}
	}
	for (const condition of definition.nodes.filter((node) => node.type === 'condition')) {
		const branches = definition.edges.filter((edge) => edge.source === condition.id);
		if (branches.length !== 2 || !branches.some((edge) => edge.when === true) || !branches.some((edge) => edge.when === false)) {
			issues.push({ code: 'invalid-condition', message: `Condition "${condition.name}" requires one true and one false branch.`, nodeId: condition.id });
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
	if (hasCycle) issues.push({ code: 'cycle', message: 'Executable process graphs cannot contain cycles.' });

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
				issues.push({ code: 'unreachable-node', message: `Node "${node.name}" is not reachable from the trigger.`, nodeId: node.id });
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