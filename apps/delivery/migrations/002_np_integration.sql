ALTER TABLE delivery_shipments ADD COLUMN details_json TEXT;
CREATE TABLE delivery_shipping_drafts (
	id TEXT PRIMARY KEY,
	owner_id TEXT NOT NULL,
	idempotency_key TEXT NOT NULL,
	payload_json TEXT NOT NULL,
	created_at TEXT NOT NULL,
	UNIQUE (owner_id, idempotency_key)
);
CREATE INDEX delivery_shipping_drafts_owner ON delivery_shipping_drafts(owner_id, created_at);