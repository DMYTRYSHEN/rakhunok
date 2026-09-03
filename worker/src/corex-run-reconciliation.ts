import { compileProcessDefinition } from '../../src/lib/features/corex/process-compiler.ts';
import type { ProcessDefinition } from '../../src/lib/features/corex/process-definition.ts';
import type { CorexWorkflowParams } from './corex-runtime.ts';

type CorexRunReconciliationOptions = {
	url: string;
	serviceRoleKey: string;
	fetcher?: typeof fetch;
	workflow: {
		get(id: string): Promise<{ status(): Promise<{ status: string }> }>;
		create(options: { id: string; params: CorexWorkflowParams }): Promise<unknown>;
	};
};

type ClaimedRun = {
	id: string;
	workflowInstanceId: string;
	ownerUserId: string;
	definition: ProcessDefinition;
	input: unknown;
	parentRunId: string | null;
	parentWorkflowInstanceId: string | null;
	parentStepId: string | null;
	attempts: number;
	claimToken: string;
};

function rpcHeaders(serviceRoleKey: string): HeadersInit {
	return {
		Authorization: `Bearer ${serviceRoleKey}`,
		apikey: serviceRoleKey,
		'Content-Type': 'application/json'
	};
}

function isClaimedRun(value: unknown): value is ClaimedRun {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
	const run = value as Record<string, unknown>;
	const nullableStringsAreValid = ['parentRunId', 'parentWorkflowInstanceId', 'parentStepId'].every(
		(key) => run[key] === null || typeof run[key] === 'string'
	);
	const parentFields = [run.parentRunId, run.parentWorkflowInstanceId, run.parentStepId];
	return (
		typeof run.id === 'string' &&
		typeof run.workflowInstanceId === 'string' &&
		typeof run.ownerUserId === 'string' &&
		typeof run.definition === 'object' &&
		run.definition !== null &&
		!Array.isArray(run.definition) &&
		Number.isSafeInteger(run.attempts) &&
		typeof run.claimToken === 'string' &&
		nullableStringsAreValid &&
		(parentFields.every((field) => field === null) ||
			parentFields.every((field) => typeof field === 'string'))
	);
}

export async function reconcileQueuedCorexRuns(options: CorexRunReconciliationOptions): Promise<{
	claimed: number;
	reconciled: number;
	failed: number;
}> {
	const fetcher = options.fetcher ?? fetch;
	const baseUrl = options.url.replace(/\/+$/, '');
	const headers = rpcHeaders(options.serviceRoleKey);
	const claimResponse = await fetcher(
		`${baseUrl}/rest/v1/rpc/corex_claim_queued_run_reconciliation`,
		{
			method: 'POST',
			headers,
			body: JSON.stringify({ p_limit: 10, p_lease_seconds: 120, p_grace_seconds: 60 })
		}
	);
	if (!claimResponse.ok) throw new Error('Could not claim queued Corex runs for reconciliation.');
	const claimed: unknown = await claimResponse.json();
	if (!Array.isArray(claimed) || claimed.some((run) => !isClaimedRun(run))) {
		throw new Error('Corex run reconciliation returned invalid data.');
	}

	let reconciled = 0;
	let failed = 0;
	for (const run of claimed as ClaimedRun[]) {
		let reconciliationSucceeded: boolean;
		try {
			const compilation = compileProcessDefinition(run.definition);
			if (!compilation.ok) throw new Error('invalid_published_definition');
			const instance = await options.workflow.get(run.workflowInstanceId);
			if ((await instance.status()).status === 'unknown') {
				await options.workflow.create({
					id: run.workflowInstanceId,
					params: {
						runId: run.id,
						workflowInstanceId: run.workflowInstanceId,
						ownerUserId: run.ownerUserId,
						plan: compilation.plan,
						input: run.input,
						...(run.parentRunId && run.parentWorkflowInstanceId && run.parentStepId
							? {
									parent: {
										runId: run.parentRunId,
										workflowInstanceId: run.parentWorkflowInstanceId,
										stepId: run.parentStepId
									}
								}
							: {})
					}
				});
			}
			reconciliationSucceeded = true;
		} catch {
			reconciliationSucceeded = false;
		}

		const updateResponse = await fetcher(
			`${baseUrl}/rest/v1/rpc/${
				reconciliationSucceeded
					? 'corex_ack_queued_run_reconciliation'
					: 'corex_fail_queued_run_reconciliation'
			}`,
			{
				method: 'POST',
				headers,
				body: JSON.stringify({
					p_run_id: run.id,
					p_claim_token: run.claimToken,
					...(reconciliationSucceeded
						? {}
						: { p_error: { code: 'workflow_reconciliation_failed' } })
				})
			}
		);
		if (!updateResponse.ok) throw new Error('Could not update Corex run reconciliation state.');
		if (reconciliationSucceeded) reconciled += 1;
		else failed += 1;
	}

	return { claimed: claimed.length, reconciled, failed };
}
