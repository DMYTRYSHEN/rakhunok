# Dashboard Process Registry

This registry records Dashboard processes that have been analyzed and accepted. It is the
authority for change boundaries under `src/lib/features/dashboard` and `src/routes/dashboard`.

## Change Control

Each process has one status:

- `ANALYZING`: investigation is active; no stable behavior is asserted yet.
- `LOCKED`: the listed invariants must not change without separate, explicit user approval.
- `UNLOCKED`: a previously locked process has an approved change scope recorded here.

Before changing Dashboard code:

1. Identify every registered process touched directly or indirectly.
2. Do not modify a `LOCKED` process while implementing another module or process.
3. If a change to a `LOCKED` process is necessary, stop and request separate user approval,
   naming the process ID, invariant, reason, blast radius, and validation plan.
4. Record approved scope before implementation. Approval for one process does not unlock any
   other process.
5. After analysis and validation, update this registry with conclusions, evidence, affected
   files, and the final status.

Incidental refactoring, formatting, dependency replacement, schema work, and shared-component
changes do not bypass these rules.

## Analysis Order

### DASH-BUSINESS-DRAFTS-002 — authorized isolated rollout (updated 2026-09-09)

- **Status:** `ANALYZING` — authorized migration and isolated Dashboard deployment completed;
  production smoke remains ongoing in the main session. Earlier `LOCAL VALIDATED — REMOTE BLOCKED`
  status describes the pre-approval checkpoint, not the current rollout state.
- User approved persistence, scoped pre-deploy safety remediation, then the separate migration and
  Dashboard-only rollout below. This does not unlock any other registered process.
- Scope: isolated candidate SQL, transactional owner-scoped settings RPC, existing SDK adapter,
  non-operative settings UI and read-only invoice preview. Demo remains browser-only.
- DAC7 `mwaeazabpvbxqfrceogr`: migration `business_settings_drafts_v2_isolated`, version
  `20260908215439`; exact SQL SHA-256
  `be063e216e315d7e9f43823ff5671dde0d49d6cb130d8e44e91b73203bb8e734`.
  Source remains outside the automatic migration folder; applying unrelated checkout migrations
  is not authorized and would break the current browser Dashboard boundary.
- Two empty tables after rollback-only authenticated SQL read/save/CAS smoke: 1 → 2 succeeded,
  stale revision `40001`. Forced RLS, authenticated-only client RPC, zero operative FKs/custom triggers.
- Only `letsrealtalk-dashboard` deployed: `d098d3b5-ee9f-4ee2-9a8b-6a2cae62f390`,
  `letsrealtalk.com/dashboard*`, assets `/dashboard/_app/`. Test landing unchanged; shared API
  `rahunok` not deployed. No Git commit/push.
- Preserve Auth, TTL, operative recipient records, invoice creation, checkout and payment routing.
- Browser drafts are not automatically imported into the account. Missing RPC is an explicit error.
- Revision is server-owned; all sellers save atomically. Selected seller remains UI-only for account data.
- Current remediation evidence: 424 unit tests (117 settings), 204 PGlite, 249 real PostgreSQL;
  direct Svelte check 0 errors/0 warnings. Earlier 5 Chromium scenarios were not rerun; no component edits.
- Later build evidence: full normal root build PASS after authorized local Wrangler 8787 stop;
  isolated full build PASS, 13 targeted/221 Worker tests passed, Chromium 111 scoped asset responses
  with no errors. This asset smoke does not replace authenticated workflow testing.
- Authenticated real-JWT browser save **NOT tested**; SQL smoke is not equivalent. No production
  smoke PASS or full production compatibility certification is asserted.
- No operative FKs, cascade revision trigger, writes or row locks remain. Only internal settings FK
  cascade is retained. Deletion never mutates draft tuples/revisions; deleted/transferred references
  fail closed even when explicitly omitted with correct CAS. No automatic orphan repair.
- Draft-only parent/index locks preserve CAS. READ COMMITTED authorization refreshes after draft waits,
  not at commit; uncommitted/later operative changes are intentionally outside that snapshot.
- SQL/model share an explicit ASCII/Ukrainian prefix alphabet; incompatible v1/v2 local data is retained,
  not silently rewritten. Concurrency validated on authorized loopback55440; disposable DB cleanup
  verified. Existing scoped lint issues documented. Production compatibility is NOT certified.
- Contract and recovery limits: [persistence documentation](BUSINESS_SETTINGS_PERSISTENCE.md).
  Exact rollout evidence and pending checks: [2026-09-09 rollout](BUSINESS_SETTINGS_ROLLOUT_20260909.md).

Audit one process at a time in this order unless the user selects another process:

1. `DASH-AUTH-001` - authentication and session lifecycle.
2. `DASH-SHELL-001` - routing, navigation, and shell ownership.
3. `DASH-OVERVIEW-001` - overview reads and refresh behavior.
4. `DASH-INVOICE-001` - invoice list, detail, create, cancel, and events.
5. `DASH-POS-001` - POS state, order lifecycle, Realtime, and polling.
6. `DASH-STRUCTURE-001` - merchant, entity, terminal, and bank-account boundaries.
7. `DASH-DEVELOPER-001` - JWT and merchant API key lifecycle.
8. `DASH-SETTINGS-001` - browser-local and server-backed settings.

Unreviewed processes are not implicitly safe to redesign. Analyze them before changing their
contract or behavior.

## Locked Processes

### DASH-AUTH-001 - Authentication And Session Lifecycle

- **Status:** `LOCKED`
- **Reviewed:** 2026-09-04
- **Owner:** Dashboard root and gateway auth boundary
- **Files:**
  - `src/lib/features/dashboard/DashboardPage.svelte`
  - `src/lib/features/dashboard/api/dashboard-gateway.ts`
  - `src/lib/features/dashboard/api/dashboard-gateway.spec.ts`
  - `src/lib/features/dashboard/api/supabase-browser.ts`
  - `src/lib/features/dashboard/auth/DashboardLogin.svelte`
  - `src/lib/features/dashboard/auth/DashboardStateScreen.svelte`
  - `src/lib/features/dashboard/auth/MerchantOnboarding.svelte`

#### Conclusions

- Supabase Auth owns session persistence and token refresh. A custom session WebSocket must not
  replace the SDK lifecycle.
- Supabase auth events provide two-way sign-in, sign-out, and user-update propagation. Automatic
  token refresh must not trigger a full merchant restore or a full-screen loading state.
- Supabase Realtime WebSockets are reserved for merchant data changes; they are not the source of
  truth for authentication.
- A confirmed ready session may be retained in SPA memory across Dashboard route remounts while a
  background restore verifies it.
- The full-screen session state is allowed on cold start when no confirmed ready session exists.
  Internal Dashboard navigation must not repeatedly show it.

#### Locked Invariants

1. Authentication remains browser-side through the configured Supabase client.
2. Every real ready session is revalidated through `gateway.restore()` and merchant ownership is
   resolved by authenticated `user_id`.
3. Cached ready state is memory-only. It must not introduce a second persistent token or merchant
   cache and must be cleared on sign-out or a non-ready restore result.
4. `SIGNED_OUT` immediately clears the cached ready state, stops Dashboard Realtime subscriptions,
   and renders the guest state.
5. `SIGNED_IN` and `USER_UPDATED` may restore in the background. `TOKEN_REFRESHED` and
   `INITIAL_SESSION` must not cause duplicate restore loops.
6. Auth and Realtime subscriptions are created once per mounted Dashboard root and unsubscribed on
   teardown.
7. The demo session cannot grant production access and must not be used as evidence for production
   authorization or write readiness.
8. Session, access-token, and API-key plaintext must never be logged, placed in documentation,
   fixtures, URLs, or error messages.

#### Evidence

- Gateway auth-event unit coverage verifies event filtering and unsubscribe behavior.
- Dashboard gateway unit suite: 27 tests passed during the 2026-09-04 review.
- Repository unit suite: 257 tests passed during the 2026-09-04 review.
- `npm run check`: OpenAPI coverage clean and Svelte reported 0 errors and 0 warnings.
- Production build completed successfully after the session lifecycle change.

#### Approved Product Branding

- **Approved:** 2026-09-04
- **Scope:** Google OAuth consent-screen application display name only.
- **Required value:** `Rahunok` for both localhost and production origins.
- **Boundary:** The display name is owned by Google Auth Platform branding for the shared
  `PUBLIC_GOOGLE_CLIENT_ID`; it is not derived from the Dashboard hostname or Svelte code.
- **Locked invariant:** Do not rename the Google OAuth application or introduce a second OAuth
  client solely to produce different localhost and production display names without separate
  approval.

#### Reopen Conditions

Separate approval is required before changing any locked invariant, including replacing Supabase
Auth, persisting a custom session cache, changing merchant ownership resolution, handling token
refresh as a full restore, or sharing auth state through a new socket/service.

### DASH-INVOICE-ACTIONS-001 - Invoice Header Actions

- **Status:** `LOCKED`
- **Reviewed:** 2026-09-04
- **Owner:** Overview and invoice-list page headers
- **Files:**
  - `src/lib/features/dashboard/overview/DashboardOverview.svelte`
  - `src/lib/features/dashboard/invoices/InvoiceList.svelte`

#### Conclusions

- Export belongs to the complete invoice register, not the financial overview.
- Export is not implemented and must remain visibly disabled until a separate export contract is
  analyzed and approved.

#### Locked Invariants

1. The Overview header does not render the Export action.
2. The Invoice List header renders Export immediately to the left of New Invoice.
3. Export remains disabled and performs no action until its data scope, format, authorization,
   audit behavior, and large-dataset strategy are approved.
4. New Invoice retains its existing route and demo-query behavior.

#### Evidence

- `svelte-check`: 0 errors and 0 warnings after implementation.
- Svelte autofixer: no issues or suggestions for either affected component.
- Browser verification: Overview contains no Export action; Invoice List renders disabled Export
  immediately left of New Invoice at 1070 px and 390 px viewport widths, with no horizontal page
  overflow.

#### Reopen Conditions

Separate approval is required to activate, remove, rename, or relocate Export, or to change the New
Invoice route as part of another process.

### DASH-POS-SETTINGS-001 - Terminal Order Expiry

- **Status:** `LOCKED`
- **Reviewed:** 2026-09-04
- **Owner:** Dashboard settings, POS order contract, and checkout expiry boundary
- **Files:**
  - `src/lib/features/dashboard/DashboardPage.svelte`
  - `src/lib/features/dashboard/settings/DashboardSettings.svelte`
  - `src/lib/features/dashboard/pos/PosBoard.svelte`
  - `src/lib/features/dashboard/pos/pos-order-contract.ts`
  - `src/lib/features/dashboard/invoices/InvoiceCreate.svelte`
  - `src/lib/features/dashboard/api/dashboard-gateway.ts`
  - `apps/checkout/js/order-expiry.js`
  - `supabase/migrations/20260903235104_merchant_settings.sql`

#### Conclusions

- `orders.expires_at` is the canonical order deadline. TTL values remain seconds from persisted
  settings through order construction; conversion happens only when creating the timestamp.
- TABLE orders use the merchant's `table_order_ttl_seconds`, stored in the owner-only
  `merchant_settings` row. The default is 1,800 seconds.
- NFC tag orders always use 300 seconds. KSO (`kasa`) orders write `expires_at = null` and remain
  active until explicitly paid or cancelled.
- Checkout distinguishes an explicitly null expiry from a missing legacy field. Explicit null is
  unlimited; only a missing field uses the legacy `created_at` fallback.
- Manual TABLE invoices carry the selected immutable `terminal_id`; parsed table text is not a
  substitute for terminal identity.

#### Locked Invariants

1. Theme preference may remain browser-local. TABLE order TTL must be read from and saved to
   Supabase, not localStorage.
2. TABLE, NFC tag, and KSO expiry policies are 1 configured value, 300 seconds, and no deadline,
   respectively.
3. KSO's explicit null deadline must never be converted to the legacy fallback by checkout.
4. Existing orders retain their stored `expires_at`; settings changes apply only to new orders.
5. Manual TABLE invoice creation must pass the selected terminal's ID to the Worker API.

#### Evidence

- Dashboard gateway suite: 28 tests passed.
- POS order contract suite: 7 tests passed.
- Checkout suite: 10 tests passed.
- `npm run check`: OpenAPI coverage clean and Svelte reported 0 errors and 0 warnings.
- Svelte autofixer: no issues for Dashboard root, settings, or POS components.
- Local database lint was unavailable because Docker is not installed. The migration remains local
  and requires an approved remote migration before production UI rollout.

#### Reopen Conditions

Separate approval is required to change terminal-specific TTL values, restore browser-local TTL,
reinterpret explicit null expiry, or derive TABLE identity without `terminal_id`.

## Active Analyses

### DASH-POS-001 - POS First Navigation And Update Recovery

- **Status:** `ANALYZING`
- **Reviewed:** 2026-09-07
- **Scope:** User-reported invisible cash button after first navigation; related read-only audit.
- **Changed files:** `src/lib/features/landing/landing.css`,
  `src/routes/dashboard/dashboard-navigation-styles.e2e.ts`.

#### Conclusions And Implemented Fix

- Reproduced landing-to-POS client navigation: the pending cash button was in the DOM but had
  a transparent background and white text. Reload restored its emerald background.
- Landing's unlayered global button reset overrode Tailwind utilities. The same leak removed
  cancellation borders, draft button backgrounds and control typography; global link reset
  also overrode link colors. Root radius tokens leaked into Tailwind radii.
- Scoped landing resets and custom properties to its wrapper, gated document styles on that
  wrapper's presence, and removed the duplicate Tailwind import. No Dashboard runtime, payment,
  authorization, order status or TTL logic changed. Existing locked processes remain locked.

#### Evidence

- Production build succeeded; an initial four-case Playwright run passed (390/1440 px, light/dark),
  but repeated final runs were unstable (latest: 2 passed, 2 timed out during style comparison).
  Browser test stabilization remains open; do not treat this as a fully green final E2E gate.
  Tests assert same-document navigation and compare cash, cancel and draft computed styles
  against direct load and reload, including backgrounds, borders, radii and typography.
- Dashboard unit tests: 13 files, 72 tests passed. Svelte check: 0 errors, 0 warnings.
- Demo is used solely for no-write visual verification, not production authorization evidence.

#### Risks And Open Questions

- Separate auth defect: `startAuthSync()` runs before gateway initialization and returns early.
  Repair requires a separately approved `DASH-AUTH-001` scope and session-race regression tests.
- Initial reads precede Realtime subscription; no subscription-ready catch-up or advertised
  fallback polling is implemented. Missed updates can remain stale. Failed refresh resources
  are not requeued. These were not the cause of the reproduced invisible-button screenshot.
- POS selection is limited to 50 pending/paid rows; newer paid rows can mask older pending rows.
  Status handling (`preparing` versus `pending`) needs contract analysis before alteration.
- No deployment, remote data writes or changes to locked invariants were performed.

#### Follow-up: New Draft After Paid Order

- **Requested:** 2026-09-07, rename the POS entry action to `Нове замовлення (чернетка)`
  and display it below `Відкрити рахунок` when the previous order is paid.
- Implemented in `pos/PosBoard.svelte` using the existing terminal-specific `openDraft` action.
  Pending cards retain cash/cancel only; previous paid receipts remain accessible.
- Existing draft retention, pending-order guard, API payload and locked expiry policies unchanged.
- Validation: 7 POS contract tests and 3 targeted POS browser tests passed, including paid-card
  button placement and opening the correct terminal's empty draft on mobile. Production build
  succeeded; Svelte check reported 0 errors and 0 warnings. Earlier navigation-style test
  instability remains a separate open issue.

### DASH-POS-001 Follow-up: Hidden Newly Created TABLE Order

- **Status:** `ANALYZING`; targeted read-projection fix implemented on 2026-09-07.
- Read-only inspection of the two user-supplied orders confirmed identical immutable terminal
  IDs for `table-30`: the old order was `paid`, the newer order was `preparing`. Creation and
  assignment succeeded; POS excluded the new row in both its query and mapper.
- `api/dashboard-gateway.ts` now includes `pending`, `preparing`, `ready`, and `paid` in POS
  reads. Unpaid lifecycle stages map to the existing POS `pending` presentation, matching the
  invoice summary convention. This retains unpaid actions and the duplicate-draft guard without
  rewriting stored statuses or changing create payloads, ownership, authentication, or TTL.
- Regression tests cover each unpaid stage replacing an older paid receipt, immutable terminal
  assignment, a repeated board read, and duplicate creation blocking. Dashboard unit suite:
  13 files / 74 tests passed.
- Remaining independent risks: global 50-row history window, paid-over-active selection in
  inconsistent histories, and the previously recorded refresh/auth issues. The observed new
  order also has a seven-day stored expiry; server-side expiry handling requires separate
  investigation under `DASH-POS-SETTINGS-001`, not an incidental change here.
- No remote records, schema, policies, or deployment were changed. Security advisors were
  inspected; existing RLS notices are separate from the confirmed status-filter defect
  ([RLS policy guidance](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)).
- Final Svelte check: 0 errors / 0 warnings. Targeted browser tests could not start because
  the static adapter encountered Windows `EBUSY` while removing `build`; no new E2E pass is claimed.

### DASH-INVOICE-001 Analysis: Missing Reusable TABLE Link

- **Status:** `ANALYZING`; read-only investigation requested on 2026-09-07.
- The user-supplied invoice was confirmed to retain `terminal_id`, terminal code `table-30`,
  table number 30, and lifecycle status `preparing`.
- `invoices/invoice-links.ts` exposes `/tag/<reference>` only for raw `pending`, hiding it for
  `preparing` and `ready`. The Pay page itself renders table information as text, not a link.
- `/pay/<UUID>` remains an invoice-specific address; `/tag/table-30` is a reusable terminal
  entry and is not an interchangeable replacement for the invoice URL or its customer QR.
- Further fixes must resolve codes through immutable terminal identity rather than assuming
  invoice reference always equals terminal code. Existing Core API terminal resolution also
  filters only `pending`; changing that backend is outside this read-only investigation.
- No link-generation, Pay, backend, or remote data changes were made for this request.

#### Approved Follow-up: Show Linked Terminal On Every Invoice Status

- User approved showing `Багаторазовий QR терміналу або столу` on linked invoice details,
  including the reported preparing order. Implemented locally on 2026-09-07.
- Invoice detail resolves `terminalCode` by its immutable `terminalId` after the merchant-scoped
  invoice read, using the existing authenticated client and terminal RLS. No auth invariants changed.
- Share links now include the encoded `/tag/<terminalCode>` whenever a resolved terminal is
  attached, independent of lifecycle status. No code is guessed from invoice reference/table number.
- Existing invoice-specific `/pay/<UUID>` checkout link, customer QR, and receipt URL are unchanged.
  Pay rendering, terminal routing, persisted records, TTL, and deployment are outside this change.
- Validation: 81 Dashboard unit tests passed; Svelte check 0 errors / 0 warnings. Browser demo
  invoice displayed the reusable label, terminal path, and copy button, while checkout retained
  `/pay/demo-1047`. Demo verification does not establish production authorization or route resolution.

## Process Record Template

```markdown
### DASH-AREA-NNN - Process Name

- **Status:** `ANALYZING | LOCKED | UNLOCKED`
- **Reviewed:** YYYY-MM-DD
- **Owner:** Owning module or boundary
- **Files:** Exact implementation and test files

#### Observed Flow

#### Conclusions

#### Locked Invariants

#### Allowed Changes

#### Evidence

#### Risks And Open Questions

#### Approval Record

#### Reopen Conditions
```
