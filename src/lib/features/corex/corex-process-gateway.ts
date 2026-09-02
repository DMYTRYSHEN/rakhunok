import type { SupabaseClient } from '@supabase/supabase-js';
import type { ProcessDefinition, ProcessLifecycle } from './process-definition';

type ProcessRow = {
	id: string;
	owner_user_id: string;
	slug: string;
	name: string;
	description: string;
	lifecycle: ProcessLifecycle;
	revision: number;
	draft_definition: ProcessDefinition;
	published_version: number | null;
	updated_at: string;
};

type ProcessVersionRow = {
	id: string;
	process_id: string;
	version: number;
	definition: ProcessDefinition;
	definition_sha256: string;
	published_at: string;
};

type RunRow = {
	id: string;
	process_id: string;
	process_version_id: string;
	workflow_instance_id: string;
	parent_run_id: string | null;
	parent_step_id: string | null;
	depth: number;
	execution_generation: number;
	status: string;
	input: unknown;
	output: unknown | null;
	error: unknown | null;
	rollback_outcome: 'complete' | 'failed' | null;
	rollback_error: unknown | null;
	archived_at: string | null;
	started_at: string | null;
	finished_at: string | null;
	created_at: string;
};

type RunEventRow = {
	id: number;
	run_id: string;
	execution_generation: number;
	sequence: number;
	event_type: string;
	step_name: string | null;
	attempt: number | null;
	payload: unknown;
	created_at: string;
};

type StepAttemptRow = {
	run_id: string;
	execution_generation: number;
	step_id: string;
	visit: number;
	durable_step_name: string;
	kind: 'forward' | 'compensation';
	attempt: number;
	started_at: string;
	finished_at: string;
	outcome: 'complete' | 'failed';
	retry: { limit: number; backoff: 'constant' | 'linear' | 'exponential'; timeoutMs: number };
	output:
		| {
				status: number;
				contentType: string | null;
				bytes: number;
				value?: unknown;
				truncated?: true;
			}
		| { type: 'object'; bytes: number; value?: unknown; truncated?: true }
		| { type: 'none' | 'redacted' }
		| null;
	error: {
		code:
			| 'http_action_failed'
			| 'transform_step_failed'
			| 'wait_event_failed'
			| 'approval_failed'
			| 'subprocess_failed';
	} | null;
};

type ApprovalTaskRow = {
	id: string;
	run_id: string;
	process_id: string;
	execution_generation: number;
	step_name: string;
	status: 'pending' | 'approved' | 'rejected' | 'expired';
	deadline_at: string;
	decision_comment: string | null;
	decided_at: string | null;
	created_at: string;
};

export type CorexProcess = {
	id: string;
	ownerUserId: string;
	slug: string;
	name: string;
	description: string;
	lifecycle: ProcessLifecycle;
	revision: number;
	draftDefinition: ProcessDefinition;
	publishedVersion: number | null;
	updatedAt: string;
};

export type CorexProcessVersion = {
	id: string;
	processId: string;
	version: number;
	definition: ProcessDefinition;
	definitionSha256: string;
	publishedAt: string;
};

export type CorexRun = {
	id: string;
	processId: string;
	processVersionId: string;
	workflowInstanceId: string;
	parentRunId: string | null;
	parentStepId: string | null;
	depth: number;
	executionGeneration: number;
	status: string;
	input: unknown;
	output: unknown | null;
	error: unknown | null;
	rollbackOutcome: 'complete' | 'failed' | null;
	rollbackError: unknown | null;
	archivedAt: string | null;
	startedAt: string | null;
	finishedAt: string | null;
	createdAt: string;
};

export type CorexRunEvent = {
	id: number;
	runId: string;
	executionGeneration: number;
	sequence: number;
	eventType: string;
	stepName: string | null;
	attempt: number | null;
	payload: unknown;
	createdAt: string;
};

export type CorexStepAttempt = {
	runId: string;
	executionGeneration: number;
	stepId: string;
	visit: number;
	durableStepName: string;
	kind: StepAttemptRow['kind'];
	attempt: number;
	startedAt: string;
	finishedAt: string;
	outcome: StepAttemptRow['outcome'];
	retry: StepAttemptRow['retry'];
	output: StepAttemptRow['output'];
	error: StepAttemptRow['error'];
};

export type CorexApprovalTask = {
	id: string;
	runId: string;
	processId: string;
	executionGeneration: number;
	stepName: string;
	status: ApprovalTaskRow['status'];
	deadlineAt: string;
	decisionComment: string | null;
	decidedAt: string | null;
	createdAt: string;
};

export class CorexDraftConflictError extends Error {
	constructor() {
		super('Corex draft revision conflict');
		this.name = 'CorexDraftConflictError';
	}
}

function mapProcess(row: ProcessRow): CorexProcess {
	return {
		id: row.id,
		ownerUserId: row.owner_user_id,
		slug: row.slug,
		name: row.name,
		description: row.description,
		lifecycle: row.lifecycle,
		revision: row.revision,
		draftDefinition: row.draft_definition,
		publishedVersion: row.published_version,
		updatedAt: row.updated_at
	};
}

export function createCorexProcessGateway(client: SupabaseClient) {
	return {
		async listProcesses(ownerUserId: string): Promise<CorexProcess[]> {
			const { data, error } = await client
				.from('corex_processes')
				.select(
					'id, owner_user_id, slug, name, description, lifecycle, revision, draft_definition, published_version, updated_at'
				)
				.eq('owner_user_id', ownerUserId)
				.order('updated_at', { ascending: false });
			if (error) throw error;
			return ((data ?? []) as ProcessRow[]).map(mapProcess);
		},

		async createProcess(
			ownerUserId: string,
			slug: string,
			definition: ProcessDefinition
		): Promise<CorexProcess> {
			const { data, error } = await client
				.from('corex_processes')
				.insert({
					owner_user_id: ownerUserId,
					slug,
					name: definition.name,
					description: definition.description,
					draft_definition: definition
				})
				.select(
					'id, owner_user_id, slug, name, description, lifecycle, revision, draft_definition, published_version, updated_at'
				)
				.single();
			if (error) throw error;
			return mapProcess(data as ProcessRow);
		},

		async saveDraft(process: CorexProcess, definition: ProcessDefinition): Promise<CorexProcess> {
			const { data, error } = await client
				.from('corex_processes')
				.update({
					name: definition.name,
					description: definition.description,
					draft_definition: definition
				})
				.eq('id', process.id)
				.eq('owner_user_id', process.ownerUserId)
				.eq('revision', process.revision)
				.select(
					'id, owner_user_id, slug, name, description, lifecycle, revision, draft_definition, published_version, updated_at'
				)
				.maybeSingle();
			if (error) {
				throw error;
			}
			if (!data) throw new CorexDraftConflictError();
			return mapProcess(data as ProcessRow);
		},

		async listVersions(processId: string, ownerUserId: string): Promise<CorexProcessVersion[]> {
			const { data, error } = await client
				.from('corex_process_versions')
				.select('id, process_id, version, definition, definition_sha256, published_at')
				.eq('process_id', processId)
				.eq('owner_user_id', ownerUserId)
				.order('version', { ascending: false });
			if (error) throw error;
			return ((data ?? []) as ProcessVersionRow[]).map((row) => ({
				id: row.id,
				processId: row.process_id,
				version: row.version,
				definition: row.definition,
				definitionSha256: row.definition_sha256,
				publishedAt: row.published_at
			}));
		},

		async listRuns(processId: string): Promise<CorexRun[]> {
			const { data, error } = await client
				.from('corex_runs')
				.select(
					'id, process_id, process_version_id, workflow_instance_id, parent_run_id, parent_step_id, depth, execution_generation, status, input, output, error, rollback_outcome, rollback_error, archived_at, started_at, finished_at, created_at'
				)
				.eq('process_id', processId)
				.order('created_at', { ascending: false });
			if (error) throw error;
			return ((data ?? []) as RunRow[]).map((row) => ({
				id: row.id,
				processId: row.process_id,
				processVersionId: row.process_version_id,
				workflowInstanceId: row.workflow_instance_id,
				parentRunId: row.parent_run_id,
				parentStepId: row.parent_step_id,
				depth: row.depth,
				executionGeneration: row.execution_generation,
				status: row.status,
				input: row.input,
				output: row.output,
				error: row.error,
				rollbackOutcome: row.rollback_outcome,
				rollbackError: row.rollback_error,
				archivedAt: row.archived_at,
				startedAt: row.started_at,
				finishedAt: row.finished_at,
				createdAt: row.created_at
			}));
		},

		async listRunEvents(runId: string): Promise<CorexRunEvent[]> {
			const { data, error } = await client
				.from('corex_run_events')
				.select(
					'id, run_id, execution_generation, sequence, event_type, step_name, attempt, payload, created_at'
				)
				.eq('run_id', runId)
				.order('execution_generation', { ascending: true })
				.order('sequence', { ascending: true });
			if (error) throw error;
			return ((data ?? []) as RunEventRow[]).map((row) => ({
				id: row.id,
				runId: row.run_id,
				executionGeneration: row.execution_generation,
				sequence: row.sequence,
				eventType: row.event_type,
				stepName: row.step_name,
				attempt: row.attempt,
				payload: row.payload,
				createdAt: row.created_at
			}));
		},

		async listStepAttempts(runId: string): Promise<CorexStepAttempt[]> {
			const { data, error } = await client
				.from('corex_step_attempts')
				.select(
					'run_id, execution_generation, step_id, visit, durable_step_name, kind, attempt, started_at, finished_at, outcome, retry, output, error'
				)
				.eq('run_id', runId)
				.order('execution_generation', { ascending: true })
				.order('started_at', { ascending: true })
				.order('attempt', { ascending: true });
			if (error) throw error;
			return ((data ?? []) as StepAttemptRow[]).map((row) => ({
				runId: row.run_id,
				executionGeneration: row.execution_generation,
				stepId: row.step_id,
				visit: row.visit,
				durableStepName: row.durable_step_name,
				kind: row.kind,
				attempt: row.attempt,
				startedAt: row.started_at,
				finishedAt: row.finished_at,
				outcome: row.outcome,
				retry: row.retry,
				output: row.output,
				error: row.error
			}));
		},

		async listApprovalTasks(assigneeUserId: string): Promise<CorexApprovalTask[]> {
			const { data, error } = await client
				.from('corex_approval_tasks')
				.select(
					'id, run_id, process_id, execution_generation, step_name, status, deadline_at, decision_comment, decided_at, created_at'
				)
				.eq('assignee_user_id', assigneeUserId)
				.order('created_at', { ascending: false });
			if (error) throw error;
			return ((data ?? []) as ApprovalTaskRow[]).map((row) => ({
				id: row.id,
				runId: row.run_id,
				processId: row.process_id,
				executionGeneration: row.execution_generation,
				stepName: row.step_name,
				status: row.status,
				deadlineAt: row.deadline_at,
				decisionComment: row.decision_comment,
				decidedAt: row.decided_at,
				createdAt: row.created_at
			}));
		}
	};
}

export type CorexProcessGateway = ReturnType<typeof createCorexProcessGateway>;
