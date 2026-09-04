<script lang="ts">
  import { checkout } from '../state/checkout.svelte.js';
  import OrderScenario from './OrderScenario.svelte';

  const screen = $derived.by(() => checkout.resolvedScenario.activeScreen);
  const scenarioType = $derived.by(() => checkout.resolvedScenario.type);
</script>

<div class="screen active">
  {#if screen === 'index' || scenarioType === 'index'}
    {#await import('./IndexScenario.svelte') then { default: IndexScenario }}
      <IndexScenario />
    {/await}
  {:else if screen === 'tips' || scenarioType === 'tips'}
    {#await import('./TipsScenario.svelte') then { default: TipsScenario }}
      <TipsScenario />
    {/await}
  {:else if screen === 'donation' || scenarioType === 'donation'}
    {#await import('./DonationScenario.svelte') then { default: DonationScenario }}
      <DonationScenario />
    {/await}
  {:else if screen === 'profile' || scenarioType === 'profile'}
    {#await import('./ProfileScenario.svelte') then { default: ProfileScenario }}
      <ProfileScenario />
    {/await}
  {:else if screen === 'amount'}
    {#await import('./AmountScenario.svelte') then { default: AmountScenario }}
      <AmountScenario />
    {/await}
  {:else if screen === 'delivery'}
    {#await import('./DeliveryScenario.svelte') then { default: DeliveryScenario }}
      <DeliveryScenario />
    {/await}
  {:else if scenarioType === 'table' || screen === 'waiting' || screen === 'table'}
    {#await import('./TableScenario.svelte') then { default: TableScenario }}
      <TableScenario />
    {/await}
  {:else}
    <OrderScenario />
  {/if}
</div>
