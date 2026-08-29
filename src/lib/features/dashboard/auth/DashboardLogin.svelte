<script lang="ts">
	import { ArrowLeft, KeyRound, LoaderCircle, ShieldCheck } from '@lucide/svelte';
	import { resolve } from '$app/paths';

	let {
		configurationRequired = false,
		homeHref = resolve('/'),
		onGoogleLogin
	}: { configurationRequired?: boolean; homeHref?: string; onGoogleLogin?: () => Promise<void> } = $props();
	let pending = $state(false);
	let message = $state<string | null>(null);

	async function login() {
		if (!onGoogleLogin || pending) return;
		pending = true;
		message = null;

		try {
			await onGoogleLogin();
		} catch {
			message = 'Не вдалося розпочати вхід через Google. Спробуйте ще раз.';
			pending = false;
		}
	}
</script>

<main class="grid min-h-screen bg-[#f6f7f8] px-4 py-8 text-zinc-950 sm:place-items-center">
	<section
		class="mx-auto w-full max-w-md overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-[0_24px_80px_rgba(24,24,27,0.08)]"
	>
		<div class="border-b border-zinc-200 px-6 py-5">
			<a
				href={homeHref}
				class="inline-flex items-center gap-2 text-xs font-bold text-zinc-500 hover:text-zinc-950"
			>
				<ArrowLeft size={15} aria-hidden="true" />
				На головну
			</a>
		</div>
		<div class="p-6 sm:p-8">
			<div class="grid size-11 place-items-center rounded-md bg-zinc-950 text-white">
				<KeyRound size={20} aria-hidden="true" />
			</div>
			<h1 class="mt-6 text-2xl font-semibold">Вхід у Rahunok</h1>
			<p class="mt-2 text-sm leading-6 text-zinc-500">
				Керуйте платежами, рахунками й касами вашого бізнесу.
			</p>

			{#if configurationRequired}
				<div
					class="mt-6 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950"
					role="status"
				>
					<strong class="block">Потрібна конфігурація Supabase</strong>
					Додайте `PUBLIC_SUPABASE_URL` і `PUBLIC_SUPABASE_ANON_KEY` до локального `.env`.
				</div>
			{:else}
				<button
					type="button"
					class="mt-7 inline-flex h-12 w-full items-center justify-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-bold text-white hover:bg-blue-700 disabled:cursor-wait disabled:opacity-70"
					style="background-color: #2563eb; color: #ffffff;"
					disabled={pending}
					onclick={login}
				>
					{#if pending}
						<LoaderCircle size={18} class="animate-spin" aria-hidden="true" />
						Перенаправлення…
					{:else}
						Увійти через Google
					{/if}
				</button>
			{/if}

			{#if message}
				<p class="mt-4 text-sm text-red-700" role="alert">{message}</p>
			{/if}

			<div
				class="mt-7 flex items-start gap-3 border-t border-zinc-100 pt-5 text-xs leading-5 text-zinc-500"
			>
				<ShieldCheck size={17} class="mt-0.5 shrink-0 text-emerald-700" aria-hidden="true" />
				<span>Сесія зберігається database у браузері та захищається чинними RLS-політиками.</span>
			</div>
		</div>
	</section>
</main>
