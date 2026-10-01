<script lang="ts">
	import type { Session, SupabaseClient } from '@supabase/supabase-js';
	import type { PlatformConfig } from './lib/config';
	import { createPlatformClient } from './lib/auth/client';
	import PlatformLogin from './lib/auth/PlatformLogin.svelte';
	import { createDac7Gateway } from './lib/dac7/dac7-gateway';
	import { readDemoRole } from './lib/roles';

	let { config, demo = false, role = null }: { config: PlatformConfig; demo?: boolean; role?: string | null } = $props();
	let client = $state.raw<SupabaseClient | null>(null);
	let session = $state.raw<Session | null>(null);
	let loading = $state(true);
	let message = $state('');
	const gateway = $derived(createDac7Gateway(demo ? null : client));

	$effect(() => {
		session = null;
		message = '';
		if (demo) { client = null; loading = false; return; }
		loading = true;
		let active = true;
		let receivedEvent = false;
		try {
			const authClient = createPlatformClient(config);
			client = authClient;
			if (!authClient) { loading = false; return; }
			const { data: { subscription } } = authClient.auth.onAuthStateChange((_event, nextSession) => {
				if (!active) return;
				receivedEvent = true;
				session = nextSession;
				loading = false;
			});
			void authClient.auth.getSession().then(({ data, error }) => {
				if (!active || receivedEvent) return;
				if (error) message = 'Не вдалося відновити сесію.';
				session = error ? null : data.session;
				loading = false;
			}).catch(() => {
				if (active && !receivedEvent) { loading = false; message = 'Не вдалося відновити сесію.'; }
			});
			return () => { active = false; subscription.unsubscribe(); authClient.auth.stopAutoRefresh(); };
		} catch { client = null; loading = false; message = 'Сервіс входу тимчасово недоступний.'; }
	});

	async function handleLogin(credential: string, nonce: string) {
		if (!client) throw new Error('Authentication is unavailable.');
		const { error } = await client.auth.signInWithIdToken({ provider: 'google', token: credential, nonce });
		if (error) throw error;
	}

	async function handleSignOut() {
		message = '';
		if (demo) { window.location.assign(window.location.pathname); return; }
		try {
			const result = await client?.auth.signOut();
			if (result?.error) throw result.error;
			session = null;
		} catch { message = 'Не вдалося вийти. Спробуйте ще раз.'; }
	}
</script>

{#if message}<p role="alert" class="bg-red-50 p-3 text-sm text-red-800">{message}</p>{/if}
{#if loading}
	<div role="status" class="grid min-h-screen place-items-center bg-zinc-50 text-sm text-zinc-600">Завантаження середовища DAC7...</div>
{:else if demo || session}
	{#await import('./lib/dac7/Dac7Workspace.svelte')}
		<p role="status">Завантаження кабінету...</p>
	{:then workspace}
		<workspace.default {gateway} {demo} initialRole={demo ? readDemoRole(role) : 'seller'} onSignOut={handleSignOut} />
	{:catch}
		<p role="alert">Не вдалося завантажити кабінет.</p><button onclick={() => window.location.reload()}>Спробувати знову</button>
	{/await}
{:else}
	<PlatformLogin clientId={config.googleClientId} available={!!client} onLogin={handleLogin} />
{/if}