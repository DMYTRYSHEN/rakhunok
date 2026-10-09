CREATE TABLE delivery_customers (
    owner_id TEXT NOT NULL,
    id TEXT NOT NULL,
    name TEXT NOT NULL CHECK(length(name) BETWEEN 3 AND 150),
    phone TEXT NOT NULL CHECK(length(phone) = 13),
    PRIMARY KEY (owner_id, id),
    UNIQUE (owner_id, phone)
);