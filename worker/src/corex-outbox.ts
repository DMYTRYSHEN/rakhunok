type CorexOutboxOptions = {
	url: string;
	serviceRoleKey: string;
	fetcher?: typeof fetch;
	workflow: {
		get(id: string): Promise<{
			status?(): Promise<{
				status: string;
				rollback?: { outcome: 'complete' | 'failed'; error: unknown | null } | null;
			}>;
			terminate?(options?: { rollback?: boolean }): Promise<void>;
			pause?(): Promise<void>;
			resume?(): Promise<void>;
			restart?(options?: {
				from?: { name: string; count?: number; type?: 'do' | 'sleep' | 'waitForEvent' };
			}): Promise<void>;
			sendEvent?(options: { type: string; payload: unknown }): Promise<void>;
		}>;
	};
};

type ClaimedOutboxBase = {
	id: string;
	workflowInstanceId: string;
	attempts: number;
	claimToken: string;
};
type ClaimedOutboxItem = ClaimedOutboxBase &
	(
		| { kind: 'terminate_workflow' }
		| {
				kind: 'rollback_workflow';
				payload: { requestId: string; platformAccepted?: boolean };
		  }
		| { kind: 'pause_workflow' }
		| { kind: 'resume_workflow' }
		| {
				kind: 'restart_workflow';
				payload: {
					requestId: string;
					executionGeneration: number;
					from?: { name: string; count?: number; type?: 'do' | 'sleep' | 'waitForEvent' };
				};
		  }
		| { kind: 'workflow_event'; payload: { type: string; payload: unknown } }
		| { kind: 'parent_callback'; payload: { type: string; payload: unknown } }
	);

const TERMINAL_WORKFLOW_STATUSES = new Set(['complete', 'errored', 'terminated']);

function rpcHeaders(serviceRoleKey: string): HeadersInit {
	return {
		Authorization: `Bearer ${serviceRoleKey}`,
		apikey: serviceRoleKey,
		'Content-Type': 'application/json'
	};
}

function isClaimedItem(value: unknown): value is ClaimedOutboxItem {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
	const item = value as Record<string, unknown>;
	const hasBaseFields =
		typeof item.id === 'string' &&
		typeof item.workflowInstanceId === 'string' &&
		Number.isSafeInteger(item.attempts) &&
		typeof item.claimToken === 'string';
	if (!hasBaseFields) return false;
	if (['terminate_workflow', 'pause_workflow', 'resume_workflow'].includes(String(item.kind))) {
		return true;
	}
	if (item.kind === 'rollback_workflow') {
		if (typeof item.payload !== 'object' || item.payload === null || Array.isArray(item.payload)) {
			return false;
		}
		const payload = item.payload as Record<string, unknown>;
		return (
			Object.keys(payload).every((key) => ['requestId', 'platformAccepted'].includes(key)) &&
			/^\p{ASCII_Hex_Digit}{8}(?:-\p{ASCII_Hex_Digit}{4}){3}-\p{ASCII_Hex_Digit}{12}$/v.test(
				String(payload.requestId)
			) &&
			(!Object.hasOwn(payload, 'platformAccepted') || payload.platformAccepted === true)
		);
	}
	if (item.kind === 'restart_workflow') {
		if (typeof item.payload !== 'object' || item.payload === null || Array.isArray(item.payload)) {
			return false;
		}
		const payload = item.payload as Record<string, unknown>;
		if (
			!/^\p{ASCII_Hex_Digit}{8}(?:-\p{ASCII_Hex_Digit}{4}){3}-\p{ASCII_Hex_Digit}{12}$/v.test(
				String(payload.requestId)
			) ||
			!Number.isSafeInteger(payload.executionGeneration) ||
			Number(payload.executionGeneration) < 2
		)
			return false;
		if (!Object.hasOwn(payload, 'from')) return true;
		if (typeof payload.from !== 'object' || payload.from === null || Array.isArray(payload.from)) {
			return false;
		}
		const from = payload.from as Record<string, unknown>;
		const keys = Object.keys(from);
		return (
			keys.every((key) => ['name', 'count', 'type'].includes(key)) &&
			typeof from.name === 'string' &&
			from.name.length > 0 &&
			from.name.length <= 100 &&
			!/[\u0000-\u001f\u007f]/.test(from.name) &&
			(!Object.hasOwn(from, 'count') ||
				(Number.isSafeInteger(from.count) && Number(from.count) > 0)) &&
			(!Object.hasOwn(from, 'type') || ['do', 'sleep', 'waitForEvent'].includes(String(from.type)))
		);
	}
	if (
		!['workflow_event', 'parent_callback'].includes(String(item.kind)) ||
		typeof item.payload !== 'object' ||
		item.payload === null ||
		Array.isArray(item.payload)
	) {
		return false;
	}
	const event = item.payload as Record<string, unknown>;
	if (typeof event.type !== 'string' || !Object.hasOwn(event, 'payload')) return false;
	if (item.kind === 'workflow_event') {
		return /^[a-zA-Z0-9_][a-zA-Z0-9_-]{0,99}$/.test(event.type);
	}
	if (!/^corex-subprocess-result:[0-9a-f-]{36}$/.test(event.type)) return false;
	if (typeof event.payload !== 'object' || event.payload === null || Array.isArray(event.payload))
		return false;
	const callback = event.payload as Record<string, unknown>;
	return (
		typeof callback.childRunId === 'string' &&
		event.type === `corex-subprocess-result:${callback.childRunId}` &&
		['complete', 'errored'].includes(String(callback.status)) &&
		(callback.status === 'complete' || !Object.hasOwn(callback, 'output'))
	);
}

export async function drainCorexOutbox(options: CorexOutboxOptions): Promise<{
	claimed: number;
	delivered: number;
	failed: number;
}> {
	const fetcher = options.fetcher ?? fetch;
	const baseUrl = options.url.replace(/\/+$/, '');
	const claimResponse = await fetcher(`${baseUrl}/rest/v1/rpc/corex_claim_outbox`, {
		method: 'POST',
		headers: rpcHeaders(options.serviceRoleKey),
		body: JSON.stringify({ p_limit: 25, p_lease_seconds: 60 })
	});
	if (!claimResponse.ok) throw new Error('Could not claim Corex outbox items.');
	const claimed: unknown = await claimResponse.json();
	if (!Array.isArray(claimed) || claimed.some((item) => !isClaimedItem(item))) {
		throw new Error('Corex outbox returned invalid data.');
	}

	let delivered = 0;
	let failed = 0;
	for (const item of claimed as ClaimedOutboxItem[]) {
		let deliverySucceeded: boolean;
		let reconciledWorkflowStatus: string | undefined;
		let reconciledRollback:
			| {
					status: string;
					rollback: { outcome: 'complete' | 'failed'; error: unknown | null } | null;
					platformAccepted: boolean;
			  }
			| undefined;
		try {
			const instance = await options.workflow.get(item.workflowInstanceId);
			if (item.kind === 'workflow_event' || item.kind === 'parent_callback') {
				if (!instance.sendEvent) throw new Error('event_delivery_unavailable');
				await instance.sendEvent(item.payload);
			} else if (item.kind === 'restart_workflow') {
				if (!instance.restart) throw new Error('restart_unavailable');
				await instance.restart(item.payload.from ? { from: item.payload.from } : undefined);
			} else if (item.kind === 'rollback_workflow') {
				if (!instance.status || !instance.terminate) throw new Error('rollback_unavailable');
				let platformAccepted = item.payload.platformAccepted === true;
				let workflowStatus = await instance.status();
				if (!platformAccepted && !TERMINAL_WORKFLOW_STATUSES.has(workflowStatus.status)) {
					try {
						await instance.terminate({ rollback: true });
						platformAccepted = true;
					} catch {
						workflowStatus = await instance.status();
						if (!workflowStatus.rollback) throw new Error('rollback_failed');
						platformAccepted = true;
					}
					workflowStatus = await instance.status();
				}
				reconciledRollback = {
					status: workflowStatus.status,
					rollback: workflowStatus.rollback ?? null,
					platformAccepted
				};
			} else if (item.kind === 'pause_workflow' || item.kind === 'resume_workflow') {
				if (!instance.status) throw new Error('lifecycle_status_unavailable');
				const expectedStatuses =
					item.kind === 'pause_workflow'
						? new Set(['waitingForPause', 'paused'])
						: new Set(['running']);
				let status = (await instance.status()).status;
				if (!expectedStatuses.has(status)) {
					const operation = item.kind === 'pause_workflow' ? instance.pause : instance.resume;
					if (!operation) throw new Error('lifecycle_operation_unavailable');
					try {
						await operation.call(instance);
					} catch {
						// The following status read reconciles an ambiguous platform response.
					}
					status = (await instance.status()).status;
				}
				if (!expectedStatuses.has(status)) throw new Error('lifecycle_operation_failed');
				reconciledWorkflowStatus = status;
			} else {
				if (!instance.status || !instance.terminate) throw new Error('termination_unavailable');
				const initialStatus = (await instance.status()).status;
				if (!TERMINAL_WORKFLOW_STATUSES.has(initialStatus)) {
					try {
						await instance.terminate();
					} catch {
						const reconciledStatus = (await instance.status()).status;
						if (!TERMINAL_WORKFLOW_STATUSES.has(reconciledStatus))
							throw new Error('termination_failed');
					}
				}
			}
			deliverySucceeded = true;
		} catch {
			deliverySucceeded = false;
		}

		const rpc = deliverySucceeded
			? reconciledRollback
				? 'corex_reconcile_rollback_outbox'
				: reconciledWorkflowStatus
					? 'corex_reconcile_lifecycle_outbox'
					: 'corex_ack_outbox'
			: 'corex_fail_outbox';
		const response = await fetcher(`${baseUrl}/rest/v1/rpc/${rpc}`, {
			method: 'POST',
			headers: rpcHeaders(options.serviceRoleKey),
			body: JSON.stringify({
				p_outbox_id: item.id,
				p_claim_token: item.claimToken,
				...(reconciledRollback
					? {
							p_workflow_status: reconciledRollback.status,
							p_rollback: reconciledRollback.rollback,
							p_platform_accepted: reconciledRollback.platformAccepted
						}
					: {}),
				...(reconciledWorkflowStatus ? { p_workflow_status: reconciledWorkflowStatus } : {}),
				...(deliverySucceeded
					? {}
					: {
							p_error: {
								code:
									item.kind === 'workflow_event'
										? 'workflow_event_delivery_failed'
										: item.kind === 'parent_callback'
											? 'parent_callback_delivery_failed'
											: item.kind === 'pause_workflow'
												? 'workflow_pause_failed'
												: item.kind === 'resume_workflow'
													? 'workflow_resume_failed'
													: item.kind === 'restart_workflow'
														? 'workflow_restart_failed'
														: item.kind === 'rollback_workflow'
															? 'workflow_rollback_failed'
															: 'workflow_termination_failed'
							}
						})
			})
		});
		if (!response.ok) throw new Error('Could not update Corex outbox delivery state.');
		if (deliverySucceeded && (reconciledWorkflowStatus || reconciledRollback)) {
			const reconciliation: unknown = await response.json();
			if (
				typeof reconciliation !== 'object' ||
				reconciliation === null ||
				(reconciliation as Record<string, unknown>).accepted !== true ||
				typeof (reconciliation as Record<string, unknown>).delivered !== 'boolean'
			) {
				throw new Error('Corex lifecycle reconciliation returned invalid data.');
			}
			if ((reconciliation as Record<string, unknown>).delivered === true) delivered += 1;
		} else if (deliverySucceeded) delivered += 1;
		else failed += 1;
	}

	return { claimed: claimed.length, delivered, failed };
}
