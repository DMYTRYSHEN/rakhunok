<script lang="ts">
  import { onMount } from 'svelte';
  import StateScreen from './lib/components/StateScreen.svelte';
  import ThemeToggle from './lib/components/ThemeToggle.svelte';
  import Toast from './lib/components/Toast.svelte';
  import { checkout } from './lib/state/checkout.svelte.js';

  let isDesktop = $state<boolean | null>(null);
  let bankSheetRequested = $state(false);
  let loadAttempt = $state(0);
  let bankLoadAttempt = $state(0);

  $effect(() => {
    if (checkout.isSheetOpen) bankSheetRequested = true;
  });

  onMount(() => {
    // Detect desktop/tablet via CSS media query (> phone width)
    const mql = window.matchMedia('(min-width: 768px)');
    isDesktop = mql.matches;
    const updateDesktop = (e: MediaQueryListEvent) => (isDesktop = e.matches);
    mql.addEventListener('change', updateDesktop);

    checkout.init();
    return () => {
      mql.removeEventListener('change', updateDesktop);
      checkout.disposeTerminal();
    };
  });
</script>

{#snippet loadError()}
  <div role="alert">
    <p>Не вдалося завантажити екран.</p>
    <button type="button" onclick={() => loadAttempt++}>Повторити</button>
  </div>
{/snippet}

{#if isDesktop === null}
  <p role="status">Завантаження...</p>
{:else if isDesktop}
  {#key loadAttempt}
    {#await import('./lib/components/DesktopCheckout.svelte')}
      <p role="status">Завантаження...</p>
    {:then { default: DesktopCheckout }}
      <DesktopCheckout />
    {:catch}
      {@render loadError()}
    {/await}
  {/key}
{:else}
  <ThemeToggle />

  {#if checkout.stateScreenType === 'error'}
    <div class="clip-root">
      <StateScreen />
    </div>
  {:else}
    <div class="clip-root">
      {#key loadAttempt}
        {#await import('./lib/scenarios/ScenarioRenderer.svelte')}
          <p role="status">Завантаження...</p>
        {:then { default: ScenarioRenderer }}
          <ScenarioRenderer />
        {:catch}
          {@render loadError()}
        {/await}
      {/key}
    </div>

    <div
      class="dim-layer"
      class:visible={checkout.isSheetOpen}
      onclick={() => checkout.closePaymentSheet()}
      role="presentation"
    ></div>

    {#if bankSheetRequested}
      {#key bankLoadAttempt}
        {#await import('./lib/components/BankSheet.svelte')}
          {#if checkout.isSheetOpen}<div class="sheet-loading" role="status">Завантаження...</div>{/if}
        {:then { default: BankSheet }}
          <BankSheet />
        {:catch}
          {#if checkout.isSheetOpen}
            <div class="sheet-loading" role="alert">
              <p>Не вдалося завантажити способи оплати.</p>
              <button type="button" onclick={() => bankLoadAttempt++}>Повторити</button>
              <button type="button" onclick={() => checkout.closePaymentSheet()}>Закрити</button>
            </div>
          {/if}
        {/await}
      {/key}
    {/if}

    {#if checkout.isStatusScreenOpen || checkout.isFiscalReceiptOpen}
      {#await import('./lib/components/StatusScreen.svelte') then { default: StatusScreen }}
        <StatusScreen />
      {/await}
    {/if}

    {#if checkout.isActionSheetOpen}
      {#await import('./lib/components/ActionSheet.svelte') then { default: ActionSheet }}
        <ActionSheet />
      {/await}
    {/if}

    {#if checkout.isBnplSheetOpen}
      {#await import('./lib/components/BnplSheet.svelte') then { default: BnplSheet }}
        <BnplSheet />
      {/await}
    {/if}

    {#if checkout.isNpTrackingOpen}
      {#await import('./lib/components/NovaPoshtaTrackingModal.svelte') then { default: NovaPoshtaTrackingModal }}
        <NovaPoshtaTrackingModal />
      {/await}
    {/if}

    {#if checkout.isLoyaltyScannerOpen}
      {#await import('./lib/components/LoyaltyScannerModal.svelte') then { default: LoyaltyScannerModal }}
        <LoyaltyScannerModal />
      {/await}
    {/if}

    <Toast />
  {/if}
{/if}

<style>
  .sheet-loading {
    position: fixed;
    inset: auto 0 0;
    z-index: 1000;
    padding: 24px;
    background: var(--sk-bg);
    text-align: center;
  }
</style>
