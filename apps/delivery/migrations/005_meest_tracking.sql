CREATE TABLE delivery_shipments_meest (
	id TEXT PRIMARY KEY,
	owner_id TEXT NOT NULL,
	carrier TEXT NOT NULL CHECK (carrier IN ('nova_poshta', 'ukrposhta', 'meest')),
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
	details_json TEXT,
	UNIQUE (owner_id, carrier, tracking_number),
	UNIQUE (owner_id, id)
);
INSERT INTO delivery_shipments_meest
	(id, owner_id, carrier, tracking_number, tracking_state, delivery_status, provider_status_code,
	provider_status_label, last_checked_at, last_success_at, next_check_at, revision, failure_count,
	lease_token, lease_until, created_at, details_json)
SELECT id, owner_id, carrier, tracking_number, tracking_state, delivery_status, provider_status_code,
	provider_status_label, last_checked_at, last_success_at, next_check_at, revision, failure_count,
	lease_token, lease_until, created_at, details_json FROM delivery_shipments;

CREATE TABLE delivery_events_meest (
	owner_id TEXT NOT NULL,
	shipment_id TEXT NOT NULL,
	event_key TEXT NOT NULL,
	delivery_status TEXT NOT NULL,
	label TEXT NOT NULL,
	occurred_at TEXT,
	observed_at TEXT NOT NULL,
	PRIMARY KEY (owner_id, shipment_id, event_key),
	FOREIGN KEY (owner_id, shipment_id) REFERENCES delivery_shipments_meest(owner_id, id) ON DELETE CASCADE
);
INSERT INTO delivery_events_meest SELECT owner_id, shipment_id, event_key, delivery_status,
	label, occurred_at, observed_at FROM delivery_events;
DROP TABLE delivery_events;
DROP TABLE delivery_shipments;
ALTER TABLE delivery_shipments_meest RENAME TO delivery_shipments;
ALTER TABLE delivery_events_meest RENAME TO delivery_events;
CREATE INDEX delivery_shipments_due ON delivery_shipments(next_check_at, lease_until) WHERE next_check_at IS NOT NULL;
CREATE INDEX delivery_shipments_owner ON delivery_shipments(owner_id, created_at);
CREATE TRIGGER delivery_events_immutable BEFORE UPDATE ON delivery_events
BEGIN
	SELECT RAISE(ABORT, 'Delivery events are immutable');
END;