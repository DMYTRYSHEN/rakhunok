import { createHash, randomUUID } from 'node:crypto';
import type { Client, Row } from '@libsql/client';
import type { CarrierCode, DeliveryStatus, TrackingResult, TrackingState } from './carriers.ts';
import { validTrackingInput } from './carriers.ts';
import { sanitizeDetails } from './np-details.ts';
import type { NovaPoshtaDetails } from './np-details.ts';

export type TrackingEvent = {
	key: string;
	deliveryStatus: DeliveryStatus;
	label: string;
	occurredAt: string | null;
	observedAt: string;
};

export type Shipment = {
	id: string;
	carrier: CarrierCode;
	trackingNumber: string;
	trackingState: TrackingState;
	deliveryStatus: DeliveryStatus;
	providerStatusCode: string | null;
	providerStatusLabel: string | null;
	lastCheckedAt: string | null;
	lastSuccessAt: string | null;
	nextCheckAt: string | null;
	revision: number;
	events: TrackingEvent[];
	details: NovaPoshtaDetails | null;
};

export type TrackingClaim = Shipment & { leaseToken: string };

const statusLabels: Record<DeliveryStatus, string> = {
	unknown: 'Unknown status', label_created: 'Label created', accepted: 'Accepted by carrier',
	in_transit: 'In transit', customs: 'Customs processing', ready_for_pickup: 'Ready for pickup',
	out_for_delivery: 'Out for delivery', delivered: 'Delivered',
	delivery_attempt_failed: 'Delivery attempt failed', refused: 'Receipt refused',
	return_in_transit: 'Returning to sender', returned: 'Returned to sender',
	cancelled: 'Cancelled', lost: 'Loss confirmed', damaged: 'Damage confirmed', exception: 'Delivery exception'
};
const terminalStatuses = new Set<DeliveryStatus>(['delivered', 'returned', 'cancelled']);
const transientStates = new Set<TrackingState>(['pending', 'not_found', 'rate_limited', 'provider_unavailable']);

function requireOwner(ownerId: string): void {
	if (typeof ownerId !== 'string' || !ownerId.trim()) throw new Error('Trusted personal owner id required');
}

function validTime(value: string): string {
	if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(value) || !Number.isFinite(Date.parse(value))) {
		throw new Error('Invalid tracking timestamp');
	}
	return new Date(value).toISOString();
}

function snapshot(row: Row, events: Row[]): Shipment {
	return {
		id: String(row.id), carrier: row.carrier as CarrierCode, trackingNumber: String(row.tracking_number),
		details: typeof row.details_json === 'string' ? sanitizeDetails(JSON.parse(row.details_json)) : null,
		trackingState: row.tracking_state as TrackingState, deliveryStatus: row.delivery_status as DeliveryStatus,
		providerStatusCode: row.provider_status_code as string | null,
		providerStatusLabel: row.provider_status_label as string | null,
		lastCheckedAt: row.last_checked_at as string | null, lastSuccessAt: row.last_success_at as string | null,
		nextCheckAt: row.next_check_at as string | null, revision: Number(row.revision),
		events: events.map(event => ({
			key: String(event.event_key), deliveryStatus: event.delivery_status as DeliveryStatus,
			label: String(event.label), occurredAt: event.occurred_at as string | null, observedAt: String(event.observed_at)
		}))
	};
}

export class TrackingStore {
	private readonly client: Client;
	private readonly clock: () => Date;

	constructor(client: Client, clock: () => Date = () => new Date()) {
		this.client = client;
		this.clock = clock;
	}

	async create(ownerId: string, carrier: CarrierCode, trackingNumber: string): Promise<Shipment> {
		requireOwner(ownerId);
		if (!validTrackingInput(carrier, trackingNumber)) {
			throw new Error('Invalid carrier or tracking number');
		}
		const now = this.clock().toISOString();
		const results = await this.client.batch([
			{ sql: `INSERT INTO delivery_shipments
				(id, owner_id, carrier, tracking_number, next_check_at, created_at) VALUES (?, ?, ?, ?, ?, ?)
				ON CONFLICT(owner_id, carrier, tracking_number) DO NOTHING`,
				args: [randomUUID(), ownerId, carrier, trackingNumber, now, now] },
			{ sql: 'SELECT * FROM delivery_shipments WHERE owner_id = ? AND carrier = ? AND tracking_number = ?',
				args: [ownerId, carrier, trackingNumber] }
		], 'write');
		return (await this.get(String(results[1].rows[0].id), ownerId))!;
	}

	async list(ownerId: string): Promise<Shipment[]> {
		requireOwner(ownerId);
		const results = await this.client.batch([
			{ sql: 'SELECT * FROM delivery_shipments WHERE owner_id = ? ORDER BY created_at, id', args: [ownerId] },
			{ sql: 'SELECT * FROM delivery_events WHERE owner_id = ? ORDER BY observed_at, event_key', args: [ownerId] }
		], 'read');
		return results[0].rows.map(row => snapshot(row, results[1].rows.filter(event => event.shipment_id === row.id)));
	}

	async get(id: string, ownerId: string): Promise<Shipment | null> {
		requireOwner(ownerId);
		const results = await this.client.batch([
			{ sql: 'SELECT * FROM delivery_shipments WHERE id = ? AND owner_id = ?', args: [id, ownerId] },
			{ sql: 'SELECT * FROM delivery_events WHERE shipment_id = ? AND owner_id = ? ORDER BY observed_at, event_key',
				args: [id, ownerId] }
		], 'read');
		return results[0].rows[0] ? snapshot(results[0].rows[0], results[1].rows) : null;
	}

	async delete(id: string, ownerId: string): Promise<boolean> {
		requireOwner(ownerId);
		const results = await this.client.batch([
			{ sql: 'DELETE FROM delivery_events WHERE shipment_id = ? AND owner_id = ?', args: [id, ownerId] },
			{ sql: 'DELETE FROM delivery_shipments WHERE id = ? AND owner_id = ?', args: [id, ownerId] }
		], 'write');
		return results[1].rowsAffected === 1;
	}

	async pause(id: string, ownerId: string, paused = true): Promise<Shipment | null> {
		requireOwner(ownerId);
		const now = this.clock().toISOString();
		await this.client.execute({
			sql: `UPDATE delivery_shipments SET tracking_state = CASE
				WHEN delivery_status IN ('delivered', 'returned', 'cancelled') THEN 'completed'
				WHEN ? THEN 'paused' ELSE 'pending' END,
				next_check_at = CASE WHEN ? OR delivery_status IN ('delivered', 'returned', 'cancelled') THEN NULL ELSE ? END,
				lease_token = NULL, lease_until = NULL, revision = revision + 1 WHERE id = ? AND owner_id = ?`,
			args: [paused ? 1 : 0, paused ? 1 : 0, now, id, ownerId]
		});
		return this.get(id, ownerId);
	}

	async claim(id: string, ownerId: string): Promise<TrackingClaim | null> {
		requireOwner(ownerId);
		const now = this.clock();
		const token = randomUUID();
		const result = await this.client.execute({
			sql: `UPDATE delivery_shipments SET lease_token = ?, lease_until = ?
				WHERE id = ? AND owner_id = ? AND tracking_state != 'paused'
				AND (lease_until IS NULL OR lease_until <= ?) RETURNING *`,
			args: [token, new Date(now.getTime() + 30_000).toISOString(), id, ownerId, now.toISOString()]
		});
		return result.rows[0] ? { ...snapshot(result.rows[0], []), leaseToken: token } : null;
	}

	async getDue(ownerId: string, limit = 10): Promise<TrackingClaim[]> {
		requireOwner(ownerId);
		if (!Number.isInteger(limit) || limit < 1 || limit > 10) throw new Error('Claim limit must be between 1 and 10');
		const now = this.clock();
		const token = randomUUID();
		const result = await this.client.execute({
			sql: `UPDATE delivery_shipments SET lease_token = ?, lease_until = ? WHERE owner_id = ? AND id IN (
				SELECT id FROM delivery_shipments WHERE owner_id = ? AND next_check_at <= ?
				AND tracking_state NOT IN ('paused', 'completed') AND (lease_until IS NULL OR lease_until <= ?)
				ORDER BY next_check_at, id LIMIT ?) RETURNING *`,
			args: [token, new Date(now.getTime() + 30_000).toISOString(), ownerId, ownerId,
				now.toISOString(), now.toISOString(), limit]
		});
		return result.rows.map(row => ({ ...snapshot(row, []), leaseToken: token }));
	}

	async refresh(id: string, ownerId: string, result: TrackingResult, leaseToken?: string): Promise<Shipment | null> {
		requireOwner(ownerId);
		const token = leaseToken ?? (await this.claim(id, ownerId))?.leaseToken;
		if (!token) return null;
		const transaction = await this.client.transaction('write');
		try {
			const now = this.clock().toISOString();
			const rows = await transaction.execute({
				sql: 'SELECT * FROM delivery_shipments WHERE id = ? AND owner_id = ? AND lease_token = ? AND lease_until > ?',
				args: [id, ownerId, token, now]
			});
			const previous = rows.rows[0];
			if (!previous) return null;
			if (result.carrier !== previous.carrier || result.trackingNumber !== previous.tracking_number) {
				throw new Error('Tracking result does not match shipment');
			}
			const checkedAt = validTime(result.checkedAt);
			if (previous.last_checked_at && checkedAt < String(previous.last_checked_at)) throw new Error('Stale tracking result');
			const success = result.trackingState === 'active';
			const incomingStatus = Object.hasOwn(statusLabels, result.deliveryStatus) ? result.deliveryStatus : 'unknown';
			const preserve = !success || incomingStatus === 'unknown' && previous.delivery_status !== 'unknown';
			const status = (preserve ? previous.delivery_status : incomingStatus) as DeliveryStatus;
			const providerCode = preserve ? previous.provider_status_code :
				typeof result.providerStatusCode === 'string' && /^\d{1,12}$/.test(result.providerStatusCode)
					? result.providerStatusCode : null;
			const details = success && result.carrier === 'nova_poshta' && result.details ? sanitizeDetails(result.details) : null;
			const providerLabel = preserve ? previous.provider_status_label : details?.originalStatus ?? statusLabels[status];
			const failures = success ? 0 : Math.min(Number(previous.failure_count) + 1, 32);
			const completed = terminalStatuses.has(status);
			const retryAfter = Number.isFinite(result.retryAfterSeconds)
				? Math.max(60, Math.min(86400, Math.ceil(result.retryAfterSeconds!))) : 60;
			const delay = success ? 900 : Math.max(retryAfter,
				transientStates.has(result.trackingState) ? Math.min(86400, 60 * 2 ** (failures - 1)) : 86400);
			const nextCheck = completed ? null : new Date(Date.parse(now) + delay * 1000).toISOString();
			await transaction.execute({
				sql: `UPDATE delivery_shipments SET tracking_state = ?, delivery_status = ?, provider_status_code = ?,
					provider_status_label = ?, last_checked_at = ?, last_success_at = ?, next_check_at = ?,
					failure_count = ?, details_json = ?, revision = revision + 1, lease_token = NULL, lease_until = NULL
					WHERE id = ? AND owner_id = ? AND lease_token = ?`,
				args: [completed ? 'completed' : result.trackingState, status, providerCode, providerLabel, checkedAt,
					success ? checkedAt : previous.last_success_at, nextCheck, failures,
					details ? JSON.stringify(details) : previous.details_json ?? null, id, ownerId, token]
			});
			if (success) {
				const events = result.events.length ? result.events :
					!previous.last_success_at || status !== previous.delivery_status || providerCode !== previous.provider_status_code
						? [{ key: `observed:${Number(previous.revision) + 1}:${status}:${providerCode}`,
							deliveryStatus: status, label: statusLabels[status], occurredAt: null }] : [];
				for (const event of events) {
					const eventStatus = Object.hasOwn(statusLabels, event.deliveryStatus) ? event.deliveryStatus : 'unknown';
					await transaction.execute({
						sql: `INSERT INTO delivery_events (owner_id, shipment_id, event_key, delivery_status, label, occurred_at, observed_at)
							VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(owner_id, shipment_id, event_key) DO NOTHING`,
						args: [ownerId, id, createHash('sha256').update(event.key).digest('hex'), eventStatus,
							statusLabels[eventStatus], event.occurredAt === null ? null : validTime(event.occurredAt), checkedAt]
					});
				}
			}
			await transaction.commit();
		} finally {
			transaction.close();
		}
		return this.get(id, ownerId);
	}
}