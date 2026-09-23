<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { SvelteURLSearchParams } from 'svelte/reactivity';
  import { checkout, formatNumber, isReusableAmountOrder, normalizeAmountInput } from '../state/checkout.svelte.js';
  import { generateA2DataUri } from '../utils/qr-a2.js';
  import { isOrderFresh } from '../services/expiry.js';
  import StateScreen from './StateScreen.svelte';

  let isDark = $state(false);
  let detailsDialog = $state<HTMLDialogElement>();
  let now = $state(Date.now());

  // Computed values
  const isLoaded = $derived(checkout.isLoaded);
  const order = $derived(checkout.order);
  const payTotalAmount = $derived(checkout.payTotalAmount);

  // For open_amount, desktop user inputs this value
  let inputAmount = $state('');
  let amountConfirmed = $state(false);

  const isFixed = $derived(!isReusableAmountOrder(order));
  const needsInput = $derived(!isFixed && !amountConfirmed);
  const validInput = $derived(normalizeAmountInput(inputAmount));

  const currentAmount = $derived(payTotalAmount);

  // The QR code URL
  const qrUrl = $derived.by(() => {
    if (!isLoaded || !order) return '';
    let url = window.location.origin + window.location.pathname;
    const params = new SvelteURLSearchParams(window.location.search);
    params.delete('amount');
    if (!isFixed && amountConfirmed) {
      params.set('amount', checkout.keypadValue.replace(',', '.'));
    }
    const q = params.toString();
    return url + (q ? '?' + q : '') + window.location.hash;
  });

  const isPaid = $derived(order?.status === 'paid');
  const isExpired = $derived(order?.status === 'expired' || Boolean(order && !isOrderFresh(order, now)));
  const isCanceled = $derived(order?.status === 'cancelled');
  const isActive = $derived(Boolean(order && order.status === 'pending' && !isExpired));
  const hasPaymentSnapshot = $derived(order?.payment_recipient_name != null || order?.payment_recipient_iban != null);
  const recipientName = $derived(hasPaymentSnapshot ? order?.payment_recipient_name : order?.merchant?.business_name || order?.merchant?.display_name);
  const recipientIban = $derived(hasPaymentSnapshot ? order?.payment_recipient_iban : order?.merchant?.iban);

  // Generate A2 QR Code Image (Data URI)
  const a2QrImage = $derived.by(() => {
    if (!qrUrl || !isActive || needsInput) return '';
    return generateA2DataUri(qrUrl, { size: 240, ecc: 'M' });
  });

  onMount(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    isDark = media.matches;
    const updateTheme = (event: MediaQueryListEvent) => { isDark = event.matches; };
    media.addEventListener('change', updateTheme);
    const clock = setInterval(() => { now = Date.now(); }, 1000);
    return () => {
      media.removeEventListener('change', updateTheme);
      clearInterval(clock);
    };
  });

  $effect(() => {
    if (!isLoaded || !order || !isActive) return;
    return untrack(() => checkout.startStatusPolling(true));
  });

  $effect(() => {
    if (!order) return;
    untrack(() => {
      inputAmount = checkout.keypadValue.replace(',', '.');
      amountConfirmed = normalizeAmountInput(inputAmount) !== null;
    });
  });

  function confirmAmount() {
    if (validInput && isActive && !isFixed) {
      checkout.keypadValue = validInput;
      amountConfirmed = true;
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(qrUrl);
  }

  function toggleTheme() {
    isDark = !isDark;
  }
</script>

{#if checkout.stateScreenType === 'error' || (isLoaded && !order)}
  <StateScreen />
{:else if !isLoaded}
  <div class="loading-state" class:dark={isDark}>
    <div class="pulse">Завантаження...</div>
  </div>
{:else}
  <div class="desktop-container" class:dark={isDark}>

    <div class="decor-circle"></div>

    <div class="desktop-content">

      <!-- Left: Info -->
      <div class="info-section">

        <div class="logo-wrapper" ondblclick={toggleTheme} role="button" tabindex="0">
          <div class="logo-icon">
            <img src="./logo.svg" alt="Logo" class="real-logo" />
          </div>
          <span class="brand-name">Rakhunok</span>
        </div>

        <div class="order-details">
          <p class="order-desc">
            {order?.description || order?.merchant?.display_name || 'Оплата рахунку'}
            {#if order?.order_number} <br/>Рахунок: {order.order_number}{/if}
          </p>

          <div class="amount-container">
            {#if needsInput && isActive}
              <div class="input-group">
                <span class="input-label">Введіть суму оплати:</span>
                <div class="input-row">
                  <input
                    type="text"
                    inputmode="decimal"
                    aria-label="Сума оплати"
                    bind:value={inputAmount}
                    placeholder="0.00"
                    class="amount-input"
                  />
                  <span class="currency-symbol">₴</span>
                </div>
                <button
                  onclick={confirmAmount}
                  disabled={!validInput}
                  class="confirm-btn">
                  Підтвердити
                </button>
              </div>
            {:else}
              <h1 class="amount-display">
                {formatNumber(currentAmount)}<span class="currency-symbol">₴</span>
              </h1>
            {/if}

            <div class="status-badge" class:paid={isPaid} class:expired={isExpired} class:canceled={isCanceled}>
              <span class="status-dot"></span>
              <span class="status-text">
                {#if isPaid}Оплачено
                {:else if isExpired}Прострочено
                {:else if isCanceled}Скасовано
                {:else if isActive}Очікує на оплату
                {:else}Оплата недоступна
                {/if}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Right: QR Card -->
      <div class="qr-card">
        <div class="card-highlight"></div>

        {#if needsInput && isActive}
          <div class="qr-placeholder">
            <svg class="placeholder-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm14 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"></path></svg>
            <p>Введіть суму зліва, щоб згенерувати QR-код</p>
          </div>
        {:else if !isActive}
          <div class="terminal-state">
            {#if isPaid}
              <div class="state-icon success">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
              </div>
              <h2>Оплачено!</h2>
              <p>Цей рахунок успішно оплачено.</p>
            {:else}
              <div class="state-icon error">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </div>
              <h2>Недійсний рахунок</h2>
              <p>Цей рахунок прострочено або скасовано.</p>
            {/if}
          </div>
        {:else}
          <div class="qr-header">
            <h2>Скануйте для оплати</h2>
            <p>Відкрийте камеру або застосунок вашого банку та наведіть на QR-код</p>
          </div>

          <div class="qr-canvas-wrapper">
            {#if a2QrImage}
              <img src={a2QrImage} alt="QR-код для оплати" class="qr-img" width="256" height="256" />
            {/if}
          </div>

          <div class="qr-actions">
            <button class="primary-btn" onclick={() => detailsDialog?.showModal()}>Переглянути деталі</button>
            <button onclick={handleCopy} class="icon-btn" title="Копіювати посилання">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
            </button>
          </div>
        {/if}
      </div>

    </div>
  </div>
{/if}

{#if a2QrImage && isActive}
  <dialog bind:this={detailsDialog} class="details-overlay" aria-labelledby="details-title">
    <div class="details-content">
      <button class="details-close" onclick={() => detailsDialog?.close()} aria-label="Закрити деталі" title="Закрити деталі">&times;</button>
      <h2 id="details-title">Деталі платежу</h2>
      <img src={a2QrImage} alt="QR-код для оплати" class="details-qr" width="360" height="360" />
      <dl class="details-list">
        <div>
          <dt>Отримувач</dt>
          <dd>{recipientName || 'Не вказано'}</dd>
        </div>
        <div>
          <dt>IBAN</dt>
          <dd class="details-iban">{recipientIban || 'Не вказано'}</dd>
        </div>
      </dl>
    </div>
  </dialog>
{/if}

<style>
  .details-overlay {
    width: 100%;
    height: 100%;
    max-width: none;
    max-height: none;
    margin: 0;
    padding: 0;
    border: 0;
    position: fixed;
    inset: 0;
    z-index: 1000;
    overflow-y: auto;
    background: #fff;
    color: #1c1c1e;
  }
  .details-content {
    min-height: 100vh;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1.5rem;
    padding: 4rem 1.5rem 2rem;
    position: relative;
  }
  .details-close {
    position: absolute;
    top: 1.25rem;
    right: 1.5rem;
    border: 0;
    background: transparent;
    color: inherit;
    font-size: 2rem;
    cursor: pointer;
  }
  .details-content h2 { margin: 0; font-size: 1.5rem; }
  .details-qr { width: min(360px, 80vw, 45vh); height: auto; aspect-ratio: 1; }
  .details-list { width: min(100%, 480px); margin: 0; }
  .details-list > div { padding: 1rem 0; border-top: 1px solid #ddd; }
  .details-list dt { color: #666; font-size: 0.875rem; }
  .details-list dd { margin: 0.35rem 0 0; font-weight: 600; overflow-wrap: anywhere; }
  .details-iban { font-variant-numeric: tabular-nums; }
  /* Variables Setup */
  .desktop-container {
    --bg-color: #F5F5F7;
    --text-primary: #1c1c1e;
    --text-secondary: #8e8e93;
    --card-bg: rgba(255, 255, 255, 0.7);
    --card-border: rgba(255, 255, 255, 0.4);
    --btn-primary-bg: #1c1c1e;
    --btn-primary-text: #ffffff;
    --btn-secondary-bg: rgba(0, 0, 0, 0.05);
    --btn-secondary-hover: rgba(0, 0, 0, 0.1);
    --input-border: #d1d1d6;
    --accent: #00D154;
    --badge-bg: rgba(0, 0, 0, 0.05);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    min-height: 100vh;
    width: 100%;
    background-color: var(--bg-color);
    color: var(--text-primary);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    box-sizing: border-box;
    position: relative;
    overflow: hidden;
    transition: background-color 0.5s ease;
  }

  .desktop-container.dark {
    --bg-color: #111111;
    --text-primary: #ffffff;
    --text-secondary: #a1a1a6;
    --card-bg: rgba(28, 28, 30, 0.65);
    --card-border: rgba(255, 255, 255, 0.08);
    --btn-primary-bg: #ffffff;
    --btn-primary-text: #000000;
    --btn-secondary-bg: rgba(255, 255, 255, 0.1);
    --btn-secondary-hover: rgba(255, 255, 255, 0.15);
    --input-border: #333333;
    --badge-bg: rgba(255, 255, 255, 0.1);
  }

  .loading-state {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: #F5F5F7;
    color: #1c1c1e;
  }
  .loading-state.dark {
    background-color: #111111;
    color: #ffffff;
  }
  .pulse {
    animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  }

  /* Layout */
  .desktop-content {
    display: grid;
    grid-template-columns: 1fr;
    gap: 2.5rem;
    max-width: 1024px;
    width: 100%;
    z-index: 10;
  }

  @media (min-width: 1024px) {
    .desktop-content {
      grid-template-columns: 1fr 1fr;
      gap: 4rem;
      align-items: center;
    }
  }

  /* Info Section */
  .info-section {
    display: flex;
    flex-direction: column;
    gap: 2rem;
    order: 2;
  }
  @media (min-width: 1024px) {
    .info-section {
      order: 1;
    }
  }

  .logo-wrapper {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    justify-content: center;
    cursor: pointer;
    user-select: none;
  }
  @media (min-width: 1024px) {
    .logo-wrapper { justify-content: flex-start; }
  }
  .logo-icon {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background-color: var(--accent);
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 14px rgba(0, 209, 84, 0.2);
    overflow: hidden;
  }
  .real-logo { width: 24px; height: 24px; object-fit: contain; }
  .brand-name { font-size: 1.25rem; font-weight: 600; letter-spacing: -0.025em; }

  .order-details {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    text-align: center;
    align-items: center;
  }
  @media (min-width: 1024px) {
    .order-details { text-align: left; align-items: flex-start; }
  }
  .order-desc {
    color: var(--text-secondary);
    font-size: 1rem;
    font-weight: 500;
    max-width: 320px;
    line-height: 1.5;
    margin: 0;
  }

  .amount-container {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    align-items: center;
  }
  @media (min-width: 1024px) {
    .amount-container { align-items: flex-start; }
  }

  .amount-display {
    font-size: 4.5rem;
    font-weight: 700;
    letter-spacing: -0.05em;
    margin: 0;
    font-variant-numeric: tabular-nums;
  }
  @media (min-width: 1024px) {
    .amount-display { font-size: 5.5rem; }
  }
  .currency-symbol { font-size: 3rem; color: var(--text-secondary); font-weight: 500; margin-left: 0.25rem; }

  /* Input Group */
  .input-group { display: flex; flex-direction: column; gap: 0.5rem; }
  .input-label { color: var(--text-secondary); font-size: 0.875rem; font-weight: 500; }
  .input-row { display: flex; align-items: center; gap: 0.75rem; }
  .amount-input {
    font-size: 3rem;
    font-weight: 700;
    background: transparent;
    border: none;
    border-bottom: 2px solid var(--input-border);
    color: var(--text-primary);
    width: 200px;
    padding: 0.5rem 0;
    outline: none;
    transition: border-color 0.2s;
  }
  .amount-input:focus { border-bottom-color: var(--accent); }
  .confirm-btn {
    margin-top: 1rem;
    padding: 0.75rem 1.5rem;
    background-color: var(--accent);
    color: #000;
    font-weight: 700;
    border: none;
    border-radius: 0.75rem;
    cursor: pointer;
    transition: opacity 0.2s;
  }
  .confirm-btn:hover:not(:disabled) { opacity: 0.9; }
  .confirm-btn:disabled { opacity: 0.5; cursor: not-allowed; }

  /* Status Badge */
  .status-badge {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    font-weight: 600;
    background-color: var(--badge-bg);
    padding: 0.5rem 1rem;
    border-radius: 9999px;
  }
  .status-dot { width: 8px; height: 8px; border-radius: 50%; background-color: #eab308; }
  .status-badge.paid .status-dot { background-color: #22c55e; }
  .status-badge.expired .status-dot, .status-badge.canceled .status-dot { background-color: #ef4444; }
  .status-badge:not(.paid):not(.expired):not(.canceled) .status-dot { animation: pulse 2s infinite; }
  .status-text { color: var(--text-primary); }

  /* QR Card */
  .qr-card {
    background: var(--card-bg);
    backdrop-filter: blur(24px);
    -webkit-backdrop-filter: blur(24px);
    border: 1px solid var(--card-border);
    border-radius: 2.5rem;
    padding: 2.5rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    position: relative;
    box-shadow: 0 20px 40px rgba(0,0,0,0.05);
    min-height: 400px;
    width: 100%;
    box-sizing: border-box;
    order: 1;
  }
  @media (min-width: 1024px) {
    .qr-card { order: 2; }
  }
  .desktop-container.dark .qr-card { box-shadow: none; }

  .card-highlight {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 4px;
    background: linear-gradient(90deg, transparent, var(--accent), transparent);
    opacity: 0.4;
  }

  .qr-placeholder { text-align: center; opacity: 0.5; color: var(--text-primary); }
  .placeholder-icon { width: 5rem; height: 5rem; margin: 0 auto 1rem; color: var(--text-secondary); }

  .terminal-state { text-align: center; }
  .state-icon {
    width: 5rem; height: 5rem; margin: 0 auto 1rem; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
  }
  .state-icon.success { background-color: rgba(34, 197, 94, 0.1); color: #22c55e; }
  .state-icon.error { background-color: rgba(239, 68, 68, 0.1); color: #ef4444; }
  .state-icon svg { width: 2.5rem; height: 2.5rem; }
  .terminal-state h2 { font-size: 1.5rem; font-weight: 700; margin: 0; }
  .terminal-state p { color: var(--text-secondary); margin-top: 0.5rem; }

  .qr-header { text-align: center; margin-bottom: 2rem; }
  .qr-header h2 { font-size: 1.5rem; font-weight: 700; margin: 0 0 0.5rem; letter-spacing: -0.025em; }
  .qr-header p { color: var(--text-secondary); font-size: 0.875rem; margin: 0; max-width: 260px; line-height: 1.5; }

  .qr-canvas-wrapper {
    background-color: #ffffff;
    padding: 1.25rem;
    border-radius: 1.5rem;
    box-shadow: 0 4px 6px rgba(0,0,0,0.05);
    margin-bottom: 2rem;
    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
  .qr-canvas-wrapper:hover { transform: scale(1.05); }
  .qr-canvas-wrapper .qr-img { width: 100% !important; max-width: 220px; height: auto !important; display: block; border-radius: 0.5rem; }

  .qr-actions { display: flex; gap: 0.75rem; width: 100%; }
  .primary-btn {
    flex: 1;
    padding: 1rem;
    background-color: var(--btn-primary-bg);
    color: var(--btn-primary-text);
    border: none;
    border-radius: 1rem;
    font-weight: 600;
    font-size: 0.875rem;
    cursor: pointer;
    transition: opacity 0.2s, transform 0.1s;
  }
  .primary-btn:hover { opacity: 0.9; }
  .primary-btn:active { transform: scale(0.98); }

  .icon-btn {
    padding: 1rem;
    background-color: var(--btn-secondary-bg);
    color: var(--text-primary);
    border: none;
    border-radius: 1rem;
    cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    transition: background-color 0.2s, transform 0.1s;
  }
  .icon-btn:hover { background-color: var(--btn-secondary-hover); }
  .icon-btn:active { transform: scale(0.98); }
  .icon-btn svg { width: 1.25rem; height: 1.25rem; }

  /* Background Decor */
  .desktop-container.dark .decor-circle {
    position: absolute;
    top: -5%;
    left: -10%;
    width: 60%;
    height: 60%;
    max-width: 500px;
    max-height: 500px;
    background-color: rgba(0, 209, 84, 0.15);
    border-radius: 50%;
    filter: blur(100px);
    pointer-events: none;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: .5; }
  }
</style>
