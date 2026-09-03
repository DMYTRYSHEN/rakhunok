type CorexRunRetentionOptions = {
	url: string;
	serviceRoleKey: string;
	fetcher?: typeof fetch;
	outputBucket?: Pick<R2Bucket, 'delete'>;
};

type ClaimedPurge = {
	id: string;
	runId: string;
	objectKeys: string[];
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

function isClaimedPurge(value: unknown): value is ClaimedPurge {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
	const job = value as Record<string, unknown>;
	return (
		typeof job.id === 'string' &&
		typeof job.runId === 'string' &&
		Array.isArray(job.objectKeys) &&
		job.objectKeys.every((key) => typeof key === 'string' && key.startsWith('corex-output/')) &&
		Number.isSafeInteger(job.attempts) &&
		Number(job.attempts) > 0 &&
		typeof job.claimToken === 'string'
	);
}

export async function purgeRetainedCorexRuns(options: CorexRunRetentionOptions): Promise<{
	claimed: number;
	purged: number;
	failed: number;
}> {
	const fetcher = options.fetcher ?? fetch;
	const baseUrl = options.url.replace(/\/+$/, '');
	const headers = rpcHeaders(options.serviceRoleKey);
	const claimResponse = await fetcher(`${baseUrl}/rest/v1/rpc/corex_claim_retention_purges`, {
		method: 'POST',
		headers,
		body: JSON.stringify({ p_limit: 10, p_lease_seconds: 120, p_retention_days: 30 })
	});
	if (!claimResponse.ok) throw new Error('Could not claim retained Corex runs for purge.');
	const claimed: unknown = await claimResponse.json();
	if (!Array.isArray(claimed) || claimed.some((job) => !isClaimedPurge(job))) {
		throw new Error('Corex retention purge returned invalid data.');
	}

	let purged = 0;
	let failed = 0;
	for (const job of claimed as ClaimedPurge[]) {
		let failureCode: string | undefined;
		try {
			if (job.objectKeys.length > 0) {
				if (!options.outputBucket) throw new Error('output_storage_unavailable');
				for (let offset = 0; offset < job.objectKeys.length; offset += 1_000) {
					await options.outputBucket.delete(job.objectKeys.slice(offset, offset + 1_000));
				}
			}
		} catch (error) {
			failureCode =
				error instanceof Error && error.message === 'output_storage_unavailable'
					? 'output_storage_unavailable'
					: 'output_deletion_failed';
		}

		const updateResponse = await fetcher(
			`${baseUrl}/rest/v1/rpc/${
				failureCode ? 'corex_fail_retention_purge' : 'corex_complete_retention_purge'
			}`,
			{
				method: 'POST',
				headers,
				body: JSON.stringify({
					p_job_id: job.id,
					p_claim_token: job.claimToken,
					...(failureCode ? { p_error: { code: failureCode } } : {})
				})
			}
		);
		if (!updateResponse.ok) throw new Error('Could not update Corex retention purge state.');
		if (failureCode) failed += 1;
		else purged += 1;
	}

	return { claimed: claimed.length, purged, failed };
}
