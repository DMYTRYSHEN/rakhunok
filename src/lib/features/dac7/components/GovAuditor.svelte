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
		ShieldCheck
	} from '@lucide/svelte';
	import type { Dac7FraudAlert, Dac7GovPlatform } from '../types';
	import type { Dac7Gateway } from '../dac7-gateway';
	import { demoFraudAlerts, demoGovPlatforms } from '../mockData';

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

	async function loadGovData() {
		loading = true;
		const res = await gateway.getGovTelemetry(demo);
		platforms = res.platforms;
		alerts = res.alerts;
		loading = false;
	}

	const totalCollectedTax = $derived(
		platforms.reduce((sum, p) => sum + p.flow * 0.1, 0)
	);
	const totalFlow = $derived(
		platforms.reduce((sum, p) => sum + p.flow, 0)
	);
	const totalSellersCount = $derived(
		platforms.reduce((sum, p) => sum + p.sellers, 0)
	);

	onMount(() => {
		loadGovData();
	});
</script>

<div class="space-y-6">
	<!-- Banner -->
	<div class="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
		<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
			<div class="space-y-1">
				<div class="flex items-center gap-2">
					<span class="inline-flex size-6 items-center justify-center rounded-md bg-stone-900 text-white">
						<Landmark size={14} />
					</span>
					<h2 class="text-base font-bold text-stone-900">
						?????????????? ????? ??? ? ????? ? 4903-IX & ????????? DAC7
					</h2>
				</div>
				<p class="text-xs text-stone-500">
					??????????? ?????????? ????? ???????? ????????, ????????????????? ?????????? ?? ???????? ???????? ???????
				</p>
			</div>

			<div class="flex items-center gap-2">
				<span class="inline-flex items-center gap-1.5 rounded-full border border-purple-200 bg-purple-50 px-3 py-1 text-xs font-bold text-purple-800">
					<ShieldCheck size={13} />
					??? ?????????? ???????
				</span>
			</div>
		</div>
	</div>

	<!-- Macro Metrics -->
	<div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
		<div class="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm space-y-1">
			<span class="text-xs font-semibold text-stone-400">???????? ???? ?? ??????????? (10%)</span>
			<div class="flex items-baseline justify-between">
				<span class="text-xl font-black text-emerald-600">
					{(totalCollectedTax / 1_000_000).toFixed(2)} ??? ?
				</span>
				<span class="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
					Q3 2026
				</span>
			</div>
		</div>

		<div class="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm space-y-1">
			<span class="text-xs font-semibold text-stone-400">????????? ?????? ???????? ????????</span>
			<div class="flex items-baseline justify-between">
				<span class="text-xl font-black text-stone-900">
					{(totalFlow / 1_000_000).toFixed(1)} ??? ?
				</span>
				<span class="text-xs text-stone-400">Bolt ? Uklon ? Glovo</span>
			</div>
		</div>

		<div class="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm space-y-1">
			<span class="text-xs font-semibold text-stone-400">???????? ???????????? ??????????</span>
			<div class="flex items-baseline justify-between">
				<span class="text-xl font-black text-stone-900">
					{totalSellersCount.toLocaleString('uk-UA')}
				</span>
				<span class="text-xs font-bold text-stone-500">??? ???????? ??????????</span>
			</div>
		</div>
	</div>

	<!-- Platforms Compliance Table -->
	<div class="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm space-y-4">
		<div class="flex items-center justify-between">
			<div>
				<h3 class="text-sm font-bold text-stone-900">?????? ?????????? ???????? (????????? ??????????? ??????)</h3>
				<p class="text-xs text-stone-500">??????????? ?????? ????????? ?? ?????????? OECD DPI</p>
			</div>
		</div>

		<div class="overflow-x-auto">
			<table class="w-full text-left text-xs">
				<thead class="border-b border-stone-200 bg-stone-50/70 text-stone-500">
					<tr>
						<th class="p-3 font-bold">???????? ?????????</th>
						<th class="p-3 font-bold">??????????</th>
						<th class="p-3 font-bold">?????? ????????</th>
						<th class="p-3 font-bold">???????? ???? 10%</th>
						<th class="p-3 font-bold">??????? DAC7</th>
						<th class="p-3 font-bold">?????????</th>
						<th class="p-3 font-bold text-right">??????</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-stone-100 text-stone-700">
					{#each platforms as plt}
						<tr class="hover:bg-stone-50/50">
							<td class="p-3 font-medium text-stone-900">{plt.name}</td>
							<td class="p-3 font-semibold text-stone-700">{plt.sellers.toLocaleString('uk-UA')}</td>
							<td class="p-3 font-mono">{plt.volume}</td>
							<td class="p-3 font-bold text-emerald-600">
								{(plt.flow * 0.1).toLocaleString('uk-UA')} ?
							</td>
							<td class="p-3 font-mono text-stone-500">{plt.dac7}</td>
							<td class="p-3">
								<span class="font-bold text-stone-900">{plt.score}%</span>
							</td>
							<td class="p-3 text-right">
								<span class="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 font-bold text-emerald-700 border border-emerald-200">
									<CheckCircle2 size={11} /> ?????
								</span>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>

	<!-- Fraud Signals & Risk Alerts -->
	<div class="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm space-y-4">
		<div class="flex items-center justify-between">
			<div class="flex items-center gap-2">
				<ShieldAlert size={16} class="text-amber-600" />
				<h3 class="text-sm font-bold text-stone-900">??????? ??????? ?? ??????????? ??????? (834 ???. ???????)</h3>
			</div>
			<span class="text-xs text-stone-400">???????? ???????????: {alerts.length}</span>
		</div>

		<div class="space-y-2">
			{#each alerts as a}
				<div class="flex items-start justify-between p-3.5 rounded-xl border border-stone-100 bg-stone-50/80 text-xs">
					<div class="space-y-1">
						<div class="flex items-center gap-2">
							<span class="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase {a.lvl === 'high' ? 'bg-rose-100 text-rose-800 border border-rose-200' : 'bg-amber-100 text-amber-800 border border-amber-200'}">
								{a.lvl === 'high' ? '??????? ?????' : '?????'}
							</span>
							<span class="text-stone-400 text-[11px]">{a.ago}</span>
						</div>
						<p class="font-medium text-stone-800">{a.t}</p>
					</div>
					<button
						type="button"
						class="rounded-lg border border-stone-200 bg-white px-2.5 py-1 text-[11px] font-bold text-stone-700 hover:bg-stone-50"
					>
						??????????
					</button>
				</div>
			{/each}
		</div>
	</div>
</div>
