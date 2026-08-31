export type CorexHttpStep = {
	id: string;
	name: string;
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
	next: string;
};

type CorexConditionStep = {
	id: string;
	name: string;
	type: 'condition';
	config: {
		path: string;
		operator: 'equals' | 'not-equals' | 'greater-than' | 'less-than' | 'exists';
		value?: string | number | boolean | null;
	};
	whenTrue: string;
	whenFalse: string;
};

type CorexWaitStep = { id: string; name: string; type: 'wait'; config: { durationMs: number }; next: string };
type CorexEventWaitStep = {
	id: string;
	name: string;
	type: 'wait-event';
	config: { eventType: string; timeoutMs: number; resultKey: string };
	next: string;
};
type CorexApprovalStep = {
	id: string;
	name: string;
	type: 'approval';
	config: { assigneeUserId: string; timeoutMs: number; resultKey: string };
	next: string;
};
type CorexTransformStep = {
	id: string;
	name: string;
	type: 'transform';
	config: { mode: 'merge' | 'replace'; mappings: Record<string, string> };
	next: string;
};
type CorexSuccessStep = { id: string; name: string; type: 'end-success'; config: { outputExpression?: string } };
type CorexExecutionStep = CorexHttpStep | CorexConditionStep | CorexWaitStep | CorexEventWaitStep | CorexApprovalStep | CorexTransformStep | CorexSuccessStep;

export type CorexExecutionPlan = {
	schemaVersion: 1;
	processId: string;
	revision: number;
	entryNodeId: string;
	nodes: CorexExecutionStep[];
};

export type CorexWorkflowParams = {
	runId: string;
	ownerUserId: string;
	plan: CorexExecutionPlan;
	input: unknown;
};

type CorexRunStatus = 'running' | 'waiting' | 'paused' | 'complete' | 'errored' | 'terminated';

export type CorexRunEvent = {
	runId: string;
	ownerUserId: string;
	sequence: number;
	status: CorexRunStatus;
	eventType: string;
	stepName?: string;
	payload?: unknown;
	output?: unknown;
	error?: unknown;
};

type CorexDurableStep = {
	do<T>(name: string, callback: () => Promise<T>): Promise<T>;
	do<T>(name: string, options: unknown, callback: () => Promise<T>): Promise<T>;
	sleep(name: string, duration: string): Promise<void>;
	waitForEvent<T>(name: string, options: { type: string; timeout: string }): Promise<{ payload: T }>;
};

export type CorexHttpResult = {
	status: number;
	contentType: string | null;
	body: unknown;
};

const MAX_RESPONSE_BYTES = 64 * 1024;
const SIMPLE_JSON_PATH = /^\$(?:\.([A-Za-z_][A-Za-z0-9_-]*))*$/;

function resolveJsonPath(path: string, input: unknown): unknown {
	if (!SIMPLE_JSON_PATH.test(path)) return undefined;
	let value = input;
	for (const property of path.slice(2).split('.').filter(Boolean)) {
		if (typeof value !== 'object' || value === null) return undefined;
		value = (value as Record<string, unknown>)[property];
	}
	return value;
}

export async function recordCorexRunEvent(
	controlPlane: { url: string; serviceRoleKey: string },
	event: CorexRunEvent,
	fetcher: typeof fetch = fetch
): Promise<void> {
	const baseUrl = controlPlane.url.replace(/\/+$/, '');
	const response = await fetcher(`${baseUrl}/rest/v1/rpc/corex_record_run_event`, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${controlPlane.serviceRoleKey}`,
			apikey: controlPlane.serviceRoleKey,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			p_run_id: event.runId,
			p_owner_user_id: event.ownerUserId,
			p_sequence: event.sequence,
			p_status: event.status,
			p_event_type: event.eventType,
			p_step_name: event.stepName ?? null,
			p_payload: event.payload ?? {},
			p_output: event.output ?? null,
			p_error: event.error ?? null
		})
	});
	if (!response.ok) throw new Error('Could not record the run event.');
}

function resolveIdempotencyKey(expression: string | undefined, input: unknown): string | undefined {
	if (!expression) return undefined;
	const value = resolveJsonPath(expression, input);
	return typeof value === 'string' || typeof value === 'number' ? String(value) : undefined;
}

function evaluateCondition(step: CorexConditionStep, context: unknown): boolean {
	const actual = resolveJsonPath(step.config.path, context);
	switch (step.config.operator) {
		case 'exists': return actual !== undefined;
		case 'equals': return actual === step.config.value;
		case 'not-equals': return actual !== step.config.value;
		case 'greater-than': return typeof actual === 'number' && typeof step.config.value === 'number' && actual > step.config.value;
		case 'less-than': return typeof actual === 'number' && typeof step.config.value === 'number' && actual < step.config.value;
	}
}

function applyTransform(step: CorexTransformStep, context: unknown): Record<string, unknown> {
	const mapped = Object.fromEntries(Object.entries(step.config.mappings).map(([key, path]) => [key, resolveJsonPath(path, context)]));
	if (step.config.mode === 'replace') return mapped;
	return { ...(typeof context === 'object' && context !== null ? context : {}), ...mapped };
}

async function readBoundedBody(response: Response): Promise<string> {
	if (!response.body) return '';
	const reader = response.body.getReader();
	const decoder = new TextDecoder();
	let size = 0;
	let result = '';
	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			size += value.byteLength;
			if (size > MAX_RESPONSE_BYTES) throw new Error('HTTP action response exceeds 64 KiB.');
			result += decoder.decode(value, { stream: true });
		}
		return result + decoder.decode();
	} finally {
		await reader.cancel().catch(() => undefined);
	}
}

export async function executeHttpAction(
	step: CorexHttpStep,
	input: unknown,
	fetcher: typeof fetch = fetch
): Promise<CorexHttpResult> {
	const headers = new Headers({ Accept: 'application/json', 'Content-Type': 'application/json' });
	const idempotencyKey = resolveIdempotencyKey(step.config.idempotencyKey, input);
	if (idempotencyKey) headers.set('Idempotency-Key', idempotencyKey);

	const response = await fetcher(step.config.url, {
		method: step.config.method,
		headers,
		...(step.config.method === 'GET' ? {} : { body: JSON.stringify(input) })
	});
	const rawBody = await readBoundedBody(response);
	if (!response.ok) throw new Error(`HTTP action failed with status ${response.status}.`);

	const contentType = response.headers.get('Content-Type');
	let body: unknown = rawBody;
	if (contentType?.includes('application/json') && rawBody) {
		try {
			body = JSON.parse(rawBody);
		} catch {
			throw new Error('HTTP action returned invalid JSON.');
		}
	}
	return { status: response.status, contentType, body };
}

export async function executeCorexWorkflow(
	params: CorexWorkflowParams,
	workflow: CorexDurableStep,
	recordEvent: (event: CorexRunEvent) => Promise<unknown>,
	fetcher: typeof fetch = fetch
): Promise<unknown> {
	const event = (details: Omit<CorexRunEvent, 'runId' | 'ownerUserId'>): CorexRunEvent => ({
		runId: params.runId,
		ownerUserId: params.ownerUserId,
		...details
	});
	await workflow.do('corex:run-started', async () =>
		recordEvent(event({ sequence: 0, status: 'running', eventType: 'run_started', payload: {} }))
	);

	const nodesById = new Map(params.plan.nodes.map((node) => [node.id, node]));
	let context = params.input;
	let currentNodeId: string | undefined = params.plan.entryNodeId;
	let currentStep: CorexExecutionStep | undefined;
	let sequence = 1;
	let traversalIndex = 0;
	try {
		while (currentNodeId) {
			currentStep = nodesById.get(currentNodeId);
			if (!currentStep) throw new Error(`Execution step "${currentNodeId}" does not exist.`);
			if (currentStep.type === 'end-success') break;
			if (traversalIndex >= params.plan.nodes.length) throw new Error('Execution traversal exceeded the compiled graph.');

			const step = currentStep;
			const startedSequence = sequence++;
			await workflow.do(`corex:step-started:${traversalIndex}`, async () =>
				recordEvent(event({
					sequence: startedSequence,
					status: step.type === 'wait' || step.type === 'wait-event' || step.type === 'approval' ? 'waiting' : 'running',
					eventType: 'step_started',
					stepName: step.name,
					payload: {
						stepId: step.id,
						stepType: step.type,
						...(step.type === 'approval' ? {
							assigneeUserId: step.config.assigneeUserId,
							timeoutMs: step.config.timeoutMs
						} : {})
					}
				}))
			);

			let nextNodeId: string;
			if (step.type === 'http-request') {
				const result = await workflow.do(
					step.name,
					{
						retries: {
						limit: step.config.retry.limit,
						delay: 1_000,
						backoff: step.config.retry.backoff
						},
						timeout: step.config.timeoutMs
					},
					async () => executeHttpAction(step, context, fetcher)
				);
				context = result.body;
				nextNodeId = step.next;
			} else if (step.type === 'transform') {
				context = await workflow.do(step.name, async () => applyTransform(step, context));
				nextNodeId = step.next;
			} else if (step.type === 'condition') {
				const matched = await workflow.do(step.name, async () => evaluateCondition(step, context));
				nextNodeId = matched ? step.whenTrue : step.whenFalse;
			} else if (step.type === 'wait') {
				await workflow.sleep(step.name, `${step.config.durationMs} milliseconds`);
				nextNodeId = step.next;
			} else if (step.type === 'wait-event') {
				const received = await workflow.waitForEvent<unknown>(step.name, {
					type: step.config.eventType,
					timeout: `${step.config.timeoutMs} milliseconds`
				});
				context = {
					...(typeof context === 'object' && context !== null ? context : {}),
					[step.config.resultKey]: received.payload
				};
				nextNodeId = step.next;
			} else {
				const received = await workflow.waitForEvent<unknown>(step.name, {
					type: 'corex-approval',
					timeout: `${step.config.timeoutMs} milliseconds`
				});
				const approval = received.payload;
				if (
					typeof approval !== 'object' || approval === null ||
					!['approved', 'rejected'].includes(String((approval as Record<string, unknown>).decision)) ||
					typeof (approval as Record<string, unknown>).actorUserId !== 'string' ||
					(typeof (approval as Record<string, unknown>).comment !== 'undefined' && typeof (approval as Record<string, unknown>).comment !== 'string')
				) throw new Error('Approval event payload is invalid.');
				context = {
					...(typeof context === 'object' && context !== null ? context : {}),
					[step.config.resultKey]: approval
				};
				nextNodeId = step.next;
			}

			const completedSequence = sequence++;
			await workflow.do(`corex:step-completed:${traversalIndex}`, async () =>
				recordEvent(event({
					sequence: completedSequence,
					status: 'running',
					eventType: 'step_completed',
					stepName: step.name,
					payload: {
						stepId: step.id,
						nextNodeId,
						...(step.type === 'approval' ? { decision: (context as Record<string, unknown>)[step.config.resultKey] } : {})
					}
				}))
			);
			currentNodeId = nextNodeId;
			traversalIndex += 1;
		}
	} catch (error) {
		await workflow.do('corex:run-failed', async () =>
			recordEvent(event({
				sequence,
				status: 'errored',
				eventType: 'run_failed',
				payload: {},
				error: { code: 'process_step_failed', stepId: currentStep?.id }
			}))
		);
		throw error;
	}

	await workflow.do('corex:run-completed', async () =>
		recordEvent(event({
			sequence,
			status: 'complete',
			eventType: 'run_completed',
			payload: {},
			output: context
		}))
	);
	return context;
}