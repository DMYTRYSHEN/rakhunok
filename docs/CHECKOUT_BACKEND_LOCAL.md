# Checkout authority — local verification report

**Local synthetic implementation only. No remote migration or deployment.
Production checkout is NOT certified ready.**

## Remediated locally

- Optional Order.description; strict contract, resource/order revisions, persisted
  terminal pointers, beneficiary validation, immutable quotes and fenced outbox.
- Demonstrated legacy row-first/gate deadlock mitigated by fail-fast advisory lock
  and bounded whole-transaction retry for explicit PostgreSQL rollback codes.
  Ambiguous network errors are not retried. Capability changes use the same gate.
- Local access migration removes browser table/column grants, including projects
  parent cascade paths. Atomic item replacement checks owner, revision, minor units
  and rolls back malformed batches. Canonical reference SQL remains untouched.
- Attempt-bound settlement ledger validates amount/currency/IBAN with NULL-safe
  comparisons; identity-conflicting replay is rejected; changed/late/already-paid
  invoices enter review. Raw-body/path/timestamp HMAC verification helper added.
- Separate synthetic Svelte harness uses actual HTTP reads, PostgreSQL change hints,
  authoritative rereads and polling. No legacy store, BankSheet or real bank action.
  Explicit dev build flag/exact loopback origin; invalid bootstrap/reload fails
  closed. Production build excludes LocalCheckout chunks.
- Synthetic amount mutation requires expected order revision (If-Match); replay
  of the same revision returns 409 without a second increment.

## Verification evidence

- **83 isolated tests passed**, zero failed/skipped: backend/financial/HTTP,
  retry/signature, schema/contract and synchronization tests.
- **10 real PostgreSQL tests passed separately**, zero failed/skipped, on fresh
  PostgreSQL 17.11 after final SQL changes: gate exclusion, same-key initiation,
  exclusive outbox claims, row-first rollback, capability revocation, browser-role
  grant closure including project deletion, atomic items/rollback, settlement
  idempotency/conflicts, changed-invoice review, incomplete quote rejection.
- Strict Worker TypeScript including settlement helper passed.
- Pay svelte-check: **0 errors, 0 warnings**; Svelte autofixer: no issues.
- Isolated Pay Vite production build passed; no LocalCheckout chunks.
- Isolated Wrangler dry-run: **16.15 KiB / 4.90 KiB gzip**, only CHECKOUT_MODE=local.
  Nothing deployed; shared deployment assets were not overwritten.
- git diff --check passed with LF/CRLF notices only.
- Browser authoritative amount 123.45 → 124.45 UAH; duplicate expected-revision
  requests returned **200, 409**. Reload without bootstrap disabled controls with
  no remote/legacy API requests. Earlier blocked-stream polling recovery observed
  at 2.036 seconds; 109 ms streamed update was one local sample, not an SLA.

### Controlled browser follow-up (2026-09-08)

The operator confirmed additional manual button clicks during the earlier tests.
A fresh database and browser click/fetch instrumentation, without operator input,
showed: 20 seconds idle at 123.45 UAH with zero clicks/mutation requests; one
automated click produced exactly one mutation request and 124.45 UAH; another
31 seconds remained at 124.45 UAH with no additional requests. PostgreSQL confirmed
exactly one new order revision (1 → 2) and one new invoice outbox event.
The earlier extra increments are consistent with the confirmed manual input;
spontaneous/repeated mutations were not reproduced. This specific suspicion is
closed, not a certification of all browser/payment scenarios. No real money involved.

Streams intentionally end every ten seconds and reconnect with authorization.
Each matching hint is reauthorized before forwarding, but revocation can race
already-in-flight delivery. Hints never authorize payment or replace authoritative
state. Local LISTEN/NOTIFY is not durable distributed delivery; polling recovers.

## Remaining launch gates

### Normal Pay hardening follow-up (2026-09-08)

- Removed direct Supabase order fallback and API-error-to-client-QR payment fallback.
  Reads/initiation use no-store, redirect:error and bounded timeouts. Invalid or
  rejected initiation and unsafe primary/secondary URLs cannot open a bank.
- Removed bank-specific synthetic success timer, cached-order payment authority,
  placeholder beneficiary injection, unused client QR derivation and fabricated
  fiscal receipts. Receipt UI requires an actual supplied receipt.
- Demo fixtures require local DEV and cannot initiate payment or replace a failed
  real invoice. Payment context is checked after CAPTCHA and initiation; stale
  identity/amount/navigation cannot open a bank. Polls are session-fenced and
  single-flight; old responses/timeouts cannot confirm a newer invoice.
- Current full Pay suite: **134 passed, zero failed/skipped**, including 26 compiled
  store regressions with mocked browser/network IO. Svelte check: **0 errors,
  0 warnings**. Isolated production build passed (187 modules). These tests do not
  replace real-browser reactivity or provider end-to-end validation.
- Expanded real PostgreSQL suite: **21 passed, zero failed/skipped**, on fresh
  checkout_test_launch_hardening_0908. Added timing/status/amount/currency/recipient
  rejection and cross-session duplicate/conflicting settlement tests. No new SQL
  changes were required. Prior 83-test backend evidence above is historical,
  not an additional newly rerun suite or a production certification.
- Svelte autofixer found no payment/polling issues; StatusScreen retains two
  unrelated unkeyed-loop recommendations. No remote operations performed.

### Local bank webhook emulator (2026-09-08)

Explicit user approval added synthetic bank delivery, not actual bank integration.
Set CHECKOUT_LOCAL_BANK_SIMULATOR=1 for the local server only. The Node-only router
is not imported into production Worker or Pay bundles. It uses a private random
server signing key and fixed loopback destination, never browser-supplied money,
recipient, provider or destination. Session bootstrap does not expose this key.

- Browser now follows the invoice capability, not the terminal pointer that becomes
  idle after payment. Separate buttons create a revision-bound immutable attempt
  and deliver/repeat its signed webhook. Ambiguous attempt retries retain the same
  idempotency key and binding. Delivery receipts never set the UI paid state.
- POST /__local/bank/deliver requires bootstrap plus scoped capability and current
  access. It constructs an event from the stored quote, preserves PostgreSQL
  timestamp precision, signs the raw body, and sends actual loopback HTTP to
  POST /__local/bank/webhook. The ingress verifies HMAC/body/path/timestamp before
  transactional checkout_record_settlement, with provider fixed to local-bank.
- Same-process retry retains event bytes, refreshing only signature timestamp.
  This in-memory emulator queue is not a production durable provider outbox and
  does not promise restart recovery. Refunds/reversals remain out of scope.
- The amount test endpoint now rejects changes after paid, on the server as well
  as in UI. Shared accepted-quote decoder validates both browser and Worker.

Fresh verification: **155 Pay tests**, **16 selected backend/signature/HTTP tests**,
and **5 real-PG/actual-loopback integration tests** passed, zero failed/skipped in
their explicit runs. The integration suite skips without the disposable local DB
environment. Pay check 0 errors/0 warnings; strict Worker TypeScript and isolated
production build (187 modules, no LocalCheckout chunk) passed.

Browser test on checkout_test_bank_webhook_0908 demonstrated 123.45 UAH payable →
attempt → signed delivery → authoritative paid at revision 2. Retry returned
replayed=true. PostgreSQL confirmed exactly one attempt, one settlement,
paid_amount=123.45, and one invoice event per revision 1/2. Browser automation
needed an in-memory visibility override because the integrated page reported
document.hidden=true, plus synthetic click dispatch; no source visibility guard
was disabled. This is not a normal visible-browser interaction certification.

Reproducible integration: supply a fresh checkout_test_* database through
CHECKOUT_TEST_DATABASE_URL and run local-bank-postgres.test.mjs using Node test.
It provisions locally and closes its ephemeral HTTP server/PG pool. Verified
review for a changed quote, replay without extra revisions/outbox, and signed-body
tampering rejection without any DB write. Current interactive harness remains at
127.0.0.1:8792 with paid synthetic data; reload without bootstrap fails closed.

### Ordinary fixed-invoice Pay slice (2026-09-08)

The local root now renders FixedInvoiceCheckout using InvoiceFrame, the same
store-free invoice presentation used by ordinary OrderScenario. The diagnostic
harness remains at /diagnostics. This is an isolated integration of the ordinary
fixed-invoice UI, not a switch of production Pay to the new backend.

- fixed-checkout adapts session bootstrap, scoped invoice reads, revision-bound
  attempts and explicit emulator delivery. It imports no legacy store/BankSheet.
  Offline/hidden/disposed/revoked sessions cannot start new payments; uncertain
  attempt retries retain their original key and revision binding.
- Opening the native confirmation dialog creates nothing. Creating an attempt
  does not deliver a webhook or mark paid. Only a later authoritative snapshot
  establishes paid; even a successful delivery receipt is not UI authority.
- Amount, summary and confirmation agree in minor units. Recipient details come
  only from the accepted immutable quote. Tips, promo, split, BNPL and actual bank
  controls are absent from this slice. Refresh is explicit; recovery uses polling,
  not the diagnostic SSE stream. This is not an instantaneous-update SLA.
- Local CSP and exact origin guards restrict traffic to loopback. Vite 8's dev
  socket uses server.ws attached to the same HTTP server on 8792; it cannot fall
  back to localhost:5174. No local lifecycle/emulator code enters production assets.

Fresh final verification: **170 Pay tests** and **16 selected backend/signature/HTTP
tests passed**, zero failed/skipped; Svelte check **0 errors, 0 warnings**. Isolated
production build passed (**188 modules**); scanning emitted JavaScript found no
FixedInvoiceCheckout, createFixedCheckout or local bank delivery endpoint.
git diff --check passed (line-ending notices only).

**One complete real-browser E2E passed**, zero skipped, on fresh disposable
checkout_test_fixed_pay_diagnostic_0908 with real PostgreSQL and actual signed
loopback HTTP delivery. Installed headless Chromium reported document.hidden=false;
real Playwright clicks opened a native modal. No visibility override or synthetic
event dispatch was used. Assertions verified:

1. 123.45 UAH / payable revision 1, with no opening/dialog mutations.
2. Exactly one attempt POST and one persisted immutable attempt; still payable,
   zero settlements after a naturally scheduled poll, no automatic webhook.
3. Explicit delivery followed by polling paid revision 2, paid_amount=123.45,
   exactly one settlement ledger entry linked to the original attempt.
4. Replay returned true and preserved every selected order/resource/outbox/
   attempt/settlement row, including revisions.
5. A new context without bootstrap and its reload failed closed, displayed no
   financial amount and made no authority/session/bank requests.
6. Exactly one payment-document navigation and one session POST; zero external,
   forbidden legacy/SSE requests, browser/HTTP errors or collected body failures.

The browser test now collects JSON immediately and records navigation, request
failure, HMR-type and phase diagnostics. Earlier CDP missing-body errors alone did
not prove navigation: Playwright adds generic "navigated away" advice. The historical
cause remains unproven; the instrumented clean run passed without suppressing body
failures or retrying mutation POSTs. Earlier Vite nonorigin fallback was separately
observed and removed by binding its socket to the local server.

Reproduction: start local-server.mjs on a NEW empty checkout_test_fixed_pay_* DB
with CHECKOUT_LOCAL_BANK_SIMULATOR=1, obtain the bootstrap using its terminal open
command, then run fixed-pay-browser.test.mjs with CHECKOUT_FIXED_BROWSER_URL and
the same CHECKOUT_TEST_DATABASE_URL. The test itself does not provision/reset the
database and refuses an already-used fixture. Optional
CHECKOUT_FIXED_BROWSER_SCREENSHOT=1 saves a local screenshot under worker/.wrangler.
The current server fixture is paid; a new full run requires a fresh database.

The prior 21-test concurrency and 5-test real-PG webhook suites are historical
evidence from the preceding phase, not newly rerun totals. This fixed slice adds
visible-browser coverage but does not certify all ordinary Pay scenarios.

### Cache-first fixed Pay activation (2026-09-08)

Implemented only in the local synthetic fixed-invoice slice, not deployed Pay.
Initial session bootstrap now requests POST /__local/preview. The Node server
holds one immutable projection for a non-sliding 30-second TTL; this is not
Cloudflare Cache API/KV. Every preview, including a hit, performs a current SQL
capability/expiry/revocation/resource access check. A miss also reads authority.
Thus cache reduces repeated projection reads, not all initial DB access. HTTP
responses remain private/no-store; credentials and authorization decisions are
not cached. No SQL migration was added.

- Preview is source=cache, canInitiate=false, even when its state is paid. Neither
  cache nor stale previously authoritative state displays current paid confirmation.
- Before “Перейти до оплати”: no authoritative GET polling, including after
  visibility/online changes or manual refresh calls. Preview itself is a one-off
  authorized request, not a polling loop.
- CTA opens confirmation and forces a fresh authoritative read. The user separately
  confirms the displayed amount. Attempt creation performs another revision-bound
  preflight and retains the atomic SQL revision/amount/status/recipient checks.
- Closing before an attempt cancels polling and in-flight reads. Reopening forces
  a new read. Generation fencing prevents an old cancelled preflight from sending
  a POST in the reopened phase. An uncertain POST preserves its original binding
  and recovery polling; it is not silently replaced or cancelled.
- Polling runs during the activated payment session, pauses offline/hidden, and
  stops on disposal/revocation. The local emulator retains polling after an accepted
  attempt (including paid) until disposal so its explicit replay diagnostics remain
  available; terminal-state automatic shutdown is not implemented in this slice.
- Bounded JSON reading now releases its reader lock in finally on success/error,
  retains the 65,536-byte limit and cancels oversized bodies only.

Final verification: **207 Pay tests**, **31 selected backend/preview/HTTP tests**,
zero failed/skipped. Svelte check **0 errors/0 warnings**, official autofixer no
issues. Isolated production build **188 modules**, with no local lifecycle,
preview route or emulator delivery endpoint in emitted JS; shared deploy assets
were not overwritten.

Final real Chromium E2E **1 passed**, on checkout_test_fixed_pay_cache_final_0908:
6.5-second idle preview and closed-dialog windows each had no authority/attempt
requests; reopening revalidated; one explicit attempt and webhook settled 123.45
UAH at revision 2; replay preserved one ledger entry. A second context received
cached paid but no paid confirmation or authority polling. Missing-bootstrap
reload failed closed. No external/legacy/SSE/browser errors or body-capture
failures occurred in this final run. No visibility overrides or synthetic clicks.

Earlier runs in this phase failed CDP body collection despite app DOM already
showing live authority and no observed AbortController call, visibility change,
or navigation. Removing local request interception alone did not eliminate this.
The final run passed after reader-lock cleanup, but a causal Chromium/GC diagnosis
is not proven. Failures remain visible in test diagnostics; no mutation POST was
retried to compensate for missing CDP data. Fresh/unused fixtures were used.

### Remaining external and rollout gates

1. **Real provider integration:** immutable attempt-bound handoff, provider sandbox
   contract/credentials, verified callback ingress, reconciliation, late/duplicate/
   refund handling and end-to-end tests. Quote/HMAC helper/NBU link is not bank
  settlement. A local-only emulator ingress exists now; no public provider
  settlement route or actual bank adapter was installed.
2. **Compatible access rollout:** audit full historical target schema, grants,
   memberships, SECURITY DEFINER RPCs/cascades; provide trusted tenant-safe merchant
   commands and capability issuance before revoking old access. Local hardening
   deliberately breaks legacy direct table access; fixture is not full production.
3. **Complete Pay migration/UI sign-off:** unsafe legacy fallbacks are now removed.
  The local fixed-invoice slice uses revision-bound authority with shared ordinary
  UI, but deployed/non-harness Pay still uses the legacy endpoint. Trusted
  capability issuance, other scenarios, full provider/browser regression coverage
  and compatibility sign-off remain. Local bootstrap is not a production issuer.
4. **Operational concurrency/realtime:** retry all legacy callers, broaden expiry/
   settlement/revocation/cascade races, address coarse global gate throughput,
   authenticated distributed push, bounded expiry sweeps, monitoring/dead letters,
   load and latency budgets. Existing mutable production caches were not purged.
5. **Separate remote approval:** letsrealtalk.com may share production API/KV and is
   not inherently isolated. rakhunok.com production is explicitly out of scope.

## Local reproduction boundaries

- Portable PostgreSQL: D:/svetle/.tools/postgres-local; verified listener
  **127.0.0.1:55439**, disposable trust-auth cluster only. Never expose publicly.
- run-postgres-tests.mjs provisions a NEW empty checkout_test_* database from
  canonical sibling base schema (read-only) plus three local migrations.
  CHECKOUT_TEST_DATABASE_URL requires literal loopback; URL overrides forbidden.
  Existing schema fails closed. Immutable synthetic receipts remain disposable.
- local-server.mjs needs another fresh database and binds 127.0.0.1:8792.
  Operator terminal command open supplies reusable bootstrap fragment, not a
  one-time production issuer. Random scoped bearers stay in browser memory and
  expire after an hour. No production data/credentials are used.
- wrangler.checkout-local.jsonc is a separate local PostgREST/Supabase adapter,
  requiring explicit local DB/service configuration, no remote defaults/bindings.
- Do not run broad legacy Worker tests against shared services or treat normal
  Pay dev entry as a synthetic-data isolation boundary.

No actual bank payment, remote SQL, production-data mutation or deployment was
performed by this remediation work. The preceding fixed-Pay slice was committed
and pushed with user approval; this cache-first follow-up remains local/uncommitted.