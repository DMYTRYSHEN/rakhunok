<script lang="ts">
	import { onMount } from 'svelte';
	import { Check, ExternalLink, Globe2, Link2, Save, ShieldAlert, UserRound } from '@lucide/svelte';
	import {
		defaultPublicPageConfig,
		loadPublicPageConfig,
		normalizePublicSlug,
		savePublicPageConfig,
		validatePublicSlug,
		type PublicPageConfig
	} from './public-page';

	let config = $state<PublicPageConfig>({ ...defaultPublicPageConfig });
	let saved = $state(false);
	const slugIssue = $derived(validatePublicSlug(config.slug));
	const previewName = $derived(config.displayName.trim() || 'Назва бізнесу');
	const previewDescription = $derived(config.description.trim() || 'Коротко розкажіть, за що вам можна заплатити.');
	const publicPath = $derived(`/@${config.slug || 'dmytryshen'}`);
	const publicUrl = $derived(`https://rahunok.com${publicPath}`);
	const initials = $derived(
		previewName
			.split(/\s+/)
			.slice(0, 2)
			.map((part) => part[0])
			.join('')
			.toUpperCase()
	);

	onMount(() => {
		config = loadPublicPageConfig();
	});

	function updateSlug(event: Event) {
		config.slug = normalizePublicSlug((event.currentTarget as HTMLInputElement).value);
		saved = false;
	}

	function persist() {
		if (slugIssue) return;
		savePublicPageConfig(config);
		saved = true;
	}

</script>

<div class="mx-auto max-w-7xl">
	<header class="mb-7 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
		<div>
			<p class="text-xs font-bold tracking-[0.14em] text-cyan-700 uppercase">Публічна присутність</p>
			<h1 class="mt-2 text-2xl font-extrabold sm:text-3xl">Публічний профіль</h1>
			<p class="mt-2 max-w-3xl text-sm leading-6 text-zinc-500">Створіть фінансову ідентичність з адресою @handle, даними бізнесу, оплатою та перевіреними зовнішніми профілями.</p>
		</div>
		<span class="inline-flex w-fit items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-900"><span class="size-1.5 rounded-full bg-amber-500"></span> Локальна чернетка</span>
	</header>

	<div class="grid gap-6 xl:grid-cols-[minmax(0,1fr)_23rem]">
		<div class="space-y-6">
			<section class="overflow-hidden rounded-lg border border-zinc-200 bg-white">
				<div class="border-b border-zinc-200 px-5 py-5 sm:px-6"><div class="flex items-start gap-3"><span class="grid size-10 shrink-0 place-items-center rounded-md bg-cyan-50 text-cyan-700"><Link2 size={19} aria-hidden="true" /></span><div><p class="text-xs font-bold tracking-[0.12em] text-zinc-500 uppercase">Ваша адреса</p><h2 class="mt-1 text-base font-extrabold">Унікальний ідентифікатор</h2></div></div></div>
				<div class="p-5 sm:p-6">
					<label for="public-slug" class="mb-2 block text-xs font-bold text-zinc-600">Ідентифікатор</label>
					<div class="flex min-w-0 items-center rounded-md border bg-white focus-within:border-blue-600 {slugIssue && config.slug ? 'border-red-300' : 'border-zinc-200'}"><span class="hidden shrink-0 border-r border-zinc-200 px-3 text-sm text-zinc-500 sm:block">rahunok.com/@</span><input id="public-slug" value={config.slug} oninput={updateSlug} autocomplete="off" spellcheck="false" placeholder="dmytryshen" class="h-12 min-w-0 flex-1 px-3 font-mono text-sm outline-none" /><button type="button" disabled class="grid size-11 shrink-0 place-items-center text-zinc-300" aria-label="Копіювання стане доступним після публікації"><ExternalLink size={17} aria-hidden="true" /></button></div>
					<p class="mt-2 text-xs leading-5 {slugIssue ? 'text-red-700' : 'text-zinc-500'}">{slugIssue ?? 'Латинські літери, цифри та дефіси. Від 3 до 40 символів.'}</p>
				</div>
			</section>

			<section class="overflow-hidden rounded-lg border border-zinc-200 bg-white">
				<div class="border-b border-zinc-200 px-5 py-5 sm:px-6"><p class="text-xs font-bold tracking-[0.12em] text-zinc-500 uppercase">Швидка перевірка</p><h2 class="mt-1 text-base font-extrabold">Пов’язані профілі та довіра</h2><p class="mt-1 text-sm leading-6 text-zinc-500">Насичена сторінка на кшталт Expirenza: реквізити, статус верифікації, соцмережі та актуальні способи зв’язку.</p></div>
				<div class="grid gap-3 p-5 sm:grid-cols-2 sm:p-6"><button type="button" disabled class="flex min-h-16 items-center gap-3 rounded-md border border-zinc-200 bg-zinc-50 p-3 text-left text-zinc-500"><Link2 size={20} aria-hidden="true" /><span><strong class="block text-sm text-zinc-700">Instagram</strong><span class="text-xs">Підключення після верифікації</span></span></button><button type="button" disabled class="flex min-h-16 items-center gap-3 rounded-md border border-zinc-200 bg-zinc-50 p-3 text-left text-zinc-500"><Globe2 size={20} aria-hidden="true" /><span><strong class="block text-sm text-zinc-700">YouTube та інші</strong><span class="text-xs">Перевірені зовнішні посилання</span></span></button></div>
			</section>

			<section class="overflow-hidden rounded-lg border border-zinc-200 bg-white">
				<div class="border-b border-zinc-200 px-5 py-5 sm:px-6"><div class="flex items-start gap-3"><span class="grid size-10 shrink-0 place-items-center rounded-md bg-lime-100 text-lime-800"><UserRound size={19} aria-hidden="true" /></span><div><p class="text-xs font-bold tracking-[0.12em] text-zinc-500 uppercase">Вигляд профілю</p><h2 class="mt-1 text-base font-extrabold">Назва та опис</h2></div></div></div>
				<div class="grid gap-5 p-5 sm:p-6">
					<label><span class="mb-2 block text-xs font-bold text-zinc-600">Публічна назва</span><input bind:value={config.displayName} oninput={() => (saved = false)} maxlength="80" placeholder="Назва бізнесу або ваше ім'я" class="h-12 w-full rounded-md border border-zinc-200 px-3 text-sm font-semibold outline-none focus:border-blue-600" /></label>
					<label><span class="mb-2 block text-xs font-bold text-zinc-600">Короткий опис</span><textarea bind:value={config.description} oninput={() => (saved = false)} maxlength="180" rows="4" placeholder="Що ви робите і за що приймаєте оплату" class="w-full resize-none rounded-md border border-zinc-200 p-3 text-sm leading-6 outline-none focus:border-blue-600"></textarea><span class="mt-1 block text-right text-xs tabular-nums text-zinc-400">{config.description.length}/180</span></label>
				</div>
			</section>

			<div class="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-950"><ShieldAlert size={20} class="mt-0.5 shrink-0" aria-hidden="true" /><p><strong>{publicUrl} ще не опублікована.</strong> Потрібні серверне збереження, перевірка унікальності @handle, верифікація зовнішніх акаунтів і публічний resolver. Ця чернетка не змінює Worker або Supabase.</p></div>
		</div>

		<aside class="h-fit overflow-hidden rounded-lg border border-zinc-200 bg-[#151718] text-white xl:sticky xl:top-24">
			<div class="border-b border-white/10 p-5"><p class="text-xs font-bold tracking-[0.12em] text-zinc-400 uppercase">Попередній перегляд</p><p class="mt-2 truncate font-mono text-xs text-cyan-300">{publicPath}</p></div>
			<div class="min-h-80 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.18),transparent_42%)] p-6 text-center"><div class="mx-auto grid size-16 place-items-center rounded-lg bg-[#c9ff4a] text-xl font-black text-zinc-950">{initials || 'R'}</div><h2 class="mt-5 text-xl font-extrabold">{previewName}</h2><p class="mx-auto mt-2 max-w-64 text-sm leading-6 text-zinc-400">{previewDescription}</p><div class="mt-7 grid gap-2"><div class="flex h-12 items-center justify-center rounded-md bg-white font-extrabold text-zinc-950">Оплатити</div><div class="flex h-11 items-center justify-center gap-2 rounded-md border border-white/15 text-sm font-bold text-zinc-300"><Globe2 size={16} aria-hidden="true" /> Поділитися профілем</div></div></div>
			<div class="border-t border-white/10 p-5"><button type="button" onclick={persist} disabled={Boolean(slugIssue)} class="flex h-12 w-full items-center justify-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-extrabold hover:bg-blue-500 disabled:bg-zinc-700 disabled:text-zinc-400">{#if saved}<Check size={17} aria-hidden="true" /> Чернетку збережено{:else}<Save size={17} aria-hidden="true" /> Зберегти чернетку{/if}</button><p class="mt-3 flex items-start gap-2 text-xs leading-5 text-zinc-400"><ExternalLink size={14} class="mt-0.5 shrink-0" aria-hidden="true" /> Публікація стане окремим серверним кроком.</p></div>
		</aside>
	</div>
</div>