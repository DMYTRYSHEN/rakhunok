import { decodeChange } from '../../../apps/pay/src/lib/services/checkout-contract.ts';
import type { OutboxEvent } from './persistence.ts';

export const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const exact = (v: Record<string, unknown>, keys: string[]) => Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
const uuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const positive = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v > 0;

export { decodeAccepted } from '../../../apps/pay/src/lib/services/checkout-attempt.ts';

export function decodeOutboxEvent(value: unknown): OutboxEvent {
  if (!record(value) || !exact(value, ['id', 'kind', 'resourceId', 'revision', 'aliases', 'deleted', 'claimToken']) ||
      !uuid(value.claimToken) || !positive(value.revision) || typeof value.deleted !== 'boolean' ||
      !Array.isArray(value.aliases) || value.aliases.length > 100 ||
      !value.aliases.every(a => a === null || (typeof a === 'string' && a.length <= 256))) throw new Error('invalid_event');
  const change = decodeChange({ documentType: 'change', schemaVersion: 1, eventId: value.id,
    resource: { kind: value.kind, id: value.resourceId }, revision: value.revision });
  return { id: change.eventId, kind: change.resource.kind, resourceId: change.resource.id,
    revision: change.revision, aliases: value.aliases, deleted: value.deleted, claimToken: value.claimToken };
}

/** Bounded JSON for local RPCs too: a broken upstream must not exhaust the isolate. */
export async function readJson(response: Response, limit = 65536): Promise<unknown> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error('empty_rpc_response');
  let size = 0;
  const chunks: Uint8Array[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > limit) { await reader.cancel(); throw new Error('rpc_response_too_large'); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
}