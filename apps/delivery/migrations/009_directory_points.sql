CREATE TABLE delivery_directory_points (
  carrier TEXT NOT NULL,
  ref TEXT NOT NULL,
  city_ref TEXT NOT NULL,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  number TEXT NOT NULL,
  category TEXT NOT NULL,
  status TEXT NOT NULL,
  type_ref TEXT NOT NULL,
  max_weight REAL,
  latitude REAL CHECK (latitude BETWEEN -90 AND 90),
  longitude REAL CHECK (longitude BETWEEN -180 AND 180),
  schedule_json TEXT NOT NULL,
  first_seen_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (carrier, ref)
);
CREATE INDEX delivery_directory_points_city ON delivery_directory_points(carrier, city_ref);