CREATE TABLE conf_banks (
    id TEXT PRIMARY KEY NOT NULL,
    payload_json TEXT NOT NULL CHECK(json_valid(payload_json) AND json_type(payload_json) = 'object'),
    code TEXT GENERATED ALWAYS AS (json_extract(payload_json, '$.code')) STORED NOT NULL,
    name TEXT GENERATED ALWAYS AS (json_extract(payload_json, '$.name')) STORED NOT NULL,
    active INTEGER GENERATED ALWAYS AS (
        CASE json_type(payload_json, '$.active')
            WHEN 'true' THEN 1 WHEN 'false' THEN 0 ELSE NULL END
    ) STORED,
    snapshot_hash TEXT NOT NULL REFERENCES conf_bank_snapshots(content_hash),
    CHECK(id = json_extract(payload_json, '$.id'))
);

CREATE INDEX conf_banks_code_idx ON conf_banks(code COLLATE NOCASE);
CREATE INDEX conf_banks_snapshot_idx ON conf_banks(snapshot_hash);

INSERT INTO conf_banks (id, payload_json, snapshot_hash)
SELECT json_extract(bank.value, '$.id'), bank.value, snapshot.content_hash
FROM conf_bank_snapshots AS snapshot, json_each(snapshot.payload_json) AS bank
WHERE snapshot.content_hash = (
    SELECT content_hash FROM conf_bank_snapshots ORDER BY imported_at DESC, content_hash DESC LIMIT 1
);