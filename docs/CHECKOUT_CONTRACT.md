# Checkout contract v1 — proposal

Status: **DRAFT / ISOLATED PROTOTYPE / NOT WIRED TO UI**, 2026-09-08. This document and the
JSON examples are a reviewable contract, not an API migration or a claim that
live synchronization is implemented. No deployment, database/RLS/Auth change,
payment action, or modification of the legacy Worker is authorized by this draft.

## 1. Verified baseline

- Svelte configuration already exists in
  [scenarios.json](../apps/pay/src/lib/config/scenarios.json). It remains unchanged;
  the proposed catalog below is not automatically merged into it.
- [Checkout shell cache](../worker/src/checkout.js) reads `ORDERS_KV` keys
  `order:<identifier>` before the API. API-derived entries default to 259200 s
  without expiry and otherwise use business expiry clamped to 300–604800 s.
  Direct-database fallback entries use 300 s. Complete invalidation was not found.
- The canonical source outside Corex uses `checkout_projection_v1:<identifier>`
  in KV (300 s) and Cache API (5 s). Create/PATCH/settlement rewrite known keys,
  but do not update the separate `order:` cache. Source inspection does not prove
  the deployed backend is identical.
- [Root/local Worker](../worker/src/index.ts) also has a 60 s in-memory cache.
  Its alias routing and status reads differ from the dedicated checkout Worker.
- [Pay realtime](../apps/pay/src/lib/services/realtime.ts) subscribes to a table
  broadcast and unfiltered `orders` changes, then filters in the browser. Its
  fallback only reads localStorage. This is not a verified public authorization
  boundary. A matching reliable publisher was not found in inspected code.
- [Pay store](../apps/pay/src/lib/state/checkout.svelte.ts) accepts injected data
  without initial revalidation; payment polling starts after initiation, checks
  only `paid`, and stops after eight minutes. No public monotonic revision is
  exposed by the inspected checkout projection/status contract.
- 2026-09-07 GET checks: local `/checkout/?id=…` returned 404; bare `/pay?id=…`
  returned root HTML locally and 403 on production; `/pay/?id=…` worked.
  `/tag/table-30` returned an order without terminal context. These remain open.

## 2. Separate identity, business state, and presentation

The URL selects a **resource**, not a Svelte component:

| Entry | Proposed intent | Invariant |
| --- | --- | --- |
| `/pay/<UUID>` | `invoice` | Never follows a newer terminal order |
| `/o/<shortId>` | `invoice` | Resolve once to canonical order UUID |
| `/pos/<shortId>` | `invoice` receipt | Paid receipt stays that receipt |
| `/tag/<code>` | `terminal` | Resolve immutable terminal UUID, then current order |
| `/t/<shortId>` | legacy invoice / open amount | Prefix alone does not authorize editable amount |
| `/t/<terminalCode>`, `/pos/<terminalCode>` | legacy terminal aliases | Preserve characterized links; ambiguity must fail explicitly |
| `/checkout/?id=…`, `/pay/?id=…`, `order_id` | compatibility entry | Same resolver, not a separate data implementation |

Bare `/pay` query variants must reach the same handler. Preserve query parameters
and direct refresh. If path/query IDs conflict, reject rather than render one
order and pay another. Existing hash forms require characterization before change.
Legacy short-ID/terminal-code collisions are unresolved: do not silently pick
an order. `_terminal` attached to an invoice is metadata, not permission to follow
terminal updates. Local and production must share resolver tests.

Public resolved context contains `resource.kind`, canonical `resource.id`, resource
`revision`, and a safe order summary. Terminal revision covers pointer changes
and projected current-order changes, including A → null → B. UUIDs alone and
guessable terminal codes are not subscription authorization.

## 3. State and payment rules

Normalize through a server adapter; do not rename persisted statuses in the UI.

| Canonical state | UI | Payment |
| --- | --- | --- |
| `idle` | Вільно · Активного рахунку немає | No; terminal only |
| `preparing` | Рахунок формується; show known amount honestly | No |
| `payable` | Receipt / amount-entry / delivery renderer | Only with fresh server permission |
| `paid` | Сплачено | No |
| `cancelled` | Скасовано | No |
| `expired` | Термін дії завершився | No |
| `failed` | Помилка рахунку; safe retry/read action | No |

Transport states (`connecting`, `live`, `reconnecting`, `stale`, `offline`,
`error`) are **orthogonal** to business state. Going offline cannot mark a bill
paid, expired, cancelled, or idle. Unknown/not-found is not synthetic `pending`.
Final-state corrections require a newer authoritative revision, not a locally
invented transition priority. A newer refund/reversal requires a future explicit
contract version; never silently map unknown states to payable.

`preparing + amount > 0` is deliberately **not automatically payable**. Existing
source used preparing as a blocker too. Backend owners must distinguish fulfillment
(kitchen preparing) from billing readiness. Until approved, show known amount and
uncertain readiness; do not display “amount missing” or enable payment speculatively.

For open amount, `payable` means the server permits an amount-entry workflow;
the user amount still needs bounds, currency, and authoritative validation at
initiation. For fixed amounts, server total in integer minor units is authoritative;
do not rebuild it from base amount and accidentally discard discounts/delivery.
Tips/splits/promos are requests subject to server capability and quote validation.

Bind payment to `{orderId, orderRevision}` from the accepted snapshot, not the
URL alias. Freeze that identity while handing off/polling a payment; a terminal
switch A → B must not change payment A. Only a server-confirmed initiation result
may start handoff; no client QR fallback after rejection. Server atomically
rechecks identity, amount, ownership, expiry, permission, and idempotency.
Staleness timers and client-side checks are not substitutes for server validation.

## 4. Cached first paint + authoritative synchronization

**KV is a bootstrap optimization, never the source of payment truth.** It has
eventual consistency; cache deletion and browser `cache: no-store` alone do not
bypass upstream KV/Cache API. Business expiry, cache retention, and UI freshness
are three separate values. This proposal does not change locked POS TTL rules.

Client lifecycle (both invoice and terminal, not just after payment):

1. Render safe cached data as **checking**, with payment disabled.
2. Obtain access scoped to the resolved public resource, start its channel, and
   start an authoritative read immediately (do not wait indefinitely for socket).
3. On confirmed subscription, read again to close the read/subscribe race.
4. A notification is only `{resource kind/id, revision, eventId}`: coalesce and
   fetch a complete allowlisted public projection. Never assign a raw CDC row to UI.
5. Accept only the current resource/generation and non-regressing revision.
    Deduplicate notifications, not authoritative confirmations: same-revision
    cache → authoritative promotion and repeated authoritative confirmation are
    valid and renew freshness. Cache must never downgrade authoritative data.
    Business content at the same revision must match; contradictory content fails
    closed. Confirmation metadata/source/permission are not business mutations.
    Discard late responses from superseded request generations. Revisions are integers;
   `updated_at`/browser time/schema version are not order revisions.
6. Revalidate on reconnect, online, foreground, manual refresh and before payment.
   Detect revision gaps; request full snapshot, not a guessed state transition.
7. Maintain one in-flight read per resource, coalesce bursts, abort on route change,
   and clean up channels/timers. Old requests/timeouts must not affect a new page.
    Keep the maximum notified revision as a watermark. If revision 9 arrives while
    reading revision 8, queue another read; an 8 response cannot restore freshness
    below watermark 9. The minimum-revision request/error wire shape is an open
    backend design item, not an existing query parameter.
8. Poll as a recovery path with bounded backoff/jitter; slow heartbeat even with
   WebSocket detects missed publication. Hidden tabs suspend routine polling;
   foreground always reconciles. Losing freshness disables new payment and shows
   “Статус уточнюється”, not fake success. Existing bank handoff remains bound.
9. Resource deletion/revocation yields explicit inaccessible state; purge local
   snapshot/access and disable payment. Authentication expiry is not “free table”.

`observedAt` is the server's authoritative observation time, preserved on cache
write/read (never reset when serving cached HTML). Socket events/cache arrival
cannot renew freshness. Clients measure confirmation age conservatively with a
monotonic clock from request start, not by trusting client/server clock agreement.
Reject timed-out or excessive-latency confirmations and revalidate after suspension.
Only an accepted authoritative response at/above the watermark renews freshness.

Draft defaults in the catalog: degraded polling 5 s, healthy heartbeat 10 s,
max backoff 30 s, max freshness 15 s, request timeout 8 s, jitter 20%.
Heartbeat is below freshness budget but network latency can still make the UI
stale; show checking/disable initiation then. Always revalidate before handoff.
Tune after load/free-tier measurements; do not promise a real-time SLA from KV.

### Transport choice

Start implementation with **authoritative polling**: it works without a new
WebSocket server. Existing endpoints need an audit first: local status reads are
cached; inspected canonical status is UUID/short-ID only and lacks revision/full
state. Polling the same stale cache is not a solution.

Optional next adapter: **Supabase Realtime private Broadcast** with short-lived,
resource-scoped access and verified channel policies. Merchant Auth and payer
access are distinct. Never expose service-role keys or widen anonymous `orders`
RLS just to make the socket work. Do not subscribe payers to the entire table.
The current draft catalog selects polling; it does not pretend private channels
or a token-issuing endpoint exist.

Cloudflare WebSockets/Durable Objects are a possible later adapter, not required
for this phase and not provisioned here. KV itself does not push to browsers.
No new paid infrastructure is approved.

### Server write and cache contract (future work)

- Persist a mutation and monotonic resource revisions atomically; terminal
  projection revisions must cover pointer AND current-order changes.
- Record a durable notification/invalidation intent in the same transaction
  (outbox or equivalent); workers retry idempotently after commit. Publish-after-
  commit without durable retry has a lost-event gap.
- Build a minimal public projection; typed/environment-scoped keys separate
  invoice snapshots from terminal pointers. Do not cache a terminal pointer for
  the invoice's business lifetime or mix terminal context into invoice cache keys.
- Refresh/invalidate **all** existing cache layers/aliases, including negative
  entries. Retired aliases need invalidation/tombstones. Define one ordered writer
  per resource or treat KV writes as best-effort only; KV has no revision CAS.
- Authoritative snapshot reads bypass every mutable projection cache and meet
  the requested minimum revision or return explicit retryable “not caught up”.
  Even a newly generated timestamp does not make stale cached content authoritative.
- Initiation independently reads authoritative state; socket/cache timing cannot
  make an invalid payment valid. Public events carry no bank payload/customer data.
- Reconciliation must still work when notification delivery, invalidation or a
  cache write fails. Use explicit observability for cache age, revision lag,
  reconnects, refetch failures and stale-payment blocks; no sensitive payload logs.

## 5. JSON configuration boundary

[Schema](checkout-contract/schema.json) validates a catalog, public state snapshot,
or public change notification using `documentType`. [Catalog](checkout-contract/catalog.example.json)
contains fixed/table/open-amount/delivery examples; [protocol examples](checkout-contract/protocol.examples.json)
are **proposed wire shapes, not current API responses**. Snapshots intentionally
contain only state/amount identity, not the full presentation/payment requisites.

`schemaVersion` describes wire/config format; `revision` describes a resource
mutation. Neither is a business expiry. Versions are validated, not guessed.
Scenario config selects allowlisted renderers/features/text. It cannot contain
JavaScript, arbitrary URLs, payment status, recipient overrides or cache policy.
Texts render as text (never HTML). Features request UI, not server permission.

Mandatory semantic validation beyond draft-07: scenario IDs are unique; max
backoff is at least poll interval; heartbeat is below max freshness. For invoices,
`resource.id === order.id` and resource/order revisions match. Terminal UUID stays
fixed through A → null → B; order revisions are independent, and terminal/order
association must be verified by the server (UUID format is not authorization).
The test helper demonstrates these checks; JSON Schema alone cannot enforce
cross-field equality or uniqueness by one property.

Operational `sync` policy is application-owned; it is never a merchant/terminal
override. There is deliberately no default scenario for an unresolved invoice:
the authoritative adapter must select a known scenario, or fail closed. Labels
remain plain text even if a string contains markup-like characters.

### Local validation

[Contract tests](checkout-contract/contract.test.mjs) validate draft-07 shapes,
examples and selected cross-field invariants: **25 tests passed**. They use Node's
built-in test runner (`node --test` with that test file) and the already installed
Ajv 6 dependency from the development tooling. No dependency manifests or lockfiles
were changed. Before adding this validator to CI or runtime, declare a direct,
pinned validator dependency rather than relying on a transitive installation.
These are configuration tests, not a reducer, network, payment, or authorization
implementation. Same-revision confirmation, watermark races, clock suspension,
and reconnection still need mocked runtime tests during implementation.

Future precedence: application defaults → validated merchant override → validated
terminal override → allowed invoice snapshot overrides. Merge only explicit
allowlisted leaf paths; arrays replace, no arbitrary deep merge/prototype keys.
Validate merged result and renderer/amount compatibility. Invalid/unknown version
must not silently enable capabilities; use safe baseline/error and observability.
Supabase persistence, ownership/RLS, publishing/version history and rollback need
a separate approved implementation. This draft adds no tables.

## 6. Acceptance and rollout gates

1. Review route ambiguity and preparing-versus-billing-readiness decisions.
2. Schema-positive/negative tests (this phase) do not prove runtime synchronization.
3. Implement pure resource resolver + state adapter with mocked contract tests.
4. Implement authoritative public read/revision/access boundary, then client poller.
5. Add cache bootstrap reconciliation and optional authorized realtime adapter.
6. Test locally: every alias/query/slash; mismatched injected ID; old cache after
   paid; empty terminal then A then B; invoice A never follows B; paid/cancelled/
   expired changes before payment; reversed event order/duplicates/gaps; delayed
   stale HTTP response; disconnected/reconnected/hidden tab; revoked access;
   server rejection never opens bank; concurrent initiation and terminal rollover;
   missed outbox delivery; all cache layer invalidations; unknown schema/status.
7. Test no cross-merchant/terminal leak and no raw CDC/customer/bank payload in
   public messages. Test same contract on local and production adapters.
8. Deploy only after separate approval; no claim of parity before these gates.

## 7. Isolated implementation progress

Implemented locally, without importing into the current checkout store:

- [Strict boundary and URL parser](../apps/pay/src/lib/services/checkout-contract.ts):
  canonical resource identity, minimal snapshot/change decoding, exact primitive
  enum types, fail-closed status/amount validation and conflicting URL rejection.
  `/pos` and `/t` remain explicitly ambiguous until trusted resolution. Hash forms
  remain unsupported in this prototype pending characterization.
- [Poll-first controller](../apps/pay/src/lib/services/checkout-sync.ts): injected
  reader and monotonic scheduler, single-flight reads, revision watermark,
  same-revision authoritative confirmation, nested order-revision checks,
  timeout/abort/backoff, foreground/reconnect reconciliation and disposal.
  Revocation clears the displayed snapshot and stops reading. A controller is
  bound to one resource: dispose it before creating one for another route.
- Payment preflight captures the displayed order ID/revision before awaiting;
  any rollover or revision change requires renewed user confirmation. Returned
  bindings are immutable; this module never launches a bank or initiates payment.
- [Mock tests](../apps/pay/src/lib/services/checkout-sync.test.mjs): **20 passed**,
  no HTTP/Supabase/payment calls. Existing package test glob includes these tests.
  Full Pay typecheck still reports three pre-existing `Order.description` errors
  in the current store/bank sheet; no errors reported in the new modules.

The reader interface's `minimumRevision` is an internal requirement, **not a new
HTTP parameter**. No concrete reader, browser lifecycle adapter, Svelte UI adapter,
private subscription, or merchant JSON override loader is connected. The decoder
is for the minimal prototype envelope, not a replacement for a fully maintained
JSON Schema validator (including exhaustive date-format conformance).

Before connection, backend approval/implementation must establish:

1. Canonical invoice/terminal resolution, payer-scoped access and revocation.
2. Atomic resource AND order revisions; full authoritative snapshots bypassing
   every mutable cache, including explicit lag/error results.
3. Billing readiness, scenario selection and editable-amount bounds.
4. Revision-bound server initiation with independent validation/idempotency.

The adapter must never label the existing cached GET/status responses as
authoritative or synthesize revisions from timestamps. Notification transport
remains optional; poll-first logic does not depend on a WebSocket server.
Future browser integration must call visibility/online lifecycle methods and
dispose channels/controllers; supply a monotonic clock, not wall-clock time.
Per-controller order history preserves revision knowledge across A → null → B;
long-lived terminal sessions need an explicit bounded-history/session-renewal
policy before production, without forgetting anti-regression guarantees.

## References

- [Migration boundaries](MIGRATION_PLAN.md)
- [Cloudflare KV consistency](https://developers.cloudflare.com/kv/concepts/how-kv-works/)
- [KV cacheTtl](https://developers.cloudflare.com/kv/api/read-key-value-pairs/#cachettl-parameter)
- [Supabase database broadcasts](https://supabase.com/docs/guides/realtime/subscribing-to-database-changes)
- [Supabase Realtime authorization](https://supabase.com/docs/guides/realtime/authorization)