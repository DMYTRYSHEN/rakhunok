export type CorexHttpRouteDesiredState = {
	environmentId: string;
	routeNamespace: string;
	httpMethod: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
	routePath: string;
	desiredStatus: 'present' | 'absent';
	desiredTriggerId: string | null;
	desiredFingerprint: string;
};

export interface CorexHttpRouteAdapter {
	reconcile(route: CorexHttpRouteDesiredState): Promise<{ observedFingerprint: string }>;
}

export function readCorexHttpRouteAdapterBinding(env: object): CorexHttpRouteAdapter | undefined {
	const candidate = Reflect.get(env, 'COREX_HTTP_ROUTE_ADAPTER') as unknown;
	if (typeof candidate !== 'object' || candidate === null) return undefined;
	const reconcile = Reflect.get(candidate, 'reconcile') as unknown;
	return typeof reconcile === 'function' ? (candidate as CorexHttpRouteAdapter) : undefined;
}

type CorexHttpRouteReconciliationOptions = {
	url: string;
	serviceRoleKey: string;
	adapter: CorexHttpRouteAdapter;
	fetcher?: typeof fetch;
};

type ClaimedRoute = CorexHttpRouteDesiredState & {
	attempts: number;
	claimToken: string;
};

const HTTP_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);
const SHA256_PATTERN = /^[a-f0-9]{64}$/;

function rpcHeaders(serviceRoleKey: string): HeadersInit {
	return {
		Authorization: `Bearer ${serviceRoleKey}`,
		apikey: serviceRoleKey,
		'Content-Type': 'application/json'
	};
}

function isClaimedRoute(value: unknown): value is ClaimedRoute {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
	const route = value as Record<string, unknown>;
	const desiredStateIsValid =
		(route.desiredStatus === 'present' && typeof route.desiredTriggerId === 'string') ||
		(route.desiredStatus === 'absent' && route.desiredTriggerId === null);
	return (
		typeof route.environmentId === 'string' &&
		typeof route.routeNamespace === 'string' &&
		typeof route.httpMethod === 'string' &&
		HTTP_METHODS.has(route.httpMethod) &&
		typeof route.routePath === 'string' &&
		desiredStateIsValid &&
		typeof route.desiredFingerprint === 'string' &&
		SHA256_PATTERN.test(route.desiredFingerprint) &&
		Number.isSafeInteger(route.attempts) &&
		typeof route.claimToken === 'string'
	);
}

export async function reconcileCorexHttpRoutes(
	options: CorexHttpRouteReconciliationOptions
): Promise<{ claimed: number; reconciled: number; failed: number }> {
	const fetcher = options.fetcher ?? fetch;
	const baseUrl = options.url.replace(/\/+$/, '');
	const headers = rpcHeaders(options.serviceRoleKey);
	const claimResponse = await fetcher(
		`${baseUrl}/rest/v1/rpc/corex_claim_http_route_reconciliation`,
		{
			method: 'POST',
			headers,
			body: JSON.stringify({ p_limit: 10, p_lease_seconds: 120 })
		}
	);
	if (!claimResponse.ok) throw new Error('Could not claim Corex HTTP routes for reconciliation.');
	const claimed: unknown = await claimResponse.json();
	if (!Array.isArray(claimed) || claimed.some((route) => !isClaimedRoute(route))) {
		throw new Error('Corex HTTP route reconciliation returned invalid data.');
	}

	let reconciled = 0;
	let failed = 0;
	for (const route of claimed as ClaimedRoute[]) {
		let observedFingerprint: string | undefined;
		try {
			const observed = await options.adapter.reconcile(route);
			if (
				SHA256_PATTERN.test(observed.observedFingerprint) &&
				observed.observedFingerprint === route.desiredFingerprint
			) {
				observedFingerprint = observed.observedFingerprint;
			}
		} catch {
			observedFingerprint = undefined;
		}

		const updateResponse = await fetcher(
			`${baseUrl}/rest/v1/rpc/${
				observedFingerprint
					? 'corex_ack_http_route_reconciliation'
					: 'corex_fail_http_route_reconciliation'
			}`,
			{
				method: 'POST',
				headers,
				body: JSON.stringify({
					p_claim_token: route.claimToken,
					...(observedFingerprint
						? { p_observed_fingerprint: observedFingerprint }
						: { p_error: { code: 'http_route_reconciliation_failed' } })
				})
			}
		);
		if (!updateResponse.ok)
			throw new Error('Could not update Corex HTTP route reconciliation state.');
		if (observedFingerprint) reconciled += 1;
		else failed += 1;
	}

	return { claimed: claimed.length, reconciled, failed };
}
