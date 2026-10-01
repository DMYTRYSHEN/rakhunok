<script lang="ts">
  import { checkout, formatNumber, vibrate } from '../state/checkout.svelte.js';
  import Odometer from '../components/Odometer.svelte';

  const configuredDonation = $derived(
    checkout.order?.scenario_config?.checkout_flow &&
    typeof checkout.order.scenario_config.checkout_flow === 'object' &&
    'id' in checkout.order.scenario_config.checkout_flow &&
    checkout.order.scenario_config.checkout_flow.id === 'donation'
      ? (checkout.order.scenario_config.flow_data as { donation?: typeof checkout.order.donation } | undefined)?.donation
      : undefined
  );
  const donation = $derived(configuredDonation || checkout.order?.donation);
  const organizer = $derived(donation?.organizer || checkout.order?.merchant?.display_name || 'Організатор збору');
  const goalTitle = $derived(donation?.goal_title || checkout.order?.title || 'Збір коштів');

  const presets = $derived(checkout.order?.scenario_config?.quick_amounts as number[] | undefined || donation?.presets || [100, 200, 500, 1000]);
  let customMode = $state(false);
  let customValue = $state('');

  const progressPct = $derived.by(() => {
    if (!donation?.target_amount || !donation.collected_amount) return 0;
    return Math.min(100, Math.round((donation.collected_amount / donation.target_amount) * 100));
  });

  function selectPreset(amt: number): void {
    customMode = false;
    checkout.setDonationAmount(amt);
  }

  function handleCustomInput(val: string): void {
    customValue = val.replace(/[^0-9]/g, '');
    const num = parseInt(customValue, 10);
    checkout.setDonationAmount(Number.isFinite(num) && num > 0 ? num : 0);
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
        <span>₴</span>
      </div>
      <span class="order-merchant-name">{organizer}</span>
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
      <span>Збір коштів</span>
    </div>

    <h1 class="donation-title">{goalTitle}</h1>
    <div class="donation-organizer-row">
      <span>Організатор: <strong>{organizer}</strong></span>
    </div>

    <!-- Progress Card -->
    {#if donation?.target_amount && donation.collected_amount !== undefined}
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
    {/if}

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
        checkout.setDonationAmount(0);
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

  <div class="tips-trust-footer">
    <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
    </svg>
    <span>Перед оплатою перевірте отримувача та призначення платежу</span>
  </div>

  <button class="order-cta donation-cta" disabled={checkout.totalAmount <= 0} onclick={() => checkout.openPaymentSheet()}>
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
