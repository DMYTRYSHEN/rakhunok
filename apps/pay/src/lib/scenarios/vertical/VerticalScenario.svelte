<script lang="ts">
	import { checkout } from '../../state/checkout.svelte.js';
	import FitnessTemplatePreview from '$lib/features/dashboard/business-settings/templates/FitnessTemplatePreview.svelte';
	import EventsTemplatePreview from '$lib/features/dashboard/business-settings/templates/EventsTemplatePreview.svelte';
	import CleaningTemplatePreview from '$lib/features/dashboard/business-settings/templates/CleaningTemplatePreview.svelte';
	import AutoServiceTemplatePreview from '$lib/features/dashboard/business-settings/templates/AutoServiceTemplatePreview.svelte';
	import BeautyStudioTemplatePreview from '$lib/features/dashboard/business-settings/templates/BeautyStudioTemplatePreview.svelte';
	import GroomingTemplatePreview from '$lib/features/dashboard/business-settings/templates/GroomingTemplatePreview.svelte';
	import FlowerShopTemplatePreview from '$lib/features/dashboard/business-settings/templates/FlowerShopTemplatePreview.svelte';
	import GiftsTemplatePreview from '$lib/features/dashboard/business-settings/templates/GiftsTemplatePreview.svelte';

	const scenarioType = $derived(checkout.resolvedScenario.type);
	const flowData = $derived((checkout.resolvedScenario.config?.flow_data ?? {}) as Record<string, any>);
	const merchantName = $derived(checkout.merchantName || 'Платформа Рахунок');

	function handlePay(amount: number) {
		checkout.keypadValue = String(amount).replace('.', ',');
		checkout.openPaymentSheet();
	}

	function goBack() {
		if (typeof window !== 'undefined') {
			window.location.href = './?demo=all';
		}
	}
</script>

<div class="screen-content vertical-mobile-screen">
	<nav class="order-nav">
		<button class="order-nav-btn" onclick={goBack} aria-label="Назад">←</button>
		<div class="header-titles">
			<strong>{merchantName}</strong>
			<span>Шаблон чекауту</span>
		</div>
		<button
			class="order-nav-btn"
			onclick={() => checkout.openActionSheet()}
			aria-label="Дії"
		>•••</button>
	</nav>

	<div class="vertical-content-body">
		{#if scenarioType === 'vertical_fitness'}
			<FitnessTemplatePreview {flowData} onPay={handlePay} />
		{:else if scenarioType === 'vertical_events'}
			<EventsTemplatePreview {flowData} onPay={handlePay} />
		{:else if scenarioType === 'vertical_cleaning'}
			<CleaningTemplatePreview {flowData} onPay={handlePay} />
		{:else if scenarioType === 'vertical_auto'}
			<AutoServiceTemplatePreview scenario={scenarioType} {flowData} onPay={handlePay} />
		{:else if scenarioType === 'vertical_beauty'}
			<BeautyStudioTemplatePreview {flowData} onPay={handlePay} />
		{:else if scenarioType === 'vertical_pets'}
			<GroomingTemplatePreview {flowData} onPay={handlePay} />
		{:else if scenarioType === 'vertical_flowers'}
			<FlowerShopTemplatePreview {flowData} onPay={handlePay} />
		{:else if scenarioType === 'vertical_gifts'}
			<GiftsTemplatePreview {flowData} onPay={handlePay} />
		{/if}
	</div>
</div>

<style>
	.vertical-mobile-screen {
		display: flex;
		flex-direction: column;
		height: 100dvh;
		max-height: 100dvh;
		overflow: hidden;
		background: var(--order-bg);
		color: var(--order-text);
		padding: 0;
	}

	.order-nav {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.75rem 1rem;
		background: var(--order-surface);
		border-bottom: 1px solid var(--order-divider);
		z-index: 10;
	}

	.header-titles {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		min-width: 0;
	}

	.header-titles strong {
		font-size: 0.95rem;
		font-weight: 700;
		color: var(--order-text);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 220px;
	}

	.header-titles span {
		font-size: 0.72rem;
		color: var(--order-text-dim);
	}

	.vertical-content-body {
		flex: 1;
		overflow-y: auto;
		-webkit-overflow-scrolling: touch;
		padding: 0.75rem;
		display: flex;
		flex-direction: column;
	}

	/* Ensure inner preview components adapt to dark mode seamlessly */
	:global(body:not(.light-mode)) .vertical-content-body :global(.ios-root) {
		background: #121319;
		border-color: rgba(255, 255, 255, 0.08);
		color: #f5f6f8;
	}

	:global(body:not(.light-mode)) .vertical-content-body :global(.ios-header) {
		background: #181a22;
		border-bottom-color: rgba(255, 255, 255, 0.08);
	}

	:global(body:not(.light-mode)) .vertical-content-body :global(.ios-nav-title) {
		color: #ffffff;
	}

	:global(body:not(.light-mode)) .vertical-content-body :global(.ios-segmented) {
		background: #232632;
	}

	:global(body:not(.light-mode)) .vertical-content-body :global(.ios-segment-btn) {
		color: #94a3b8;
	}

	:global(body:not(.light-mode)) .vertical-content-body :global(.ios-segment-btn.active) {
		background: #2e3242;
		color: #ffffff;
	}

	:global(body:not(.light-mode)) .vertical-content-body :global(.ios-capsule-item) {
		background: #1e202b;
		color: #94a3b8;
	}

	:global(body:not(.light-mode)) .vertical-content-body :global(.ios-card) {
		background: #181a22;
		border-color: rgba(255, 255, 255, 0.06);
		color: #f5f6f8;
	}

	:global(body:not(.light-mode)) .vertical-content-body :global(.ios-card-title) {
		color: #ffffff;
	}

	:global(body:not(.light-mode)) .vertical-content-body :global(.ios-club-row),
	:global(body:not(.light-mode)) .vertical-content-body :global(.ios-addon-item),
	:global(body:not(.light-mode)) .vertical-content-body :global(.ios-zone-row),
	:global(body:not(.light-mode)) .vertical-content-body :global(.ios-option-tile) {
		background: #1e202b;
		border-color: rgba(255, 255, 255, 0.06);
		color: #f5f6f8;
	}

	:global(body:not(.light-mode)) .vertical-content-body :global(.ios-club-name),
	:global(body:not(.light-mode)) .vertical-content-body :global(.ios-addon-name),
	:global(body:not(.light-mode)) .vertical-content-body :global(.ios-tariff-title) {
		color: #ffffff;
	}

	:global(body:not(.light-mode)) .vertical-content-body :global(.ios-tariff-card) {
		background: #181a22;
		border-color: rgba(255, 255, 255, 0.08);
	}

	:global(body:not(.light-mode)) .vertical-content-body :global(.ios-input) {
		background: #1e202b;
		border-color: rgba(255, 255, 255, 0.12);
		color: #ffffff;
	}

	:global(body:not(.light-mode)) .vertical-content-body :global(.ios-pass-card) {
		background: #181a22;
		border-color: rgba(255, 255, 255, 0.08);
	}

	:global(body:not(.light-mode)) .vertical-content-body :global(.ios-pass-tariff-name),
	:global(body:not(.light-mode)) .vertical-content-body :global(.ios-total-row span) {
		color: #ffffff;
	}

	:global(body:not(.light-mode)) .vertical-content-body :global(.ios-pass-footer) {
		background: #14151c;
	}

	:global(body:not(.light-mode)) .vertical-content-body :global(.ios-pass-cut .ios-cut-left),
	:global(body:not(.light-mode)) .vertical-content-body :global(.ios-pass-cut .ios-cut-right) {
		background: #121319;
	}

	:global(body:not(.light-mode)) .vertical-content-body :global(.ios-bottom-bar) {
		background: #181a22;
		border-top-color: rgba(255, 255, 255, 0.08);
	}
</style>
