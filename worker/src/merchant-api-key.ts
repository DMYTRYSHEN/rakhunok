export interface MerchantApiKeyEnv {
	SUPABASE_URL?: string;
	SUPABASE_SERVICE_ROLE_KEY?: string;
}

function response(body: unknown, status: number): Response {
	return Response.json(body, {
		status,
		headers: { 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' }
	});
}

export async function handleMerchantApiKey(request: Request, env: MerchantApiKeyEnv): Promise<Response | null> {
	const authorization = request.headers.get('Authorization') ?? '';
	if (!/^(?:\S+\s+)?rhk_/i.test(authorization)) return null;
	const match = authorization.match(/^Bearer (rhk_live_[a-f0-9]{64})$/i);
	if (!match || !/^rhk_live_[a-f0-9]{64}$/.test(match[1])) return response({ error: 'Unauthorized' }, 401);
	const url = new URL(request.url);
	const route = url.pathname.match(/^\/api\/v1\/(orders|stats)(?:\/([a-zA-Z0-9_-]+))?$/);
	if (!route || !['GET', 'POST'].includes(request.method) ||
		(route[1] === 'stats' && (request.method !== 'GET' || route[2])) ||
		(request.method === 'POST' && route[2]) || (request.method === 'PATCH' && !route[2])) {
		return response({ error: 'Merchant API key not allowed for this operation' }, 403);
	}
	const idempotencyKey = request.headers.get('Idempotency-Key');
	if (idempotencyKey !== null && (request.method !== 'POST' || route[1] !== 'orders' ||
		! /^[A-Za-z0-9._:-]{1,128}$/.test(idempotencyKey))) {
		return response({ error: 'Invalid Idempotency-Key' }, 400);
	}
	if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return response({ error: 'Service unavailable' }, 503);
	let body: unknown = {};
	if (request.method !== 'GET') {
		try {
			body = await request.json();
			if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error();
		} catch {
			return response({ error: 'Invalid JSON payload' }, 400);
		}
	}
	try {
		const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(match[1]));
		const secretHash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
		const upstream = await fetch(`${env.SUPABASE_URL.replace(/\/$/, '')}/rest/v1/rpc/merchant_api_operations`, {
			method: 'POST',
			redirect: 'error',
			signal: AbortSignal.timeout(10000),
			headers: {
				apikey: env.SUPABASE_SERVICE_ROLE_KEY,
				Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ p_secret_hash: secretHash, p_method: request.method,
				p_resource: route[1], p_resource_id: route[2] ?? null, p_query: Object.fromEntries(url.searchParams),
				p_body: body, p_idempotency_key: idempotencyKey })
		});
		if (!upstream.ok) return response({ error: 'Service unavailable' }, 503);
		const result = await upstream.json() as { status?: number; body?: Record<string, unknown>; retry_after?: number };
		if (!result || ![200, 400, 401, 403, 404, 409, 422, 429, 503].includes(result.status ?? 0) ||
			!result.body || typeof result.body !== 'object' || Array.isArray(result.body)) {
			return response({ error: 'Service unavailable' }, 503);
		}
		if (result.status === 200) {
			if (route[1] === 'stats') {
				if (!Number.isSafeInteger(result.body.orders) || !Array.isArray(result.body.daily) ||
					typeof result.body.timezone !== 'string') return response({ error: 'Service unavailable' }, 503);
			} else if (request.method === 'GET') {
				if (route[2] ? result.body.id !== route[2] : !Array.isArray(result.body.orders)) {
					return response({ error: 'Service unavailable' }, 503);
				}
			} else {
				const order = result.body.order as Record<string, unknown> | undefined;
				if (result.body.success !== true || !order || typeof order.id !== 'string' || !order.id.trim() ||
					(request.method === 'PATCH' && order.id !== route[2])) {
					return response({ error: 'Service unavailable' }, 503);
				}
				if (request.method === 'POST') {
					result.body.order = { ...order, share_url: `${url.origin}/pay/${encodeURIComponent(order.id)}` };
				}
			}
		}
		const outgoing = response(result.body, result.status!);
		if (result.status === 429) {
			if (!Number.isInteger(result.retry_after) || result.retry_after! < 1 || result.retry_after! > 3600) {
				return response({ error: 'Service unavailable' }, 503);
			}
			outgoing.headers.set('Retry-After', String(result.retry_after));
			outgoing.headers.set('Access-Control-Expose-Headers', 'Retry-After');
		}
		return outgoing;
	} catch {
		return response({ error: 'Service unavailable' }, 503);
	}
}