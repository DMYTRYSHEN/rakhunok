<script lang="ts">
	import { onMount } from 'svelte';
	import {
		ArrowRight,
		Check,
		Landmark,
		Link2,
		QrCode,
		ReceiptText,
		Smartphone,
		Sparkles,
		Store
	} from '@lucide/svelte';
	import { checkoutBanks } from '../bank-options';
	import BankLogoCarousel from './BankLogoCarousel.svelte';
	import type { Translations } from '../data/translations';

	type Role = 'merchant' | 'payer';

	let { t }: { t: Translations } = $props();

	let role = $state<Role>('merchant');
	let activeStep = $state(0);
	let paused = $state(false);
	let reducedMotion = $state(true);
	let cycleRevision = $state(0);
	let selectedBank = $state(0);
	const scenario = $derived(t.scenarios[role]);
	const aBankOnly = checkoutBanks.filter((b) => b.id === 'abank24');

	onMount(() => {
		const media = window.matchMedia('(prefers-reduced-motion: reduce)');
		const updateMotion = () => (reducedMotion = media.matches);
		updateMotion();
		media.addEventListener('change', updateMotion);
		return () => media.removeEventListener('change', updateMotion);
	});

	$effect(() => {
		if (paused || reducedMotion) return;
		role;
		activeStep;
		cycleRevision;
		const timer = window.setTimeout(advanceStory, 3400);
		return () => window.clearTimeout(timer);
	});

	function advanceStory() {
		if (activeStep < scenario.steps.length - 1) {
			activeStep += 1;
			return;
		}
		role = role === 'merchant' ? 'payer' : 'merchant';
		activeStep = 0;
	}

	function restartCycle() {
		cycleRevision += 1;
	}

	function chooseRole(nextRole: Role) {
		role = nextRole;
		activeStep = 0;
		selectedBank = 0;
		restartCycle();
	}

	function nextStep() {
		activeStep = (activeStep + 1) % scenario.steps.length;
		restartCycle();
	}

	function chooseStep(index: number) {
		activeStep = index;
		restartCycle();
	}
</script>

<section class="role-scenarios section" id="how-it-works">
	<div class="container">
		<header class="role-scenarios__heading">
			<div>
				<p class="eyebrow">
					<span>{t.scenarios.eyebrow}</span>
				</p>
				<h2>{t.scenarios.title}</h2>
			</div>
			<div class="role-switch" role="tablist" aria-label="Оберіть сторону платежу">
				<span>Роль:</span>
				<button
					type="button"
					role="tab"
					aria-selected={role === 'merchant'}
					class:active={role === 'merchant'}
					onclick={() => chooseRole('merchant')}
				>
					{t.scenarios.merchantRole}
				</button>
				<i>/</i>
				<button
					type="button"
					role="tab"
					aria-selected={role === 'payer'}
					class:active={role === 'payer'}
					onclick={() => chooseRole('payer')}
				>
					{t.scenarios.payerRole}
				</button>
			</div>
		</header>

		<div
			class="role-story spotlight-card"
			data-role={role}
			role="group"
			aria-label="Покроковий сценарій платежу"
			onpointerenter={() => (paused = true)}
			onpointerleave={() => {
				paused = false;
				restartCycle();
			}}
			onfocusin={() => (paused = true)}
			onfocusout={(event) => {
				if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
					paused = false;
					restartCycle();
				}
			}}
		>
			<div class="role-story__copy">
				<p class="role-story__eyebrow">{scenario.eyebrow}</p>
				<h3>{scenario.title}</h3>
				<p class="role-story__intro">{scenario.intro}</p>

				<div class="role-steps">
					{#each scenario.steps as step, index (step.title)}
						<button
							type="button"
							class:active={activeStep === index}
							onclick={() => chooseStep(index)}
						>
							<span>{String(index + 1).padStart(2, '0')}</span>
							<div>
								<strong>{step.title}</strong>
								<p>{step.text}</p>
							</div>
							<ArrowRight size={17} aria-hidden="true" />
						</button>
					{/each}
				</div>
			</div>

			<div class="role-demo" aria-live="polite">
				<div class="role-phone">
					<div class="role-phone__bar">
						<span>9:41</span>
						<i></i>
						<b>5G • 100%</b>
					</div>

					{#if role === 'merchant'}
						<!-- Authentic Merchant POS App UI -->
						<div class="merchant-flow" data-step={activeStep}>
							<header>
								<div style="display: flex; align-items: center; gap: 8px;">
									<Store size={16} style="color: #c9ff4a;" />
									<div>
										<small style="color: var(--mockup-text-dim); font-size: 10px;"
											>Каса · Тераса</small
										>
										<strong style="font-size: 12px; color: var(--mockup-text);"
											>Кав'ярня «Крапка»</strong
										>
									</div>
								</div>
								<span
									style="background: #c9ff4a; color: #000; font-size: 11px; font-weight: 800; padding: 2px 6px; border-radius: 4px;"
									>POS</span
								>
							</header>

							{#if activeStep === 0}
								<div class="merchant-amount">
									<small>Стіл 12 · Сума замовлення</small>
									<strong>490<span class="cur">₴</span></strong>
								</div>
								<div class="merchant-keypad">
									{#each ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '✓'] as key}
										<i>{key}</i>
									{/each}
								</div>
								<button type="button" onclick={nextStep}>
									Створити рахунок <ArrowRight size={16} />
								</button>
							{:else if activeStep === 1}
								<div class="merchant-amount" style="text-align: left;">
									<div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
										<ReceiptText size={18} style="color: var(--mockup-accent);" />
										<small style="font-weight: 800; color: var(--mockup-accent);"
											>ФІКСОВАНИЙ РАХУНОК</small
										>
									</div>
									<strong style="font-size: 24px; margin-bottom: 8px;">490,00 ₴</strong>
									<div class="mockup-detail-row"><span>Стіл</span> <b>Стіл 12 · Тераса</b></div>
									<div class="mockup-detail-row"><span>IBAN</span> <b>UA89...4821</b></div>
									<div class="mockup-detail-row">
										<span>Призначення</span> <b>Замовлення #1046</b>
									</div>
								</div>
								<button type="button" onclick={nextStep}> Показати QR-код </button>
							{:else if activeStep === 2}
								<div class="merchant-amount">
									<small style="color: var(--mockup-success); font-weight: 800;"
										>РАХУНОК АКТИВНО</small
									>
									<strong style="font-size: 22px; margin: 4px 0 10px;">490,00 ₴</strong>
									<div
										style="background: var(--mockup-text); padding: 10px; border-radius: 12px; display: inline-block; margin-bottom: 8px;"
									>
										<QrCode size={80} color="var(--mockup-bg)" />
									</div>
									<p class="mockup-caption">Очікуємо сканування клієнтом</p>
								</div>
								<button type="button" onclick={nextStep}>
									<Link2 size={16} /> Надіслати посилання
								</button>
							{:else}
								<div class="merchant-amount" style="border-color: rgba(48,209,88,0.3);">
									<div class="mockup-success-icon">
										<Check size={24} />
									</div>
									<small style="color: var(--mockup-success); font-weight: 800;"
										>ОПЛАТУ ЗАРАХОВАНО</small
									>
									<strong style="font-size: 26px; margin: 4px 0; color: var(--mockup-success);"
										>+ 490,00 ₴</strong
									>
									<p class="mockup-caption">Чек ПРРО сформовано автоматично</p>
								</div>
								<button type="button" onclick={nextStep}> Новий чек </button>
							{/if}
						</div>
					{:else}
						<!-- Authentic App Clip Checkout UI -->
						<div class="payer-flow" data-step={activeStep}>
							{#if activeStep === 0}
								<div class="merchant-amount">
									<div
										style="background: var(--mockup-text); padding: 10px; border-radius: 12px; display: inline-block; margin-bottom: 10px;"
									>
										<QrCode size={70} color="var(--mockup-bg)" />
									</div>
									<small style="color: var(--mockup-accent); font-weight: 800;">RAHUNOK PAY</small>
									<strong style="font-size: 20px; margin: 2px 0 6px;">App Clip Checkout</strong>
									<p class="mockup-caption">Швидка оплата без встановлення додатків</p>
								</div>
								<button type="button" onclick={nextStep}> Відкрити чекаут </button>
							{:else if activeStep === 1}
								<div class="checkout-order-area" style="padding: 0 0 6px;">
									<div class="checkout-merchant-row">
										<div class="checkout-merchant-avatar">К</div>
										<span style="color: var(--mockup-text); font-weight: 700;"
											>Кав'ярня «Крапка»</span
										>
									</div>
									<div class="checkout-amount-display" style="font-size: 26px; margin: 2px 0;">
										490,00 ₴
									</div>
									<div class="checkout-status-chip" style="font-size: 9px; padding: 2px 8px;">
										<i></i>
										<span>Очікує вибору банку</span>
									</div>
								</div>
								<div
									class="app-clip-sheet"
									style="position: static; padding: 10px 8px; border-radius: 20px;"
								>
									<header class="sheet-header">
										<button
											class="sheet-close-btn"
											type="button"
											aria-label="Закрити"
											onclick={nextStep}>✕</button
										>
										<div class="sheet-center-title">
											<b class="sheet-recipient" style="font-size: 11.5px;">Кав'ярня «Крапка»</b>
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
												Rahunok · NBU 003
											</small>
										</div>
										<button class="sheet-info-btn" type="button" aria-label="Інформація">ⓘ</button>
									</header>
									<div class="sheet-badges-row" style="margin-bottom: 6px;">
										<span class="sheet-badge-fee" style="font-size: 9.5px; padding: 2px 8px;"
											>Без комісії</span
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
											Усі банки
										</button>
									</div>
									<BankLogoCarousel
										banks={aBankOnly}
										bind:selected={selectedBank}
										autoplay={false}
									/>
									<button
										class="app-clip-action-btn"
										type="button"
										onclick={nextStep}
										style="margin-top: 6px;"
									>
										{t.sandbox.step2.btnConfirm(aBankOnly[0].shortName)}
									</button>
								</div>
							{:else if activeStep === 2}
								<div class="merchant-amount" style="text-align: left;">
									<div style="display: flex; align-items: center; gap: 8px; margin-bottom: 10px;">
										<Landmark size={18} style="color: #03d350;" />
										<small style="font-weight: 800; color: #03d350;">БАНКІВСЬКИЙ ДОДАТОК</small>
									</div>
									<strong style="font-size: 22px; margin-bottom: 6px; color: var(--mockup-text);"
										>490,00 ₴</strong
									>
									<div class="mockup-detail-row">
										<span>Отримувач</span> <b>Кав'ярня «Крапка»</b>
									</div>
									<div class="mockup-detail-row">
										<span>Призначення</span> <b>Замовлення #1046</b>
									</div>
									<div class="mockup-detail-row"><span>Комісія</span> <b>0 ₴</b></div>
								</div>
								<button type="button" onclick={nextStep}>
									<Smartphone size={16} /> Підтвердити FaceID
								</button>
							{:else}
								<div
									class="merchant-amount"
									style="border-color: rgba(48,209,88,0.3); background: var(--mockup-surface); padding: 14px 10px;"
								>
									<div
										class="mockup-success-icon"
										style="width: 44px; height: 44px; border-radius: 22px; margin: 0 auto 8px;"
									>
										<Check size={22} />
									</div>
									<small style="color: var(--mockup-success); font-weight: 800; font-size: 10px;"
										>ОПЛАТУ ЗАРАХОВАНО</small
									>
									<strong style="font-size: 22px; margin: 2px 0 6px; color: var(--mockup-text);"
										>490,00 ₴</strong
									>
									<div class="mockup-detail-row" style="font-size: 10px;">
										<span>Мерчант</span> <b>Кав'ярня «Крапка»</b>
									</div>
									<div class="mockup-detail-row" style="font-size: 10px;">
										<span>ПРРО</span> <b style="color: #30d158;">✓ Фіскалізовано #89421</b>
									</div>
								</div>
								<button type="button" onclick={nextStep} style="margin-top: 8px;"> Готово </button>
							{/if}
						</div>
					{/if}
				</div>

				<div class="role-demo__progress">
					<span>Крок {activeStep + 1} із 4</span>
					<div>
						{#each scenario.steps as _, index}
							<button
								type="button"
								aria-label={`Крок ${index + 1}`}
								class:active={activeStep === index}
								onclick={() => chooseStep(index)}
							></button>
						{/each}
					</div>
				</div>
			</div>
		</div>
	</div>
</section>
