<script lang="ts">
  import { checkout, formatNumber, vibrate } from '../state/checkout.svelte.js';
  import Odometer from '../components/Odometer.svelte';

  const donation = $derived(checkout.order?.donation || {
    goal_title: '10 FPV-дронів для 72-ї ОМБр «Чорні Запорожці»',
    organizer: 'БФ «Повернись живим»',
    target_amount: 200000,
    collected_amount: 145000,
    presets: [100, 200, 500, 1000]
  });

  const presets = $derived(donation.presets || [100, 200, 500, 1000]);
  let customMode = $state(false);
  let customValue = $state('');

  const progressPct = $derived.by(() => {
    if (!donation.target_amount) return 0;
    return Math.min(100, Math.round((donation.collected_amount / donation.target_amount) * 100));
  });

  function selectPreset(amt: number): void {
    customMode = false;
    checkout.setDonationAmount(amt);
  }

  function handleCustomInput(val: string): void {
    customValue = val.replace(/[^0-9]/g, '');
    const num = parseInt(customValue, 10);
    if (!isNaN(num) && num > 0) {
      checkout.setDonationAmount(num);
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
      <div class="merchant-avatar donation-avatar">
        <span>🇺🇦</span>
      </div>
      <span class="order-merchant-name">{donation.organizer}</span>
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

  <!-- Donation Header -->
  <section class="donation-hero">
    <div class="donation-badge">
      <span class="ua-flag">🇺🇦</span>
      <span>Волонтерська Банка</span>
      <svg viewBox="0 0 24 24" width="13" height="13" fill="#22c55e" stroke="#22c55e">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"></path>
      </svg>
    </div>

    <h1 class="donation-title">{donation.goal_title}</h1>
    <div class="donation-organizer-row">
      <span>Організатор: <strong>{donation.organizer}</strong></span>
    </div>

    <!-- Progress Card -->
    <div class="donation-progress-card">
      <div class="donation-progress-bar-wrap">
        <div class="donation-progress-fill" style="width: {progressPct}%"></div>
      </div>
      <div class="donation-progress-meta">
        <div class="donation-stat">
          <span class="donation-stat-num">{formatNumber(donation.collected_amount)} ₴</span>
          <span class="donation-stat-sub">зібрано ({progressPct}%)</span>
        </div>
        <div class="donation-stat right">
          <span class="donation-stat-num">{formatNumber(donation.target_amount)} ₴</span>
          <span class="donation-stat-sub">мета збору</span>
        </div>
      </div>
    </div>

    <div class="order-hero-amount" style="margin-top: 14px;">
      <Odometer value={formatNumber(checkout.totalAmount)} suffix=" ₴" />
    </div>
    <div class="pay-status" style="margin-top: 4px;">
      <span class="st-dot ua"></span>
      <span>Сума вашого внеску</span>
    </div>
  </section>

  <!-- Quick Amounts Grid -->
  <div class="tips-presets-grid">
    {#each presets as amt}
      <button
        class="tips-preset-chip"
        class:active={!customMode && checkout.donationAmount === amt}
        onclick={() => selectPreset(amt)}
      >
        {amt} ₴
      </button>
    {/each}
    <button
      class="tips-preset-chip custom-chip"
      class:active={customMode}
      onclick={() => {
        customMode = true;
        vibrate(8);
      }}
    >
      Інша сума
    </button>
  </div>

  {#if customMode}
    <div class="promo-card" style="margin-top: 8px;">
      <input
        type="number"
        pattern="[0-9]*"
        class="promo-input"
        placeholder="Введіть суму донату в ₴"
        value={customValue}
        oninput={(e) => handleCustomInput((e.target as HTMLInputElement).value)}
      />
    </div>
  {/if}

  <!-- Comment & Anonymous Checkbox -->
  <div class="tips-note-card">
    <div class="tips-note-label">Слова підтримки або позивний:</div>
    <input
      type="text"
      class="tips-note-input"
      placeholder="На перемогу! Слава Україні! 🇺🇦"
      bind:value={checkout.donationComment}
    />
    <label class="donation-anon-label">
      <input type="checkbox" bind:checked={checkout.isAnonymousDonation} />
      <span>Зробити донат анонімним</span>
    </label>
  </div>

  <div class="tips-trust-footer">
    <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
    </svg>
    <span>100% коштів зараховуються на офіційний рахунок збору</span>
  </div>

  <button class="order-cta donation-cta" onclick={() => checkout.openPaymentSheet()}>
    <span>Задонатити {formatNumber(checkout.totalAmount)} ₴</span>
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
