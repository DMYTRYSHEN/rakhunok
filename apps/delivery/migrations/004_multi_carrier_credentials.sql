CREATE TABLE delivery_carrier_credentials_v2 (
    owner_id TEXT NOT NULL CHECK (length(trim(owner_id)) > 0),
    carrier TEXT NOT NULL CHECK (carrier IN ('nova_poshta', 'ukrposhta', 'meest')),
    ciphertext TEXT NOT NULL CHECK (length(ciphertext) BETWEEN 4 AND 1368),
    version INTEGER NOT NULL CHECK (version = 1),
    nonce TEXT NOT NULL CHECK (length(nonce) = 16),
    tag TEXT NOT NULL CHECK (length(tag) = 24),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (owner_id, carrier)
);
INSERT INTO delivery_carrier_credentials_v2 SELECT * FROM delivery_carrier_credentials;
DROP TABLE delivery_carrier_credentials;
ALTER TABLE delivery_carrier_credentials_v2 RENAME TO delivery_carrier_credentials;