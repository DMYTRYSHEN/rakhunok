<script lang="ts">
	import {
		Film,
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
		Sparkles
	} from '@lucide/svelte';
	import type {
		EventsFlowData,
		EventSession,
		EventHall,
		EventSeat
	} from '$lib/features/shared/checkout-scenario-config';
	import {
		calculateEventsOrderPrice,
		pruneEventsSelections,
		type EventsOrderSelections,
		type SelectedSeatItem,
		type OpenZoneSelection
	} from '$lib/features/shared/events-pricing';

	let {
		flowData = {},
		onPay
	}: {
		flowData?: Partial<EventsFlowData>;
		onPay: (amount: number) => void;
	} = $props();

	const defaultData: EventsFlowData = {
		venueName: 'Кіноконцертний комплекс «Олімп»',
		address: 'м. Київ, вул. Велика Васильківська, 55',
		description: 'Сучасні кінозали з лазерною проекцією та концертний хол з акустикою Meyer Sound',
		contacts: {
			phone: '+380 44 222 11 00',
			telegram: '@olymp_tickets_bot',
			email: 'tickets@olymp.kiev.ua'
		},
		serviceFeePerTicket: 20,
		reservationHoldMinutes: 10,
		maxTicketsPerOrder: 6,
		allowCashierMode: true,
		allowRefunds: true,
		refundNotice: 'Повернення можливе не пізніше ніж за 2 години до початку сеансу',
		sessions: [
			{
				id: 'sess_1',
				eventTitle: 'Дюна: Частина Друга (Laser)',
				format: '2D Laser',
				language: 'Український дубляж',
				hallId: 'hall_1',
				date: '2026-09-22',
				time: '19:30',
				durationMinutes: 165,
				ageRating: '16+'
			},
			{
				id: 'sess_2',
				eventTitle: 'Симфонія Всесвіту — Hans Zimmer Tribute',
				format: 'Live Concert',
				language: 'Живе виконання',
				hallId: 'hall_1',
				date: '2026-09-23',
				time: '20:00',
				durationMinutes: 120,
				ageRating: '12+'
			},
			{
				id: 'sess_3',
				eventTitle: 'Indie Wave Festival 2026',
				format: 'Open Air Festival',
				language: 'Live Sound',
				hallId: 'hall_2',
				date: '2026-09-26',
				time: '18:00',
				durationMinutes: 240,
				ageRating: '16+'
			}
		],
		halls: [
			{
				id: 'hall_1',
				name: 'Зал 1 — Premier Screen',
				type: 'seated',
				screenOrStageLabel: '🎬 ЕКРАН',
				rowsCount: 5,
				seatsPerRow: 8,
				capacity: 40,
				categories: [
					{
						id: 'cat_standard',
						name: 'Стандартне місце',
						price: 250,
						color: '#007aff',
						description: 'Зручні крісла, ряди 1–3'
					},
					{
						id: 'cat_premium',
						name: 'Преміальне місце',
						price: 350,
						color: '#ff9500',
						description: 'Шкіряні реклайнери, ряди 4–5'
					}
				],
				seats: [
					// Row 1 (Standard)
					{ id: 'R1-S1', row: 1, seat: 1, categoryId: 'cat_standard', status: 'available' },
					{ id: 'R1-S2', row: 1, seat: 2, categoryId: 'cat_standard', status: 'available' },
					{ id: 'R1-S3', row: 1, seat: 3, categoryId: 'cat_standard', status: 'available' },
					{ id: 'R1-S4', row: 1, seat: 4, categoryId: 'cat_standard', status: 'available' },
					{ id: 'R1-S5', row: 1, seat: 5, categoryId: 'cat_standard', status: 'available' },
					{ id: 'R1-S6', row: 1, seat: 6, categoryId: 'cat_standard', status: 'sold' },
					{ id: 'R1-S7', row: 1, seat: 7, categoryId: 'cat_standard', status: 'sold' },
					{ id: 'R1-S8', row: 1, seat: 8, categoryId: 'cat_standard', status: 'available' },
					// Row 2 (Standard)
					{ id: 'R2-S1', row: 2, seat: 1, categoryId: 'cat_standard', status: 'available' },
					{ id: 'R2-S2', row: 2, seat: 2, categoryId: 'cat_standard', status: 'available' },
					{ id: 'R2-S3', row: 2, seat: 3, categoryId: 'cat_standard', status: 'available' },
					{ id: 'R2-S4', row: 2, seat: 4, categoryId: 'cat_standard', status: 'available' },
					{ id: 'R2-S5', row: 2, seat: 5, categoryId: 'cat_standard', status: 'available' },
					{ id: 'R2-S6', row: 2, seat: 6, categoryId: 'cat_standard', status: 'available' },
					{ id: 'R2-S7', row: 2, seat: 7, categoryId: 'cat_standard', status: 'available' },
					{ id: 'R2-S8', row: 2, seat: 8, categoryId: 'cat_standard', status: 'available' },
					// Row 3 (Standard)
					{ id: 'R3-S1', row: 3, seat: 1, categoryId: 'cat_standard', status: 'available' },
					{ id: 'R3-S2', row: 3, seat: 2, categoryId: 'cat_standard', status: 'available' },
					{ id: 'R3-S3', row: 3, seat: 3, categoryId: 'cat_standard', status: 'available' },
					{ id: 'R3-S4', row: 3, seat: 4, categoryId: 'cat_standard', status: 'available' },
					{ id: 'R3-S5', row: 3, seat: 5, categoryId: 'cat_standard', status: 'available' },
					{ id: 'R3-S6', row: 3, seat: 6, categoryId: 'cat_standard', status: 'available' },
					{ id: 'R3-S7', row: 3, seat: 7, categoryId: 'cat_standard', status: 'available' },
					{ id: 'R3-S8', row: 3, seat: 8, categoryId: 'cat_standard', status: 'available' },
					// Row 4 (Premium)
					{ id: 'R4-S1', row: 4, seat: 1, categoryId: 'cat_premium', status: 'available' },
					{ id: 'R4-S2', row: 4, seat: 2, categoryId: 'cat_premium', status: 'available' },
					{ id: 'R4-S3', row: 4, seat: 3, categoryId: 'cat_premium', status: 'available' },
					{ id: 'R4-S4', row: 4, seat: 4, categoryId: 'cat_premium', status: 'sold' },
					{ id: 'R4-S5', row: 4, seat: 5, categoryId: 'cat_premium', status: 'sold' },
					{ id: 'R4-S6', row: 4, seat: 6, categoryId: 'cat_premium', status: 'available' },
					{ id: 'R4-S7', row: 4, seat: 7, categoryId: 'cat_premium', status: 'available' },
					{ id: 'R4-S8', row: 4, seat: 8, categoryId: 'cat_premium', status: 'available' },
					// Row 5 (Premium)
					{ id: 'R5-S1', row: 5, seat: 1, categoryId: 'cat_premium', status: 'available' },
					{ id: 'R5-S2', row: 5, seat: 2, categoryId: 'cat_premium', status: 'available' },
					{ id: 'R5-S3', row: 5, seat: 3, categoryId: 'cat_premium', status: 'available' },
					{ id: 'R5-S4', row: 5, seat: 4, categoryId: 'cat_premium', status: 'available' },
					{ id: 'R5-S5', row: 5, seat: 5, categoryId: 'cat_premium', status: 'available' },
					{ id: 'R5-S6', row: 5, seat: 6, categoryId: 'cat_premium', status: 'available' },
					{ id: 'R5-S7', row: 5, seat: 7, categoryId: 'cat_premium', status: 'available' },
					{ id: 'R5-S8', row: 5, seat: 8, categoryId: 'cat_premium', status: 'available' }
				]
			},
			{
				id: 'hall_2',
				name: 'Фестивальний майданчик Open Space',
				type: 'open_zone',
				screenOrStageLabel: '🎸 ГОЛОВНА СЦЕНА',
				capacity: 500,
				categories: [
					{
						id: 'cat_fan1',
						name: 'Фан-зона 1 (біля сцени)',
						price: 500,
						color: '#ef4444',
						description: 'Максимальна близькість до артистів'
					},
					{
						id: 'cat_fan2',
						name: 'Фан-зона 2 (загальна)',
						price: 350,
						color: '#3b82f6',
						description: 'Вільний простір фестивалю'
					},
					{
						id: 'cat_vip',
						name: 'VIP Lounge Lounge Bar',
						price: 900,
						color: '#8b5cf6',
						description: 'Окремий бар, посадочні пуфи та веранда'
					}
				]
			}
		],
		approval: {
			autoApprovalEnabled: true,
			requireManualForGroupBooking: true,
			groupBookingMinSeats: 6,
			telegramChat: '@olymp_tickets_bot'
		}
	};

	let mergedData = $derived<EventsFlowData>({
		...defaultData,
		...flowData,
		contacts: { ...defaultData.contacts, ...(flowData?.contacts || {}) },
		sessions: flowData?.sessions && flowData.sessions.length > 0 ? flowData.sessions : defaultData.sessions,
		halls: flowData?.halls && flowData.halls.length > 0 ? flowData.halls : defaultData.halls,
		approval: { ...defaultData.approval, ...(flowData?.approval || {}) }
	});

	let step = $state<1 | 2 | 3>(1);

	// Default selections: 2 standard seats + 1 premium seat = exactly 910 ₴ (850 ₴ tickets + 60 ₴ service fee)
	let selections = $state<EventsOrderSelections>({
		sessionId: 'sess_1',
		mode: 'seat_map',
		selectedSeats: [
			{
				seatId: 'R2-S4',
				row: 2,
				seat: 4,
				categoryId: 'cat_standard',
				categoryName: 'Стандартне місце',
				price: 250
			},
			{
				seatId: 'R2-S5',
				row: 2,
				seat: 5,
				categoryId: 'cat_standard',
				categoryName: 'Стандартне місце',
				price: 250
			},
			{
				seatId: 'R4-S3',
				row: 4,
				seat: 3,
				categoryId: 'cat_premium',
				categoryName: 'Преміальне місце',
				price: 350
			}
		],
		openZoneSelections: [
			{ categoryId: 'cat_fan1', categoryName: 'Фан-зона 1', price: 500, quantity: 0 },
			{ categoryId: 'cat_fan2', categoryName: 'Фан-зона 2', price: 350, quantity: 2 },
			{ categoryId: 'cat_vip', categoryName: 'VIP Lounge', price: 900, quantity: 0 }
		],
		buyerName: 'Олександр Коваленко',
		buyerEmail: 'o.kovalenko@example.com',
		buyerPhone: '+380 67 123 45 67'
	});

	let activeSession = $derived<EventSession>(
		mergedData.sessions.find((s) => s.id === selections.sessionId) || mergedData.sessions[0]
	);

	let activeHall = $derived<EventHall>(
		mergedData.halls.find((h) => h.id === activeSession?.hallId) || mergedData.halls[0]
	);

	// Sync mode when hall type changes
	$effect(() => {
		if (activeHall.type === 'open_zone' && selections.mode !== 'open_zone') {
			selections.mode = 'open_zone';
		} else if (activeHall.type === 'seated' && selections.mode !== 'seat_map') {
			selections.mode = 'seat_map';
		}
	});

	let prunedSelections = $derived(pruneEventsSelections(mergedData, selections));
	let priceResult = $derived(calculateEventsOrderPrice(mergedData, prunedSelections));

	// Timer state: 10 minutes reservation
	let secondsLeft = $state(594); // 9m 54s
	$effect(() => {
		const timer = setInterval(() => {
			if (secondsLeft > 0) secondsLeft--;
		}, 1000);
		return () => clearInterval(timer);
	});

	let formattedTime = $derived(() => {
		const m = Math.floor(secondsLeft / 60).toString().padStart(2, '0');
		const s = (secondsLeft % 60).toString().padStart(2, '0');
		return `${m}:${s}`;
	});

	// Inspection simulator state (tickets used/scanned on entry)
	let showTicketPasses = $state(false);
	let usedTicketCodes = $state<Set<string>>(new Set());
	let scanMessage = $state<string | null>(null);

	function toggleSeat(seat: EventSeat) {
		if (seat.status === 'sold' || seat.status === 'disabled') return;

		const current = [...selections.selectedSeats];
		const idx = current.findIndex((s) => s.seatId === seat.id);

		if (idx >= 0) {
			current.splice(idx, 1);
		} else {
			if (current.length >= (mergedData.maxTicketsPerOrder || 6)) {
				alert(`Максимально дозволено не більше ${mergedData.maxTicketsPerOrder} квитків в одному замовленні.`);
				return;
			}
			const cat = activeHall.categories?.find((c) => c.id === seat.categoryId);
			current.push({
				seatId: seat.id,
				row: seat.row,
				seat: seat.seat,
				categoryId: seat.categoryId,
				categoryName: cat?.name || 'Місце',
				price: cat?.price || 250
			});
		}
		selections.selectedSeats = current;
	}

	function handleOpenZoneQty(catId: string, delta: number) {
		const current = [...(selections.openZoneSelections || [])];
		const idx = current.findIndex((z) => z.categoryId === catId);
		const cat = activeHall.categories?.find((c) => c.id === catId);
		if (!cat) return;

		const totalCount = current.reduce((sum, z) => sum + z.quantity, 0);
		if (delta > 0 && totalCount >= (mergedData.maxTicketsPerOrder || 6)) {
			alert(`Максимально дозволено не більше ${mergedData.maxTicketsPerOrder} квитків.`);
			return;
		}

		if (idx >= 0) {
			current[idx].quantity = Math.max(0, current[idx].quantity + delta);
		} else if (delta > 0) {
			current.push({
				categoryId: cat.id,
				categoryName: cat.name,
				price: cat.price,
				quantity: 1
			});
		}
		selections.openZoneSelections = current;
	}

	function handleSessionChange(sessId: string) {
		selections.sessionId = sessId;
		selections.selectedSeats = [];
		selections.openZoneSelections = [];
	}

	function handlePayClick() {
		onPay(priceResult.totalAmount);
		showTicketPasses = true;
	}

	function simulateScan(code: string) {
		if (usedTicketCodes.has(code)) {
			scanMessage = `❌ КВИТОК ${code} ВЖЕ БУВ ПОГАШЕНИЙ РАНІШЕ! ПОВТОРНИЙ ВХІД ЗАБОРОНЕНО.`;
		} else {
			const updated = new Set(usedTicketCodes);
			updated.add(code);
			usedTicketCodes = updated;
			scanMessage = `✅ ВХІД ДОЗВОЛЕНО! Квиток ${code} успішно погашено на турнікеті.`;
		}
	}
</script>

<div class="ios-preview-container">
	<!-- iOS Navigation Bar -->
	<header class="ios-nav-bar">
		<div class="ios-nav-content">
			<span class="ios-merchant-badge">🎬 {mergedData.venueName}</span>
			<span class="ios-secure-tag"><ShieldCheck size={12} /> Квиткова каса</span>
		</div>
	</header>

	<!-- Step Header & Progress Capsules -->
	<div class="ios-step-indicator">
		<div class="ios-capsules">
			<div class="ios-capsule" class:filled={step >= 1}></div>
			<div class="ios-capsule" class:filled={step >= 2}></div>
			<div class="ios-capsule" class:filled={step >= 3}></div>
		</div>
		<div class="ios-step-title-wrap">
			<span class="ios-step-sub">Крок {step} з 3</span>
			<h4 class="ios-step-title">
				{#if step === 1}
					Подія, сеанс та зал
				{:else if step === 2}
					Схема залу та вибір місць
				{:else if step === 3}
					Оплата та електронні квитки
				{/if}
			</h4>
		</div>
	</div>

	<div class="ios-window-body">
		<!-- WINDOW 1: EVENT, SESSION & HALL SELECTION -->
		{#if step === 1}
			<!-- Sessions Inset Card -->
			<div class="ios-card">
				<span class="ios-card-title">Оберіть подію та сеанс:</span>
				<div class="ios-items-stack">
					{#each mergedData.sessions as sess (sess.id)}
						<button
							type="button"
							class="ios-session-row"
							class:selected={selections.sessionId === sess.id}
							onclick={() => handleSessionChange(sess.id)}
						>
							<div class="ios-sess-main">
								<div class="ios-sess-title">{sess.eventTitle}</div>
								<div class="ios-sess-tags">
									<span class="ios-badge-format">{sess.format}</span>
									<span class="ios-badge-age">{sess.ageRating}</span>
									<span class="ios-sess-hall">{mergedData.halls.find(h => h.id === sess.hallId)?.name}</span>
								</div>
							</div>
							<div class="ios-sess-timing">
								<strong class="ios-sess-time">{sess.time}</strong>
								<span class="ios-sess-date">{sess.date}</span>
							</div>
						</button>
					{/each}
				</div>
			</div>

			<!-- Venue Info Card -->
			<div class="ios-card">
				<span class="ios-card-title">Локація та правила відвідування:</span>
				<div class="ios-venue-info">
					<div class="ios-info-row">
						<MapPin size={15} class="text-blue-500 shrink-0" />
						<span>{mergedData.address}</span>
					</div>
					<div class="ios-info-row">
						<Clock size={15} class="text-zinc-400 shrink-0" />
						<span>Тривалість сеансу: {activeSession.durationMinutes} хв ({activeSession.language})</span>
					</div>
					<div class="ios-info-row">
						<ShieldCheck size={15} class="text-emerald-500 shrink-0" />
						<span>{mergedData.refundNotice}</span>
					</div>
				</div>
			</div>

		<!-- WINDOW 2: SEAT MATRIX & RESERVATION TIMER -->
		{:else if step === 2}
			<!-- Reservation Timer Alert -->
			<div class="ios-timer-pill">
				<Clock size={14} />
				<span>Місця зарезервовано на <strong>{formattedTime()} хв</strong></span>
			</div>

			<!-- Hall Seating Card -->
			{#if activeHall.type === 'seated'}
				<div class="ios-card ios-hall-card">
					<!-- Curved Screen Bar -->
					<div class="ios-screen-arc">
						<span>{activeHall.screenOrStageLabel || '🎬 ЕКРАН'}</span>
					</div>

					<!-- Seat Matrix -->
					<div class="ios-seat-grid">
						{#each Array(activeHall.rowsCount || 5) as _, rIdx}
							{@const rowNum = rIdx + 1}
							<div class="ios-grid-row">
								<span class="ios-row-label">{rowNum}</span>
								<div class="ios-seats-lane">
									{#each (activeHall.seats?.filter(s => s.row === rowNum) || []) as seat (seat.id)}
										{@const isSelected = selections.selectedSeats.some(s => s.seatId === seat.id)}
										{@const isStandard = seat.categoryId === 'cat_standard'}
										<button
											type="button"
											class="ios-seat-dot"
											class:selected={isSelected}
											class:sold={seat.status === 'sold'}
											class:standard={isStandard && !isSelected && seat.status !== 'sold'}
											class:premium={!isStandard && !isSelected && seat.status !== 'sold'}
											disabled={seat.status === 'sold'}
											onclick={() => toggleSeat(seat)}
											aria-label="Ряд {seat.row}, місце {seat.seat}"
										>
											{#if isSelected}
												<Check size={10} strokeWidth={3} />
											{:else if seat.status === 'sold'}
												×
											{:else}
												{seat.seat}
											{/if}
										</button>
									{/each}
								</div>
								<span class="ios-row-label">{rowNum}</span>
							</div>
						{/each}
					</div>

					<!-- Legend -->
					<div class="ios-legend-row">
						<div class="ios-legend-item">
							<span class="ios-leg-dot standard"></span>
							<span>Стандарт (250 ₴)</span>
						</div>
						<div class="ios-legend-item">
							<span class="ios-leg-dot premium"></span>
							<span>Преміум (350 ₴)</span>
						</div>
						<div class="ios-legend-item">
							<span class="ios-leg-dot selected"></span>
							<span>Обрано</span>
						</div>
						<div class="ios-legend-item">
							<span class="ios-leg-dot sold"></span>
							<span>Зайнято</span>
						</div>
					</div>
				</div>
			{:else}
				<!-- Open Fan Zone -->
				<div class="ios-card">
					<span class="ios-card-title">Квитки у вільні фан-зони:</span>
					<div class="ios-items-stack">
						{#each activeHall.categories as cat (cat.id)}
							{@const currentQty = selections.openZoneSelections?.find(z => z.categoryId === cat.id)?.quantity || 0}
							<div class="ios-fan-card">
								<div>
									<strong class="ios-fan-name" style="border-left-color: {cat.color}">{cat.name}</strong>
									<p class="ios-fan-desc">{cat.description}</p>
									<span class="ios-fan-price">{cat.price} ₴</span>
								</div>
								<div class="ios-stepper">
									<button
										type="button"
										class="ios-stepper-btn"
										disabled={currentQty <= 0}
										onclick={() => handleOpenZoneQty(cat.id, -1)}
									>
										-
									</button>
									<span class="ios-stepper-val">{currentQty}</span>
									<button
										type="button"
										class="ios-stepper-btn"
										onclick={() => handleOpenZoneQty(cat.id, 1)}
									>
										+
									</button>
								</div>
							</div>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Selected Tickets Counter Card -->
			<div class="ios-card ios-card-stepper">
				<div>
					<span class="ios-card-title mb-0">Обрано квитків:</span>
					<span class="ios-card-sub">{priceResult.issuedTickets.length} шт (максимум {mergedData.maxTicketsPerOrder || 6})</span>
				</div>
				<strong class="text-blue-600 font-bold text-sm">{priceResult.baseTicketsAmount} ₴</strong>
			</div>

		<!-- WINDOW 3: PAYMENT, BREAKDOWN & ELECTRONIC TICKETS -->
		{:else if step === 3}
			<!-- Buyer Contacts Card -->
			<div class="ios-card">
				<span class="ios-card-title">Отримувач електронних квитків:</span>
				<div class="ios-form-stack">
					<label>
						<span class="ios-input-lbl">Ім'я та прізвище:</span>
						<input
							type="text"
							class="ios-input"
							bind:value={selections.buyerName}
							placeholder="Олександр Коваленко"
						/>
					</label>
					<div class="ios-grid-2">
						<label>
							<span class="ios-input-lbl">Email (для надсилання PDF):</span>
							<input
								type="email"
								class="ios-input"
								bind:value={selections.buyerEmail}
								placeholder="example@mail.com"
							/>
						</label>
						<label>
							<span class="ios-input-lbl">Телефон (SMS / Viber):</span>
							<input
								type="tel"
								class="ios-input"
								bind:value={selections.buyerPhone}
								placeholder="+380..."
							/>
						</label>
					</div>
				</div>
			</div>

			<!-- Apple Wallet Pass Style Ticket Receipt -->
			<div class="ios-pass-card">
				<div class="ios-pass-head">
					<div>
						<span class="ios-pass-tag">Електронні квитки</span>
						<h5 class="ios-pass-title">{activeSession.eventTitle}</h5>
					</div>
					<span class="ios-pass-badge">🎬 {activeSession.format}</span>
				</div>

				<div class="ios-pass-body">
					{#each priceResult.breakdown as line}
						<div class="ios-pass-row">
							<span class="ios-pass-lbl">{line.label}</span>
							<strong class="ios-pass-val">{line.amount} ₴</strong>
						</div>
					{/each}
				</div>

				<div class="ios-pass-cut">
					<div class="ios-cut-left"></div>
					<div class="ios-cut-line"></div>
					<div class="ios-cut-right"></div>
				</div>

				<div class="ios-pass-footer">
					<div class="ios-pass-total-row">
						<div>
							<span>Разом до сплати:</span>
							<span class="ios-fee-note">Включаючи сервісний збір {priceResult.totalServiceFee} ₴</span>
						</div>
						<strong class="ios-total-sum">{priceResult.totalAmount} ₴</strong>
					</div>
				</div>
			</div>

			<!-- E-Tickets Section with QR & Entrance Simulator -->
			<div class="ios-card">
				<div class="ios-card-head mb-2">
					<span class="ios-card-title mb-0">🎟️ Ваші електронні квитки ({priceResult.issuedTickets.length} шт):</span>
					<button
						type="button"
						class="text-[11px] font-semibold text-blue-600"
						onclick={() => (showTicketPasses = !showTicketPasses)}
					>
						{showTicketPasses ? 'Згорнути' : 'Показати QR'}
					</button>
				</div>

				{#if scanMessage}
					<div class="ios-scan-alert" class:allowed={scanMessage.includes('ДОЗВОЛЕНО')}>
						{scanMessage}
					</div>
				{/if}

				{#if showTicketPasses}
					<div class="ios-tickets-list">
						{#each priceResult.issuedTickets as tck}
							{@const isUsed = usedTicketCodes.has(tck.ticketCode)}
							<div class="ios-ticket-pass" class:used={isUsed}>
								<div class="ios-tck-top">
									<strong class="ios-tck-code">{tck.ticketCode}</strong>
									<span class="ios-tck-status" class:status-used={isUsed}>
										{isUsed ? '❌ ПОГАШЕНО' : '✅ ДІЙСНИЙ'}
									</span>
								</div>
								<div class="ios-tck-meta">
									<span>{tck.seatLabel} ({tck.categoryName})</span>
									<span>{tck.hallName}</span>
								</div>
								<div class="ios-tck-qr-row">
									<div class="ios-qr-box">
										<QrCode size={40} />
									</div>
									<div class="ios-qr-action">
										<span class="ios-qr-desc">Пред'явіть контролеру на вході</span>
										<button
											type="button"
											class="ios-btn-scan"
											onclick={() => simulateScan(tck.ticketCode)}
										>
											📱 Симулювати сканування
										</button>
									</div>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		{/if}
	</div>

	<!-- Apple Style Floating Bottom Bar -->
	<div class="ios-bottom-bar">
		{#if step > 1}
			<button
				type="button"
				class="ios-btn-secondary"
				onclick={() => step = (step - 1) as 1 | 2 | 3}
			>
				<ChevronLeft size={16} /> Назад
			</button>
		{/if}

		{#if step < 3}
			<button
				type="button"
				class="ios-btn-primary flex-1"
				onclick={() => step = (step + 1) as 1 | 2 | 3}
			>
				{#if step === 1}
					Вибрати місця
				{:else if step === 2}
					До оплати ({priceResult.totalAmount} ₴)
				{/if}
				<ChevronRight size={16} />
			</button>
		{:else}
			<button
				type="button"
				class="ios-btn-primary flex-1"
				disabled={priceResult.totalAmount <= 0}
				onclick={handlePayClick}
			>
				<Ticket size={16} />
				<span>Оплатити {priceResult.totalAmount} ₴</span>
			</button>
		{/if}
	</div>
</div>

<style>
	.ios-preview-container {
		display: flex;
		flex-direction: column;
		background: var(--surface-alt);
		font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", system-ui, sans-serif;
		color: var(--text);
		min-height: 520px;
		border-radius: 18px;
		overflow: hidden;
		position: relative;
		padding-bottom: 72px;
	}

	.ios-nav-bar {
		background: rgba(255, 255, 255, 0.85);
		backdrop-filter: blur(12px);
		-webkit-backdrop-filter: blur(12px);
		border-bottom: 0.5px solid var(--divider);
		padding: 0.65rem 1rem;
		position: sticky;
		top: 0;
		z-index: 10;
	}

	.ios-nav-content {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.ios-merchant-badge {
		font-size: 0.85rem;
		font-weight: 700;
		color: var(--text);
	}

	.ios-secure-tag {
		display: flex;
		align-items: center;
		gap: 3px;
		font-size: 0.7rem;
		font-weight: 500;
		color: #34c759;
		background: rgba(52, 199, 89, 0.12);
		padding: 2px 8px;
		border-radius: 12px;
	}

	.ios-step-indicator {
		padding: 0.85rem 1rem 0.25rem 1rem;
	}

	.ios-capsules {
		display: flex;
		gap: 4px;
		margin-bottom: 0.4rem;
	}

	.ios-capsule {
		flex: 1;
		height: 3px;
		background: var(--divider);
		border-radius: 2px;
		transition: background 0.3s ease;
	}

	.ios-capsule.filled {
		background: var(--cta);
	}

	.ios-step-sub {
		font-size: 0.7rem;
		font-weight: 600;
		color: var(--cta);
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.ios-step-title {
		font-size: 1.05rem;
		font-weight: 700;
		color: var(--text);
		margin: 0;
	}

	.ios-window-body {
		padding: 0.75rem 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.ios-card {
		background: var(--surface);
		border-radius: 14px;
		padding: 0.85rem;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
		border: 0.5px solid var(--divider);
	}

	.ios-card-head {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.ios-card-title {
		display: block;
		font-size: 0.82rem;
		font-weight: 600;
		color: var(--text);
		margin-bottom: 0.5rem;
	}

	.ios-card-sub {
		font-size: 0.72rem;
		color: var(--text-sec);
		margin: 0;
	}

	.ios-card-stepper {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	
	.ios-session-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.85rem 1rem;
		border-radius: 14px;
		border: 1px solid var(--divider);
		background: var(--surface);
		cursor: pointer;
		text-align: left;
		transition: all 0.2s cubic-bezier(0.2, 0.8, 0.2, 1);
	}
	.ios-session-row:active {
		transform: scale(0.97);
	}
	.ios-session-row.selected {
		border-color: var(--cta);
		border-width: 2px;
		padding: calc(0.85rem - 1px) calc(1rem - 1px);
	}
	.ios-items-stack {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.ios-session-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.65rem 0.75rem;
		border-radius: 10px;
		border: 1px solid var(--divider);
		background: var(--surface);
		cursor: pointer;
		text-align: left;
	}

	.ios-session-row.selected {
		border-color: var(--cta);
		background: #f0f7ff;
	}

	.ios-sess-title {
		font-size: 0.82rem;
		font-weight: 700;
		color: var(--text);
	}

	.ios-sess-tags {
		display: flex;
		align-items: center;
		gap: 4px;
		margin-top: 3px;
	}

	.ios-badge-format {
		font-size: 0.65rem;
		background: var(--divider);
		color: var(--text);
		padding: 1px 5px;
		border-radius: 4px;
		font-weight: 600;
	}

	.ios-badge-age {
		font-size: 0.65rem;
		background: #fee2e2;
		color: #b91c1c;
		padding: 1px 5px;
		border-radius: 4px;
		font-weight: 600;
	}

	.ios-sess-hall {
		font-size: 0.68rem;
		color: var(--text-sec);
	}

	.ios-sess-timing {
		text-align: right;
	}

	.ios-sess-time {
		font-size: 0.92rem;
		color: var(--cta);
		display: block;
	}

	.ios-sess-date {
		font-size: 0.65rem;
		color: var(--text-sec);
	}

	.ios-venue-info {
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
		font-size: 0.75rem;
		color: var(--text-sec);
	}

	.ios-info-row {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.ios-timer-pill {
		display: flex;
		align-items: center;
		gap: 6px;
		background: #fffbeb;
		border: 1px solid #fef3c7;
		padding: 0.45rem 0.75rem;
		border-radius: 10px;
		font-size: 0.75rem;
		color: #b45309;
	}

	/* Seating Screen & Matrix */
	.ios-hall-card {
		padding: 0.85rem 0.5rem;
		overflow-x: auto;
	}

	.ios-screen-arc {
		background: linear-gradient(180deg, var(--divider) 0%, rgba(229, 229, 234, 0.2) 100%);
		border-top: 3px solid var(--cta);
		border-radius: 50% 50% 0 0 / 14px 14px 0 0;
		padding: 0.35rem 0;
		text-align: center;
		font-size: 0.68rem;
		font-weight: 700;
		letter-spacing: 1px;
		color: var(--text-sec);
		margin-bottom: 0.75rem;
	}

	.ios-seat-grid {
		display: flex;
		flex-direction: column;
		gap: 4px;
		align-items: center;
	}

	.ios-grid-row {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.ios-row-label {
		font-size: 0.65rem;
		font-weight: 700;
		color: var(--text-sec);
		width: 14px;
		text-align: center;
	}

	.ios-seats-lane {
		display: flex;
		gap: 4px;
	}

	.ios-seat-dot {
		width: 22px;
		height: 22px;
		border-radius: 5px;
		font-size: 0.62rem;
		font-weight: 600;
		border: 1px solid var(--divider);
		background: var(--surface);
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.ios-seat-dot.standard {
		border-color: #93c5fd;
		color: #1d4ed8;
		background: #eff6ff;
	}

	.ios-seat-dot.premium {
		border-color: #fde68a;
		color: #b45309;
		background: #fffbeb;
	}

	.ios-seat-dot.selected {
		border-color: var(--cta);
		background: var(--cta);
		color: var(--surface);
		font-weight: 700;
	}

	.ios-seat-dot.sold {
		border-color: var(--divider);
		background: var(--surface-alt);
		color: var(--text-sec);
		cursor: not-allowed;
	}

	.ios-legend-row {
		display: flex;
		justify-content: center;
		flex-wrap: wrap;
		gap: 0.75rem;
		margin-top: 0.85rem;
		padding-top: 0.6rem;
		border-top: 1px solid var(--surface-alt);
		font-size: 0.68rem;
		color: var(--text-sec);
	}

	.ios-legend-item {
		display: flex;
		align-items: center;
		gap: 4px;
	}

	.ios-leg-dot {
		width: 10px;
		height: 10px;
		border-radius: 3px;
	}

	.ios-leg-dot.standard {
		background: #eff6ff;
		border: 1px solid #93c5fd;
	}

	.ios-leg-dot.premium {
		background: #fffbeb;
		border: 1px solid #fde68a;
	}

	.ios-leg-dot.selected {
		background: var(--cta);
	}

	.ios-leg-dot.sold {
		background: var(--divider);
	}

	/* Fan zone */
	.ios-fan-card {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.65rem 0.75rem;
		border-radius: 10px;
		border: 1px solid var(--divider);
		background: var(--surface);
	}

	.ios-fan-name {
		font-size: 0.8rem;
		font-weight: 600;
		color: var(--text);
		display: block;
		padding-left: 6px;
		border-left: 3px solid var(--cta);
	}

	.ios-fan-desc {
		font-size: 0.68rem;
		color: var(--text-sec);
		margin: 2px 0 0 0;
	}

	.ios-fan-price {
		font-size: 0.82rem;
		font-weight: 700;
		color: var(--cta);
		margin-top: 2px;
		display: block;
	}

	.ios-stepper {
		display: flex;
		align-items: center;
		background: var(--surface-alt);
		border-radius: 8px;
		padding: 2px;
		gap: 6px;
	}

	.ios-stepper-btn {
		width: 26px;
		height: 26px;
		border-radius: 6px;
		border: none;
		background: var(--surface);
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		box-shadow: 0 1px 2px var(--divider);
	}

	.ios-stepper-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.ios-stepper-val {
		font-size: 0.82rem;
		font-weight: 700;
		color: var(--text);
		min-width: 24px;
		text-align: center;
	}

	/* Form Inputs */
	.ios-form-stack {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.ios-input-lbl {
		display: block;
		font-size: 0.74rem;
		font-weight: 600;
		color: var(--text);
		margin-bottom: 0.35rem;
	}

	.ios-input {
		width: 100%;
		border: 1px solid var(--divider);
		background: #f9f9fb;
		border-radius: 8px;
		padding: 0.5rem 0.65rem;
		font-size: 0.8rem;
		color: var(--text);
		outline: none;
		box-sizing: border-box;
	}

	.ios-input:focus {
		border-color: var(--cta);
		background: var(--surface);
	}

	/* Apple Pass / Wallet Card */
	.ios-pass-card {
		background: var(--surface);
		border-radius: 16px;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
		border: 0.5px solid var(--divider);
		overflow: hidden;
	}

	.ios-pass-head {
		padding: 0.85rem;
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		background: linear-gradient(180deg, var(--surface) 0%, var(--surface) 100%);
	}

	.ios-pass-tag {
		font-size: 0.68rem;
		font-weight: 600;
		color: var(--cta);
		text-transform: uppercase;
		display: block;
	}

	.ios-pass-title {
		font-size: 0.95rem;
		font-weight: 700;
		color: var(--text);
		margin: 2px 0 0 0;
	}

	.ios-pass-badge {
		font-size: 0.65rem;
		font-weight: 600;
		color: var(--cta);
		background: #eff6ff;
		padding: 2px 8px;
		border-radius: 10px;
	}

	.ios-pass-body {
		padding: 0.5rem 0.85rem;
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.ios-pass-row {
		display: flex;
		justify-content: space-between;
		font-size: 0.78rem;
	}

	.ios-pass-lbl {
		color: var(--text-sec);
	}

	.ios-pass-val {
		color: var(--text);
	}

	.ios-pass-cut {
		display: flex;
		align-items: center;
		position: relative;
		margin: 0.35rem 0;
	}

	.ios-cut-left, .ios-cut-right {
		width: 14px;
		height: 14px;
		background: var(--surface-alt);
		border-radius: 50%;
	}

	.ios-cut-left {
		margin-left: -7px;
	}

	.ios-cut-right {
		margin-right: -7px;
	}

	.ios-cut-line {
		flex: 1;
		border-bottom: 1px dashed var(--divider);
	}

	.ios-pass-footer {
		padding: 0.5rem 0.85rem 0.85rem 0.85rem;
	}

	.ios-pass-total-row {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		font-size: 0.88rem;
		font-weight: 600;
	}

	.ios-fee-note {
		display: block;
		font-size: 0.65rem;
		font-weight: normal;
		color: var(--text-sec);
	}

	.ios-total-sum {
		font-size: 1.25rem;
		font-weight: 800;
		color: var(--cta);
	}

	/* E-Tickets Cards */
	.ios-scan-alert {
		font-size: 0.72rem;
		padding: 0.45rem 0.6rem;
		border-radius: 8px;
		background: #fee2e2;
		color: #b91c1c;
		margin-bottom: 0.5rem;
	}

	.ios-scan-alert.allowed {
		background: #dcfce7;
		color: #15803d;
	}

	.ios-tickets-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.ios-ticket-pass {
		border: 1px solid var(--divider);
		border-radius: 10px;
		padding: 0.6rem 0.75rem;
		background: var(--surface);
	}

	.ios-ticket-pass.used {
		opacity: 0.55;
		background: #f4f4f5;
	}

	.ios-tck-top {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.ios-tck-code {
		font-size: 0.78rem;
		color: var(--text);
	}

	.ios-tck-status {
		font-size: 0.68rem;
		font-weight: 700;
		color: #16a34a;
	}

	.ios-tck-status.status-used {
		color: #ef4444;
	}

	.ios-tck-meta {
		display: flex;
		justify-content: space-between;
		font-size: 0.7rem;
		color: var(--text-sec);
		margin: 2px 0 0.4rem 0;
	}

	.ios-tck-qr-row {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding-top: 0.4rem;
		border-top: 1px dashed var(--divider);
	}

	.ios-qr-box {
		background: var(--surface);
		padding: 4px;
		border-radius: 6px;
		border: 1px solid var(--divider);
	}

	.ios-qr-action {
		flex: 1;
	}

	.ios-qr-desc {
		font-size: 0.68rem;
		color: var(--text-sec);
		display: block;
		margin-bottom: 4px;
	}

	.ios-btn-scan {
		background: var(--cta);
		color: var(--surface);
		border: none;
		border-radius: 6px;
		padding: 0.35rem 0.6rem;
		font-size: 0.7rem;
		font-weight: 600;
		cursor: pointer;
	}

	/* Fixed Bottom Action Bar */
	.ios-bottom-bar {
		position: absolute;
		bottom: 0;
		left: 0;
		right: 0;
		padding: 0.65rem 1rem;
		background: rgba(255, 255, 255, 0.92);
		backdrop-filter: blur(16px);
		-webkit-backdrop-filter: blur(16px);
		border-top: 0.5px solid var(--divider);
		display: flex;
		gap: 0.5rem;
		z-index: 20;
	}

	.ios-btn-secondary {
		background: var(--divider);
		color: var(--text);
		border: none;
		border-radius: 12px;
		padding: 0.6rem 0.9rem;
		font-size: 0.82rem;
		font-weight: 600;
		display: flex;
		align-items: center;
		gap: 4px;
		cursor: pointer;
	}

	.ios-btn-primary {
		background: var(--cta);
		color: var(--surface);
		border: none;
		border-radius: 12px;
		padding: 0.65rem 1rem;
		font-size: 0.85rem;
		font-weight: 600;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		cursor: pointer;
		box-shadow: 0 2px 6px rgba(0, 122, 255, 0.3);
		transition: all 0.2s cubic-bezier(0.2, 0.8, 0.2, 1);
	}

	.ios-btn-primary:active, .ios-btn-secondary:active { transform: scale(0.96); opacity: 0.9; }
	.ios-btn-primary:active {
		background: var(--cta);
	}

	.ios-btn-primary:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.ios-grid-2 {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.5rem;
	}
</style>
