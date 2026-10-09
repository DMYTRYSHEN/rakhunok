import type { Client, Row } from '@libsql/client';

const columns = 'id, carrier, tracking_number, tracking_state, delivery_status, provider_status_code, last_checked_at, last_success_at, revision';

function summary(row: Row) {
	return {
		id: String(row.id), carrier: String(row.carrier), trackingNumber: String(row.tracking_number),
		trackingState: String(row.tracking_state), deliveryStatus: String(row.delivery_status),
		providerStatusCode: row.provider_status_code, lastCheckedAt: row.last_checked_at,
		lastSuccessAt: row.last_success_at, revision: Number(row.revision)
	};
}

function bounds(ownerId: string, limit: number, offset: number) {
	if (!ownerId.trim() || !Number.isInteger(limit) || limit < 1 || limit > 50 ||
		!Number.isInteger(offset) || offset < 0 || offset > 10000) throw new Error('Invalid read bounds');
}

export function createReadModel(client: Client) {
	return {
		async list(ownerId: string, limit: number, offset: number) {
			bounds(ownerId, limit, offset);
			const result = await client.execute({
				sql: `SELECT ${columns} FROM delivery_shipments WHERE owner_id = ? ORDER BY created_at, id LIMIT ? OFFSET ?`,
				args: [ownerId, limit + 1, offset]
			});
			return { shipments: result.rows.slice(0, limit).map(summary),
				nextOffset: result.rows.length > limit && offset + limit <= 10000 ? offset + limit : null };
		},
		async get(ownerId: string, id: string) {
			bounds(ownerId, 1, 0);
			const result = await client.execute({
				sql: `SELECT ${columns} FROM delivery_shipments WHERE owner_id = ? AND id = ?`, args: [ownerId, id]
			});
			return result.rows[0] ? summary(result.rows[0]) : null;
		},
		async tracking(ownerId: string, id: string, limit: number, offset: number) {
			bounds(ownerId, limit, offset);
			const shipment = await this.get(ownerId, id);
			if (!shipment) return null;
			const result = await client.execute({
				sql: `SELECT delivery_status, occurred_at, observed_at FROM delivery_events
					WHERE owner_id = ? AND shipment_id = ? ORDER BY observed_at, event_key LIMIT ? OFFSET ?`,
				args: [ownerId, id, limit + 1, offset]
			});
			return { shipment, source: 'stored_snapshot', events: result.rows.slice(0, limit).map(row => ({
				deliveryStatus: row.delivery_status, occurredAt: row.occurred_at, observedAt: row.observed_at
			})), nextOffset: result.rows.length > limit && offset + limit <= 10000 ? offset + limit : null };
		}
	};
}

export type DeliveryReadModel = ReturnType<typeof createReadModel>;