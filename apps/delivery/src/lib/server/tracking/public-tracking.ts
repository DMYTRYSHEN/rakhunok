import { track, validTrackingInput } from './carriers.ts';
import type { CarrierCode, DeliveryStatus, TrackingConfig, TrackingState } from './carriers.ts';

export type PublicTrackingResult = {
	carrier: CarrierCode;
	trackingNumber: string;
	trackingState: TrackingState;
	deliveryStatus: DeliveryStatus;
	checkedAt: string;
	providerStatusCode: string | null;
};

export class PublicTrackingError extends Error {
	readonly status = 400;

	constructor() {
		super('Invalid tracking number');
		this.name = 'PublicTrackingError';
	}
}

const trackingStates = new Set<TrackingState>([
	'pending', 'active', 'needs_carrier', 'needs_verification', 'not_found',
	'rate_limited', 'provider_unavailable', 'access_denied', 'unsupported',
	'paused', 'completed', 'expired'
]);
const deliveryStatuses = new Set<DeliveryStatus>([
	'unknown', 'label_created', 'accepted', 'in_transit', 'customs',
	'ready_for_pickup', 'out_for_delivery', 'delivered', 'delivery_attempt_failed',
	'refused', 'return_in_transit', 'returned', 'cancelled', 'lost', 'damaged', 'exception'
]);

export class PublicTracking {
	private readonly transport: typeof fetch;
	private readonly tracker: typeof track;
	private readonly clock: () => number;
	private readonly cache = new Map<string, { expiresAt: number; result: PublicTrackingResult }>();
	private readonly inflight = new Map<string, Promise<PublicTrackingResult>>();
	private calls: number[] = [];

	constructor(transport: typeof fetch = fetch, tracker: typeof track = track, clock: () => number = Date.now) {
		this.transport = transport;
		this.tracker = tracker;
		this.clock = clock;
	}

	async lookup(number: string, config: TrackingConfig, explicitCarrier?: unknown): Promise<PublicTrackingResult> {
		if (typeof number !== 'string' || number.length > 64) throw new PublicTrackingError();
		const trackingNumber = number.trim().toUpperCase();
		const carrier = explicitCarrier ?? (/^\d{14}$/.test(trackingNumber) ? 'nova_poshta' : 'ukrposhta');
		if (!validTrackingInput(carrier, trackingNumber) || (carrier !== 'meest' &&
			!(carrier === 'nova_poshta' ? /^\d{14}$/.test(trackingNumber) : /^\d{13}$/.test(trackingNumber) || /^[A-Z]{2}\d{9}[A-Z]{2}$/.test(trackingNumber)))) throw new PublicTrackingError();
		const cacheKey = `${carrier}:${trackingNumber}`;
		const now = this.clock();
		for (const [key, entry] of this.cache) {
			if (entry.expiresAt <= now) this.cache.delete(key);
		}
		const cached = this.cache.get(cacheKey);
		if (cached) return { ...cached.result };
		const pending = this.inflight.get(cacheKey);
		if (pending) return { ...await pending };
		this.calls = this.calls.filter(startedAt => startedAt > now - 60_000);
		if (this.inflight.size >= 100 || this.calls.length >= 30) {
			return this.result(carrier, trackingNumber, 'rate_limited', 'unknown', null, now);
		}
		this.calls.push(now);
		const credentials: TrackingConfig = carrier === 'nova_poshta' ? {} : carrier === 'meest' ? {
			MEEST_TRACKING_TOKEN: config.MEEST_TRACKING_TOKEN
		} : {
			UKRPOSHTA_TRACKING_TOKEN: config.UKRPOSHTA_TRACKING_TOKEN
		};
		const operation = Promise.resolve().then(async () => {
			let result: PublicTrackingResult;
			try {
				const tracked = await this.tracker(carrier, trackingNumber, credentials, this.transport);
				if (!tracked || tracked.carrier !== carrier || tracked.trackingNumber !== trackingNumber ||
					!trackingStates.has(tracked.trackingState) || !deliveryStatuses.has(tracked.deliveryStatus)) {
					throw new Error('Invalid carrier result');
				}
				const providerStatusCode = typeof tracked.providerStatusCode === 'string' &&
					/^\d{1,12}$/.test(tracked.providerStatusCode) ? tracked.providerStatusCode : null;
				result = this.result(carrier, trackingNumber, tracked.trackingState,
					tracked.deliveryStatus, providerStatusCode, this.clock());
			} catch {
				result = this.result(carrier, trackingNumber, 'provider_unavailable', 'unknown', null, this.clock());
			}
			if (this.cache.size >= 100) this.cache.delete(this.cache.keys().next().value!);
			this.cache.set(cacheKey, {
				expiresAt: this.clock() + (result.trackingState === 'active' ? 30_000 : 5_000),
				result
			});
			return result;
		});
		this.inflight.set(cacheKey, operation);
		try {
			return { ...await operation };
		} finally {
			this.inflight.delete(cacheKey);
		}
	}

	private result(
		carrier: CarrierCode, trackingNumber: string, trackingState: TrackingState,
		deliveryStatus: DeliveryStatus, providerStatusCode: string | null, now: number
	): PublicTrackingResult {
		return {
			carrier, trackingNumber, trackingState, deliveryStatus,
			checkedAt: new Date(now).toISOString(), providerStatusCode
		};
	}
}

export const publicTracking = new PublicTracking();