import type { CarrierCode, TrackingResult } from './carriers.ts';
import { TrackingStore } from './store.ts';
import type { Shipment, TrackingClaim } from './store.ts';

export type CarrierTrack = (carrier: CarrierCode, trackingNumber: string, ownerId: string) => Promise<TrackingResult>;
export type ScheduledResult = { id: string; shipment: Shipment | null; error: string | null };

export class TrackingService {
	private readonly store: TrackingStore;
	private readonly track: CarrierTrack;
	private readonly clock: () => Date;

	constructor(store: TrackingStore, track: CarrierTrack, clock: () => Date = () => new Date()) {
		this.store = store;
		this.track = track;
		this.clock = clock;
	}

	async refresh(id: string, ownerId: string): Promise<Shipment | null> {
		const claim = await this.store.claim(id, ownerId);
		return claim ? this.refreshClaim(claim, ownerId) : null;
	}

	async runDue(ownerId: string, limit = 10): Promise<ScheduledResult[]> {
		if (!Number.isInteger(limit) || limit < 1 || limit > 10) throw new Error('Claim limit must be between 1 and 10');
		const results: ScheduledResult[] = [];
		for (let index = 0; index < limit; index++) {
			const [claim] = await this.store.getDue(ownerId, 1);
			if (!claim) break;
			try {
				results.push({ id: claim.id, shipment: await this.refreshClaim(claim, ownerId), error: null });
			} catch {
				results.push({ id: claim.id, shipment: null, error: 'Tracking job failed' });
			}
		}
		return results;
	}

	private async refreshClaim(claim: TrackingClaim, ownerId: string): Promise<Shipment | null> {
		let result: TrackingResult;
		try {
			result = await this.track(claim.carrier, claim.trackingNumber, ownerId);
		} catch {
			result = {
				carrier: claim.carrier, trackingNumber: claim.trackingNumber,
				trackingState: 'provider_unavailable', deliveryStatus: 'unknown', providerStatusCode: null,
				providerStatusLabel: null, checkedAt: this.clock().toISOString(), events: []
			};
		}
		return this.store.refresh(claim.id, ownerId, result, claim.leaseToken);
	}
}