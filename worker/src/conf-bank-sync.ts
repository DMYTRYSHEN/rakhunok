export interface BankSyncEnv {
	BANK_CATALOG_DB?: D1Database;
	CONF_SUPABASE_URL?: string;
	CONF_SUPABASE_PUBLISHABLE_KEY?: string;
	CONF_BANK_SYNC_ADMIN_IDS?: string;
}

function reply(status: number, body: Record<string, unknown>): Response {
	return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

function canonicalize(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(canonicalize);
	if (value !== null && typeof value === 'object') {
		return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
			.map(([key, entry]) => [key, canonicalize(entry)]));
	}
	return value;
}

async function readBoundedJson(response: Response): Promise<unknown> {
	const reader = response.body?.getReader();
	if (!reader) throw new Error('empty_response');
	const chunks: Uint8Array[] = [];
	let size = 0;
	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			size += value.byteLength;
			if (size > 1_500_000) throw new Error('source_too_large');
			chunks.push(value);
		}
	} finally {
		await reader.cancel();
	}
	const bytes = new Uint8Array(size);
	let offset = 0;
	for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
	return JSON.parse(new TextDecoder().decode(bytes));
}

export async function syncBanks(request: Request, env: BankSyncEnv): Promise<Response> {
	if (request.method !== 'POST') return reply(405, { error: 'method_not_allowed' });
	const admins = env.CONF_BANK_SYNC_ADMIN_IDS?.split(',').map((id) => id.trim()).filter(Boolean);
	if (!env.BANK_CATALOG_DB || !env.CONF_SUPABASE_URL || !env.CONF_SUPABASE_PUBLISHABLE_KEY || !admins?.length) {
		return reply(503, { error: 'sync_not_configured' });
	}
	const origin = request.headers.get('Origin');
	if (origin && origin !== new URL(request.url).origin) return reply(403, { error: 'origin_not_allowed' });
	const authorization = request.headers.get('Authorization');
	if (!authorization || !/^Bearer [^\s]+$/i.test(authorization)) return reply(401, { error: 'authentication_required' });
	let source: URL;
	try {
		source = new URL(env.CONF_SUPABASE_URL);
		if (source.protocol !== 'https:' || source.username || source.password || source.pathname !== '/' || source.search || source.hash) throw new Error();
	} catch { return reply(503, { error: 'sync_not_configured' }); }
	const headers = { apikey: env.CONF_SUPABASE_PUBLISHABLE_KEY, Authorization: authorization };
	let user: { id?: unknown; is_anonymous?: unknown };
	try {
		const response = await fetch(new URL('/auth/v1/user', source), {
			headers, redirect: 'manual', signal: AbortSignal.timeout(10_000)
		});
		if (response.status === 401 || response.status === 403) return reply(401, { error: 'authentication_required' });
		if (!response.ok) {
			console.warn('conf_bank_sync_auth_http', response.status);
			return reply(502, { error: 'auth_unavailable' });
		}
		user = await response.json();
	} catch (error) {
		console.warn('conf_bank_sync_auth_failure', error instanceof Error ? error.name : 'UnknownError');
		return reply(502, { error: 'auth_unavailable' });
	}
	if (!user || typeof user.id !== 'string' || user.is_anonymous === true || (!admins.includes('*') && !admins.includes(user.id))) {
		return reply(403, { error: 'sync_forbidden' });
	}
	let rows: Record<string, unknown>[];
	try {
		const response = await fetch(new URL('/rest/v1/banklink?select=*&order=id.asc&limit=501', source), {
			headers: { ...headers, Prefer: 'count=exact' }, redirect: 'manual', signal: AbortSignal.timeout(15_000)
		});
		if (!response.ok) throw new Error();
		const data = await readBoundedJson(response);
		const range = response.headers.get('Content-Range')?.match(/^0-(\d+)\/(\d+)$/);
		if (!Array.isArray(data) || !data.length || data.length > 500 || !range || Number(range[1]) + 1 !== data.length || Number(range[2]) !== data.length) {
			return reply(422, { error: 'source_incomplete_or_empty' });
		}
		const ids = new Set<string>();
		for (const row of data) {
			if (!row || typeof row !== 'object' || Array.isArray(row) ||
				['id', 'code', 'name'].some((field) => typeof row[field] !== 'string' || !row[field].trim() || row[field].length > 256) || ids.has(row.id)) {
				return reply(422, { error: 'source_invalid' });
			}
			
			// Rewrite logo URL to use R2 proxy
			if (typeof row.logo === 'string' && row.logo.startsWith('http') && !row.logo.includes('/api/v1/bank-logo/')) {
				row.logo = `https://rhnk.pp.ua/api/v1/bank-logo/${row.code}?url=${encodeURIComponent(row.logo)}`;
			}
			
			ids.add(row.id);
		}
		rows = data.sort((left, right) => left.id < right.id ? -1 : left.id > right.id ? 1 : 0);
	} catch { return reply(502, { error: 'source_unavailable' }); }
	const payload = JSON.stringify(canonicalize(rows));
	const sourceUrl = `${source.origin}/rest/v1/banklink`;
	const hashBytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${sourceUrl}\n${payload}`));
	const hash = Array.from(new Uint8Array(hashBytes), (byte) => byte.toString(16).padStart(2, '0')).join('');
	try {
		const results = await env.BANK_CATALOG_DB.batch([
			env.BANK_CATALOG_DB.prepare(`INSERT INTO conf_bank_snapshots
				(content_hash, source_url, payload_json, bank_count, imported_by, imported_at)
				VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(content_hash) DO NOTHING`)
				.bind(hash, sourceUrl, payload, rows.length, user.id, new Date().toISOString()),
			env.BANK_CATALOG_DB.prepare('SELECT content_hash, bank_count, imported_at FROM conf_bank_snapshots WHERE content_hash = ?').bind(hash),
			env.BANK_CATALOG_DB.prepare('DELETE FROM conf_banks WHERE snapshot_hash <> ?').bind(hash),
			env.BANK_CATALOG_DB.prepare(`INSERT INTO conf_banks (id, payload_json, snapshot_hash)
				SELECT json_extract(bank.value, '$.id'), bank.value, snapshot.content_hash
				FROM conf_bank_snapshots AS snapshot, json_each(snapshot.payload_json) AS bank
				WHERE snapshot.content_hash = ? ON CONFLICT(id) DO NOTHING`).bind(hash)
		]);
		if (results.some((result) => !result.success) || !results[1].results[0]) throw new Error();
		return reply(200, { status: results[0].meta.changes ? 'imported' : 'unchanged', snapshot: results[1].results[0] });
	} catch { return reply(503, { error: 'snapshot_storage_unavailable' }); }
}