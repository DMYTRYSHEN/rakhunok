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
	config: { mode: 'merge' | 'replace'; mappings: Record<string, string> };
	next: string;
};
export type CorexInvokeProcessStep = {
	id: string;
	name: string;
	type: 'invoke-process';
	config: { processId: string; inputPath: string; resultKey: string; timeoutMs: number };
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
		callback: (context: CorexDurableStepContext) => Promise<T>
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
	attempt: number;
	startedAt: string;
	finishedAt: string;
	outcome: 'complete' | 'failed';
	retry: { limit: number; backoff: 'constant' | 'linear' | 'exponential'; timeoutMs: number };
	output?: { status: number; contentType: string | null; bytes: number };
	error?: { code: 'http_action_failed' };
};

export type CorexStepAttemptRecorder = (attempt: CorexStepAttempt) => Promise<unknown>;

export type CorexSubprocessStarter = (
	step: CorexInvokeProcessStep,
	input: unknown,
	parent: Pick<CorexWorkflowParams, 'runId' | 'ownerUserId'>
) => Promise<{ childRunId: string; workflowInstanceId: string }>;

export type CorexSubprocessTerminator = (
	step: CorexInvokeProcessStep,
	child: { childRunId: string; workflowInstanceId: string },
	parent: Pick<CorexWorkflowParams, 'runId' | 'ownerUserId'>
) => Promise<void>;

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

export async function executeCorexWorkflow(
	params: CorexWorkflowParams,
	workflow: CorexDurableStep,
	recordEvent: (event: CorexRunEvent) => Promise<unknown>,
	fetcher: typeof fetch = fetch,
	startSubprocess?: CorexSubprocessStarter,
	terminateSubprocess?: CorexSubprocessTerminator,
	executionGeneration = 1,
	recordAttempt?: CorexStepAttemptRecorder
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
			if (step.type === 'parallel') {
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

						if (branchStep.type === 'http-request') {
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
								async () => executeHttpAction(branchStep, branchContext, fetcher)
							);
							branchContext = result.body;
							branchNodeId = branchStep.next;
						} else if (branchStep.type === 'transform') {
							branchContext = await workflow.do(branchStepName, async () =>
								applyTransform(branchStep, branchContext)
							);
							branchNodeId = branchStep.next;
						} else if (branchStep.type === 'condition') {
							const matched = await workflow.do(branchStepName, async () =>
								evaluateCondition(branchStep, branchContext)
							);
							branchNodeId = matched ? branchStep.whenTrue : branchStep.whenFalse;
						} else if (branchStep.type === 'switch') {
							const selectedCase = await workflow.do(branchStepName, async () =>
								selectSwitchCase(branchStep, branchContext)
							);
							branchNodeId = selectedCase
								? branchStep.targets[selectedCase]
								: branchStep.defaultTarget;
						} else if (branchStep.type === 'loop') {
							const iteration = branchLoopIterations.get(branchStep.id) ?? 0;
							const enterBody = await workflow.do(branchStepName, async () =>
								Promise.resolve(iteration < branchStep.config.maxIterations)
							);
							if (enterBody) branchLoopIterations.set(branchStep.id, iteration + 1);
							branchNodeId = enterBody ? branchStep.bodyTarget : branchStep.exitTarget;
						} else if (branchStep.type === 'break') {
							await workflow.do(branchStepName, async () => Promise.resolve());
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
					async (stepContext) => {
						const startedAt = new Date().toISOString();
						try {
							const httpResult = await executeHttpAction(step, context, fetcher);
							if (recordAttempt) {
								try {
									await recordAttempt({
										runId: params.runId,
										ownerUserId: params.ownerUserId,
										executionGeneration,
										stepId: step.id,
										visit,
										durableStepName,
										attempt: stepContext.attempt,
										startedAt,
										finishedAt: new Date().toISOString(),
										outcome: 'complete',
										retry: {
											limit: step.config.retry.limit,
											backoff: step.config.retry.backoff,
											timeoutMs: step.config.timeoutMs
										},
										output: {
											status: httpResult.status,
											contentType: httpResult.contentType,
											bytes: httpResult.bytes
										}
									});
								} catch {
									// Observability failures must not replay a completed external side effect.
								}
							}
							return httpResult;
						} catch (error) {
							if (recordAttempt) {
								try {
									await recordAttempt({
										runId: params.runId,
										ownerUserId: params.ownerUserId,
										executionGeneration,
										stepId: step.id,
										visit,
										durableStepName,
										attempt: stepContext.attempt,
										startedAt,
										finishedAt: new Date().toISOString(),
										outcome: 'failed',
										retry: {
											limit: step.config.retry.limit,
											backoff: step.config.retry.backoff,
											timeoutMs: step.config.timeoutMs
										},
										error: { code: 'http_action_failed' }
									});
								} catch {
									// Preserve the action failure when attempt telemetry is unavailable.
								}
							}
							throw error;
						}
					}
				);
				context = result.body;
				nextNodeId = step.next;
			} else if (step.type === 'transform') {
				context = await workflow.do(durableStepName, async () => applyTransform(step, context));
				nextNodeId = step.next;
			} else if (step.type === 'condition') {
				const matched = await workflow.do(durableStepName, async () =>
					evaluateCondition(step, context)
				);
				nextNodeId = matched ? step.whenTrue : step.whenFalse;
			} else if (step.type === 'switch') {
				const selectedCase = await workflow.do(durableStepName, async () =>
					selectSwitchCase(step, context)
				);
				nextNodeId = selectedCase ? step.targets[selectedCase] : step.defaultTarget;
			} else if (step.type === 'loop') {
				const iteration = loopIterations.get(step.id) ?? 0;
				const enterBody = await workflow.do(durableStepName, async () =>
					Promise.resolve(iteration < step.config.maxIterations)
				);
				if (enterBody) loopIterations.set(step.id, iteration + 1);
				nextNodeId = enterBody ? step.bodyTarget : step.exitTarget;
			} else if (step.type === 'break') {
				await workflow.do(durableStepName, async () => Promise.resolve());
				nextNodeId = step.exitTarget;
			} else if (step.type === 'wait') {
				await workflow.sleep(durableStepName, `${step.config.durationMs} milliseconds`);
				nextNodeId = step.next;
			} else if (step.type === 'wait-until') {
				await workflow.sleepUntil(durableStepName, new Date(step.config.timestamp));
				nextNodeId = step.next;
			} else if (step.type === 'wait-event') {
				const received = await workflow.waitForEvent<unknown>(durableStepName, {
					type: waitEventType!,
					timeout: `${step.config.timeoutMs} milliseconds`
				});
				context = {
					...(typeof context === 'object' && context !== null ? context : {}),
					[step.config.resultKey]: received.payload
				};
				nextNodeId = step.next;
			} else if (step.type === 'invoke-process') {
				if (!startSubprocess) throw new Error('Subprocess execution is unavailable.');
				const childInput = resolveJsonPath(step.config.inputPath, context);
				const child = await workflow.do(durableStepName, async () =>
					startSubprocess(step, childInput, {
						runId: params.runId,
						ownerUserId: params.ownerUserId
					})
				);
				let received: { payload: unknown };
				try {
					received = await workflow.waitForEvent<unknown>(`${durableStepName}:result`, {
						type: corexSubprocessResultEventType(child.childRunId),
						timeout: `${step.config.timeoutMs} milliseconds`
					});
				} catch (error) {
					if (terminateSubprocess) {
						try {
							await workflow.do(`${durableStepName}:terminate-child`, async () =>
								terminateSubprocess(step, child, {
									runId: params.runId,
									ownerUserId: params.ownerUserId
								})
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
				)
					throw new Error('Subprocess result payload is invalid.');
				if ((result as Record<string, unknown>).status === 'errored') {
					throw new Error('Subprocess failed.');
				}
				if ((result as Record<string, unknown>).status !== 'complete') {
					throw new Error('Subprocess result payload is invalid.');
				}
				context = {
					...(typeof context === 'object' && context !== null ? context : {}),
					[step.config.resultKey]: (result as Record<string, unknown>).output
				};
				nextNodeId = step.next;
			} else {
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
				context = {
					...(typeof context === 'object' && context !== null ? context : {}),
					[step.config.resultKey]: approval
				};
				const decision = (approval as Record<string, unknown>).decision;
				nextNodeId =
					decision === 'approved'
						? (step.whenApproved ?? step.next ?? '')
						: (step.whenRejected ?? step.next ?? '');
				if (!nextNodeId)
					throw new Error(`Approval step "${step.id}" has no ${decision} transition.`);
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
			currentNodeId = nextNodeId;
			traversalIndex += 1;
		}
	} catch (error) {
		if (error instanceof CorexTerminalFailure) throw error;
		await workflow.do('corex:run-failed', async () =>
			recordEvent(
				event({
					sequence,
					status: 'errored',
					eventType: 'run_failed',
					payload: {},
					error: { code: 'process_step_failed', stepId: currentStep?.id }
				})
			)
		);
		throw error;
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
