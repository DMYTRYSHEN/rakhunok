import { decodeOutboxEvent, readJson } from './validation.ts';
import { isTransactionRetryable, retryTransaction } from './retry.ts';

/** Vendor-neutral boundary: implementations MUST preserve transactions and fencing. */
export interface CheckoutPersistence {
  read(input: Record<string, unknown>): Promise<unknown>;
  initiate(input: Record<string, unknown>): Promise<unknown>;
  claim(): Promise<OutboxEvent[]>;
  finish(id: string, claimToken: string, success: boolean): Promise<boolean>;
}
export interface OutboxEvent {
  id: string;
  kind: 'invoice' | 'terminal';
  resourceId: string;
  revision: number;
  aliases: (string | null)[];
  deleted: boolean;
  claimToken: string;
}

export function assertLocalUrl(value: string, allowQuery = false): URL {
  const url = new URL(value);
  if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
      !['http:', 'https:'].includes(url.protocol) || url.username || url.password || (!allowQuery && url.search) || url.hash) {
    throw new Error('local_only');
  }
  return url;
}

export function postgresAdapter(baseUrl: string, serviceKey: string, fetcher = fetch): CheckoutPersistence {
  const base = assertLocalUrl(baseUrl);
  if (!serviceKey || base.pathname !== '/') throw new Error('invalid_local_configuration');
  async function rpc(name: string, input: Record<string, unknown>) {
    return retryTransaction(async () => {
    const response = await fetcher(new URL(`/rest/v1/rpc/${name}`, base), {
      method: 'POST', cache: 'no-store', redirect: 'error',
      signal: AbortSignal.timeout(8000),
      headers: { 'Content-Type': 'application/json', apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`, 'Cache-Control': 'no-store' },
      body: JSON.stringify(input)
    });
    if (!response.ok) {
      const failure = await readJson(response);
      if (isTransactionRetryable(failure)) throw failure;
      throw new Error('persistence_unavailable');
    }
    return readJson(response);
    });
  }
  return {
    read: input => rpc('checkout_read', input),
    initiate: input => rpc('checkout_initiate', input),
    claim: async () => {
      // One lease at a time: no 25-event queue ageing behind slow cache operations.
      const events = await rpc('checkout_claim_outbox', { p_limit: 1 });
      if (!Array.isArray(events) || events.length > 1) throw new Error('invalid_claim');
      return events.map(decodeOutboxEvent);
    },
    finish: async (id, token, success) => {
      const result = await rpc('checkout_finish_outbox', { p_id: id, p_claim_token: token, p_success: success });
      if (typeof result !== 'boolean') throw new Error('invalid_ack');
      return result;
    }
  };
}