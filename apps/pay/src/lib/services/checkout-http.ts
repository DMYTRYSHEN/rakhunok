import { decodeResource, decodeSnapshot, sameResource } from './checkout-contract.js';
import type { Resource } from './checkout-contract.js';
import type { CheckoutReader } from './checkout-sync';

export async function boundedJson(response: Response): Promise<unknown> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error('empty_response');
  const chunks: Uint8Array[] = []; let length = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.length;
    if (length > 65536) { await reader.cancel(); throw new Error('response_too_large'); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
}
export function checkoutHttpReader(resource: Resource, token: string, fetcher = fetch): CheckoutReader {
  const scope = decodeResource(resource);
  if (!/^[A-Za-z0-9_-]{43,128}$/.test(token)) throw new Error('invalid_capability');
  return { async read(input) {
    if (!sameResource(scope, input.resource)) throw new Error('scope_mismatch');
    const response = await fetcher(`/api/checkout/v1/${scope.kind}/${scope.id}/snapshot?minimumRevision=${input.minimumRevision}`, {
      signal: input.signal, cache: 'no-store', redirect: 'error', credentials: 'omit',
      headers: { Authorization: `Bearer ${token}` }
    });
    const value = await boundedJson(response);
    if (response.status === 403 && typeof value === 'object' && value !== null &&
        Object.keys(value).length === 1 && 'error' in value && value.error === 'inaccessible') return { kind: 'inaccessible' };
    if (!response.ok) throw new Error('checkout_unavailable');
    const snapshot = decodeSnapshot(value);
    if (!sameResource(scope, snapshot.resource) || snapshot.source !== 'authoritative' || snapshot.revision < input.minimumRevision) throw new Error('invalid_snapshot');
    return { kind: 'snapshot', value: snapshot };
  } };
}