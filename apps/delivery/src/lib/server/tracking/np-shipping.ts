import { NovaPoshtaError, requireRef } from './np-api.ts';

export class ShippingValidationError extends Error {
	constructor(publicField: string) {
		super('Invalid shipment preparation');
		this.field = publicField;
	}
	field: string;
}

export type Seat = { weight: number; length: number; width: number; height: number };
export type Preparation = {
	senderCityRef: string; senderWarehouseRef: string;
	recipientCityRef: string; recipientWarehouseRef: string;
	recipientName: string; recipientPhone: string; description: string;
	seats: Seat[]; declaredCost: number;
	payer: 'Sender' | 'Recipient'; paymentMethod: 'Cash' | 'NonCash';
};
type Api = { call(model: string, method: string, properties: Record<string, unknown>, key?: string): Promise<Record<string, unknown>[]> };
type Point = { ref: string; cityRef: string; name: string; category: 'Warehouse' | 'Postomat' };

function invalid(field: string): never { throw new ShippingValidationError(field); }
function text(value: unknown, field: string, min: number, max: number): string {
	if (typeof value !== 'string' || /[\u0000-\u001f\u007f]/.test(value)) invalid(field);
	const normalized = value.trim();
	if (normalized.length < min || normalized.length > max) invalid(field);
	return normalized;
}
function ref(value: unknown, field: string): string {
	try { return requireRef(text(value, field, 36, 36)).toLowerCase(); }
	catch { return invalid(field); }
}
function number(value: unknown, field: string, max: number): number {
	if (typeof value !== 'number' && typeof value !== 'string' ||
		typeof value === 'string' && !/^\d+(?:\.\d{1,3})?$/.test(value)) invalid(field);
	const parsed = Number(value);
	if (!Number.isFinite(parsed) || parsed <= 0 || parsed > max) invalid(field);
	return parsed;
}
function record(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function validatePreparation(input: Record<string, unknown>): Preparation {
	const recipientName = text(input.recipientName, 'recipientName', 3, 150);
	if (!/^[\p{L}\p{M}'\u2019 -]+$/u.test(recipientName) || recipientName.split(/\s+/).length < 2) invalid('recipientName');
	const phone = text(input.recipientPhone, 'recipientPhone', 10, 24).replace(/[ ()-]/g, '');
	const recipientPhone = /^0\d{9}$/.test(phone) ? `+38${phone}` : phone;
	if (!/^\+380\d{9}$/.test(recipientPhone)) invalid('recipientPhone');
	let seats: unknown = input.seats;
	if (typeof seats === 'string') {
		if (seats.length > 10000) invalid('seats');
		try { seats = JSON.parse(seats); } catch { invalid('seats'); }
	}
	if (!Array.isArray(seats) || seats.length < 1 || seats.length > 20) invalid('seats');
	const parsedSeats = seats.map(seat => {
		if (!record(seat)) invalid('seats');
		return {
			weight: number(seat.weight, 'seats', 1000), length: number(seat.length, 'seats', 300),
			width: number(seat.width, 'seats', 300), height: number(seat.height, 'seats', 300)
		};
	});
	if (!['Sender', 'Recipient'].includes(String(input.payer))) invalid('payer');
	if (!['Cash', 'NonCash'].includes(String(input.paymentMethod))) invalid('paymentMethod');
	const declaredCost = number(input.declaredCost, 'declaredCost', 1000000);
	if (Math.abs(declaredCost * 100 - Math.round(declaredCost * 100)) > 0.000001) invalid('declaredCost');
	return {
		senderCityRef: ref(input.senderCityRef, 'senderCityRef'), senderWarehouseRef: ref(input.senderWarehouseRef, 'senderWarehouseRef'),
		recipientCityRef: ref(input.recipientCityRef, 'recipientCityRef'), recipientWarehouseRef: ref(input.recipientWarehouseRef, 'recipientWarehouseRef'),
		recipientName, recipientPhone, description: text(input.description, 'description', 3, 200),
		seats: parsedSeats, declaredCost, payer: input.payer as Preparation['payer'], paymentMethod: input.paymentMethod as Preparation['paymentMethod']
	};
}

function limit(value: unknown): number | null {
	if (value === undefined || value === null || value === '') return null;
	if (typeof value !== 'number' && typeof value !== 'string') throw new NovaPoshtaError(503);
	const parsed = Number(value);
	if (!Number.isFinite(parsed) || parsed < 0) throw new NovaPoshtaError(503);
	return parsed === 0 ? null : parsed;
}

export function validatePoint(raw: Record<string, unknown>, preparation: Preparation, side: 'sender' | 'recipient'): Point {
	const field = `${side}WarehouseRef`;
	const expectedRef = side === 'sender' ? preparation.senderWarehouseRef : preparation.recipientWarehouseRef;
	const expectedCity = side === 'sender' ? preparation.senderCityRef : preparation.recipientCityRef;
	if (typeof raw.Ref !== 'string' || raw.Ref.toLowerCase() !== expectedRef ||
		typeof raw.CityRef !== 'string' || raw.CityRef.toLowerCase() !== expectedCity || raw.WarehouseStatus !== 'Working') invalid(field);
	const category = raw.CategoryOfWarehouse === 'Branch' ? 'Warehouse' : raw.CategoryOfWarehouse;
	if (category !== 'Warehouse' && category !== 'Postomat') invalid(field);
	const maxWeight = limit(raw.PlaceMaxWeightAllowed);
	const totalWeight = limit(raw.TotalMaxWeightAllowed);
	if (preparation.seats.some(seat => maxWeight !== null && seat.weight > maxWeight) ||
		totalWeight !== null && preparation.seats.reduce((sum, seat) => sum + seat.weight, 0) > totalWeight) invalid(field);
	const dimensions = raw[side === 'sender' ? 'SendingLimitationsOnDimensions' : 'ReceivingLimitationsOnDimensions'];
	if (dimensions !== undefined && dimensions !== null && !record(dimensions)) throw new NovaPoshtaError(503);
	if (record(dimensions)) {
		const limits = [limit(dimensions.Width), limit(dimensions.Height), limit(dimensions.Length)].sort((left, right) => (left ?? Infinity) - (right ?? Infinity));
		if (preparation.seats.some(seat => [seat.width, seat.height, seat.length].sort((left, right) => left - right)
			.some((size, index) => limits[index] !== null && size > limits[index]!))) invalid(field);
	}
	if (raw.CategoryOfWarehouse === 'Postomat' && (preparation.seats.length !== 1 || preparation.seats[0].weight > 20 ||
		[preparation.seats[0].width, preparation.seats[0].height, preparation.seats[0].length].sort((left, right) => left - right)
			.some((size, index) => size > [30, 40, 60][index]))) invalid(field);
	return { ref: expectedRef, cityRef: expectedCity, name: text(raw.Description, field, 1, 400), category };
}

export function buildEstimatePayload(preparation: Preparation, sender: Point, recipient: Point): Record<string, unknown> {
	if (sender.ref !== preparation.senderWarehouseRef || sender.cityRef !== preparation.senderCityRef ||
		recipient.ref !== preparation.recipientWarehouseRef || recipient.cityRef !== preparation.recipientCityRef ||
		![sender.category, recipient.category].every(category => category === 'Warehouse' || category === 'Postomat')) invalid('route');
	return {
		CitySender: sender.cityRef, CityRecipient: recipient.cityRef, ServiceType: 'WarehouseWarehouse', CargoType: 'Cargo',
		Weight: preparation.seats.reduce((sum, seat) => sum + seat.weight, 0), SeatsAmount: preparation.seats.length,
		Cost: preparation.declaredCost, PayerType: preparation.payer, PaymentMethod: preparation.paymentMethod,
		OptionsSeat: preparation.seats.map(seat => ({ weight: seat.weight, volumetricLength: seat.length,
			volumetricWidth: seat.width, volumetricHeight: seat.height, volumetricVolume: seat.length * seat.width * seat.height / 1000000 }))
	};
}

function deliveryDate(value: unknown): string | null {
	if (typeof value !== 'string') return null;
	const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(value);
	const normalized = match ? `${match[3]}-${match[2]}-${match[1]}` : value;
	if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return null;
	const parsed = new Date(`${normalized}T00:00:00Z`);
	return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === normalized ? normalized : null;
}

export async function prepareShipment(api: Api, input: Record<string, unknown>, key?: string, now = new Date()) {
	const preparation = validatePreparation(input);
	const points = await Promise.all((['sender', 'recipient'] as const).map(async side => {
		const selected = side === 'sender' ? preparation.senderWarehouseRef : preparation.recipientWarehouseRef;
		const rows = await api.call('Address', 'getWarehouses', { Ref: selected, Language: 'UA' }, key);
		if (rows.length !== 1) invalid(`${side}WarehouseRef`);
		return validatePoint(rows[0], preparation, side);
	}));
	const payload = buildEstimatePayload(preparation, points[0], points[1]);
	let cost: number | null = null;
	let estimatedDeliveryDate: string | null = null;
	try {
		const prices = await api.call('InternetDocument', 'getDocumentPrice', payload, key);
		if (prices.length === 1) cost = limit(prices[0].Cost);
	} catch { cost = null; }
	try {
		const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Kyiv', day: '2-digit', month: '2-digit', year: 'numeric' }).format(now).split('/');
		const dates = await api.call('InternetDocument', 'getDocumentDeliveryDate', {
			CitySender: points[0].cityRef, CityRecipient: points[1].cityRef, ServiceType: payload.ServiceType,
			DateTime: `${parts[0]}.${parts[1]}.${parts[2]}`
		}, key);
		if (dates.length === 1) estimatedDeliveryDate = deliveryDate(dates[0].DeliveryDate);
	} catch { estimatedDeliveryDate = null; }
	return {
		status: 'prepared_not_issued' as const, sender: points[0], recipient: points[1],
		seatsAmount: preparation.seats.length, weight: payload.Weight as number, declaredCost: preparation.declaredCost,
		payer: preparation.payer, paymentMethod: preparation.paymentMethod, serviceType: payload.ServiceType as string,
		cost, estimatedDeliveryDate, missingOwnerSetup: ['senderAccount', 'senderCounterpartyRef', 'senderContactRef', 'recipientCounterpartyRef', 'recipientContactRef']
	};
}