CREATE TABLE delivery_np_documents (
 id TEXT PRIMARY KEY,
 owner_id TEXT NOT NULL,
 fingerprint TEXT NOT NULL,
 credential_hash TEXT NOT NULL,
 state TEXT NOT NULL CHECK (state IN ('submitting', 'issued', 'outcome_unknown')),
 document_ref TEXT,
 tracking_number TEXT,
 created_at TEXT NOT NULL,
 UNIQUE(owner_id, fingerprint)
);
CREATE INDEX delivery_np_documents_owner ON delivery_np_documents(owner_id, created_at);