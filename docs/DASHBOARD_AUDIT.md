# Dashboard Audit

This document defines the behavioral and UX baseline for migrating the merchant dashboard from `../core/dashboard` to Svelte 5. The legacy backend, Supabase schema, RLS policies, Worker routes, and production deployment remain unchanged during the frontend migration.

## Source Of Truth

The active dashboard is the inline application in `../core/dashboard/index.html`. It loads `../core/dashboard/dashboard.css` and the Supabase browser SDK. The files under `../core/dashboard/js`, `../core/dashboard/css`, and `../core/dashboard/test.js` are not loaded by the active page and must not be treated as behavioral authority.

Before migrating a flow, compare it against the inline application and verify the deployed test environment when the checked-in schema and runtime behavior disagree.

## Product Priorities

The migration is evaluated in this order:

1. Financial actions are correct and visibly confirmed.
2. Auth, ownership, and RLS boundaries are preserved.
3. Common POS and invoice tasks require fewer decisions and remain fast on touch devices.
4. Loading, empty, error, offline, and success states are explicit.
5. Desktop and mobile layouts remain usable without clipped controls or nested scroll traps.
6. The visual language is a quiet, modern fintech workspace built with Tailwind.

## Route Inventory

| Legacy hash route | Purpose                                      | Corex target                                     |
| ----------------- | -------------------------------------------- | ------------------------------------------------ |
| `#/login`         | Google OAuth and experimental passkey login  | `/dashboard/login/` or protected dashboard state |
| `#/overview`      | Daily metrics and recent invoices            | `/dashboard/`                                    |
| `#/pos`           | Amount, product cart, and table/tag POS      | `/dashboard/pos/`                                |
| `#/invoices/new`  | Four-scenario invoice creation               | `/dashboard/invoices/new/`                       |
| `#/invoices`      | Searchable and filterable invoice list       | `/dashboard/invoices/`                           |
| `#/invoices/:id`  | Invoice, QR, sharing, status, and audit      | `/dashboard/invoices/[id]/`                      |
| `#/structure`     | Entities, accounts, locations, and terminals | `/dashboard/structure/`                          |
| `#/api-keys`      | API token and integration guidance           | `/dashboard/developers/`                         |
| `#/settings`      | Theme, table TTL, and passkey enrollment     | `/dashboard/settings/`                           |

Unknown legacy hashes currently fall back to POS. `#/products` is advertised by a hotkey but has no active router branch and must not become a new product route without a separate decision.

## Functional Baseline

### Authentication And Session

- Create the Supabase client in the browser with the existing public project URL and anonymous key.
- Restore the session with `auth.getSession()` while preserving the observed 1.5-second fallback during parity work.
- Load the current merchant from `merchants` by authenticated `user_id`.
- Support Google OAuth with a return to `/dashboard/`.
- Preserve experimental passkey sign-in and enrollment behind capability checks.
- Sign out through Supabase and clear matching Supabase auth keys before returning to login.
- Replace blocking alerts with inline errors or toasts, but preserve the underlying outcomes.

The current page has no `onAuthStateChange` listener. Corex should use one only after tests prove that callback ordering does not change OAuth restoration or route transitions.

### Overview

- Show today's revenue, payment count, average payment, terminal count, and five recent merchant orders.
- Scope every order query to the authenticated merchant.
- Keep loading, empty, and error states distinct.
- Do not preserve the legacy bug that counts `pending` orders as successful revenue without an explicit product decision and fixture proving production expectations.

### Invoice Creation

Preserve the four scenarios and their conditional fields:

- `fixed`: a fixed-amount invoice;
- `open_amount`: the customer enters the amount;
- `table`: table or tag flow with expiry;
- `delivery`: delivery-oriented payment flow.

Preserve entity and terminal selection, quick amounts, calculator input, title or purpose, memo, expiry, QR generation, local fallback, and order event creation. Before implementing mutations, map every collected field to the actual deployed schema: several legacy fields are currently collected but discarded.

### POS

Preserve all three work modes:

- amount entry;
- product cart;
- tags or tables.

Each table keeps an independent draft containing cart items, amount expression, memo, and evaluation state. Preserve quick amounts, calculator operations, cart quantity changes, QR creation, cash registration, cancellation, paid state, and table release.

The migration must explicitly test create-versus-update behavior for an existing pending table order. Products and categories are currently hard-coded, while search and category controls are visually present but inactive.

### Invoices And Payments

- Search by the legacy supported text and amount fields.
- Filter by status, type, and date.
- Preserve ten-row pagination.
- Open invoice details from a list result.
- Cancel eligible invoices with pending and failure feedback.
- Load audit events from the existing Worker endpoint, with the current Supabase fallback.
- Present a responsive row layout on mobile rather than relying only on a horizontally scrolling desktop table.

### Invoice Detail

- Resolve the order from Supabase, then use the documented local fallback when applicable.
- Display amount, status, purpose, timestamps, QR, and share URLs.
- Preserve clipboard sharing and checkout launch.
- Keep sandbox payment mutation isolated from real payment UX.
- Restore the audit timeline; the legacy renderer currently targets a missing element.

### Business Structure

- Merchant display-name updates are operational through the existing `merchants` RLS contract.
- Business entity create, edit, and delete are operational through verified checked-in columns and user-scoped RLS.
- Terminal create, edit, and delete are operational through verified checked-in columns and user-scoped RLS.
- Active entity selection is preserved while refreshed records remain available.
- Supabase mutation errors are surfaced in the structure UI.
- Bank-account controls remain locked until the deployed contract is captured.

The deployed `bank_accounts` contract and enum values must be captured from an approved environment before this mutation slice starts because checked-in SQL does not fully match the active UI.

### Implemented Dashboard Controls

- Sign-out uses the existing Supabase Auth session.
- Theme persists in `rahunok_theme` and applies across dashboard routes.
- `rahunok_table_ttl` is a minute value, matching the legacy `value * 60000` consumer.
- Developer API examples use relative Worker routes and placeholders; session JWTs are never rendered.
- Invoice detail cancellation reuses the same eligibility contract as the list.
- `Alt+1`, `Alt+2`, `Alt+3`, and `Alt+N` navigate dashboard surfaces outside editable controls.

### Developer And Settings Surfaces

- Mask access tokens by default and require an explicit reveal or copy action.
- Keep integration examples consistent with the endpoint they call.
- Preserve theme and table TTL settings.
- Show protocol, Realtime, or bank availability only from measured state; remove static health claims.
- Remove the merchant/payer switch until payer mode has a real destination and behavior.

## Data And Integration Contract

### Supabase Tables

| Table               | Active dashboard behavior                                                |
| ------------------- | ------------------------------------------------------------------------ |
| `merchants`         | Read by `user_id`; update business/display name                          |
| `business_entities` | User-scoped list; create, update, delete                                 |
| `terminals`         | User/entity-scoped list; code lookup; create, update, delete             |
| `bank_accounts`     | Entity-related list; create and delete; deployed schema must be verified |
| `orders`            | Merchant/status/date/type/search reads; create and status/detail updates |
| `order_events`      | Order timeline reads and selected lifecycle inserts                      |

### Worker Routes

- `POST /api/v1/checkout/:order_id/event`
  - Body: `event_type`, `actor_name`, `bank_code`, `previous_bank_code`, `metadata`.
- `GET /api/v1/checkout/:order_id/events`
  - Response: `order_id`, `events`.

Do not change these payloads during frontend parity work.

### Browser Storage

Preserve and centrally type these keys:

- `rahunok_theme`
- `rahunok_user_role`
- `rahunok_staff_id`
- `rahunok_table_ttl`
- `rahunok_active_fop_id`
- `rahunok_active_fop_name`
- `rahunok_cached_terminals`
- `rahunok_dismissed_orders`
- `rahunok_order_<id>`
- Supabase SDK auth keys

Storage parsing must tolerate missing, malformed, and obsolete values.

### Realtime And Polling

The active POS subscribes to `orders` changes and polls active orders every 15 seconds. Corex must own both mechanisms in one lifecycle-managed service:

- subscribe only while the POS route is active;
- scope reads and events to the current merchant and relevant terminals;
- pause or reduce polling while the document is hidden;
- remove channels and intervals on route exit and logout;
- recover from disconnected Realtime without duplicating subscriptions.

## Risks Requiring Explicit Decisions

1. The legacy browser contains a direct telemetry bearer token. It must not be copied into Corex. This credential should be rotated separately, and telemetry should use the existing approved server boundary.
2. The legacy POS can issue unscoped active-order reads. Corex must not reproduce cross-merchant exposure; all dashboard reads require explicit ownership scope in addition to existing RLS.
3. The UI writes order status `completed`, but checked-in SQL may reject it.
4. UI entity and terminal enum values do not fully match checked-in schema constraints.
5. Table TTL is labelled ambiguously and multiplied as minutes in the active code.
6. Several invoice fields are displayed and collected but not persisted.
7. Local fallback orders are absent from overview and list views.
8. Some order event names and actor/source values disagree between browser code, Worker types, and persisted records.

These issues must be characterized with sanitized fixtures. Do not silently resolve them by changing Supabase or Worker behavior.

## UX Audit

### Preserve

- Fast access to POS and new invoice actions.
- Separate table carts and visible free, draft, pending, and paid states.
- Dense invoice scanning with tabular monetary values.
- Quick amounts, touch calculator, QR, and sharing.
- Clear paid, pending, and failed status semantics.
- Desktop sidebar and compact operational layout.

### Replace Or Correct

- Clickable `div` and table rows must become semantic buttons, links, tabs, or radio controls.
- Dialogs need labels, focus containment, Escape handling, and focus restoration.
- Native `disabled` and `aria-busy` states must replace opacity and pointer-event simulations.
- Every financial mutation needs progress, success, failure, and retry feedback.
- Mobile navigation needs a backdrop, outside-click/Escape close, focus management, and automatic close after navigation.
- Mobile pages need natural document scrolling; remove fixed-height nested scroll traps.
- Remove viewport zoom restrictions.
- Replace browser `alert()` and `confirm()` with accessible dialogs and toasts.
- Add visible `:focus-visible` treatment across all interactive controls.
- Never communicate payment state by color alone.
- Avoid global single-key shortcuts while focus is in any editable or interactive control.

## Tailwind Fintech Direction

Use Tailwind as the styling system and keep feature styles close to dashboard components. Avoid a second monolithic dashboard stylesheet.

### Visual Language

- Light-first operational canvas with a dark equivalent theme.
- Neutral white and cool-gray surfaces; near-black primary text.
- Blue only for primary actions and selected navigation.
- Emerald only for confirmed success, amber for attention, red for destructive or failed states.
- Tabular numerals for amounts, IDs, and timestamps.
- Four-to-eight pixel radii for controls and data panels; up to twelve pixels for dialogs and primary POS surfaces.
- Visible borders and restrained shadows; no decorative gradients, glass effects, or oversized marketing typography.
- Dense but breathable spacing optimized for repeated daily use.

### Component Layer

Create reusable primitives before feature screens:

- `DashboardShell`, `Sidebar`, `MobileNavigation`, `NavItem`;
- `PageHeader`, `PageActions`, `Metric`;
- `DataTable`, responsive invoice row, pagination;
- `StatusBadge`, `Money`, timestamp and identifier display;
- `Field`, `Select`, `SegmentedControl`, calculator keypad;
- `Dialog`, mobile `Sheet`, `Toast`, confirmation flow;
- `Skeleton`, `EmptyState`, `ErrorState`.

Use Lucide icons through the project icon library when introduced. Icon-only actions require an accessible label and tooltip.

### Responsive Model

- Desktop: persistent sidebar, sticky page header, dense tables, and split POS workspace.
- Tablet: collapsible sidebar and adaptable two-column layouts.
- Mobile: navigation sheet, one-column forms, invoice row alternative, and sticky bottom payment summary or primary action.
- Apply safe-area padding to fixed or sticky mobile controls.
- No horizontal page overflow at 320, 375, 768, 1024, and 1440 pixel widths.

## Proposed Corex Architecture

```text
src/lib/features/dashboard/
├─ api/             # Typed Supabase and Worker adapters
├─ auth/            # Browser session and merchant context
├─ components/      # Dashboard-specific shared UI
├─ invoices/        # List, create, and detail flows
├─ overview/        # Read-only operational summary
├─ pos/             # POS state machine and synchronization
├─ structure/       # Entity, account, and terminal management
├─ settings/        # Local preferences and passkeys
├─ state/           # Typed storage and feature state
└─ types.ts

src/routes/dashboard/
├─ +layout.svelte
├─ +page.svelte
├─ login/+page.svelte
├─ pos/+page.svelte
├─ invoices/+page.svelte
├─ invoices/new/+page.svelte
├─ invoices/[id]/+page.svelte
├─ structure/+page.svelte
├─ developers/+page.svelte
└─ settings/+page.svelte
```

Routes remain thin and contain only routing concerns. Browser-only integrations stay behind feature adapters so they cannot execute during SSR.

## Migration Sequence

1. Add typed domain models, storage keys, status mappings, and sanitized fixtures.
2. Build the Tailwind dashboard shell and all shared loading, empty, error, dialog, and toast states.
3. Implement browser-only Supabase initialization, protected routing, login, logout, and merchant context.
4. Migrate read-only overview, invoice list, invoice detail, and audit timeline.
5. Migrate invoice creation after deployed field and enum contracts are verified.
6. Implement the POS state machine with pure reducer tests before attaching Supabase mutations.
7. Add scoped Realtime and polling with route lifecycle cleanup.
8. Migrate entity, bank account, and terminal management after schema mismatches are resolved.
9. Migrate settings, passkeys, and developer guidance.
10. Run parity tests, mobile accessibility checks, and approved-environment network verification before routing production traffic.

## Acceptance Criteria

Each migrated screen must have:

- loading, empty, success, and recoverable error states;
- keyboard-operable controls and visible focus;
- no horizontal overflow at the supported viewport widths;
- deterministic cleanup for timers and subscriptions;
- explicit merchant scoping for financial data;
- no browser-embedded secret or telemetry credential;
- tests for monetary calculations and status transitions;
- a browser test for its primary user journey;
- no Worker, Supabase schema, RLS, or production deployment change.
