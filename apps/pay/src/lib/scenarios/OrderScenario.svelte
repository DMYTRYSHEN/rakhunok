<script lang="ts">
  import { checkout, formatNumber, vibrate } from '../state/checkout.svelte.js';
  import Odometer from '../components/Odometer.svelte';

  let promoInput = $state('');
  let isItemsExpanded = $state(true);

  function handlePromo(): void {
    if (checkout.applyPromo(promoInput)) {
      promoInput = '';
    }
  }

  function handleBack(): void {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      window.history.back();
    }
  }
</script>

<div class="screen-content">
  <nav class="order-nav">
    <button class="order-nav-btn back-btn" onclick={handleBack} aria-label="Назад">
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
        <polyline points="15 18 9 12 15 6"></polyline>
      </svg>
    </button>

    <div class="order-merchant">
      <div class="merchant-avatar">
        <img src="./logo.svg" alt="" />
      </div>
      <span class="order-merchant-name">{checkout.merchantName}</span>
    </div>

    <button
      class="order-nav-btn more-btn"
      onclick={() => checkout.openActionSheet()}
      aria-label="Дії"
    >
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
        <circle cx="12" cy="12" r="1"></circle>
        <circle cx="19" cy="12" r="1"></circle>
        <circle cx="5" cy="12" r="1"></circle>
      </svg>
    </button>
  </nav>

  <section class="order-hero">
    <div class="order-hero-label">{checkout.orderLabel}</div>
    <div class="order-hero-amount">
      <Odometer value={formatNumber(checkout.totalAmount)} suffix=" ₴" suffixClass="currency-glyph" />
    </div>

    <div>
      <div
        class="pay-status"
        class:paid={checkout.order?.status === 'paid'}
        class:preparing={checkout.order?.status === 'preparing'}
      >
        <span class="st-dot"></span>
        <span>
          {#if checkout.order?.status === 'paid'}
            Оплачено
          {:else if checkout.order?.status === 'preparing'}
            Готується
          {:else}
            Очікує на оплату
          {/if}
        </span>
      </div>
    </div>

    {#if checkout.totalAmount >= 1000}
      <button class="bnpl-badge" onclick={() => checkout.openBnplSheet()}>
        <span class="bnpl-badge-pill">0%</span>
        <span>або від {checkout.bnplMinMonthly} ₴/міс у Monobank чи Приват24</span>
        <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2.5" fill="none">
          <polyline points="9 18 15 12 9 6"></polyline>
        </svg>
      </button>
    {/if}
  </section>

  <!-- Line Items List (Feature 1: Cart Breakdown) -->
  {#if checkout.orderItems.length > 0}
    <div class="table-items-card">
      <button
        class="table-items-header"
        onclick={() => {
          isItemsExpanded = !isItemsExpanded;
          vibrate(6);
        }}
      >
        <div class="table-items-summary">
          <span class="table-items-icon">
            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
              <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"></path>
              <path d="M3 6h18"></path>
              <path d="M16 10a4 4 0 0 1-8 0"></path>
            </svg>
          </span>
          <span class="table-items-title">Товари в замовленні ({checkout.orderItems.length})</span>
        </div>
        <svg
          class="table-split-arrow"
          class:open={isItemsExpanded}
          viewBox="0 0 24 24"
          width="16"
          height="16"
          stroke="currentColor"
          stroke-width="2.5"
          fill="none"
        >
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </button>

      {#if isItemsExpanded}
        <div class="table-items-list">
          {#each checkout.orderItems as item}
            <div class="table-item-row">
              <div class="table-item-info">
                <span class="table-item-name">{item.name}</span>
                <span class="table-item-qty">{item.qty} × {formatNumber(item.price)} ₴</span>
              </div>
              <span class="table-item-total">{formatNumber(item.qty * item.price)} ₴</span>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  {/if}

  <!-- Quick Upsell (Feature 1: Order Bump in 1-Click) -->
  {#if checkout.upsellItems.length > 0}
    <div class="upsell-section">
      <div class="upsell-header">
        <span>Рекомендуємо до замовлення:</span>
      </div>
      <div class="upsell-chips-scroll">
        {#each checkout.upsellItems as up}
          <button class="upsell-chip" onclick={() => checkout.addUpsell(up)}>
            <span class="upsell-name">{up.name}</span>
            <span class="upsell-price">+{up.price} ₴</span>
            <span class="upsell-plus">+</span>
          </button>
        {/each}
      </div>
    </div>
  {/if}

  <!-- Charity Round-Up for ZSU 🇺🇦 (Feature 2) -->
  {#if checkout.showRoundUp}
    <div class="roundup-card" class:active={checkout.isRoundUpActive}>
      <button class="roundup-btn" onclick={() => checkout.toggleRoundUp()}>
        <div class="roundup-left">
          <span class="roundup-flag">
            <svg viewBox="0 0 24 16" width="22" height="15" style="border-radius: 3px; display: block; box-shadow: 0 1px 3px rgba(0,0,0,0.2);">
              <rect width="24" height="8" fill="#0057B7"></rect>
              <rect y="8" width="24" height="8" fill="#FFD700"></rect>
            </svg>
          </span>
          <div class="roundup-text">
            <div class="roundup-title">Округлити до {Math.ceil(checkout.roundUpTarget)} ₴ на дрони ЗСУ</div>
            <div class="roundup-sub">+{formatNumber(checkout.roundUpDiff)} ₴ решти для 72-ї ОМБр</div>
          </div>
        </div>
        <div class="roundup-toggle" class:on={checkout.isRoundUpActive}>
          <span class="roundup-knob"></span>
        </div>
      </button>
    </div>
  {/if}

  <!-- Loyalty Bonuses (Feature 3) -->
  {#if checkout.availableBonusPoints > 0}
    <div class="loyalty-card" class:active={checkout.useBonuses}>
      <button class="loyalty-btn" onclick={() => checkout.toggleUseBonuses()}>
        <div class="loyalty-left">
          <span class="loyalty-icon">
            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 12 20 22 4 22 4 12"></polyline>
              <rect x="2" y="7" width="20" height="5"></rect>
              <line x1="12" y1="22" x2="12" y2="7"></line>
              <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"></path>
              <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"></path>
            </svg>
          </span>
          <div class="loyalty-text">
            <div class="loyalty-title">Списати {checkout.availableBonusPoints} ₴ бонусів</div>
            <div class="loyalty-sub">+5% кешбеку повернеться на картку</div>
          </div>
        </div>
        <div class="roundup-toggle" class:on={checkout.useBonuses}>
          <span class="roundup-knob"></span>
        </div>
      </button>
    </div>
  {/if}

  <div class="order-card">
    <div class="summary-row">
      <span class="summary-label">Сума замовлення</span>
      <span class="summary-value">{formatNumber(checkout.baseAmount)} ₴</span>
    </div>

    {#if checkout.promoApplied}
      <div class="summary-row discount-row visible">
        <span class="summary-label">Знижка за промокодом</span>
        <span class="summary-value discount">−{formatNumber(checkout.promoDiscount)} ₴</span>
      </div>
    {/if}

    {#if checkout.bonusDiscount > 0}
      <div class="summary-row">
        <span class="summary-label">Списання бонусів</span>
        <span class="summary-value" style="color: #22c55e;">−{formatNumber(checkout.bonusDiscount)} ₴</span>
      </div>
    {/if}

    {#if checkout.roundUpAmount > 0}
      <div class="summary-row">
        <span class="summary-label">Внесок на дрони ЗСУ 🇺🇦</span>
        <span class="summary-value" style="color: #38bdf8;">+{formatNumber(checkout.roundUpAmount)} ₴</span>
      </div>
    {/if}

    <div class="summary-row total">
      <span class="summary-label">До сплати</span>
      <span class="summary-value">{formatNumber(checkout.totalAmount)} ₴</span>
    </div>
  </div>

  <!-- Loyalty Card Scanner Trigger / Connected Badge -->
  {#if checkout.resolvedScenario.config?.showPromo !== false && checkout.allowLoyalty}
    {#if !checkout.loyaltyCard}
      <div class="loyalty-trigger-card">
        <button
          type="button"
          class="loyalty-trigger-btn"
          onclick={() => checkout.openLoyaltyScanner()}
        >
          <div class="loyalty-trigger-left">
            <div class="loyalty-scanner-icon">
              <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none">
                <path d="M3 7V5a2 2 0 0 1 2-2h2"></path>
                <path d="M17 3h2a2 2 0 0 1 2 2v2"></path>
                <path d="M21 17v2a2 2 0 0 1-2 2h-2"></path>
                <path d="M7 21H5a2 2 0 0 1-2-2v-2"></path>
                <line x1="7" y1="12" x2="17" y2="12"></line>
              </svg>
            </div>
            <div class="loyalty-trigger-text">
              <span class="loyalty-trigger-title">Картка лояльності</span>
              <span class="loyalty-trigger-desc">Зісканувати або ввести номер</span>
            </div>
          </div>
          <div class="loyalty-trigger-action">
            <span>Сканер</span>
            <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2.5" fill="none">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </div>
        </button>
      </div>
    {:else}
      <div class="loyalty-connected-badge">
        <button
          type="button"
          class="loyalty-connected-btn"
          onclick={() => checkout.openLoyaltyScanner()}
        >
          <div class="connected-left">
            <div class="connected-emv-icon">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="2" y="5" width="20" height="14" rx="3" stroke="#eab308" />
                <path d="M2 10h20" stroke="#eab308" />
              </svg>
            </div>
            <div class="connected-info">
              <div class="connected-header-row">
                <span class="connected-title">{checkout.loyaltyCard.program_name}</span>
                <span class="connected-tier-pill">{checkout.loyaltyCard.tier}</span>
              </div>
              <span class="connected-saving">
                {checkout.loyaltyCard.use_bonuses
                  ? `−${formatNumber(checkout.bonusDiscount)} списано`
                  : `${formatNumber(checkout.loyaltyCard.bonus_balance)} ₴ бонусів доступно`}
              </span>
            </div>
          </div>
          <div class="connected-edit-pill">
            <span>Змінити</span>
            <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2.5" fill="none">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </div>
        </button>
      </div>
    {/if}
  {/if}

  {#if checkout.resolvedScenario.config?.showPromo !== false && checkout.allowPromo}
    <div class="promo-card">
      <input
        bind:value={promoInput}
        type="text"
        class="promo-input"
        placeholder="Промокод"
        autocomplete="off"
        spellcheck="false"
        disabled={checkout.promoApplied}
        onkeydown={(e) => {
          if (e.key === 'Enter') handlePromo();
        }}
      />
      <button
        class="promo-apply"
        class:applied={checkout.promoApplied}
        disabled={checkout.promoApplied}
        onclick={handlePromo}
      >
        {checkout.promoApplied ? 'Застосовано' : 'Застосувати'}
      </button>
    </div>
  {/if}


  <button
    class="order-cta"
    onclick={() => checkout.openPaymentSheet()}
  >
    <span>{checkout.resolvedScenario.config?.ctaText || 'Перейти до оплати'} {formatNumber(checkout.totalAmount)} ₴</span>
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
      <polyline points="9 18 15 12 9 6"></polyline>
    </svg>
  </button>
</div>
