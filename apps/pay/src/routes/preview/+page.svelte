<script lang="ts">
	import { onMount } from 'svelte';
	import { checkout } from '../../lib/state/checkout.svelte.js';
	import ScenarioRenderer from '../../lib/scenarios/ScenarioRenderer.svelte';
	import type { Order } from '../../lib/types/order.js';

	let loaded = $state(false);

	function previewOrder(scenario: string, config: Record<string, unknown>): Order {
		return {
			id: 'mock-order-id',
			order_number: 'PREVIEW-001',
			title: "Призначення платежу (Прев'ю)",
			type: scenario,
			status: 'pending',
			total_amount: 500,
			base_amount: 500,
			currency: 'UAH',
			scenario_config: config,
			merchant: {
				business_name: 'Назва вашого бізнесу',
				display_name: 'Ваш бізнес'
			}
		};
	}

	onMount(() => {
		checkout.order = previewOrder('fixed', {});
		loaded = true;

		const listener = (event: MessageEvent) => {
			if (event.data?.type === 'CHECKOUT_CONFIG_UPDATE') {
				const scenario = event.data.scenario as string;
				const config = event.data.config as Record<string, unknown>;
				checkout.order = previewOrder(scenario, config);
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
