<script lang="ts">
	import {
		Dumbbell,
		Check,
		ChevronRight,
		ChevronLeft,
		QrCode,
		CreditCard,
		MapPin,
		Clock,
		Sparkles
	} from '@lucide/svelte';
	import type {
		FitnessFlowData,
		FitnessTariffPeriod
	} from '$lib/features/shared/checkout-scenario-config';
	import {
		calculateFitnessOrderPrice,
		pruneFitnessSelections,
		type FitnessOrderMode,
		type FitnessOrderSelections
	} from '$lib/features/shared/fitness-pricing';

	let {
		flowData = {},
		onPay
	}: {
		flowData?: Partial<FitnessFlowData>;
		onPay: (amount: number) => void;
	} = $props();

	const defaultData: FitnessFlowData = {
		clubBrand: 'Pulse Fitness Club',
		tagline: 'Сила, здоровʼя та енергія кожного дня',
		description: 'Сучасний фітнес-простір з басейном, спа-зоною та персональними тренерами',
		contacts: {
			phone: '+380 44 233 44 55',
			telegram: '@pulse_fitness_admin',
			instagram: '@pulse_fit_ua',
			address: 'вул. Спаська, 12, Київ'
		},
		modes: {
			newMembershipEnabled: true,
			renewalEnabled: true,
			addonOnlyEnabled: true,
			receptionPayEnabled: true,
			newMembershipButtonText: 'Оформити новий абонемент',
			renewalButtonText: 'Продовжити мій абонемент',
			addonOnlyButtonText: 'Докупити послуги / тренування',
			receptionPayButtonText: 'Швидка оплата на рецепції'
		},
		clubs: [
			{
				id: 'pulse_podil',
				name: 'Pulse Fitness Podil',
				address: 'вул. Спаська, 12, Київ',
				workingHours: 'Пн-Пт: 07:00 – 22:00, Сб-Нд: 08:00 – 21:00',
				phone: '+380 44 233 44 55',
				amenities: ['Тренажерна зала', 'Басейн 25м', 'Фінська сауна', 'Бокс-зона'],
				availableTariffIds: ['day', 'week', 'month']
			},
			{
				id: 'pulse_pechersk',
				name: 'Pulse Fitness Pechersk',
				address: 'бул. Лесі Українки, 26, Київ',
				workingHours: 'Пн-Нд: 07:00 – 23:00',
				phone: '+380 44 599 88 77',
				amenities: ['Тренажерна зала', 'Зона кросфіту', 'SPA-зона', 'Фіто-бар'],
				availableTariffIds: ['day', 'week', 'month']
			}
		],
		tariffs: [
			{
				id: 'day',
				name: 'Денний візит',
				period: 'day',
				price: 300,
				description: 'Тренажерна зала + душові на 1 день без обмеження часу',
				includesGym: true,
				includesPool: false,
				includesSauna: false,
				durationDays: 1,
				allowedHoursNotice: '07:00 – 22:00 у день візиту'
			},
			{
				id: 'week',
				name: 'Тижневий інтенсив',
				period: 'week',
				price: 900,
				description: '7 днів повного доступу до кардіо та силової зони',
				includesGym: true,
				includesPool: false,
				includesSauna: false,
				durationDays: 7,
				allowedHoursNotice: '7 календарних днів поспіль'
			},
			{
				id: 'month',
				name: 'Місячний безліміт',
				period: 'month',
				price: 1800,
				description: 'Необмежений доступ у будь-який час, вступний інструктаж тренера',
				includesGym: true,
				includesPool: false,
				includesSauna: false,
				durationDays: 30,
				allowedHoursNotice: '1 календарний місяць, щоденно 07:00 – 22:00',
				badge: 'POPULAR'
			}
		],
		addons: [
			{
				id: 'pool',
				name: 'Басейн (Аква-зона)',
				category: 'access',
				price: 600,
				priceModel: 'match_tariff',
				description: 'Доріжки 25м, аква-зона та гідромасаж',
				icon: '🏊‍♂️'
			},
			{
				id: 'locker',
				name: 'Персональна шафка',
				category: 'resource',
				price: 300,
				priceModel: 'match_tariff',
				description: 'Індивідуальна шафка в роздягальні з електронним замком',
				icon: '🔒',
				totalLockers: 150,
				availableLockers: 14
			},
			{
				id: 'trainings_4',
				name: '4 Персональні тренування',
				category: 'credits',
				price: 2000,
				creditCount: 4,
				priceModel: 'fixed_bundle',
				description: 'Індивідуальні тренування з топ-тренером (500 ₴/сесія)',
				icon: '🥊'
			}
		],
		approval: {
			autoApprovalEnabled: true,
			requireManualForLocker: false,
			requireManualForCorporate: true,
			telegramChat: '@pulse_fitness_admin',
			responseTimeNotice: 'Миттєве зарахування та автовидача цифрового QR-абонемента'
		},
		rules: {
			allowFreeze: true,
			maxFreezeDays: 14,
			refundNotice: 'Заморозка до 14 днів безкоштовно. Повернення коштів за правилами клубу.',
			entryMethod: 'qr_reception'
		}
	};

	let data = $derived<FitnessFlowData>({
		...defaultData,
		...flowData,
		contacts: { ...defaultData.contacts, ...(flowData?.contacts ?? {}) },
		modes: { ...defaultData.modes, ...(flowData?.modes ?? {}) },
		clubs: flowData?.clubs?.length ? flowData.clubs : defaultData.clubs,
		tariffs: flowData?.tariffs?.length ? flowData.tariffs : defaultData.tariffs,
		addons: flowData?.addons?.length ? flowData.addons : defaultData.addons,
		approval: { ...defaultData.approval, ...(flowData?.approval ?? {}) },
		rules: { ...defaultData.rules, ...(flowData?.rules ?? {}) }
	});

	let currentMode = $state<FitnessOrderMode>('new_membership');
	let step = $state<1 | 2 | 3 | 4>(1);

	let selectedClubId = $state('pulse_podil');
	let selectedTariffId = $state('month');
	let startDateType = $state<'today' | 'custom_date'>('today');
	let customStartDate = $state(new Date().toISOString().split('T')[0]);
	let selectedAddonIds = $state<string[]>(['pool', 'locker', 'trainings_4']);
	let trainingCount = $state(4);
	let towelCount = $state(0);
	let clientName = $state('Олександр Коваленко');
	let clientPhone = $state('+380 67 111 22 33');
	let clientEmail = $state('alex.kovalenko@example.com');
	let memberCardId = $state('PULSE-4700-142');
	let renewalTargetPeriod = $state<FitnessTariffPeriod>('month');
	let receptionReceiptId = $state('REC-8291');
	let receptionAmount = $state(4700);

	let simulatedCreditsUsed = $state(0);

	const pricing = $derived.by(() => {
		const rawSelections: FitnessOrderSelections = {
			mode: currentMode,
			clubId: selectedClubId,
			tariffId: selectedTariffId,
			startDateType,
			customStartDate,
			selectedAddonIds,
			trainingCount,
			towelCount,
			clientName,
			clientPhone,
			clientEmail,
			memberCardId,
			renewalTargetPeriod,
			receptionReceiptId,
			receptionAmount
		};
		const pruned = pruneFitnessSelections(data, rawSelections);
		return calculateFitnessOrderPrice(data, pruned);
	});

	function toggleAddon(addonId: string) {
		if (selectedAddonIds.includes(addonId)) {
			selectedAddonIds = selectedAddonIds.filter((id) => id !== addonId);
		} else {
			selectedAddonIds = [...selectedAddonIds, addonId];
		}
	}

	function useOneTrainingCredit() {
		const maxCredits = pricing.issuedCard.trainingCreditsTotal;
		if (simulatedCreditsUsed < maxCredits) {
			simulatedCreditsUsed++;
		}
	}
	
	function resetSimulatedUsage() {
		simulatedCreditsUsed = 0;
	}
</script>

<div class="premium-root">
	<!-- APPLE HIG HEADER & SEGMENTED MODE SELECTOR -->
	<header class="premium-header">
		<div class="header-top">
			<div class="header-titles">
				<span class="micro-title">{data.clubBrand}</span>
				<h1 class="main-title">Клубний Доступ</h1>
			</div>
			<div class="header-icon">
				<Dumbbell size={20} strokeWidth={2.5} />
			</div>
		</div>

		<!-- HIG Segmented Control -->
		<div class="ios-segmented-control">
			<button class="ios-segment" class:active={currentMode === 'new_membership'} onclick={() => { currentMode = 'new_membership'; step = 1; }}>Новий</button>
			<button class="ios-segment" class:active={currentMode === 'renewal'} onclick={() => { currentMode = 'renewal'; step = 1; }}>Продовження</button>
			<button class="ios-segment" class:active={currentMode === 'addon_only'} onclick={() => { currentMode = 'addon_only'; step = 1; }}>Послуги</button>
			<button class="ios-segment" class:active={currentMode === 'reception_pay'} onclick={() => { currentMode = 'reception_pay'; step = 1; }}>Рецепція</button>
		</div>

		<!-- Stepper (only for new_membership) -->
		{#if currentMode === 'new_membership'}
		<div class="stepper">
			{#each [1, 2, 3, 4] as s}
				<div class="stepper-dot" class:active={step >= s}></div>
			{/each}
		</div>
		{/if}
	</header>

	<main class="premium-main">
		{#if currentMode === 'new_membership'}
			{#if step === 1}
				<section class="section">
					<h2 class="section-title">Оберіть філію</h2>
					<div class="horizontal-scroll">
						{#each data.clubs as club}
							<label class="radio-label">
								<input type="radio" name="club" value={club.id} bind:group={selectedClubId} class="peer-radio" />
								<div class="hig-card card-hover-fx card-w240">
									<div class="card-icon-row">
										<div class="icon-box"><MapPin size={18} strokeWidth={2.5} /></div>
										<div class="hig-radio-ring">
											<div class="hig-radio-dot"></div>
										</div>
									</div>
									<h3 class="card-title">{club.name}</h3>
									<p class="card-subtitle"><Clock size={12} class="inline-icon" /> {club.workingHours}</p>
								</div>
							</label>
						{/each}
					</div>
				</section>

				<section class="section mt-2">
					<h2 class="section-title">Тариф абонемента</h2>
					<div class="vertical-stack">
						{#each data.tariffs as tariff}
							<label class="radio-label">
								<input type="radio" name="tariff" value={tariff.id} bind:group={selectedTariffId} class="peer-radio" />
								<div class="hig-card card-hover-fx flex-row-between">
									<div class="card-col-left">
										{#if tariff.badge}
											<span class="hig-badge">{tariff.badge}</span>
										{/if}
										<h3 class="card-title">{tariff.name}</h3>
										<span class="card-subtitle">{tariff.durationDays} днів доступу</span>
									</div>
									<div class="card-col-right">
										<div class="price-wrap">
											<span class="hig-price">{tariff.price}</span>
											<span class="currency">₴</span>
										</div>
									</div>
								</div>
							</label>
						{/each}
					</div>
				</section>

			{:else if step === 2}
				<section class="section">
					<h2 class="section-title">Додаткові послуги</h2>
					<div class="vertical-stack">
						{#each data.addons as addon}
							{@const isSelected = selectedAddonIds.includes(addon.id)}
							<label class="radio-label">
								<input type="checkbox" checked={isSelected} onchange={() => toggleAddon(addon.id)} class="peer-radio" />
								<div class="hig-card card-hover-fx flex-row-center">
									<div class="addon-emoji">{addon.icon || '✨'}</div>
									<div class="card-col-left">
										<h3 class="card-title-sm">{addon.name}</h3>
										<p class="card-subtitle-sm">{addon.description}</p>
										<div class="addon-price">+{addon.price} ₴</div>
									</div>
									<div class="hig-toggle">
										<div class="hig-toggle-knob"></div>
									</div>
								</div>
							</label>
						{/each}
					</div>
				</section>

			{:else if step === 3}
				<section class="section">
					<h2 class="section-title">Контактні дані</h2>
					<div class="vertical-stack">
						<input type="text" bind:value={clientName} placeholder="Прізвище та ім'я" class="hig-input" />
						<input type="tel" bind:value={clientPhone} placeholder="Номер телефону" class="hig-input" />
						<input type="email" bind:value={clientEmail} placeholder="Email адреса" class="hig-input" />
					</div>
				</section>

			{:else if step === 4}
				<section class="section pass-section">
					<h2 class="section-title text-center">Ваша цифрова картка</h2>
					
					<div class="wallet-pass">
						<!-- Pass Perforations -->
						<div class="pass-cutout-left"></div>
						<div class="pass-cutout-right"></div>
						
						<div class="pass-top">
							<Dumbbell size={22} strokeWidth={2.5} class="pass-brand-icon" />
							<span class="pass-badge">CLUB PASS</span>
						</div>
						
						<h3 class="pass-owner">{clientName.split(' ')[0]}</h3>
						<p class="pass-desc">{pricing.summaryLabel}</p>

						<div class="qr-container">
							<div class="qr-box">
								<QrCode size={100} strokeWidth={1.5} />
							</div>
						</div>

						<div class="pass-bottom">
							<span class="pass-total-lbl">До сплати</span>
							<div class="pass-total">
								<span class="pass-price">{pricing.totalAmount}</span>
								<span class="pass-currency">₴</span>
							</div>
						</div>
					</div>
				</section>
			{/if}

		{:else if currentMode === 'renewal'}
			<section class="section">
				<h2 class="section-title">Дані абонемента</h2>
				<div class="vertical-stack">
					<input type="text" bind:value={memberCardId} placeholder="PULSE-4700-142 або +380..." class="hig-input" />
					
					<div class="hig-banner">
						<Sparkles size={20} class="banner-icon" />
						<div class="banner-content">
							<strong>Знайдено абонемент</strong>
							<span>{clientName} · Картка #{memberCardId}</span>
							<small>Продовжується на 30 днів від кінцевої дати</small>
						</div>
					</div>
				</div>
			</section>

		{:else if currentMode === 'addon_only'}
			<section class="section">
				<h2 class="section-title">Докупівля послуг</h2>
				<div class="vertical-stack">
					{#each data.addons as addon}
						{@const isSelected = selectedAddonIds.includes(addon.id)}
						<label class="radio-label">
							<input type="checkbox" checked={isSelected} onchange={() => toggleAddon(addon.id)} class="peer-radio" />
							<div class="hig-card card-hover-fx flex-row-center">
								<div class="addon-emoji">{addon.icon || '✨'}</div>
								<div class="card-col-left">
									<h3 class="card-title-sm">{addon.name}</h3>
									<p class="card-subtitle-sm">{addon.description}</p>
									<div class="addon-price">+{addon.price} ₴</div>
								</div>
								<div class="hig-toggle">
									<div class="hig-toggle-knob"></div>
								</div>
							</div>
						</label>
					{/each}
				</div>
			</section>

		{:else if currentMode === 'reception_pay'}
			<section class="section">
				<h2 class="section-title">Швидка оплата</h2>
				<div class="vertical-stack">
					<input type="text" bind:value={receptionReceiptId} placeholder="Номер чека / замовлення" class="hig-input" />
					<div class="hig-input-wrap">
						<span class="input-prefix">₴</span>
						<input type="number" bind:value={receptionAmount} placeholder="Сума до сплати" class="hig-input amount-input" />
					</div>
				</div>
			</section>
		{/if}
	</main>

	<!-- THUMB ZONE (Sticky Action Bar) -->
	<div class="hig-thumb-zone">
		<div class="thumb-container">
			{#if currentMode === 'new_membership'}
				{#if step > 1}
					<button onclick={() => step--} class="btn-hig-secondary">
						<ChevronLeft size={24} strokeWidth={2.5} />
					</button>
				{/if}
				
				{#if step < 4}
					<button onclick={() => step++} class="btn-hig-primary">
						<span>Продовжити</span>
						<div class="btn-hig-right">
							<span class="btn-hig-price">{pricing.totalAmount} ₴</span>
							<ChevronRight size={20} strokeWidth={2.5} />
						</div>
					</button>
				{:else}
					<button onclick={() => onPay(pricing.totalAmount)} class="btn-hig-primary btn-success">
						<CreditCard size={20} strokeWidth={2.5} />
						<span>Оплатити {pricing.totalAmount} ₴</span>
					</button>
				{/if}
			{:else}
				<button onclick={() => onPay(pricing.totalAmount)} class="btn-hig-primary btn-success">
					<CreditCard size={20} strokeWidth={2.5} />
					<span>Оплатити {pricing.totalAmount} ₴</span>
				</button>
			{/if}
		</div>
	</div>
</div>

<style>
	/* VARIABLES: Native CSS custom properties fallback mapping to apps/pay */
	.premium-root {
		--bg: var(--order-bg, #f5f5f7);
		--surface: var(--order-surface, #ffffff);
		--surface-alt: var(--order-surface-2, #e5e5ea);
		--surface-hover: rgba(0, 0, 0, 0.03);
		--text: var(--order-text, #1d1d1f);
		--text-sec: var(--order-text-dim, #86868b);
		--divider: var(--order-divider, rgba(0,0,0,0.1));
		--cta: var(--order-cta, #007aff);
		--cta-text: var(--order-cta-text, #ffffff);
		--success: #34c759;
		
		background: transparent;
		color: var(--text);
		font-family: var(--font-stack, -apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", sans-serif);
		width: 100%;
		position: relative;
		overflow-x: hidden;
		padding-bottom: 110px; /* space for thumb zone */
		-webkit-font-smoothing: antialiased;
	}

	:global(body:not(.light-mode)) .premium-root {
		--surface-hover: rgba(255, 255, 255, 0.05);
		--divider: rgba(255, 255, 255, 0.15);
	}

	/* Typography Polish */
	.micro-title {
		font-size: 11px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--text-sec);
	}

	.main-title {
		font-size: 22px;
		font-weight: 700;
		letter-spacing: -0.02em;
		margin: 2px 0 0;
	}

	.section-title {
		font-size: 13px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--text-sec);
		margin: 0 0 10px 4px;
	}
	
	.text-center { text-align: center; margin-left: 0; }

	.premium-header {
		padding: 20px 20px 12px;
		background: transparent;
	}

	.header-top {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 16px;
	}

	.header-icon {
		height: 40px;
		width: 40px;
		background: var(--text);
		color: var(--bg);
		border-radius: 12px;
		display: flex;
		align-items: center;
		justify-content: center;
		box-shadow: 0 4px 12px rgba(0,0,0,0.08);
	}

	/* iOS UISegmentedControl Replica */
	.ios-segmented-control {
		display: flex;
		background: var(--surface-alt);
		border-radius: 9px;
		padding: 2px;
		margin-bottom: 16px;
		overflow-x: auto;
		scroll-snap-type: x mandatory;
	}
	
	.ios-segmented-control::-webkit-scrollbar { display: none; }

	.ios-segment {
		flex: 1;
		min-width: max-content;
		padding: 6px 14px;
		font-size: 13px;
		font-weight: 500;
		color: var(--text);
		background: transparent;
		border: none;
		border-radius: 7px;
		cursor: pointer;
		transition: all 0.2s cubic-bezier(0.2, 0.8, 0.2, 1);
		scroll-snap-align: start;
	}

	.ios-segment.active {
		background: var(--surface);
		font-weight: 600;
		box-shadow: 0 3px 8px rgba(0,0,0,0.12), 0 3px 1px rgba(0,0,0,0.04);
	}

	.stepper {
		display: flex;
		gap: 6px;
	}

	.stepper-dot {
		height: 4px;
		flex: 1;
		background: var(--surface-alt);
		border-radius: 2px;
		transition: background 0.3s ease;
	}

	.stepper-dot.active {
		background: var(--text);
	}

	.premium-main {
		padding: 0 20px 20px;
		display: flex;
		flex-direction: column;
		gap: 24px;
	}

	/* Layout primitives */
	.horizontal-scroll {
		display: flex;
		overflow-x: auto;
		scroll-snap-type: x mandatory;
		gap: 12px;
		padding-bottom: 16px;
		margin: 0 -20px;
		padding-left: 20px;
		padding-right: 20px;
		-webkit-overflow-scrolling: touch;
	}
	
	.horizontal-scroll::-webkit-scrollbar { display: none; }
	.vertical-stack { display: flex; flex-direction: column; gap: 12px; }

	.radio-label {
		cursor: pointer;
		display: block;
		position: relative;
		-webkit-tap-highlight-color: transparent;
	}
	.peer-radio { position: absolute; opacity: 0; pointer-events: none; }

	/* HIG Cards */
	.hig-card {
		background: var(--surface);
		border: 1px solid var(--divider);
		border-radius: 16px;
		padding: 16px;
		transition: all 0.2s cubic-bezier(0.2, 0.8, 0.2, 1);
		box-shadow: 0 2px 8px rgba(0,0,0,0.02);
	}

	.card-w240 {
		width: 240px;
		flex: none;
		scroll-snap-align: center;
	}
	
	.flex-row-between { display: flex; justify-content: space-between; }
	.flex-row-center { display: flex; align-items: center; }

	.radio-label:active .card-hover-fx {
		transform: scale(0.97);
		background: var(--surface-hover);
	}

	.peer-radio:checked + .hig-card {
		border-color: var(--cta);
		border-width: 2px;
		padding: 15px; /* Offset border width change to avoid layout shift */
	}

	/* Card Internals */
	.card-icon-row {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 16px;
	}

	.icon-box {
		height: 36px;
		width: 36px;
		background: var(--surface-alt);
		color: var(--text);
		border-radius: 10px;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	/* HIG Radio styling */
	.hig-radio-ring {
		height: 22px;
		width: 22px;
		border-radius: 50%;
		border: 1.5px solid var(--text-sec);
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.2s;
	}

	.hig-radio-dot {
		height: 10px;
		width: 10px;
		border-radius: 50%;
		background: var(--surface);
		transform: scale(0);
		transition: transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1);
	}

	.peer-radio:checked + .hig-card .hig-radio-ring {
		border-color: var(--cta);
		background: var(--cta);
	}
	
	.peer-radio:checked + .hig-card .hig-radio-dot {
		transform: scale(1);
	}

	.card-title {
		font-size: 16px;
		font-weight: 600;
		letter-spacing: -0.01em;
		margin: 0 0 4px;
	}

	.card-title-sm {
		font-size: 15px;
		font-weight: 600;
		margin: 0 0 2px;
	}

	.card-subtitle {
		font-size: 13px;
		color: var(--text-sec);
		display: flex;
		align-items: center;
		gap: 4px;
	}

	.card-subtitle-sm {
		font-size: 13px;
		color: var(--text-sec);
		margin: 0;
	}

	.card-col-left { display: flex; flex-direction: column; flex: 1; padding-right: 12px; justify-content: center; }
	.card-col-right { display: flex; align-items: center; justify-content: flex-end; }

	.hig-badge {
		font-size: 10px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--cta);
		margin-bottom: 6px;
		display: inline-block;
	}

	.price-wrap { display: flex; align-items: flex-start; }

	.hig-price {
		font-size: 24px;
		font-weight: 700;
		letter-spacing: -0.03em;
		line-height: 1;
	}

	.currency {
		font-size: 13px;
		font-weight: 600;
		color: var(--text-sec);
		margin-left: 3px;
		margin-top: 1px;
	}

	.addon-emoji {
		font-size: 24px;
		height: 48px;
		width: 48px;
		background: var(--surface-alt);
		border-radius: 12px;
		display: flex;
		align-items: center;
		justify-content: center;
		margin-right: 14px;
		flex-shrink: 0;
	}

	.addon-price {
		font-size: 14px;
		font-weight: 600;
		margin-top: 4px;
	}

	/* HIG Toggle Switch */
	.hig-toggle {
		width: 51px;
		height: 31px;
		background: var(--surface-alt);
		border-radius: 16px;
		position: relative;
		transition: background 0.3s;
		flex-shrink: 0;
	}

	.peer-radio:checked + .hig-card .hig-toggle,
	.peer-radio:checked + .hig-card .hig-toggle {
		background: var(--success);
	}

	.hig-toggle-knob {
		width: 27px;
		height: 27px;
		background: #ffffff;
		border-radius: 50%;
		position: absolute;
		top: 2px;
		left: 2px;
		transition: transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
		box-shadow: 0 3px 8px rgba(0,0,0,0.15), 0 3px 1px rgba(0,0,0,0.06);
	}

	.peer-radio:checked + .hig-card .hig-toggle-knob {
		transform: translateX(20px);
	}

	/* Inputs */
	.hig-input {
		width: 100%;
		height: 52px;
		background: var(--surface);
		border: 1px solid var(--divider);
		border-radius: 12px;
		padding: 0 16px;
		font-size: 16px;
		font-weight: 500;
		color: var(--text);
		outline: none;
		transition: all 0.2s;
		box-shadow: inset 0 1px 2px rgba(0,0,0,0.02);
	}

	.hig-input::placeholder { color: var(--text-sec); font-weight: 400; }
	.hig-input:focus { border-color: var(--cta); box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.15); }

	.hig-input-wrap { position: relative; }
	.input-prefix {
		position: absolute;
		left: 16px;
		top: 50%;
		transform: translateY(-50%);
		font-size: 16px;
		font-weight: 600;
		color: var(--text-sec);
	}
	.amount-input {
		padding-left: 36px;
		color: var(--success);
		font-weight: 600;
	}

	/* Banners */
	.hig-banner {
		display: flex;
		align-items: flex-start;
		gap: 12px;
		background: rgba(0, 122, 255, 0.08);
		border-radius: 12px;
		padding: 16px;
		color: var(--cta);
	}
	
	.banner-icon { flex-shrink: 0; margin-top: 2px; }
	.banner-content { display: flex; flex-direction: column; font-size: 13px; }
	.banner-content strong { font-weight: 600; margin-bottom: 2px; }
	.banner-content small { margin-top: 4px; opacity: 0.8; font-size: 12px; }

	/* Wallet Pass Ticket */
	.wallet-pass {
		background: linear-gradient(135deg, #18181b, #27272a);
		color: #ffffff;
		border-radius: 20px;
		padding: 24px;
		width: 100%;
		position: relative;
		overflow: hidden;
		box-shadow: 0 12px 32px rgba(0,0,0,0.12);
	}

	.pass-cutout-left, .pass-cutout-right {
		position: absolute;
		top: 50%;
		width: 24px;
		height: 24px;
		background: var(--bg);
		border-radius: 50%;
		transform: translateY(-50%);
		z-index: 10;
	}

	.pass-cutout-left { left: -12px; }
	.pass-cutout-right { right: -12px; }

	.pass-top {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 20px;
	}

	.pass-brand-icon { color: #34c759; }

	.pass-badge {
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.05em;
		opacity: 0.6;
	}

	.pass-owner {
		font-size: 24px;
		font-weight: 700;
		letter-spacing: -0.01em;
		line-height: 1;
		margin: 0 0 6px;
	}

	.pass-desc {
		font-size: 13px;
		font-weight: 500;
		opacity: 0.7;
		margin: 0 0 24px;
	}

	.qr-container {
		background: #ffffff;
		border-radius: 16px;
		padding: 20px;
		display: flex;
		justify-content: center;
		align-items: center;
		margin-bottom: 24px;
	}
	
	.qr-box {
		color: #000;
	}

	.pass-bottom {
		border-top: 1px dashed rgba(255,255,255,0.2);
		padding-top: 20px;
	}

	.pass-total-lbl {
		font-size: 12px;
		font-weight: 500;
		opacity: 0.7;
	}

	.pass-total {
		display: flex;
		align-items: flex-start;
		margin-top: 4px;
	}

	.pass-price {
		font-size: 28px;
		font-weight: 700;
		letter-spacing: -0.02em;
	}

	.pass-currency {
		font-size: 14px;
		font-weight: 600;
		opacity: 0.7;
		margin-left: 4px;
		margin-top: 2px;
	}

	/* THUMB ZONE (Sticky Action Bar) */
	.hig-thumb-zone {
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		z-index: 50;
		padding: 16px;
		padding-bottom: calc(16px + env(safe-area-inset-bottom));
		background: rgba(255, 255, 255, 0.8);
		backdrop-filter: blur(40px) saturate(200%);
		-webkit-backdrop-filter: blur(40px) saturate(200%);
		border-top: 0.5px solid rgba(0,0,0,0.15);
	}

	:global(body:not(.light-mode)) .hig-thumb-zone {
		background: rgba(28, 28, 30, 0.8);
		border-top-color: rgba(255,255,255,0.15);
	}

	.thumb-container {
		max-width: 480px;
		margin: 0 auto;
		display: flex;
		gap: 12px;
	}

	.btn-hig-secondary {
		height: 54px;
		width: 54px;
		border-radius: 16px;
		background: var(--surface-alt);
		color: var(--text);
		border: none;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		flex-shrink: 0;
		transition: all 0.2s cubic-bezier(0.2, 0.8, 0.2, 1);
	}

	.btn-hig-primary {
		height: 54px;
		flex: 1;
		border-radius: 16px;
		background: var(--cta);
		color: var(--cta-text);
		border: none;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0 20px;
		font-size: 16px;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s cubic-bezier(0.2, 0.8, 0.2, 1);
	}

	.btn-success {
		background: var(--success);
		justify-content: center;
		gap: 10px;
	}

	.btn-hig-primary:active, .btn-hig-secondary:active {
		transform: scale(0.96);
		opacity: 0.9;
	}

	.btn-hig-right {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.btn-hig-price {
		font-size: 14px;
		font-weight: 500;
		opacity: 0.9;
	}
</style>
