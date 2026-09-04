<script lang="ts">
  import { checkout, vibrate } from '../state/checkout.svelte.js';

  function handleReload(): void {
    vibrate(10);
    window.location.reload();
  }

  function handleGoAll(): void {
    vibrate(10);
    window.location.href = './?demo=all';
  }
</script>

<div
  class="screen checkout-state-screen active"
  class:error={checkout.stateScreenType === 'error'}
  role="status"
  aria-live="polite"
>
  <div class="checkout-compact-card">
    <div class="compact-card-icon" class:loading={checkout.stateScreenType !== 'error'}>
      {#if checkout.stateScreenType === 'error'}
        <svg
          viewBox="0 0 24 24"
          width="24"
          height="24"
          stroke="currentColor"
          stroke-width="2.2"
          fill="none"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
          <line x1="9" y1="13" x2="15" y2="13"></line>
          <line x1="12" y1="17" x2="12.01" y2="17"></line>
        </svg>
      {:else}
        <div class="compact-loader-spinner"></div>
      {/if}
    </div>

    <div class="compact-card-content">
      <h1 class="compact-card-title">{checkout.errorTitle}</h1>
      <p class="compact-card-sub">{checkout.errorMessage}</p>
    </div>

    {#if checkout.stateScreenType === 'error'}
      <div class="compact-card-actions">
        <button type="button" class="compact-btn-primary" onclick={handleReload}>
          <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2.5" fill="none">
            <polyline points="23 4 23 10 17 10"></polyline>
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
          </svg>
          <span>Оновити</span>
        </button>

        <button type="button" class="compact-btn-secondary" onclick={handleGoAll}>
          <span>Каталог сценаріїв</span>
        </button>
      </div>
    {/if}
  </div>
</div>
