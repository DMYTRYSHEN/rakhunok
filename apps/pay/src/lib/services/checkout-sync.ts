import { businessFingerprint, decodeChange, decodeResource, decodeSnapshot, sameResource } from './checkout-contract.js';
import type { PaymentBinding, Resource, Snapshot } from './checkout-contract.js';

export type ReadResult = { kind: 'snapshot'; value: unknown } | { kind: 'inaccessible' };
/** Internal port, NOT a current HTTP endpoint. Adapter owns scoped access and no-cache authority. */
export interface CheckoutReader {
  read(input: { resource: Resource; minimumRevision: number; signal: AbortSignal }): Promise<ReadResult>;
}
export interface SyncClock {
  /** Must use a monotonic clock (e.g. performance.now), never Date.now. */
  now(): number;
  schedule(callback: () => void, delayMs: number): () => void;
}
export type SyncView = Readonly<{
  snapshot: Snapshot | null;
  transport: 'connecting' | 'live' | 'stale' | 'offline' | 'error' | 'inaccessible' | 'disposed';
  canInitiate: boolean;
  watermark: number;
}>;
export interface SyncOptions {
  resource: Resource; reader: CheckoutReader; clock: SyncClock;
  onChange?: (view: SyncView) => void; random?: () => number;
  pollMs?: number; maxStaleMs?: number; timeoutMs?: number; maxBackoffMs?: number;
}

/** Poll-first prototype. No browser globals, bank handoff, subscriptions or network imports. */
export function createCheckoutSync(options: SyncOptions) {
  const resource = decodeResource(options.resource);
  const { clock, reader } = options;
  const pollMs = options.pollMs ?? 5000;
  const maxStaleMs = options.maxStaleMs ?? 15000;
  const timeoutMs = options.timeoutMs ?? 8000;
  const maxBackoffMs = options.maxBackoffMs ?? 30000;
  if (![pollMs, maxStaleMs, timeoutMs, maxBackoffMs].every(v => Number.isSafeInteger(v) && v > 0) || maxBackoffMs < pollMs || pollMs >= maxStaleMs) throw new Error('Invalid sync timing');
  let snapshot: Snapshot | null = null;
  let confirmedAt: number | null = null;
  let watermark = 0;
  let online = true;
  let visible = true;
  let disposed = false;
  let inaccessible = false;
  let started = false;
  let failed = false;
  let failures = 0;
  let pending = false;
  let sequence = 0;
  let flight: { id: number; abort: AbortController; cancelTimeout: () => void; resolve: (ok: boolean) => void; promise: Promise<boolean> } | null = null;
  let cancelPoll: (() => void) | undefined;
  let cancelFreshness: (() => void) | undefined;
  let lastTime = clock.now();
  const orderHistory = new Map<string, { revision: number; fingerprint: string }>();

  function now() {
    const value = clock.now();
    if (!Number.isFinite(value) || value < lastTime) {
      invalidate();
      return lastTime;
    }
    lastTime = value;
    return value;
  }

  function fresh() {
    const time = now();
    const age = confirmedAt === null ? Infinity : time - confirmedAt;
    if (age >= maxStaleMs) invalidate();
    return online && visible && !failed && !disposed && !inaccessible && age >= 0 && age < maxStaleMs && snapshot !== null && snapshot.source === 'authoritative' && snapshot.revision >= watermark;
  }
  function view(): SyncView {
    const isFresh = fresh();
    return Object.freeze({ snapshot, watermark,
      transport: disposed ? 'disposed' : inaccessible ? 'inaccessible' : !online ? 'offline' : failed ? 'error' : isFresh ? 'live' : snapshot ? 'stale' : 'connecting',
      canInitiate: isFresh && snapshot?.canInitiate === true });
  }
  const emit = () => options.onChange?.(view());
  function invalidate() {
    confirmedAt = null;
    cancelFreshness?.();
    cancelFreshness = undefined;
  }
  function schedulePoll() {
    cancelPoll?.();
    if (disposed || inaccessible || !online || !visible || !started) return;
    const base = Math.min(maxBackoffMs, pollMs * 2 ** Math.min(failures, 10));
    const sample = options.random?.() ?? 0.5;
    const jitter = Number.isFinite(sample) ? Math.max(0, Math.min(1, sample)) : 0.5;
    const delay = Math.min(maxBackoffMs, base * (0.8 + jitter * 0.4));
    cancelPoll = clock.schedule(() => { void refresh(); }, delay);
  }
  function stopFlight() {
    const current = flight;
    flight = null;
    if (current) { current.cancelTimeout(); current.abort.abort(); current.resolve(false); }
  }
  function finish(id: number, ok: boolean) {
    if (!flight || flight.id !== id) return;
    const current = flight;
    flight = null;
    current.cancelTimeout();
    current.resolve(ok);
    const again = pending;
    pending = false;
    emit();
    if (again && ok && online && visible && !disposed && !inaccessible) void refresh();
    else schedulePoll();
  }
  function refresh(): Promise<boolean> {
    if (!started || disposed || inaccessible || !online || !visible) return Promise.resolve(false);
    if (flight) { pending = true; return flight.promise; }
    cancelPoll?.();
    const id = ++sequence;
    const startTime = now();
    const abort = new AbortController();
    let resolve!: (ok: boolean) => void;
    const promise = new Promise<boolean>(done => { resolve = done; });
    const cancelTimeout = clock.schedule(() => {
      if (flight?.id !== id) return;
      abort.abort(); invalidate(); failed = true; failures++;
      finish(id, false);
    }, timeoutMs);
    flight = { id, abort, cancelTimeout, resolve, promise };
    void Promise.resolve().then(() => {
      if (abort.signal.aborted) throw new Error('Read aborted');
      return reader.read({ resource, minimumRevision: watermark, signal: abort.signal });
    }).then(result => {
      if (flight?.id !== id || disposed) return;
      if (result.kind === 'inaccessible') {
        inaccessible = true; snapshot = null; invalidate(); finish(id, false); return;
      }
      const next = decodeSnapshot(result.value);
      const rawTime = clock.now();
      const clockRegressed = !Number.isFinite(rawTime) || rawTime < lastTime;
      const elapsed = now() - startTime;
      if (clockRegressed || !sameResource(resource, next.resource) || next.source !== 'authoritative' || elapsed < 0 || elapsed >= timeoutMs || elapsed >= maxStaleMs) throw new Error('Untrusted or late snapshot');
      if (snapshot && (next.revision < snapshot.revision || (next.revision === snapshot.revision && businessFingerprint(next) !== businessFingerprint(snapshot)))) throw new Error('Regressing or contradictory snapshot');
      if (next.order) {
        const prior = orderHistory.get(next.order.id);
        const fingerprint = businessFingerprint(next);
        if (prior && (next.order.revision < prior.revision || (next.order.revision === prior.revision && fingerprint !== prior.fingerprint))) throw new Error('Regressing or contradictory order');
        orderHistory.set(next.order.id, { revision: next.order.revision, fingerprint });
      }
      snapshot = next;
      failed = false;
      failures = 0;
      invalidate();
      if (next.revision >= watermark) {
        confirmedAt = startTime;
        cancelFreshness = clock.schedule(() => { invalidate(); emit(); }, maxStaleMs - elapsed);
      }
      // A hint arriving during this read is retained even if this response lags it.
      finish(id, true);
    }).catch(() => {
      if (flight?.id !== id || disposed) return;
      invalidate(); failed = true; failures++; finish(id, false);
    });
    return promise;
  }

  return {
    view,
    start(bootstrap?: unknown) {
      if (started || disposed) throw new Error('Sync lifecycle already started or disposed');
      started = true;
      if (bootstrap !== undefined) {
        try {
          const initial = decodeSnapshot(bootstrap);
          if (!sameResource(resource, initial.resource)) throw new Error('Bootstrap mismatch');
          // Even a serialized authoritative flag cannot establish current freshness.
          snapshot = Object.freeze({ ...initial, source: 'cache', canInitiate: false });
          if (initial.order) orderHistory.set(initial.order.id, { revision: initial.order.revision, fingerprint: businessFingerprint(initial) });
        } catch { failed = true; }
      }
      emit(); return refresh();
    },
    refresh,
    notify(value: unknown) {
      if (!started || disposed || inaccessible) return;
      let change;
      try { change = decodeChange(value); } catch { return; }
      if (!sameResource(resource, change.resource) || change.revision <= Math.max(watermark, snapshot?.revision ?? -1)) return;
      watermark = change.revision;
      invalidate(); emit(); void refresh();
    },
    setOnline(value: boolean) {
      if (disposed || online === value) return;
      online = value; invalidate(); cancelPoll?.(); pending = false;
      stopFlight(); emit(); if (online) void refresh();
    },
    setVisible(value: boolean) {
      if (disposed || visible === value) return;
      visible = value; invalidate(); cancelPoll?.(); pending = false;
      stopFlight(); emit(); if (visible) void refresh();
    },
    async revalidateBeforePayment(): Promise<PaymentBinding | null> {
      const expected = snapshot?.order;
      if (!expected || snapshot?.state !== 'payable') return null;
      // Never join a read started before this user's payment action.
      if (flight) { await flight.promise; }
      const ok = await refresh();
      if (!ok || !view().canInitiate || !snapshot?.order || snapshot.order.id !== expected.id || snapshot.order.revision !== expected.revision) return null;
      return Object.freeze({ orderId: snapshot.order.id, orderRevision: snapshot.order.revision });
    },
    dispose() {
      if (disposed) return;
      disposed = true; pending = false; cancelPoll?.(); invalidate(); stopFlight(); snapshot = null; orderHistory.clear(); emit();
    }
  };
}