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

	/* Map Apple HIG styles to apps/pay native OrderScenario styles (like demo=1) */
	:global(.vertical-content-body .ios-root) {
		background: transparent !important;
		border: none !important;
		box-shadow: none !important;
		color: var(--order-text) !important;
		border-radius: 0 !important;
	}

	:global(.vertical-content-body .ios-header) {
		background: transparent !important;
		border-bottom: none !important;
		padding: 0 0 16px 0 !important;
	}

	:global(.vertical-content-body .ios-nav-top) {
		display: none !important; /* Hide HIG title since we have order-nav */
	}

	:global(.vertical-content-body .ios-body) {
		padding: 0 !important;
		gap: 12px !important;
	}

	:global(.vertical-content-body .ios-card) {
		background: var(--order-surface) !important;
		border: none !important;
		border-radius: 18px !important;
		box-shadow: none !important;
		padding: 16px !important;
		color: var(--order-text) !important;
	}

	:global(.vertical-content-body .ios-card-title) {
		color: var(--order-text) !important;
		font-size: 14px !important;
		font-weight: 600 !important;
		margin-bottom: 12px !important;
	}

	:global(.vertical-content-body .ios-segmented),
	:global(.vertical-content-body .ios-segmented-sm) {
		background: var(--order-surface-2) !important;
		border-radius: 12px !important;
		padding: 4px !important;
	}

	:global(.vertical-content-body .ios-segment-btn),
	:global(.vertical-content-body .ios-seg-sm-btn) {
		color: var(--order-text-dim) !important;
		font-weight: 500 !important;
		border-radius: 8px !important;
	}

	:global(.vertical-content-body .ios-segment-btn.active),
	:global(.vertical-content-body .ios-seg-sm-btn.active) {
		background: var(--order-surface) !important;
		color: var(--order-text) !important;
		box-shadow: 0 1px 3px rgba(0,0,0,0.1) !important;
	}

	:global(.vertical-content-body .ios-stepper-capsules) {
		margin-top: 16px !important;
	}

	:global(.vertical-content-body .ios-capsule-item) {
		background: var(--order-surface) !important;
		color: var(--order-text-dim) !important;
		border-radius: 12px !important;
	}

	:global(.vertical-content-body .ios-capsule-item.active) {
		background: var(--order-text) !important;
		color: var(--order-bg) !important;
	}

	:global(.vertical-content-body .ios-capsule-item.done) {
		background: var(--order-surface-2) !important;
		color: var(--order-text) !important;
	}

	:global(.vertical-content-body .ios-club-row),
	:global(.vertical-content-body .ios-addon-item),
	:global(.vertical-content-body .ios-option-tile),
	:global(.vertical-content-body .ios-zone-row) {
		background: var(--order-surface) !important;
		border: 1.5px solid transparent !important;
		border-radius: 15px !important;
		color: var(--order-text) !important;
		padding: 13px 14px !important;
	}

	:global(.vertical-content-body .ios-club-row.selected),
	:global(.vertical-content-body .ios-addon-item.selected),
	:global(.vertical-content-body .ios-option-tile.selected),
	:global(.vertical-content-body .ios-zone-row.selected) {
		border-color: var(--order-text) !important;
	}

	:global(.vertical-content-body .ios-club-name),
	:global(.vertical-content-body .ios-addon-name),
	:global(.vertical-content-body .ios-tariff-title) {
		color: var(--order-text) !important;
	}

	:global(.vertical-content-body .ios-tariff-card) {
		background: var(--order-surface) !important;
		border: 1.5px solid transparent !important;
		border-radius: 15px !important;
	}

	:global(.vertical-content-body .ios-tariff-card.selected) {
		border-color: var(--order-text) !important;
		box-shadow: none !important;
	}

	:global(.vertical-content-body .ios-input) {
		background: var(--order-surface) !important;
		border: 1px solid transparent !important;
		border-radius: 14px !important;
		color: var(--order-text) !important;
		padding: 14px 15px !important;
	}
	
	:global(.vertical-content-body .ios-card .ios-input) {
		background: var(--order-surface-2) !important;
	}

	:global(.vertical-content-body .ios-input:focus) {
		border-color: rgba(128,128,128,0.4) !important;
	}

	:global(.vertical-content-body .ios-bottom-bar) {
		background: transparent !important;
		border-top: none !important;
		padding: 16px 0 0 0 !important;
	}

	:global(.vertical-content-body .ios-pay-btn),
	:global(.vertical-content-body .ios-btn-primary) {
		background: var(--order-cta) !important;
		color: var(--order-cta-text) !important;
		border-radius: 27px !important;
		height: 54px !important;
		font-size: 15px !important;
		font-weight: 700 !important;
		width: 100% !important;
		justify-content: center !important;
		border: none !important;
	}

	:global(.vertical-content-body .ios-next-btn),
	:global(.vertical-content-body .ios-back-btn),
	:global(.vertical-content-body .ios-btn-secondary),
	:global(.vertical-content-body .ios-btn-outline),
	:global(.vertical-content-body .ios-btn-scan) {
		background: var(--order-surface) !important;
		color: var(--order-text) !important;
		border-radius: 27px !important;
		height: 54px !important;
		font-weight: 600 !important;
		border: 1px solid var(--order-divider) !important;
	}

	:global(.vertical-content-body .ios-time-btn),
	:global(.vertical-content-body .ios-date-btn) {
		background: var(--order-surface) !important;
		border: 1.5px solid transparent !important;
		border-radius: 14px !important;
		color: var(--order-text) !important;
	}
	:global(.vertical-content-body .ios-time-btn.selected),
	:global(.vertical-content-body .ios-date-btn.selected) {
		background: var(--order-surface-2) !important;
		border-color: var(--order-text) !important;
	}
	
	:global(.vertical-content-body .ios-stepper-btn) {
		background: var(--order-surface-2) !important;
		color: var(--order-text) !important;
		border: none !important;
	}

	:global(.vertical-content-body .ios-pass-card) {
		background: var(--order-surface) !important;
		border: none !important;
		border-radius: 18px !important;
	}
	
	:global(.vertical-content-body .ios-pass-head) {
		background: var(--order-surface-2) !important;
		color: var(--order-text) !important;
	}

	:global(.vertical-content-body .ios-pass-tariff-name),
	:global(.vertical-content-body .ios-total-row span) {
		color: var(--order-text) !important;
	}

	:global(.vertical-content-body .ios-pass-footer) {
		background: var(--order-surface) !important;
	}

	:global(.vertical-content-body .ios-pass-cut .ios-cut-left),
	:global(.vertical-content-body .ios-pass-cut .ios-cut-right) {
		background: var(--order-bg) !important;
	}
	
	:global(.vertical-content-body .ios-digital-card) {
		background: linear-gradient(135deg, var(--order-surface), var(--order-surface-2)) !important;
		border: 1px solid var(--order-divider) !important;
		box-shadow: none !important;
	}
	
	:global(.vertical-content-body .ios-toggle-switch) {
		background: var(--order-surface-2) !important;
	}
	
	:global(.vertical-content-body .ios-toggle-switch.active) {
		background: var(--accent) !important;
	}
</style>
