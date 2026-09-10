<script lang="ts">
	import { onMount } from 'svelte';
	import {
		Award,
		Mail,
		Send,
		Activity,
		ChevronRight,
		CircleCheck,
		TriangleAlert,
		AlertTriangle,
		Users,
		Receipt,
		FileText,
		ShieldCheck,
		Search,
		Download,
		X,
		Zap,
		Percent,
		Building2,
		CodeXml,
		ArrowLeftRight,
		Layers,
		HelpCircle,
		Check,
		Filter
	} from '@lucide/svelte';
	import Dac7TaxReconciliation from './Dac7TaxReconciliation.svelte';
	import Dac7Pagination from './Dac7Pagination.svelte';
	import SellerDrawer from './drawers/SellerDrawer.svelte';
	import PayoutDrawer from './drawers/PayoutDrawer.svelte';
	import ImportWizard from './ImportWizard.svelte';
	import type { Dac7Batch, Dac7Payout, Dac7Seller, SellerCategory } from '../types';
	import type { Dac7Gateway } from '../dac7-gateway';
	import {
		demoPayouts,
		demoSellers,
		demoBatches,
		demoEscrows,
		ESCROW_META,
		type Dac7EscrowItem,
		fmt,
		PO_META,
		KYC_META,
		CATEGORY_META,
		TENANT_DATA,
		revenueSeries,
		type TenantStats
	} from '../mockData';

	let {
		gateway,
		demo = false,
		activeTab = 'dashboard',
		onNavigate
	}: {
		gateway: Dac7Gateway;
		demo?: boolean;
		activeTab?: string;
		onNavigate?: (tab: string) => void;
	} = $props();

	let tenant = $state('bolt_food');
	let liveStats = $state<TenantStats | null>(null);
	let livePayouts = $state<Dac7Payout[]>([]);
	let liveSellers = $state<Dac7Seller[]>([]);
	let selectedSeller = $state<Dac7Seller | null>(null);
	let selectedPayout = $state<Dac7Payout | null>(null);
	let importWizardOpen = $state<boolean>(false);

	// Campaign Simulation State
	let campaignRunning = $state(false);
	let campaignProgress = $state(0);
	let campaignTarget = $state<'needTin' | 'needAddress'>('needTin');
	let campaignChannel = $state<'email' | 'sms' | 'telegram' | 'push'>('email');

	// Sellers list filter, city, search and pagination
	let sellerSearch = $state('');
	let sellerFilter = $state('all');
	let sellerCategory = $state('all');
	let sellerCity = $state('all');
	let sellerPage = $state(1);
	let sellerPageSize = $state(5);

	// Payouts tab states (views: tx, batch, escrow)
	let payoutView = $state<'tx' | 'batch' | 'escrow'>('tx');
	let payoutSearch = $state('');
	let payoutStatus = $state('all');
	let payoutPage = $state(1);
	let payoutPageSize = $state(5);
	let escrows = $state<Dac7EscrowItem[]>(demoEscrows);
	let selectedBatch = $state<Dac7Batch | null>(null);
	let selectedEscrow = $state<Dac7EscrowItem | null>(null);

	// XML generator state
	let xmlModalOpen = $state(false);
	let xmlReportContent = $state('');

	function loadTenant() {
		if (typeof window === 'undefined') return;
		tenant = localStorage.getItem('active_platform_tenant') || 'bolt_food';
	}

	async function loadData() {
		if (demo) return;
		const [pList, sList] = await Promise.all([
			gateway.getPayouts(false),
			gateway.getSellers(false)
		]);
		livePayouts = pList;
		liveSellers = sList;
	}

	onMount(() => {
		loadTenant();
		loadData();
		window.addEventListener('storage', loadTenant);
		return () => window.removeEventListener('storage', loadTenant);
	});

	$effect(() => {
		if (!demo) {
			loadData();
		}
	});

	const stats: TenantStats = $derived(
		demo
			? TENANT_DATA[tenant] || TENANT_DATA.bolt_food
			: liveStats || {
					paidToday: '0 ₴',
					payoutsCount: '0 виплат',
					scheduled: '0 ₴',
					pendingKyc: '0',
					complianceScore: 100,
					unresolvedCount: { kyc: 0, iban: 0, name: 0, sanctions: 0 },
					pdxo: '0 ₴',
					payoutPrefix: 'po_db',
					totalSellers: liveSellers.length,
					verifiedSellers: liveSellers.filter((s) => s.kyc === 'tier2').length,
					needTin: liveSellers.filter((s) => !s.rnokpp).length,
					needAddress: liveSellers.filter((s) => !s.address).length,
					blockedSellers: liveSellers.filter((s) => s.kyc === 'blocked').length,
					underReview: liveSellers.filter((s) => s.kyc === 'pending').length
				}
	);

	function triggerCampaign() {
		campaignRunning = true;
		campaignProgress = 0;
		const interval = setInterval(() => {
			if (campaignProgress >= 100) {
				clearInterval(interval);
				campaignRunning = false;
				alert(
					'Кампанію успішно завершено! Надіслано сповіщень. Очікувана конверсія збору даних: +32% протягом 24 годин.'
				);
			} else {
				campaignProgress += 10;
			}
		}, 300);
	}

	function navigateTo(tab: string) {
		if (onNavigate) onNavigate(tab);
	}

	const feedPayouts = $derived(demo ? demoPayouts : livePayouts);
	const filteredPayouts = $derived(
		feedPayouts
			.map((p) => ({
				...p,
				originalId: p.id,
				displayId: p.id.startsWith('po_') ? p.id : `${stats.payoutPrefix}${p.id.substring(7)}`
			}))
			.slice(0, 4)
	);

	const sellersList = $derived(demo ? demoSellers : liveSellers);

	const sellerCounts = $derived({
		all: sellersList.length,
		tier2: sellersList.filter((s) => s.kyc === 'tier2').length,
		tier1: sellersList.filter((s) => s.kyc === 'tier1').length,
		pending: sellersList.filter((s) => s.kyc === 'pending').length,
		blocked: sellersList.filter((s) => s.kyc === 'blocked').length
	});

	const citiesList = $derived([
		'all',
		...Array.from(new Set(sellersList.map((s) => s.city).filter(Boolean)))
	]);

	const displayedSellers = $derived(
		sellersList.filter((s) => {
			const matchesQ =
				sellerSearch === '' ||
				s.name.toLowerCase().includes(sellerSearch.toLowerCase()) ||
				s.id.toLowerCase().includes(sellerSearch.toLowerCase()) ||
				s.city.toLowerCase().includes(sellerSearch.toLowerCase()) ||
				(s.rnokpp && s.rnokpp.includes(sellerSearch)) ||
				(s.role && s.role.toLowerCase().includes(sellerSearch.toLowerCase()));
			if (!matchesQ) return false;
			if (sellerCity !== 'all' && s.city !== sellerCity) return false;
			if (sellerCategory !== 'all' && s.category !== sellerCategory) return false;
			if (sellerFilter === 'tier2') return s.kyc === 'tier2';
			if (sellerFilter === 'tier1') return s.kyc === 'tier1';
			if (sellerFilter === 'pending') return s.kyc === 'pending';
			if (sellerFilter === 'blocked') return s.kyc === 'blocked';
			return true;
		})
	);

	const paginatedSellers = $derived(
		displayedSellers.slice((sellerPage - 1) * sellerPageSize, sellerPage * sellerPageSize)
	);

	function exportSellersCsv() {
		const headers = [
			'ID',
			'ПІБ',
			'Роль',
			'Категорія',
			'Податковий режим',
			'Місто',
			'KYC',
			'РНОКПП',
			'Обіг YTD (UAH)'
		];
		const rows = displayedSellers.map((s) => [
			s.id,
			`"${s.name}"`,
			s.role,
			s.category,
			`"${CATEGORY_META[s.category]?.taxRateDisplay || '10% ПДФО'}"`,
			s.city,
			s.kyc,
			s.rnokpp || '',
			s.earned
		]);
		const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
		const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `sellers_export_${new Date().toISOString().slice(0, 10)}.csv`;
		a.click();
		URL.revokeObjectURL(url);
	}

	// Payouts Filtering & Pagination
	const filteredTxList = $derived(
		feedPayouts.filter((p) => {
			const matchesQ =
				payoutSearch === '' ||
				(p.seller + p.id + p.sid).toLowerCase().includes(payoutSearch.toLowerCase());
			if (!matchesQ) return false;
			if (payoutStatus !== 'all' && p.st !== payoutStatus) return false;
			return true;
		})
	);
	const paginatedTxList = $derived(
		filteredTxList.slice((payoutPage - 1) * payoutPageSize, payoutPage * payoutPageSize)
	);

	const filteredBatchList = $derived(
		demoBatches.filter((b) => {
			const matchesQ =
				payoutSearch === '' ||
				(b.seller + b.id + b.sid).toLowerCase().includes(payoutSearch.toLowerCase());
			if (!matchesQ) return false;
			if (payoutStatus !== 'all' && b.st !== payoutStatus) return false;
			return true;
		})
	);
	const paginatedBatchList = $derived(
		filteredBatchList.slice((payoutPage - 1) * payoutPageSize, payoutPage * payoutPageSize)
	);

	const filteredEscrowList = $derived(
		escrows.filter((e) => {
			const matchesQ =
				payoutSearch === '' ||
				(e.seller + e.buyer + e.id).toLowerCase().includes(payoutSearch.toLowerCase());
			if (!matchesQ) return false;
			if (payoutStatus !== 'all' && e.status !== payoutStatus) return false;
			return true;
		})
	);
	const paginatedEscrowList = $derived(
		filteredEscrowList.slice((payoutPage - 1) * payoutPageSize, payoutPage * payoutPageSize)
	);

	function exportPayoutsCsv() {
		const headers = [
			'ID',
			'Одержувач',
			'SID',
			'Gross (UAH)',
			'ПДФО 10% (UAH)',
			'Net (UAH)',
			'Рейка',
			'Статус',
			'Дата'
		];
		const rows = filteredTxList.map((p) => [
			p.id,
			`"${p.seller}"`,
			p.sid,
			p.gross,
			p.tax,
			p.net,
			p.rail,
			p.st,
			p.date
		]);
		const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
		const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `payouts_export_${new Date().toISOString().slice(0, 10)}.csv`;
		a.click();
		URL.revokeObjectURL(url);
	}

	function handleEscrowAction(
		id: string,
		action: 'released' | 'refunded' | 'disputed',
		reason?: string
	) {
		escrows = escrows.map((item) => {
			if (item.id === id) {
				return { ...item, status: action, reason };
			}
			return item;
		});
		if (selectedEscrow && selectedEscrow.id === id) {
			selectedEscrow = { ...selectedEscrow, status: action, reason };
		}
	}

	function generateDac7Xml() {
		xmlReportContent = `<?xml version="1.0" encoding="UTF-8"?>
<DPI_Report xmlns="urn:oecd:ties:dpi:v1" version="1.0">
  <DocSpec>
    <DocRefId>RHK-UA-2026-Q3-BOLT-001</DocRefId>
    <DocTypeIndic>OECD1</DocTypeIndic>
  </DocSpec>
  <PlatformOperator>
    <Jurisdiction>UA</Jurisdiction>
    <Name>Bolt Food Ukraine (ТОВ «Болт Оперейшнз Україна»)</Name>
    <TIN jurisdiction="UA">43102914</TIN>
  </PlatformOperator>
  <ReportableSellers count="${sellersList.length}">
${sellersList
	.map(
		(s) => `    <Seller>
      <Identity>
        <Name>${s.name}</Name>
        <RNOKPP>${s.rnokpp || '3091248192'}</RNOKPP>
        <KYCLevel>${s.kyc}</KYCLevel>
      </Identity>
      <FinancialDetails>
        <GrossTurnover currency="UAH">${s.earned.toFixed(2)}</GrossTurnover>
        <TaxWithheld currency="UAH">${(s.isFop ? 0 : s.earned * 0.1).toFixed(2)}</TaxWithheld>
      </FinancialDetails>
    </Seller>`
	)
	.join('\n')}
  </ReportableSellers>
</DPI_Report>`;
		xmlModalOpen = true;
	}

	// Chart geometry for SVG Area Chart (Matches Recharts layout from Screenshot 2)
	const chartWidth = 560;
	const chartHeight = 220;
	const padLeft = 36;
	const padRight = 16;
	const padTop = 10;
	const padBottom = 26;
	const plotW = chartWidth - padLeft - padRight;
	const plotH = chartHeight - padTop - padBottom;
	const maxVal = 100;

	const chartPoints = $derived(
		revenueSeries.map((item, idx) => {
			const x = padLeft + (idx / (revenueSeries.length - 1)) * plotW;
			const yPayouts = padTop + plotH - (item.payouts / maxVal) * plotH;
			const yTax = padTop + plotH - (item.tax / maxVal) * plotH;
			return { x, yPayouts, yTax, ...item };
		})
	);

	const payoutsPath = $derived.by(() => {
		if (chartPoints.length === 0) return '';
		const line = chartPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.yPayouts}`).join(' ');
		const last = chartPoints[chartPoints.length - 1];
		const first = chartPoints[0];
		const area = `${line} L ${last.x} ${padTop + plotH} L ${first.x} ${padTop + plotH} Z`;
		return { line, area };
	});

	const taxPath = $derived.by(() => {
		if (chartPoints.length === 0) return '';
		const line = chartPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.yTax}`).join(' ');
		const last = chartPoints[chartPoints.length - 1];
		const first = chartPoints[0];
		const area = `${line} L ${last.x} ${padTop + plotH} L ${first.x} ${padTop + plotH} Z`;
		return { line, area };
	});
</script>

{#if activeTab === 'dashboard'}
	<div class="mx-auto max-w-7xl space-y-6">
		<!-- 1. B2B Compliance OS Dashboard Funnel (Matches Screenshot 2 media_1789073462629.png) -->
		<div
			class="via-stone-850 rounded-2xl border-none bg-gradient-to-r from-stone-500 to-stone-900 p-6 text-stone-200 shadow-xl"
		>
			<div class="mb-5 flex items-center justify-between">
				<div>
					<h3 class="flex items-center gap-2 text-[15.5px] font-bold text-white">
						<Award class="size-4.5 text-emerald-400" />
						Комплексна комплаєнс-воронка (Digital Platform Compliance OS)
					</h3>
					<p class="mt-0.5 text-[12.5px] text-stone-400">
						Аналітичний зріз верифікації та ризиків за вимогами DAC7 (OECD DPI)
					</p>
				</div>
				<span
					class="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/20 px-2.5 py-0.5 text-[11.5px] font-medium text-emerald-300"
				>
					Live Sync
				</span>
			</div>

			<div class="grid grid-cols-2 gap-3 text-center md:grid-cols-6">
				<div class="rounded-xl border border-white/10 bg-white/5 p-3.5">
					<div class="text-[11px] font-semibold tracking-wider text-stone-400 uppercase">
						Виконавці
					</div>
					<div class="mt-1 text-[20px] font-bold text-white tabular-nums">
						{stats.totalSellers.toLocaleString('uk-UA')}
					</div>
					<div class="mt-1 text-[11px] text-stone-500">100% профілів</div>
				</div>

				<div class="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3.5">
					<div class="text-[11px] font-semibold tracking-wider text-emerald-400 uppercase">
						Верифіковано
					</div>
					<div class="mt-1 text-[20px] font-bold text-emerald-300 tabular-nums">
						{stats.verifiedSellers.toLocaleString('uk-UA')}
					</div>
					<div class="mt-1 text-[11px] text-emerald-500/80">
						{stats.totalSellers > 0
							? Math.round((stats.verifiedSellers / stats.totalSellers) * 100)
							: 0}% успішних
					</div>
				</div>

				<div class="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3.5">
					<div class="text-[11px] font-semibold tracking-wider text-amber-400 uppercase">
						Потрібен TIN
					</div>
					<div class="mt-1 text-[20px] font-bold text-amber-300 tabular-nums">
						{stats.needTin.toLocaleString('uk-UA')}
					</div>
					<div class="mt-1 text-[11px] text-amber-500/80">Немає РНОКПП</div>
				</div>

				<div class="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3.5">
					<div class="text-[11px] font-semibold tracking-wider text-amber-400 uppercase">
						Потрібна адреса
					</div>
					<div class="mt-1 text-[20px] font-bold text-amber-300 tabular-nums">
						{stats.needAddress.toLocaleString('uk-UA')}
					</div>
					<div class="mt-1 text-[11px] text-amber-500/80">Немає адреси</div>
				</div>

				<div class="rounded-xl border border-red-500/20 bg-red-500/10 p-3.5">
					<div class="text-[11px] font-semibold tracking-wider text-red-400 uppercase">
						Заблоковано
					</div>
					<div class="mt-1 text-[20px] font-bold text-red-300 tabular-nums">
						{stats.blockedSellers.toLocaleString('uk-UA')}
					</div>
					<div class="mt-1 text-[11px] text-red-500/80">AML / Фінмон</div>
				</div>

				<div class="rounded-xl border border-white/10 bg-white/5 p-3.5">
					<div class="text-[11px] font-semibold tracking-wider text-stone-400 uppercase">
						На розгляді
					</div>
					<div class="mt-1 text-[20px] font-bold text-white tabular-nums">
						{stats.underReview.toLocaleString('uk-UA')}
					</div>
					<div class="mt-1 text-[11px] text-stone-500">Арбітраж KYC</div>
				</div>
			</div>
		</div>

		<!-- 2. Interactive Data Collection Campaign Manager + Compliance Score -->
		<div class="grid gap-5 md:grid-cols-[1.5fr_1fr]">
			<!-- Left: Campaign Manager -->
			<div
				class="flex flex-col justify-between rounded-2xl border border-stone-200/70 bg-white p-6 shadow-sm"
			>
				<div>
					<div class="mb-3 flex items-center gap-2">
						<Mail class="size-4.5 text-stone-500" />
						<h3 class="text-[14.5px] font-bold text-stone-900">
							Мобілізація збору даних (Data Collection Campaign)
						</h3>
					</div>
					<p class="mb-4 text-[13px] leading-relaxed text-stone-600">
						Автоматичне надсилання серії пуш-повідомлень, SMS та email нагадувань продавцям, у яких
						відсутні критичні комплаєнс-дані для річного звіту DAC7.
					</p>

					<div class="mb-4 grid grid-cols-2 gap-4">
						<div>
							<label
								for="campaign-target"
								class="mb-1 block text-[11px] font-medium text-stone-500"
							>
								Цільова група продавців
							</label>
							<select
								id="campaign-target"
								bind:value={campaignTarget}
								disabled={campaignRunning}
								class="h-9 w-full cursor-pointer rounded-lg border border-stone-200 bg-white px-2 text-[12.5px] outline-none"
							>
								<option value="needTin">
									Продавці без TIN ({stats.needTin.toLocaleString('uk-UA')} осіб)
								</option>
								<option value="needAddress">
									Продавці без адреси ({stats.needAddress.toLocaleString('uk-UA')} осіб)
								</option>
							</select>
						</div>
						<div>
							<label
								for="campaign-channel"
								class="mb-1 block text-[11px] font-medium text-stone-500"
							>
								Канал надсилання нагадувань
							</label>
							<select
								id="campaign-channel"
								bind:value={campaignChannel}
								disabled={campaignRunning}
								class="h-9 w-full cursor-pointer rounded-lg border border-stone-200 bg-white px-2 text-[12.5px] outline-none"
							>
								<option value="email">Email Кампанія (SaaS Mailer)</option>
								<option value="telegram">Telegram Бот-нотифікації</option>
								<option value="sms">SMS-сповіщення (AlfaSMS)</option>
								<option value="push">In-App Push (Firebase)</option>
							</select>
						</div>
					</div>
				</div>

				<div class="space-y-3">
					{#if campaignRunning}
						<div class="animate-fadeIn space-y-1.5">
							<div class="flex justify-between text-[12px] font-medium text-stone-700">
								<span>Триває розсилка...</span>
								<span>{campaignProgress}%</span>
							</div>
							<div class="h-2 w-full overflow-hidden rounded-full bg-stone-200">
								<div
									class="h-full bg-emerald-500 transition-all duration-300"
									style="width: {campaignProgress}%"
								></div>
							</div>
						</div>
					{:else}
						<button
							type="button"
							onclick={triggerCampaign}
							class="hover:bg-stone-850 flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-stone-900 text-[13px] font-bold text-white transition"
						>
							<Send class="size-4" />
							<span>Запустити кампанію нагадувань</span>
						</button>
					{/if}
				</div>
			</div>

			<!-- Right: Compliance Score (Glass) -->
			<div
				class="flex flex-col justify-between rounded-2xl border border-white/70 bg-white/60 p-6 shadow-sm backdrop-blur-xl"
			>
				<div>
					<div class="mb-4 flex items-center justify-between">
						<span class="text-[15px] font-bold text-stone-900">Compliance Score платформи</span>
						<span
							class="inline-flex items-center gap-1.5 rounded-full border border-emerald-100/50 bg-emerald-50 px-2.5 py-0.5 text-[11.5px] font-medium text-emerald-700"
						>
							{stats.complianceScore}%
						</span>
					</div>
					<div class="mb-5 h-2 overflow-hidden rounded-full bg-stone-200">
						<div
							class="h-full rounded-full bg-emerald-500 transition-all duration-500"
							style="width: {stats.complianceScore}%"
						></div>
					</div>
					<div class="space-y-2.5">
						{#each [{ n: stats.unresolvedCount.kyc, t: 'не пройшли KYC — посилання застаріло' }, { n: stats.unresolvedCount.iban, t: 'IBAN не підтверджені' }, { n: stats.unresolvedCount.name, t: 'змінили ПІБ — повторна Дія' }, { n: stats.unresolvedCount.sanctions, t: 'санкційний збіг — заблоковано' }] as r}
							<button
								type="button"
								onclick={() => navigateTo('sellers')}
								class="group flex w-full cursor-pointer items-start gap-3 rounded-lg px-2 py-1.5 text-left transition hover:bg-white/70"
							>
								<span class="w-6 shrink-0 text-[13.5px] font-bold text-stone-900 tabular-nums">
									{r.n}
								</span>
								<span class="flex-1 text-[13px] leading-snug text-stone-600">{r.t}</span>
								<ChevronRight
									class="mt-0.5 size-4 text-stone-300 transition group-hover:text-stone-900"
								/>
							</button>
						{/each}
					</div>
				</div>
			</div>
		</div>

		<!-- 3. 4 Stat Cards -->
		<div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
			<!-- Stat 1 -->
			<button
				type="button"
				onclick={() => navigateTo('payouts')}
				class="cursor-pointer rounded-2xl border border-white/70 bg-white/60 p-5 text-left shadow-sm backdrop-blur-xl transition hover:bg-white/80"
			>
				<div class="flex items-center justify-between">
					<div class="text-[11px] font-medium tracking-[0.16em] text-stone-400 uppercase">
						Виплачено сьогодні
					</div>
					<span class="text-[10px] text-stone-300">↗</span>
				</div>
				<div
					class="mt-2 text-[26px] leading-none font-semibold tracking-tight text-stone-900 tabular-nums"
				>
					{stats.paidToday}
				</div>
				<div class="mt-2 text-[12.5px] text-stone-500">{stats.payoutsCount}</div>
			</button>

			<!-- Stat 2 -->
			<button
				type="button"
				onclick={() => navigateTo('payouts')}
				class="cursor-pointer rounded-2xl border border-white/70 bg-white/60 p-5 text-left shadow-sm backdrop-blur-xl transition hover:bg-white/80"
			>
				<div class="flex items-center justify-between">
					<div class="text-[11px] font-medium tracking-[0.16em] text-stone-400 uppercase">
						Заплановано в батчах · 21:00
					</div>
					<span class="text-[10px] text-stone-300">↗</span>
				</div>
				<div
					class="mt-2 text-[26px] leading-none font-semibold tracking-tight text-stone-900 tabular-nums"
				>
					{stats.scheduled}
				</div>
				<div class="mt-2 text-[12.5px] text-stone-500">1 847 продавців · 1 переказ кожному</div>
			</button>

			<!-- Stat 3 -->
			<button
				type="button"
				onclick={() => navigateTo('sellers')}
				class="cursor-pointer rounded-2xl border border-white/70 bg-white/60 p-5 text-left shadow-sm backdrop-blur-xl transition hover:bg-white/80"
			>
				<div class="flex items-center justify-between">
					<div class="text-[11px] font-medium tracking-[0.16em] text-stone-400 uppercase">
						Очікують верифікації
					</div>
					<span class="text-[10px] text-stone-300">↗</span>
				</div>
				<div
					class="mt-2 text-[26px] leading-none font-semibold tracking-tight text-amber-600 tabular-nums"
				>
					{stats.pendingKyc}
				</div>
				<div class="mt-2 text-[12.5px] text-stone-500">KYC-черга · SLA 4 год</div>
			</button>

			<!-- Stat 4 -->
			<button
				type="button"
				onclick={() => navigateTo('dac7')}
				class="cursor-pointer rounded-2xl border border-white/70 bg-white/60 p-5 text-left shadow-sm backdrop-blur-xl transition hover:bg-white/80"
			>
				<div class="flex items-center justify-between">
					<div class="text-[11px] font-medium tracking-[0.16em] text-stone-400 uppercase">
						DAC7 Ready
					</div>
					<span class="text-[10px] text-stone-300">↗</span>
				</div>
				<div
					class="mt-2 text-[26px] leading-none font-semibold tracking-tight text-stone-900 tabular-nums"
				>
					{stats.complianceScore}.4%
				</div>
				<div class="mt-2 text-[12.5px] text-stone-500">2026-Q3 · 1 254 профілі в роботі</div>
			</button>
		</div>

		<!-- 4. Lower Grid: 12-Month Area Chart & Tax Agent Card -->
		<div class="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
			<!-- 12-Month Area Chart -->
			<div class="rounded-2xl border border-stone-200/70 bg-white p-6 shadow-sm">
				<div class="mb-4 flex items-center justify-between">
					<span class="text-[15px] font-semibold text-stone-900">
						Виплати та податки · 12 міс
					</span>
					<div class="flex items-center gap-3">
						<div class="flex items-center gap-1.5 text-xs text-stone-600">
							<span class="size-2 rounded-sm bg-stone-900"></span>
							<span>Виплати</span>
						</div>
						<div class="flex items-center gap-1.5 text-xs text-stone-600">
							<span class="size-2 rounded-sm bg-emerald-600"></span>
							<span>Податки</span>
						</div>
						<span class="rounded-full bg-stone-100 px-2 py-0.5 text-[11.5px] text-stone-600">
							млн ₴
						</span>
					</div>
				</div>

				<!-- SVG Area Chart -->
				<div class="flex h-[280px] w-full items-center justify-center">
					<svg
						viewBox="0 0 {chartWidth} {chartHeight}"
						class="h-full w-full overflow-visible font-sans"
					>
						<defs>
							<linearGradient id="gp2" x1="0" y1="0" x2="0" y2="1">
								<stop offset="0%" stop-color="#0c0a09" stop-opacity="0.12" />
								<stop offset="100%" stop-color="#0c0a09" stop-opacity="0" />
							</linearGradient>
							<linearGradient id="gt2" x1="0" y1="0" x2="0" y2="1">
								<stop offset="0%" stop-color="#059669" stop-opacity="0.25" />
								<stop offset="100%" stop-color="#059669" stop-opacity="0" />
							</linearGradient>
						</defs>

						<!-- Horizontal Gridlines -->
						{#each [0, 25, 50, 75, 100] as tick}
							{@const y = padTop + plotH - (tick / maxVal) * plotH}
							<line
								x1={padLeft}
								y1={y}
								x2={padLeft + plotW}
								y2={y}
								stroke="#e7e5e4"
								stroke-dasharray="2 4"
							/>
							<text x={padLeft - 8} y={y + 3.5} text-anchor="end" font-size="11" fill="#78716c">
								{tick}
							</text>
						{/each}

						<!-- Areas -->
						{#if payoutsPath}
							<path d={payoutsPath.area} fill="url(#gp2)" />
							<path d={payoutsPath.line} fill="none" stroke="#0c0a09" stroke-width="1.8" />
						{/if}

						{#if taxPath}
							<path d={taxPath.area} fill="url(#gt2)" />
							<path d={taxPath.line} fill="none" stroke="#059669" stroke-width="1.8" />
						{/if}

						<!-- X-Axis Labels -->
						{#each chartPoints as pt}
							<text x={pt.x} y={chartHeight - 6} text-anchor="middle" font-size="11" fill="#78716c">
								{pt.m}
							</text>
						{/each}
					</svg>
				</div>
			</div>

			<!-- Right Column: Tax Agent Card & Live Payout Stream -->
			<div class="flex flex-col gap-5">
				<!-- Tax Agent Card -->
				<div class="rounded-2xl border border-stone-200/70 bg-white p-6 shadow-sm">
					<div class="mb-4 flex items-center justify-between border-b border-stone-100 pb-3">
						<span class="flex items-center gap-2 text-[15px] font-semibold text-stone-900">
							<Award class="size-4 text-emerald-600" />
							Податковий агент
						</span>
					</div>
					<div class="divide-y divide-stone-100">
						<div class="flex items-center justify-between py-2.5">
							<span class="text-[13px] text-stone-500">Утримано ПДФО + ВЗ (10%)</span>
							<span class="text-[13.5px] font-semibold text-stone-900">{stats.pdxo}</span>
						</div>
						<div class="flex items-center justify-between py-2.5">
							<span class="text-[13px] text-stone-500">Відправлено в Казначейство</span>
							<span class="text-[13.5px] font-semibold text-stone-900">8 968 400 ₴</span>
						</div>
						<div class="flex items-center justify-between py-2.5">
							<span class="text-[13px] text-stone-500">Наступний кліринг</span>
							<span class="text-[13.5px] font-medium text-stone-900">Сьогодні · 18:00</span>
						</div>
					</div>
				</div>

				<!-- Live Payout Stream Card -->
				<div
					class="flex-1 overflow-hidden rounded-2xl border border-stone-200/70 bg-white shadow-sm"
				>
					<div class="flex items-center justify-between border-b border-stone-100 px-6 py-4">
						<span class="flex items-center gap-2 text-[15px] font-semibold text-stone-900">
							<Activity class="size-4 text-emerald-600" />
							Live Payout Stream
						</span>
						<span
							class="inline-flex items-center gap-1.5 rounded-full border border-emerald-100/50 bg-emerald-50 px-2.5 py-0.5 text-[11.5px] font-medium text-emerald-700"
						>
							<span class="size-1.5 rounded-full bg-emerald-500"></span>
							live
						</span>
					</div>

					<div class="divide-y divide-stone-50">
						{#each filteredPayouts as p}
							<button
								type="button"
								onclick={() => navigateTo('payouts')}
								class="flex w-full cursor-pointer items-center justify-between px-6 py-3 text-left transition hover:bg-stone-50"
							>
								<div>
									<div class="text-[13.5px] font-medium text-stone-900">{p.seller}</div>
									<div class="font-mono text-[11.5px] text-stone-400">
										{p.displayId} · {p.date}
									</div>
								</div>
								<div class="flex items-center gap-3">
									<span class="text-[13.5px] font-semibold text-stone-900 tabular-nums">
										{fmt(p.net)} ₴
									</span>
									<span
										class="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium {PO_META[
											p.st
										]?.t === 'ok'
											? 'border border-emerald-100/50 bg-emerald-50 text-emerald-700'
											: 'border border-amber-100/50 bg-amber-50 text-amber-700'}"
									>
										{PO_META[p.st]?.l || p.st}
									</span>
								</div>
							</button>
						{/each}
					</div>
				</div>
			</div>
		</div>
	</div>
{:else if activeTab === 'sellers'}
	<!-- Sub-tab: Sellers table -->
	<div class="mx-auto max-w-7xl space-y-6">
		<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
			<div>
				<h2 class="text-[18px] font-bold text-stone-900">Виконавці та комплаєнс-профілі</h2>
				<p class="mt-0.5 text-xs text-stone-500">
					База підключених кур'єрів, водіїв та мерчантів платформи Bolt Food
				</p>
			</div>

			<div class="flex flex-wrap items-center gap-2">
				<!-- Category Filter -->
				<select
					bind:value={sellerCategory}
					onchange={() => (sellerPage = 1)}
					class="h-9 cursor-pointer rounded-full border border-stone-200 bg-white px-3.5 text-xs text-stone-700 shadow-xs outline-none focus:border-stone-400"
				>
					<option value="all">Всі категорії субʼєктів</option>
					<option value="platform_gig">Гіг-виконавці (10% ПДФО)</option>
					<option value="fop">ФОП (1, 2, 3 групи)</option>
					<option value="goods_casual">Товари (De Minimis)</option>
					<option value="property_rental">Оренда нерухомості</option>
					<option value="transport_rental">Оренда авто</option>
					<option value="independent_pro">Незалежні профі (ст. 178)</option>
					<option value="corporate_entity">Корпоративні (VARUS)</option>
					<option value="excluded_seller">Виключені продавці</option>
				</select>

				<!-- City Filter -->
				<select
					bind:value={sellerCity}
					onchange={() => (sellerPage = 1)}
					class="h-9 cursor-pointer rounded-full border border-stone-200 bg-white px-3.5 text-xs text-stone-700 shadow-xs outline-none focus:border-stone-400"
				>
					<option value="all">Всі міста</option>
					{#each citiesList.filter((c) => c !== 'all') as city}
						<option value={city}>{city}</option>
					{/each}
				</select>

				<!-- Search Input -->
				<div class="relative">
					<Search class="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-stone-400" />
					<input
						type="text"
						bind:value={sellerSearch}
						oninput={() => (sellerPage = 1)}
						placeholder="Пошук за ПІБ, ID, РНОКПП або містом..."
						class="h-9 w-64 rounded-full border border-stone-200 bg-white pr-4 pl-9 text-xs shadow-xs outline-none"
					/>
				</div>

				<!-- Export Button -->
				<button
					type="button"
					onclick={exportSellersCsv}
					class="flex h-9 cursor-pointer items-center gap-2 rounded-full border border-stone-200 bg-white px-4 text-xs font-semibold text-stone-700 shadow-xs transition hover:bg-stone-50"
				>
					<Download class="size-3.5" />
					<span>Експорт CSV</span>
				</button>
			</div>
		</div>

		<!-- Segmented Filter Buttons with Badges -->
		<div class="flex w-fit flex-wrap gap-1 rounded-full border border-stone-200 bg-stone-50 p-1">
			{#each [{ id: 'all', l: 'Всі виконавці', n: sellerCounts.all }, { id: 'tier2', l: 'Tier-2 Дія', n: sellerCounts.tier2 }, { id: 'tier1', l: 'Tier-1 СЕП', n: sellerCounts.tier1 }, { id: 'pending', l: 'Очікують KYC', n: sellerCounts.pending }, { id: 'blocked', l: 'Заблоковані', n: sellerCounts.blocked }] as f}
				<button
					type="button"
					onclick={() => {
						sellerFilter = f.id;
						sellerPage = 1;
					}}
					class="flex h-7 cursor-pointer items-center gap-1.5 rounded-full px-3 text-xs font-medium transition {sellerFilter ===
					f.id
						? 'bg-stone-900 text-white shadow-xs'
						: 'text-stone-500 hover:text-stone-900'}"
				>
					<span>{f.l}</span>
					<span
						class="py-0.2 rounded-full px-1.5 text-[10px] font-bold {sellerFilter === f.id
							? 'bg-white/20 text-white'
							: 'bg-stone-200 text-stone-600'}"
					>
						{f.n}
					</span>
				</button>
			{/each}
		</div>

		<!-- Table -->
		<div class="overflow-hidden rounded-2xl border border-stone-200/70 bg-white shadow-sm">
			<table class="w-full text-left text-xs">
				<thead
					class="border-b border-stone-100 bg-stone-50/80 font-semibold tracking-wider text-stone-400 uppercase"
				>
					<tr>
						<th class="p-4 px-6">Виконавець / ID</th>
						<th class="p-4">Категорія суб'єкта</th>
						<th class="p-4">Податковий режим</th>
						<th class="p-4">Місто</th>
						<th class="p-4">KYC Статус</th>
						<th class="p-4">РНОКПП / ЄДРПОУ</th>
						<th class="p-4 text-right">Обіг YTD</th>
						<th class="p-4 px-6 text-right">Дія</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-stone-100">
					{#each paginatedSellers as s}
						<tr class="transition hover:bg-stone-50/70">
							<td class="p-4 px-6">
								<div class="font-bold text-stone-900">{s.name}</div>
								<div class="font-mono text-[11px] text-stone-400">{s.id} · {s.role}</div>
							</td>
							<td class="p-4">
								<span
									class="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold {CATEGORY_META[
										s.category
									]?.badgeClass || 'border-stone-200 bg-stone-100 text-stone-700'}"
								>
									{CATEGORY_META[s.category]?.shortLabel || s.category}
								</span>
							</td>
							<td class="p-4">
								<div class="text-[11.5px] font-semibold text-stone-800">
									{CATEGORY_META[s.category]?.taxRateDisplay || '10% ПДФО'}
								</div>
								<div class="text-[10px] text-stone-400">
									{#if s.category === 'platform_gig'}
										Військовий збір: 0 ₴
									{:else if s.category === 'fop'}
										ЄП 3 гр (5%) самостійно
									{:else if s.category === 'goods_casual'}
										{s.deMinimis?.isExempt ? 'До ліміту (0%)' : 'Поза лімітом (Reportable)'}
									{:else if s.category === 'property_rental'}
										Кадастр: {s.propertyDetails?.cadastralNumber ? 'Внесено' : 'Немає'}
									{:else if s.category === 'transport_rental'}
										Держномер: {s.transportDetails?.plateNumber || '—'}
									{:else if s.category === 'corporate_entity'}
										ПДВ 20% · ТОВ
									{:else}
										Звільнено від DPI
									{/if}
								</div>
							</td>
							<td class="p-4 text-stone-600">{s.city}</td>
							<td class="p-4">
								<span
									class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium {s.kyc ===
									'tier2'
										? 'bg-emerald-50 text-emerald-700'
										: s.kyc === 'pending'
											? 'bg-amber-50 text-amber-700'
											: 'bg-red-50 text-red-700'}"
								>
									{KYC_META[s.kyc]?.l || s.kyc}
								</span>
							</td>
							<td class="p-4 font-mono text-stone-700">
								{s.corporateDetails?.edrpou || s.rnokpp || 'Немає'}
							</td>
							<td class="p-4 text-right font-bold text-stone-900">{fmt(s.earned)} ₴</td>
							<td class="p-4 px-6 text-right">
								<button
									type="button"
									onclick={() => (selectedSeller = s)}
									class="cursor-pointer rounded-lg border border-stone-200 px-2.5 py-1 text-xs font-semibold text-stone-700 transition hover:bg-stone-100"
								>
									Профіль
								</button>
							</td>
						</tr>
					{:else}
						<tr>
							<td colspan="8" class="space-y-2 py-12 text-center text-stone-400">
								<div class="flex justify-center">
									<AlertTriangle class="h-8 w-8 text-stone-300" />
								</div>
								<div class="text-[13.5px] font-medium text-stone-700">
									Нічого не знайдено за цим фільтром
								</div>
								<div class="text-xs text-stone-400">
									Спробуйте змінити категорію, пошуковий запит або вибрати інше місто
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>

			<!-- Pagination Component -->
			<Dac7Pagination
				bind:currentPage={sellerPage}
				totalItems={displayedSellers.length}
				bind:pageSize={sellerPageSize}
				pageSizeOptions={[5, 10, 20]}
			/>
		</div>
	</div>
{:else if activeTab === 'payouts'}
	<!-- Sub-tab: Payouts Stream & Registry -->
	<div class="mx-auto max-w-7xl space-y-6">
		<div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
			<div>
				<h2 class="text-[18px] font-bold text-stone-900">
					Реєстр виплат (Payout Registry & Escrow)
				</h2>
				<p class="mt-0.5 text-xs text-stone-500">
					Управління миттєвими виплатами, щоденними батчами та ескроу-рахунками платформи
				</p>
			</div>
			<div class="flex items-center gap-2">
				<button
					type="button"
					onclick={exportPayoutsCsv}
					class="flex cursor-pointer items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3.5 py-2 text-xs font-semibold text-stone-700 shadow-xs transition hover:bg-stone-50"
				>
					<Download class="size-3.5" />
					<span>Експорт CSV</span>
				</button>
				<button
					type="button"
					onclick={() => (importWizardOpen = true)}
					class="flex cursor-pointer items-center gap-2 rounded-xl bg-stone-900 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-stone-800"
				>
					<Download class="size-4" />
					<span>Імпорт виплат</span>
				</button>
			</div>
		</div>

		{#if importWizardOpen}
			<ImportWizard onClose={() => (importWizardOpen = false)} />
		{/if}

		<!-- View Switcher & Search Bar -->
		<div class="flex flex-wrap items-center gap-3">
			<div class="flex gap-1 rounded-full border border-stone-200 bg-stone-50 p-1">
				{#each [{ id: 'tx', l: 'Миттєві виплати', n: feedPayouts.length }, { id: 'batch', l: 'Денні батчі', n: demoBatches.length }, { id: 'escrow', l: 'Ескроу та диспути', n: escrows.length }] as v}
					<button
						type="button"
						onclick={() => {
							payoutView = v.id as any;
							payoutStatus = 'all';
							payoutPage = 1;
						}}
						class="flex h-7 cursor-pointer items-center gap-1.5 rounded-full px-3 text-xs font-medium transition {payoutView ===
						v.id
							? 'bg-stone-900 text-white shadow-xs'
							: 'text-stone-500 hover:text-stone-900'}"
					>
						<span>{v.l}</span>
						<span
							class="py-0.2 rounded-full px-1.5 text-[10px] font-bold {payoutView === v.id
								? 'bg-white/20 text-white'
								: 'bg-stone-200 text-stone-600'}"
						>
							{v.n}
						</span>
					</button>
				{/each}
			</div>

			<!-- Search -->
			<div class="relative min-w-[200px] flex-1">
				<Search class="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-stone-400" />
				<input
					type="text"
					bind:value={payoutSearch}
					oninput={() => (payoutPage = 1)}
					placeholder="Пошук за особою, ID або SID…"
					class="h-9 w-full rounded-full border border-stone-200 bg-white pr-4 pl-9 text-xs shadow-xs outline-none"
				/>
			</div>

			<!-- Status Filter Pills -->
			<div class="flex gap-1 rounded-full border border-stone-200 bg-stone-50 p-1">
				{#each payoutView === 'tx' ? [{ id: 'all', l: 'Усі' }, { id: 'paid', l: 'Виплачено' }, { id: 'processing', l: 'В обробці' }, { id: 'hold', l: 'Hold' }, { id: 'failed', l: 'Помилки' }] : payoutView === 'batch' ? [{ id: 'all', l: 'Усі' }, { id: 'scheduled', l: 'Заплановані' }, { id: 'paid', l: 'Виплачені' }] : [{ id: 'all', l: 'Усі' }, { id: 'held', l: 'В утриманні' }, { id: 'released', l: 'Випущені' }, { id: 'disputed', l: 'Диспути' }, { id: 'refunded', l: 'Повернені' }] as st}
					<button
						type="button"
						onclick={() => {
							payoutStatus = st.id;
							payoutPage = 1;
						}}
						class="h-7 cursor-pointer rounded-full px-3 text-xs font-medium transition {payoutStatus ===
						st.id
							? 'bg-stone-900 text-white shadow-xs'
							: 'text-stone-500 hover:text-stone-900'}"
					>
						{st.l}
					</button>
				{/each}
			</div>
		</div>

		<!-- Informational Banners -->
		{#if payoutView === 'batch'}
			<div
				class="flex items-start gap-2.5 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-xs leading-snug text-sky-800"
			>
				<Layers class="mt-0.5 size-4 shrink-0" />
				<span
					>Нарахування дня агрегуються в один переказ у вікні 21:00: собівартість виплат ÷ N, 10%
					ПДФО фіксується при кожному нарахуванні.</span
				>
			</div>
		{:else if payoutView === 'escrow'}
			<div
				class="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-snug text-amber-800"
			>
				<ArrowLeftRight class="mt-0.5 size-4 shrink-0" />
				<span
					>Модель безпеки Ескроу: кошти утримуються платформою до підтвердження доставки. У разі
					скарг відкривається Диспут із можливістю повного чи часткового Refund.</span
				>
			</div>
		{/if}

		<!-- Tables Container -->
		<div class="overflow-hidden rounded-2xl border border-stone-200/70 bg-white shadow-sm">
			{#if payoutView === 'tx'}
				<!-- Instant Payouts Table -->
				<div class="overflow-x-auto">
					<table class="w-full text-left text-xs">
						<thead
							class="border-b border-stone-100 bg-stone-50/80 font-semibold tracking-wider text-stone-400 uppercase"
						>
							<tr>
								<th class="p-4 px-6">Виплата / Одержувач</th>
								<th class="p-4 text-right">Брутто</th>
								<th class="p-4 text-right">ПДФО 10%</th>
								<th class="p-4 text-right">Чистими (Net)</th>
								<th class="p-4">Рейка</th>
								<th class="p-4">Статус</th>
								<th class="p-4 px-6 text-right"></th>
							</tr>
						</thead>
						<tbody class="divide-y divide-stone-100">
							{#each paginatedTxList as p}
								<tr
									onclick={() => (selectedPayout = p)}
									class="group cursor-pointer transition hover:bg-stone-50/70"
								>
									<td class="p-4 px-6">
										<div class="font-bold text-stone-900 transition group-hover:text-emerald-700">
											{p.seller}
										</div>
										<div class="font-mono text-[11px] text-stone-400">
											{p.id} · {p.date}
										</div>
									</td>
									<td class="p-4 text-right text-stone-500 tabular-nums">{fmt(p.gross)} ₴</td>
									<td class="p-4 text-right font-semibold text-emerald-600 tabular-nums"
										>−{fmt(p.tax)} ₴</td
									>
									<td class="p-4 text-right font-bold text-stone-900 tabular-nums"
										>{fmt(p.net)} ₴</td
									>
									<td class="p-4 text-stone-600">{p.rail}</td>
									<td class="p-4">
										<span
											class="rounded-full px-2.5 py-0.5 text-xs font-semibold {PO_META[p.st]?.t ===
											'ok'
												? 'bg-emerald-50 text-emerald-700'
												: 'bg-amber-50 text-amber-700'}"
										>
											{PO_META[p.st]?.l || p.st}
										</span>
									</td>
									<td class="p-4 px-6 text-right">
										<ChevronRight
											class="inline-block size-4 text-stone-300 transition group-hover:text-stone-900"
										/>
									</td>
								</tr>
							{:else}
								<tr>
									<td colspan="7" class="py-10 text-center text-xs text-stone-400">
										Немає виплат за обраним фільтром
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>

				<Dac7Pagination
					bind:currentPage={payoutPage}
					totalItems={filteredTxList.length}
					bind:pageSize={payoutPageSize}
					pageSizeOptions={[5, 10, 20]}
				/>
			{:else if payoutView === 'batch'}
				<!-- Daily Batches Table -->
				<div class="overflow-x-auto">
					<table class="w-full text-left text-xs">
						<thead
							class="border-b border-stone-100 bg-stone-50/80 font-semibold tracking-wider text-stone-400 uppercase"
						>
							<tr>
								<th class="p-4 px-6">Батч · День</th>
								<th class="p-4 text-right">Нарахувань</th>
								<th class="p-4 text-right">Брутто</th>
								<th class="p-4 text-right">ПДФО 10%</th>
								<th class="p-4 text-right">Один переказ</th>
								<th class="p-4">Статус</th>
								<th class="p-4 px-6 text-right"></th>
							</tr>
						</thead>
						<tbody class="divide-y divide-stone-100">
							{#each paginatedBatchList as b}
								<tr
									onclick={() => (selectedBatch = b)}
									class="group cursor-pointer transition hover:bg-stone-50/70"
								>
									<td class="p-4 px-6">
										<div class="font-bold text-stone-900 transition group-hover:text-emerald-700">
											{b.seller} <span class="font-normal text-stone-400">· {b.date}</span>
										</div>
										<div class="font-mono text-[11px] text-stone-400">{b.id} · {b.eta}</div>
									</td>
									<td class="p-4 text-right text-stone-700 tabular-nums">{b.txs}</td>
									<td class="p-4 text-right text-stone-500 tabular-nums">{fmt(b.gross)} ₴</td>
									<td class="p-4 text-right font-semibold text-emerald-600 tabular-nums"
										>−{fmt(b.tax)} ₴</td
									>
									<td class="p-4 text-right font-bold text-stone-900 tabular-nums"
										>{fmt(b.net)} ₴</td
									>
									<td class="p-4">
										<span
											class="rounded-full px-2.5 py-0.5 text-xs font-semibold {PO_META[b.st]?.t ===
											'ok'
												? 'bg-emerald-50 text-emerald-700'
												: 'bg-sky-50 text-sky-700'}"
										>
											{PO_META[b.st]?.l || b.st}
										</span>
									</td>
									<td class="p-4 px-6 text-right">
										<ChevronRight
											class="inline-block size-4 text-stone-300 transition group-hover:text-stone-900"
										/>
									</td>
								</tr>
							{:else}
								<tr>
									<td colspan="7" class="py-10 text-center text-xs text-stone-400">
										Немає батчів за обраним фільтром
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>

				<Dac7Pagination
					bind:currentPage={payoutPage}
					totalItems={filteredBatchList.length}
					bind:pageSize={payoutPageSize}
					pageSizeOptions={[5, 10, 20]}
				/>
			{:else if payoutView === 'escrow'}
				<!-- Escrow & Disputes Table -->
				<div class="overflow-x-auto">
					<table class="w-full text-left text-xs">
						<thead
							class="border-b border-stone-100 bg-stone-50/80 font-semibold tracking-wider text-stone-400 uppercase"
						>
							<tr>
								<th class="p-4 px-6">Код ескроу · Дата</th>
								<th class="p-4">Виконавець (Кур'єр)</th>
								<th class="p-4">Покупець (Клієнт)</th>
								<th class="p-4 text-right">Сума (Gross)</th>
								<th class="p-4 text-right">Чистими (Net)</th>
								<th class="p-4">Статус</th>
								<th class="p-4 px-6 text-right"></th>
							</tr>
						</thead>
						<tbody class="divide-y divide-stone-100">
							{#each paginatedEscrowList as e}
								<tr
									onclick={() => (selectedEscrow = e)}
									class="group cursor-pointer transition hover:bg-stone-50/70"
								>
									<td
										class="p-4 px-6 font-mono font-bold text-stone-900 transition group-hover:text-emerald-700"
									>
										{e.id}
										<div class="font-sans text-[11px] font-normal text-stone-400">{e.date}</div>
									</td>
									<td class="p-4 font-semibold text-stone-800">{e.seller}</td>
									<td class="p-4 text-stone-600">{e.buyer}</td>
									<td class="p-4 text-right text-stone-500 tabular-nums">{fmt(e.gross)} ₴</td>
									<td class="p-4 text-right font-bold text-stone-900 tabular-nums"
										>{fmt(e.net)} ₴</td
									>
									<td class="p-4">
										<span
											class="rounded-full px-2.5 py-0.5 text-xs font-semibold {ESCROW_META[e.status]
												?.t === 'ok'
												? 'bg-emerald-50 text-emerald-700'
												: ESCROW_META[e.status]?.t === 'warn'
													? 'bg-amber-50 text-amber-700'
													: ESCROW_META[e.status]?.t === 'bad'
														? 'bg-red-50 text-red-700'
														: 'bg-stone-100 text-stone-700'}"
										>
											{ESCROW_META[e.status]?.l || e.status}
										</span>
									</td>
									<td class="p-4 px-6 text-right">
										<ChevronRight
											class="inline-block size-4 text-stone-300 transition group-hover:text-stone-900"
										/>
									</td>
								</tr>
							{:else}
								<tr>
									<td colspan="7" class="py-10 text-center text-xs text-stone-400">
										Немає угод за обраним фільтром
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>

				<Dac7Pagination
					bind:currentPage={payoutPage}
					totalItems={filteredEscrowList.length}
					bind:pageSize={payoutPageSize}
					pageSizeOptions={[5, 10, 20]}
				/>
			{/if}
		</div>
	</div>
{:else if activeTab === 'taxes'}
	<!-- Sub-tab: Taxes -->
	<div class="mx-auto max-w-7xl space-y-6">
		<h2 class="text-[18px] font-bold text-stone-900">Податкове адміністрування (Tax Settlement)</h2>

		<div class="grid gap-4 sm:grid-cols-3">
			<div class="rounded-2xl border border-stone-200/70 bg-white p-6 shadow-sm">
				<div class="text-xs font-semibold tracking-wider text-stone-500 uppercase">
					Утримано податків за місяць
				</div>
				<div class="mt-2 text-2xl font-bold text-stone-900">{stats.pdxo}</div>
				<p class="mt-1 text-xs text-stone-500">10% ставка ПДФО з платформних доходів</p>
			</div>
			<div class="rounded-2xl border border-stone-200/70 bg-white p-6 shadow-sm">
				<div class="text-xs font-semibold tracking-wider text-stone-500 uppercase">
					Перераховано до Казначейства
				</div>
				<div class="mt-2 text-2xl font-bold text-emerald-600">8 968 400 ₴</div>
				<p class="mt-1 text-xs text-stone-500">Реєстр платіжних інструкцій СЕП</p>
			</div>
			<div class="rounded-2xl border border-stone-200/70 bg-white p-6 shadow-sm">
				<div class="text-xs font-semibold tracking-wider text-stone-500 uppercase">
					Податковий статус платформи
				</div>
				<div class="mt-2 text-2xl font-bold text-stone-900">Compliant 100%</div>
				<p class="mt-1 text-xs font-semibold text-emerald-600">Заборгованість відсутня</p>
			</div>
		</div>

		<!-- Comprehensive Tax Reconciliation and Tools -->
		<Dac7TaxReconciliation {demo} />
	</div>
{:else if activeTab === 'dac7'}
	<!-- Sub-tab: DAC7 XML Generation -->
	<div class="mx-auto max-w-7xl space-y-6">
		<div class="flex items-center justify-between">
			<div>
				<h2 class="text-[18px] font-bold text-stone-900">DAC7 / DPI Звітність (OECD XSD)</h2>
				<p class="mt-0.5 text-xs text-stone-500">
					Формування та подання щорічного реєстру активних продавців до ДПС України
				</p>
			</div>
			<button
				type="button"
				onclick={generateDac7Xml}
				class="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-stone-900 px-4 py-2 text-xs font-bold text-white transition hover:bg-stone-800"
			>
				<Download class="size-4" />
				<span>Згенерувати DPI XML</span>
			</button>
		</div>

		<div class="rounded-2xl border border-stone-200/70 bg-white p-6 shadow-sm">
			<div class="mb-2 text-sm font-bold text-stone-900">Статус валідації схеми DPI OECD</div>
			<div class="mb-4 flex items-center gap-2 text-xs font-semibold text-emerald-700">
				<CircleCheck class="size-4 text-emerald-600" />
				<span>Всі поля відповідають специфікації DPI_XML_Schema_v1.0 (OECD)</span>
			</div>
			<p class="text-xs leading-relaxed text-stone-600">
				Звіт включає 128 412 продавців, сумарний обіг, утримані податкові відрахування, валідовані
				РНОКПП та географічні адреси резидентів.
			</p>
		</div>
	</div>
{:else if activeTab === 'sim'}
	<!-- Sub-tab: Simulator (VARUS Platform & Incident Recovery) -->
	<div class="mx-auto max-w-7xl space-y-6">
		<div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
			<div>
				<h2 class="text-[18px] font-bold text-stone-900">
					Симулятор платіжних потоків, інцидентів та ERP-сторнування
				</h2>
				<p class="mt-1 text-xs text-stone-500">
					Тестування автоматичної синхронізації 3-х Леджерів (Payment, Income, Payout) для штатних
					та позаштатних ситуацій
				</p>
			</div>
			<span
				class="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800"
			>
				Swiss Clockwork Engine
			</span>
		</div>

		<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
			<!-- 1. Happy Path -->
			<div class="space-y-3 rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm">
				<div class="flex items-center justify-between">
					<span class="flex items-center gap-1.5 text-sm font-bold text-stone-900">
						<CircleCheck class="size-4 text-emerald-600" />
						1. Штатна успішна доставка (DELIVERED)
					</span>
					<span
						class="rounded bg-emerald-100 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-800"
						>930 ₴</span
					>
				</div>
				<p class="text-xs leading-relaxed text-stone-600">
					Клієнт сплатив 930 ₴ (850 ₴ товари + 80 ₴ доставка). Курʼєр успішно вручив пакунок.
					Нараховано 100 ₴ (з бонусом). Утримано 10% ПДФО (10 ₴), виплата 90 ₴.
				</p>
				<button
					type="button"
					onclick={() =>
						alert(
							'✅ Успішно!\nPayment Ledger: +930 ₴ (Captured)\nCourier Income Ledger: +100 ₴ (DELIVERED)\nPayout Ledger: +90 ₴ (10% ПДФО = 10 ₴)\nУсі три леджери зведено в 0.00 ₴.'
						)}
					class="w-full cursor-pointer rounded-xl bg-stone-900 py-2.5 text-xs font-bold text-white transition hover:bg-stone-800"
				>
					Симулювати успішну доставку
				</button>
			</div>

			<!-- 2. Undelivered / Lost -->
			<div class="space-y-3 rounded-2xl border border-red-200 bg-white p-5 shadow-sm">
				<div class="flex items-center justify-between">
					<span class="flex items-center gap-1.5 text-sm font-bold text-stone-900">
						<TriangleAlert class="size-4 text-red-600" />
						2. Курʼєр не довіз вантаж (UNDELIVERED)
					</span>
					<span class="rounded bg-red-100 px-2 py-0.5 font-mono text-[10px] font-bold text-red-800"
						>Втрата</span
					>
				</div>
				<p class="text-xs leading-relaxed text-stone-600">
					Курʼєр зник або потрапив у ДТП. Клієнту повертається 100% (930 ₴). Винагорода курʼєру 0 ₴
					(запис в Income Ledger НЕ створюється, ПДФО = 0 ₴).
				</p>
				<button
					type="button"
					onclick={() =>
						alert(
							'⚠️ Інцидент оброблено:\nPayment Ledger: REFUND 930 ₴ клієнту\nCourier Income Ledger: Не нараховується (статус FAILED)\nПодаток ПДФО 10%: 0.00 ₴ (база відсутня)\nУ звіті DAC7 жодних помилкових нарахувань!'
						)}
					class="w-full cursor-pointer rounded-xl border border-red-200 bg-red-50 py-2.5 text-xs font-bold text-red-700 transition hover:bg-red-100"
				>
					Симулювати втрату замовлення
				</button>
			</div>

			<!-- 3. Damaged by Courier -->
			<div class="space-y-3 rounded-2xl border border-amber-200 bg-white p-5 shadow-sm">
				<div class="flex items-center justify-between">
					<span class="flex items-center gap-1.5 text-sm font-bold text-stone-900">
						<AlertTriangle class="size-4 text-amber-600" />
						3. Пошкоджено товар з вини курʼєра
					</span>
					<span
						class="rounded bg-amber-100 px-2 py-0.5 font-mono text-[10px] font-bold text-amber-800"
						>Претензія</span
					>
				</div>
				<p class="text-xs leading-relaxed text-stone-600">
					Розбито пляшки вина на 340 ₴. Клієнту часткове повернення 340 ₴. Винагорода курʼєра
					анулюється (ADJUSTED). ПДФО 10% сторнується в обліку.
				</p>
				<button
					type="button"
					onclick={() =>
						alert(
							'🔄 Сторновано:\nPayment Ledger: PARTIAL_REFUND 340 ₴\nCourier Income Ledger: ADJUSTED (Gross = 0 ₴)\nПодаткова проводка: Дт 685 — Кт 6411 СТОРНО 10 ₴\nСтворено запис у dac7_incidents_log.'
						)}
					class="w-full cursor-pointer rounded-xl border border-amber-200 bg-amber-50 py-2.5 text-xs font-bold text-amber-800 transition hover:bg-amber-100"
				>
					Симулювати пошкодження товару
				</button>
			</div>

			<!-- 4. Courier Reassignment -->
			<div class="space-y-3 rounded-2xl border border-sky-200 bg-white p-5 shadow-sm">
				<div class="flex items-center justify-between">
					<span class="flex items-center gap-1.5 text-sm font-bold text-stone-900">
						<Zap class="size-4 text-sky-600" />
						4. Поломка транспорту (Перепризначення)
					</span>
					<span class="rounded bg-sky-100 px-2 py-0.5 font-mono text-[10px] font-bold text-sky-800"
						>Split x2</span
					>
				</div>
				<p class="text-xs leading-relaxed text-stone-600">
					Курʼєр 1 зламався біля ресторану. Диспетчер передав замовлення Курʼєру 2. Курʼєр 1: 20 ₴
					(подача, ПДФО 2 ₴). Курʼєр 2: 80 ₴ (доставка, ПДФО 8 ₴).
				</p>
				<button
					type="button"
					onclick={() =>
						alert(
							'👥 Перепризначення виконано:\nКурʼєр 1 (Олексій): +20 ₴ Gross (ПДФО 2 ₴)\nКурʼєр 2 (Сергій): +80 ₴ Gross (ПДФО 8 ₴)\nОбидва курʼєри отримують окремі коректні записи в DAC7 річний звіт!'
						)}
					class="w-full cursor-pointer rounded-xl border border-sky-200 bg-sky-50 py-2.5 text-xs font-bold text-sky-800 transition hover:bg-sky-100"
				>
					Симулювати перепризначення рейсу
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Drawers -->
<SellerDrawer seller={selectedSeller} onClose={() => (selectedSeller = null)} />
<PayoutDrawer payout={selectedPayout} onClose={() => (selectedPayout = null)} />

<!-- Batch Details Modal -->
{#if selectedBatch}
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4">
		<button
			type="button"
			aria-label="Закрити"
			class="absolute inset-0 cursor-default border-none bg-stone-900/50 p-0 backdrop-blur-xs"
			onclick={() => (selectedBatch = null)}
		></button>
		<div
			class="relative flex max-h-[90vh] w-full max-w-lg flex-col space-y-5 rounded-2xl bg-white p-6 shadow-2xl"
		>
			<div class="flex items-center justify-between border-b border-stone-100 pb-3">
				<div>
					<h3 class="text-base font-bold text-stone-900">Деталі денного батчу</h3>
					<div class="font-mono text-xs text-stone-400">
						{selectedBatch.id} · {selectedBatch.date}
					</div>
				</div>
				<button
					type="button"
					onclick={() => (selectedBatch = null)}
					class="cursor-pointer rounded-lg p-1 text-stone-400 hover:bg-stone-100"
				>
					<X class="size-4" />
				</button>
			</div>

			<div class="space-y-2 rounded-xl border border-stone-100 bg-stone-50 p-4 text-xs">
				<div class="flex justify-between border-b border-stone-200/50 py-1">
					<span class="text-stone-500">Одержувач:</span>
					<span class="font-semibold text-stone-900">{selectedBatch.seller}</span>
				</div>
				<div class="flex justify-between border-b border-stone-200/50 py-1">
					<span class="text-stone-500">Рейка виплати:</span>
					<span class="font-medium text-stone-800">СЕП · A2A (ISO 20022)</span>
				</div>
				<div class="flex justify-between border-b border-stone-200/50 py-1">
					<span class="text-stone-500">Брутто за день:</span>
					<span class="font-mono text-stone-800 tabular-nums">{fmt(selectedBatch.gross)} ₴</span>
				</div>
				<div class="flex justify-between border-b border-stone-200/50 py-1">
					<span class="text-stone-500">Утримано 10% ПДФО:</span>
					<span class="font-mono font-semibold text-emerald-600 tabular-nums"
						>−{fmt(selectedBatch.tax)} ₴</span
					>
				</div>
				<div class="flex justify-between border-b border-stone-200/50 py-1">
					<span class="text-stone-500">Кількість нарахувань:</span>
					<span class="font-semibold text-stone-900">{selectedBatch.txs} замовлень</span>
				</div>
				<div class="flex justify-between py-1 text-sm font-bold text-stone-900">
					<span>До виплати одним переказом:</span>
					<span class="text-emerald-700 tabular-nums">{fmt(selectedBatch.net)} ₴</span>
				</div>
			</div>

			<div
				class="rounded-xl border border-sky-100 bg-sky-50 p-3.5 text-xs leading-relaxed text-sky-800"
			>
				<div class="mb-0.5 font-bold">Платіжне вікно: {selectedBatch.eta}</div>
				Автоматичне списання з транзитного рахунку ескроу та зарахування на спецрахунок кур'єра в СЕП-4.
			</div>

			<div class="flex justify-end pt-2">
				<button
					type="button"
					onclick={() => (selectedBatch = null)}
					class="cursor-pointer rounded-xl bg-stone-900 px-4 py-2 text-xs font-bold text-white transition hover:bg-stone-800"
				>
					Зрозуміло
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Escrow Details & Dispute Management Modal -->
{#if selectedEscrow}
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4">
		<button
			type="button"
			aria-label="Закрити"
			class="absolute inset-0 cursor-default border-none bg-stone-900/50 p-0 backdrop-blur-xs"
			onclick={() => (selectedEscrow = null)}
		></button>
		<div
			class="relative flex max-h-[90vh] w-full max-w-xl flex-col space-y-5 overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"
		>
			<div class="flex items-center justify-between border-b border-stone-100 pb-3">
				<div>
					<h3 class="text-base font-bold text-stone-900">Деталі ескроу угоди</h3>
					<div class="font-mono text-xs text-stone-400">
						{selectedEscrow.id} · {selectedEscrow.date}
					</div>
				</div>
				<button
					type="button"
					onclick={() => (selectedEscrow = null)}
					class="cursor-pointer rounded-lg p-1 text-stone-400 hover:bg-stone-100"
				>
					<X class="size-4" />
				</button>
			</div>

			<div class="space-y-2 rounded-xl border border-stone-100 bg-stone-50 p-4 text-xs">
				<div class="flex justify-between border-b border-stone-200/50 py-1">
					<span class="text-stone-500">Кур'єр / Виконавець:</span>
					<span class="font-semibold text-stone-900">{selectedEscrow.seller}</span>
				</div>
				<div class="flex justify-between border-b border-stone-200/50 py-1">
					<span class="text-stone-500">Покупець / Замовник:</span>
					<span class="font-medium text-stone-800">{selectedEscrow.buyer}</span>
				</div>
				<div class="flex justify-between border-b border-stone-200/50 py-1">
					<span class="text-stone-500">Сума угоди (Gross):</span>
					<span class="font-mono text-stone-800 tabular-nums">{fmt(selectedEscrow.gross)} ₴</span>
				</div>
				<div class="flex justify-between border-b border-stone-200/50 py-1">
					<span class="text-stone-500">Утримання 10% ПДФО:</span>
					<span class="font-mono font-semibold text-emerald-600 tabular-nums"
						>−{fmt(selectedEscrow.tax)} ₴</span
					>
				</div>
				<div class="flex justify-between py-1 text-sm font-bold text-stone-900">
					<span>Чистими на виплату (Net):</span>
					<span class="text-emerald-700 tabular-nums">{fmt(selectedEscrow.net)} ₴</span>
				</div>
				{#if selectedEscrow.reason}
					<div class="flex justify-between py-1 font-medium text-amber-800">
						<span>Причина стану:</span>
						<span>{selectedEscrow.reason}</span>
					</div>
				{/if}
			</div>

			<!-- Dispute & Release Actions -->
			<div class="space-y-2 pt-1">
				<div class="text-xs font-bold tracking-wider text-stone-900 uppercase">
					Керування ескроу-депозитом
				</div>

				{#if selectedEscrow.status === 'held'}
					<div class="grid grid-cols-1 gap-2 sm:grid-cols-3">
						<button
							type="button"
							onclick={() => handleEscrowAction(selectedEscrow!.id, 'released')}
							class="cursor-pointer rounded-xl bg-emerald-600 py-2.5 text-xs font-semibold text-white transition hover:bg-emerald-700"
						>
							Виплатити кур'єру
						</button>
						<button
							type="button"
							onclick={() => {
								const reason =
									prompt('Введіть причину повернення коштів:') || 'Повернення за згодою сторін';
								handleEscrowAction(selectedEscrow!.id, 'refunded', reason);
							}}
							class="cursor-pointer rounded-xl bg-stone-900 py-2.5 text-xs font-semibold text-white transition hover:bg-stone-800"
						>
							Повернути покупцю
						</button>
						<button
							type="button"
							onclick={() =>
								handleEscrowAction(
									selectedEscrow!.id,
									'disputed',
									'Покупець подав скаргу на пошкодження вантажу'
								)}
							class="cursor-pointer rounded-xl bg-red-600 py-2.5 text-xs font-semibold text-white transition hover:bg-red-700"
						>
							Відкрити диспут
						</button>
					</div>
				{:else if selectedEscrow.status === 'disputed'}
					<div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
						<button
							type="button"
							onclick={() =>
								handleEscrowAction(
									selectedEscrow!.id,
									'released',
									'Диспут вирішено на користь курʼєра'
								)}
							class="cursor-pointer rounded-xl bg-emerald-600 py-2.5 text-xs font-semibold text-white transition hover:bg-emerald-700"
						>
							Вирішити на користь кур'єра
						</button>
						<button
							type="button"
							onclick={() =>
								handleEscrowAction(
									selectedEscrow!.id,
									'refunded',
									'Диспут вирішено: претензія покупця обґрунтована'
								)}
							class="cursor-pointer rounded-xl bg-stone-900 py-2.5 text-xs font-semibold text-white transition hover:bg-stone-800"
						>
							Вирішити на користь покупця
						</button>
					</div>
				{:else if selectedEscrow.status === 'released'}
					<div
						class="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-700"
					>
						<CircleCheck class="size-4 shrink-0 text-emerald-600" />
						<span
							>Кошти успішно вивільнено на спецрахунок кур'єра та включено до найближчого денного
							батчу.</span
						>
					</div>
				{:else if selectedEscrow.status === 'refunded'}
					<div
						class="flex items-center gap-2 rounded-xl border border-stone-200 bg-stone-50 p-3 text-xs font-semibold text-stone-700"
					>
						<HelpCircle class="size-4 shrink-0 text-stone-500" />
						<span
							>Угоду скасовано. Кошти повернуто покупцю, нарахування та утримання 10% ПДФО повністю
							сторновано.</span
						>
					</div>
				{/if}
			</div>

			<div class="flex justify-end pt-2">
				<button
					type="button"
					onclick={() => (selectedEscrow = null)}
					class="cursor-pointer rounded-xl bg-stone-100 px-4 py-2 text-xs font-bold text-stone-800 transition hover:bg-stone-200"
				>
					Закрити
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- XML Modal Viewer -->
{#if xmlModalOpen}
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4">
		<button
			type="button"
			aria-label="Закрити"
			class="absolute inset-0 cursor-default border-none bg-stone-900/50 p-0 backdrop-blur-xs"
			onclick={() => (xmlModalOpen = false)}
		></button>
		<div
			class="relative flex max-h-[85vh] w-full max-w-2xl flex-col space-y-4 rounded-2xl bg-white p-6 shadow-2xl"
		>
			<div class="flex items-center justify-between border-b border-stone-100 pb-3">
				<h3 class="text-sm font-bold text-stone-900">DPI OECD XML Специфікація</h3>
				<button
					type="button"
					onclick={() => (xmlModalOpen = false)}
					class="cursor-pointer rounded-lg p-1 text-stone-400 hover:bg-stone-100"
				>
					<X class="size-4" />
				</button>
			</div>
			<div
				class="flex-1 overflow-auto rounded-xl bg-stone-900 p-4 font-mono text-xs text-stone-200"
			>
				<pre>{xmlReportContent}</pre>
			</div>
			<div class="flex justify-end gap-2 pt-2">
				<button
					type="button"
					onclick={() => {
						navigator.clipboard.writeText(xmlReportContent);
						alert('XML скопійовано в буфер обміну!');
					}}
					class="cursor-pointer rounded-xl border border-stone-200 px-4 py-2 text-xs font-bold text-stone-800 transition hover:bg-stone-100"
				>
					Копіювати
				</button>
				<button
					type="button"
					onclick={() => (xmlModalOpen = false)}
					class="cursor-pointer rounded-xl bg-stone-900 px-4 py-2 text-xs font-bold text-white transition hover:bg-stone-800"
				>
					Закрити
				</button>
			</div>
		</div>
	</div>
{/if}
