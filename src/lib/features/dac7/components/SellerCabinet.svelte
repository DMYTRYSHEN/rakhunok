<script lang="ts">
	import { onMount } from 'svelte';
	import {
		CircleCheck,
		TriangleAlert,
		Clock,
		Zap,
		ChevronRight,
		ArrowUpRight,
		Layers,
		FileText,
		ChartBarBig,
		User,
		Globe,
		Building2,
		Percent,
		ShieldCheck,
		Search,
		Download,
		X
	} from '@lucide/svelte';
	import type { Dac7Batch, Dac7IncomeTransaction, Dac7Payout, Dac7Seller } from '../types';
	import type { Dac7Gateway } from '../dac7-gateway';
	import { demoBatches, demoIncome, demoPayouts, demoSellers, fmt, PO_META, KYC_META } from '../mockData';

	let {
		gateway,
		demo = false,
		activeTab = 'home',
		onNavigate
	}: {
		gateway: Dac7Gateway;
		demo?: boolean;
		activeTab?: string;
		onNavigate?: (tab: string) => void;
	} = $props();

	let mode = $state<'daily' | 'instant'>('daily');
	let selectedBatch = $state<Dac7Batch | null>(null);

	// Compliance & banking state
	let isFop = $state(false);
	let isGoodsSeller = $state(false);
	let goodsSalesYtd = $state(1450);
	let annualEarningsYtd = $state(136800);

	let primaryIban = $state('UA51 …2384');
	let primaryBank = $state('Монобанк');

	// Payout rules state
	let payoutFrequency = $state('daily');
	let payoutThreshold = $state(0);

	let isRiskFlagged = $state(false);
	let isSigning = $state(false);

	let liveEarnedYtd = $state(0);
	let liveTaxYtd = $state(0);
	let liveBatches = $state<Dac7Batch[]>([]);
	let livePayouts = $state<Dac7Payout[]>([]);
	let liveIncome = $state<Dac7IncomeTransaction[]>([]);

	// Consents
	let platformConsents = $state<Record<string, boolean>>({
		bolt_food: true,
		uklon: true,
		glovo: false
	});

	function loadComplianceState() {
		if (typeof window === 'undefined') return;
		isRiskFlagged = localStorage.getItem('seller_risk_flag') === 'true';
		isFop = localStorage.getItem('seller_isFop') === 'true';
		isGoodsSeller = localStorage.getItem('seller_isGoodsSeller') === 'true';

		const valSales = localStorage.getItem('seller_goodsSalesYtd');
		goodsSalesYtd = valSales ? parseFloat(valSales) : 1450;

		const valEarn = localStorage.getItem('seller_annualEarningsYtd');
		annualEarningsYtd = valEarn ? parseFloat(valEarn) : 136800;

		const pIban = localStorage.getItem('seller_primaryIban');
		const pBank = localStorage.getItem('seller_primaryBank');
		if (pIban) {
			const cleanIban = pIban.replace(/\s/g, '');
			primaryIban = `${cleanIban.slice(0, 4)} …${cleanIban.slice(-4)}`;
		} else {
			primaryIban = 'UA51 …2384';
		}
		if (pBank) primaryBank = pBank;

		const pMode = (localStorage.getItem('seller_payoutMode') as 'daily' | 'instant') || 'daily';
		mode = pMode;

		payoutFrequency = localStorage.getItem('seller_payoutFrequency') || 'daily';
		const pThreshold = localStorage.getItem('seller_payoutThreshold');
		payoutThreshold = pThreshold ? parseInt(pThreshold) : 0;
	}

	async function loadLiveData() {
		if (demo) return;
		const [pList, bList] = await Promise.all([
			gateway.getPayouts(false),
			gateway.getBatches(false)
		]);
		livePayouts = pList;
		liveBatches = bList;
		liveEarnedYtd = pList.reduce((sum: number, p: Dac7Payout) => sum + p.gross, 0);
		liveTaxYtd = pList.reduce((sum: number, p: Dac7Payout) => sum + p.tax, 0);
	}

	onMount(() => {
		loadComplianceState();
		loadLiveData();
		window.addEventListener('storage', loadComplianceState);
		return () => window.removeEventListener('storage', loadComplianceState);
	});

	$effect(() => {
		if (!demo) {
			loadLiveData();
		}
	});

	function handleModeChange(newMode: 'daily' | 'instant') {
		mode = newMode;
		localStorage.setItem('seller_payoutMode', newMode);
		window.dispatchEvent(new Event('storage'));
	}

	function handleReverify() {
		isSigning = true;
		setTimeout(() => {
			isSigning = false;
			isRiskFlagged = false;
			localStorage.setItem('seller_risk_flag', 'false');
			alert(
				'Дія.Підпис підтверджено! Особу успішно верифіковано. Санкційні списки: збігів не знайдено. Рахунок розблоковано, виплати відновлено.'
			);
			window.dispatchEvent(new Event('storage'));
		}, 2500);
	}

	function getDynamicTax(gross: number) {
		if (isFop) return 0;
		if (isGoodsSeller && goodsSalesYtd < 2000) return 0;
		const isOverLimit = annualEarningsYtd >= 7211598;
		const rate = isOverLimit ? 0.23 : 0.1;
		return Math.round(gross * rate);
	}

	const grossToday = $derived(demo ? 557 : (liveBatches[0]?.gross || 0));
	const taxToday = $derived(getDynamicTax(grossToday));
	const netToday = $derived(grossToday - taxToday);

	const grossYtd = $derived(demo ? 136800 : liveEarnedYtd);
	const taxYtd = $derived(
		demo
			? isFop || (isGoodsSeller && goodsSalesYtd < 2000)
				? 0
				: Math.round(136800 * 0.1)
			: liveTaxYtd
	);
	const netYtd = $derived(grossYtd - taxYtd);

	const feedBatches = $derived(demo ? demoBatches : liveBatches);
	const todayBatch = $derived(feedBatches[0]);
	const dynTodayBatch = $derived(
		todayBatch
			? {
					...todayBatch,
					tax: getDynamicTax(todayBatch.gross),
					net: todayBatch.gross - getDynamicTax(todayBatch.gross)
				}
			: null
	);

	let scheduleText = $derived.by(() => {
		if (payoutFrequency === 'weekly') return "Виплата щоп'ятниці о 21:00";
		if (payoutFrequency === 'monthly') return 'Виплата 1-го числа місяця о 21:00';
		return 'Виплата сьогодні о 21:00';
	});

	const isThresholdMet = $derived(payoutThreshold === 0 || netYtd >= payoutThreshold);

	function navigateTo(tab: string) {
		if (onNavigate) onNavigate(tab);
	}

	function togglePlatformConsent(pKey: string) {
		platformConsents = {
			...platformConsents,
			[pKey]: !platformConsents[pKey]
		};
	}
</script>

{#if activeTab === 'home'}
	<div class="mx-auto max-w-2xl space-y-5">
		<!-- Re-signing overlay -->
		{#if isSigning}
			<div
				class="fixed inset-0 z-50 flex flex-col items-center justify-center bg-stone-900/60 backdrop-blur-md animate-fadeIn"
			>
				<div class="size-12 animate-spin rounded-full border-4 border-white/20 border-t-white"></div>
				<div class="mt-4 text-[15px] font-bold text-white">Зчитування Дія.Підпису...</div>
				<div class="mt-1.5 text-[12.5px] text-stone-300">
					Перевірка санкційних списків та реєстрів МВС
				</div>
			</div>
		{/if}

		<!-- AML Risk Flag Banner -->
		{#if isRiskFlagged}
			<div class="rounded-2xl border border-red-200 bg-red-50 p-5 space-y-3.5 shadow-sm">
				<div class="flex gap-3">
					<TriangleAlert class="size-5.5 text-red-600 shrink-0 mt-0.5" />
					<div>
						<div class="text-[14.5px] font-bold text-red-950">
							ФІНМОНІТОРИНГ: Акаунт та виплати заблоковано
						</div>
						<p class="mt-1 text-[13px] text-red-800 leading-relaxed">
							Risk Engine зафіксував використання вашого основного банківського рахунку іншим
							користувачем платформи. З міркувань безпеки виплати призупинено.
						</p>
					</div>
				</div>
				<div class="flex gap-2">
					<button
						type="button"
						onclick={handleReverify}
						class="h-9 px-4.5 rounded-full bg-red-600 hover:bg-red-700 text-white font-semibold text-[13px] transition cursor-pointer"
					>
						Пройти повторну верифікацію Дія.Підпис
					</button>
				</div>
			</div>
		{/if}

		<!-- Glass Hero Card (Matches Screenshot 1 media_1789073424815.png) -->
		<div class="rounded-2xl border border-white/70 bg-white/60 p-7 shadow-sm backdrop-blur-xl">
			<div class="flex flex-wrap items-start justify-between gap-4">
				<div>
					<div class="text-[11px] font-medium uppercase tracking-[0.16em] text-stone-400">
						Нараховано сьогодні
					</div>
					<div
						class="mt-2 text-[42px] font-semibold leading-none tracking-tight tabular-nums text-stone-900"
					>
						{fmt(netToday)} <span class="text-[24px] text-stone-400">₴</span>
					</div>
					<div class="mt-2.5 text-[13.5px] text-stone-500">
						2 нарахування · брутто {fmt(grossToday)} ₴ · податок {taxToday > 0
							? `${fmt(taxToday)} ₴`
							: '0 ₴'} вже утримано
					</div>
				</div>
				<div class="text-right">
					<div class="text-[11px] font-medium uppercase tracking-[0.16em] text-stone-400">
						Баланс гаманця
					</div>
					<div
						class="mt-2 text-[26px] font-semibold tabular-nums tracking-tight text-stone-900"
					>
						{fmt(netYtd)} ₴
					</div>
					<div class="mt-1.5 text-[12.5px] text-stone-500">за минулі дні · виплачено</div>
				</div>
			</div>

			<!-- Payout Mode Quick Selector -->
			<div class="mt-6 rounded-2xl border border-stone-200/70 p-1.5 bg-white/50">
				<div class="grid grid-cols-2 gap-1.5">
					<button
						type="button"
						onclick={() => handleModeChange('daily')}
						class="rounded-xl p-3.5 text-left transition cursor-pointer {mode === 'daily'
							? 'bg-stone-900 text-white shadow-md'
							: 'hover:bg-white/80'}"
					>
						<div class="flex items-center gap-2 text-[14px] font-medium">
							{#if mode === 'daily'}
								<CircleCheck class="size-4 text-emerald-400" />
							{/if}
							Регламент виплат
						</div>
						<div
							class="mt-1 text-[12px] {mode === 'daily' ? 'text-stone-300' : 'text-stone-500'}"
						>
							за графіком · без комісії
						</div>
					</button>

					<button
						type="button"
						onclick={() => handleModeChange('instant')}
						class="rounded-xl p-3.5 text-left transition cursor-pointer {mode === 'instant'
							? 'bg-stone-900 text-white shadow-md'
							: 'hover:bg-white/80'}"
					>
						<div class="flex items-center gap-2 text-[14px] font-medium">
							{#if mode === 'instant'}
								<CircleCheck class="size-4 text-emerald-400" />
							{/if}
							Миттєво
						</div>
						<div
							class="mt-1 text-[12px] {mode === 'instant' ? 'text-stone-300' : 'text-stone-500'}"
						>
							кожне нарахування одразу · 3 ₴/переказ
						</div>
					</button>
				</div>
			</div>

			{#if mode === 'daily'}
				{#if dynTodayBatch}
					<div class="mt-4 space-y-3">
						<button
							type="button"
							onclick={() => (selectedBatch = dynTodayBatch)}
							class="flex w-full items-center justify-between rounded-xl border border-sky-200 bg-sky-50 px-5 py-4 text-left transition hover:border-sky-300 cursor-pointer"
						>
							<div class="flex items-center gap-3.5 flex-1 min-w-0">
								<Clock class="size-5 text-sky-600 shrink-0" />
								<div class="min-w-0">
									<div class="text-[14px] font-semibold text-sky-900 truncate">
										{scheduleText} · один переказ на {primaryBank} ({primaryIban})
									</div>
									<div class="mt-0.5 text-[12px] text-sky-700/70">
										{payoutThreshold > 0
											? `Поріг виплати: не менше ${payoutThreshold.toLocaleString('uk-UA')} ₴`
											: "Усі нарахування за період будуть об'єднані в один батч"}
									</div>
								</div>
							</div>
							<ChevronRight class="size-4 text-sky-400 shrink-0" />
						</button>

						<!-- Threshold warning if configured -->
						{#if payoutThreshold > 0}
							<div
								class="flex items-start gap-2.5 rounded-xl border p-3.5 text-[12.5px] leading-snug {isThresholdMet
									? 'bg-emerald-50 border-emerald-100 text-emerald-800'
									: 'bg-amber-50 border-amber-100 text-amber-800'}"
							>
								{#if isThresholdMet}
									<CircleCheck class="size-4 text-emerald-500 shrink-0 mt-0.5" />
									<span>
										Поріг у {payoutThreshold.toLocaleString('uk-UA')} ₴ досягнуто. Баланс {fmt(
											netYtd
										)} ₴ буде виплачено за розкладом.
									</span>
								{:else}
									<TriangleAlert class="size-4 text-amber-500 shrink-0 mt-0.5" />
									<span>
										Виплату призупинено. Баланс ({fmt(netYtd)} ₴) менше встановленого порогу в {payoutThreshold.toLocaleString(
											'uk-UA'
										)} ₴. Кошти накопичуються.
									</span>
								{/if}
							</div>
						{/if}
					</div>
				{/if}
			{:else}
				<div
					class="mt-4 flex items-center gap-3 rounded-xl border border-stone-200 bg-white px-5 py-4 text-[13px] text-stone-600 shadow-sm"
				>
					<Zap class="size-5 text-stone-400 shrink-0" />
					<span class="truncate">
						Кожне нове нарахування вилітатиме на {primaryBank} ({primaryIban}) миттєво. Сьогоднішні {fmt(
							netToday
						)} ₴ буде відправлено зараз.
					</span>
				</div>
			{/if}
		</div>

		<!-- 3 Stat Cards below -->
		<div class="grid gap-4 sm:grid-cols-3">
			<!-- Income -->
			<button
				type="button"
				onclick={() => navigateTo('income')}
				class="rounded-2xl border border-stone-200/70 bg-white p-5 text-left shadow-[0_1px_2px_rgba(0,0,0,0.03)] cursor-pointer transition hover:border-stone-300 hover:shadow-md"
			>
				<div class="flex items-center justify-between">
					<div class="text-[11px] font-medium uppercase tracking-[0.16em] text-stone-400">
						Доходи · червень
					</div>
					<ArrowUpRight class="size-4 text-stone-300" />
				</div>
				<div class="mt-2 text-[22px] font-semibold tabular-nums tracking-tight text-stone-900">
					25 050 ₴
				</div>
				<div class="mt-1 text-[12px] text-stone-500">4 платформи</div>
			</button>

			<!-- Taxes -->
			<button
				type="button"
				onclick={() => navigateTo('taxes')}
				class="rounded-2xl border border-stone-200/70 bg-white p-5 text-left shadow-[0_1px_2px_rgba(0,0,0,0.03)] cursor-pointer transition hover:border-stone-300 hover:shadow-md"
			>
				<div class="flex items-center justify-between">
					<div class="text-[11px] font-medium uppercase tracking-[0.16em] text-stone-400">
						Податки · рік
					</div>
					<ArrowUpRight class="size-4 text-stone-300" />
				</div>
				<div class="mt-2 text-[22px] font-semibold tabular-nums tracking-tight text-stone-900">
					{fmt(taxYtd)} ₴
				</div>
				<div class="mt-1 text-[12px] text-stone-500">сплачено автоматично</div>
			</button>

			<!-- Compliance -->
			<button
				type="button"
				onclick={() => navigateTo('profile')}
				class="rounded-2xl border border-stone-200/70 bg-white p-5 text-left shadow-[0_1px_2px_rgba(0,0,0,0.03)] cursor-pointer transition hover:border-stone-300 hover:shadow-md"
			>
				<div class="flex items-center justify-between">
					<div class="text-[11px] font-medium uppercase tracking-[0.16em] text-stone-400">
						Compliance
					</div>
					<ArrowUpRight class="size-4 text-stone-300" />
				</div>
				<div class="mt-2 text-[22px] font-semibold tabular-nums tracking-tight text-stone-900">
					98
				</div>
				<div class="mt-1 text-[12px] text-stone-500">Tier-2 · Дія</div>
			</button>
		</div>

		<!-- Card "Останні виплати" -->
		<div
			class="rounded-2xl border border-stone-200/70 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)] overflow-hidden"
		>
			<div class="flex items-center justify-between border-b border-stone-100 px-6 py-4">
				<span class="text-[15px] font-semibold text-stone-900">Останні виплати</span>
				<button
					type="button"
					onclick={() => navigateTo('payouts')}
					class="text-[13px] font-medium text-stone-500 hover:text-stone-900 cursor-pointer transition"
				>
					Усі →
				</button>
			</div>

			<div class="divide-y divide-stone-50">
				{#each feedBatches.slice(0, 3) as b}
					{@const itemTax = getDynamicTax(b.gross)}
					{@const itemNet = b.gross - itemTax}
					<button
						type="button"
						onclick={() => (selectedBatch = { ...b, tax: itemTax, net: itemNet })}
						class="flex w-full items-center justify-between px-6 py-3.5 text-left transition hover:bg-stone-50 cursor-pointer"
					>
						<div>
							<div class="text-[13.5px] font-medium text-stone-900">
								Батч {b.date} <span class="font-normal text-stone-400">· {b.txs} нарах.</span>
							</div>
							<div class="font-mono text-[12px] text-stone-400">{b.eta}</div>
						</div>
						<div class="flex items-center gap-3">
							<span class="tabular-nums text-[14px] font-semibold text-emerald-600">
								+{fmt(itemNet)} ₴
							</span>
							<span
								class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11.5px] font-medium {PO_META[
									b.st
								]?.t === 'ok'
									? 'bg-emerald-50 text-emerald-700 border border-emerald-100/50'
									: 'bg-sky-50 text-sky-700 border border-sky-100/50'}"
							>
								{PO_META[b.st]?.l || b.st}
							</span>
						</div>
					</button>
				{/each}
			</div>
		</div>
	</div>
{:else if activeTab === 'payouts'}
	<!-- Sub-tab: Payouts -->
	<div class="space-y-6 max-w-4xl mx-auto">
		<div class="flex items-center justify-between">
			<h2 class="text-[18px] font-bold text-stone-900">Виплати та батчі</h2>
			<span class="text-xs text-stone-500 font-mono">IBAN: {primaryIban}</span>
		</div>

		<div class="grid gap-4 sm:grid-cols-3">
			<div class="rounded-2xl border border-stone-200/70 bg-white p-5 shadow-sm">
				<div class="text-[11px] font-medium uppercase tracking-[0.16em] text-stone-400">
					Зароблено YTD
				</div>
				<div class="mt-2 text-[26px] font-semibold tabular-nums text-stone-900">
					{fmt(grossYtd)} ₴
				</div>
			</div>
			<div class="rounded-2xl border border-stone-200/70 bg-white p-5 shadow-sm">
				<div class="text-[11px] font-medium uppercase tracking-[0.16em] text-stone-400">
					Виплачено на картку
				</div>
				<div class="mt-2 text-[26px] font-semibold tabular-nums text-emerald-600">
					{fmt(netYtd)} ₴
				</div>
			</div>
			<div class="rounded-2xl border border-stone-200/70 bg-white p-5 shadow-sm">
				<div class="text-[11px] font-medium uppercase tracking-[0.16em] text-stone-400">
					Утримано ПДФО (10%)
				</div>
				<div class="mt-2 text-[26px] font-semibold tabular-nums text-stone-900">
					{fmt(taxYtd)} ₴
				</div>
			</div>
		</div>

		<div class="rounded-2xl border border-stone-200/70 bg-white shadow-sm overflow-hidden">
			<div class="px-6 py-4 border-b border-stone-100 font-semibold text-stone-900">
				Історія батчів та транзакцій
			</div>
			<div class="divide-y divide-stone-100">
				{#each feedBatches as b}
					{@const itemTax = getDynamicTax(b.gross)}
					{@const itemNet = b.gross - itemTax}
					<div class="flex items-center justify-between p-4 px-6 hover:bg-stone-50/70 transition">
						<div>
							<div class="text-sm font-semibold text-stone-900">
								Батч {b.date} ({b.id})
							</div>
							<div class="text-xs text-stone-500 font-mono">
								{b.eta} · {b.txs} нарахування · СЕП A2A
							</div>
						</div>
						<div class="flex items-center gap-3">
							<span class="text-sm font-bold text-emerald-600">+{fmt(itemNet)} ₴</span>
							<span
								class="rounded-full px-2.5 py-0.5 text-xs font-semibold {b.st === 'paid'
									? 'bg-emerald-50 text-emerald-700'
									: 'bg-sky-50 text-sky-700'}"
							>
								{PO_META[b.st]?.l || b.st}
							</span>
						</div>
					</div>
				{/each}
			</div>
		</div>
	</div>
{:else if activeTab === 'income'}
	<!-- Sub-tab: Income -->
	<div class="space-y-6 max-w-4xl mx-auto">
		<h2 class="text-[18px] font-bold text-stone-900">Нарахування за замовленнями</h2>

		<div class="rounded-2xl border border-stone-200/70 bg-white p-6 shadow-sm">
			<div class="text-sm font-semibold text-stone-900 mb-4">
				Поточні замовлення в роботі (Bolt Food)
			</div>
			<div class="space-y-3">
				{#each demoIncome as inc}
					<div
						class="flex items-center justify-between rounded-xl border border-stone-100 p-3.5 hover:bg-stone-50/80 transition"
					>
						<div>
							<div class="text-sm font-semibold text-stone-900">{inc.p}</div>
							<div class="text-xs text-stone-500">{inc.d} · {inc.date} {inc.time}</div>
						</div>
						<div class="text-right">
							<div class="text-sm font-bold text-emerald-600">+{fmt(inc.net)} ₴</div>
							<div class="text-[11px] text-stone-400">под. {fmt(inc.tax)} ₴</div>
						</div>
					</div>
				{/each}
			</div>
		</div>
	</div>
{:else if activeTab === 'taxes'}
	<!-- Sub-tab: Taxes -->
	<div class="space-y-6 max-w-4xl mx-auto">
		<h2 class="text-[18px] font-bold text-stone-900">Податковий звіт (Закон № 4903-IX)</h2>

		<div class="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-6">
			<div class="flex items-center gap-3 mb-2">
				<ShieldCheck class="size-5 text-emerald-700" />
				<h3 class="font-bold text-emerald-950 text-base">Податковий агент: Bolt Food Ukraine</h3>
			</div>
			<p class="text-xs text-emerald-800 leading-relaxed">
				Всі податкові зобов'язання (10% ПДФО) розраховуються та автоматично утримуються платформою в
				момент формування щоденного батчу. Подавати декларацію не потрібно.
			</p>
		</div>

		<div class="grid gap-4 sm:grid-cols-2">
			<div class="rounded-2xl border border-stone-200/70 bg-white p-6 shadow-sm">
				<div class="text-[11px] font-medium uppercase tracking-[0.16em] text-stone-400">
					Сплачено податків YTD
				</div>
				<div class="mt-2 text-[32px] font-bold tabular-nums text-stone-900">{fmt(taxYtd)} ₴</div>
				<p class="mt-2 text-xs text-stone-500">10% ставка ПДФО для платформної зайнятості</p>
			</div>

			<div class="rounded-2xl border border-stone-200/70 bg-white p-6 shadow-sm">
				<div class="text-[11px] font-medium uppercase tracking-[0.16em] text-stone-400">
					Ліміт доходів (834 МЗП)
				</div>
				<div class="mt-2 text-[32px] font-bold tabular-nums text-stone-900">7 211 598 ₴</div>
				<p class="mt-2 text-xs text-stone-500">Використано {Math.round((grossYtd / 7211598) * 100)}% річного порогу</p>
			</div>
		</div>
	</div>
{:else if activeTab === 'docs'}
	<!-- Sub-tab: Docs -->
	<div class="space-y-6 max-w-4xl mx-auto">
		<h2 class="text-[18px] font-bold text-stone-900">Документи та довідки</h2>

		<div class="rounded-2xl border border-stone-200/70 bg-white p-6 shadow-sm space-y-4">
			<div class="flex items-center justify-between border-b border-stone-100 pb-4">
				<div>
					<div class="text-sm font-semibold text-stone-900">Довідка про доходи за Q2 2026</div>
					<div class="text-xs text-stone-500 font-mono">Сформовано автоматично · Дія.Підпис</div>
				</div>
				<button
					type="button"
					onclick={() => alert('Завантаження офіційної довідки про доходи з КЕП...')}
					class="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-2 text-xs font-bold text-stone-800 hover:bg-stone-100 transition"
				>
					<Download class="size-4" /> PDF
				</button>
			</div>

			<div class="flex items-center justify-between">
				<div>
					<div class="text-sm font-semibold text-stone-900">Повідомлення про відкриття спецрахунку</div>
					<div class="text-xs text-stone-500 font-mono">ДПС України · підтверджено 15.03.2025</div>
				</div>
				<button
					type="button"
					onclick={() => alert('Завантаження квитанції ДПС №2...')}
					class="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-2 text-xs font-bold text-stone-800 hover:bg-stone-100 transition"
				>
					<Download class="size-4" /> PDF
				</button>
			</div>
		</div>
	</div>
{:else if activeTab === 'platforms'}
	<!-- Sub-tab: Platforms -->
	<div class="space-y-6 max-w-4xl mx-auto">
		<h2 class="text-[18px] font-bold text-stone-900">Підключені платформи</h2>

		<div class="grid gap-4 sm:grid-cols-3">
			<div class="rounded-2xl border border-stone-200/70 bg-white p-5 shadow-sm space-y-3">
				<div class="flex items-center justify-between">
					<div class="font-bold text-stone-900 text-sm">Bolt Food</div>
					<span class="size-2 rounded-full bg-emerald-500"></span>
				</div>
				<p class="text-xs text-stone-500">Автоматичний податковий агент</p>
				<button
					type="button"
					onclick={() => togglePlatformConsent('bolt_food')}
					class="w-full rounded-xl py-1.5 text-xs font-semibold transition {platformConsents.bolt_food
						? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
						: 'bg-stone-100 text-stone-600'}"
				>
					{platformConsents.bolt_food ? 'Згода надана' : 'Згоду відкликано'}
				</button>
			</div>

			<div class="rounded-2xl border border-stone-200/70 bg-white p-5 shadow-sm space-y-3">
				<div class="flex items-center justify-between">
					<div class="font-bold text-stone-900 text-sm">Uklon</div>
					<span class="size-2 rounded-full bg-emerald-500"></span>
				</div>
				<p class="text-xs text-stone-500">Спільний розрахунковий баланс</p>
				<button
					type="button"
					onclick={() => togglePlatformConsent('uklon')}
					class="w-full rounded-xl py-1.5 text-xs font-semibold transition {platformConsents.uklon
						? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
						: 'bg-stone-100 text-stone-600'}"
				>
					{platformConsents.uklon ? 'Згода надана' : 'Згоду відкликано'}
				</button>
			</div>

			<div class="rounded-2xl border border-stone-200/70 bg-white p-5 shadow-sm space-y-3">
				<div class="flex items-center justify-between">
					<div class="font-bold text-stone-900 text-sm">Glovo</div>
					<span class="size-2 rounded-full bg-stone-300"></span>
				</div>
				<p class="text-xs text-stone-500">Очікує повторного підтвердження</p>
				<button
					type="button"
					onclick={() => togglePlatformConsent('glovo')}
					class="w-full rounded-xl py-1.5 text-xs font-semibold transition {platformConsents.glovo
						? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
						: 'bg-stone-100 text-stone-600'}"
				>
					{platformConsents.glovo ? 'Згода надана' : 'Підключити'}
				</button>
			</div>
		</div>
	</div>
{:else if activeTab === 'profile'}
	<!-- Sub-tab: Profile -->
	<div class="space-y-6 max-w-4xl mx-auto">
		<h2 class="text-[18px] font-bold text-stone-900">Фінансовий паспорт кур'єра</h2>

		<div class="rounded-2xl border border-stone-200/70 bg-white p-6 shadow-sm space-y-4">
			<div class="flex items-center justify-between border-b border-stone-100 pb-3">
				<span class="text-xs text-stone-500">ПІБ</span>
				<span class="text-sm font-semibold text-stone-900">Олексій Ткаченко</span>
			</div>
			<div class="flex items-center justify-between border-b border-stone-100 pb-3">
				<span class="text-xs text-stone-500">РНОКПП (ІПН)</span>
				<span class="text-sm font-mono font-semibold text-stone-900">3091248192</span>
			</div>
			<div class="flex items-center justify-between border-b border-stone-100 pb-3">
				<span class="text-xs text-stone-500">IBAN рахунку</span>
				<span class="text-sm font-mono font-semibold text-stone-900">{primaryIban}</span>
			</div>
			<div class="flex items-center justify-between border-b border-stone-100 pb-3">
				<span class="text-xs text-stone-500">Банк зарахування</span>
				<span class="text-sm font-semibold text-stone-900">{primaryBank}</span>
			</div>
			<div class="flex items-center justify-between border-b border-stone-100 pb-3">
				<span class="text-xs text-stone-500">Верифікація</span>
				<span
					class="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700"
				>
					<CircleCheck class="size-3.5" /> Tier-2 · Дія.Підпис
				</span>
			</div>
			<div class="flex items-center justify-between">
				<span class="text-xs text-stone-500">Compliance Score</span>
				<span class="text-sm font-bold text-emerald-600">98 / 100</span>
			</div>
		</div>
	</div>
{/if}

<!-- Batch Details Drawer (Matching BatchDrawer.tsx from D:\SELF\src) -->
{#if selectedBatch}
	<div class="fixed inset-0 z-50">
		<!-- Backdrop -->
		<button
			type="button"
			aria-label="Закрити"
			class="absolute inset-0 bg-stone-950/30 backdrop-blur-[2px] border-none p-0 cursor-default"
			onclick={() => (selectedBatch = null)}
		></button>

		<!-- Slide-over panel -->
		<div
			class="absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-white shadow-2xl transition-transform duration-300 ease-out"
		>
			<div class="flex items-center justify-between border-b border-stone-100 px-6 py-4">
				<span class="text-[15px] font-semibold text-stone-900">
					Денний батч · {selectedBatch.date}
				</span>
				<div class="flex items-center gap-2">
					<kbd
						class="hidden rounded-md border border-stone-200 bg-stone-50 px-1.5 py-0.5 text-[10.5px] text-stone-400 sm:block"
					>
						esc
					</kbd>
					<button
						type="button"
						onclick={() => (selectedBatch = null)}
						class="rounded-full p-1.5 text-stone-400 transition hover:bg-stone-100 hover:text-stone-900 cursor-pointer"
					>
						<X class="size-4" />
					</button>
				</div>
			</div>

			<div class="flex-1 overflow-y-auto p-6">
				<div class="text-center">
					<div
						class="text-[34px] font-semibold tracking-tight tabular-nums text-stone-900"
					>
						{fmt(selectedBatch.net)} ₴
					</div>
					<div class="mt-1 text-[13px] text-stone-500">
						{selectedBatch.txs} нарахування за зміну
					</div>
					<div class="mt-3">
						<span
							class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11.5px] font-medium {PO_META[
								selectedBatch.st
							]?.t === 'ok'
								? 'bg-emerald-50 text-emerald-700 border border-emerald-100/50'
								: 'bg-sky-50 text-sky-700 border border-sky-100/50'}"
						>
							<span
								class="size-1.5 rounded-full {PO_META[selectedBatch.st]?.t === 'ok'
									? 'bg-emerald-500'
									: 'bg-sky-500'}"
							></span>
							{PO_META[selectedBatch.st]?.l || selectedBatch.st}
						</span>
					</div>
				</div>

				<div class="mt-6 divide-y divide-stone-100 border-t border-b border-stone-100">
					<div class="flex items-center justify-between py-2.5">
						<span class="text-[13px] text-stone-500">ID батчу</span>
						<span class="font-mono text-[12.5px] text-stone-900">{selectedBatch.id}</span>
					</div>
					<div class="flex items-center justify-between py-2.5">
						<span class="text-[13px] text-stone-500">ID кур'єра</span>
						<span class="font-mono text-[12.5px] text-stone-900">{selectedBatch.sid}</span>
					</div>
					<div class="flex items-center justify-between py-2.5">
						<span class="text-[13px] text-stone-500">Сума брутто</span>
						<span class="text-[13.5px] font-medium text-stone-900">
							{fmt(selectedBatch.gross)} ₴
						</span>
					</div>
					<div class="flex items-center justify-between py-2.5">
						<span class="text-[13px] text-stone-500">Утримано ПДФО</span>
						<span class="text-[13.5px] font-medium text-stone-900">
							{selectedBatch.tax > 0
								? `−${fmt(selectedBatch.tax)} ₴ · утримано платформою (10% ПДФО)`
								: '0 ₴'}
						</span>
					</div>
					<div class="flex items-center justify-between py-2.5">
						<span class="text-[13px] text-stone-500">До виплати (нетто)</span>
						<span class="text-[13.5px] font-semibold text-emerald-600">
							{fmt(selectedBatch.net)} ₴
						</span>
					</div>
					<div class="flex items-center justify-between py-2.5">
						<span class="text-[13px] text-stone-500">
							{selectedBatch.st === 'scheduled' ? 'Вікно виплати' : 'Виплачено о'}
						</span>
						<span class="text-[13.5px] font-medium text-stone-900">{selectedBatch.eta}</span>
					</div>
					<div class="flex items-center justify-between py-2.5">
						<span class="text-[13px] text-stone-500">Платіжна рейка</span>
						<span class="text-[13.5px] font-medium text-stone-900">СЕП · A2A</span>
					</div>
				</div>

				<div
					class="mt-4 flex items-start gap-2.5 rounded-xl border border-sky-200 bg-sky-50 p-4 text-[13px] leading-snug text-sky-800"
				>
					<Layers class="mt-0.5 size-4 shrink-0" />
					<span>
						Усі нарахування за добу об'єднуються в один фінальний переказ для уникнення банківських
						комісій та спрощення податкового обліку.
					</span>
				</div>

				<!-- Accruals breakdown -->
				<div class="mt-6">
					<div class="mb-3 text-[14.5px] font-semibold text-stone-900">
						Нарахування в цьому батчі
					</div>
					<div class="space-y-2">
						{#each demoIncome.filter((tx) => tx.batch === selectedBatch?.id) as tx}
							<div
								class="flex items-center justify-between rounded-xl border border-stone-100 px-4 py-3"
							>
								<div>
									<div class="text-[13.5px] font-medium text-stone-900">{tx.p}</div>
									<div class="font-mono text-[11.5px] text-stone-400">
										{tx.id} · {tx.date} · {tx.time}
									</div>
								</div>
								<div class="text-right">
									<div class="tabular-nums text-[13.5px] font-semibold text-emerald-600">
										+{fmt(tx.net)} ₴
									</div>
									{#if tx.tax > 0}
										<div class="text-[11px] text-stone-400">под. {fmt(tx.tax)} ₴</div>
									{/if}
								</div>
							</div>
						{/each}
					</div>
				</div>
			</div>
		</div>
	</div>
{/if}
