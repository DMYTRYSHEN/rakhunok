import { compileProcessDefinition } from '../../src/lib/features/corex/process-compiler.ts';
import {
	parseProcessDefinition,
	type ProcessDefinition
} from '../../src/lib/features/corex/process-definition.ts';
import type { CorexControlPlane, CorexPublishCommand } from './corex-router.ts';

type CorexControlPlaneOptions = {
	url: string;
	publishableKey: string;
	serviceRoleKey: string;
	fetcher?: typeof fetch;
	workflow?: {
		create(options: {
			id: string;
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

const MAX_RESPONSE_BYTES = 64 * 1024;

export class CorexControlPlaneError extends Error {
	readonly status: number;

	constructor(message: string, status: number) {
		super(message);
		this.name = 'CorexControlPlaneError';
		this.status = status;
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

	return {
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
					p_expected_revision: command.expectedRevision
				})
			});
			if (!publishResponse.ok) {
				const status = publishResponse.status === 409 ? 409 : 502;
				throw new CorexControlPlaneError('Could not publish the process.', status);
			}
			const published = (await readJson(publishResponse)) as PublishedVersion;
			if (typeof published.id !== 'string' || !Number.isSafeInteger(published.version)) {
				throw new CorexControlPlaneError('Publish returned an invalid version.', 502);
			}
			return { id: published.id, version: published.version as number };
		},
		async start(command) {
			if (!options.workflow)
				throw new CorexControlPlaneError('Workflow binding is unavailable.', 503);
			const ownerUserId = await verifyUser(command.accessToken);
			const workflowInstanceId = createId();
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
				if (
					!['approved', 'rejected'].includes(String(decision)) ||
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
