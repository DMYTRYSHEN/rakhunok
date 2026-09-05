<script lang="ts">
  import { checkout, formatNumber, vibrate } from '../state/checkout.svelte.js';
  import type { Bank } from '../types/bank.js';
  import Odometer from './Odometer.svelte';

  let currentSubView = $state<'info' | 'search' | 'methods' | null>(null);
  let searchQuery = $state<string>('');
  let trackEl: HTMLElement | null = $state(null);
  let searchInputEl: HTMLInputElement | null = $state(null);

  // Track geometry & 3D carousel
  let trackWidth = $state<number>(0);

  // Coupon state
  let couponCode = $state<string>('');
  let couponApplied = $state<boolean>(false);

  function toggleSubView(view: 'info' | 'search' | 'methods'): void {
    if (currentSubView === view) {
      currentSubView = null;
    } else {
      currentSubView = view;
      if (view === 'search') {
        setTimeout(() => searchInputEl?.focus(), 350);
      }
    }
  }

  function closeSubViews(): boolean {
    if (currentSubView) {
      currentSubView = null;
      return true;
    }
    return false;
  }

  function handleClose(): void {
    if (!closeSubViews()) {
      checkout.closePaymentSheet();
    }
  }

  function handleWalletPay(wallet: 'apple' | 'google'): void {
    vibrate([15, 35, 15]);
    const walletName = wallet === 'apple' ? 'Apple Pay' : 'Google Pay';
    checkout.showToast(`Авторизація через ${walletName}...`);
    setTimeout(() => {
      checkout.executePay();
    }, 450);
  }

  function handleManualCardPay(): void {
    vibrate(10);
    checkout.showToast('Перехід до безпечної форми оплати карткою...');
    setTimeout(() => {
      checkout.executePay();
    }, 450);
  }

  function handleApplyCoupon(): void {
    if (!couponCode.trim()) return;
    vibrate(12);
    couponApplied = true;
    checkout.showToast(`Купон «${couponCode.toUpperCase()}» активовано (-50 ₴)`);
  }

  function selectBankCard(index: number, fromGrid = false): void {
    checkout.selectBank(index);
    if (fromGrid) {
      currentSubView = null;
    }
    scrollToCard(index, fromGrid ? 120 : 0);
  }

  function scrollToCard(index: number, delayMs = 0): void {
    setTimeout(() => {
      if (!trackEl) return;
      const wrappers = trackEl.querySelectorAll<HTMLElement>('.card-wrapper');
      const wrapper = wrappers[index];
      if (!wrapper) return;
      const pos = wrapper.offsetLeft - trackEl.clientWidth / 2 + wrapper.offsetWidth / 2;
      if (trackEl.scrollTo) {
        trackEl.scrollTo({ left: pos, behavior: 'smooth' });
      } else {
        trackEl.scrollLeft = pos;
      }
    }, delayMs);
  }

  function updateCardTransforms(): void {
    if (!trackEl) return;
    const w = trackEl.clientWidth;
    if (!w) return;
    trackWidth = w;
    const trackCenter = trackEl.scrollLeft + w / 2;
    const wrappers = trackEl.querySelectorAll<HTMLElement>('.card-wrapper');
    const cards = trackEl.querySelectorAll<HTMLElement>('.bank-card');

    let closestDistance = Infinity;
    let activeIdx = checkout.selectedBankIndex;

    wrappers.forEach((wrapper, index) => {
      const card = cards[index];
      if (!card) return;
      const wrapperCenter = wrapper.offsetLeft + wrapper.offsetWidth / 2;
      const distance = Math.abs(trackCenter - wrapperCenter);
      if (distance < closestDistance) {
        closestDistance = distance;
        activeIdx = index;
      }

      const normalized = Math.min(distance / (wrapper.offsetWidth || 1), 1);
      const scale = 1 - normalized * 0.13;
      const opacity = 1 - normalized * 0.45;
      const direction = wrapperCenter > trackCenter ? 1 : -1;
      card.style.transform = `scale(${scale}) perspective(900px) rotateY(${normalized * direction * -12}deg)`;
      card.style.opacity = String(opacity);
    });

    if (activeIdx !== checkout.selectedBankIndex) {
      checkout.selectBank(activeIdx);
    }
  }

  // Filtered banks for search view
  const filteredBanks = $derived.by(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return checkout.banks.map((b, idx) => ({ bank: b, originalIndex: idx }));
    return checkout.banks
      .map((b, idx) => ({ bank: b, originalIndex: idx }))
      .filter(({ bank }) =>
        `${bank.name} ${bank.code} ${bank.alias || ''}`.toLowerCase().includes(q)
      );
  });

  $effect(() => {
    if (checkout.isSheetOpen && trackEl) {
      const timer = setTimeout(() => {
        updateCardTransforms();
        scrollToCard(checkout.selectedBankIndex);
      }, 250);
      return () => clearTimeout(timer);
    }
  });
</script>

<div class="device-frame">
  <main class="payment-sheet" class:open={checkout.isSheetOpen}>
    <header class="sheet-header">
      <button class="header-btn" onclick={handleClose} aria-label="Закрити">
        <svg
          viewBox="0 0 24 24"
          width="15"
          height="15"
          stroke="currentColor"
          stroke-width="2.5"
          fill="none"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>

      <div class="logo-area">
        <div class="recipient-name">{checkout.merchantName}</div>
        <div class="security-badge">
          <svg
            viewBox="0 0 24 24"
            width="9"
            height="9"
            stroke="currentColor"
            stroke-width="2.5"
            fill="none"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
          </svg>
          Захищено Rahunok · NBU 003
        </div>
      </div>

      <button
        class="header-btn"
        onclick={() => toggleSubView('info')}
        aria-label="Деталі платежу"
      >
        <svg
          viewBox="0 0 24 24"
          width="15"
          height="15"
          stroke="currentColor"
          stroke-width="2"
          fill="none"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="16" x2="12" y2="12"></line>
          <line x1="12" y1="8" x2="12.01" y2="8"></line>
        </svg>
      </button>
    </header>

    <section class="info-group">
      <div class="amount">
        <Odometer value={formatNumber(checkout.payTotalAmount)} suffix=" ₴" suffixClass="currency-glyph" />
      </div>


      <div class="hero-meta-row">
        <div class="fee-badge" class:has-fee={checkout.bankFee > 0}>
          {checkout.bankFee > 0
            ? `Комісія ${checkout.selectedBank?.feePct}% · +${formatNumber(checkout.bankFee)} ₴`
            : 'Без комісії'}
        </div>

        <button class="search-trigger" onclick={() => toggleSubView('search')}>
          <svg
            viewBox="0 0 24 24"
            width="11"
            height="11"
            stroke="currentColor"
            stroke-width="2.5"
            fill="none"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <rect x="3" y="3" width="7" height="7" rx="1.5"></rect>
            <rect x="14" y="3" width="7" height="7" rx="1.5"></rect>
            <rect x="3" y="14" width="7" height="7" rx="1.5"></rect>
            <rect x="14" y="14" width="7" height="7" rx="1.5"></rect>
          </svg>
          Усі банки
        </button>
      </div>
    </section>

    <!-- 3D Bank Carousel -->
    <section class="carousel-container">
      <div
        bind:this={trackEl}
        class="carousel-track"
        onscroll={() => requestAnimationFrame(updateCardTransforms)}
      >
        {#each checkout.banks as bank, index}
          <div class="card-wrapper" data-index={index}>
            <div
              class="bank-card"
              style="--v2-bg: {bank.bg || bank.bg_gradient || 'linear-gradient(135deg, #1c1c1e, #2c2c2e)'};"
              onclick={() => selectBankCard(index, false)}
              role="button"
              tabindex="0"
              onkeydown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') selectBankCard(index, false);
              }}
            >
              <div class="card-top">
                <div class="card-header-left">
                  <div class="bank-logo-small">
                    {#if bank.logo}
                      <img src={bank.logo} alt="" loading="lazy" />
                    {/if}
                  </div>
                  <div class="bank-name">{bank.name}</div>
                </div>
                <div class="bank-logo">{bank.code}</div>
              </div>

              <div class="card-bottom">
                <div class="iban">A2A · NBU 003</div>
                <div class="network-logo"></div>
              </div>

              <div class="card-bg-logo">
                {#if bank.logo}
                  <img src={bank.logo} alt="" loading="lazy" />
                {:else}
                  {bank.code}
                {/if}
              </div>
            </div>
          </div>
        {/each}
      </div>

      {#if checkout.banks.length === 0}
        <div class="carousel-skel">
          <div class="skel-bankcard side"></div>
          <div class="skel-bankcard"></div>
          <div class="skel-bankcard side"></div>
        </div>
      {/if}
    </section>

    <!-- Delivery details row inside sheet (if scenario is delivery) -->
    {#if checkout.delivery.price > 0}
      <section class="delivery-rows visible">
        <button class="d-row" onclick={() => checkout.closePaymentSheet()}>
          <div class="d-row-icon person">
            <svg
              viewBox="0 0 24 24"
              width="15"
              height="15"
              stroke="currentColor"
              stroke-width="2.2"
              fill="none"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
          </div>
          <div class="d-row-text">
            <div class="d-row-title">Отримувач</div>
            <div class="d-row-value">{checkout.delivery.name} · {checkout.delivery.phone}</div>
          </div>
          <svg
            class="d-row-chevron"
            viewBox="0 0 24 24"
            width="14"
            height="14"
            stroke="currentColor"
            stroke-width="2.5"
            fill="none"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </button>

        <button class="d-row" onclick={() => checkout.closePaymentSheet()}>
          <div class="d-row-icon np">
            <svg
              viewBox="0 0 24 24"
              width="15"
              height="15"
              stroke="currentColor"
              stroke-width="2.2"
              fill="none"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path
                d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"
              ></path>
            </svg>
          </div>
          <div class="d-row-text">
            <div class="d-row-title">Нова пошта · {formatNumber(checkout.delivery.price)} ₴</div>
            <div class="d-row-value">{checkout.delivery.city}, {checkout.delivery.branch}</div>
          </div>
          <svg
            class="d-row-chevron"
            viewBox="0 0 24 24"
            width="14"
            height="14"
            stroke="currentColor"
            stroke-width="2.5"
            fill="none"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </button>
      </section>
    {/if}

    <!-- Pay Button -->
    <section class="action-area">
      <button
        class="pay-btn"
        class:processing={checkout.isProcessingPayment}
        disabled={checkout.isProcessingPayment}
        onclick={() => checkout.executePay()}
      >
        <span class="btn-text">
          {checkout.isProcessingPayment
            ? `Переходимо в ${checkout.selectedBank?.name || 'банк'}...`
            : 'Ви підтвердите платіж у застосунку банку'}
        </span>
        <div class="spinner"></div>
      </button>

      <!-- Secondary Action: Other Payment Methods & Promo Coupon -->
      <button
        type="button"
        class="other-methods-trigger-btn"
        onclick={() => toggleSubView('methods')}
      >
        <span class="other-trigger-left">
          <svg
            viewBox="0 0 24 24"
            width="15"
            height="15"
            stroke="currentColor"
            stroke-width="2"
            fill="none"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <rect x="2" y="5" width="20" height="14" rx="2"></rect>
            <line x1="2" y1="10" x2="22" y2="10"></line>
          </svg>
          <span>Інші способи оплати та промокод</span>
        </span>
        <svg
          viewBox="0 0 24 24"
          width="13"
          height="13"
          stroke="currentColor"
          stroke-width="2.5"
          fill="none"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <polyline points="9 18 15 12 9 6"></polyline>
        </svg>
      </button>

      <p class="recaptcha-notice">
        Цей сайт захищено reCAPTCHA. Застосовуються
        <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Політика конфіденційності</a> та
        <a href="https://policies.google.com/terms" target="_blank" rel="noopener noreferrer">Умови використання</a> Google.
      </p>
    </section>

    <!-- Info View Sub-modal -->
    <div class="sub-view" class:active={currentSubView === 'info'}>
      <h3 class="view-title">Деталі платежу</h3>
      <div class="info-list">
        <div class="info-row">
          <span class="info-label">Отримувач</span>
          <span class="info-value">
            {checkout.order?.merchant?.business_name || checkout.merchantName}
          </span>
        </div>
        {#if checkout.order?.merchant?.bank_name}
          <div class="info-row">
            <span class="info-label">Банк</span>
            <span class="info-value">{checkout.order.merchant.bank_name}</span>
          </div>
        {/if}
        <div class="info-row">
          <span class="info-label">IBAN</span>
          <span class="info-value">{checkout.order?.merchant?.iban || 'Не вказано'}</span>
        </div>
        <div class="info-row">
          <span class="info-label">ЄДРПОУ</span>
          <span class="info-value">{checkout.order?.merchant?.tax_id || 'Не вказано'}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Призначення</span>
          <span class="info-value">{checkout.orderLabel}</span>
        </div>
      </div>
    </div>

    <!-- Search View Sub-modal -->
    <div class="sub-view" class:active={currentSubView === 'search'}>
      <h3 class="view-title">Оберіть банк</h3>
      <div class="search-input-wrapper">
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
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <input
          bind:this={searchInputEl}
          bind:value={searchQuery}
          type="text"
          placeholder="Знайти банк..."
          class="bank-search-input"
        />
      </div>

      <div class="bank-grid">
        {#each filteredBanks as { bank, originalIndex }}
          <div
            class="grid-card"
            class:selected={originalIndex === checkout.selectedBankIndex}
            style="background: {bank.bg || bank.bg_gradient || 'linear-gradient(135deg, #1c1c1e, #2c2c2e)'};"
            onclick={() => selectBankCard(originalIndex, true)}
            role="button"
            tabindex="0"
            onkeydown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') selectBankCard(originalIndex, true);
            }}
          >
            <div class="card-top">
              <div class="card-header-left">
                <div class="bank-logo-small">
                  {#if bank.logo}
                    <img src={bank.logo} alt="" loading="lazy" />
                  {/if}
                </div>
                <div class="grid-card-name">{bank.name}</div>
              </div>
              <div class="grid-check">
                <svg
                  viewBox="0 0 24 24"
                  width="12"
                  height="12"
                  stroke="currentColor"
                  stroke-width="3.5"
                  fill="none"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              </div>
            </div>

            <div class="grid-card-code">
              {bank.code} · Open Banking
            </div>

            <div class="grid-bg-logo">
              {#if bank.logo}
                <img src={bank.logo} alt="" loading="lazy" />
              {:else}
                {bank.code}
              {/if}
            </div>
          </div>
        {/each}
      </div>
    </div>

    <!-- Other Methods & Promo Sub-modal -->
    <div class="sub-view" class:active={currentSubView === 'methods'}>
      <div class="sub-view-nav">
        <button
          type="button"
          class="sub-back-btn"
          onclick={() => (currentSubView = null)}
        >
          <svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2.5" fill="none">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
          <span>Pay by Bank</span>
        </button>
        <h3 class="view-title" style="margin-bottom: 0;">Інші варіанти</h3>
      </div>

      <!-- Promo / Coupon Code Section -->
      <div class="other-group">
        <div class="other-group-title">Купон або промокод</div>
        <div class="coupon-box">
          <input
            type="text"
            class="coupon-input"
            placeholder="Введіть промокод (напр. DISCOUNT)"
            bind:value={couponCode}
          />
          <button
            type="button"
            class="coupon-apply-btn"
            disabled={!couponCode.trim()}
            onclick={handleApplyCoupon}
          >
            {couponApplied ? 'Застосовано' : 'Застосувати'}
          </button>
        </div>
        {#if couponApplied}
          <div class="coupon-applied-msg">
            ✓ Знижку 50 ₴ активовано для цього чекауту
          </div>
        {/if}
      </div>

      <!-- Loyalty Card & Scanner Section -->
      <div class="other-group">
        <div class="other-group-title">Картка лояльності та бонуси</div>
        {#if !checkout.loyaltyCard}
          <button
            type="button"
            class="other-method-item loyalty-trigger-row"
            onclick={() => {
              currentSubView = null;
              checkout.openLoyaltyScanner();
            }}
          >
            <div class="other-method-item-left">
              <div class="other-wallet-icon loyalty">
                <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none">
                  <path d="M3 7V5a2 2 0 0 1 2-2h2"></path>
                  <path d="M17 3h2a2 2 0 0 1 2 2v2"></path>
                  <path d="M21 17v2a2 2 0 0 1-2 2h-2"></path>
                  <path d="M7 21H5a2 2 0 0 1-2-2v-2"></path>
                  <line x1="7" y1="12" x2="17" y2="12"></line>
                </svg>
              </div>
              <div class="other-item-text">
                <div class="other-item-title">Зісканувати картку лояльності</div>
                <div class="other-item-sub">Камера, штрих-код або номер картки</div>
              </div>
            </div>
            <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2.5" fill="none">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </button>
        {:else}
          <button
            type="button"
            class="other-method-item applied-card"
            onclick={() => {
              currentSubView = null;
              checkout.openLoyaltyScanner();
            }}
          >
            <div class="other-method-item-left">
              <div class="other-wallet-icon loyalty-active">
                ✓
              </div>
              <div class="other-item-text">
                <div class="other-item-title">{checkout.loyaltyCard.program_name}</div>
                <div class="other-item-sub">
                  {checkout.loyaltyCard.use_bonuses
                    ? `Списано ${formatNumber(checkout.bonusDiscount)} ₴`
                    : `${formatNumber(checkout.loyaltyCard.bonus_balance)} ₴ бонусів`}
                </div>
              </div>
            </div>
            <span class="other-badge-status">Налаштувати</span>
          </button>
        {/if}
      </div>

      <!-- Optional Digital Wallets & Cards -->
      <div class="other-group">
        <div class="other-group-title">Додаткові способи (якщо увімкнено)</div>

        <div class="other-methods-list">
          <button
            type="button"
            class="other-method-item"
            onclick={() => handleWalletPay('apple')}
          >
            <div class="other-method-item-left">
              <div class="other-wallet-icon apple">
                <svg viewBox="0 0 170 80" width="34" height="16" fill="currentColor">
                  <path d="M45.5 40.5c0-7.3 5.9-10.8 6.2-11-3.4-5-8.7-5.7-10.6-5.8-4.5-.5-8.9 2.7-11.2 2.7-2.3 0-5.9-2.6-9.7-2.5-4.9.1-9.5 2.9-12 7.3-5.2 8.9-1.3 22.1 3.7 29.3 2.5 3.5 5.4 7.5 9.2 7.3 3.7-.1 5.1-2.4 9.6-2.4 4.5 0 5.7 2.4 9.6 2.3 4-.1 6.5-3.6 8.9-7.1 2.8-4.1 4-8.1 4.1-8.3-.1-.1-7.8-3-7.6-11.8zM39.6 20.3c2-2.5 3.4-5.9 3-9.4-2.9.1-6.5 2-8.6 4.4-1.9 2.2-3.5 5.7-3.1 9.1 3.3.3 6.6-1.7 8.7-4.1z"/>
                  <path d="M85.4 23.8h-14v39.1h7.8V49.2h6.2c9.4 0 16-6.1 16-12.7 0-6.7-6.5-12.7-16-12.7zm-.3 18h-5.9V31.2h5.9c5 0 8.4 2.8 8.4 5.3s-3.4 5.3-8.4 5.3zM107.5 44.5c0-6 4.6-9.9 12.8-10.4l7.1-.4v-2c0-3.3-2.3-5.1-6.6-5.1-3.8 0-6.4 1.4-7.2 3.6h-7.3c.9-5.7 6.6-9.9 14.8-9.9 8.9 0 14.1 4.5 14.1 12.1v23.2h-7.4v-5.2c-2.4 3.5-6.6 5.6-11.3 5.6-6.6 0-11.1-4.2-11.1-10.1c-.2-1.4 0-1.4 0-1.4zm19.9 3.2v-3.7l-6.1.4c-4.2.3-6.5 2-6.5 4.8 0 2.7 2.2 4.4 5.6 4.4 4.1 0 7-2.6 7-5.9zM140.2 67.8l5.8-16.7-12-27.3h8.3l7.6 19.3 7.6-19.3h8.3l-16.7 36.8h-8.9z"/>
                </svg>
              </div>
              <div class="other-item-text">
                <div class="other-item-title">Apple Pay</div>
                <div class="other-item-sub">Швидка оплата картою Apple Wallet</div>
              </div>
            </div>
            <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2.5" fill="none">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </button>

          <button
            type="button"
            class="other-method-item"
            onclick={() => handleWalletPay('google')}
          >
            <div class="other-method-item-left">
              <div class="other-wallet-icon google">
                <svg viewBox="0 0 100 40" width="38" height="16" fill="currentColor">
                  <path fill="#4285F4" d="M20.2 20.3c0-.7-.1-1.4-.2-2.1H10v4h5.7c-.2 1.3-1 2.4-2.1 3.2v2.6h3.4c2-1.9 3.2-4.6 3.2-7.7z"/>
                  <path fill="#34A853" d="M10 30.7c2.9 0 5.3-1 7.1-2.6l-3.4-2.6c-1 .7-2.2 1.1-3.7 1.1-2.8 0-5.2-1.9-6.1-4.5H.4v2.7C2.2 28.3 5.9 30.7 10 30.7z"/>
                  <path fill="#FBBC05" d="M3.9 22.1c-.2-.7-.4-1.5-.4-2.3s.1-1.6.4-2.3v-2.7H.4C-.3 16.1-.7 18-.7 20s.4 3.9 1.1 5.2l3.5-2.7z"/>
                  <path fill="#EA4335" d="M10 13.5c1.6 0 3 .5 4.1 1.6l3.1-3.1C15.3 10.2 12.8 9.3 10 9.3 5.9 9.3 2.2 11.7.4 15.3l3.5 2.7c.9-2.7 3.3-4.5 6.1-4.5z"/>
                  <path fill="currentColor" d="M34.8 14.8h-7.6v15.9h3.6v-5.9h4c3.4 0 6-2.3 6-5s-2.6-5-6-5zm-.1 6.8h-3.9v-3.7h3.9c1.7 0 2.8.9 2.8 1.8s-1.1 1.9-2.8 1.9zM48.8 20.7c-2.3 0-4.3 1.8-4.3 4.2 0 2.4 1.9 4.2 4.3 4.2 1.1 0 2.2-.5 2.9-1.3v1.1h3.4V21h-3.4v1.1c-.7-.9-1.8-1.4-2.9-1.4zm.5 5.5c-1.1 0-2-1-2-2.1s.9-2.1 2-2.1 2 1 2 2.1-.9 2.1-2 2.1zM65.4 21l-3.8 9.7h-3.5l1.4-3.1-4.2-9.6h3.8l2.3 5.9 2.3-5.9h3.7z"/>
                </svg>
              </div>
              <div class="other-item-text">
                <div class="other-item-title">Google Pay</div>
                <div class="other-item-sub">Швидка оплата через Google Wallet</div>
              </div>
            </div>
            <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2.5" fill="none">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </button>

          <button
            type="button"
            class="other-method-item"
            onclick={handleManualCardPay}
          >
            <div class="other-method-item-left">
              <div class="other-wallet-icon card">
                💳
              </div>
              <div class="other-item-text">
                <div class="other-item-title">Банківська картка</div>
                <div class="other-item-sub">Visa, Mastercard — введення реквізитів</div>
              </div>
            </div>
            <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2.5" fill="none">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </button>
        </div>
      </div>

      <button
        type="button"
        class="return-to-bank-btn"
        onclick={() => (currentSubView = null)}
      >
        ← Повернутись до Pay by Bank (A2A)
      </button>
    </div>
  </main>
</div>
