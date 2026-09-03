import { compileProcessDefinition } from '../../src/lib/features/corex/process-compiler.ts';
import {
	parseProcessDefinition,
	type ProcessDefinition
} from '../../src/lib/features/corex/process-definition.ts';
import type {
	CorexControlPlane,
	CorexDomainTarget,
	CorexExternalOutputDescriptor,
	CorexLocationHint,
	CorexProcessRetirementResult,
	CorexPublishCommand,
	CorexTriggerLifecycleResult
} from './corex-router.ts';

type CorexControlPlaneOptions = {
	url: string;
	publishableKey: string;
	serviceRoleKey: string;
	fetcher?: typeof fetch;
	workflow?: {
		create(options: {
			id: string;
			locationHint?: CorexLocationHint;
			params: {
				runId: string;
				workflowInstanceId: string;
				ownerUserId: string;
				plan: unknown;
				input: unknown;
			};
		}): Promise<unknown>;
		get(id: string): Promise<{
			status(): Promise<{ status: string }>;
			terminate(options?: { rollback?: boolean }): Promise<void>;
			sendEvent(options: { type: string; payload: unknown }): Promise<void>;
		}>;
	};
	createId?: () => string;
};

type SupabaseUser = { id?: unknown };
type PublishedVersion = { id?: unknown; version?: unknown };
type DomainTarget = Partial<CorexDomainTarget>;
type PersistedDraft = { revision?: unknown; draft_definition?: unknown };
type StartedRun = {
	id?: unknown;
	workflowInstanceId?: unknown;
	status?: unknown;
	definition?: unknown;
};
type ApprovalDecision = { accepted?: unknown };
type EventAcceptance = { accepted?: unknown };
type CancellationResult = {
	id?: unknown;
	status?: unknown;
	accepted?: unknown;
	workflowInstanceIds?: unknown;
};
type LifecycleResult = { id?: unknown; status?: unknown; accepted?: unknown };
type RestartResult = LifecycleResult & { executionGeneration?: unknown };
type ArchiveResult = LifecycleResult & { archivedAt?: unknown };
type ProcessRetirementResult = {
	id?: unknown;
	lifecycle?: unknown;
	retiredAt?: unknown;
	accepted?: unknown;
};
type StepAttemptOutputRow = { output?: unknown };
type TriggerLifecycleResult = { processId?: unknown; version?: unknown; active?: unknown };
type OperationSubmission = { id?: unknown; status?: unknown; itemCount?: unknown };
type OperationRow = {
	id?: unknown;
	kind?: unknown;
	status?: unknown;
	item_count?: unknown;
	completed_count?: unknown;
	failed_count?: unknown;
	created_at?: unknown;
	started_at?: unknown;
	completed_at?: unknown;
};
type OperationItemRow = {
	target_id?: unknown;
	status?: unknown;
	attempts?: unknown;
	result?: unknown;
	error_code?: unknown;
};

const MAX_RESPONSE_BYTES = 64 * 1024;

export class CorexControlPlaneError extends Error {
	readonly status: number;
	readonly code?: 'route_conflict' | 'route_protected';

	constructor(message: string, status: number, code?: 'route_conflict' | 'route_protected') {
		super(message);
		this.name = 'CorexControlPlaneError';
		this.status = status;
		this.code = code;
	}
}

async function readJson(response: Response): Promise<unknown> {
	const declaredLength = Number(response.headers.get('Content-Length') ?? 0);
	if (declaredLength > MAX_RESPONSE_BYTES)
		throw new CorexControlPlaneError('Upstream response is too large.', 502);
	const body = await response.text();
	if (new TextEncoder().encode(body).byteLength > MAX_RESPONSE_BYTES) {
		throw new CorexControlPlaneError('Upstream response is too large.', 502);
	}
	try {
		return JSON.parse(body);
	} catch {
		throw new CorexControlPlaneError('Upstream returned invalid JSON.', 502);
	}
}

function isPublishableDraft(
	value: unknown,
	processId: string,
	revision: number
): ProcessDefinition | undefined {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
	return parseProcessDefinition({ ...value, id: processId, revision, lifecycle: 'draft' });
}

function readExternalOutputDescriptor(value: unknown): CorexExternalOutputDescriptor | undefined {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
	const external = (value as { external?: unknown }).external;
	if (typeof external !== 'object' || external === null || Array.isArray(external))
		return undefined;
	const descriptor = external as Record<string, unknown>;
	if (
		typeof descriptor.key !== 'string' ||
		!descriptor.key.startsWith('corex-output/') ||
		!Number.isSafeInteger(descriptor.bytes) ||
		Number(descriptor.bytes) < 0 ||
		descriptor.contentType !== 'application/json'
	) {
		return undefined;
	}
	return {
		key: descriptor.key,
		bytes: Number(descriptor.bytes),
		contentType: 'application/json'
	};
}

export function createSupabaseCorexControlPlane(
	options: CorexControlPlaneOptions
): CorexControlPlane {
	const fetcher = options.fetcher ?? fetch;
	const baseUrl = options.url.replace(/\/+$/, '');
	const createId = options.createId ?? (() => crypto.randomUUID());

	async function verifyUser(accessToken: string): Promise<string> {
		const userResponse = await fetcher(`${baseUrl}/auth/v1/user`, {
			headers: {
				Authorization: `Bearer ${accessToken}`,
				apikey: options.publishableKey
			}
		});
		if (!userResponse.ok) throw new CorexControlPlaneError('Authentication required.', 401);
		const user = (await readJson(userResponse)) as SupabaseUser;
		if (typeof user.id !== 'string' || !user.id) {
			throw new CorexControlPlaneError('Authentication required.', 401);
		}
		return user.id;
	}

	async function requestTriggerLifecycle(
		operation: 'corex_deactivate_http_trigger' | 'corex_rollback_http_trigger',
		body: Record<string, string | number>
	): Promise<CorexTriggerLifecycleResult> {
		const response = await fetcher(`${baseUrl}/rest/v1/rpc/${operation}`, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${options.serviceRoleKey}`,
				apikey: options.serviceRoleKey,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(body)
		});
		if (!response.ok) {
			const errorBody = await readJson(response);
			const errorCode =
				typeof errorBody === 'object' && errorBody !== null && 'code' in errorBody
					? errorBody.code
					: undefined;
			const errorMessage =
				typeof errorBody === 'object' && errorBody !== null && 'message' in errorBody
					? errorBody.message
					: undefined;
			if (errorCode === '23505' && errorMessage === 'Corex HTTP route conflict') {
				throw new CorexControlPlaneError('HTTP route is already in use.', 409, 'route_conflict');
			}
			if (errorCode === '40001' && errorMessage === 'Corex trigger lifecycle conflict') {
				throw new CorexControlPlaneError('Trigger lifecycle request conflicts.', 409);
			}
			if (
				errorCode === 'PT409' &&
				errorMessage === 'Corex HTTP trigger lifecycle request conflicts'
			) {
				throw new CorexControlPlaneError('Trigger lifecycle request conflicts.', 409);
			}
			if (
				errorCode === 'P0002' &&
				(errorMessage === 'Corex rollback version is missing' ||
					errorMessage === 'Corex rollback trigger is missing')
			) {
				throw new CorexControlPlaneError('Trigger version not found.', 404);
			}
			if (response.status === 404)
				throw new CorexControlPlaneError('Trigger version not found.', 404);
			if (response.status === 409)
				throw new CorexControlPlaneError('Trigger lifecycle request conflicts.', 409);
			throw new CorexControlPlaneError('Could not change the HTTP trigger lifecycle.', 502);
		}
		const result = (await readJson(response)) as TriggerLifecycleResult;
		if (
			typeof result.processId !== 'string' ||
			!Number.isSafeInteger(result.version) ||
			Number(result.version) < 1 ||
			typeof result.active !== 'boolean'
		) {
			throw new CorexControlPlaneError('Trigger lifecycle command returned invalid data.', 502);
		}
		return {
			processId: result.processId,
			version: result.version as number,
			active: result.active
		};
	}

	async function failRun(runId: string, ownerUserId: string, code: string): Promise<void> {
		try {
			await fetcher(`${baseUrl}/rest/v1/rpc/corex_fail_process_run`, {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${options.serviceRoleKey}`,
					apikey: options.serviceRoleKey,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					p_run_id: runId,
					p_owner_user_id: ownerUserId,
					p_error: { code }
				})
			});
		} catch {
			// Preserve the sanitized command error when compensation is unavailable.
		}
	}

	async function submitOperationRpc(
		name: 'corex_submit_batch_operation' | 'corex_submit_process_deletion',
		body: Record<string, unknown>
	): Promise<{ id: string; status: string; itemCount: number }> {
		const response = await fetcher(`${baseUrl}/rest/v1/rpc/${name}`, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${options.serviceRoleKey}`,
				apikey: options.serviceRoleKey,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(body)
		});
		if (!response.ok) {
			const error = (await readJson(response)) as { code?: unknown };
			const status =
				error.code === 'PT403'
					? 403
					: error.code === 'PT404'
						? 404
						: error.code === 'PT409'
							? 409
							: error.code === 'PT422'
								? 422
								: error.code === 'PT423'
									? 423
									: 502;
			throw new CorexControlPlaneError('Could not submit Corex operation.', status);
		}
		const result = (await readJson(response)) as OperationSubmission;
		if (
			typeof result.id !== 'string' ||
			typeof result.status !== 'string' ||
			!Number.isSafeInteger(result.itemCount) ||
			Number(result.itemCount) < 1
		) {
			throw new CorexControlPlaneError('Operation command returned invalid data.', 502);
		}
		return { id: result.id, status: result.status, itemCount: Number(result.itemCount) };
	}

	return {
		async submitOperation(command) {
			const ownerUserId = await verifyUser(command.accessToken);
			return submitOperationRpc('corex_submit_batch_operation', {
				p_owner_user_id: ownerUserId,
				p_requested_by: ownerUserId,
				p_request_id: command.requestId,
				p_kind: command.kind,
				p_items: command.items
			});
		},
		async deleteProcess(command) {
			const ownerUserId = await verifyUser(command.accessToken);
			return submitOperationRpc('corex_submit_process_deletion', {
				p_process_id: command.processId,
				p_owner_user_id: ownerUserId,
				p_requested_by: ownerUserId,
				p_request_id: command.requestId
			});
		},
		async getOperation(command) {
			const ownerUserId = await verifyUser(command.accessToken);
			const operationQuery = new URL(`${baseUrl}/rest/v1/corex_operations`);
			operationQuery.searchParams.set(
				'select',
				'id,kind,status,item_count,completed_count,failed_count,created_at,started_at,completed_at'
			);
			operationQuery.searchParams.set('id', `eq.${command.operationId}`);
			operationQuery.searchParams.set('owner_user_id', `eq.${ownerUserId}`);
			const operationResponse = await fetcher(operationQuery, {
				headers: {
					Authorization: `Bearer ${options.serviceRoleKey}`,
					apikey: options.serviceRoleKey
				}
			});
			if (!operationResponse.ok)
				throw new CorexControlPlaneError('Could not load Corex operation.', 502);
			const operations = (await readJson(operationResponse)) as OperationRow[];
			const operation = operations[0];
			if (!operation) throw new CorexControlPlaneError('Operation not found.', 404);
			const itemQuery = new URL(`${baseUrl}/rest/v1/corex_operation_items`);
			itemQuery.searchParams.set('select', 'target_id,status,attempts,result,error_code');
			itemQuery.searchParams.set('operation_id', `eq.${command.operationId}`);
			itemQuery.searchParams.set('order', 'ordinal.asc');
			const itemResponse = await fetcher(itemQuery, {
				headers: {
					Authorization: `Bearer ${options.serviceRoleKey}`,
					apikey: options.serviceRoleKey
				}
			});
			if (!itemResponse.ok)
				throw new CorexControlPlaneError('Could not load Corex operation.', 502);
			const items = (await readJson(itemResponse)) as OperationItemRow[];
			if (
				typeof operation.id !== 'string' ||
				typeof operation.kind !== 'string' ||
				typeof operation.status !== 'string' ||
				!Number.isSafeInteger(operation.item_count) ||
				!Number.isSafeInteger(operation.completed_count) ||
				!Number.isSafeInteger(operation.failed_count) ||
				typeof operation.created_at !== 'string' ||
				!Array.isArray(items) ||
				items.some(
					(item) =>
						typeof item.target_id !== 'string' ||
						typeof item.status !== 'string' ||
						!Number.isSafeInteger(item.attempts)
				)
			) {
				throw new CorexControlPlaneError('Operation query returned invalid data.', 502);
			}
			return {
				id: operation.id,
				kind: operation.kind,
				status: operation.status,
				itemCount: Number(operation.item_count),
				completedCount: Number(operation.completed_count),
				failedCount: Number(operation.failed_count),
				createdAt: operation.created_at,
				startedAt: typeof operation.started_at === 'string' ? operation.started_at : null,
				completedAt: typeof operation.completed_at === 'string' ? operation.completed_at : null,
				items: items.map((item) => ({
					targetId: item.target_id as string,
					status: item.status as 'pending' | 'processing' | 'complete' | 'failed',
					attempts: Number(item.attempts),
					result:
						typeof item.result === 'object' && item.result !== null && !Array.isArray(item.result)
							? (item.result as Record<string, unknown>)
							: null,
					errorCode: typeof item.error_code === 'string' ? item.error_code : null
				}))
			};
		},
		async configureDomainTarget(command) {
			const ownerUserId = await verifyUser(command.accessToken);
			const response = await fetcher(`${baseUrl}/rest/v1/rpc/corex_configure_domain_target`, {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${options.serviceRoleKey}`,
					apikey: options.serviceRoleKey,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					p_owner_user_id: ownerUserId,
					p_environment_key: command.environmentKey,
					p_route_namespace: command.routeNamespace,
					p_hostname: command.hostname
				})
			});
			if (!response.ok) {
				const errorBody = await readJson(response);
				const errorCode =
					typeof errorBody === 'object' && errorBody !== null && 'code' in errorBody
						? errorBody.code
						: undefined;
				if (errorCode === 'PT403')
					throw new CorexControlPlaneError('The domain is protected.', 403);
				if (errorCode === 'PT409')
					throw new CorexControlPlaneError('The domain target conflicts.', 409);
				throw new CorexControlPlaneError('Could not configure the domain target.', 502);
			}
			const target = (await readJson(response)) as DomainTarget;
			if (
				typeof target.environmentId !== 'string' ||
				typeof target.environmentKey !== 'string' ||
				typeof target.routeNamespace !== 'string' ||
				typeof target.domainTargetId !== 'string' ||
				typeof target.hostname !== 'string' ||
				!['pending', 'verified', 'failed'].includes(target.verificationStatus ?? '')
			) {
				throw new CorexControlPlaneError('Domain target returned invalid data.', 502);
			}
			return target as CorexDomainTarget;
		},
		async resolveStepAttemptOutput(command) {
			const ownerUserId = await verifyUser(command.accessToken);
			const query = new URLSearchParams({
				select: 'output',
				run_id: `eq.${command.runId}`,
				owner_user_id: `eq.${ownerUserId}`,
				execution_generation: `eq.${command.executionGeneration}`,
				step_id: `eq.${command.stepId}`,
				visit: `eq.${command.visit}`,
				attempt: `eq.${command.attempt}`,
				limit: '1'
			});
			const response = await fetcher(`${baseUrl}/rest/v1/corex_step_attempts?${query}`, {
				headers: {
					Authorization: `Bearer ${options.serviceRoleKey}`,
					apikey: options.serviceRoleKey
				}
			});
			if (!response.ok) throw new CorexControlPlaneError('Could not load the step attempt.', 502);
			const rows = await readJson(response);
			const row = Array.isArray(rows) ? (rows[0] as StepAttemptOutputRow | undefined) : undefined;
			const descriptor = readExternalOutputDescriptor(row?.output);
			if (!descriptor) throw new CorexControlPlaneError('Step output not found.', 404);
			return descriptor;
		},
		async publish(command: CorexPublishCommand) {
			const ownerUserId = await verifyUser(command.accessToken);
			const query = new URLSearchParams({
				select: 'revision,draft_definition',
				id: `eq.${command.processId}`,
				owner_user_id: `eq.${ownerUserId}`,
				revision: `eq.${command.expectedRevision}`,
				limit: '1'
			});
			const draftResponse = await fetcher(`${baseUrl}/rest/v1/corex_processes?${query}`, {
				headers: {
					Authorization: `Bearer ${options.serviceRoleKey}`,
					apikey: options.serviceRoleKey
				}
			});
			if (!draftResponse.ok)
				throw new CorexControlPlaneError('Could not load the process draft.', 502);
			const rows = await readJson(draftResponse);
			const persisted = Array.isArray(rows) ? (rows[0] as PersistedDraft | undefined) : undefined;
			if (!persisted || persisted.revision !== command.expectedRevision) {
				throw new CorexControlPlaneError('The process revision changed before publish.', 409);
			}
			const definition = isPublishableDraft(
				persisted.draft_definition,
				command.processId,
				command.expectedRevision
			);
			if (!definition || !compileProcessDefinition(definition).ok) {
				throw new CorexControlPlaneError('The persisted process draft is not executable.', 422);
			}

			const publishResponse = await fetcher(`${baseUrl}/rest/v1/rpc/corex_publish_process`, {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${options.serviceRoleKey}`,
					apikey: options.serviceRoleKey,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					p_process_id: command.processId,
					p_owner_user_id: ownerUserId,
					p_expected_revision: command.expectedRevision,
					p_environment_id: command.environmentId ?? null,
					p_route_namespace: command.routeNamespace ?? null
				})
			});
			if (!publishResponse.ok) {
				const errorBody = await readJson(publishResponse);
				if (
					typeof errorBody === 'object' &&
					errorBody !== null &&
					'code' in errorBody &&
					errorBody.code === '23505' &&
					'message' in errorBody &&
					errorBody.message === 'Corex HTTP route conflict'
				) {
					throw new CorexControlPlaneError('HTTP route is already in use.', 409, 'route_conflict');
				}
				if (
					typeof errorBody === 'object' &&
					errorBody !== null &&
					'code' in errorBody &&
					errorBody.code === 'PT403' &&
					'message' in errorBody &&
					errorBody.message === 'Corex HTTP route is protected'
				) {
					throw new CorexControlPlaneError('HTTP route is protected.', 403, 'route_protected');
				}
				const status = publishResponse.status === 409 ? 409 : 502;
				throw new CorexControlPlaneError('Could not publish the process.', status);
			}
			const published = (await readJson(publishResponse)) as PublishedVersion;
			if (typeof published.id !== 'string' || !Number.isSafeInteger(published.version)) {
				throw new CorexControlPlaneError('Publish returned an invalid version.', 502);
			}
			return { id: published.id, version: published.version as number };
		},
		async deactivateTrigger(command) {
			const ownerUserId = await verifyUser(command.accessToken);
			return requestTriggerLifecycle('corex_deactivate_http_trigger', {
				p_process_id: command.processId,
				p_owner_user_id: ownerUserId,
				p_request_id: command.requestId,
				p_expected_version: command.expectedVersion
			});
		},
		async rollbackTrigger(command) {
			const ownerUserId = await verifyUser(command.accessToken);
			return requestTriggerLifecycle('corex_rollback_http_trigger', {
				p_process_id: command.processId,
				p_owner_user_id: ownerUserId,
				p_request_id: command.requestId,
				p_expected_version: command.expectedVersion,
				p_target_version: command.targetVersion
			});
		},
		async start(command) {
			if (!options.workflow)
				throw new CorexControlPlaneError('Workflow binding is unavailable.', 503);
			const ownerUserId = await verifyUser(command.accessToken);
			const workflowInstanceId = command.instanceId
				? `corex:${ownerUserId.toLowerCase()}:${command.instanceId.toLowerCase()}`
				: createId();
			const runResponse = await fetcher(`${baseUrl}/rest/v1/rpc/corex_start_process_run`, {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${options.serviceRoleKey}`,
					apikey: options.serviceRoleKey,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					p_process_id: command.processId,
					p_owner_user_id: ownerUserId,
					p_workflow_instance_id: workflowInstanceId,
					p_input: command.input
				})
			});
			if (!runResponse.ok) throw new CorexControlPlaneError('Could not create the run.', 502);
			const run = (await readJson(runResponse)) as StartedRun;
			if (
				typeof run.id !== 'string' ||
				typeof run.workflowInstanceId !== 'string' ||
				typeof run.status !== 'string' ||
				typeof run.definition !== 'object' ||
				run.definition === null
			) {
				throw new CorexControlPlaneError('Run command returned invalid data.', 502);
			}
			const compilation = compileProcessDefinition(run.definition as ProcessDefinition);
			if (!compilation.ok) {
				await failRun(run.id, ownerUserId, 'process_not_executable');
				throw new CorexControlPlaneError('Published process is not executable.', 422);
			}
			try {
				await options.workflow.create({
					id: run.workflowInstanceId,
					...(command.locationHint ? { locationHint: command.locationHint } : {}),
					params: {
						runId: run.id,
						workflowInstanceId: run.workflowInstanceId,
						ownerUserId,
						plan: compilation.plan,
						input: command.input
					}
				});
			} catch {
				await failRun(run.id, ownerUserId, 'workflow_create_failed');
				throw new CorexControlPlaneError('Workflow could not be started.', 503);
			}
			return { id: run.id, workflowInstanceId: run.workflowInstanceId, status: run.status };
		},
		async cancel(command) {
			if (!options.workflow)
				throw new CorexControlPlaneError('Workflow binding is unavailable.', 503);
			const ownerUserId = await verifyUser(command.accessToken);
			const response = await fetcher(`${baseUrl}/rest/v1/rpc/corex_request_run_cancellation`, {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${options.serviceRoleKey}`,
					apikey: options.serviceRoleKey,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					p_run_id: command.runId,
					p_owner_user_id: ownerUserId,
					p_request_id: command.requestId
				})
			});
			if (!response.ok) {
				if (response.status === 404) throw new CorexControlPlaneError('Run not found.', 404);
				if (response.status === 409)
					throw new CorexControlPlaneError('Cancellation request conflicts.', 409);
				throw new CorexControlPlaneError('Could not request run cancellation.', 502);
			}
			const result = (await readJson(response)) as CancellationResult;
			if (
				typeof result.id !== 'string' ||
				typeof result.status !== 'string' ||
				result.accepted !== true ||
				!Array.isArray(result.workflowInstanceIds) ||
				result.workflowInstanceIds.some((id) => typeof id !== 'string')
			)
				throw new CorexControlPlaneError('Cancellation command returned invalid data.', 502);

			for (const workflowInstanceId of result.workflowInstanceIds as string[]) {
				try {
					const instance = await options.workflow.get(workflowInstanceId);
					const status = (await instance.status()).status;
					if (!['complete', 'errored', 'terminated', 'unknown'].includes(status)) {
						await instance.terminate();
					}
				} catch {
					// The durable outbox retains termination intent for reconciliation.
				}
			}
			return { id: result.id, status: result.status, accepted: true as const };
		},
		async lifecycle(command) {
			const ownerUserId = await verifyUser(command.accessToken);
			const response = await fetcher(`${baseUrl}/rest/v1/rpc/corex_request_run_lifecycle`, {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${options.serviceRoleKey}`,
					apikey: options.serviceRoleKey,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					p_run_id: command.runId,
					p_owner_user_id: ownerUserId,
					p_request_id: command.requestId,
					p_command: command.action
				})
			});
			if (!response.ok) {
				if (response.status === 404) throw new CorexControlPlaneError('Run not found.', 404);
				if (response.status === 409)
					throw new CorexControlPlaneError('Run lifecycle request conflicts.', 409);
				throw new CorexControlPlaneError('Could not request run lifecycle change.', 502);
			}
			const result = (await readJson(response)) as LifecycleResult;
			if (
				typeof result.id !== 'string' ||
				typeof result.status !== 'string' ||
				result.accepted !== true
			) {
				throw new CorexControlPlaneError('Lifecycle command returned invalid data.', 502);
			}
			return { id: result.id, status: result.status, accepted: true as const };
		},
		async restart(command) {
			const ownerUserId = await verifyUser(command.accessToken);
			const response = await fetcher(`${baseUrl}/rest/v1/rpc/corex_request_run_restart`, {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${options.serviceRoleKey}`,
					apikey: options.serviceRoleKey,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					p_run_id: command.runId,
					p_owner_user_id: ownerUserId,
					p_request_id: command.requestId,
					p_from: command.from ?? null
				})
			});
			if (!response.ok) {
				if (response.status === 404) throw new CorexControlPlaneError('Run not found.', 404);
				if (response.status === 409)
					throw new CorexControlPlaneError('Run restart request conflicts.', 409);
				throw new CorexControlPlaneError('Could not request run restart.', 502);
			}
			const result = (await readJson(response)) as RestartResult;
			if (
				typeof result.id !== 'string' ||
				typeof result.status !== 'string' ||
				!Number.isSafeInteger(result.executionGeneration) ||
				Number(result.executionGeneration) < 2 ||
				result.accepted !== true
			) {
				throw new CorexControlPlaneError('Restart command returned invalid data.', 502);
			}
			return {
				id: result.id,
				status: result.status,
				executionGeneration: result.executionGeneration as number,
				accepted: true as const
			};
		},
		async rollback(command) {
			const ownerUserId = await verifyUser(command.accessToken);
			const response = await fetcher(`${baseUrl}/rest/v1/rpc/corex_request_run_rollback`, {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${options.serviceRoleKey}`,
					apikey: options.serviceRoleKey,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					p_run_id: command.runId,
					p_owner_user_id: ownerUserId,
					p_request_id: command.requestId
				})
			});
			if (!response.ok) {
				if (response.status === 404) throw new CorexControlPlaneError('Run not found.', 404);
				if (response.status === 409)
					throw new CorexControlPlaneError('Run rollback request conflicts.', 409);
				throw new CorexControlPlaneError('Could not request run rollback.', 502);
			}
			const result = (await readJson(response)) as LifecycleResult;
			if (
				typeof result.id !== 'string' ||
				typeof result.status !== 'string' ||
				result.accepted !== true
			) {
				throw new CorexControlPlaneError('Rollback command returned invalid data.', 502);
			}
			return { id: result.id, status: result.status, accepted: true as const };
		},
		async archive(command) {
			const ownerUserId = await verifyUser(command.accessToken);
			const response = await fetcher(`${baseUrl}/rest/v1/rpc/corex_request_run_archive`, {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${options.serviceRoleKey}`,
					apikey: options.serviceRoleKey,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					p_run_id: command.runId,
					p_owner_user_id: ownerUserId,
					p_request_id: command.requestId
				})
			});
			if (!response.ok) {
				if (response.status === 404) throw new CorexControlPlaneError('Run not found.', 404);
				if (response.status === 409)
					throw new CorexControlPlaneError('Run archive request conflicts.', 409);
				throw new CorexControlPlaneError('Could not request run archive.', 502);
			}
			const result = (await readJson(response)) as ArchiveResult;
			if (
				typeof result.id !== 'string' ||
				typeof result.status !== 'string' ||
				typeof result.archivedAt !== 'string' ||
				result.accepted !== true
			) {
				throw new CorexControlPlaneError('Archive command returned invalid data.', 502);
			}
			return {
				id: result.id,
				status: result.status,
				archivedAt: result.archivedAt,
				accepted: true as const
			};
		},
		async retireProcess(command): Promise<CorexProcessRetirementResult> {
			const ownerUserId = await verifyUser(command.accessToken);
			const response = await fetcher(`${baseUrl}/rest/v1/rpc/corex_retire_process`, {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${options.serviceRoleKey}`,
					apikey: options.serviceRoleKey,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					p_process_id: command.processId,
					p_owner_user_id: ownerUserId,
					p_request_id: command.requestId
				})
			});
			if (!response.ok) {
				if (response.status === 404) throw new CorexControlPlaneError('Process not found.', 404);
				if (response.status === 409)
					throw new CorexControlPlaneError('Process retirement request conflicts.', 409);
				throw new CorexControlPlaneError('Could not retire the process.', 502);
			}
			const result = (await readJson(response)) as ProcessRetirementResult;
			if (
				typeof result.id !== 'string' ||
				result.lifecycle !== 'retired' ||
				typeof result.retiredAt !== 'string' ||
				result.accepted !== true
			) {
				throw new CorexControlPlaneError('Process retirement returned invalid data.', 502);
			}
			return {
				id: result.id,
				lifecycle: result.lifecycle,
				retiredAt: result.retiredAt,
				accepted: true
			};
		},
		async signal(command) {
			const ownerUserId = await verifyUser(command.accessToken);
			if (command.type === 'corex-approval') {
				if (
					typeof command.payload !== 'object' ||
					command.payload === null ||
					Array.isArray(command.payload)
				) {
					throw new CorexControlPlaneError('Approval decision is invalid.', 400);
				}
				const decision = (command.payload as Record<string, unknown>).decision;
				const comment = (command.payload as Record<string, unknown>).comment;
				const taskId = (command.payload as Record<string, unknown>).taskId;
				if (
					!['approved', 'rejected'].includes(String(decision)) ||
					typeof taskId !== 'string' ||
					!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
						taskId
					) ||
					(comment !== undefined && typeof comment !== 'string')
				) {
					throw new CorexControlPlaneError('Approval decision is invalid.', 400);
				}
				const decisionResponse = await fetcher(
					`${baseUrl}/rest/v1/rpc/corex_decide_approval_task`,
					{
						method: 'POST',
						headers: {
							Authorization: `Bearer ${options.serviceRoleKey}`,
							apikey: options.serviceRoleKey,
							'Content-Type': 'application/json'
						},
						body: JSON.stringify({
							p_run_id: command.runId,
							p_task_id: taskId,
							p_actor_user_id: ownerUserId,
							p_decision: decision,
							p_comment: typeof comment === 'string' ? comment : ''
						})
					}
				);
				if (!decisionResponse.ok)
					throw new CorexControlPlaneError('Approval task cannot be decided.', 409);
				const approved = (await readJson(decisionResponse)) as ApprovalDecision;
				if (approved.accepted !== true) {
					throw new CorexControlPlaneError('Approval task returned invalid data.', 502);
				}
				return { accepted: true as const };
			}
			if (
				!command.eventId ||
				!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
					command.eventId
				)
			) {
				throw new CorexControlPlaneError('Event ID is invalid.', 400);
			}
			if (command.type.toLowerCase().startsWith('corex-')) {
				throw new CorexControlPlaneError('Event type is reserved.', 400);
			}
			const eventResponse = await fetcher(`${baseUrl}/rest/v1/rpc/corex_enqueue_workflow_event`, {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${options.serviceRoleKey}`,
					apikey: options.serviceRoleKey,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					p_run_id: command.runId,
					p_owner_user_id: ownerUserId,
					p_event_id: command.eventId,
					p_step_id: command.stepId ?? null,
					p_event_type: command.type,
					p_payload: command.payload
				})
			});
			if (!eventResponse.ok) {
				if (eventResponse.status === 404) throw new CorexControlPlaneError('Run not found.', 404);
				if (eventResponse.status === 409)
					throw new CorexControlPlaneError('Run cannot accept events.', 409);
				throw new CorexControlPlaneError('Could not enqueue workflow event.', 502);
			}
			const accepted = (await readJson(eventResponse)) as EventAcceptance;
			if (accepted.accepted !== true) {
				throw new CorexControlPlaneError('Workflow event command returned invalid data.', 502);
			}
			return { accepted: true as const };
		}
	};
}
