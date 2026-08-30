<script lang="ts">
	import { onDestroy } from 'svelte';
	import { ArrowRight, CheckCircle2, ShieldCheck, Sparkles, Terminal } from '@lucide/svelte';
	import { formatMoney } from '../utils/calculator';
	import { checkoutBanks } from '../bank-options';
	import BankLogoCarousel from './BankLogoCarousel.svelte';
	import type { Translations } from '../data/translations';

	let { t }: { t: Translations } = $props();

	let purpose = $state('Вечеря · Стіл 12');
	let amount = $state(850);
	let table = $state('Стіл 12');
	let invoice: { purpose: string; amount: number; table: string } | null = $state({
		purpose: 'Вечеря · Стіл 12',
		amount: 850,
		table: 'Стіл 12'
	});
	let status: 'waiting' | 'processing' | 'success' = $state('waiting');
	let selectedBankIndex = $state(checkoutBanks.findIndex((b) => b.id === 'abank24'));
	let timer: ReturnType<typeof setTimeout> | undefined;

	const banks = checkoutBanks;

	const presets = $derived([
		{
			name: t.sandbox.step1.presets.coffee,
			purpose: 'Капучино та круасан',
			amount: 140,
			table: 'Каса 1'
		},
		{
			name: t.sandbox.step1.presets.lunch,
			purpose: 'Бізнес-ланч · Стіл 4',
			amount: 420,
			table: 'Стіл 4'
		},
		{
			name: t.sandbox.step1.presets.dinner,
			purpose: 'Вечеря · Стіл 12',
			amount: 850,
			table: 'Стіл 12'
		},
		{
			name: t.sandbox.step1.presets.services,
			purpose: 'Консультація та сервіс',
			amount: 1600,
			table: 'Онлайн'
		}
	]);

	function applyPreset(p: (typeof presets)[0]) {
		purpose = p.purpose;
		amount = p.amount;
		table = p.table;
		createInvoice();
	}

	function createInvoice() {
		if (!Number.isFinite(amount) || amount < 1) return;
		clearTimeout(timer);
		invoice = {
			purpose: purpose.trim() || 'Замовлення',
			amount,
			table: table.trim() || 'Без мітки'
		};
		status = 'waiting';
	}

	function simulatePayment() {
		status = 'processing';
		timer = setTimeout(() => (status = 'success'), 1400);
	}

	onDestroy(() => clearTimeout(timer));
</script>

<section class="section" id="demo">
	<div class="container">
		<header class="integration-heading">
			<p class="eyebrow">
				<span>{t.sandbox.eyebrow}</span>
			</p>
			<h2>{t.sandbox.title}</h2>
			<p>
				{t.sandbox.description}
			</p>
		</header>

		<div class="integration-shell" data-state={invoice ? status : 'empty'}>
			<div class="integration-live-head">
				<span>
					<i></i>
					{t.sandbox.liveBadge}
				</span>
				<b>{t.sandbox.simulationMode}</b>
			</div>

			<div class="integration-grid">
				<!-- Step 1: Create Invoice -->
				<form
					class="integration-step integration-form"
					onsubmit={(event) => {
						event.preventDefault();
						createInvoice();
					}}
				>
					<header>
						<span>{t.sandbox.step1.badge}</span>
						<div>
							<small>{t.sandbox.step1.small}</small>
							<h4>{t.sandbox.step1.title}</h4>
						</div>
					</header>

					<div style="display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 4px;">
						{#each presets as p}
							<button
								type="button"
								style="font-size: 11px; padding: 4px 10px; border-radius: var(--radius-pill); background: var(--bg-input); color: var(--text-secondary); font-weight: 600;"
								onclick={() => applyPreset(p)}
							>
								{p.name} ({p.amount} ₴)
							</button>
						{/each}
					</div>

					<label>
						<span>{t.sandbox.step1.purposeLabel}</span>
						<input
							bind:value={purpose}
							maxlength="48"
							placeholder={t.sandbox.step1.purposePlaceholder}
						/>
					</label>

					<div class="demo-input-row">
						<label>
							<span>{t.sandbox.step1.amountLabel}</span>
							<input bind:value={amount} type="number" min="1" max="1000000" />
						</label>
						<label>
							<span>{t.sandbox.step1.tableLabel}</span>
							<input bind:value={table} maxlength="32" />
						</label>
					</div>

					<button class="integration-action" type="submit">
						{t.sandbox.step1.submitBtn}
						<ArrowRight
							size={15}
							style="display: inline-block; vertical-align: middle; margin-left: 4px;"
						/>
					</button>
				</form>

				<!-- Step 2: Customer Checkout -->
				<div class="integration-step integration-checkout">
					<header>
						<span>{t.sandbox.step2.badge}</span>
						<div>
							<small>{t.sandbox.step2.small}</small>
							<h4>{t.sandbox.step2.title}</h4>
						</div>
					</header>

					{#if invoice}
						<div class="embedded-checkout">
							<div class="embedded-phone-bar">
								<span>9:41</span>
								<b>Rahunok Pay</b>
								<span>5G</span>
							</div>

							<div class="checkout-order-area" style="padding: 0 0 6px;">
								<div class="checkout-merchant-row">
									<div class="checkout-merchant-avatar">К</div>
									<span style="color: var(--mockup-text); font-weight: 700;"
										>{t.sandbox.step2.merchantName} · {invoice.table}</span
									>
								</div>
								<div class="checkout-amount-display" style="font-size: 24px; margin: 2px 0;">
									{formatMoney(invoice.amount)}
								</div>
								<div
									class="checkout-status-chip"
									class:paid={status === 'success'}
									class:processing={status === 'processing'}
									style="font-size: 9px; padding: 2px 8px;"
								>
									<i></i>
									<span
										>{status === 'success'
											? t.sandbox.step2.btnSuccess
											: status === 'processing'
												? 'Обробка…'
												: 'Очікує оплати'}</span
									>
								</div>
							</div>

							<div
								class="app-clip-sheet"
								style="position: static; padding: 10px 8px; border-radius: 18px;"
							>
								<header class="sheet-header">
									<button class="sheet-close-btn" type="button" aria-label="Закрити">✕</button>
									<div class="sheet-center-title">
										<b class="sheet-recipient" style="font-size: 11.5px;"
											>{t.sandbox.step2.merchantName}</b
										>
										<small class="sheet-security">
											<svg
												viewBox="0 0 24 24"
												width="8"
												height="8"
												stroke="currentColor"
												stroke-width="2.5"
												fill="none"
												><rect x="3" y="11" width="18" height="11" rx="2" /><path
													d="M7 11V7a5 5 0 0 1 10 0v4"
												/></svg
											>
											{t.sandbox.step2.security}
										</small>
									</div>
									<button class="sheet-info-btn" type="button" aria-label="Інформація">ⓘ</button>
								</header>

								<div class="sheet-badges-row" style="margin-bottom: 6px;">
									<span class="sheet-badge-fee" style="font-size: 9.5px; padding: 2px 8px;"
										>{t.sandbox.step2.noFee}</span
									>
									<button
										class="sheet-badge-banks"
										type="button"
										style="font-size: 9.5px; padding: 2px 8px;"
									>
										<svg viewBox="0 0 24 24" width="10" height="10" fill="currentColor"
											><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect
												x="14"
												y="3"
												width="7"
												height="7"
												rx="1.5"
											/><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect
												x="14"
												y="14"
												width="7"
												height="7"
												rx="1.5"
											/></svg
										>
										{t.sandbox.step2.allBanks}
									</button>
								</div>

								<div class="embedded-banks vertical-bank-list">
									{#each banks.filter((b) => b.id === 'abank24') as bank, i}
										<button
											type="button"
											class="vertical-bank-row selected"
											onclick={() =>
												(selectedBankIndex = banks.findIndex((b) => b.id === 'abank24'))}
										>
											<span class="checkout-bank-card__top">
												<span class="checkout-bank-card__identity">
													<span class="checkout-bank-card__logo"
														><img src={bank.logo} alt="" loading="lazy" /></span
													>
													<strong>{bank.shortName}</strong>
												</span>
												<em>{bank.code}</em>
											</span>
										</button>
									{/each}
								</div>

								<button
									class="app-clip-action-btn"
									type="button"
									disabled={status === 'processing'}
									onclick={simulatePayment}
									style="margin-top: 6px;"
								>
									{#if status === 'processing'}
										{t.sandbox.step2.btnChecking(banks[selectedBankIndex].name)}
									{:else if status === 'success'}
										{t.sandbox.step2.btnSuccess}
									{:else}
										{t.sandbox.step2.btnConfirm(banks[selectedBankIndex].shortName)}
									{/if}
								</button>
							</div>
						</div>
					{:else}
						<div class="integration-empty">
							<i>+</i>
							<span>
								<b>{t.sandbox.step2.emptyTitle}</b>
								<small>{t.sandbox.step2.emptyDesc}</small>
							</span>
						</div>
					{/if}
				</div>

				<!-- Step 3: Server Confirmation -->
				<div class="integration-step integration-result">
					<header>
						<span>{t.sandbox.step3.badge}</span>
						<div>
							<small>{t.sandbox.step3.small}</small>
							<h4>{t.sandbox.step3.title}</h4>
						</div>
					</header>

					<div
						class="verification-orbit"
						class:processing={status === 'processing'}
						class:success={status === 'success'}
					>
						{#if status === 'success'}
							✓
						{:else if status === 'processing'}
							•••
						{:else}
							<svg
								xmlns="http://www.w3.org/2000/svg"
								width="28"
								height="28"
								viewBox="0 0 208 221"
								fill="none"
							>
								<g>
									<path
										d="M108.903 29.2451C119.845 29.2451 129.281 31.4851 137.211 35.9649C145.14 40.4448 151.167 46.3148 155.29 53.5752C159.413 60.8356 161.475 68.6366 161.475 76.9783C161.475 86.8647 158.62 96.0563 152.911 104.552C147.361 112.894 139.193 119.15 128.409 123.321L169.325 191.445C144.049 191.445 120.737 178.182 108.337 156.747L94.6296 133.053C82.5427 133.053 72.7443 142.588 72.7443 154.351V191.445C53.3001 191.445 37.5375 176.106 37.5375 157.183V137.192C37.5375 118.27 53.3001 102.93 72.7443 102.93C105.753 104.095 124.948 105.313 126.268 80.4542C126.648 60.1615 109.721 58.9323 72.7443 60.7583H69.9196C52.0355 60.7583 37.5375 46.6494 37.5375 29.2451H108.903ZM101.528 102.93C109.299 102.93 115.326 100.768 119.608 96.4421C124.048 91.9623 126.268 86.633 126.268 80.4542C126.268 74.7384 124.365 70.0268 120.559 66.3194C116.753 62.612 111.202 60.7583 103.907 60.7583H72.7443C109.721 58.9323 126.648 60.1615 126.268 80.4542C124.948 105.313 105.753 104.095 72.7443 102.93H101.528Z"
										fill="currentColor"
									/>
								</g>
							</svg>
						{/if}
					</div>

					<div class="verification-copy">
						<strong>
							{status === 'success'
								? t.sandbox.step3.successStatus
								: status === 'processing'
									? t.sandbox.step3.processingStatus
									: t.sandbox.step3.waitingStatus}
						</strong>
						<p>
							{status === 'success'
								? t.sandbox.step3.successDesc(formatMoney(invoice?.amount ?? amount))
								: t.sandbox.step3.waitingDesc}
						</p>
					</div>

					<div class="verification-meta">
						<span>A2A CALLBACK</span>
						<i>→</i>
						<span>SERVER WEBHOOK</span>
						<i>→</i>
						<b>DIRECT IBAN</b>
					</div>
				</div>
			</div>

			<footer class="integration-footer">
				{#each t.sandbox.footerTags as tag}
					<span>{tag}</span>
				{/each}
			</footer>
		</div>
	</div>
</section>
