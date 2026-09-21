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

### CROSS-APP-INVOICE-SCENARIOS-001 — established invoice scenarios (2026-09-21)

- **Status:** `LOCKED` — the user-approved Universal-Link-first correction for `fixed`,
  `open_amount`, `table`, and `delivery` was implemented, validated, and deployed to the test domain
  on 2026-09-21; all invariants are locked again.
- **Owner:** Dashboard invoice creation and POS, Pay checkout, Merchant app invoice/POS entry,
  shared scenario contracts, and Worker order APIs.
- **Scenarios:** `fixed`, `open_amount`, `table`, and `delivery`.
- **Approval boundary:** Any direct or indirect behavior change requires separate, explicit user
  approval naming the affected scenario or scenarios. Approval for another process, new scenarios,
  template work, visual cleanup, refactoring, dependency changes, or deployment does not unlock this
  process.
- **Applicable instruction:** `.github/instructions/invoice-scenario-locks.instructions.md`.

#### Approved Temporary Scope — Public Scenario Catalog

- On 2026-09-21, the user explicitly approved enabling the non-payment scenario catalog at
  `/pay/?demo=all`, then separately approved opening the catalog's `fixed`, `open_amount`, `table`,
  and `delivery` demo fixtures for display only.
- Allow the exact 19 catalog demo URLs on the test domain `letsrealtalk.com` and local preview
  hosts. Keep `rakhunok.com` blocked. Preserve real invoice routing, amounts, validation,
  persistence, payment entry, and status behavior; every forced demo remains non-payable.
- Limit implementation to the Pay scenario-selection gate, its focused regression test, and this
  registry record. The process remains `LOCKED` outside this exact scope.

#### Public Scenario Catalog Scope Closure Evidence

- The Pay suite covers all 19 catalog URLs on `letsrealtalk.com`, verifies that none can initiate a
  payment, rejects every catalog URL on `rakhunok.com`, and resolves the non-payment `index`
  definition to the existing catalog renderer.
- `svelte-check` diagnostics and the Svelte autofixer report no issues in the changed state slice;
  the Pay production build succeeds and the catalog contains all 19 entries.
- The existing `letsrealtalk-checkout` Worker routes were deployed to the test domain only. No
  Worker route, invoice payload, payment behavior, or `rakhunok.com` environment was changed. The
  approved scope is closed and `CROSS-APP-INVOICE-SCENARIOS-001` remains `LOCKED`.

#### Approved Temporary Scope — Universal Link First

- For Monobank (`MONO`/`UNJS`), return the payload-bearing Universal Link
  `https://mbnk.app/qr/<payload>` as both `redirect_url` and `fallback_url` on iOS, Android, and
  desktop. The bank-owned link decides the native application handoff.
- Use OS-specific custom schemes or package-bound intents only for banks without a configured
  Universal Link. Existing non-Monobank routing remains unchanged.
- Preserve the exact NBU payload, amounts, statuses, persistence, invoice-scenario resolution, and
  checkout behavior outside bank-link selection. Limit edits to the Pay/Worker generators, focused
  contract tests, and this registry record; validate Pay, Worker, and root checks before relocking.

#### Universal-Link-First Scope Closure Evidence

- Pay and Worker now return `https://mbnk.app/qr/<payload>` as both the primary redirect and fallback
  for Monobank (`MONO`/`UNJS`) on iOS, Android, and desktop. Existing platform-specific behavior for
  banks without a Universal Link remains unchanged.
- The complete Pay suite passes 232/232, the Worker index suite passes 13/13, and root `npm run
  check` reports 0 Svelte errors and 0 warnings. Root and Pay builds plus backend and checkout
  production-environment dry-runs completed successfully.
- The correction was deployed only to `letsrealtalk.com`: backend version
  `08512a4b-35ff-475d-b045-0b911e3889cd` and checkout version
  `fa198886-d06d-44a3-9583-6807c1f12c78`, with checkout bound to `letsrealtalk-web-preview`. No
  `rakhunok.com` route or shared `rahunok` Worker was deployed.
- Remote smoke returned HTTP 200 for `/`, `/dashboard`, `/app`, `/conf/`, `/pay`, `/pay/`, and
  `/corex`. A live Monobank initiation returned identical payload-bearing HTTPS redirect and
  fallback URLs whose suffix exactly matched `nbu_payload_base64`; no Android intent was returned.

#### Approved Temporary Scope — Platform-Specific Monobank Launch

- For iOS and desktop, use the payload-bearing Monobank universal link
  `https://mbnk.app/qr/<payload>` as `redirect_url`.
- For Android, use a package-bound HTTPS intent targeting `com.ftband.mono`, with the same encoded
  Monobank universal link as its browser fallback; keep `fallback_url` equal to that universal link.
- Preserve the exact NBU payload in every generated URL and retain strict Pay validation for the
  approved HTTPS and Android intent shapes.
- Do not change amounts, statuses, persistence, invoice-scenario resolution, or routing for any
  other bank. Validate focused Pay and Worker contracts before the full test and build gates, and
  deploy only to `letsrealtalk.com` after those checks pass.

#### Approved Temporary Scope — Monobank Link Fallback

- Preserve an HTTPS payment universal link carrying the NBU payload as `redirect_url` and launch it
  first. Do not replace it with a generic bank homepage.
- Use only the payload-bound `mono://bank.gov.ua/qr/<payload>` custom scheme as the mobile Plan B
  `fallback_url` when the universal link does not open the installed app.
- Extend Pay URL validation only for that exact Monobank scheme, host, path, and payload shape; do not
  permit arbitrary `mono:` URLs or weaken validation for any other scheme.
- Add focused Worker, Pay API, and launch-order regression coverage. No payment-status, amount,
  persistence, invoice-scenario, or other bank-routing behavior is unlocked.

#### Monobank Scope Closure Evidence

- The platform-specific scope supersedes the earlier custom-scheme launch contract below: iOS and
  desktop now use `https://mbnk.app/qr/<payload>`, while Android uses an HTTPS intent explicitly
  bound to `com.ftband.mono` with the same encoded universal link as its browser fallback. The
  historical custom-scheme evidence remains recorded for audit continuity.
- `mbnk.app` serves an Apple App Site Association entry for `LK7J8D2SS7.com.ftband.mono` and an
  Android `assetlinks.json` entry for `com.ftband.mono`; Pay rejects the ambiguous `mono://` route,
  mismatched Monobank intent payloads, foreign fallback domains, and unapproved packages.
- The complete Pay suite passes 232/232, the Worker index suite passes 13/13, and root `npm run
  check` reports 0 Svelte errors and 0 warnings. Root and Pay builds plus both relevant Wrangler
  dry-runs completed successfully.
- The correction was deployed only to `letsrealtalk.com`: route-less backend
  `letsrealtalk-web-preview` version `b2f62529-35dd-453f-a855-6e8adb58b4da` and checkout Worker
  version `2512334f-cff9-4aa7-9803-f196f551f353`, bound to `letsrealtalk-web-preview`. No
  `rakhunok.com` route or shared `rahunok` Worker was deployed.
- Remote smoke returned HTTP 200 for `/`, `/dashboard`, `/app`, `/conf/`, `/pay`, `/pay/`, and
  `/corex`. Live iOS and Android Monobank initiation responses retained the exact generated NBU
  payload in every redirect and fallback URL. Native app handoff remains a physical-device check.

- The Worker and Pay client mirror bind the same NBU payload to the exact mobile primary redirect
  `mono://bank.gov.ua/qr/<payload>` and payload-bearing HTTPS deeplink/fallback
  `https://mbnk.app/qr/<payload>`; Pay rejects other `mono:` hosts, paths, payloads, queries,
  fragments, and credentials. Desktop opens the HTTPS URL instead of attempting the custom scheme.
- The complete Pay suite passes 228/228, the complete Worker index suite passes 13/13, and root
  `svelte-check` reports 0 errors and 0 warnings. Focused generator, API validation, launch-order,
  and Worker contract checks are included in those suites.
- The corrected test slice was deployed only to `letsrealtalk.com`: route-less backend
  `letsrealtalk-web-preview` version `d841563c-1a5a-44c4-ad27-a4c995e29946` and checkout Worker
  version `db6617c7-af15-4a69-a092-f77c3018f90f`. The shared `rahunok` Worker and all
  `rakhunok.com` routes were not deployed or changed.
- Post-deployment smoke returned HTTP 200 for `/`, `/dashboard`, `/app`, `/conf/`, `/pay`, `/pay/`,
  `/corex`, the selected checkout order API, and the banks API. A live Monobank initiation returned
  `mono://bank.gov.ua/qr/<payload>` as `redirect_url` and `https://mbnk.app/qr/<payload>` as
  `fallback_url`; Chromium loaded the new `checkout.svelte-BPjyAPVr.js` bundle.
- Local Chromium rendering with a read-only synthetic checkout response verified the checkout
  merchant avatar at 34 x 34 px with circular clipping and its SVG image at 18 x 18 px at both
  600 px and 390 px viewport widths.
- No payment records, invoice state, or persistence were changed. With explicit user approval, the
  Pay test slice was deployed only to `letsrealtalk.com`: route-less backend
  `letsrealtalk-web-preview` version `5ac059ed-6b6b-430e-b0f4-e3cdaecc8d66` and checkout Worker
  version `d0d4c0b9-6716-46b6-8da6-1ed2b4f54353`. The test checkout now uses that isolated backend;
  the shared `rahunok` Worker and all `rakhunok.com` routes were not deployed or changed.
- Post-deployment smoke returned HTTP 200 for `/`, `/dashboard`, `/app`, `/conf/`, `/pay`, `/pay/`,
  and `/corex`, plus the checkout banks, logos, and selected-order APIs. Chromium loaded the new Pay
  asset hashes from `letsrealtalk.com` and confirmed the 34 x 34 px clipped merchant avatar with an
  18 x 18 px SVG image.

#### Locked Invariants

1. Dashboard routes `/dashboard/invoices/new?type=fixed`, `?type=open_amount`, `?type=table`, and
   `?type=delivery` must continue to select their corresponding forms. Direct creation from these
   routes remains independent of optional checkout-template selection and readiness gates.
2. Dashboard POS and Merchant POS must preserve their existing invoice creation behavior. A TABLE
   order retains immutable `terminal_id` ownership and expiry semantics; fixed and `open_amount` do
   not inherit a stale selected terminal or entity.
3. Persisted scenario identities remain `fixed`, `open_amount`, `table`, and `delivery`. Existing
   orders and public `/o`, `/t`, `/tag`, `/pos`, and `/pay` links must remain backward compatible.
4. Fixed and TABLE amounts remain server-authoritative and positive where currently required.
   `open_amount` retains zero-total creation and customer amount-entry semantics. Delivery total
   retains the existing separation between item amount and delivery fee.
5. Pay scenario resolution, renderer selection, amount authority, pending/expiry behavior, payment
   entry, and status transitions for these scenarios must not change without approval.
6. Existing Dashboard, Pay, Merchant app, shared-contract, and Worker validation must not be weakened,
   bypassed, or silently remapped by a fallback.
7. `delivery` route and form behavior are locked as currently validated, but this lock does not certify
   production persistence. The known Worker rejection of persisted `delivery` remains an explicit
   blocker and requires a separately approved cross-app change before repair.

#### Reopen Conditions

Before editing a locked invariant, record a temporary `UNLOCKED` scope that names the scenarios,
intended behavior, affected applications and files, backward-compatibility plan, data/API impact, and
focused unit plus browser validation. Restore `LOCKED` after the approved work is validated.

#### Baseline Evidence

- Focused Dashboard capability, template mapping, gateway, and POS suites pass 53/53.
- Existing Chromium acceptance for invoice scenario navigation and the read-only POS board passes 2/2.
- Live localhost smoke selected the expected `fixed`, `open_amount`, `table`, and `delivery` forms;
  delivery displayed its branch input. No production records were created.
- The readiness guard applies only to an explicitly selected checkout template; direct scenario
  selection clears that template and remains unblocked.

## Analysis Order

### DASH-TELEGRAM-INVOICE-001 — local self-test delivery (2026-09-13)

- **Status:** `ANALYZING` — local implementation tested; remote activation not approved/performed.
- User approved adding an invoice action beside Telegram message templates and sending to self
  while testing; buyer delivery remains separate future scope.
- Isolated existing-invoice selection, PNG/caption delivery, operator-configured single user/chat,
  verified bearer and canonical owner checks. No invoice creation/payment mutation added.
- Existing SDK token getter/read gateway reused; locked Auth, POS, checkout and classic invoice
  creation invariants unchanged. Per-account component key isolates in-memory delivery state.
- Demo stays local. Legacy non-demo notification/verification contracts remain separate.
- 356 backend tests, 103 client/gateway tests; Svelte zero errors/warnings; full-page desktop/mobile
  demo and synthetic retry/reopen checks passed without live sends. No authenticated live smoke.
- Limitations and operator activation: [Telegram self-test](TELEGRAM_INVOICE_SELF_TEST.md).
- Redesign validation: 438 Worker and 217 focused frontend tests passed; full/half-size QR
  decoding verified. Canonical read-only authenticated local preview returned 200. Branded
  card includes legal recipient, number, dates and verified short URL; 72-hour display cap
  does not mutate invoice expiry. Approved local launcher active; no redesign send/deployment.
- User-approved local proxy remediation: only definite `ECONNREFUSED` (all aggregate causes)
  reports `local_api_unavailable`; other transport failures remain uncertain. Exact legacy 503
  compatibility only; duplicate warning hidden without weakening retry confirmation or safety gates.
- Remediation evidence: 101 client/proxy + 31 gateway tests, 1 synthetic Chromium regression,
  scoped ESLint clean, Svelte check 0 errors/0 warnings and official Svelte MCP clean.
  Local GET confirmed 503 structured response with `Cache-Control: no-store`; no live sends.
- Final local verification (2026-09-14): full `TelegramInvoiceComposer.svelte`,
  `PublicPageSettings.svelte`, and `DashboardPage.svelte` submitted to official Svelte 5 MCP
  autofixer; no issues. Dashboard's five pre-existing invoice-effect suggestions remain
  intentionally unchanged. Full Dashboard rerun after the Telegram-only correction: no issues.
- Corrected Telegram preview/send scope capture before lazy import; session/gateway changes or
  teardown during import/token acquisition now fail before dispatch. Stale previews are rejected;
  already-dispatched send outcomes remain recordable. Shared locked auth lifecycle was not changed.
- Evidence: 217 focused client/proxy/scope/gateway tests (including 14 request-race regressions),
  scoped ESLint clean, direct Svelte check 0 errors/0 warnings, one synthetic Chromium regression
  with API/external requests blocked. Browser fixture now supplies the required canonical preview.
  Reviewed exact-cent/date/label/allowlisted-URL decoder and composer generation fencing; no
  additional actionable client decoder issue found. No live sends or deployment in this review.
- Status remains `ANALYZING`: known shared auth subscription initialization issue remains outside
  this scope; these local checks do not certify authenticated account-switching or live delivery.

### DASH-CHECKOUT-TEMPLATES-001 — checkout template management (2026-09-16)

- **Status:** `ANALYZING — REMOTE TEMPLATE STORAGE MIGRATED` — the user separately approved the
  checkout-template migration after the production repository reported its RPC boundary was absent.
  Application deployment remains unapproved.
- Current extension scope: preserve the template scenario identity in versioned `scenario_config`,
  make `apps/pay` resolve its renderer from that identity independently of the persisted invoice type,
  and prove a forward-compatible path for richer vertical flows such as fuel station dispenser,
  fuel-grade, and volume selection. Existing payment execution, invoice lifecycle, authentication,
  remote schema execution, and deployment remain outside this approval.
- Approved scope: isolate demo storage, repair template CRUD/default consistency and validation,
  tighten checkout-template RLS for active memberships, add focused tests, and make the minimum
  `DASH-SHELL-001`/invoice-template integration corrections needed for a clean validated contract.
  Authentication lifecycle, unrelated invoice behavior, checkout runtime, remote schema changes,
  and deployment remain locked or out of scope.
- Implemented merchant-scoped browser storage for demo mode before Supabase client acquisition,
  repository/persisted-row validation, editor/list mutation fencing and error states, and canonical
  scenario configuration shared by the editor, preview, repository, and invoice integration.
- Production create, update, delete, and default reassignment now target one merchant-scoped RPC per
  operation. The local migration uses advisory transaction locks, active-member RLS, explicit update
  `WITH CHECK`, `SECURITY INVOKER`, restricted execute grants, and constraints for supported scenario,
  bounded nonblank name, and complete boolean configuration.
- Migration compatibility: legacy object configuration is merged over all 11 required defaults;
  non-object JSON is normalized; the invalid empty-object column default is dropped before the new
  constraints. The migration contract checks ordering, policy/RPC shape, backfill, and default removal.
- Invoice integration preserves the separate persisted invoice-type domain: `tips` templates map to
  `open_amount`; the other four supported scenarios map directly. Version `1` JSON now keeps renderer
  identity in `checkout_flow.id`, financial behavior in `checkout_flow.invoice_type`, and optional
  renderer-owned vertical input in `flow_data`. Custom flow slugs require all flow metadata, while
  built-in scenarios remain compatible without it. Demo invoice creation loads the same merchant-local
  template repository and does not acquire a Supabase client.
- At the initial registry stage, `apps/pay` resolved only registered renderer IDs and aliases, so the
  then-unregistered `fuel_station` and unsupported metadata fell back to persisted invoice behavior.
  The later validated `fuel_station` registration and unchanged visual-design boundary are recorded below.
- Evidence: direct Svelte check 0 errors/0 warnings; official Svelte autofixer found no issues in the
  changed invoice-template path; scoped ESLint and diff whitespace checks clean; 11 focused repository
  and invoice integration tests pass; 3 migration contract tests pass; pay scenario suite passes 223
  tests. The pay preview and amount scenario compile with 0 errors/0 warnings, both changed Svelte files
  pass the official autofixer, and the current pay suite passes 223/223. Earlier full Vitest remains 54
  files/715 tests, and the isolated Dashboard adapter-static build completed to `build-dashboard`.
- Focused Chromium demo acceptance in `dashboard.svelte.e2e.ts` passes through normal user actions and
  covers empty state, create, edit, single-default reassignment, delete, reload persistence, 390 px
  overflow, and zero remote Supabase REST/RPC requests. Invoice creation applies a `tips` template as
  `open_amount` with its CTA/configuration. The adjacent cross-app `/apps/pay/src/fonts.css` import was
  removed and no longer requests a proxied `/apps/pay` resource.
- The template editor now uses one responsive workspace shell: settings and a sticky live preview are
  visible side by side on desktop, while mobile uses explicit settings/preview modes and persistent
  footer actions. It reports dirty state, protects close/navigation, and confirms scenario changes only
  when scenario-owned configuration would be discarded. Scenario presets are structured controls for
  `quick_amounts` and `tip_presets`; no executable or arbitrary JSON editor was introduced. The shared
  dark theme default is now explicit so defaults, form state, preview, and pay resolve identically.
- Post-editor evidence: official Svelte autofixer reports no issues for both changed components;
  `svelte-check` reports 0 errors/0 warnings; focused Dashboard repository, invoice, and preview suites
  pass 19/19; the pay suite passes 223/223 including versioned renderer identity and unknown
  `fuel_station` fallback before its renderer was registered. Focused 390 px Chromium acceptance passes create/edit/default/delete/reload,
  mobile mode switching, dirty-state visibility, quick-amount preview, and persisted preset restoration,
  with zero remote Supabase requests. Scoped Prettier and `git diff --check` are clean apart from Windows
  line-ending notices.
- Dashboard `LIVE PREVIEW` now follows the real pay transition: the checkout remains visible beneath a
  modal bank-selection sheet, and its CTA opens selectable banks before confirmation. The conditional
  secondary view mirrors `BankSheet.svelte` with alternative wallet/card methods, promo application
  when `allow_promo` is enabled, and loyalty-card interaction when `allow_loyalty` is enabled. Its close
  and back controls return from alternative methods to the bank view before dismissing the sheet.
- Payment-sheet evidence: the official Svelte autofixer reports no issue in the changed preview block,
  direct `svelte-check` reports 0 errors/0 warnings, and focused 390 px Chromium acceptance passes. The
  browser test covers checkout visibility behind the sheet, bank selection, fixed-template promo entry
  and configured 4 ₴ discount, alternative methods, methods-to-bank navigation, sheet dismissal, and
  promo absence under `tips` defaults. No `apps/pay` visual or runtime code was changed for this preview.
- The first specialized renderer, `fuel_station`, now proves the versioned extension boundary. Reusable
  templates persist policy only; operational checkout data carries a revisioned station snapshot,
  dispenser/nozzle/product topology, limits, current selection, expiring authoritative quote, and
  optional fulfillment result. Runtime activation fails closed to `open_amount` unless the complete
  snapshot validates. A connected selection must match the active physical nozzle product.
- Fuel-station quotes are bound to the exact snapshot ID/revision, dispenser, product, input mode and
  input value. The CTA opens the existing `BankSheet.svelte` only while that identity, price arithmetic,
  currency and TTL remain valid; changing liters or amount invalidates the quote. The client estimate is
  never accepted as an authoritative payment amount. The `/pay` bank-sheet visual design was unchanged;
  the shared animated amount received only a declarative accessible value.
- AZS evidence: shared validator tests pass 5/5, including foreign snapshot/selection quote rejection
  and connected-nozzle/product mismatch; template repository tests preserve policy-only storage; pay
  Svelte/TypeScript check reports 0 errors/0 warnings; the complete pay suite passes 224/224. Focused 390 px
  Chromium acceptance runs the real pay app through dispenser, fuel and liters steps, proves stale quote
  blocking after a value change, restores the exact quote, and opens the existing bank sheet with
  1190,00 UAH plus its alternative-methods/promo entry. The fixture is DEV localhost-only.
- Dashboard now exposes `АЗС — пальне на колонці` in the template type selector. Its `LIVE PREVIEW`
  supplies isolated demonstration station data and supports selecting one of four columns, fuel,
  liters or amount, then opens the existing payment sheet with the preview total. These volatile
  columns and prices are not persisted in the reusable template. Focused browser acceptance selects
  connected column 2, A-95 and 20 liters and passes 1/1; preview/repository contracts pass 13/13,
  direct Svelte check reports 0 errors/0 warnings, and the new component passes the official Svelte
  autofixer. A separate full-suite dark-theme route assertion still fails because its Team heading is
  absent; the other 17 browser tests, including checkout-template management, pass.
- Supabase MCP read-only preflight against project `mwaeazabpvbxqfrceogr` found zero
  `checkout_templates` rows and therefore zero current row-compatibility blockers. The remote table has
  only its primary/merchant foreign-key constraints; the current update policy has no `WITH CHECK`, and
  none of the four merchant-scoped template RPCs exists remotely. The unique partial merchant-default
  index already exists. Recent Postgres/PostgREST logs contained no relevant checkout-template, RLS, or
  permission errors. Migration history does not include local migration
  `20260916170000_checkout_templates_integrity.sql`.
- After explicit approval, Supabase MCP applied only `checkout_templates_integrity`; remote migration
  history records it as `20260916182932_checkout_templates_integrity`. Postflight found the table still
  empty, `scenario_config` without a column default, all 3 expected integrity constraints, all 4
  authenticated RLS policies, and an explicit `WITH CHECK` on update. All 4 merchant-scoped RPCs are
  `SECURITY INVOKER` with an empty `search_path`; `authenticated` has execute permission while `PUBLIC`
  and `anon` do not. Post-DDL security and performance advisors reported no checkout-template finding.
- Residual blockers: root `npm run check` stops at five pre-existing documented-but-unimplemented
  OpenAPI operations; the standard shared root build is locked by active local processes. The SQL is
  contract-tested, including strict `IS TRUE` handling for nullable JSON predicates. An authenticated
  browser mutation has not yet been repeated after the migration.
- No Worker/application deployment or test-data mutation was performed. Existing auth and checkout
  runtime contracts remain unchanged outside the approved template-storage migration.
- Dashboard scenario readiness is now explicit for all 26 selectable template types. The shared
  capability registry drives editor groups, template-list status badges, and production invoice-link
  eligibility. `fixed`, `open_amount`, `table`, and `tips` remain available; `delivery` and
  `fuel_station` remain in testing; all `engine_*` and `vertical_*` flows remain preview-only. Demo mode
  may exercise every configured scenario, while production invoice creation fails closed when an
  unfinished template is selected. Direct non-template invoice creation is unchanged.
- Readiness-gate evidence: registry coverage and demo/production eligibility tests pass 3/3; the
  existing template-to-invoice regression suite passes 7/7. Svelte language diagnostics and the
  official Svelte autofixer report no issue in the changed list, editor, or invoice components. No Pay,
  Worker, schema, payment execution, or deployment change was made. The known Worker rejection of the
  persisted `delivery` type remains the reason that scenario is not marked available.

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

### DASH-SHELL-001 - Dynamic Module Load Recovery (2026-09-16)

- **Status:** `ANALYZING - LOCAL RECOVERY VALIDATED`.
- Browser reproduction traced the failed `PublicPageSettings.svelte` import to its transitive
  `qrcode` dependency returning `504 Outdated Optimize Dep`. Vitest and the live dev server shared
  `node_modules/.vite`, allowing focused test runs to replace dependency metadata while the server
  retained an older browser hash. Vitest now uses an isolated `.vite-vitest` cache.
- A failed dependency request could also reject a lazy module import once and leave that Promise
  cached for the lifetime of the Dashboard root. Later navigation to the same view reused the
  rejection instead of requesting the module again.
- The shared lazy loader now clears only failed module Promises. Successful and in-flight imports
  remain cached and deduplicated; route ownership, auth/session lifecycle, APIs and view contracts are
  unchanged.
- Direct Vite fetch of `PublicPageSettings.svelte` returned transformed JavaScript with HTTP 200;
  editor diagnostics and official Svelte autofixer reported no issues. Focused recovery coverage
  passes 2/2 and the neighboring Telegram scope suite passes 14/14. No deployment was performed.

## Locked Processes

### DASH-AUTH-001 - Authentication And Session Lifecycle

- **Status:** `LOCKED` — local context candidate validated; runtime invariants unchanged.
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

#### Approved Local Context Scope — 2026-09-13

- User explicitly approved owner-or-active-membership context provided simple Google registration
  and existing functionality are preserved. Only invariant 2 is reopened; no remote SQL or deploy.
- Inspection found that current `ready` renders owner controls and resources still use owner-only
  `user_id` boundaries. Therefore membership must NOT enter the existing ready shell yet.
- Implement and test an isolated server context candidate, with no runtime imports or activation.
  Preserve owner-first login and the existing no-owner onboarding path without new dependencies.
- Validate active/suspended/deleted membership, actor versus owner identity, role/terminal scope,
  multiple contexts and nonrecursive authenticated SQL access using synthetic local fixtures.
- Activation requires coordinated role-aware UI, Worker/RPC/RLS enforcement and context selection;
  a context lookup alone is not authorization for financial or administrative commands.
- Local evidence: `supabase/candidates/dashboard-access-context.sql` (unapplied) and
  `worker/src/dashboard-access-context.test.mjs`: 55 SQL cases plus parent, 56 Node tests passed;
  existing gateway suite 31/31 passed, including Google credential exchange and onboarding.
- No runtime imports, UI edits, auth lifecycle changes, remote reads/writes or deployments.
  Candidate requires a trusted BYPASSRLS definer and verified JWT-to-`auth.uid()` boundary.
- Activation blockers: current `ON DELETE SET NULL` loses manager/viewer assignment history;
  owner-ID terminal mapping assumes existing one-merchant-per-owner boundary; candidate metadata
  outages fail the whole lookup. Do not replace independent owner restore with this candidate
  until these contracts and role-aware commands are validated. PGlite is not concurrency proof.
- This completes the isolated candidate checkpoint, not member-ready access or secure onboarding
  implementation. The user's local implementation approval is recorded; broader locked changes
  and any remote rollout still require their own explicit scopes.

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
  - `apps/merchant-app/src/App.svelte`
  - `apps/merchant-app/src/data/merchant-data-gateway.ts`
  - `apps/checkout/js/order-expiry.js`
  - `worker/src/index.ts`
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
- Merchant POS captures the selected terminal at dispatch and sends its immutable `terminal_id`
  and `entity_id` with the authenticated merchant claim. The Worker verifies the exact merchant
  and active terminal/entity/owner tuple through the caller's RLS-scoped Supabase session before
  inserting the order.
- Merchant POS scopes that identity to TABLE creation. Fixed and `open_amount` invoices omit
  `terminal_id` and `entity_id`, even when a table remains selected from an earlier scenario.
- Fixed and TABLE orders require a finite positive total. `open_amount` intentionally retains its
  zero-total creation semantics, and malformed persisted totals are rejected by the Merchant
  gateway instead of being displayed as zero.
- The Merchant payment sheet exposes every supported invoice entry point as a QR carousel:
  TABLE uses `/tag`, `/pos`, and `/pay`; fixed uses `/o` and `/pay`; `open_amount` uses `/t` and
  `/pay`. Preview and created-order surfaces remain anchored to the viewport bottom.
- Active Merchant fixed and TABLE invoices expose a separate `Надіслати в Telegram` action while
  generic `Поділитися` keeps the existing Web Share behavior. The Merchant action calls its own
  authenticated Worker endpoint; it does not reuse or weaken Dashboard's operator-only self-test.
- The Worker derives the destination from exactly one trusted `custom:telegram` Auth identity,
  rejects browser-provided `chat_id`, and verifies the order, active owner/entity, positive UAH
  total, pending status, and expiry through the caller's RLS-scoped Supabase session.
- Telegram receives the existing invoice PNG, escaped caption, and inline canonical `/pay/{id}`
  button. The Worker never retries a bot call; an ambiguous transport result is surfaced as
  `delivery_unknown`, and the UI tells the user to inspect the chat before a manual retry.

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
- Merchant gateway suite: 41 tests passed, including the exact Telegram `{ order_id }` payload,
  refreshed bearer token, immutable identity payloads, invalid created totals, and session fences.
- Worker write suite: 122 tests passed, including exact merchant and active terminal authorization,
  amount validation, sanitized lookup failures, and `open_amount` zero semantics.
- Merchant app check: Svelte reported 0 errors and 0 warnings; TypeScript node check passed.
- Merchant payment-sheet focused suite: 12 tests passed, covering the three-entry TABLE carousel,
  fixed/open route isolation, paid/cancelled states, separate generic share, and Telegram
  sending/sent/unknown states. Telegram host helper suite passes 2/2 after chooser removal.
- Combined Merchant Telegram and unchanged Dashboard self-test Worker suites pass 275/275,
  including identity trust boundaries, RLS ownership failures, invalid/expired totals, rich card
  payload, rate limit/rejection handling, and no retry after an ambiguous delivery.
- OpenAPI coverage includes the Merchant Telegram endpoint as documented, implemented, and consumed
  with no missing consumed or undocumented implemented operations. The five Team/Invitation routes
  already existed in the Worker; their explicit audit inventory is now synchronized, and invitation
  acceptance is documented with its implemented `PATCH` method. Root `npm run check` passes with
  30 documented/implemented operations and Svelte reports 0 errors and 0 warnings.
- Isolated browser verification at 1008x836 and 390x844 confirmed a 10px bottom gap, no horizontal
  or card overflow, nonblank QR canvas pixels, reachable actions, and live `/tag` to `/pos`
  carousel switching after viewport resize.
- Merchant app full Vitest run: 204 tests passed, but the command remains non-zero because the
  pre-existing empty `src/lib/liquid-payment.test.ts` contains no test suite.
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

#### Authenticated Invoice Creation RLS Repair

- **Status:** `ANALYZING — LOCAL FIX VALIDATED`; investigated and repaired locally on 2026-09-16.
- Production logs identified `POST /rest/v1/orders` returning 403 / PostgreSQL `42501`, with two
  `new row violates row-level security policy for table "orders"` entries. The second failure was
  the compatibility retry without `scenario_config`, excluding the saved template JSON as cause.
- The authenticated user directly owns the active merchant, has the required table and column
  privileges, and passes the current owner-only `orders` policy. A rollback-only insert under the
  same authenticated JWT subject, merchant and scenario config succeeded, so no RLS weakening or
  database migration was required.
- Root cause: invoice creation discarded the ready session's merchant ID. The Worker fallback then
  queried `/merchants?select=id&limit=1`; the public active-profile SELECT policy can expose merchants
  other than the caller's, so an arbitrary merchant could be selected and the subsequent insert was
  correctly rejected by owner RLS.
- `InvoiceCreateInput` now requires the merchant ID already established by `gateway.restore()`.
  `InvoiceCreate` passes it to the gateway, the Worker request includes it, and the direct Supabase
  fallback verifies that exact ID against both `merchants.id` and authenticated `user_id` before
  inserting. Existing auth lifecycle, owner-only RLS and template `scenario_config` are unchanged.
- Regression coverage verifies the explicit Worker payload and direct fallback insert retain the
  same merchant ID and scenario config. Dashboard gateway tests pass 32/32; Worker write-route tests
  pass 114/114; official Svelte autofixer and editor diagnostics report no issues.
- Proforma conversion now passes its existing merchant-scoped argument into the same required
  `InvoiceCreateInput.merchantId` field. This closes the compile-time caller gap without changing
  proforma persistence, invoice fields, authentication, or RLS; Svelte check passes with 0 errors
  and 0 warnings.
- No Dashboard or Worker deployment was performed. Production remains on the previous client bundle
  until a separately approved deployment and authenticated smoke test.

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
