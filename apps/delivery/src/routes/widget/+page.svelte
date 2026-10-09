<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { ArrowRight, Package2 } from '@lucide/svelte';
	let trackingNumber = $state('');
	let submitting = $state(false);
	let error = $state('');

	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		if (submitting) return;
		trackingNumber = trackingNumber.trim().toUpperCase();
		if (!/^[A-Z0-9]{1,64}$/.test(trackingNumber)) {
			error = 'Введіть номер накладної: від 1 до 64 латинських літер або цифр.';
			return;
		}
		if (['BUSINESS', 'LOGIN', 'LOGOUT', 'TRACK', 'WIDGET', 'API'].includes(trackingNumber)) {
			error = 'Ця назва зарезервована. Введіть номер накладної.';
			return;
		}
		submitting = true;
		error = '';
		try {
			await goto(resolve('/(public)/[trackingNumber]', { trackingNumber }));
		} catch {
			error = 'Не вдалося відкрити відправлення. Спробуйте ще раз.';
		} finally {
			submitting = false;
		}
	}
</script>

<svelte:head><title>Віджет відстеження — Rahunok Delivery</title></svelte:head>

<main class="widget-shell">
	<header><a href={resolve('/(public)')} aria-label="Rahunok Delivery: головна"><span class="widget-mark"><Package2 size={20} /></span>rahunok <span class="widget-product">/ delivery</span></a><span class="demo-label">Демо</span></header>
	<h1>Де ваша посилка?</h1>
	<form onsubmit={handleSubmit}>
		<label for="widget-number">Номер накладної</label>
		<div class="widget-field">
			<input id="widget-number" bind:value={trackingNumber} placeholder="20450000000000" maxlength={64} required autocomplete="off" spellcheck="false" aria-describedby="widget-disclosure" />
			<button type="submit" disabled={!trackingNumber.trim() || submitting} aria-label="Відстежити" title="Відстежити"><ArrowRight size={21} /></button>
		</div>
		{#if error}<p role="alert" class="form-error">{error}</p>{/if}
	</form>
	<p id="widget-disclosure">Демонстраційні дані. Перевірка у перевізників ще не підключена.</p>
	<footer><span>Нова пошта · Укрпошта</span><a href={resolve('/(public)/[trackingNumber]', { trackingNumber: '20450000000000' })}>Приклад <ArrowRight size={14} /></a></footer>
</main>

<style>
	.widget-shell { width: calc(100% - 32px); max-width: 440px; margin: 24px auto; padding: 24px; background: white; border: 1px solid var(--color-border-default); border-radius: 8px; }
	header, header a, footer, footer a { display: flex; align-items: center; gap: 8px; }
	header a { font-size: 16px; font-weight: 800; }
	.widget-mark { width: 34px; height: 34px; display: grid; place-items: center; border-radius: 6px; background: #ddf988; }
	.widget-product { font-size: 11px; font-weight: 500; color: var(--color-text-secondary); }
	h1 { font-size: 25px; font-weight: 650; margin: 30px 0 22px; }
	label { display: block; font-size: 12px; font-weight: 650; margin-bottom: 8px; }
	.widget-field { display: flex; gap: 6px; padding: 5px; border: 1px solid #c5cbbd; border-radius: 6px; }
	.widget-field:focus-within { outline: 2px solid #b9d27f; outline-offset: 2px; }
	input { flex: 1; min-width: 0; width: 100%; padding: 10px 8px; font-size: 16px; outline: none; }
	button { display: grid; place-items: center; width: 44px; height: 44px; flex-shrink: 0; background: #ddf988; border-radius: 4px; cursor: pointer; }
	button:disabled { background: #edf1e5; color: #818873; cursor: default; }
	p { font-size: 11px; line-height: 1.7; color: var(--color-text-secondary); margin: 14px 0 22px; }
	footer { border-top: 1px solid var(--color-border-subtle); padding-top: 16px; justify-content: space-between; font-size: 10px; color: var(--color-text-secondary); flex-wrap: wrap; }
	footer a { min-height: 36px; font-weight: 700; }
	@media (max-width: 360px) { .widget-shell { padding: 18px; }.widget-product { display: none; } }
</style>