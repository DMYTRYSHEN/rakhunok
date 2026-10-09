# Rahunok Tracking (Delivery App)

This is the SvelteKit-based autonomous microservice for package tracking as outlined in the "Rahunok Tracking" product specification (v0.1, 2026-10-06).

## Overview

The service acts as an independent system for tracking shipments in Ukraine, capable of identifying carriers by tracking numbers, storing normalized events, and providing a unified dashboard/API for businesses without requiring them to integrate with each carrier individually.

## Architecture Highlights

- **Framework**: SvelteKit (Svelte 5 ready).
- **Database**: Turso (libSQL) via Drizzle ORM.
- **API First**: The core functionality is exposed via REST APIs (`/api/v1/*`), making it easy to integrate with CRMs, ERPs, or other microservices.
- **UI Components**:
  - `(public)`: Public tracking search.
  - `(business)`: Enterprise business dashboard.
  - `widget`: Embeddable iframe component for third-party sites.
- **Logic**: Carrier detection (`CarrierDetector`) rules engine to identify packages without leaking sensitive API keys.

## Folder Structure

- `/src/lib/server/db`: Turso schema definition and client connection.
- `/src/lib/server/services`: Business logic like carrier detection (`detector.ts`).
- `/src/routes/api/v1`: REST APIs fulfilling the HTTP Contracts (e.g. `POST /v1/shipments`).
- `/src/routes/(public)`: The public-facing tracking lookup tool.
- `/src/routes/(business)`: The operational dashboard for merchants.
- `/src/routes/widget`: Embeddable widget component.

## Database (Turso)

The Drizzle schema (`schema.ts`) implements the logical data model required:
- `tenants`: Multi-tenant organization boundaries.
- `shipments` & `tracking_events`: Core package status and history.
- `carrier_capabilities` & `carrier_connections`: Carrier configuration and delegated access.
- `outbox_events`: Transactional outbox pattern for reliable webhook/notification delivery.

## Running Locally

1. `npm install` (or `pnpm install`)
2. Make sure you have a valid Turso DB (or use the local sqlite fallback)
3. `npm run dev`

For the approved local Dashboard-auth demo, run `npm run dev:dashboard-auth`
from this directory and open `http://localhost:5173/login`. This opt-in launcher
reads the root `.env` public Dashboard auth settings and maps only those three
settings into Delivery's server environment. It does not copy keys into files,
reuse Dashboard session cookies, or change production configuration. The
selected local auth project is `mwaeazabpvbxqfrceogr`, not `rhnk_main`.
Use `node dev-dashboard-auth.mjs --check` to check availability without starting
the server or printing credentials.

## Navigation And Current Scope

The business sidebar and mobile More menu both link directly to sender defaults
at `/business/settings/sender`. Settings also links to sender defaults, carrier
credentials and customers. Sender defaults links back to Settings and new
shipments. The shipment wizard links to sender defaults and customers; the
points directory and customers link to new shipments. Nested routes keep the
matching navigation entry active.

The public Cabinet link targets `/business`; its existing authentication guard
redirects anonymous visitors to login. `/track` is a legacy redirect to the same
workspace. `/widget` is an isolated demo, not a production business section.

Attention and Analytics still display explicit unavailable-state placeholders.
Company profile, notifications and team management are not implemented. Their
legacy demo controls remain hidden by the shell; navigation changes do not make
those features operational.

Run `node scripts/test-navigation.mjs` with Vite on port 5173. It checks the real
anonymous home/login round trip and business navigation in a component harness,
including sender controls and desktop/mobile layouts. Authenticated business
loaders, form persistence and real carrier writes are outside this test.

## Tracking API

Anonymous status lookup by tracking number:

```sh
curl 'http://127.0.0.1:5173/api/v1/tracking/20450000000000?carrier=nova_poshta'
```

`GET /api/v1/tracking/{ttn}` needs no login or carrier key in the request.
Optional `carrier` accepts `nova_poshta`, `ukrposhta`, or `meest`. Without it,
14 digits select Nova Poshta, other valid public numbers select Ukrposhta.
Specify Meest explicitly. The response is `{data: {carrier, trackingNumber,
trackingState, deliveryStatus, checkedAt, providerStatusCode}}`. It excludes
names, phones, addresses, events, provider labels and credentials. This route
does not save a shipment or access an owner's shipment records. Anonymous CORS
reads are allowed without cookies or authorization headers.

HTTP 400 rejects invalid input; 429 includes `Retry-After: 60`; provider
unavailability/access denial returns 503. Other lookup results return 200,
including `not_found`; inspect `trackingState`, not just the HTTP status.
Only `active` confirms a fresh successful lookup. Responses use `no-store`;
the server shares a 30-second successful-result cache, 5-second failure cache,
inflight coalescing and a 30-uncached-call/minute budget with public page lookup.
These limits are per process, not distributed across replicas. Production
requires separate edge/distributed abuse protection; none is deployed here.
Server-side Ukrposhta/Meest tokens may still be necessary for those providers.

Authenticated owner-scoped refresh remains separate:
`POST /api/v1/shipments/{id}/refresh`, with a same-origin `Origin` header and
Bearer token (or existing session cookie). `id` is the shipment UUID from the
authenticated list/create API, not a TTN. The response includes saved status
fields and `lastCheckedAt`/`lastSuccessAt`; transient failures may retain a prior
successful delivery status. HTTP 400/401/403/409/503 indicate invalid UUID,
authentication, origin, unavailable/busy shipment, or service failure.
Neither endpoint exposes secrets. Settings contains examples for both APIs.

Run `node --experimental-strip-types --test public-tracking-api.test.mjs
public-tracking.test.mjs refresh-api.test.mjs` for mocked carrier and API tests.
These tests do not establish live carrier availability.

## Customer Directory

`/business/customers` manages the authenticated user's recipients: name and
Ukrainian phone number, with search, manual creation, editing and deletion.
Phones are normalized to `+380...` and unique per user. Repeated creation does
not overwrite an existing name; use explicit editing to change it.

The shipment wizard can fill recipient name and phone from this directory.
Delivery city and point remain separately selected. Confirmed successful Nova
Poshta issuance adds the recipient automatically; failed or uncertain issuance
does not. A customer-storage failure is reported without hiding an issued EN.
Existing shipments are not backfilled into the directory.

Migration `008_customers.sql` adds the owner-scoped table in Delivery's
Turso/libSQL database. `npm run setup:tracking` applies pending migrations only
to the local file database. Remote application requires separate approval.
No Supabase schema objects, including those in `rhnk_main` (`rhnk.to`), are
changed by this feature; deploying a Delivery environment still requires its
own database and authentication configuration.

Run `node --experimental-strip-types scripts/test-customers.mjs` with the local
Vite server on port 5173 for the browser regression. It uses temporary libSQL
storage and actual components; it does not exercise authenticated route actions
or real carrier issuance.

## Google Authentication

Delivery uses the same Google Identity Services ID-token flow as Dashboard,
but requires its own explicitly selected Supabase project configuration:

- `DELIVERY_SUPABASE_URL`: HTTPS origin of the selected Supabase project.
- `DELIVERY_SUPABASE_PUBLISHABLE_KEY`: its `sb_publishable_...` key, never a secret/service-role key.
- `DELIVERY_GOOGLE_CLIENT_ID`: Google Web OAuth client ID enabled in that project's Google provider.

Set these in the local environment or the Delivery Worker's runtime bindings.
Enable Google in Supabase Auth and register the actual UI origin in the Google
OAuth client's Authorized JavaScript origins, including `http://localhost:5173`
for this local demo. Configure the selected project's OAuth callback in Google
as directed by Supabase. This UI uses ID-token exchange, not a browser OAuth redirect.
The client ID is rendered to the login page; Supabase configuration stays server-side.

Open `/login`. The Google browser callback submits the credential to `/`
(`http://localhost:5173/` locally), not `/login`. Successful exchange redirects
to `/business`; rejected exchange returns to `/login?auth=failed`.
Google receives the SHA-256 nonce; its raw value is bound to a root-path
ten-minute HttpOnly cookie and consumed once by the root server action. Supabase
validates the credential and nonce. The resulting access token is stored in an
HttpOnly, SameSite cookie, Secure on HTTPS. Business layout loads verify it with
Supabase Auth. Logout revokes the local session and clears the cookie. Sessions
currently require sign-in again after access-token expiry; refresh-token renewal
is not implemented. No existing Dashboard session/project is silently reused.

The business workspace now loads only the signed-in user's stored shipments.
Create, refresh and delete actions verify authentication independently. Creation
stores a tracking number and immediately attempts a carrier refresh. A failed
first refresh does not undo the saved shipment. The refresh button retries it.
An empty account shows no shipments. Integrations now render the real carrier
credential controls; webhook delivery and external CRM integrations are not implemented.
GET/POST `/api/v1/shipments` also verify authentication and scope records to the
verified user ID; the old default-tenant writer has been removed.
Organization membership and cross-tenant API authorization remain separate work.
No remote Google/Supabase configuration or production deployment has been performed.

## Tracking Credentials And Storage

Set private values in the existing `apps/delivery/.env.local`, preserving any
other settings. A secret-free template is `.env.tracking.example`. Never paste
credentials into chat or use `PUBLIC_`/`VITE_` prefixes for carrier or Turso keys.

- `DELIVERY_TURSO_DATABASE_URL`: `file:./tracking-local.db` locally, or the
  selected Turso database's `libsql://...` URL.
- `DELIVERY_TURSO_AUTH_TOKEN`: the selected remote Turso database auth token;
  leave empty for local SQLite.
- `NOVA_POSHTA_API_KEY`: API key from the Nova Poshta business account/API
  settings. The read-only `TrackingDocumentGeneral/getStatusDocuments` adapter
  can send requests without a key, but actual access and limits must be verified.
  A shared key does not itself authorize multi-customer aggregation.
- `UKRPOSHTA_TRACKING_TOKEN`: Bearer token issued for Ukrposhta's status-tracking
  API. Request the correct tracking access from Ukrposhta; this is not assumed
  to be interchangeable with shipment-creation credentials. Without it, the
  adapter reports access denied rather than returning fabricated tracking.

Restart the server after changing environment values. `dev:dashboard-auth`
prepares a separate local tracking database when no URL is configured or a
local `file:` URL is selected. It never migrates a remote database. For Turso,
review and apply `migrations/001_tracking.sql` to the explicitly selected database
before switching the URL; no remote migration was performed here.

This is not yet a production-complete service. Automatic polling is not attached
to a runtime scheduler, the public tracking/session/detail API is not complete,
organization roles and session renewal are pending, and live carrier access has
not been verified. Nova Poshta branch-to-branch issuance is implemented under
personal credentials as described below. Production deployment acceptance remains pending.

## Ukrposhta Tracking Integration

The adapter is checked against the official
[Status Tracking API specification, March 2025](https://dev.ukrposhta.ua/uploads/Status-tracking-API-10032025.pdf),
authorization section, section 3.1 and Appendix B. It sends a read-only
`POST https://www.ukrposhta.ua/status-tracking/0.0.1/statuses/with-not-found`
with a JSON array containing the barcode and a server-only Bearer token.
It handles the `found` history and explicit `notFound` list, numeric or string
event codes, and `UPE02000` (tracking is unsupported for that shipment).

Domestic and international events are normalized without exposing raw carrier
responses. `41000` with `eventReason_id=10` means returned to sender, not delivered
to the recipient. Unknown codes remain unknown; undocumented `10601` is not
treated as proof of a created label. Storage and holds do not imply successful
delivery or readiness for pickup. LocalDateTime values are ordered but never
presented as an invented UTC timestamp.

For a local live test, place the issued tracking Bearer in
`UKRPOSHTA_TRACKING_TOKEN` in `.env.local`, restart Delivery, and search for a
registered Ukrposhta shipment on `http://localhost:5173/`. The document states
that shipments enter tracking after registration at a branch, so `notFound`
does not prove an invalid barcode. Missing tokens and HTTP 401/403 report access
denied; 429 preserves a valid Retry-After. Timeouts, malformed data and other
HTTP failures remain provider unavailable rather than fabricated tracking.

Run the mocked contract and public privacy checks with:

```sh
node --experimental-strip-types --test carriers.test.mjs public-tracking.test.mjs
```

No live token was supplied or verified. API access permissions and actual rate
limits still require confirmation with Ukrposhta. This integration does not
create shipments, purchase postage, produce official labels, resolve branches,
or schedule background polling.

## Nova Poshta Direct Integration

The broader scope is specified in [Nova Poshta new-shipment requirements](NP_NEW_SHIPMENTS.md).
Branch-to-branch issuance and official PDF retrieval are implemented; registers,
batch operations, courier/address delivery and COD remain pending.

The authenticated directory endpoint at `/api/v1/nova-poshta/directory` queries
Nova Poshta's official JSON API directly. `/business/points` shows real city,
branch and locker results, addresses, schedules and weight limits with pagination.
No third-party MCP package is installed: Shopana identifies its package as
community-maintained, and an official carrier MCP was not confirmed.

`/business/new` prepares branch/locker shipments, independently rechecks selected
points and cargo limits, and requests read-only price/date estimates. Failed
estimates remain unavailable, never fabricated. Preparation does not persist a
draft or issue a waybill. A separate confirmed issuance action loads the personal
sender account and contacts, revalidates both branches, creates the recipient,
and submits `InternetDocument/save`. A successful TTN is also added to tracking.
The shared tracking key does not authorize issuing documents for every user.

`/business/settings/sender` stores the default Nova Poshta sender and contact for
the authenticated user. The wizard preselects them after checking they still
belong to the current carrier account. Changes in the wizard affect only that
shipment; save or clear defaults in Settings. Migration `007_np_sender_defaults.sql`
stores only owner-scoped references and a credential fingerprint, not names,
phone numbers or keys. A changed key does not reuse the old defaults. Missing
contacts require a new selection. The local setup command applies this migration;
remote Turso application requires separate approval. No Supabase schema or
`rhnk.to` database objects are changed by this feature.

Migration `006_np_documents.sql` persists an owner-scoped attempt before any
carrier write. It is included in the local-only `npm run setup:tracking` command.
The journal shows the latest 100 attempts. Unknown outcomes are not retried
automatically: inspect the Nova Poshta account before taking further action.
Identical normalized shipment payloads are currently blocked permanently,
including successful previous shipments; explicit repeat-order and reconciliation
workflows are not yet implemented. This restriction prevents duplicate writes
but is a limitation for recurring business orders.

Issued documents have authenticated PDF links for the express waybill, A4 marking
and Zebra 100x100 marking. The server checks owner, stored document Ref and the
original personal key fingerprint before calling the official print endpoint.
Arbitrary tracked TTNs cannot be used to print documents. Replacing the key
disables printing old documents until a verified key-rotation workflow exists.
Keys are not returned to the browser. PDF downloads validate content type,
signature and actual size, reject redirects, and use `no-store` responses.

The mocked tests cover issuance, ambiguous outcomes, duplicate prevention,
owner/key boundaries and all three PDF transports (`np-documents.test.mjs`).
Browser tests cover the actual integrations layout and wizard confirmation,
pending lock and journal links at desktop/mobile sizes. Live provider issuance,
real print output and post-submit authenticated route refresh remain unverified.

Live credential-free city and branch lookup was verified, including real
addresses, schedules and a full page with further pagination. Authenticated directory and live
tariff end-to-end verification remain pending after local session expiry.
Ukrposhta shipment/address integration and runtime polling are still pending.
No remote migration, carrier write or deployment was performed.

## Personal Nova Poshta Credential Vault

The authenticated `/api/v1/nova-poshta/credentials` endpoint accepts POST JSON
`{ "key": "<32 hexadecimal characters>" }`, GET, and DELETE. POST and DELETE
require an exact same-origin Origin header. Authentication independently verifies
the personal owner through the configured Supabase Auth project; request bodies
cannot choose an owner. POST reads at most 2048 actual bytes with a five-second
body deadline, validates the provided key using only Nova Poshta's read-only
`Counterparty/getCounterparties` (Sender, Limit 1, Page 1), then saves it encrypted.
Validation does not use the shared directory cache or the shared tracking key.
Successful responses contain only `configured`, `ready` and `verified`, never
keys or suffixes. GET revalidates a saved Nova Poshta key through the read-only
sender endpoint. A failed validation preserves the saved credential but reports
`ready: false` and `verified: false`. Database and crypto failures return safe errors.

Set `DELIVERY_CREDENTIAL_ENCRYPTION_KEY` privately to canonical standard base64
encoding of exactly 32 cryptographically random bytes. Missing or malformed
configuration fails closed with 503, including GET and DELETE. Provision this
value outside chat using a trusted secret manager or secure local process.
The local-only setup command generates a missing master key in the ignored
`.env.local` only if no encrypted credentials already exist; it never prints it.
Production key provisioning remains external to the application.
Keep the master key backed up privately: replacing it makes existing credentials
unreadable, and automatic rotation is not implemented.

Storage is the existing `DELIVERY_TURSO_DATABASE_URL`, not a new database or a
Supabase table. Version 1 uses AES-256-GCM with a fresh random 12-byte nonce and
AAD encoding the owner, carrier and version as an unambiguous JSON tuple. The
owner/carrier primary key, ciphertext, version, nonce, tag and timestamps live
in `delivery_carrier_credentials`; all owner queries use bound SQL parameters.
Dedicated `credentialRuntime().store` opens a client without DDL.
`getPersonalNovaPoshtaKey(ownerId)` in the credential runtime returns undefined
when no row exists, but throws a safe vault error if a saved key cannot be
decrypted, including missing encryption configuration. It never falls back to
`NOVA_POSHTA_API_KEY`. Authenticated tracking reads the signed-in owner's saved
carrier credential, not a shared fallback. A missing personal NP key allows only
the carrier's credential-free tracking response; it does not imply account access.

## SMB Workflow And Verified NP Capabilities

Business acceptance criteria implemented locally:

- Connect a personal NP key in `/business/integrations`, validate it with NP,
  replace/delete it, and never return its value to the browser. The API-key
  acquisition link opens the NP account settings.
- Paste a tracking number in `/business`: normalize whitespace/case, suggest NP
  for 14 digits starting with 2/5, and Ukrposhta for 13 digits or UA-ending S10.
  Ambiguous numbers require manual selection; format is not carrier confirmation.
  Manual selection remains authoritative, including Meest.
- Save and immediately check the shipment. Show provider failure separately from
  delivery status and retain the last successful snapshot and observed history.
- Inspect route, weight, seats, declared/delivery amounts, creation/estimated/
  receipt dates, current-status scan time and storage/paid-storage start dates
  when NP supplies them. Dates remain explicitly provider-local (Europe/Kyiv).
- In `/business/new`, GPS resolves the city and selects the nearest working
  branch/locker with valid coordinates and a suitable per-seat weight limit.
  Users can override the point or choose manually when GPS fails. Rankings use
  straight-line distance within the matched city, with a disclosed 600-point cap;
  they do not guarantee walking distance or parcel-dimension acceptance.

Source checked: [NP getStatusDocuments official contract](https://developers.novaposhta.ua/view/model/a99d2f28-8512-11ec-8ced-005056b2dbe1/method/a9ae7bc9-8512-11ec-8ced-005056b2dbe1).
It documents current status, expanded key-dependent fields and up to 100 documents
per request. Its documented response has no full chronological event-history
array. The NP timeline therefore records changes observed by Rahunok, not the
complete route before enrollment. `DateScan` is a current-status fact, not a
synthetic history entry. The adapter accepts the documented DD-MM-YYYY and
YYYY-MM-DD date formats as well as DD.MM.YYYY, rejecting sentinel/invalid dates.
Raw identity, residential-address, payment-token and locker-reservation fields
are deliberately not exposed. A key does not prove ownership of any entered TTN.

Still pending for production SMB operation: runtime background polling and
notifications, batching, team roles, session renewal, real waybill issuance and
official labels, persisted preparation drafts, operational webhook/API tabs and
live customer-key acceptance. The existing scheduler logic is tested but not
attached to a running background worker. This is not full NP API coverage.
No remote schema migration or deployment is part of this change; tracking remains
in the separate configured libSQL store, not either Supabase database.

Local migration `003_carrier_credentials.sql` is registered by `migrateLocal`
after the existing 001/002 migrations, atomically recorded in
`tracking_migrations`, and tested for repeatability and preservation of shipments.
The launcher still resolves a missing/file URL relative to this app and calls
`migrateLocal` only for that local file; it defaults to `tracking-local.db`.
It reads the database URL from process environment first, then the existing
private local env file. Vite loads that local env file; an inherited process
master key takes precedence. The root env mapping remains public auth settings
only. `--check` checks only auth settings, not vault readiness. Plain `npm run dev`
does not migrate. `node migrate-local.mjs file:./tracking-local.db` is the explicit
local alternative when run from this directory. Remote URLs, hosted file URLs,
query/fragment URLs, memory databases and `local.db` are rejected by the migrator.

Only temporary test databases were migrated for this change. The real tracking
database was not modified. Local master-key provisioning and the actual local
003 migration are pending; no remote schema/write, Supabase migration, production
deployment or live personal-key validation has been performed. Remote migration
approval and compatible runtime crypto configuration remain separate requirements.

Run focused tests from this directory:

```sh
node --expose-gc --experimental-strip-types --test credential-vault.test.mjs credential-api.test.mjs service.test.mjs
npm run check
```

## PWA Installation

The production build includes a standalone web manifest, maskable PNG icons and
a SvelteKit service worker. Only the manifest, two icons and the static offline
document enter its cache. Business pages, session responses, API data and POST
requests are never stored by the service worker. Tracking and sign-in require
an internet connection; offline navigation shows a retry screen, not stale data.
Updates activate after the old application tabs close; no forced reload interrupts
an action. Push notifications, background tracking and offline writes are not included.

Use `npm run build` followed by `npm run preview -- --port 5178` to check the PWA
locally. Vite development mode on 5173 does not register a service worker.
Chrome/Edge offer installation from the browser menu; iOS Safari uses Share >
Add to Home Screen. A real phone needs an HTTPS URL: the computer's localhost
is not reachable as localhost on the phone. No remote deployment is authorized.
The standalone app starts at `business` inside its scope and follows the existing
Google sign-in flow. Production hosting still needs an explicit SvelteKit adapter
and approved runtime configuration. Run `node --test pwa.test.mjs` for cache-isolation
and nested-scope fallback regression coverage.
