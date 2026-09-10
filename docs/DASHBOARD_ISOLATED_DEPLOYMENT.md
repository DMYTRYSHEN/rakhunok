# Dashboard-only test deployment

## Current rollout state — recorded 2026-09-09

The separately authorized deployment completed **only** for `letsrealtalk-dashboard`, version
`d098d3b5-ee9f-4ee2-9a8b-6a2cae62f390`, route `letsrealtalk.com/dashboard*`, generated assets
`/dashboard/_app/`. Test landing is unchanged; shared API `rahunok` was **not deployed**.
The authorized DAC7 settings migration is recorded in the
[dated rollout evidence](BUSINESS_SETTINGS_ROLLOUT_20260909.md).

Production smoke is ongoing in the main session; **no PASS is claimed**. A real-JWT authenticated
browser save has **not been tested**. Rollback-only authenticated SQL smoke does not substitute
for that browser test. No Git commit or push was performed.

This opt-in artifact targets only `letsrealtalk-dashboard` on
`letsrealtalk.com/dashboard*`. It does not deploy Landing, Corex, Pay, Conf, or
anything on `rakhunok.com`. The `API` service remains `rahunok`; a test hostname
does **not** imply a sandbox backend. Do not exercise authenticated mutations
against that binding as part of an asset smoke test.

## Build and safety boundary

- `npm run build:dashboard:isolated` runs process-manifest generation and the
  **entire** SvelteKit route graph with `vite build --mode dashboard-isolated`.
- Intermediate output: `.svelte-kit-dashboard`; adapter output: `build-dashboard`.
- `appDir: 'dashboard/_app'`, empty `paths.base` / `paths.assets`, and
  `paths.relative: false` keep generated resource URLs under `/dashboard/_app/`
  without moving page routes or taking ownership of Landing's `/_app/*`.
- The default root build and existing deployment configurations/scripts are unchanged.
- The guard checks the exact test-domain Worker/config/binding contract, fallback
  asset URLs and files, client manifest files/dependencies, absence of concrete
  shared generated URLs, and every source page in the server build manifest.
- The full graph includes Corex's descriptive `/_app/` route catalog; that literal
  is not a generated resource reference and is deliberately allowed.
- Worker asset dispatch precedes dashboard shell dispatch. Missing assets remain
  404 (`not_found_handling: 'none'`), rather than returning HTML as JavaScript.
- Full graph compilation is intentional; route ownership, not bundle pruning,
  limits this deployment to Dashboard. Navigation to another product is outside
  this local smoke test's scope.

## Commands from the Corex root

- Unit regressions: `npm run test:dashboard:isolated`
- Full isolated build: `npm run build:dashboard:isolated`
- Guard and offline upload dry-run: `npm run check:dashboard:isolated`
- Local server: `npm --prefix worker run dev:dashboard:isolated`
  (loopback port 8788, inspector 9238, local service bindings).
- **Deployment, only when separately authorized:** `npm run deploy:dashboard:isolated`
  rebuilds, guards, dry-runs, then deploys using only the explicit isolated config.

Historically, no deployment or remote write was performed while implementing these artifacts.
That implementation-only status is superseded by the separately authorized rollout above.
The full normal root build passed after the authorized stop of local Wrangler on port 8787;
the isolated full build and matching dry-run also passed. Never substitute a partial root build
for the full-build prerequisite. Further deployments remain separately approval-gated.

## Local validation evidence (not production smoke)

- Full isolated build: 16 source pages; 199 generated files; 9 fallback entry assets.
- Isolated Wrangler dry-run: 208 asset files, Worker 4.83 KiB (gzip 1.66 KiB).
- 13 isolated guard/routing tests passed; 221 top-level Worker tests passed.
- Fresh headless Chromium loaded `/dashboard`, `/dashboard/`,
  `/dashboard/invoices/new`, and `/dashboard/settings`: HTTP 200 and hydrated login UI.
  All 111 observed generated asset responses used `/dashboard/_app/`, with correct
  MIME types; no page errors or failed HTTP responses.
- Missing isolated/shared assets and unrelated `/`, `/app`, `/pay`, `/corex`
  returned 404 on the isolated local Worker.
- Browser external and API requests were blocked. Google login consequently showed
  its expected unavailable message. Authenticated workflows were **not** certified.
- The server started for this check was stopped; ports 8788 and 9238 were released.
- Root deployment output was hash-checked unchanged; pre-existing unrelated dirty
  source files were preserved. Process-manifest regeneration records the new asset
  routing branches. Editor Svelte tooling can separately refresh ignored default
  `.svelte-kit` metadata; it is not a deployment artifact.

References: [SvelteKit configuration](https://svelte.dev/docs/kit/configuration),
[Cloudflare static asset routing](https://developers.cloudflare.com/workers/static-assets/routing/advanced/).
