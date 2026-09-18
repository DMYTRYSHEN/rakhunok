<script lang="ts">
	import {
		Dog,
		Cat,
		Scissors,
		Clock,
		Check,
		ChevronRight,
		ArrowLeft,
		Calendar,
		Sparkles,
		ShieldCheck,
		Send,
		AlertTriangle,
		Search,
		Receipt
	} from '@lucide/svelte';
	import type {
		GroomingStudioFlowData,
		GroomingPetType,
		GroomingCoatLength,
		GroomingCoatCondition
	} from '$lib/features/shared/checkout-scenario-config';
	import { calculateGroomingPrice, pruneGroomingSelections } from '$lib/features/shared/grooming-pricing';

	let {
		flowData = {},
		onPay
	}: {
		flowData?: Partial<GroomingStudioFlowData>;
		onPay: (amount: number) => void;
	} = $props();

	const defaultData: GroomingStudioFlowData = {
		studioName: 'Happy Paws Грумінг',
		title: 'Салон краси та догляду для тварин',
		description: 'Комплексний грумінг, купання, експрес-линька та СПА-догляд',
		contacts: {
			phone: '+380 67 111 22 33',
			instagram: '@happypaws.groom',
			address: 'вул. Саксаганського, 42'
		},
		modes: {
			bookingEnabled: true,
			inSalonPayEnabled: true,
			bookingButtonText: 'Записати улюбленця',
			inSalonButtonText: 'Оплатити в салоні'
		},
		supportedPets: ['dog', 'cat'],
		weightTiers: [
			{ id: 'under_5', label: 'до 5 кг включно', maxWeightKg: 5, basePrice: 700 },
			{ id: '5_to_10', label: 'понад 5 до 10 кг включно', maxWeightKg: 10, basePrice: 900 },
			{ id: '10_to_20', label: 'понад 10 до 20 кг включно', maxWeightKg: 20, basePrice: 1200 }
		],
		services: [
			{
				id: 'srv_complex',
				name: 'Комплексний грумінг (купання + стрижка)',
				petTypes: ['dog', 'cat'],
				requiresCoatDetails: true,
				weightTierPrices: { under_5: 700, '5_to_10': 900, '10_to_20': 1200 },
				durationMinutes: 90
			},
			{
				id: 'srv_bath',
				name: 'Купання та сушка',
				petTypes: ['dog', 'cat'],
				requiresCoatDetails: true,
				weightTierPrices: { under_5: 450, '5_to_10': 600, '10_to_20': 800 },
				durationMinutes: 60
			},
			{
				id: 'srv_nails',
				name: 'Стрижка кігтів та догляд лапок',
				petTypes: ['dog', 'cat'],
				requiresCoatDetails: false,
				weightTierPrices: {},
				fixedPrice: 150,
				durationMinutes: 15
			}
		],
		coatOptions: [
			{ id: 'short', label: 'Коротка шерсть', extraPrice: 0 },
			{ id: 'medium', label: 'Середня шерсть', extraPrice: 100 },
			{ id: 'long', label: 'Довга шерсть', extraPrice: 200 }
		],
		addons: [
			{
				id: 'add_spa',
				name: 'Додаткова доглядова процедура (СПА)',
				description: 'Гідромасажна ванна та шовкова маска',
				price: 150
			}
		],
		masters: [
			{
				id: 'm_natali',
				name: 'Топ-грумер Наталія',
				role: 'Стиліст котів та собак',
				extraPrice: 0,
				allowedPetTypes: ['dog', 'cat']
			}
		],
		autoApproval: {
			enabled: true,
			noticeText: 'Автопогодження діє для стандартних заявок без ковтунів'
		},
		paymentModel: {
			type: 'percent',
			percentValue: 30,
			fixedAmount: 200
		},
		approval: {
			channel: 'telegram',
			responseTimeNotice: 'до 15 хвилин'
		}
	};

	const effectiveData = $derived<Partial<GroomingStudioFlowData>>({
		studioName: flowData.studioName || defaultData.studioName,
		title: flowData.title || defaultData.title,
		description: flowData.description || defaultData.description,
		contacts: flowData.contacts || defaultData.contacts,
		modes: flowData.modes || defaultData.modes,
		supportedPets: flowData.supportedPets || defaultData.supportedPets,
		weightTiers: flowData.weightTiers || defaultData.weightTiers,
		services: flowData.services || defaultData.services,
		coatOptions: flowData.coatOptions || defaultData.coatOptions,
		addons: flowData.addons || defaultData.addons,
		masters: flowData.masters || defaultData.masters,
		autoApproval: flowData.autoApproval || defaultData.autoApproval,
		paymentModel: flowData.paymentModel || defaultData.paymentModel,
		approval: flowData.approval || defaultData.approval
	});

	// Поточний екран: 'welcome' | 'booking' | 'in_salon' | 'booking_submitted'
	let activePath = $state<'welcome' | 'booking' | 'in_salon' | 'booking_submitted'>('welcome');

	// Вибрані клієнтом опції
	let petType = $state<GroomingPetType>('dog');
	let weightKg = $state<number>(8);
	let selectedServiceId = $state<string>('srv_complex');
	let coatLength = $state<GroomingCoatLength>('long');
	let coatCondition = $state<GroomingCoatCondition>('clean');
	let selectedAddonIds = $state<string[]>(['add_spa']);

	// Дані для запису
	let selectedDate = $state('Завтра');
	let selectedTime = $state('11:00');
	let petName = $state('Чак');
	let petBreed = $state('Коргі');
	let clientPhone = $state('+380 67 111 22 33');

	// Для розрахунку в салоні (пошук рахунку)
	let invoiceSearchQuery = $state('');

	// Автоматичне очищення несумісних відповідей
	$effect(() => {
		const cleaned = pruneGroomingSelections(effectiveData, {
			petType,
			weightKg,
			serviceId: selectedServiceId,
			coatLength,
			coatCondition,
			addonIds: selectedAddonIds
		});
		if (cleaned.serviceId !== selectedServiceId) selectedServiceId = cleaned.serviceId;
		if (cleaned.coatLength !== coatLength) coatLength = cleaned.coatLength ?? 'short';
		if (cleaned.coatCondition !== coatCondition) coatCondition = cleaned.coatCondition ?? 'clean';
	});

	// Динамічний розрахунок ціни
	const pricing = $derived(
		calculateGroomingPrice(effectiveData, {
			petType,
			weightKg,
			serviceId: selectedServiceId,
			coatLength,
			coatCondition,
			addonIds: selectedAddonIds
		})
	);

	const activeService = $derived(
		(effectiveData.services ?? []).find((s) => s.id === selectedServiceId)
	);

	function toggleAddon(id: string) {
		if (selectedAddonIds.includes(id)) {
			selectedAddonIds = selectedAddonIds.filter((item) => item !== id);
		} else {
			selectedAddonIds = [...selectedAddonIds, id];
		}
	}
</script>

<div class="grooming-preview-shell">
	<!-- Шапка салону -->
	<header class="studio-header">
		<div class="studio-brand">
			<div class="studio-avatar">
				<Dog size={20} class="text-amber-500" />
			</div>
			<div class="studio-meta">
				<h3 class="studio-name">{effectiveData.studioName}</h3>
				<span class="studio-tagline">{effectiveData.title}</span>
			</div>
		</div>

		{#if activePath !== 'welcome'}
			<button
				type="button"
				class="btn-switch-mode"
				onclick={() => (activePath = 'welcome')}
			>
				<ArrowLeft size={14} /> Назад
			</button>
		{/if}
	</header>

	<!-- ═════════════════════════════════════════════════════════════ -->
	<!-- ЕКРАН 1: Вітальний екран вибору шляху                        -->
	<!-- ═════════════════════════════════════════════════════════════ -->
	{#if activePath === 'welcome'}
		<div class="welcome-screen space-y-4">
			<div class="hero-card">
				<span class="badge-groom">Grooming & Care</span>
				<h2>{effectiveData.description}</h2>
				<div class="contacts-strip">
					{#if effectiveData.contacts?.instagram}
						<span>📸 {effectiveData.contacts.instagram}</span>
					{/if}
					{#if effectiveData.contacts?.address}
						<span>📍 {effectiveData.contacts.address}</span>
					{/if}
				</div>
			</div>

			<div class="action-buttons space-y-3 pt-2">
				{#if effectiveData.modes?.bookingEnabled}
					<button
						type="button"
						class="btn-mode-card booking"
						onclick={() => (activePath = 'booking')}
					>
						<div class="mode-icon"><Calendar size={22} /></div>
						<div class="mode-text">
							<strong>{effectiveData.modes?.bookingButtonText || 'Записати улюбленця'}</strong>
							<small>Тариф за вагою, довжина шерсті та бажаний час</small>
						</div>
						<ChevronRight size={18} class="arrow" />
					</button>
				{/if}

				{#if effectiveData.modes?.inSalonPayEnabled}
					<button
						type="button"
						class="btn-mode-card in-salon"
						onclick={() => (activePath = 'in_salon')}
					>
						<div class="mode-icon"><Receipt size={22} /></div>
						<div class="mode-text">
							<strong>{effectiveData.modes?.inSalonButtonText || 'Оплатити в салоні'}</strong>
							<small>Оплата готового рахунку або послуги без квізу</small>
						</div>
						<ChevronRight size={18} class="arrow" />
					</button>
				{/if}
			</div>

			<div class="preview-helper">
				<span>💡 Натисніть одну з кнопок вище для тестування шляху клієнта</span>
			</div>
		</div>

	<!-- ═════════════════════════════════════════════════════════════ -->
	<!-- ЕКРАН 2: Шлях 1 — «Записати улюбленця»                       -->
	<!-- ═════════════════════════════════════════════════════════════ -->
	{:else if activePath === 'booking'}
		<div class="flow-content space-y-4">
			<div class="step-title-bar">
				<span class="step-pill">Онлайн-запис</span>
				<span class="step-desc">Параметри тварини та розрахунок вартості</span>
			</div>

			<!-- Крок 1: Тварина -->
			<div class="section-box">
				<span class="section-label">1. Оберіть улюбленця:</span>
				<div class="grid grid-cols-2 gap-2">
					<button
						type="button"
						class="pet-type-btn"
						class:active={petType === 'dog'}
						onclick={() => (petType = 'dog')}
					>
						<span>🐶 Собака</span>
					</button>
					<button
						type="button"
						class="pet-type-btn"
						class:active={petType === 'cat'}
						onclick={() => (petType = 'cat')}
					>
						<span>🐱 Кіт</span>
					</button>
				</div>
			</div>

			<!-- Крок 2: Вага тварини (тарифна сітка) -->
			<div class="section-box">
				<div class="flex items-center justify-between mb-1.5">
					<span class="section-label mb-0">2. Вага тварини:</span>
					<strong class="text-amber-400 text-xs font-bold">{weightKg} кг</strong>
				</div>
				<input
					type="range"
					min="1"
					max="25"
					step="0.5"
					bind:value={weightKg}
					class="w-full accent-amber-500 cursor-pointer"
				/>
				<div class="flex items-center justify-between text-[10px] text-zinc-400 mt-1">
					<span>до 5 кг (700 ₴)</span>
					<span>5.1–10 кг (900 ₴)</span>
					<span>10.1–20 кг (1 200 ₴)</span>
				</div>
				{#if pricing.matchedTier}
					<div class="tier-pill mt-2">
						<span>Категорія тарифу:</span>
						<strong>{pricing.matchedTier.label}</strong>
					</div>
				{/if}
			</div>

			<!-- Крок 3: Послуга -->
			<div class="section-box">
				<span class="section-label">3. Послуга:</span>
				<div class="space-y-1.5">
					{#each (effectiveData.services ?? []).filter((s) => s.petTypes.includes(petType)) as s (s.id)}
						<button
							type="button"
							class="service-chip"
							class:active={s.id === selectedServiceId}
							onclick={() => (selectedServiceId = s.id)}
						>
							<div class="s-info">
								<strong>{s.name}</strong>
								<span class="s-time"><Clock size={11} /> {s.durationMinutes} хв</span>
							</div>
							<div class="s-price">
								{#if s.requiresCoatDetails && pricing.matchedTier}
									<strong>{s.weightTierPrices[pricing.matchedTier.id] ?? pricing.matchedTier.basePrice} ₴</strong>
								{:else}
									<strong>{s.fixedPrice ?? 150} ₴</strong>
								{/if}
								{#if s.id === selectedServiceId}
									<span class="check-dot"><Check size={12} /></span>
								{/if}
							</div>
						</button>
					{/each}
				</div>
			</div>

			<!-- Крок 4: Шерсть та Стан ковтунів (лише якщо послуга вимагає) -->
			{#if activeService?.requiresCoatDetails}
				<div class="section-box">
					<span class="section-label">4. Довжина шерсті:</span>
					<div class="grid grid-cols-3 gap-1.5">
						{#each effectiveData.coatOptions ?? [] as c (c.id)}
							<button
								type="button"
								class="opt-chip"
								class:active={coatLength === c.id}
								onclick={() => (coatLength = c.id)}
							>
								<span>{c.label}</span>
								<strong>{c.extraPrice > 0 ? `+${c.extraPrice} ₴` : '+0 ₴'}</strong>
							</button>
						{/each}
					</div>
				</div>

				<!-- Стан шерсті: перемикач ковтунів -->
				<div class="section-box highlight-matting" class:matted-active={coatCondition === 'matted'}>
					<div class="flex items-center justify-between mb-1.5">
						<span class="section-label text-amber-300 mb-0">5. Стан шерсті (ковтуни):</span>
						{#if coatCondition === 'matted'}
							<span class="badge-eval">Ручна оцінка</span>
						{/if}
					</div>
					<div class="grid grid-cols-2 gap-2">
						<button
							type="button"
							class="cond-btn"
							class:active={coatCondition === 'clean'}
							onclick={() => (coatCondition = 'clean')}
						>
							<span>✨ Без ковтунів</span>
							<small>Точна ціна</small>
						</button>
						<button
							type="button"
							class="cond-btn warning"
							class:active={coatCondition === 'matted'}
							onclick={() => (coatCondition = 'matted')}
						>
							<span>⚠️ Є ковтуни / Не впевнений</span>
							<small>Попередня оцінка</small>
						</button>
					</div>

					{#if pricing.isEstimate}
						<div class="estimate-banner mt-2.5">
							<AlertTriangle size={15} class="shrink-0 text-amber-400" />
							<span class="text-[11px] text-amber-200 leading-4">
								{pricing.estimateNotice}
							</span>
						</div>
					{/if}
				</div>
			{/if}

			<!-- Крок 5: Додаткові процедури (СПА) -->
			{#if (effectiveData.addons ?? []).length > 0}
				<div class="section-box">
					<span class="section-label">Додаткові процедури:</span>
					<div class="space-y-1.5">
						{#each effectiveData.addons ?? [] as addon (addon.id)}
							{@const checked = selectedAddonIds.includes(addon.id)}
							<button
								type="button"
								class="addon-row"
								class:active={checked}
								onclick={() => toggleAddon(addon.id)}
							>
								<div class="addon-text">
									<strong>{addon.name}</strong>
									{#if addon.description}<small>{addon.description}</small>{/if}
								</div>
								<div class="addon-price">
									<strong>+{addon.price} ₴</strong>
									<span class="box-check" class:checked>{checked ? '✓' : ''}</span>
								</div>
							</button>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Крок 6: Бажаний час -->
			<div class="section-box">
				<span class="section-label">Бажаний час візиту:</span>
				<div class="flex gap-2 mb-2 overflow-x-auto pb-1">
					{#each ['Сьогодні', 'Завтра', 'Четвер', 'П’ятниця'] as day}
						<button
							type="button"
							class="day-btn"
							class:active={selectedDate === day}
							onclick={() => (selectedDate = day)}
						>
							{day}
						</button>
					{/each}
				</div>
				<div class="grid grid-cols-4 gap-1.5">
					{#each ['10:00', '11:00', '13:30', '15:00', '17:00', '18:30'] as t}
						<button
							type="button"
							class="time-btn"
							class:active={selectedTime === t}
							onclick={() => (selectedTime = t)}
						>
							{t}
						</button>
					{/each}
				</div>
				<span class="text-[10px] text-zinc-400 block mt-1.5">
					ℹ️ Бажаний час узгоджується із розкладом майстра
				</span>
			</div>

			<!-- Крок 7: Контакти та Кличка -->
			<div class="section-box">
				<span class="section-label">Дані улюбленця та контакти:</span>
				<div class="grid grid-cols-2 gap-2 mb-2">
					<input
						type="text"
						bind:value={petName}
						placeholder="Кличка (Чак)"
						class="groom-input"
					/>
					<input
						type="text"
						bind:value={petBreed}
						placeholder="Порода (Коргі)"
						class="groom-input"
					/>
				</div>
				<input
					type="tel"
					bind:value={clientPhone}
					placeholder="Номер телефону (+380)"
					class="groom-input"
				/>
			</div>

			<!-- Підсумок вартості -->
			<div class="summary-card">
				<div class="sum-line">
					<span>{pricing.serviceName} ({pricing.matchedTier?.label ?? `${weightKg} кг`}):</span>
					<strong>{pricing.basePrice} ₴</strong>
				</div>

				{#if pricing.coatExtra > 0}
					<div class="sum-line sub">
						<span>└ Довга шерсть:</span>
						<strong>+{pricing.coatExtra} ₴</strong>
					</div>
				{/if}

				{#each pricing.activeAddons as add}
					<div class="sum-line sub">
						<span>└ {add.name}:</span>
						<strong>+{add.price} ₴</strong>
					</div>
				{/each}

				<div class="sum-line total">
					<span>{pricing.isEstimate ? 'Попередня оцінка:' : 'Загальна вартість:'}</span>
					<strong class="text-amber-400 text-base">{pricing.totalPrice} ₴</strong>
				</div>

				{#if pricing.isEstimate}
					<span class="text-[10px] text-amber-300 block">
						Остаточна сума визначається після огляду ковтунів
					</span>
				{/if}

				<div class="sum-line deposit">
					<span>Аванс для запису (30%):</span>
					<strong class="text-emerald-400 font-bold">{pricing.depositAmount} ₴</strong>
				</div>
			</div>

			<button
				type="button"
				class="btn-submit-booking"
				onclick={() => (activePath = 'booking_submitted')}
			>
				<Send size={16} />
				<span>{pricing.isEstimate ? 'Надіслати заявку на оцінку майстру' : 'Записати улюбленця на візит'}</span>
			</button>
		</div>

	<!-- ═════════════════════════════════════════════════════════════ -->
	<!-- ЕКРАН 3: Шлях 2 — «Оплатити в салоні»                          -->
	<!-- ═════════════════════════════════════════════════════════════ -->
	{:else if activePath === 'in_salon'}
		<div class="flow-content space-y-4">
			<div class="step-title-bar in-salon-header">
				<span class="step-pill in-salon">Оплата на місці</span>
				<span class="step-desc">Розрахунок після процедури без повторного квізу</span>
			</div>

			<!-- Пошук підготовленого рахунку -->
			<div class="section-box">
				<span class="section-label">Пошук рахунку за кличкою або номером:</span>
				<div class="relative mb-2">
					<Search size={14} class="absolute left-2.5 top-2.5 text-zinc-400" />
					<input
						type="text"
						bind:value={invoiceSearchQuery}
						placeholder="Введіть кличку тварини (напр. Чак)..."
						class="groom-input pl-8"
					/>
				</div>

				<div class="found-invoice-card">
					<div class="flex items-center justify-between">
						<div>
							<strong class="text-xs text-white block">Рахунок #GP-4421 · Коргі Чак</strong>
							<span class="text-[10px] text-zinc-400">Комплекс + СПА догляд · Майстер Наталія</span>
						</div>
						<strong class="text-amber-400 text-sm">{pricing.totalPrice} ₴</strong>
					</div>
				</div>
			</div>

			<!-- Або вибір послуги з фіксованим прайсом -->
			<div class="section-box">
				<span class="section-label">Або швидка оплата фіксованої послуги:</span>
				<div class="space-y-1.5">
					<button
						type="button"
						class="service-chip active"
						onclick={() => (selectedServiceId = 'srv_nails')}
					>
						<div class="s-info">
							<strong>Стрижка кігтів та догляд лапок</strong>
							<span class="s-time">Фіксована ціна</span>
						</div>
						<div class="s-price">
							<strong>150 ₴</strong>
							<span class="check-dot"><Check size={12} /></span>
						</div>
					</button>
				</div>
			</div>

			<!-- Підсумок -->
			<div class="summary-card">
				<div class="sum-line total">
					<span>Сума до сплати:</span>
					<strong class="text-amber-400 text-lg font-black">{pricing.totalPrice} ₴</strong>
				</div>
				<span class="text-[11px] text-zinc-400 block mt-1">
					Картка, Apple Pay, Google Pay або розрахунок через QR
				</span>
			</div>

			<button
				type="button"
				class="btn-pay-now"
				onclick={() => onPay(pricing.totalPrice)}
			>
				<ShieldCheck size={18} />
				<span>Сплатити {pricing.totalPrice} ₴</span>
			</button>
		</div>

	<!-- ═════════════════════════════════════════════════════════════ -->
	<!-- ЕКРАН 4: Заявку надіслано (погодження в Telegram)              -->
	<!-- ═════════════════════════════════════════════════════════════ -->
	{:else if activePath === 'booking_submitted'}
		<div class="submitted-screen text-center space-y-4 py-4">
			<div class="sent-badge">
				<Send size={28} class="text-amber-400" />
			</div>

			<div class="space-y-1">
				<h3 class="text-base font-bold text-white">
					{pricing.isEstimate ? 'Заявку на оцінку надіслано' : 'Заявку на запис надіслано'}
				</h3>
				<p class="text-xs text-zinc-400">
					{pricing.isEstimate
						? 'Грумер перевірить деталі стану шерсті та запропонує остаточну вартість.'
						: 'Адміністратор узгоджує бажаний час візиту в Telegram.'}
				</p>
			</div>

			<div class="ticket-box text-left">
				<div class="ticket-row">
					<span>Улюбленець:</span>
					<strong>{petName} ({petBreed}, {weightKg} кг)</strong>
				</div>
				<div class="ticket-row">
					<span>Бажаний час:</span>
					<strong>{selectedDate}, {selectedTime}</strong>
				</div>
				<div class="ticket-row">
					<span>Послуга:</span>
					<strong>{pricing.serviceName}</strong>
				</div>
				<div class="ticket-row">
					<span>{pricing.isEstimate ? 'Попередня оцінка:' : 'Вартість:'}</span>
					<strong>{pricing.totalPrice} ₴</strong>
				</div>
				{#if pricing.depositAmount > 0}
					<div class="ticket-row highlight">
						<span>Аванс після погодження:</span>
						<strong class="text-emerald-400">{pricing.depositAmount} ₴</strong>
					</div>
				{/if}
			</div>

			<div class="response-note">
				<span>⏳ Орієнтовний час відповіді: {effectiveData.approval?.responseTimeNotice || 'до 15 хвилин'}</span>
			</div>

			<div class="simulation-box pt-2">
				<span class="text-[11px] text-zinc-500 block mb-2">Для тестування (симуляція погодження грумером):</span>
				<button
					type="button"
					class="btn-simulate-pay"
					onclick={() => onPay(pricing.depositAmount > 0 ? pricing.depositAmount : pricing.totalPrice)}
				>
					<Check size={14} />
					<span>Сплатити аванс {pricing.depositAmount > 0 ? pricing.depositAmount : pricing.totalPrice} ₴</span>
				</button>
			</div>
		</div>
	{/if}
</div>

<style>
	.grooming-preview-shell {
		color: #f4f4f5;
		font-family: inherit;
		display: flex;
		flex-direction: column;
		gap: 14px;
	}

	/* Header */
	.studio-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding-bottom: 12px;
		border-bottom: 1px solid rgba(255, 255, 255, 0.08);
	}
	.studio-brand {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.studio-avatar {
		width: 36px;
		height: 36px;
		border-radius: 10px;
		background: rgba(245, 158, 11, 0.15);
		border: 1px solid rgba(245, 158, 11, 0.3);
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.studio-meta {
		display: flex;
		flex-direction: column;
	}
	.studio-name {
		font-size: 14px;
		font-weight: 700;
		color: #ffffff;
		margin: 0;
	}
	.studio-tagline {
		font-size: 11px;
		color: #a1a1aa;
	}
	.btn-switch-mode {
		display: flex;
		align-items: center;
		gap: 4px;
		font-size: 11px;
		color: #a1a1aa;
		background: rgba(255, 255, 255, 0.06);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 6px;
		padding: 4px 8px;
		cursor: pointer;
	}
	.btn-switch-mode:hover {
		color: #ffffff;
		background: rgba(255, 255, 255, 0.12);
	}

	/* Hero */
	.hero-card {
		background: linear-gradient(135deg, rgba(245, 158, 11, 0.15), rgba(234, 88, 12, 0.1));
		border: 1px solid rgba(245, 158, 11, 0.25);
		border-radius: 14px;
		padding: 16px;
		text-align: center;
	}
	.badge-groom {
		font-size: 10px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: #fbbf24;
		background: rgba(245, 158, 11, 0.2);
		padding: 3px 8px;
		border-radius: 6px;
		display: inline-block;
		margin-bottom: 6px;
	}
	.hero-card h2 {
		font-size: 14px;
		font-weight: 600;
		color: #ffffff;
		margin: 4px 0 8px;
	}
	.contacts-strip {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 12px;
		font-size: 11px;
		color: #cbd5e1;
	}

	.btn-mode-card {
		display: flex;
		align-items: center;
		gap: 12px;
		width: 100%;
		padding: 14px;
		border-radius: 12px;
		background: rgba(255, 255, 255, 0.04);
		border: 1px solid rgba(255, 255, 255, 0.1);
		color: #ffffff;
		text-align: left;
		cursor: pointer;
		transition: all 0.2s;
	}
	.btn-mode-card:hover {
		background: rgba(255, 255, 255, 0.08);
		transform: translateY(-1px);
	}
	.btn-mode-card.booking:hover {
		border-color: #f59e0b;
	}
	.btn-mode-card.in-salon:hover {
		border-color: #38bdf8;
	}
	.mode-icon {
		width: 42px;
		height: 42px;
		border-radius: 10px;
		background: rgba(255, 255, 255, 0.06);
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}
	.btn-mode-card.booking .mode-icon {
		color: #fbbf24;
		background: rgba(245, 158, 11, 0.15);
	}
	.btn-mode-card.in-salon .mode-icon {
		color: #38bdf8;
		background: rgba(56, 189, 248, 0.15);
	}
	.mode-text {
		flex: 1;
		min-width: 0;
	}
	.mode-text strong {
		display: block;
		font-size: 13px;
		font-weight: 700;
	}
	.mode-text small {
		font-size: 11px;
		color: #a1a1aa;
	}
	:global(.arrow) {
		color: #71717a;
	}

	.preview-helper {
		padding: 8px 12px;
		border-radius: 8px;
		background: rgba(255, 255, 255, 0.03);
		border: 1px dashed rgba(255, 255, 255, 0.12);
		text-align: center;
		font-size: 11px;
		color: #a1a1aa;
	}

	/* Form */
	.step-title-bar {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.step-pill {
		font-size: 10px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: #fbbf24;
		background: rgba(245, 158, 11, 0.15);
		padding: 2px 6px;
		border-radius: 4px;
	}
	.step-pill.in-salon {
		color: #38bdf8;
		background: rgba(56, 189, 248, 0.15);
	}
	.step-desc {
		font-size: 12px;
		color: #a1a1aa;
	}

	.section-box {
		background: rgba(255, 255, 255, 0.03);
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 10px;
		padding: 10px 12px;
	}
	.section-box.highlight-matting {
		background: rgba(245, 158, 11, 0.06);
		border-color: rgba(245, 158, 11, 0.2);
	}
	.section-box.highlight-matting.matted-active {
		background: rgba(239, 68, 68, 0.08);
		border-color: rgba(239, 68, 68, 0.3);
	}
	.section-label {
		display: block;
		font-size: 11px;
		font-weight: 700;
		color: #e4e4e7;
		margin-bottom: 6px;
	}

	.pet-type-btn {
		padding: 8px;
		border-radius: 8px;
		background: rgba(255, 255, 255, 0.04);
		border: 1px solid rgba(255, 255, 255, 0.1);
		color: #f4f4f5;
		font-size: 12px;
		font-weight: 600;
		cursor: pointer;
		text-align: center;
	}
	.pet-type-btn.active {
		background: #f59e0b;
		border-color: #fbbf24;
		color: #000000;
	}

	.tier-pill {
		display: flex;
		align-items: center;
		justify-content: space-between;
		background: rgba(245, 158, 11, 0.12);
		border-radius: 6px;
		padding: 4px 8px;
		font-size: 11px;
		color: #fbbf24;
	}

	/* Services */
	.service-chip {
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: 100%;
		padding: 8px 10px;
		border-radius: 8px;
		background: rgba(255, 255, 255, 0.04);
		border: 1px solid rgba(255, 255, 255, 0.08);
		color: #f4f4f5;
		cursor: pointer;
	}
	.service-chip.active {
		background: rgba(245, 158, 11, 0.15);
		border-color: #f59e0b;
	}
	.s-info {
		display: flex;
		flex-direction: column;
		text-align: left;
		gap: 1px;
	}
	.s-info strong {
		font-size: 12px;
	}
	.s-time {
		display: flex;
		align-items: center;
		gap: 3px;
		font-size: 10px;
		color: #a1a1aa;
	}
	.s-price {
		display: flex;
		align-items: center;
		gap: 6px;
	}
	.s-price strong {
		font-size: 13px;
		color: #fbbf24;
	}
	.check-dot {
		width: 16px;
		height: 16px;
		border-radius: 50%;
		background: #f59e0b;
		color: #000000;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	/* Coat Options */
	.opt-chip {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 6px 4px;
		border-radius: 6px;
		background: rgba(255, 255, 255, 0.04);
		border: 1px solid rgba(255, 255, 255, 0.08);
		color: #f4f4f5;
		cursor: pointer;
		font-size: 10px;
	}
	.opt-chip.active {
		background: #f59e0b;
		border-color: #fbbf24;
		color: #000000;
	}

	/* Matting condition */
	.cond-btn {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 7px 6px;
		border-radius: 8px;
		background: rgba(255, 255, 255, 0.04);
		border: 1px solid rgba(255, 255, 255, 0.08);
		color: #f4f4f5;
		cursor: pointer;
		font-size: 11px;
		text-align: center;
	}
	.cond-btn small {
		font-size: 9px;
		color: #a1a1aa;
		margin-top: 1px;
	}
	.cond-btn.active {
		background: #10b981;
		border-color: #34d399;
		color: white;
	}
	.cond-btn.warning.active {
		background: #ea580c;
		border-color: #fb923c;
		color: white;
	}
	.badge-eval {
		font-size: 9px;
		text-transform: uppercase;
		color: #f87171;
		background: rgba(239, 68, 68, 0.2);
		padding: 1px 5px;
		border-radius: 4px;
	}
	.estimate-banner {
		display: flex;
		align-items: flex-start;
		gap: 6px;
		background: rgba(234, 88, 12, 0.15);
		border: 1px solid rgba(234, 88, 12, 0.3);
		border-radius: 6px;
		padding: 6px 8px;
	}

	/* Add-ons */
	.addon-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: 100%;
		padding: 7px 10px;
		border-radius: 8px;
		background: rgba(255, 255, 255, 0.04);
		border: 1px solid rgba(255, 255, 255, 0.08);
		color: #ffffff;
		cursor: pointer;
	}
	.addon-row.active {
		background: rgba(168, 85, 247, 0.15);
		border-color: #c084fc;
	}
	.addon-text {
		text-align: left;
		display: flex;
		flex-direction: column;
	}
	.addon-text strong {
		font-size: 11px;
	}
	.addon-price {
		display: flex;
		align-items: center;
		gap: 6px;
	}
	.addon-price strong {
		font-size: 12px;
		color: #c084fc;
	}
	.box-check {
		width: 16px;
		height: 16px;
		border-radius: 4px;
		border: 1px solid rgba(255, 255, 255, 0.3);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 10px;
	}
	.box-check.checked {
		background: #a855f7;
		border-color: #a855f7;
		color: white;
	}

	/* Days & Times */
	.day-btn {
		padding: 4px 10px;
		border-radius: 6px;
		background: rgba(255, 255, 255, 0.05);
		border: 1px solid rgba(255, 255, 255, 0.08);
		color: #e4e4e7;
		font-size: 11px;
		cursor: pointer;
		white-space: nowrap;
	}
	.day-btn.active {
		background: #f59e0b;
		border-color: #fbbf24;
		color: #000000;
	}
	.time-btn {
		padding: 5px;
		border-radius: 6px;
		background: rgba(255, 255, 255, 0.04);
		border: 1px solid rgba(255, 255, 255, 0.08);
		color: #f4f4f5;
		font-size: 11px;
		cursor: pointer;
	}
	.time-btn.active {
		background: #f59e0b;
		border-color: #fbbf24;
		color: #000000;
	}

	.groom-input {
		width: 100%;
		box-sizing: border-box;
		background: rgba(0, 0, 0, 0.3);
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 8px;
		padding: 7px 10px;
		color: #ffffff;
		font-size: 12px;
		outline: none;
	}
	.groom-input:focus {
		border-color: #f59e0b;
	}

	/* Summary Card */
	.summary-card {
		background: rgba(255, 255, 255, 0.04);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 10px;
		padding: 10px 12px;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.sum-line {
		display: flex;
		justify-content: space-between;
		font-size: 11px;
		color: #a1a1aa;
	}
	.sum-line strong {
		color: #ffffff;
	}
	.sum-line.sub {
		padding-left: 8px;
		font-size: 10px;
		color: #71717a;
	}
	.sum-line.total {
		border-top: 1px solid rgba(255, 255, 255, 0.08);
		padding-top: 6px;
		margin-top: 4px;
		font-size: 12px;
		color: #ffffff;
	}
	.sum-line.deposit {
		background: rgba(16, 185, 129, 0.1);
		border-radius: 6px;
		padding: 4px 6px;
		margin-top: 2px;
	}

	/* Action Buttons */
	.btn-submit-booking,
	.btn-pay-now,
	.btn-simulate-pay {
		width: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		padding: 12px;
		border-radius: 10px;
		font-size: 13px;
		font-weight: 700;
		border: none;
		cursor: pointer;
		transition: all 0.2s;
	}
	.btn-submit-booking {
		background: linear-gradient(135deg, #f59e0b, #d97706);
		color: #000000;
	}
	.btn-submit-booking:hover {
		background: linear-gradient(135deg, #d97706, #b45309);
	}
	.btn-pay-now {
		background: linear-gradient(135deg, #059669, #10b981);
		color: white;
	}
	.btn-simulate-pay {
		background: rgba(16, 185, 129, 0.2);
		border: 1px solid #10b981;
		color: #34d399;
		padding: 8px;
		font-size: 12px;
	}

	/* In-salon found card */
	.found-invoice-card {
		background: rgba(255, 255, 255, 0.06);
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 8px;
		padding: 8px 10px;
	}

	/* Submitted screen */
	.sent-badge {
		width: 54px;
		height: 54px;
		border-radius: 50%;
		background: rgba(245, 158, 11, 0.15);
		border: 1px solid rgba(245, 158, 11, 0.3);
		display: flex;
		align-items: center;
		justify-content: center;
		margin: 0 auto;
	}
	.ticket-box {
		background: rgba(255, 255, 255, 0.04);
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 10px;
		padding: 10px 12px;
		display: flex;
		flex-direction: column;
		gap: 5px;
	}
	.ticket-row {
		display: flex;
		justify-content: space-between;
		font-size: 11px;
		color: #a1a1aa;
	}
	.ticket-row strong {
		color: #ffffff;
	}
	.ticket-row.highlight {
		border-top: 1px solid rgba(255, 255, 255, 0.08);
		padding-top: 5px;
		margin-top: 2px;
	}
	.response-note {
		font-size: 11px;
		color: #94a3b8;
		background: rgba(255, 255, 255, 0.04);
		padding: 6px;
		border-radius: 6px;
	}
</style>
