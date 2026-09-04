<script lang="ts">
  import { onMount } from 'svelte';
  import BankSheet from './lib/components/BankSheet.svelte';
  import StateScreen from './lib/components/StateScreen.svelte';
  import ThemeToggle from './lib/components/ThemeToggle.svelte';
  import Toast from './lib/components/Toast.svelte';
  import ScenarioRenderer from './lib/scenarios/ScenarioRenderer.svelte';
  import { checkout } from './lib/state/checkout.svelte.js';

  onMount(() => {
    checkout.init();
  });
</script>

<ThemeToggle />

{#if checkout.stateScreenType === 'error'}
  <div class="clip-root">
    <StateScreen />
  </div>
{:else}
  <div class="clip-root">
    <ScenarioRenderer />
  </div>

  <div
    class="dim-layer"
    class:visible={checkout.isSheetOpen}
    onclick={() => checkout.closePaymentSheet()}
    role="presentation"
  ></div>

  <BankSheet />

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
