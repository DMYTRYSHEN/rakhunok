<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import {
		Check,
		ExternalLink,
		Globe2,
		Link2,
		Loader2,
		Save,
		ShieldAlert,
		ShieldCheck,
		Smartphone,
		Send,
		UserRound,
		X
	} from '@lucide/svelte';
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
	let showVerifyModal = $state(false);
	let telegramBotUsername = $state('RhnkBot');
	let verifyToken = $state('');
	let isPolling = $state(false);
	let verificationSuccessMessage = $state<string | null>(null);
	let pollInterval: ReturnType<typeof setInterval> | null = null;

	const slugIssue = $derived(validatePublicSlug(config.slug));
	const previewName = $derived(config.displayName.trim() || 'Назва бізнесу');
	const previewDescription = $derived(
		config.description.trim() || 'Коротко розкажіть, за що вам можна заплатити.'
	);
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
		if (config.telegramId && !config.avatarUrl) {
			const apiHost =
				typeof window !== 'undefined' &&
				(window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
					? 'https://letsrealtalk.com'
					: '';
			config.avatarUrl = `${apiHost}/api/v1/telegram/avatar?user_id=${config.telegramId}`;
			savePublicPageConfig(config);
		}
	});

	onDestroy(() => {
		stopPolling();
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

	function startTelegramVerification() {
		verifyToken = Math.random().toString(36).substring(2, 12);
		verificationSuccessMessage = null;
		showVerifyModal = true;
		startPolling();
	}

	function startPolling() {
		stopPolling();
		isPolling = true;
		pollInterval = setInterval(async () => {
			if (!verifyToken || !showVerifyModal) {
				stopPolling();
				return;
			}
			try {
				const apiHost =
					typeof window !== 'undefined' &&
					(window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
						? 'https://letsrealtalk.com'
						: '';
				const res = await fetch(
					`${apiHost}/api/v1/verification/status?token=${encodeURIComponent(verifyToken)}`
				);
				if (res.ok) {
					const data = await res.json();
					if (data.verified && data.phone) {
						config.phone = data.phone;
						config.phoneVerified = true;
						config.telegramId = data.telegramId;
						config.telegramUsername = data.telegramUsername;
						if (data.avatarUrl) {
							config.avatarUrl = (apiHost ? apiHost : '') + data.avatarUrl;
						}
						saved = false;
						savePublicPageConfig(config);
						verificationSuccessMessage = `Номер ${data.phone} успішно підтверджено!`;
						stopPolling();
						setTimeout(() => {
							showVerifyModal = false;
						}, 1600);
					}
				}
			} catch {}
		}, 2000);
	}

	function stopPolling() {
		if (pollInterval) {
			clearInterval(pollInterval);
			pollInterval = null;
		}
		isPolling = false;
	}

	function closeVerifyModal() {
		stopPolling();
		showVerifyModal = false;
	}

	function resetVerification() {
		stopPolling();
		config.phone = '';
		config.phoneVerified = false;
		config.telegramId = undefined;
		config.telegramUsername = undefined;
		config.avatarUrl = undefined;
		saved = false;
		savePublicPageConfig(config);
	}

	function simulateSuccess() {
		config.phone = '+380 (98) 765-43-21';
		config.phoneVerified = true;
		config.telegramId = 777123456;
		config.telegramUsername = 'demo_user';
		config.avatarUrl =
			'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80';
		saved = false;
		savePublicPageConfig(config);
		verificationSuccessMessage = 'Номер успішно верифіковано в демо-режимі!';
		stopPolling();
		setTimeout(() => {
			showVerifyModal = false;
		}, 1200);
	}

	let showSendMessageModal = $state(false);
	let notificationText = $state('');
	let isSendingNotification = $state(false);
	let notificationStatus = $state<{ success?: boolean; error?: string } | null>(null);

	async function sendTelegramNotification() {
		if (!config.telegramId || !notificationText.trim()) return;
		isSendingNotification = true;
		notificationStatus = null;
		try {
			const apiHost =
				typeof window !== 'undefined' &&
				(window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
					? 'https://letsrealtalk.com'
					: '';
			const res = await fetch(`${apiHost}/api/v1/telegram/notify`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					telegram_id: config.telegramId,
					text: notificationText.trim()
				})
			});
			if (res.ok) {
				const data = await res.json();
				if (data.success) {
					notificationStatus = { success: true };
					notificationText = '';
					setTimeout(() => {
						showSendMessageModal = false;
						notificationStatus = null;
					}, 1500);
				} else {
					notificationStatus = { error: 'Не вдалося доставити повідомлення ботом' };
				}
			} else {
				notificationStatus = { error: 'Помилка сервера' };
			}
		} catch (err: any) {
			notificationStatus = { error: err?.message || 'Помилка мережі' };
		} finally {
			isSendingNotification = false;
		}
	}
</script>

<div class="mx-auto max-w-7xl">
	<header class="mb-7 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
		<div>
			<p class="text-xs font-bold tracking-[0.14em] text-cyan-700 uppercase">
				Публічна присутність
			</p>
			<h1 class="mt-2 text-2xl font-extrabold sm:text-3xl">Публічний профіль</h1>
			<p class="mt-2 max-w-3xl text-sm leading-6 text-zinc-500">
				Створіть фінансову ідентичність з адресою @RhnkBot, даними бізнесу, оплатою та перевіреними
				зовнішніми профілями.
			</p>
		</div>
		<span
			class="inline-flex w-fit items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-900"
			><span class="size-1.5 rounded-full bg-amber-500"></span> Локальна чернетка</span
		>
	</header>

	<div class="grid gap-6 xl:grid-cols-[minmax(0,1fr)_23rem]">
		<div class="space-y-6">
			<section class="overflow-hidden rounded-lg border border-zinc-200 bg-white">
				<div class="border-b border-zinc-200 px-5 py-5 sm:px-6">
					<div class="flex items-start gap-3">
						<span
							class="grid size-10 shrink-0 place-items-center rounded-md bg-cyan-50 text-cyan-700"
							><Link2 size={19} aria-hidden="true" /></span
						>
						<div>
							<p class="text-xs font-bold tracking-[0.12em] text-zinc-500 uppercase">Ваша адреса</p>
							<h2 class="mt-1 text-base font-extrabold">Унікальний ідентифікатор</h2>
						</div>
					</div>
				</div>
				<div class="p-5 sm:p-6">
					<label for="public-slug" class="mb-2 block text-xs font-bold text-zinc-600"
						>Ідентифікатор</label
					>
					<div
						class="flex min-w-0 items-center rounded-md border bg-white focus-within:border-blue-600 {slugIssue &&
						config.slug
							? 'border-red-300'
							: 'border-zinc-200'}"
					>
						<span
							class="hidden shrink-0 border-r border-zinc-200 px-3 text-sm text-zinc-500 sm:block"
							>rahunok.com/@</span
						><input
							id="public-slug"
							value={config.slug}
							oninput={updateSlug}
							autocomplete="off"
							spellcheck="false"
							placeholder="dmytryshen"
							class="h-12 min-w-0 flex-1 px-3 font-mono text-sm outline-none"
						/><button
							type="button"
							disabled
							class="grid size-11 shrink-0 place-items-center text-zinc-300"
							aria-label="Копіювання стане доступним після публікації"
							><ExternalLink size={17} aria-hidden="true" /></button
						>
					</div>
					<p class="mt-2 text-xs leading-5 {slugIssue ? 'text-red-700' : 'text-zinc-500'}">
						{slugIssue ?? 'Латинські літери, цифри та дефіси. Від 3 до 40 символів.'}
					</p>

					<div class="mt-5 border-t border-zinc-100 pt-5">
						<div class="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
							<div>
								<div class="flex items-center gap-1.5">
									<Smartphone size={15} class="text-zinc-500" />
									<span class="text-xs font-bold text-zinc-700">Верифікація номера телефону</span>
								</div>
								<p class="mt-1 text-xs text-zinc-500">
									{#if config.phoneVerified && config.phone}
										Підтверджений номер: <strong class="font-mono text-zinc-800">{config.phone}</strong>
										{#if config.telegramId}
											<span class="ml-2 inline-flex items-center gap-1.5 rounded-full bg-[#229ED9]/10 py-0.5 pr-2 pl-1 text-[11px] font-semibold text-[#229ED9]">
												{#if config.avatarUrl}
													<img
														src={config.avatarUrl}
														alt=""
														class="size-4 rounded-full object-cover"
													/>
												{:else}
													<Send size={11} class="ml-1" />
												{/if}
												<span>{#if config.telegramUsername}@{config.telegramUsername}{:else}ID: {config.telegramId}{/if}</span>
											</span>
										{/if}
									{:else}
										Підтвердіть номер для закріплення вашої адреси rahunok.com/@{config.slug || 'ваша-адреса'} та отримання сповіщень.
									{/if}
								</p>
							</div>

							{#if config.phoneVerified && config.phone}
								<div class="flex items-center gap-2">
									<span
										class="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700"
									>
										<ShieldCheck size={13} />
										Верифіковано
									</span>
									{#if config.telegramId}
										<button
											type="button"
											onclick={() => {
												showSendMessageModal = true;
												notificationText = '';
												notificationStatus = null;
											}}
											class="inline-flex cursor-pointer items-center gap-1 rounded-md border border-[#229ED9]/40 bg-[#229ED9]/10 px-2.5 py-1 text-xs font-bold text-[#229ED9] transition-colors hover:bg-[#229ED9]/20"
										>
											<Send size={12} />
											Написати
										</button>
									{/if}
									<button
										type="button"
										onclick={resetVerification}
										class="cursor-pointer text-xs text-zinc-400 underline hover:text-zinc-600"
									>
										Змінити
									</button>
								</div>
							{:else}
								<button
									type="button"
									onclick={startTelegramVerification}
									class="inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-md bg-[#229ED9] px-3.5 py-2 text-xs font-bold text-white shadow-xs transition-all hover:bg-[#1E88E5] active:scale-95"
								>
									<Send size={13} />
									Верифікувати номер телефону
								</button>
							{/if}
						</div>
					</div>
				</div>
			</section>

			<section class="overflow-hidden rounded-lg border border-zinc-200 bg-white">
				<div class="border-b border-zinc-200 px-5 py-5 sm:px-6">
					<p class="text-xs font-bold tracking-[0.12em] text-zinc-500 uppercase">
						Швидка перевірка
					</p>
					<h2 class="mt-1 text-base font-extrabold">Пов’язані профілі та довіра</h2>
					<p class="mt-1 text-sm leading-6 text-zinc-500">
						Насичена сторінка на кшталт Expirenza: реквізити, статус верифікації, соцмережі та
						актуальні способи зв’язку.
					</p>
				</div>
				<div class="grid gap-3 p-5 sm:grid-cols-2 sm:p-6">
					<button
						type="button"
						disabled
						class="flex min-h-16 items-center gap-3 rounded-md border border-zinc-200 bg-zinc-50 p-3 text-left text-zinc-500"
						><Link2 size={20} aria-hidden="true" /><span
							><strong class="block text-sm text-zinc-700">Instagram</strong><span class="text-xs"
								>Підключення після верифікації</span
							></span
						></button
					><button
						type="button"
						disabled
						class="flex min-h-16 items-center gap-3 rounded-md border border-zinc-200 bg-zinc-50 p-3 text-left text-zinc-500"
						><Globe2 size={20} aria-hidden="true" /><span
							><strong class="block text-sm text-zinc-700">YouTube та інші</strong><span
								class="text-xs">Перевірені зовнішні посилання</span
							></span
						></button
					>
				</div>
			</section>

			<section class="overflow-hidden rounded-lg border border-zinc-200 bg-white">
				<div class="border-b border-zinc-200 px-5 py-5 sm:px-6">
					<div class="flex items-start gap-3">
						<span
							class="grid size-10 shrink-0 place-items-center rounded-md bg-lime-100 text-lime-800"
							><UserRound size={19} aria-hidden="true" /></span
						>
						<div>
							<p class="text-xs font-bold tracking-[0.12em] text-zinc-500 uppercase">
								Вигляд профілю
							</p>
							<h2 class="mt-1 text-base font-extrabold">Назва та опис</h2>
						</div>
					</div>
				</div>
				<div class="grid gap-5 p-5 sm:p-6">
					<label
						><span class="mb-2 block text-xs font-bold text-zinc-600">Публічна назва</span><input
							bind:value={config.displayName}
							oninput={() => (saved = false)}
							maxlength="80"
							placeholder="Назва бізнесу або ваше ім'я"
							class="h-12 w-full rounded-md border border-zinc-200 px-3 text-sm font-semibold outline-none focus:border-blue-600"
						/></label
					>
					<label
						><span class="mb-2 block text-xs font-bold text-zinc-600">Короткий опис</span><textarea
							bind:value={config.description}
							oninput={() => (saved = false)}
							maxlength="180"
							rows="4"
							placeholder="Що ви робите і за що приймаєте оплату"
							class="w-full resize-none rounded-md border border-zinc-200 p-3 text-sm leading-6 outline-none focus:border-blue-600"
						></textarea><span class="mt-1 block text-right text-xs text-zinc-400 tabular-nums"
							>{config.description.length}/180</span
						></label
					>
				</div>
			</section>

			<div
				class="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-950"
			>
				<ShieldAlert size={20} class="mt-0.5 shrink-0" aria-hidden="true" />
				<p>
					<strong>{publicUrl} ще не опублікована.</strong> Потрібні серверне збереження, перевірка унікальності
					@RhnkBot, верифікація зовнішніх акаунтів і публічний resolver. Ця чернетка не змінює Worker або
					Supabase.
				</p>
			</div>
		</div>

		<aside
			class="h-fit overflow-hidden rounded-lg border border-zinc-200 bg-[#151718] text-white xl:sticky xl:top-24"
		>
			<div class="border-b border-white/10 p-5">
				<p class="text-xs font-bold tracking-[0.12em] text-zinc-400 uppercase">
					Попередній перегляд
				</p>
				<p class="mt-2 truncate font-mono text-xs text-cyan-300">{publicPath}</p>
			</div>
			<div
				class="min-h-80 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.18),transparent_42%)] p-6 text-center"
			>
				<div
					class="mx-auto grid size-16 place-items-center rounded-lg bg-[#c9ff4a] text-xl font-black text-zinc-950 overflow-hidden shadow-inner"
				>
					{#if config.avatarUrl}
						<img src={config.avatarUrl} alt={previewName} class="size-full object-cover" />
					{:else}
						{initials || 'R'}
					{/if}
				</div>
				<h2 class="mt-5 text-xl font-extrabold">{previewName}</h2>
				{#if config.phoneVerified && config.phone}
					<div
						class="mt-2 inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-0.5 text-xs font-semibold text-emerald-400"
					>
						<ShieldCheck size={13} />
						<span>{config.phone}</span>
					</div>
				{/if}
				<p class="mx-auto mt-2 max-w-64 text-sm leading-6 text-zinc-400">{previewDescription}</p>
				<div class="mt-7 grid gap-2">
					<div
						class="flex h-12 items-center justify-center rounded-md bg-white font-extrabold text-zinc-950"
					>
						Оплатити
					</div>
					<div
						class="flex h-11 items-center justify-center gap-2 rounded-md border border-white/15 text-sm font-bold text-zinc-300"
					>
						<Globe2 size={16} aria-hidden="true" /> Поділитися профілем
					</div>
				</div>
			</div>
			<div class="border-t border-white/10 p-5">
				<button
					type="button"
					onclick={persist}
					disabled={Boolean(slugIssue)}
					class="flex h-12 w-full items-center justify-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-extrabold hover:bg-blue-500 disabled:bg-zinc-700 disabled:text-zinc-400"
					>{#if saved}<Check size={17} aria-hidden="true" /> Чернетку збережено{:else}<Save
							size={17}
							aria-hidden="true"
						/> Зберегти чернетку{/if}</button
				>
				<p class="mt-3 flex items-start gap-2 text-xs leading-5 text-zinc-400">
					<ExternalLink size={14} class="mt-0.5 shrink-0" aria-hidden="true" /> Публікація стане окремим
					серверним кроком.
				</p>
			</div>
		</aside>
	</div>
</div>

{#if showVerifyModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
		<div class="relative w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-2xl">
			<button
				type="button"
				onclick={closeVerifyModal}
				class="absolute right-4 top-4 cursor-pointer text-zinc-400 hover:text-zinc-600"
				aria-label="Закрити"
			>
				<X size={18} />
			</button>

			<div class="flex items-center gap-3">
				<div class="grid size-11 place-items-center rounded-xl bg-[#229ED9]/10 text-[#229ED9]">
					<Send size={22} />
				</div>
				<div>
					<h3 class="text-base font-extrabold text-zinc-900">Підтвердження через Telegram</h3>
					<p class="text-xs text-zinc-500">Швидка верифікація номера телефону</p>
				</div>
			</div>

			{#if verificationSuccessMessage}
				<div class="mt-4 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-xs font-bold text-emerald-800">
					<Check size={18} class="shrink-0 text-emerald-600" />
					<span>{verificationSuccessMessage}</span>
				</div>
			{:else}
				<div class="mt-4 space-y-2.5 rounded-lg border border-zinc-100 bg-zinc-50 p-4 text-xs text-zinc-600">
					<div class="flex items-start gap-2.5">
						<span
							class="flex size-5 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-[11px] font-bold text-zinc-700"
							>1</span
						>
						<span>Натисніть кнопку <strong>Відкрити бота</strong> нижче.</span>
					</div>
					<div class="flex items-start gap-2.5">
						<span
							class="flex size-5 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-[11px] font-bold text-zinc-700"
							>2</span
						>
						<span>У чаті з ботом натисніть кнопку <strong>Розпочати (Start)</strong>.</span>
					</div>
					<div class="flex items-start gap-2.5">
						<span
							class="flex size-5 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-[11px] font-bold text-zinc-700"
							>3</span
						>
						<span>Натисніть нативну кнопку <strong>📱 Поділитися номером</strong>.</span>
					</div>
				</div>

				{#if isPolling}
					<div class="mt-3 flex items-center justify-center gap-2 py-1 text-xs text-zinc-500">
						<Loader2 size={14} class="animate-spin text-[#229ED9]" />
						<span>Очікуємо на підтвердження контакту від бота...</span>
					</div>
				{/if}
			{/if}

			<div class="mt-5 flex flex-col gap-2">
				<a
					href="https://t.me/{telegramBotUsername}?start=verify_{verifyToken}"
					target="_blank"
					rel="noopener noreferrer"
					class="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#229ED9] text-xs font-bold text-white shadow-xs transition-all hover:bg-[#1E88E5]"
				>
					<Send size={15} />
					Відкрити @{telegramBotUsername}
					<ExternalLink size={13} />
				</a>

				<button
					type="button"
					onclick={simulateSuccess}
					class="flex h-10 w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-zinc-200 bg-white text-xs font-semibold text-zinc-600 transition-colors hover:bg-zinc-50"
				>
					<Check size={14} class="text-emerald-600" />
					Імітувати успіх (Тестовий режим)
				</button>
			</div>
		</div>
	</div>
{/if}

{#if showSendMessageModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
		<div class="relative w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-2xl">
			<button
				type="button"
				onclick={() => (showSendMessageModal = false)}
				class="absolute right-4 top-4 cursor-pointer text-zinc-400 hover:text-zinc-600"
				aria-label="Закрити"
			>
				<X size={18} />
			</button>

			<div class="flex items-center gap-3">
				<div class="grid size-11 place-items-center rounded-xl bg-[#229ED9]/10 text-[#229ED9]">
					<Send size={22} />
				</div>
				<div>
					<h3 class="text-base font-extrabold text-zinc-900">Надіслати в Telegram</h3>
					<p class="text-xs text-zinc-500">
						Отримувач: <strong class="text-zinc-800">{#if config.telegramUsername}@{config.telegramUsername}{:else}ID: {config.telegramId}{/if}</strong>
					</p>
				</div>
			</div>

			<div class="mt-4">
				<label for="telegram-notification-text" class="mb-1.5 block text-xs font-bold text-zinc-700">
					Текст повідомлення
				</label>
				<textarea
					id="telegram-notification-text"
					bind:value={notificationText}
					rows="3"
					placeholder="Введіть текст для відправки через бота @RhnkBot..."
					class="w-full rounded-md border border-zinc-200 p-3 text-sm leading-5 outline-none focus:border-[#229ED9]"
				></textarea>

				<div class="mt-2 flex flex-wrap gap-1.5">
					<button
						type="button"
						onclick={() => (notificationText = '🎉 Вітаємо! Ваш профіль та номер телефону успішно верифіковано на Rahunok.')}
						class="cursor-pointer rounded border border-zinc-200 bg-zinc-50 px-2 py-1 text-[11px] text-zinc-600 hover:bg-zinc-100"
					>
						+ Шаблон вітання
					</button>
					<button
						type="button"
						onclick={() => (notificationText = '🔔 Тестове сповіщення з вашого кабінету Rahunok: зв’язок із ботом налаштовано успішно!')}
						class="cursor-pointer rounded border border-zinc-200 bg-zinc-50 px-2 py-1 text-[11px] text-zinc-600 hover:bg-zinc-100"
					>
						+ Тест зв\'язку
					</button>
				</div>
			</div>

			{#if notificationStatus?.success}
				<div class="mt-3 flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-2.5 text-xs font-bold text-emerald-800">
					<Check size={16} class="text-emerald-600" />
					Повідомлення успішно доставлено в Telegram!
				</div>
			{:else if notificationStatus?.error}
				<div class="mt-3 rounded-md border border-red-200 bg-red-50 p-2.5 text-xs font-semibold text-red-700">
					{notificationStatus.error}
				</div>
			{/if}

			<div class="mt-5 flex gap-2">
				<button
					type="button"
					onclick={() => (showSendMessageModal = false)}
					class="flex-1 cursor-pointer rounded-lg border border-zinc-200 bg-white py-2.5 text-xs font-bold text-zinc-700 hover:bg-zinc-50"
				>
					Скасувати
				</button>
				<button
					type="button"
					disabled={!notificationText.trim() || isSendingNotification}
					onclick={sendTelegramNotification}
					class="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-[#229ED9] py-2.5 text-xs font-bold text-white shadow-xs hover:bg-[#1E88E5] disabled:bg-zinc-300"
				>
					{#if isSendingNotification}
						<Loader2 size={14} class="animate-spin" />
						Відправка...
					{:else}
						<Send size={14} />
						Надіслати
					{/if}
				</button>
			</div>
		</div>
	</div>
{/if}
