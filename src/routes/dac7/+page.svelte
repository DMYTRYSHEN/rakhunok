<script lang="ts">
	import { onMount } from 'svelte';
	import { getSupabaseBrowserClient } from '$lib/features/dashboard/api/supabase-browser';
	import { createDac7Gateway } from '$lib/features/dac7/dac7-gateway';
	import Dac7Workspace from '$lib/features/dac7/Dac7Workspace.svelte';
	import DashboardLogin from '$lib/features/dashboard/auth/DashboardLogin.svelte';
	import { page } from '$app/state';

	let client = getSupabaseBrowserClient();
	let gateway = createDac7Gateway(client || ({} as any));
	let session = $state<any>(null);
	let isLoading = $state(true);

	const isDemoFromQuery = $derived(page.url.searchParams.get('demo') === '1');

	async function checkAuth() {
		if (!client) {
			isLoading = false;
			return;
		}
		const res = await client.auth.getSession();
		session = res.data.session;
		isLoading = false;
	}

	async function handleGoogleLogin(credential: string, nonce: string) {
		if (!client) return;
		const { error } = await client.auth.signInWithIdToken({
			provider: 'google',
			token: credential,
			nonce
		});
		if (error) throw error;
		await checkAuth();
	}

	onMount(() => {
		void checkAuth();
	});
</script>

<svelte:head>
	<title>Rahunok DAC7 & Закон про цифрові платформи (№ 4903-IX)</title>
	<meta name="description" content="Фінансово-податкова інфраструктура цифрових платформ, виплати кур'єрам, 10% ПДФО, Дія.Підпис та DAC7 XML." />
</svelte:head>

{#if isLoading}
	<div class="min-h-screen grid place-items-center bg-[#fafaf9] text-stone-500 text-xs">
		Завантаження середовища DAC7...
	</div>
{:else if session || isDemoFromQuery}
	{#if gateway}
		<Dac7Workspace {gateway} demo={isDemoFromQuery && !session} />
	{/if}
{:else}
	<div class="min-h-screen bg-[#fafaf9] flex flex-col items-center justify-center p-4">
		<div class="w-full max-w-md space-y-6">
			<div class="text-center space-y-2">
				<div class="mx-auto grid size-12 place-items-center rounded-2xl bg-stone-900 text-white font-black text-lg">
					R
				</div>
				<h1 class="text-2xl font-black text-stone-900">Вхід до системи DAC7</h1>
				<p class="text-xs text-stone-500 max-w-sm mx-auto">
					Авторизуйтесь через корпоративний акаунт Google для отримання персоналізованого доступу до вашого контуру платформи.
				</p>
			</div>

			<div class="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
				<DashboardLogin onGoogleLogin={handleGoogleLogin} homeHref="/dac7" />
			</div>

			<div class="text-center">
				<a
					href="/dac7?demo=1"
					class="text-xs font-bold text-emerald-700 hover:text-emerald-800 underline"
				>
					Або переглянути в режимі демо (імітація даних) →
				</a>
			</div>
		</div>
	</div>
{/if}
