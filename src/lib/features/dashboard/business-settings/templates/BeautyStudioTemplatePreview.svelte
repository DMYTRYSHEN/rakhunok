<script lang="ts">
	import {
		Scissors,
		Clock,
		Check,
		ChevronRight,
		ArrowLeft,
		Calendar,
		Sparkles,
		ShieldCheck,
		Send,
		User,
		Phone,
		MapPin
	} from '@lucide/svelte';
	import type { BeautyStudioFlowData } from '$lib/features/shared/checkout-scenario-config';
	import { calculateBeautyPrice, pruneBeautySelections } from '$lib/features/shared/beauty-pricing';

	let {
		flowData = {},
		onPay
	}: {
		flowData?: Partial<BeautyStudioFlowData>;
		onPay: (amount: number) => void;
	} = $props();

	// Дефолтні дані, якщо flowData ще пустий
	const defaultServices = [
		{ id: 'srv_female', name: 'Жіноча стрижка', durationMinutes: 60, basePrice: 600 },
		{ id: 'srv_male', name: 'Чоловіча стрижка', durationMinutes: 45, basePrice: 400 },
		{ id: 'srv_child', name: 'Дитяча стрижка', durationMinutes: 30, basePrice: 350 }
	];

	const defaultQuestions = [
		{
			id: 'q_hair_length',
			title: 'Довжина волосся',
			hint: 'Тільки для жіночої стрижки',
			required: true,
			dependsOnServiceId: 'srv_female',
			options: [
				{ id: 'opt_short', title: 'Коротке волосся', extraPrice: 0 },
				{ id: 'opt_medium', title: 'Середнє волосся', extraPrice: 150 },
				{ id: 'opt_long', title: 'Довге волосся', extraPrice: 300 }
			]
		}
	];

	const defaultMasters = [
		{ id: 'm_any', name: 'Будь-який майстер', role: 'Спеціаліст', extraPrice: 0 },
		{ id: 'm_reg', name: 'Звичайний майстер', role: 'Стиліст', extraPrice: 0 },
		{ id: 'm_lead', name: 'Провідний майстер', role: 'Топ-стиліст', extraPrice: 200 }
	];

	const defaultAddons = [
		{ id: 'add_care', name: 'Догляд та маска для волосся', description: '', price: 250 }
	];

	const effectiveData = $derived<Partial<BeautyStudioFlowData>>({
		studioName: flowData.studioName || 'Beauty Studio',
		title: flowData.title || 'Салон краси та стилю',
		description: flowData.description || 'Стрижки, догляд та фарбування',
		contacts: flowData.contacts || {
			phone: '+380 67 000 00 00',
			instagram: '@beauty.studio',
			address: 'вул. Хрещатик, 15'
		},
		modes: flowData.modes || {
			bookingEnabled: true,
			inSalonPayEnabled: true,
			bookingButtonText: 'Записатися на візит',
			inSalonButtonText: 'Оплатити в салоні'
		},
		services: Array.isArray(flowData.services) && flowData.services.length > 0
			? flowData.services
			: defaultServices,
		questions: Array.isArray(flowData.questions) ? flowData.questions : defaultQuestions,
		masters: Array.isArray(flowData.masters) ? flowData.masters : defaultMasters,
		addons: Array.isArray(flowData.addons) ? flowData.addons : defaultAddons,
		paymentModel: flowData.paymentModel || { type: 'percent', percentValue: 30, fixedAmount: 200 },
		approval: flowData.approval || { channel: 'telegram', responseTimeNotice: 'до 15 хвилин' }
	});

	// Поточний екран: 'welcome' | 'booking' | 'in_salon' | 'booking_submitted'
	let activePath = $state<'welcome' | 'booking' | 'in_salon' | 'booking_submitted'>('welcome');

	// Вибрані клієнтом опції
	let selectedServiceId = $state<string>('');
	let questionOptionMap = $state<Record<string, string>>({});
	let selectedMasterId = $state<string>('');
	let selectedAddonIds = $state<string[]>([]);

	// Дані для запису
	let selectedDate = $state('Завтра');
	let selectedTime = $state('14:00');
	let clientName = $state('Оксана');
	let clientPhone = $state('+380 67 123 45 67');

	// Ініціалізація вибору за замовчуванням
	$effect(() => {
		const srvs = effectiveData.services ?? [];
		if (srvs.length > 0 && !selectedServiceId) {
			selectedServiceId = srvs[0].id;
		}
		const mstrs = effectiveData.masters ?? [];
		if (mstrs.length > 0 && !selectedMasterId) {
			selectedMasterId = mstrs[2]?.id ?? mstrs[0].id; // дефолтно провідний для наочності
		}
	});

	// Автоматичне очищення залежних відповідей при зміні послуги
	$effect(() => {
		if (selectedServiceId) {
			const cleaned = pruneBeautySelections(effectiveData, selectedServiceId, questionOptionMap);
			if (JSON.stringify(cleaned) !== JSON.stringify(questionOptionMap)) {
				questionOptionMap = cleaned;
			}
		}
	});

	// Динамічний розрахунок ціни через спільний калькулятор
	const pricing = $derived(
		calculateBeautyPrice(effectiveData, {
			serviceId: selectedServiceId,
			questionOptionMap,
			masterId: selectedMasterId,
			addonIds: selectedAddonIds
		})
	);

	// Активні запитання для поточної послуги
	const activeQuestions = $derived(
		(effectiveData.questions ?? []).filter(
			(q) => !q.dependsOnServiceId || q.dependsOnServiceId === selectedServiceId
		)
	);

	function toggleAddon(id: string) {
		if (selectedAddonIds.includes(id)) {
			selectedAddonIds = selectedAddonIds.filter((item) => item !== id);
		} else {
			selectedAddonIds = [...selectedAddonIds, id];
		}
	}

	function handleServiceSelect(id: string) {
		selectedServiceId = id;
		// Якщо для послуги є обов'язкові запитання і для них немає вибору — ставимо перший варіант
		const questionsForThis = (effectiveData.questions ?? []).filter(
			(q) => q.dependsOnServiceId === id
		);
		for (const q of questionsForThis) {
			if (!questionOptionMap[q.id] && q.options?.length) {
				questionOptionMap = { ...questionOptionMap, [q.id]: q.options[q.options.length - 1].id };
			}
		}
	}
</script>

<div class="beauty-preview-shell">
	<!-- Шапка салону -->
	<header class="studio-header">
		<div class="studio-brand">
			<div class="studio-avatar">
				<Scissors size={20} class="text-rose-500" />
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
	<!-- ЕКРАН 1: Вітальний екран вибору шляху (якщо увімкнено обидва) -->
	<!-- ═════════════════════════════════════════════════════════════ -->
	{#if activePath === 'welcome'}
		<div class="welcome-screen space-y-4">
			<div class="hero-card">
				<span class="badge-beauty">Beauty Experience</span>
				<h2>{effectiveData.description}</h2>
				<div class="contacts-strip">
					{#if effectiveData.contacts?.instagram}
						<span>📸 {effectiveData.contacts.instagram}</span>
					{/if}
					{#if effectiveData.contacts?.address}
						<span><MapPin size={12} /> {effectiveData.contacts.address}</span>
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
							<strong>{effectiveData.modes?.bookingButtonText || 'Записатися на візит'}</strong>
							<small>Обрати послугу, майстра та зручний час</small>
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
						<div class="mode-icon"><Scissors size={22} /></div>
						<div class="mode-text">
							<strong>{effectiveData.modes?.inSalonButtonText || 'Оплатити в салоні'}</strong>
							<small>Миттєва оплата на місці через QR / Apple Pay</small>
						</div>
						<ChevronRight size={18} class="arrow" />
					</button>
				{/if}
			</div>

			<!-- Підказка для мерчанта в прев'ю -->
			<div class="preview-helper">
				<span>💡 Натисніть одну з кнопок вище, щоб протестувати клієнтський flow</span>
			</div>
		</div>

	<!-- ═════════════════════════════════════════════════════════════ -->
	<!-- ЕКРАН 2: Шлях 1 — «Записатися на візит»                       -->
	<!-- ═════════════════════════════════════════════════════════════ -->
	{:else if activePath === 'booking'}
		<div class="flow-content space-y-4">
			<div class="step-title-bar">
				<span class="step-pill">Онлайн-запис</span>
				<span class="step-desc">Оберіть деталі вашого візиту</span>
			</div>

			<!-- Крок 1: Послуга -->
			<div class="section-box">
				<span class="section-label">1. Оберіть послугу:</span>
				<div class="services-list space-y-1.5">
					{#each effectiveData.services ?? [] as s (s.id)}
						<button
							type="button"
							class="service-chip"
							class:active={s.id === selectedServiceId}
							onclick={() => handleServiceSelect(s.id)}
						>
							<div class="s-info">
								<strong>{s.name}</strong>
								<span class="s-time"><Clock size={11} /> {s.durationMinutes} хв</span>
							</div>
							<div class="s-price">
								<strong>{s.basePrice} ₴</strong>
								{#if s.id === selectedServiceId}
									<span class="check-dot"><Check size={12} /></span>
								{/if}
							</div>
						</button>
					{/each}
				</div>
			</div>

			<!-- Крок 2: Розгалужені запитання (Довжина волосся) -->
			{#if activeQuestions.length > 0}
				{#each activeQuestions as q (q.id)}
					<div class="section-box highlight-box">
						<span class="section-label text-indigo-400">
							2. {q.title}
							<span class="badge-branching">розгалуження</span>
						</span>
						<p class="section-hint">{q.hint}</p>

						<div class="options-grid">
							{#each q.options as opt (opt.id)}
								<button
									type="button"
									class="opt-btn"
									class:active={questionOptionMap[q.id] === opt.id}
									onclick={() => (questionOptionMap = { ...questionOptionMap, [q.id]: opt.id })}
								>
									<span>{opt.title}</span>
									<strong>{opt.extraPrice > 0 ? `+${opt.extraPrice} ₴` : 'Без доплати'}</strong>
								</button>
							{/each}
						</div>
					</div>
				{/each}
			{/if}

			<!-- Крок 3: Вибір майстра -->
			<div class="section-box">
				<span class="section-label">3. Спеціаліст / Майстер:</span>
				<div class="masters-grid">
					{#each effectiveData.masters ?? [] as m (m.id)}
						<button
							type="button"
							class="master-card"
							class:active={m.id === selectedMasterId}
							onclick={() => (selectedMasterId = m.id)}
						>
							<span class="m-avatar">💇</span>
							<div class="m-info">
								<strong>{m.name}</strong>
								<small>{m.role}</small>
							</div>
							<span class="m-extra">{m.extraPrice > 0 ? `+${m.extraPrice} ₴` : '+0 ₴'}</span>
						</button>
					{/each}
				</div>
			</div>

			<!-- Крок 4: Додатковий догляд -->
			{#if (effectiveData.addons ?? []).length > 0}
				<div class="section-box">
					<span class="section-label">4. Додаткові процедури:</span>
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

			<!-- Крок 5: Бажаний час -->
			<div class="section-box">
				<span class="section-label">5. Бажаний час візиту:</span>
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
					{#each ['10:00', '12:30', '14:00', '16:30', '18:00', '19:15'] as t}
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
					ℹ️ Час є бажаним та узгоджується із графіком майстра
				</span>
			</div>

			<!-- Крок 6: Контакти клієнта -->
			<div class="section-box">
				<span class="section-label">6. Ваші контактні дані:</span>
				<div class="space-y-2">
					<input
						type="text"
						bind:value={clientName}
						placeholder="Ваше ім’я"
						class="beauty-input"
					/>
					<input
						type="tel"
						bind:value={clientPhone}
						placeholder="+380 67 000 00 00"
						class="beauty-input"
					/>
				</div>
			</div>

			<!-- Підсумок та розрахунок авансу -->
			<div class="summary-card">
				<div class="sum-line">
					<span>{pricing.serviceName}:</span>
					<strong>{pricing.basePrice} ₴</strong>
				</div>

				{#each pricing.activeModifiers as mod}
					<div class="sum-line sub">
						<span>└ {mod.title}:</span>
						<strong>+{mod.extraPrice} ₴</strong>
					</div>
				{/each}

				{#if pricing.masterExtra > 0}
					<div class="sum-line sub">
						<span>└ Майстер ({pricing.masterName}):</span>
						<strong>+{pricing.masterExtra} ₴</strong>
					</div>
				{/if}

				{#each pricing.activeAddons as add}
					<div class="sum-line sub">
						<span>└ {add.name}:</span>
						<strong>+{add.price} ₴</strong>
					</div>
				{/each}

				<div class="sum-line total">
					<span>Загальна вартість:</span>
					<strong class="text-rose-400 text-base">{pricing.totalPrice} ₴</strong>
				</div>

				{#if pricing.paymentType === 'percent'}
					<div class="sum-line deposit">
						<span>Аванс для фіксації (30%):</span>
						<strong class="text-emerald-400 font-bold">{pricing.depositAmount} ₴</strong>
					</div>
				{:else if pricing.paymentType === 'fixed'}
					<div class="sum-line deposit">
						<span>Аванс для фіксації:</span>
						<strong class="text-emerald-400 font-bold">{pricing.depositAmount} ₴</strong>
					</div>
				{:else if pricing.paymentType === 'full'}
					<div class="sum-line deposit">
						<span>Оплата 100%:</span>
						<strong class="text-emerald-400 font-bold">{pricing.depositAmount} ₴</strong>
					</div>
				{/if}
			</div>

			<button
				type="button"
				class="btn-submit-booking"
				onclick={() => (activePath = 'booking_submitted')}
			>
				<Send size={16} />
				<span>Надіслати заявку на погодження</span>
			</button>
		</div>

	<!-- ═════════════════════════════════════════════════════════════ -->
	<!-- ЕКРАН 3: Шлях 2 — «Оплатити в салоні»                          -->
	<!-- ═════════════════════════════════════════════════════════════ -->
	{:else if activePath === 'in_salon'}
		<div class="flow-content space-y-4">
			<div class="step-title-bar in-salon-header">
				<span class="step-pill in-salon">Оплата на місці</span>
				<span class="step-desc">Швидкий розрахунок у салоні</span>
			</div>

			<!-- Вибір наданої послуги -->
			<div class="section-box">
				<span class="section-label">Надана послуга:</span>
				<div class="services-list space-y-1.5">
					{#each effectiveData.services ?? [] as s (s.id)}
						<button
							type="button"
							class="service-chip"
							class:active={s.id === selectedServiceId}
							onclick={() => handleServiceSelect(s.id)}
						>
							<div class="s-info">
								<strong>{s.name}</strong>
							</div>
							<div class="s-price">
								<strong>{s.basePrice} ₴</strong>
								{#if s.id === selectedServiceId}
									<span class="check-dot"><Check size={12} /></span>
								{/if}
							</div>
						</button>
					{/each}
				</div>
			</div>

			<!-- Залежні параметри (довжина) -->
			{#if activeQuestions.length > 0}
				{#each activeQuestions as q (q.id)}
					<div class="section-box highlight-box">
						<span class="section-label text-indigo-400">{q.title}:</span>
						<div class="options-grid">
							{#each q.options as opt (opt.id)}
								<button
									type="button"
									class="opt-btn"
									class:active={questionOptionMap[q.id] === opt.id}
									onclick={() => (questionOptionMap = { ...questionOptionMap, [q.id]: opt.id })}
								>
									<span>{opt.title}</span>
									<strong>{opt.extraPrice > 0 ? `+${opt.extraPrice} ₴` : '+0 ₴'}</strong>
								</button>
							{/each}
						</div>
					</div>
				{/each}
			{/if}

			<!-- Майстер -->
			<div class="section-box">
				<span class="section-label">Хто надавав послугу:</span>
				<div class="masters-grid">
					{#each effectiveData.masters ?? [] as m (m.id)}
						<button
							type="button"
							class="master-card"
							class:active={m.id === selectedMasterId}
							onclick={() => (selectedMasterId = m.id)}
						>
							<span class="m-avatar">💇</span>
							<div class="m-info">
								<strong>{m.name}</strong>
								<small>{m.role}</small>
							</div>
							<span class="m-extra">{m.extraPrice > 0 ? `+${m.extraPrice} ₴` : '+0 ₴'}</span>
						</button>
					{/each}
				</div>
			</div>

			<!-- Додатковий догляд -->
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

			<!-- Підсумок без зайвих полів часу й телефону -->
			<div class="summary-card">
				<div class="sum-line total">
					<span>Сума до сплати:</span>
					<strong class="text-rose-400 text-lg font-black">{pricing.totalPrice} ₴</strong>
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
				<Send size={28} class="text-blue-400" />
			</div>

			<div class="space-y-1">
				<h3 class="text-base font-bold text-white">Заявку надіслано в салон</h3>
				<p class="text-xs text-zinc-400">
					Адміністратор отримав сповіщення в Telegram та перевіряє графік майстра ({pricing.masterName}).
				</p>
			</div>

			<div class="ticket-box text-left">
				<div class="ticket-row">
					<span>Клієнт:</span>
					<strong>{clientName} ({clientPhone})</strong>
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
					<span>Вартість:</span>
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
				<span>⏳ Орієнтовний час підтвердження: {effectiveData.approval?.responseTimeNotice || 'до 15 хвилин'}</span>
			</div>

			<!-- Симуляція погодження для тестування -->
			<div class="simulation-box pt-2">
				<span class="text-[11px] text-zinc-500 block mb-2">Для тестування (симуляція погодження майстром):</span>
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
	.beauty-preview-shell {
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
		background: rgba(244, 63, 94, 0.15);
		border: 1px solid rgba(244, 63, 94, 0.3);
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

	/* Welcome Screen */
	.hero-card {
		background: linear-gradient(135deg, rgba(244, 63, 94, 0.15), rgba(168, 85, 247, 0.1));
		border: 1px solid rgba(244, 63, 94, 0.25);
		border-radius: 14px;
		padding: 16px;
		text-align: center;
	}
	.badge-beauty {
		font-size: 10px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: #fb7185;
		background: rgba(244, 63, 94, 0.2);
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
	.contacts-strip span {
		display: flex;
		align-items: center;
		gap: 4px;
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
		border-color: #f43f5e;
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
		color: #fb7185;
		background: rgba(244, 63, 94, 0.15);
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

	/* Common Form Flow */
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
		color: #fb7185;
		background: rgba(244, 63, 94, 0.15);
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
	.section-box.highlight-box {
		background: rgba(99, 102, 241, 0.08);
		border-color: rgba(99, 102, 241, 0.3);
	}
	.section-label {
		display: flex;
		align-items: center;
		justify-content: space-between;
		font-size: 11px;
		font-weight: 700;
		color: #e4e4e7;
		margin-bottom: 6px;
	}
	.badge-branching {
		font-size: 9px;
		text-transform: uppercase;
		color: #818cf8;
		background: rgba(99, 102, 241, 0.2);
		padding: 1px 5px;
		border-radius: 4px;
	}
	.section-hint {
		font-size: 10px;
		color: #a1a1aa;
		margin: -2px 0 6px;
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
		transition: all 0.2s;
	}
	.service-chip.active {
		background: rgba(244, 63, 94, 0.15);
		border-color: #f43f5e;
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
		color: #fb7185;
	}
	.check-dot {
		width: 16px;
		height: 16px;
		border-radius: 50%;
		background: #f43f5e;
		color: white;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	/* Branching Options */
	.options-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 6px;
	}
	.opt-btn {
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
		text-align: center;
	}
	.opt-btn.active {
		background: #6366f1;
		border-color: #818cf8;
		color: white;
	}
	.opt-btn strong {
		font-size: 11px;
		margin-top: 2px;
	}

	/* Masters */
	.masters-grid {
		display: grid;
		grid-template-columns: 1fr;
		gap: 6px;
	}
	.master-card {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 6px 10px;
		border-radius: 8px;
		background: rgba(255, 255, 255, 0.04);
		border: 1px solid rgba(255, 255, 255, 0.08);
		color: #ffffff;
		cursor: pointer;
	}
	.master-card.active {
		background: rgba(245, 158, 11, 0.15);
		border-color: #f59e0b;
	}
	.m-avatar {
		font-size: 14px;
	}
	.m-info {
		flex: 1;
		text-align: left;
		display: flex;
		flex-direction: column;
	}
	.m-info strong {
		font-size: 11px;
	}
	.m-info small {
		font-size: 9px;
		color: #a1a1aa;
	}
	.m-extra {
		font-size: 11px;
		font-weight: 700;
		color: #fbbf24;
	}

	/* Add-on Row */
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
		background: #f43f5e;
		border-color: #f43f5e;
		color: white;
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
		background: #f43f5e;
		border-color: #f43f5e;
		color: white;
	}

	.beauty-input {
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
	.beauty-input:focus {
		border-color: #f43f5e;
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
		background: linear-gradient(135deg, #f43f5e, #e11d48);
		color: white;
	}
	.btn-submit-booking:hover {
		background: linear-gradient(135deg, #e11d48, #be123c);
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

	/* Submitted screen */
	.sent-badge {
		width: 54px;
		height: 54px;
		border-radius: 50%;
		background: rgba(59, 130, 246, 0.15);
		border: 1px solid rgba(59, 130, 246, 0.3);
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
