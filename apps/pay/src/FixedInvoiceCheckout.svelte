<script lang="ts">
  import { onMount } from 'svelte';
  import InvoiceFrame from './lib/components/InvoiceFrame.svelte';
  import { createFixedCheckout, type FixedCheckoutView } from './lib/services/fixed-checkout';
  import type { BusinessState } from './lib/services/checkout-contract';

  let view = $state<FixedCheckoutView | null>(null);
  let controller = $state<ReturnType<typeof createFixedCheckout> | null>(null);
  let sheet = $state<HTMLDialogElement>();
  const snapshot = $derived(view?.sync?.snapshot);
  const amount = $derived(snapshot?.order ? snapshot.order.amountMinor / 100 : null);
  const canCreate = $derived(!!view && !view.busy && !view.attempt && snapshot?.state === 'payable' &&
    view.connected && (view.pending || !!view.sync?.canInitiate));
  const labels: Record<BusinessState, string> = {
    idle: 'Рахунок відсутній', preparing: 'Рахунок готується', payable: 'Очікує на оплату',
    paid: 'Оплачено', cancelled: 'Скасовано', expired: 'Термін оплати минув', failed: 'Оплата недоступна'
  };
  const money = (minor: number) => (minor / 100).toLocaleString('uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  onMount(() => {
    // Consume before any rendering of navigation/share controls; never persist credentials.
    const bootstrap = /^#local=([A-Za-z0-9_-]{43,128})$/.exec(location.hash)?.[1] ?? '';
    history.replaceState(null, '', location.pathname);
    let active = true;
    const session = createFixedCheckout({ bootstrap, online: navigator.onLine, visible: !document.hidden,
      onChange: next => { if (active) view = next; } });
    controller = session;
    const online = () => session.setOnline(navigator.onLine);
    const visible = () => session.setVisible(!document.hidden);
    window.addEventListener('online', online);
    window.addEventListener('offline', online);
    document.addEventListener('visibilitychange', visible);
    void session.start();
    return () => {
      active = false;
      session.dispose();
      controller = null;
      window.removeEventListener('online', online);
      window.removeEventListener('offline', online);
      document.removeEventListener('visibilitychange', visible);
    };
  });
</script>

<div class="local-banner">LOCAL SYNTHETIC · Без реальних грошей</div>
<main class="clip-root" data-testid="fixed-invoice-checkout">
  <InvoiceFrame merchantName={view?.attempt?.quote.recipient.name ?? 'Фіксований рахунок'}
    orderLabel="Рахунок до сплати" {amount} statusText={snapshot ? labels[snapshot.state] : 'Підключення до рахунку…'}
    paid={snapshot?.state === 'paid'} preparing={snapshot?.state === 'preparing'}
    canPay={canCreate} ctaText={view?.pending ? 'Повторити ту саму спробу' : 'Перейти до оплати'}
    onpay={() => sheet?.showModal()}>
    {#snippet afterSummary()}
      <section class="authority" aria-live="polite">
        <p data-testid="authoritative-state">Стан: {snapshot?.state ?? '—'} · Ревізія: {snapshot?.revision ?? '—'}</p>
        <p data-testid="transport">З’єднання: {view?.sync?.transport ?? 'connecting'}</p>
        {#if snapshot?.order}<p class="identifier">ID рахунку: {snapshot.order.id}</p>{/if}
        {#if !view?.connected}<p>Оплата заблокована до свіжого підтвердження сервера.</p>{/if}
        {#if view?.error}<p role="alert">{view.error}</p>{/if}
        {#if snapshot?.state === 'paid'}<p data-testid="paid-confirmation">Оплату підтверджено авторитетним станом рахунку.</p>{/if}
        <button class="secondary" disabled={!controller || view?.busy} onclick={() => { void controller?.refresh(); }}>Оновити стан</button>
      </section>
      {#if view?.attempt}
        <section class="authority accepted" aria-live="polite">
          <h2>Спробу створено</h2>
          <p class="identifier" data-testid="attempt-id">{view.attempt.attemptId}</p>
          <p>Зафіксовано: {money(view.attempt.quote.amountMinor)} ₴ · ревізія {view.attempt.quote.orderRevision}</p>
          <details>
            <summary>Реквізити зафіксованої спроби</summary>
            <p>{view.attempt.quote.recipient.name}</p>
            <p class="identifier">{view.attempt.quote.recipient.iban}</p>
            <p>Податковий номер: {view.attempt.quote.recipient.taxId}</p>
            <p>{view.attempt.quote.purpose}</p>
          </details>
          <p>Створення спроби не є оплатою. Емулятор надсилає webhook лише окремою дією.</p>
          <button class="secondary" data-testid="deliver-webhook" disabled={view.busy || !view.connected}
            onclick={() => { void controller?.deliver(); }}>
            {view.receipt ? 'Повторити той самий webhook' : 'Емулювати банківський webhook'}
          </button>
          <p data-testid="delivery-receipt">{view.receipt ? `Квитанція доставки: ${view.receipt.outcome}; replayed=${view.receipt.replayed}` : 'Webhook ще не підтверджено'}</p>
          {#if view.receipt?.outcome === 'review'}<p role="alert">Потрібна перевірка платежу. Ця доставка не підтверджує оплату поточної версії рахунку.</p>{/if}
        </section>
      {/if}
      <p class="scope-note">Локальна перевірка фіксованої суми. Без чайових, промокодів, розділення та реального переходу в банк. Статус оновлюється серверним polling.</p>
    {/snippet}
  </InvoiceFrame>
</main>

<dialog bind:this={sheet} aria-labelledby="fixed-payment-title">
  <div class="sheet-content">
    <button class="close" aria-label="Закрити оплату" onclick={() => sheet?.close()}>×</button>
    <span class="local-label">LOCAL SYNTHETIC</span>
    <h2 id="fixed-payment-title">Підтвердьте суму рахунку</h2>
    <p class="sheet-amount" data-testid="sheet-amount">{snapshot?.order ? money(snapshot.order.amountMinor) : '—'} ₴</p>
    <p>Локальний емулятор банку. Суму й отримувача визначає сервер; реальні кошти не списуються.</p>
    {#if view?.error}<p role="alert">{view.error}</p>{/if}
    <button class="order-cta" data-testid="create-attempt" disabled={!canCreate}
      onclick={async () => { await controller?.create(); if (view?.attempt) sheet?.close(); }}>
      {view?.busy ? 'Перевірка рахунку…' : view?.pending ? 'Повторити з тим самим ключем' : 'Створити платіжну спробу'}
    </button>
  </div>
</dialog>

<style>
  .local-banner { text-align: center; padding: 12px 20px; color: #14532d; background: #dcfce7; font-size: 12px; font-weight: 800; letter-spacing: .06em; }
  .authority { padding: 18px; margin: 16px 0; border: 1px solid #64748b33; border-radius: 18px; font-size: 13px; line-height: 1.65; }
  .authority p { margin: 8px 0; }
  .identifier { overflow-wrap: anywhere; font-variant-numeric: tabular-nums; }
  .accepted { border-color: #16a34a55; }
  h2 { font-size: 19px; margin: 0 0 14px; }
  .secondary { padding: 12px 16px; border: 1px solid #64748b55; border-radius: 12px; background: transparent; color: inherit; cursor: pointer; }
  button:disabled { opacity: .45; cursor: not-allowed; }
  .scope-note { font-size: 12px; opacity: .7; line-height: 1.7; margin: 20px 0; }
  dialog { width: min(480px, calc(100vw - 24px)); border: 0; border-radius: 24px; padding: 0; color: #182334; background: #fff; max-height: 90vh; }
  dialog::backdrop { background: #0f172a88; backdrop-filter: blur(4px); }
  .sheet-content { padding: 32px; position: relative; line-height: 1.65; }
  .close { position: absolute; right: 16px; top: 12px; border: 0; background: transparent; font-size: 28px; cursor: pointer; }
  .local-label { font-size: 11px; font-weight: 800; color: #15803d; }
  .sheet-amount { font-size: 40px; font-weight: 800; margin: 20px 0; font-variant-numeric: tabular-nums; }
</style>