export const FUEL_STATION_FLOW_ID = 'fuel_station';

export type FuelStationInputMode = 'liters' | 'amount';
export type FuelStationUnit = 'liter' | 'kwh';
export type FuelStationDispenserStatus =
	'available' | 'occupied' | 'connected' | 'offline' | 'disabled' | 'unknown';
export type FuelStationProductStatus = 'available' | 'unavailable' | 'out_of_stock';
export type FuelStationNozzleStatus = 'docked' | 'connected' | 'disabled' | 'unknown';

export interface FuelStationTemplatePolicy {
	allowed_input_modes: FuelStationInputMode[];
	default_input_mode: FuelStationInputMode;
	require_connected_nozzle: boolean;
	price_change_policy: 'lock_quote' | 'accept_at_authorization' | 'reject';
	quote_ttl_seconds: number;
}

export interface FuelStationProduct {
	id: string;
	code: string;
	label: string;
	unit: FuelStationUnit;
	price_per_unit: number;
	currency: string;
	status: FuelStationProductStatus;
}

export interface FuelStationDispenser {
	id: string;
	number: string;
	label: string;
	status: FuelStationDispenserStatus;
	product_ids: string[];
	nozzles: Array<{
		id: string;
		product_id: string;
		status: FuelStationNozzleStatus;
	}>;
	active_nozzle_id?: string;
}

export interface FuelStationLimit {
	mode: FuelStationInputMode;
	min: number;
	max: number;
	step: number;
}

export interface FuelStationSnapshot {
	snapshot_id: string;
	revision: string;
	observed_at: string;
	station: {
		id: string;
		label: string;
		address?: string;
	};
	dispensers: FuelStationDispenser[];
	products: FuelStationProduct[];
	limits: FuelStationLimit[];
}

export interface FuelStationSelection {
	dispenser_id: string;
	product_id: string;
	quantity: {
		mode: FuelStationInputMode;
		value: number;
	};
}

export interface FuelStationQuote {
	id: string;
	snapshot_id: string;
	revision: string;
	dispenser_id: string;
	product_id: string;
	input_mode: FuelStationInputMode;
	input_value: number;
	created_at: string;
	expires_at: string;
	unit_price: number;
	estimated_quantity: number;
	estimated_amount: number;
	currency: string;
}

export interface FuelStationFulfillment {
	status: 'authorized' | 'dispensing' | 'completed' | 'cancelled' | 'failed';
	transaction_id: string;
	actual_quantity?: number;
	actual_amount?: number;
	completed_at?: string;
}

export interface FuelStationFlowData {
	policy: FuelStationTemplatePolicy;
	snapshot?: FuelStationSnapshot;
	selection?: FuelStationSelection;
	quote?: FuelStationQuote;
	fulfillment?: FuelStationFulfillment;
}

const inputModes = new Set<FuelStationInputMode>(['liters', 'amount']);
const dispenserStatuses = new Set<FuelStationDispenserStatus>([
	'available',
	'occupied',
	'connected',
	'offline',
	'disabled',
	'unknown'
]);
const productStatuses = new Set<FuelStationProductStatus>([
	'available',
	'unavailable',
	'out_of_stock'
]);
const nozzleStatuses = new Set<FuelStationNozzleStatus>([
	'docked',
	'connected',
	'disabled',
	'unknown'
]);

function object(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function identifier(value: unknown): value is string {
	return typeof value === 'string' && value.trim().length > 0 && value.length <= 128;
}

function finiteNumber(value: unknown): value is number {
	return typeof value === 'number' && Number.isFinite(value);
}

function isoDate(value: unknown): value is string {
	return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function validatePolicy(value: unknown): asserts value is FuelStationTemplatePolicy {
	if (!object(value)) throw new Error('Некоректна політика сценарію АЗС.');
	const modes = value.allowed_input_modes;
	if (
		!Array.isArray(modes) ||
		modes.length === 0 ||
		modes.length > inputModes.size ||
		new Set(modes).size !== modes.length ||
		modes.some((mode) => !inputModes.has(mode as FuelStationInputMode)) ||
		!inputModes.has(value.default_input_mode as FuelStationInputMode) ||
		!modes.includes(value.default_input_mode)
	) {
		throw new Error('Некоректні режими введення сценарію АЗС.');
	}
	if (typeof value.require_connected_nozzle !== 'boolean')
		throw new Error('Некоректне правило підключення пістолета АЗС.');
	if (
		!['lock_quote', 'accept_at_authorization', 'reject'].includes(
			value.price_change_policy as string
		)
	)
		throw new Error('Некоректна політика зміни ціни АЗС.');
	if (
		!Number.isInteger(value.quote_ttl_seconds) ||
		(value.quote_ttl_seconds as number) < 10 ||
		(value.quote_ttl_seconds as number) > 300
	) {
		throw new Error('Строк дії пропозиції АЗС має бути від 10 до 300 секунд.');
	}
}

function validateSnapshot(value: unknown): asserts value is FuelStationSnapshot {
	if (
		!object(value) ||
		!identifier(value.snapshot_id) ||
		!identifier(value.revision) ||
		!isoDate(value.observed_at)
	)
		throw new Error('Некоректна версія оперативних даних АЗС.');
	if (!object(value.station) || !identifier(value.station.id) || !identifier(value.station.label))
		throw new Error('Некоректні дані станції АЗС.');
	if (!Array.isArray(value.products) || value.products.length === 0)
		throw new Error('АЗС не передала доступні види пального.');
	const productIds = new Set<string>();
	for (const product of value.products) {
		if (
			!object(product) ||
			!identifier(product.id) ||
			productIds.has(product.id) ||
			!identifier(product.code) ||
			!identifier(product.label) ||
			!['liter', 'kwh'].includes(product.unit as string) ||
			!finiteNumber(product.price_per_unit) ||
			product.price_per_unit <= 0 ||
			!identifier(product.currency) ||
			!productStatuses.has(product.status as FuelStationProductStatus)
		) {
			throw new Error('Некоректний вид пального або ціна АЗС.');
		}
		productIds.add(product.id);
	}
	if (!Array.isArray(value.dispensers) || value.dispensers.length === 0)
		throw new Error('АЗС не передала паливні пости.');
	const dispenserIds = new Set<string>();
	for (const dispenser of value.dispensers) {
		const nozzles = object(dispenser) && Array.isArray(dispenser.nozzles) ? dispenser.nozzles : [];
		const dispenserProductIds =
			object(dispenser) && Array.isArray(dispenser.product_ids) ? dispenser.product_ids : [];
		const activeNozzleId = object(dispenser) ? dispenser.active_nozzle_id : undefined;
		const nozzleIds = new Set<string>();
		const validNozzles =
			nozzles.length > 0 &&
			nozzles.every((nozzle) => {
				if (
					!object(nozzle) ||
					!identifier(nozzle.id) ||
					nozzleIds.has(nozzle.id) ||
					!identifier(nozzle.product_id) ||
					!productIds.has(nozzle.product_id) ||
					!nozzleStatuses.has(nozzle.status as FuelStationNozzleStatus)
				) {
					return false;
				}
				nozzleIds.add(nozzle.id);
				return true;
			});
		if (
			!object(dispenser) ||
			!identifier(dispenser.id) ||
			dispenserIds.has(dispenser.id) ||
			!identifier(dispenser.number) ||
			!identifier(dispenser.label) ||
			!dispenserStatuses.has(dispenser.status as FuelStationDispenserStatus) ||
			dispenserProductIds.length === 0 ||
			dispenserProductIds.some((id) => !identifier(id) || !productIds.has(id)) ||
			!validNozzles ||
			nozzles.some((nozzle) => !dispenserProductIds.includes(nozzle.product_id as string)) ||
			(activeNozzleId !== undefined &&
				(!identifier(activeNozzleId) || !nozzleIds.has(activeNozzleId))) ||
			(dispenser.status === 'connected' &&
				(!identifier(activeNozzleId) ||
					nozzles.find((nozzle) => nozzle.id === activeNozzleId)?.status !== 'connected'))
		) {
			throw new Error('Некоректний паливний пост або його асортимент.');
		}
		dispenserIds.add(dispenser.id);
	}
	if (!Array.isArray(value.limits) || value.limits.length === 0)
		throw new Error('АЗС не передала ліміти відпуску.');
	for (const limit of value.limits) {
		if (
			!object(limit) ||
			!inputModes.has(limit.mode as FuelStationInputMode) ||
			!finiteNumber(limit.min) ||
			!finiteNumber(limit.max) ||
			!finiteNumber(limit.step) ||
			limit.min < 0 ||
			limit.max <= limit.min ||
			limit.step <= 0
		) {
			throw new Error('Некоректні ліміти відпуску АЗС.');
		}
	}
}

function validateSelection(
	value: unknown,
	snapshot: FuelStationSnapshot,
	policy: FuelStationTemplatePolicy
): asserts value is FuelStationSelection {
	if (!object(value) || !identifier(value.dispenser_id) || !identifier(value.product_id))
		throw new Error('Некоректний вибір на АЗС.');
	const dispenser = snapshot.dispensers.find((item) => item.id === value.dispenser_id);
	const product = snapshot.products.find((item) => item.id === value.product_id);
	if (!dispenser || !product || !dispenser.product_ids.includes(product.id))
		throw new Error('Обраний пост не відпускає цей продукт.');
	if (!['available', 'connected'].includes(dispenser.status) || product.status !== 'available')
		throw new Error('Обраний пост або продукт зараз недоступний.');
	if (policy.require_connected_nozzle && dispenser.status !== 'connected')
		throw new Error('Підключіть пістолет до обраного поста.');
	const activeNozzle = dispenser.nozzles.find((item) => item.id === dispenser.active_nozzle_id);
	if (policy.require_connected_nozzle && activeNozzle?.product_id !== product.id)
		throw new Error('Обране пальне не відповідає підключеному пістолету.');
	if (
		!object(value.quantity) ||
		!policy.allowed_input_modes.includes(value.quantity.mode as FuelStationInputMode) ||
		!finiteNumber(value.quantity.value)
	) {
		throw new Error('Некоректна кількість або сума заправки.');
	}
	const quantity = value.quantity as { mode: FuelStationInputMode; value: number };
	const limit = snapshot.limits.find((item) => item.mode === quantity.mode);
	if (!limit || quantity.value < limit.min || quantity.value > limit.max)
		throw new Error('Значення заправки виходить за дозволені ліміти.');
}

function validateQuote(
	value: unknown,
	snapshot: FuelStationSnapshot,
	selection: FuelStationSelection,
	policy: FuelStationTemplatePolicy,
	now: number
): asserts value is FuelStationQuote {
	if (
		!object(value) ||
		!identifier(value.id) ||
		!identifier(value.snapshot_id) ||
		!identifier(value.revision) ||
		!identifier(value.dispenser_id) ||
		!identifier(value.product_id) ||
		!inputModes.has(value.input_mode as FuelStationInputMode) ||
		!finiteNumber(value.input_value) ||
		!isoDate(value.created_at) ||
		!isoDate(value.expires_at) ||
		!finiteNumber(value.unit_price) ||
		value.unit_price <= 0 ||
		!finiteNumber(value.estimated_quantity) ||
		value.estimated_quantity <= 0 ||
		!finiteNumber(value.estimated_amount) ||
		value.estimated_amount <= 0 ||
		!identifier(value.currency)
	) {
		throw new Error('Некоректна пропозиція АЗС.');
	}
	if (
		value.snapshot_id !== snapshot.snapshot_id ||
		value.revision !== snapshot.revision ||
		value.dispenser_id !== selection.dispenser_id ||
		value.product_id !== selection.product_id ||
		value.input_mode !== selection.quantity.mode ||
		value.input_value !== selection.quantity.value
	) {
		throw new Error('Пропозиція АЗС не відповідає оперативним даним або вибору.');
	}
	const createdAt = Date.parse(value.created_at);
	const expiresAt = Date.parse(value.expires_at);
	if (
		expiresAt <= createdAt ||
		expiresAt - createdAt > policy.quote_ttl_seconds * 1000 ||
		expiresAt <= now
	) {
		throw new Error('Пропозиція АЗС прострочена або має некоректний строк дії.');
	}
	const product = snapshot.products.find((item) => item.id === selection.product_id);
	if (!product || value.currency !== product.currency)
		throw new Error('Валюта пропозиції не відповідає продукту АЗС.');
	if (policy.price_change_policy === 'lock_quote' && value.unit_price !== product.price_per_unit)
		throw new Error('Ціна пропозиції не відповідає оперативним даним АЗС.');
	const expectedAmount = value.estimated_quantity * value.unit_price;
	if (Math.abs(expectedAmount - value.estimated_amount) > 0.01)
		throw new Error('Сума пропозиції не відповідає кількості та ціні.');
}

function validateFulfillment(value: unknown): asserts value is FuelStationFulfillment {
	if (
		!object(value) ||
		!['authorized', 'dispensing', 'completed', 'cancelled', 'failed'].includes(
			value.status as string
		) ||
		!identifier(value.transaction_id) ||
		(value.actual_quantity !== undefined &&
			(!finiteNumber(value.actual_quantity) || value.actual_quantity < 0)) ||
		(value.actual_amount !== undefined &&
			(!finiteNumber(value.actual_amount) || value.actual_amount < 0)) ||
		(value.completed_at !== undefined && !isoDate(value.completed_at))
	) {
		throw new Error('Некоректні дані фактичного відпуску АЗС.');
	}
	if (
		value.status === 'completed' &&
		(value.actual_quantity === undefined ||
			value.actual_amount === undefined ||
			value.completed_at === undefined)
	) {
		throw new Error('Завершений відпуск АЗС не містить фактичних показників.');
	}
}

export function validateFuelStationFlowData(
	value: unknown,
	options: { requireSnapshot?: boolean; templateOnly?: boolean; now?: number } = {}
): FuelStationFlowData {
	if (!object(value)) throw new Error('Некоректні дані сценарію АЗС.');
	validatePolicy(value.policy);
	if (
		options.templateOnly &&
		['snapshot', 'selection', 'quote', 'fulfillment'].some((key) => value[key] !== undefined)
	) {
		throw new Error('Шаблон АЗС не може містити оперативні дані станції.');
	}
	if (options.requireSnapshot && value.snapshot === undefined)
		throw new Error('Відсутні оперативні дані АЗС.');
	if (value.snapshot !== undefined) validateSnapshot(value.snapshot);
	if (value.selection !== undefined) {
		if (value.snapshot === undefined) throw new Error('Вибір АЗС потребує оперативних даних.');
		validateSelection(value.selection, value.snapshot, value.policy);
	}
	if (value.quote !== undefined) {
		if (value.snapshot === undefined || value.selection === undefined)
			throw new Error('Пропозиція АЗС потребує оперативних даних і вибору.');
		validateQuote(
			value.quote,
			value.snapshot,
			value.selection,
			value.policy,
			options.now ?? Date.now()
		);
	}
	if (value.fulfillment !== undefined) {
		if (value.quote === undefined) throw new Error('Відпуск АЗС потребує пропозиції.');
		validateFulfillment(value.fulfillment);
	}
	return value as unknown as FuelStationFlowData;
}
