<script lang="ts">
  import { checkout, formatNumber } from '../state/checkout.svelte.js';

  async function handleShare(): Promise<void> {
    checkout.closeActionSheet();
    const shareData = {
      title: `${checkout.merchantName} · ${checkout.order?.order_number || ''}`,
      text: `${checkout.order?.order_number || 'Замовлення'} на суму ${formatNumber(checkout.totalAmount)} ₴`,
      url: window.location.href
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch {
        // user cancelled or share failed
      }
    } else {
      try {
        await navigator.clipboard.writeText(`${shareData.text} — ${shareData.url}`);
        checkout.showToast('Скопійовано в буфер обміну');
      } catch {
        checkout.showToast('Не вдалося поділитися');
      }
    }
  }
</script>

<div
  class="action-sheet-overlay"
  class:active={checkout.isActionSheetOpen}
  onclick={(e) => {
    if (e.target === e.currentTarget) checkout.closeActionSheet();
  }}
  role="presentation"
>
  <div class="action-sheet">
    <div class="as-group">
      <div class="as-title">
        {checkout.merchantName} · {checkout.order?.order_number || ''}
      </div>
      <a
        class="as-action"
        href="tel:{checkout.order?.merchant?.phone || '+380800300000'}"
        id="asCallBtn"
      >
        <svg
          viewBox="0 0 24 24"
          width="18"
          height="18"
          stroke="currentColor"
          stroke-width="2"
          fill="none"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path
            d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"
          ></path>
        </svg>
        Зателефонувати продавцю
      </a>
      <button class="as-action" onclick={handleShare} id="shareOrderBtn">
        <svg
          viewBox="0 0 24 24"
          width="18"
          height="18"
          stroke="currentColor"
          stroke-width="2"
          fill="none"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path>
          <polyline points="16 6 12 2 8 6"></polyline>
          <line x1="12" y1="2" x2="12" y2="15"></line>
        </svg>
        Поділитися замовленням
      </button>
    </div>
    <button
      class="as-action as-cancel"
      onclick={() => checkout.closeActionSheet()}
    >
      Скасувати
    </button>
  </div>
</div>
