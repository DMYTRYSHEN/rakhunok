<script lang="ts">
  import { checkout, formatNumber } from '../state/checkout.svelte.js';
  import Odometer from '../components/Odometer.svelte';

  function handleBack(): void {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      window.history.back();
    }
  }

  const displayValue = $derived(checkout.keypadValue === '' ? '0' : checkout.keypadValue);
  const isValidAmount = $derived(checkout.baseAmount > 0);
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

  <div class="amount-entry">
    <div class="entry-hint">
      {checkout.resolvedScenario.config?.hint || 'Введіть суму до сплати'}
    </div>
    <div class="entry-amount" class:empty={!isValidAmount}>
      <Odometer value={displayValue} suffix=" ₴" suffixClass="cur" />
    </div>
  </div>

  <div class="keypad">
    {#each ['1', '2', '3', '4', '5', '6', '7', '8', '9', ',', '0'] as key}
      <button
        class="key"
        onclick={() => checkout.setKeypadDigit(key)}
      >
        {key}
      </button>
    {/each}
    <button
      class="key"
      onclick={() => checkout.setKeypadDigit('del')}
      aria-label="Стерти"
    >
      <svg
        viewBox="0 0 24 24"
        width="22"
        height="22"
        stroke="currentColor"
        stroke-width="2"
        fill="none"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z"></path>
        <line x1="18" y1="9" x2="12" y2="15"></line>
        <line x1="12" y1="9" x2="18" y2="15"></line>
      </svg>
    </button>
  </div>

  <button
    class="order-cta"
    disabled={!isValidAmount}
    onclick={() => checkout.openPaymentSheet()}
  >
    {checkout.resolvedScenario.config?.ctaText || 'Перейти до оплати'}
  </button>
</div>
