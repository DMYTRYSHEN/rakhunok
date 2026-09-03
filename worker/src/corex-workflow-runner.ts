import {
	executeCorexWorkflow,
	recordCorexRunEvent,
	recordCorexStepAttempt,
	type CorexActiveApproval,
	type CorexActiveWait,
	type CorexInvokeProcessStep,
	type CorexWorkflowParams
} from './corex-runtime.ts';
import { compileProcessDefinition } from '../../src/lib/features/corex/process-compiler.ts';
import type { ProcessDefinition } from '../../src/lib/features/corex/process-definition.ts';

type WorkflowInstance = {
	status(): Promise<{ status: string }>;
	terminate(options?: { rollback?: boolean }): Promise<void>;
	sendEvent(event: { type: string; payload: unknown }): Promise<void>;
};

type WorkflowBinding = {
	create(options: { id: string; params: CorexWorkflowParams }): Promise<unknown>;
	get(id: string): Promise<WorkflowInstance>;
};

type CorexWorkflowEnv = {
	SUPABASE_URL: string;
	SUPABASE_SERVICE_ROLE_KEY: string;
	COREX_PROCESS_WORKFLOW: WorkflowBinding;
	COREX_OUTPUTS?: Pick<R2Bucket, 'get' | 'put' | 'delete'>;
};

type StartedSubprocess = {
	id?: unknown;
	workflowInstanceId?: unknown;
	parentWorkflowInstanceId?: unknown;
	status?: unknown;
	definition?: unknown;
	created?: unknown;
};

async function readJson(response: Response): Promise<unknown> {
	if (!response.ok) throw new Error('Could not create the subprocess run.');
	return response.json();
}

async function readExecutionGeneration(
	controlPlane: { url: string; serviceRoleKey: string },
	runId: string,
	ownerUserId: string,
	fetcher: typeof fetch
): Promise<number> {
	const response = await fetcher(
		`${controlPlane.url.replace(/\/+$/, '')}/rest/v1/rpc/corex_get_run_execution_generation`,
		{
			method: 'POST',
			headers: {
				Authorization: `Bearer ${controlPlane.serviceRoleKey}`,
				apikey: controlPlane.serviceRoleKey,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ p_run_id: runId, p_owner_user_id: ownerUserId })
		}
	);
	if (!response.ok) throw new Error('Could not read the run execution generation.');
	const generation: unknown = await response.json();
	if (!Number.isSafeInteger(generation) || Number(generation) < 1) {
		throw new Error('Run execution generation is invalid.');
	}
	return Number(generation);
}

async function failQueuedRun(
	controlPlane: { url: string; serviceRoleKey: string },
	runId: string,
	ownerUserId: string,
	fetcher: typeof fetch
): Promise<void> {
	try {
		await fetcher(`${controlPlane.url.replace(/\/+$/, '')}/rest/v1/rpc/corex_fail_process_run`, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${controlPlane.serviceRoleKey}`,
				apikey: controlPlane.serviceRoleKey,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				p_run_id: runId,
				p_owner_user_id: ownerUserId,
				p_error: { code: 'workflow_create_failed' }
			})
		});
	} catch {
		// Preserve the Workflow creation error when compensation is unavailable.
	}
}

export async function runCorexProcessWorkflow(
	env: CorexWorkflowEnv,
	payload: CorexWorkflowParams,
	workflow: Parameters<typeof executeCorexWorkflow>[1],
	dependencies: { fetcher?: typeof fetch; createId?: () => string } = {}
): Promise<unknown> {
	const fetcher = dependencies.fetcher ?? fetch;
	const createId = dependencies.createId ?? (() => crypto.randomUUID());
	const controlPlane = { url: env.SUPABASE_URL, serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY };
	const executionGeneration = await readExecutionGeneration(
		controlPlane,
		payload.runId,
		payload.ownerUserId,
		fetcher
	);
	const startSubprocess = async (
		step: CorexInvokeProcessStep,
		input: unknown,
		parent: Pick<CorexWorkflowParams, 'runId' | 'ownerUserId'> & { invocationKey: string }
	): Promise<{ childRunId: string; workflowInstanceId: string }> => {
		const workflowInstanceId = createId();
		const invocationKey = Array.from(
			new Uint8Array(
				await crypto.subtle.digest('SHA-256', new TextEncoder().encode(parent.invocationKey))
			),
			(byte) => byte.toString(16).padStart(2, '0')
		).join('');
		const response = await fetcher(
			`${controlPlane.url.replace(/\/+$/, '')}/rest/v1/rpc/corex_start_subprocess_run`,
			{
				method: 'POST',
				headers: {
					Authorization: `Bearer ${controlPlane.serviceRoleKey}`,
					apikey: controlPlane.serviceRoleKey,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					p_process_id: step.config.processId,
					p_owner_user_id: parent.ownerUserId,
					p_parent_run_id: parent.runId,
					p_parent_step_id: invocationKey,
					p_workflow_instance_id: workflowInstanceId,
					p_input: input
				})
			}
		);
		const run = (await readJson(response)) as StartedSubprocess;
		if (
			typeof run.id !== 'string' ||
			typeof run.workflowInstanceId !== 'string' ||
			typeof run.parentWorkflowInstanceId !== 'string' ||
			typeof run.status !== 'string' ||
			typeof run.definition !== 'object' ||
			run.definition === null ||
			typeof run.created !== 'boolean'
		)
			throw new Error('Subprocess command returned invalid data.');
		if (run.status !== 'queued') throw new Error('Subprocess run cannot be started.');
		const compilation = compileProcessDefinition(run.definition as ProcessDefinition);
		if (!compilation.ok) throw new Error('Published subprocess is not executable.');
		const existing = run.created
			? null
			: await env.COREX_PROCESS_WORKFLOW.get(run.workflowInstanceId);
		const shouldCreate = run.created || (await existing!.status()).status === 'unknown';
		if (shouldCreate) {
			try {
				await env.COREX_PROCESS_WORKFLOW.create({
					id: run.workflowInstanceId,
					params: {
						runId: run.id,
						workflowInstanceId: run.workflowInstanceId,
						ownerUserId: parent.ownerUserId,
						plan: compilation.plan,
						input,
						parent: {
							runId: parent.runId,
							workflowInstanceId: run.parentWorkflowInstanceId,
							stepId: step.id
						}
					}
				});
			} catch (error) {
				await failQueuedRun(controlPlane, run.id, parent.ownerUserId, fetcher);
				throw error;
			}
		}
		return { childRunId: run.id, workflowInstanceId: run.workflowInstanceId };
	};
	const terminateSubprocess = async (
		step: CorexInvokeProcessStep,
		child: { childRunId: string; workflowInstanceId: string },
		parent: Pick<CorexWorkflowParams, 'runId' | 'ownerUserId'> & { invocationKey: string }
	): Promise<void> => {
		const invocationKey = Array.from(
			new Uint8Array(
				await crypto.subtle.digest('SHA-256', new TextEncoder().encode(parent.invocationKey))
			),
			(byte) => byte.toString(16).padStart(2, '0')
		).join('');
		const instance = await env.COREX_PROCESS_WORKFLOW.get(child.workflowInstanceId);
		const terminalStatuses = new Set(['complete', 'errored', 'terminated', 'unknown']);
		const initialStatus = (await instance.status()).status;
		if (!terminalStatuses.has(initialStatus)) {
			try {
				await instance.terminate({ rollback: true });
			} catch (error) {
				if (!terminalStatuses.has((await instance.status()).status)) throw error;
			}
		}
		const response = await fetcher(
			`${controlPlane.url.replace(/\/+$/, '')}/rest/v1/rpc/corex_terminate_subprocess_run`,
			{
				method: 'POST',
				headers: {
					Authorization: `Bearer ${controlPlane.serviceRoleKey}`,
					apikey: controlPlane.serviceRoleKey,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					p_run_id: child.childRunId,
					p_owner_user_id: parent.ownerUserId,
					p_parent_run_id: parent.runId,
					p_parent_step_id: invocationKey,
					p_workflow_instance_id: child.workflowInstanceId
				})
			}
		);
		if (!response.ok) throw new Error('Could not terminate the subprocess run.');
	};
	const registerActiveWait = async (wait: CorexActiveWait): Promise<void> => {
		const response = await fetcher(
			`${controlPlane.url.replace(/\/+$/, '')}/rest/v1/rpc/corex_register_active_wait`,
			{
				method: 'POST',
				headers: {
					Authorization: `Bearer ${controlPlane.serviceRoleKey}`,
					apikey: controlPlane.serviceRoleKey,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					p_run_id: wait.runId,
					p_owner_user_id: wait.ownerUserId,
					p_execution_generation: wait.executionGeneration,
					p_step_id: wait.stepId,
					p_visit: wait.visit,
					p_event_type: wait.eventType,
					p_wait_event_type: wait.waitEventType,
					p_durable_step_name: wait.durableStepName
				})
			}
		);
		if (!response.ok) throw new Error('Could not register the active wait.');
	};
	const completeActiveWait = async (
		wait: Pick<
			CorexActiveWait,
			'runId' | 'ownerUserId' | 'executionGeneration' | 'stepId' | 'visit'
		>
	): Promise<void> => {
		const response = await fetcher(
			`${controlPlane.url.replace(/\/+$/, '')}/rest/v1/rpc/corex_complete_active_wait`,
			{
				method: 'POST',
				headers: {
					Authorization: `Bearer ${controlPlane.serviceRoleKey}`,
					apikey: controlPlane.serviceRoleKey,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					p_run_id: wait.runId,
					p_owner_user_id: wait.ownerUserId,
					p_execution_generation: wait.executionGeneration,
					p_step_id: wait.stepId,
					p_visit: wait.visit
				})
			}
		);
		if (!response.ok) throw new Error('Could not complete the active wait.');
	};
	const registerActiveApproval = async (approval: CorexActiveApproval): Promise<void> => {
		const response = await fetcher(
			`${controlPlane.url.replace(/\/+$/, '')}/rest/v1/rpc/corex_register_active_approval`,
			{
				method: 'POST',
				headers: {
					Authorization: `Bearer ${controlPlane.serviceRoleKey}`,
					apikey: controlPlane.serviceRoleKey,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					p_run_id: approval.runId,
					p_owner_user_id: approval.ownerUserId,
					p_execution_generation: approval.executionGeneration,
					p_step_id: approval.stepId,
					p_visit: approval.visit,
					p_wait_event_type: approval.waitEventType,
					p_durable_step_name: approval.durableStepName,
					p_assignee_user_id: approval.assigneeUserId,
					p_timeout_ms: approval.timeoutMs
				})
			}
		);
		if (!response.ok) throw new Error('Could not register the active approval.');
	};

	return executeCorexWorkflow(
		payload,
		workflow,
		(runEvent) => recordCorexRunEvent(controlPlane, runEvent, fetcher),
		fetcher,
		startSubprocess,
		terminateSubprocess,
		executionGeneration,
		(stepAttempt) => recordCorexStepAttempt(controlPlane, stepAttempt, fetcher),
		registerActiveWait,
		completeActiveWait,
		registerActiveApproval,
		env.COREX_OUTPUTS
			? async ({ key, body, contentType }) => {
					await env.COREX_OUTPUTS!.put(key, body, { httpMetadata: { contentType } });
				}
			: undefined
	);
}
