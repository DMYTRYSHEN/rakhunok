# Meest Read-Only Tracking

The adapter implements the official [OpenAPI specification](https://wiki.meest-group.com/api/files/openAPI_ua.json?v=582410):
`GET https://api.meest.com/v3.0/openAPI/tracking/{trackNumber}` with JSON Accept/Content-Type
and a server-only `token` header. The documented token lifetime is 86400 seconds
(24 hours). Authentication, renewal, shipment creation and credential management
are not implemented by this adapter.

The documented success envelope is `status: "ok"`, empty `info` fields and a
`result` event array. Each event has `parcelNumber`, `barCode`, integer `eventCode`
and local `eventDateTime`, for example `TAC-2550636`, `711-2550636`, `606`,
`2019-05-02 11:21:42`. Both identifiers must be safe and consistent throughout
the response; either must exactly match the requested number. Provider text,
locations, names, phones, addresses and alias identifiers are never returned.

Verified numeric events normalize to generated status labels; ambiguous or
unknown codes remain `unknown`. Codes 1622 and 1825 mean delivered and returned
respectively. Pickup cancellation 316 does not prove shipment cancellation.
Local event times establish history order but `occurredAt` remains null because
the response does not establish a timezone. Conflicting latest events reject
the response. Empty history is `provider_unavailable`, not invented `not_found`.

Transport rejects redirects, limits decoded JSON to less than 1 MiB and history
to 1000 events, and aborts after eight seconds. HTTP 401/403 means access denied;
429 retains sanitized Retry-After; malformed responses and other errors remain
provider unavailable without provider error text.

## Integration Boundary

`track('meest', number, { MEEST_TRACKING_TOKEN })` and
`PublicTracking.lookup(number, config, 'meest')` support caller-supplied tokens.
Public route `/{trackingNumber}?carrier=meest` preserves the explicit hint when
retrying. Existing automatic NP/UP detection is unchanged; Meest is explicit.
Public caching/coalescing is scoped by carrier and number and exposes only six
scalar fields. Each carrier receives only its own allowed public credentials.

The private creation API and tracking-only carrier selectors accept Meest.
Credential API and the integrations UI now accept personal Meest tokens and
store them encrypted by owner and carrier. Private tracking uses only the
shipment owner's token; it does not fall back to a platform token. The public
route uses the separate server-only `MEEST_TRACKING_TOKEN`, if configured.
Automatic renewal is not implemented. Saved credentials are not marked
provider-verified. Missing or expired tokens must not represent live access.

Migration `005_meest_tracking.sql` widens only the tracking shipment carrier
constraint. The local migration runner applies it transactionally and once,
preserving shipment fields, events, indexes, composite ownership foreign keys,
immutable history and deletion cascades. It has been tested against populated
local SQLite fixtures; no remote database migration or deployment was performed.
This is SQLite/libSQL, not a Supabase/Postgres schema change. No `rhnk.to`
database compatibility is claimed or remote schema changed by this work.

## Local Validation

On Windows use uppercase `D:/` paths and a writable `TEMP`/`TMP`, such as
`D:/delivery-pdf-reader-temp`, for native SQLite fixtures:

```sh
node --expose-gc --experimental-strip-types --test carriers.test.mjs meest-tracking.test.mjs public-tracking.test.mjs service.test.mjs meest-migration.test.mjs
npm run check
```

Tests use mocks and temporary local databases. They do not verify live carrier
access, a real token, browser behavior or production deployment readiness.