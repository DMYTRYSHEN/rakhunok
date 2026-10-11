# Client Support Mode Implementation Plan

Date: 2026-10-05
Status: partial local integration with tested table-TTL operation; remote rollout and other writes pending.
Current scope: no Axiom, no external log export, no secret provisioning.

## Primary Workflow Clarification

The user confirmed that support must enter the existing customer Dashboard rather
than operate a duplicate console for each feature. The support route should select
the customer and establish an expiring server-authorized context. Existing screens
should be reused, with a persistent customer banner and explicit exit to the admin.
The administrator retains their own SDK identity; customer credentials and JWT
impersonation are excluded. Incoming-funds confirmation remains forbidden.

The user approved the named local DASH-AUTH-001 / DASH-SHELL-001 exception with
"супер продовжуй". Shared-shell entry is now implemented as a limited read-only slice:
the support page offers customer-cabinet entry, followed by full-document navigation.
Only a boolean mode marker is stored in sessionStorage. Original administrator SDK
identity is preserved; server bootstrap and snapshot select and validate the customer.
The existing overview renders the snapshot without unsupported aggregate metrics.
All other views are blocked before mounting their ordinary API-capable components.

A persistent banner identifies the customer/workspace and shows expiry and explicit
exit. Data is cleared on expiry, auth session changes, failed revalidation and exit.
Abort signals and response fencing prevent late reads restoring a closed context.
No owner gateway fallback or support Realtime subscription is used. Revocation is
checked on reads, visibility changes and every 15 seconds, not via instant push.
Failed server end leaves a closed retryable screen; successful end returns to support
without signing out the administrator. Entry and exit reload the document to clear
old module caches and subscriptions.

Focused gateway suites pass 50 tests; six mocked browser scenarios cover existing TTL
recovery plus shared-cabinet entry/reload, blocked creation/POS including demo=1,
expiry, revoked snapshot, failed exit/retry, retained administrator auth storage and
zero ordinary business API requests. Widths 1366/375 have no horizontal overflow.
These are mocked integration checks, not real GoTrue/PostgREST validation.
Invoice creation, full configuration and executable scenario reproduction remain
unimplemented in the shared cabinet. Ordinary invoice rules and remote migration,
grant and deployment approval boundaries are unchanged.

## Current Integration Checkpoint

The actual Dashboard route is `http://127.0.0.1:5190/dashboard/support` while its
local Vite task is running. It uses the existing administrator Supabase SDK session,
TOTP MFA, exact email/UID lookup, merchant selection, reason-bound context,
snapshots, reload recovery and exit. Same-actor sign-in resets previous customer data.
Operators with explicit write permission can review and confirm a table-TTL change.
The synthetic tool below remains separate and is not a real-client backend.

`worker-rhnk-to/support.js` forwards the original administrator JWT with an explicit
project URL/publishable key to `public.support_dispatch`. It checks origin, bounded
JSON inputs, action allowlist and bounded upstream JSON; errors are sanitized and
responses are no-store. Local `/dashboard/api/support` routes exclusively to port
8791, preserving its path and failing closed with 503 when no backend is running.
The real local adapter targets the selected shared project `mwaeazabpvbxqfrceogr`.
There is no production SUPPORT binding yet.

Applied to shared DAC7 after explicit approval on 2026-10-05:
`supabase/migrations/20261005172522_support_customer_context.sql`.
It implements private operator/context/operation/audit tables, current auth/session/role checks,
fresh MFA for search/open, ownership and expiry checks, exact typed inputs and atomic
successful-action audit. Missing/transferred sellers invalidate live settings reads;
stored sandbox resource ownership is rechecked before release. Sandbox is an allowlisted
private snapshot with isolated table-TTL editing, not full executable invoice reproduction.

The only real write adapter currently implemented is `settings.table_ttl`. It requires
`operators.can_write`, current AAL2/fresh MFA, context-bound elevation (at most five
minutes), server-stored canonical SHA-256 preparation and a two-minute confirmation.
Live confirmation uses a distinct acknowledgement from sandbox. Commit checks the
previous nullable stored value, atomically changes only `merchant_settings`, records
the result and correlates the audit. Repeated commits return the stored result without
reapplying the mutation. Exit cancels outstanding preparations. Sandbox changes only
the private snapshot. Allowed values match Dashboard: 1800, 3600, 7200, 18000 seconds;
only future table invoices use the setting, and existing orders are untouched.

The UI displays the before/after review and requires an explicit checkbox. A lost
commit response retains the operation for status-only reconciliation, without repeating
the write. The audited `operation` action returns a context-bound operation by ID or
the latest operation on reload. Prepared operations require renewed acknowledgement;
committed operations return their stored result. Cancelled and expired preparations
are distinguished. Result reads require current actor/session/read access and an active,
owned context, but not can_write, fresh MFA or elevation. Deterministic HTTP rejection
is distinguished from an unknown transport outcome. CAS is expected-value/existence
comparison, not a revision: an intervening change back to the original value (ABA) is
not detectable. Real concurrent PostgreSQL and owner-write interaction remain unverified.

PGlite SQL tests, Worker HTTP tests and mocked Chromium tests of the actual UI pass.
Browser fixtures intercept all Supabase/support calls; no real account was signed in
by these tests. After separate approval, verified operator
`4917dc24-e6d9-4870-b40d-a504504d4a5b` received `enabled=true`, `can_write=true` in
shared DAC7. RPC/table denial checks and post-migration security advisors passed
without new warnings; four private no-policy informational findings are expected.
Real GoTrue MFA and authenticated customer E2E remain unverified.
Deferred rhnk_main is empty and lacks the
required baseline; this migration must not be applied there on its own or redirected
silently to DAC7. rhnk_main was not changed. No customer business data was mutated
during shared DAC7 setup, and no Worker was deployed.

PGlite covers TTL permission/elevation/MFA, malformed input, digest/acknowledgement
tampering, stale values, absent-row conflicts, audit rollback, replay, cancellation,
expiry, exit and sandbox isolation. Mocked browser coverage includes explicit review
and status-only recovery after losing a successful commit response, pending/committed
reload recovery, reads without current write permission/fresh MFA, and conflict handling.
SQL tests cover reconciliation after elevation expiry, revoked write permission, stale
MFA, and rejection for disabled operators, other sessions/contexts, lost ownership and
expired/revoked contexts. These tests do not establish real PostgreSQL concurrency.

Support retains the administrator's own identity while configuring or reproducing
customer issues; it never impersonates a customer JWT. HTTP and direct-RPC negative
tests reject payment confirmation, marking invoices paid, receipt creation, ledger
credit and webhook replay. Only the explicit TTL write capability is implemented.
This is an allowlist boundary, not a generic privileged proxy with a payment blacklist.

Remaining release gates: multi-tab/in-flight operation race handling, other settings/invoice write
adapters, executable isolated sandbox, denial auditing,
rate limiting, snapshot retention cleanup, diagnostics/reports, full MFA/expiry/race
browser coverage, runtime configuration, target-specific migration review and explicit
remote-operation approval. Lifetime belongs to `merchant_settings.table_order_ttl_seconds`,
not the version-2 business-settings document. Ordinary invoice creation remains tied
to `auth.uid()` and cannot be reused by forging customer claims. Delivery blockers remain.

This checkpoint supersedes historical implementation-status statements below. It is
not a full service or permission to publish under the earlier conditional request.

## Historical Synthetic Tool Checkpoint

The local tool is available at `http://127.0.0.1:5188` using the VS Code task
`Client Support local demo`. See [local instructions](../worker-rhnk-to/SUPPORT_LOCAL.md).
It provides sandbox/live simulation, reason-bound expiring sessions, all four
synthetic invoice scenarios, payment requisites/numbering/lifetime settings,
server-normalized SHA-256 operation preparation, explicit confirmation,
idempotent commit, revision enforcement, local audit and session exit.

Both environments are synthetic. A loopback Node server persists local business
records and audit in one atomically replaced temporary-directory JSON file.
Administrator identity and elevation are demo-only, not verified auth/MFA.
No real client, Supabase project, payment or notification is connected. Ordinary
Dashboard authentication and production invoice code are untouched. The local
model is not a production-domain adapter or proof of delivery readiness.

Browser demonstration created a fixed 45 UAH sandbox invoice, changed lifetime
to 90 minutes, entered read-only live simulation, cancelled a prepared operation,
created a synthetic delivery invoice after elevation, and exited to admin context.
Automated Chromium coverage exercises all four scenarios, rules, audit, reload,
isolation, confirmation, cancellation, exit and desktop/mobile layout.
Real-customer integration remains pending the authenticated adapters and database
compatibility/security checks described below; no remote write or deploy occurred.

## Revised Product Scope: Sandbox And Live Business

Explicit user approval after the scope question: all `fixed`, `open_amount`,
`table`, `delivery` creation scenarios and payment requisites, invoice numbering
and invoice lifetime settings are included for implementation in both workspaces.
This is a bounded support implementation scope, preserving established invoice
authority and ordinary customer flows; not blanket CRUD or remote execution approval.

Local confirmation policy added in `worker-rhnk-to/support-operation-policy.js`:
13 support tests pass. It validates trusted operation/context/confirmation inputs
only, not signatures or actual writes. The server must canonicalize the full
validated payload (including scenario, settings groups and expected revision),
compute its SHA-256 digest, persist the reviewed confirmation and consume it
atomically with audit and mutation. Never trust caller-supplied digests, capabilities,
MFA fields, confirmed/consumed flags or project identity. A local synthetic write
adapter now exists; a real-business transactional write adapter does not.

User explicitly requested both isolated test reproduction and operations in the
customer's real business. This section supersedes earlier statements excluding
all future live writes; existing release-1 read-only restrictions and the tested
kernel remain unchanged. Approval of product scope is not remote-write/deploy
approval or a named invoice-scenario unlock.

Two workspaces are required:

- `sandbox`: dedicated test environment with synthetic or separately approved
  masked fixtures and ordinary test-user permissions. Allow test invoice creation
  and supported settings changes; block real payments and external notifications.
- `live`: real customer business, initially read-only. Separately elevate the
  session to narrowly scoped `invoice.create` and/or `settings.update` capabilities
  using fresh MFA, a mandatory reason and explicit live-business confirmation.
  No blanket superadmin CRUD, arbitrary RPC or customer-session impersonation.

Bind workspace, actual database/project, actor, target, merchant and capabilities
server-side. Switching workspaces ends the previous session and clears caches,
drafts, subscriptions and outstanding requests; never copy a sandbox authorization
or prepared action into live. No silent fallback between environments.

Live invoice creation makes a real invoice and can consume real numbering or
occupy a terminal. Live settings changes affect real subsequent operations.
Never label these actions as harmless tests, auto-delete resulting records, or
promise transactional rollback of external effects.

Before each live mutation show the exact business, operation and affected fields
or invoice summary. Require an operation-bound confirmation with expiry, reviewed
payload digest, settings revision where applicable and server idempotency key.
Recheck current permissions and scope at commit; record actor/target, intent and
sanitized outcome durably. Couple audit and database mutation transactionally
where possible; reconcile pending/unknown outcomes instead of blindly retrying.
Do not store full requisites in audit. Settings writes use revision conflict checks.

Keep ordinary invoice authority, numbering, snapshot, expiry, terminal and ownership
invariants. Admin authorization must not simulate a customer JWT or weaken existing
RLS. Privileged scoped mutation routines require separate schema/security review.
Provider payments, mark-paid, cancellation, refunds, API keys, user management,
bulk export and notification dispatch are not granted by these two capabilities.
Review implicit side effects before enabling any operation.

Exit is always visible in both workspaces. It revokes support authority, aborts
browser requests, clears target context and returns to the administrator's own
Dashboard without logging out their SDK session. Exit cannot undo a committed
mutation; a sent request may finish server-side. Surface pending/unknown outcomes
with an operation ID and reconcile them. Logout, expiry and kill-switch also stop
support access; never advertise already-committed writes as cancelled by exit.

Delivery sequence remains read-only foundation -> sandbox -> separately reviewed
live-write pilot. Add tests for cross-environment replay, expired confirmation,
payload tampering, duplicate submissions, stale settings revisions, revoked role,
audit/commit failure and exit during an in-flight mutation. Verify actual durable
effects rather than only HTTP success.

Before touching locked invoice runtime, obtain explicit scenario scope for
`fixed`, `open_amount`, `table` and/or `delivery`, including the intended settings
changes. Account roles, remote migrations and deployment still need exact target
approval. Until then no live-write handler or database mutation is enabled.

## Local Implementation Checkpoint

User requested execution after this plan. The first independent local kernel is
implemented in `worker-rhnk-to/support-core.js`, with adapter requirements in
`worker-rhnk-to/SUPPORT_CORE_CONTRACT.md`. Nine synthetic support tests and fifteen
neighboring Dashboard/App/terminal tests pass (24 total). This does not change the
release status: the end-user service is not implemented or deployed.

Implemented: actor/target separation, AAL2/fresh-MFA contract checks, token-bounded
15-minute sessions, current role/ownership checks, audited opening/read/end contracts,
late-result fencing, correlated audit events and allowlisted summary output.
Unimplemented: verified identity adapter, transactional database/audit adapters,
HTTP security/rate limits/denial audit, customer diagnostics/reports, Dashboard UI,
role grants and isolated reproduction. Existing locks and remote targets are unchanged.

## Goal And Release Boundaries

Allow an authorized support administrator to inspect a customer's current Dashboard
context and diagnose configuration failures, then reproduce selected actions in an
isolated test environment. Never log in as the customer or change their password.

Initial administrator candidate: `4917dc24-e6d9-4870-b40d-a504504d4a5b`.
Existence, account status and MFA must be verified in the selected project before
any separate, approved role assignment. This document grants no permissions.

Release 1: server authorization, durable audit, read-only Dashboard support view,
configuration diagnostics and a sanitized incident report.
Release 2: isolated Dashboard/POS reproduction with ordinary test-user permissions.
Release 3: Merchant App reproduction and optional customer-submitted diagnostics.
Real customer writes, payment initiation, cancellations, refunds, credentials,
exports of customer datasets and authentication impersonation are out of scope.

## Current Evidence And Working Hypothesis

- Dashboard auth/session lifecycle is locked under `DASH-AUTH-001`.
- `src/lib/features/dashboard/api/dashboard-gateway.ts` uses Worker APIs and
  direct Supabase access; invoice creation has a direct RPC fallback. POS creation
  uses a separate Worker-only path. A Worker-only support flag cannot cover both.
- Registration requisites and invoice rules have separate persistence paths.
  Successful onboarding does not establish complete invoice configuration.
- Existing settings do not provide a historical configuration timeline. A current
  valid configuration cannot prove why an earlier request failed.
- Development domains can share production data and integrations. A different
  hostname alone is not a reproduction sandbox.

Hypothesis: a separate, allowlisted support read gateway can supply target-scoped
view data while preserving the administrator's SDK-owned session and preventing
customer writes. Discriminating check: attempted mutations, including direct RPC
fallbacks and Realtime setup, must never obtain customer credentials or reach a
customer write path; arbitrary target/resource substitutions must be denied.

## Identity And Authorization

Keep `actor_user_id`, `target_user_id`, `merchant_id`, environment and support
session identity separate in every request and audit event. The authenticated actor
comes from a verified bearer token, never a body field. Resolve target ownership
on the server; membership-based access requires a separate reviewed policy.

Use a server-managed support-role registry. No frontend UID allowlist as the
security boundary, no user-editable metadata, and no reliance solely on stale JWT
role claims. Role management is not exposed in the first UI release.

Require MFA at AAL2 and recent step-up authentication before opening a support
session. Verify token issuer/audience/signature/expiry, actual auth-session validity,
current role, session revocation and target ownership on every sensitive request.
Exact freshness interval and verification mechanism are implementation gates.

Support sessions last at most 15 minutes without silent renewal, are revocable,
and bind one actor, auth session, target, merchant and mode. A random session ID is
a lookup handle, not a standalone bearer credential. Target changes require a new
session and reason. Restrict to one active target per actor in release 1.

Use same-origin requests, strict origin checks for state-changing session operations,
bounded input schemas and rate limits. Return generic forbidden responses to
unauthorized callers without revealing whether a customer exists.

## Server And Storage Boundary

Proposed ownership: a dedicated `rhnk-to-support` Worker, reached through a private
service binding from the isolated rhnk.to Dashboard Worker. It has no public generic
proxy, arbitrary SQL endpoint, unrestricted RPC forwarding or user-supplied URL.
Worker creation and binding changes require a separate deployment approval.

Proposed private storage concepts, not approved SQL:

- Support roles: actor, enabled state, grants/revocations and responsible operator.
- Support sessions: actor/auth-session binding, target, merchant, reason, mode,
  creation/expiry/revocation and correlation ID.
- Support audit events: unique event ID, session, actor, target, action, resource
  identifiers, authorization outcome, time and sanitized result/error code.
- Incident reports: reproduction steps, expected/actual behavior, versions,
  configuration revision and sanitized diagnostics; no raw request bodies.

Prefer private-schema, narrowly scoped database routines with explicit actor,
session and target checks. Keep cross-tenant read authority separate from ordinary
customer RLS; never broaden customer table policies to make support work. Evaluate
SECURITY INVOKER first. Any unavoidable privileged routine needs explicit review,
fixed search_path, restricted EXECUTE and no dynamic SQL or caller-chosen relations.
No privileged database secret is ever available to the browser.

Store durable audit in the selected database, not only Worker console logs.
Authorize and record access before releasing customer data. If audit persistence
fails, fail closed for support access; ordinary customer traffic is unaffected.
Record completion separately and distinguish interrupted/pending reads from success.
Application roles cannot update/delete audit events. This is not a claim of
cryptographic immutability against database administrators.

Review retention and access before launch; proposed defaults are 90 days for audit
and 30 days for incident reports, subject to privacy requirements and approval.
No external audit delivery, Axiom datasets, token or logging SDK is needed.

## Proposed API Contract

All endpoints below are proposals under `/dashboard/api/support`:

| Endpoint | Purpose | Required restriction |
| --- | --- | --- |
| GET /capabilities | Own support eligibility | No customer data |
| POST /targets/resolve | Resolve exact customer UID and eligible businesses | Authorized MFA actor; audited; no bulk directory |
| POST /sessions | Open target-bound read-only session with reason | Fresh MFA, current role, ownership, durable audit |
| GET /sessions/:id | Read own active context/expiry | Actor and auth-session match |
| POST /sessions/:id/end | Revoke own support session | Idempotent; no customer auth logout |
| GET /sessions/:id/overview | Minimal business/entity/terminal summaries | Server-owned field allowlist and pagination |
| GET /sessions/:id/diagnostics | Configuration and current-state findings | Read-only; no invoice creation RPC |
| POST /sessions/:id/reports | Save bounded sanitized incident report | Support metadata only; never customer mutation |

Allow operations by semantic capability, not HTTP verb alone: opening sessions and
recording reports legitimately use POST. There is no support endpoint for creating
invoices, saving settings, marking paid, cancelling or invoking arbitrary RPCs.
Revoke the initial role via an approved operator procedure; active requests must
fail on their next authorization check after revocation.

## Dashboard Experience

Entry: proposed `/dashboard/support`, visible only after server capability checks.
An unauthorized direct URL must fail at the server, not merely hide navigation.

Workflow: exact UID -> eligible business -> mandatory reason -> MFA confirmation
if needed -> start session -> read-only view -> diagnostics/report -> exit.
Always show target business, read-only state, remaining time and an exit action.
Unsupported sections remain unavailable; never silently fall back to actor data.

Use an explicit support gateway/context rather than replacing the normal Supabase
client or its token. Reuse only components whose reads and effects are audited.
First map each included component's direct client/RPC calls and automatic writes.
Exclude developer credentials, API keys, integrations and team administration.

No customer Realtime subscriptions in release 1. Use manual refresh through the
authorized support gateway. Show snapshot time so stale data is not mistaken for
live state. Realtime support requires a later separate authorization design.

Key in-memory caches by actor, support session, target, merchant and environment.
Do not persist customer snapshots in localStorage, service-worker caches or CDN
caches; use `Cache-Control: no-store`. Abort in-flight requests and discard late
responses on exit, expiry, role revocation, auth logout or context change. Clear
support state/drafts and return to the administrator's normal Dashboard context.
Use cross-tab invalidation plus server checks; a browser signal is not authorization.

## Diagnostics And Privacy

Check onboarding completion, merchant/entity activity and ownership, presence of
invoice rules, payment mode, seller match, VAT selection, purpose-template presence,
settings revision, terminal assignment and current invoice status/expiry when scoped.
Return stable codes with `pass`, `fail` or `unknown`, timestamp and evidence source.
Do not present partial format checks as full invoice-RPC validation.

Mask bank/tax/contact values by default. Prefer `iban_valid`, `tax_id_valid`,
`recipient_present` and rule codes over raw values. Never collect JWTs, cookies,
passwords, API keys, payment payloads or unrestricted database error text. Limit
reason/report lengths, redact secrets and prevent log-injection characters.

Reports record request ID, actor/target/session, application and Worker versions,
schema version when verified, configuration revision, selected operation and
sanitized error. Existing errors without stored correlation/config history remain
historical unknowns. Client browser state, extensions and network conditions cannot
be reconstructed from server data alone. Optional customer diagnostic submission
needs explicit consent and a later bounded collection design; no session replay.

## Isolated Reproduction

Provision a dedicated local stack or explicitly approved development project with
matching relevant schema/RPC versions. Never use a shared production-backed domain
as the test boundary. Inspect missing baseline migrations and schema drift first.

Start with synthetic fixtures. For a specific incident, copy only separately
approved, minimized and masked configuration; remap ownership to a dedicated test
user. Do not copy auth users, sessions, real orders/payments, secrets or Storage
objects. Record source configuration revision and fixture transformations.

Use normal user JWT/RLS/API paths, never an admin bypass as evidence of parity.
Disable or stub payment providers, webhooks, messaging, bank handoffs and public
payment URLs; add explicit egress restrictions. Use separate storage/queues and
short-lived test data. Fail setup if isolation cannot be demonstrated.

Exercise Dashboard creation and POS independently, then Merchant App separately.
Each locked scenario (`fixed`, `open_amount`, `table`, `delivery`) requires named
approval before affected runtime changes or integration. Existing delivery blockers
remain visible; do not describe delivery as production-ready.

## Implementation Stages And Acceptance

1. Boundary inventory and contract tests. Enumerate the included Dashboard reads,
   direct RPC fallbacks and side effects; define DTOs, capabilities and errors.
   Acceptance: support cannot call customer mutations even through hidden effects.
2. Local authorization/audit backend. Build role/session checks, expiry/revocation,
   narrow read functions and append-only application audit with synthetic users.
   Acceptance: non-admin, AAL1, expired/revoked session, forged actor/target/resource,
   second-admin session reuse and missing audit all deny access.
3. Local read-only UI. Add support route, target/reason selection, banner, expiry,
   context fencing and safe gateway. Acceptance: no writes/network fallbacks or
   cross-target data leaks; refresh/logout/back/multiple tabs behave correctly.
4. Diagnostics and reports. Add configuration checks and bounded report storage.
   Acceptance: missing rules and valid current rules are distinguished; historical
   uncertainty is explicit; logs/reports contain no secrets or full requisites.
5. Security and parity gate. Run focused unit/Worker tests, local DB grants/RLS
   tests and browser tests. Exercise audit failure, role revocation during a read,
   late responses, cached assets/data, UUID tampering and unsupported sections.
   Run lint, check, unit, e2e and build before requesting release approval.
6. Approved read-only pilot. Review exact migration diff and remote target, apply
   approved migration, assign the verified initial role, deploy isolated Workers,
   then test using an approved customer UID without any business mutation.
   Acceptance: authorized read/audit works; unauthorized access fails; ordinary
   Dashboard/POS/App and existing domains retain their behavior.
7. Reproduction environment. Add synthetic fixtures and ordinary-user flows with
   egress disabled. Expand Dashboard/POS and App separately, with named scenario
   approvals and acceptance evidence for each. Production write mode is not added.

## Approval And Compatibility Gates

- `DASH-AUTH-001`: approval needed for the separate actor/target support context,
  MFA and capability/session checks in DashboardPage, gateway and auth integration.
  Preserve SDK persistence/refresh and ordinary sign-in/out behavior. Main risk:
  stale authority or confused identities; verify refresh, revocation and logout.
- `DASH-SHELL-001` and `DASH-STRUCTURE-001`: review their exact records before
  navigation/route edits; approval limited to support entry/banner and context exit.
- `CROSS-APP-INVOICE-SCENARIOS-001`: no current unlock. No amounts, statuses,
  lifetimes, payment rules or creation/cancellation behavior changes in release 1.
  Reused invoice/POS components need explicit approval if indirect effects exist.
- Current business data target is shared DAC7 `mwaeazabpvbxqfrceogr`.
  No migration or role assignment to it is authorized by this plan.
- Deferred rhnk_main `mvytjhaujcewqfyivwxf` is a separate target. Inventory tables,
  columns, relationships, constraints, indexes, views, RPCs, triggers, grants/RLS,
  Storage policies and Realtime publications for relevant dependencies before
  migration work. Report its prepared/applied/verified status independently; no
  fallback to DAC7 and no automatic propagation between environments.
- Before remote writes: verify target identity, migration history/drift, local or
  dedicated-branch results, exact SQL and approved role grant. After approval:
  verify security advisors, tenant/anonymous tests and regenerate affected types.
- Deploy only with separate exact rhnk.to scope approval. Root build plus matching
  dry-run is required for Dashboard. Never use the all-products release script.
  Smoke `/`, `/dashboard`, `/app`, `/conf/`, `/pay`, `/pay/`, `/corex` and expected
  assets; disclose existing failures instead of silently fixing other products.

## Rollback And Handoff

Keep a server-side kill switch that stops new and existing support access without
affecting normal customer authentication. Revoke support sessions/roles, remove
the entry capability, and revert only this release's Worker versions if necessary.
Retain audit records; do not drop tables, reset databases or revert customer data.

Next executable slice after scoped approval: local authorization/audit backend and
negative tests with synthetic users, followed by the read-only gateway. No remote
grant, customer session, Axiom key or production deployment is needed for this slice.

Completion reports must separate planned, implemented locally, tested, migrated,
granted and deployed work. This document is only the first of those states.