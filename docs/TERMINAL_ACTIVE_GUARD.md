# Original checkout terminal active-only guard — local, 2026-09-09

## Authorized test deployment

Deployed `letsrealtalk-checkout` version `4d0ad213-a3f2-40c1-82b3-1ef90a88c953`.
Transferred only the existing test `/tag/*` route from the isolated presentation Worker
to this original checkout. Retained `/api/v1/checkout/terminal/*` on
`letsrealtalk-terminal-read` for authoritative reads. No SQL or production deployment.
Live Chromium confirmed terminal API 200, original preparing screen with merchant details,
theme and back controls, and no JavaScript page errors. No real payment attempted.
The local-only statements below describe validation before this authorized deployment.

- `/tag/:code` alone uses the existing same-origin GET `/api/v1/checkout/terminal/:code` with `no-store`. The isolated API implementation and all route configurations remain untouched.
- Active selection loads the trusted original detail contract by canonical UUID, verifies ID/status/total/currency/expiry, reconfirms selection, and hydrates the original checkout store (including items and upsells).
- Idle uses original TableScenario waiting; errors clear invoice/payment state and use original StateScreen. Preparing and zero-value orders cannot initiate payment.
- Single-flight polling every two seconds; one-second expiry revocation; lifecycle/read fencing; original table realtime and legacy status polling disabled only in terminal mode.
- Payment captures the displayed UUID, runs the existing captcha, rechecks authoritative selection immediately before the unchanged initiate call, and rejects rollover/amount/status/expiry changes. Poll rollover also fences a pending bank response.
- Tag HTML skips all alias KV reads/writes and order injection and returns `Cache-Control: no-store`. Normal `/pay` hydration and payment behavior are unchanged.
- App and TableScenario markup/styles compared exactly with HEAD by the browser test. No new UI; no original scenario files removed.

## Local validation

- Pay suite: 220 passing tests (compiled real store, including terminal regressions).
- Checkout Worker suite: 11 passing tests.
- Svelte check: zero errors/warnings.
- Original production-mode checkout build: 189 modules, isolated `apps/pay/.active-guard-dist`; no sync to existing dist/build.
- Chromium: original waiting/active/split/error/recovery/rollover/preparing; no legacy realtime; exact markup/style preservation.
- Browser test: `node --test worker/src/terminal-active-guard-browser.test.mjs` (requires the isolated build).

## Boundaries

No deployment, route changes, SQL, secret access, commit or push. Only two read-only LIVE GETs were used to confirm existing response fields. All automated mutation/payment tests use local mocks.

This guards terminal selection, not atomic server-side compare-and-swap: a rollover after the final GET still requires backend enforcement to be atomic. It does not invent detail revisions or certify item-level freshness beyond the trusted legacy detail contract. Terminal idle is not proof of payment; no synthetic success is shown. Existing waiter/demo functionality and all 19 scenarios were not reimplemented or individually end-to-end certified in this narrow change.