<script lang="ts">
  import { checkout, formatNumber, vibrate } from '../state/checkout.svelte.js';
  import Odometer from '../components/Odometer.svelte';

  const presets = [20, 50, 100, 200];
  let customMode = $state(false);
  let customValue = $state('');

  function selectPreset(amount: number): void {
    customMode = false;
    checkout.setTip(amount, null);
  }

  function handleCustomInput(val: string): void {
    customValue = val.replace(/[^0-9]/g, '');
    const num = parseInt(customValue, 10);
    if (!isNaN(num) && num > 0) {
      checkout.setTip(num, null);
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
      <span class="order-merchant-name">{checkout.order?.merchant?.business_name || 'Кав’ярня'}</span>
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

  <section class="tips-hero">
    <div class="tips-avatar-wrap">
      <div class="tips-avatar">
        <span>👨‍🍳</span>
      </div>
      <div class="tips-rating-badge">
        <svg viewBox="0 0 24 24" width="12" height="12" fill="#ffb800" stroke="#ffb800">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
        </svg>
        <span>4.96</span>
      </div>
    </div>

    <h1 class="tips-name">{checkout.order?.waiter?.name ? `Офіціант ${checkout.order.waiter.name}` : 'Офіціант Олександр'}</h1>
    <p class="tips-caption">
      {checkout.order?.waiter?.caption || 'Збираю на навчання та подорож 🌍'}
    </p>

    <div class="order-hero-amount" style="margin-top: 14px;">
      <Odometer value={formatNumber(checkout.totalAmount)} suffix=" ₴" />
    </div>
    <div class="pay-status" style="margin-top: 4px;">
      <span class="st-dot"></span>
      <span>Чайові офіціанту</span>
    </div>
  </section>

  <!-- Tip Presets -->
  <div class="tips-presets-grid">
    {#each presets as amt}
      <button
        class="tips-preset-chip"
        class:active={!customMode && checkout.tipAmount === amt}
        onclick={() => selectPreset(amt)}
      >
        +{amt} ₴
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
        placeholder="Введіть суму в ₴"
        value={customValue}
        oninput={(e) => handleCustomInput((e.target as HTMLInputElement).value)}
      />
    </div>
  {/if}

  <!-- Note Input -->
  <div class="tips-note-card">
    <div class="tips-note-label">Подяка або коментар:</div>
    <input
      type="text"
      class="tips-note-input"
      placeholder="Дякую за чудовий сервіс та настрій! ☕"
      bind:value={checkout.tipNote}
    />
  </div>

  <div class="tips-trust-footer">
    <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
    </svg>
    <span>Чайові зараховуються напряму на картку офіціанта</span>
  </div>

  <button class="order-cta" onclick={() => checkout.openPaymentSheet()}>
    <span>Подякувати {formatNumber(checkout.totalAmount)} ₴</span>
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
