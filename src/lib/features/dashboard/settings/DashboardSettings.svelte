<script lang="ts">
	import { onMount } from 'svelte';
	import { Check, Clock3, Moon, Save, Sun } from '@lucide/svelte';

	type DashboardTheme = 'light' | 'dark';
	let {
		tableOrderTtlSeconds,
		onSave
	}: {
		tableOrderTtlSeconds: number;
		onSave: (tableOrderTtlSeconds: number) => Promise<void>;
	} = $props();

	let theme = $state<DashboardTheme>('light');
	let tableTtl = $derived(String(tableOrderTtlSeconds));
	let savedTtl = $derived(String(tableOrderTtlSeconds));
	let saved = $state(false);
	let saving = $state(false);
	let saveError = $state<string | null>(null);

	const ttlOptions = [
		{ value: '1800', label: '30 хвилин', detail: 'Стандарт' },
		{ value: '3600', label: '1 година', detail: 'Для довгих сесій' },
		{ value: '7200', label: '2 години', detail: 'Збалансований режим' },
		{ value: '18000', label: '5 годин', detail: 'Тривале обслуговування' }
	];

	function applyTheme(nextTheme: DashboardTheme) {
		theme = nextTheme;
		document.documentElement.dataset.theme = nextTheme;
		localStorage.setItem('rahunok_theme', nextTheme);
	}

	async function saveTtl() {
		saving = true;
		saveError = null;
		try {
			await onSave(Number(tableTtl));
			saved = true;
			window.setTimeout(() => (saved = false), 2400);
		} catch (error) {
			saveError = error instanceof Error ? error.message : 'Не вдалося зберегти налаштування.';
		} finally {
			saving = false;
		}
	}

	onMount(() => {
		const storedTheme = localStorage.getItem('rahunok_theme');
		applyTheme(storedTheme === 'dark' ? 'dark' : 'light');
	});
</script>

<div class="mx-auto max-w-5xl">
	<header class="mb-8">
		<p class="text-xs font-bold tracking-[0.14em] text-zinc-500 uppercase">Робочий простір</p>
		<h1 class="mt-2 text-2xl font-extrabold sm:text-3xl">Налаштування</h1>
		<p class="mt-2 max-w-2xl text-sm leading-6 text-zinc-600">
			Оформлення дашборду та поведінка активних замовлень за столиками.
		</p>
	</header>

	<div class="space-y-6">
		<section class="overflow-hidden rounded-lg border border-zinc-200 bg-white">
			<div class="border-b border-zinc-200 px-5 py-5 sm:px-6">
				<p class="text-xs font-bold tracking-[0.12em] text-zinc-500 uppercase">Зовнішній вигляд</p>
				<h2 class="mt-1 text-base font-extrabold">Тема інтерфейсу</h2>
				<p class="mt-1 text-sm text-zinc-500">Оберіть комфортне оформлення робочого простору.</p>
			</div>

			<div class="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
				<button
					type="button"
					onclick={() => applyTheme('light')}
					aria-pressed={theme === 'light'}
					class="group overflow-hidden rounded-lg border-2 text-left transition-colors {theme ===
					'light'
						? 'border-blue-600'
						: 'border-zinc-200 hover:border-zinc-300'}"
				>
					<div class="h-32 bg-[#f4f5f6] p-4">
						<div
							class="flex h-full overflow-hidden rounded-md border border-zinc-200 bg-white shadow-sm"
						>
							<div class="w-12 bg-[#151717] p-2">
								<div class="size-3 rounded-sm bg-[#c9ff4a]"></div>
							</div>
							<div class="flex-1 p-3">
								<div class="h-2 w-16 rounded bg-zinc-300"></div>
								<div class="mt-3 grid grid-cols-2 gap-2">
									<div class="h-12 rounded border border-zinc-200 bg-zinc-50"></div>
									<div class="h-12 rounded border border-zinc-200 bg-zinc-50"></div>
								</div>
							</div>
						</div>
					</div>
					<div class="flex items-start gap-3 border-t border-zinc-200 p-4">
						<span
							class="grid size-9 shrink-0 place-items-center rounded-md bg-amber-50 text-amber-700"
						>
							<Sun size={18} aria-hidden="true" />
						</span>
						<span class="min-w-0 flex-1">
							<strong class="block text-sm">Світла</strong>
							<span class="mt-0.5 block text-xs leading-5 text-zinc-500"
								>Чистий контраст для роботи вдень</span
							>
						</span>
						{#if theme === 'light'}
							<span class="grid size-6 place-items-center rounded-full bg-blue-600 text-white">
								<Check size={14} strokeWidth={3} aria-hidden="true" />
							</span>
						{/if}
					</div>
				</button>

				<button
					type="button"
					onclick={() => applyTheme('dark')}
					aria-pressed={theme === 'dark'}
					class="group overflow-hidden rounded-lg border-2 text-left transition-colors {theme ===
					'dark'
						? 'border-blue-600'
						: 'border-zinc-200 hover:border-zinc-300'}"
				>
					<div class="h-32 bg-[#191b1c] p-4">
						<div
							class="flex h-full overflow-hidden rounded-md border border-zinc-700 bg-[#242627] shadow-sm"
						>
							<div class="w-12 bg-black p-2">
								<div class="size-3 rounded-sm bg-[#c9ff4a]"></div>
							</div>
							<div class="flex-1 p-3">
								<div class="h-2 w-16 rounded bg-zinc-600"></div>
								<div class="mt-3 grid grid-cols-2 gap-2">
									<div class="h-12 rounded border border-zinc-700 bg-zinc-800"></div>
									<div class="h-12 rounded border border-zinc-700 bg-zinc-800"></div>
								</div>
							</div>
						</div>
					</div>
					<div class="flex items-start gap-3 border-t border-zinc-200 p-4">
						<span
							class="grid size-9 shrink-0 place-items-center rounded-md bg-zinc-900 text-zinc-100"
						>
							<Moon size={18} aria-hidden="true" />
						</span>
						<span class="min-w-0 flex-1">
							<strong class="block text-sm">Темна</strong>
							<span class="mt-0.5 block text-xs leading-5 text-zinc-500"
								>Менше яскравості у вечірню зміну</span
							>
						</span>
						{#if theme === 'dark'}<span
								class="grid size-6 place-items-center rounded-full bg-blue-600 text-white"
								><Check size={14} strokeWidth={3} aria-hidden="true" /></span
							>{/if}
					</div>
				</button>
			</div>
		</section>

		<section class="rounded-lg border border-zinc-200 bg-white">
			<div class="border-b border-zinc-200 px-5 py-5 sm:px-6">
				<div class="flex items-start gap-3">
					<span
						class="grid size-10 shrink-0 place-items-center rounded-md bg-blue-50 text-blue-700"
					>
						<Clock3 size={19} aria-hidden="true" />
					</span>
					<div>
						<p class="text-xs font-bold tracking-[0.12em] text-zinc-500 uppercase">
							Ресторан і термінали
						</p>
						<h2 class="mt-1 text-base font-extrabold">Час активності столика</h2>
						<p class="mt-1 max-w-2xl text-sm leading-6 text-zinc-500">
							Скільки часу призначена сума залишається актуальною до повернення столика в режим
							очікування.
						</p>
					</div>
				</div>
			</div>

			<div class="p-5 sm:p-6">
				<fieldset>
					<legend class="text-sm font-bold">Тривалість сесії</legend>
					<div class="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
						{#each ttlOptions as option (option.value)}
							<label class="cursor-pointer">
								<input
									class="peer sr-only"
									type="radio"
									name="table-ttl"
									value={option.value}
									bind:group={tableTtl}
								/>
								<span
									class="block rounded-md border border-zinc-200 px-4 py-3 peer-checked:border-blue-600 peer-checked:bg-blue-50"
								>
									<strong class="block text-sm">{option.label}</strong>
									<span class="mt-1 block text-xs text-zinc-500">{option.detail}</span>
								</span>
							</label>
						{/each}
					</div>
				</fieldset>

				<div
					class="mt-6 flex flex-col gap-3 border-t border-zinc-200 pt-5 sm:flex-row sm:items-center sm:justify-between"
				>
					<div>
						<p class="text-xs text-zinc-500">
							Поточне значення: {ttlOptions.find((option) => option.value === savedTtl)?.label ??
								`${Number(savedTtl) / 60} хвилин`}. Застосовується до нових рахунків за столиком.
						</p>
						{#if saveError}<p class="mt-2 text-xs font-semibold text-red-600">{saveError}</p>{/if}
					</div>
					<button
						type="button"
						disabled={tableTtl === savedTtl || saving}
						onclick={saveTtl}
						class="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-blue-600 px-5 text-sm font-extrabold text-white hover:bg-blue-700 disabled:bg-zinc-200 disabled:text-zinc-500"
					>
						<Save size={17} aria-hidden="true" />
						{saving ? 'Збереження...' : saved ? 'Збережено' : 'Зберегти'}
					</button>
				</div>
			</div>
		</section>
	</div>
</div>
