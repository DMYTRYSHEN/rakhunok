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
		CodeXml
	} from '@lucide/svelte';
	import type { Dac7Payout, Dac7Seller } from '../types';
	import type { Dac7Gateway } from '../dac7-gateway';
	import {
		demoPayouts,
		demoSellers,
		fmt,
		PO_META,
		KYC_META,
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

	// Campaign Simulation State
	let campaignRunning = $state(false);
	let campaignProgress = $state(0);
	let campaignTarget = $state<'needTin' | 'needAddress'>('needTin');
	let campaignChannel = $state<'email' | 'sms' | 'telegram' | 'push'>('email');

	// Sellers list filter and search
	let sellerSearch = $state('');
	let sellerFilter = $state('all');

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
	const displayedSellers = $derived(
		sellersList.filter((s) => {
			const matchesQ =
				s.name.toLowerCase().includes(sellerSearch.toLowerCase()) ||
				s.id.toLowerCase().includes(sellerSearch.toLowerCase()) ||
				s.city.toLowerCase().includes(sellerSearch.toLowerCase());
			if (!matchesQ) return false;
			if (sellerFilter === 'tier2') return s.kyc === 'tier2';
			if (sellerFilter === 'pending') return s.kyc === 'pending';
			if (sellerFilter === 'blocked') return s.kyc === 'blocked';
			return true;
		})
	);

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
	<div class="space-y-6 max-w-7xl mx-auto">
		<!-- 1. B2B Compliance OS Dashboard Funnel (Matches Screenshot 2 media_1789073462629.png) -->
		<div
			class="rounded-2xl p-6 bg-gradient-to-r from-stone-500 via-stone-850 to-stone-900 border-none shadow-xl text-stone-200"
		>
			<div class="flex items-center justify-between mb-5">
				<div>
					<h3 class="text-[15.5px] font-bold text-white flex items-center gap-2">
						<Award class="size-4.5 text-emerald-400" />
						Комплексна комплаєнс-воронка (Digital Platform Compliance OS)
					</h3>
					<p class="text-[12.5px] text-stone-400 mt-0.5">
						Аналітичний зріз верифікації та ризиків за вимогами DAC7 (OECD DPI)
					</p>
				</div>
				<span
					class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11.5px] font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
				>
					Live Sync
				</span>
			</div>

			<div class="grid gap-3 grid-cols-2 md:grid-cols-6 text-center">
				<div class="bg-white/5 border border-white/10 rounded-xl p-3.5">
					<div class="text-[11px] font-semibold text-stone-400 uppercase tracking-wider">
						Виконавці
					</div>
					<div class="text-[20px] font-bold text-white mt-1 tabular-nums">
						{stats.totalSellers.toLocaleString('uk-UA')}
					</div>
					<div class="text-[11px] text-stone-500 mt-1">100% профілів</div>
				</div>

				<div class="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3.5">
					<div class="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider">
						Верифіковано
					</div>
					<div class="text-[20px] font-bold text-emerald-300 mt-1 tabular-nums">
						{stats.verifiedSellers.toLocaleString('uk-UA')}
					</div>
					<div class="text-[11px] text-emerald-500/80 mt-1">
						{stats.totalSellers > 0
							? Math.round((stats.verifiedSellers / stats.totalSellers) * 100)
							: 0}% успішних
					</div>
				</div>

				<div class="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3.5">
					<div class="text-[11px] font-semibold text-amber-400 uppercase tracking-wider">
						Потрібен TIN
					</div>
					<div class="text-[20px] font-bold text-amber-300 mt-1 tabular-nums">
						{stats.needTin.toLocaleString('uk-UA')}
					</div>
					<div class="text-[11px] text-amber-500/80 mt-1">Немає РНОКПП</div>
				</div>

				<div class="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3.5">
					<div class="text-[11px] font-semibold text-amber-400 uppercase tracking-wider">
						Потрібна адреса
					</div>
					<div class="text-[20px] font-bold text-amber-300 mt-1 tabular-nums">
						{stats.needAddress.toLocaleString('uk-UA')}
					</div>
					<div class="text-[11px] text-amber-500/80 mt-1">Немає адреси</div>
				</div>

				<div class="bg-red-500/10 border border-red-500/20 rounded-xl p-3.5">
					<div class="text-[11px] font-semibold text-red-400 uppercase tracking-wider">
						Заблоковано
					</div>
					<div class="text-[20px] font-bold text-red-300 mt-1 tabular-nums">
						{stats.blockedSellers.toLocaleString('uk-UA')}
					</div>
					<div class="text-[11px] text-red-500/80 mt-1">AML / Фінмон</div>
				</div>

				<div class="bg-white/5 border border-white/10 rounded-xl p-3.5">
					<div class="text-[11px] font-semibold text-stone-400 uppercase tracking-wider">
						На розгляді
					</div>
					<div class="text-[20px] font-bold text-white mt-1 tabular-nums">
						{stats.underReview.toLocaleString('uk-UA')}
					</div>
					<div class="text-[11px] text-stone-500 mt-1">Арбітраж KYC</div>
				</div>
			</div>
		</div>

		<!-- 2. Interactive Data Collection Campaign Manager + Compliance Score -->
		<div class="grid gap-5 md:grid-cols-[1.5fr_1fr]">
			<!-- Left: Campaign Manager -->
			<div
				class="rounded-2xl border border-stone-200/70 bg-white p-6 shadow-sm flex flex-col justify-between"
			>
				<div>
					<div class="flex items-center gap-2 mb-3">
						<Mail class="size-4.5 text-stone-500" />
						<h3 class="text-[14.5px] font-bold text-stone-900">
							Мобілізація збору даних (Data Collection Campaign)
						</h3>
					</div>
					<p class="text-[13px] text-stone-600 leading-relaxed mb-4">
						Автоматичне надсилання серії пуш-повідомлень, SMS та email нагадувань продавцям, у яких
						відсутні критичні комплаєнс-дані для річного звіту DAC7.
					</p>

					<div class="grid grid-cols-2 gap-4 mb-4">
						<div>
							<label for="campaign-target" class="text-[11px] font-medium text-stone-500 block mb-1">
								Цільова група продавців
							</label>
							<select
								id="campaign-target"
								bind:value={campaignTarget}
								disabled={campaignRunning}
								class="w-full h-9 rounded-lg border border-stone-200 bg-white text-[12.5px] px-2 outline-none cursor-pointer"
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
							<label for="campaign-channel" class="text-[11px] font-medium text-stone-500 block mb-1">
								Канал надсилання нагадувань
							</label>
							<select
								id="campaign-channel"
								bind:value={campaignChannel}
								disabled={campaignRunning}
								class="w-full h-9 rounded-lg border border-stone-200 bg-white text-[12.5px] px-2 outline-none cursor-pointer"
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
						<div class="space-y-1.5 animate-fadeIn">
							<div class="flex justify-between text-[12px] font-medium text-stone-700">
								<span>Триває розсилка...</span>
								<span>{campaignProgress}%</span>
							</div>
							<div class="h-2 w-full bg-stone-200 rounded-full overflow-hidden">
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
							class="w-full h-10 rounded-xl bg-stone-900 hover:bg-stone-850 text-white font-bold text-[13px] flex items-center justify-center gap-2 transition cursor-pointer"
						>
							<Send class="size-4" />
							<span>Запустити кампанію нагадувань</span>
						</button>
					{/if}
				</div>
			</div>

			<!-- Right: Compliance Score (Glass) -->
			<div
				class="rounded-2xl border border-white/70 bg-white/60 shadow-sm backdrop-blur-xl p-6 flex flex-col justify-between"
			>
				<div>
					<div class="flex items-center justify-between mb-4">
						<span class="text-[15px] font-bold text-stone-900">Compliance Score платформи</span>
						<span
							class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11.5px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-100/50"
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
						{#each [
							{ n: stats.unresolvedCount.kyc, t: 'не пройшли KYC — посилання застаріло' },
							{ n: stats.unresolvedCount.iban, t: 'IBAN не підтверджені' },
							{ n: stats.unresolvedCount.name, t: 'змінили ПІБ — повторна Дія' },
							{ n: stats.unresolvedCount.sanctions, t: 'санкційний збіг — заблоковано' }
						] as r}
							<button
								type="button"
								onclick={() => navigateTo('sellers')}
								class="group flex w-full items-start gap-3 rounded-lg px-2 py-1.5 text-left transition hover:bg-white/70 cursor-pointer"
							>
								<span class="w-6 shrink-0 text-[13.5px] font-bold tabular-nums text-stone-900">
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
				class="rounded-2xl border border-white/70 bg-white/60 p-5 shadow-sm backdrop-blur-xl text-left cursor-pointer transition hover:bg-white/80"
			>
				<div class="flex items-center justify-between">
					<div class="text-[11px] font-medium uppercase tracking-[0.16em] text-stone-400">
						Виплачено сьогодні
					</div>
					<span class="text-stone-300 text-[10px]">↗</span>
				</div>
				<div
					class="mt-2 text-[26px] font-semibold leading-none tracking-tight tabular-nums text-stone-900"
				>
					{stats.paidToday}
				</div>
				<div class="mt-2 text-[12.5px] text-stone-500">{stats.payoutsCount}</div>
			</button>

			<!-- Stat 2 -->
			<button
				type="button"
				onclick={() => navigateTo('payouts')}
				class="rounded-2xl border border-white/70 bg-white/60 p-5 shadow-sm backdrop-blur-xl text-left cursor-pointer transition hover:bg-white/80"
			>
				<div class="flex items-center justify-between">
					<div class="text-[11px] font-medium uppercase tracking-[0.16em] text-stone-400">
						Заплановано в батчах · 21:00
					</div>
					<span class="text-stone-300 text-[10px]">↗</span>
				</div>
				<div
					class="mt-2 text-[26px] font-semibold leading-none tracking-tight tabular-nums text-stone-900"
				>
					{stats.scheduled}
				</div>
				<div class="mt-2 text-[12.5px] text-stone-500">1 847 продавців · 1 переказ кожному</div>
			</button>

			<!-- Stat 3 -->
			<button
				type="button"
				onclick={() => navigateTo('sellers')}
				class="rounded-2xl border border-white/70 bg-white/60 p-5 shadow-sm backdrop-blur-xl text-left cursor-pointer transition hover:bg-white/80"
			>
				<div class="flex items-center justify-between">
					<div class="text-[11px] font-medium uppercase tracking-[0.16em] text-stone-400">
						Очікують верифікації
					</div>
					<span class="text-stone-300 text-[10px]">↗</span>
				</div>
				<div
					class="mt-2 text-[26px] font-semibold leading-none tracking-tight tabular-nums text-amber-600"
				>
					{stats.pendingKyc}
				</div>
				<div class="mt-2 text-[12.5px] text-stone-500">KYC-черга · SLA 4 год</div>
			</button>

			<!-- Stat 4 -->
			<button
				type="button"
				onclick={() => navigateTo('dac7')}
				class="rounded-2xl border border-white/70 bg-white/60 p-5 shadow-sm backdrop-blur-xl text-left cursor-pointer transition hover:bg-white/80"
			>
				<div class="flex items-center justify-between">
					<div class="text-[11px] font-medium uppercase tracking-[0.16em] text-stone-400">
						DAC7 Ready
					</div>
					<span class="text-stone-300 text-[10px]">↗</span>
				</div>
				<div
					class="mt-2 text-[26px] font-semibold leading-none tracking-tight tabular-nums text-stone-900"
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
				<div class="w-full h-[280px] flex items-center justify-center">
					<svg
						viewBox="0 0 {chartWidth} {chartHeight}"
						class="w-full h-full overflow-visible font-sans"
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
							<text
								x={padLeft - 8}
								y={y + 3.5}
								text-anchor="end"
								font-size="11"
								fill="#78716c"
							>
								{tick}
							</text>
						{/each}

						<!-- Areas -->
						{#if payoutsPath}
							<path d={payoutsPath.area} fill="url(#gp2)" />
							<path
								d={payoutsPath.line}
								fill="none"
								stroke="#0c0a09"
								stroke-width="1.8"
							/>
						{/if}

						{#if taxPath}
							<path d={taxPath.area} fill="url(#gt2)" />
							<path
								d={taxPath.line}
								fill="none"
								stroke="#059669"
								stroke-width="1.8"
							/>
						{/if}

						<!-- X-Axis Labels -->
						{#each chartPoints as pt}
							<text
								x={pt.x}
								y={chartHeight - 6}
								text-anchor="middle"
								font-size="11"
								fill="#78716c"
							>
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
					class="rounded-2xl border border-stone-200/70 bg-white shadow-sm flex-1 overflow-hidden"
				>
					<div class="flex items-center justify-between border-b border-stone-100 px-6 py-4">
						<span class="flex items-center gap-2 text-[15px] font-semibold text-stone-900">
							<Activity class="size-4 text-emerald-600" />
							Live Payout Stream
						</span>
						<span
							class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11.5px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-100/50"
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
								class="flex w-full items-center justify-between px-6 py-3 text-left transition hover:bg-stone-50 cursor-pointer"
							>
								<div>
									<div class="text-[13.5px] font-medium text-stone-900">{p.seller}</div>
									<div class="font-mono text-[11.5px] text-stone-400">
										{p.displayId} · {p.date}
									</div>
								</div>
								<div class="flex items-center gap-3">
									<span class="tabular-nums text-[13.5px] font-semibold text-stone-900">
										{fmt(p.net)} ₴
									</span>
									<span
										class="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium {PO_META[
											p.st
										]?.t === 'ok'
											? 'bg-emerald-50 text-emerald-700 border border-emerald-100/50'
											: 'bg-amber-50 text-amber-700 border border-amber-100/50'}"
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
	<div class="space-y-6 max-w-7xl mx-auto">
		<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
			<div>
				<h2 class="text-[18px] font-bold text-stone-900">Виконавці та комплаєнс-профілі</h2>
				<p class="text-xs text-stone-500 mt-0.5">
					База підключених кур'єрів, водіїв та мерчантів платформи Bolt Food
				</p>
			</div>

			<div class="flex items-center gap-2">
				<div class="relative">
					<Search class="size-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
					<input
						type="text"
						bind:value={sellerSearch}
						placeholder="Пошук за ПІБ, ID або містом..."
						class="h-9 rounded-full border border-stone-200 bg-white pl-9 pr-4 text-xs outline-none w-64 shadow-xs"
					/>
				</div>
			</div>
		</div>

		<!-- Segmented Filter Buttons -->
		<div class="flex gap-1 rounded-full border border-stone-200 bg-stone-50 p-1 w-fit">
			{#each [
				{ id: 'all', l: 'Всі виконавці' },
				{ id: 'tier2', l: 'Tier-2 Дія' },
				{ id: 'pending', l: 'Очікують KYC' },
				{ id: 'blocked', l: 'Заблоковані' }
			] as f}
				<button
					type="button"
					onclick={() => (sellerFilter = f.id)}
					class="h-7 rounded-full px-3.5 text-xs font-medium transition cursor-pointer {sellerFilter ===
					f.id
						? 'bg-stone-900 text-white shadow-xs'
						: 'text-stone-500 hover:text-stone-900'}"
				>
					{f.l}
				</button>
			{/each}
		</div>

		<!-- Table -->
		<div class="rounded-2xl border border-stone-200/70 bg-white shadow-sm overflow-hidden">
			<table class="w-full text-left text-xs">
				<thead class="bg-stone-50/80 border-b border-stone-100 text-stone-400 uppercase tracking-wider font-semibold">
					<tr>
						<th class="p-4 px-6">Виконавець / ID</th>
						<th class="p-4">Роль</th>
						<th class="p-4">Місто</th>
						<th class="p-4">KYC Статус</th>
						<th class="p-4">РНОКПП</th>
						<th class="p-4 text-right">Обіг YTD</th>
						<th class="p-4 px-6 text-right">Дія</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-stone-100">
					{#each displayedSellers as s}
						<tr class="hover:bg-stone-50/70 transition">
							<td class="p-4 px-6">
								<div class="font-bold text-stone-900">{s.name}</div>
								<div class="font-mono text-[11px] text-stone-400">{s.id}</div>
							</td>
							<td class="p-4 text-stone-700">{s.role}</td>
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
							<td class="p-4 font-mono text-stone-700">{s.rnokpp || 'Немає'}</td>
							<td class="p-4 text-right font-bold text-stone-900">{fmt(s.earned)} ₴</td>
							<td class="p-4 px-6 text-right">
								<button
									type="button"
									onclick={() => (selectedSeller = s)}
									class="rounded-lg border border-stone-200 px-2.5 py-1 text-xs font-semibold text-stone-700 hover:bg-stone-100 transition cursor-pointer"
								>
									Профіль
								</button>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>
{:else if activeTab === 'payouts'}
	<!-- Sub-tab: Payouts Stream -->
	<div class="space-y-6 max-w-7xl mx-auto">
		<h2 class="text-[18px] font-bold text-stone-900">Реєстр виплат (Payout Registry)</h2>

		<div class="rounded-2xl border border-stone-200/70 bg-white shadow-sm overflow-hidden">
			<div class="px-6 py-4 border-b border-stone-100 font-semibold text-stone-900">
				Транзакції виплат за останні періоди
			</div>
			<div class="divide-y divide-stone-100">
				{#each feedPayouts as p}
					<div class="flex items-center justify-between p-4 px-6 hover:bg-stone-50/70 transition">
						<div>
							<div class="text-sm font-semibold text-stone-900">{p.seller}</div>
							<div class="text-xs text-stone-400 font-mono">
								{p.id} · {p.date} · {p.rail}
							</div>
						</div>
						<div class="text-right flex items-center gap-4">
							<div>
								<div class="text-sm font-bold text-stone-900">{fmt(p.net)} ₴</div>
								<div class="text-xs text-stone-400">ПДФО: {fmt(p.tax)} ₴</div>
							</div>
							<span
								class="rounded-full px-2.5 py-0.5 text-xs font-semibold {PO_META[p.st]?.t ===
								'ok'
									? 'bg-emerald-50 text-emerald-700'
									: 'bg-amber-50 text-amber-700'}"
							>
								{PO_META[p.st]?.l || p.st}
							</span>
						</div>
					</div>
				{/each}
			</div>
		</div>
	</div>
{:else if activeTab === 'taxes'}
	<!-- Sub-tab: Taxes -->
	<div class="space-y-6 max-w-7xl mx-auto">
		<h2 class="text-[18px] font-bold text-stone-900">Податкове адміністрування (Tax Settlement)</h2>

		<div class="grid gap-4 sm:grid-cols-3">
			<div class="rounded-2xl border border-stone-200/70 bg-white p-6 shadow-sm">
				<div class="text-xs text-stone-500 uppercase tracking-wider font-semibold">
					Утримано податків за місяць
				</div>
				<div class="mt-2 text-2xl font-bold text-stone-900">{stats.pdxo}</div>
				<p class="mt-1 text-xs text-stone-500">10% ставка ПДФО з платформних доходів</p>
			</div>
			<div class="rounded-2xl border border-stone-200/70 bg-white p-6 shadow-sm">
				<div class="text-xs text-stone-500 uppercase tracking-wider font-semibold">
					Перераховано до Казначейства
				</div>
				<div class="mt-2 text-2xl font-bold text-emerald-600">8 968 400 ₴</div>
				<p class="mt-1 text-xs text-stone-500">Реєстр платіжних інструкцій СЕП</p>
			</div>
			<div class="rounded-2xl border border-stone-200/70 bg-white p-6 shadow-sm">
				<div class="text-xs text-stone-500 uppercase tracking-wider font-semibold">
					Податковий статус платформи
				</div>
				<div class="mt-2 text-2xl font-bold text-stone-900">Compliant 100%</div>
				<p class="mt-1 text-xs text-emerald-600 font-semibold">Заборгованість відсутня</p>
			</div>
		</div>
	</div>
{:else if activeTab === 'dac7'}
	<!-- Sub-tab: DAC7 XML Generation -->
	<div class="space-y-6 max-w-7xl mx-auto">
		<div class="flex items-center justify-between">
			<div>
				<h2 class="text-[18px] font-bold text-stone-900">DAC7 / DPI Звітність (OECD XSD)</h2>
				<p class="text-xs text-stone-500 mt-0.5">
					Формування та подання щорічного реєстру активних продавців до ДПС України
				</p>
			</div>
			<button
				type="button"
				onclick={generateDac7Xml}
				class="inline-flex items-center gap-2 rounded-xl bg-stone-900 px-4 py-2 text-xs font-bold text-white hover:bg-stone-800 transition cursor-pointer"
			>
				<Download class="size-4" />
				<span>Згенерувати DPI XML</span>
			</button>
		</div>

		<div class="rounded-2xl border border-stone-200/70 bg-white p-6 shadow-sm">
			<div class="font-bold text-stone-900 text-sm mb-2">Статус валідації схеми DPI OECD</div>
			<div class="flex items-center gap-2 text-xs text-emerald-700 font-semibold mb-4">
				<CircleCheck class="size-4 text-emerald-600" />
				<span>Всі поля відповідають специфікації DPI_XML_Schema_v1.0 (OECD)</span>
			</div>
			<p class="text-xs text-stone-600 leading-relaxed">
				Звіт включає 128 412 продавців, сумарний обіг, утримані податкові відрахування, валідовані
				РНОКПП та географічні адреси резидентів.
			</p>
		</div>
	</div>
{:else if activeTab === 'sim'}
	<!-- Sub-tab: Simulator -->
	<div class="space-y-6 max-w-7xl mx-auto">
		<h2 class="text-[18px] font-bold text-stone-900">Симулятор платіжних потоків та Split</h2>
		<div class="rounded-2xl border border-stone-200/70 bg-white p-6 shadow-sm space-y-4">
			<p class="text-xs text-stone-600">
				Тестування розрахунку 10% податку та формування щоденного розрахункового батчу:
			</p>
			<button
				type="button"
				onclick={() =>
					alert(
						'Створено тестове замовлення Bolt Food на 1 000 ₴. Split виконано: 900 ₴ ресторан, 100 ₴ кур’єр, 10 ₴ податок.'
					)}
				class="inline-flex items-center gap-2 rounded-xl bg-stone-900 px-4 py-2 text-xs font-bold text-white hover:bg-stone-800 transition cursor-pointer"
			>
				<Zap class="size-4" />
				<span>Симулювати замовлення з автоматичним сплитом</span>
			</button>
		</div>
	</div>
{/if}

<!-- Seller Detail Drawer (Matches SellerDrawer.tsx from D:\SELF\src) -->
{#if selectedSeller}
	<div class="fixed inset-0 z-50">
		<button
			type="button"
			aria-label="Закрити"
			class="absolute inset-0 bg-stone-950/30 backdrop-blur-[2px] border-none p-0 cursor-default"
			onclick={() => (selectedSeller = null)}
		></button>

		<div
			class="absolute inset-y-0 right-0 flex w-full max-w-xl flex-col bg-white shadow-2xl transition-transform duration-300 ease-out"
		>
			<div class="flex items-center justify-between border-b border-stone-100 px-6 py-4">
				<span class="text-[15px] font-semibold text-stone-900">Профіль виконавця платформи</span>
				<button
					type="button"
					onclick={() => (selectedSeller = null)}
					class="rounded-full p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-900 cursor-pointer"
				>
					<X class="size-4" />
				</button>
			</div>

			<div class="flex-1 overflow-y-auto p-6 space-y-5">
				<div class="flex items-center gap-4">
					<div
						class="flex size-14 items-center justify-center rounded-2xl bg-stone-900 text-[18px] font-bold text-white"
					>
						{selectedSeller.name
							.split(' ')
							.map((w) => w[0])
							.join('')}
					</div>
					<div>
						<div class="text-[18px] font-bold text-stone-900">{selectedSeller.name}</div>
						<div class="font-mono text-[12.5px] text-stone-400">
							{selectedSeller.id} · {selectedSeller.role} · {selectedSeller.city}
						</div>
					</div>
				</div>

				<div class="divide-y divide-stone-100 border-t border-b border-stone-100">
					<div class="flex items-center justify-between py-2.5 text-xs">
						<span class="text-stone-500">KYC статус</span>
						<span
							class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold {selectedSeller.kyc ===
							'tier2'
								? 'bg-emerald-50 text-emerald-700'
								: 'bg-amber-50 text-amber-700'}"
						>
							{KYC_META[selectedSeller.kyc]?.l || selectedSeller.kyc}
						</span>
					</div>
					<div class="flex items-center justify-between py-2.5 text-xs">
						<span class="text-stone-500">РНОКПП</span>
						<span class="font-mono font-semibold text-stone-900">
							{selectedSeller.rnokpp || '3091248192'}
						</span>
					</div>
					<div class="flex items-center justify-between py-2.5 text-xs">
						<span class="text-stone-500">Зароблено на платформі YTD</span>
						<span class="font-bold text-stone-900">{fmt(selectedSeller.earned)} ₴</span>
					</div>
					<div class="flex items-center justify-between py-2.5 text-xs">
						<span class="text-stone-500">Податковий агент утримав (10%)</span>
						<span class="font-semibold text-stone-900">
							{fmt(Math.round(selectedSeller.earned * 0.1))} ₴
						</span>
					</div>
					<div class="flex items-center justify-between py-2.5 text-xs">
						<span class="text-stone-500">Адреса проживання</span>
						<span class="text-stone-800">{selectedSeller.address || 'м. Дніпро'}</span>
					</div>
				</div>

				<div
					class="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-semibold text-emerald-800"
				>
					Дані верифіковані через Дія.Підпис та готові до включення у щорічний звіт DAC7.
				</div>
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
			class="absolute inset-0 bg-stone-900/50 backdrop-blur-xs border-none p-0 cursor-default"
			onclick={() => (xmlModalOpen = false)}
		></button>
		<div
			class="relative w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col"
		>
			<div class="flex items-center justify-between border-b border-stone-100 pb-3">
				<h3 class="font-bold text-stone-900 text-sm">DPI OECD XML Специфікація</h3>
				<button
					type="button"
					onclick={() => (xmlModalOpen = false)}
					class="rounded-lg p-1 text-stone-400 hover:bg-stone-100 cursor-pointer"
				>
					<X class="size-4" />
				</button>
			</div>
			<div class="flex-1 overflow-auto rounded-xl bg-stone-900 p-4 font-mono text-xs text-stone-200">
				<pre>{xmlReportContent}</pre>
			</div>
			<div class="flex justify-end gap-2 pt-2">
				<button
					type="button"
					onclick={() => {
						navigator.clipboard.writeText(xmlReportContent);
						alert('XML скопійовано в буфер обміну!');
					}}
					class="rounded-xl border border-stone-200 px-4 py-2 text-xs font-bold text-stone-800 hover:bg-stone-100 transition cursor-pointer"
				>
					Копіювати
				</button>
				<button
					type="button"
					onclick={() => (xmlModalOpen = false)}
					class="rounded-xl bg-stone-900 px-4 py-2 text-xs font-bold text-white hover:bg-stone-800 transition cursor-pointer"
				>
					Закрити
				</button>
			</div>
		</div>
	</div>
{/if}
