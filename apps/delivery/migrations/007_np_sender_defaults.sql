CREATE TABLE delivery_np_sender_defaults (
    owner_id TEXT PRIMARY KEY,
    credential_hash TEXT NOT NULL,
    sender_ref TEXT NOT NULL,
    contact_ref TEXT NOT NULL
);