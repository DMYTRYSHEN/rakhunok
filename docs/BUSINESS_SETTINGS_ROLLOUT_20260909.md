# Business settings — authorized rollout evidence recorded 2026-09-09

This page records the supplied evidence for the separately authorized rollout following the
2026-09-08 local checkpoints. It is not a new deployment instruction or a claim of completed
production acceptance. This documentation update performs no remote operations and no Git commit/push.

## Authorized database installation

| Item | Recorded evidence |
| --- | --- |
| Project | DAC7 — `mwaeazabpvbxqfrceogr` |
| Migration | `business_settings_drafts_v2_isolated` |
| Migration version | `20260908215439` |
| Exact SQL SHA-256 | `be063e216e315d7e9f43823ff5671dde0d49d6cb130d8e44e91b73203bb8e734` |
| Result | Two new tables; both empty after rollback verification |
| Access boundary | Forced RLS; authenticated-only client RPC execution; no direct browser table access |
| Operative isolation | Zero operative foreign keys and zero custom triggers; only the internal settings FK remains |

The reviewed [SQL source](../supabase/candidates/business-settings.sql) remains outside the automatic
migration directory. This approval did not authorize applying unrelated checkout migrations.

Rollback-only authenticated SQL read/save/CAS smoke passed: revision **1 → 2**, with a stale save
rejected by SQLSTATE **40001**. The transaction was rolled back and both new tables remained empty.
This was SQL-level authenticated-role testing, **not** an authenticated browser save using a real JWT.

## Authorization and recovery limits remain unchanged

- READ COMMITTED ownership checks use a fresh authorization snapshot after draft-lock waits.
  This is **not commit-time revocation**: an uncommitted or later transfer/deletion can coexist
  with a successful in-flight RPC; subsequent calls recheck and fail closed.
- No operative row locks, operative writes, operative FK cascades or custom triggers were added.
  Draft-parent/index locking supplies settings CAS; the internal settings FK is not an operative FK.
- Deleted/transferred references invalidate the whole aggregate, even when omitted from a save
  with correct CAS. Orphan draft tuples/revisions are retained without pruning or automatic repair.
  Manual administrative recovery requires a separately authorized procedure; no recovery UI or
  completed recovery certification is claimed. Transfer-away-and-back and UUID reuse are not tracked.
- Saved settings remain non-operative drafts: no payment/provider activation, invoice/QR payload
  integration, recipient replacement or terminal TTL change follows from this rollout.

See the [persistence contract](BUSINESS_SETTINGS_PERSISTENCE.md) and
[process registry](DASHBOARD_PROCESS_REGISTRY.md) for the full boundaries.

## Validation evidence

| Check | Result and boundary |
| --- | --- |
| Full normal root build | **PASS**, after separately authorized stop of local Wrangler on port 8787 |
| Full isolated Dashboard build | **PASS**, full route graph rather than a partial build |
| Targeted isolated tests | **13 passed** |
| Worker tests | **221 passed** |
| Local Chromium asset smoke | **111** generated asset responses under `/dashboard/_app/`; no errors |
| Root unit suite | **424 passed** |
| PGlite settings suite | **204 passed**; not real concurrency proof |
| Real PostgreSQL settings suite | **249 passed** |
| Remote rollback-only SQL smoke | Authenticated read/save/CAS passed; 1 → 2, stale `40001`; no retained rows |

These are recorded results from the rollout and preceding validation, not tests rerun by this
documentation-only update. The earlier Windows EBUSY build failure remains a historical checkpoint;
it is superseded by the successful full normal root build, not erased.

## Exact deployment scope

- **Only deployed Worker:** `letsrealtalk-dashboard`.
- **Version:** `d098d3b5-ee9f-4ee2-9a8b-6a2cae62f390`.
- **Route:** `letsrealtalk.com/dashboard*`.
- **Generated assets:** `/dashboard/_app/`.
- **Test landing:** unchanged.
- **Shared API:** binding remains `rahunok`; `rahunok` was **not deployed**.
- No root/Landing, Corex, Pay, Conf or `rakhunok.com` Worker deployment is included.
- No Git commit or push.

Full graph compilation does not expand route ownership. The test hostname still uses a shared
backend and must not be treated as a sandbox for authenticated mutations. See the
[isolated deployment runbook](DASHBOARD_ISOLATED_DEPLOYMENT.md).

## Post-deployment smoke

- All seven checked production paths (`/`, `/dashboard`, `/app`, `/conf/`, `/pay`,
  `/pay/`, `/corex`) returned HTTP 200 and identical SHA-256 HTML hashes before/after.
- Production route IDs/patterns/Worker targets are unchanged. Production web/dashboard/
  checkout and shared `rahunok` deployment versions remain unchanged.
- On the test domain only Dashboard HTML changed; the other six checked paths retained
  their hashes. Fresh Chromium loaded structure/invoice-rules/payment-methods in demo
  mode with zero page errors or failed namespaced assets. API/external traffic was blocked.
- This is route/rendering evidence, not certification of live payment workflows.

## Pending acceptance — do not report as passed

1. Production smoke above passed within its stated read-only scope; live payments were not tested.
2. **Authenticated real-JWT browser save is NOT tested.** SQL role/claim smoke and local asset
   hydration do not establish browser Auth, token transport, RPC integration or save/reload success.
3. Snapshot authorization and orphan/manual recovery limits remain accepted limitations, not fixed
   by deployment. Further recovery operations, schema changes and deployments need separate approval.