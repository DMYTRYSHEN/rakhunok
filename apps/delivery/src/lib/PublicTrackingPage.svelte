<script lang="ts">
	import { resolve } from '$app/paths';
	import { ArrowLeft, Copy, RefreshCw, CircleCheck, Package2, CircleAlert, Clock3 } from '@lucide/svelte';
	import TrackingHeader from '#lib/TrackingHeader.svelte';
	import { statusLabels, stateLabels, carrierLabels, formatTime } from '#lib/tracking-labels.ts';
	import type { PublicTrackingResult } from '#lib/server/tracking/public-tracking.ts';
	let { tracking }: { tracking: PublicTrackingResult } = $props();
	let feedback = $state('');
	const confirmed = $derived(tracking.trackingState === 'active');
	const delivered = $derived(confirmed && tracking.deliveryStatus === 'delivered');
	async function copyNumber() {
		try { await navigator.clipboard.writeText(tracking.trackingNumber); feedback = 'Номер скопійовано.'; }
		catch { feedback = 'Не вдалося скопіювати номер.'; }
	}
</script>

<svelte:head><title>{tracking.trackingNumber} — Rahunok Delivery</title><meta name="robots" content="noindex, nofollow" /></svelte:head>
<div class="tracking-page detail-page">
	<TrackingHeader detail />
	<main class="detail-main">
		<a class="detail-back" href={resolve('/(public)')}><ArrowLeft size={16} /> Новий пошук</a>
		<section class="detail-status" aria-labelledby="shipment-number">
			<div class="shipment-heading"><span class="carrier-mark" class:np={tracking.carrier === 'nova_poshta'}><Package2 size={20} /></span><div><p class="carrier">{carrierLabels[tracking.carrier]}</p><p class="eyebrow">Відправлення</p></div></div>
			<div class="detail-number"><h1 id="shipment-number">{tracking.trackingNumber}</h1><button class="icon-button" title="Копіювати номер" aria-label="Копіювати номер" onclick={copyNumber}><Copy size={18} /></button></div>
			<div class="delivery-state" class:delivered class:unconfirmed={!confirmed}><span class="status-symbol">{#if delivered}<CircleCheck size={28} />{:else if confirmed}<Package2 size={28} />{:else}<CircleAlert size={28} />{/if}</span><div><p class="eyebrow">Статус доставки</p><h2>{confirmed ? statusLabels[tracking.deliveryStatus] : stateLabels[tracking.trackingState]}</h2></div></div>
			{#if !confirmed}<p class="notice">Статус доставки не підтверджено. Спробуйте повторити перевірку пізніше.</p>{/if}
			<div class="verification"><div class="checked"><Clock3 size={17} /><div><span>Остання перевірка</span><time datetime={tracking.checkedAt}>{formatTime(tracking.checkedAt)}</time></div></div><a class="retry" href={`${resolve('/(public)/[trackingNumber]', { trackingNumber: tracking.trackingNumber })}?carrier=${tracking.carrier}`} data-sveltekit-reload><RefreshCw size={17} /> Перевірити знову</a></div>
			<p class="feedback" role="status">{feedback}</p>
		</section>
	</main>
	<footer class="tracking-footer"><span>Rahunok Delivery</span><a href={resolve('/(public)')}>Новий пошук <ArrowLeft size={13} /></a></footer>
</div>

<style>
	.detail-main { width: min(100%, 840px); margin: auto; padding: 36px 40px 48px; }
	.detail-back { display: inline-flex; align-items: center; gap: 8px; min-height: 44px; font-size: 13px; font-weight: 650; color: #626262; }
	.detail-status { padding-top: 36px; }
	.shipment-heading { display: flex; align-items: center; gap: 12px; }
	.carrier-mark { width: 44px; height: 44px; display: grid; place-items: center; border-radius: 8px; background: #fff5cc; color: #765b00; }
	.carrier-mark.np { background: #fff0f0; color: #c83232; }
	.carrier { font-size: 14px; font-weight: 750; color: #222; }
	.eyebrow { font-size: 12px; color: #666; margin-top: 3px; }
	.detail-number { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin: 22px 0 36px; }
	h1 { min-width: 0; overflow-wrap: anywhere; font-size: 32px; line-height: 1.3; font-weight: 750; font-variant-numeric: tabular-nums; }
	.detail-number button { border: 1px solid #e5e5e5; }
	.delivery-state { display: flex; align-items: center; gap: 18px; padding: 28px 0; border-block: 1px solid #ebebeb; }
	.status-symbol { display: grid; place-items: center; width: 56px; height: 56px; flex-shrink: 0; border-radius: 50%; background: #f4f4f4; color: #222; }
	.delivered .status-symbol { color: #13795b; background: #edf8f2; }
	.unconfirmed .status-symbol { color: #9a6100; background: #fff7e7; }
	h2 { margin-top: 4px; font-size: 26px; line-height: 1.35; font-weight: 750; overflow-wrap: anywhere; }
	.notice { margin-top: 20px; font-size: 14px; color: #666; line-height: 1.6; }
	.verification { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 20px; padding-top: 28px; }
	.checked { display: flex; align-items: center; gap: 10px; color: #666; font-size: 12px; }
	.checked time { display: block; color: #222; font-size: 13px; font-weight: 650; margin-top: 4px; }
	.retry { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 44px; padding: 0 18px; border-radius: 8px; background: #222; color: white; font-size: 13px; font-weight: 700; }
	.retry:hover { background: #444; }
	.feedback { min-height: 24px; margin-top: 16px; font-size: 12px; color: #666; }
	@media (max-width: 700px) { .detail-main { padding: 20px 20px 32px; } .detail-status { padding-top: 24px; } h1 { font-size: 24px; } h2 { font-size: 22px; } .detail-number { gap: 10px; margin-bottom: 28px; } .delivery-state { gap: 14px; } .retry { width: 100%; } }
</style>