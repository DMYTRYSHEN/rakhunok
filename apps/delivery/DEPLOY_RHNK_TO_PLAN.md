# Delivery Deployment Plan: rhnk.to

Date: 2026-10-10
Status: isolated Delivery directory transport fix deployed; historical releases below.
The user approved preparation and deployment conditional on working flows and
no impact on other services. Migrations 001 through 008 were separately approved
and applied to the exact delivery-rhnk Turso database. The subsequent point
accumulation request authorized migration 009 and the conditional isolated release.

## Browser-Only Point Catalog: Deployed, 2026-10-10

### Shipment Storage Configuration Repair: 2026-10-10

- After the catalog release, the user reported shipment-list HTTP 503.
   The likely initialization-order defect was repaired by reading Turso URL,
   token and credential encryption key from request-time Worker bindings.
   Production logs have not confirmed this as the original failure cause.
- User explicitly approved this repair deployment. Cloudflare confirmed version
   79103e94-444f-4473-97cc-a4b8c8cd3192 on rhnk-to-delivery with the same two
   Delivery routes. This supersedes catalog version
   d8d4ad7c-af1d-4424-956a-941d8d3a2c33; the last earlier known-working version
   remains f7a7d415-49be-43f1-a526-a69ec0f5da4f.
- Shipment page loaded on localhost:5173, eight focused regressions passed,
   typecheck had zero errors and eight existing warnings, build and dry-run passed.
   Production runtime recovery is not verified because testing remains restricted
   to localhost:5173. No database migrations, data changes or sibling deployments.

- Explicit user deployment approval: "deploy" on 2026-10-10.
- Isolated Delivery build and guarded dry-run passed, followed by successful
   Cloudflare deployment to rhnk-to-delivery on rhnk.to/delivery and
   rhnk.to/delivery/* only. Current version:
   d8d4ad7c-af1d-4424-956a-941d8d3a2c33.
- Previous deployed version for a separately approved rollback:
   f7a7d415-49be-43f1-a526-a69ec0f5da4f.
- Production runtime smoke tests were not performed because testing is restricted
   to localhost:5173. Deployment success is confirmed by Wrangler, not by a live
   authenticated catalog check. No other Worker or database was changed.

- Supersedes the earlier local Turso-first proposal at the user's request.
   Directory requests now have no trackingRuntime/database dependency; both GPS
   and manual warehouse browsing perform no catalog reads or writes in Turso.
   The unused DirectoryStore registration was removed from tracking runtime.
- Successful directory responses, including empty results, are cached only in
   browser localStorage per user ID. Maximum 60 entries and approximately 1 MiB
   of UTF-16 storage per user; oldest entries are evicted. GPS responses expire
   after 15 minutes, cities/manual point responses after 12 hours. Exact request
   keys preserve coordinate, city, weight, query and pagination separation.
- Both new-shipment and points screens use this cache. Missing, malformed,
   expired, disabled or full browser storage falls back to the authenticated API.
   GPS still returns only suitable points within 1 km and fetches at most 30 pages.
- No database rows were deleted and no migration was applied.
   Existing catalog rows still occupy Turso storage;
   removing them requires a separately approved cleanup. Other Delivery data
   remains in Turso. The deployed release uses browser-local catalog caching.
- Validation: 11 cache/provider/native Workers tests passed; Delivery typecheck
   has 0 errors and 8 existing settings accessibility warnings. Svelte autofixer
   found no issues in the modified lookup slices. Localhost:5173 desktop/mobile
   GPS test confirmed localStorage persistence and no second directory request
   on repeated nearby lookup. The unrelated extended settings harness was not rerun.

## Superseded GPS Turso-First Proposal: 2026-10-10

- Implemented locally only. No GPS production deployment, remote database write,
   migration or authentication change was performed. Production remains version
   f7a7d415-49be-43f1-a526-a69ec0f5da4f. The user confirmed its directory works.
- After GPS city resolution, one authenticated nearby request reads the existing
   Turso catalog first. SQL bounds coordinates, city, status, category and weight;
   exact Haversine filtering keeps only points within 1 km.
- A nonempty catalog result performs no provider call or directory save. Empty
   results fetch at most 30 provider pages and persist only suitable nearby points.
   Empty fallback results perform no save. Conditional upserts do not rewrite
   identical rows, including updated_at. Manual directory browsing remains intact.
- Limits: cached points may be stale or incomplete; adjacent-city points are not
   included. Empty searches can repeat provider pagination. Manual browsing can
   still add catalog rows. Read/storage quotas and SQL billing remain applicable;
   reduced changed rows are not a free-tier capacity guarantee.
- Validation: 13 focused tests passed, including cache-hit call counts, bounded
   empty fallback, unchanged-row SQL behavior, radius and native Workers transport.
   Delivery check: 0 errors, 8 existing settings accessibility warnings. Svelte
   autofixer found no issues in the changed async lookup slice.
- Localhost:5173 GPS-only browser test passed at desktop/mobile sizes, including
   one nearby request, distant-point exclusion and manual selection. A real
   authenticated local endpoint returned HTTP 200, source turso, 5 points.
   The extended unrelated standalone settings-form harness failed with undefined
   SvelteKit form state; it was not fixed or certified in this GPS slice.

## Directory Transport Fix Release: 2026-10-10

- The user explicitly approved this separate isolated Delivery deployment.
   Deployed Worker: rhnk-to-delivery, version
   f7a7d415-49be-43f1-a526-a69ec0f5da4f. Previous version for rollback:
   ede32180-17c8-4d9d-b968-3a01c7ea4581. Routes remain only rhnk.to/delivery
   and rhnk.to/delivery/*.

- The new-shipment directory uses NovaPoshtaApi.call. Native Workers testing
   exposed an illegal fetch invocation: the default global fetch was called as
   an instance field with the wrong receiver. The default transport now wraps
   global fetch without binding it to the client instance.
- The same call also used redirect: error, unsupported in Workers. It now uses
   manual and retains fail-closed rejection of 3xx responses.
- The socket-free native Workers regression covers real city and warehouse
   lookup against an internal mock provider and rejection of 302 responses.
   All 18 focused native, directory, shipping, document and sender tests passed.
   Delivery typecheck reported 0 errors and 8 existing accessibility warnings.
- On localhost:5173/business/new, Kyiv city lookup succeeded and warehouse
   lookup returned HTTP 200 with 20 rows. Catalog persistence targeted only
   file:D:/svetle/corex/apps/delivery/tracking-local.db. No shipment was issued.
- Production build and matching dry-run passed: 98 assets, 867.61 KiB upload,
   178.31 KiB gzip. Cloudflare confirmed both routes and startup time of 15 ms.
- No remote database writes, schema changes, production application requests or
   sibling deployments were performed. Existing Delivery secrets were resupplied
   without intentional rotation. Production directory lookup remains unverified
   under the localhost:5173-only testing restriction. Other carrier transport
   paths are outside this focused regression and remain uncertified.

## Account Display Name Release: 2026-10-10

- The user explicitly approved this separate Delivery production deployment.
- Deployed Worker: rhnk-to-delivery, version
   ede32180-17c8-4d9d-b968-3a01c7ea4581. Routes remain only rhnk.to/delivery
   and rhnk.to/delivery/*. Previous version for rollback:
   1886e55b-cfec-4928-96c8-865a87211369.
- The sidebar account title now displays the verified user's bounded full_name
   or name metadata, with a neutral fallback when absent. Metadata is used only
   for display, never authorization. Google and logout remain unchanged.
- All 24 focused authentication and login-route tests passed. Delivery typecheck
   reported 0 errors and 8 existing accessibility warnings. The full suite was
   not rerun. Localhost:5173 business returned HTTP 200 with the user's name and
   no 5xx responses on the final reload; an earlier transient Internal Error
   did not recur. The desktop account block fit within its container.
- Production build and matching dry-run passed: 98 assets, 867.57 KiB upload,
   178.30 KiB gzip. Cloudflare confirmed both routes and startup time of 13 ms.
- No schema changes, provider changes or sibling deployments were made. Existing
   Delivery secrets were resupplied without intentional rotation. Production
   application requests were not performed under the localhost:5173-only testing
   restriction; production display-name rendering remains unverified.

## Authentication Transport Fix Release: 2026-10-10

- After deployment, the user confirmed that production authentication works.
   This is user-confirmed acceptance, not an automated production smoke test.
- The user explicitly approved this separate isolated production deployment.
- Deployed Worker: rhnk-to-delivery, version
   1886e55b-cfec-4928-96c8-865a87211369. Routes remain only rhnk.to/delivery
   and rhnk.to/delivery/*. Previous version for rollback:
   d37c6c1e-1b51-4895-9a71-ec750036c5c1.
- Native workerd rejected redirect: error with TypeError before sending the
   provider request. This explains the Node-local versus Workers-runtime
   difference and the reported AUTH_UNAVAILABLE_transport stage.
- The shared Delivery authentication helper now uses redirect: manual. It does
   not follow redirects; existing status validation rejects 3xx responses.
   Nonce, cookie scope, deadline, response bounds and identity checks are unchanged.
- A socket-free native Workers regression test uses the actual auth helper and
   a mock provider to verify successful Google exchange and rejection of 302.
   All 23 focused authentication and login-route tests passed locally.
- Delivery typecheck passed with 0 errors and 8 existing accessibility warnings.
   Production build and matching dry-run passed: 98 assets, 866.68 KiB Worker
   upload, 178.07 KiB gzip. Cloudflare confirmed deployment of both routes and
   Worker startup time of 20 ms. The full Delivery suite was not rerun.
- No production application requests, provider changes, database writes or sibling
   deployments were performed. Existing Delivery secrets were resupplied without
   intentional rotation. Real production login and smoke tests remain unverified
   under the user's localhost:5173-only testing restriction.

## Authentication Diagnostic Release: 2026-10-10

- The user separately approved this diagnostic-only production deployment.
- Deployed Worker: rhnk-to-delivery, version
   d37c6c1e-1b51-4895-9a71-ec750036c5c1. Routes remain only rhnk.to/delivery
   and rhnk.to/delivery/*. Previous version for rollback:
   26a713b1-ae12-484e-b300-635c76c923ce.
- Authentication failures now append a safe internal stage category to the
   login reason: transport, timeout, response_url, response_status,
   response_type, response_size, response_body, response_json, session or
   identity. No credentials, provider payloads or raw error messages are exposed.
   Existing nonce, response bounds, deadline and authorization checks remain.
- All 22 focused authentication and login-route tests passed. Current code
   typecheck reported 0 errors and 8 existing accessibility warnings.
   The full Delivery suite was not rerun for this diagnostic release.
   Production build and matching dry-run passed: 98 assets,
   866.67 KiB Worker upload, 178.07 KiB gzip. Cloudflare confirmed both routes
   deployed and a Worker startup time of 15 ms.
- No migrations, Supabase provider changes or sibling deployments were made.
   Existing Delivery secrets were resupplied without intentional rotation.
- Production smoke tests and real login were not performed under the user's
   localhost:5173-only testing restriction. The AUTH_UNAVAILABLE root cause
   remains unknown; deployment confirms diagnostics, not an authentication fix.

## Login Correction Release: 2026-10-10

- The user explicitly approved this separate production deployment after review
   of the login changes and their remaining diagnostic limits.
- Deployed Worker: rhnk-to-delivery, version
   26a713b1-ae12-484e-b300-635c76c923ce. Routes remain only rhnk.to/delivery
   and rhnk.to/delivery/*. Previous version for rollback:
   962ff72f-98c2-4e33-a498-0de392728d35.
- Successful Google login now redirects to /delivery/business. Failed login
   redirects to /delivery/login?auth=failed with a safe reason category, never
   credential values or provider response bodies. Repeated login loads preserve
   an existing valid nonce until submission instead of invalidating a rendered
   Google button. Cookie scope and security attributes remain unchanged.
- All 122 Delivery tests passed. Typecheck reported 0 errors and 8 existing
   accessibility warnings. Production build and matching dry-run passed:
   98 assets, 866.33 KiB Worker upload, 177.99 KiB gzip.
- HTTP checks on localhost:5173 confirmed repeated login loads return 200 and
   preserve the nonce. Cloudflare confirmed successful upload and deployment
   of both exact and wildcard Delivery routes (startup time 14 ms).
- No migrations, Supabase configuration changes, or sibling Worker deployments
   were performed. The existing deployment script resupplied the two configured
   Delivery secrets from the local protected source without intentional rotation.
- Production smoke tests and real login were not performed because the user's
   current testing restriction permits only localhost:5173. The exact cause of
   the originally reported production authentication rejection is not confirmed;
   deployment success does not establish successful production sign-in.

## Catalog Release: 2026-10-10

- Deployed Worker: rhnk-to-delivery, version
   962ff72f-98c2-4e33-a498-0de392728d35, only rhnk.to/delivery and
   rhnk.to/delivery/*. Previous version: 7613af05-05eb-48ef-a262-2ab23666ab0d.
- Migration 009_directory_points applied to
   libsql://delivery-rhnk.aws-eu-west-1.turso.io. Readback verified its journal,
   columns, carrier/ref primary key, city index and coordinate constraints.
   The new catalog started empty; no local or business data was copied.
- Authenticated warehouse directory responses are upserted before returning.
   The shared Nova Poshta catalog preserves address, city, point type, schedule,
   weight limits, valid coordinates and first-seen/update timestamps. Repeated
   reads update existing points without duplicate refs. No user identity or
   carrier credentials are stored in this table.
- Collection covers requested warehouse pages only, not an exhaustive carrier
   import. Other carriers and a catalog map/read API are not part of this release.
- Real Google login and warehouse collection were checked on localhost:5173;
   local SQLite contained 20 points with coordinates. Public page preloads no
   longer replace the login nonce before credential submission.
- Delivery check: 0 errors, 8 existing accessibility warnings. Production build
   and matching dry-run passed (98 assets, 177.89 KiB gzip). All 121 tests passed:
   node --expose-gc --experimental-vm-modules --experimental-strip-types --test
   apps/delivery/*.test.mjs. Windows native SQLite teardown requires --expose-gc;
   without it cleanup EBUSY errors can mask assertions.
- Production writes were limited to migration 009 and this Worker deployment.
   No production login, carrier document issuance or point collection test was run.
- Post-deploy read-only checks passed: /delivery redirects 308 to /delivery/;
   home/login and their resolved JS assets return 200; anonymous business redirects
   303 to /delivery/login. Sibling /, /dashboard, /app, /conf/, /pay and /pay/
   return 200. /corex retains its known pre-existing 404, not repaired by this release.
- Worker rollback does not remove the additive catalog migration. Historical
   preparation gaps below are not claims of newly verified provider workflows.

## Preparation Checkpoint: 2026-10-09

- Delivery's Vite build uses adapter-cloudflare and paths.base=/delivery;
   ordinary local development remains at /. Dedicated wrangler.jsonc targets
   only rhnk-to-delivery and the two narrow Delivery routes. Wrangler account
   access is verified; actual remote route ownership remains to be verified.
- Credentials requests now include the configured base path.
- Assets use html_handling=none: offline.html now returns 200 without the
   automatic extension-stripping redirect that broke service-worker installation.
- Wrangler declares the two required private token/encryption secrets.
   Public Supabase and Google configuration is supplied through vars.
- Production build and Wrangler deploy --dry-run passed. Worker gzip size was
   approximately 178 KiB. Only Delivery assets were packaged.
- Local Workers runtime on port 5186 returned home/login 200, bare /delivery
   308, anonymous business 303 to login, PWA assets 200 and invalid TTN API 400.
   /delivery-other and /dashboard returned 404 in this isolated Worker.
   Browser home/navigation links correctly use /delivery/. These checks do not
   verify existing production services or authenticated business workflows.
- Auth, PWA, public tracking and private refresh regression tests: 31/31 passed.
   A scan of 66 generated text files found no exact local secret values.
- Remote Turso has seven empty business tables plus tracking_migrations;
   integrity_check=ok and foreign_key_check reported no violations. Migration
   001 remains idempotent; the existing journal records 002 through 008.
- The user explicitly approved shared Dashboard Auth for Delivery. Its URL and
   publishable key match live Dashboard's mwaeazabpvbxqfrceogr project, and the
   Google Client ID comes from the live public frontend configuration.
   Read-only /auth/v1/settings returned 200 with email and Google enabled.
   Real login, Google origins and authenticated owner workflows remain unverified.
- Turso token and vault encryption key have not been uploaded to Cloudflare.
   Local .env.local still points to SQLite; no local records were copied.
- Full business-flow release checks, distributed abuse protection, runtime
   database compatibility, remote account/routes verification and real provider
   availability remain pending. Dry-run is not authorization to skip these gates.

## Target And Isolation

- Canonical application URL: https://rhnk.to/delivery/
- Proposed isolated Worker: `rhnk-to-delivery`.
- Repository root for this service: `apps/delivery`.
- Proposed routes: `rhnk.to/delivery` and `rhnk.to/delivery/*`, zone `rhnk.to`.
- Bare `/delivery` should redirect to `/delivery/` without losing the query.
- Existing `worker-rhnk-to/wrangler.landing.jsonc` owns `rhnk.to/*` in source.
  Verify actual deployed route ownership before release; narrower Delivery
  routes must not overwrite the landing route or capture `/delivery-other`.
- Existing configs suggest account `753ff9292511c16a281c5cfa8e105c63`;
  verify the authenticated account and zone before any remote operation.
- Do not reuse the root `build` folder or Conf assets. Delivery must build and
  deploy its own SSR/API output, not a static-only SPA.

## Implementation Before Release

1. Configure the installed `@sveltejs/adapter-cloudflare` in Delivery's
   SvelteKit 3 Vite plugin options. Set production `paths.base` to `/delivery`
   (no trailing slash). Keep root-path local development independently usable.
   Validate the installed adapter's output with a dedicated Wrangler config;
   use its generated Worker and assets, not manually copied root artifacts.
2. Make every URL base-aware: links, redirects, fetch calls, forms, icons,
   manifest, service worker, widget, share links and API examples. A known
   root-relative credentials fetch in `CarrierConnections.svelte` has been fixed.
   Test hard reloads and client navigation under the prefix, not just at `/`.
3. Scope Delivery cookies, including login state and deletion, to `/delivery/`;
   retain HttpOnly/Secure/SameSite protections. Confirm login callbacks and
   logout never redirect to unrelated root routes. Do not reuse Dashboard
   session cookies or relax CSRF/origin checks for deployment.
4. Create a dedicated Wrangler source config with exact and wildcard routes,
   today's reviewed compatibility date, required compatibility flags, isolated
   assets and enabled logs/traces. Generate binding types with installed Wrangler.
   Do not enable automatic production deploy-on-push.
5. Verify Workers runtime compatibility. Prefer the libSQL web client for remote
   Turso access; no filesystem SQLite, native Node transport or local `file:`
   fallback is permitted in production. Review legacy database imports separately.
6. Add distributed/edge abuse protection for anonymous tracking before public
   release. Current cache/coalescing/30 uncached calls per minute are process-local
   and do not provide a global or per-client limit across Workers isolates.
7. Define how due shipment checks run. Current owner-triggered checks must not
   be presented as an automatic background scheduler. A cron/queue rollout is
   separate work with explicit approval and ownership-safe tests.

## Data, Authentication And Secrets

Delivery operational data is Turso/libSQL, not Supabase Postgres. Provision a
dedicated remote Delivery database only after its environment and cost are
approved. Inspect migration history/drift, validate migrations 001 through 008
against a disposable development database, then review the pending set for the
exact production target. Never upload `local.db`, `tracking-local.db`, users,
sessions, recipients, shipments or stored carrier keys as deployment artifacts.
Confirm constraints, owner isolation, credential encryption and backup/restore
before release. Applied local migrations do not imply remote migrations applied.

Explicitly approved Delivery-only Auth exception: use the same Supabase Auth
project as live Dashboard, `mwaeazabpvbxqfrceogr`, with its matching URL and
publishable key. This replaces the initial rhnk_main Auth target for Delivery
only; it does not change Dashboard configuration, Supabase users or schemas.
The distinct rhnk_main database remains `mvytjhaujcewqfyivwxf`, not an alias.
Delivery operational data stays in its dedicated Turso database. Sharing the
Auth project does not automatically reuse Dashboard cookies or browser sessions.
Verify enabled login providers and callback allowlists for `/delivery/`;
changes to Supabase provider settings need separate approval.

This plan makes no Supabase schema change. Before any later database-dependent
implementation, explicitly assess rhnk_main tables, columns, relationships,
constraints, indexes, views, RPCs, triggers, grants, RLS, Storage policies and
Realtime publications. Delivery does not currently require replicating its
Turso tables into that project. Any newly introduced Supabase dependency needs
its own migration and access tests; never silently fall back to the old project.

Public runtime configuration in Wrangler vars:

- `DELIVERY_SUPABASE_URL`, `DELIVERY_SUPABASE_PUBLISHABLE_KEY`,
  `DELIVERY_GOOGLE_CLIENT_ID`, `DELIVERY_TURSO_DATABASE_URL`.

Private runtime secrets (values must never enter Git or logs):

- `DELIVERY_TURSO_AUTH_TOKEN`
- Credential-vault encryption configuration as required by the existing vault;
  verify exact variable names and key format before provisioning, preserve keys
  for decrypting existing records and plan rotation separately.
- `UKRPOSHTA_TRACKING_TOKEN`, `MEEST_TRACKING_TOKEN` when public provider access
  requires them; private carrier credentials remain per authenticated owner.

Use protected secret input; secret updates can deploy a Worker version and
therefore need approval. Do not bake runtime secrets into build artifacts.

## Public URLs After Release

- Home: `https://rhnk.to/delivery/`
- Tracking page: `https://rhnk.to/delivery/{ttn}`
- Login: `https://rhnk.to/delivery/login`
- Business: `https://rhnk.to/delivery/business`
- Anonymous API: `GET https://rhnk.to/delivery/api/v1/tracking/{ttn}`
- Owner API: `POST https://rhnk.to/delivery/api/v1/shipments/{id}/refresh`

The anonymous API returns status-only fields and requires no identity. It must
not expose personal data or private carrier keys. The UUID refresh remains
authenticated and owner-scoped. Carrier outage or absent credentials must be
reported honestly, not treated as confirmed tracking. Live availability of
Nova Poshta, Ukrposhta and Meest remains unverified for this target.

## Release Gates And Rollback

1. Free adequate disk space before installation/build (npm previously returned
   ENOSPC). Freeze the source commit and retain the lockfile.
2. Run Delivery type checks, all relevant unit tests and prefix-aware browser
   tests for tracking/history/focus, login/logout, navigation, credentials,
   customers, sender defaults and shipment documents. Exercise real route
   loaders/actions in staging; component fixtures alone are insufficient.
3. Build Delivery with the Cloudflare adapter and `/delivery` prefix, then run
   a matching local Wrangler dry run. Verify bundle/assets and web libSQL
   compatibility. A dry run does not validate remote databases or secrets.
4. Test the built Worker in a dedicated development environment without copying
   production data or issuing real shipping documents unintentionally. Verify
   authentication against the selected test project and tenant isolation.
5. Review route snapshot, exact Worker/account, migration set, secrets readiness,
   backup, rollback version and smoke-test results. Obtain explicit production
   approval for this release before route/database/deployment writes.
6. Deploy only the isolated Delivery build. Smoke-test `/delivery`, `/delivery/`,
   prefixed assets, login and authenticated flows, anonymous API invalid and
   successful lookup, rate limits and provider failures. Check desktop/mobile.
   Check `/`, `/dashboard`, `/app`, `/conf/`, `/pay`, `/pay/`, `/corex` still return
   HTTP 200 with their expected assets; do not mutate those applications.
7. Roll back the Delivery Worker to its recorded previous version; for the
   initial release, restore/remove only the two new routes after approval so the
   previous catch-all ownership resumes. Worker rollback does not undo database
   migrations, secrets or resource data. Use the reviewed data recovery plan.

## Git And Current Evidence

Commit only Delivery source, tests, docs, static source assets, lockfile and this
plan. Exclude dependencies, generated builds, local databases, environment
secrets, browser artifacts and unrelated monorepo changes. A local commit is
not a remote push, production approval or scheduled deployment.

Previous local checks: tracking API/public lookup/private refresh tests 16/16;
desktop/mobile navigation and API examples passed; Svelte check 0 errors with
8 existing warnings. The preparation checkpoint above supersedes historical
build and remote schema status. Full release gate, real authenticated flows,
live carrier/provider checks and deployment are still pending.

References:

- https://svelte.dev/docs/kit/adapter-cloudflare
- https://svelte.dev/docs/kit/@sveltejs-kit-vite#paths
- https://developers.cloudflare.com/workers/wrangler/configuration/