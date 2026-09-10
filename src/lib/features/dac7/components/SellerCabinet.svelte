<script lang="ts">
	import { onMount } from 'svelte';
	import {
		ArrowUpRight,
		Building2,
		CheckCircle2,
		CreditCard,
		FileCheck,
		Fingerprint,
		HelpCircle,
		ShieldCheck,
		Sparkles,
		UserCheck,
		Zap
	} from '@lucide/svelte';
	import type { Dac7Batch, Dac7IncomeTransaction, Dac7Payout, Dac7Seller } from '../types';
	import type { Dac7Gateway } from '../dac7-gateway';
	import { demoBatches, demoIncome, demoPayouts, demoSellers } from '../mockData';

	let {
		gateway,
		demo = false
	}: {
		gateway: Dac7Gateway;
		demo?: boolean;
	} = $props();

	let currentSeller = $state<Dac7Seller>(demoSellers[0]);
	let batches = $state<Dac7Batch[]>(demoBatches);
	let incomeList = $state<Dac7IncomeTransaction[]>(demoIncome);
	let payoutsList = $state<Dac7Payout[]>(demoPayouts);
	let loading = $state(true);
	let payoutSuccess = $state<string | null>(null);

	async function loadData() {
		loading = true;
		const sellers = await gateway.getSellers(demo);
		if (sellers.length > 0) {
			currentSeller = sellers[0];
		}
		const allPayouts = await gateway.getPayouts(demo);
		payoutsList = allPayouts.filter((p) => p.sid === currentSeller.id || p.seller.includes(currentSeller.name));
		loading = false;
	}

	async function requestInstantPayout() {
		payoutSuccess = 'Ініціалізація миттєвої виплати на IBAN...';
		const newPayout = await gateway.createPayout({
			sellerId: currentSeller.id,
			sellerName: currentSeller.name,
			gross: 650,
			isFop: !!currentSeller.isFop,
			rail: 'Monobank Instant IBAN'
		});

		payoutsList = [newPayout, ...payoutsList];
		payoutSuccess = `Кошти в сумі ${newPayout.net} ₴ успішно надіслано на ваш рахунок ${currentSeller.ibanFormatted || 'IBAN'} (ПДФО 10%: ${newPayout.tax} ₴ сплачено платформою)`;
		setTimeout(() => (payoutSuccess = null), 6000);
	}

	onMount(() => {
		loadData();
	});
</script>

<div class="space-y-6">
	<!-- Courier Header Profile Card -->
	<div class="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
		<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
			<div class="flex items-center gap-4">
				<div class="grid size-12 place-items-center rounded-2xl bg-stone-900 font-bold text-white text-lg">
					ОТ
				</div>
				<div>
					<div class="flex items-center gap-2">
						<h2 class="text-base font-bold text-stone-900">{currentSeller.name}</h2>
						<span class="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 border border-emerald-200">
							<CheckCircle2 size={12} /> Дія.Підпис Tier 2
						</span>
					</div>
					<p class="text-xs text-stone-500">
						РНОКПП: {currentSeller.rnokpp || '3091248192'} • Статус: Самозайнятий кур'єр (Закон № 4903-IX)
					</p>
				</div>
			</div>

			<div class="flex items-center gap-3">
				<button
					type="button"
					onclick={requestInstantPayout}
					class="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 transition"
				>
					<Zap size={14} />
					<span>Миттєва виплата на картку</span>
				</button>
			</div>
		</div>

		{#if payoutSuccess}
			<div class="mt-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-800">
				<CheckCircle2 size={16} />
				<span>{payoutSuccess}</span>
			</div>
		{/if}
	</div>

	<!-- 3 Ledgers Rule Explainer -->
	<div class="rounded-2xl border border-stone-200 bg-stone-50/70 p-5 space-y-3">
		<div class="flex items-center gap-2 font-bold text-stone-900 text-xs">
			<Sparkles size={15} class="text-amber-500" />
			<span>Правило трьох реєстрів обліку доходів (Закон № 4903-IX):</span>
		</div>
		<div class="grid grid-cols-1 gap-3 sm:grid-cols-3 text-xs">
			<div class="rounded-xl border border-stone-200 bg-white p-3.5 space-y-1">
				<span class="font-bold text-stone-900">1. Оплата клієнта (Payment)</span>
				<p class="text-stone-500 text-[11px]">
					Клієнт сплачує за замовлення та доставку на користь платформи (Merchant of Record).
				</p>
			</div>
			<div class="rounded-xl border border-stone-200 bg-white p-3.5 space-y-1">
				<span class="font-bold text-blue-700">2. Дохід кур'єра (Income)</span>
				<p class="text-stone-500 text-[11px]">
					Фіксація виконання послуги доставки. З цієї суми платформа автоматично нараховує 10% ПДФО.
				</p>
			</div>
			<div class="rounded-xl border border-stone-200 bg-white p-3.5 space-y-1">
				<span class="font-bold text-emerald-700">3. Виплата на рахунок (Payout)</span>
				<p class="text-stone-500 text-[11px]">
					Чисті кошти (Net 90%), зараховані на банківський IBAN через СЕП НБУ або A2C.
				</p>
			</div>
		</div>
	</div>

	<!-- Today Summary & Verified IBAN Card -->
	<div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
		<!-- Daily Earnings -->
		<div class="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm space-y-4 lg:col-span-2">
			<div class="flex items-center justify-between">
				<h3 class="text-sm font-bold text-stone-900">Сьогоднішній заробіток та утримані податки</h3>
				<span class="text-xs text-stone-400">10 вересня 2026</span>
			</div>

			<div class="grid grid-cols-3 gap-3">
				<div class="rounded-xl bg-stone-50 p-4 border border-stone-100">
					<span class="text-[11px] font-semibold text-stone-400">Нараховано</span>
					<div class="mt-1 text-lg font-black text-stone-900">700.00 ₴</div>
				</div>
				<div class="rounded-xl bg-rose-50/60 p-4 border border-rose-100">
					<span class="text-[11px] font-semibold text-rose-700">ПДФО 10% (в бюджет)</span>
					<div class="mt-1 text-lg font-black text-rose-600">-70.00 ₴</div>
				</div>
				<div class="rounded-xl bg-emerald-50/60 p-4 border border-emerald-100">
					<span class="text-[11px] font-semibold text-emerald-800">Чистий дохід (Net)</span>
					<div class="mt-1 text-lg font-black text-emerald-700">630.00 ₴</div>
				</div>
			</div>

			<!-- Breakdown of Today's Deliveries -->
			<div class="space-y-2 pt-2">
				<span class="text-xs font-bold text-stone-700">Виконані доставки за зміну:</span>
				<div class="space-y-1.5">
					{#each incomeList as inc}
						<div class="flex items-center justify-between p-2.5 rounded-xl bg-stone-50 text-xs">
							<div>
								<span class="font-bold text-stone-900">{inc.p}</span>
								<span class="text-stone-500 ml-2">{inc.d}</span>
							</div>
							<div class="text-right">
								<span class="font-bold text-stone-900">{inc.gross} ₴</span>
								<span class="text-rose-600 text-[11px] ml-1">(-{inc.tax} ₴)</span>
								<span class="text-emerald-600 font-bold ml-1">{inc.net} ₴</span>
							</div>
						</div>
					{/each}
				</div>
			</div>
		</div>

		<!-- Verified IBAN Requisites -->
		<div class="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm space-y-4">
			<div class="flex items-center justify-between">
				<h3 class="text-sm font-bold text-stone-900">Банківські реквізити</h3>
				<span class="rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
					Верифіковано
				</span>
			</div>

			<div class="rounded-xl border border-stone-200 bg-gradient-to-br from-stone-900 to-stone-800 p-4 text-white space-y-3">
				<div class="flex items-center justify-between text-xs text-stone-300">
					<span>{currentSeller.bankName || 'Монобанк'}</span>
					<CreditCard size={16} />
				</div>
				<div class="font-mono text-sm tracking-wider font-bold">
					{currentSeller.ibanFormatted || 'UA51 3220 0100 0002 6000 0001 2384'}
				</div>
				<div class="flex items-center justify-between text-[11px] text-stone-400">
					<span>Отримувач: {currentSeller.name}</span>
					<span>A2C Direct</span>
				</div>
			</div>

			<div class="text-xs text-stone-500 space-y-1">
				<p>• Виплати зараховуються автоматично щодня о 18:30.</p>
				<p>• Відсутня необхідність самостійно подавати квартальні звіти до податкової.</p>
			</div>
		</div>
	</div>

	<!-- History of Payouts -->
	<div class="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm space-y-4">
		<div class="flex items-center justify-between">
			<h3 class="text-sm font-bold text-stone-900">Історія виплат на рахунок</h3>
			<span class="text-xs text-stone-400">Всього: {payoutsList.length}</span>
		</div>

		<div class="overflow-x-auto">
			<table class="w-full text-left text-xs">
				<thead class="border-b border-stone-200 bg-stone-50/70 text-stone-500">
					<tr>
						<th class="p-3 font-bold">Номер виплати</th>
						<th class="p-3 font-bold">Канал</th>
						<th class="p-3 font-bold">Нараховано</th>
						<th class="p-3 font-bold">ПДФО 10%</th>
						<th class="p-3 font-bold">Отримано на картку</th>
						<th class="p-3 font-bold">Статус</th>
						<th class="p-3 font-bold text-right">Дата</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-stone-100 text-stone-700">
					{#each payoutsList as p}
						<tr class="hover:bg-stone-50/50">
							<td class="p-3 font-mono font-medium text-stone-900">{p.id}</td>
							<td class="p-3 font-mono text-stone-500">{p.rail}</td>
							<td class="p-3 font-semibold text-stone-900">{p.gross.toFixed(2)} ₴</td>
							<td class="p-3 font-bold text-rose-600">-{p.tax.toFixed(2)} ₴</td>
							<td class="p-3 font-bold text-emerald-600">{p.net.toFixed(2)} ₴</td>
							<td class="p-3">
								<span class="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 font-bold text-emerald-700 border border-emerald-200">
									<CheckCircle2 size={11} /> Зараховано
								</span>
							</td>
							<td class="p-3 text-right text-stone-400">{p.date}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>
</div>
