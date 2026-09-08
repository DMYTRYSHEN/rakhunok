<script lang="ts">
  import type { Snippet } from 'svelte';
  import Odometer from './Odometer.svelte';

  let {
    merchantName,
    orderLabel,
    amount,
    baseAmount = amount,
    statusText,
    paid = false,
    preparing = false,
    canPay = true,
    ctaText = 'Перейти до оплати',
    onpay,
    navigation,
    beforeSummary,
    afterSummary,
    heroExtras,
    summaryExtras,
    children
  }: {
    merchantName: string;
    orderLabel: string;
    amount: number | null;
    baseAmount?: number | null;
    statusText: string;
    paid?: boolean;
    preparing?: boolean;
    canPay?: boolean;
    ctaText?: string;
    onpay?: () => void;
    navigation?: Snippet<[Snippet]>;
    beforeSummary?: Snippet;
    afterSummary?: Snippet;
    heroExtras?: Snippet;
    summaryExtras?: Snippet;
    children?: Snippet;
  } = $props();

  function formatAmount(value: number): string {
    return value.toFixed(2).replace('.', ',');
  }
</script>

{#snippet merchant()}
  <div class="order-merchant">
    <div class="merchant-avatar">
      <img src="./logo.svg" alt="" />
    </div>
    <span class="order-merchant-name">{merchantName}</span>
  </div>
{/snippet}

<div class="screen-content">
  <nav class="order-nav">
    {#if navigation}
      {@render navigation(merchant)}
    {:else}
      {@render merchant()}
    {/if}
  </nav>

  <section class="order-hero">
    <div class="order-hero-label">{orderLabel}</div>
    {#if amount !== null}
      <div
        class="order-hero-amount"
        role="img"
        aria-label={`${formatAmount(amount)} ₴`}
        data-testid="invoice-amount"
      >
        <div aria-hidden="true">
          <Odometer value={formatAmount(amount)} suffix=" ₴" suffixClass="currency-glyph" />
        </div>
      </div>
    {/if}

    <div>
      <div class="pay-status" class:paid class:preparing>
        <span class="st-dot"></span>
        <span>{statusText}</span>
      </div>
    </div>

    {@render heroExtras?.()}
  </section>

  {@render beforeSummary?.()}

  <div class="order-card">
    {#if baseAmount !== null}
      <div class="summary-row">
        <span class="summary-label">Сума замовлення</span>
        <span class="summary-value">{formatAmount(baseAmount)} ₴</span>
      </div>
    {/if}

    {@render summaryExtras?.()}

    {#if amount !== null}
      <div class="summary-row total">
        <span class="summary-label">До сплати</span>
        <span class="summary-value">{formatAmount(amount)} ₴</span>
      </div>
    {/if}
  </div>

  {@render afterSummary?.()}
  {@render children?.()}

  <button
    class="order-cta"
    data-testid="invoice-pay"
    disabled={!canPay}
    onclick={onpay}
  >
    <span>{ctaText}{#if amount !== null} {formatAmount(amount)} ₴{/if}</span>
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