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
						color: '#3b82f6',
						description: 'Зручні крісла, ряди 1–3'
					},
					{
						id: 'cat_premium',
						name: 'Преміальне місце',
						price: 350,
						color: '#eab308',
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
					{ id: 'R4-S4', row: 4, seat: 4, categoryId: 'cat_premium', status: 'available' },
					{ id: 'R4-S5', row: 4, seat: 5, categoryId: 'cat_premium', status: 'sold' },
					{ id: 'R4-S6', row: 4, seat: 6, categoryId: 'cat_premium', status: 'sold' },
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
				name: 'Концертний хол (Фан-зони)',
				type: 'open_zone',
				screenOrStageLabel: '🎸 ГОЛОВНА СЦЕНА',
				capacity: 500,
				categories: [
					{
						id: 'cat_fan1',
						name: 'Фан-зона 1 (під сценою)',
						price: 500,
						color: '#ec4899',
						description: 'Найближче до виконавців'
					},
					{
						id: 'cat_fan2',
						name: 'Фан-зона 2 (загальна)',
						price: 350,
						color: '#8b5cf6',
						description: 'Вільний простір, хороший огляд'
					},
					{
						id: 'cat_vip',
						name: 'VIP Lounge (балкон)',
						price: 900,
						color: '#10b981',
						description: 'Окремий бар, місця за столиками'
					}
				]
			}
		],
		approval: {
			autoApprovalEnabled: true,
			requireManualForGroupBooking: true,
			groupBookingMinSeats: 8,
			telegramChat: '@olymp_tickets_manager'
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
	let showTicketModal = $state(false);
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
			const cat = activeHall.categories.find((c) => c.id === seat.categoryId);
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

	function handleSessionChange(newSessionId: string) {
		if (selections.sessionId !== newSessionId) {
			selections.sessionId = newSessionId;
			// Strict dependency rule: switching session cleans old hall seats
			selections.selectedSeats = [];
			secondsLeft = 600; // reset 10m timer
		}
	}

	function handleOpenZoneQty(catId: string, delta: number) {
		const zones = (selections.openZoneSelections || []).map((z) => {
			if (z.categoryId === catId) {
				const nextQty = Math.max(0, Math.min(10, z.quantity + delta));
				return { ...z, quantity: nextQty };
			}
			return z;
		});
		selections.openZoneSelections = zones;
	}

	function simulateScan(ticketCode: string) {
		if (usedTicketCodes.has(ticketCode)) {
			scanMessage = `❌ ПОМИЛКА: Квиток ${ticketCode} УЖЕ ВИКОРИСТАНО! Повторний прохід заборонено.`;
		} else {
			usedTicketCodes.add(ticketCode);
			usedTicketCodes = new Set(usedTicketCodes);
			scanMessage = `✅ ВХІД ДОЗВОЛЕНО: Квиток ${ticketCode} успішно погашено контролером.`;
		}
	}

	function handlePayClick() {
		if (priceResult.totalAmount <= 0) return;
		onPay(priceResult.totalAmount);
		showTicketModal = true;
	}
</script>

<div class="events-preview">
	<!-- Venue Hero Header -->
	<header class="venue-header">
		<div class="venue-badge">🎬 Квиткова каса онлайн</div>
		<h3 class="venue-title">{mergedData.venueName}</h3>
		<p class="venue-address"><MapPin size={13} /> {mergedData.address}</p>
	</header>

	<!-- Session Picker Carousel -->
	<section class="sessions-selector">
		<div class="selector-header">
			<span class="sub-label">Оберіть подію та сеанс:</span>
		</div>
		<div class="sessions-scroll">
			{#each mergedData.sessions as sess (sess.id)}
				<button
					type="button"
					class="session-pill-btn"
					class:active={selections.sessionId === sess.id}
					onclick={() => handleSessionChange(sess.id)}
				>
					<span class="sess-title">{sess.eventTitle}</span>
					<div class="sess-meta">
						<span class="badge-format">{sess.format}</span>
						<span>{sess.date} о {sess.time}</span>
					</div>
					<span class="sess-hall">{mergedData.halls.find(h => h.id === sess.hallId)?.name}</span>
				</button>
			{/each}
		</div>
	</section>

	<!-- Main Hall or Zone Experience -->
	<main class="hall-experience">
		<!-- 10-Minute Reservation Timer Banner -->
		<div class="reservation-timer-banner">
			<Clock size={16} />
			<div>
				<strong>Місця зарезервовано на {formattedTime()} хв</strong>
				<span class="timer-desc">Завершіть покупку до закінчення таймера, щоб зберегти місця</span>
			</div>
		</div>

		<!-- HALL MAP (SEATED) -->
		{#if activeHall.type === 'seated'}
			<div class="screen-indicator">
				<div class="screen-arc"></div>
				<span class="screen-text">{activeHall.screenOrStageLabel || '🎬 ЕКРАН'}</span>
			</div>

			<!-- Hall Seat Map Matrix -->
			<div class="seat-matrix-wrap">
				<div class="seat-matrix">
					{#each Array(activeHall.rowsCount || 5) as _, rIdx}
						{@const rowNum = rIdx + 1}
						<div class="seat-row">
							<span class="row-num">{rowNum}</span>
							<div class="seats-in-row">
								{#each (activeHall.seats?.filter(s => s.row === rowNum) || []) as seat (seat.id)}
									{@const isSelected = selections.selectedSeats.some(s => s.seatId === seat.id)}
									{@const isStandard = seat.categoryId === 'cat_standard'}
									<button
										type="button"
										class="seat-cell"
										class:selected={isSelected}
										class:sold={seat.status === 'sold'}
										class:standard={isStandard && !isSelected && seat.status !== 'sold'}
										class:premium={!isStandard && !isSelected && seat.status !== 'sold'}
										disabled={seat.status === 'sold'}
										aria-label="Ряд {seat.row}, місце {seat.seat}, {isStandard ? '250 ₴' : '350 ₴'}"
										onclick={() => toggleSeat(seat)}
									>
										{#if isSelected}
											<Check size={11} strokeWidth={3} />
										{:else if seat.status === 'sold'}
											×
										{:else}
											{seat.seat}
										{/if}
									</button>
								{/each}
							</div>
							<span class="row-num">{rowNum}</span>
						</div>
					{/each}
				</div>
			</div>

			<!-- Category Legend -->
			<div class="hall-legend">
				<div class="legend-item">
					<span class="legend-color standard"></span>
					<span>Стандарт (250 ₴)</span>
				</div>
				<div class="legend-item">
					<span class="legend-color premium"></span>
					<span>Преміум (350 ₴)</span>
				</div>
				<div class="legend-item">
					<span class="legend-color selected"></span>
					<span>Обрано</span>
				</div>
				<div class="legend-item">
					<span class="legend-color sold"></span>
					<span>Зайнято</span>
				</div>
			</div>

		<!-- OPEN FAN ZONE (NON-SEATED) -->
		{:else}
			<div class="open-zone-container">
				<div class="stage-banner">
					<span>🎸 ГОЛОВНА СЦЕНА ФЕСТИВАЛЮ</span>
				</div>

				<div class="open-zone-cards">
					{#each activeHall.categories as cat (cat.id)}
						{@const currentQty = selections.openZoneSelections?.find(z => z.categoryId === cat.id)?.quantity || 0}
						<div class="zone-card">
							<div class="zone-info">
								<span class="zone-name" style="border-left-color: {cat.color}">{cat.name}</span>
								<p class="zone-desc">{cat.description}</p>
								<strong class="zone-price">{cat.price} ₴</strong>
							</div>
							<div class="zone-stepper">
								<button
									type="button"
									class="btn-step"
									disabled={currentQty <= 0}
									onclick={() => handleOpenZoneQty(cat.id, -1)}
								>
									-
								</button>
								<span class="step-qty">{currentQty}</span>
								<button
									type="button"
									class="btn-step"
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
	</main>

	<!-- Price Summary & Transparent Breakdown -->
	<footer class="checkout-footer">
		<div class="order-summary-box">
			<div class="summary-top">
				<span class="event-title-tag">{activeSession.eventTitle}</span>
				<span class="session-time-tag">{activeSession.date} · {activeSession.time}</span>
			</div>

			<!-- Breakdown rows -->
			<div class="breakdown-lines">
				{#each priceResult.breakdown as line}
					<div class="line-row" class:fee-line={line.isFee}>
						<span class="line-label">{line.label}</span>
						<span class="line-sum">{line.amount} ₴</span>
					</div>
				{/each}
			</div>

			<div class="total-bar">
				<div>
					<span class="total-lbl">До сплати разом:</span>
					<span class="service-notice">Включаючи сервісний збір {priceResult.totalServiceFee} ₴</span>
				</div>
				<strong class="total-num">{priceResult.totalAmount} ₴</strong>
			</div>

			<button
				type="button"
				class="pay-btn"
				disabled={priceResult.totalAmount <= 0}
				onclick={handlePayClick}
			>
				<Ticket size={18} />
				<span>Оплатити {priceResult.totalAmount} ₴ (Отримати квитки)</span>
			</button>
		</div>
	</footer>

	<!-- Electronic Tickets Modal / Access Control Simulator -->
	{#if showTicketModal}
		<div class="tickets-modal-backdrop">
			<div class="tickets-modal">
				<div class="modal-header">
					<div>
						<h4>🎟️ Ваші електронні квитки</h4>
						<p class="modal-subtitle">{activeSession.eventTitle} ({priceResult.issuedTickets.length} шт)</p>
					</div>
					<button
						type="button"
						class="btn-close"
						onclick={() => (showTicketModal = false)}
						aria-label="Закрити"
					>
						×
					</button>
				</div>

				{#if scanMessage}
					<div class="scan-alert-box" class:alert-ok={scanMessage.includes('ВХІД ДОЗВОЛЕНО')}>
						{scanMessage}
					</div>
				{/if}

				<div class="tickets-list">
					{#each priceResult.issuedTickets as tck}
						{@const isUsed = usedTicketCodes.has(tck.ticketCode)}
						<div class="ticket-card" class:used={isUsed}>
							<div class="tck-top">
								<span class="tck-code">{tck.ticketCode}</span>
								<span class="tck-status" class:status-used={isUsed}>
									{isUsed ? '❌ ПОГАШЕНО (Вхід здійснено)' : '✅ ДІЙСНИЙ'}
								</span>
							</div>

							<div class="tck-details">
								<div>
									<strong>{tck.seatLabel}</strong>
									<span class="tck-cat">{tck.categoryName}</span>
								</div>
								<div class="tck-meta">
									<span>{tck.hallName}</span>
									<span>{tck.sessionDateTime}</span>
								</div>
							</div>

							<div class="tck-qr-row">
								<div class="qr-mock">
									<QrCode size={48} />
								</div>
								<div class="qr-info">
									<p class="qr-desc">Пред’явіть QR-код контролеру на вході</p>
									<button
										type="button"
										class="btn-scanner"
										onclick={() => simulateScan(tck.ticketCode)}
									>
										📱 Сканувати на вході
									</button>
								</div>
							</div>
						</div>
					{/each}
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
	.events-preview {
		display: flex;
		flex-direction: column;
		background: #0f172a;
		border-radius: 12px;
		color: #ffffff;
		overflow: hidden;
		font-family: inherit;
	}

	.venue-header {
		background: linear-gradient(180deg, #1e293b, #0f172a);
		padding: 1.1rem 1rem 0.6rem 1rem;
		text-align: center;
	}

	.venue-badge {
		display: inline-block;
		font-size: 0.72rem;
		font-weight: 700;
		color: #38bdf8;
		background: rgba(56, 189, 248, 0.15);
		padding: 0.2rem 0.6rem;
		border-radius: 20px;
		margin-bottom: 0.35rem;
	}

	.venue-title {
		font-size: 1.15rem;
		font-weight: 800;
		margin: 0;
		color: #f8fafc;
	}

	.venue-address {
		font-size: 0.75rem;
		color: #94a3b8;
		margin: 0.25rem 0 0 0;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.25rem;
	}

	.sessions-selector {
		padding: 0.75rem 0.75rem 0.25rem 0.75rem;
	}

	.selector-header {
		margin-bottom: 0.4rem;
	}

	.sub-label {
		font-size: 0.75rem;
		font-weight: 600;
		color: #94a3b8;
	}

	.sessions-scroll {
		display: flex;
		gap: 0.5rem;
		overflow-x: auto;
		padding-bottom: 0.35rem;
	}

	.session-pill-btn {
		background: #1e293b;
		border: 1.5px solid #334155;
		border-radius: 8px;
		padding: 0.55rem 0.75rem;
		color: #cbd5e1;
		cursor: pointer;
		text-align: left;
		white-space: nowrap;
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		transition: all 0.15s ease;
	}

	.session-pill-btn.active {
		border-color: #38bdf8;
		background: #0284c7;
		color: #ffffff;
	}

	.sess-title {
		font-size: 0.82rem;
		font-weight: 700;
	}

	.sess-meta {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.72rem;
		color: #94a3b8;
	}

	.session-pill-btn.active .sess-meta {
		color: #e0f2fe;
	}

	.badge-format {
		background: rgba(255, 255, 255, 0.15);
		padding: 0.1rem 0.35rem;
		border-radius: 4px;
		font-weight: 600;
		font-size: 0.68rem;
	}

	.sess-hall {
		font-size: 0.68rem;
		color: #64748b;
	}

	.session-pill-btn.active .sess-hall {
		color: #bae6fd;
	}

	.hall-experience {
		padding: 0.75rem;
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
	}

	.reservation-timer-banner {
		background: rgba(245, 158, 11, 0.15);
		border: 1px solid rgba(245, 158, 11, 0.3);
		border-radius: 8px;
		padding: 0.6rem 0.75rem;
		display: flex;
		align-items: center;
		gap: 0.65rem;
		color: #fbbf24;
	}

	.reservation-timer-banner strong {
		font-size: 0.82rem;
		display: block;
	}

	.timer-desc {
		font-size: 0.7rem;
		color: #d97706;
		display: block;
	}

	/* Hall Screen & Seat Map */
	.screen-indicator {
		text-align: center;
		padding: 0.5rem 0;
	}

	.screen-arc {
		height: 4px;
		background: linear-gradient(90deg, transparent, #38bdf8, transparent);
		border-radius: 50%;
		margin: 0 1.5rem 0.35rem 1.5rem;
		box-shadow: 0 0 10px #38bdf8;
	}

	.screen-text {
		font-size: 0.72rem;
		letter-spacing: 2px;
		font-weight: 700;
		color: #64748b;
	}

	.seat-matrix-wrap {
		display: flex;
		justify-content: center;
		overflow-x: auto;
		padding: 0.5rem 0;
	}

	.seat-matrix {
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
	}

	.seat-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.row-num {
		font-size: 0.72rem;
		font-weight: 700;
		color: #64748b;
		width: 14px;
		text-align: center;
	}

	.seats-in-row {
		display: flex;
		gap: 0.35rem;
	}

	.seat-cell {
		width: 26px;
		height: 26px;
		border-radius: 6px 6px 4px 4px;
		border: 1px solid transparent;
		font-size: 0.7rem;
		font-weight: 700;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.seat-cell.standard {
		background: #1e3a8a;
		border-color: #3b82f6;
		color: #bfdbfe;
	}

	.seat-cell.premium {
		background: #713f12;
		border-color: #eab308;
		color: #fef08a;
	}

	.seat-cell.selected {
		background: #10b981;
		border-color: #34d399;
		color: #ffffff;
		box-shadow: 0 0 8px #10b981;
	}

	.seat-cell.sold {
		background: #334155;
		color: #64748b;
		cursor: not-allowed;
		opacity: 0.4;
	}

	.hall-legend {
		display: flex;
		justify-content: center;
		gap: 0.85rem;
		flex-wrap: wrap;
		font-size: 0.7rem;
		color: #94a3b8;
		padding: 0.25rem 0;
	}

	.legend-item {
		display: flex;
		align-items: center;
		gap: 0.35rem;
	}

	.legend-color {
		width: 12px;
		height: 12px;
		border-radius: 3px;
	}

	.legend-color.standard {
		background: #3b82f6;
	}

	.legend-color.premium {
		background: #eab308;
	}

	.legend-color.selected {
		background: #10b981;
	}

	.legend-color.sold {
		background: #475569;
	}

	/* Open Zone */
	.open-zone-container {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.stage-banner {
		background: #be185d;
		color: white;
		text-align: center;
		padding: 0.6rem;
		font-weight: 800;
		font-size: 0.8rem;
		letter-spacing: 1px;
		border-radius: 6px;
	}

	.open-zone-cards {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.zone-card {
		background: #1e293b;
		border: 1px solid #334155;
		border-radius: 8px;
		padding: 0.75rem;
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.zone-name {
		font-weight: 700;
		font-size: 0.85rem;
		border-left: 3px solid #38bdf8;
		padding-left: 0.4rem;
	}

	.zone-desc {
		font-size: 0.72rem;
		color: #94a3b8;
		margin: 0.15rem 0 0.3rem 0;
	}

	.zone-price {
		font-size: 0.92rem;
		color: #38bdf8;
	}

	.zone-stepper {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		background: #0f172a;
		padding: 0.2rem 0.4rem;
		border-radius: 6px;
	}

	.btn-step {
		width: 28px;
		height: 28px;
		background: #334155;
		color: white;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		font-weight: 700;
	}

	.btn-step:disabled {
		opacity: 0.3;
		cursor: not-allowed;
	}

	.step-qty {
		font-size: 0.9rem;
		font-weight: 800;
		min-width: 20px;
		text-align: center;
	}

	/* Footer & Pricing */
	.checkout-footer {
		background: #1e293b;
		border-top: 1px solid #334155;
		padding: 1rem;
	}

	.order-summary-box {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.summary-top {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.event-title-tag {
		font-size: 0.85rem;
		font-weight: 700;
		color: #f8fafc;
	}

	.session-time-tag {
		font-size: 0.72rem;
		color: #38bdf8;
	}

	.breakdown-lines {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		border-top: 1px dashed #334155;
		border-bottom: 1px dashed #334155;
		padding: 0.5rem 0;
	}

	.line-row {
		display: flex;
		justify-content: space-between;
		font-size: 0.78rem;
		color: #cbd5e1;
	}

	.fee-line {
		color: #fbbf24;
	}

	.total-bar {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.total-lbl {
		font-size: 0.88rem;
		font-weight: 700;
		display: block;
	}

	.service-notice {
		font-size: 0.68rem;
		color: #94a3b8;
		display: block;
	}

	.total-num {
		font-size: 1.3rem;
		font-weight: 800;
		color: #38bdf8;
	}

	.pay-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		width: 100%;
		padding: 0.8rem;
		background: #0284c7;
		color: #ffffff;
		border: none;
		border-radius: 8px;
		font-size: 0.92rem;
		font-weight: 700;
		cursor: pointer;
		box-shadow: 0 4px 10px rgba(2, 132, 199, 0.4);
		transition: all 0.15s ease;
	}

	.pay-btn:hover:not(:disabled) {
		background: #0369a1;
	}

	.pay-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	/* E-tickets Modal */
	.tickets-modal-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.8);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1rem;
		z-index: 999;
	}

	.tickets-modal {
		background: #0f172a;
		border: 1px solid #334155;
		border-radius: 12px;
		max-width: 420px;
		width: 100%;
		max-height: 85vh;
		overflow-y: auto;
		padding: 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.modal-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
	}

	.modal-header h4 {
		margin: 0;
		font-size: 1.1rem;
		color: #ffffff;
	}

	.modal-subtitle {
		font-size: 0.75rem;
		color: #94a3b8;
		margin: 0.2rem 0 0 0;
	}

	.btn-close {
		background: none;
		border: none;
		color: #94a3b8;
		font-size: 1.4rem;
		cursor: pointer;
		line-height: 1;
	}

	.scan-alert-box {
		background: #7f1d1d;
		border: 1px solid #ef4444;
		color: #fecaca;
		padding: 0.6rem 0.75rem;
		border-radius: 6px;
		font-size: 0.75rem;
		font-weight: 600;
	}

	.scan-alert-box.alert-ok {
		background: #064e3b;
		border-color: #10b981;
		color: #a7f3d0;
	}

	.tickets-list {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.ticket-card {
		background: #1e293b;
		border: 1.5px dashed #475569;
		border-radius: 8px;
		padding: 0.85rem;
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
	}

	.ticket-card.used {
		opacity: 0.55;
		border-color: #ef4444;
	}

	.tck-top {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.tck-code {
		font-size: 0.78rem;
		font-family: monospace;
		font-weight: 700;
		color: #38bdf8;
	}

	.tck-status {
		font-size: 0.7rem;
		font-weight: 700;
		color: #10b981;
	}

	.status-used {
		color: #ef4444;
	}

	.tck-details {
		display: flex;
		justify-content: space-between;
		align-items: flex-end;
		border-top: 1px solid #334155;
		padding-top: 0.5rem;
	}

	.tck-cat {
		display: block;
		font-size: 0.7rem;
		color: #94a3b8;
	}

	.tck-meta {
		font-size: 0.7rem;
		color: #94a3b8;
		text-align: right;
		display: flex;
		flex-direction: column;
	}

	.tck-qr-row {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		background: #0f172a;
		padding: 0.5rem;
		border-radius: 6px;
	}

	.qr-mock {
		background: white;
		color: black;
		padding: 0.25rem;
		border-radius: 4px;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.qr-info {
		flex: 1;
	}

	.qr-desc {
		font-size: 0.68rem;
		color: #94a3b8;
		margin: 0 0 0.4rem 0;
	}

	.btn-scanner {
		background: #334155;
		color: #ffffff;
		border: none;
		border-radius: 4px;
		padding: 0.35rem 0.6rem;
		font-size: 0.7rem;
		font-weight: 600;
		cursor: pointer;
	}

	.btn-scanner:hover {
		background: #475569;
	}
</style>
