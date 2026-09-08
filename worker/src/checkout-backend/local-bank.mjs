// Synthetic Node-only bank adapter. No legacy Worker or remote transport.
import { createHmac, randomBytes } from 'node:crypto';
import { Readable } from 'node:stream';
import { verifySettlement } from './settlement-auth.ts';
import { readJson, record } from './validation.ts';
import { retryTransaction } from './retry.ts';

const webhook = '/__local/bank/webhook';
const deliver = '/__local/bank/deliver';
const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const response = (status, value) => Response.json(value, { status, headers: {
  'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff'
} });
const failure = (status, error) => response(status, { error });
function outcome(value) {
  if (!record(value) || Object.keys(value).sort().join(',') !== 'outcome,replayed' ||
      !['paid', 'review'].includes(value.outcome) || typeof value.replayed !== 'boolean') {
    throw new Error('invalid_settlement_response');
  }
  return { outcome: value.outcome, replayed: value.replayed };
}

/** Preserve signed bytes; the consuming verifier/readJson enforces its bound. */
export function rawRequest(req, url) {
  return new Request(url, { method: req.method, headers: req.headers,
    ...(!['GET', 'HEAD'].includes(req.method) ? { body: Readable.toWeb(req), duplex: 'half' } : {}) });
}

/** Bootstrap authorization belongs to the HTTP host, before calling this router. */
export function createLocalBank({ pool, contexts, db, key = randomBytes(32), origin, enabled = false }) {
  const target = new URL(origin);
  if (target.protocol !== 'http:' || target.hostname !== '127.0.0.1' ||
      target.username || target.password || target.pathname !== '/' || target.search || target.hash) {
    throw new Error('literal_loopback_origin_required');
  }
  if (!(key instanceof Uint8Array) || key.byteLength !== 32) throw new Error('invalid_bank_key');
  const secret = Buffer.from(key);
  const destination = new URL(webhook, target).href;
  // Cache promises before awaiting PG, so simultaneous clicks share the same event.
  // Failed transport does NOT evict an event: retries must retain its exact bytes.
  const events = new Map();
  let lastStamp = 0;

  async function ingress(request) {
    let event;
    try { event = await verifySettlement(request, secret); }
    catch (error) {
      if (error.message === 'too_large') return failure(413, 'too_large');
      if (error.message === 'invalid_signature') return failure(401, 'invalid_signature');
      return failure(400, 'invalid_event');
    }
    try {
      const result = await retryTransaction(() => pool.query(
        'select public.checkout_record_settlement($1,$2,$3,$4,$5,$6,$7,$8) as value',
        ['local-bank', event.eventId, event.attemptId, event.amountMinor, event.currency,
          event.iban, event.reference, event.occurredAt]));
      return response(200, outcome(result.rows[0]?.value));
    } catch (error) {
      if (error.code === 'P0001' && [
        'checkout_settlement_identity_conflict', 'checkout_settlement_quote_mismatch',
        'checkout_unknown_attempt', 'checkout_invalid_settlement'
      ].includes(error.message)) return failure(409, 'settlement_rejected');
      return failure(503, 'checkout_unavailable');
    }
  }

  async function simulate(request) {
    const bearer = /^Bearer ([A-Za-z0-9_-]{43,128})$/.exec(request.headers.get('Authorization') ?? '');
    const context = bearer && contexts.find(c => c.token === bearer[1]);
    if (!context) return failure(403, 'inaccessible');
    let body;
    try { body = await readJson(request, 4096); }
    catch (error) { return failure(error.message === 'rpc_response_too_large' ? 413 : 400,
      error.message === 'rpc_response_too_large' ? 'too_large' : 'invalid_request'); }
    if (!record(body) || Object.keys(body).join(',') !== 'attemptId' ||
        typeof body.attemptId !== 'string' || !uuid.test(body.attemptId)) return failure(400, 'invalid_request');
    const attemptId = body.attemptId.toLowerCase();
    const access = await db.read({ p_kind: context.resource.kind, p_id: context.resource.id,
      p_token_hash: context.hash, p_minimum_revision: 0 });
    if (access?.kind !== 'snapshot') return failure(403, 'inaccessible');
    // Scope is stored in request.kind/resourceId, NOT quote.orderId (terminal != invoice).
    const { rows } = await pool.query(
      'select id, token_hash, request, quote from checkout_private.attempts where id=$1', [attemptId]);
    const attempt = rows[0];
    if (!attempt || attempt.token_hash !== context.hash ||
        attempt.request?.kind !== context.resource.kind ||
        attempt.request?.resourceId !== context.resource.id) return failure(403, 'inaccessible');
    if (!events.has(attemptId)) {
      const pending = (async () => {
        // Never round through JS Date: PG microseconds must remain >= created_at.
        const clock = await pool.query('select clock_timestamp()::text as occurred_at');
        const quote = attempt.quote;
        const event = { eventId: `local-${attemptId}`, attemptId,
          amountMinor: quote.amountMinor, currency: quote.currency, iban: quote.recipient?.iban,
          reference: `local-${attemptId}`, occurredAt: clock.rows[0]?.occurred_at };
        if (!Number.isSafeInteger(event.amountMinor) || event.amountMinor < 1 || event.currency !== 'UAH' ||
            typeof event.iban !== 'string' || !/^UA[0-9]{27}$/.test(event.iban) ||
            typeof event.occurredAt !== 'string' || !Number.isFinite(Date.parse(event.occurredAt))) {
          throw new Error('invalid_stored_quote');
        }
        return JSON.stringify(event);
      })();
      events.set(attemptId, pending);
      // Only failure before an event exists may be retried with a fresh PG clock.
      void pending.catch(() => { if (events.get(attemptId) === pending) events.delete(attemptId); });
    }
    const eventBody = await events.get(attemptId);
    const stamp = String(lastStamp = Math.max(Date.now(), lastStamp + 1));
    const signature = createHmac('sha256', secret)
      .update(`POST\n${webhook}\n${stamp}\n`).update(eventBody).digest('hex');
    let result;
    try {
      // Actual HTTP, fixed destination, no redirect/override, bounded wait and JSON.
      const received = await fetch(destination, { method: 'POST', redirect: 'error',
        signal: AbortSignal.timeout(5000), headers: { 'Content-Type': 'application/json',
          'X-Settlement-Timestamp': stamp, 'X-Settlement-Signature': signature }, body: eventBody });
      const value = await readJson(received, 4096);
      if (!received.ok) return failure(received.status === 409 ? 409 : 502, 'bank_delivery_failed');
      result = outcome(value);
    } catch { return failure(502, 'bank_delivery_failed'); }
    // A delivery receipt only. UI paid authority must come from checkout snapshots.
    return response(200, { synthetic: true, ...result });
  }

  return {
    async handle(request) {
      const url = new URL(request.url);
      if (![webhook, deliver].includes(url.pathname)) return failure(404, 'not_found');
      if (enabled !== true) return failure(403, 'simulator_disabled');
      if (url.origin !== target.origin) return failure(403, 'local_only');
      if (request.method !== 'POST') return failure(405, 'method_not_allowed');
      if (url.search || request.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
        return failure(400, 'invalid_request');
      }
      try { return await (url.pathname === webhook ? ingress(request) : simulate(request)); }
      catch { return failure(503, 'checkout_unavailable'); }
    }
  };
}