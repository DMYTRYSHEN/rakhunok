import { sqliteTable, text, integer, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const tenants = sqliteTable('tenants', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	plan: text('plan').notNull().default('free'),
	retentionPolicy: integer('retention_policy').notNull().default(180), // days
	status: text('status').notNull().default('active')
});

export const carrierCapabilities = sqliteTable('carrier_capabilities', {
	code: text('code').primaryKey(),
	enabled: integer('enabled', { mode: 'boolean' }).notNull().default(false),
	capabilities: text('capabilities', { mode: 'json' }).notNull(),
	adapterVersion: text('adapter_version').notNull()
});

export const carrierConnections = sqliteTable('carrier_connections', {
	tenantId: text('tenant_id').notNull().references(() => tenants.id),
	carrierCode: text('carrier_code').notNull(),
	credentialRef: text('credential_ref').notNull(),
	accessScope: text('access_scope').notNull()
}, (table) => ({
    unq: uniqueIndex('unq_tenant_carrier').on(table.tenantId, table.carrierCode)
}));

export const shipments = sqliteTable('shipments', {
	id: text('id').primaryKey(),
	tenantId: text('tenant_id').notNull().references(() => tenants.id),
	trackingNumber: text('tracking_number').notNull(),
	carrierCode: text('carrier_code'),
	trackingCycle: text('tracking_cycle').notNull(),
	deliveryStatus: text('delivery_status').notNull().default('unknown'),
	trackingState: text('tracking_state').notNull().default('pending'),
	revision: integer('revision').notNull().default(1),
    lastCheckedAt: integer('last_checked_at', { mode: 'timestamp' }),
    nextCheckAt: integer('next_check_at', { mode: 'timestamp' })
});

export const trackingEvents = sqliteTable('tracking_events', {
	id: text('id').primaryKey(),
	tenantId: text('tenant_id').notNull().references(() => tenants.id),
	shipmentId: text('shipment_id').notNull().references(() => shipments.id),
	sourceEventId: text('source_event_id'),
	dedupeKey: text('dedupe_key').notNull(),
	payload: text('payload', { mode: 'json' }),
	occurredAt: integer('occurred_at', { mode: 'timestamp' }),
	receivedAt: integer('received_at', { mode: 'timestamp' }).notNull(),
	mappingVersion: text('mapping_version')
});

// Outbox pattern for event delivery and webhooks
export const outboxEvents = sqliteTable('outbox_events', {
	id: text('id').primaryKey(),
	tenantId: text('tenant_id').notNull().references(() => tenants.id),
	eventId: text('event_id').notNull(),
	shipmentId: text('shipment_id').notNull(),
	revision: integer('revision').notNull(),
	type: text('type').notNull(),
	createdAt: integer('created_at', { mode: 'timestamp' }).notNull()
});
