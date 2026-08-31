import { compileProcessDefinition } from '../../src/lib/features/corex/process-compiler.ts';
import type { ProcessDefinition } from '../../src/lib/features/corex/process-definition.ts';
import type { CorexControlPlane, CorexPublishCommand } from './corex-router.ts';

type CorexControlPlaneOptions = {
	url: string;
	publishableKey: string;
	serviceRoleKey: string;
	fetcher?: typeof fetch;
	workflow?: {
		create(options: {
			id: string;
			params: { runId: string; ownerUserId: string; plan: unknown; input: unknown };
		}): Promise<unknown>;
		get(id: string): Promise<{
			sendEvent(options: { type: string; payload: unknown }): Promise<void>;
		}>;
	};
	createId?: () => string;
};

type SupabaseUser = { id?: unknown };
type PublishedVersion = { id?: unknown; version?: unknown };
type StartedRun = {
	id?: unknown;
	workflowInstanceId?: unknown;
	status?: unknown;
	definition?: unknown;
};
type OwnedRun = { workflow_instance_id?: unknown; status?: unknown };
type ApprovalDecision = { workflowInstanceId?: unknown; payload?: unknown };

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
	if (declaredLength > MAX_RESPONSE_BYTES) throw new CorexControlPlaneError('Upstream response is too large.', 502);
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

export function createSupabaseCorexControlPlane(options: CorexControlPlaneOptions): CorexControlPlane {
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
		const user = await readJson(userResponse) as SupabaseUser;
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
			const published = await readJson(publishResponse) as PublishedVersion;
			if (typeof published.id !== 'string' || !Number.isSafeInteger(published.version)) {
				throw new CorexControlPlaneError('Publish returned an invalid version.', 502);
			}
			return { id: published.id, version: published.version as number };
		},
		async start(command) {
			if (!options.workflow) throw new CorexControlPlaneError('Workflow binding is unavailable.', 503);
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
			const run = await readJson(runResponse) as StartedRun;
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
		async signal(command) {
			if (!options.workflow) throw new CorexControlPlaneError('Workflow binding is unavailable.', 503);
			const ownerUserId = await verifyUser(command.accessToken);
			if (command.type === 'corex-approval') {
				if (typeof command.payload !== 'object' || command.payload === null || Array.isArray(command.payload)) {
					throw new CorexControlPlaneError('Approval decision is invalid.', 400);
				}
				const decision = (command.payload as Record<string, unknown>).decision;
				const comment = (command.payload as Record<string, unknown>).comment;
				if (!['approved', 'rejected'].includes(String(decision)) || (comment !== undefined && typeof comment !== 'string')) {
					throw new CorexControlPlaneError('Approval decision is invalid.', 400);
				}
				const decisionResponse = await fetcher(`${baseUrl}/rest/v1/rpc/corex_decide_approval_task`, {
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
				});
				if (!decisionResponse.ok) throw new CorexControlPlaneError('Approval task cannot be decided.', 409);
				const approved = await readJson(decisionResponse) as ApprovalDecision;
				if (typeof approved.workflowInstanceId !== 'string' || typeof approved.payload !== 'object' || approved.payload === null) {
					throw new CorexControlPlaneError('Approval task returned invalid data.', 502);
				}
				try {
					const instance = await options.workflow.get(approved.workflowInstanceId);
					await instance.sendEvent({ type: 'corex-approval', payload: approved.payload });
				} catch {
					throw new CorexControlPlaneError('Workflow event could not be sent.', 409);
				}
				return { accepted: true as const };
			}
			const query = new URLSearchParams({
				select: 'workflow_instance_id,status',
				id: `eq.${command.runId}`,
				owner_user_id: `eq.${ownerUserId}`,
				limit: '1'
			});
			const runResponse = await fetcher(`${baseUrl}/rest/v1/corex_runs?${query}`, {
				headers: {
					Authorization: `Bearer ${options.serviceRoleKey}`,
					apikey: options.serviceRoleKey
				}
			});
			if (!runResponse.ok) throw new CorexControlPlaneError('Could not load the run.', 502);
			const rows = await readJson(runResponse);
			const run = Array.isArray(rows) ? rows[0] as OwnedRun | undefined : undefined;
			if (!run || typeof run.workflow_instance_id !== 'string') {
				throw new CorexControlPlaneError('Run not found.', 404);
			}
			if (run.status === 'complete' || run.status === 'errored' || run.status === 'terminated') {
				throw new CorexControlPlaneError('Run cannot accept events.', 409);
			}
			try {
				const instance = await options.workflow.get(run.workflow_instance_id);
				await instance.sendEvent({ type: command.type, payload: command.payload });
			} catch {
				throw new CorexControlPlaneError('Workflow event could not be sent.', 409);
			}
			return { accepted: true as const };
		}
	};
}