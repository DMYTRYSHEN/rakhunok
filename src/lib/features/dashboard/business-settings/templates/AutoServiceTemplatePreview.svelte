<script lang="ts">
	import {
		Calendar,
		Check,
		ChevronRight,
		Clock,
		ShieldCheck,
		User,
		Wrench
	} from '@lucide/svelte';

	let {
		onPay,
		scenario = 'vertical_auto',
		flowData = {}
	}: {
		onPay: (amount: number) => void;
		scenario?: string;
		flowData?: Record<string, unknown>;
	} = $props();

	type VehicleType = {
		id: string;
		title: string;
		subtitle: string;
		icon: string;
		baseModifier: number;
	};

	type AutoService = {
		id: string;
		name: string;
		duration: string;
		basePrice: number;
	};

	const uiLabels = $derived.by(() => {
		if (scenario === 'vertical_education') {
			return {
				tab1: 'Курс / Викладач',
				tab2: 'Дата і час',
				tab3: 'Оплата',
				categoryHeading: 'Викладач / Напрямок навчання:',
				serviceHeading: 'Перелік занять та курсів',
				serviceSubtitle: 'Оберіть пробний урок, разове заняття або абонемент',
				scheduleHeading: 'Вільні години викладача',
				scheduleSubtitle: 'Оберіть дату та час першого уроку',
				customFieldLabel: 'Мета навчання / Рівень учня:',
				customFieldPlaceholder: 'Наприклад: B1, підготовка до НМТ'
			};
		}
		if (scenario === 'vertical_beauty') {
			return {
				tab1: 'Послуги салону',
				tab2: 'Дата і час',
				tab3: 'Оплата',
				categoryHeading: 'Спеціаліст / Майстер:',
				serviceHeading: 'Прайс-лист послуг краси',
				serviceSubtitle: 'Оберіть процедуру моделювання, фарбування чи догляду',
				scheduleHeading: 'Вільний розклад майстра',
				scheduleSubtitle: 'Оберіть зручний час для запису',
				customFieldLabel: 'Побажання для майстра:',
				customFieldPlaceholder: 'Бажаний стиль, довжина або колір'
			};
		}
		if (scenario === 'vertical_pets') {
			return {
				tab1: 'Грумінг',
				tab2: 'Дата і час',
				tab3: 'Оплата',
				categoryHeading: 'Розмір та вид тварини:',
				serviceHeading: 'Послуги грумінгу та гігієни',
				serviceSubtitle: 'Оберіть комплекс або гігієнічну процедуру',
				scheduleHeading: 'Вільні місця на грумінг-столі',
				scheduleSubtitle: 'Оберіть дату та час прийому',
				customFieldLabel: 'Кличка та порода улюбленця:',
				customFieldPlaceholder: 'Чак, бігль, 2 роки'
			};
		}
		if (scenario === 'vertical_cleaning') {
			return {
				tab1: 'Клінінг',
				tab2: 'Дата виїзду',
				tab3: 'Оплата',
				categoryHeading: 'Тип житла / площа:',
				serviceHeading: 'Пакети прибирання',
				serviceSubtitle: 'Оберіть необхідний обсяг клінінгових робіт',
				scheduleHeading: 'Графік виїзду бригади',
				scheduleSubtitle: 'Оберіть дату та зручний час прибуття клінерів',
				customFieldLabel: 'Адреса об’єкта (вулиця, кв):',
				customFieldPlaceholder: 'вул. Хрещатик, 1, кв. 15'
			};
		}
		if (scenario === 'vertical_rental') {
			return {
				tab1: 'Спорядження',
				tab2: 'Дати прокату',
				tab3: 'Оплата',
				categoryHeading: 'Категорія товарів:',
				serviceHeading: 'Об’єкти прокату (добовий тариф)',
				serviceSubtitle: 'Оберіть намет, сапборд або інструмент',
				scheduleHeading: 'Графік пункту видачі',
				scheduleSubtitle: 'Оберіть дату та час отримання спорядження',
				customFieldLabel: 'Адреса видачі / номер паспорта:',
				customFieldPlaceholder: 'Самовивіз або доставка додому'
			};
		}
		if (scenario === 'vertical_services') {
			return {
				tab1: 'Послуги майстра',
				tab2: 'Дата візиту',
				tab3: 'Оплата',
				categoryHeading: 'Спеціалізація майстра:',
				serviceHeading: 'Перелік ремонтних послуг',
				serviceSubtitle: 'Сантехніка, електрика, дрібний побутовий ремонт',
				scheduleHeading: 'Графік виїзду майстра',
				scheduleSubtitle: 'Оберіть зручний час для візиту спеціаліста',
				customFieldLabel: 'Адреса та опис несправності:',
				customFieldPlaceholder: 'вул. Садова, 5, тече кран у ванній'
			};
		}
		// За замовчуванням СТО / Шиномонтаж
		return {
			tab1: 'Послуги СТО',
			tab2: 'Дата і час',
			tab3: 'Оплата',
			categoryHeading: 'Тип авто (впливає на вартість):',
			serviceHeading: 'Перелік послуг СТО та шиномонтажу',
			serviceSubtitle: 'Оберіть потрібні роботи для вашого автомобіля',
			scheduleHeading: 'Вільні слоти на боксі СТО',
			scheduleSubtitle: 'Оберіть дату та час для заїзду',
			customFieldLabel: 'Номерний знак авто:',
			customFieldPlaceholder: 'КА 0000 АА'
		};
	});

	const defaultVehicleTypes: VehicleType[] = [
		{ id: 'sedan', title: 'Легкове', subtitle: 'Седан, хетчбек', icon: '🚗', baseModifier: 1.0 },
		{ id: 'suv', title: 'Кросовер / SUV', subtitle: 'Позашляховик', icon: '🚙', baseModifier: 1.25 },
		{ id: 'van', title: 'Мікроавтобус', subtitle: 'Бус, комерційний', icon: '🚐', baseModifier: 1.5 }
	];

	const defaultServices: AutoService[] = [
		{ id: 'tire_full', name: 'Комплексний шиномонтаж (4 шт)', duration: '45 хв', basePrice: 800 },
		{ id: 'tire_balance', name: 'Балансування коліс', duration: '30 хв', basePrice: 400 },
		{ id: 'inspection', name: 'Діагностика ходової частини', duration: '30 хв', basePrice: 350 },
		{ id: 'oil_change', name: 'Заміна мастила та фільтрів', duration: '40 хв', basePrice: 450 }
	];

	const vehicleTypes = $derived<VehicleType[]>(
		Array.isArray(flowData?.categories) && flowData.categories.length > 0
			? (flowData.categories as any[]).map((c) => ({
					id: c.id || 'cat',
					title: c.title || 'Категорія',
					subtitle: c.subtitle || '',
					icon: c.icon || '🚗',
					baseModifier: Number(c.modifier || 1.0)
				}))
			: defaultVehicleTypes
	);

	const services = $derived<AutoService[]>(
		Array.isArray(flowData?.services) && flowData.services.length > 0
			? (flowData.services as any[]).map((s) => ({
					id: s.id || 'srv',
					name: s.name || 'Послуга',
					duration: typeof s.duration === 'string' ? s.duration : `${s.durationMinutes || 30} хв`,
					basePrice: Number(s.basePrice || 300)
				}))
			: defaultServices
	);

	const scheduleData = $derived(
		(flowData?.schedule as Record<string, any>) || {}
	);

	const depositAmount = $derived(
		Number(scheduleData.depositAmount || flowData?.deposit_amount || 200)
	);

	// Генерація 7 днів для календаря
	const days = Array.from({ length: 7 }, (_, i) => {
		const d = new Date();
		d.setDate(d.getDate() + i);
		const dayName = i === 0 ? 'Сьогодні' : i === 1 ? 'Завтра' : d.toLocaleDateString('uk-UA', { weekday: 'short' });
		const dateStr = d.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' });
		const iso = d.toISOString().slice(0, 10);
		return { iso, dayName, dateStr };
	});

	// Генерація динамічних слотів часу за графіком мерчанта
	const timeSlots = $derived.by(() => {
		const start = scheduleData.startHour || '09:00';
		const end = scheduleData.endHour || '19:00';
		const stepMins = Number(scheduleData.slotDurationMinutes || 45);

		const [startH, startM] = start.split(':').map(Number);
		const [endH, endM] = end.split(':').map(Number);

		let currentMinutes = startH * 60 + (startM || 0);
		const stopMinutes = endH * 60 + (endM || 0);

		const slots: { time: string; available: boolean }[] = [];
		let count = 0;

		while (currentMinutes + stepMins <= stopMinutes && count < 16) {
			const h = Math.floor(currentMinutes / 60).toString().padStart(2, '0');
			const m = (currentMinutes % 60).toString().padStart(2, '0');
			const available = !(count === 2 || count === 6);
			slots.push({ time: `${h}:${m}`, available });
			currentMinutes += stepMins;
			count++;
		}

		return slots.length > 0 ? slots : [
			{ time: '09:00', available: true },
			{ time: '10:15', available: true },
			{ time: '11:30', available: false },
			{ time: '13:00', available: true },
			{ time: '14:30', available: true },
			{ time: '16:00', available: true },
			{ time: '17:30', available: false },
			{ time: '18:45', available: true }
		];
	});

	let step = $state<1 | 2 | 3>(1);
	let selectedVehicleId = $state<string>('');
	let selectedServiceId = $state<string>('');
	let selectedDateIso = $state<string>(days[0].iso);
	let selectedTime = $state<string>('10:15');
	let carPlate = $state<string>('КА 7744 ВІ');
	let clientPhone = $state<string>('+380 67 123 45 67');
	let paymentMode = $state<'deposit' | 'full'>('deposit');

	$effect(() => {
		if (vehicleTypes.length > 0 && (!selectedVehicleId || !vehicleTypes.some((v) => v.id === selectedVehicleId))) {
			selectedVehicleId = vehicleTypes[0].id;
		}
	});

	$effect(() => {
		if (services.length > 0 && (!selectedServiceId || !services.some((s) => s.id === selectedServiceId))) {
			selectedServiceId = services[0].id;
		}
	});

	$effect(() => {
		if (timeSlots.length > 0 && (!selectedTime || !timeSlots.some((t) => t.time === selectedTime))) {
			const firstAvail = timeSlots.find((t) => t.available);
			selectedTime = firstAvail ? firstAvail.time : timeSlots[0].time;
		}
	});

	const selectedVehicle = $derived(vehicleTypes.find((v) => v.id === selectedVehicleId) ?? vehicleTypes[0]);
	const selectedService = $derived(services.find((s) => s.id === selectedServiceId) ?? services[0]);
	const totalPrice = $derived(Math.round((selectedService?.basePrice ?? 500) * (selectedVehicle?.baseModifier ?? 1.0)));
	const paymentAmount = $derived(paymentMode === 'deposit' ? depositAmount : totalPrice);

	function proceedToPay() {
		onPay(paymentAmount);
	}
</script>

<div class="booking-preview">
	<!-- Interactive 3-step navigation bar -->
	<div class="step-nav" role="tablist">
		<button
			type="button"
			role="tab"
			class="step-tab"
			class:active={step === 1}
			onclick={() => (step = 1)}
		>
			<span class="tab-badge">1</span>
			<span class="tab-text">{uiLabels.tab1}</span>
		</button>
		<button
			type="button"
			role="tab"
			class="step-tab"
			class:active={step === 2}
			onclick={() => (step = 2)}
		>
			<span class="tab-badge">2</span>
			<span class="tab-text">{uiLabels.tab2}</span>
		</button>
		<button
			type="button"
			role="tab"
			class="step-tab"
			class:active={step === 3}
			onclick={() => (step = 3)}
		>
			<span class="tab-badge">3</span>
			<span class="tab-text">{uiLabels.tab3}</span>
		</button>
	</div>

	<!-- Step 1: Services & Categories -->
	{#if step === 1}
		{#if vehicleTypes.length > 0}
			<div class="category-block">
				<span class="sub-label">{uiLabels.categoryHeading}</span>
				<div class="cat-pills">
					{#each vehicleTypes as v (v.id)}
						<button
							type="button"
							class="cat-chip"
							class:selected={v.id === selectedVehicleId}
							onclick={() => (selectedVehicleId = v.id)}
						>
							<span class="chip-icon">{v.icon}</span>
							<span class="chip-title">{v.title}</span>
							{#if v.baseModifier !== 1.0}
								<span class="chip-mod">
									{v.baseModifier > 1 ? `+${Math.round((v.baseModifier - 1) * 100)}%` : `${Math.round((v.baseModifier - 1) * 100)}%`}
								</span>
							{/if}
						</button>
					{/each}
				</div>
			</div>
		{/if}

		<div class="heading">
			<div class="flex items-center gap-1.5">
				<Wrench size={15} class="text-blue-600" />
				<h3>{uiLabels.serviceHeading}</h3>
			</div>
			<p>{uiLabels.serviceSubtitle}</p>
		</div>

		<div class="service-list">
			{#each services as s (s.id)}
				{@const price = Math.round(s.basePrice * (selectedVehicle?.baseModifier ?? 1.0))}
				<button
					type="button"
					class="service-card"
					class:selected={s.id === selectedServiceId}
					onclick={() => (selectedServiceId = s.id)}
				>
					<div class="s-main">
						<strong>{s.name}</strong>
						<span class="duration"><Clock size={12} /> {s.duration}</span>
					</div>
					<div class="s-price">
						<strong>{price} ₴</strong>
						{#if s.id === selectedServiceId}
							<span class="check-pill"><Check size={12} /></span>
						{/if}
					</div>
				</button>
			{/each}
		</div>

		<div class="selected-summary-bar">
			<div class="summary-text">
				<small>Обрана послуга:</small>
				<strong>{selectedService.name}</strong>
			</div>
			<div class="summary-price">
				<strong>{totalPrice} ₴</strong>
			</div>
		</div>

		<button type="button" class="btn-next" onclick={() => (step = 2)}>
			Обрати дату та час ({timeSlots.filter(t => t.available).length} слотів) <ChevronRight size={16} />
		</button>

	<!-- Step 2: Date & Time Calendar -->
	{:else if step === 2}
		<div class="heading">
			<div class="flex items-center gap-1.5">
				<Calendar size={15} class="text-emerald-600" />
				<h3>{uiLabels.scheduleHeading}</h3>
			</div>
			<p>{uiLabels.scheduleSubtitle}</p>
		</div>

		<!-- Календарний скрол днів -->
		<div class="days-strip">
			{#each days as d (d.iso)}
				<button
					type="button"
					class="day-chip"
					class:selected={d.iso === selectedDateIso}
					onclick={() => (selectedDateIso = d.iso)}
				>
					<span class="day-name">{d.dayName}</span>
					<strong class="day-date">{d.dateStr}</strong>
				</button>
			{/each}
		</div>

		<!-- Слоти часу -->
		<div class="slots-header">
			<Clock size={13} class="text-zinc-600" />
			<span>Вільний час на {days.find(d => d.iso === selectedDateIso)?.dayName ?? 'обрану дату'}:</span>
		</div>

		<div class="slots-grid">
			{#each timeSlots as slot (slot.time)}
				<button
					type="button"
					class="slot-chip"
					class:selected={slot.time === selectedTime}
					disabled={!slot.available}
					onclick={() => (selectedTime = slot.time)}
				>
					{slot.time}
				</button>
			{/each}
		</div>

		<div class="selected-summary-bar">
			<div class="summary-text">
				<small>Запис на:</small>
				<strong>{days.find(d => d.iso === selectedDateIso)?.dateStr} о {selectedTime}</strong>
			</div>
			<span class="badge-slot">Слот заброньовано</span>
		</div>

		<div class="flex gap-2">
			<button type="button" class="btn-back-half" onclick={() => (step = 1)}>
				&larr; Послуги
			</button>
			<button type="button" class="btn-next-half" onclick={() => (step = 3)}>
				Далі до оплати <ChevronRight size={16} />
			</button>
		</div>

	<!-- Step 3: Confirmation & Payment -->
	{:else if step === 3}
		<div class="heading">
			<div class="flex items-center gap-1.5">
				<ShieldCheck size={15} class="text-blue-600" />
				<h3>Підтвердження та завдаток</h3>
			</div>
			<p>Перевірте деталі запису та оберіть спосіб оплати.</p>
		</div>

		<!-- Резюме запису -->
		<div class="booking-summary-card">
			<div class="sum-row">
				<span>Послуга:</span>
				<strong>{selectedService.name}</strong>
			</div>
			<div class="sum-row">
				<span>Параметри:</span>
				<strong>{selectedVehicle.title}</strong>
			</div>
			<div class="sum-row">
				<span>Дата та час:</span>
				<strong>{days.find(d => d.iso === selectedDateIso)?.dateStr} о {selectedTime}</strong>
			</div>
			<div class="sum-row total">
				<span>Повна вартість робіт:</span>
				<strong>{totalPrice} ₴</strong>
			</div>
		</div>

		<!-- Введення контактів -->
		<div class="inputs-group">
			<label class="field">
				<span>{uiLabels.customFieldLabel}</span>
				<input type="text" bind:value={carPlate} placeholder={uiLabels.customFieldPlaceholder} />
			</label>
			<label class="field">
				<span>Номер телефону клієнта:</span>
				<input type="text" bind:value={clientPhone} placeholder="+380..." />
			</label>
		</div>

		<!-- Модель оплати -->
		<div class="payment-modes">
			<label class="mode-card" class:active={paymentMode === 'deposit'}>
				<input type="radio" name="pay_mode" value="deposit" bind:group={paymentMode} />
				<div class="mode-info">
					<strong>Фіксований завдаток (передоплата)</strong>
					<small>Бронює слот у системі. Решта ({Math.max(0, totalPrice - depositAmount)} ₴) на місці</small>
				</div>
				<span class="amount-badge">{depositAmount} ₴</span>
			</label>

			<label class="mode-card" class:active={paymentMode === 'full'}>
				<input type="radio" name="pay_mode" value="full" bind:group={paymentMode} />
				<div class="mode-info">
					<strong>Оплатити 100% онлайн</strong>
					<small>Повний розрахунок онлайн без готівки на місці</small>
				</div>
				<span class="amount-badge">{totalPrice} ₴</span>
			</label>
		</div>

		<button type="button" class="btn-pay" onclick={proceedToPay}>
			Забронювати за {paymentAmount} ₴
		</button>
	{/if}
</div>

<style>
	.booking-preview {
		padding: 12px 14px 20px;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	/* Step Nav Bar */
	.step-nav {
		display: grid;
		grid-template-columns: 1fr 1fr 1fr;
		gap: 6px;
		background: #f4f4f5;
		padding: 3px;
		border-radius: 10px;
	}
	.step-tab {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		padding: 7px 4px;
		font-size: 11px;
		font-weight: 700;
		color: #71717a;
		border-radius: 8px;
		border: none;
		background: transparent;
		cursor: pointer;
		transition: all 0.15s ease;
	}
	.step-tab.active {
		background: #ffffff;
		color: #18181b;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
	}
	.tab-badge {
		width: 16px;
		height: 16px;
		border-radius: 50%;
		background: #e4e4e7;
		color: #52525b;
		font-size: 10px;
		display: grid;
		place-items: center;
		font-weight: 800;
	}
	.step-tab.active .tab-badge {
		background: #2563eb;
		color: #ffffff;
	}

	/* Category Pills */
	.category-block {
		display: flex;
		flex-direction: column;
		gap: 5px;
	}
	.sub-label {
		font-size: 10px;
		font-weight: 700;
		color: #52525b;
	}
	.cat-pills {
		display: flex;
		gap: 6px;
		overflow-x: auto;
		padding-bottom: 2px;
	}
	.cat-chip {
		display: flex;
		align-items: center;
		gap: 5px;
		background: #ffffff;
		border: 1px solid #e4e4e7;
		border-radius: 8px;
		padding: 6px 10px;
		cursor: pointer;
		white-space: nowrap;
		font-size: 11px;
		font-weight: 600;
		color: #3f3f46;
		transition: all 0.15s;
	}
	.cat-chip.selected {
		border-color: #2563eb;
		background: #eff6ff;
		color: #1d4ed8;
	}
	.chip-mod {
		font-size: 9px;
		font-weight: 700;
		background: #dbeafe;
		color: #1e40af;
		padding: 1px 4px;
		border-radius: 4px;
	}

	.heading h3 {
		margin: 0;
		font-size: 13px;
		font-weight: 800;
		color: #18181b;
	}
	.heading p {
		margin: 2px 0 0;
		font-size: 11px;
		color: #71717a;
	}

	.service-list {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.service-card {
		display: flex;
		align-items: center;
		justify-content: space-between;
		background: #ffffff;
		border: 1px solid #e4e4e7;
		border-radius: 10px;
		padding: 9px 12px;
		cursor: pointer;
		text-align: left;
		transition: all 0.15s ease;
	}
	.service-card.selected {
		border-color: #2563eb;
		background: #eff6ff;
	}
	.s-main strong {
		display: block;
		font-size: 11px;
		color: #18181b;
	}
	.duration {
		display: inline-flex;
		align-items: center;
		gap: 3px;
		font-size: 10px;
		color: #71717a;
		margin-top: 1px;
	}
	.s-price {
		display: flex;
		align-items: center;
		gap: 6px;
	}
	.s-price strong {
		font-size: 12px;
		font-weight: 800;
		color: #18181b;
	}
	.check-pill {
		width: 18px;
		height: 18px;
		border-radius: 50%;
		background: #2563eb;
		color: #ffffff;
		display: grid;
		place-items: center;
	}

	.selected-summary-bar {
		background: #f4f4f5;
		border-radius: 8px;
		padding: 7px 10px;
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	.summary-text small {
		display: block;
		font-size: 9px;
		color: #71717a;
	}
	.summary-text strong {
		font-size: 11px;
		color: #18181b;
	}
	.summary-price strong {
		font-size: 13px;
		font-weight: 800;
		color: #2563eb;
	}
	.badge-slot {
		font-size: 10px;
		font-weight: 700;
		color: #15803d;
		background: #dcfce7;
		padding: 2px 6px;
		border-radius: 4px;
	}

	/* Days Strip */
	.days-strip {
		display: flex;
		gap: 5px;
		overflow-x: auto;
		padding-bottom: 2px;
	}
	.day-chip {
		flex: 1;
		min-width: 44px;
		display: flex;
		flex-direction: column;
		align-items: center;
		background: #ffffff;
		border: 1px solid #e4e4e7;
		border-radius: 8px;
		padding: 6px 2px;
		cursor: pointer;
	}
	.day-chip.selected {
		border-color: #2563eb;
		background: #eff6ff;
	}
	.day-name {
		font-size: 9px;
		color: #71717a;
	}
	.day-date {
		font-size: 11px;
		color: #18181b;
	}
	.day-chip.selected .day-date {
		color: #2563eb;
	}

	.slots-header {
		display: flex;
		align-items: center;
		gap: 4px;
		font-size: 10px;
		font-weight: 700;
		color: #52525b;
	}
	.slots-grid {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 5px;
	}
	.slot-chip {
		padding: 6px 2px;
		font-size: 11px;
		font-weight: 700;
		background: #ffffff;
		border: 1px solid #e4e4e7;
		border-radius: 6px;
		cursor: pointer;
		color: #18181b;
	}
	.slot-chip.selected {
		border-color: #2563eb;
		background: #2563eb;
		color: #ffffff;
	}
	.slot-chip:disabled {
		opacity: 0.4;
		text-decoration: line-through;
		cursor: not-allowed;
	}

	/* Summary Card */
	.booking-summary-card {
		background: #fafafa;
		border: 1px solid #e4e4e7;
		border-radius: 10px;
		padding: 9px 12px;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.sum-row {
		display: flex;
		justify-content: space-between;
		font-size: 11px;
		color: #52525b;
	}
	.sum-row.total {
		border-top: 1px solid #e4e4e7;
		padding-top: 4px;
		margin-top: 2px;
		font-weight: 800;
		color: #18181b;
	}

	.inputs-group {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.field {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.field span {
		font-size: 10px;
		font-weight: 700;
		color: #52525b;
	}
	.field input {
		background: #ffffff;
		border: 1px solid #d4d4d8;
		border-radius: 6px;
		padding: 6px 8px;
		font-size: 11px;
		outline: none;
	}

	.payment-modes {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.mode-card {
		display: flex;
		align-items: center;
		gap: 8px;
		background: #ffffff;
		border: 1px solid #e4e4e7;
		border-radius: 8px;
		padding: 8px 10px;
		cursor: pointer;
	}
	.mode-card.active {
		border-color: #2563eb;
		background: #eff6ff;
	}
	.mode-info {
		flex: 1;
		min-width: 0;
	}
	.mode-info strong {
		display: block;
		font-size: 11px;
		color: #18181b;
	}
	.mode-info small {
		font-size: 9px;
		color: #71717a;
	}
	.amount-badge {
		font-size: 12px;
		font-weight: 800;
		color: #2563eb;
	}

	/* Buttons */
	.btn-next,
	.btn-pay {
		width: 100%;
		background: #2563eb;
		color: #ffffff;
		border: none;
		border-radius: 10px;
		padding: 11px;
		font-size: 13px;
		font-weight: 700;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		box-shadow: 0 2px 6px rgba(37, 99, 235, 0.3);
	}
	.btn-back-half {
		flex: 1;
		background: #f4f4f5;
		color: #52525b;
		border: 1px solid #e4e4e7;
		border-radius: 10px;
		padding: 10px;
		font-size: 12px;
		font-weight: 700;
		cursor: pointer;
	}
	.btn-next-half {
		flex: 2;
		background: #2563eb;
		color: #ffffff;
		border: none;
		border-radius: 10px;
		padding: 10px;
		font-size: 12px;
		font-weight: 700;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 4px;
	}
</style>
