import { sanitizeNovaPoshta } from './np-details.ts';
import type { NovaPoshtaDetails } from './np-details.ts';

export type CarrierCode = 'nova_poshta' | 'ukrposhta' | 'meest';

export type DeliveryStatus =
	| 'unknown' | 'label_created' | 'accepted' | 'in_transit' | 'customs'
	| 'ready_for_pickup' | 'out_for_delivery' | 'delivered' | 'delivery_attempt_failed'
	| 'refused' | 'return_in_transit' | 'returned' | 'cancelled' | 'lost' | 'damaged'
	| 'exception';

export type TrackingState =
	| 'pending' | 'active' | 'needs_carrier' | 'needs_verification' | 'not_found'
	| 'rate_limited' | 'provider_unavailable' | 'access_denied' | 'unsupported'
	| 'paused' | 'completed' | 'expired';

export type TrackingConfig = {
	NOVA_POSHTA_API_KEY?: string;
	UKRPOSHTA_TRACKING_TOKEN?: string;
	MEEST_TRACKING_TOKEN?: string;
};

export type TrackingResult = {
	carrier: CarrierCode;
	trackingNumber: string;
	trackingState: TrackingState;
	deliveryStatus: DeliveryStatus;
	providerStatusCode: string | null;
	providerStatusLabel: string | null;
	checkedAt: string;
	events: Array<{ key: string; deliveryStatus: DeliveryStatus; label: string; occurredAt: string | null }>;
	retryAfterSeconds?: number;
	details?: NovaPoshtaDetails;
};

const labels: Record<DeliveryStatus, string> = {
	unknown: 'Unknown status', label_created: 'Label created', accepted: 'Accepted by carrier',
	in_transit: 'In transit', customs: 'Customs processing', ready_for_pickup: 'Ready for pickup',
	out_for_delivery: 'Out for delivery', delivered: 'Delivered',
	delivery_attempt_failed: 'Delivery attempt failed', refused: 'Receipt refused',
	return_in_transit: 'Returning to sender', returned: 'Returned to sender',
	cancelled: 'Cancelled', lost: 'Loss confirmed', damaged: 'Damage confirmed',
	exception: 'Delivery exception'
};

const npStatuses: Readonly<Record<string, DeliveryStatus>> = {
	'1': 'label_created', '2': 'cancelled', '4': 'in_transit', '41': 'in_transit',
	'5': 'in_transit', '6': 'in_transit', '7': 'ready_for_pickup', '8': 'ready_for_pickup',
	'9': 'delivered', '10': 'delivered', '11': 'delivered', '15': 'in_transit',
	'101': 'in_transit', '102': 'refused', '103': 'refused', '105': 'exception',
	'106': 'delivered', '107': 'in_transit', '111': 'delivery_attempt_failed',
	'112': 'exception', '124': 'exception'
};

const upStatuses: Readonly<Record<string, DeliveryStatus>> = {
	'10100': 'accepted', '10600': 'cancelled', '10602': 'cancelled', '10603': 'cancelled',
	'21400': 'exception',
	'20700': 'in_transit', '20800': 'in_transit', '20900': 'in_transit', '21500': 'in_transit',
	'21700': 'ready_for_pickup', '31100': 'delivery_attempt_failed',
	'31400': 'delivery_attempt_failed', '41000': 'delivered', '48000': 'delivered',
	'41010': 'returned', '31200': 'return_in_transit', '31300': 'in_transit',
	'21600': 'in_transit', '60700': 'in_transit', '70800': 'in_transit', '71200': 'in_transit',
	'80700': 'customs', '80800': 'in_transit', '80821': 'customs', '82700': 'customs', '87500': 'customs',
	'89000': 'customs', '82800': 'in_transit', '90700': 'in_transit', '90800': 'in_transit',
	'100800': 'in_transit', '100700': 'in_transit', '17100': 'accepted',
	'29500': 'out_for_delivery', '29700': 'ready_for_pickup', '35500': 'returned',
	'88500': 'customs', '89100': 'in_transit', '5001': 'delivered', '5002': 'delivered',
	'24100': 'exception', '24200': 'exception', '24300': 'exception',
	'24400': 'in_transit', '24500': 'in_transit', '27200': 'in_transit', '27900': 'in_transit',
	'29200': 'in_transit', '29300': 'in_transit', '35100': 'in_transit', '35200': 'in_transit',
	'35300': 'delivery_attempt_failed', '35400': 'exception', '35600': 'in_transit',
	'35700': 'exception', '36000': 'ready_for_pickup', '36200': 'exception',
	'36300': 'exception', '36400': 'exception', '36500': 'exception', '55800': 'exception',
	'55900': 'exception', '56100': 'exception', '67300': 'in_transit', '77600': 'in_transit',
	'97700': 'in_transit', '107400': 'in_transit', '107800': 'in_transit',
	'2100': 'in_transit', '2200': 'in_transit', '2201': 'in_transit', '3006': 'in_transit',
	'4001': 'in_transit', '4014': 'in_transit', '4021': 'in_transit', '4040': 'in_transit',
	'4082': 'return_in_transit', '5003': 'in_transit', '5004': 'returned', '5005': 'customs',
	...Object.fromEntries(Array.from({ length: 12 }, (_, index) => [String(80830 + index), 'customs' as const]))
};

const maximumBytes = 1024 * 1024;
const timeoutMilliseconds = 8000;

function record(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function code(value: unknown): string | null {
	const text = typeof value === 'number' && Number.isSafeInteger(value) ? String(value) : value;
	return typeof text === 'string' && /^\d{1,12}$/.test(text) ? text : null;
}

function timestamp(value: unknown): string | null {
	if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return null;
	if (Number(value.slice(11, 13)) > 23 || Number(value.slice(14, 16)) > 59 || Number(value.slice(17, 19)) > 59) return null;
	if (!value.endsWith('Z') && (Number(value.slice(-5, -3)) > 23 || Number(value.slice(-2)) > 59)) return null;
	const day = value.slice(0, 10);
	const date = new Date(`${day}T00:00:00Z`);
	if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== day) return null;
	return Number.isFinite(Date.parse(value)) ? value : null;
}

function retryAfter(value: string | null): number | undefined {
	if (!value) return undefined;
	const seconds = /^\d+$/.test(value) ? Number(value) :
		/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun), \d{2} [A-Z][a-z]{2} \d{4} \d{2}:\d{2}:\d{2} GMT$/.test(value)
			? Math.ceil((Date.parse(value) - Date.now()) / 1000) : NaN;
	return Number.isSafeInteger(seconds) ? Math.max(0, seconds) : undefined;
}

export async function boundedJson(response: Response, signal: AbortSignal): Promise<unknown> {
	const length = response.headers.get('content-length');
	if (length && /^\d+$/.test(length) && Number(length) >= maximumBytes) {
		void response.body?.cancel().catch(() => {});
		throw new Error('Response too large');
	}
	if (!response.body) throw new Error('Missing response body');
	const reader = response.body.getReader();
	const abort = () => { void reader.cancel().catch(() => {}); };
	signal.addEventListener('abort', abort, { once: true });
	const decoder = new TextDecoder('utf-8', { fatal: true });
	let bytes = 0;
	let text = '';
	try {
		while (true) {
			signal.throwIfAborted();
			const chunk = await reader.read();
			signal.throwIfAborted();
			if (chunk.done) break;
			bytes += chunk.value.byteLength;
			if (bytes >= maximumBytes) throw new Error('Response too large');
			text += decoder.decode(chunk.value, { stream: true });
		}
		text += decoder.decode();
		return JSON.parse(text);
	} catch (error) {
		void reader.cancel().catch(() => {});
		throw error;
	} finally {
		signal.removeEventListener('abort', abort);
		reader.releaseLock();
	}
}

function novaPoshta(payload: unknown, result: TrackingResult): TrackingResult {
	if (!record(payload) || payload.success !== true || !Array.isArray(payload.data) ||
		(Array.isArray(payload.errors) && payload.errors.length > 0) ||
		(Array.isArray(payload.errorCodes) && payload.errorCodes.length > 0)) return result;
	if (payload.data.length !== 1) return result;
	const item: unknown = payload.data[0];
	if (!record(item) || item.Number !== result.trackingNumber) return result;
	const statusCode = code(item.StatusCode);
	if (!statusCode) return result;
	if (statusCode === '3') return { ...result, trackingState: 'not_found', providerStatusCode: statusCode, providerStatusLabel: 'Number not found' };
	const status = npStatuses[statusCode] ?? 'unknown';
	return {
		...result, trackingState: 'active', deliveryStatus: status,
		providerStatusCode: statusCode, providerStatusLabel: labels[status],
		details: sanitizeNovaPoshta(item),
		events: []
	};
}

function ukrposhta(payload: unknown, result: TrackingResult): TrackingResult {
	if (record(payload) && payload.code === 'UPE02000') return { ...result, trackingState: 'unsupported' };
	if (!record(payload) || !record(payload.found) || !Array.isArray(payload.notFound)) return result;
	const items: unknown = Object.hasOwn(payload.found, result.trackingNumber) ? payload.found[result.trackingNumber] : undefined;
	if (payload.notFound.includes(result.trackingNumber)) {
		return items === undefined ? { ...result, trackingState: 'not_found' } : result;
	}
	if (!Array.isArray(items) || items.length === 0 || items.length > 1000) return result;
	const events: Array<{ event: TrackingResult['events'][number]; statusCode: string; order: number; zoned: boolean }> = [];
	for (const item of items) {
		if (!record(item) || item.barcode !== result.trackingNumber) return result;
		const statusCode = code(item.event);
		if (!statusCode || typeof item.date !== 'string') return result;
		const zonedTime = timestamp(item.date);
		const localTime = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?$/.test(item.date) ? timestamp(`${item.date}Z`) : null;
		if (!zonedTime && !localTime) return result;
		const status = statusCode === '41000' && (item.eventReason_id === 10 || item.eventReason_id === '10')
			? 'returned' : upStatuses[statusCode] ?? 'unknown';
		const step = typeof item.step === 'number' && Number.isSafeInteger(item.step) && item.step >= 0 ? String(item.step) : '';
		events.push({
			event: { key: `ukrposhta:${step}:${statusCode}:${status}:${item.date}`, deliveryStatus: status, label: labels[status], occurredAt: zonedTime },
			statusCode, order: Date.parse(zonedTime ?? localTime!), zoned: zonedTime !== null
		});
	}
	if (events.some(item => item.zoned !== events[0].zoned)) return result;
	events.sort((left, right) => left.order - right.order);
	const latest = events[events.length - 1];
	if (events.some(item => item.order === latest.order &&
		(item.statusCode !== latest.statusCode || item.event.deliveryStatus !== latest.event.deliveryStatus))) return result;
	return {
		...result, trackingState: 'active', deliveryStatus: latest.event.deliveryStatus,
		providerStatusCode: latest.statusCode, providerStatusLabel: latest.event.label,
		events: [...new Map(events.map(item => [item.event.key, item.event])).values()]
	};
}

const meestStatuses: Readonly<Record<string, DeliveryStatus>> = {
	'2': 'label_created', '3': 'cancelled', '101': 'label_created',
	'11': 'in_transit', '12': 'in_transit', '1100': 'in_transit',
	'202': 'in_transit', '303': 'in_transit', '404': 'in_transit', '405': 'in_transit',
	'505': 'in_transit', '606': 'accepted', '808': 'in_transit', '8081': 'in_transit',
	'109': 'return_in_transit', '707': 'return_in_transit', '1521': 'return_in_transit',
	'1216': 'ready_for_pickup', '1315': 'out_for_delivery',
	'1601': 'delivery_attempt_failed', '1620': 'refused', '1622': 'delivered',
	'1623': 'delivery_attempt_failed', '1624': 'delivery_attempt_failed',
	'1625': 'delivery_attempt_failed', '1626': 'delivery_attempt_failed',
	'1627': 'delivery_attempt_failed', '1628': 'delivery_attempt_failed',
	'1629': 'lost', '1630': 'exception', '1825': 'returned',
	'2225': 'customs', '2230': 'customs', '2331': 'exception', '5700': 'cancelled'
};

export function validTrackingInput(carrier: unknown, number: unknown): carrier is CarrierCode {
	return typeof number === 'string' && (carrier === 'meest'
		? number.length <= 64 && /^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$/.test(number)
		: (carrier === 'nova_poshta' || carrier === 'ukrposhta') && /^[A-Za-z0-9]{1,64}$/.test(number));
}

function meest(payload: unknown, result: TrackingResult): TrackingResult {
	if (!record(payload) || payload.status !== 'ok' || !record(payload.info)) return result;
	const info = payload.info;
	if (['fieldName', 'message', 'messageDetails'].some(field => info[field] !== undefined && info[field] !== '') ||
		!Array.isArray(payload.result) || payload.result.length === 0 || payload.result.length > 1000) return result;
	const events: Array<{ event: TrackingResult['events'][number]; statusCode: string; order: number }> = [];
	let identity: string | undefined;
	for (const item of payload.result) {
		if (!record(item) || !validTrackingInput('meest', item.parcelNumber) || !validTrackingInput('meest', item.barCode) ||
			(item.parcelNumber !== result.trackingNumber && item.barCode !== result.trackingNumber)) return result;
		const pair = JSON.stringify([item.parcelNumber, item.barCode]);
		if (identity !== undefined && identity !== pair) return result;
		identity = pair;
		if (typeof item.eventCode !== 'number' || !Number.isSafeInteger(item.eventCode) || item.eventCode < 0 || item.eventCode > 2147483647 ||
			typeof item.eventDateTime !== 'string' || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(item.eventDateTime)) return result;
		const localTime = timestamp(`${item.eventDateTime.replace(' ', 'T')}Z`);
		if (!localTime) return result;
		const statusCode = String(item.eventCode);
		const status = meestStatuses[statusCode] ?? 'unknown';
		events.push({ event: { key: `meest:${statusCode}:${item.eventDateTime}`, deliveryStatus: status,
			label: labels[status], occurredAt: null }, statusCode, order: Date.parse(localTime) });
	}
	events.sort((left, right) => left.order - right.order);
	const latest = events[events.length - 1];
	if (events.some(item => item.order === latest.order && item.statusCode !== latest.statusCode)) return result;
	return { ...result, trackingState: 'active', deliveryStatus: latest.event.deliveryStatus,
		providerStatusCode: latest.statusCode, providerStatusLabel: latest.event.label,
		events: [...new Map(events.map(item => [item.event.key, item.event])).values()] };
}

export async function track(
	carrier: CarrierCode,
	number: string,
	config: TrackingConfig,
	transport: typeof fetch = fetch
): Promise<TrackingResult> {
	const result: TrackingResult = {
		carrier, trackingNumber: number, trackingState: 'provider_unavailable', deliveryStatus: 'unknown',
		providerStatusCode: null, providerStatusLabel: null, checkedAt: new Date().toISOString(), events: []
	};
	if (carrier !== 'nova_poshta' && carrier !== 'ukrposhta' && carrier !== 'meest') return { ...result, trackingState: 'unsupported' };
	if (!validTrackingInput(carrier, number)) return { ...result, trackingState: 'needs_verification' };
	const upToken = config.UKRPOSHTA_TRACKING_TOKEN?.trim();
	if (carrier === 'ukrposhta' && (!upToken || /[\r\n]/.test(config.UKRPOSHTA_TRACKING_TOKEN!))) return { ...result, trackingState: 'access_denied' };
	const meestToken = config.MEEST_TRACKING_TOKEN?.trim();
	if (carrier === 'meest' && (!meestToken || /[\r\n]/.test(config.MEEST_TRACKING_TOKEN!))) return { ...result, trackingState: 'access_denied' };
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), timeoutMilliseconds);
	try {
		const isNp = carrier === 'nova_poshta';
		const response = carrier === 'meest' ? await transport(`https://api.meest.com/v3.0/openAPI/tracking/${encodeURIComponent(number)}`, {
			method: 'GET', redirect: 'manual', signal: controller.signal,
			headers: { 'Content-Type': 'application/json', Accept: 'application/json', token: meestToken! }
		}) : await transport(isNp ? 'https://api.novaposhta.ua/v2.0/json/' :
			'https://www.ukrposhta.ua/status-tracking/0.0.1/statuses/with-not-found', {
			method: 'POST', redirect: 'manual', signal: controller.signal,
			headers: { 'Content-Type': 'application/json', Accept: 'application/json',
				...(!isNp ? { Authorization: `Bearer ${upToken}` } : {}) },
			body: JSON.stringify(isNp ? {
				...(config.NOVA_POSHTA_API_KEY ? { apiKey: config.NOVA_POSHTA_API_KEY } : {}),
				modelName: 'TrackingDocumentGeneral', calledMethod: 'getStatusDocuments',
				methodProperties: { Documents: [{ DocumentNumber: number }] }
			} : [number])
		});
		if (response.redirected || response.status >= 300 && response.status < 400) {
			void response.body?.cancel().catch(() => {});
			return result;
		}
		if (response.status === 429) {
			void response.body?.cancel().catch(() => {});
			const seconds = retryAfter(response.headers.get('retry-after'));
			return { ...result, trackingState: 'rate_limited', ...(seconds !== undefined ? { retryAfterSeconds: seconds } : {}) };
		}
		if (response.status === 401 || response.status === 403) {
			void response.body?.cancel().catch(() => {});
			return { ...result, trackingState: 'access_denied' };
		}
		if (!response.ok) {
			void response.body?.cancel().catch(() => {});
			return result;
		}
		const payload = await boundedJson(response, controller.signal);
		return carrier === 'meest' ? meest(payload, result) : isNp ? novaPoshta(payload, result) : ukrposhta(payload, result);
	} catch {
		return result;
	} finally {
		clearTimeout(timeout);
	}
}