# Delivery Deployment Plan: rhnk.to

Date: 2026-10-09
Status: planned, not implemented or deployed.
Scope approved here: save Delivery source in Git and plan deployment.
Remote provisioning, secret changes, migrations, route changes and production
deployment require separate explicit approval. No deployment date is scheduled.

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
   blocker is the root-relative credentials fetch in `CarrierConnections.svelte`.
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

Authentication for rhnk.to must use `rhnk_main`, project ref
`mvytjhaujcewqfyivwxf`, URL `https://mvytjhaujcewqfyivwxf.supabase.co`.
Do not inherit `mwaeazabpvbxqfrceogr` from the local Dashboard demo or old Worker
configs. Configure this service's own public/publishable key and server values.
Verify enabled login providers and callback allowlists for `/delivery/`;
changes to Supabase provider settings need separate approval.

This plan makes no Supabase schema change. Before any later database-dependent
implementation, explicitly assess rhnk_main tables, columns, relationships,
constraints, indexes, views, RPCs, triggers, grants, RLS, Storage policies and
Realtime publications. Delivery does not currently require replicating its
Turso tables into that project. Any newly introduced Supabase dependency needs
its own migration and access tests; never silently fall back to the old project.

Required runtime configuration (values must never enter Git or logs):

- `DELIVERY_SUPABASE_URL`, `DELIVERY_SUPABASE_PUBLISHABLE_KEY`
- `DELIVERY_TURSO_DATABASE_URL`, `DELIVERY_TURSO_AUTH_TOKEN`
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
8 existing warnings. Full release gate, production adapter build, prefix tests,
remote schema/provider checks and deployment are still pending.

References:

- https://svelte.dev/docs/kit/adapter-cloudflare
- https://svelte.dev/docs/kit/@sveltejs-kit-vite#paths
- https://developers.cloudflare.com/workers/wrangler/configuration/