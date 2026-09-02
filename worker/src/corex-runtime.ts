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
		outputPolicy?: { mode: 'metadata' | 'inline'; maxBytes: number; redactPaths?: string[] };
	};
	compensation?:
		| {
				id: string;
				name: string;
				type?: 'http-request';
				config: CorexHttpStep['config'];
			}
		| {
				id: string;
				name: string;
				type: 'transform';
				config: CorexTransformStep['config'];
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

type CorexSwitchStep = {
	id: string;
	name: string;
	type: 'switch';
	config: {
		path: string;
		cases: Array<{ id: string; value: string | number | boolean | null }>;
	};
	targets: Record<string, string>;
	defaultTarget: string;
};

type CorexLoopStep = {
	id: string;
	name: string;
	type: 'loop';
	config: { maxIterations: number };
	bodyTarget: string;
	exitTarget: string;
};

type CorexBreakStep = {
	id: string;
	name: string;
	type: 'break';
	loopId: string;
	exitTarget: string;
};

type CorexParallelStep = {
	id: string;
	name: string;
	type: 'parallel';
	config: { branches: Array<{ id: string }>; resultKey: string };
	branchTargets: Record<string, string>;
	joinTarget: string;
	continuationTarget: string;
};

type CorexWaitStep = {
	id: string;
	name: string;
	type: 'wait';
	config: { durationMs: number };
	next: string;
};
type CorexWaitUntilStep = {
	id: string;
	name: string;
	type: 'wait-until';
	config: { timestamp: string };
	next: string;
};
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
	next?: string;
	whenApproved?: string;
	whenRejected?: string;
};
type CorexTransformStep = {
	id: string;
	name: string;
	type: 'transform';
	config: {
		mode: 'merge' | 'replace';
		mappings: Record<string, string>;
		outputPolicy?: { mode: 'metadata' | 'inline'; maxBytes: number; redactPaths?: string[] };
	};
	compensation?: {
		id: string;
		name: string;
		config: CorexHttpStep['config'];
		type: 'http-request';
	} | {
		id: string;
		name: string;
		type: 'transform';
		config: CorexTransformStep['config'];
	};
	next: string;
};
export type CorexInvokeProcessStep = {
	id: string;
	name: string;
	type: 'invoke-process';
	config: { processId: string; inputPath: string; resultKey: string; timeoutMs: number };
	compensation?: {
		id: string;
		name: string;
		type: 'transform';
		config: CorexTransformStep['config'];
	};
	next: string;
};
type CorexSuccessStep = {
	id: string;
	name: string;
	type: 'end-success';
	config: { outputExpression?: string };
};
type CorexFailureStep = {
	id: string;
	name: string;
	type: 'end-failure';
	config: { code: string; message: string };
};
type CorexTryStep = {
	id: string;
	name: string;
	type: 'try';
	config: Record<string, never>;
	bodyTarget: string;
	catchTarget?: string;
	finallyTarget?: string;
	continuationTarget: string;
};
type CorexExecutionStep =
	| CorexHttpStep
	| CorexConditionStep
	| CorexSwitchStep
	| CorexLoopStep
	| CorexBreakStep
	| CorexParallelStep
	| CorexWaitStep
	| CorexWaitUntilStep
	| CorexEventWaitStep
	| CorexApprovalStep
	| CorexTransformStep
	| CorexInvokeProcessStep
	| CorexTryStep
	| CorexSuccessStep
	| CorexFailureStep;

export type CorexExecutionPlan = {
	schemaVersion: 1;
	processId: string;
	revision: number;
	entryNodeId: string;
	nodes: CorexExecutionStep[];
};

export type CorexWorkflowParams = {
	runId: string;
	workflowInstanceId: string;
	ownerUserId: string;
	plan: CorexExecutionPlan;
	input: unknown;
	parent?: {
		runId: string;
		workflowInstanceId: string;
		stepId: string;
	};
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
	do<T>(name: string, callback: (context: CorexDurableStepContext) => Promise<T>): Promise<T>;
	do<T>(
		name: string,
		options: unknown,
		callback: (context: CorexDurableStepContext) => Promise<T>,
		rollbackOptions?: {
			rollback: (context: {
				ctx: CorexDurableStepContext;
				error: Error;
				output: T | undefined;
			}) => Promise<void>;
			rollbackConfig?: unknown;
		}
	): Promise<T>;
	sleep(name: string, duration: string): Promise<void>;
	sleepUntil(name: string, timestamp: Date | number): Promise<void>;
	waitForEvent<T>(
		name: string,
		options: { type: string; timeout: string }
	): Promise<{ payload: T }>;
};

type CorexDurableStepContext = {
	step: { name: string; count: number };
	attempt: number;
	config: unknown;
};

type CorexRollbackOptions<T> = {
	rollback: (context: {
		ctx: CorexDurableStepContext;
		error: Error;
		output: T | undefined;
	}) => Promise<void>;
	rollbackConfig?: {
		retries: {
			limit: number;
			delay: number;
			backoff: 'constant' | 'linear' | 'exponential';
		};
		timeout: number;
	};
};

class CorexTerminalFailure extends Error {}

export type CorexHttpResult = {
	status: number;
	contentType: string | null;
	bytes: number;
	body: unknown;
};

export type CorexStepAttempt = {
	runId: string;
	ownerUserId: string;
	executionGeneration: number;
	stepId: string;
	visit: number;
	durableStepName: string;
	kind: 'forward' | 'compensation';
	attempt: number;
	startedAt: string;
	finishedAt: string;
	outcome: 'complete' | 'failed';
	retry: { limit: number; backoff: 'constant' | 'linear' | 'exponential'; timeoutMs: number };
	output?:
		| {
				status: number;
				contentType: string | null;
				bytes: number;
				value?: unknown;
				truncated?: true;
			}
		| { type: 'object'; bytes: number; value?: unknown; truncated?: true }
		| { type: 'none' | 'redacted' };
	error?: {
		code:
			| 'http_action_failed'
			| 'transform_step_failed'
			| 'wait_event_failed'
			| 'approval_failed'
			| 'subprocess_failed';
	};
};

export type CorexStepAttemptRecorder = (attempt: CorexStepAttempt) => Promise<unknown>;

export type CorexActiveWait = {
	runId: string;
	ownerUserId: string;
	executionGeneration: number;
	stepId: string;
	visit: number;
	eventType: string;
	waitEventType: string;
	durableStepName: string;
};

export type CorexActiveApproval = CorexActiveWait & {
	assigneeUserId: string;
	timeoutMs: number;
};

export type CorexActiveWaitRegistrar = (wait: CorexActiveWait) => Promise<unknown>;
export type CorexActiveApprovalRegistrar = (approval: CorexActiveApproval) => Promise<unknown>;
export type CorexActiveWaitCompleter = (
	wait: Pick<CorexActiveWait, 'runId' | 'ownerUserId' | 'executionGeneration' | 'stepId' | 'visit'>
) => Promise<unknown>;

const MAX_INLINE_OUTPUT_BYTES = 16_384;
const REDACTED_OUTPUT_VALUE = '[REDACTED]';

function redactOutput(value: unknown, paths: string[] | undefined): unknown {
	if (!paths?.length || value === null || typeof value !== 'object') return value;
	const copy = JSON.parse(JSON.stringify(value)) as unknown;
	for (const path of paths) {
		const properties = path.slice(2).split('.');
		let parent: unknown = copy;
		for (const property of properties.slice(0, -1)) {
			if (parent === null || typeof parent !== 'object' || !Object.hasOwn(parent, property)) {
				parent = undefined;
				break;
			}
			parent = (parent as Record<string, unknown>)[property];
		}
		const property = properties.at(-1);
		if (
			property &&
			parent !== null &&
			typeof parent === 'object' &&
			Object.hasOwn(parent, property)
		) {
			Object.defineProperty(parent, property, {
				value: REDACTED_OUTPUT_VALUE,
				enumerable: true,
				configurable: true,
				writable: true
			});
		}
	}
	return copy;
}

function describeHttpOutput(
	result: CorexHttpResult,
	policy?: CorexHttpStep['config']['outputPolicy']
): Extract<NonNullable<CorexStepAttempt['output']>, { status: number }> {
	const descriptor = {
		status: result.status,
		contentType: result.contentType,
		bytes: result.bytes
	};
	if (policy?.mode !== 'inline' || !result.contentType?.toLowerCase().includes('application/json')) {
		return descriptor;
	}
	const value = redactOutput(result.body, policy.redactPaths);
	const bytes = new TextEncoder().encode(JSON.stringify(value)).byteLength;
	if (bytes > Math.min(policy.maxBytes, MAX_INLINE_OUTPUT_BYTES)) {
		return { ...descriptor, truncated: true };
	}
	return { ...descriptor, value };
}

function describeTransformOutput(
	result: Record<string, unknown>,
	policy?: CorexTransformStep['config']['outputPolicy']
): Extract<NonNullable<CorexStepAttempt['output']>, { type: 'object' }> {
	const sourceBytes = new TextEncoder().encode(JSON.stringify(result)).byteLength;
	if (policy?.mode !== 'inline') return { type: 'object', bytes: sourceBytes };
	const value = redactOutput(result, policy.redactPaths);
	const storedBytes = new TextEncoder().encode(JSON.stringify(value)).byteLength;
	if (storedBytes > Math.min(policy.maxBytes, MAX_INLINE_OUTPUT_BYTES)) {
		return { type: 'object', bytes: sourceBytes, truncated: true };
	}
	return { type: 'object', bytes: sourceBytes, value };
}

async function executeRecordedHttpAction(
	operation: () => Promise<CorexHttpResult>,
	identity: {
		runId: string;
		ownerUserId: string;
		executionGeneration: number;
		stepId: string;
		visit: number;
		durableStepName: string;
	},
	stepContext: CorexDurableStepContext,
	retry: CorexStepAttempt['retry'],
	recordAttempt?: CorexStepAttemptRecorder,
	outputPolicy?: CorexHttpStep['config']['outputPolicy']
): Promise<CorexHttpResult> {
	const startedAt = new Date().toISOString();
	try {
		const result = await operation();
		if (recordAttempt) {
			try {
				await recordAttempt({
					...identity,
					kind: 'forward',
					attempt: stepContext.attempt,
					startedAt,
					finishedAt: new Date().toISOString(),
					outcome: 'complete',
					retry,
					output: describeHttpOutput(result, outputPolicy)
				});
			} catch {
				// Observability failures must not replay a completed external side effect.
			}
		}
		return result;
	} catch (error) {
		if (recordAttempt) {
			try {
				await recordAttempt({
					...identity,
					kind: 'forward',
					attempt: stepContext.attempt,
					startedAt,
					finishedAt: new Date().toISOString(),
					outcome: 'failed',
					retry,
					error: { code: 'http_action_failed' }
				});
			} catch {
				// Preserve the action failure when attempt telemetry is unavailable.
			}
		}
		throw error;
	}
}

async function executeRecordedTransform(
	operation: () => Record<string, unknown>,
	identity: {
		runId: string;
		ownerUserId: string;
		executionGeneration: number;
		stepId: string;
		visit: number;
		durableStepName: string;
	},
	stepContext: CorexDurableStepContext,
	recordAttempt?: CorexStepAttemptRecorder,
	kind: CorexStepAttempt['kind'] = 'forward',
	outputPolicy?: CorexTransformStep['config']['outputPolicy']
): Promise<Record<string, unknown>> {
	const startedAt = new Date().toISOString();
	try {
		const result = operation();
		if (recordAttempt) {
			try {
				await recordAttempt({
					...identity,
					kind,
					attempt: stepContext.attempt,
					startedAt,
					finishedAt: new Date().toISOString(),
					outcome: 'complete',
					retry: { limit: 0, backoff: 'constant', timeoutMs: 0 },
					output: describeTransformOutput(result, outputPolicy)
				});
			} catch {
				// Observability failures must not fail a completed transform.
			}
		}
		return result;
	} catch (error) {
		if (recordAttempt) {
			try {
				await recordAttempt({
					...identity,
					kind,
					attempt: stepContext.attempt,
					startedAt,
					finishedAt: new Date().toISOString(),
					outcome: 'failed',
					retry: { limit: 0, backoff: 'constant', timeoutMs: 0 },
					error: { code: 'transform_step_failed' }
				});
			} catch {
				// Preserve the transform failure when attempt telemetry is unavailable.
			}
		}
		throw error;
	}
}

async function executeRecordedDeterministicStep<T>(
	operation: () => T,
	identity: {
		runId: string;
		ownerUserId: string;
		executionGeneration: number;
		stepId: string;
		visit: number;
		durableStepName: string;
	},
	stepContext: CorexDurableStepContext,
	recordAttempt?: CorexStepAttemptRecorder
): Promise<T> {
	const startedAt = new Date().toISOString();
	const result = operation();
	if (recordAttempt) {
		try {
			await recordAttempt({
				...identity,
				kind: 'forward',
				attempt: stepContext.attempt,
				startedAt,
				finishedAt: new Date().toISOString(),
				outcome: 'complete',
				retry: { limit: 0, backoff: 'constant', timeoutMs: 0 },
				output: { type: 'none' }
			});
		} catch {
			// Observability failures must not alter a completed decision.
		}
	}
	return result;
}

async function executeRecordedDurableWait(
	operation: () => Promise<void>,
	identity: {
		runId: string;
		ownerUserId: string;
		executionGeneration: number;
		stepId: string;
		visit: number;
		durableStepName: string;
	},
	recordAttempt?: CorexStepAttemptRecorder
): Promise<void> {
	const startedAt = new Date().toISOString();
	await operation();
	if (recordAttempt) {
		try {
			await recordAttempt({
				...identity,
				kind: 'forward',
				attempt: 1,
				startedAt,
				finishedAt: new Date().toISOString(),
				outcome: 'complete',
				retry: { limit: 0, backoff: 'constant', timeoutMs: 0 },
				output: { type: 'none' }
			});
		} catch {
			// Observability failures must not alter a completed wait.
		}
	}
}

async function executeRecordedEventWait<T>(
	operation: () => Promise<T>,
	identity: {
		runId: string;
		ownerUserId: string;
		executionGeneration: number;
		stepId: string;
		visit: number;
		durableStepName: string;
	},
	timeoutMs: number,
	errorCode: 'wait_event_failed' | 'approval_failed' | 'subprocess_failed',
	recordAttempt?: CorexStepAttemptRecorder
): Promise<T> {
	const startedAt = new Date().toISOString();
	try {
		const result = await operation();
		if (recordAttempt) {
			try {
				await recordAttempt({
					...identity,
					kind: 'forward',
					attempt: 1,
					startedAt,
					finishedAt: new Date().toISOString(),
					outcome: 'complete',
					retry: { limit: 0, backoff: 'constant', timeoutMs },
					output: { type: 'redacted' }
				});
			} catch {
				// Observability failures must not alter a completed event wait.
			}
		}
		return result;
	} catch (error) {
		if (recordAttempt) {
			try {
				await recordAttempt({
					...identity,
					kind: 'forward',
					attempt: 1,
					startedAt,
					finishedAt: new Date().toISOString(),
					outcome: 'failed',
					retry: { limit: 0, backoff: 'constant', timeoutMs },
					error: { code: errorCode }
				});
			} catch {
				// Preserve the event wait failure when attempt telemetry is unavailable.
			}
		}
		throw error;
	}
}

export type CorexSubprocessStarter = (
	step: CorexInvokeProcessStep,
	input: unknown,
	parent: Pick<CorexWorkflowParams, 'runId' | 'ownerUserId'> & { invocationKey: string }
) => Promise<{ childRunId: string; workflowInstanceId: string }>;

export type CorexSubprocessTerminator = (
	step: CorexInvokeProcessStep,
	child: { childRunId: string; workflowInstanceId: string },
	parent: Pick<CorexWorkflowParams, 'runId' | 'ownerUserId'> & { invocationKey: string }
) => Promise<void>;

function corexSubprocessInvocationKey(
	executionGeneration: number,
	stepId: string,
	visit: number
): string {
	return `${executionGeneration}:${stepId}:${visit}`;
}

async function executeSubprocess(
	step: CorexInvokeProcessStep,
	context: unknown,
	identity: CorexAttemptIdentity,
	params: Pick<CorexWorkflowParams, 'runId' | 'ownerUserId'>,
	workflow: CorexDurableStep,
	startSubprocess: CorexSubprocessStarter,
	terminateSubprocess: CorexSubprocessTerminator | undefined,
	fetcher: typeof fetch,
	recordAttempt: CorexStepAttemptRecorder | undefined
): Promise<Record<string, unknown>> {
	const childInput = resolveJsonPath(step.config.inputPath, context);
	return executeRecordedEventWait(
		async () => {
			const parent = {
				...params,
				invocationKey: corexSubprocessInvocationKey(
					identity.executionGeneration,
					step.id,
					identity.visit
				)
			};
			const child = await workflow.do(identity.durableStepName, async () =>
				startSubprocess(step, childInput, parent)
			);
			let received: { payload: unknown };
			try {
				received = await workflow.waitForEvent<unknown>(`${identity.durableStepName}:result`, {
					type: corexSubprocessResultEventType(child.childRunId),
					timeout: `${step.config.timeoutMs} milliseconds`
				});
			} catch (error) {
				if (terminateSubprocess) {
					try {
						await workflow.do(`${identity.durableStepName}:terminate-child`, async () =>
							terminateSubprocess(step, child, parent)
						);
					} catch {
						// Preserve the original wait failure after durable cleanup retries are exhausted.
					}
				}
				throw error;
			}
			const result = received.payload;
			if (
				typeof result !== 'object' ||
				result === null ||
				(result as Record<string, unknown>).childRunId !== child.childRunId
			) throw new Error('Subprocess result payload is invalid.');
			if ((result as Record<string, unknown>).status === 'errored') {
				throw new Error('Subprocess failed.');
			}
			if ((result as Record<string, unknown>).status !== 'complete') {
				throw new Error('Subprocess result payload is invalid.');
			}
			const completedResult = result as Record<string, unknown>;
			if (!step.compensation) return completedResult;
			return workflow.do(
				`${identity.durableStepName}:completed`,
				{},
				async () => completedResult,
				step.compensation.type === 'http-request'
					? createHttpRollbackOptions<Record<string, unknown>>(step, context, fetcher, {
							runId: identity.runId,
							ownerUserId: identity.ownerUserId,
							executionGeneration: identity.executionGeneration,
							visit: identity.visit,
							durableStepName: identity.durableStepName,
							recordAttempt
						})
					: createTransformRollbackOptions(step, context, {
							runId: identity.runId,
							ownerUserId: identity.ownerUserId,
							executionGeneration: identity.executionGeneration,
							visit: identity.visit,
							durableStepName: identity.durableStepName,
							recordAttempt
						})
			);
		},
		identity,
		step.config.timeoutMs,
		'subprocess_failed',
		recordAttempt
	);
}

export function corexSubprocessResultEventType(childRunId: string): string {
	return `corex-subprocess-result:${childRunId}`;
}

export function corexWaitEventType(
	runId: string,
	executionGeneration: number,
	startedSequence: number
): string {
	return `corex-wait-${runId}-${executionGeneration}-${startedSequence}`;
}

export function corexBranchWaitEventType(
	runId: string,
	executionGeneration: number,
	stepId: string,
	visit: number
): string {
	return `corex-wait-${runId}-${executionGeneration}-${stepId}-${visit}`;
}

const MAX_RESPONSE_BYTES = 64 * 1024;
const MAX_EXECUTION_TRAVERSALS = 100_000;
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

export async function recordCorexStepAttempt(
	controlPlane: { url: string; serviceRoleKey: string },
	attempt: CorexStepAttempt,
	fetcher: typeof fetch = fetch
): Promise<void> {
	const response = await fetcher(
		`${controlPlane.url.replace(/\/+$/, '')}/rest/v1/rpc/corex_record_step_attempt`,
		{
			method: 'POST',
			headers: {
				Authorization: `Bearer ${controlPlane.serviceRoleKey}`,
				apikey: controlPlane.serviceRoleKey,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				p_run_id: attempt.runId,
				p_owner_user_id: attempt.ownerUserId,
				p_execution_generation: attempt.executionGeneration,
				p_step_id: attempt.stepId,
				p_visit: attempt.visit,
				p_durable_step_name: attempt.durableStepName,
				p_kind: attempt.kind,
				p_attempt: attempt.attempt,
				p_started_at: attempt.startedAt,
				p_finished_at: attempt.finishedAt,
				p_outcome: attempt.outcome,
				p_retry: attempt.retry,
				p_output: attempt.output ?? null,
				p_error: attempt.error ?? null
			})
		}
	);
	if (!response.ok) throw new Error('Could not record the step attempt.');
}

function resolveIdempotencyKey(expression: string | undefined, input: unknown): string | undefined {
	if (!expression) return undefined;
	const value = resolveJsonPath(expression, input);
	return typeof value === 'string' || typeof value === 'number' ? String(value) : undefined;
}

function evaluateCondition(step: CorexConditionStep, context: unknown): boolean {
	const actual = resolveJsonPath(step.config.path, context);
	switch (step.config.operator) {
		case 'exists':
			return actual !== undefined;
		case 'equals':
			return actual === step.config.value;
		case 'not-equals':
			return actual !== step.config.value;
		case 'greater-than':
			return (
				typeof actual === 'number' &&
				typeof step.config.value === 'number' &&
				actual > step.config.value
			);
		case 'less-than':
			return (
				typeof actual === 'number' &&
				typeof step.config.value === 'number' &&
				actual < step.config.value
			);
	}
}

function selectSwitchCase(step: CorexSwitchStep, context: unknown): string | undefined {
	const actual = resolveJsonPath(step.config.path, context);
	return step.config.cases.find((item) => item.value === actual)?.id;
}

function applyTransform(step: CorexTransformStep, context: unknown): Record<string, unknown> {
	const mapped = Object.fromEntries(
		Object.entries(step.config.mappings).map(([key, path]) => [key, resolveJsonPath(path, context)])
	);
	if (step.config.mode === 'replace') return mapped;
	return { ...(typeof context === 'object' && context !== null ? context : {}), ...mapped };
}

async function readBoundedBody(response: Response): Promise<{ text: string; bytes: number }> {
	if (!response.body) return { text: '', bytes: 0 };
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
		return { text: result + decoder.decode(), bytes: size };
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
	const { text: rawBody, bytes } = await readBoundedBody(response);
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
	return { status: response.status, contentType, bytes, body };
}

function createHttpRollbackOptions<T = CorexHttpResult>(
	step: CorexHttpStep | CorexInvokeProcessStep,
	input: unknown,
	fetcher: typeof fetch,
	attemptIdentity: {
		runId: string;
		ownerUserId: string;
		executionGeneration: number;
		visit: number;
		durableStepName: string;
		recordAttempt?: CorexStepAttemptRecorder;
	}
): CorexRollbackOptions<T> | undefined {
	if (!step.compensation) return undefined;
	const compensation = step.compensation;
	if (compensation.type === 'transform') {
		return {
			rollback: async ({ ctx, error, output }) => {
				await executeRecordedTransform(
					() =>
						applyTransform(
							{ ...compensation, next: step.next },
							{
								input,
								output,
								error: { name: error.name, message: error.message }
							}
						),
					{
						runId: attemptIdentity.runId,
						ownerUserId: attemptIdentity.ownerUserId,
						executionGeneration: attemptIdentity.executionGeneration,
						stepId: compensation.id,
						visit: attemptIdentity.visit,
						durableStepName: `${attemptIdentity.durableStepName}:rollback:${compensation.name}`
					},
					ctx,
					attemptIdentity.recordAttempt,
					'compensation',
					compensation.config.outputPolicy
				);
			}
		};
	}
	return {
		rollback: async ({ ctx, error, output }) => {
			const startedAt = new Date().toISOString();
			try {
				const result = await executeHttpAction(
					{ ...compensation, type: 'http-request', next: step.next },
					{
						input,
						output,
						error: { name: error.name, message: error.message }
					},
					fetcher
				);
				if (attemptIdentity.recordAttempt) {
					try {
						await attemptIdentity.recordAttempt({
							runId: attemptIdentity.runId,
							ownerUserId: attemptIdentity.ownerUserId,
							executionGeneration: attemptIdentity.executionGeneration,
							stepId: compensation.id,
							visit: attemptIdentity.visit,
							durableStepName: `${attemptIdentity.durableStepName}:rollback:${compensation.name}`,
							kind: 'compensation',
							attempt: ctx.attempt,
							startedAt,
							finishedAt: new Date().toISOString(),
							outcome: 'complete',
							retry: {
								limit: compensation.config.retry.limit,
								backoff: compensation.config.retry.backoff,
								timeoutMs: compensation.config.timeoutMs
							},
							output: describeHttpOutput(result, compensation.config.outputPolicy)
						});
					} catch {
						// Observability failures must not fail completed compensation.
					}
				}
			} catch (compensationError) {
				if (attemptIdentity.recordAttempt) {
					try {
						await attemptIdentity.recordAttempt({
							runId: attemptIdentity.runId,
							ownerUserId: attemptIdentity.ownerUserId,
							executionGeneration: attemptIdentity.executionGeneration,
							stepId: compensation.id,
							visit: attemptIdentity.visit,
							durableStepName: `${attemptIdentity.durableStepName}:rollback:${compensation.name}`,
							kind: 'compensation',
							attempt: ctx.attempt,
							startedAt,
							finishedAt: new Date().toISOString(),
							outcome: 'failed',
							retry: {
								limit: compensation.config.retry.limit,
								backoff: compensation.config.retry.backoff,
								timeoutMs: compensation.config.timeoutMs
							},
							error: { code: 'http_action_failed' }
						});
					} catch {
						// Preserve the compensation failure when attempt telemetry is unavailable.
					}
				}
				throw compensationError;
			}
		},
		rollbackConfig: {
			retries: {
				limit: compensation.config.retry.limit,
				delay: 1_000,
				backoff: compensation.config.retry.backoff
			},
			timeout: compensation.config.timeoutMs
		}
	};
}

function createTransformRollbackOptions(
	step: CorexTransformStep | CorexInvokeProcessStep,
	input: unknown,
	attemptIdentity: {
		runId: string;
		ownerUserId: string;
		executionGeneration: number;
		visit: number;
		durableStepName: string;
		recordAttempt?: CorexStepAttemptRecorder;
	}
): CorexRollbackOptions<Record<string, unknown>> | undefined {
	if (!step.compensation) return undefined;
	const compensation = step.compensation;
	return {
		rollback: async ({ ctx, error, output }) => {
			await executeRecordedTransform(
				() =>
					applyTransform(
						{ ...compensation, next: step.next },
						{
							input,
							output,
							error: { name: error.name, message: error.message }
						}
					),
				{
					runId: attemptIdentity.runId,
					ownerUserId: attemptIdentity.ownerUserId,
					executionGeneration: attemptIdentity.executionGeneration,
					stepId: compensation.id,
					visit: attemptIdentity.visit,
					durableStepName: `${attemptIdentity.durableStepName}:rollback:${compensation.name}`
				},
				ctx,
				attemptIdentity.recordAttempt,
				'compensation',
				compensation.config.outputPolicy
			);
		}
	};
}

export async function executeCorexWorkflow(
	params: CorexWorkflowParams,
	workflow: CorexDurableStep,
	recordEvent: (event: CorexRunEvent) => Promise<unknown>,
	fetcher: typeof fetch = fetch,
	startSubprocess?: CorexSubprocessStarter,
	terminateSubprocess?: CorexSubprocessTerminator,
	executionGeneration = 1,
	recordAttempt?: CorexStepAttemptRecorder,
	registerActiveWait?: CorexActiveWaitRegistrar,
	completeActiveWait?: CorexActiveWaitCompleter,
	registerActiveApproval?: CorexActiveApprovalRegistrar
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
	let output: unknown;
	let sequence = 1;
	let traversalIndex = 0;
	const loopIterations = new Map<string, number>();
	const nodeVisits = new Map<string, number>();
	const tryFrames: Array<{
		step: CorexTryStep;
		phase: 'body' | 'catch' | 'finally';
		pendingError?: unknown;
		pendingErrorStepId?: string;
	}> = [];
	let failedStepId: string | undefined;
	execution: while (currentNodeId) {
	try {
		while (currentNodeId) {
			currentStep = nodesById.get(currentNodeId);
			if (!currentStep) throw new Error(`Execution step "${currentNodeId}" does not exist.`);
			if (currentStep.type === 'end-success') {
				output = currentStep.config.outputExpression
					? resolveJsonPath(currentStep.config.outputExpression, context)
					: context;
				break;
			}
			if (currentStep.type === 'end-failure') {
				await workflow.do('corex:run-failed', async () =>
					recordEvent(
						event({
							sequence,
							status: 'errored',
							eventType: 'run_failed',
							stepName: currentStep!.name,
							payload: { message: currentStep!.config.message },
							error: { code: currentStep!.config.code, stepId: currentStep!.id }
						})
					)
				);
				throw new CorexTerminalFailure(currentStep.config.message);
			}
			if (traversalIndex >= MAX_EXECUTION_TRAVERSALS)
				throw new Error('Execution traversal exceeded the runtime safety limit.');

			const step = currentStep;
			const visit = nodeVisits.get(step.id) ?? 0;
			nodeVisits.set(step.id, visit + 1);
			const durableStepName = visit === 0 ? step.name : `${step.name}:visit-${visit}`;
			const startedSequence = sequence++;
			const waitEventType =
				step.type === 'wait-event' || step.type === 'approval'
					? corexWaitEventType(params.runId, executionGeneration, startedSequence)
					: undefined;
			await workflow.do(`corex:step-started:${traversalIndex}`, async () =>
				recordEvent(
					event({
						sequence: startedSequence,
						status:
							step.type === 'wait' ||
							step.type === 'wait-until' ||
							step.type === 'wait-event' ||
							step.type === 'approval' ||
							step.type === 'invoke-process'
								? 'waiting'
								: 'running',
						eventType: 'step_started',
						stepName: step.name,
						payload: {
							stepId: step.id,
							stepType: step.type,
							...(step.type === 'wait-event'
								? { eventType: step.config.eventType, waitEventType }
								: {}),
							...(step.type === 'approval'
								? {
										assigneeUserId: step.config.assigneeUserId,
										timeoutMs: step.config.timeoutMs,
										waitEventType
									}
								: {})
						}
					})
				)
			);

			let nextNodeId: string;
			let parallelBranches: string[] | undefined;
			let parallelStarts: Array<{ id: string; index: number }> | undefined;
			let parallelResolves: Array<{ id: string; index: number }> | undefined;
				if (step.type === 'try') {
					tryFrames.push({ step, phase: 'body' });
					nextNodeId = step.bodyTarget;
				} else if (step.type === 'parallel') {
				const inputContext = context;
				parallelStarts = step.config.branches.map((branch, index) => ({ id: branch.id, index }));
				parallelResolves = [];
				const runBranch = async (branch: { id: string }): Promise<unknown> => {
					let branchContext = structuredClone(inputContext);
					let branchNodeId = step.branchTargets[branch.id];
					let branchTraversal = 0;
					const branchLoopIterations = new Map<string, number>();
					const branchNodeVisits = new Map<string, number>();
					while (branchNodeId !== step.joinTarget) {
						if (branchTraversal >= MAX_EXECUTION_TRAVERSALS)
							throw new Error('Parallel branch traversal exceeded the runtime safety limit.');
						const branchStep = nodesById.get(branchNodeId);
						if (
							!branchStep ||
							branchStep.type === 'end-success' ||
							branchStep.type === 'end-failure' ||
							branchStep.type === 'parallel'
						)
							throw new Error(`Parallel branch "${branch.id}" has an invalid execution step.`);
						const branchVisit = branchNodeVisits.get(branchStep.id) ?? 0;
						branchNodeVisits.set(branchStep.id, branchVisit + 1);
						const branchStepName = `${step.name}:parallel-${branch.id}:${branchStep.name}${
							branchVisit === 0 ? '' : `:visit-${branchVisit}`
						}`;
						const branchAttemptIdentity = {
							runId: params.runId,
							ownerUserId: params.ownerUserId,
							executionGeneration,
							stepId: branchStep.id,
							visit: branchVisit,
							durableStepName: branchStepName
						};

						if (branchStep.type === 'http-request') {
							const actionInput = structuredClone(branchContext);
							const result = await workflow.do(
								branchStepName,
								{
									retries: {
										limit: branchStep.config.retry.limit,
										delay: 1_000,
										backoff: branchStep.config.retry.backoff
									},
									timeout: branchStep.config.timeoutMs
								},
								async (stepContext) =>
									executeRecordedHttpAction(
										() => executeHttpAction(branchStep, branchContext, fetcher),
										{
											runId: params.runId,
											ownerUserId: params.ownerUserId,
											executionGeneration,
											stepId: branchStep.id,
											visit: branchVisit,
											durableStepName: branchStepName
										},
										stepContext,
										{
											limit: branchStep.config.retry.limit,
											backoff: branchStep.config.retry.backoff,
											timeoutMs: branchStep.config.timeoutMs
										},
										recordAttempt,
										branchStep.config.outputPolicy
									),
								createHttpRollbackOptions(branchStep, actionInput, fetcher, {
									runId: params.runId,
									ownerUserId: params.ownerUserId,
									executionGeneration,
									visit: branchVisit,
									durableStepName: branchStepName,
									recordAttempt
								})
							);
							branchContext = result.body;
							branchNodeId = branchStep.next;
						} else if (branchStep.type === 'transform') {
							const actionInput = structuredClone(branchContext);
							branchContext = await workflow.do(
								branchStepName,
								{},
								async (stepContext) => executeRecordedTransform(
									() => applyTransform(branchStep, branchContext),
									branchAttemptIdentity,
									stepContext,
									recordAttempt,
									'forward',
									branchStep.config.outputPolicy
								),
								createTransformRollbackOptions(branchStep, actionInput, {
									...branchAttemptIdentity,
									recordAttempt
								})
							);
							branchNodeId = branchStep.next;
						} else if (branchStep.type === 'wait') {
							await executeRecordedDurableWait(
								() =>
									workflow.sleep(
										branchStepName,
										`${branchStep.config.durationMs} milliseconds`
									),
								branchAttemptIdentity,
								recordAttempt
							);
							branchNodeId = branchStep.next;
						} else if (branchStep.type === 'wait-until') {
							await executeRecordedDurableWait(
								() =>
									workflow.sleepUntil(
										branchStepName,
										new Date(branchStep.config.timestamp)
									),
								branchAttemptIdentity,
								recordAttempt
							);
							branchNodeId = branchStep.next;
						} else if (branchStep.type === 'invoke-process') {
							if (!startSubprocess) throw new Error('Subprocess execution is unavailable.');
							const result = await executeSubprocess(
								branchStep,
								branchContext,
								branchAttemptIdentity,
								{ runId: params.runId, ownerUserId: params.ownerUserId },
								workflow,
								startSubprocess,
								terminateSubprocess,
								fetcher,
								recordAttempt
							);
							branchContext = {
								...(typeof branchContext === 'object' && branchContext !== null
									? branchContext
									: {}),
								[branchStep.config.resultKey]: result.output
							};
							branchNodeId = branchStep.next;
						} else if (branchStep.type === 'wait-event' || branchStep.type === 'approval') {
							if (!registerActiveWait || !completeActiveWait)
								throw new Error('Parallel durable wait registration is unavailable.');
							if (branchStep.type === 'approval' && !registerActiveApproval)
								throw new Error('Parallel approval registration is unavailable.');
							const branchWaitEventType = corexBranchWaitEventType(
								params.runId,
								executionGeneration,
								branchStep.id,
								branchVisit
							);
							const activeWait = {
								...branchAttemptIdentity,
								eventType: branchStep.type === 'wait-event' ? branchStep.config.eventType : 'approval',
								waitEventType: branchWaitEventType
							};
							await workflow.do(`${branchStepName}:register-wait`, async () =>
								await (branchStep.type === 'approval'
									? registerActiveApproval!({
										...activeWait,
										assigneeUserId: branchStep.config.assigneeUserId,
										timeoutMs: branchStep.config.timeoutMs
									})
									: registerActiveWait(activeWait))
							);
							let received: { payload: unknown };
							try {
								received = await executeRecordedEventWait(
									() =>
										workflow.waitForEvent<unknown>(branchStepName, {
											type: branchWaitEventType,
											timeout: `${branchStep.config.timeoutMs} milliseconds`
										}),
									branchAttemptIdentity,
									branchStep.config.timeoutMs,
									branchStep.type === 'approval' ? 'approval_failed' : 'wait_event_failed',
									recordAttempt
								);
							} finally {
								await workflow.do(`${branchStepName}:complete-wait`, async () =>
									await completeActiveWait(activeWait)
								);
							}
							const payload = received.payload;
							if (branchStep.type === 'approval') {
								if (
									typeof payload !== 'object' || payload === null ||
									!['approved', 'rejected'].includes(String((payload as Record<string, unknown>).decision)) ||
									typeof (payload as Record<string, unknown>).actorUserId !== 'string' ||
									(typeof (payload as Record<string, unknown>).comment !== 'undefined' &&
										typeof (payload as Record<string, unknown>).comment !== 'string')
								) throw new Error('Approval event payload is invalid.');
							}
							branchContext = {
								...(typeof branchContext === 'object' && branchContext !== null
									? branchContext
									: {}),
								[branchStep.config.resultKey]: payload
							};
							branchNodeId = branchStep.type === 'approval'
								? ((payload as Record<string, unknown>).decision === 'approved'
									? branchStep.whenApproved ?? branchStep.next!
									: branchStep.whenRejected ?? branchStep.next!)
								: branchStep.next;
						} else if (branchStep.type === 'condition') {
							const matched = await workflow.do(branchStepName, async (stepContext) =>
								executeRecordedDeterministicStep(
									() => evaluateCondition(branchStep, branchContext),
									branchAttemptIdentity,
									stepContext,
									recordAttempt
								)
							);
							branchNodeId = matched ? branchStep.whenTrue : branchStep.whenFalse;
						} else if (branchStep.type === 'switch') {
							const selectedCase = await workflow.do(branchStepName, async (stepContext) =>
								executeRecordedDeterministicStep(
									() => selectSwitchCase(branchStep, branchContext),
									branchAttemptIdentity,
									stepContext,
									recordAttempt
								)
							);
							branchNodeId = selectedCase
								? branchStep.targets[selectedCase]
								: branchStep.defaultTarget;
						} else if (branchStep.type === 'loop') {
							const iteration = branchLoopIterations.get(branchStep.id) ?? 0;
							const enterBody = await workflow.do(branchStepName, async (stepContext) =>
								executeRecordedDeterministicStep(
									() => iteration < branchStep.config.maxIterations,
									branchAttemptIdentity,
									stepContext,
									recordAttempt
								)
							);
							if (enterBody) branchLoopIterations.set(branchStep.id, iteration + 1);
							branchNodeId = enterBody ? branchStep.bodyTarget : branchStep.exitTarget;
						} else if (branchStep.type === 'break') {
							await workflow.do(branchStepName, async (stepContext) =>
								executeRecordedDeterministicStep(
									() => undefined,
									branchAttemptIdentity,
									stepContext,
									recordAttempt
								)
							);
							branchNodeId = branchStep.exitTarget;
						} else {
							throw new Error(
								`Parallel branch "${branch.id}" contains unsupported durable step "${branchStep.type}".`
							);
						}
						branchTraversal += 1;
					}
					return branchContext;
				};
				const branchResults = await Promise.all(
					step.config.branches.map((branch) =>
						runBranch(branch).then((result) => {
							parallelResolves!.push({ id: branch.id, index: parallelResolves!.length });
							return result;
						})
					)
				);
				parallelBranches = step.config.branches.map((branch) => branch.id);
				context = {
					...(typeof inputContext === 'object' && inputContext !== null ? inputContext : {}),
					[step.config.resultKey]: Object.fromEntries(
						step.config.branches.map((branch, index) => [branch.id, branchResults[index]])
					)
				};
				nextNodeId = step.continuationTarget;
			} else if (step.type === 'http-request') {
				const actionInput = structuredClone(context);
				const result = await workflow.do(
					durableStepName,
					{
						retries: {
							limit: step.config.retry.limit,
							delay: 1_000,
							backoff: step.config.retry.backoff
						},
						timeout: step.config.timeoutMs
					},
					async (stepContext) =>
						executeRecordedHttpAction(
							() => executeHttpAction(step, context, fetcher),
							{
								runId: params.runId,
								ownerUserId: params.ownerUserId,
								executionGeneration,
								stepId: step.id,
								visit,
								durableStepName
							},
							stepContext,
							{
								limit: step.config.retry.limit,
								backoff: step.config.retry.backoff,
								timeoutMs: step.config.timeoutMs
							},
							recordAttempt,
							step.config.outputPolicy
						),
					createHttpRollbackOptions(step, actionInput, fetcher, {
						runId: params.runId,
						ownerUserId: params.ownerUserId,
						executionGeneration,
						visit,
						durableStepName,
						recordAttempt
					})
				);
				context = result.body;
				nextNodeId = step.next;
			} else if (step.type === 'transform') {
				const actionInput = structuredClone(context);
				context = await workflow.do(
					durableStepName,
					{},
					async (stepContext) => executeRecordedTransform(
						() => applyTransform(step, context),
						{
							runId: params.runId,
							ownerUserId: params.ownerUserId,
							executionGeneration,
							stepId: step.id,
							visit,
							durableStepName
						},
						stepContext,
						recordAttempt,
						'forward',
						step.config.outputPolicy
					),
					createTransformRollbackOptions(step, actionInput, {
						runId: params.runId,
						ownerUserId: params.ownerUserId,
						executionGeneration,
						visit,
						durableStepName,
						recordAttempt
					})
				);
				nextNodeId = step.next;
			} else if (step.type === 'condition') {
				const matched = await workflow.do(durableStepName, async (stepContext) =>
					executeRecordedDeterministicStep(
						() => evaluateCondition(step, context),
						{
							runId: params.runId,
							ownerUserId: params.ownerUserId,
							executionGeneration,
							stepId: step.id,
							visit,
							durableStepName
						},
						stepContext,
						recordAttempt
					)
				);
				nextNodeId = matched ? step.whenTrue : step.whenFalse;
			} else if (step.type === 'switch') {
				const selectedCase = await workflow.do(durableStepName, async (stepContext) =>
					executeRecordedDeterministicStep(
						() => selectSwitchCase(step, context),
						{
							runId: params.runId,
							ownerUserId: params.ownerUserId,
							executionGeneration,
							stepId: step.id,
							visit,
							durableStepName
						},
						stepContext,
						recordAttempt
					)
				);
				nextNodeId = selectedCase ? step.targets[selectedCase] : step.defaultTarget;
			} else if (step.type === 'loop') {
				const iteration = loopIterations.get(step.id) ?? 0;
				const enterBody = await workflow.do(durableStepName, async (stepContext) =>
					executeRecordedDeterministicStep(
						() => iteration < step.config.maxIterations,
						{
							runId: params.runId,
							ownerUserId: params.ownerUserId,
							executionGeneration,
							stepId: step.id,
							visit,
							durableStepName
						},
						stepContext,
						recordAttempt
					)
				);
				if (enterBody) loopIterations.set(step.id, iteration + 1);
				nextNodeId = enterBody ? step.bodyTarget : step.exitTarget;
			} else if (step.type === 'break') {
				await workflow.do(durableStepName, async (stepContext) =>
					executeRecordedDeterministicStep(
						() => undefined,
						{
							runId: params.runId,
							ownerUserId: params.ownerUserId,
							executionGeneration,
							stepId: step.id,
							visit,
							durableStepName
						},
						stepContext,
						recordAttempt
					)
				);
				nextNodeId = step.exitTarget;
			} else if (step.type === 'wait') {
				await executeRecordedDurableWait(
					() => workflow.sleep(durableStepName, `${step.config.durationMs} milliseconds`),
					{
						runId: params.runId,
						ownerUserId: params.ownerUserId,
						executionGeneration,
						stepId: step.id,
						visit,
						durableStepName
					},
					recordAttempt
				);
				nextNodeId = step.next;
			} else if (step.type === 'wait-until') {
				await executeRecordedDurableWait(
					() => workflow.sleepUntil(durableStepName, new Date(step.config.timestamp)),
					{
						runId: params.runId,
						ownerUserId: params.ownerUserId,
						executionGeneration,
						stepId: step.id,
						visit,
						durableStepName
					},
					recordAttempt
				);
				nextNodeId = step.next;
			} else if (step.type === 'wait-event') {
				const received = await executeRecordedEventWait(
					() =>
						workflow.waitForEvent<unknown>(durableStepName, {
							type: waitEventType!,
							timeout: `${step.config.timeoutMs} milliseconds`
						}),
					{
						runId: params.runId,
						ownerUserId: params.ownerUserId,
						executionGeneration,
						stepId: step.id,
						visit,
						durableStepName
					},
					step.config.timeoutMs,
					'wait_event_failed',
					recordAttempt
				);
				context = {
					...(typeof context === 'object' && context !== null ? context : {}),
					[step.config.resultKey]: received.payload
				};
				nextNodeId = step.next;
			} else if (step.type === 'invoke-process') {
				if (!startSubprocess) throw new Error('Subprocess execution is unavailable.');
				const result = await executeSubprocess(
					step,
					context,
					{
						runId: params.runId,
						ownerUserId: params.ownerUserId,
						executionGeneration,
						stepId: step.id,
						visit,
						durableStepName
					},
					{ runId: params.runId, ownerUserId: params.ownerUserId },
					workflow,
					startSubprocess,
					terminateSubprocess,
					fetcher,
					recordAttempt
				);
				context = {
					...(typeof context === 'object' && context !== null ? context : {}),
					[step.config.resultKey]: result.output
				};
				nextNodeId = step.next;
			} else {
				const { approval, approvalNextNodeId } = await executeRecordedEventWait(
					async () => {
						const received = await workflow.waitForEvent<unknown>(durableStepName, {
							type: waitEventType!,
							timeout: `${step.config.timeoutMs} milliseconds`
						});
						const approval = received.payload;
						if (
							typeof approval !== 'object' ||
							approval === null ||
							!['approved', 'rejected'].includes(
								String((approval as Record<string, unknown>).decision)
							) ||
							typeof (approval as Record<string, unknown>).actorUserId !== 'string' ||
							(typeof (approval as Record<string, unknown>).comment !== 'undefined' &&
								typeof (approval as Record<string, unknown>).comment !== 'string')
						)
							throw new Error('Approval event payload is invalid.');
						const decision = (approval as Record<string, unknown>).decision;
						const approvalNextNodeId =
							decision === 'approved'
								? (step.whenApproved ?? step.next ?? '')
								: (step.whenRejected ?? step.next ?? '');
						if (!approvalNextNodeId)
							throw new Error(`Approval step "${step.id}" has no ${decision} transition.`);
						return { approval, approvalNextNodeId };
					},
					{
						runId: params.runId,
						ownerUserId: params.ownerUserId,
						executionGeneration,
						stepId: step.id,
						visit,
						durableStepName
					},
					step.config.timeoutMs,
					'approval_failed',
					recordAttempt
				);
				context = {
					...(typeof context === 'object' && context !== null ? context : {}),
					[step.config.resultKey]: approval
				};
				nextNodeId = approvalNextNodeId;
			}

			const completedSequence = sequence++;
			await workflow.do(`corex:step-completed:${traversalIndex}`, async () =>
				recordEvent(
					event({
						sequence: completedSequence,
						status: 'running',
						eventType: 'step_completed',
						stepName: step.name,
						payload: {
							stepId: step.id,
							nextNodeId,
							...(parallelBranches
								? {
										branches: parallelBranches,
										starts: parallelStarts,
										resolves: parallelResolves
									}
								: {}),
							...(step.type === 'approval'
								? { decision: (context as Record<string, unknown>)[step.config.resultKey] }
								: {})
						}
					})
				)
			);
				const tryFrame = tryFrames.at(-1);
				if (tryFrame && nextNodeId === tryFrame.step.continuationTarget) {
					if (tryFrame.phase !== 'finally' && tryFrame.step.finallyTarget) {
						tryFrame.phase = 'finally';
						nextNodeId = tryFrame.step.finallyTarget;
					} else {
						tryFrames.pop();
						if (tryFrame.pendingError !== undefined) {
							failedStepId = tryFrame.pendingErrorStepId;
							throw tryFrame.pendingError;
						}
					}
				} else if (tryFrame?.step.finallyTarget === nextNodeId) {
					tryFrame.phase = 'finally';
				}
			currentNodeId = nextNodeId;
			traversalIndex += 1;
		}
			break execution;
	} catch (error) {
		if (error instanceof CorexTerminalFailure) throw error;
			const errorStepId = failedStepId ?? currentStep?.id;
			while (tryFrames.length > 0) {
				const tryFrame = tryFrames.at(-1)!;
				if (tryFrame.phase === 'body' && tryFrame.step.catchTarget) {
					tryFrame.phase = 'catch';
					failedStepId = undefined;
					currentNodeId = tryFrame.step.catchTarget;
					continue execution;
				}
				if (tryFrame.phase !== 'finally' && tryFrame.step.finallyTarget) {
					tryFrame.phase = 'finally';
					tryFrame.pendingError = error;
					tryFrame.pendingErrorStepId = errorStepId;
					currentNodeId = tryFrame.step.finallyTarget;
					continue execution;
				}
				tryFrames.pop();
			}
		await workflow.do('corex:run-failed', async () =>
			recordEvent(
				event({
					sequence,
					status: 'errored',
					eventType: 'run_failed',
					payload: {},
						error: { code: 'process_step_failed', stepId: errorStepId }
				})
			)
		);
		throw error;
	}
	}

	await workflow.do('corex:run-completed', async () =>
		recordEvent(
			event({
				sequence,
				status: 'complete',
				eventType: 'run_completed',
				payload: {},
				output
			})
		)
	);
	return output;
}
