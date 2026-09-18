<script lang="ts">
	import {
		Calendar,
		Car,
		Check,
		ChevronRight,
		Clock,
		ShieldCheck,
		User,
		Wrench
	} from '@lucide/svelte';

	let {
		onPay,
		flowData = {}
	}: {
		onPay: (amount: number) => void;
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

	const defaultVehicleTypes: VehicleType[] = [
		{ id: 'sedan', title: 'Легкове авто', subtitle: 'Седан, хетчбек, купе', icon: '🚗', baseModifier: 1.0 },
		{ id: 'suv', title: 'Кросовер / SUV', subtitle: 'Позашляховик, паркетник', icon: '🚙', baseModifier: 1.25 },
		{ id: 'van', title: 'Мікроавтобус', subtitle: 'Бус, комерційний транспорт', icon: '🚐', baseModifier: 1.5 }
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
			// Симуляція пари зайнятих слотів для реалізму
			const available = !(count === 2 || count === 6);
			slots.push({ time: `${h}:${m}`, available });
			currentMinutes += stepMins;
			count++;
		}

		return slots.length > 0 ? slots : [
			{ time: '09:00', available: true },
			{ time: '10:30', available: true },
			{ time: '12:00', available: false },
			{ time: '14:00', available: true },
			{ time: '15:30', available: true }
		];
	});

	let step = $state<1 | 2 | 3 | 4>(1);
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
	<!-- Progress bar -->
	<div class="progress-steps" aria-label={`Крок ${step} з 4`}>
		{#each [1, 2, 3, 4] as s}
			<span class:active={s <= step} class:current={s === step}></span>
		{/each}
	</div>

	{#if step === 1}
		<div class="heading">
			<span class="step-badge">Крок 1 з 4</span>
			<h3>Оберіть тип авто</h3>
			<p>Впливає на вартість матеріалів та час роботи.</p>
		</div>

		<div class="vehicle-options">
			{#each vehicleTypes as v (v.id)}
				<button
					type="button"
					class="vehicle-card"
					class:selected={v.id === selectedVehicleId}
					onclick={() => (selectedVehicleId = v.id)}
				>
					<span class="v-icon">{v.icon}</span>
					<div class="v-info">
						<strong>{v.title}</strong>
						<small>{v.subtitle}</small>
					</div>
					{#if v.id === selectedVehicleId}
						<div class="check-circle"><Check size={14} /></div>
					{/if}
				</button>
			{/each}
		</div>

		<button type="button" class="btn-next" onclick={() => (step = 2)}>
			Обрати послугу <ChevronRight size={16} />
		</button>

	{:else if step === 2}
		<button type="button" class="btn-back" onclick={() => (step = 1)}>
			&larr; Змінити авто ({selectedVehicle.title})
		</button>

		<div class="heading">
			<span class="step-badge">Крок 2 з 4</span>
			<h3>Оберіть послугу СТО</h3>
			<p>Розраховано для {selectedVehicle.title.toLowerCase()}.</p>
		</div>

		<div class="service-list">
			{#each services as s (s.id)}
				{@const price = Math.round(s.basePrice * selectedVehicle.baseModifier)}
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

		<button type="button" class="btn-next" onclick={() => (step = 3)}>
			Обрати дату та час <ChevronRight size={16} />
		</button>

	{:else if step === 3}
		<button type="button" class="btn-back" onclick={() => (step = 2)}>
			&larr; Змінити послугу
		</button>

		<div class="heading">
			<span class="step-badge">Крок 3 з 4</span>
			<h3>Оберіть дату та час</h3>
			<p>Вільні слоти на шиномонтажному боксі.</p>
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
		<span class="slots-label"><Clock size={13} /> Доступні слоти:</span>
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

		<button type="button" class="btn-next" onclick={() => (step = 4)}>
			Вказати контакти <ChevronRight size={16} />
		</button>

	{:else if step === 4}
		<button type="button" class="btn-back" onclick={() => (step = 3)}>
			&larr; Змінити час ({selectedTime})
		</button>

		<div class="heading">
			<span class="step-badge">Крок 4 з 4</span>
			<h3>Підтвердження запису</h3>
			<p>Перевірте дані та оберіть варіант оплати.</p>
		</div>

		<!-- Резюме запису -->
		<div class="summary-card">
			<div class="sum-row">
				<span>Послуга:</span>
				<strong>{selectedService.name}</strong>
			</div>
			<div class="sum-row">
				<span>Авто:</span>
				<strong>{selectedVehicle.title}</strong>
			</div>
			<div class="sum-row">
				<span>Час запису:</span>
				<strong class="highlight">{days.find((d) => d.iso === selectedDateIso)?.dayName}, {selectedTime}</strong>
			</div>
			<div class="sum-row total">
				<span>Загальна сума робіт:</span>
				<strong class="price">{totalPrice} ₴</strong>
			</div>
		</div>

		<!-- Введення контактів -->
		<div class="inputs-group">
			<label class="field">
				<span>Номерний знак авто:</span>
				<input type="text" bind:value={carPlate} placeholder="КА 0000 АА" />
			</label>
			<label class="field">
				<span>Номер телефону клієнта:</span>
				<input type="tel" bind:value={clientPhone} placeholder="+380" />
			</label>
		</div>

		<!-- Варіант оплати: Завдаток чи Вся сума -->
		<div class="payment-mode-selector">
			<label class="mode-card" class:active={paymentMode === 'deposit'}>
				<input type="radio" name="pay_mode" value="deposit" bind:group={paymentMode} />
				<div>
					<strong>Завдаток (передоплата)</strong>
					<small>Бронює слот. Решта ({totalPrice - depositAmount} ₴) на СТО</small>
				</div>
				<span class="amount-badge">200 ₴</span>
			</label>

			<label class="mode-card" class:active={paymentMode === 'full'}>
				<input type="radio" name="pay_mode" value="full" bind:group={paymentMode} />
				<div>
					<strong>Оплатити повністю</strong>
					<small>Швидкий виїзд без розрахунку на місці</small>
				</div>
				<span class="amount-badge">{totalPrice} ₴</span>
			</label>
		</div>

		<button type="button" class="btn-pay" onclick={proceedToPay}>
			<span>Сплатити {paymentAmount} ₴</span>
			<ShieldCheck size={18} />
		</button>
	{/if}
</div>

<style>
	.booking-preview {
		display: flex;
		flex-direction: column;
		gap: 16px;
		color: #f4f4f5;
	}

	.progress-steps {
		display: flex;
		gap: 6px;
	}
	.progress-steps span {
		flex: 1;
		height: 4px;
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.12);
		transition: all 0.3s;
	}
	.progress-steps span.active {
		background: #2563eb;
	}
	.progress-steps span.current {
		background: #60a5fa;
		box-shadow: 0 0 8px rgba(96, 165, 250, 0.5);
	}

	.heading {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.step-badge {
		font-size: 11px;
		font-weight: 700;
		color: #60a5fa;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}
	.heading h3 {
		font-size: 17px;
		font-weight: 700;
		color: #ffffff;
		margin: 0;
	}
	.heading p {
		font-size: 12px;
		color: #a1a1aa;
		margin: 0;
	}

	.btn-back {
		align-self: flex-start;
		background: transparent;
		border: none;
		color: #a1a1aa;
		font-size: 12px;
		font-weight: 600;
		cursor: pointer;
		padding: 0;
		transition: color 0.2s;
	}
	.btn-back:hover {
		color: #ffffff;
	}

	/* Vehicle Cards */
	.vehicle-options {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.vehicle-card {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 12px 14px;
		border-radius: 12px;
		background: rgba(255, 255, 255, 0.04);
		border: 1px solid rgba(255, 255, 255, 0.08);
		cursor: pointer;
		text-align: left;
		transition: all 0.2s;
		color: #f4f4f5;
	}
	.vehicle-card:hover {
		background: rgba(255, 255, 255, 0.07);
	}
	.vehicle-card.selected {
		background: rgba(37, 99, 235, 0.15);
		border-color: #3b82f6;
	}
	.v-icon {
		font-size: 24px;
	}
	.v-info {
		flex: 1;
		display: flex;
		flex-direction: column;
	}
	.v-info strong {
		font-size: 14px;
		color: #ffffff;
	}
	.v-info small {
		font-size: 11px;
		color: #a1a1aa;
	}
	.check-circle {
		width: 22px;
		height: 22px;
		border-radius: 50%;
		background: #2563eb;
		color: white;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	/* Services */
	.service-list {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.service-card {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 12px 14px;
		border-radius: 12px;
		background: rgba(255, 255, 255, 0.04);
		border: 1px solid rgba(255, 255, 255, 0.08);
		cursor: pointer;
		text-align: left;
		transition: all 0.2s;
		color: #f4f4f5;
	}
	.service-card:hover {
		background: rgba(255, 255, 255, 0.07);
	}
	.service-card.selected {
		background: rgba(37, 99, 235, 0.15);
		border-color: #3b82f6;
	}
	.s-main {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.s-main strong {
		font-size: 13px;
		color: #ffffff;
	}
	.duration {
		display: flex;
		align-items: center;
		gap: 4px;
		font-size: 11px;
		color: #a1a1aa;
	}
	.s-price {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.s-price strong {
		font-size: 14px;
		color: #60a5fa;
	}
	.check-pill {
		width: 18px;
		height: 18px;
		border-radius: 50%;
		background: #2563eb;
		color: white;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	/* Days Strip */
	.days-strip {
		display: flex;
		gap: 8px;
		overflow-x: auto;
		padding-bottom: 6px;
		scrollbar-width: thin;
	}
	.day-chip {
		flex: 0 0 68px;
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 8px 6px;
		border-radius: 10px;
		background: rgba(255, 255, 255, 0.04);
		border: 1px solid rgba(255, 255, 255, 0.08);
		cursor: pointer;
		transition: all 0.2s;
		color: #f4f4f5;
	}
	.day-chip:hover {
		background: rgba(255, 255, 255, 0.08);
	}
	.day-chip.selected {
		background: #2563eb;
		border-color: #3b82f6;
		color: white;
	}
	.day-name {
		font-size: 10px;
		text-transform: uppercase;
		opacity: 0.8;
	}
	.day-date {
		font-size: 12px;
		margin-top: 2px;
	}

	/* Slots Grid */
	.slots-label {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 12px;
		font-weight: 600;
		color: #a1a1aa;
		margin-top: 4px;
	}
	.slots-grid {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 6px;
	}
	.slot-chip {
		padding: 9px 4px;
		border-radius: 8px;
		background: rgba(255, 255, 255, 0.04);
		border: 1px solid rgba(255, 255, 255, 0.08);
		color: #ffffff;
		font-size: 13px;
		font-weight: 600;
		cursor: pointer;
		text-align: center;
		transition: all 0.2s;
	}
	.slot-chip:hover:not(:disabled) {
		background: rgba(255, 255, 255, 0.1);
	}
	.slot-chip.selected {
		background: #2563eb;
		border-color: #3b82f6;
		box-shadow: 0 0 10px rgba(37, 99, 235, 0.4);
	}
	.slot-chip:disabled {
		opacity: 0.25;
		cursor: not-allowed;
		text-decoration: line-through;
	}

	/* Summary Card */
	.summary-card {
		background: rgba(255, 255, 255, 0.03);
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 12px;
		padding: 12px 14px;
		display: flex;
		flex-direction: column;
		gap: 8px;
		font-size: 12px;
	}
	.sum-row {
		display: flex;
		justify-content: space-between;
		color: #a1a1aa;
	}
	.sum-row strong {
		color: #f4f4f5;
	}
	.sum-row .highlight {
		color: #60a5fa;
	}
	.sum-row.total {
		margin-top: 4px;
		padding-top: 8px;
		border-top: 1px solid rgba(255, 255, 255, 0.08);
		font-size: 13px;
	}
	.sum-row.total .price {
		font-size: 15px;
		color: #34d399;
	}

	/* Inputs */
	.inputs-group {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.field {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.field span {
		font-size: 11px;
		color: #a1a1aa;
		font-weight: 500;
	}
	.field input {
		width: 100%;
		box-sizing: border-box;
		background: rgba(0, 0, 0, 0.25);
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 8px;
		padding: 8px 10px;
		color: #ffffff;
		font-size: 13px;
		outline: none;
		transition: border-color 0.2s;
	}
	.field input:focus {
		border-color: #3b82f6;
	}

	/* Payment Mode Selector */
	.payment-mode-selector {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.mode-card {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 10px 12px;
		border-radius: 10px;
		background: rgba(255, 255, 255, 0.03);
		border: 1px solid rgba(255, 255, 255, 0.08);
		cursor: pointer;
		transition: all 0.2s;
	}
	.mode-card.active {
		border-color: #3b82f6;
		background: rgba(37, 99, 235, 0.12);
	}
	.mode-card input {
		accent-color: #2563eb;
	}
	.mode-card div {
		flex: 1;
		display: flex;
		flex-direction: column;
	}
	.mode-card strong {
		font-size: 12px;
		color: #ffffff;
	}
	.mode-card small {
		font-size: 10px;
		color: #a1a1aa;
	}
	.amount-badge {
		font-size: 13px;
		font-weight: 700;
		color: #60a5fa;
	}

	/* Buttons */
	.btn-next,
	.btn-pay {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		width: 100%;
		padding: 12px;
		border-radius: 10px;
		background: #2563eb;
		color: white;
		font-size: 14px;
		font-weight: 700;
		border: none;
		cursor: pointer;
		transition: background 0.2s, transform 0.1s;
		margin-top: 4px;
	}
	.btn-next:hover,
	.btn-pay:hover {
		background: #1d4ed8;
	}
	.btn-next:active,
	.btn-pay:active {
		transform: scale(0.98);
	}
	.btn-pay {
		background: linear-gradient(135deg, #059669, #10b981);
	}
	.btn-pay:hover {
		background: linear-gradient(135deg, #047857, #059669);
	}
</style>
