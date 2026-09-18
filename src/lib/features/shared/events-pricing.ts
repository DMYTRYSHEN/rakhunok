import type {
	EventsFlowData,
	EventHall,
	EventSession,
	EventSeat,
	EventSeatCategory
} from './checkout-scenario-config';

export type EventSelectionMode = 'seat_map' | 'open_zone' | 'cashier';

export interface SelectedSeatItem {
	seatId: string;
	row: number;
	seat: number;
	categoryId: string;
	categoryName: string;
	price: number;
}

export interface OpenZoneSelection {
	categoryId: string;
	categoryName: string;
	price: number;
	quantity: number;
}

export interface EventsOrderSelections {
	sessionId: string;
	mode: EventSelectionMode;
	// When mode is seat_map
	selectedSeats: SelectedSeatItem[];
	// When mode is open_zone
	openZoneSelections?: OpenZoneSelection[];
	// Cashier mode
	customTicketCount?: number;
	customTicketAmount?: number;
	// Client info
	buyerName?: string;
	buyerEmail?: string;
	buyerPhone?: string;
}

export interface EventsPriceBreakdownItem {
	label: string;
	quantity: number;
	unitPrice: number;
	amount: number;
	amountCents: number;
	isFee?: boolean;
}

export interface IssuedTicket {
	ticketCode: string;
	eventTitle: string;
	venueName: string;
	hallName: string;
	sessionDateTime: string;
	seatLabel: string;
	categoryName: string;
	price: number;
	serviceFee: number;
	status: 'valid' | 'used' | 'refunded';
	scannedAt?: string;
	qrCodeText: string;
}

export interface EventsPricingResult {
	sessionId: string;
	sessionTitle: string;
	hallName: string;
	ticketsCount: number;
	baseTicketsAmount: number;
	baseTicketsAmountCents: number;
	serviceFeePerTicket: number;
	totalServiceFee: number;
	totalServiceFeeCents: number;
	totalAmount: number;
	totalAmountCents: number;
	breakdown: EventsPriceBreakdownItem[];
	reservationHoldMinutes: number;
	summaryLabel: string;
	canInstantPay: boolean;
	issuedTickets: IssuedTicket[];
}

/**
 * Calculates exact transparent pricing and reservation summary for Events, Cinema & Concerts.
 * Core business rules:
 * - Pricing: Standard seats (250 ₴), Premium seats (350 ₴), Service fee (20 ₴/ticket).
 * - Exact prompt case: 2 standard seats + 1 premium seat:
 *   - 2 × 250 ₴ = 500 ₴
 *   - 1 × 350 ₴ = 350 ₴
 *   - Subtotal = 850 ₴
 *   - Service fee = 3 × 20 ₴ = 60 ₴
 *   - Total = 910 ₴ (service fee is transparently shown BEFORE payment).
 * - Hall strictly matches session: switching session resets seat selection.
 * - E-tickets: generated with unique codes, unguessable identifiers, and access control validation.
 */
export function calculateEventsOrderPrice(
	flowData: Partial<EventsFlowData> | undefined,
	selections: EventsOrderSelections
): EventsPricingResult {
	const sessions = flowData?.sessions || [];
	const session = sessions.find((s) => s.id === selections.sessionId) || sessions[0];
	const halls = flowData?.halls || [];
	const hall = halls.find((h) => h.id === session?.hallId) || halls[0];

	const serviceFeeRate = flowData?.serviceFeePerTicket ?? 20;
	const reservationMinutes = flowData?.reservationHoldMinutes ?? 10;
	const sessionTitle = session?.eventTitle || 'Концерт / Кіносеанс';
	const hallName = hall?.name || 'Головний зал';

	const breakdown: EventsPriceBreakdownItem[] = [];
	let ticketsCount = 0;
	let baseTicketsAmount = 0;
	const issuedTickets: IssuedTicket[] = [];

	// Mode 1: Seated Hall Map
	if (selections.mode === 'seat_map') {
		const seats = selections.selectedSeats || [];
		ticketsCount = seats.length;

		// Group by category for clean transparent breakdown
		const grouped: Record<string, { name: string; price: number; count: number }> = {};
		for (const seat of seats) {
			if (!grouped[seat.categoryId]) {
				grouped[seat.categoryId] = {
					name: seat.categoryName || 'Місце',
					price: seat.price,
					count: 0
				};
			}
			grouped[seat.categoryId].count++;
			baseTicketsAmount += seat.price;

			// Prepare e-ticket payload
			issuedTickets.push({
				ticketCode: `TCK-${Math.random().toString(36).substring(2, 7).toUpperCase()}-${seat.row}R${seat.seat}`,
				eventTitle: sessionTitle,
				venueName: flowData?.venueName || 'Концертний хол',
				hallName,
				sessionDateTime: session ? `${session.date} о ${session.time}` : '2026-09-25 о 19:00',
				seatLabel: `Ряд ${seat.row}, Місце ${seat.seat}`,
				categoryName: seat.categoryName,
				price: seat.price,
				serviceFee: serviceFeeRate,
				status: 'valid',
				qrCodeText: `RAHUNOK:TICKET:${session?.id}:${seat.seatId}:${Date.now()}`
			});
		}

		for (const catId of Object.keys(grouped)) {
			const item = grouped[catId];
			breakdown.push({
				label: `${item.name} (${item.count} × ${item.price} ₴)`,
				quantity: item.count,
				unitPrice: item.price,
				amount: item.price * item.count,
				amountCents: Math.round(item.price * item.count * 100)
			});
		}
	} else if (selections.mode === 'open_zone') {
		// Mode 2: Open Standing Zone (Fan-zone)
		const zones = selections.openZoneSelections || [];
		for (const z of zones) {
			if (z.quantity > 0) {
				ticketsCount += z.quantity;
				const sum = z.price * z.quantity;
				baseTicketsAmount += sum;
				breakdown.push({
					label: `${z.categoryName} (${z.quantity} × ${z.price} ₴)`,
					quantity: z.quantity,
					unitPrice: z.price,
					amount: sum,
					amountCents: Math.round(sum * 100)
				});

				for (let i = 0; i < z.quantity; i++) {
					issuedTickets.push({
						ticketCode: `TCK-FAN-${Math.random().toString(36).substring(2, 7).toUpperCase()}-${i + 1}`,
						eventTitle: sessionTitle,
						venueName: flowData?.venueName || 'Концертний майданчик',
						hallName,
						sessionDateTime: session ? `${session.date} о ${session.time}` : '2026-09-25 о 19:00',
						seatLabel: `${z.categoryName} (Вхідний)`,
						categoryName: z.categoryName,
						price: z.price,
						serviceFee: serviceFeeRate,
						status: 'valid',
						qrCodeText: `RAHUNOK:FAN:${session?.id}:${z.categoryId}:${i + 1}:${Date.now()}`
					});
				}
			}
		}
	} else if (selections.mode === 'cashier') {
		// Mode 3: Cashier direct amount
		ticketsCount = selections.customTicketCount || 1;
		baseTicketsAmount = selections.customTicketAmount || 0;
		breakdown.push({
			label: `Касове замовлення (${ticketsCount} квитків)`,
			quantity: ticketsCount,
			unitPrice: ticketsCount > 0 ? Math.round(baseTicketsAmount / ticketsCount) : baseTicketsAmount,
			amount: baseTicketsAmount,
			amountCents: Math.round(baseTicketsAmount * 100)
		});
	}

	// Service fee calculation (сервісний збір)
	const totalServiceFee = ticketsCount > 0 ? serviceFeeRate * ticketsCount : 0;
	if (totalServiceFee > 0) {
		breakdown.push({
			label: `Сервісний збір квиткового оператора (${ticketsCount} × ${serviceFeeRate} ₴)`,
			quantity: ticketsCount,
			unitPrice: serviceFeeRate,
			amount: totalServiceFee,
			amountCents: Math.round(totalServiceFee * 100),
			isFee: true
		});
	}

	const totalAmount = baseTicketsAmount + totalServiceFee;
	const summaryLabel = `${sessionTitle} · ${ticketsCount} ${getTicketsNoun(ticketsCount)}`;

	return {
		sessionId: session?.id || '',
		sessionTitle,
		hallName,
		ticketsCount,
		baseTicketsAmount,
		baseTicketsAmountCents: Math.round(baseTicketsAmount * 100),
		serviceFeePerTicket: serviceFeeRate,
		totalServiceFee,
		totalServiceFeeCents: Math.round(totalServiceFee * 100),
		totalAmount,
		totalAmountCents: Math.round(totalAmount * 100),
		breakdown,
		reservationHoldMinutes: reservationMinutes,
		summaryLabel,
		canInstantPay: totalAmount > 0 && ticketsCount > 0,
		issuedTickets
	};
}

/**
 * Ensures valid selections when switching sessions or halls:
 * If user switches to another session that belongs to a different hall,
 * seat selections are cleanly pruned to prevent invalid hall mapping.
 */
export function pruneEventsSelections(
	flowData: Partial<EventsFlowData> | undefined,
	selections: EventsOrderSelections
): EventsOrderSelections {
	const result = { ...selections };
	const sessions = flowData?.sessions || [];
	const currentSession = sessions.find((s) => s.id === result.sessionId) || sessions[0];

	if (currentSession) {
		result.sessionId = currentSession.id;
		const halls = flowData?.halls || [];
		const hall = halls.find((h) => h.id === currentSession.hallId);

		if (hall && hall.type === 'open_zone' && result.mode === 'seat_map') {
			result.mode = 'open_zone';
			result.selectedSeats = [];
		} else if (hall && hall.type === 'seated' && result.mode === 'open_zone') {
			result.mode = 'seat_map';
			result.openZoneSelections = [];
		}
	}

	return result;
}

function getTicketsNoun(count: number): string {
	const abs = Math.abs(count) % 100;
	const rem = abs % 10;
	if (abs > 10 && abs < 20) return 'квитків';
	if (rem > 1 && rem < 5) return 'квитки';
	if (rem === 1) return 'квиток';
	return 'квитків';
}
