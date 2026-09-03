import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
	fileURLToPath(
		new URL(
			'../../../../supabase/migrations/20260903135430_corex_process_flows.sql',
			import.meta.url
		)
	),
	'utf8'
).toLowerCase();

describe('Corex process Flow persistence migration', () => {
	it('stores mutable authored drafts and immutable resolved versions', () => {
		expect(migration).toContain('create table if not exists public.corex_process_flows');
		expect(migration).toContain('draft_definition jsonb not null');
		expect(migration).toContain('create table if not exists public.corex_process_flow_versions');
		expect(migration).toContain('resolved_definition jsonb not null');
		expect(migration).toContain('definition_sha256 text not null');
		expect(migration).toContain('unique (flow_id, version)');
		expect(migration).toContain('foreign key (flow_id, owner_user_id)');
		expect(migration).not.toContain('unique (flow_id, definition_sha256)');
	});

	it('prevents published snapshots from being changed or deleted', () => {
		expect(migration).toContain(
			'create or replace function corex_private.prevent_process_flow_version_mutation()'
		);
		expect(migration).toContain('raise exception using');
		expect(migration).toContain('process flow versions are immutable');
		expect(migration).toContain('before update or delete on public.corex_process_flow_versions');
	});

	it('enforces owner-scoped reads with explicit Data API privileges', () => {
		expect(migration).toContain('alter table public.corex_process_flows enable row level security');
		expect(migration).toContain(
			'alter table public.corex_process_flow_versions enable row level security'
		);
		expect(migration).toContain('to authenticated');
		expect(migration).toContain('using ((select auth.uid()) = owner_user_id)');
		expect(migration).toContain(
			'grant select on table public.corex_process_flows to authenticated'
		);
		expect(migration).toContain(
			'grant select on table public.corex_process_flow_versions to authenticated'
		);
		expect(migration).toContain(
			'revoke all on table public.corex_process_flows from anon, authenticated'
		);
		expect(migration).toContain(
			'revoke all on table public.corex_process_flow_versions from anon, authenticated'
		);
		expect(migration).toContain('on public.corex_process_flows for insert to authenticated');
		expect(migration).toContain('with check ((select auth.uid()) = owner_user_id)');
		expect(migration).toContain('on public.corex_process_flows for update to authenticated');
		expect(migration).toContain('using ((select auth.uid()) = owner_user_id)');
		expect(migration).toContain(
			'grant insert (owner_user_id, slug, name, description, draft_definition)'
		);
		expect(migration).toContain('grant update (name, description, draft_definition)');
	});

	it('publishes only server-resolved immutable Flow snapshots', () => {
		expect(migration).toContain('create or replace function public.corex_publish_process_flow(');
		expect(migration).toContain('for update');
		expect(migration).toContain('target_flow.revision <> p_expected_revision');
		expect(migration).toContain("participant ->> 'kind' = 'process'");
		expect(migration).toContain('and owner_user_id = target_flow.owner_user_id');
		expect(migration).toContain('and version = target_process.published_version');
		expect(migration).toContain("'{processversionid}'");
		expect(migration).toContain("'{processversion}'");
		expect(migration).toContain('definition_sha256 = published_sha256');
		expect(migration).toContain('coalesce(max(version), 0) + 1');
		expect(migration).toMatch(
			/revoke all on function public\.corex_publish_process_flow\(uuid, uuid, bigint\)\s+from public, anon, authenticated/
		);
		expect(migration).toMatch(
			/grant execute on function public\.corex_publish_process_flow\(uuid, uuid, bigint\)\s+to service_role/
		);
	});

	it('correlates existing process runs to an immutable Flow version and participant', () => {
		expect(migration).toContain('create table if not exists public.corex_process_flow_runs');
		expect(migration).toContain('create table if not exists public.corex_process_flow_run_members');
		expect(migration).toContain('unique (owner_user_id, request_id)');
		expect(migration).toContain('unique (run_id)');
		expect(migration).toContain('foreign key (flow_version_id, flow_id, owner_user_id)');
		expect(migration).toContain('create or replace function public.corex_start_process_flow_run(');
		expect(migration).toContain('create or replace function public.corex_link_process_flow_run(');
		expect(migration).toContain("resolved_definition -> 'scenarios'");
		expect(migration).toContain("resolved_definition -> 'participants'");
		expect(migration).toContain('target_run.process_version_id <> participant_process_version_id');
		expect(migration).toMatch(
			/grant execute on function public\.corex_start_process_flow_run\(uuid, uuid, uuid, text\)\s+to service_role/
		);
		expect(migration).toMatch(
			/grant execute on function public\.corex_link_process_flow_run\(uuid, uuid, uuid, text\)\s+to service_role/
		);
	});
});
