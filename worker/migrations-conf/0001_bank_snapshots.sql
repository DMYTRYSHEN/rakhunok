CREATE TABLE conf_bank_snapshots (
    content_hash TEXT PRIMARY KEY NOT NULL CHECK(length(content_hash) = 64),
    source_url TEXT NOT NULL,
    payload_json TEXT NOT NULL CHECK(json_valid(payload_json)),
    bank_count INTEGER NOT NULL CHECK(bank_count BETWEEN 1 AND 500),
    imported_by TEXT NOT NULL,
    imported_at TEXT NOT NULL
);