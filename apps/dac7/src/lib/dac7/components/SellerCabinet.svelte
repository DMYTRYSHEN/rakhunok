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
	import IncomeDrawer from './drawers/IncomeDrawer.svelte';
	import BankSelector from './BankSelector.svelte';
	import Dac7Pagination from './Dac7Pagination.svelte';
	import type {
		Dac7Batch,
		Dac7IncomeTransaction,
		Dac7Payout,
		Dac7Seller,
		SellerCategory
	} from '../types';
	import type { Dac7Gateway } from '../dac7-gateway';
	import {
		demoBatches,
		demoIncome,
		demoPayouts,
		demoSellers,
		fmt,
		PO_META,
		KYC_META,
		CATEGORY_META
	} from '../mockData';

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
	let selectedIncomeTx = $state<Dac7IncomeTransaction | null>(null);

	// Compliance & banking state
	let sellerCategory = $state<SellerCategory>('platform_gig');
	let isFop = $state(false);
	let isGoodsSeller = $state(false);
	let goodsSalesYtd = $state(1450);
	let annualEarningsYtd = $state(136800);

	let primaryIban = $state('UA51 …2384');
	let primaryBank = $state('Монобанк');

	// Payout rules state
	let payoutFrequency = $state('daily');
	let payoutThreshold = $state(0);
	let showAddIban = $state(false);

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

		const savedCat = localStorage.getItem('seller_category') as SellerCategory;
		if (savedCat) {
			sellerCategory = savedCat;
		} else if (isFop) {
			sellerCategory = 'fop';
		} else if (isGoodsSeller) {
			sellerCategory = 'goods_casual';
		} else {
			sellerCategory = 'platform_gig';
		}

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

	function handleCategoryChange(newCat: SellerCategory) {
		sellerCategory = newCat;
		localStorage.setItem('seller_category', newCat);
		localStorage.setItem('seller_isFop', (newCat === 'fop').toString());
		localStorage.setItem('seller_isGoodsSeller', (newCat === 'goods_casual').toString());
		isFop = newCat === 'fop';
		isGoodsSeller = newCat === 'goods_casual';
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
		if (sellerCategory === 'fop') return 0;
		if (sellerCategory === 'goods_casual' && goodsSalesYtd < 2000) return 0;
		if (sellerCategory === 'corporate_entity' || sellerCategory === 'excluded_seller') return 0;
		const isOverLimit = annualEarningsYtd >= 7211598;
		const rate = isOverLimit ? 0.18 : 0.1; // Strictly 10% PIT up to 834 MW, 18% PIT on excess, 0% military fee
		return Math.round(gross * rate);
	}

	const grossToday = $derived(demo ? 557 : liveBatches[0]?.gross || 0);
	const taxToday = $derived(getDynamicTax(grossToday));
	const netToday = $derived(grossToday - taxToday);

	const grossYtd = $derived(demo ? 136800 : liveEarnedYtd);
	const taxYtd = $derived(
		demo
			? sellerCategory === 'fop' ||
				(sellerCategory === 'goods_casual' && goodsSalesYtd < 2000) ||
				sellerCategory === 'corporate_entity' ||
				sellerCategory === 'excluded_seller'
				? 0
				: Math.round(136800 * (annualEarningsYtd >= 7211598 ? 0.18 : 0.1))
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

	// Income tab filtering and pagination
	let incomeSearch = $state('');
	let incomeStatus = $state('all');
	let incomePage = $state(1);
	let incomePageSize = $state(5);

	const feedIncome = $derived(demo ? demoIncome : liveIncome.length ? liveIncome : demoIncome);

	const filteredIncome = $derived(
		feedIncome.filter((inc) => {
			const matchesQ =
				incomeSearch === '' ||
				inc.p.toLowerCase().includes(incomeSearch.toLowerCase()) ||
				inc.d.toLowerCase().includes(incomeSearch.toLowerCase()) ||
				(inc.orderId && inc.orderId.toLowerCase().includes(incomeSearch.toLowerCase()));
			if (!matchesQ) return false;
			if (incomeStatus !== 'all' && inc.deliveryStatus !== incomeStatus) return false;
			return true;
		})
	);

	const paginatedIncome = $derived(
		filteredIncome.slice((incomePage - 1) * incomePageSize, incomePage * incomePageSize)
	);

	// Payouts tab filtering and pagination
	let payoutSearch = $state('');
	let payoutStatus = $state('all');
	let payoutPage = $state(1);
	let payoutPageSize = $state(5);

	const filteredBatches = $derived(
		feedBatches.filter((b) => {
			const matchesQ =
				payoutSearch === '' ||
				b.id.toLowerCase().includes(payoutSearch.toLowerCase()) ||
				b.date.toLowerCase().includes(payoutSearch.toLowerCase());
			if (!matchesQ) return false;
			if (payoutStatus !== 'all' && b.st !== payoutStatus) return false;
			return true;
		})
	);

	const paginatedBatches = $derived(
		filteredBatches.slice((payoutPage - 1) * payoutPageSize, payoutPage * payoutPageSize)
	);
</script>

{#if activeTab === 'home'}
	<div class="mx-auto max-w-2xl space-y-5">
		<!-- Re-signing overlay -->
		{#if isSigning}
			<div
				class="animate-fadeIn fixed inset-0 z-50 flex flex-col items-center justify-center bg-stone-900/60 backdrop-blur-md"
			>
				<div
					class="size-12 animate-spin rounded-full border-4 border-white/20 border-t-white"
				></div>
				<div class="mt-4 text-[15px] font-bold text-white">Зчитування Дія.Підпису...</div>
				<div class="mt-1.5 text-[12.5px] text-stone-300">
					Перевірка санкційних списків та реєстрів МВС
				</div>
			</div>
		{/if}

		<!-- AML Risk Flag Banner -->
		{#if isRiskFlagged}
			<div class="space-y-3.5 rounded-2xl border border-red-200 bg-red-50 p-5 shadow-sm">
				<div class="flex gap-3">
					<TriangleAlert class="mt-0.5 size-5.5 shrink-0 text-red-600" />
					<div>
						<div class="text-[14.5px] font-bold text-red-950">
							ФІНМОНІТОРИНГ: Акаунт та виплати заблоковано
						</div>
						<p class="mt-1 text-[13px] leading-relaxed text-red-800">
							Risk Engine зафіксував використання вашого основного банківського рахунку іншим
							користувачем платформи. З міркувань безпеки виплати призупинено.
						</p>
					</div>
				</div>
				<div class="flex gap-2">
					<button
						type="button"
						onclick={handleReverify}
						class="h-9 cursor-pointer rounded-full bg-red-600 px-4.5 text-[13px] font-semibold text-white transition hover:bg-red-700"
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
					<div class="text-[11px] font-medium tracking-[0.16em] text-stone-400 uppercase">
						Нараховано сьогодні
					</div>
					<div
						class="mt-2 text-[42px] leading-none font-semibold tracking-tight text-stone-900 tabular-nums"
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
					<div class="text-[11px] font-medium tracking-[0.16em] text-stone-400 uppercase">
						Баланс гаманця
					</div>
					<div class="mt-2 text-[26px] font-semibold tracking-tight text-stone-900 tabular-nums">
						{fmt(netYtd)} ₴
					</div>
					<div class="mt-1.5 text-[12.5px] text-stone-500">за минулі дні · виплачено</div>
				</div>
			</div>

			<!-- Payout Mode Quick Selector -->
			<div class="mt-6 rounded-2xl border border-stone-200/70 bg-white/50 p-1.5">
				<div class="grid grid-cols-2 gap-1.5">
					<button
						type="button"
						onclick={() => handleModeChange('daily')}
						class="cursor-pointer rounded-xl p-3.5 text-left transition {mode === 'daily'
							? 'bg-stone-900 text-white shadow-md'
							: 'hover:bg-white/80'}"
					>
						<div class="flex items-center gap-2 text-[14px] font-medium">
							{#if mode === 'daily'}
								<CircleCheck class="size-4 text-emerald-400" />
							{/if}
							Регламент виплат
						</div>
						<div class="mt-1 text-[12px] {mode === 'daily' ? 'text-stone-300' : 'text-stone-500'}">
							за графіком · без комісії
						</div>
					</button>

					<button
						type="button"
						onclick={() => handleModeChange('instant')}
						class="cursor-pointer rounded-xl p-3.5 text-left transition {mode === 'instant'
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
							class="flex w-full cursor-pointer items-center justify-between rounded-xl border border-sky-200 bg-sky-50 px-5 py-4 text-left transition hover:border-sky-300"
						>
							<div class="flex min-w-0 flex-1 items-center gap-3.5">
								<Clock class="size-5 shrink-0 text-sky-600" />
								<div class="min-w-0">
									<div class="truncate text-[14px] font-semibold text-sky-900">
										{scheduleText} · один переказ на {primaryBank} ({primaryIban})
									</div>
									<div class="mt-0.5 text-[12px] text-sky-700/70">
										{payoutThreshold > 0
											? `Поріг виплати: не менше ${payoutThreshold.toLocaleString('uk-UA')} ₴`
											: "Усі нарахування за період будуть об'єднані в один батч"}
									</div>
								</div>
							</div>
							<ChevronRight class="size-4 shrink-0 text-sky-400" />
						</button>

						<!-- Threshold warning if configured -->
						{#if payoutThreshold > 0}
							<div
								class="flex items-start gap-2.5 rounded-xl border p-3.5 text-[12.5px] leading-snug {isThresholdMet
									? 'border-emerald-100 bg-emerald-50 text-emerald-800'
									: 'border-amber-100 bg-amber-50 text-amber-800'}"
							>
								{#if isThresholdMet}
									<CircleCheck class="mt-0.5 size-4 shrink-0 text-emerald-500" />
									<span>
										Поріг у {payoutThreshold.toLocaleString('uk-UA')} ₴ досягнуто. Баланс {fmt(
											netYtd
										)} ₴ буде виплачено за розкладом.
									</span>
								{:else}
									<TriangleAlert class="mt-0.5 size-4 shrink-0 text-amber-500" />
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
					<Zap class="size-5 shrink-0 text-stone-400" />
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
				class="cursor-pointer rounded-2xl border border-stone-200/70 bg-white p-5 text-left shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition hover:border-stone-300 hover:shadow-md"
			>
				<div class="flex items-center justify-between">
					<div class="text-[11px] font-medium tracking-[0.16em] text-stone-400 uppercase">
						Доходи · червень
					</div>
					<ArrowUpRight class="size-4 text-stone-300" />
				</div>
				<div class="mt-2 text-[22px] font-semibold tracking-tight text-stone-900 tabular-nums">
					25 050 ₴
				</div>
				<div class="mt-1 text-[12px] text-stone-500">4 платформи</div>
			</button>

			<!-- Taxes -->
			<button
				type="button"
				onclick={() => navigateTo('taxes')}
				class="cursor-pointer rounded-2xl border border-stone-200/70 bg-white p-5 text-left shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition hover:border-stone-300 hover:shadow-md"
			>
				<div class="flex items-center justify-between">
					<div class="text-[11px] font-medium tracking-[0.16em] text-stone-400 uppercase">
						Податки · рік
					</div>
					<ArrowUpRight class="size-4 text-stone-300" />
				</div>
				<div class="mt-2 text-[22px] font-semibold tracking-tight text-stone-900 tabular-nums">
					{fmt(taxYtd)} ₴
				</div>
				<div class="mt-1 text-[12px] text-stone-500">сплачено автоматично</div>
			</button>

			<!-- Compliance -->
			<button
				type="button"
				onclick={() => navigateTo('profile')}
				class="cursor-pointer rounded-2xl border border-stone-200/70 bg-white p-5 text-left shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition hover:border-stone-300 hover:shadow-md"
			>
				<div class="flex items-center justify-between">
					<div class="text-[11px] font-medium tracking-[0.16em] text-stone-400 uppercase">
						Compliance
					</div>
					<ArrowUpRight class="size-4 text-stone-300" />
				</div>
				<div class="mt-2 text-[22px] font-semibold tracking-tight text-stone-900 tabular-nums">
					98
				</div>
				<div class="mt-1 text-[12px] text-stone-500">Tier-2 · Дія</div>
			</button>
		</div>

		<!-- Card "Останні виплати" -->
		<div
			class="overflow-hidden rounded-2xl border border-stone-200/70 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)]"
		>
			<div class="flex items-center justify-between border-b border-stone-100 px-6 py-4">
				<span class="text-[15px] font-semibold text-stone-900">Останні виплати</span>
				<button
					type="button"
					onclick={() => navigateTo('payouts')}
					class="cursor-pointer text-[13px] font-medium text-stone-500 transition hover:text-stone-900"
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
						class="flex w-full cursor-pointer items-center justify-between px-6 py-3.5 text-left transition hover:bg-stone-50"
					>
						<div>
							<div class="text-[13.5px] font-medium text-stone-900">
								Батч {b.date} <span class="font-normal text-stone-400">· {b.txs} нарах.</span>
							</div>
							<div class="font-mono text-[12px] text-stone-400">{b.eta}</div>
						</div>
						<div class="flex items-center gap-3">
							<span class="text-[14px] font-semibold text-emerald-600 tabular-nums">
								+{fmt(itemNet)} ₴
							</span>
							<span
								class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11.5px] font-medium {PO_META[
									b.st
								]?.t === 'ok'
									? 'border border-emerald-100/50 bg-emerald-50 text-emerald-700'
									: 'border border-sky-100/50 bg-sky-50 text-sky-700'}"
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
	<!-- Sub-tab: Payouts (Payout Ledger) -->
	<div class="mx-auto max-w-4xl space-y-6">
		<div>
			<h2 class="text-[18px] font-bold text-stone-900">Реєстр виплат (Payout Ledger)</h2>
			<p class="mt-1 text-sm text-stone-500">
				Згідно з моделлю VARUS, реєстр відображає фактичні виплати на ваш IBAN рахунок, сформовані у
				пакети (Weekly Payout Batches).
			</p>
		</div>

		<div class="grid gap-4 sm:grid-cols-3">
			<div class="rounded-2xl border border-stone-200/70 bg-white p-5 shadow-sm">
				<div class="text-[11px] font-medium tracking-[0.16em] text-stone-400 uppercase">
					Зароблено YTD (Income)
				</div>
				<div class="mt-2 text-[26px] font-semibold text-stone-900 tabular-nums">
					{fmt(grossYtd)} ₴
				</div>
			</div>
			<div class="rounded-2xl border border-stone-200/70 bg-white p-5 shadow-sm">
				<div class="text-[11px] font-medium tracking-[0.16em] text-stone-400 uppercase">
					Виплачено на IBAN (Payouts)
				</div>
				<div class="mt-2 text-[26px] font-semibold text-emerald-600 tabular-nums">
					{fmt(netYtd)} ₴
				</div>
			</div>
			<div class="rounded-2xl border border-stone-200/70 bg-white p-5 shadow-sm">
				<div class="text-[11px] font-medium tracking-[0.16em] text-stone-400 uppercase">
					Утримано ПДФО (10%)
				</div>
				<div class="mt-2 text-[26px] font-semibold text-stone-900 tabular-nums">
					{fmt(taxYtd)} ₴
				</div>
			</div>
		</div>

		<div
			class="space-y-4 overflow-hidden rounded-2xl border border-stone-200/70 bg-white shadow-sm"
		>
			<div class="flex flex-col justify-between gap-3 p-6 pb-0 sm:flex-row sm:items-center">
				<div>
					<div class="text-sm font-bold text-stone-900">
						Щотижневі батчі виплат (Weekly Payout Batches)
					</div>
					<div class="mt-0.5 font-mono text-xs text-stone-500">
						Основний IBAN: {primaryIban} · {primaryBank}
					</div>
				</div>

				<!-- Search & Filter Controls -->
				<div class="flex flex-wrap items-center gap-2">
					<div class="relative">
						<Search class="absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-stone-400" />
						<input
							type="text"
							bind:value={payoutSearch}
							oninput={() => (payoutPage = 1)}
							placeholder="Пошук за ID або датою…"
							class="h-8 w-48 rounded-full border border-stone-200 bg-white pr-3 pl-8 text-xs shadow-xs outline-none"
						/>
					</div>

					<div class="flex gap-1 rounded-full border border-stone-200 bg-stone-50 p-0.5">
						{#each [{ id: 'all', l: 'Всі' }, { id: 'paid', l: 'Виплачені' }, { id: 'scheduled', l: 'Заплановані' }] as st}
							<button
								type="button"
								onclick={() => {
									payoutStatus = st.id;
									payoutPage = 1;
								}}
								class="h-6 cursor-pointer rounded-full px-2.5 text-[11px] font-medium transition {payoutStatus ===
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

			<div class="divide-y divide-stone-100 border-t border-stone-100">
				{#each paginatedBatches as b}
					{@const itemTax = getDynamicTax(b.gross)}
					{@const itemNet = b.gross - itemTax}
					<div class="flex items-center justify-between p-4 px-6 transition hover:bg-stone-50/70">
						<div>
							<div class="text-sm font-semibold text-stone-900">
								Батч {b.date} ({b.id})
							</div>
							<div class="mt-0.5 font-mono text-xs text-stone-500">
								Очікується: {b.eta} · {b.txs} подій · {primaryBank}
							</div>
						</div>
						<div class="flex items-center gap-3">
							<span
								class="text-sm font-bold {b.st === 'paid' ? 'text-emerald-600' : 'text-stone-700'}"
								>+{fmt(itemNet)} ₴</span
							>
							<span
								class="rounded-full border px-2.5 py-0.5 text-xs font-semibold {b.st === 'paid'
									? 'border-emerald-200/50 bg-emerald-50 text-emerald-700'
									: 'border-sky-200/50 bg-sky-50 text-sky-700'}"
							>
								{PO_META[b.st]?.l || b.st}
							</span>
						</div>
					</div>
				{:else}
					<div class="py-8 text-center text-xs text-stone-400">
						Батчів за обраним критерієм не знайдено
					</div>
				{/each}
			</div>

			<Dac7Pagination
				bind:currentPage={payoutPage}
				totalItems={filteredBatches.length}
				bind:pageSize={payoutPageSize}
				pageSizeOptions={[3, 5, 10]}
			/>
		</div>
	</div>
{:else if activeTab === 'income'}
	<!-- Sub-tab: Income (Courier Income Ledger) -->
	<div class="mx-auto max-w-4xl space-y-6">
		<div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
			<div>
				<h2 class="text-[18px] font-bold text-stone-900">Реєстр доходів (Courier Income Ledger)</h2>
				<p class="mt-0.5 text-sm text-stone-500">
					Згідно з моделлю VARUS, винагорода фіксується після фактичного виконання доставки (статус
					DELIVERED).
				</p>
			</div>

			<!-- Search -->
			<div class="relative">
				<Search class="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-stone-400" />
				<input
					type="text"
					bind:value={incomeSearch}
					oninput={() => (incomePage = 1)}
					placeholder="Пошук за № або описом…"
					class="h-9 w-56 rounded-full border border-stone-200 bg-white pr-4 pl-9 text-xs shadow-xs outline-none"
				/>
			</div>
		</div>

		<!-- Status Filters -->
		<div class="flex w-fit flex-wrap gap-1 rounded-full border border-stone-200 bg-stone-50 p-1">
			{#each [{ id: 'all', l: 'Всі' }, { id: 'DELIVERED', l: 'Успішно (DELIVERED)' }, { id: 'IN_DELIVERY', l: 'В дорозі (IN_DELIVERY)' }, { id: 'ADJUSTED', l: 'Сторновано (ADJUSTED)' }] as st}
				<button
					type="button"
					onclick={() => {
						incomeStatus = st.id;
						incomePage = 1;
					}}
					class="h-7 cursor-pointer rounded-full px-3 text-xs font-medium transition {incomeStatus ===
					st.id
						? 'bg-stone-900 text-white shadow-xs'
						: 'text-stone-500 hover:text-stone-900'}"
				>
					{st.l}
				</button>
			{/each}
		</div>

		<div class="space-y-4 rounded-2xl border border-stone-200/70 bg-white p-6 shadow-sm">
			<div class="flex items-center justify-between text-sm font-semibold text-stone-900">
				<span>Події виконання послуг</span>
				<span class="font-mono text-xs text-stone-500">Знайдено: {filteredIncome.length}</span>
			</div>
			<div class="space-y-3">
				{#each paginatedIncome as inc}
					<button
						type="button"
						onclick={() => (selectedIncomeTx = inc)}
						class="flex w-full cursor-pointer items-center justify-between rounded-xl border border-stone-100 p-3.5 text-left transition hover:bg-stone-50/80 {inc.deliveryStatus ===
							'CANCELLED' || inc.deliveryStatus === 'ADJUSTED'
							? 'bg-stone-50 opacity-70'
							: ''}"
					>
						<div class="flex items-start gap-3">
							<div class="mt-1">
								{#if inc.deliveryStatus === 'DELIVERED'}
									<div class="flex size-6 items-center justify-center rounded-full bg-emerald-100">
										<CircleCheck class="size-3.5 text-emerald-600" />
									</div>
								{:else if inc.deliveryStatus === 'IN_DELIVERY'}
									<div class="flex size-6 items-center justify-center rounded-full bg-amber-100">
										<Clock class="size-3.5 text-amber-600" />
									</div>
								{:else if inc.deliveryStatus === 'ADJUSTED' || inc.deliveryStatus === 'CANCELLED'}
									<div class="flex size-6 items-center justify-center rounded-full bg-stone-200">
										<TriangleAlert class="size-3.5 text-stone-500" />
									</div>
								{/if}
							</div>
							<div>
								<div class="flex items-center gap-2">
									<div class="text-sm font-semibold text-stone-900">
										{inc.p} <span class="font-normal text-stone-400">· {inc.orderId}</span>
									</div>
									<span
										class="rounded-md px-1.5 py-0.5 text-[10px] font-bold {inc.deliveryStatus ===
										'DELIVERED'
											? 'border border-emerald-200/50 bg-emerald-50 text-emerald-700'
											: inc.deliveryStatus === 'IN_DELIVERY'
												? 'border border-amber-200/50 bg-amber-50 text-amber-700'
												: 'border border-stone-200 bg-stone-100 text-stone-600'}"
									>
										{inc.deliveryStatus}
									</span>
								</div>
								<div class="mt-0.5 text-xs text-stone-500">{inc.d} · {inc.date} {inc.time}</div>
							</div>
						</div>
						<div class="text-right">
							<div
								class="text-sm font-bold {inc.gross < 0
									? 'text-red-600'
									: inc.deliveryStatus === 'DELIVERED'
										? 'text-emerald-600'
										: 'text-stone-600'}"
							>
								{inc.gross > 0 ? '+' : ''}{fmt(inc.net)} ₴
							</div>
							<div class="text-[11px] text-stone-400">под. {fmt(inc.tax)} ₴</div>
						</div>
					</button>
				{:else}
					<div class="py-8 text-center text-xs text-stone-400">Записів доходів не знайдено</div>
				{/each}
			</div>

			<Dac7Pagination
				bind:currentPage={incomePage}
				totalItems={filteredIncome.length}
				bind:pageSize={incomePageSize}
				pageSizeOptions={[3, 5, 10]}
			/>
		</div>

		<!-- Income Delivery Drawer -->
		<IncomeDrawer tx={selectedIncomeTx} onClose={() => (selectedIncomeTx = null)} />
	</div>
{:else if activeTab === 'taxes'}
	<!-- Sub-tab: Taxes -->
	<div class="mx-auto max-w-4xl space-y-6">
		<div class="flex items-center justify-between">
			<div>
				<h2 class="text-[18px] font-bold text-stone-900">
					Податковий звіт (Закон № 4903-IX / DAC7)
				</h2>
				<p class="mt-0.5 text-xs text-stone-500">
					Режим: <strong class="text-stone-800"
						>{CATEGORY_META[sellerCategory]?.label || sellerCategory}</strong
					>
				</p>
			</div>
			<span
				class="rounded-full border px-3 py-1 text-xs font-bold {CATEGORY_META[sellerCategory]
					?.badgeClass || 'bg-stone-100 text-stone-700'}"
			>
				{CATEGORY_META[sellerCategory]?.taxRateDisplay}
			</span>
		</div>

		<!-- Category-specific tax banner -->
		{#if sellerCategory === 'platform_gig'}
			<div class="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-6">
				<div class="mb-2 flex items-center gap-3">
					<ShieldCheck class="size-5 text-emerald-700" />
					<h3 class="text-base font-bold text-emerald-950">
						Податковий агент: Bolt Food / VARUS Ukraine
					</h3>
				</div>
				<p class="text-xs leading-relaxed text-emerald-800">
					Всі податкові зобов'язання (10% ПДФО) розраховуються та автоматично утримуються платформою
					в момент формування виплатного батчу. Подавати річну декларацію про доходи не потрібно.
					<strong>Військовий збір = 0.00 ₴</strong> (не застосовується).
				</p>
			</div>

			<div class="grid gap-4 sm:grid-cols-2">
				<div class="rounded-2xl border border-stone-200/70 bg-white p-6 shadow-sm">
					<div class="text-[11px] font-medium tracking-[0.16em] text-stone-400 uppercase">
						Сплачено ПДФО (10%) YTD
					</div>
					<div class="mt-2 text-[32px] font-bold text-stone-900 tabular-nums">{fmt(taxYtd)} ₴</div>
					<p class="mt-2 text-xs text-stone-500">
						10% ставка ПДФО для платформної зайнятості (Військовий збір: 0.00 ₴)
					</p>
				</div>

				<div class="rounded-2xl border border-stone-200/70 bg-white p-6 shadow-sm">
					<div class="text-[11px] font-medium tracking-[0.16em] text-stone-400 uppercase">
						Ліміт доходів (834 МЗП)
					</div>
					<div class="mt-2 text-[32px] font-bold text-stone-900 tabular-nums">7 211 598 ₴</div>
					<p class="mt-2 text-xs text-stone-500">
						Використано {Math.round((grossYtd / 7211598) * 100)}% річного порогу
					</p>
				</div>
			</div>
		{:else if sellerCategory === 'fop'}
			<div class="rounded-2xl border border-indigo-200 bg-indigo-50/70 p-6">
				<div class="mb-2 flex items-center gap-3">
					<ShieldCheck class="size-5 text-indigo-700" />
					<h3 class="text-base font-bold text-indigo-950">
						Самостійне декларування: ФОП (3 група, 5% ЄП)
					</h3>
				</div>
				<p class="text-xs leading-relaxed text-indigo-800">
					Платформа <strong>НЕ є податковим агентом</strong> та не утримує податки (ставка 0%).
					Виплата перераховується на поточний рахунок ФОП. Платформа подає звіт за формою 4ДФ з
					кодом ознаки доходу <strong>157</strong>.
				</p>
			</div>

			<div class="grid gap-4 sm:grid-cols-2">
				<div class="rounded-2xl border border-stone-200/70 bg-white p-6 shadow-sm">
					<div class="text-[11px] font-medium tracking-[0.16em] text-stone-400 uppercase">
						Утримано платформою
					</div>
					<div class="mt-2 text-[32px] font-bold text-stone-900 tabular-nums">0.00 ₴</div>
					<p class="mt-2 text-xs text-stone-500">
						Платформа не утримує ПДФО чи ВЗ із зареєстрованих ФОП
					</p>
				</div>

				<div class="rounded-2xl border border-stone-200/70 bg-white p-6 shadow-sm">
					<div class="text-[11px] font-medium tracking-[0.16em] text-stone-400 uppercase">
						Єдиний податок (5% самостійно)
					</div>
					<div class="mt-2 text-[32px] font-bold text-indigo-700 tabular-nums">
						{fmt(Math.round(grossYtd * 0.05))} ₴
					</div>
					<p class="mt-2 text-xs text-stone-500">
						Орієнтовне нарахування ЄП для квартальної декларації ФОП
					</p>
				</div>
			</div>
		{:else if sellerCategory === 'goods_casual'}
			<div class="rounded-2xl border border-amber-200 bg-amber-50/70 p-6">
				<div class="mb-2 flex items-center gap-3">
					<ShieldCheck class="size-5 text-amber-700" />
					<h3 class="text-base font-bold text-amber-950">
						Режим продажу особистих речей (De Minimis)
					</h3>
				</div>
				<p class="text-xs leading-relaxed text-amber-800">
					Відповідно до Директиви DAC7 та Закону України № 4903-IX, продавці особистих та вживаних
					речей звільняються від оподаткування та обов'язкового подання звітності DPI до досягнення <strong
						>30 операцій або 2 000 €</strong
					> на рік.
				</p>
			</div>

			<div class="grid gap-4 sm:grid-cols-2">
				<div class="rounded-2xl border border-stone-200/70 bg-white p-6 shadow-sm">
					<div class="text-[11px] font-medium tracking-[0.16em] text-stone-400 uppercase">
						Використання ліміту угод
					</div>
					<div class="mt-2 text-[32px] font-bold text-stone-900 tabular-nums">
						{goodsSalesYtd < 2000 ? 14 : 45} / 30
					</div>
					<p class="mt-2 text-xs text-stone-500">
						{goodsSalesYtd < 2000
							? '✓ В межах норми De Minimis'
							: '⚠️ Ліміт перевищено, звітність активна'}
					</p>
				</div>

				<div class="rounded-2xl border border-stone-200/70 bg-white p-6 shadow-sm">
					<div class="text-[11px] font-medium tracking-[0.16em] text-stone-400 uppercase">
						Обіг у валюті DAC7 (EUR)
					</div>
					<div class="mt-2 text-[32px] font-bold text-stone-900 tabular-nums">
						{goodsSalesYtd} € / 2 000 €
					</div>
					<p class="mt-2 text-xs text-stone-500">Поріг: 2 000 євро (~90 000 ₴)</p>
				</div>
			</div>
		{:else}
			<div class="rounded-2xl border border-stone-200 bg-stone-50/70 p-6">
				<div class="mb-2 flex items-center gap-3">
					<ShieldCheck class="size-5 text-stone-700" />
					<h3 class="text-base font-bold text-stone-900">{CATEGORY_META[sellerCategory]?.label}</h3>
				</div>
				<p class="text-xs leading-relaxed text-stone-600">
					{CATEGORY_META[sellerCategory]?.taxDescription}
				</p>
			</div>
		{/if}
	</div>
{:else if activeTab === 'docs'}
	<!-- Sub-tab: Docs -->
	<div class="mx-auto max-w-4xl space-y-6">
		<h2 class="text-[18px] font-bold text-stone-900">Документи та довідки</h2>

		<div class="space-y-4 rounded-2xl border border-stone-200/70 bg-white p-6 shadow-sm">
			<div class="flex items-center justify-between border-b border-stone-100 pb-4">
				<div>
					<div class="text-sm font-semibold text-stone-900">Довідка про доходи за Q2 2026</div>
					<div class="font-mono text-xs text-stone-500">Сформовано автоматично · Дія.Підпис</div>
				</div>
				<button
					type="button"
					onclick={() => alert('Завантаження офіційної довідки про доходи з КЕП...')}
					class="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-2 text-xs font-bold text-stone-800 transition hover:bg-stone-100"
				>
					<Download class="size-4" /> PDF
				</button>
			</div>

			<div class="flex items-center justify-between">
				<div>
					<div class="text-sm font-semibold text-stone-900">
						Повідомлення про відкриття спецрахунку
					</div>
					<div class="font-mono text-xs text-stone-500">ДПС України · підтверджено 15.03.2025</div>
				</div>
				<button
					type="button"
					onclick={() => alert('Завантаження квитанції ДПС №2...')}
					class="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-2 text-xs font-bold text-stone-800 transition hover:bg-stone-100"
				>
					<Download class="size-4" /> PDF
				</button>
			</div>
		</div>
	</div>
{:else if activeTab === 'platforms'}
	<!-- Sub-tab: Platforms -->
	<div class="mx-auto max-w-4xl space-y-6">
		<h2 class="text-[18px] font-bold text-stone-900">Підключені платформи</h2>

		<div class="grid gap-4 sm:grid-cols-3">
			<div class="space-y-3 rounded-2xl border border-stone-200/70 bg-white p-5 shadow-sm">
				<div class="flex items-center justify-between">
					<div class="text-sm font-bold text-stone-900">Bolt Food</div>
					<span class="size-2 rounded-full bg-emerald-500"></span>
				</div>
				<p class="text-xs text-stone-500">Автоматичний податковий агент</p>
				<button
					type="button"
					onclick={() => togglePlatformConsent('bolt_food')}
					class="w-full rounded-xl py-1.5 text-xs font-semibold transition {platformConsents.bolt_food
						? 'border border-emerald-200 bg-emerald-50 text-emerald-800'
						: 'bg-stone-100 text-stone-600'}"
				>
					{platformConsents.bolt_food ? 'Згода надана' : 'Згоду відкликано'}
				</button>
			</div>

			<div class="space-y-3 rounded-2xl border border-stone-200/70 bg-white p-5 shadow-sm">
				<div class="flex items-center justify-between">
					<div class="text-sm font-bold text-stone-900">Uklon</div>
					<span class="size-2 rounded-full bg-emerald-500"></span>
				</div>
				<p class="text-xs text-stone-500">Спільний розрахунковий баланс</p>
				<button
					type="button"
					onclick={() => togglePlatformConsent('uklon')}
					class="w-full rounded-xl py-1.5 text-xs font-semibold transition {platformConsents.uklon
						? 'border border-emerald-200 bg-emerald-50 text-emerald-800'
						: 'bg-stone-100 text-stone-600'}"
				>
					{platformConsents.uklon ? 'Згода надана' : 'Згоду відкликано'}
				</button>
			</div>

			<div class="space-y-3 rounded-2xl border border-stone-200/70 bg-white p-5 shadow-sm">
				<div class="flex items-center justify-between">
					<div class="text-sm font-bold text-stone-900">Glovo</div>
					<span class="size-2 rounded-full bg-stone-300"></span>
				</div>
				<p class="text-xs text-stone-500">Очікує повторного підтвердження</p>
				<button
					type="button"
					onclick={() => togglePlatformConsent('glovo')}
					class="w-full rounded-xl py-1.5 text-xs font-semibold transition {platformConsents.glovo
						? 'border border-emerald-200 bg-emerald-50 text-emerald-800'
						: 'bg-stone-100 text-stone-600'}"
				>
					{platformConsents.glovo ? 'Згода надана' : 'Підключити'}
				</button>
			</div>
		</div>
	</div>
{:else if activeTab === 'profile'}
	<!-- Sub-tab: Profile -->
	<div class="mx-auto max-w-4xl space-y-6">
		<h2 class="text-[18px] font-bold text-stone-900">Фінансовий паспорт кур'єра</h2>

		<div class="grid gap-6 sm:grid-cols-2">
			<!-- Identity Data -->
			<div class="space-y-4 rounded-2xl border border-stone-200/70 bg-white p-6 shadow-sm">
				<div class="mb-2 flex items-center gap-2">
					<User class="size-5 text-stone-500" />
					<h3 class="font-bold text-stone-900">Ідентифікація</h3>
				</div>
				<div class="flex items-center justify-between border-b border-stone-100 pb-3">
					<span class="text-xs text-stone-500">ПІБ</span>
					<span class="text-sm font-semibold text-stone-900">Олексій Ткаченко</span>
				</div>
				<div class="flex items-center justify-between border-b border-stone-100 pb-3">
					<span class="text-xs text-stone-500">РНОКПП (ІПН)</span>
					<span class="font-mono text-sm font-semibold text-stone-900">3091248192</span>
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

			<!-- Tax Mode Configuration -->
			<div class="space-y-4 rounded-2xl border border-stone-200/70 bg-white p-6 shadow-sm">
				<div class="mb-2 flex items-center justify-between">
					<div class="flex items-center gap-2">
						<Percent class="size-5 text-stone-500" />
						<h3 class="font-bold text-stone-900">Податковий режим та категорія</h3>
					</div>
					<span
						class="rounded-full border px-2 py-0.5 text-[10px] font-bold {CATEGORY_META[
							sellerCategory
						]?.badgeClass || 'bg-stone-100 text-stone-700'}"
					>
						{CATEGORY_META[sellerCategory]?.taxRateDisplay}
					</span>
				</div>

				<div class="space-y-2">
					<!-- Option 1: Platform Gig -->
					<label
						class="flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition {sellerCategory ===
						'platform_gig'
							? 'border-emerald-300 bg-emerald-50/50'
							: 'border-stone-100 hover:bg-stone-50'}"
					>
						<input
							type="radio"
							name="seller_cat"
							value="platform_gig"
							checked={sellerCategory === 'platform_gig'}
							onchange={() => handleCategoryChange('platform_gig')}
							class="mt-1 h-4 w-4 cursor-pointer text-emerald-600 focus:ring-emerald-500"
						/>
						<div>
							<div class="text-xs font-bold text-stone-900">
								Спецрежим цифрової платформи (ст. 178-1 ПКУ)
							</div>
							<div class="mt-0.5 text-[11px] text-stone-500">
								10% ПДФО утримує платформа, <strong>Військовий збір = 0.00 ₴</strong>, ліміт до 7
								211 598 ₴ на рік.
							</div>
						</div>
					</label>

					<!-- Option 2: FOP -->
					<label
						class="flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition {sellerCategory ===
						'fop'
							? 'border-indigo-300 bg-indigo-50/50'
							: 'border-stone-100 hover:bg-stone-50'}"
					>
						<input
							type="radio"
							name="seller_cat"
							value="fop"
							checked={sellerCategory === 'fop'}
							onchange={() => handleCategoryChange('fop')}
							class="mt-1 h-4 w-4 cursor-pointer text-indigo-600 focus:ring-indigo-500"
						/>
						<div>
							<div class="text-xs font-bold text-stone-900">
								Зареєстрований ФОП (3 група, 5% ЄП)
							</div>
							<div class="mt-0.5 text-[11px] text-stone-500">
								0% утримання платформою. Сплата ЄП самостійно. Звітність платформи за кодом 157.
							</div>
						</div>
					</label>

					<!-- Option 3: Goods Casual -->
					<label
						class="flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition {sellerCategory ===
						'goods_casual'
							? 'border-amber-300 bg-amber-50/50'
							: 'border-stone-100 hover:bg-stone-50'}"
					>
						<input
							type="radio"
							name="seller_cat"
							value="goods_casual"
							checked={sellerCategory === 'goods_casual'}
							onchange={() => handleCategoryChange('goods_casual')}
							class="mt-1 h-4 w-4 cursor-pointer text-amber-600 focus:ring-amber-500"
						/>
						<div>
							<div class="text-xs font-bold text-stone-900">
								Продаж особистих речей (De Minimis)
							</div>
							<div class="mt-0.5 text-[11px] text-stone-500">
								Звільнення від податків та звітності до 30 угод або 2 000 євро на рік за правилами
								DAC7.
							</div>
						</div>
					</label>

					<!-- Option 4: Property Rental -->
					<label
						class="flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition {sellerCategory ===
						'property_rental'
							? 'border-violet-300 bg-violet-50/50'
							: 'border-stone-100 hover:bg-stone-50'}"
					>
						<input
							type="radio"
							name="seller_cat"
							value="property_rental"
							checked={sellerCategory === 'property_rental'}
							onchange={() => handleCategoryChange('property_rental')}
							class="mt-1 h-4 w-4 cursor-pointer text-violet-600 focus:ring-violet-500"
						/>
						<div>
							<div class="text-xs font-bold text-stone-900">Орендодавець житла / нерухомості</div>
							<div class="mt-0.5 text-[11px] text-stone-500">
								Звітність DAC7 за об'єктом з кадастровим номером та кількістю діб оренди.
							</div>
						</div>
					</label>

					<!-- Option 5: Transport Rental -->
					<label
						class="flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition {sellerCategory ===
						'transport_rental'
							? 'border-cyan-300 bg-cyan-50/50'
							: 'border-stone-100 hover:bg-stone-50'}"
					>
						<input
							type="radio"
							name="seller_cat"
							value="transport_rental"
							checked={sellerCategory === 'transport_rental'}
							onchange={() => handleCategoryChange('transport_rental')}
							class="mt-1 h-4 w-4 cursor-pointer text-cyan-600 focus:ring-cyan-500"
						/>
						<div>
							<div class="text-xs font-bold text-stone-900">Оренда транспорту / Прокат авто</div>
							<div class="mt-0.5 text-[11px] text-stone-500">
								Облік автотранспорту за держномером та VIN-кодом.
							</div>
						</div>
					</label>

					<!-- Option 6: Independent Pro -->
					<label
						class="flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition {sellerCategory ===
						'independent_pro'
							? 'border-teal-300 bg-teal-50/50'
							: 'border-stone-100 hover:bg-stone-50'}"
					>
						<input
							type="radio"
							name="seller_cat"
							value="independent_pro"
							checked={sellerCategory === 'independent_pro'}
							onchange={() => handleCategoryChange('independent_pro')}
							class="mt-1 h-4 w-4 cursor-pointer text-teal-600 focus:ring-teal-500"
						/>
						<div>
							<div class="text-xs font-bold text-stone-900">
								Незалежний професіонал (ст. 178 ПКУ)
							</div>
							<div class="mt-0.5 text-[11px] text-stone-500">
								Репетитори, юристи, консультанти з обліком у ДПС.
							</div>
						</div>
					</label>
				</div>
			</div>
		</div>

		<!-- IBAN Manager (Верифікація рахунку) -->
		<div class="space-y-4 rounded-2xl border border-stone-200/70 bg-white p-6 shadow-sm">
			<div class="mb-2 flex items-center gap-2">
				<Building2 class="size-5 text-stone-500" />
				<h3 class="font-bold text-stone-900">Виплатні реквізити (IBAN)</h3>
			</div>

			<div
				class="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 p-4"
			>
				<div class="flex items-start gap-3">
					<div
						class="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-stone-900 text-xs font-bold text-white"
					>
						МБ
					</div>
					<div>
						<div class="flex items-center gap-2">
							<div class="text-sm font-semibold text-stone-900">Монобанк</div>
							<span
								class="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800"
								>ОСНОВНИЙ</span
							>
						</div>
						<div class="mt-1 font-mono text-sm text-stone-600">{primaryIban}</div>
						<div class="mt-1 flex items-center gap-1 text-xs text-emerald-700">
							<CircleCheck class="size-3" /> Верифіковано через BankID (збіг ПІБ та РНОКПП)
						</div>
					</div>
				</div>
			</div>

			<div
				class="flex items-center justify-between rounded-xl border border-stone-200 p-4 opacity-60"
			>
				<div class="flex items-start gap-3">
					<div
						class="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-green-600 text-xs font-bold text-white"
					>
						ПБ
					</div>
					<div>
						<div class="text-sm font-semibold text-stone-900">ПриватБанк</div>
						<div class="mt-1 font-mono text-sm text-stone-600">
							UA68 3052 9900 0002 6000 0004 8912
						</div>
						<div class="mt-1 flex items-center gap-1 text-xs text-stone-500">
							<ShieldCheck class="size-3" /> Верифіковано (Penny Drop 1 грн)
						</div>
					</div>
				</div>
				<button class="text-xs font-semibold text-stone-500 hover:text-stone-900"
					>Зробити основним</button
				>
			</div>

			{#if showAddIban}
				<div class="space-y-3 rounded-xl border border-stone-200 bg-stone-50 p-4">
					<div class="flex items-center justify-between">
						<span class="text-xs font-bold text-stone-900">Виберіть банк або введіть МФО:</span>
						<button
							type="button"
							onclick={() => (showAddIban = false)}
							class="text-xs font-bold text-stone-400 hover:text-stone-700"
						>
							Скасувати
						</button>
					</div>
					<BankSelector
						onSelectBank={(b) => {
							primaryBank = b.name.split(' ')[0];
							showAddIban = false;
						}}
					/>
				</div>
			{:else}
				<button
					type="button"
					onclick={() => (showAddIban = true)}
					class="mt-2 w-full cursor-pointer rounded-xl border border-dashed border-stone-300 p-3 text-sm font-semibold text-stone-500 transition hover:bg-stone-50 hover:text-stone-900"
				>
					+ Додати новий IBAN (Modulo 97)
				</button>
			{/if}
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
			class="absolute inset-0 cursor-default border-none bg-stone-950/30 p-0 backdrop-blur-[2px]"
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
						class="cursor-pointer rounded-full p-1.5 text-stone-400 transition hover:bg-stone-100 hover:text-stone-900"
					>
						<X class="size-4" />
					</button>
				</div>
			</div>

			<div class="flex-1 overflow-y-auto p-6">
				<div class="text-center">
					<div class="text-[34px] font-semibold tracking-tight text-stone-900 tabular-nums">
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
								? 'border border-emerald-100/50 bg-emerald-50 text-emerald-700'
								: 'border border-sky-100/50 bg-sky-50 text-sky-700'}"
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
									<div class="text-[13.5px] font-semibold text-emerald-600 tabular-nums">
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
