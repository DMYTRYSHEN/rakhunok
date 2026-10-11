<script lang="ts">
	import { Package2, Truck, MapPin, CircleCheck, CircleAlert, ArrowUpRight } from '@lucide/svelte';
	import { statusLabels, stateLabels } from '#lib/tracking-labels.ts';
	import type { PublicTrackingResult } from '#lib/server/tracking/public-tracking.ts';
	let { tracking }: { tracking: PublicTrackingResult } = $props();
	const stages = [
		{ label: 'Оформлення', icon: Package2, statuses: ['label_created', 'accepted'] },
		{ label: 'У дорозі', icon: Truck, statuses: ['in_transit', 'customs'] },
		{ label: 'Отримання', icon: MapPin, statuses: ['ready_for_pickup', 'out_for_delivery'] },
		{ label: 'Доставлено', icon: CircleCheck, statuses: ['delivered'] }
	];
	const confirmed = $derived(tracking.trackingState === 'active');
	const current = $derived(confirmed ? stages.findIndex(stage => stage.statuses.includes(tracking.deliveryStatus)) : -1);
	const complete = $derived(confirmed && tracking.deliveryStatus === 'delivered');
</script>

<section class="route" class:complete class:unavailable={!confirmed} aria-labelledby="route-title">
	<div class="route-heading"><h2 id="route-title">Етапи доставки</h2><span>{current >= 0 ? 'Поточний етап' : 'Без визначеного етапу'} <ArrowUpRight size={14} /></span></div>
	<ol class="route-stages">
		{#each stages as stage, index (stage.label)}
			<li class:current={index === current} aria-current={index === current ? 'step' : undefined} style={`--stage: ${index}`}>
				<span class="route-node"><stage.icon size={24} strokeWidth={1.5} /></span>
				<span class="stage-index">0{index + 1}</span>
				<span class="stage-label">{stage.label}</span>
				{#if index === current}<span class="current-mark" aria-hidden="true"></span>{/if}
			</li>
		{/each}
	</ol>
	<div class="route-caption">
		{#if current < 0}<CircleAlert size={18} />{:else}<span class="caption-dot" aria-hidden="true"></span>{/if}
		<p>{confirmed ? statusLabels[tracking.deliveryStatus] : stateLabels[tracking.trackingState]}</p>
		<span>Дані перевізника</span>
	</div>
</section>

<style>
	.route { --route-accent: #267260; --route-tint: #eaf5f0; padding: 30px 0 0; margin-top: 12px; }
	.route.complete { --route-accent: #176448; --route-tint: #ddf5e7; }
	.route.unavailable { --route-accent: #737373; --route-tint: #f2f2f2; }
	.route-heading { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
	h2 { font-size: 14px; font-weight: 650; }
	.route-heading > span { display: flex; align-items: center; gap: 6px; font-size: 11px; color: #737373; }
	.route-stages { isolation: isolate; position: relative; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); list-style: none; padding: 30px 0 24px; margin: 18px 0 0; background-image: radial-gradient(#dce3df 0.7px, transparent 0.7px); background-size: 12px 12px; }
	.route-stages::before { content: ''; position: absolute; top: 60px; left: 12.5%; right: 12.5%; height: 1px; background: #bac9c2; z-index: -1; transform-origin: left; }
	li { position: relative; min-width: 0; display: flex; flex-direction: column; align-items: center; text-align: center; }
	.route-node { display: grid; place-items: center; width: 60px; height: 60px; border-radius: 50%; background: #fff; border: 1px solid #dce3df; color: #777; }
	.current .route-node { background: var(--route-tint); border-color: var(--route-accent); color: var(--route-accent); box-shadow: 0 0 0 6px white, 0 0 0 7px #cdded5; }
	.stage-index { margin-top: 20px; font-size: 10px; font-variant-numeric: tabular-nums; color: #888; }
	.stage-label { font-size: 12px; line-height: 1.5; margin-top: 6px; padding: 0 4px; overflow-wrap: anywhere; color: #666; }
	.current .stage-label { color: var(--route-accent); font-weight: 750; }
	.current-mark { width: 5px; height: 5px; border-radius: 50%; background: var(--route-accent); margin-top: 10px; }
	.route-caption { display: flex; align-items: center; gap: 10px; padding: 18px 0; border-bottom: 1px solid #ebebeb; font-size: 12px; }
	.route-caption p { flex: 1; min-width: 0; overflow-wrap: anywhere; }
	.route-caption > span:last-child { color: #777; font-size: 10px; }
	.caption-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--route-accent); flex-shrink: 0; }
	.route-caption :global(svg) { flex-shrink: 0; color: #9a6100; }
	@media (prefers-reduced-motion: no-preference) {
		:global(:root:not([data-motion-input='keyboard'])) .route-stages::before { animation: route-connect 620ms cubic-bezier(.23, 1, .32, 1) both; }
		:global(:root:not([data-motion-input='keyboard'])) li { animation: stage-reveal 420ms cubic-bezier(.23, 1, .32, 1) both; animation-delay: calc(80ms + var(--stage) * 70ms); }
		:global(:root:not([data-motion-input='keyboard'])) .current .route-node { animation: node-arrive 600ms cubic-bezier(.23, 1, .32, 1) both; animation-delay: calc(180ms + var(--stage) * 70ms); }
		:global(:root:not([data-motion-input='keyboard'])) .route-caption { animation: stage-reveal 300ms 380ms both; }
	}
	@keyframes route-connect { from { transform: scaleX(0); opacity: 0; } to { transform: scaleX(1); opacity: 1; } }
	@keyframes stage-reveal { from { transform: translateY(10px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
	@keyframes node-arrive { from { transform: scale(.86); } to { transform: scale(1); } }
	@media (max-width: 480px) { .route-heading { align-items: start; } .route-heading > span { max-width: 120px; } .route-node { width: 46px; height: 46px; } .route-stages::before { top: 53px; } .stage-label { font-size: 11px; } .route-caption { flex-wrap: wrap; } .route-caption > span:last-child { width: 100%; padding-left: 16px; } }
</style>