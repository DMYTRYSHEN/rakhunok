import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
	fileURLToPath(new URL('../../../../supabase/migrations/202608300001_corex_control_plane.sql', import.meta.url)),
	'utf8'
).toLowerCase();
const approvalMigration = readFileSync(
	fileURLToPath(new URL('../../../../supabase/migrations/202608310001_corex_approval_tasks.sql', import.meta.url)),
	'utf8'
).toLowerCase();

describe('Corex control-plane migration', () => {
	it('creates RLS-protected approval tasks with an assignee-only decision RPC', () => {
		expect(approvalMigration).toContain('create table public.corex_approval_tasks');
		expect(approvalMigration).toContain('assignee_user_id = (select auth.uid())');
		expect(approvalMigration).toContain('and assignee_user_id = p_actor_user_id');
		expect(approvalMigration).toContain('for update;');
		expect(approvalMigration).toContain("target_task.status = 'pending'");
		expect(approvalMigration).toContain('grant execute on function public.corex_decide_approval_task(uuid, uuid, text, text) to service_role');
		expect(approvalMigration).not.toContain('security definer');
	});

	it('creates tasks from approval lifecycle events and supports waiting transitions', () => {
		expect(approvalMigration).toContain("new.payload ->> 'steptype' <> 'approval'");
		expect(approvalMigration).toContain('on conflict (run_id, step_name) do nothing');
		expect(approvalMigration).toContain("target_run.status = 'running' and p_status in ('waiting', 'complete', 'errored')");
		expect(approvalMigration).toContain("target_run.status = 'waiting' and p_status in ('running', 'errored')");
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
		expect(migration).toContain('grant execute on function public.corex_publish_process(uuid, uuid, bigint) to service_role');
		expect(migration).toContain('revoke all on function public.corex_publish_process(uuid, uuid, bigint) from public, anon, authenticated');
		expect(migration).not.toContain('p_definition');
	});

	it('starts runs only from the current immutable version through a service-role-only function', () => {
		expect(migration).toContain('create or replace function public.corex_start_process_run(');
		expect(migration).toContain('target_process.published_version is null');
		expect(migration).toContain('process_version_id');
		expect(migration).toContain('grant execute on function public.corex_start_process_run(uuid, uuid, text, jsonb) to service_role');
		expect(migration).toContain('revoke all on function public.corex_start_process_run(uuid, uuid, text, jsonb) from public, anon, authenticated');
		expect(migration).not.toContain('p_execution_plan');
	});

	it('marks a queued run as errored through a service-role-only compensation function', () => {
		expect(migration).toContain('create or replace function public.corex_fail_process_run(');
		expect(migration).toContain("and status = 'queued'");
		expect(migration).toContain("set status = 'errored'");
		expect(migration).toContain('grant execute on function public.corex_fail_process_run(uuid, uuid, jsonb) to service_role');
		expect(migration).toContain('revoke all on function public.corex_fail_process_run(uuid, uuid, jsonb) from public, anon, authenticated');
	});

	it('records ordered lifecycle events and status changes atomically for the service role', () => {
		expect(migration).toContain('create or replace function public.corex_record_run_event(');
		expect(migration).toContain('for update;');
		expect(migration).toContain('existing_event public.corex_run_events');
		expect(migration).toContain("raise exception 'conflicting corex run event'");
		expect(migration).not.toContain('on conflict (run_id, sequence) do nothing');
		expect(migration).toContain("target_run.status = 'queued' and p_status = 'running'");
		expect(migration).toContain("target_run.status = 'running' and p_status in ('complete', 'errored')");
		expect(migration).toContain('grant execute on function public.corex_record_run_event(uuid, uuid, integer, public.corex_run_status, text, text, jsonb, jsonb, jsonb) to service_role');
		expect(migration).toContain('revoke all on function public.corex_record_run_event(uuid, uuid, integer, public.corex_run_status, text, text, jsonb, jsonb, jsonb) from public, anon, authenticated');
	});
});