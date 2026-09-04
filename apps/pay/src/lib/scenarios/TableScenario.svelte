<script lang="ts">
  import { checkout, formatNumber, vibrate } from '../state/checkout.svelte.js';
  import Odometer from '../components/Odometer.svelte';
  import { formatRemainingTime, getOrderRemainingSeconds, getOrderTotalTtlSeconds } from '../services/expiry.js';
  import { startTableSync } from '../services/realtime.js';
  import type { Order } from '../types/order.js';

  let remainingSeconds = $state<number>(0);
  let totalTtlSeconds = $state<number>(0);
  let countdownTimer: ReturnType<typeof setInterval> | null = null;

  // Cart line items expansion
  let isItemsExpanded = $state<boolean>(true);

  // Split bill controls
  let isSplitExpanded = $state<boolean>(false);
  let customSplitVal = $state<string>('');

  // Tip controls
  let isCustomTipActive = $state<boolean>(false);
  let customTipVal = $state<string>('');

  const tip10 = $derived(Math.round(checkout.tableShareAmount * 0.1));
  const tip15 = $derived(Math.round(checkout.tableShareAmount * 0.15));
  const tip20 = $derived(Math.round(checkout.tableShareAmount * 0.2));

  const isPreparing = $derived.by(() => {
    return (
      checkout.order?.status === 'preparing' ||
      !checkout.order?.total_amount ||
      checkout.order.total_amount <= 0
    );
  });

  const tableLabel = $derived.by(() => {
    if (checkout.terminal) return checkout.terminal.name;
    if (checkout.order?.table_number) return `Столик ${checkout.order.table_number}`;
    return checkout.order?.title || 'Термінал';
  });

  const ttlProgressPct = $derived.by(() => {
    if (totalTtlSeconds <= 0) return 0;
    return Math.max(0, Math.min(100, (remainingSeconds / totalTtlSeconds) * 100));
  });

  function selectTipPct(pct: number | null): void {
    isCustomTipActive = false;
    if (pct === null || pct === 0) {
      checkout.setTip(0, null);
    } else {
      const amt = Math.round(checkout.tableShareAmount * (pct / 100));
      checkout.setTip(amt, pct);
    }
  }

  function handleCustomTipInput(val: string): void {
    customTipVal = val.replace(/[^0-9]/g, '');
    const num = parseInt(customTipVal, 10);
    if (!isNaN(num) && num >= 0) {
      checkout.setTip(num, null);
    }
  }

  function handleCustomSplitInput(val: string): void {
    customSplitVal = val.replace(/[^0-9]/g, '');
    const num = parseInt(customSplitVal, 10);
    if (!isNaN(num) && num > 0) {
      checkout.setSplitCustomAmount(num);
    }
  }

  function startCountdown(order: Order): void {
    if (countdownTimer) clearInterval(countdownTimer);

    function tick() {
      const rem = getOrderRemainingSeconds(order, Date.now(), checkout.legacyTtlMinutes);
      remainingSeconds = rem;
      totalTtlSeconds = getOrderTotalTtlSeconds(order, checkout.legacyTtlMinutes);

      if (rem <= 0) {
        if (countdownTimer) clearInterval(countdownTimer);
        vibrate(10);
      }
    }

    tick();
    countdownTimer = setInterval(tick, 1000);
  }

  $effect(() => {
    if (checkout.terminal) {
      const stopSync = startTableSync(
        checkout.terminal,
        checkout.legacyTtlMinutes,
        (newOrder) => {
          vibrate([30, 50, 30]);
          checkout.order = newOrder;
          startCountdown(newOrder);
        }
      );
      return () => {
        stopSync();
        if (countdownTimer) clearInterval(countdownTimer);
      };
    } else if (checkout.order && !isPreparing) {
      startCountdown(checkout.order);
      return () => {
        if (countdownTimer) clearInterval(countdownTimer);
      };
    }
  });

  let elapsedWaitSeconds = $state<number>(34);
  let isRefreshing = $state<boolean>(false);

  function formatElapsed(sec: number): string {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  }

  function handleManualRefresh(): void {
    vibrate(10);
    isRefreshing = true;
    setTimeout(() => {
      isRefreshing = false;
      checkout.showToast('Статус столика синхронізовано з POS');
    }, 600);
  }

  function handleCallWaiter(): void {
    vibrate([15, 30, 15]);
    checkout.showToast('Офіціанту надіслано сигнал до столика №12');
  }

  $effect(() => {
    if (isPreparing) {
      const waitTimer = setInterval(() => {
        elapsedWaitSeconds += 1;
      }, 1000);
      return () => clearInterval(waitTimer);
    }
  });

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

  {#if isPreparing}
    <!-- Screen: Waiting (Apple Sonar Radar Redesign) -->
    <div class="waiting-wrap">
      <div class="table-badge">
        <svg
          viewBox="0 0 24 24"
          width="14"
          height="14"
          stroke="currentColor"
          stroke-width="2.5"
          fill="none"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <rect x="3" y="3" width="18" height="18" rx="4"></rect>
        </svg>
        <span>{tableLabel}</span>
      </div>

      <!-- Apple Sonar Radar Stage -->
      <div class="sonar-stage" role="status" aria-label="Рахунок формується">
        <div class="sonar-ring ring-1"></div>
        <div class="sonar-ring ring-2"></div>
        <div class="sonar-ring ring-3"></div>
        <div class="sonar-sweep"></div>

        <div class="sonar-core">
          <div class="sonar-icon">
            <svg
              viewBox="0 0 24 24"
              width="28"
              height="28"
              stroke="currentColor"
              stroke-width="2"
              fill="none"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <polyline points="10 9 9 9 8 9"></polyline>
            </svg>
          </div>
          <div class="sonar-beacon"></div>
        </div>
      </div>

      <div class="waiting-title">
        {checkout.resolvedScenario.config?.waitingTitle || 'Готуємо рахунок'}
      </div>

      <div class="waiting-sub">
        {checkout.resolvedScenario.config?.waitingSub ||
          "Сума з'явиться автоматично, щойно офіціант закриє замовлення."}
      </div>

      <!-- Live Apple Inset Status Card -->
      <div class="waiting-live-card">
        <div class="live-card-top">
          <div class="live-card-badge">
            <span class="live-card-dot"></span>
            <span>LIVE POS SYNC</span>
          </div>
          <div class="live-card-timer">
            ⏱ {formatElapsed(elapsedWaitSeconds)}
          </div>
        </div>

        <div class="live-status-row">
          <div class="live-status-info">
            <div class="live-status-title">
              {checkout.resolvedScenario.config?.waitingStatus || 'Офіціант формує чек'}
            </div>
            <div class="live-status-detail">
              Синхронізація з касою ресторану (Poster / Syrve)
            </div>
          </div>
        </div>

        <!-- Micro Step Tracker -->
        <div class="live-steps">
          <div class="live-step done">
            <span class="step-icon">✓</span>
            <span>Замовлення</span>
          </div>
          <div class="live-step active">
            <span class="step-spinner"></span>
            <span>Формування</span>
          </div>
          <div class="live-step pending">
            <span class="step-circle"></span>
            <span>Оплата</span>
          </div>
        </div>
      </div>

      <!-- Interactive Quick Actions -->
      <div class="waiting-actions">
        <button
          type="button"
          class="waiting-action-btn primary"
          onclick={handleManualRefresh}
          disabled={isRefreshing}
        >
          <svg
            class:spinning={isRefreshing}
            viewBox="0 0 24 24"
            width="15"
            height="15"
            stroke="currentColor"
            stroke-width="2.5"
            fill="none"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <polyline points="23 4 23 10 17 10"></polyline>
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
          </svg>
          <span>{isRefreshing ? 'Оновлюємо...' : 'Оновити статус'}</span>
        </button>

        <button type="button" class="waiting-action-btn secondary" onclick={handleCallWaiter}>
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
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
          </svg>
          <span>Покликати офіціанта</span>
        </button>
      </div>
    </div>
  {:else}
    <!-- Screen: Ready Table Order -->
    <section class="order-hero">
      <div class="order-hero-label">{tableLabel}</div>
      <div class="order-hero-amount">
        <Odometer value={formatNumber(checkout.totalAmount)} suffix=" ₴" />
      </div>

      <div>
        <div class="pay-status">
          <span class="st-dot"></span>
          <span>Очікує на оплату</span>
        </div>
      </div>

      <!-- Live Table TTL Countdown Timer Bar -->
      {#if Number.isFinite(remainingSeconds) && remainingSeconds > 0}
        <div
          style="display:inline-flex; max-width:220px; margin:10px auto 0; background:rgba(255,255,255,0.06); border:1px solid var(--card-border); border-radius:20px; padding:4px 12px; align-items:center; gap:8px;"
        >
          <span
            style="font-size:11.5px; font-weight:700; color:var(--accent); font-family:monospace;"
          >
            {formatRemainingTime(remainingSeconds)}
          </span>
          <div
            style="flex:1; height:4px; background:rgba(255,255,255,0.1); border-radius:2px; overflow:hidden;"
          >
            <div
              style="width:{ttlProgressPct}%; height:100%; background:var(--accent); transition:width 1s linear;"
            ></div>
          </div>
          <span
            style="font-size:10px; color:var(--order-text-dim); text-transform:uppercase;"
          >
            TTL
          </span>
        </div>
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
            <span class="table-items-title">Склад замовлення ({checkout.orderItems.length} позиції)</span>
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
          <span>Додати до замовлення в 1 клік:</span>
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

    <!-- Split the Bill -->
    {#if checkout.allowSplit}
      <div class="table-split-card">
        <button
          class="table-split-header"
          onclick={() => {
            isSplitExpanded = !isSplitExpanded;
            vibrate(6);
            if (isSplitExpanded && checkout.splitMode === 'none') {
              checkout.setSplitMode('equal');
            }
          }}
        >
          <div class="table-split-icon">
            <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M22 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
          </div>
          <div class="table-split-text">
            <div class="table-split-title">Розділити чек між друзями</div>
            <div class="table-split-sub">
              {#if checkout.splitMode === 'equal'}
                Порівну на {checkout.splitPersons} осіб (по {Math.ceil(checkout.tableBaseAmount / checkout.splitPersons)} ₴)
              {:else if checkout.splitMode === 'custom'}
                Своя частка ({checkout.splitCustomAmount} ₴)
              {:else}
                Оплатити частину чека
              {/if}
            </div>
          </div>
          <svg
            class="table-split-arrow"
            class:open={isSplitExpanded}
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

        {#if isSplitExpanded}
          <div class="table-split-body">
            <div class="table-split-tabs">
              <button
                class="table-split-tab"
                class:active={checkout.splitMode === 'equal'}
                onclick={() => checkout.setSplitMode('equal')}
              >
                Порівну
              </button>
              <button
                class="table-split-tab"
                class:active={checkout.splitMode === 'custom'}
                onclick={() => checkout.setSplitMode('custom')}
              >
                Своя сума
              </button>
              <button
                class="table-split-tab cancel"
                onclick={() => {
                  checkout.setSplitMode('none');
                  isSplitExpanded = false;
                }}
              >
                Скинути
              </button>
            </div>

            {#if checkout.splitMode === 'equal'}
              <div class="table-split-stepper">
                <span class="stepper-label">Кількість гостей:</span>
                <div class="stepper-controls">
                  <button
                    class="stepper-btn"
                    onclick={() => checkout.setSplitPersons(checkout.splitPersons - 1)}
                    disabled={checkout.splitPersons <= 2}
                  >
                    −
                  </button>
                  <span class="stepper-val">{checkout.splitPersons}</span>
                  <button
                    class="stepper-btn"
                    onclick={() => checkout.setSplitPersons(checkout.splitPersons + 1)}
                    disabled={checkout.splitPersons >= 8}
                  >
                    +
                  </button>
                </div>
              </div>
              <div class="split-hint">
                З кожного по <strong>{Math.ceil(checkout.tableBaseAmount / checkout.splitPersons)} ₴</strong> з чека {formatNumber(checkout.tableBaseAmount)} ₴
              </div>
            {:else if checkout.splitMode === 'custom'}
              <div class="promo-card" style="margin-top: 6px;">
                <input
                  type="number"
                  pattern="[0-9]*"
                  class="promo-input"
                  placeholder="Введіть вашу частину суми"
                  value={customSplitVal}
                  oninput={(e) => handleCustomSplitInput((e.target as HTMLInputElement).value)}
                />
              </div>
            {/if}
          </div>
        {/if}
      </div>
    {/if}

    <!-- Tipping Section -->
    {#if checkout.allowTips}
      <div class="table-tips-card">
        <div class="table-tips-header">
          <span class="table-tips-emoji">
            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
            </svg>
          </span>
          <span class="table-tips-title">Подякувати офіціанту?</span>
        </div>

        <div class="table-tips-chips">
          <button
            class="table-tip-chip"
            class:active={checkout.tipAmount === 0 && !isCustomTipActive}
            onclick={() => selectTipPct(0)}
          >
            0%
          </button>
          <button
            class="table-tip-chip"
            class:active={checkout.tipPercentage === 10}
            onclick={() => selectTipPct(10)}
          >
            10% <small>(+{tip10} ₴)</small>
          </button>
          <button
            class="table-tip-chip"
            class:active={checkout.tipPercentage === 15}
            onclick={() => selectTipPct(15)}
          >
            15% <small>(+{tip15} ₴)</small>
          </button>
          <button
            class="table-tip-chip"
            class:active={checkout.tipPercentage === 20}
            onclick={() => selectTipPct(20)}
          >
            20% <small>(+{tip20} ₴)</small>
          </button>
          <button
            class="table-tip-chip custom"
            class:active={isCustomTipActive}
            onclick={() => {
              isCustomTipActive = true;
              vibrate(8);
            }}
          >
            Своя
          </button>
        </div>

        {#if isCustomTipActive}
          <div class="promo-card" style="margin-top: 8px;">
            <input
              type="number"
              pattern="[0-9]*"
              class="promo-input"
              placeholder="Введіть суму чайових в ₴"
              value={customTipVal}
              oninput={(e) => handleCustomTipInput((e.target as HTMLInputElement).value)}
            />
          </div>
        {/if}
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

    <!-- Breakdown Card -->
    <div class="order-card">
      <div class="summary-row">
        <span class="summary-label">Замовлення</span>
        <span class="summary-value">{formatNumber(checkout.tableBaseAmount)} ₴</span>
      </div>

      {#if checkout.splitMode !== 'none'}
        <div class="summary-row">
          <span class="summary-label">
            Ваша частка
            {#if checkout.splitMode === 'equal'}
              (1 з {checkout.splitPersons})
            {/if}
          </span>
          <span class="summary-value">{formatNumber(checkout.tableShareAmount)} ₴</span>
        </div>
      {/if}

      {#if checkout.bonusDiscount > 0}
        <div class="summary-row">
          <span class="summary-label">Списання бонусів</span>
          <span class="summary-value" style="color: #22c55e;">−{formatNumber(checkout.bonusDiscount)} ₴</span>
        </div>
      {/if}

      {#if checkout.tipAmount > 0}
        <div class="summary-row">
          <span class="summary-label">
            Чайові офіціанту
            {#if checkout.tipPercentage}
              ({checkout.tipPercentage}%)
            {/if}
          </span>
          <span class="summary-value" style="color: #22c55e;">+{formatNumber(checkout.tipAmount)} ₴</span>
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

    <!-- Digital Platforms Law (DAC7) Split Settlement Compliance (Feature 5) -->
    {#if checkout.showComplianceCard}
      <div class="compliance-card">
        <div class="compliance-header">
          <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
          </svg>
          <span>Розподіл за Законом про цифрові платформи</span>
        </div>
        <div class="compliance-rows">
          <div class="compliance-row">
            <span>Закладу (ТОВ «СМАК», ПРРО чек):</span>
            <span class="val">{formatNumber(checkout.platformSplit.merchant_amount)} ₴</span>
          </div>
          {#if checkout.platformSplit.waiter_amount > 0}
            <div class="compliance-row">
              <span>Офіціанту (особиста виплата, без ПДВ):</span>
              <span class="val" style="color: #22c55e;">{formatNumber(checkout.platformSplit.waiter_amount)} ₴</span>
            </div>
          {/if}
          {#if checkout.platformSplit.charity_amount > 0}
            <div class="compliance-row">
              <span>На ЗСУ (БФ «Повернись живим»):</span>
              <span class="val" style="color: #38bdf8;">{formatNumber(checkout.platformSplit.charity_amount)} ₴</span>
            </div>
          {/if}
        </div>
      </div>
    {/if}

    <button class="order-cta" onclick={() => checkout.openPaymentSheet()}>
      <span>Перейти до оплати {formatNumber(checkout.totalAmount)} ₴</span>
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
  {/if}
</div>
