import type { SupabaseClient } from '@supabase/supabase-js';
import type { ProcessLifecycle } from './process-definition';
import type { ProcessFlowDefinition } from './process-flow-definition';
import type { ResolvedProcessFlowDefinition } from './process-flow-resolution';

type ProcessFlowRow = {
	id: string;
	owner_user_id: string;
	slug: string;
	name: string;
	description: string;
	lifecycle: ProcessLifecycle;
	revision: number;
	draft_definition: ProcessFlowDefinition;
	published_version: number | null;
	updated_at: string;
};

type ProcessFlowVersionRow = {
	id: string;
	flow_id: string;
	version: number;
	resolved_definition: ResolvedProcessFlowDefinition;
	definition_sha256: string;
	published_at: string;
};

type ProcessFlowRunRow = {
	id: string;
	flow_version_id: string;
	flow_id: string;
	owner_user_id: string;
	request_id: string;
	scenario_id: string;
	started_at: string;
};

type ProcessFlowRunMemberRow = {
	flow_run_id: string;
	run_id: string;
	owner_user_id: string;
	participant_id: string;
	linked_at: string;
};

export type CorexProcessFlow = {
	id: string;
	ownerUserId: string;
	slug: string;
	name: string;
	description: string;
	lifecycle: ProcessLifecycle;
	revision: number;
	draftDefinition: ProcessFlowDefinition;
	publishedVersion: number | null;
	updatedAt: string;
};

export type CorexProcessFlowVersion = {
	id: string;
	flowId: string;
	version: number;
	resolvedDefinition: ResolvedProcessFlowDefinition;
	definitionSha256: string;
	publishedAt: string;
};

export type CorexProcessFlowRun = {
	id: string;
	flowVersionId: string;
	flowId: string;
	ownerUserId: string;
	requestId: string;
	scenarioId: string;
	startedAt: string;
};

export type CorexProcessFlowRunMember = {
	flowRunId: string;
	runId: string;
	ownerUserId: string;
	participantId: string;
	linkedAt: string;
};

export class CorexProcessFlowDraftConflictError extends Error {
	constructor() {
		super('Corex process Flow draft revision conflict');
		this.name = 'CorexProcessFlowDraftConflictError';
	}
}

function mapFlow(row: ProcessFlowRow): CorexProcessFlow {
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

const FLOW_COLUMNS =
	'id, owner_user_id, slug, name, description, lifecycle, revision, draft_definition, published_version, updated_at';

export function createCorexProcessFlowGateway(client: SupabaseClient) {
	return {
		async listFlows(ownerUserId: string): Promise<CorexProcessFlow[]> {
			const { data, error } = await client
				.from('corex_process_flows')
				.select(FLOW_COLUMNS)
				.eq('owner_user_id', ownerUserId)
				.order('updated_at', { ascending: false });
			if (error) throw error;
			return ((data ?? []) as unknown as ProcessFlowRow[]).map(mapFlow);
		},

		async createFlow(
			ownerUserId: string,
			slug: string,
			definition: ProcessFlowDefinition
		): Promise<CorexProcessFlow> {
			const { data, error } = await client
				.from('corex_process_flows')
				.insert({
					owner_user_id: ownerUserId,
					slug,
					name: definition.name,
					description: definition.description,
					draft_definition: definition
				})
				.select(FLOW_COLUMNS)
				.single();
			if (error) throw error;
			return mapFlow(data as unknown as ProcessFlowRow);
		},

		async saveDraft(
			flow: CorexProcessFlow,
			definition: ProcessFlowDefinition
		): Promise<CorexProcessFlow> {
			const { data, error } = await client
				.from('corex_process_flows')
				.update({
					name: definition.name,
					description: definition.description,
					draft_definition: definition
				})
				.eq('id', flow.id)
				.eq('owner_user_id', flow.ownerUserId)
				.eq('revision', flow.revision)
				.select(FLOW_COLUMNS)
				.maybeSingle();
			if (error) throw error;
			if (!data) throw new CorexProcessFlowDraftConflictError();
			return mapFlow(data as unknown as ProcessFlowRow);
		},

		async listVersions(flowId: string, ownerUserId: string): Promise<CorexProcessFlowVersion[]> {
			const { data, error } = await client
				.from('corex_process_flow_versions')
				.select('id, flow_id, version, resolved_definition, definition_sha256, published_at')
				.eq('flow_id', flowId)
				.eq('owner_user_id', ownerUserId)
				.order('version', { ascending: false });
			if (error) throw error;
			return ((data ?? []) as unknown as ProcessFlowVersionRow[]).map((row) => ({
				id: row.id,
				flowId: row.flow_id,
				version: row.version,
				resolvedDefinition: row.resolved_definition,
				definitionSha256: row.definition_sha256,
				publishedAt: row.published_at
			}));
		},

		async listFlowRuns(flowId: string, ownerUserId: string): Promise<CorexProcessFlowRun[]> {
			const { data, error } = await client
				.from('corex_process_flow_runs')
				.select('id, flow_version_id, flow_id, owner_user_id, request_id, scenario_id, started_at')
				.eq('flow_id', flowId)
				.eq('owner_user_id', ownerUserId)
				.order('started_at', { ascending: false });
			if (error) throw error;
			return ((data ?? []) as unknown as ProcessFlowRunRow[]).map((row) => ({
				id: row.id,
				flowVersionId: row.flow_version_id,
				flowId: row.flow_id,
				ownerUserId: row.owner_user_id,
				requestId: row.request_id,
				scenarioId: row.scenario_id,
				startedAt: row.started_at
			}));
		},

		async listFlowRunMembers(
			flowRunId: string,
			ownerUserId: string
		): Promise<CorexProcessFlowRunMember[]> {
			const { data, error } = await client
				.from('corex_process_flow_run_members')
				.select('flow_run_id, run_id, owner_user_id, participant_id, linked_at')
				.eq('flow_run_id', flowRunId)
				.eq('owner_user_id', ownerUserId)
				.order('linked_at', { ascending: true });
			if (error) throw error;
			return ((data ?? []) as unknown as ProcessFlowRunMemberRow[]).map((row) => ({
				flowRunId: row.flow_run_id,
				runId: row.run_id,
				ownerUserId: row.owner_user_id,
				participantId: row.participant_id,
				linkedAt: row.linked_at
			}));
		}
	};
}
