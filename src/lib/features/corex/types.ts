export type FlowNodeStatus = 'complete' | 'running' | 'waiting' | 'blocked' | 'failed';

export type FlowNodeKind = 'trigger' | 'action' | 'decision' | 'terminal';

export type FlowNodeLayer = 'browser' | 'auth' | 'worker' | 'database' | 'external' | 'deploy';

export type WorkflowNodeType =
	| 'start'
	| 'trigger-http'
	| 'trigger-schedule'
	| 'trigger-event'
	| 'step-do'
	| 'step-sleep'
	| 'step-sleep-until'
	| 'step-wait-for-event'
	| 'human-approval'
	| 'if'
	| 'switch'
	| 'loop'
	| 'parallel'
	| 'ab-router'
	| 'try'
	| 'db-read'
	| 'db-write'
	| 'kv-get'
	| 'kv-set'
	| 'data-transform'
	| 'http-request'
	| 'invoke-workflow'
	| 'end-success'
	| 'end-failure'
	| 'block'
	| 'function-definition'
	| 'function-call'
	| 'break';

export type WorkflowNodeFamily = 'trigger' | 'control' | 'wait' | 'data' | 'integration' | 'resilience' | 'terminal' | 'structure';

export type WorkflowTriggerConfig = {
	kind: 'http' | 'schedule' | 'event';
	method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
	path?: string;
	cron?: string;
	eventSource?: 'queue' | 'workflow-binding' | 'durable-object' | 'database-webhook' | 'custom';
	inputSchema?: string;
};

export type WorkflowConnectorConfig = {
	kind: 'supabase' | 'postgres' | 'd1' | 'kv' | 'http' | 'workflow' | 'worker-service' | 'custom';
	binding?: string;
	operation?: string;
	resource?: string;
	idempotencyKey?: string;
};

export type WorkflowStepConfig = {
	name: string;
	type: WorkflowNodeType;
	family?: WorkflowNodeFamily;
	timeout?: string;
	retries?: {
		limit: number;
		delay: string;
		backoff?: 'constant' | 'linear' | 'exponential';
	};
	eventType?: string;
	trigger?: WorkflowTriggerConfig;
	connector?: WorkflowConnectorConfig;
	inputSchema?: string;
	outputSchema?: string;
	expression?: string;
	branches?: string[];
	duration?: string;
	timestamp?: string;
	rollback?: boolean;
	parentId?: string;
	collapsed?: boolean;
	starts?: number;
	resolves?: number;
	warnings?: string[];
};

export type FlowNode = {
	id: string;
	eyebrow: string;
	title: string;
	detail: string;
	status: FlowNodeStatus;
	meta: string;
	kind: FlowNodeKind;
	position: { x: number; y: number };
	layer?: FlowNodeLayer;
	request?: string;
	operation?: string;
	input?: string;
	output?: string;
	workflow?: WorkflowStepConfig;
};

export type FlowEdge = {
	id: string;
	source: string;
	target: string;
	label?: string;
	tone?: 'default' | 'success' | 'danger';
};

export type FlowScenario = {
	id: string;
	category: 'Access' | 'PWA' | 'Invoices' | 'Routing' | 'Checkout' | 'Payments' | 'POS' | 'Dashboard' | 'Delivery' | 'Operations';
	label: string;
	title: string;
	description: string;
	entrypoint: string;
	nodes: FlowNode[];
	edges: FlowEdge[];
};