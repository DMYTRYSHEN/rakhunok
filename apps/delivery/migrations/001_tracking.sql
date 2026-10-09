BEGIN IMMEDIATE;

CREATE TABLE IF NOT EXISTS delivery_shipments (
	id TEXT PRIMARY KEY,
	owner_id TEXT NOT NULL,
	carrier TEXT NOT NULL CHECK (carrier IN ('nova_poshta', 'ukrposhta')),
	tracking_number TEXT NOT NULL,
	tracking_state TEXT NOT NULL DEFAULT 'pending',
	delivery_status TEXT NOT NULL DEFAULT 'unknown',
	provider_status_code TEXT,
	provider_status_label TEXT,
	last_checked_at TEXT,
	last_success_at TEXT,
	next_check_at TEXT,
	revision INTEGER NOT NULL DEFAULT 0,
	failure_count INTEGER NOT NULL DEFAULT 0,
	lease_token TEXT,
	lease_until TEXT,
	created_at TEXT NOT NULL,
	UNIQUE (owner_id, carrier, tracking_number),
	UNIQUE (owner_id, id)
);

CREATE TABLE IF NOT EXISTS delivery_events (
	owner_id TEXT NOT NULL,
	shipment_id TEXT NOT NULL,
	event_key TEXT NOT NULL,
	delivery_status TEXT NOT NULL,
	label TEXT NOT NULL,
	occurred_at TEXT,
	observed_at TEXT NOT NULL,
	PRIMARY KEY (owner_id, shipment_id, event_key),
	FOREIGN KEY (owner_id, shipment_id) REFERENCES delivery_shipments(owner_id, id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS delivery_shipments_due ON delivery_shipments(next_check_at, lease_until)
	WHERE next_check_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS delivery_shipments_owner ON delivery_shipments(owner_id, created_at);

CREATE TRIGGER IF NOT EXISTS delivery_events_immutable
BEFORE UPDATE ON delivery_events
BEGIN
	SELECT RAISE(ABORT, 'Delivery events are immutable');
END;

COMMIT;