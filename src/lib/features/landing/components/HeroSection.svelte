<script lang="ts">
	import { onMount } from 'svelte';
	import {
		ArrowRight,
		ArrowUpRight,
		Building2,
		Check,
		CircleCheck,
		CreditCard,
		LayoutDashboard,
		QrCode,
		Receipt,
		ScrollText,
		ShieldCheck,
		Sparkles,
		Store,
		WalletCards
	} from '@lucide/svelte';
	import { checkoutBanks } from '../bank-options';
	import { reveal } from '../actions/reveal';
	import BankLogoCarousel from './BankLogoCarousel.svelte';
	import type { Translations } from '../data/translations';

	let { onSignup, t }: { onSignup: () => void; t: Translations } = $props();
	let activeStep = $state(0);
	let selectedBank = $state(0);
	let interactionTimer: number | undefined;
	let successTimer: number | undefined;
	let autoplayTimer: number | undefined;
	let headlineTimer: number | undefined;
	let audienceTimer: number | undefined;
	let successfulPayments = $state(185);
	let averageCheck = $state(698);
	let todayRevenue = $state(128420);

	let headline = $state('');
	let headlineTyping = $state(false);
	let isPersonalAudience = $state(false);
	let audienceChanging = $state(false);
	const banks = checkoutBanks;
	const nextHeadline = $derived(
		t.hero.finalHeadlineStart + t.hero.finalHeadlineMiddle + t.hero.finalHeadlineEnd
	);

	$effect(() => {
		headline = t.hero.initialHeadlinePrefix + t.hero.initialHeadlineAccent;
	});

	function headlineSlice(start: number, length: number) {
		return headline.slice(start, start + length);
	}

	function rotateAudience() {
		audienceChanging = true;
		window.setTimeout(() => {
			isPersonalAudience = !isPersonalAudience;
			audienceChanging = false;
		}, 240);
	}

	function animateHeadline() {
		let current = headline.length;
		headlineTyping = true;
		const targetHeadline = nextHeadline;

		const erase = () => {
			if (current > 0) {
				headline = headline.slice(0, --current);
				headlineTimer = window.setTimeout(erase, 24);
				return;
			}

			let next = 0;
			const type = () => {
				headline = targetHeadline.slice(0, ++next);
				if (next < targetHeadline.length) headlineTimer = window.setTimeout(type, 46);
				else headlineTyping = false;
			};
			headlineTimer = window.setTimeout(type, 180);
		};

		erase();
	}

	let sweepTimer: ReturnType<typeof setTimeout> | undefined;
	let resumeTimer: ReturnType<typeof setTimeout> | undefined;
	let userInteracted = $state(false);

	const aBankIndex = checkoutBanks.findIndex((b) => b.id === 'abank24' || b.id === 'abank');
	const targetBankIndex = aBankIndex >= 0 ? aBankIndex : checkoutBanks.length - 1;

	// Rotating bank targets demonstrating multiple Ukrainian banks in natural trackpad 2-bank gestures
	const showcaseTargets = [
		{ start: 0, target: 2 }, // 0 (ПУМБ) -> trackpad swipe 2 banks -> 2 (NovaPay)
		{ start: 2, target: 4 }, // 2 (NovaPay) -> trackpad swipe 2 banks -> 4 (Приват24)
		{ start: 4, target: 3 }, // 4 (Приват24) -> trackpad swipe -> 3 (monobank)
		{ start: 3, target: 5 }, // 3 (monobank) -> trackpad swipe 2 banks -> 5 (Sense Bank)
		{ start: 5, target: targetBankIndex } // 5 (Sense) -> trackpad swipe -> 26 (А-Банк)
	];
	let showcaseCycle = 0;

	function stopAutoplay() {
		userInteracted = true;
		if (sweepTimer) clearTimeout(sweepTimer);
		if (interactionTimer) clearTimeout(interactionTimer);
		if (successTimer) clearTimeout(successTimer);
		if (resumeTimer) clearTimeout(resumeTimer);

		// Resume automated demo after 4.5s of idle
		resumeTimer = setTimeout(() => {
			userInteracted = false;
			runNaturalTrackpadDemo();
		}, 4500);
	}

	function runNaturalTrackpadDemo() {
		if (userInteracted) return;

		const currentShowcase = showcaseTargets[showcaseCycle % showcaseTargets.length];
		showcaseCycle++;

		activeStep = 1;
		selectedBank = currentShowcase.start;

		// 1. Initial pause (600ms) before natural trackpad flick
		sweepTimer = setTimeout(() => {
			if (userInteracted) return;

			// 2. Smooth trackpad swipe across ~2 banks to target
			selectedBank = currentShowcase.target;

			// 3. User settles & presses action button after 1100ms
			sweepTimer = setTimeout(() => {
				if (userInteracted) return;

				// 4. Click button -> Processing state
				activeStep = 2;

				// 5. Processing for 1.4s -> Authentic success screen
				sweepTimer = setTimeout(() => {
					if (userInteracted) return;

					// 6. Step 3: Success screen with stage celebration pulse
					completePayment();

					// 7. Stay on success screen for 2.8s, then smoothly pick next bank
					sweepTimer = setTimeout(() => {
						if (userInteracted) return;
						runNaturalTrackpadDemo();
					}, 2800);
				}, 1400);
			}, 1100);
		}, 600);
	}

	function selectBank(index: number) {
		stopAutoplay();
		selectedBank = index;
		activeStep = 1;
	}

	function completePayment() {
		activeStep = 3;
		successfulPayments += 1;
		todayRevenue += 490;
		averageCheck = 698 + Math.floor(Math.random() * 11) - 5;
	}

	function continuePayment() {
		stopAutoplay();
		if (sweepTimer) clearTimeout(sweepTimer);
		if (interactionTimer) clearTimeout(interactionTimer);
		if (successTimer) clearTimeout(successTimer);

		if (activeStep === 3) {
			activeStep = 1;
			return;
		}
		activeStep = 2;
		interactionTimer = window.setTimeout(() => {
			activeStep = 2;
			successTimer = window.setTimeout(completePayment, 1800);
		}, 600);
	}

	function closeStatus() {
		stopAutoplay();
		activeStep = 1;
	}

	function moveStage(event: PointerEvent) {
		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
		const stage = event.currentTarget as HTMLElement;
		const rect = stage.getBoundingClientRect();
		stage.style.setProperty(
			'--pointer-x',
			`${((event.clientX - rect.left) / rect.width - 0.5) * 12}px`
		);
		stage.style.setProperty(
			'--pointer-y',
			`${((event.clientY - rect.top) / rect.height - 0.5) * 10}px`
		);
	}

	function resetStage(event: PointerEvent) {
		const stage = event.currentTarget as HTMLElement;
		stage.style.setProperty('--pointer-x', '0px');
		stage.style.setProperty('--pointer-y', '0px');
	}

	onMount(() => {
		const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		if (!reducedMotion) audienceTimer = window.setInterval(rotateAudience, 3600);
		headlineTimer = window.setTimeout(() => {
			if (reducedMotion) headline = nextHeadline;
			else animateHeadline();
		}, 5000);

		if (reducedMotion) {
			activeStep = 3;
		} else {
			sweepTimer = setTimeout(runNaturalTrackpadDemo, 800);
		}
		return () => {
			if (sweepTimer) clearTimeout(sweepTimer);
			window.clearInterval(audienceTimer);
			window.clearTimeout(interactionTimer);
			window.clearTimeout(successTimer);
			window.clearTimeout(headlineTimer);
		};
	});
</script>

<section class="hero" aria-labelledby="hero-title">
	<div class="hero-grid container">
		<div class="hero-message">
			<p class="eyebrow" style="font-size: 10px;">
				<span>{t.brand.name}</span>
				<span class="eyebrow-audience" class:changing={audienceChanging}>
					{isPersonalAudience ? t.hero.eyebrowAudience.personal : t.hero.eyebrowAudience.business}
				</span>
			</p>

			<h1
				id="hero-title"
				class:typing={headlineTyping}
				aria-label={headline}
				style="min-height: 2.8em;"
			>
				{#if headline.startsWith(t.hero.initialHeadlinePrefix.trim().slice(0, 4))}
					{headlineSlice(0, t.hero.initialHeadlinePrefix.length)}<span
						class="headline-gradient-terminal"
						>{headlineSlice(
							t.hero.initialHeadlinePrefix.length,
							t.hero.initialHeadlineAccent.length
						)}</span
					>
				{:else}
					<span class="headline-gradient-payment"
						>{headlineSlice(0, t.hero.finalHeadlineStart.length)}</span
					>{headlineSlice(t.hero.finalHeadlineStart.length, t.hero.finalHeadlineMiddle.length)}<span
						class="headline-gradient-natural"
						>{headlineSlice(
							t.hero.finalHeadlineStart.length + t.hero.finalHeadlineMiddle.length,
							t.hero.finalHeadlineEnd.length
						)}</span
					>
				{/if}<span class="typing-caret" aria-hidden="true"></span>
			</h1>

			<p class="hero-copy">
				{t.hero.subhead}
			</p>

			<div class="hero-actions">
				<button class="button button-primary hero-cta" type="button" onclick={onSignup}>
					{t.hero.tryPilotBtn}
					<ArrowRight size={16} aria-hidden="true" />
				</button>
				<a class="button button-secondary" href="#demo">{t.hero.calculateSavingsBtn}</a>
			</div>

			<div class="hero-proof" aria-label="Ключові можливості">
				<div>
					<b>{t.hero.proof.zeroHardware.title}</b>
					<span>{t.hero.proof.zeroHardware.desc}</span>
				</div>
				<div>
					<b>{t.hero.proof.instantSettlement.title}</b>
					<span>{t.hero.proof.instantSettlement.desc}</span>
				</div>
				<div>
					<b>{t.hero.proof.autoPrro.title}</b>
					<span>{t.hero.proof.autoPrro.desc}</span>
				</div>
			</div>
		</div>

		<div
			class="product-stage"
			class:payment-success-pulse={activeStep === 3}
			use:reveal
			role="group"
			aria-label="Інтерактивна симуляція Dashboard та Checkout"
			onpointermove={moveStage}
			onpointerleave={resetStage}
		>
			<!-- Authentic Project Dashboard -->
			<div class="project-dashboard-shell">
				<aside class="project-sidebar">
					<div class="project-sidebar-brand">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="16"
							height="16"
							viewBox="0 0 208 221"
							fill="none"
							class="brand-icon"
							style="margin-right: -4px;"
						>
							<g>
								<path
									d="M108.903 29.2451C119.845 29.2451 129.281 31.4851 137.211 35.9649C145.14 40.4448 151.167 46.3148 155.29 53.5752C159.413 60.8356 161.475 68.6366 161.475 76.9783C161.475 86.8647 158.62 96.0563 152.911 104.552C147.361 112.894 139.193 119.15 128.409 123.321L169.325 191.445C144.049 191.445 120.737 178.182 108.337 156.747L94.6296 133.053C82.5427 133.053 72.7443 142.588 72.7443 154.351V191.445C53.3001 191.445 37.5375 176.106 37.5375 157.183V137.192C37.5375 118.27 53.3001 102.93 72.7443 102.93C105.753 104.095 124.948 105.313 126.268 80.4542C126.648 60.1615 109.721 58.9323 72.7443 60.7583H69.9196C52.0355 60.7583 37.5375 46.6494 37.5375 29.2451H108.903ZM101.528 102.93C109.299 102.93 115.326 100.768 119.608 96.4421C124.048 91.9623 126.268 86.633 126.268 80.4542C126.268 74.7384 124.365 70.0268 120.559 66.3194C116.753 62.612 111.202 60.7583 103.907 60.7583H72.7443C109.721 58.9323 126.648 60.1615 126.268 80.4542C124.948 105.313 105.753 104.095 72.7443 102.93H101.528Z"
									fill="currentColor"
								/>
								<path
									d="M72.7443 102.93C53.3001 102.93 37.5375 118.27 37.5375 137.192V157.183C37.5375 176.106 53.3001 191.445 72.7443 191.445V154.351C72.7443 142.588 82.5427 133.053 94.6296 133.053L108.337 156.747C120.737 178.182 144.049 191.445 169.325 191.445L128.409 123.321C139.193 119.15 147.361 112.894 152.911 104.552C158.62 96.0563 161.475 86.8647 161.475 76.9783C161.475 68.6366 159.413 60.8356 155.29 53.5752C151.167 46.3148 145.14 40.4448 137.211 35.9649C129.281 31.4851 119.845 29.2451 108.903 29.2451H37.5375C37.5375 46.6494 52.0355 60.7583 69.9196 60.7583H72.7443M72.7443 102.93H101.528C109.299 102.93 115.326 100.768 119.608 96.4421C124.048 91.9623 126.268 86.633 126.268 80.4542M72.7443 102.93C105.753 104.095 124.948 105.313 126.268 80.4542M72.7443 60.7583H103.907C111.202 60.7583 116.753 62.612 120.559 66.3194C124.365 70.0268 126.268 74.7384 126.268 80.4542M72.7443 60.7583C109.721 58.9323 126.648 60.1615 126.268 80.4542"
									stroke="currentColor"
									stroke-width="0.05"
								/>
							</g>
						</svg>
						<b>{t.hero.dashboard.title}</b>
					</div>

					<nav class="project-sidebar-nav">
						<small>{t.hero.dashboard.navManagement}</small>
						<div class="project-nav-item active">
							<LayoutDashboard size={14} />
							<span>{t.hero.dashboard.navOverview}</span>
						</div>
						<div class="project-nav-item">
							<Store size={14} />
							<span>{t.hero.dashboard.navPos}</span>
						</div>
						<div class="project-nav-item">
							<Receipt size={14} />
							<span>{t.hero.dashboard.navInvoices}</span>
						</div>
						<small style="margin-top: 8px;">{t.hero.dashboard.navManagement}</small>
						<div class="project-nav-item">
							<Building2 size={14} />
							<span>{t.hero.dashboard.navStructure}</span>
						</div>
						<div class="project-nav-item">
							<ScrollText size={14} />
							<span>{t.hero.dashboard.navRules}</span>
						</div>
					</nav>

					<div class="project-sidebar-footer">
						<div>RC</div>
						<span>Rahunok Coffee</span>
					</div>
				</aside>

				<div class="project-dashboard-main">
					<header class="project-dash-header">
						<b>{t.hero.dashboard.financialOverview}</b>
						<span><i></i> Supabase</span>
					</header>

					<div class="project-dash-content">
						<div class="project-metric-grid">
							<div class="project-metric-card">
								<small>{t.hero.dashboard.todayRevenue}</small>
								<strong class:metric-updated={activeStep === 3}
									>{todayRevenue.toLocaleString('uk-UA').replace(/\u00a0/g, ' ')} ₴</strong
								>
								<span>+12,4%</span>
							</div>
							<div class="project-metric-card">
								<small>{t.hero.dashboard.successfulPayments}</small>
								<strong class:metric-updated={activeStep === 3}>{successfulPayments}</strong>
								<span>99,4%</span>
							</div>
							<div class="project-metric-card">
								<small>{t.hero.dashboard.avgCheck}</small>
								<strong class:metric-updated={activeStep === 3}>{averageCheck} ₴</strong>
								<span>QR · Link</span>
							</div>
						</div>

						<div class="project-invoices-card">
							<header>
								<span>{t.hero.dashboard.recentOperations}</span>
								<span style="font-size: 10px; color: #0071e3; cursor: pointer;"
									>{t.hero.dashboard.navInvoices} →</span
								>
							</header>

							<div
								class="project-invoice-row"
								style={activeStep === 3 ? 'background: rgba(16, 185, 129, 0.08);' : ''}
							>
								<div>
									<b>{t.hero.dashboard.dinnerTable}</b>
									<span style="display: block; font-size: 10px; color: #6b7280;">щойно</span>
								</div>
								<strong>490 ₴</strong>
								<div>
									<span class="project-status-badge {activeStep === 3 ? 'paid' : 'pending'}">
										{activeStep === 3 ? `✓ ${t.hero.dashboard.statusPaid}` : '•• Очікує'}
									</span>
								</div>
								<span style="font-size: 11px; color: #6b7280; text-align: right;">QR</span>
							</div>

							<div class="project-invoice-row">
								<div>
									<b>{t.hero.dashboard.lunchTable}</b>
									<span style="display: block; font-size: 10px; color: #6b7280;">2 хв тому</span>
								</div>
								<strong>850 ₴</strong>
								<div>
									<span class="project-status-badge paid">✓ {t.hero.dashboard.statusPaid}</span>
								</div>
								<span style="font-size: 11px; color: #6b7280; text-align: right;">QR</span>
							</div>

							<div class="project-invoice-row">
								<div>
									<b>{t.hero.dashboard.coffeeTable}</b>
									<span style="display: block; font-size: 10px; color: #6b7280;">8 хв тому</span>
								</div>
								<strong>140 ₴</strong>
								<div>
									<span class="project-status-badge paid">✓ {t.hero.dashboard.statusPaid}</span>
								</div>
								<span style="font-size: 11px; color: #6b7280; text-align: right;">Link</span>
							</div>
						</div>
					</div>
				</div>
			</div>

			<!-- Authentic Project Checkout (App Clip bottom sheet) -->
			<div class="authentic-checkout-device">
				<div class="app-clip-header">
					<span>{t.hero.checkout.time}</span>
					<b>{t.hero.checkout.appTitle}</b>
					<span>5G</span>
				</div>

				<div class="checkout-order-area">
					<div class="checkout-merchant-row">
						<div class="checkout-merchant-avatar">К</div>
						<span>{t.hero.checkout.merchantName}</span>
					</div>
					<div class="checkout-amount-display">490,00 ₴</div>
					<div
						class="checkout-status-chip"
						class:paid={activeStep === 3}
						class:processing={activeStep === 2}
					>
						<i></i>
						<span
							>{activeStep === 3
								? t.hero.checkout.statusPaid
								: activeStep === 2
									? t.hero.checkout.statusProcessing
									: t.hero.checkout.statusWaiting}</span
						>
					</div>
				</div>

				<div class="app-clip-sheet">
					<header class="sheet-header">
						<button
							class="sheet-close-btn"
							type="button"
							aria-label="Закрити"
							onclick={() => (activeStep = 1)}>✕</button
						>
						<div class="sheet-center-title">
							<b class="sheet-recipient">{t.hero.checkout.merchantName}</b>
							<small class="sheet-security">
								<svg
									viewBox="0 0 24 24"
									width="9"
									height="9"
									stroke="currentColor"
									stroke-width="2.5"
									fill="none"
									><rect x="3" y="11" width="18" height="11" rx="2" /><path
										d="M7 11V7a5 5 0 0 1 10 0v4"
									/></svg
								>
								{t.hero.checkout.securityBadge}
							</small>
						</div>
						<button class="sheet-info-btn" type="button" aria-label="Інформація">ⓘ</button>
					</header>

					<div class="sheet-amount-area">
						<strong class="sheet-amount">490,00 ₴</strong>
					</div>

					<div class="sheet-badges-row">
						<span class="sheet-badge-fee">{t.hero.checkout.noFeeBadge}</span>
						<button
							class="sheet-badge-banks"
							type="button"
							onclick={() => selectBank((selectedBank + 1) % banks.length)}
						>
							<svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor"
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
							{t.hero.checkout.allBanks}
						</button>
					</div>

					<BankLogoCarousel
						{banks}
						bind:selected={selectedBank}
						autoplay={activeStep === 1}
						interval={320}
						onselect={selectBank}
					/>

					<button
						class="app-clip-action-btn"
						type="button"
						disabled={activeStep === 2}
						onclick={continuePayment}
					>
						{#if activeStep === 2}
							{t.hero.checkout.processingAction(banks[selectedBank].name)}
						{:else}
							{t.hero.checkout.payAction(banks[selectedBank].shortName)}
						{/if}
					</button>
				</div>

				{#if activeStep === 3}
					<div class="checkout-success-screen">
						<div class="checkout-success-content">
							<div class="checkout-success-icon">
								<svg class="checkout-success-check" viewBox="0 0 24 24">
									<polyline points="20 6 9 17 4 12"></polyline>
								</svg>
							</div>
							<h3 class="checkout-success-title">{t.hero.checkout.successTitle}</h3>
							<div class="checkout-success-amount">490,00 ₴</div>

							<div class="checkout-success-card">
								<div class="summary-row">
									<span class="summary-label">Мерчант</span>
									<span class="summary-value">{t.hero.checkout.merchantName}</span>
								</div>
								<div class="summary-row">
									<span class="summary-label">Банк</span>
									<span class="summary-value">{banks[selectedBank].name}</span>
								</div>
								<div class="summary-row">
									<span class="summary-label">Призначення</span>
									<span class="summary-value">{t.hero.checkout.receiptOrder}</span>
								</div>
								<div class="summary-row">
									<span class="summary-label">ПРРО</span>
									<span class="summary-value discount">{t.hero.checkout.receiptFiscal}</span>
								</div>
							</div>

							<button class="checkout-success-btn" type="button" onclick={continuePayment}>
								{t.hero.checkout.readyAction}
							</button>
						</div>
					</div>
				{/if}
			</div>
		</div>
	</div>

	<div class="hero-foot container">
		<p>{t.hero.pipeline.note}</p>
		<div>
			<span>{t.hero.pipeline.customer}</span>
			<i>→</i>
			<span>{t.hero.pipeline.theirBank}</span>
			<i>→</i>
			<span>{t.hero.pipeline.yourAccount}</span>
		</div>
	</div>
</section>
