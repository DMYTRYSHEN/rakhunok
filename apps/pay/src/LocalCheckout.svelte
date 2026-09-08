<script lang="ts">
  import { onMount } from 'svelte';
  import { createCheckoutSync, type SyncView } from './lib/services/checkout-sync';
  import { checkoutHttpReader } from './lib/services/checkout-http';
  import { checkoutPost, createCheckoutAttempt, selectLocalInvoice, type AcceptedAttempt, type DeliveryReceipt } from './lib/services/checkout-attempt';
  let view = $state<SyncView | null>(null);
  let message = $state('Підключення до локальної БД…');
  let busy = $state(false);
  let attempt = $state<AcceptedAttempt | null>(null);
  let receipt = $state<DeliveryReceipt | null>(null);
  let pendingAttempt = $state(false);
  let deliveryTried = $state(false);
  let actions = $state<{ mutate: () => Promise<void>; create: () => Promise<void>; deliver: () => Promise<void> } | null>(null);
  const paid = $derived(view?.snapshot?.state === 'paid');
  onMount(() => {
    const bootstrap = location.hash.slice('#local='.length);
    history.replaceState(null, '', location.pathname);
    const abort = new AbortController();
    let sync: ReturnType<typeof createCheckoutSync> | undefined;
    const online = () => sync?.setOnline(navigator.onLine);
    const visible = () => sync?.setVisible(!document.hidden);
    const headers = { 'X-Local-Bootstrap': bootstrap };
    async function connect() {
      const contexts = await checkoutPost('/__local/session', headers, {}, abort.signal);
      const { resource, token } = selectLocalInvoice(contexts);
      sync = createCheckoutSync({ resource, reader: checkoutHttpReader(resource, token),
        clock: { now: () => performance.now(), schedule: (fn, ms) => { const id = setTimeout(fn, ms); return () => clearTimeout(id); } },
        onChange: next => { if (!abort.signal.aborted) view = next; }, random: Math.random });
      online(); visible(); await sync.start();
      if (abort.signal.aborted) return;
      const controller = createCheckoutAttempt({ resource, token, bootstrap, signal: abort.signal,
        revalidateBeforePayment: () => sync!.revalidateBeforePayment() });
      message = 'LOCAL SYNTHETIC · Без реальних грошей';
      const run = async (operation: () => Promise<void>) => {
        if (busy || abort.signal.aborted) return;
        busy = true;
        try {
          await operation();
        } catch {
          if (!abort.signal.aborted) message = 'Запит не підтверджено. Повтор спроби зберігає той самий ключ і ревізію; webhook — той самий attemptId.';
        } finally {
          if (!abort.signal.aborted) { pendingAttempt = controller.hasPending(); busy = false; }
        }
      };
      actions = {
        mutate: () => run(async () => {
          const current = sync!.view();
          const revision = current.snapshot?.order?.revision;
          if (current.transport !== 'live' || current.snapshot?.state !== 'payable' || !revision) return;
          await checkoutPost('/__local/amount', { ...headers, 'If-Match': String(revision) }, {}, abort.signal);
          await sync!.refresh();
        }),
        create: () => run(async () => {
          if (sync!.view().snapshot?.state === 'paid') return;
          const result = await controller.create();
          if (abort.signal.aborted) return;
          attempt = result;
          message = 'Спробу прив’язано до ревізії. Webhook надсилається лише окремою кнопкою.';
        }),
        deliver: () => run(async () => {
          deliveryTried = true;
          receipt = null;
          const result = await controller.deliver();
          if (abort.signal.aborted) return;
          receipt = result;
          message = 'Отримано квитанцію доставки, не підтвердження оплати. Очікуємо авторитетний snapshot.';
          await sync!.refresh();
        })
      };
      while (!abort.signal.aborted) {
        try {
          const events = await fetch('/__local/events', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store', redirect: 'error', credentials: 'omit', signal: abort.signal });
          if (!events.ok || !events.body) break;
          const reader = events.body.getReader(); const decoder = new TextDecoder(); let pending = '';
          for (;;) {
            const { done, value } = await reader.read(); if (done) break;
            pending += decoder.decode(value, { stream: true });
            if (pending.length > 65536) { await reader.cancel(); throw new Error('event_too_large'); }
            let end: number;
            while ((end = pending.indexOf('\n\n')) >= 0) {
              const frame = pending.slice(0, end); pending = pending.slice(end + 2);
              if (frame.startsWith('data: ')) sync.notify(JSON.parse(frame.slice(6)));
            }
          }
        } catch { break; } // Polling continues if push transport fails.
      }
    }
    window.addEventListener('online', online); window.addEventListener('offline', online);
    document.addEventListener('visibilitychange', visible);
    void connect().catch(() => { if (!abort.signal.aborted) message = 'Не вдалося підключити локальний checkout'; });
    return () => { abort.abort(); sync?.dispose(); actions = null;
      window.removeEventListener('online', online); window.removeEventListener('offline', online); document.removeEventListener('visibilitychange', visible); };
  });
</script>

<main>
  <div class="badge">LOCAL SYNTHETIC · PostgreSQL · Без реальних грошей</div>
  <h1>Checkout — перевірка синхронізації</h1>
  <p>{message}</p>
  <section aria-live="polite">
    <span>Авторитетна сума</span>
    <strong data-testid="amount">{view?.snapshot?.order ? (view.snapshot.order.amountMinor / 100).toFixed(2) : '—'} ₴</strong>
    <dl><dt>Авторитетний стан</dt><dd data-testid="authoritative-state">{view?.snapshot?.state ?? '—'}</dd><dt>З’єднання</dt><dd>{view?.transport ?? 'connecting'}</dd><dt>Ревізія</dt><dd>{view?.snapshot?.revision ?? '—'}</dd></dl>
  </section>
  <div class="controls" aria-busy={busy}>
    <button disabled={!actions || busy || paid || view?.transport !== 'live' || view?.snapshot?.state !== 'payable'} onclick={() => { void actions?.mutate(); }}>LOCAL SYNTHETIC · Змінити тестову суму +1 ₴</button>
    <button data-testid="create-attempt" disabled={!actions || busy || paid || !!attempt || (!pendingAttempt && !view?.canInitiate)} onclick={() => { void actions?.create(); }}>{pendingAttempt && !attempt ? 'LOCAL SYNTHETIC · Повторити спробу з тим самим ключем' : 'LOCAL SYNTHETIC · Створити спробу для цієї ревізії'}</button>
    <button data-testid="deliver-webhook" disabled={!actions || busy || !attempt} onclick={() => { void actions?.deliver(); }}>{deliveryTried ? 'LOCAL SYNTHETIC · Повторити той самий webhook' : 'LOCAL SYNTHETIC · Доставити підписаний webhook'}</button>
  </div>
  <section aria-live="polite">
    <span>LOCAL SYNTHETIC · attemptId</span>
    <p class="identifier" data-testid="attempt-id">{attempt?.attemptId ?? '—'}</p>
    {#if attempt}<p>Зафіксована ревізія: {attempt.quote.orderRevision} · {(attempt.quote.amountMinor / 100).toFixed(2)} ₴</p>{/if}
    <p data-testid="delivery-receipt">Квитанція доставки (не стан оплати): {receipt ? `LOCAL SYNTHETIC · outcome=${receipt.outcome} · replayed=${receipt.replayed}` : 'не підтверджено'}</p>
  </section>
  <p class="note">Без реальних грошей. Суму можна змінити після створення спроби для перевірки review застарілої котировки; після paid зміни вимкнено. Стан paid надходить лише з авторитетного snapshot, ніколи з квитанції доставки. Polling відновлює стан після втрати подій.</p>
</main>

<style>
  main { max-width: 560px; margin: 8vh auto; padding: 32px; font-family: system-ui, sans-serif; color: #182334; }
  .badge { display: inline-block; border-radius: 20px; background: #e0f6ed; color: #116346; padding: 7px 12px; font-size: 12px; font-weight: 700; letter-spacing: .08em; }
  h1 { font-size: 30px; line-height: 1.2; margin: 24px 0 12px; }
  p { color: #5a687c; line-height: 1.6; }
  section { margin: 24px 0; padding: 28px; border: 1px solid #dfe6ee; border-radius: 20px; background: #fff; box-shadow: 0 12px 32px #20324a08; }
  strong { display: block; font-size: 44px; margin: 10px 0 24px; font-variant-numeric: tabular-nums; }
  dl { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; } dt { color: #64748b; } dd { margin: 0; text-align: right; }
  button { width: 100%; padding: 16px; background: #143c35; color: white; border: 0; border-radius: 12px; font-weight: 600; cursor: pointer; } button:disabled { opacity: .4; cursor: default; }
  .note { font-size: 13px; }
  .controls { display: grid; gap: 12px; }
  .identifier { overflow-wrap: anywhere; font-family: monospace; }
</style>