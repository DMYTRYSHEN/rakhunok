# Business settings persistence — authorized isolated rollout

## Current state — rollout evidence recorded 2026-09-09

The separately authorized DAC7 migration and Dashboard-only deployment have completed.
Production smoke in the main session is **ongoing**, not passed. An authenticated browser save
with a real JWT has **not been tested**; authenticated SQL smoke is not equivalent.
See [dated rollout evidence](BUSINESS_SETTINGS_ROLLOUT_20260909.md) for exact identifiers,
validation boundaries and outstanding checks. Earlier local-only records below are historical.

The three settings views use one repository. Demo uses the existing scoped localStorage draft.
Account mode calls the existing authenticated Supabase browser singleton through two RPCs:
`read_business_settings(merchant_id)` and `save_business_settings(merchant_id, expected_revision, document)`
(actual SQL argument names are prefixed `p_`). Missing schema, authorization and connection failures
are explicit errors, never silent local fallback. Old local drafts are retained but not imported.

The reviewed SQL source remains outside the automatic migration directory. It was installed in
DAC7 (`mwaeazabpvbxqfrceogr`) as `business_settings_drafts_v2_isolated`, version `20260908215439`.
Exact SQL SHA-256: `be063e216e315d7e9f43823ff5671dde0d49d6cb130d8e44e91b73203bb8e734`.
Both new tables were verified empty after rollback-only authenticated read/save/CAS smoke:
revision 1 → 2 succeeded and stale revision failed with SQLSTATE `40001`.
RLS is forced; client RPC execution is authenticated-only. There are zero operative foreign
keys and zero custom triggers. This does not certify a real-JWT browser workflow.

Only `letsrealtalk-dashboard` was deployed, version `d098d3b5-ee9f-4ee2-9a8b-6a2cae62f390`,
on `letsrealtalk.com/dashboard*`, with generated assets under `/dashboard/_app/`.
Test landing is unchanged; shared API `rahunok` was not deployed. No commit or push.

## Integrity and boundaries

- One version-2 document per merchant, normalized into new parent/seller tables. All changes save
  in one transaction using a server-owned revision; stale saves fail with SQLSTATE 40001.
- RPC validates authenticated merchant ownership and every entity's owner. Same owner is the
  existing relationship: this does not introduce or prove multi-brand membership.
- RLS is enabled/forced with no direct browser policies or table grants. Hardened definer functions
  use an empty search path; trusted BYPASSRLS installer ownership is required and must be audited.
- Ownership transfer invalidates access to the aggregate; explicit administrative recovery remains
  future work. No new owner inherits the former owner's configuration.
- Safety remediation removes **all foreign keys to operative merchants/entities** and the cascade
  revision trigger. The only remaining FK is seller-settings → settings-parent (internal cascade).
  Operative deletion leaves every draft tuple and revision unchanged, including exhausted revisions.
- Deleted/transferred references invalidate the **whole** aggregate (42501). Even an explicit save
  with correct CAS that omits the bad reference is rejected. No pruning or automatic repair exists;
  retained inaccessible drafts require a separately authorized administrative recovery procedure.
- Read/save lock only draft parents (SHARE/UPDATE); first saves serialize through the draft unique
  index with speculative INSERT/ON CONFLICT DO NOTHING. Any later error rolls back the entire save.
  No operative row locks or writes. Ordinary SELECT AccessShare table locks still conflict with DDL,
  but not operative ownership UPDATE/DELETE. Draft lock timeout can return 40001; reload before retry.
- Both RPCs require READ COMMITTED (other isolation levels return 22023). A single nonlocking
  authorization snapshot after draft-lock waits checks the merchant and all stored/incoming entities.
  This is **snapshot authorization, not commit-time revocation**: an uncommitted or later transfer/delete
  may coexist with a successful in-flight RPC; subsequent RPCs recheck and fail closed. Historical
  transfer-away-and-back or deletion/reuse of the same UUID is not tracked by this candidate.
- Candidate installation uses transaction-local lock_timeout=2s and statement_timeout=30s. These
  settings do not persist as RPC runtime limits; remote/API runtime limits require separate review.
- UUID seller keys are canonical lowercase. Text limits count UTF-16 units, templates use the
  JavaScript trim whitespace set, and both layers reject C0/DEL/C1 control characters.
- Prefixes use literal membership, not Unicode categories or locale-dependent character classes:
  ASCII A–Z/a–z, digits 0–9, Ukrainian АБВГҐДЕЄЖЗИІЇЙКЛМНОПРСТУФХЦЧШЩЬЮЯ (both cases), `_` and `-`;
  empty is allowed, maximum 20 UTF-16 units. SQL/model literal equality and every allowed member
  are tested. Other scripts, accented Latin, non-ASCII numbers and combining marks are rejected.
  This deliberately narrows both v1/v2 validation: incompatible old local bytes are retained without
  rewriting, import or fallback. Explicit correction is required; no recovery UI is added here.
- Selected seller is UI state, not shared account data. Async completions are scoped and fenced;
  pending forms cannot issue duplicate saves. No cache or automatic retry is implemented.

All saved settings remain **non-operative drafts**. The finance-purpose template supports seller
identity, own IBAN, provider references, business purpose and a visibly fictitious payment-ID marker.
Substitution is single-pass, not executable code. Missing values remain explicit placeholders.
The generic template renderer also supplies placeholders for v1 previews; v1 stored documents are
not silently rewritten. Editing the finance template explicitly creates v2.

No provider activation, real numbering reservation, invoice/QR/payment payload integration, finance
recipient overwrite, payout/collection state changes, authentication changes or terminal TTL changes.

## Historical local safety remediation evidence — 2026-09-08

- Full root Vitest: **424 tests in 39 files passed**; settings-specific subset **117 passed**.
- Direct svelte-check (without generation scripts): **0 errors, 0 warnings**. No Svelte component edits.
- PGlite: **204 passed**; PostgreSQL 17: **249 passed**, including 45 real-PG-specific scenarios.
  Combined repeated run: **453 passed, zero failed/skipped** (Node totals include parent tests).
  Coverage includes first-save/update CAS, rollback, coherent aggregate reads, bounded nonblocking
  operative DML in both directions, authorization refreshed after parent/unique-index waits,
  owner pinning, unsupported isolation rejection, unchanged orphan tuples and max-revision deletion.
- Disposable database drop confirmed; independent catalog check found **zero settings_test_* databases
  and connections** on authorized loopback port 55440. No real/remote data used.
- Scoped ESLint still reports three pre-existing issues: model preserve-caught-error, the existing
  repository-test unused selection binding, and SQL-test no-control-regex. No new lint finding remains.
- Historical UI evidence, **not rerun in this SQL/model remediation**: 5 focused Playwright tests twice;
  includes template validation/save/reload/per-seller values, conflicts, navigation and mobile.
- Historical official Svelte MCP checks after earlier component edits reported no issues.
- User approved a separate clean cluster rather than overwriting the old cluster. New data lives
  outside the repository at `D:\svetle\.tools\postgres-settings-test\data`, loopback port 55440,
  administrator `settings_test_admin`. Synthetic NOLOGIN roles `anon`/`authenticated` were created
  only there. Old cluster on 55439 is unchanged. Both servers are left running.
- The new cluster uses trust authentication for local synthetic tests only; never expose its port
  or use production data. Harness permits only loopback and ports 55439/55440, selected with
  `BUSINESS_SETTINGS_LOCAL_PG_PORT`; opt-in and administrator variables remain required.
- Startup uses existing PostgreSQL binaries through pg_ctl. No reinstallation or old-data deletion.
- At this remediation checkpoint, the full root build had failed with Windows EBUSY.
  Subsequently, the full normal root build **passed** after the authorized stop of local Wrangler
  on port 8787. The isolated full build also passed, with 13 targeted and 221 Worker tests;
  Chromium observed 111 correctly scoped generated asset responses and no errors.

## Historical pre-installation gates (superseded only for the authorized slice)

The following checklist records the pre-rollout requirements, not a current claim that installation
is blocked. The dated evidence records the authorized execution; future installations, changes,
administrative recovery and payment activation still require their own review and approval.

1. Preserve the passing disposable real-PostgreSQL concurrency evidence when changing SQL.
2. Confirm intended project against nonsecret application configuration; inventory actual grants,
   RLS, entity deletion/ownership workflows, function owner privileges and PostgreSQL/Unicode behavior.
3. Review backup, installation/rollback and administrative ownership recovery procedures. The SQL
  candidate is fresh-install additive DDL, not an upgrade patch for an already installed older
  candidate, nor an idempotent migration runner. Never apply the unrelated
   checkout migration directory as a shortcut: its grants differ from this Dashboard's boundary.
4. Obtain separate explicit permission for remote schema installation; install only the reviewed
   candidate, inspect security advisors, and test with isolated authorized fixtures.
5. Obtain clean full-build evidence and separate deployment approval. Payment activation is an
   additional implementation/approval phase, not a consequence of saving these settings.

The local remediation phase made no remote writes, payments, deployments, commits or pushes.
The later authorized migration and isolated deployment are recorded above; no payment activation,
commit or push is included in that rollout.

## Historical pre-installation Cloud and Git review — 2026-09-08

- At that checkpoint, remote public table inventory confirmed the two new settings tables were absent. MCP read-only
  schema/log queries succeeded, but this is not a full production health certification.
- Existing security advisors report three mutable function search paths, anon/authenticated access
  to the SECURITY DEFINER function `rls_auto_enable`, and disabled leaked-password protection.
  Twenty-seven RLS-without-policy notices may be intentional default-deny; review, do not open access.
  These predate candidate installation and were not changed.
- Remediation references: [search path](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable),
  [anonymous definer execution](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable),
  [password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
- Local and actual remote main still match `ae9f2036b840d26f9933bbd858422b4fa2232f64`.
  Working tree includes unrelated checkout, landing, POS and deployment edits; never stage all blindly.
- Limited pattern scan of 636 tracked/nonignored paths found no selected secret patterns; this is
  not a complete outgoing-history or secret audit. No GitHub workflow files were found; external
  deployment integrations remain unverified. Prefer a scoped review branch, not a production release.