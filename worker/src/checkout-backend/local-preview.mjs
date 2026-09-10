// Node-only, local server-memory adapter. NOT Cloudflare Cache API/KV.
// Preview may be stale (including paid); never payment/status authority.
import { timingSafeEqual } from 'node:crypto';
import { decodeSnapshot } from '../../../apps/pay/src/lib/services/checkout-contract.ts';
import { readJson, record } from './validation.ts';

const path = '/__local/preview';
const ttl = 30_000;
const response = (status, value) => Response.json(value, { status, headers: {
  'Cache-Control': 'no-store, private, max-age=0',
  'CDN-Cache-Control': 'no-store', 'Cloudflare-CDN-Cache-Control': 'no-store',
  'Vary': 'Authorization', 'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff'
} });
const failure = (status, error) => response(status, { error });

// Exact existing capability columns; do NOT cache this decision or consult
// context existence alone. Tombstones and missing physical orders deny access.
const accessSql = `select exists (
  select 1 from checkout_private.capabilities c
  join checkout_private.resources r on r.kind=c.kind and r.id=c.resource_id
  join public.orders o on o.id=r.id
  where c.token_hash=$1 and c.kind='invoice' and c.resource_id=$2
    and c.revoked_at is null and c.expires_at>clock_timestamp()
    and not r.deleted
) as authorized`;

/** HTTP host MUST enforce its exact bootstrap secret before calling handle.
 * No timers, polling, subscriptions, initiation, or remote cache transport.
 */
export function createLocalPreview({ pool, db, contexts, now = Date.now }) {
  // One entry maximum across identities AND revisions, for the local fixture.
  // Keys never contain credentials. Values are recursively frozen by decoder.
  const cache = new Map();

  return {
    async handle(request) {
      try {
        const url = new URL(request.url);
        if (url.pathname !== path) return failure(404, 'not_found');
        if (request.method !== 'POST') return failure(405, 'method_not_allowed');
        // URL.search alone misses a bare trailing '?'. Fragments are not input.
        if (request.url.includes('?') || request.url.includes('#') ||
            !/^application\/json(?:\s*;\s*charset\s*=\s*(?:utf-8|"utf-8"))?$/i.test(
              request.headers.get('Content-Type') ?? '') ||
            request.headers.has('Content-Encoding')) return failure(400, 'invalid_request');
        const bearer = /^Bearer ([A-Za-z0-9_-]{43,128})$/.exec(request.headers.get('Authorization') ?? '');
        const token = bearer && Buffer.from(bearer[1]);
        const context = token && contexts.find(c => typeof c.token === 'string' &&
          Buffer.byteLength(c.token) === token.length && timingSafeEqual(Buffer.from(c.token), token));
        if (!context || context.resource?.kind !== 'invoice') return failure(403, 'inaccessible');

        let body;
        try { body = await readJson(request, 2048); }
        catch (error) { return failure(error.message === 'rpc_response_too_large' ? 413 : 400,
          error.message === 'rpc_response_too_large' ? 'too_large' : 'invalid_request'); }
        if (!record(body) || Object.keys(body).length !== 0) return failure(400, 'invalid_request');

        // Always execute, even when the preview is already cached.
        const access = await pool.query(accessSql, [context.hash, context.resource.id]);
        if (!Array.isArray(access?.rows) || access.rows.length !== 1 ||
            !record(access.rows[0]) || Object.keys(access.rows[0]).join(',') !== 'authorized' ||
            typeof access.rows[0].authorized !== 'boolean') throw new Error('invalid_access_result');
        if (!access.rows[0].authorized) return failure(403, 'inaccessible');

        const stamp = now();
        if (!Number.isFinite(stamp)) throw new Error('invalid_clock');
        for (const [key, entry] of cache) {
          if (stamp < entry.createdAt || stamp >= entry.expiresAt) cache.delete(key);
          else if (entry.snapshot.resource.id === context.resource.id) return response(200, entry.snapshot);
        }

        const result = await db.read({ p_kind: 'invoice', p_id: context.resource.id,
          p_token_hash: context.hash, p_minimum_revision: 0 });
        if (record(result) && Object.keys(result).join(',') === 'kind' && result.kind === 'inaccessible') {
          return failure(403, 'inaccessible');
        }
        if (!record(result) || Object.keys(result).sort().join(',') !== 'kind,value' ||
            result.kind !== 'snapshot') throw new Error('invalid_authority_result');
        const authoritative = decodeSnapshot(result.value);
        if (authoritative.source !== 'authoritative' || authoritative.resource.kind !== 'invoice' ||
            authoritative.resource.id !== context.resource.id || authoritative.revision < 1) {
          throw new Error('invalid_authority_snapshot');
        }
        // Preserve actual amount, state, revision and observedAt; no made-up data.
        const snapshot = decodeSnapshot({ ...authoritative, source: 'cache', canInitiate: false });
        cache.clear();
        cache.set(`invoice:${snapshot.resource.id}:${snapshot.revision}`,
          Object.freeze({ snapshot, createdAt: stamp, expiresAt: stamp + ttl }));
        return response(200, snapshot);
      } catch { return failure(503, 'checkout_unavailable'); }
    }
  };
}