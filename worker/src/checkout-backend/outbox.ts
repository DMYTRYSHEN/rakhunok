import type { CheckoutPersistence, OutboxEvent } from './persistence.ts';
import { decodeOutboxEvent } from './validation.ts';

export interface CheckoutCache {
  delete(key: string): Promise<unknown>;
  put(key: string, value: string, options: { expirationTtl: number }): Promise<unknown>;
}

/** Local namespace only. No mutable "latest revision" writes: KV has no CAS. */
export async function deliverEvent(event: OutboxEvent, cache: CheckoutCache): Promise<void> {
  event = decodeOutboxEvent(event);
  const prefix = `checkout:local:v1:${event.kind}:`;
  const aliases = new Set([event.resourceId, ...event.aliases.filter((a): a is string => a !== null)]);
  for (const alias of aliases) await cache.delete(`${prefix}alias:${encodeURIComponent(alias)}`);
  // A revision-keyed notification/tombstone is immutable and contains no order PII.
  await cache.put(`${prefix}${event.resourceId}:revision:${event.revision}`, JSON.stringify({
    documentType: 'change', schemaVersion: 1, eventId: event.id,
    resource: { kind: event.kind, id: event.resourceId }, revision: event.revision
  }), { expirationTtl: 86400 });
}

export async function drainOutbox(db: CheckoutPersistence, cache: CheckoutCache): Promise<{ delivered: number; failed: number }> {
  const result = { delivered: 0, failed: 0 };
  for (const event of await db.claim()) {
    let success = false;
    try { await deliverEvent(event, cache); success = true; } catch { /* durable retry below */ }
    const acknowledged = await db.finish(event.id, event.claimToken, success);
    if (success && acknowledged) result.delivered++; else result.failed++;
  }
  return result;
}