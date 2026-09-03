import { compileProcessDefinition } from '../../src/lib/features/corex/process-compiler.ts';
import type { ProcessDefinition } from '../../src/lib/features/corex/process-definition.ts';

type OperationKind = 'process_create' | 'run_terminate' | 'workflow_delete' | 'process_delete';

type ClaimedOperationItem = {
	id: string;
	operationId: string;
	kind: OperationKind;
	ownerUserId: string;
	targetId: string;
	payload: Record<string, unknown>;
	claimToken: string;
};

type PreparedCreate = ClaimedOperationItem & {
	workflowInstanceId: string;
	runId: string;
	plan: unknown;
	input: unknown;
	locationHint?: WorkflowInstanceLocationHint;
};

type CorexOperationProcessorOptions = {
	url: string;
	serviceRoleKey: string;
	fetcher?: typeof fetch;
	workflow: {
		createBatch(batch: WorkflowInstanceCreateOptions[]): Promise<Array<{ id: string }>>;
		deleteBatch(ids: string[]): Promise<WorkflowBatchDeleteResult>;
		get(id: string): Promise<{
			status(): Promise<{ status: string }>;
			terminate(options?: { rollback?: boolean }): Promise<void>;
		}>;
	};
	outputBucket?: Pick<R2Bucket, 'delete'>;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const LOCATION_HINTS = new Set([
	'wnam',
	'enam',
	'sam',
	'weur',
	'eeur',
	'apac',
	'apac-ne',
	'apac-se',
	'oc',
	'afr',
	'me'
]);
const TERMINAL_STATUSES = new Set(['complete', 'errored', 'terminated']);

function rpcHeaders(serviceRoleKey: string): HeadersInit {
	return {
		Authorization: `Bearer ${serviceRoleKey}`,
		apikey: serviceRoleKey,
		'Content-Type': 'application/json'
	};
}

function isClaimedItem(value: unknown): value is ClaimedOperationItem {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
	const item = value as Record<string, unknown>;
	return (
		typeof item.id === 'string' &&
		typeof item.operationId === 'string' &&
		['process_create', 'run_terminate', 'workflow_delete', 'process_delete'].includes(
			String(item.kind)
		) &&
		typeof item.ownerUserId === 'string' &&
		typeof item.targetId === 'string' &&
		typeof item.payload === 'object' &&
		item.payload !== null &&
		!Array.isArray(item.payload) &&
		typeof item.claimToken === 'string'
	);
}

export async function processCorexOperations(options: CorexOperationProcessorOptions): Promise<{
	claimed: number;
	completed: number;
	failed: number;
}> {
	const fetcher = options.fetcher ?? fetch;
	const baseUrl = options.url.replace(/\/+$/, '');
	const headers = rpcHeaders(options.serviceRoleKey);

	async function rpc(name: string, body: Record<string, unknown>): Promise<unknown> {
		const response = await fetcher(`${baseUrl}/rest/v1/rpc/${name}`, {
			method: 'POST',
			headers,
			body: JSON.stringify(body)
		});
		if (!response.ok) throw new Error(`${name}_failed`);
		return response.json();
	}

	async function complete(item: ClaimedOperationItem, result: Record<string, unknown>) {
		await rpc('corex_complete_operation_item', {
			p_item_id: item.id,
			p_claim_token: item.claimToken,
			p_result: result
		});
	}

	async function fail(item: ClaimedOperationItem, code: string) {
		await rpc('corex_fail_operation_item', {
			p_item_id: item.id,
			p_claim_token: item.claimToken,
			p_error_code: code
		});
	}

	const claimedValue = await rpc('corex_claim_operation_items', {
		p_limit: 100,
		p_lease_seconds: 300
	});
	if (!Array.isArray(claimedValue) || claimedValue.some((item) => !isClaimedItem(item))) {
		throw new Error('Corex operation claim returned invalid data.');
	}
	const claimed = claimedValue as ClaimedOperationItem[];
	let completed = 0;
	let failed = 0;

	const createItems = claimed.filter((item) => item.kind === 'process_create');
	if (createItems.length > 0) {
		const prepared = await Promise.all(
			createItems.map(async (item): Promise<PreparedCreate | undefined> => {
				try {
					const processId = item.payload.processId;
					const locationHint = item.payload.locationHint;
					if (
						typeof processId !== 'string' ||
						!UUID.test(processId) ||
						(locationHint !== undefined && !LOCATION_HINTS.has(String(locationHint)))
					) {
						throw new Error('invalid_create_payload');
					}
					const workflowInstanceId = `corex:${item.ownerUserId.toLowerCase()}:${item.targetId.toLowerCase()}`;
					const run = (await rpc('corex_start_process_run', {
						p_process_id: processId,
						p_owner_user_id: item.ownerUserId,
						p_workflow_instance_id: workflowInstanceId,
						p_input: item.payload.input ?? null
					})) as Record<string, unknown>;
					if (
						typeof run.id !== 'string' ||
						run.workflowInstanceId !== workflowInstanceId ||
						typeof run.definition !== 'object' ||
						run.definition === null
					) {
						throw new Error('invalid_start_result');
					}
					const compilation = compileProcessDefinition(run.definition as ProcessDefinition);
					if (!compilation.ok) throw new Error('process_not_executable');
					return {
						...item,
						workflowInstanceId,
						runId: run.id,
						plan: compilation.plan,
						input: item.payload.input ?? null,
						...(locationHint ? { locationHint: locationHint as WorkflowInstanceLocationHint } : {})
					};
				} catch (error) {
					await fail(
						item,
						error instanceof Error && error.message === 'process_not_executable'
							? 'process_not_executable'
							: 'run_preparation_failed'
					);
					failed += 1;
					return undefined;
				}
			})
		);
		const ready = prepared.filter((item): item is PreparedCreate => item !== undefined);
		if (ready.length > 0) {
			try {
				await options.workflow.createBatch(
					ready.map((item) => ({
						id: item.workflowInstanceId,
						...(item.locationHint ? { locationHint: item.locationHint } : {}),
						params: {
							runId: item.runId,
							workflowInstanceId: item.workflowInstanceId,
							ownerUserId: item.ownerUserId,
							plan: item.plan,
							input: item.input
						}
					}))
				);
				for (const item of ready) {
					await complete(item, { runId: item.runId, workflowInstanceId: item.workflowInstanceId });
					completed += 1;
				}
			} catch {
				for (const item of ready) {
					await fail(item, 'workflow_create_failed');
					failed += 1;
				}
			}
		}
	}

	for (const item of claimed.filter((candidate) => candidate.kind === 'run_terminate')) {
		try {
			const result = (await rpc('corex_request_run_cancellation', {
				p_run_id: item.targetId,
				p_owner_user_id: item.ownerUserId,
				p_request_id: item.id
			})) as Record<string, unknown>;
			const ids = result.workflowInstanceIds;
			if (!Array.isArray(ids) || ids.some((id) => typeof id !== 'string')) {
				throw new Error('invalid_cancellation_result');
			}
			for (const id of ids as string[]) {
				const instance = await options.workflow.get(id);
				const status = await instance.status();
				if (!TERMINAL_STATUSES.has(status.status)) await instance.terminate({ rollback: true });
			}
			await complete(item, { terminated: true });
			completed += 1;
		} catch {
			await fail(item, 'workflow_terminate_failed');
			failed += 1;
		}
	}

	const deleteItems = claimed.filter((item) => item.kind === 'workflow_delete');
	if (deleteItems.length > 0) {
		const ids = deleteItems
			.map((item) => item.payload.workflowInstanceId)
			.filter((id): id is string => typeof id === 'string');
		if (ids.length !== deleteItems.length) {
			for (const item of deleteItems) await fail(item, 'workflow_identity_missing');
			failed += deleteItems.length;
		} else {
			try {
				const result = await options.workflow.deleteBatch(ids);
				const deleted = new Set(result.deleted.map(({ id }) => id));
				const missing = new Set(
					result.errors.filter(({ code }) => code === 404).map(({ id }) => id)
				);
				for (let index = 0; index < deleteItems.length; index += 1) {
					const item = deleteItems[index];
					if (deleted.has(ids[index]) || missing.has(ids[index])) {
						await complete(item, { deleted: true });
						completed += 1;
					} else {
						await fail(item, 'workflow_delete_failed');
						failed += 1;
					}
				}
			} catch {
				for (const item of deleteItems) await fail(item, 'workflow_delete_failed');
				failed += deleteItems.length;
			}
		}
	}

	for (const item of claimed.filter((candidate) => candidate.kind === 'process_delete')) {
		try {
			if (item.payload.action === 'process_finalize') {
				await rpc('corex_finalize_process_deletion', {
					p_item_id: item.id,
					p_claim_token: item.claimToken
				});
			} else if (item.payload.action === 'run_cleanup') {
				const objectKeys = item.payload.objectKeys;
				if (
					!Array.isArray(objectKeys) ||
					objectKeys.some((key) => typeof key !== 'string' || !key.startsWith('corex-output/'))
				) {
					throw new Error('invalid_cleanup_payload');
				}
				if (objectKeys.length > 0) {
					if (!options.outputBucket) throw new Error('output_storage_unavailable');
					for (let offset = 0; offset < objectKeys.length; offset += 1_000) {
						await options.outputBucket.delete(objectKeys.slice(offset, offset + 1_000));
					}
				}
				const result = await options.workflow.deleteBatch([item.targetId]);
				if (result.errors.some(({ code }) => code !== 404)) {
					throw new Error('workflow_delete_failed');
				}
				await complete(item, { cleaned: true });
			} else {
				throw new Error('invalid_cleanup_payload');
			}
			completed += 1;
		} catch (error) {
			const code =
				error instanceof Error &&
				['output_storage_unavailable', 'workflow_delete_failed'].includes(error.message)
					? error.message
					: 'process_cleanup_failed';
			await fail(item, code);
			failed += 1;
		}
	}

	return { claimed: claimed.length, completed, failed };
}
