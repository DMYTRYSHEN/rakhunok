<script lang="ts">
	import {
		ArrowUpRight,
		ArrowRight,
		Check,
		ChevronDown,
		Coffee,
		LayoutDashboard,
		ReceiptText,
		ChartNoAxesCombined,
		Settings2,
		Store,
		Plus,
		ShieldCheck,
		Wifi,
		BatteryFull,
		RotateCcw
	} from '@lucide/svelte';
	import type { Locale } from '../data/translations';
	import { studioCopy } from '../data/studio-copy';
	import { checkoutBanks } from '../bank-options';
	let { locale }: { locale: Locale } = $props();
	const c = $derived(studioCopy[locale]);
	const banks = checkoutBanks.filter((bank) => ['mono', 'pb', 'pumb'].includes(bank.id));
	let selectedBank = $state('mono');
	let paid = $state(false);
	let period = $state<'day' | 'week'>('day');
	const total = $derived((period === 'day' ? 24850 : 174260) + (paid ? 490 : 0));
	const count = $derived((period === 'day' ? 48 : 326) + (paid ? 1 : 0));
	const money = (value: number) =>
		new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value);
	const bars = [28, 44, 34, 60, 46, 73, 58, 83, 67, 91, 76, 96];
</script>

<div class="experience-stage" id="demo">
	<div class="experience-halo" aria-hidden="true"></div>
	<div class="workspace-shell">
		<div class="window-chrome">
			<span class="window-dots" aria-hidden="true"><i></i><i></i><i></i></span><span
				><ShieldCheck size={12} /> Rahunok Business</span
			><span class="demo-pill">{c.demoData}</span>
		</div>
		<div class="workspace-body">
			<aside class="workspace-sidebar" aria-hidden="true">
				<div class="workspace-logo">R<span>Rahunok</span></div>
				<span class="sidebar-active"><LayoutDashboard size={17} />{c.overview}</span><span
					><ReceiptText size={17} />{c.recent}</span
				><span><Store size={17} />{c.allLocations}</span><span
					><ChartNoAxesCombined size={17} />{c.nav[3]}</span
				>
				<div class="sidebar-bottom"><Settings2 size={17} /><span>Business workspace</span></div>
			</aside>
			<div class="workspace-content">
				<div class="workspace-heading">
					<div>
						<span class="micro-label">KRAPKA COFFEE / WORKSPACE</span>
						<h3>{c.overview}</h3>
					</div>
					<span class="location-chip"
						><Store size={13} />{c.allLocations}<ChevronDown size={12} /></span
					>
				</div>
				<div class="dashboard-toolbar">
					<span class="online-label"><i></i>{c.demoData}</span>
					<div class="segmented compact" aria-label={c.today}>
						<button
							type="button"
							class:active={period === 'day'}
							aria-pressed={period === 'day'}
							onclick={() => (period = 'day')}>{c.today}</button
						><button
							type="button"
							class:active={period === 'week'}
							aria-pressed={period === 'week'}
							onclick={() => (period = 'week')}>{c.week}</button
						>
					</div>
				</div>
				<div class="dashboard-metrics">
					<div>
						<span>{c.revenue}</span><strong>{money(total)}<small> ₴</small></strong><span
							class="metric-note">{c.demoData}</span
						>
					</div>
					<div>
						<span>{c.payments}</span><strong>{count}</strong><span class="metric-note"
							>{c.confirmed}</span
						>
					</div>
					<div>
						<span>{c.average}</span><strong>{money(total / count)}<small> ₴</small></strong><span
							class="metric-note">UAH</span
						>
					</div>
				</div>
				<div
					class="dashboard-chart"
					role="img"
					aria-label={`${c.revenue}: ${money(total)} UAH. ${c.demoData}`}
				>
					<div class="chart-grid"><span>30k</span><span>20k</span><span>10k</span></div>
					<div class="volume-bars">
						{#each bars as bar, i (i)}<div
								style:height={`${period === 'day' ? bar : 100 - bar / 2}%`}
								class:highlight={i > 8}
							>
								<span></span>
							</div>{/each}
					</div>
					<div class="chart-times">
						<span>08:00</span><span>12:00</span><span>16:00</span><span>20:00</span>
					</div>
				</div>
				<div class="invoice-list">
					<div class="invoice-list-title"><strong>{c.recent}</strong><ReceiptText size={15} /></div>
					<div class="invoice-row invoice-table-head">
						<span>{c.customer}</span><span>{c.status}</span><span>{c.amount}</span>
					</div>
					{#each [490, 850, 320] as amount, i (i)}<div class="invoice-row">
							<span
								><i class="invoice-icon"><Coffee size={14} /></i><span
									>#{1042 - i}<small>{c.terminal}</small></span
								></span
							><span class:status-paid={i > 0 || paid} class="invoice-state"
								>{i > 0 || paid ? c.confirmed : c.awaiting}</span
							><strong>{money(amount)} ₴</strong>
						</div>{/each}
				</div>
			</div>
		</div>
	</div>
	<div class="phone-shell">
		<div class="phone-status">
			<b>9:41</b><i class="dynamic-island"></i><span
				><Wifi size={12} /><BatteryFull size={16} /></span
			>
		</div>
		<div class="phone-content">
			<div class="phone-app-label">
				<span class="app-symbol">R</span><span>Rahunok Pay<small>{c.phoneNote}</small></span
				><ShieldCheck size={19} />
			</div>
			<div class="phone-merchant">
				<span><Coffee size={23} /></span>
				<h4>Krapka Coffee</h4>
				<p>{c.terminal} · #1042</p>
			</div>
			<div class="phone-amount">490<span>,00 ₴</span></div>
			<div class="phone-receipt">
				<span>Flat white × 2</span><b>180 ₴</b><span>Croissant × 2</span><b>310 ₴</b>
			</div>
			<div class="phone-banks">
				<span>{c.choose}</span>
				<div>
					{#each banks as bank (bank.id)}<button
							type="button"
							class:selected={selectedBank === bank.id}
							aria-pressed={selectedBank === bank.id}
							disabled={paid}
							onclick={() => (selectedBank = bank.id)}
							><img src={bank.logo} alt="" width="36" height="36" loading="lazy" /><span
								>{bank.shortName}</span
							>{#if selectedBank === bank.id}<i><Check size={9} /></i>{/if}</button
						>{/each}
				</div>
			</div>
			<button type="button" class="phone-pay" class:complete={paid} onclick={() => (paid = !paid)}
				>{#if paid}<RotateCcw size={16} />{c.reset}{:else}{c.pay}<ArrowRight
						size={16}
					/>{/if}</button
			>
			<p class="phone-safe" role="status">
				{#if paid}<Check size={13} />{c.paid}{:else}<ShieldCheck size={13} />{c.phoneNote}{/if}
			</p>
		</div>
		<div class="home-indicator"></div>
	</div>
	<div class="payment-toast" class:settled={paid} role="status">
		<span class="toast-icon"
			>{#if paid}<Check size={19} />{:else}<ReceiptText size={19} />{/if}</span
		>
		<div><strong>{paid ? c.confirmed : c.awaiting}</strong><span>#1042 · {c.demoData}</span></div>
		<b>{paid ? '+' : ''}490 ₴</b>
	</div>
</div>
<p class="experience-caption"><span><i></i>{c.demo}</span>{c.bankNote}</p>
