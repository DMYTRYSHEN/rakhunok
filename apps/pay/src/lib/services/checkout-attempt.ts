import { decodeResource } from './checkout-contract.js';
import type { PaymentBinding, Resource } from './checkout-contract.js';
// @ts-ignore Node's native TypeScript tests need the explicit extension.
import { boundedJson } from './checkout-http.ts';

const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const exact = (v: Record<string, unknown>, keys: string[]) => Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
const uuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const positive = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v > 0;

/** Shared wire decoder: no Worker or bank implementation dependencies. */
export function decodeAccepted(value: unknown, orderId: string, orderRevision: number) {
  if (!record(value) || !exact(value, ['kind', 'attemptId', 'quote', 'replayed']) || value.kind !== 'accepted' ||
      !uuid(value.attemptId) || typeof value.replayed !== 'boolean' || !record(value.quote)) throw new Error('invalid_attempt');
  const q = value.quote;
  if (!exact(q, ['orderId', 'orderRevision', 'amountMinor', 'currency', 'recipient', 'purpose', 'expiresAt']) ||
      q.orderId !== orderId || q.orderRevision !== orderRevision || !positive(q.amountMinor) || q.currency !== 'UAH' ||
      typeof q.purpose !== 'string' || q.purpose.length > 10000 || typeof q.expiresAt !== 'string' ||
      !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(q.expiresAt) ||
      !Number.isFinite(Date.parse(q.expiresAt)) || !record(q.recipient)) throw new Error('invalid_quote');
  const r = q.recipient;
  if (!exact(r, ['iban', 'name', 'taxId']) || typeof r.iban !== 'string' || !/^UA[0-9]{27}$/.test(r.iban) ||
      BigInt(r.iban.slice(4) + '3010' + r.iban.slice(2, 4)) % 97n !== 1n ||
      typeof r.name !== 'string' || !r.name.trim() || r.name.length > 200 ||
      typeof r.taxId !== 'string' || !/^(?:[0-9]{8}|[0-9]{10})$/.test(r.taxId)) throw new Error('invalid_recipient');
  return { kind: 'accepted' as const, attemptId: value.attemptId, replayed: value.replayed,
    quote: { orderId, orderRevision, amountMinor: q.amountMinor, currency: 'UAH' as const,
      recipient: { iban: r.iban, name: r.name, taxId: r.taxId }, purpose: q.purpose, expiresAt: q.expiresAt } };
}

export type AcceptedAttempt = ReturnType<typeof decodeAccepted>;
export type DeliveryReceipt = Readonly<{ synthetic: true; outcome: 'paid' | 'review'; replayed: boolean }>;

export function selectLocalInvoice(value: unknown): { resource: Resource; token: string } {
  if (!Array.isArray(value)) throw new Error('invalid_local_session');
  const invoices = value.filter(v => record(v) && record(v.resource) && v.resource.kind === 'invoice');
  if (invoices.length !== 1) throw new Error('invalid_local_invoice');
  const context = invoices[0];
  const resource = decodeResource(context.resource);
  if (typeof context.token !== 'string' || !/^[A-Za-z0-9_-]{43,128}$/.test(context.token)) throw new Error('invalid_capability');
  return { resource, token: context.token };
}

/** Every mutation has a deadline covering fetch AND bounded response consumption. */
export async function checkoutPost(url: string, headers: Record<string, string>, body: unknown, signal: AbortSignal, fetcher: typeof fetch = fetch) {
  const abort = new AbortController();
  const cancel = () => abort.abort(signal.reason);
  signal.addEventListener('abort', cancel, { once: true });
  if (signal.aborted) cancel();
  const timer = setTimeout(() => abort.abort(new Error('checkout_timeout')), 8000);
  let stop: (() => void) | undefined;
  const cancelled = new Promise<never>((_, reject) => {
    stop = () => reject(abort.signal.reason);
    abort.signal.addEventListener('abort', stop, { once: true });
    if (abort.signal.aborted) stop();
  });
  try {
    return await Promise.race([cancelled, (async () => {
      abort.signal.throwIfAborted();
      const response = await fetcher(url, {
        method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(body), signal: abort.signal,
        cache: 'no-store', redirect: 'error', credentials: 'omit'
      });
      const value = await boundedJson(response);
      abort.signal.throwIfAborted();
      if (!response.ok) throw new Error('checkout_request_rejected');
      return value;
    })()]);
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', cancel);
    if (stop) abort.signal.removeEventListener('abort', stop);
  }
}

/** One explicit attempt per local session. Uncertain responses NEVER rotate its key or binding. */
export function createCheckoutAttempt(options: {
  resource: Resource; token: string; bootstrap: string; signal: AbortSignal;
  revalidateBeforePayment: () => Promise<PaymentBinding | null>;
  fetcher?: typeof fetch; newKey?: () => string;
}) {
  const resource = decodeResource(options.resource);
  if (!/^[A-Za-z0-9_-]{43,128}$/.test(options.token) || !/^[A-Za-z0-9_-]{43,128}$/.test(options.bootstrap)) throw new Error('invalid_capability');
  const headers = { Authorization: `Bearer ${options.token}` };
  let pending: Readonly<{ binding: PaymentBinding; key: string }> | null = null;
  let accepted: AcceptedAttempt | null = null;
  let busy = false;
  return {
    hasPending: () => pending !== null,
    async create(): Promise<AcceptedAttempt> {
      if (busy) throw new Error('checkout_busy');
      options.signal.throwIfAborted();
      if (accepted) return accepted;
      busy = true;
      try {
        if (!pending) {
          const binding = await options.revalidateBeforePayment();
          options.signal.throwIfAborted();
          if (!binding || !uuid(binding.orderId) || !positive(binding.orderRevision) ||
              (resource.kind === 'invoice' && binding.orderId !== resource.id)) throw new Error('checkout_binding_changed');
          const key = (options.newKey ?? (() => crypto.randomUUID()))();
          if (!/^[A-Za-z0-9_-]{8,128}$/.test(key)) throw new Error('invalid_idempotency_key');
          pending = Object.freeze({ binding: Object.freeze({ orderId: binding.orderId, orderRevision: binding.orderRevision }), key });
        }
        const value = await checkoutPost(`/api/checkout/v1/${resource.kind}/${resource.id}/attempts`,
          { ...headers, 'Idempotency-Key': pending.key }, pending.binding, options.signal, options.fetcher);
        const result = decodeAccepted(value, pending.binding.orderId, pending.binding.orderRevision);
        accepted = Object.freeze({ ...result, quote: Object.freeze({ ...result.quote, recipient: Object.freeze(result.quote.recipient) }) });
        return accepted;
      } finally { busy = false; }
    },
    async deliver(): Promise<DeliveryReceipt> {
      if (busy) throw new Error('checkout_busy');
      if (!accepted) throw new Error('attempt_required');
      busy = true;
      try {
        const value = await checkoutPost('/__local/bank/deliver',
          { ...headers, 'X-Local-Bootstrap': options.bootstrap }, { attemptId: accepted.attemptId }, options.signal, options.fetcher);
        if (!record(value) || !exact(value, ['synthetic', 'outcome', 'replayed']) || value.synthetic !== true ||
            (value.outcome !== 'paid' && value.outcome !== 'review') || typeof value.replayed !== 'boolean') throw new Error('invalid_delivery_receipt');
        // Transport acknowledgement only. Never a snapshot or a payment-state update.
        return Object.freeze({ synthetic: true, outcome: value.outcome, replayed: value.replayed });
      } finally { busy = false; }
    }
  };
}