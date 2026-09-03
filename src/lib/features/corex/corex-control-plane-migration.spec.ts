import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
	fileURLToPath(
		new URL('../../../../supabase/migrations/202608300001_corex_control_plane.sql', import.meta.url)
	),
	'utf8'
).toLowerCase();
const approvalMigration = readFileSync(
	fileURLToPath(
		new URL(
			'../../../../supabase/migrations/202608310001_corex_approval_tasks.sql',
			import.meta.url
		)
	),
	'utf8'
).toLowerCase();
const subprocessMigration = readFileSync(
	fileURLToPath(
		new URL(
			'../../../../supabase/migrations/202608310002_corex_subprocess_runs.sql',
			import.meta.url
		)
	),
	'utf8'
).toLowerCase();
const subprocessTerminationMigration = readFileSync(
	fileURLToPath(
		new URL(
			'../../../../supabase/migrations/202608310003_corex_subprocess_termination.sql',
			import.meta.url
		)
	),
	'utf8'
).toLowerCase();
const cancellationMigration = readFileSync(
	fileURLToPath(
		new URL(
			'../../../../supabase/migrations/202608310004_corex_run_cancellation.sql',
			import.meta.url
		)
	),
	'utf8'
).toLowerCase();
const approvalOutboxMigration = readFileSync(
	fileURLToPath(
		new URL(
			'../../../../supabase/migrations/202608310005_corex_approval_outbox.sql',
			import.meta.url
		)
	),
	'utf8'
).toLowerCase();
const externalEventOutboxMigration = readFileSync(
	fileURLToPath(
		new URL(
			'../../../../supabase/migrations/202609010001_corex_external_event_outbox.sql',
			import.meta.url
		)
	),
	'utf8'
).toLowerCase();
const parentCallbackOutboxMigration = readFileSync(
	fileURLToPath(
		new URL(
			'../../../../supabase/migrations/202609010002_corex_parent_callback_outbox.sql',
			import.meta.url
		)
	),
	'utf8'
).toLowerCase();
const stepAttemptsMigration = readFileSync(
	fileURLToPath(
		new URL(
			'../../../../supabase/migrations/20260901083622_corex_step_attempts.sql',
			import.meta.url
		)
	),
	'utf8'
).toLowerCase();
const stepAttemptKindMigration = readFileSync(
	fileURLToPath(
		new URL(
			'../../../../supabase/migrations/20260902092723_corex_step_attempt_kind.sql',
			import.meta.url
		)
	),
	'utf8'
).toLowerCase();
const runRetentionMigration = readFileSync(
	fileURLToPath(
		new URL('../../../../supabase/migrations/202609030001_corex_run_retention.sql', import.meta.url)
	),
	'utf8'
).toLowerCase();
const operationsMigration = readFileSync(
	fileURLToPath(
		new URL('../../../../supabase/migrations/202609030015_corex_operations.sql', import.meta.url)
	),
	'utf8'
).toLowerCase();
const operationExecutionMigration = readFileSync(
	fileURLToPath(
		new URL(
			'../../../../supabase/migrations/202609030016_corex_operation_execution.sql',
			import.meta.url
		)
	),
	'utf8'
).toLowerCase();
const publishedHttpTriggersMigration = readFileSync(
	fileURLToPath(
		new URL(
			'../../../../supabase/migrations/202609030002_corex_published_http_triggers.sql',
			import.meta.url
		)
	),
	'utf8'
).toLowerCase();
const httpTriggerLifecycleMigration = readFileSync(
	fileURLToPath(
		new URL(
			'../../../../supabase/migrations/202609030003_corex_http_trigger_lifecycle.sql',
			import.meta.url
		)
	),
	'utf8'
).toLowerCase();
const httpTriggerLifecycleIdempotencyMigration = readFileSync(
	fileURLToPath(
		new URL(
			'../../../../supabase/migrations/202609030004_corex_http_trigger_lifecycle_idempotency.sql',
			import.meta.url
		)
	),
	'utf8'
).toLowerCase();
const httpRouteOwnershipMigration = readFileSync(
	fileURLToPath(
		new URL(
			'../../../../supabase/migrations/202609030005_corex_http_route_ownership.sql',
			import.meta.url
		)
	),
	'utf8'
).toLowerCase();
const httpRouteReconciliationMigration = readFileSync(
	fileURLToPath(
		new URL(
			'../../../../supabase/migrations/202609030006_corex_http_route_reconciliation.sql',
			import.meta.url
		)
	),
	'utf8'
).toLowerCase();
const publishedTriggerRegistryMigration = readFileSync(
	fileURLToPath(
		new URL(
			'../../../../supabase/migrations/202609030007_corex_published_trigger_registry.sql',
			import.meta.url
		)
	),
	'utf8'
).toLowerCase();
const canonicalTriggerPublicationMigration = readFileSync(
	fileURLToPath(
		new URL(
			'../../../../supabase/migrations/202609030008_corex_canonical_trigger_publication.sql',
			import.meta.url
		)
	),
	'utf8'
).toLowerCase();
const environmentNamespaceAllocationMigration = readFileSync(
	fileURLToPath(
		new URL(
			'../../../../supabase/migrations/202609030009_corex_environment_namespace_allocation.sql',
			import.meta.url
		)
	),
	'utf8'
).toLowerCase();
const environmentNamespaceRetirementMigration = readFileSync(
	fileURLToPath(
		new URL(
			'../../../../supabase/migrations/202609030010_corex_environment_namespace_retirement.sql',
			import.meta.url
		)
	),
	'utf8'
).toLowerCase();
const domainTargetSelectionMigration = readFileSync(
	fileURLToPath(
		new URL(
			'../../../../supabase/migrations/202609030011_corex_domain_target_selection.sql',
			import.meta.url
		)
	),
	'utf8'
).toLowerCase();
const domainScopedPublicationMigration = readFileSync(
	fileURLToPath(
		new URL(
			'../../../../supabase/migrations/202609030012_corex_domain_scoped_publication.sql',
			import.meta.url
		)
	),
	'utf8'
).toLowerCase();
const domainTargetConfigurationMigration = readFileSync(
	fileURLToPath(
		new URL(
			'../../../../supabase/migrations/202609030013_corex_domain_target_configuration.sql',
			import.meta.url
		)
	),
	'utf8'
).toLowerCase();
const outboxDeadLettersMigration = readFileSync(
	fileURLToPath(
		new URL(
			'../../../../supabase/migrations/202609010003_corex_outbox_dead_letters.sql',
			import.meta.url
		)
	),
	'utf8'
).toLowerCase();
const runReconciliationMigration = readFileSync(
	fileURLToPath(
		new URL(
			'../../../../supabase/migrations/202609010004_corex_run_reconciliation.sql',
			import.meta.url
		)
	),
	'utf8'
).toLowerCase();
const waitEventCorrelationMigration = readFileSync(
	fileURLToPath(
		new URL(
			'../../../../supabase/migrations/202609010005_corex_wait_event_correlation.sql',
			import.meta.url
		)
	),
	'utf8'
).toLowerCase();
const waitingForPauseStatusMigration = readFileSync(
	fileURLToPath(
		new URL(
			'../../../../supabase/migrations/202609010006_corex_waiting_for_pause_status.sql',
			import.meta.url
		)
	),
	'utf8'
).toLowerCase();
const pauseResumeMigration = readFileSync(
	fileURLToPath(
		new URL(
			'../../../../supabase/migrations/202609010007_corex_run_pause_resume.sql',
			import.meta.url
		)
	),
	'utf8'
).toLowerCase();
const cancelWaitingForPauseMigration = readFileSync(
	fileURLToPath(
		new URL(
			'../../../../supabase/migrations/202609010008_corex_cancel_waiting_for_pause.sql',
			import.meta.url
		)
	),
	'utf8'
).toLowerCase();
const runRestartMigration = readFileSync(
	fileURLToPath(
		new URL('../../../../supabase/migrations/202609010009_corex_run_restart.sql', import.meta.url)
	),
	'utf8'
).toLowerCase();
const targetedWaitEventsMigration = readFileSync(
	fileURLToPath(
		new URL(
			'../../../../supabase/migrations/20260902100000_corex_targeted_wait_events.sql',
			import.meta.url
		)
	),
	'utf8'
).toLowerCase();
const rollingBackStatusMigration = readFileSync(
	fileURLToPath(
		new URL(
			'../../../../supabase/migrations/202609010010_corex_rolling_back_status.sql',
			import.meta.url
		)
	),
	'utf8'
).toLowerCase();
const runRollbackMigration = readFileSync(
	fileURLToPath(
		new URL('../../../../supabase/migrations/202609010011_corex_run_rollback.sql', import.meta.url)
	),
	'utf8'
).toLowerCase();
const runArchiveMigration = readFileSync(
	fileURLToPath(
		new URL('../../../../supabase/migrations/202609010012_corex_run_archive.sql', import.meta.url)
	),
	'utf8'
).toLowerCase();
const processRetirementMigration = readFileSync(
	fileURLToPath(
		new URL(
			'../../../../supabase/migrations/202609030014_corex_process_retirement.sql',
			import.meta.url
		)
	),
	'utf8'
).toLowerCase();

describe('Corex control-plane migration', () => {
	it('models bounded asynchronous operations and privileged process deletion', () => {
		expect(operationsMigration).toContain('create table public.corex_privileged_operators');
		expect(operationsMigration).toContain('create table public.corex_process_legal_holds');
		expect(operationsMigration).toContain('create table public.corex_operations');
		expect(operationsMigration).toContain('create table public.corex_operation_items');
		expect(operationsMigration).toContain('item_count between 1 and 100');
		expect(operationsMigration).toContain('unique (owner_user_id, request_id)');
		expect(operationsMigration).toContain('operator.can_delete_processes');
		expect(operationsMigration).toContain("target_process.lifecycle <> 'retired'");
		expect(operationsMigration).toContain('hold.released_at is null');
		expect(operationsMigration).toContain('for update skip locked');
		expect(operationsMigration).toContain('process_run_count > 99');
		expect(operationsMigration).toContain("'action', 'run_cleanup'");
		expect(operationsMigration).toContain("item.payload ->> 'action' <> 'process_finalize'");
		expect(operationsMigration).toContain("dependency.payload ->> 'action' = 'process_finalize'");
		expect(operationsMigration).toContain("error_code = 'dependency_failed'");
		expect(operationsMigration).toContain("'itemcount', existing_operation.item_count");
		expect(operationsMigration).toContain(
			'grant execute on function public.corex_submit_process_deletion(uuid, uuid, uuid, uuid) to service_role'
		);
	});

	it('finalizes destructive deletion only through a live authorized claim', () => {
		expect(operationExecutionMigration).toContain('corex.deletion_claim_token');
		expect(operationExecutionMigration).toContain('authorized_process_deletion(old.process_id)');
		expect(operationExecutionMigration).toContain('operator.expires_at > now()');
		expect(operationExecutionMigration).toContain('hold.released_at is null');
		expect(operationExecutionMigration).toContain("target_process.lifecycle <> 'retired'");
		expect(operationExecutionMigration).toContain('delete from public.corex_runs');
		expect(operationExecutionMigration).toContain('corex_process_deletion_tombstones');
		expect(operationExecutionMigration).toContain('jsonb_array_length(p_items)');
		expect(operationExecutionMigration).toContain('item_count not between 1 and 100');
		expect(operationExecutionMigration).toContain("p_kind in ('run_terminate', 'workflow_delete')");
		expect(operationExecutionMigration).toContain(
			"coalesce(item -> 'payload', '{}'::jsonb) <> '{}'::jsonb"
		);
		expect(operationExecutionMigration).toContain("payload ->> 'action' = 'process_finalize'");
		expect(operationExecutionMigration).toContain('dependency.ordinal < target_item.ordinal');
		expect(operationExecutionMigration).toContain("dependency.status <> 'complete'");
	});
	it('creates RLS-protected approval tasks with an assignee-only decision RPC', () => {
		expect(approvalMigration).toContain('create table public.corex_approval_tasks');
		expect(approvalMigration).toContain('assignee_user_id = (select auth.uid())');
		expect(approvalMigration).toContain('and assignee_user_id = p_actor_user_id');
		expect(approvalMigration).toContain('for update;');
		expect(approvalMigration).toContain("target_task.status = 'pending'");
		expect(approvalMigration).toContain(
			'grant execute on function public.corex_decide_approval_task(uuid, uuid, text, text) to service_role'
		);
		expect(approvalMigration).not.toContain('security definer');
	});

	it('creates tasks from approval lifecycle events and supports waiting transitions', () => {
		expect(approvalMigration).toContain("new.payload ->> 'steptype' <> 'approval'");
		expect(approvalMigration).toContain('on conflict (run_id, step_name) do nothing');
		expect(approvalMigration).toContain(
			"target_run.status = 'running' and p_status in ('waiting', 'complete', 'errored')"
		);
		expect(approvalMigration).toContain(
			"target_run.status = 'waiting' and p_status in ('running', 'errored')"
		);
	});

	it('links subprocess runs to one parent step with a bounded depth', () => {
		expect(subprocessMigration).toContain(
			'parent_run_id uuid references public.corex_runs(id) on delete restrict'
		);
		expect(subprocessMigration).toContain('create unique index corex_runs_parent_step_idx');
		expect(subprocessMigration).toContain('on public.corex_runs (parent_run_id, parent_step_id)');
		expect(subprocessMigration).toContain(
			'depth integer not null default 0 check (depth between 0 and 8)'
		);
		expect(subprocessMigration).toContain('if parent_run.depth >= 8 then');
		expect(subprocessMigration).toContain('parent_run.depth + 1');
	});

	it('starts owner-scoped subprocesses from immutable published versions idempotently', () => {
		expect(subprocessMigration).toContain(
			'create or replace function public.corex_start_subprocess_run('
		);
		expect(subprocessMigration).toContain('and owner_user_id = p_owner_user_id');
		expect(subprocessMigration).toContain("parent_run.status not in ('running', 'waiting')");
		expect(subprocessMigration).toContain('where parent_run_id = parent_run.id');
		expect(subprocessMigration).toContain('and parent_step_id = p_parent_step_id');
		expect(subprocessMigration).toContain('target_process.published_version');
		expect(subprocessMigration).toContain('where id = child_run.process_version_id');
		expect(subprocessMigration).not.toContain('p_definition');
		expect(subprocessMigration).not.toContain('p_execution_plan');
	});

	it('keeps subprocess creation service-role-only without definer privileges', () => {
		expect(subprocessMigration).toContain(
			'revoke all on function public.corex_start_subprocess_run(uuid, uuid, uuid, text, text, jsonb) from public, anon, authenticated'
		);
		expect(subprocessMigration).toContain(
			'grant execute on function public.corex_start_subprocess_run(uuid, uuid, uuid, text, text, jsonb) to service_role'
		);
		expect(subprocessMigration).not.toContain('security definer');
	});

	it('terminates only the exact active subprocess through a service-role-only function', () => {
		expect(subprocessTerminationMigration).toContain(
			'create or replace function public.corex_terminate_subprocess_run('
		);
		expect(subprocessTerminationMigration).toContain('and owner_user_id = p_owner_user_id');
		expect(subprocessTerminationMigration).toContain('and parent_run_id = p_parent_run_id');
		expect(subprocessTerminationMigration).toContain('and parent_step_id = p_parent_step_id');
		expect(subprocessTerminationMigration).toContain(
			'and workflow_instance_id = p_workflow_instance_id'
		);
		expect(subprocessTerminationMigration).toContain('for update;');
		expect(subprocessTerminationMigration).toContain(
			"child_run.status in ('queued', 'running', 'waiting', 'paused')"
		);
		expect(subprocessTerminationMigration).toContain("set status = 'terminated'");
		expect(subprocessTerminationMigration).toContain('finished_at = coalesce(finished_at, now())');
		expect(subprocessTerminationMigration).toContain(
			'error = \'{"code":"parent_wait_failed"}\'::jsonb'
		);
		expect(subprocessTerminationMigration).not.toContain('p_reason');
		expect(subprocessTerminationMigration).toContain(
			'grant execute on function public.corex_terminate_subprocess_run(uuid, uuid, uuid, text, text) to service_role'
		);
		expect(subprocessTerminationMigration).toContain(
			'revoke all on function public.corex_terminate_subprocess_run(uuid, uuid, uuid, text, text) from public, anon, authenticated'
		);
		expect(subprocessTerminationMigration).not.toContain('security definer');
	});

	it('atomically cancels an owned run tree and records durable termination intents', () => {
		expect(cancellationMigration).toContain('create table public.corex_outbox');
		expect(cancellationMigration).toContain('create table public.corex_run_cancellation_requests');
		expect(cancellationMigration).toContain(
			'create or replace function public.corex_request_run_cancellation('
		);
		expect(cancellationMigration).toContain('with recursive run_tree as');
		expect(cancellationMigration).toContain('order by run.depth desc');
		expect(cancellationMigration).toContain(
			"target_run.status in ('queued', 'running', 'waiting', 'paused')"
		);
		expect(cancellationMigration).toContain("'terminate_workflow:' || target_run.id::text");
		expect(cancellationMigration).toContain('on conflict (semantic_key) do nothing');
		expect(cancellationMigration).toContain('error = \'{"code":"run_cancelled"}\'::jsonb');
		expect(cancellationMigration).toContain('primary key (owner_user_id, request_id)');
		expect(cancellationMigration).toContain(
			'grant execute on function public.corex_request_run_cancellation(uuid, uuid, uuid) to service_role'
		);
		expect(cancellationMigration).not.toContain('security definer');
	});

	it('serializes subprocess creation and cancellation across the entire lineage', () => {
		expect(cancellationMigration).toContain(
			'create or replace function public.corex_start_subprocess_run('
		);
		expect(cancellationMigration.match(/pg_advisory_xact_lock/g)).toHaveLength(2);
		expect(cancellationMigration).toContain('hashtextextended(lineage_root_id::text, 0)');
		expect(cancellationMigration.match(/select \* into existing_request/g)).toHaveLength(2);
		expect(cancellationMigration).toContain("parent_run.status not in ('running', 'waiting')");
	});

	it('leases outbox work with stale-worker protection and bounded retries', () => {
		expect(cancellationMigration).toContain('for update skip locked');
		expect(cancellationMigration).toContain('claim_token = gen_random_uuid()');
		expect(cancellationMigration).toContain('and claim_token = p_claim_token');
		expect(cancellationMigration).toContain('and lease_expires_at > now()');
		expect(cancellationMigration).toContain("last_error = jsonb_build_object('code'");
		expect(cancellationMigration).toContain(
			'grant execute on function public.corex_claim_outbox(integer, integer) to service_role'
		);
		expect(cancellationMigration).toContain(
			'grant execute on function public.corex_ack_outbox(uuid, uuid) to service_role'
		);
		expect(cancellationMigration).toContain(
			'grant execute on function public.corex_fail_outbox(uuid, uuid, jsonb) to service_role'
		);
	});

	it('dead-letters the eighth failed delivery and excludes it from future claims', () => {
		expect(outboxDeadLettersMigration).toContain('add column dead_lettered_at timestamptz');
		expect(outboxDeadLettersMigration).toContain('and dead_lettered_at is null');
		expect(outboxDeadLettersMigration).toContain('and attempts < 8');
		expect(outboxDeadLettersMigration).toContain(
			'dead_lettered_at = case when attempts >= 8 then now() else null end'
		);
		expect(outboxDeadLettersMigration).toContain(
			"'deadlettered', failed_item.dead_lettered_at is not null"
		);
		expect(outboxDeadLettersMigration).toContain(
			'where delivered_at is null and dead_lettered_at is null'
		);
	});

	it('retries owner-scoped dead letters and exposes aggregate outbox health only to service role', () => {
		expect(outboxDeadLettersMigration).toContain(
			'create or replace function public.corex_retry_outbox('
		);
		expect(outboxDeadLettersMigration).toContain('and owner_user_id = p_owner_user_id');
		expect(outboxDeadLettersMigration).toContain('and dead_lettered_at is not null');
		expect(outboxDeadLettersMigration).toContain('set attempts = 0');
		expect(outboxDeadLettersMigration).toContain(
			'create or replace function public.corex_get_outbox_health()'
		);
		expect(outboxDeadLettersMigration).toContain("'pendingcount', count(*) filter");
		expect(outboxDeadLettersMigration).toContain("'deadletteredcount', count(*) filter");
		expect(outboxDeadLettersMigration).toContain("'oldestpendingat', min(created_at) filter");
		expect(outboxDeadLettersMigration).toContain(
			'revoke all on function public.corex_retry_outbox(uuid, uuid) from public, anon, authenticated'
		);
		expect(outboxDeadLettersMigration).toContain(
			'revoke all on function public.corex_get_outbox_health() from public, anon, authenticated'
		);
		expect(outboxDeadLettersMigration).toContain(
			'grant execute on function public.corex_retry_outbox(uuid, uuid) to service_role'
		);
		expect(outboxDeadLettersMigration).toContain(
			'grant execute on function public.corex_get_outbox_health() to service_role'
		);
		expect(outboxDeadLettersMigration).not.toContain('security definer');
	});

	it('leases stale queued runs for bounded service-role-only workflow reconciliation', () => {
		expect(runReconciliationMigration).toContain(
			'create or replace function public.corex_claim_queued_run_reconciliation('
		);
		expect(runReconciliationMigration).toContain('for update skip locked');
		expect(runReconciliationMigration).toContain(
			'run.created_at <= now() - make_interval(secs => p_grace_seconds)'
		);
		expect(runReconciliationMigration).toContain(
			'workflow_reconcile_claim_token = gen_random_uuid()'
		);
		expect(runReconciliationMigration).toContain(
			'and workflow_reconcile_claim_token = p_claim_token'
		);
		expect(runReconciliationMigration).toContain('and workflow_reconcile_lease_expires_at > now()');
		expect(runReconciliationMigration).toContain('workflow_reconcile_attempts < 8');
		expect(runReconciliationMigration).toContain(
			"'deadlettered', failed_run.workflow_reconcile_dead_lettered_at is not null"
		);
		expect(runReconciliationMigration).toContain(
			'create or replace function public.corex_get_run_reconciliation_health()'
		);
		expect(runReconciliationMigration).toContain(
			'grant execute on function public.corex_claim_queued_run_reconciliation(integer, integer, integer) to service_role'
		);
		expect(runReconciliationMigration).toContain(
			'revoke all on function public.corex_claim_queued_run_reconciliation(integer, integer, integer) from public, anon, authenticated'
		);
		expect(runReconciliationMigration).not.toContain('security definer');
	});

	it('correlates external and approval delivery to the exact active durable wait', () => {
		expect(waitEventCorrelationMigration).toContain("target_run.status <> 'waiting'");
		expect(waitEventCorrelationMigration.match(/active_wait\.id is null/g)).toHaveLength(2);
		expect(waitEventCorrelationMigration).toContain("active_wait.event_type <> 'step_started'");
		expect(waitEventCorrelationMigration).toContain(
			"active_wait.payload ->> 'steptype' <> 'wait-event'"
		);
		expect(waitEventCorrelationMigration).toContain(
			"active_wait.payload ->> 'eventtype' <> p_event_type"
		);
		expect(waitEventCorrelationMigration).toContain(
			"wait_event_type := active_wait.payload ->> 'waiteventtype'"
		);
		expect(waitEventCorrelationMigration).toContain(
			"active_wait.payload ->> 'steptype' <> 'approval'"
		);
		expect(waitEventCorrelationMigration).toContain(
			"jsonb_build_object('type', wait_event_type, 'payload'"
		);
		expect(waitEventCorrelationMigration).toContain(
			'revoke all on function public.corex_enqueue_workflow_event(uuid, uuid, uuid, text, jsonb) from public, anon, authenticated'
		);
		expect(waitEventCorrelationMigration).toContain(
			'grant execute on function public.corex_decide_approval_task(uuid, uuid, text, text) to service_role'
		);
		expect(waitEventCorrelationMigration).not.toContain('security definer');
	});

	it('targets an external event to one active wait step', () => {
		expect(targetedWaitEventsMigration).toContain('create table public.corex_active_waits');
		expect(targetedWaitEventsMigration).toContain(
			'primary key (run_id, execution_generation, step_id, visit)'
		);
		expect(targetedWaitEventsMigration).toContain(
			'create function public.corex_register_active_wait('
		);
		expect(targetedWaitEventsMigration).toContain(
			'create function public.corex_complete_active_wait('
		);
		expect(targetedWaitEventsMigration).toContain("status = 'active'");
		expect(targetedWaitEventsMigration).toContain('add column step_id text');
		expect(targetedWaitEventsMigration).toContain(
			'create function public.corex_enqueue_workflow_event('
		);
		expect(targetedWaitEventsMigration).toContain('p_step_id text');
		expect(targetedWaitEventsMigration).toContain(
			'existing_request.step_id is distinct from p_step_id'
		);
		expect(targetedWaitEventsMigration).toContain('from public.corex_active_waits wait');
		expect(targetedWaitEventsMigration).toContain('wait.step_id = p_step_id');
		expect(targetedWaitEventsMigration).toContain("active_wait.status <> 'active'");
		expect(targetedWaitEventsMigration).toContain(
			'grant execute on function public.corex_enqueue_workflow_event(uuid, uuid, uuid, text, text, jsonb)'
		);
		expect(targetedWaitEventsMigration).toContain(
			'drop function public.corex_decide_approval_task(uuid, uuid, text, text)'
		);
		expect(targetedWaitEventsMigration).toContain('p_task_id uuid');
		expect(targetedWaitEventsMigration).toContain('where id = p_task_id');
		expect(targetedWaitEventsMigration).toContain(
			'create function public.corex_register_active_approval('
		);
		expect(targetedWaitEventsMigration).toContain('perform public.corex_register_active_wait(');
		expect(targetedWaitEventsMigration).toContain(
			'on conflict (run_id, execution_generation, step_id, visit)'
		);
		expect(targetedWaitEventsMigration).toContain("and wait.event_type = 'approval'");
		expect(targetedWaitEventsMigration).toContain('wait.visit = target_task.visit');
		expect(targetedWaitEventsMigration).toContain("set status = 'expired'");
		expect(targetedWaitEventsMigration).toContain(
			'grant execute on function public.corex_decide_approval_task(uuid, uuid, uuid, text, text)'
		);
		expect(targetedWaitEventsMigration).not.toContain('security definer');
	});

	it('records pause and resume as idempotent durable lifecycle intents', () => {
		expect(waitingForPauseStatusMigration).toContain(
			"alter type public.corex_run_status add value if not exists 'waiting_for_pause'"
		);
		expect(pauseResumeMigration).toContain('create table public.corex_run_lifecycle_requests');
		expect(pauseResumeMigration).toContain("command in ('pause', 'resume')");
		expect(pauseResumeMigration).toContain('primary key (owner_user_id, request_id)');
		expect(pauseResumeMigration.match(/select \* into existing_request/g)).toHaveLength(2);
		expect(pauseResumeMigration).toContain("target_run.status not in ('running', 'waiting')");
		expect(pauseResumeMigration).toContain("next_status := 'waiting_for_pause'");
		expect(pauseResumeMigration).toContain("target_run.status <> 'paused'");
		expect(pauseResumeMigration).toContain("p_command || '_workflow'");
		expect(pauseResumeMigration).toContain("'payload', payload");
		expect(pauseResumeMigration).toContain(
			'create or replace function public.corex_reconcile_lifecycle_outbox('
		);
		expect(pauseResumeMigration).toContain("p_workflow_status = 'waitingforpause'");
		expect(pauseResumeMigration).toContain("p_workflow_status = 'paused'");
		expect(pauseResumeMigration).toContain("p_workflow_status = 'running'");
		expect(pauseResumeMigration).toContain("status in ('waiting_for_pause', 'paused')");
		expect(pauseResumeMigration).toContain('and lease_expires_at > now()');
		expect(pauseResumeMigration).toContain("if p_workflow_status = 'waitingforpause' then");
		expect(pauseResumeMigration).toContain('set attempts = greatest(attempts - 1, 0)');
		expect(pauseResumeMigration).toContain("'delivered', false");
		expect(pauseResumeMigration).toContain("target_run.status = 'waiting_for_pause'");
		expect(pauseResumeMigration).toContain(
			"and p_status in ('running', 'waiting', 'complete', 'errored')"
		);
		expect(pauseResumeMigration).toContain(
			"when target_run.status = 'waiting_for_pause' and p_status in ('running', 'waiting')"
		);
		expect(pauseResumeMigration).toContain(
			'grant execute on function public.corex_request_run_lifecycle(uuid, uuid, uuid, text) to service_role'
		);
		expect(pauseResumeMigration).toContain(
			'grant execute on function public.corex_reconcile_lifecycle_outbox(uuid, uuid, text) to service_role'
		);
		expect(pauseResumeMigration).not.toContain('security definer');
	});

	it('cancels runs while a durable pause is converging', () => {
		expect(cancelWaitingForPauseMigration).toContain(
			'create or replace function public.corex_request_run_cancellation('
		);
		expect(cancelWaitingForPauseMigration.match(/select \* into existing_request/g)).toHaveLength(
			2
		);
		expect(cancelWaitingForPauseMigration).toContain('pg_advisory_xact_lock');
		expect(cancelWaitingForPauseMigration).toContain('with recursive run_tree as');
		expect(cancelWaitingForPauseMigration).toContain('order by run.depth desc');
		expect(
			cancelWaitingForPauseMigration.match(
				/root_run\.status in \('queued', 'running', 'waiting', 'waiting_for_pause', 'paused'\)/g
			)
		).toHaveLength(2);
		expect(cancelWaitingForPauseMigration).toContain(
			"target_run.status in ('queued', 'running', 'waiting', 'waiting_for_pause', 'paused')"
		);
		expect(cancelWaitingForPauseMigration).toContain(
			"'terminate_workflow:' || target_run.id::text"
		);
		expect(cancelWaitingForPauseMigration).toContain('on conflict (semantic_key) do nothing');
		expect(cancelWaitingForPauseMigration).toContain("'run_cancelled'");
		expect(cancelWaitingForPauseMigration).toContain(
			'grant execute on function public.corex_request_run_cancellation(uuid, uuid, uuid) to service_role'
		);
		expect(cancelWaitingForPauseMigration).not.toContain('security definer');
	});

	it('terminates an exactly correlated subprocess while its pause is converging', () => {
		expect(cancelWaitingForPauseMigration).toContain(
			'create or replace function public.corex_terminate_subprocess_run('
		);
		expect(cancelWaitingForPauseMigration).toContain('and owner_user_id = p_owner_user_id');
		expect(cancelWaitingForPauseMigration).toContain('and parent_run_id = p_parent_run_id');
		expect(cancelWaitingForPauseMigration).toContain('and parent_step_id = p_parent_step_id');
		expect(cancelWaitingForPauseMigration).toContain(
			'and workflow_instance_id = p_workflow_instance_id'
		);
		expect(cancelWaitingForPauseMigration).toContain(
			"child_run.status in ('queued', 'running', 'waiting', 'waiting_for_pause', 'paused')"
		);
		expect(cancelWaitingForPauseMigration).toContain(
			'error = \'{"code":"parent_wait_failed"}\'::jsonb'
		);
		expect(cancelWaitingForPauseMigration).toContain(
			'grant execute on function public.corex_terminate_subprocess_run(uuid, uuid, uuid, text, text) to service_role'
		);
	});

	it('restarts the same immutable Workflow instance with generation-safe history', () => {
		const restartRequestFunction = runRestartMigration.slice(
			runRestartMigration.indexOf('create or replace function public.corex_request_run_restart('),
			runRestartMigration.indexOf(
				'revoke all on function public.corex_request_run_restart(uuid, uuid, uuid, jsonb)'
			)
		);
		expect(runRestartMigration).toContain(
			'add column execution_generation integer not null default 1'
		);
		expect(runRestartMigration).toContain('drop constraint corex_run_events_run_id_sequence_key');
		expect(runRestartMigration).toContain('unique (run_id, execution_generation, sequence)');
		expect(runRestartMigration).toContain('create table public.corex_run_restart_requests');
		expect(runRestartMigration).toContain(
			'create or replace function public.corex_request_run_restart('
		);
		expect(restartRequestFunction.match(/select \* into existing_request/g)).toHaveLength(2);
		expect(runRestartMigration).toContain(
			"target_run.status not in ('complete', 'errored', 'terminated')"
		);
		expect(runRestartMigration).toContain("p_from ->> 'name'");
		expect(runRestartMigration).toContain("p_from ->> 'count'");
		expect(runRestartMigration).toContain("p_from ->> 'type'");
		expect(runRestartMigration).toContain("not in ('do', 'sleep', 'waitforevent')");
		expect(runRestartMigration).toContain(
			'execution_generation = target_run.execution_generation + 1'
		);
		expect(runRestartMigration).toContain('unique (run_id, execution_generation, step_name)');
		expect(runRestartMigration).toContain(
			'on conflict (run_id, execution_generation, step_name) do nothing'
		);
		expect(runRestartMigration).toContain("set status = 'expired'");
		expect(runRestartMigration).toContain(
			'create or replace function public.corex_get_run_execution_generation('
		);
		expect(runRestartMigration).toContain('create trigger corex_run_event_assigns_generation');
		expect(runRestartMigration).toContain(
			'and event.execution_generation = target_run.execution_generation'
		);
		expect(runRestartMigration).toContain(
			'and execution_generation = target_run.execution_generation'
		);
		expect(runRestartMigration).toContain("'restart_workflow'");
		expect(runRestartMigration).toContain("'run_restart_requested'");
		expect(runRestartMigration).toContain('target_run.workflow_instance_id');
		expect(runRestartMigration).not.toContain('target_process.published_version');
		expect(runRestartMigration).toContain(
			'grant execute on function public.corex_request_run_restart(uuid, uuid, uuid, jsonb) to service_role'
		);
		expect(runRestartMigration).not.toContain('security definer');
	});

	it('persists explicit rollback and reconciles the platform outcome', () => {
		expect(rollingBackStatusMigration).toContain(
			"alter type public.corex_run_status add value if not exists 'rolling_back'"
		);
		expect(runRollbackMigration).toContain('create table public.corex_run_rollback_requests');
		expect(runRollbackMigration).toContain('primary key (owner_user_id, request_id)');
		expect(runRollbackMigration.match(/select \* into existing_request/g)).toHaveLength(2);
		expect(runRollbackMigration).toContain("'status', target_run.status");
		expect(runRollbackMigration).toContain("'rollbackoutcome', target_run.rollback_outcome");
		expect(runRollbackMigration).toContain("'rollback_workflow'");
		expect(runRollbackMigration).toContain("set status = 'rolling_back'");
		expect(runRollbackMigration).toContain("'run_rollback_requested'");
		expect(runRollbackMigration).toContain(
			'create or replace function public.corex_reconcile_rollback_outbox('
		);
		expect(runRollbackMigration).toContain("p_workflow_status = 'running' and p_rollback is null");
		expect(runRollbackMigration).toContain("p_workflow_status <> 'terminated'");
		expect(runRollbackMigration).toContain(
			"p_rollback ->> 'outcome' not in ('complete', 'failed')"
		);
		expect(runRollbackMigration).toContain(
			"coalesce(p_rollback -> 'error', 'null'::jsonb) <> 'null'::jsonb"
		);
		expect(runRollbackMigration).toContain(
			"jsonb_typeof(p_rollback -> 'error' -> 'message') <> 'string'"
		);
		expect(runRollbackMigration).toContain("status = 'rolling_back'");
		expect(runRollbackMigration).toContain("'run_rollback_completed'");
		expect(runRollbackMigration).toContain("'run_rollback_failed'");
		expect(runRollbackMigration).toContain('set attempts = greatest(attempts - 1, 0)');
		expect(runRollbackMigration).toContain('payload || \'{"platformaccepted":true}\'::jsonb');
		expect(runRollbackMigration).toContain(
			'grant execute on function public.corex_request_run_rollback(uuid, uuid, uuid) to service_role'
		);
		expect(runRollbackMigration).toContain(
			'grant execute on function public.corex_reconcile_rollback_outbox(uuid, uuid, text, jsonb, boolean) to service_role'
		);
		expect(runRollbackMigration).not.toContain('security definer');
	});

	it('archives only terminal runs without changing their execution status', () => {
		expect(runArchiveMigration).toContain('add column archived_at timestamptz');
		expect(runArchiveMigration).toContain('corex_runs_archived_terminal_check');
		expect(runArchiveMigration).toContain(
			"archived_at is null or status in ('complete', 'errored', 'terminated')"
		);
		expect(runArchiveMigration).toContain('create table public.corex_run_archive_requests');
		expect(runArchiveMigration).toContain('primary key (owner_user_id, request_id)');
		expect(runArchiveMigration.match(/select \* into existing_request/g)).toHaveLength(2);
		expect(runArchiveMigration).toContain(
			"target_run.status not in ('complete', 'errored', 'terminated')"
		);
		expect(runArchiveMigration).toContain('set archived_at = coalesce(archived_at, now())');
		expect(runArchiveMigration).toContain("'status', target_run.status");
		expect(runArchiveMigration).toContain("'run_archived'");
		expect(runArchiveMigration).not.toContain('delete from public.corex_runs');
		expect(runArchiveMigration).not.toContain('corex_outbox');
		expect(runArchiveMigration).toContain(
			'grant execute on function public.corex_request_run_archive(uuid, uuid, uuid) to service_role'
		);
		expect(runArchiveMigration).not.toContain('security definer');
	});

	it('retires a process without deleting immutable versions or run history', () => {
		expect(processRetirementMigration).toContain('add column retired_at timestamptz');
		expect(processRetirementMigration).toContain(
			'create table public.corex_process_retirement_requests'
		);
		expect(processRetirementMigration).toContain('primary key (owner_user_id, request_id)');
		expect(processRetirementMigration.match(/select \* into existing_request/g)).toHaveLength(2);
		expect(processRetirementMigration).toContain(
			"old.lifecycle = 'retired' and new.lifecycle <> 'retired'"
		);
		expect(processRetirementMigration).toContain("process.lifecycle = 'published'");
		expect(processRetirementMigration).toContain('delete from public.corex_active_http_routes');
		expect(processRetirementMigration).toContain("set lifecycle = 'retired'");
		expect(processRetirementMigration).toContain(
			'grant execute on function public.corex_retire_process(uuid, uuid, uuid) to service_role'
		);
		expect(processRetirementMigration).not.toContain('delete from public.corex_process_versions');
		expect(processRetirementMigration).not.toContain('delete from public.corex_runs');
		expect(processRetirementMigration).not.toContain('security definer');
	});

	it('purges retained archived leaf runs through leased service-role jobs', () => {
		expect(runRetentionMigration).toContain('create table public.corex_run_purge_jobs');
		expect(runRetentionMigration).toContain("reason text not null check (reason = 'retention')");
		expect(runRetentionMigration).toContain(
			'run.archived_at <= now() - make_interval(days => p_retention_days)'
		);
		expect(runRetentionMigration).toContain(
			'not exists (select 1 from public.corex_runs child where child.parent_run_id = run.id)'
		);
		expect(runRetentionMigration).toContain("active_wait.status = 'active'");
		expect(runRetentionMigration).toContain('outbox.delivered_at is null');
		expect(runRetentionMigration).toContain("attempt.output #>> '{external,key}'");
		expect(runRetentionMigration).toContain('for update skip locked');
		expect(runRetentionMigration).toContain('target_job.claim_token <> p_claim_token');
		expect(runRetentionMigration).toContain(
			'delete from public.corex_runs where id = target_job.run_id'
		);
		expect(runRetentionMigration).toContain("status = 'complete'");
		expect(runRetentionMigration).toContain(
			'grant execute on function public.corex_claim_retention_purges(integer, integer, integer) to service_role'
		);
		expect(runRetentionMigration).not.toContain('references public.corex_runs');
		expect(runRetentionMigration).not.toContain('security definer');
	});

	it('decides approvals and enqueues their workflow event atomically', () => {
		expect(approvalOutboxMigration).toContain(
			'create or replace function public.corex_decide_approval_task('
		);
		expect(approvalOutboxMigration).toContain('for update;');
		expect(approvalOutboxMigration).toContain("'workflow_event:approval:' || target_task.id::text");
		expect(approvalOutboxMigration).toContain("event.payload ->> 'stepid'");
		expect(approvalOutboxMigration).toContain("'type', 'corex-approval:' || target_step_id");
		expect(approvalOutboxMigration).toContain('on conflict (semantic_key) do nothing');
		expect(approvalOutboxMigration).toContain("return jsonb_build_object('accepted', true)");
		expect(approvalOutboxMigration).toContain("'payload', payload");
		expect(approvalOutboxMigration).not.toContain('security definer');
	});

	it('enqueues owner-scoped external events with replay equality and conflict detection', () => {
		expect(externalEventOutboxMigration).toContain(
			'create table public.corex_external_event_requests'
		);
		expect(externalEventOutboxMigration).toContain('primary key (owner_user_id, event_id)');
		expect(externalEventOutboxMigration).toContain(
			'create or replace function public.corex_enqueue_workflow_event('
		);
		expect(externalEventOutboxMigration).toContain("lower(p_event_type) like 'corex-%'");
		expect(externalEventOutboxMigration).toContain('existing_request.run_id <> p_run_id');
		expect(externalEventOutboxMigration).toContain('existing_request.event_type <> p_event_type');
		expect(externalEventOutboxMigration).toContain(
			"existing_request.payload <> coalesce(p_payload, 'null'::jsonb)"
		);
		expect(externalEventOutboxMigration).toContain(
			'get diagnostics inserted_request_count = row_count'
		);
		expect(externalEventOutboxMigration).toContain('if inserted_request_count = 0 then');
		expect(externalEventOutboxMigration).toContain("errcode = 'pt404'");
		expect(externalEventOutboxMigration).toContain("errcode = 'pt409'");
		expect(externalEventOutboxMigration).toContain(
			"target_run.status not in ('running', 'waiting', 'paused')"
		);
		expect(externalEventOutboxMigration).toContain(
			"'workflow_event:external:' || p_owner_user_id::text || ':' || p_event_id::text"
		);
		expect(externalEventOutboxMigration).toContain('on conflict (semantic_key) do nothing');
		expect(externalEventOutboxMigration).toContain(
			'grant execute on function public.corex_enqueue_workflow_event(uuid, uuid, uuid, text, jsonb) to service_role'
		);
		expect(externalEventOutboxMigration).not.toContain('security definer');
	});

	it('atomically enqueues one parent callback when a subprocess becomes terminal', () => {
		expect(parentCallbackOutboxMigration).toContain(
			'create or replace function public.corex_record_run_event('
		);
		expect(parentCallbackOutboxMigration).toContain('for update;');
		expect(parentCallbackOutboxMigration).toContain(
			"target_run.parent_run_id is not null and p_status in ('complete', 'errored')"
		);
		expect(parentCallbackOutboxMigration).toContain("'parent_callback:' || target_run.id::text");
		expect(parentCallbackOutboxMigration).toContain("'parent_callback'");
		expect(parentCallbackOutboxMigration).toContain('parent_run.workflow_instance_id');
		expect(parentCallbackOutboxMigration).toContain(
			"'type', 'corex-subprocess-result:' || target_run.id::text"
		);
		expect(parentCallbackOutboxMigration).toContain('on conflict (semantic_key) do nothing');
		expect(parentCallbackOutboxMigration).toContain(
			'grant execute on function public.corex_record_run_event(uuid, uuid, integer, public.corex_run_status, text, text, jsonb, jsonb, jsonb) to service_role'
		);
		expect(parentCallbackOutboxMigration).not.toContain('security definer');
	});

	it('saves browser drafts through RLS and column-level grants without a definer RPC', () => {
		expect(migration).toContain('grant update (name, description, draft_definition)');
		expect(migration).toContain('owners update corex processes');
		expect(migration).not.toContain('security definer');
		expect(migration).not.toContain('corex_save_process_draft');
	});

	it('publishes only the locked saved revision through a service-role-only function', () => {
		expect(migration).toContain('create or replace function public.corex_publish_process(');
		expect(migration).toContain('for update;');
		expect(migration).toContain('target_process.revision <> p_expected_revision');
		expect(migration).toContain(
			'grant execute on function public.corex_publish_process(uuid, uuid, bigint) to service_role'
		);
		expect(migration).toContain(
			'revoke all on function public.corex_publish_process(uuid, uuid, bigint) from public, anon, authenticated'
		);
		expect(migration).not.toContain('p_definition');
	});

	it('claims domain-neutral HTTP routes atomically while publishing immutable versions', () => {
		expect(publishedHttpTriggersMigration).toContain(
			'create table public.corex_published_triggers'
		);
		expect(publishedHttpTriggersMigration).toContain(
			'create table public.corex_active_http_routes'
		);
		expect(publishedHttpTriggersMigration).toContain(
			'primary key (route_namespace, http_method, route_path)'
		);
		expect(publishedHttpTriggersMigration).toContain("route_namespace constant text := 'default'");
		expect(publishedHttpTriggersMigration).toContain("where node ->> 'type' = 'trigger-http'");
		expect(publishedHttpTriggersMigration).toContain('delete from public.corex_active_http_routes');
		expect(publishedHttpTriggersMigration).toContain('insert into public.corex_active_http_routes');
		expect(publishedHttpTriggersMigration).toContain(
			"raise exception 'corex http route conflict' using errcode = '23505'"
		);
		expect(publishedHttpTriggersMigration).toContain(
			'create trigger corex_published_triggers_immutable'
		);
		expect(publishedHttpTriggersMigration).not.toContain('hostname');
		expect(publishedHttpTriggersMigration).not.toContain('domain');
		expect(publishedHttpTriggersMigration).not.toContain('security definer');
	});

	it('registers immutable non-HTTP trigger descriptors against published versions', () => {
		expect(publishedTriggerRegistryMigration).toContain(
			'create table public.corex_published_trigger_registrations'
		);
		expect(publishedTriggerRegistryMigration).toContain(
			"kind text not null check (kind in ('webhook', 'schedule', 'internal_event', 'queue'))"
		);
		expect(publishedTriggerRegistryMigration).toContain(
			'foreign key (process_version_id, process_id, owner_user_id)'
		);
		expect(publishedTriggerRegistryMigration).toContain(
			'unique (process_version_id, kind, trigger_key)'
		);
		expect(publishedTriggerRegistryMigration).toContain(
			'create trigger corex_published_trigger_registrations_immutable'
		);
		expect(publishedTriggerRegistryMigration).toContain(
			'create or replace function public.corex_register_published_trigger('
		);
		expect(publishedTriggerRegistryMigration).toContain('for key share');
		expect(publishedTriggerRegistryMigration).toContain(
			"jsonb_typeof(p_configuration) <> 'object'"
		);
		expect(publishedTriggerRegistryMigration).toContain('jsonb_path_exists');
		expect(publishedTriggerRegistryMigration).toContain(
			'existing_registration.configuration_sha256 <> configuration_fingerprint'
		);
		expect(publishedTriggerRegistryMigration).toContain("using errcode = 'pt409'");
		expect(publishedTriggerRegistryMigration).toContain(
			'grant execute on function public.corex_register_published_trigger(uuid, uuid, text, text, jsonb) to service_role'
		);
		expect(publishedTriggerRegistryMigration).not.toContain('hostname');
		expect(publishedTriggerRegistryMigration).not.toContain('domain');
		expect(publishedTriggerRegistryMigration).not.toContain('security definer');
	});

	it('extracts canonical trigger descriptors atomically during publication', () => {
		expect(canonicalTriggerPublicationMigration).toContain(
			'create or replace function public.corex_publish_process('
		);
		expect(canonicalTriggerPublicationMigration).toContain(
			"where node ->> 'type' in ('trigger-http', 'trigger-schedule', 'trigger-event')"
		);
		expect(canonicalTriggerPublicationMigration).toContain(
			"raise exception 'corex publish requires exactly one trigger'"
		);
		expect(canonicalTriggerPublicationMigration).toContain("if trigger_type = 'trigger-http' then");
		expect(canonicalTriggerPublicationMigration).toContain(
			'perform public.corex_register_published_trigger('
		);
		expect(canonicalTriggerPublicationMigration).toContain("'schedule'");
		expect(canonicalTriggerPublicationMigration).toContain("'queue'");
		expect(canonicalTriggerPublicationMigration).toContain("'internal_event'");
		expect(canonicalTriggerPublicationMigration).toContain("'database-webhook'");
		expect(canonicalTriggerPublicationMigration).toContain(
			'delete from public.corex_active_http_routes'
		);
		expect(canonicalTriggerPublicationMigration).not.toContain('hostname');
		expect(canonicalTriggerPublicationMigration).not.toContain('domain');
		expect(canonicalTriggerPublicationMigration).not.toContain('security definer');
	});

	it('allocates owner-scoped environments and route namespaces without domain semantics', () => {
		expect(environmentNamespaceAllocationMigration).toContain(
			'create or replace function public.corex_ensure_environment('
		);
		expect(environmentNamespaceAllocationMigration).toContain(
			'create or replace function public.corex_ensure_route_namespace('
		);
		expect(environmentNamespaceAllocationMigration).toContain(
			'normalized_environment_key text := lower(trim(p_environment_key))'
		);
		expect(environmentNamespaceAllocationMigration).toContain(
			'normalized_route_namespace text := lower(trim(p_route_namespace))'
		);
		expect(environmentNamespaceAllocationMigration).toContain(
			'on conflict (owner_user_id, environment_key) do nothing'
		);
		expect(environmentNamespaceAllocationMigration).toContain(
			'on conflict (environment_id, route_namespace) do nothing'
		);
		expect(environmentNamespaceAllocationMigration).toMatch(
			/where id = p_environment_id\s+and owner_user_id = p_owner_user_id\s+for key share/
		);
		expect(environmentNamespaceAllocationMigration).toContain(
			"raise exception 'corex environment not found' using errcode = 'p0002'"
		);
		expect(environmentNamespaceAllocationMigration).toContain(
			'grant execute on function public.corex_ensure_environment(uuid, text) to service_role'
		);
		expect(environmentNamespaceAllocationMigration).toContain(
			'grant execute on function public.corex_ensure_route_namespace(uuid, uuid, text) to service_role'
		);
		expect(environmentNamespaceAllocationMigration).not.toContain(
			'grant execute on function public.corex_ensure_environment(uuid, text) to authenticated'
		);
		expect(environmentNamespaceAllocationMigration).not.toContain('hostname');
		expect(environmentNamespaceAllocationMigration).not.toContain('domain');
		expect(environmentNamespaceAllocationMigration).not.toContain('security definer');
	});

	it('retires unused non-default environments and route namespaces without deleting history', () => {
		expect(environmentNamespaceRetirementMigration).toContain(
			"check (lifecycle in ('active', 'retired'))"
		);
		expect(environmentNamespaceRetirementMigration).toContain(
			'create or replace function public.corex_retire_route_namespace('
		);
		expect(environmentNamespaceRetirementMigration).toContain(
			'create or replace function public.corex_retire_environment('
		);
		expect(environmentNamespaceRetirementMigration).toContain(
			"raise exception 'corex default environment namespace cannot be retired' using errcode = 'pt403'"
		);
		expect(environmentNamespaceRetirementMigration).toContain(
			"raise exception 'corex default environment cannot be retired' using errcode = 'pt403'"
		);
		expect(environmentNamespaceRetirementMigration).toContain(
			'from public.corex_active_http_routes'
		);
		expect(environmentNamespaceRetirementMigration).toContain(
			"raise exception 'corex route namespace is in use' using errcode = 'pt409'"
		);
		expect(environmentNamespaceRetirementMigration).toMatch(
			/from public\.corex_route_namespaces\s+where environment_id = target_environment\.id\s+and lifecycle = 'active'/
		);
		expect(environmentNamespaceRetirementMigration).toContain(
			"raise exception 'corex environment is retired' using errcode = 'pt409'"
		);
		expect(environmentNamespaceRetirementMigration).toContain(
			"raise exception 'corex route namespace is retired' using errcode = 'pt409'"
		);
		expect(environmentNamespaceRetirementMigration).toContain(
			'grant execute on function public.corex_retire_route_namespace(uuid, uuid, text) to service_role'
		);
		expect(environmentNamespaceRetirementMigration).toContain(
			'grant execute on function public.corex_retire_environment(uuid, uuid) to service_role'
		);
		expect(environmentNamespaceRetirementMigration).toContain(
			'grant update (lifecycle, retired_at) on public.corex_environments to service_role'
		);
		expect(environmentNamespaceRetirementMigration).toContain(
			'grant update (lifecycle, retired_at) on public.corex_route_namespaces to service_role'
		);
		expect(environmentNamespaceRetirementMigration).not.toMatch(
			/delete from public\.corex_(environments|route_namespaces)/
		);
		expect(environmentNamespaceRetirementMigration).not.toContain('hostname');
		expect(environmentNamespaceRetirementMigration).not.toContain('domain');
		expect(environmentNamespaceRetirementMigration).not.toContain('security definer');
	});

	it('selects an explicit protected-aware domain target without claiming activation', () => {
		expect(domainTargetSelectionMigration).toContain('create table public.corex_domain_targets');
		expect(domainTargetSelectionMigration).toContain(
			'create table public.corex_environment_domain_targets'
		);
		expect(domainTargetSelectionMigration).toContain('unique (hostname)');
		expect(domainTargetSelectionMigration).toContain('environment_id uuid primary key');
		expect(domainTargetSelectionMigration).toContain('domain_target_id uuid not null unique');
		expect(domainTargetSelectionMigration).toContain(
			'foreign key (domain_target_id, owner_user_id)'
		);
		expect(domainTargetSelectionMigration).toContain(
			'create or replace function corex_private.is_protected_domain(p_hostname text)'
		);
		expect(domainTargetSelectionMigration).toContain("p_hostname = 'rakhunok.com'");
		expect(domainTargetSelectionMigration).toContain("p_hostname like '%.rakhunok.com'");
		expect(domainTargetSelectionMigration).toContain(
			"normalized_hostname text := rtrim(lower(trim(p_hostname)), '.')"
		);
		expect(domainTargetSelectionMigration).toContain(
			"raise exception 'corex domain is protected' using errcode = 'pt403'"
		);
		expect(domainTargetSelectionMigration).toContain(
			"raise exception 'corex domain target conflicts' using errcode = 'pt409'"
		);
		expect(domainTargetSelectionMigration).toContain(
			"raise exception 'corex environment domain already selected' using errcode = 'pt409'"
		);
		expect(domainTargetSelectionMigration).toContain(
			'grant execute on function public.corex_register_domain_target(uuid, text) to service_role'
		);
		expect(domainTargetSelectionMigration).toContain(
			'grant execute on function public.corex_select_environment_domain(uuid, uuid, uuid) to service_role'
		);
		expect(domainTargetSelectionMigration).not.toContain('dns');
		expect(domainTargetSelectionMigration).not.toContain('cloudflare');
		expect(domainTargetSelectionMigration).not.toContain('security definer');
	});

	it('pins HTTP publication to an explicitly selected environment domain', () => {
		expect(domainScopedPublicationMigration).toContain('add column domain_target_id uuid');
		expect(domainScopedPublicationMigration).toContain(
			'foreign key (domain_target_id, owner_user_id)'
		);
		expect(domainScopedPublicationMigration).toContain(
			"check (kind <> 'http' or domain_target_id is not null) not valid"
		);
		expect(domainScopedPublicationMigration).toContain(
			'revoke execute on function public.corex_publish_process(uuid, uuid, bigint) from service_role'
		);
		expect(domainScopedPublicationMigration).toContain('p_environment_id uuid');
		expect(domainScopedPublicationMigration).toContain('p_route_namespace text');
		expect(domainScopedPublicationMigration).toContain(
			'from public.corex_environment_domain_targets'
		);
		expect(domainScopedPublicationMigration).toContain(
			"raise exception 'corex environment domain is not selected' using errcode = 'pt409'"
		);
		expect(domainScopedPublicationMigration).toContain('target_domain_selection.domain_target_id');
		expect(domainScopedPublicationMigration).toContain(
			"raise exception 'corex published domain target conflicts' using errcode = 'pt409'"
		);
		expect(domainScopedPublicationMigration).toContain(
			'grant execute on function public.corex_publish_process(uuid, uuid, bigint, uuid, text)'
		);
		expect(domainScopedPublicationMigration).not.toContain('cloudflare');
		expect(domainScopedPublicationMigration).not.toContain('security definer');
	});

	it('configures an environment domain target atomically through one service-only RPC', () => {
		expect(domainTargetConfigurationMigration).toContain(
			'create or replace function public.corex_configure_domain_target('
		);
		expect(domainTargetConfigurationMigration).toContain(
			'target_environment := public.corex_ensure_environment('
		);
		expect(domainTargetConfigurationMigration).toContain(
			'target_namespace := public.corex_ensure_route_namespace('
		);
		expect(domainTargetConfigurationMigration).toContain(
			'target_domain := public.corex_register_domain_target('
		);
		expect(domainTargetConfigurationMigration).toContain(
			'domain_selection := public.corex_select_environment_domain('
		);
		expect(domainTargetConfigurationMigration).toContain("'environmentid'");
		expect(domainTargetConfigurationMigration).toContain("'routenamespace'");
		expect(domainTargetConfigurationMigration).toContain("'hostname'");
		expect(domainTargetConfigurationMigration).toContain("'verificationstatus'");
		expect(domainTargetConfigurationMigration).toContain(
			'grant execute on function public.corex_configure_domain_target(uuid, text, text, text)'
		);
		expect(domainTargetConfigurationMigration).not.toContain('cloudflare');
		expect(domainTargetConfigurationMigration).not.toContain('security definer');
	});

	it('deactivates and rolls back HTTP routes through locked service-only operations', () => {
		expect(httpTriggerLifecycleMigration).toContain(
			'create or replace function public.corex_deactivate_http_trigger('
		);
		expect(httpTriggerLifecycleMigration).toContain(
			'create or replace function public.corex_rollback_http_trigger('
		);
		expect(httpTriggerLifecycleMigration.match(/for update;/g)).toHaveLength(2);
		expect(httpTriggerLifecycleMigration).toContain('where process_id = target_process.id');
		expect(httpTriggerLifecycleMigration).toContain('where process_version_id = target_version.id');
		expect(httpTriggerLifecycleMigration).toContain('delete from public.corex_active_http_routes');
		expect(httpTriggerLifecycleMigration).toContain('insert into public.corex_active_http_routes');
		expect(httpTriggerLifecycleMigration).toContain(
			"raise exception 'corex http route conflict' using errcode = '23505'"
		);
		expect(httpTriggerLifecycleMigration).toContain(
			'grant execute on function public.corex_deactivate_http_trigger(uuid, uuid, integer) to service_role'
		);
		expect(httpTriggerLifecycleMigration).toContain(
			'grant execute on function public.corex_rollback_http_trigger(uuid, uuid, integer, integer) to service_role'
		);
		expect(httpTriggerLifecycleMigration).not.toContain('hostname');
		expect(httpTriggerLifecycleMigration).not.toContain('domain');
		expect(httpTriggerLifecycleMigration).not.toContain('security definer');
	});

	it('makes HTTP trigger lifecycle requests replayable and conflict-safe', () => {
		expect(httpTriggerLifecycleIdempotencyMigration).toContain(
			'create table public.corex_http_trigger_lifecycle_requests'
		);
		expect(httpTriggerLifecycleIdempotencyMigration).toContain(
			'primary key (owner_user_id, request_id)'
		);
		expect(httpTriggerLifecycleIdempotencyMigration).toContain(
			'alter table public.corex_http_trigger_lifecycle_requests enable row level security'
		);
		expect(httpTriggerLifecycleIdempotencyMigration).toContain(
			'revoke all on public.corex_http_trigger_lifecycle_requests from public, anon, authenticated'
		);
		expect(httpTriggerLifecycleIdempotencyMigration).toContain('p_request_id uuid');
		expect(httpTriggerLifecycleIdempotencyMigration).toContain('result jsonb');
		expect(httpTriggerLifecycleIdempotencyMigration).toContain('existing_request.result');
		expect(httpTriggerLifecycleIdempotencyMigration).toContain(
			"raise exception 'corex http trigger lifecycle request conflicts' using errcode = 'pt409'"
		);
		expect(httpTriggerLifecycleIdempotencyMigration).toContain(
			'grant execute on function public.corex_deactivate_http_trigger(uuid, uuid, uuid, integer) to service_role'
		);
		expect(httpTriggerLifecycleIdempotencyMigration).toContain(
			'grant execute on function public.corex_rollback_http_trigger(uuid, uuid, uuid, integer, integer) to service_role'
		);
		expect(httpTriggerLifecycleIdempotencyMigration).not.toContain('hostname');
		expect(httpTriggerLifecycleIdempotencyMigration).not.toContain('domain');
		expect(httpTriggerLifecycleIdempotencyMigration).not.toContain('security definer');
	});

	it('owns domain-neutral route namespaces by environment and rejects protected paths', () => {
		expect(httpRouteOwnershipMigration).toContain('create table public.corex_environments');
		expect(httpRouteOwnershipMigration).toContain('unique (owner_user_id, environment_key)');
		expect(httpRouteOwnershipMigration).toContain('create table public.corex_route_namespaces');
		expect(httpRouteOwnershipMigration).toContain('primary key (environment_id, route_namespace)');
		expect(httpRouteOwnershipMigration).toContain(
			'create or replace function corex_private.is_protected_http_route('
		);
		expect(httpRouteOwnershipMigration).toContain(
			"target_route_namespace constant text := 'default'"
		);
		expect(httpRouteOwnershipMigration).toContain(
			"target_environment_key constant text := 'default'"
		);
		expect(httpRouteOwnershipMigration).toContain(
			"raise exception 'corex http route is protected' using errcode = 'pt403'"
		);
		expect(httpRouteOwnershipMigration).toContain(
			'foreign key (environment_id, route_namespace, owner_user_id)'
		);
		expect(httpRouteOwnershipMigration).toContain(
			'create trigger corex_active_http_routes_prepare_ownership'
		);
		expect(httpRouteOwnershipMigration).toContain(
			'new.environment_id := published_trigger.environment_id'
		);
		expect(httpRouteOwnershipMigration).toContain(
			'new.owner_user_id := published_trigger.owner_user_id'
		);
		expect(httpRouteOwnershipMigration).toContain('on delete restrict');
		expect(httpRouteOwnershipMigration).toContain(
			'revoke all on public.corex_environments from public, anon, authenticated'
		);
		expect(httpRouteOwnershipMigration).toContain(
			'revoke all on public.corex_route_namespaces from public, anon, authenticated'
		);
		expect(httpRouteOwnershipMigration).not.toContain('hostname');
		expect(httpRouteOwnershipMigration).not.toContain('rakhunok.com');
		expect(httpRouteOwnershipMigration).not.toContain('security definer');
	});

	it('leases desired HTTP routes and records bounded observed reconciliation state', () => {
		expect(httpRouteReconciliationMigration).toContain(
			'create table public.corex_http_route_reconciliations'
		);
		expect(httpRouteReconciliationMigration).toContain(
			'primary key (environment_id, route_namespace, http_method, route_path)'
		);
		expect(httpRouteReconciliationMigration).toContain(
			'create or replace function public.corex_claim_http_route_reconciliation('
		);
		expect(httpRouteReconciliationMigration).toContain('for update skip locked');
		expect(httpRouteReconciliationMigration).toContain('claim_token = gen_random_uuid()');
		expect(httpRouteReconciliationMigration).toContain('where claim_token = p_claim_token');
		expect(httpRouteReconciliationMigration).toContain('and lease_expires_at > now()');
		expect(httpRouteReconciliationMigration).toContain('attempts < 8');
		expect(httpRouteReconciliationMigration).toContain("observed_status = 'converged'");
		expect(httpRouteReconciliationMigration).toContain(
			'observed_fingerprint = p_observed_fingerprint'
		);
		expect(httpRouteReconciliationMigration).toContain(
			'dead_lettered_at = case when attempts >= 8 then now() else null end'
		);
		expect(httpRouteReconciliationMigration).toContain(
			'create or replace function public.corex_get_http_route_reconciliation_health()'
		);
		expect(httpRouteReconciliationMigration).toContain(
			'grant execute on function public.corex_claim_http_route_reconciliation(integer, integer) to service_role'
		);
		expect(httpRouteReconciliationMigration).toContain(
			'grant execute on function public.corex_ack_http_route_reconciliation(uuid, text) to service_role'
		);
		expect(httpRouteReconciliationMigration).toContain(
			'grant execute on function public.corex_fail_http_route_reconciliation(uuid, jsonb) to service_role'
		);
		expect(httpRouteReconciliationMigration).toContain(
			'grant execute on function corex_private.set_http_route_reconciliation_desired(uuid, text, text, text, uuid, text, uuid)'
		);
		expect(httpRouteReconciliationMigration).not.toContain('hostname');
		expect(httpRouteReconciliationMigration).not.toContain('domain');
		expect(httpRouteReconciliationMigration).not.toContain('security definer');
	});

	it('starts runs only from the current immutable version through a service-role-only function', () => {
		expect(migration).toContain('create or replace function public.corex_start_process_run(');
		expect(migration).toContain('target_process.published_version is null');
		expect(migration).toContain('process_version_id');
		expect(migration).toContain(
			'grant execute on function public.corex_start_process_run(uuid, uuid, text, jsonb) to service_role'
		);
		expect(migration).toContain(
			'revoke all on function public.corex_start_process_run(uuid, uuid, text, jsonb) from public, anon, authenticated'
		);
		expect(migration).not.toContain('p_execution_plan');
	});

	it('marks a queued run as errored through a service-role-only compensation function', () => {
		expect(migration).toContain('create or replace function public.corex_fail_process_run(');
		expect(migration).toContain("and status = 'queued'");
		expect(migration).toContain("set status = 'errored'");
		expect(migration).toContain(
			'grant execute on function public.corex_fail_process_run(uuid, uuid, jsonb) to service_role'
		);
		expect(migration).toContain(
			'revoke all on function public.corex_fail_process_run(uuid, uuid, jsonb) from public, anon, authenticated'
		);
	});

	it('records ordered lifecycle events and status changes atomically for the service role', () => {
		expect(migration).toContain('create or replace function public.corex_record_run_event(');
		expect(migration).toContain('for update;');
		expect(migration).toContain('existing_event public.corex_run_events');
		expect(migration).toContain("raise exception 'conflicting corex run event'");
		expect(migration).not.toContain('on conflict (run_id, sequence) do nothing');
		expect(migration).toContain("target_run.status = 'queued' and p_status = 'running'");
		expect(migration).toContain(
			"target_run.status = 'running' and p_status in ('complete', 'errored')"
		);
		expect(migration).toContain(
			'grant execute on function public.corex_record_run_event(uuid, uuid, integer, public.corex_run_status, text, text, jsonb, jsonb, jsonb) to service_role'
		);
		expect(migration).toContain(
			'revoke all on function public.corex_record_run_event(uuid, uuid, integer, public.corex_run_status, text, text, jsonb, jsonb, jsonb) from public, anon, authenticated'
		);
	});

	it('stores owner-readable HTTP attempts through an idempotent service-only RPC', () => {
		expect(stepAttemptsMigration).toContain('create table public.corex_step_attempts');
		expect(stepAttemptsMigration).toContain(
			"check ((outcome = 'complete' and output is not null and error is null)"
		);
		expect(stepAttemptsMigration).toContain(
			'primary key (run_id, execution_generation, step_id, visit, attempt)'
		);
		expect(stepAttemptsMigration).toContain(
			'alter table public.corex_step_attempts enable row level security'
		);
		expect(stepAttemptsMigration).toContain('using (owner_user_id = (select auth.uid()))');
		expect(stepAttemptsMigration).toContain(
			'on conflict (run_id, execution_generation, step_id, visit, attempt) do nothing'
		);
		expect(stepAttemptsMigration).toContain("raise exception 'conflicting corex step attempt'");
		expect(stepAttemptsMigration).toMatch(
			/grant execute on function public\.corex_record_step_attempt\(\s*uuid, uuid, integer, text, integer, text, integer, timestamptz, timestamptz,\s*text, jsonb, jsonb, jsonb\s*\) to service_role/
		);
		expect(stepAttemptsMigration).not.toContain('security definer');
	});

	it('distinguishes compensation attempts without breaking existing RPC callers', () => {
		expect(stepAttemptKindMigration).toContain("add column kind text not null default 'forward'");
		expect(stepAttemptKindMigration).toContain("check (kind in ('forward', 'compensation'))");
		expect(stepAttemptKindMigration).toContain("p_kind text default 'forward'");
		expect(stepAttemptKindMigration).toContain('or existing_attempt.kind <> p_kind');
		expect(stepAttemptKindMigration).toMatch(
			/grant execute on function public\.corex_record_step_attempt\(\s*uuid, uuid, integer, text, integer, text, integer, timestamptz, timestamptz,\s*text, jsonb, jsonb, jsonb, text\s*\) to service_role/
		);
		expect(stepAttemptKindMigration).not.toContain('security definer');
	});
});
