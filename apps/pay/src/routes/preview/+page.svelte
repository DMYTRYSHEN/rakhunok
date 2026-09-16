<script lang="ts">
	import { onMount } from 'svelte';
	import { checkout } from '$lib/state/checkout.svelte';
	import ScenarioRenderer from '$lib/scenarios/ScenarioRenderer.svelte';
	import type { CheckoutScenarioConfig } from '$lib/features/shared/checkout-scenario-config';

	let loaded = $state(false);

	onMount(() => {
		// Mock an initial order so it renders immediately
		checkout.init({
			id: 'mock-order-id',
			reference: 'PREVIEW-001',
			title: 'Призначення платежу (Прев\'ю)',
			amount: 500,
			currency: 'UAH',
			status: 'pending',
			scenario_type: 'fixed',
			merchant_id: 'mock-merchant',
			scenario_config: {},
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString()
		}, {
			id: 'mock-merchant',
			user_id: 'mock-user',
			business_name: 'Назва вашого бізнесу',
			display_name: 'Ваш бізнес',
			display_color: '#2563EB',
			is_active: true,
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString()
		});
		
		loaded = true;

		// Listen for config updates from the dashboard iframe parent
		const listener = (event: MessageEvent) => {
			if (event.data?.type === 'CHECKOUT_CONFIG_UPDATE') {
				const scenario = event.data.scenario as string;
				const config = event.data.config as CheckoutScenarioConfig;
				
				// Re-init with new config
				checkout.init({
					...checkout.order!,
					scenario_type: scenario,
					scenario_config: config
				}, checkout.merchant!);
			}
		};

		window.addEventListener('message', listener);
		return () => {
			window.removeEventListener('message', listener);
		};
	});
</script>

{#if loaded}
	<ScenarioRenderer />
{:else}
	<div class="flex h-screen items-center justify-center">
		Завантаження прев'ю...
	</div>
{/if}
