import { assertLocalUrl, postgresAdapter, type CheckoutPersistence } from './persistence.ts';
import { drainOutbox, type CheckoutCache } from './outbox.ts';
import { decodeSnapshot } from '../../../apps/pay/src/lib/services/checkout-contract.ts';
import { decodeAccepted, record } from './validation.ts';

interface Env {
  CHECKOUT_MODE?: string;
  CHECKOUT_DATABASE_URL?: string;
  CHECKOUT_DATABASE_SERVICE_KEY?: string;
  CHECKOUT_CACHE?: CheckoutCache;
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function response(value: unknown, status = 200): Response {
  return Response.json(value, { status, headers: {
    'Cache-Control': 'no-store, private, max-age=0', 'CDN-Cache-Control': 'no-store',
    'Cloudflare-CDN-Cache-Control': 'no-store', 'Vary': 'Authorization',
    'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer'
  } });
}
function database(env: Env) {
  if (env.CHECKOUT_MODE !== 'local') throw new Error('local_only');
  return postgresAdapter(env.CHECKOUT_DATABASE_URL ?? '', env.CHECKOUT_DATABASE_SERVICE_KEY ?? '');
}
async function tokenHash(request: Request) {
  const match = /^Bearer ([A-Za-z0-9_-]{43,128})$/.exec(request.headers.get('Authorization') ?? '');
  if (!match) return null;
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(match[1]));
  return Array.from(new Uint8Array(hash), x => x.toString(16).padStart(2, '0')).join('');
}

/** No old Worker imports, aliases, direct Supabase fallback, bank callback or cache reads. */
export async function handle(request: Request, db: CheckoutPersistence): Promise<Response> {
  const url = new URL(request.url);
  const route = /^\/api\/checkout\/v1\/(invoice|terminal)\/([^/]+)\/(snapshot|attempts)$/.exec(url.pathname);
  if (!route || !uuid.test(route[2])) return response({ error: 'not_found' }, 404);
  const [, kind, rawId, operation] = route;
  if (request.method !== (operation === 'snapshot' ? 'GET' : 'POST')) return response({ error: 'method_not_allowed' }, 405);
  const hash = await tokenHash(request);
  if (!hash) return response({ error: 'inaccessible' }, 403);
  const input = { p_kind: kind, p_id: rawId.toLowerCase(), p_token_hash: hash };
  let result;
  if (operation === 'snapshot') {
    if ([...url.searchParams.keys()].some(k => k !== 'minimumRevision') || url.searchParams.getAll('minimumRevision').length > 1) {
      return response({ error: 'invalid_request' }, 400);
    }
    const raw = url.searchParams.get('minimumRevision') ?? '0';
    const minimum = Number(raw);
    if (!/^\d+$/.test(raw) || !Number.isSafeInteger(minimum)) return response({ error: 'invalid_revision' }, 400);
    result = await db.read({ ...input, p_minimum_revision: minimum });
    if (record(result) && result.kind === 'snapshot' && Object.keys(result).length === 2) {
      const snapshot = decodeSnapshot(result.value);
      if (!snapshot || snapshot.source !== 'authoritative' || snapshot.resource.kind !== kind ||
          snapshot.resource.id !== input.p_id || snapshot.revision < minimum) throw new Error('invalid_snapshot');
      return response(snapshot);
    }
  } else {
    if (url.search || request.headers.get('Content-Type')?.split(';')[0]?.trim().toLowerCase() !== 'application/json') return response({ error: 'invalid_request' }, 400);
    // Read a bounded stream, not an unbounded request.json().
    const reader = request.body?.getReader();
    if (!reader) return response({ error: 'invalid_request' }, 400);
    let length = 0; const chunks: Uint8Array[] = [];
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > 2048) { await reader.cancel(); return response({ error: 'too_large' }, 413); }
      chunks.push(value);
    }
    let body;
    try {
      const bytes = new Uint8Array(length); let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
      body = JSON.parse(new TextDecoder().decode(bytes));
    } catch { return response({ error: 'invalid_json' }, 400); }
    const key = request.headers.get('Idempotency-Key');
    if (!body || Array.isArray(body) || Object.keys(body).sort().join(',') !== 'orderId,orderRevision' ||
        typeof body.orderId !== 'string' || !uuid.test(body.orderId) ||
        !Number.isSafeInteger(body.orderRevision) || body.orderRevision < 1 ||
        !key || !/^[A-Za-z0-9_-]{8,128}$/.test(key)) return response({ error: 'invalid_request' }, 400);
    result = await db.initiate({ ...input, p_order_id: body.orderId.toLowerCase(),
      p_order_revision: body.orderRevision, p_idempotency_key: key });
    if (record(result) && result.kind === 'accepted') {
      const accepted = decodeAccepted(result, body.orderId.toLowerCase(), body.orderRevision);
      return response(accepted, accepted.replayed ? 200 : 201);
    }
  }
  const codes: Record<string, number> = { inaccessible: 403, lag: 409, conflict: 409,
    'not-payable': 409, 'invalid-recipient': 422 };
  if (!record(result) || Object.keys(result).length !== 1 || typeof result.kind !== 'string' ||
      !Object.hasOwn(codes, result.kind)) throw new Error('invalid_persistence_result');
  return response({ error: result.kind }, codes[result.kind]);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      assertLocalUrl(request.url, true);
      return await handle(request, database(env));
    } catch { return response({ error: 'checkout_unavailable' }, 503); }
  },
  async scheduled(_event: unknown, env: Env): Promise<void> {
    const db = database(env);
    if (!env.CHECKOUT_CACHE) throw new Error('local_cache_not_configured');
    await drainOutbox(db, env.CHECKOUT_CACHE);
  }
};