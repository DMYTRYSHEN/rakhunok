<script lang="ts">
	import {
		Dumbbell,
		Calendar,
		Clock,
		MapPin,
		ShieldCheck,
		AlertTriangle,
		Ticket,
		Check,
		ChevronRight,
		ChevronLeft,
		QrCode,
		User,
		Info,
		RotateCcw,
		Sparkles,
		Waves,
		Lock,
		CreditCard,
		KeyRound
	} from '@lucide/svelte';
	import type {
		FitnessFlowData,
		FitnessClub,
		FitnessTariff,
		FitnessAddon,
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
				name: 'Денний візит (Разовий)',
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
				badge: 'Найпопулярніший'
			}
		],
		addons: [
			{
				id: 'pool',
				name: 'Доступ до басейну (на строк абонемента)',
				category: 'access',
				price: 600,
				priceModel: 'match_tariff',
				description: 'Доріжки 25м, аква-зона та гідромасаж',
				icon: '🏊‍♂️'
			},
			{
				id: 'locker',
				name: 'Персональна закріплена шафка',
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
				name: 'Пакет 4 персональних тренувань',
				category: 'credits',
				price: 2000,
				creditCount: 4,
				priceModel: 'fixed_bundle',
				description: 'Індивідуальні тренування з топ-тренером (500 ₴/сесія)',
				icon: '🥊'
			},
			{
				id: 'towel',
				name: 'Оренда преміум-рушника (разово)',
				category: 'usage',
				price: 50,
				priceModel: 'per_use',
				description: 'Великий махровий рушник на кожне тренування',
				icon: '🧖'
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

	// Mode & Apple HIG 4-Step Window State
	let currentMode = $state<FitnessOrderMode>('new_membership');
	let step = $state<1 | 2 | 3 | 4>(1);

	// Default selections: Month (1 800 ₴) + Pool (600 ₴) + Locker (300 ₴) + 4 Trainings (2 000 ₴) = 4 700 ₴
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

	// Simulator state for redeemed training credits
	let simulatedCreditsUsed = $state(0);

	// Calculation derived
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

	function resetSimulatedUsage() {
		simulatedCreditsUsed = 0;
	}

	function useOneTrainingCredit() {
		const maxCredits = pricing.issuedCard.trainingCreditsTotal;
		if (simulatedCreditsUsed < maxCredits) {
			simulatedCreditsUsed++;
		}
	}
</script>

<div class="ios-root">
	<!-- APPLE HIG HEADER & SEGMENTED MODE SELECTOR -->
	<header class="ios-header">
		<div class="ios-nav-top">
			<span class="ios-nav-sub">{data.clubBrand || 'Pulse Fitness Club'}</span>
			<h4 class="ios-nav-title">Абонементи & Клубний Доступ</h4>
		</div>

		<!-- Segmented Control -->
		<div class="ios-segmented">
			<button
				type="button"
				class="ios-segment-btn"
				class:active={currentMode === 'new_membership'}
				onclick={() => {
					currentMode = 'new_membership';
					step = 1;
				}}
			>
				Новий абонемент
			</button>
			<button
				type="button"
				class="ios-segment-btn"
				class:active={currentMode === 'renewal'}
				onclick={() => {
					currentMode = 'renewal';
					step = 1;
				}}
			>
				Продовження
			</button>
			<button
				type="button"
				class="ios-segment-btn"
				class:active={currentMode === 'addon_only'}
				onclick={() => {
					currentMode = 'addon_only';
					step = 1;
				}}
			>
				Додаткові послуги
			</button>
			<button
				type="button"
				class="ios-segment-btn"
				class:active={currentMode === 'reception_pay'}
				onclick={() => {
					currentMode = 'reception_pay';
					step = 1;
				}}
			>
				На рецепції
			</button>
		</div>

		<!-- Step Capsules (For New Membership) -->
		{#if currentMode === 'new_membership'}
			<div class="ios-stepper-capsules">
				<div class="ios-capsule-item" class:active={step === 1} class:done={step > 1}>
					<span class="capsule-num">1</span>
					<span class="capsule-lbl">Клуб & Тариф</span>
				</div>
				<div class="ios-capsule-item" class:active={step === 2} class:done={step > 2}>
					<span class="capsule-num">2</span>
					<span class="capsule-lbl">Послуги & Зони</span>
				</div>
				<div class="ios-capsule-item" class:active={step === 3} class:done={step > 3}>
					<span class="capsule-num">3</span>
					<span class="capsule-lbl">Контакти</span>
				</div>
				<div class="ios-capsule-item" class:active={step === 4} class:done={step > 4}>
					<span class="capsule-num">4</span>
					<span class="capsule-lbl">Картка & Оплата</span>
				</div>
			</div>
		{/if}
	</header>

	<!-- MAIN CONTENT BODY -->
	<main class="ios-body">
		{#if currentMode === 'new_membership'}
			<!-- WINDOW 1: CLUB & TARIFF SELECTION -->
			{#if step === 1}
				<!-- Club Selector Inset Group -->
				<div class="ios-card">
					<span class="ios-card-title">Оберіть філію або клуб:</span>
					<div class="ios-club-list">
						{#each data.clubs as club (club.id)}
							<button
								type="button"
								class="ios-club-row"
								class:selected={selectedClubId === club.id}
								onclick={() => (selectedClubId = club.id)}
							>
								<div class="ios-club-info">
									<strong class="ios-club-name">{club.name}</strong>
									<span class="ios-club-addr">
										<MapPin size={12} /> {club.address}
									</span>
									<span class="ios-club-hours">
										<Clock size={12} /> {club.workingHours}
									</span>
								</div>
								{#if selectedClubId === club.id}
									<div class="ios-check-circle">
										<Check size={14} />
									</div>
								{/if}
							</button>
						{/each}
					</div>
				</div>

				<!-- Tariff Selector Inset Group -->
				<div class="ios-card">
					<span class="ios-card-title">Тариф абонемента:</span>
					<div class="ios-tariff-grid">
						{#each data.tariffs as tariff (tariff.id)}
							<button
								type="button"
								class="ios-tariff-card"
								class:selected={selectedTariffId === tariff.id}
								onclick={() => (selectedTariffId = tariff.id)}
							>
								{#if tariff.badge}
									<span class="ios-badge-pill">{tariff.badge}</span>
								{/if}
								<div class="ios-tariff-header">
									<strong class="ios-tariff-title">{tariff.name}</strong>
									<span class="ios-tariff-price">{tariff.price} ₴</span>
								</div>
								<p class="ios-tariff-desc">{tariff.description}</p>
								<div class="ios-tariff-hours">
									<Clock size={12} />
									<span>{tariff.allowedHoursNotice}</span>
								</div>
								{#if selectedTariffId === tariff.id}
									<div class="ios-check-circle corner">
										<Check size={14} />
									</div>
								{/if}
							</button>
						{/each}
					</div>
				</div>

				<!-- Date Selection Inset Group -->
				<div class="ios-card">
					<span class="ios-card-title">Дата активації абонемента:</span>
					<div class="ios-date-selector">
						<div class="ios-segmented-sm">
							<button
								type="button"
								class="ios-seg-sm-btn"
								class:active={startDateType === 'today'}
								onclick={() => (startDateType = 'today')}
							>
								З сьогоднішнього дня
							</button>
							<button
								type="button"
								class="ios-seg-sm-btn"
								class:active={startDateType === 'custom_date'}
								onclick={() => (startDateType = 'custom_date')}
							>
								Обрати дату старту
							</button>
						</div>

						{#if startDateType === 'custom_date'}
							<div class="ios-date-input-wrap mt-2">
								<input
									type="date"
									class="ios-input"
									bind:value={customStartDate}
								/>
							</div>
						{/if}

						<div class="ios-validity-banner">
							<Sparkles size={16} class="text-indigo-600" />
							<div>
								<strong>Термін дії:</strong>
								<span>{pricing.startDateFormatted} — {pricing.endDateFormatted}</span>
								<small class="block text-zinc-500">{pricing.validityDaysNotice}</small>
							</div>
						</div>
					</div>
				</div>

			<!-- WINDOW 2: ADDONS & RESOURCES -->
			{:else if step === 2}
				<div class="ios-card">
					<div class="ios-card-head-row">
						<div>
							<span class="ios-card-title">Додаткові послуги та розширення:</span>
							<p class="ios-card-sub">
								Додайте басейн, персональну шафку чи тренування до вашого абонемента
							</p>
						</div>
					</div>

					<div class="ios-addons-stack">
						{#each data.addons as addon (addon.id)}
							{@const isSelected = selectedAddonIds.includes(addon.id)}
							<button
								type="button"
								class="ios-addon-item"
								class:selected={isSelected}
								onclick={() => toggleAddon(addon.id)}
							>
								<div class="ios-addon-left">
									<span class="ios-addon-icon">{addon.icon || '🏷️'}</span>
									<div class="text-left">
										<div class="ios-addon-title-row">
											<strong class="ios-addon-name">{addon.name}</strong>
											{#if addon.category === 'resource' && addon.availableLockers !== undefined}
												<span class="ios-pill-status">
													{addon.availableLockers} вільно
												</span>
											{/if}
										</div>
										<p class="ios-addon-desc">{addon.description}</p>
									</div>
								</div>
								<div class="ios-addon-right">
									<strong class="ios-addon-price">+{addon.price} ₴</strong>
									<div class="ios-toggle-switch" class:active={isSelected}>
										<div class="ios-switch-knob"></div>
									</div>
								</div>
							</button>
						{/each}
					</div>
				</div>

				<div class="ios-info-note">
					<Info size={16} class="text-blue-600 flex-shrink-0" />
					<span>
						Персональна закріплена шафка резервується за вами на весь термін дії абонемента з персональним електронним ключем.
					</span>
				</div>

			<!-- WINDOW 3: CLIENT CONTACTS -->
			{:else if step === 3}
				<div class="ios-card">
					<span class="ios-card-title">Контактні дані власника абонемента:</span>
					<div class="ios-form-stack">
						<label>
							<span class="ios-input-lbl">Прізвище та ім'я:</span>
							<input
								type="text"
								class="ios-input"
								bind:value={clientName}
								placeholder="Олександр Коваленко"
							/>
						</label>

						<label>
							<span class="ios-input-lbl">Номер телефону (для входу та Telegram-сповіщень):</span>
							<input
								type="tel"
								class="ios-input"
								bind:value={clientPhone}
								placeholder="+380..."
							/>
						</label>

						<label>
							<span class="ios-input-lbl">Email для квитанції та електронної картки:</span>
							<input
								type="email"
								class="ios-input"
								bind:value={clientEmail}
								placeholder="client@example.com"
							/>
						</label>
					</div>
				</div>

				<div class="ios-card">
					<span class="ios-card-title">Правила клубу:</span>
					<div class="ios-rules-box">
						<div class="rule-bullet">
							<ShieldCheck size={16} class="text-emerald-600 flex-shrink-0" />
							<span>Безкоштовна заморозка абонемента до {data.rules.maxFreezeDays} днів у будь-який момент.</span>
						</div>
						<div class="rule-bullet">
							<QrCode size={16} class="text-indigo-600 flex-shrink-0" />
							<span>Вхід до клубу здійснюється за цифровим QR-кодом на рецепції або через оптичний турнікет.</span>
						</div>
					</div>
				</div>

			<!-- WINDOW 4: APPLE WALLET PASS TICKET & MEMBERSHIP ISSUANCE -->
			{:else if step === 4}
				<!-- APPLE WALLET PASS TICKET -->
				<div class="ios-pass-card">
					<div class="ios-pass-head">
						<div class="ios-pass-logo-wrap">
							<Dumbbell size={20} class="text-white" />
							<span class="ios-pass-brand">{data.clubBrand || 'Pulse Fitness Club'}</span>
						</div>
						<span class="ios-pass-type-badge">Офіційний рахунок</span>
					</div>

					<div class="ios-pass-body">
						<h4 class="ios-pass-tariff-name">{pricing.summaryLabel}</h4>
						<div class="ios-pass-dates">
							<span>Діє: <strong>{pricing.startDateFormatted} — {pricing.endDateFormatted}</strong></span>
						</div>

						<div class="ios-pass-breakdown">
							{#each pricing.breakdown as item}
								<div class="ios-pass-row">
									<span class="ios-pass-item-name">{item.label}</span>
									<strong class="ios-pass-item-val">{item.amount} ₴</strong>
								</div>
							{/each}
						</div>
					</div>

					<!-- Cutout line -->
					<div class="ios-pass-cut">
						<div class="ios-cut-left"></div>
						<div class="ios-cut-line"></div>
						<div class="ios-cut-right"></div>
					</div>

					<div class="ios-pass-footer">
						<div class="ios-total-row">
							<span>Разом до сплати:</span>
							<strong class="ios-total-amount">{pricing.totalAmount} ₴</strong>
						</div>
					</div>
				</div>

				<!-- ISSUED DIGITAL MEMBERSHIP PASS PREVIEW -->
				<div class="ios-digital-card">
					<div class="digital-card-head">
						<div class="flex items-center gap-2">
							<div class="pulse-chip"></div>
							<span class="digital-card-brand">{data.clubBrand || 'PULSE FITNESS'}</span>
						</div>
						<span class="digital-card-status">
							{pricing.issuedCard.status === 'active' ? '● АКТИВНА' : '● ГОТОВА'}
						</span>
					</div>

					<div class="digital-card-body">
						<div class="digital-member-info">
							<span class="digital-lbl">Власник картки</span>
							<strong class="digital-val">{pricing.issuedCard.memberName}</strong>
						</div>

						<div class="digital-grid-2">
							<div>
								<span class="digital-lbl">Номер картки</span>
								<strong class="digital-val-mono">{pricing.issuedCard.cardCode}</strong>
							</div>
							<div>
								<span class="digital-lbl">Персональна шафка</span>
								<strong class="digital-val text-amber-300">
									{pricing.issuedCard.assignedLocker || 'Загальна'}
								</strong>
							</div>
						</div>

						<div class="digital-zones-row">
							<span class="digital-lbl">Доступні зони:</span>
							<div class="digital-tags-wrap">
								{#each pricing.issuedCard.allowedZones as zone}
									<span class="digital-zone-tag">{zone}</span>
								{/each}
							</div>
						</div>

						{#if pricing.issuedCard.trainingCreditsTotal > 0}
							{@const remaining = Math.max(0, pricing.issuedCard.trainingCreditsTotal - simulatedCreditsUsed)}
							<div class="digital-credits-box">
								<div class="flex justify-between items-center">
									<span class="digital-lbl">Персональні тренування:</span>
									<strong class="text-emerald-300 font-bold">
										{remaining} з {pricing.issuedCard.trainingCreditsTotal} занять
									</strong>
								</div>
								<div class="reception-simulator-row">
									<button
										type="button"
										class="ios-sim-btn"
										disabled={remaining <= 0}
										onclick={useOneTrainingCredit}
									>
										Списати 1 заняття на рецепції
									</button>
									{#if simulatedCreditsUsed > 0}
										<button
											type="button"
											class="ios-sim-reset"
											onclick={resetSimulatedUsage}
										>
											Скинути
										</button>
									{/if}
								</div>
							</div>
						{/if}

						<div class="digital-qr-wrap">
							<div class="qr-mock">
								<QrCode size={56} class="text-zinc-900" />
							</div>
							<div class="qr-info">
								<span class="text-xs text-zinc-300 font-semibold">QR-код для турнікета</span>
								<span class="text-[10px] text-zinc-400">Покажіть на вході або скануйте оптичним зчитувачем</span>
							</div>
						</div>
					</div>
				</div>
			{/if}

		<!-- OTHER MODES -->
		{:else if currentMode === 'renewal'}
			<div class="ios-card">
				<span class="ios-card-title">Продовження чинного абонемента:</span>
				<div class="ios-form-stack">
					<label>
						<span class="ios-input-lbl">Номер діючої картки або телефон:</span>
						<input
							type="text"
							class="ios-input"
							bind:value={memberCardId}
							placeholder="PULSE-4700-142 або +380..."
						/>
					</label>

					<div class="ios-validity-banner">
						<Sparkles size={16} class="text-indigo-600" />
						<div>
							<strong>Знайдено абонемент:</strong>
							<span>Олександр Коваленко · Картка #{memberCardId}</span>
							<small class="block text-zinc-500">Продовжується на 30 днів від кінцевої дати</small>
						</div>
					</div>

					<div class="ios-pass-card mt-3">
						<div class="ios-pass-body">
							<div class="ios-pass-row">
								<span>Продовження: Місячний безліміт</span>
								<strong>1 800 ₴</strong>
							</div>
						</div>
						<div class="ios-pass-cut">
							<div class="ios-cut-left"></div>
							<div class="ios-cut-line"></div>
							<div class="ios-cut-right"></div>
						</div>
						<div class="ios-pass-footer">
							<div class="ios-total-row">
								<span>До сплати:</span>
								<strong class="ios-total-amount">1 800 ₴</strong>
							</div>
						</div>
					</div>
				</div>
			</div>

		{:else if currentMode === 'addon_only'}
			<div class="ios-card">
				<span class="ios-card-title">Докупівля послуг до існуючого абонемента:</span>
				<div class="ios-addons-stack mt-2">
					{#each data.addons as addon (addon.id)}
						{@const isSelected = selectedAddonIds.includes(addon.id)}
						<button
							type="button"
							class="ios-addon-item"
							class:selected={isSelected}
							onclick={() => toggleAddon(addon.id)}
						>
							<div class="ios-addon-left">
								<span class="ios-addon-icon">{addon.icon || '🏷️'}</span>
								<div class="text-left">
									<strong class="ios-addon-name">{addon.name}</strong>
									<p class="ios-addon-desc">{addon.description}</p>
								</div>
							</div>
							<div class="ios-addon-right">
								<strong class="ios-addon-price">+{addon.price} ₴</strong>
								<div class="ios-toggle-switch" class:active={isSelected}>
									<div class="ios-switch-knob"></div>
								</div>
							</div>
						</button>
					{/each}
				</div>

				<div class="ios-pass-card mt-3">
					<div class="ios-pass-body">
						<div class="ios-pass-row">
							<span>Вибрано додаткових послуг:</span>
							<strong>{pricing.totalAmount} ₴</strong>
						</div>
					</div>
				</div>
			</div>

		{:else if currentMode === 'reception_pay'}
			<div class="ios-card">
				<span class="ios-card-title">Швидка оплата на рецепції клубу:</span>
				<div class="ios-form-stack">
					<div class="ios-grid-2">
						<label>
							<span class="ios-input-lbl">Номер чека / замовлення:</span>
							<input
								type="text"
								class="ios-input"
								bind:value={receptionReceiptId}
							/>
						</label>
						<label>
							<span class="ios-input-lbl">Сума до сплати:</span>
							<input
								type="number"
								class="ios-input font-bold text-emerald-600"
								bind:value={receptionAmount}
							/>
						</label>
					</div>

					<div class="ios-reception-box">
						<QrCode size={36} class="text-indigo-600" />
						<div>
							<strong>Термінал або QR-стійка рецепції</strong>
							<span class="text-xs text-zinc-500 block">
								Клієнт сканує QR-код на стійці адміністратора та оплачує через Apple Pay або карткою
							</span>
						</div>
					</div>
				</div>
			</div>
		{/if}
	</main>

	<!-- BOTTOM HIG ACTION BAR -->
	<footer class="ios-bottom-bar">
		{#if currentMode === 'new_membership'}
			<div class="ios-bar-content">
				{#if step > 1}
					<button
						type="button"
						class="ios-back-btn"
						onclick={() => step--}
					>
						<ChevronLeft size={16} />
						<span>Назад</span>
					</button>
				{:else}
					<div></div>
				{/if}

				{#if step < 4}
					<button
						type="button"
						class="ios-next-btn"
						onclick={() => step++}
					>
						<span>
							{step === 1 ? 'Обрати послуги →' : step === 2 ? 'Контактні дані →' : 'До оплати →'}
						</span>
						<ChevronRight size={16} />
					</button>
				{:else}
					<button
						type="button"
						class="ios-pay-btn"
						onclick={() => onPay(pricing.totalAmount)}
					>
						<CreditCard size={17} />
						<span>Оплатити {pricing.totalAmount} ₴</span>
					</button>
				{/if}
			</div>
		{:else}
			<div class="ios-bar-content">
				<div></div>
				<button
					type="button"
					class="ios-pay-btn"
					onclick={() => onPay(pricing.totalAmount)}
				>
					<CreditCard size={17} />
					<span>Оплатити {pricing.totalAmount} ₴</span>
				</button>
			</div>
		{/if}
	</footer>
</div>

<style>
	/* APPLE HIG CONTAINER & TYPOGRAPHY */
	.ios-root {
		display: flex;
		flex-direction: column;
		background: #f2f2f7;
		font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Helvetica Neue", Arial, sans-serif;
		color: #1c1c1e;
		border-radius: 18px;
		overflow: hidden;
		border: 1px solid #e5e5ea;
		box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
	}

	.ios-header {
		background: #ffffff;
		padding: 1rem 1.15rem 0.75rem;
		border-bottom: 1px solid #e5e5ea;
	}

	.ios-nav-top {
		margin-bottom: 0.75rem;
	}

	.ios-nav-sub {
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: #007aff;
	}

	.ios-nav-title {
		font-size: 1.15rem;
		font-weight: 700;
		color: #000000;
		margin: 0.15rem 0 0;
	}

	/* Segmented Control (HIG Style) */
	.ios-segmented {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		background: #efeff4;
		padding: 3px;
		border-radius: 9px;
		gap: 2px;
	}

	.ios-segment-btn {
		background: transparent;
		border: none;
		padding: 0.4rem 0.2rem;
		font-size: 0.74rem;
		font-weight: 500;
		color: #636366;
		border-radius: 7px;
		cursor: pointer;
		transition: all 0.15s ease;
		text-align: center;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.ios-segment-btn.active {
		background: #ffffff;
		color: #000000;
		font-weight: 600;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
	}

	/* Step Capsules (HIG Style) */
	.ios-stepper-capsules {
		display: flex;
		gap: 0.4rem;
		margin-top: 0.75rem;
	}

	.ios-capsule-item {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.35rem;
		padding: 0.35rem 0.5rem;
		border-radius: 9999px;
		background: #f2f2f7;
		font-size: 0.72rem;
		color: #8e8e93;
		font-weight: 500;
	}

	.ios-capsule-item.active {
		background: #007aff;
		color: #ffffff;
		font-weight: 600;
	}

	.ios-capsule-item.done {
		background: #e1f0ff;
		color: #007aff;
	}

	.capsule-num {
		font-weight: 700;
	}

	/* BODY & CARDS */
	.ios-body {
		padding: 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
	}

	.ios-card {
		background: #ffffff;
		border-radius: 13px;
		padding: 0.85rem 1rem;
		border: 1px solid rgba(0, 0, 0, 0.04);
		box-shadow: 0 1px 4px rgba(0, 0, 0, 0.03);
	}

	.ios-card-title {
		display: block;
		font-size: 0.82rem;
		font-weight: 600;
		color: #1c1c1e;
		margin-bottom: 0.6rem;
	}

	.ios-card-sub {
		font-size: 0.74rem;
		color: #8e8e93;
		margin: 0 0 0.5rem;
	}

	/* Clubs List */
	.ios-club-list {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.ios-club-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.65rem 0.8rem;
		border-radius: 10px;
		border: 1px solid #f2f2f7;
		background: #fbfbfd;
		cursor: pointer;
		text-align: left;
		transition: all 0.15s ease;
	}

	.ios-club-row.selected {
		border-color: #007aff;
		background: #f0f7ff;
	}

	.ios-club-name {
		font-size: 0.85rem;
		font-weight: 600;
		color: #000;
		display: block;
	}

	.ios-club-addr,
	.ios-club-hours {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		font-size: 0.73rem;
		color: #636366;
		margin-top: 0.15rem;
	}

	.ios-check-circle {
		width: 22px;
		height: 22px;
		border-radius: 50%;
		background: #007aff;
		color: #fff;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.ios-check-circle.corner {
		position: absolute;
		top: 0.6rem;
		right: 0.6rem;
	}

	/* Tariff Grid */
	.ios-tariff-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 0.6rem;
	}

	.ios-tariff-card {
		position: relative;
		border-radius: 11px;
		border: 1.5px solid #e5e5ea;
		background: #ffffff;
		padding: 0.75rem 0.65rem;
		cursor: pointer;
		text-align: left;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		transition: all 0.15s ease;
	}

	.ios-tariff-card.selected {
		border-color: #007aff;
		background: #f7fbff;
		box-shadow: 0 2px 8px rgba(0, 122, 255, 0.15);
	}

	.ios-badge-pill {
		position: absolute;
		top: -8px;
		left: 50%;
		transform: translateX(-50%);
		background: #ff9500;
		color: #fff;
		font-size: 0.65rem;
		font-weight: 700;
		padding: 0.15rem 0.45rem;
		border-radius: 9999px;
		white-space: nowrap;
	}

	.ios-tariff-title {
		font-size: 0.82rem;
		color: #1c1c1e;
		display: block;
	}

	.ios-tariff-price {
		font-size: 1.05rem;
		font-weight: 800;
		color: #007aff;
		margin: 0.2rem 0;
		display: block;
	}

	.ios-tariff-desc {
		font-size: 0.7rem;
		color: #8e8e93;
		margin: 0.2rem 0;
		line-height: 1.3;
	}

	.ios-tariff-hours {
		display: flex;
		align-items: center;
		gap: 0.2rem;
		font-size: 0.68rem;
		color: #3c3c43;
		margin-top: 0.4rem;
	}

	/* Date Selector */
	.ios-segmented-sm {
		display: grid;
		grid-template-columns: 1fr 1fr;
		background: #efeff4;
		padding: 2px;
		border-radius: 8px;
		gap: 2px;
	}

	.ios-seg-sm-btn {
		background: transparent;
		border: none;
		padding: 0.35rem;
		font-size: 0.75rem;
		font-weight: 500;
		color: #636366;
		border-radius: 6px;
		cursor: pointer;
	}

	.ios-seg-sm-btn.active {
		background: #ffffff;
		color: #000;
		font-weight: 600;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
	}

	.ios-validity-banner {
		display: flex;
		align-items: center;
		gap: 0.65rem;
		background: #f2f5fc;
		border-radius: 9px;
		padding: 0.6rem 0.8rem;
		margin-top: 0.6rem;
		font-size: 0.78rem;
		color: #1e1b4b;
	}

	/* Addons Stack */
	.ios-addons-stack {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.ios-addon-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.65rem 0.8rem;
		border-radius: 10px;
		border: 1px solid #e5e5ea;
		background: #ffffff;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.ios-addon-item.selected {
		border-color: #007aff;
		background: #f0f7ff;
	}

	.ios-addon-left {
		display: flex;
		align-items: center;
		gap: 0.6rem;
	}

	.ios-addon-icon {
		font-size: 1.3rem;
	}

	.ios-addon-title-row {
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}

	.ios-addon-name {
		font-size: 0.82rem;
		font-weight: 600;
		color: #000000;
	}

	.ios-pill-status {
		font-size: 0.68rem;
		font-weight: 600;
		padding: 0.1rem 0.35rem;
		border-radius: 4px;
		background: #dcfce7;
		color: #166534;
	}

	.ios-addon-desc {
		font-size: 0.7rem;
		color: #8e8e93;
		margin: 0.15rem 0 0;
	}

	.ios-addon-right {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.ios-addon-price {
		font-size: 0.85rem;
		font-weight: 700;
		color: #34c759;
	}

	/* iOS Toggle Switch */
	.ios-toggle-switch {
		width: 40px;
		height: 24px;
		border-radius: 9999px;
		background: #e5e5ea;
		padding: 2px;
		transition: background-color 0.2s ease;
		display: flex;
		align-items: center;
	}

	.ios-toggle-switch.active {
		background: #34c759;
	}

	.ios-switch-knob {
		width: 20px;
		height: 20px;
		border-radius: 50%;
		background: #ffffff;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
		transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
	}

	.ios-toggle-switch.active .ios-switch-knob {
		transform: translateX(16px);
	}

	.ios-info-note {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		background: #eef2ff;
		padding: 0.6rem 0.8rem;
		border-radius: 10px;
		font-size: 0.74rem;
		color: #3730a3;
	}

	/* Form Stack */
	.ios-form-stack {
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
	}

	.ios-input-lbl {
		display: block;
		font-size: 0.75rem;
		font-weight: 600;
		color: #636366;
		margin-bottom: 0.25rem;
	}

	.ios-input {
		width: 100%;
		padding: 0.55rem 0.75rem;
		border-radius: 8px;
		border: 1px solid #d1d1d6;
		font-size: 0.85rem;
		background: #ffffff;
		color: #000000;
		box-sizing: border-box;
	}

	.ios-rules-box {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.rule-bullet {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.76rem;
		color: #3c3c43;
	}

	/* APPLE WALLET PASS TICKET */
	.ios-pass-card {
		background: #ffffff;
		border-radius: 14px;
		overflow: hidden;
		box-shadow: 0 2px 10px rgba(0, 0, 0, 0.06);
		border: 1px solid rgba(0, 0, 0, 0.06);
	}

	.ios-pass-head {
		background: linear-gradient(135deg, #1e293b, #0f172a);
		padding: 0.8rem 1rem;
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.ios-pass-logo-wrap {
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}

	.ios-pass-brand {
		font-size: 0.85rem;
		font-weight: 700;
		color: #ffffff;
		letter-spacing: 0.02em;
	}

	.ios-pass-type-badge {
		font-size: 0.65rem;
		font-weight: 600;
		color: #94a3b8;
		background: rgba(255, 255, 255, 0.1);
		padding: 0.15rem 0.45rem;
		border-radius: 4px;
	}

	.ios-pass-body {
		padding: 0.85rem 1rem;
	}

	.ios-pass-tariff-name {
		font-size: 0.95rem;
		font-weight: 700;
		color: #000;
		margin: 0 0 0.2rem;
	}

	.ios-pass-dates {
		font-size: 0.74rem;
		color: #636366;
		margin-bottom: 0.65rem;
	}

	.ios-pass-breakdown {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		border-top: 1px dashed #e5e5ea;
		padding-top: 0.6rem;
	}

	.ios-pass-row {
		display: flex;
		justify-content: space-between;
		font-size: 0.78rem;
		color: #3c3c43;
	}

	.ios-pass-item-val {
		font-weight: 600;
		color: #000;
	}

	/* Pass Cutout */
	.ios-pass-cut {
		position: relative;
		height: 18px;
		display: flex;
		align-items: center;
		overflow: hidden;
	}

	.ios-cut-left,
	.ios-cut-right {
		position: absolute;
		width: 18px;
		height: 18px;
		background: #f2f2f7;
		border-radius: 50%;
	}

	.ios-cut-left {
		left: -9px;
	}

	.ios-cut-right {
		right: -9px;
	}

	.ios-cut-line {
		flex: 1;
		height: 1px;
		border-bottom: 1.5px dashed #d1d1d6;
		margin: 0 14px;
	}

	.ios-pass-footer {
		padding: 0.75rem 1rem;
		background: #fafafa;
	}

	.ios-total-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.ios-total-row span {
		font-size: 0.85rem;
		font-weight: 600;
		color: #1c1c1e;
	}

	.ios-total-amount {
		font-size: 1.35rem;
		font-weight: 800;
		color: #34c759;
	}

	/* DIGITAL MEMBERSHIP CARD (APPLE WALLET STYLE) */
	.ios-digital-card {
		background: linear-gradient(135deg, #18181b 0%, #27272a 100%);
		border-radius: 16px;
		color: #ffffff;
		padding: 1.1rem;
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
		border: 1px solid rgba(255, 255, 255, 0.1);
	}

	.digital-card-head {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding-bottom: 0.75rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.1);
	}

	.pulse-chip {
		width: 12px;
		height: 12px;
		border-radius: 50%;
		background: #10b981;
		box-shadow: 0 0 8px #10b981;
	}

	.digital-card-brand {
		font-size: 0.8rem;
		font-weight: 800;
		letter-spacing: 0.08em;
	}

	.digital-card-status {
		font-size: 0.68rem;
		font-weight: 700;
		color: #34d399;
	}

	.digital-card-body {
		padding-top: 0.75rem;
		display: flex;
		flex-direction: column;
		gap: 0.7rem;
	}

	.digital-lbl {
		font-size: 0.65rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: #a1a1aa;
		display: block;
	}

	.digital-val {
		font-size: 0.95rem;
		font-weight: 700;
		color: #ffffff;
	}

	.digital-val-mono {
		font-family: monospace;
		font-size: 0.88rem;
		color: #38bdf8;
	}

	.digital-grid-2 {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.5rem;
	}

	.digital-zones-row {
		border-top: 1px solid rgba(255, 255, 255, 0.08);
		padding-top: 0.5rem;
	}

	.digital-tags-wrap {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
		margin-top: 0.25rem;
	}

	.digital-zone-tag {
		background: rgba(255, 255, 255, 0.12);
		padding: 0.15rem 0.45rem;
		border-radius: 4px;
		font-size: 0.68rem;
		font-weight: 500;
	}

	.digital-credits-box {
		background: rgba(255, 255, 255, 0.06);
		border-radius: 8px;
		padding: 0.55rem 0.65rem;
		border: 1px solid rgba(255, 255, 255, 0.08);
	}

	.reception-simulator-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-top: 0.4rem;
	}

	.ios-sim-btn {
		background: #0284c7;
		color: #fff;
		border: none;
		border-radius: 5px;
		padding: 0.3rem 0.6rem;
		font-size: 0.72rem;
		font-weight: 600;
		cursor: pointer;
	}

	.ios-sim-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.ios-sim-reset {
		background: transparent;
		color: #94a3b8;
		border: 1px solid rgba(255, 255, 255, 0.2);
		border-radius: 5px;
		padding: 0.3rem 0.5rem;
		font-size: 0.7rem;
		cursor: pointer;
	}

	.digital-qr-wrap {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		background: rgba(255, 255, 255, 0.05);
		padding: 0.55rem 0.75rem;
		border-radius: 10px;
		margin-top: 0.25rem;
	}

	.qr-mock {
		background: #ffffff;
		padding: 4px;
		border-radius: 6px;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	/* BOTTOM ACTION BAR */
	.ios-bottom-bar {
		background: #ffffff;
		border-top: 1px solid #e5e5ea;
		padding: 0.75rem 1rem;
	}

	.ios-bar-content {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.ios-back-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		background: transparent;
		border: none;
		color: #007aff;
		font-size: 0.85rem;
		font-weight: 600;
		cursor: pointer;
	}

	.ios-next-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		background: #007aff;
		color: #ffffff;
		border: none;
		border-radius: 9999px;
		padding: 0.55rem 1.1rem;
		font-size: 0.85rem;
		font-weight: 600;
		cursor: pointer;
		box-shadow: 0 2px 6px rgba(0, 122, 255, 0.25);
	}

	.ios-pay-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		background: #34c759;
		color: #ffffff;
		border: none;
		border-radius: 9999px;
		padding: 0.65rem 1.35rem;
		font-size: 0.9rem;
		font-weight: 700;
		cursor: pointer;
		box-shadow: 0 3px 10px rgba(52, 199, 89, 0.3);
	}

	.ios-reception-box {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		background: #f8fafc;
		border: 1px solid #e2e8f0;
		border-radius: 10px;
		padding: 0.75rem;
		margin-top: 0.5rem;
	}
</style>
