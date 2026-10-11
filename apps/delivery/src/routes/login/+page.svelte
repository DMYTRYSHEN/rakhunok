<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { Package2, LoaderCircle } from '@lucide/svelte';
	import type { PageProps } from './$types';
	let { data }: PageProps = $props();
	let button = $state<HTMLDivElement>();
	let loginForm = $state<HTMLFormElement>();
	let credential = $state('');
	let pending = $state(false);
	let message = $state('');

	onMount(() => {
		if (!data.configured) return;
		let active = true;
		const script = document.createElement('script');
		script.src = 'https://accounts.google.com/gsi/client';
		script.async = true;
		const timer = setTimeout(() => { if (active) message = 'Вхід Google недоступний. Оновіть сторінку.'; }, 15000);
		script.onload = () => {
			clearTimeout(timer);
			if (!active || !button) return;
			const google = (window as unknown as { google: { accounts: { id: {
				initialize: (options: { client_id: string; nonce: string; callback: (response: { credential?: string }) => void }) => void;
				renderButton: (element: HTMLElement, options: Record<string, string | number>) => void;
			} } } }).google;
			if (!google) { message = 'Вхід Google недоступний. Оновіть сторінку.'; return; }
			google.accounts.id.initialize({ client_id: data.clientId, nonce: data.nonce, callback: (response) => {
				if (!active || pending || !response.credential || !loginForm) return;
				credential = response.credential;
				pending = true;
				const input = loginForm.elements.namedItem('credential') as HTMLInputElement;
				input.value = credential;
				loginForm.requestSubmit();
			} });
			google.accounts.id.renderButton(button, { type: 'standard', theme: 'outline', size: 'large', text: 'signin_with', shape: 'rectangular', width: 280 });
		};
		script.onerror = () => { clearTimeout(timer); if (active) message = 'Не вдалося завантажити вхід Google.'; };
		document.head.appendChild(script);
		return () => { active = false; clearTimeout(timer); script.remove(); };
	});
</script>

<svelte:head>
	<title>Вхід | Rahunok Delivery</title>
	<meta name="referrer" content="same-origin" />
</svelte:head>
<main>
	<section aria-labelledby="login-title">
		<a href={resolve('/(public)')} class="brand"><Package2 size={28} /> rahunok / delivery</a>
		<h1 id="login-title">Вхід у кабінет</h1>
		<form method="POST" action={resolve('/(public)')} bind:this={loginForm}>
			<input type="hidden" name="credential" value={credential} />
			{#if data.configured}
				<div class="google-button" bind:this={button} class:pending aria-hidden={pending}></div>
				{#if pending}<p role="status"><LoaderCircle size={18} /> Вхід...</p>{/if}
			{:else}<p role="status">Сервіс входу тимчасово недоступний.</p>{/if}
		</form>
		{#if message || data.message}<p role="alert">{message || data.message}</p>{/if}
	</section>
</main>

<style>
	main { min-height: 100dvh; display: grid; place-items: center; padding: 24px 16px; background: #f5f7f8; }
	section { width: min(100%, 400px); }
	.brand { display: flex; align-items: center; gap: 12px; font-weight: 750; font-size: 20px; }
	h1 { font-size: 28px; margin: 36px 0 28px; }
	.google-button { width: 280px; min-height: 44px; }
	.pending { display: none; }
	p { display: flex; gap: 8px; font-size: 14px; line-height: 1.6; margin-top: 16px; }
</style>