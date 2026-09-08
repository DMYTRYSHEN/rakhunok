/** Proposed v1 boundary, deliberately not wired to the legacy checkout store. */
export type Resource = Readonly<{ kind: 'invoice' | 'terminal'; id: string }>;
export type BusinessState = 'idle' | 'preparing' | 'payable' | 'paid' | 'cancelled' | 'expired' | 'failed';
export type Snapshot = Readonly<{
  documentType: 'snapshot'; schemaVersion: 1; resource: Resource; revision: number;
  source: 'cache' | 'authoritative'; observedAt: string; state: BusinessState;
  order: Readonly<{ id: string; revision: number; amountMinor: number; currency: 'UAH'; expiresAt: string | null }> | null;
  canInitiate: boolean;
}>;
export type Change = Readonly<{
  documentType: 'change'; schemaVersion: 1; eventId: string; resource: Resource; revision: number;
}>;
export type PaymentBinding = Readonly<{ orderId: string; orderRevision: number }>;

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const states: readonly string[] = ['idle', 'preparing', 'payable', 'paid', 'cancelled', 'expired', 'failed'];
const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const exact = (v: Record<string, unknown>, keys: string[]) => Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
const revision = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
const id = (v: unknown): v is string => typeof v === 'string' && uuid.test(v);
const timestamp = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(v) && Number.isFinite(Date.parse(v));
export const sameResource = (a: Resource, b: Resource) => a.kind === b.kind && a.id === b.id;

export function decodeResource(v: unknown): Resource {
  if (!record(v) || !exact(v, ['kind', 'id']) || typeof v.kind !== 'string' || !['invoice', 'terminal'].includes(v.kind) || !id(v.id)) {
    throw new Error('Invalid checkout resource');
  }
  return Object.freeze({ kind: v.kind as Resource['kind'], id: v.id.toLowerCase() });
}

export function decodeSnapshot(v: unknown): Snapshot {
  if (!record(v) || !exact(v, ['documentType', 'schemaVersion', 'resource', 'revision', 'source', 'observedAt', 'state', 'order', 'canInitiate']) ||
    v.documentType !== 'snapshot' || v.schemaVersion !== 1 || !revision(v.revision) ||
    typeof v.source !== 'string' || !['cache', 'authoritative'].includes(v.source) || !timestamp(v.observedAt) ||
    typeof v.state !== 'string' || !states.includes(v.state) || typeof v.canInitiate !== 'boolean') throw new Error('Invalid checkout snapshot');
  const resource = decodeResource(v.resource);
  let order: Snapshot['order'] = null;
  if (v.order !== null) {
    const o = v.order;
    if (!record(o) || !exact(o, ['id', 'revision', 'amountMinor', 'currency', 'expiresAt']) ||
      !id(o.id) || !revision(o.revision) || !revision(o.amountMinor) || o.currency !== 'UAH' ||
      !(o.expiresAt === null || timestamp(o.expiresAt))) throw new Error('Invalid checkout order');
    order = Object.freeze({ id: o.id.toLowerCase(), revision: o.revision, amountMinor: o.amountMinor, currency: 'UAH', expiresAt: o.expiresAt });
  }
  if ((v.state === 'idle') !== (order === null) || (v.state === 'idle' && resource.kind !== 'terminal') ||
    (resource.kind === 'invoice' && (!order || order.id !== resource.id || order.revision !== v.revision)) ||
    (v.canInitiate && (v.state !== 'payable' || v.source !== 'authoritative'))) throw new Error('Inconsistent checkout snapshot');
  return Object.freeze({ documentType: 'snapshot', schemaVersion: 1, resource, revision: v.revision,
    source: v.source as Snapshot['source'], observedAt: v.observedAt, state: v.state as BusinessState, order, canInitiate: v.canInitiate });
}

export function decodeChange(v: unknown): Change {
  if (!record(v) || !exact(v, ['documentType', 'schemaVersion', 'eventId', 'resource', 'revision']) ||
    v.documentType !== 'change' || v.schemaVersion !== 1 || !id(v.eventId) || !revision(v.revision)) throw new Error('Invalid checkout change');
  return Object.freeze({ documentType: 'change', schemaVersion: 1, eventId: v.eventId, resource: decodeResource(v.resource), revision: v.revision });
}

export type EntryIntent = Readonly<{ kind: 'invoice' | 'terminal' | 'ambiguous'; identifier: string; prefix: string }>;
/** Syntax only. Aliases MUST be resolved by a trusted server, never by this parser. */
export function parseCheckoutEntry(input: string): EntryIntent {
  const url = new URL(input, 'https://checkout.invalid');
  if (url.hash) throw new Error('Legacy hash entry requires characterization');
  const match = /^\/(pay|checkout|o|pos|t|tag)(?:\/([a-zA-Z0-9_-]{1,128}))?\/?$/.exec(url.pathname);
  if (!match) throw new Error('Unsupported checkout path');
  const prefix = match[1]!;
  const values = [match[2], ...url.searchParams.getAll('id'), ...url.searchParams.getAll('order_id')].filter((v): v is string => v !== undefined);
  if (!values.length || values.some(v => !/^[a-zA-Z0-9_-]{1,128}$/.test(v))) throw new Error('Missing or invalid checkout identifier');
  const normalized = values.map(v => uuid.test(v) ? v.toLowerCase() : v);
  if (new Set(normalized).size !== 1) throw new Error('Conflicting checkout identifiers');
  if (!match[2] && !['pay', 'checkout'].includes(prefix)) throw new Error('Alias requires path identifier');
  return Object.freeze({ prefix, identifier: normalized[0]!, kind: prefix === 'tag' ? 'terminal' : ['pos', 't'].includes(prefix) ? 'ambiguous' : 'invoice' });
}

export function validateResolvedContext(intent: EntryIntent, resource: Resource): void {
  const checked = decodeResource(resource);
  if (intent.kind !== 'ambiguous' && intent.kind !== checked.kind) throw new Error('Resource intent mismatch');
  if (intent.kind === 'invoice' && uuid.test(intent.identifier) && checked.id !== intent.identifier.toLowerCase()) throw new Error('Invoice identity mismatch');
}

export function businessFingerprint(snapshot: Snapshot): string {
  return JSON.stringify([snapshot.state, snapshot.order]);
}