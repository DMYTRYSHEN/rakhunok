# Core to Corex Migration Plan

## Objective

Rebuild the working product from `D:\svetle\core` in `D:\svetle\corex` using the latest stable Svelte 5, SvelteKit, TypeScript, Vite, Tailwind CSS, Vitest, and Playwright versions available when scaffolding begins.

The migration must reproduce current behavior before any redesign or backend change. The deployed Cloudflare Worker and Supabase database remain unchanged during this project. No Wrangler deployment is allowed until local parity is complete and separately approved.

## Sources of Truth

Use these legacy sources to characterize behavior:

- Landing: `../core/Index.html`
- Merchant POS/PWA: `../core/app/index.html`, `../core/app/assets/app.js`, `../core/app/assets/app.css`
- Payer checkout: the active scripts and markup in `../core/checkout`
- Merchant dashboard: the active scripts and markup in `../core/dashboard`
- API documentation: `../core/docs`
- Compatibility redirect: `../core/pay`
- API contract: route handlers in `../core/worker/src`
- Database behavior: the live API behavior first; `../core/db` is supporting documentation only

Do not treat `../core/dist`, `../core/public`, `.wrangler` output, patch scripts, modular prototypes, or `dashboard-v2` as canonical implementations. They may be inspected for comparison but must not silently replace active behavior.

## Non-Negotiable Constraints

1. Build all new frontend code in `corex`; do not rewrite the legacy frontend in place.
2. Do not change `core/worker`, Worker routes, request/response payloads, status values, authentication headers, or edge-injected checkout data.
3. Do not change Supabase tables, migrations, RLS policies, Auth settings, Realtime behavior, or production data.
4. Keep browser-side Supabase operations in the browser where the legacy app relies on the current RLS boundary.
5. Do not run `wrangler deploy`, publish Pages assets, or overwrite `core/dist` during migration.
6. Preserve current public routes and direct-navigation behavior.
7. Replace a legacy surface only after automated checks and manual parity review pass.
8. Do not introduce redesigns, renamed business concepts, or speculative API abstractions during parity work.

## Target Structure

```text
corex/
├─ src/
│  ├─ lib/
│  │  ├─ api/                 # typed clients for the unchanged Worker API
│  │  ├─ auth/                # Supabase browser auth and session behavior
│  │  ├─ components/          # shared presentational components
│  │  ├─ stores/              # explicit UI/session/order state
│  │  ├─ types/               # contracts inferred from live behavior
│  │  └─ utils/               # formatting, route parsing, timers, platform checks
│  └─ routes/
│     ├─ +page.svelte                     # landing
│     ├─ app/+page.svelte                 # POS PWA
│     ├─ checkout/+page.svelte            # payer checkout query route
│     ├─ o/[id]/+page.svelte              # checkout aliases
│     ├─ t/[id]/+page.svelte
│     ├─ tag/[id]/+page.svelte
│     ├─ pos/[id]/+page.svelte
│     ├─ pay/[id]/+page.svelte
│     ├─ dashboard/+page.svelte           # merchant cabinet
│     └─ doc/+page.svelte                 # API documentation
├─ static/                                # manifest and approved static assets
├─ tests/
│  ├─ unit/
│  └─ e2e/
└─ docs/MIGRATION_PLAN.md
```

Route groups may be introduced later if they improve layouts without changing URLs.

## Required URL Compatibility

Preserve at least:

```text
/
/app/
/checkout/?id=:id
/o/:id
/t/:id
/tag/:id
/pos/:id
/pay/:id
/dashboard/
/doc/
/docs
/docs/
```

The legacy Worker currently redirects `/` to `/dashboard/`, while `core/Index.html` is the landing page. Build the landing at `/` locally, but do not change production routing until that conflict is explicitly resolved.

## Implementation Order

```text
Characterization and baseline
-> SvelteKit foundation
-> Landing
-> POS authentication and read paths
-> POS order lifecycle
-> Checkout display and route resolution
-> Checkout payment, QR, deep links, Realtime, and polling
-> Dashboard
-> Docs and compatibility routes
-> Full parity QA
-> Separate deployment decision
```

## Step-by-Step Plan

### Phase 0: Characterize the Legacy Product

- Run every legacy surface locally against the unchanged Worker where possible.
- Record desktop and mobile screenshots for normal, loading, empty, error, and success states.
- Capture all network requests, payloads, headers, responses, redirects, and status transitions.
- Inventory localStorage/sessionStorage keys, URL parameters, cookies, Supabase calls, Realtime channels, timers, and global variables.
- Record current accessibility names and keyboard behavior for critical workflows.
- Create a route/API behavior matrix before implementing new components.

Exit gate:

- Every user-visible surface and critical workflow has an explicit baseline.
- Unknown or contradictory behavior is documented instead of guessed.

### Phase 1: Scaffold Corex

- Initialize the latest stable Svelte 5 and SvelteKit directly in `corex`.
- Use strict TypeScript and pin exact resolved versions in the lockfile.
- Add adapter-static only after confirming its output works with the unchanged Worker's assets behavior.
- Configure Tailwind, ESLint, Prettier, `svelte-check`, Vitest, and Playwright.
- Add a local `/api` proxy to the unchanged Worker at `http://localhost:8787`.
- Keep build output separate from `core/dist`, for example `corex/build`.

Exit gate:

- Typecheck, unit test, production build, direct route refresh, and a basic Playwright smoke test pass.
- No file under `core/worker`, `core/db`, or `core/dist` has changed.

### Phase 2: Typed Compatibility Layer

- Derive request and response types from the active Worker route handlers and observed responses.
- Implement a fetch wrapper preserving current paths, methods, bearer headers, body shapes, and error semantics.
- Preserve edge globals `window.__INITIAL_ORDER__` and `window.__INITIAL_BANKS__` for checkout hydration.
- Implement browser-only Supabase initialization with the same Auth persistence and RLS boundary.
- Centralize route parsing, amount formatting, timer cleanup, and platform detection without changing behavior.

Exit gate:

- Contract tests compare legacy and Corex requests for representative workflows.
- No new SvelteKit server endpoint proxies or mutates production data.

### Phase 3: Landing

- Port `core/Index.html` to Svelte components while preserving content, metadata, links, responsive styling, animations, forms, and modals.
- Preserve OAuth hash forwarding to `/dashboard/`.
- Keep the current `/api/leads` behavior visible as a known incompatibility because that endpoint is absent from the Worker; do not invent a backend route.
- Verify all CTA destinations against the route compatibility matrix.

Exit gate:

- Desktop and mobile screenshot parity is accepted.
- OAuth fragment forwarding and every CTA work as before.

### Phase 4: Merchant POS/PWA

- Port login/session restoration first.
- Port entity and terminal selection.
- Port the calculator and `fixed`, `table`, and `open_amount` modes.
- Port order creation with exact payload parity.
- Preserve active-table collision handling, cancellation, QR display, sharing, history, and statistics.
- Preserve three-second status polling and stop timers on order change, completion, cancellation, navigation, and component destruction.
- Move the manifest to `static`; do not enable the existing cache-first service worker until stale-auth and upgrade behavior are tested.

Exit gate:

- Signed-out and signed-in flows pass.
- All calculator operations and order types match legacy results.
- Insert payloads, QR/share URLs, collision flows, status transitions, and RLS isolation match the legacy app.

### Phase 5: Checkout Read Path

- Port checkout identifier extraction and resolution for UUID, short ID, order number, terminal alias, query parameters, and compatibility paths.
- Consume edge-injected initial order and bank data before fetching to avoid duplicate loading.
- Port merchant, amount, item, delivery, promo, and status presentation.
- Reproduce pending, paid, expired, cancelled, not-found, network-error, and retry states.

Exit gate:

- Every supported identifier and alias resolves identically.
- Direct navigation and refresh work without route loss.
- Initial edge data does not produce a visible duplicate fetch state.

### Phase 6: Checkout Payment Path

- Port bank list/carousel, logos, fee display, and selected-bank behavior.
- Preserve NBU 003 QR generation and current Worker initiation/payment payloads.
- Preserve reCAPTCHA success, failure, expiry, and retry behavior.
- Preserve bank deep-link launch inside the initiating user gesture where required.
- Reproduce iOS, Android, and desktop universal-link/popup fallback timing.
- Add duplicate-submit protection without changing request semantics.
- Preserve checkout event recording, status polling, and terminal/table Realtime order replacement.
- Stop all polling and subscriptions on terminal state or component destruction.

Exit gate:

- Payment request traces match the legacy checkout.
- Deep-link and fallback tests pass on representative mobile/desktop environments.
- Paid status can arrive through the existing webhook/status path without frontend changes to Worker or Supabase.

### Phase 7: Merchant Dashboard

- Use `core/dashboard` as the behavior source; do not base the migration on incomplete `dashboard-v2`.
- Port in this order: authentication/session shell, navigation/layout, overview, orders, order detail, POS, business entities, bank accounts, terminals, and audit/events.
- Preserve Google Auth, passkeys, localStorage keys, direct Supabase CRUD, Worker calls, pagination, filters, and Realtime subscriptions.
- Verify unauthorized, empty, loading, stale-session, validation, and network-error states on every route.

Exit gate:

- CRUD requests and database-visible outcomes match the legacy dashboard.
- Session restoration and protected navigation behave identically.
- Realtime updates and cleanup pass repeated navigation tests.

### Phase 8: Docs and Compatibility Routes

- Preserve `/doc`, `/docs`, and `/docs/` behavior.
- Preserve `/pay/:id`, `/o/:id`, `/t/:id`, `/tag/:id`, and `/pos/:id` without breaking old links or QR codes.
- Render the existing OpenAPI document as-is during parity migration; reconcile documentation and Worker routes in a separate approved project.

Exit gate:

- Existing bookmarks, QR codes, and direct URLs resolve to the correct Corex screen.

### Phase 9: Full Local Parity QA

- Run `svelte-check`, TypeScript, lint, unit tests, production build, and Playwright.
- Test mobile and desktop layouts for overflow, overlap, focus order, keyboard operation, and text scaling.
- Run Corex against the unchanged local Worker and approved test Supabase environment.
- Compare screenshots and network traces with the Phase 0 baseline.
- Verify Auth, RLS, Realtime, polling cleanup, QR payloads, sharing, deep links, payment statuses, and refresh behavior.

Exit gate:

- All agreed parity checks pass and remaining differences are explicitly approved.

### Phase 10: Deployment Readiness, Not Deployment

- Produce a standalone Corex build without overwriting `core/dist`.
- Validate compatibility with the current Worker assets routing in a local or isolated preview only.
- Document required future Worker/build-path changes without applying them.
- Do not run `wrangler deploy`.
- Deployment requires a separate approval, rollback plan, and production smoke-test checklist.

## Known Risks to Track

- The Worker root redirect conflicts with the desired landing route.
- The landing posts to `/api/leads`, which the Worker does not currently expose.
- Checked-in SQL and migrations do not fully describe fields used at runtime.
- Legacy status values are inconsistent in some files; observed production/API behavior wins during parity work.
- `rakhunok.com` and `letsrealtalk.com` both appear in legacy URL generation.
- Active checkout/dashboard inline code differs from cleaner modular prototype files.
- Current OpenAPI files do not fully match active Worker routes.
- PWA cache-first behavior may retain stale authenticated HTML or scripts.
- Bank deep links are sensitive to timing, user gesture, platform, and browser popup policy.

These risks must be documented and tested. They must not be fixed by changing Worker or Supabase during the frontend migration.

## Definition of Done

The migration is complete only when:

- all required URLs and workflows have behavioral parity;
- automated type, build, unit, integration, and browser tests pass;
- desktop and mobile visual parity is accepted;
- no unapproved Worker, Supabase, or production deployment change exists;
- the old frontend remains available for rollback;
- deployment is handled as a separate, explicitly approved operation.
