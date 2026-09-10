// @ts-ignore Node native TypeScript tests require explicit extensions.
import { createCheckoutSync, type SyncClock, type SyncView } from './checkout-sync.ts';
// @ts-ignore Node native TypeScript tests require explicit extensions.
import { checkoutHttpReader } from './checkout-http.ts';
// @ts-ignore Node native TypeScript tests require explicit extensions.
import { checkoutPost, createCheckoutAttempt, selectLocalInvoice, type AcceptedAttempt, type DeliveryReceipt } from './checkout-attempt.ts';
import { decodeSnapshot, sameResource } from './checkout-contract.js';

export type FixedCheckoutView = Readonly<{
  sync: SyncView | null;
  attempt: AcceptedAttempt | null;
  receipt: DeliveryReceipt | null;
  busy: boolean;
  pending: boolean;
  error: string | null;
  connected: boolean;
  paymentActive: boolean;
  canOpen: boolean;
}>;

export interface FixedCheckoutOptions {
  bootstrap: string;
  onChange: (view: FixedCheckoutView) => void;
  fetcher?: typeof fetch;
  clock?: SyncClock;
  online?: boolean;
  visible?: boolean;
}

const unavailable = 'Не вдалося оновити рахунок. Спробуйте ще раз.';
const revoked = 'Доступ до рахунку закрито.';
const uncertain = 'Запит не підтверджено. Повторіть спробу з тим самим ключем.';

/** Local fixed-invoice lifecycle. No implicit attempt, delivery, or push subscription. */
export function createFixedCheckout(options: FixedCheckoutOptions) {
  const clock: SyncClock = options.clock ?? {
    now: () => performance.now(),
    schedule: (callback, delay) => {
      const timer = setTimeout(callback, delay);
      return () => clearTimeout(timer);
    }
  };
  const abort = new AbortController();
  let bootstrap = options.bootstrap;
  let online = options.online ?? true;
  let visible = options.visible ?? true;
  let disposed = false;
  let started = false;
  let busy = false;
  let error: string | null = null;
  let sync: ReturnType<typeof createCheckoutSync> | null = null;
  let controller: ReturnType<typeof createCheckoutAttempt> | null = null;
  let current: SyncView | null = null;
  let attempt: AcceptedAttempt | null = null;
  let receipt: DeliveryReceipt | null = null;
  let paymentActive = false;
  let generation = 0;

  const accessible = () => !disposed && !abort.signal.aborted;
  const connected = () => accessible() && online && visible && current?.transport === 'live';
  function emit() {
    options.onChange(Object.freeze({ sync: current, attempt, receipt, busy, error,
      pending: accessible() && !attempt && (controller?.hasPending() ?? false),
      connected: connected(), paymentActive,
      canOpen: accessible() && online && visible && !!sync && !busy && !attempt }));
  }
  function observe(next: SyncView) {
    if (disposed) return;
    current = next;
    if (next.transport === 'inaccessible') {
      abort.abort();
      controller = null;
      attempt = null;
      receipt = null;
      busy = false;
      paymentActive = false;
      error = revoked;
    } else if (next.transport === 'error') error = unavailable;
    else if (next.transport === 'live' && error === unavailable) error = null;
    emit();
  }
  function latest() {
    // Recompute freshness even when browser timers were suspended.
    if (sync && accessible()) current = sync.view();
    return current;
  }

  async function start(): Promise<void> {
    if (started || disposed) return;
    started = true;
    if (typeof bootstrap !== 'string' || !/^[A-Za-z0-9_-]{43,128}$/.test(bootstrap)) {
      bootstrap = '';
      error = 'Недійсний локальний доступ до рахунку.';
      emit();
      return;
    }
    busy = true;
    emit();
    try {
      const contexts = await checkoutPost('/__local/session', { 'X-Local-Bootstrap': bootstrap }, {}, abort.signal, options.fetcher);
      // Must precede selection AND sync construction: disposal can win after POST resolves.
      if (!accessible()) return;
      const { resource, token } = selectLocalInvoice(contexts);
      const preview = decodeSnapshot(await checkoutPost('/__local/preview', {
        'X-Local-Bootstrap': bootstrap, Authorization: `Bearer ${token}`
      }, {}, abort.signal, options.fetcher));
      if (!accessible()) return;
      if (!sameResource(resource, preview.resource) || preview.source !== 'cache' || preview.canInitiate) throw new Error('Invalid preview');
      sync = createCheckoutSync({ resource, clock,
        reader: checkoutHttpReader(resource, token, options.fetcher), onChange: observe });
      controller = createCheckoutAttempt({ resource, token, bootstrap, signal: abort.signal,
        fetcher: options.fetcher,
        revalidateBeforePayment: async () => {
          const phase = generation;
          const binding = await sync!.revalidateBeforePayment();
          return phase === generation && accessible() && paymentActive && online && visible && sync?.view().canInitiate ? binding : null;
        }
      });
      sync.setOnline(online);
      sync.setVisible(visible);
      if (!accessible()) return;
      await sync.start(preview, false);
      if (!accessible()) return;
    } catch {
      if (accessible()) error = unavailable;
    } finally {
      if (accessible()) { busy = false; emit(); }
    }
  }

  async function beginPayment(): Promise<void> {
    if (!accessible() || busy || !sync || attempt || !online || !visible) return;
    const owner = ++generation;
    paymentActive = true;
    busy = true;
    error = null;
    emit();
    try {
      await sync.setActive(true);
    } finally {
      if (accessible() && owner === generation) { busy = false; emit(); }
    }
  }

  function closePayment(): void {
    // An uncertain POST must retain its immutable binding and recovery polling.
    if (!accessible() || attempt || controller?.hasPending()) return;
    generation++;
    paymentActive = false;
    busy = false;
    void sync?.setActive(false);
    emit();
  }

  async function create(): Promise<void> {
    const view = latest();
    if (!accessible() || !paymentActive || busy || !controller || attempt || !online || !visible ||
        view?.snapshot?.state !== 'payable' ||
        (!controller.hasPending() && (view.transport !== 'live' || !view.canInitiate))) return;
    const owner = controller;
    const phase = generation;
    busy = true;
    error = null;
    emit();
    try {
      const accepted = await owner.create();
      if (!accessible() || controller !== owner || phase !== generation) return;
      attempt = accepted;
    } catch {
      if (accessible() && phase === generation) error = owner.hasPending() ? uncertain : 'Рахунок змінився або недоступний. Перевірте дані та повторіть спробу.';
    } finally {
      if (accessible() && phase === generation) { busy = false; emit(); }
    }
  }

  async function deliver(): Promise<void> {
    latest();
    if (!connected() || busy || !controller || !attempt) return;
    const owner = controller;
    busy = true;
    error = null;
    receipt = null;
    emit();
    try {
      const result = await owner.deliver();
      if (!accessible() || controller !== owner) return;
      receipt = result;
      // A receipt is not payment authority. Only polling/refresh can change sync.
    } catch {
      if (accessible()) error = 'Доставку не підтверджено. Можна повторити доставку цієї спроби.';
    } finally {
      if (accessible()) { busy = false; emit(); }
    }
  }

  return {
    start, beginPayment, closePayment, create, deliver,
    async refresh(): Promise<void> {
      if (!accessible() || !paymentActive) return;
      await sync?.refresh();
    },
    setOnline(value: boolean): void {
      if (!accessible() || online === value) return;
      online = value;
      if (sync) sync.setOnline(value); else emit();
    },
    setVisible(value: boolean): void {
      if (!accessible() || visible === value) return;
      visible = value;
      if (sync) sync.setVisible(value); else emit();
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      paymentActive = false;
      abort.abort();
      sync?.dispose();
      sync = null;
      controller = null;
      bootstrap = '';
      current = null;
      attempt = null;
      receipt = null;
      busy = false;
      error = null;
      emit();
    }
  };
}