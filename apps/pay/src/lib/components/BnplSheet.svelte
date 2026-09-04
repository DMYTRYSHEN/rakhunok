<script lang="ts">
  import { checkout, formatNumber, vibrate } from '../state/checkout.svelte.js';

  let selectedParts = $state(4);
  const partOptions = [3, 4, 6];

  const monthlyAmount = $derived.by(() => {
    return Math.ceil(checkout.payTotalAmount / selectedParts);
  });

  function handleSelectBank(bankName: string): void {
    vibrate(10);
    checkout.closeBnplSheet();
    const idx = checkout.banks.findIndex((b) => b.name.toLowerCase().includes(bankName.toLowerCase()));
    if (idx !== -1) {
      checkout.selectBank(idx);
    }
    checkout.openPaymentSheet();
  }
</script>

<div
  class="action-sheet-overlay"
  class:active={checkout.isBnplSheetOpen}
  onclick={(e) => {
    if (e.target === e.currentTarget) checkout.closeBnplSheet();
  }}
  role="presentation"
>
  <div class="action-sheet bnpl-sheet" role="dialog">
    <div class="as-group" style="padding: 16px;">
      <div class="bnpl-header">
        <div class="bnpl-badge-icon">💳</div>
        <div class="bnpl-title">Оплата частинами під 0%</div>
        <div class="bnpl-sub">Діліть платіж без жодних переплат та відсотків</div>
      </div>

      <!-- Parts selector -->
      <div class="bnpl-parts-selector">
        {#each partOptions as parts}
          <button
            class="bnpl-part-btn"
            class:active={selectedParts === parts}
            onclick={() => {
              selectedParts = parts;
              vibrate(6);
            }}
          >
            <span class="bnpl-part-num">{parts} платежі</span>
            <span class="bnpl-part-val">{Math.ceil(checkout.payTotalAmount / parts)} ₴/міс</span>
          </button>
        {/each}
      </div>

      <div class="bnpl-summary-card">
        <div class="summary-row">
          <span class="summary-label">Загальна сума</span>
          <span class="summary-value">{formatNumber(checkout.payTotalAmount)} ₴</span>
        </div>
        <div class="summary-row">
          <span class="summary-label">Перший платіж сьогодні</span>
          <span class="summary-value">{monthlyAmount} ₴</span>
        </div>
        <div class="summary-row">
          <span class="summary-label">Комісія банку</span>
          <span class="summary-value" style="color: #22c55e; font-weight: 700;">0%</span>
        </div>
      </div>

      <div class="bnpl-banks-grid">
        <button class="bnpl-bank-btn mono" onclick={() => handleSelectBank('monobank')}>
          <div class="bnpl-bank-icon mono-icon">mono</div>
          <div class="bnpl-bank-info">
            <div class="bnpl-bank-name">Покупка частинами Monobank</div>
            <div class="bnpl-bank-hint">{monthlyAmount} ₴ × {selectedParts} міс</div>
          </div>
          <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2.5" fill="none">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </button>

        <button class="bnpl-bank-btn privat" onclick={() => handleSelectBank('приват')}>
          <div class="bnpl-bank-icon privat-icon">P24</div>
          <div class="bnpl-bank-info">
            <div class="bnpl-bank-name">Оплата частинами Приват24</div>
            <div class="bnpl-bank-hint">{monthlyAmount} ₴ × {selectedParts} міс</div>
          </div>
          <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2.5" fill="none">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </button>
      </div>
    </div>

    <button class="as-action as-cancel" onclick={() => checkout.closeBnplSheet()}>
      Закрити
    </button>
  </div>
</div>
