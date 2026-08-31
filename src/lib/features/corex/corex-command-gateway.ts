import type { SupabaseClient } from '@supabase/supabase-js';

export type CorexPublishedVersion = {
	id: string;
	version: number;
};

export type CorexStartedRun = {
	id: string;
	workflowInstanceId: string;
	status: string;
};

export type CorexCommandErrorCode =
	| 'authentication_required'
	| 'revision_conflict'
	| 'published_process_not_found'
	| 'process_not_executable'
	| 'run_not_found'
	| 'run_not_accepting_event'
	| 'runtime_unavailable'
	| 'command_failed';

export class CorexCommandError extends Error {
	constructor(
		public readonly code: CorexCommandErrorCode,
		public readonly status: number
	) {
		super(code);
		this.name = 'CorexCommandError';
	}
}

function errorCode(status: number): CorexCommandErrorCode {
	if (status === 401) return 'authentication_required';
	if (status === 409) return 'revision_conflict';
	if (status === 404) return 'published_process_not_found';
	if (status === 422) return 'process_not_executable';
	if (status === 503) return 'runtime_unavailable';
	return 'command_failed';
}

export function createCorexCommandGateway(
	client: SupabaseClient,
	fetcher: typeof fetch = fetch
) {
	async function command<T>(
		path: string,
		body: unknown,
		statusCodes: Partial<Record<number, CorexCommandErrorCode>> = {}
	): Promise<T> {
		const { data, error } = await client.auth.getSession();
		const accessToken = data.session?.access_token;
		if (error || !accessToken) throw new CorexCommandError('authentication_required', 401);

		const response = await fetcher(path, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${accessToken}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(body)
		});
		if (!response.ok) throw new CorexCommandError(statusCodes[response.status] ?? errorCode(response.status), response.status);
		return response.json() as Promise<T>;
	}

	return {
		publish(processId: string, expectedRevision: number): Promise<CorexPublishedVersion> {
			return command(`/corex/api/processes/${encodeURIComponent(processId)}/publish`, {
				expectedRevision
			});
		},

		start(processId: string, input: unknown): Promise<CorexStartedRun> {
			return command(`/corex/api/processes/${encodeURIComponent(processId)}/runs`, { input });
		},

		signal(runId: string, type: string, payload: unknown): Promise<{ accepted: true }> {
			return command(`/corex/api/runs/${encodeURIComponent(runId)}/events`, { type, payload }, {
				404: 'run_not_found',
				409: 'run_not_accepting_event'
			});
		}
	};
}

export type CorexCommandGateway = ReturnType<typeof createCorexCommandGateway>;