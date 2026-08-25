# Legacy Behavior Baseline

## Purpose

This document records the current frontend behavior in `../core`. Corex implementations must match this baseline before redesign or backend changes are considered.

## Canonical Surfaces

| Surface      | Canonical legacy source                                                             | Critical behavior                                                                                                      |
| ------------ | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Landing      | `../core/Index.html`                                                                | Marketing navigation, demo flow, modal behavior, OAuth hash forwarding, lead submission                                |
| POS PWA      | `../core/app/index.html`, `../core/app/assets/app.js`, `../core/app/assets/app.css` | Supabase Auth, calculator, scenarios, terminals, order creation, QR/share, history, cancellation, polling              |
| Checkout     | Active inline code in `../core/checkout/index.html`                                 | Identifier resolution, edge hydration, table mode, banks, reCAPTCHA, payment initiation, deep links, polling, Realtime |
| Dashboard    | Active inline code in `../core/dashboard/index.html`                                | Auth/passkeys, merchant data, POS, orders, entities, bank accounts, terminals, audit events, Realtime                  |
| Docs         | `../core/docs`                                                                      | Static OpenAPI presentation and `/doc` compatibility                                                                   |
| Pay redirect | `../core/pay`                                                                       | Redirect old `/pay/:id` links to checkout                                                                              |

Generated `dist`/`public` copies, `.wrangler`, patch scripts, modular prototypes, and `dashboard-v2` are not canonical behavior sources.

## Landing Baseline

- Root document title: `Rahunok — оплата напряму на рахунок бізнесу`.
- In-page navigation targets include `#payment-flow`, `#solutions`, `#money-flow`, `#pricing`, `#faq`, and `#demo`.
- Dashboard CTA points to `/dashboard/`.
- When the URL hash contains `access_token=`, the page forwards it to the path stored in `auth_redirect`, falling back to `/dashboard/`.
- The lead form posts to `/api/leads`; the active Worker does not currently implement that endpoint. Preserve this as a documented legacy mismatch during parity work.
- Visual baseline still needs browser screenshots before the landing port begins.

## POS/PWA Baseline

- Supabase browser Auth restores the session with `auth.getSession()` and observes `onAuthStateChange`.
- Google OAuth is initiated in the browser.
- Reads `business_entities`, `terminals`, `merchants`, and `orders` directly through the Supabase browser client.
- Stores the default entity in `default_entity_id`.
- Supports `fixed`, `table`, and `open_amount` order types.
- Handles arithmetic input, delayed evaluation, backspace hold, selected terminal, and active table-order collisions.
- Creates orders directly through Supabase and stores local fallback order data.
- Displays generated QR codes and uses Web Share where available.
- Polls order status after creation, normally every 3 seconds, with a 5-second error retry.
- Cancelling an active order updates its status to `cancelled`.
- Manifest exists. Existing service-worker caching must not be enabled automatically during migration.

## Checkout Baseline

- Resolves identifiers from `id`, `order_id`, aliases in the path, URL hash, and local fallback state.
- Supported path prefixes include `pay`, `checkout`, `o`, `t`, `tag`, and `pos`.
- Reads `window.__INITIAL_ORDER__`, `window.__INITIAL_BANKS__`, and `window.__INITIAL_TERMINAL__` when injected by the Worker.
- Resolves terminal/table state through Supabase and can select the newest pending order.
- Uses localStorage fallbacks including `rahunok_last_order_id`, `rahunok_last_order`, `rahunok_order_*`, `rahunok_orders`, and `rahunok_term_*`.
- Table mode coordinates changes using BroadcastChannel, Supabase Realtime, the storage event, and periodic REST checks.
- Loads banks and logos from the Worker.
- Refreshes a reCAPTCHA token every 90 seconds.
- Initiates payment through the existing checkout API, launches a bank deep link, applies a fallback URL after a delay, and polls payment status.
- Uses Web Share when available.
- All intervals, timeouts, BroadcastChannels, and Supabase channels must be disposed when state changes or components unmount.

## Dashboard Baseline

- Uses Supabase browser Auth with Google OAuth and experimental passkey paths.
- Restores Auth with a 1.5-second fallback timeout.
- Maintains theme, role, active business entity, terminal cache, dismissed orders, staff identity, and local fallback orders in localStorage.
- Reads and mutates `merchants`, `business_entities`, `terminals`, `bank_accounts`, `orders`, and `order_events` directly through Supabase.
- Uses a Realtime channel for POS order updates and also runs a periodic active-order refresh.
- Sends order lifecycle events to the Worker and currently also contains direct browser telemetry behavior.
- Supports overview, POS, orders, entity/account/terminal management, and audit/event views.
- Some legacy code writes status `completed`; this conflicts with parts of the checked-in SQL and must be characterized against actual runtime behavior rather than normalized during migration.

## Baseline Acceptance Artifacts Still Required

- Desktop and mobile screenshots for every primary route and state.
- Network traces for login, order creation, checkout load, payment initiation, and status completion.
- Exact request and response fixtures with secrets and personal data removed.
- Keyboard/focus behavior for authentication, payment, modals, and critical forms.
- Test identifiers from an explicitly approved non-production environment.
