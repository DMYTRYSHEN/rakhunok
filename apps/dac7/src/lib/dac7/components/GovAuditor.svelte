<script lang="ts">
	import { onMount } from 'svelte';
	import {
		AlertTriangle,
		Building,
		CheckCircle2,
		Download,
		Eye,
		FileText,
		Landmark,
		Radio,
		Scale,
		ShieldAlert,
		ShieldCheck,
		Search,
		MapPin,
		Briefcase
	} from '@lucide/svelte';
	import Dac7Pagination from './Dac7Pagination.svelte';
	import type { Dac7FraudAlert, Dac7GovPlatform } from '../types';
	import type { Dac7Gateway } from '../dac7-gateway';
	import { demoFraudAlerts, demoGovPlatforms, demoRegions, demoIndustries } from '../mockData';

	let {
		gateway,
		demo = false
	}: {
		gateway: Dac7Gateway;
		demo?: boolean;
	} = $props();

	let platforms = $state<Dac7GovPlatform[]>(demoGovPlatforms);
	let alerts = $state<Dac7FraudAlert[]>(demoFraudAlerts);
	let loading = $state(true);

	// Platforms filtering and pagination
	let platformSearch = $state('');
	let platformStatus = $state('all');
	let platformPage = $state(1);
	let platformPageSize = $state(5);

	const filteredPlatforms = $derived(
		platforms.filter((p) => {
			const matchesQ =
				platformSearch === '' || p.name.toLowerCase().includes(platformSearch.toLowerCase());
			if (!matchesQ) return false;
			if (platformStatus === 'ok' && p.st !== 'ok') return false;
			if (platformStatus === 'warn' && p.st !== 'warn') return false;
			return true;
		})
	);
	const paginatedPlatforms = $derived(
		filteredPlatforms.slice((platformPage - 1) * platformPageSize, platformPage * platformPageSize)
	);

	// Fraud alerts filtering and pagination
	let fraudSearch = $state('');
	let fraudLevel = $state('all');
	let fraudPage = $state(1);
	let fraudPageSize = $state(5);

	const filteredAlerts = $derived(
		alerts.filter((a) => {
			const matchesQ = fraudSearch === '' || a.t.toLowerCase().includes(fraudSearch.toLowerCase());
			if (!matchesQ) return false;
			if (fraudLevel !== 'all' && a.lvl !== fraudLevel) return false;
			return true;
		})
	);
	const paginatedAlerts = $derived(
		filteredAlerts.slice((fraudPage - 1) * fraudPageSize, fraudPage * fraudPageSize)
	);

	async function loadGovData() {
		loading = true;
		const res = await gateway.getGovTelemetry(demo);
		platforms = res.platforms;
		alerts = res.alerts;
		loading = false;
	}

	const totalCollectedTax = $derived(platforms.reduce((sum, p) => sum + p.flow * 0.1, 0));
	const totalFlow = $derived(platforms.reduce((sum, p) => sum + p.flow, 0));
	const totalSellersCount = $derived(platforms.reduce((sum, p) => sum + p.sellers, 0));

	let activeTab = $state('overview');

	function navigateTo(tab: string) {
		activeTab = tab;
	}

	onMount(() => {
		loadGovData();
	});
</script>

<div class="space-y-6">
	<!-- Header / Tabs -->
	<div class="flex items-center gap-1 border-b border-stone-200 pb-2">
		{#each [{ id: 'overview', l: 'Огляд' }, { id: 'platforms', l: 'Реєстр платформ' }, { id: 'fraud', l: 'Сигнали ризику' }, { id: 'regions', l: 'Регіони' }] as t}
			<button
				type="button"
				onclick={() => navigateTo(t.id)}
				class="rounded-xl px-4 py-2 text-sm font-semibold transition {activeTab === t.id
					? 'bg-stone-900 text-white shadow-sm'
					: 'text-stone-500 hover:bg-stone-50 hover:text-stone-900'}"
			>
				{t.l}
			</button>
		{/each}
	</div>

	{#if activeTab === 'overview'}
		<!-- Overview Tab -->
		<div class="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
			<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div class="space-y-1">
					<div class="flex items-center gap-2">
						<span
							class="inline-flex size-6 items-center justify-center rounded-md bg-stone-900 text-white"
						>
							<Landmark size={14} />
						</span>
						<h2 class="text-base font-bold text-stone-900">
							Моніторинговий центр ДПС • Закон № 4903-IX
						</h2>
					</div>
					<p class="text-xs text-stone-500">
						Агрегований податковий аудит цифрових платформ, деперсоналізована телеметрія та контроль
						переходу лімітів
					</p>
				</div>

				<div class="flex items-center gap-2">
					<span
						class="inline-flex items-center gap-1.5 rounded-full border border-purple-200 bg-purple-50 px-3 py-1 text-xs font-bold text-purple-800"
					>
						<ShieldCheck size={13} />
						ДПС Телеметрія Активна
					</span>
				</div>
			</div>
		</div>

		<!-- Macro Metrics -->
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
			<div class="space-y-1 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
				<span class="text-xs font-semibold text-stone-400">Сплачено ПДФО до держбюджету (10%)</span>
				<div class="flex items-baseline justify-between">
					<span class="text-xl font-black text-emerald-600">
						{(totalCollectedTax / 1_000_000).toFixed(2)} млн ₴
					</span>
					<span
						class="rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700"
					>
						Q3 2026
					</span>
				</div>
			</div>

			<div class="space-y-1 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
				<span class="text-xs font-semibold text-stone-400">Загальний оборот цифрових платформ</span>
				<div class="flex items-baseline justify-between">
					<span class="text-xl font-black text-stone-900">
						{(totalFlow / 1_000_000).toFixed(1)} млн ₴
					</span>
					<span class="text-xs text-stone-400">Bolt · Uklon · Glovo</span>
				</div>
			</div>

			<div class="space-y-1 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
				<span class="text-xs font-semibold text-stone-400">Охоплено самозайнятих виконавців</span>
				<div class="flex items-baseline justify-between">
					<span class="text-xl font-black text-stone-900">
						{totalSellersCount.toLocaleString('uk-UA')}
					</span>
					<span class="text-xs font-bold text-stone-500">Без тіньової зайнятості</span>
				</div>
			</div>
		</div>
	{:else if activeTab === 'platforms'}
		<!-- Platforms Compliance Table -->
		<div class="space-y-4 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
			<div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
				<div>
					<h3 class="text-sm font-bold text-stone-900">
						Реєстр підзвітних платформ (Оператори комерційних послуг)
					</h3>
					<p class="text-xs text-stone-500">Автоматична подача звітності за стандартом OECD DPI</p>
				</div>

				<div class="flex flex-wrap items-center gap-2">
					<div class="relative">
						<Search class="absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-stone-400" />
						<input
							type="text"
							bind:value={platformSearch}
							oninput={() => (platformPage = 1)}
							placeholder="Пошук платформи..."
							class="h-8 w-48 rounded-full border border-stone-200 bg-white pr-3 pl-8 text-xs shadow-xs outline-none"
						/>
					</div>

					<div class="flex gap-1 rounded-full border border-stone-200 bg-stone-50 p-0.5">
						{#each [{ id: 'all', l: 'Всі' }, { id: 'ok', l: 'Норма' }, { id: 'warn', l: 'Протерміновано' }] as st}
							<button
								type="button"
								onclick={() => {
									platformStatus = st.id;
									platformPage = 1;
								}}
								class="h-6 cursor-pointer rounded-full px-2.5 text-[11px] font-medium transition {platformStatus ===
								st.id
									? 'bg-stone-900 text-white shadow-xs'
									: 'text-stone-500 hover:text-stone-900'}"
							>
								{st.l}
							</button>
						{/each}
					</div>
				</div>
			</div>

			<div class="overflow-x-auto">
				<table class="w-full text-left text-xs">
					<thead class="border-b border-stone-200 bg-stone-50/70 text-stone-500">
						<tr>
							<th class="p-3 font-bold">Оператор платформи</th>
							<th class="p-3 font-bold">Виконавців</th>
							<th class="p-3 font-bold">Оборот кварталу</th>
							<th class="p-3 font-bold">Утримано ПДФО 10%</th>
							<th class="p-3 font-bold">Дедлайн DAC7</th>
							<th class="p-3 font-bold">Комплаєнс</th>
							<th class="p-3 text-right font-bold">Статус</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-stone-100 text-stone-700">
						{#each paginatedPlatforms as plt}
							<tr class="hover:bg-stone-50/50">
								<td class="p-3 font-medium text-stone-900">{plt.name}</td>
								<td class="p-3 font-semibold text-stone-700"
									>{plt.sellers.toLocaleString('uk-UA')}</td
								>
								<td class="p-3 font-mono">{plt.volume}</td>
								<td class="p-3 font-bold text-emerald-600">
									{(plt.flow * 0.1).toLocaleString('uk-UA')} ₴
								</td>
								<td class="p-3 font-mono text-stone-500">{plt.dac7}</td>
								<td class="p-3">
									<span class="font-bold text-stone-900">{plt.score}%</span>
								</td>
								<td class="p-3 text-right">
									<span
										class="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 font-bold {plt.st ===
										'ok'
											? 'border-emerald-200 bg-emerald-50 text-emerald-700'
											: 'border-amber-200 bg-amber-50 text-amber-700'}"
									>
										<CheckCircle2 size={11} />
										{plt.st === 'ok' ? 'Норма' : 'Протерміновано'}
									</span>
								</td>
							</tr>
						{:else}
							<tr>
								<td colspan="7" class="py-8 text-center text-xs text-stone-400">
									Платформ за запитом не знайдено
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>

			<Dac7Pagination
				bind:currentPage={platformPage}
				totalItems={filteredPlatforms.length}
				bind:pageSize={platformPageSize}
				pageSizeOptions={[3, 5, 10]}
			/>
		</div>
	{:else if activeTab === 'fraud'}
		<!-- Fraud Signals & Risk Alerts -->
		<div class="space-y-4 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
			<div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
				<div class="flex items-center gap-2">
					<ShieldAlert size={16} class="text-amber-600" />
					<h3 class="text-sm font-bold text-stone-900">
						Сигнали ризиків та перевищення лімітів (834 мін. зарплат)
					</h3>
				</div>

				<div class="flex flex-wrap items-center gap-2">
					<div class="relative">
						<Search class="absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-stone-400" />
						<input
							type="text"
							bind:value={fraudSearch}
							oninput={() => (fraudPage = 1)}
							placeholder="Пошук сигналів…"
							class="h-8 w-44 rounded-full border border-stone-200 bg-white pr-3 pl-8 text-xs shadow-xs outline-none"
						/>
					</div>

					<div class="flex gap-1 rounded-full border border-stone-200 bg-stone-50 p-0.5">
						{#each [{ id: 'all', l: 'Всі' }, { id: 'high', l: 'Високий' }, { id: 'mid', l: 'Увага' }] as lvl}
							<button
								type="button"
								onclick={() => {
									fraudLevel = lvl.id;
									fraudPage = 1;
								}}
								class="h-6 cursor-pointer rounded-full px-2.5 text-[11px] font-medium transition {fraudLevel ===
								lvl.id
									? 'bg-stone-900 text-white shadow-xs'
									: 'text-stone-500 hover:text-stone-900'}"
							>
								{lvl.l}
							</button>
						{/each}
					</div>
				</div>
			</div>

			<div class="space-y-2">
				{#each paginatedAlerts as a}
					<div
						class="flex items-start justify-between rounded-xl border border-stone-100 bg-stone-50/80 p-3.5 text-xs"
					>
						<div class="space-y-1">
							<div class="flex items-center gap-2">
								<span
									class="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase {a.lvl === 'high'
										? 'border border-rose-200 bg-rose-100 text-rose-800'
										: 'border border-amber-200 bg-amber-100 text-amber-800'}"
								>
									{a.lvl === 'high' ? 'Високий ризик' : 'Увага'}
								</span>
								<span class="text-[11px] text-stone-400">{a.ago}</span>
							</div>
							<p class="font-medium text-stone-800">{a.t}</p>
						</div>
						<button
							type="button"
							class="cursor-pointer rounded-lg border border-stone-200 bg-white px-2.5 py-1 text-[11px] font-bold text-stone-700 hover:bg-stone-50"
						>
							Перевірити
						</button>
					</div>
				{:else}
					<div class="py-8 text-center text-xs text-stone-400">
						Підозрілих операцій за фільтром не виявлено
					</div>
				{/each}
			</div>

			<Dac7Pagination
				bind:currentPage={fraudPage}
				totalItems={filteredAlerts.length}
				bind:pageSize={fraudPageSize}
				pageSizeOptions={[3, 5, 10]}
			/>
		</div>
	{:else if activeTab === 'regions'}
		<!-- Regions & Industries Analytics Tab (from D:\SELF\src\features\gov\GovRegions.tsx) -->
		<div class="space-y-6">
			<div class="flex items-center justify-between">
				<div>
					<h3 class="text-base font-bold text-stone-900">
						Аналітика зайнятості по регіонах та індустріях
					</h3>
					<p class="mt-0.5 text-xs text-stone-500">
						Географічний зріз податкових надходжень (10% ПДФО) до місцевих бюджетів України
					</p>
				</div>
			</div>

			<div class="grid gap-5 lg:grid-cols-2">
				<!-- Popular Regions Card -->
				<div class="space-y-4 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
					<div class="flex items-center gap-2 border-b border-stone-100 pb-3">
						<MapPin class="size-4 text-stone-500" />
						<h4 class="text-sm font-bold text-stone-900">Популярні регіони</h4>
					</div>
					<div class="divide-y divide-stone-50">
						{#each demoRegions as r}
							<div class="flex items-center justify-between py-2 text-xs">
								<span class="font-medium text-stone-700">{r.name}</span>
								<span class="font-mono font-bold text-stone-900">{r.v}%</span>
							</div>
						{/each}
					</div>
				</div>

				<!-- Industries Breakdown Card -->
				<div class="space-y-4 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
					<div class="flex items-center gap-2 border-b border-stone-100 pb-3">
						<Briefcase class="size-4 text-stone-500" />
						<h4 class="text-sm font-bold text-stone-900">Розподіл за індустріями</h4>
					</div>
					<div class="space-y-4 pt-1">
						{#each demoIndustries as ind}
							<div class="space-y-1.5">
								<div class="flex justify-between text-xs">
									<span class="font-medium text-stone-700">{ind.name}</span>
									<span class="font-mono font-bold text-stone-500">{ind.v}%</span>
								</div>
								<div class="h-2 w-full overflow-hidden rounded-full bg-stone-100">
									<div class="h-full rounded-full {ind.c}" style="width: {ind.v}%"></div>
								</div>
							</div>
						{/each}
					</div>
				</div>
			</div>
		</div>
	{/if}
</div>
