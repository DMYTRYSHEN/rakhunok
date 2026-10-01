# Rahunok Platform

Standalone Svelte 5/Vite application owning the DAC7 workspace. No Dashboard,
SvelteKit, or Corex imports are required by this application.

## Product knowledge

[Platform knowledge base](docs/PLATFORM_KNOWLEDGE_BASE.md) is the living Ukrainian
reference for product scope, DAC7 sources, local VARUS materials, roles, prototype
gaps, open legal questions, and the proposed implementation roadmap.
It distinguishes verified sources from proposals and unverified legal claims.

[Implementation plan](docs/IMPLEMENTATION_PLAN.md) tracks the agreed demo-first
delivery scenario, tasks E0-E10, acceptance checks, and separate live-integration gates.

## Local development

From the repository root:

```sh
npm install
npm run dev:platform
npm run check:platform
npm run test:platform
npm run build:platform
```

Open `http://127.0.0.1:5178/platform/` to select a demo role on the login screen.
The root development server serves `/platform` through a thin adapter using the same app.
Legacy `/dac7` and `/dac7/` links redirect to `/platform`, preserving query parameters.
Port 5178 is strict; choose another with
`npm --prefix apps/platform run dev -- --port 5179` if it is occupied.
The standalone dev and preview servers redirect the bare base path to `/platform/`
while preserving query parameters. The root dev proxy excludes `/apps/` source
modules from the merchant application's `/app` route.

The build writes only `apps/platform/dist`. `BASE_URL` overrides the default
`/platform/` base. A future host must serve static assets and use `index.html` as the
SPA fallback; retain both bare `/platform` and `/platform/*` routing and redirect
legacy `/dac7` links. No Worker or
deployment is included in this extraction.

## Public configuration

Vite reads the root environment files. Browser-visible values:

- `PUBLIC_SUPABASE_URL`
- `PUBLIC_SUPABASE_PUBLISHABLE_KEY` (preferred), or `PUBLIC_SUPABASE_ANON_KEY`
- `PUBLIC_GOOGLE_CLIENT_ID`

Never put a service-role key, secret key, or Google client secret in these values.
Missing configuration leaves demo available and disables sign-in. Register the
exact development/production origin in Google's authorized JavaScript origins.
Configure the Supabase provider callback separately. New origins do not inherit
browser sessions or local preferences; users may need to sign in again.

Platform owns its Google ID-token integration and Supabase client. Google receives
the SHA-256 nonce; Supabase receives the raw nonce. The SDK owns session
persistence/refresh. Auth changes are subscribed to and unsubscribed on teardown.
Dashboard authentication code and its locked process are not modified.

## Data and safety boundaries

### E1-E7 interactive demo

Open `/platform/?demo=1&role=platform` for the operator or
`/platform/?demo=1&role=seller` for the shared self-employed participant. Explicit SaaS admin:
`/platform/?demo=1&persona=rahunok-admin`. The context selector includes operator
delegates; navigation and data are filtered by their simulated permissions.
Two operators share one of four seeded synthetic participants. Additional
self-employed participants can be onboarded for delivery, taxi, services or other
activities; internal `courierId` identifiers remain for compatibility. Amounts use integer UAH minor
units. Contact changes, audit history, reload and reset use the dedicated
`rahunok.platform.demo.v1` storage key. This is not server-side authorization.
Stale-tab detection is best effort, not an atomic concurrency mechanism.

Run `node --test scripts/platform-demo.browser.test.mjs` from the root for the
isolated headless module checks. No manually running server is required.
Screenshots go to `test-results/platform-demo`. Visual review remains open;
automated interaction and mobile page-overflow checks passed.

The shared demo includes structured registration details, multiple platforms and
activities, versioned packages and independent approval. New packages record exact
document versions; replacing an attachment requires a new package and approval.
It also includes seller evidence and operator relationships, team invitations and revocation,
scoped test keys, CSV/JSON ingestion, separate financial register filters,
append-only adjustments, external payout reconciliation and approved payout batches.
Quarterly immutable report snapshots support versioned reportability assessments,
explicit fees/withholding, simulated receipts and corrections. New DEMO-UA-v2
artifacts retain all rows for reconciliation but include only reportable rows in
the submission section. Self-employed participants receive only their own accepted
extracts, without internal assessments. SaaS administrators normally see technical
metadata and can suspend new operations without blocking reconciliation of prior work.
Exceptional support reads require a reason, independent operator approval, a
profile/finance scope and a 1-60 minute expiry. Reads are persisted before disclosure;
expiry, role changes and observed cross-tab revocation clear the displayed payload.

These are local domain commands, not deployed HTTP endpoints or bank/tax services.
Versioned synthetic DEMO TXT files (20 KB each, 100 versions per operator) support
independent acceptance/rejection, expiry and financial/registration readiness checks.
They are not verified identity documents or signed official evidence. Missing mandatory
document categories are not detected: the legal checklist has not been established.
Reportability and charges are manually recorded demo decisions, not a tax engine.
No tax rate or official reporting format is established.
E8 automated acceptance covers continuous routes A/B and role navigation at
1440/390 px, with scoped text contrast checks, taxi onboarding/document revisions
and temporary support access (17 browser tests). Reliable manual
visual review remains open; these checks are not a complete WCAG audit.

Latest design gate: 18 workflow browser tests plus 4 production-loading tests;
build passed without the >500 KB warning. Svelte check: 0 errors/0 warnings.
The prior domain validation passed 47 unit tests in 6 files; domain code is unchanged.
The former eager JS bundle was 753.82 KB (202.61 KB gzip). The production demo
overview now requests 161.43 KB JS in total (53.44 KB summed gzip), including the
54.87 KB entry and its loaded dependencies.
Auth/legacy workspaces and unopened feature panels are absent from overview requests.
Panels load on demand; subsequent visits reuse browser modules. Persona keys are
preserved while imports resolve. Failed imports offer a page reload; persisted
demo data survives, but unsaved form edits do not. No eager all-section prefetch is used.

Run `npm run build:platform` and then
`node --test scripts/platform-loading.browser.test.mjs` for production loading checks.
They enforce overview budgets of 180 KB raw / 65 KB summed gzip JS, test desktop
and mobile, cached revisits, persona changes during pending imports, and failed
chunk recovery. Gzip is calculated from requested files, not a claim about hosting
compression. CSS source scanning is restricted to this app; entry CSS is 71.56 KB.
A local Chromium run observed overview visibility at 560 ms desktop and 1049 ms
mobile (4x CPU slowdown, 200 KB/s download, 40 ms latency); FCP was 144 / 480 ms.
These are single-run lab observations, not field Core Web Vitals or guaranteed
load times. No before/after timing trace was captured. Production hosting still
needs compression and versioned-asset caching configured separately.
These results supersede the historical 38-unit/15-browser checkpoint in the plan.
No deployment or real external action was performed.
Use `workspace=legacy` for the earlier prototype. `role=admin` alone still opens
the legacy admin, not the SaaS administrator.

### Design refinement

The shared shell uses a neutral/green palette, clearer typography, 44 px controls,
visible keyboard focus and a skip-to-content link. Financial summaries precede
action-oriented tasks on the operator overview. Integration flows separate keys,
input and verification; the preview precedes write actions, and editing input
invalidates both the preview and previous result. Technical results remain available
in expandable details. Demo disclosures and role permissions are preserved.
The design regression covers 1440/390 px, hierarchy, keyboard entry, import state
and horizontal overflow. This is not a complete redesign of every feature panel,
a complete accessibility audit or usability acceptance with real users.

### Guided document entry

Every demo section has expandable workflow instructions. The shared document form
supports manual entry and staged local file import for operators and self-employed
participants. TXT imports name/content and preserves the current ID/category/expiry;
JSON imports exactly `id`, `category`, `name`, `content`, `expires`. Download the JSON
template from the form. Review the preview, apply it to the form, then submit the
version separately. Cancel or invalid input does not overwrite manual fields.

Only synthetic evidence is supported: `DEMO-doc-*` identifiers, `DEMO-*.txt` names,
content beginning with `DEMO`, a valid future expiry, and at most 20,000 content
bytes. TXT files are limited to 20,000 bytes; JSON envelopes to 150,000 bytes.
Unknown JSON fields, including owner/status, are rejected. PDF/image OCR and real
document storage are not implemented. Imports do not transmit files externally
or bypass existing ownership, versioning, and independent review rules.

Latest guided-entry validation supersedes the design checkpoint above: 52 unit
tests, 19 workflow browser tests, 4 production loading tests, Svelte check with
zero errors/warnings, and a successful build. Initial overview JS: 168,078 bytes
(55,445 summed gzip bytes), within the existing 180 KB / 65 KB budgets.

### Legacy prototype

`?demo=1` always uses a gateway without a Supabase client, including when a real
session already exists. Reads return fixtures and payout/PIN actions are local
simulations. Demo exit does not sign out a real account. Local demo preferences
remain browser-local and are not authorization controls.
The login role selector opens `?demo=1&role=platform` (or another listed role).
Unknown roles fall back to `seller`; role query parameters never select a live role
or grant permissions after Google sign-in.

The live gateway retains the existing direct dependencies on `merchant_memberships`,
`sellers`, `payouts`, `diia_sessions`, `pinpay_sessions`, and `loyalty_accounts`.
This extraction does not establish tenant authorization or production readiness.
Existing prototype behavior includes fixture fallback on empty/failed reads,
local role switches, a fixed payout tenant, and synthetic successful payouts on
insert failure. These require a separate reviewed backend/security workstream.
Tax calculations and legal text are legacy fixtures, not validated legal advice.

## Ownership

- `src/lib/dac7`: feature UI, types, gateway, fixtures and regression tests.
- `src/lib/demo`: E1-E7 domain commands, contextual projections, UI and regression tests.
- `src/lib/auth`: Platform-owned browser auth integration.
- `docs/dac7-openapi.yaml`: existing DAC7 prototype contract, relocated unchanged.
- `src/routes/platform/+page.svelte` at repository root: application adapter.
- `src/routes/dac7/+page.ts` at repository root: legacy redirect only.
- Root Corex scenario: remains a Corex visualization consuming the contract.
- `worker/src/dac7-worker.ts` and `worker/wrangler.dac7.jsonc`: existing prototype,
  intentionally unchanged until the separate Worker phase.
- Root Supabase migrations: remain in the historical migration chain, unchanged.

The contract's sample server URLs and paths are inherited prototype documentation;
they are not evidence of a deployed API. The frontend gateway does not yet use
that Worker. Real Google sign-in, RLS, payment execution, and deployment require
separate environment-backed validation.