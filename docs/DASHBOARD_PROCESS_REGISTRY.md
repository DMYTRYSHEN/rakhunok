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
