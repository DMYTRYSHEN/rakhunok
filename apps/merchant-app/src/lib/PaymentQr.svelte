<script lang="ts">
	import QRCode from 'qrcode';

	let { value, label }: { value: string; label: string } = $props();
	let canvas: HTMLCanvasElement;
	let error = $state(false);

	$effect(() => {
		if (!canvas || !value) return;
		error = false;
		void QRCode.toCanvas(canvas, value, {
			errorCorrectionLevel: 'H',
			margin: 2,
			width: 232,
			color: { dark: '#0a0a0c', light: '#ffffff' }
		}).catch(() => (error = true));
	});
</script>

<figure class="payment-qr">
	<figcaption>{label}</figcaption>
	<div class="payment-qr-frame" class:error>
		<canvas bind:this={canvas} aria-label={label}></canvas>
		<span class="payment-qr-logo" aria-hidden="true">
			<svg viewBox="0 0 208 221"><path d="M108.9 29.2c31.7 0 52.6 20.2 52.6 47.8 0 21.2-12.1 38.8-33.1 46.3l40.9 68.1c-25.3 0-48.6-13.3-61-34.7l-13.7-23.7c-12.1 0-21.9 9.6-21.9 21.3v37.1c-19.4 0-35.2-15.3-35.2-34.3v-20c0-18.9 15.8-34.3 35.2-34.3h28.8c15.8 0 24.7-8.3 24.7-22.4 0-13.1-7.5-19.7-22.4-19.7H72.7c-19.4 0-35.2-14.1-35.2-31.5h71.4Z" /></svg>
		</span>
	</div>
	{#if error}<p>Не вдалося створити QR-код.</p>{/if}
</figure>

<style>
	.payment-qr { margin: 16px auto 18px; }
	figcaption { margin-bottom: 9px; color: var(--muted); font-size: 11px; font-weight: 750; }
	.payment-qr-frame { position: relative; display: grid; width: min(232px, 72vw); aspect-ratio: 1; place-items: center; margin: auto; overflow: hidden; border-radius: 14px; background: #fff; box-shadow: 0 14px 34px rgb(0 0 0 / 18%); }
	canvas { display: block; width: 100% !important; height: 100% !important; }
	.payment-qr-logo { position: absolute; display: grid; width: 18%; aspect-ratio: 1; place-items: center; border: 5px solid #fff; border-radius: 11px; background: #fff; box-shadow: 0 2px 8px rgb(0 0 0 / 14%); }
	.payment-qr-logo svg { width: 72%; height: 72%; fill: #155ce6; }
	.error .payment-qr-logo { display: none; }
	p { margin: 8px 0 0; color: #ff6961; font-size: 11px; }
</style>