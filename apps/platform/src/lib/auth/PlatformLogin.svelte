<script lang="ts">
	import { onMount } from 'svelte';
	import { KeyRound, LoaderCircle } from '@lucide/svelte';
	import { createGoogleNonce, loadGoogleIdentityServices } from './google-identity';
	import { platformRoles } from '../roles';
	import type { Dac7Role } from '../dac7/types';

	let { clientId, available, onLogin }: {
		clientId: string;
		available: boolean;
		onLogin: (credential: string, nonce: string) => Promise<void>;
	} = $props();
	let googleButton = $state<HTMLDivElement>();
	let pending = $state(false);
	let message = $state('');
	let selectedRole = $state<Dac7Role>('seller');

	onMount(() => {
		if (!available || !clientId) return;
		let active = true;
		async function initialize() {
			try {
				const [google, nonce] = await Promise.all([loadGoogleIdentityServices(), createGoogleNonce()]);
				if (!active || !googleButton) return;
				google.accounts.id.initialize({
					client_id: clientId,
					nonce: nonce.hashed,
					callback: async ({ credential }) => {
						if (!active || pending || !credential) return;
						pending = true;
						message = '';
						try { await onLogin(credential, nonce.raw); }
						catch { message = 'Не вдалося увійти. Спробуйте ще раз.'; }
						finally { pending = false; }
					}
				});
				google.accounts.id.renderButton(googleButton, {
					type: 'standard', theme: 'outline', size: 'large', text: 'signin_with',
					shape: 'rectangular', width: Math.min(320, googleButton.clientWidth)
				});
			} catch { if (active) message = 'Google-вхід недоступний. Оновіть сторінку пізніше.'; }
		}
		void initialize();
		return () => { active = false; };
	});
</script>

<main class="grid min-h-screen place-items-center bg-zinc-50 px-6 py-12 text-zinc-950">
	<div class="w-full max-w-sm space-y-6">
		<KeyRound size={28} aria-hidden="true" />
		<h1 class="text-2xl font-semibold">Rahunok Platform</h1>
		<p class="text-sm text-zinc-600">Вхід до системи DAC7</p>
		<div class="space-y-3">
			<label for="demo-role" class="block text-sm font-semibold">Роль у демо</label>
			<select id="demo-role" name="demo-role" bind:value={selectedRole} disabled={pending} class="min-h-12 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:outline-2 focus:outline-emerald-700">
				{#each platformRoles as role (role.id)}
					<option value={role.id}>{role.label}</option>
				{/each}
			</select>
		</div>
		{#if !available || !clientId}
			<p role="alert" class="text-sm text-amber-800">Сервіс входу тимчасово недоступний.</p>
		{:else}
			<div class="relative min-h-11" aria-busy={pending}>
				<div bind:this={googleButton} class:invisible={pending}></div>
				{#if pending}<LoaderCircle class="absolute top-2 animate-spin" size={24} aria-label="Вхід" />{/if}
			</div>
		{/if}
		{#if message}<p role="alert" class="text-sm text-red-700">{message}</p>{/if}
		<a href={`?demo=1&role=${selectedRole}`} class="inline-block text-sm font-semibold text-emerald-700 underline">Відкрити демо</a>
	</div>
</main>