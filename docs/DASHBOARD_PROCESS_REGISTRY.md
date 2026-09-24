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

### BANK-CATALOG-READ-001 — public BankLink catalog (2026-09-22)

- **Status:** `LOCKED` — the user approved and the implementation completed read-only catalog
  resolution only. Payment initiation, invoice scenarios, Conf management, database writes,
  migrations, and deployment were not unlocked.
- Worker bank list and detail GET routes read `public.banklink` through a single PostgREST `GET`
  using the configured publishable/anon key. The request has no body and cannot mutate source rows.
- The existing hardcoded `DEFAULT_BANKS` remains unchanged and is returned when Supabase
  configuration is absent, the request throws, the response is non-2xx, JSON is invalid, or the
  result is empty or contains an invalid `id`, `code`, or `name`.
- Detail lookup remains case-insensitive by bank `id` or `code`. A focused regression confirms an
  API-only bank resolves from Supabase; failure regressions confirm `500`, empty, and malformed
  responses preserve the fallback catalog.
- Pay keeps its active bundled catalog when a successful Worker response is incomplete, overlays
  matching active API records by case-insensitive `code`, and appends API-only records. This changes
  catalog composition only; payment initiation, invoice data, scenarios, statuses, and redirects
  remain unchanged.
- Evidence: all 18 tests in `worker/src/index.test.mjs` pass and editor diagnostics are clean for
  the changed Worker source and test. Pay validation passes all 236 tests and `svelte-check` with
  zero errors; the local target invoice renders 46 bank rows, including bundled-only `ALLI` and
  API-only `UNJS`. No remote query, migration, or deployment was performed.

### CROSS-APP-INVOICE-SCENARIOS-001 — established invoice scenarios (2026-09-21)

- **Status:** `UNLOCKED` — on 2026-09-22 the user explicitly approved a compatibility-preserving
  security hardening for `fixed`, `open_amount`, `table`, and `delivery`. The temporary scope is
  limited to server-owned invoice references, NBU field 11, concrete `open_amount` payment invoices,
  and authenticated settlement reconciliation. Remote schema changes and deployment remain
  separately gated and are not approved by this unlock.
- **Owner:** Dashboard invoice creation and POS, Pay checkout, Merchant app invoice/POS entry,
  shared scenario contracts, and Worker order APIs.
- **Scenarios:** `fixed`, `open_amount`, `table`, and `delivery`.
- **Approval boundary:** Any direct or indirect behavior change requires separate, explicit user
  approval naming the affected scenario or scenarios. Approval for another process, new scenarios,
  template work, visual cleanup, refactoring, dependency changes, or deployment does not unlock this
  process.
- **Applicable instruction:** `.github/instructions/invoice-scenario-locks.instructions.md`.

#### Loading-Only Scope Checkpoint - 2026-09-24

- The user separately approved `fixed`, `open_amount`, `table` and `delivery` for Merchant App
  lazy payment/voice/QR modules and Pay lazy UI/QR plus a lightweight initial HTML screen.
  Compatibility boundaries: retain API payloads, amounts, status rules, public links,
  authentication and renderer identity. No deployment or database changes were authorized.
- Touched loading surfaces: Merchant `App.svelte`, `AccountIdentityGuidance.svelte`, `PaymentQr.svelte`;
  Pay `App.svelte`, `ScenarioRenderer.svelte`, `DesktopCheckout.svelte`, `index.html`, `main.ts`.
  Per-icon login imports remove the barrel; QR rendering has stale-result guards; payment and
  voice modules defer to existing UI/auth boundaries; first-open BankSheet stays mounted on close.
- Evidence: Merchant check has zero diagnostics and 215 unit tests pass; Pay check has zero errors
  with nine existing CSS warnings and 238 unit tests pass. Identity guidance passes 24 browser tests.
  Both production builds pass. The focused lazy-loading browser suite passes 11/11, including all
  four mobile renderer identities, retained BankSheet instances, desktop amount-gated QR and
  merchant latest-value QR decoding. Details: `docs/LOCAL_LOADING_AUDIT_20260924.md`.
- Residual risks: browser scenarios use isolated synthetic data, not remote persistence or completed
  payments. Real OAuth, physical microphone behavior and production latency/chunk-failure recovery
  are unverified. The recorded delivery persistence blocker remains; no production-readiness claim.
- **Final loading-only scope status: `LOCKED` (closed).** Previously approved security and seller
  scopes and their existing process-level status are unchanged. This checkpoint grants no further
  changes to scenario semantics, authentication, shared Workers or deployment.

#### Merchant App Seller Selection Checkpoint — 2026-09-24

- The user approved a bounded correction for `fixed` and `open_amount` merchant-app invoice
  creation, preservation of `table` terminal ownership, guest single-invoice checkout reading,
  and deployment to the `letsrealtalk.com` test domain only. No database migration, unrelated
  Worker change, or `rakhunok.com` deployment was approved.
- The merchant app now selects an owner-scoped active seller for non-table invoices and sends its
  `entity_id`; `table` continues to use the selected terminal's seller. Focused merchant payload
  tests passed 43/43, `check:app` passed without diagnostics, `check:pay` passed with nine existing
  template CSS warnings, and checkout routing tests passed 11/11. The isolated merchant build,
  root build, and app production-environment Wrangler dry-run succeeded locally.
- Anonymous test-domain `GET /api/v1/checkout/not-a-real-invoice` returned 404 as expected, but
  anonymous `GET /api/v1/orders` returned 200 with 49 invoice rows and payment-related fields.
  The current API Worker list branch uses a publishable key when Authorization is absent. This
  violates the intended private-list boundary and requires a separately scoped API security fix.
  No test-domain deployment, remote migration, or authenticated creation smoke test was performed;
  remote RPC readiness and guest reading of an existing invoice remain unverified. The process
  remains `UNLOCKED` only within previously approved scopes; this checkpoint does not authorize
  changing the shared Worker or expanding any scenario behavior.
- Follow-up clarification: the existing public `/api/v1/checkout/{id}` already fetches one
  invoice by UUID, short ID, or order number with `limit=1`. A local Worker patch now requires a
  Bearer token before private `GET /api/v1/orders` and `GET /api/v1/orders/{id}` access. Focused
  tests confirm anonymous private reads return 401 without a database query, authenticated list
  requests forward the token, and public checkout still fetches one invoice; the full Worker route
  suite passes 21/21. The shared Worker has unrelated in-progress API-key changes, so neither the
  patch nor those changes have been deployed; the remote exposure remains until a separately
  isolated and validated API Worker deployment is approved and performed.

#### Approved Temporary Scope — Authoritative Payment Reference

- Preserve current routes, public links, renderer selection, amount-entry UX, bank launch behavior,
  and existing persisted invoice interpretation for `fixed`, `open_amount`, `table`, and `delivery`.
- Use the concrete payable invoice's server-generated `short_id` as NBU field 11. Ignore any
  client-supplied payment reference when a persisted invoice is resolved.
- Harden `orders.short_id` to be server-generated, immutable, `NOT NULL`, and `UNIQUE`, with
  constraint-driven collision retry. Existing non-null references must remain unchanged.
- Preserve reusable zero-value `open_amount` invoices; after customer amount entry, create a
  concrete child invoice with an immutable amount and recipient snapshot before payment initiation.
- Do not treat the existing unsigned generic callback as authoritative. Provider settlement may be
  activated only with authenticated provider input and atomic verification of reference, amount,
  `UAH`, recipient IBAN, invoice state, and unique provider transaction/event identity.
- Limit implementation to the minimum Worker, Pay, migration, focused contract tests, and this
  registry record. Restore `LOCKED` only after local compatibility validation. Do not apply a remote
  migration or deploy either domain without separate explicit approval.

#### Approved Temporary Scope — Recipient And Payment Purpose Snapshot

- On 2026-09-22, the user explicitly approved activating persisted per-seller invoice rules and
  payment-acceptance mode for `fixed`, `open_amount`, `table`, and `delivery`.
- For direct acceptance, snapshot the selected seller as the actual recipient and finalize NBU field
  12 from that seller's invoice rules. For finance-company acceptance, snapshot the finance company
  as the actual recipient: its name in field 6, IBAN in field 7, and EDRPOU/RNOKPP in field 9; finalize
  field 12 from the finance-company template with seller/provider references and a server payment ID.
- Resolve mode, recipient, invoice number, and purpose server-side in one authoritative invoice
  creation operation. Client input must not override the selected mode, recipient, payment ID, or
  final purpose. Persist immutable recipient and purpose snapshots on each new concrete invoice.
- Preserve existing invoices and their current `description`/`title` fallback interpretation. Fail
  closed for newly activated creation when required settings are unconfigured or incomplete.
- Keep finance-company onward settlement, `SELF_EMPLOYED`, and transfers to an individual's account
  outside this scope. Do not apply remote migrations or deploy either domain without separate
  explicit approval.
- Validate direct and finance-company modes, fields 6/7/9/12, atomic numbering, client-override
  rejection, old-invoice compatibility, and all four scenarios with focused database and Worker
  tests plus the root check.

#### Authoritative Payment Reference Checkpoint — 2026-09-22

- The legacy Worker now takes persisted NBU fields 6–11 from the resolved order and merchant,
  including the server `short_id` and server amount; request fields remain fallback-only when no
  persisted order is resolved. A focused Worker regression rejects client overrides.
- The forward short-ID migration preserves existing references, backfills missing values, enforces
  format, uniqueness, `NOT NULL`, server-only generation, immutability, and constraint-driven retry.
  The forward settlement migration additionally requires the stored order `short_id` to match the
  immutable attempt quote and existing amount, currency, IBAN, status, revision, time, and provider
  event checks.
- Reusable zero-total `open_amount` parents remain non-payable in the active Pay flow. Secure child
  creation is not activated: the stronger attempt/quote authority is deliberately local-only and is
  not dispatched by the legacy Worker, while the legacy route has no equivalent authenticated
  server-side child-creation boundary. Do not create children through anonymous Data API writes or
  accept a client amount directly on the parent.
- No remote migration or deployment has been performed. The process remains `UNLOCKED` only for the
  remaining approved child-invoice authority integration and focused compatibility validation.

#### Recipient And Purpose Snapshot Checkpoint — 2026-09-22

- New concrete `fixed`, `open_amount`, `table`, and `delivery` invoices are created through the
  authenticated `create_authoritative_invoice` RPC. The RPC verifies owner, seller, and terminal,
  atomically reserves the seller invoice number, and persists immutable mode, recipient, payment ID,
  settings revision, and final purpose snapshots. Client numbering, recipient, payment ID, and final
  purpose are not RPC inputs.
- Checkout uses a complete persisted snapshot for NBU fields 6, 7, 9, and 12, rejects partial
  snapshots, and preserves the previous merchant plus `description`/`title` fallback only when all
  snapshot fields are null. Field 11 remains the persisted server `short_id`.
- Finance-company field 12 now starts with the exact six-character field 11 value as
  `ID: <short_id>. `, followed by the seller's business purpose, legal name, EDRPOU/RNOKPP, own
  IBAN, and any non-empty contract, provider seller ID, and provider code values. The compact
  standard format omits labels for the last two provider values and omits empty optional segments.
  The finance company remains the actual bank recipient in fields 6, 7, and 9; the seller details
  in field 12 are reconciliation metadata. Direct-mode field 12 is unchanged.
- The internal UUID `payment_id` remains server-generated, persisted, and immutable but is omitted
  from the new standard visible purpose. Existing custom templates using `{payment_id}` retain their
  previous behavior. The exact former standard template is normalized server-side to the compact
  format so existing saved defaults do not keep emitting the old verbose purpose.
- Dashboard invoice and POS creation now carry seller identity through the authenticated Worker;
  the browser fallback calls the same authoritative RPC rather than inserting directly into
  `orders`. TABLE terminal ownership and expiry are preserved, while the RPC discards expiry for
  non-TABLE scenarios. Post-create local invoice-rule increments were removed because the server is
  the numbering authority; proforma draft-copy numbering remains unchanged.
- Focused contracts cover direct and finance-company recipients, all four scenarios, legacy rows,
  partial-snapshot rejection, immutability, unauthorized ownership, client override rejection,
  TABLE expiry, and the 420-character NBU purpose boundary. Finance-company content is limited to
  408 characters before the server adds the 12-character short-ID prefix; boundary coverage asserts
  that 408 persists as exactly 420 and 409 is rejected. A local PGlite overlapping-call
  regression asserts distinct consecutive number reservation; it is not multi-connection PostgreSQL
  contention proof. Editor diagnostics are clean for the changed Worker, gateway, contract,
  migration, and test files; the Svelte autofixer reports no issue in the two changed component
  control-flow slices.
- Executable validation remains blocked because the VS Code task host repeatedly starts tasks
  without creating a terminal. No focused test, root check, build, remote migration, or deployment
  is claimed as successful. The process therefore remains `UNLOCKED` pending executable validation.
- Ukrainian IBAN format remains enforced as `UA` plus 27 digits. Mod-97 enforcement is not added in
  this compatibility scope because existing Dashboard settings and fixtures permit format-only
  synthetic IBAN values; checksum rollout requires separate data cleanup and compatibility review.

#### Amount And Purpose Verification — 2026-09-22

- Read-only inspection classified order `4125d75a-4f5d-48a4-b326-04ebb729d761` as a legacy
  `fixed` invoice created before the snapshot migration: its persisted `base_amount` and
  `total_amount` are both `117.00`, while its title is `Рахунок APP-49520512` and description is
  null. The connected remote database does not yet contain the payment snapshot columns or the
  `20260922140000_invoice_payment_snapshots` migration, so this existing invoice cannot use the
  agreed seller or finance-company purpose formatter and correctly remains on legacy fallback.
- The local candidate now accepts and renders the same seller purpose tokens as Dashboard:
  `{number}`, `{date}`, `{scenario}`, `{amount}`, `{customer}`, `{contract}`, and `{tax}`. Rendering
  uses the concrete invoice total (`base_amount + delivery_fee`), the scenario label, seller contract,
  and Dashboard-compatible whitespace normalization. A focused PGlite regression verifies all
  supported tokens are consumed for a delivery invoice.
- No remote migration, data mutation, or deployment was performed. Existing legacy invoices were
  not reinterpreted or backfilled; new immutable purpose snapshots require separately approved
  application of the pending migration and compatible application deployment.

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

- CSS-only checkpoint (2026-09-24): the user explicitly approved removing seven unused Events
  preview selectors and correcting two Fitness icon styles. Removed the unused Events blocks;
  passed the existing color/spacing properties directly to the Lucide components via `style`.
  No warning suppression, invoice semantics, template data, authentication or deployment changes.
  Pay `check` now reports zero errors and zero warnings; the changed icon markup passes the Svelte
  autofixer without issues. This cleanup is complete; the broader process status below is unchanged.
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
- On 2026-09-22 the user approved correcting problems limited to `?demo=1`. The scope covers stale
  demo browser assertions, independent viewport test budgets, and fail-closed Developer API demo
  credentials when no gateway exists. It does not unlock production auth, persistence, invoice or
  payment behavior, schema changes, or deployment.
- Demo-only repair is locally validated: the focused demo slice passed 6/6, the checkout-template
  flow passed 1/1 in isolation, and the complete Dashboard browser suite passed 24/24. Developer API
  now accepts an absent gateway and fails closed before credential reads or mutations; its focused
  browser test passed 1/1 after the final guards. Root `npm run check` passed with 0 errors and 9
  pre-existing unused-CSS warnings in template previews. No production auth, persistence, invoice or
  payment behavior, schema, API, RLS, deployment, or `rakhunok.com` resource changed.
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
- **Local loading audit, 2026-09-24:** Stabilized localhost guest Dashboard LCP was 2.216 s
  with cold browser cache and 0.476 s warm. Initial dev starts also triggered dependency
  optimization/reloads, so loading-screen samples are not evidence of workspace readiness.
  The guest dependency graph included 17,053 KiB of decoded Hugeicons and 6,876 KiB of Lucide
  dev modules. Per-icon imports and deferred shell loading are proposals only; production
  sizes and authenticated navigation remain unmeasured. See [local audit](LOCAL_LOADING_AUDIT_20260924.md).
  No shell behavior or process status was changed.
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
- **Local loading audit, 2026-09-24:** Guest login rendered after hydration; fresh-browser Google
  Identity button requests returned 403, with an origin-not-allowed diagnostic in the integrated
  browser. No sign-in action, authenticated readiness test, auth mutation or invariant change was
  performed. Deferred authenticated UI is proposed only and must preserve revalidation and ownership
  checks. This process remains `LOCKED`; evidence and limitations are in the
  [local audit](LOCAL_LOADING_AUDIT_20260924.md).
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

#### Test-Domain Build Configuration Checkpoint — 2026-09-24

- The isolated `letsrealtalk.com/dashboard` build was published without public Supabase URL,
  publishable/anon key, or Google client ID; its `dashboard/_app/env.js` contained none of these
  names, so the existing configuration-required login screen was shown before authentication.
- Rebuilt the isolated Dashboard in a deployment worktree using only the existing public build
  variables, without changing Dashboard source or auth lifecycle. The isolated artifact guard,
  Dashboard Worker dry-run, root build, and `npm run check` passed (nine existing CSS warnings).
- Redeployed only `letsrealtalk-dashboard`. The served public env module matches the corrected
  artifact byte-for-byte; an unauthenticated browser visit shows the Google sign-in button, and
  `/`, `/dashboard`, `/app`, `/conf/`, `/pay`, `/pay/`, and `/corex` return HTTP 200.
- **Status:** `LOCKED`. Signed-in session restore and merchant access were not retested; future
  isolated deployments must supply the public build variables before publishing assets.

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

### Browser And Deployment Compatibility Audit - 2026-09-24

- **Status:** `ANALYZING`; partial browser verification, not full production certification.
  Processes: `DASH-AUTH-001`, `DASH-POS-001`, `DASH-INVOICE-001`,
  `DASH-DEVELOPER-001`, and `CROSS-APP-INVOICE-SCENARIOS-001`. Existing locks remain unchanged.
- **Boundary:** no runtime edits, deployment, remote migration, login submission, invoice creation,
  or payment initiation. Remote browser checks blocked methods other than GET/HEAD/OPTIONS;
  blocked analytics POST errors are audit artifacts, not application failures.
- **Local browser evidence:** Dashboard business UI suite passed 24/24; isolated account identity
  guidance browser suite passed 24/24; Pay fuel quote/payment-sheet UI test passed 1/1.
  Pay logged ECONNREFUSED for bank/logo API proxy requests because local port 8787 was unavailable;
  this pass does not establish live API integration. No full repository validation gate was run.
- **Deployed entry points:** `/dashboard`, `/dashboard/`, `/app`, `/app/`, `/pay`, and `/pay/`
  returned HTTP 200 on both letsrealtalk.com and rakhunok.com. Guest desktop checks found no
  page exceptions or horizontal overflow. Bare Pay correctly displayed the missing-invoice state.
  Production App renders a Google login iframe; its initially sparse body text is not a blank UI.
  Test App additionally exposes Telegram login and account identity guidance.
- **Pay smoke:** mobile demo 1/2/3/4 remained on their expected checkout URLs without horizontal
  overflow on both domains. TABLE reload preserved the displayed 386.00 UAH order and controls.
  Demo rendering is not evidence for persisted invoices, delivery persistence, or bank settlement.
- **Responsive findings:** repeated 28-page matrix (Dashboard overview/POS/invoices and four Pay
  demos, two domains, 390/1440 px) had no page exceptions, horizontal overflow, or lingering
  Dashboard loading state. However, test-domain desktop Pay rendered all four demos as expired
  with no usable QR; mobile rendered checkout actions. Production uses a different desktop view.
  TABLE was reproduced separately: `DesktopCheckout.svelte` applies `!isOrderFresh(order, now)`,
  while its demo fixture lacks creation/expiry timestamps; `expiry.ts` treats missing timestamps
  as not fresh. This explains a demo compatibility failure, not proven failure of real invoices.
  Production POS also retains the older draft label, unlike the test deployment.
- **Artifact comparison:** test App entry JS `index-BllVO330.js` and CSS `index-DOIfg4iw.css`
  match the existing local dist bytes. Production App uses different assets. Dashboard entry
  assets differ between both domains and the existing root build; Pay entry assets likewise
  differ between test, production, and local dist. Some shared chunks match exactly. These are
  comparisons with existing artifacts, not fresh builds or proof of deployed commit identity.
- **Coverage gaps:** `scripts/liquid-payment.browser.test.mjs`,
  `scripts/liquid-payment.harness.mjs`, and `worker/src/terminal-functional-browser.test.mjs`
  are zero-byte files. They were not restored or counted as passing coverage.
- **Still required:** authenticated Dashboard/App JWT refresh and navigation, live Realtime,
  a valid test invoice across the four scenarios, cash/payment write lifecycle, and actual mobile
  Safari/Telegram WebView behavior. No passwords or tokens should be provided to the assistant;
  authenticated verification requires a user-established browser session. Earlier navigation-style
  test instability and delivery persistence findings below remain unresolved.
- **Auth audit correction:** the initial blanket POST guard also blocked the user's Google
  Supabase `auth/v1/token?grant_type=id_token` exchange. Those login failures were introduced
  by the audit, not evidence of an application regression. The shared page now allows only
  token POST exchanges with id_token/refresh_token/pkce grants on the configured Supabase host;
  the business-write guard remains. Reload still showed login; automated Google button clicks
  timed out on visibility, so successful authentication remains unverified pending user interaction.
- **Authenticated read-only follow-up (2026-09-24):** the user completed Google sign-in in a
  standard browser; popup failure was not reproduced there. A newly shared authenticated tab
  displayed the Dashboard financial overview, invoices, POS workplaces, structure, settings,
  and Developer API after load, with no visible alerts or persistent restore screen. The App
  opened its online cashier without another login; history and profile loaded. No token or key
  values were read or recorded. One existing TABLE invoice detail loaded, but its checkout
  rendered "payment unavailable / invalid invoice"; expiry at the observation time was not
  established. App history displayed "preparing", while Dashboard displayed "waiting".
  Current Pay tests explicitly block preparing invoices, including positive amounts. The
  persisted status at observation time was not captured, so the exact cause remains unverified.
  This does not establish active checkout or payment compatibility. The earlier audit tab was not used
  for this follow-up; its request guard must not be assumed to cover the new tab. No business
  writes were initiated. Token-refresh timing, live Realtime delivery, valid checkout across
  four scenarios, and payment/write lifecycle remain unverified.
- **Fresh-build follow-up (2026-09-24):** a cold local Vite run timed out once at
  `page.goto` and then at the five-second overview heading assertion; the same isolated test
  passed after the route warmed, followed by 24/24 Dashboard business UI E2E passing. This
  supports a cold-start timing issue, not a proven Dashboard navigation regression. Fresh local
  and test App entry JS/CSS names match. Dashboard start/app entry bytes differ despite equal
  lengths; bundle identity is not established. Pay has 18/22 identical referenced chunk names;
  the four differing chunks are Amount, Delivery, Table, and Tips scenarios. The Pay entry JS
  differs because it imports the changed App chunk; its other entry imports and CSS match.
  Read-only Pay demo checks at 390/1440 px matched local and test behavior for all four
  scenarios without horizontal overflow: mobile showed checkout actions, desktop marked every
  demo invalid/expired. Local preview bank/logo API proxy requests returned 502; no live payment
  or persisted invoice was verified. Test Dashboard demo overview, POS, invoices, and Developer
  API routes loaded with expected headings. Asset differences and demo parity do not certify
  authenticated API, Realtime, invoice settlement, or scenario write compatibility.

### Merchant API Key Orders Authentication

- **Remote promotion attempt (2026-09-24):** the user explicitly retained merchant PATCH
  `paid` for cash or alternative payment, not bank-confirmed settlement, and authorized the two
  migrations and test-only deployment conditional on compatibility. SELECT checks confirmed the
  required columns, service-role table privileges, invoice function signature and existing grants.
  The user-installed `SUPABASE_SERVICE_ROLE_KEY` is present on `letsrealtalk-web`; its value has
  not been functionally verified. Fresh focused tests passed 29/29; full root build and matching
  test Worker dry-run passed. Earlier root unit run passed 759 tests and check had zero errors.
- **Deployment blocker:** applying `merchant_api_key_orders` failed with SQLSTATE `42501`,
  `permission denied to set parameter "request.jwt.claim.sub"`. Remote SELECT confirmed that
  neither `postgres` nor `service_role` can SET either JWT claims parameter. PGlite does not
  reproduce this hosted permission restriction. Follow-up SELECT confirmed full rollback:
  both new RPCs and the private schema are absent, neither migration is recorded, and the original
  revocation trigger function is unchanged. The second migration and Worker deployment were not
  attempted. No existing orders were modified. The database is shared with `rakhunok.com`.
- **Required approval boundary:** redesigning the shared authoritative invoice creation path to
  accept a verified merchant owner without impersonating JWT claims affects
  `CROSS-APP-INVOICE-SCENARIOS-001` across `fixed`, `open_amount`, `table`, and `delivery`.
  This requires separate approval before changing that locked path; do not grant broad JWT-setting
  privileges or remove auth checks as a deployment workaround. Existing browser JWT behavior,
  snapshots, numbering, and merchant isolation must remain covered by regression tests.
- **Local integration follow-up (2026-09-24):** after the entrypoint was restored, the Merchant
  API key handler was reconnected before the legacy JWT routes and public order cache. Successful
  key PATCH clears matching cached order aliases; JWT requests continue through the existing route.
  Focused Worker routing tests passed 16/16, local PGlite invoice/API tests passed 13/13, and the
  main Worker Wrangler dry-run bundled successfully. No remote migrations, secrets or deployment
  were applied; deployed key authentication and live JWT compatibility remain unverified.
- **Status:** locally implemented and tested, remote promotion blocked by hosted JWT-parameter
  permissions; `DASH-DEVELOPER-001` remains `ANALYZING` for deployment/readiness.
  `CROSS-APP-INVOICE-SCENARIOS-001` remains `LOCKED` for the required shared creation-path redesign.
- **Explicit approval:** user selected "Погоджую цей обсяг для всіх чотирьох сценаріїв" for
  `fixed`, `open_amount`, `table`, `delivery`. Temporary unlock covered only API key read/write
  authentication, local Worker/migration/tests/specification. No deployment or remote migration.
- **Earlier local implementation (superseded):** `worker/src/merchant-api-key.ts` intercepts Merchant keys before legacy
  routes/cache; SHA-256 only is sent to service-role-only invoker RPC `merchant_api_key_orders`.
  Key validity, scopes, merchant isolation and operation share one transaction. Key row locking
  serializes operations with revocation. Usage timestamps are server-updated; owner revocation
  remains supported. Authoritative invoice creation is reused; temporary auth claims are derived
  exclusively from the verified merchant and restored at function exit, never returned as JWTs.
- **Preserved:** existing JWT path, invoice numbering/payment snapshots, four scenario identities,
  amount/status semantics, terminal authority and public links. Successful key PATCH invalidates
  matching local cache aliases. No Dashboard authentication lifecycle or UI changes.
- **Earlier local evidence:** HTTP/SQL/JWT regression suite passed (172/172); focused JWT/key cache
  variants and standalone Worker-to-PGlite test also passed independently (3/3).
  Covers all four creates, reads/writes, foreign merchant/order denial, scope denial, expiry,
  revocation, client RPC permission denial, hash-only forwarding and restored auth context.
- **Deployment prerequisites:** apply `20260923225403_merchant_api_key_orders.sql` after existing
  migrations; configure server-only `SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_URL` on main Worker.
  No remote schema, secret, Worker or production route was changed. Real PostgREST authentication,
  full local Supabase stack/advisors and deployed behavior remain unverified.
- **Local operations follow-up:** the unapplied `20260923235713_merchant_api_operations.sql`
  adds `stats:read`, merchant-wide read/write rate limits and 24-hour create idempotency through
  `merchant_api_operations`, which delegates order work to `merchant_api_key_orders`.
- **Approved local redesign (2026-09-24):** the user selected a separate API creation path while
  leaving browser creation unchanged, then explicitly approved local changes for `fixed`,
  `open_amount`, `table`, and `delivery`. This temporarily unlocked only the Merchant API invoice
  creation path and its tests, not remote migration or deployment. The earlier JWT-claim approach
  above remains a failed, rolled-back attempt, not the current implementation: the unapplied
  `20260923225403_merchant_api_key_orders.sql` now defines service-role-only, security-invoker
  `create_merchant_api_invoice(owner, merchant, ...)`. Key verification derives both IDs before
  the call; the function checks ownership and seller/terminal authority without SET on JWT claims.
  `create_authoritative_invoice` and browser JWT creation are unchanged. Local PGlite tests cover
  four API scenarios in direct and finance-company recipient modes, numbering, purpose snapshots,
  key isolation and revocation, plus idempotency/stats (14/14 focused tests). This supersedes the
  old implementation claim about temporary JWT claims; no hosted permission or PostgREST execution
  was established. `PATCH paid` remains a merchant cash/alternative-payment action, not bank proof.
  Remote rollout of both migrations and either Worker requires separate explicit authorization;
  `delivery` retains its recorded persistence blocker. Temporary unlock closed:
  `CROSS-APP-INVOICE-SCENARIOS-001` is `LOCKED`, `DASH-DEVELOPER-001` remains `ANALYZING`.
- **Residual risks:** hosted PostgREST execution, live JWT compatibility and actual merchant
  payment writes remain unverified. Existing public/JWT cache access and status-transition
  gaps remain. `delivery` is not production-ready while the earlier persistence blocker remains.
  Earlier read-only audit findings below remain historical evidence, not an implementation claim.
  Updated integration contract: `docs/openapi2.yaml`; original `docs/openapi.yaml` unchanged.

### Main OpenAPI And Worker Contract Audit

- **Status:** `ANALYZING`; read-only runtime review. Existing process lock/unlock states and
  previously approved scopes are unchanged. This audit grants no implementation or deployment approval.
- **Scope:** `docs/openapi.yaml` (30 operations), main Worker router, checkout proxy and domain
  service bindings; related processes `DASH-AUTH-001`, `DASH-INVOICE-001`, `DASH-POS-001`,
  `DASH-DEVELOPER-001`, and `CROSS-APP-INVOICE-SCENARIOS-001`.
- `worker/src/index.ts` accepts unsigned KSO requests and bank webhooks without the documented
  HMAC, timestamp, replay/idempotency, or persistence behavior. KSO returns stub fields instead
  of the required checkout/payment identifiers; the bank webhook only echoes its input.
- The documented `/api/v1/merchant/telegram/invoices/send` POST returns 404 in the main router;
  the handler is mounted at `/api/v1/merchant/telegram-invoice`. Direct handler tests and the
  hardcoded coverage inventory do not prove the documented URL is reachable.
- Merchant credentials are forwarded to Supabase; no merchant API-key resolution was found in
  this router. Several protected reads return demo/static data or empty success on auth failure.
  Team deletion and invitation creation report success even when mocked persistence returns 403.
- Order creation requires `entity_id` (and `terminal_id` for table), unlike the documented optional
  fields, returns 200 rather than 201, and does not forward items/order_number/discount_amount.
  Public cold order lookup filters UUID `id` only, despite the documented code lookup.
- Main Worker checkout initiation ignores required `bank` in favor of `bank_code`, accepts GET,
  and generates a payment payload for a missing order. Promo/delivery changes are memory-only;
  events are echoed without persistence. These findings are not production checkout certification.
- `worker/src/checkout.js` forwards public API requests unchanged through `API`: the test-domain
  configuration targets `letsrealtalk-web-preview`, while production targets `rahunok`. The latter
  service implementation/deployed revision was not established by this audit.
- Error payloads use string `error` rather than the contract's required boolean `error` and
  `message`. YAML parsing found nine Response Objects without required `description`.
- **Evidence:** 11 offline assertions against `routeWebRequest` reproduced the source behavior;
  all external fetches were mocked. YAML inventory parsed 30 operations. These are discrepancy
  reproductions, not passing conformance tests. The demo-session response matches its inline schema.
- **Residual risks:** deployed service revisions, production checkout behavior, real JWT/key flows,
  database policies and settlement behavior remain unverified. No remote requests, database changes,
  API/specification edits, or deployments were performed for this audit.

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
