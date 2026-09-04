<script lang="ts">
  import { checkout, formatNumber, vibrate } from '../state/checkout.svelte.js';
  import Odometer from './Odometer.svelte';

  let hoveredStar = $state<number>(0);
  let feedbackInput = $state<string>('');

  function handleWallet(): void {
    vibrate(15);
    checkout.showToast('Карту лояльності додано в Apple Wallet');
  }

  function handleDone(): void {
    window.location.reload();
  }

  function handleStarClick(star: number): void {
    checkout.setNpsRating(star);
  }

  function handleSendFeedback(): void {
    if (!feedbackInput.trim()) return;
    checkout.npsFeedback = feedbackInput;
    checkout.submitNpsFeedback();
    feedbackInput = '';
  }

  function openGoogleReview(): void {
    vibrate(10);
    const url = checkout.order?.merchant?.google_maps_url || 'https://maps.google.com';
    window.open(url, '_blank');
  }

  function handleDownloadReceipt(): void {
    vibrate(12);
    if (typeof window !== 'undefined') {
      window.print();
    }
  }
</script>

<div class="status-screen" class:active={checkout.isStatusScreenOpen} id="statusScreen">
  <div class="status-content" class:is-timeout={checkout.statusState === 'timeout'}>
    <div
      class="status-icon"
      class:success={checkout.statusState === 'success'}
      class:timeout={checkout.statusState === 'timeout'}
      id="statusIcon"
    >
      <div class="status-spinner"></div>
      <svg class="status-check" viewBox="0 0 24 24">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
      {#if checkout.statusState === 'timeout'}
        <svg
          class="status-warn-icon"
          viewBox="0 0 24 24"
          width="36"
          height="36"
          stroke="currentColor"
          stroke-width="2.5"
          fill="none"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
      {/if}
    </div>

    <div class="status-title" id="statusTitle">
      {#if checkout.statusState === 'success'}
        Успішно оплачено
      {:else if checkout.statusState === 'timeout'}
        Не отримали відповідь від банку
      {:else}
        Очікуємо підтвердження у {checkout.selectedBank?.name || 'банку'}…
      {/if}
    </div>

    {#if checkout.statusState === 'timeout'}
      <p class="status-sub">
        Банк не надав підтвердження вчасно. Перевірте списання у застосунку банку, спробуйте ще раз або виберіть інший банк.
      </p>
    {/if}

    <div class="status-amount">
      <Odometer value={formatNumber(checkout.payTotalAmount)} suffix=" ₴" />
    </div>

    <div
      class="status-details"
      style:display={checkout.statusState !== 'pending' ? 'block' : 'none'}
    >
      <div class="summary-row">
        <span class="summary-label">Банк</span>
        <span class="summary-value">{checkout.selectedBank?.name || 'Банк'}</span>
      </div>

      {#if checkout.bankFee > 0}
        <div class="summary-row">
          <span class="summary-label">Комісія {checkout.selectedBank?.feePct}%</span>
          <span class="summary-value">+{formatNumber(checkout.bankFee)} ₴</span>
        </div>
      {/if}

      {#if checkout.delivery.price > 0}
        <div class="summary-row">
          <span class="summary-label">Доставка НП</span>
          <span class="summary-value">+{formatNumber(checkout.delivery.price)} ₴</span>
        </div>
      {/if}

      {#if checkout.tipAmount > 0}
        <div class="summary-row">
          <span class="summary-label">Чайові офіціанту</span>
          <span class="summary-value" style="color: #22c55e;">+{formatNumber(checkout.tipAmount)} ₴</span>
        </div>
      {/if}

      {#if checkout.roundUpAmount > 0}
        <div class="summary-row">
          <span class="summary-label">Внесок на ЗСУ 🇺🇦</span>
          <span class="summary-value" style="color: #38bdf8;">+{formatNumber(checkout.roundUpAmount)} ₴</span>
        </div>
      {/if}

      <div class="summary-row">
        <span class="summary-label">Отримувач</span>
        <span class="summary-value">{checkout.merchantName}</span>
      </div>

      <div class="summary-row">
        <span class="summary-label">Призначення</span>
        <span class="summary-value">{checkout.orderLabel}</span>
      </div>
    </div>

    {#if checkout.statusState === 'timeout'}
      <button class="order-cta" onclick={() => checkout.retryPayment()}>
        <span>Спробувати ще раз</span>
        <svg
          viewBox="0 0 24 24"
          width="16"
          height="16"
          stroke="currentColor"
          stroke-width="2.5"
          fill="none"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <polyline points="23 4 23 10 17 10"></polyline>
          <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
        </svg>
      </button>

      <button class="status-btn-secondary" onclick={() => checkout.chooseAnotherBank()}>
        Вибрати інший банк
      </button>
    {/if}

    {#if checkout.statusState === 'success'}
      <!-- Live Order Tracker (Feature 6) -->
      {#if checkout.order?.type === 'table' || checkout.forcedScenario === '3' || checkout.forcedScenario === 'table'}
        <div class="live-tracker-card">
          <div class="live-tracker-header">
            <span class="live-tracker-icon">👨‍🍳</span>
            <div>
              <div class="live-tracker-title">Замовлення готується на кухні</div>
              <div class="live-tracker-sub">Орієнтовний час подачі: ~8 хв</div>
            </div>
          </div>
          <div class="live-tracker-progress">
            <div class="live-tracker-fill" style="width: 65%;"></div>
          </div>
        </div>
      {/if}

      <!-- Dedicated Nova Poshta Tracking Button -->
      {#if checkout.order?.type === 'delivery' || checkout.forcedScenario === '4' || checkout.forcedScenario === 'delivery' || checkout.order?.np_tracking}
        <button class="np-track-trigger-btn" onclick={() => checkout.openNpTracking()}>
          <div class="np-track-logo">НП</div>
          <div class="np-track-info">
            <div class="np-track-title">Відстежити посилку в Нова пошта</div>
            <div class="np-track-sub">ТТН 2045089281921 · Прямує до Львова 🚚</div>
          </div>
          <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2.5" fill="none">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </button>
      {/if}

      <!-- NPS 5-Star Rating & Review Card -->
      <div class="nps-card">
        <div class="nps-title">Як вам обслуговування?</div>
        <div class="nps-stars">
          {#each [1, 2, 3, 4, 5] as star}
            <button
              class="nps-star-btn"
              class:filled={star <= (hoveredStar || checkout.npsRating)}
              onmouseenter={() => (hoveredStar = star)}
              onmouseleave={() => (hoveredStar = 0)}
              onclick={() => handleStarClick(star)}
              aria-label="{star} зірок"
            >
              ★
            </button>
          {/each}
        </div>

        {#if checkout.npsRating === 5}
          <div class="nps-feedback-box good">
            <div class="nps-good-title">Чудово! Раді чути 🎉</div>
            <button class="nps-google-btn" onclick={openGoogleReview}>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"></path>
              </svg>
              <span>Залишити відгук у Google Maps</span>
            </button>
          </div>
        {:else if checkout.npsRating > 0 && checkout.npsRating <= 3 && !checkout.npsSubmitted}
          <div class="nps-feedback-box bad">
            <div class="nps-bad-title">Що пішло не так? Напишіть нам, щоб ми виправились:</div>
            <div class="promo-card" style="margin-top: 6px;">
              <input
                type="text"
                class="promo-input"
                placeholder="Ваш коментар або зауваження"
                bind:value={feedbackInput}
              />
              <button class="promo-apply" onclick={handleSendFeedback}>
                Надіслати
              </button>
            </div>
          </div>
        {:else if checkout.npsSubmitted}
          <div class="nps-thanks">Дякуємо! Ваше повідомлення передано адміністратору.</div>
        {/if}
      </div>

      <!-- Fiscal Receipt Trigger -->
      <button class="status-receipt-btn" onclick={() => checkout.openFiscalReceipt()}>
        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
          <line x1="16" y1="13" x2="8" y2="13"></line>
          <line x1="16" y1="17" x2="8" y2="17"></line>
          <polyline points="10 9 9 9 8 9"></polyline>
        </svg>
        <span>Електронний фіскальний чек ДПС</span>
      </button>

      <!-- Apple Wallet -->
      <button
        class="wallet-btn visible"
        onclick={handleWallet}
      >
        <span class="wallet-icon"></span>
        Додати в Apple Wallet
      </button>

      <!-- App Banner -->
      <button
        class="app-banner visible"
        onclick={() => window.open('https://rakhunok.com', '_blank')}
      >
        <div class="app-banner-icon">₴</div>
        <div class="app-banner-text">
          <div class="app-banner-title">Rahunok</div>
          <div class="app-banner-sub">Чеки, історія платежів і кешбек — у повному застосунку</div>
        </div>
        <div class="app-banner-get">ОТРИМАТИ</div>
      </button>

      <button class="status-done visible" onclick={handleDone}>
        Готово
      </button>
    {/if}
  </div>
</div>

<!-- Electronic Fiscal Receipt Modal Dialog (Apple Premium Digital Tax Receipt) -->
{#if checkout.isFiscalReceiptOpen}
  <div
    class="action-sheet-backdrop visible"
    onclick={() => checkout.closeFiscalReceipt()}
    role="presentation"
  ></div>

  <div class="fiscal-modal" role="dialog" aria-modal="true" aria-labelledby="fiscalTitle">
    <div class="fiscal-receipt-paper">
      <button
        class="fiscal-close-btn"
        onclick={() => checkout.closeFiscalReceipt()}
        aria-label="Закрити чек"
      >
        <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>

      <div class="fiscal-header">
        <div class="fiscal-gov-badge">
          <svg viewBox="0 0 24 16" width="18" height="12" style="border-radius: 2px; display: inline-block;">
            <rect width="24" height="8" fill="#0057B7"></rect>
            <rect y="8" width="24" height="8" fill="#FFD700"></rect>
          </svg>
          <span>ДЕРЖАВНА ПОДАТКОВА СЛУЖБА УКРАЇНИ</span>
        </div>
        <div class="fiscal-org">{checkout.fiscalReceipt.tax_name}</div>
        <div class="fiscal-meta">ЄДРПОУ: {checkout.fiscalReceipt.tax_id} · {checkout.fiscalReceipt.device_number}</div>
        <div class="fiscal-title-check" id="fiscalTitle">Електронний фіскальний чек</div>
      </div>

      <div class="fiscal-hairline"></div>

      <div class="fiscal-items-list">
        {#each checkout.fiscalReceipt.items as item}
          <div class="fiscal-item-row">
            <div class="fiscal-item-info">
              <div class="fiscal-item-name">{item.name}</div>
              <div class="fiscal-item-qty">{item.quantity} × {formatNumber(item.price)} ₴</div>
            </div>
            <div class="fiscal-item-sum">{formatNumber(item.total)} ₴</div>
          </div>
        {/each}
      </div>

      <div class="fiscal-hairline"></div>

      <div class="fiscal-totals">
        <div class="fiscal-total-row">
          <span>Сума без ПДВ</span>
          <span>{formatNumber(checkout.fiscalReceipt.total_amount - (checkout.fiscalReceipt.vat_amount || 0))} ₴</span>
        </div>
        {#if checkout.fiscalReceipt.vat_amount}
          <div class="fiscal-total-row">
            <span>ПДВ 20% (А)</span>
            <span>{formatNumber(checkout.fiscalReceipt.vat_amount)} ₴</span>
          </div>
        {/if}
        <div class="fiscal-total-row grand">
          <span>Фіскальна сума закладу</span>
          <span class="grand-sum">{formatNumber(checkout.fiscalReceipt.total_amount)} ₴</span>
        </div>
        <div class="fiscal-total-row payment-method">
          <span>Безготівково (IBAN / A2A)</span>
          <span>{formatNumber(checkout.fiscalReceipt.total_amount)} ₴</span>
        </div>
        {#if checkout.tipAmount > 0}
          <div class="fiscal-tip-badge">
            <div class="fiscal-tip-label">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
              </svg>
              <span>Чайові (Закон про цифрові платформи):</span>
            </div>
            <span class="fiscal-tip-sum">+{formatNumber(checkout.tipAmount)} ₴ (без ПДВ)</span>
          </div>
        {/if}
      </div>

      <div class="fiscal-hairline"></div>

      <div class="fiscal-footer">
        <div class="fiscal-seal-pill">
          <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2.5" fill="none">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
            <polyline points="9 12 11 14 15 10"></polyline>
          </svg>
          <span>ЧЕК ЗАРЕЄСТРОВАНО В ДПС</span>
        </div>
        <div class="fiscal-fn">ФН ЧЕКА: <code>{checkout.fiscalReceipt.fiscal_number}</code></div>
        <div class="fiscal-datetime">{checkout.fiscalReceipt.date_time}</div>

        <div class="fiscal-qr-box">
          <svg viewBox="0 0 100 100" width="96" height="96" fill="currentColor">
            <rect x="0" y="0" width="30" height="30"></rect>
            <rect x="5" y="5" width="20" height="20" fill="var(--card-bg, #fff)"></rect>
            <rect x="9" y="9" width="12" height="12"></rect>

            <rect x="70" y="0" width="30" height="30"></rect>
            <rect x="75" y="5" width="20" height="20" fill="var(--card-bg, #fff)"></rect>
            <rect x="79" y="9" width="12" height="12"></rect>

            <rect x="0" y="70" width="30" height="30"></rect>
            <rect x="5" y="75" width="20" height="20" fill="var(--card-bg, #fff)"></rect>
            <rect x="9" y="79" width="12" height="12"></rect>

            <rect x="40" y="10" width="8" height="8"></rect>
            <rect x="50" y="20" width="8" height="8"></rect>
            <rect x="40" y="40" width="20" height="20"></rect>
            <rect x="45" y="45" width="10" height="10" fill="var(--card-bg, #fff)"></rect>
            <rect x="70" y="50" width="10" height="10"></rect>
            <rect x="20" y="45" width="10" height="10"></rect>
            <rect x="75" y="75" width="15" height="15"></rect>
          </svg>
        </div>
        <a class="fiscal-qr-sub" href="https://cabinet.tax.gov.ua" target="_blank" rel="noopener noreferrer">cabinet.tax.gov.ua</a>
      </div>

      <div class="fiscal-actions">
        <button class="order-cta" onclick={handleDownloadReceipt}>
          <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2.5" fill="none">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
          <span>Зберегти чек / Друк</span>
        </button>
        <button class="status-btn-secondary" onclick={() => checkout.closeFiscalReceipt()}>
          Закрити
        </button>
      </div>
    </div>
  </div>
{/if}
