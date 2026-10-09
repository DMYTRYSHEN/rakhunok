CREATE TABLE delivery_carrier_credentials (
    owner_id TEXT NOT NULL CHECK (length(trim(owner_id)) > 0),
    carrier TEXT NOT NULL CHECK (carrier = 'nova_poshta'),
    ciphertext TEXT NOT NULL CHECK (length(ciphertext) = 44),
    version INTEGER NOT NULL CHECK (version = 1),
    nonce TEXT NOT NULL CHECK (length(nonce) = 16),
    tag TEXT NOT NULL CHECK (length(tag) = 24),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (owner_id, carrier)
);