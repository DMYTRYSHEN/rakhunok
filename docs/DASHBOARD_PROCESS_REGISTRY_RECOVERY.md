# Dashboard Registry Recovery And Contact Preparation

## Recovery Status - 2026-10-04

- The user approved restoring `docs/DASHBOARD_PROCESS_REGISTRY.md` from exact git HEAD while preserving its original empty contents in `docs/DASHBOARD_PROCESS_REGISTRY.empty.backup.md`.
- Recovery is complete. The registry was originally 0 bytes. Exact HEAD restoration through the approved single-file `git restore --source=HEAD --worktree` was verified against blob `34a3c49a6bb3230a57d3878adeec741e5bcc32f4` (134521 bytes, 1752 lines) before appending the separately scoped analysis record. The empty backup remains preserved.
- This document is a supporting record, not a replacement registry or authorization to change other processes. Unrelated worktree changes were preserved.

## Current Blocker Repair - 2026-10-04

Latest user decision: preparation only with an isolated database. Shared DAC7
(`mwaeazabpvbxqfrceogr`) is prohibited for this migration and test writes; no Worker deployment
is authorized. Two dedicated test accounts will be supplied through browser entry. See the
[isolated acceptance runbook](ONBOARDING_ISOLATED_ACCEPTANCE.md). No isolated target is selected.
Runner safety/cleanup tests pass 3/3 and runner ESLint passes; no real JWT run has occurred.
Fresh root build and both letsrealtalk target dry-runs pass packaging without upload. API D1
is not inherited into env.production, and Dashboard API binds to rahunok rather than the newly
packaged letsrealtalk-web. Those configurations were not changed; route integration remains blocked.

This section supersedes the historical local repair, conditional preflight and contact-column
preparation below. Those sections retain the evidence available at their original phase, not the
current release design or permission boundary.

- Latest user approval covers local contact privacy repair and selected-seller compatibility checks
	for fixed, open_amount, table and delivery. No payment runtime, auth lifecycle, existing public
	policies, recipient snapshots or unrelated grants were changed. Delivery activation is excluded.
- The unsafe contact-column candidate was removed. The single unapplied initialization candidate
	creates public.business_entity_contacts: entity PK/FK with delete cascade, verified owner, nullable
	contacts, owner-only RLS, authenticated CRUD and no anon access. Public business_entities recipient
	reads remain unchanged. Table privileges would override column revokes, so column-only protection
	was rejected: [column security](https://supabase.com/docs/guides/database/postgres/column-level-security).
- complete_merchant_onboarding atomically creates merchant, entity and private contacts under
	SECURITY INVOKER/auth.uid(). Existing retries do not overwrite or backfill. save_business_entity
	atomically saves legal details and private contacts; omitted keys preserve, JSON null clears.
	Gateway reads the protected one-to-one relation and uses this RPC only for supplied contact keys.
	RPC errors or unconfirmed owner results fail closed without public-column fallback.
- Five PGlite tests cover public active-entity reads, private contact denial, cross-owner writes,
	all four forms, retry preservation and transaction rollback. These emulate roles, not real JWTs.
	Gateway: 45/45; actual-component browser checks: 2/2 at desktop/mobile; registry guard: 2/2;
	root check: 0 errors and 0 warnings.
- Four previous gate failures were fixture-contract defects: cache GET lacked bearer, initiation
	lacked configured bank routing, logos expected a removed committed response, and bank catalog
	mocked Supabase instead of current D1. Runtime routing/cache/payment code was not changed.
	Final combined gate: 193/193. Extended snapshot suite: 15/15, including a
	4-form by 4-scenario selected-recipient matrix and earlier snapshot immutability.
- InvoiceCreate submits selected entityId independently of its local non-FOP-to-TOV rules.
	SQL tests confirm authoritative selected-recipient name/IBAN/tax ID, amounts, terminal and expiry.
	This does not certify browser-local VAT/purpose suggestions or activate delivery.
- Release remains blocked on target-specific schema/RPC acceptance, real JWT save/read/reload and
	owner isolation, real PostgreSQL concurrency and route integration. Root release build and
	matching packaging dry-runs pass with the configuration limitations above;
	scoped ESLint retains two unchanged no-explicit-any findings in gateway team methods. Full-repo
	lint/e2e acceptance is not claimed. The gateway
	relation query requires the new schema first; do not deploy UI against the old schema.
- CREATE TABLE is single-use and deliberately fails if the relation already exists. Review target
	columns, constraints, migration history and grants before converting/applying the candidate.
	Preserve contact data and widened legal forms when rolling back application artifacts; do not
	automatically drop the relation or delete businesses. No hosted DDL/DML, deployment or commit.

## Historical Local Repair Progress - 2026-10-04

- User approved local implementation of the readiness plan, then conditionally approved the proposed SQL/RPC and Worker rollout only if payment and onboarding remain safe. No hosted DDL/DML, deployment or commit was performed. Read-only hosted metadata and advisor queries were performed; conditional approval does not unlock payment scenarios, RLS, grants or authentication.
- Worker onboarding now verifies the bearer through Auth, ignores submitted owner/bank identity, validates explicit legal/contact input and calls one authenticated `complete_merchant_onboarding` RPC. It confirms persisted UUIDs and owner identity before returning success. Missing RPC fails closed, with no partial-write fallback.
- Unapplied `supabase/candidates/merchant-onboarding.sql` adds the three nullable entity contacts, widens the inspected merchant legal-type constraint and implements a SECURITY INVOKER transaction deriving `auth.uid()`. New owners receive one merchant and one initial entity; entity failure rolls back both. Existing-owner retries return `created: false` without modifying branding, contacts or creating a missing entity. Different retry input is not a conflict error; it returns the existing merchant explicitly. No operation-key or real concurrency acceptance is claimed.
- Contacts remain authoritative in business_entities, not duplicated on merchants. The initialization candidate overlaps the contact-only candidate's three additions; review the rollout as one compatible schema change, not unrelated migration execution.
- Two-step form supports fop, tov, self_employed and ngo, preserves input after errors and back navigation, and normalizes contacts. Personal identifiers currently require 10 digits and organization codes 8; legal identifier exceptions remain unreviewed. Public-name suggestion is capped at the existing 100-character storage limit; legal name remains up to 200.
- Entity create/update now select the returned id/user_id and require exactly one matching owner-bound row. Zero, malformed, multiple, cross-owner and wrong update IDs fail instead of reporting success. Omitted contacts and explicit clearing remain distinct.
- Local evidence: 24 handler tests, 40 gateway tests, 4 synthetic PGlite transaction/RLS tests, 2 registry-guard tests and 2 actual-component browser tests at 1280x900/390x844 passed. `npm run check` passed with 0 errors and 0 warnings. Svelte autofixer reported no issues for changed interaction markup.
- Existing empty structure now displays a legal-seller empty state beside the existing create action. Browser checks confirm no mutation on render; creation remains explicit. Richer resumable suggestions are not implemented.
- Broader Worker write regression run: 135/136 passed; existing cached-alias PATCH test fails at index-writes.test.mjs:377 (expected cancelled, got undefined). It also fails when isolated from onboarding. Protected invoice/cache implementation was not changed; the failure blocks full regression acceptance.
- Remaining: non-destructive setup guidance for an established merchant without an entity, delayed auth/account-switch reproduction, actual PostgreSQL concurrency, target policies/grants/advisories/log review, hosted save/reload/logout-login and first-action acceptance. No full Dashboard readiness claim.
- Release boundary: schema/RPC compatibility must precede Worker deployment. Current hosted catalog lacks contacts/RPC and self_employed merchant support. Protected invoice legal-form propagation, local-only invoice terminal creation, delivery activation and legacy merchant/me writes remain outside this repair.
- The historical audit and proposed gates below retain their original findings; the progress section above supersedes resolved empty-registry and ownerless-onboarding findings locally only.

## Historical Conditional Rollout Preflight - 2026-10-04

- Outcome: blocked before hosted apply or deployment. The existing local candidates remain unapplied; no public policy or grant was changed.
- Fresh hosted catalog confirms both tables have RLS enabled, owner-bound ALL policies, and additional public SELECT policies for active rows. Existing table SELECT privileges include anon and authenticated. Adding contact columns to business_entities would expose those columns through the current public read boundary. Owner-scoped application queries are not a privacy boundary against direct API access.
- The four synthetic PGlite tests use representative owner-only policies, not the actual public SELECT policies. Their foreign-owner-denial result must not be interpreted as hosted contact confidentiality. A separate approved privacy design must preserve required public payment-recipient reads without exposing owner contacts; do not simply delete public policies during onboarding rollout.
- InvoiceCreate.svelte:170 maps self_employed and ngo to TOV invoice rules and carries the existing VAT state for that branch. This is a compatibility blocker for activating expanded onboarding, not a newly introduced invoice-code change. Review legal-form, payment-purpose and seller snapshot behavior for fixed, open_amount, table and delivery only under separately named scenario approval; delivery activation remains excluded.
- Combined command: `node --experimental-strip-types --test worker/src/index.test.mjs worker/src/index-writes.test.mjs worker/src/checkout.test.mjs worker/src/checkout-backend/invoice-payment-snapshots.test.mjs worker/src/merchant-onboarding.test.mjs worker/src/merchant-onboarding-db.test.mjs`. Result: 191 tests, 187 passed, 4 failed, exit 1. Failures are cached-alias PATCH (index-writes.test.mjs:338), checkout initiation (index.test.mjs:207), banks/logos (index.test.mjs:370), and bank-catalog read (index.test.mjs:399). Baseline attribution is not established; do not dismiss these as unrelated or claim payment readiness.
- Scoped advisors additionally report entity foreign keys without covering indexes and repeated auth.uid evaluation/multiple permissive SELECT policies. These are not changed in this scope. References: [RLS init-plan guidance](https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan), [multiple policies](https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies), [foreign-key indexes](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys).
- Next safe gate: separately approve the privacy boundary and named invoice compatibility repair, reproduce and resolve/attribute the four failures, then repeat onboarding/payment regressions before hosted authenticated round-trip, release build/dry-run and target-specific deployment. Existing records, orders, statuses, amounts and links remain unchanged.

## Historical DASH-STRUCTURE-001 - Contact-Column Preparation (Superseded)

- Status: local implementation and focused mocked/browser validation complete; registry recovered and hosted database execution pending.
- Approved scope: optional `phone`, `contact_email`, and `website` on `public.business_entities`, each nullable `text`. No defaults, required values, backfill, row modifications, RLS, grants, authentication, ownership, or business-type changes.
- Approved presentation requirement: the Dashboard legal-records and cards/wallets disclosures now default to expanded, retaining native manual collapse. Component compilation and a focused source assertion passed.
- Local candidate: `supabase/candidates/business-entity-contacts.sql`. It contains only `ALTER TABLE public.business_entities` and three `ADD COLUMN IF NOT EXISTS` clauses.
- The Postgres datatype rule was read: strings use `text` unless a length constraint is required. No artificial length constraints are introduced.
- Existing Supabase CLI was not found in PATH or `node_modules/.bin/supabase.cmd`. No CLI was installed or downloaded and no migration timestamp was invented. The candidate is outside migration history and is not automatically applied.
- Validation: the focused structural assertion passed, requiring exactly the approved statement and three nullable text additions. This is not database execution or hosted-schema verification.
- Pending: hosted schema compatibility review and separately approved round-trip tests. `IF NOT EXISTS` skips existing columns; it does not correct incompatible existing types or constraints. Synthetic local SQL execution is recorded above, not hosted execution.
- No remote apply, database mutation, deployment or commit was performed. The contact-only preparation did not change RLS/auth or business types; the separately approved local repair candidate is documented above.
- Remote application and deployment require separate explicit approval. Other process locks and approval boundaries remain unchanged.

## Local Implementation Evidence

- BusinessStructure creation/edit dialog now accepts optional phone, contact email and website; existing self_employed remains unchanged. Values hydrate from the existing entity. Validation and normalization reuse the existing contact helpers; bank, tax, IBAN and terminal behavior remain unchanged.
- Gateway maps absent/null contact columns to empty strings. Omitted input properties do not enter mutation payloads; explicitly empty properties become SQL null. The form omits empty never-populated contacts so old-schema ordinary legal-record writes retain their previous payload. No silent retry drops populated contacts after a database error.
- Focused gateway suite: 34 tests passed, including legacy rows, contact readback mapping, explicit clearing and unchanged user/id filters. These are mocked database results, not hosted persistence evidence.
- scripts/business-contacts.browser.test.mjs passed against the actual component at 1280x900 and 390x844: create, normalized payload, self_employed preservation, edit hydration, invalid-site rejection and clearing. Assets were compiled in memory; synthetic callbacks never connect to Auth or a database. Screenshots are in test-results/business-contacts-1280.png and test-results/business-contacts-390.png.
- BusinessStructure compiled with no warnings. Editor diagnostics found no errors in the touched contact runtime/type/test files. Official Svelte autofixer returned no issues for the new contact interaction markup and disclosures; the full legacy components were not submitted to that tool.
- Read-only hosted catalog inspection previously found no contact columns in business_entities. Populated contacts will fail against that schema until the candidate is reviewed and applied with separate approval. No remote SQL, DML, auth/RLS changes, deployment or commit occurred.
- The later local repair resolves owner assignment and seeds initial entity contacts through an unapplied atomic candidate. It does not add merchant contact columns or backfill existing merchants automatically. Hosted compatibility remains unresolved until approved rollout.

## Readiness Audit And Repair Plan - 2026-10-04

Status: analysis complete for the entry, onboarding and initial business-structure paths; implementation and live acceptance pending. This plan does not certify all Dashboard features or unlock protected processes. No remote operations or runtime edits were performed during this audit phase.

### Verified Git Baseline

| Revision | Registry bytes | Git blob |
| --- | ---: | --- |
| HEAD `a7b8eae8f0c8b8c6cde8c7e127788a05d4d4b24c` | 134521 | `34a3c49a6bb3230a57d3878adeec741e5bcc32f4` |
| `4a2bad5` | 134521 | `34a3c49a6bb3230a57d3878adeec741e5bcc32f4` |
| `b6fb1c6` | 121510 | `90e2732acd9e3947f5fc24be17e3e4b723a6dc26` |
| `6b7c5cb` | 112521 | `37f98d3cc4e0d52a1e0cd880875ac456f08897fa` |

`4a2bad5` is the latest registry-changing commit found in history (2026-10-01). Its registry is identical to HEAD. Recovery restored only this document, not application code or the whole worktree; a separate local analysis record now makes the working document intentionally differ from HEAD. The backup remains zero bytes. Nonempty Git content establishes authority recovery, not production functionality.

The Git registry lists `DASH-STRUCTURE-001` in the analysis order but has no dedicated reviewed section for it. Do not present it as previously LOCKED or fully verified. Add its analysis and the already approved contact scope after exact recovery. Historical tests and deployments retain their original dates and limitations; do not relabel them as current acceptance.

### Findings And Evidence

| Priority | Finding | Evidence and consequence |
| --- | --- | --- |
| P0 | Real onboarding is not persistence-ready against the previously inspected schema. | [Worker](../worker/src/index.ts) onboarding omits mandatory `merchants.user_id` and sends contact columns absent in that catalog. RLS does not assign an owner; inspected tables have no owner-filling default or trigger. Recheck target metadata before implementation or rollout. |
| P0 | Protected process authority is empty in the worktree. | Exact Git baseline above is available. Recovery and hash verification must precede protected runtime work. |
| P1 | Successful merchant creation is not business setup completion. | [Gateway](../src/lib/features/dashboard/api/dashboard-gateway.ts) restore reads only merchant identity/name. Any merchant yields `ready`; `onboarding_completed`, legal entities and terminals are not readiness inputs. Structure reads separate owner-scoped tables; onboarding creates no initial entity. |
| P1 | Onboarding lacks a safe retry/identity contract. | Worker forwards the bearer but does not resolve verified owner identity for this write; POST uses merge-duplicates without an explicit owner conflict target, and legal fields still have demonstration defaults. Presence of a bearer alone is not verification. |
| P1 | Legal type support is inconsistent. | `business_entities` supports `self_employed`; onboarding UI allows only `fop`/`tov`; inspected merchant constraint also allows `ngo` but not `self_employed`. [InvoiceCreate](../src/lib/features/dashboard/invoices/InvoiceCreate.svelte) maps every non-FOP selected entity to TOV invoice rules. This is not end-to-end self-employed support. |
| P1 | A newly added terminal in the invoice form is not persisted. | `createLocalTerminal()` creates `local-*` / `local-draft` state; the table submission passes that identifier onward. Do not count this as a usable saved workplace. Existing persisted-terminal behavior is a separate path. |
| P1 | Existing users can receive false mutation success. | Entity update checks `result.error` but not affected-row count; owner/id filters can produce zero rows without an error. Reloading the list does not prove the intended mutation occurred. |
| P1 risk | Pending asynchronous results may outlive their session. | [DashboardPage](../src/lib/features/dashboard/DashboardPage.svelte) restore and structure/POS completion primarily check `destroyed`; sign-out does not destroy the root. Reproduce with controlled delayed promises before selecting a fix. The Git registry also records an unresolved auth-subscription initialization issue, not a passed account-switch test. |
| P2 | Current local tests do not prove hosted round-trip persistence. | Gateway/Worker responses are mocked; contact browser tests use synthetic callbacks. Previous catalog inspection is read-only and was not repeated in this phase. Real authenticated save/reload and first-invoice acceptance remain pending. |

The neighboring `PUT /api/v1/merchant` also has legacy defaults and omitted owner identity. Inventory its callers and either include it in a separately stated compatibility scope or leave it explicitly blocked; repairing onboarding alone must not be represented as repairing all merchant writes.

### Process Impact And Approval Boundaries

| Process | Baseline status / invariant | Planned treatment |
| --- | --- | --- |
| `DASH-AUTH-001` | LOCKED: browser SDK auth, owner-resolved ready state, memory-only cache, immediate sign-out, event filtering and subscription cleanup. | Preserve all eight invariants. Test delayed restore, cold-start subscriptions, expiry and account switching. Record a separate named repair scope before changing shared lifecycle code. Do not activate the isolated membership candidate. |
| `DASH-SHELL-001` | ANALYZING; local lazy-import recovery validated. | Preserve routes and cached successful imports. Add an operational setup guide inside the authenticated shell, not a new authentication mechanism. |
| `DASH-STRUCTURE-001` | Listed for analysis, no dedicated reviewed Git section. | Record contacts separately from the proposed merchant/entity initialization, owner binding, type alignment and mutation confirmation scope. Existing contact approval is not approval for those additional contracts. |
| `DASH-SETTINGS-001` / `DASH-BUSINESS-DRAFTS-002` | Settings boundaries partly analyzed; drafts have a separately scoped rollout. | Preserve expanded disclosures. Do not treat settings drafts or browser-local invoice rules as operative recipient records; no automatic draft import. |
| `DASH-INVOICE-001` / `DASH-POS-001` | Active analyses and recorded repairs, not blanket readiness certification. | Validate the first usable invoice/POS action with persisted owner-scoped entity/terminal data. Protect existing amounts, statuses, TTL and public links. |
| `DASH-INVOICE-ACTIONS-001` / `DASH-POS-SETTINGS-001` | LOCKED records exist. | Retain existing action/settings contracts and run relevant regressions; no implicit unlock through onboarding. |
| `CROSS-APP-INVOICE-SCENARIOS-001` | LOCKED: `fixed`, `open_amount`, `table`, `delivery`. | Separate scenario-specific approval before changing recipient rules, terminal selection or invoice payloads. Direct invoice/POS creation must remain independent of optional templates. Delivery remains in testing while its Worker persistence blocker exists. |
| `DASH-OVERVIEW-001` / `DASH-DEVELOPER-001` | Adjacent read and credential boundaries. | Existing-owner smoke only in this scope. No financial aggregation redesign, API-key rotation or new permissions. |

### Intended User States

Keep authentication readiness and operational setup separate. A merchant's existence can continue to authorize the owner shell; a derived setup state determines which additional steps a particular action needs. Missing optional contacts must never force an established owner back through onboarding.

| State | Intended behavior and acceptance |
| --- | --- |
| Guest / missing public configuration | Configured Google sign-in or explicit configuration error; no demonstration fallback presented as a real account. |
| Authenticated user without merchant | Two steps: legal/payment details, then phone/email and optional website. Preserve entries on validation/network failure; submit once and safely reconcile uncertain outcomes. |
| Existing complete owner | Open the current Dashboard without repeating setup. Existing entities, terminals, invoices, names and integration settings stay unchanged. |
| Existing merchant without operative entity | Show a resumable setup action. Offer legacy merchant details as editable suggestions; never create or overwrite records merely on login. |
| Existing entity without terminal | Allow actions that do not require a terminal. For table/POS workflows, guide the owner to persist a correctly linked workplace before use. No blanket terminal requirement for all invoices. |
| Existing entity missing contacts | Allow current work; request optional completion in settings. Clear/omit semantics remain distinct. |
| Partially completed / uncertain save | Reconcile using owner identity and operation identity, show the persisted step, avoid duplicate merchant/entity/terminal creation. |
| Read failure / expired session | Retry or reauthenticate explicitly. A database timeout or access error must not be interpreted as an empty business. |
| Membership-only user / multiple businesses | Do not enter the owner shell through membership alone or create a second merchant implicitly. Role-aware selection and commands are a separate required scope for team access. Current one-merchant-per-owner uniqueness stays until deliberately redesigned. |

### Field Contract To Approve

| Field | Proposed ownership and requirement |
| --- | --- |
| `user_id` | Server-derived verified authenticated owner; never editable or trusted from the request body. Keep RLS ownership checks. |
| Business type | Canonical `fop`, `tov`, `self_employed`, `ngo` across the relevant DB/API/UI contracts; display labels do not change stored identity. No automatic conversion of old rows. |
| Legal name and tax identifier | Operative legal entity. Explicit type-specific validation: FOP/self-employed identifier versus legal-entity code; confirm supported identifier exceptions instead of inventing legal requirements. No demonstration defaults. |
| IBAN and bank | Operative legal entity; normalized valid UA IBAN with checksum. Derive MFO/bank label; unknown valid MFO is not rejected solely because a local bank-name map is incomplete. |
| Display name | Merchant presentation; default suggestion from legal name, editable later. Do not overwrite existing branding on retry. |
| Phone and contact email | Request on new setup, prefill email from Auth as an editable suggestion. Business contacts are distinct from login identity and do not become verified merely by saving. Existing entities remain valid without them. |
| Website | Optional normalized HTTP(S) URL, blank becomes null; reject credentials and invalid schemes. |
| Workplace name/code/type/entity | Needed when creating a workplace, not to log in. Entity and terminal must belong to the same authorized owner; enforce code uniqueness according to the existing DB contract. |

Recommended source of truth: `business_entities` for operative recipient details/contacts; `merchants` for account/business presentation and compatibility fields. If merchant-level contacts remain part of the onboarding API, add their explicit nullable storage contract and document that they are merchant defaults, not silently synchronized copies. Initial entity contacts can be seeded once from confirmed setup; later edits must not unexpectedly overwrite another entity. Do not persist contact PII into a new browser-local draft store.

### Ordered Implementation And Release Gates

1. **Recover the registry only.** Preserve the empty backup and all unrelated work. Restore the exact HEAD blob, require `git hash-object` to equal `34a3c49a6bb3230a57d3878adeec741e5bcc32f4`, then append the scoped audit records as a separate diff. A tooling exception or user-operated exact restore is needed if the required patch writer again alters source fidelity. Add a narrow nonempty/required-process-ID guard to repository checks after recovery; do not replace the registry with an abbreviated reconstruction.
2. **Capture executable failures locally.** Add focused cases in existing gateway/Worker tests for mandatory owner assignment, absent columns, invalid/expired bearer, duplicate submission, zero-row update and server rejection of invalid legal fields. Add controlled root lifecycle cases for sign-out/account-switch during restore and subscription startup. First reproduce the race before changing its implementation. All fixtures must be synthetic and secret-free.
3. **Review database compatibility.** Refresh read-only target metadata, migrations, grants, policies, constraints, triggers, logs and advisories with no customer-row dump. Validate a local additive candidate against a representative baseline before remote execution. Keep the already prepared entity-contact SQL separate from merchant contacts, merchant type widening, ownership/uniqueness or transactional initialization changes. Existing nullable fields require no backfill. Do not apply unrelated migrations.
4. **Implement reliable initialization under approved scope.** Verify the bearer using the established server auth boundary; derive the owner and keep user-scoped authorization. Prefer one authenticated transaction/RPC for merchant plus initial entity, with explicit owner uniqueness and a stable idempotency key. On conflict, return/reconcile the existing result without overwriting configured records; mismatched retries must be explicit. Define the response with persisted IDs and setup outcome, not HTTP success alone. If a transaction cannot be adopted, persist and expose resumable stages; never hide partial completion. Do not use a service-role bypass as a shortcut.
5. **Integrate new and existing-owner setup.** Preserve SDK auth and the current ready contract. Add non-destructive setup guidance and an explicit completion/readback check. Support the approved legal forms end to end, retain supplied values after errors, prevent double-submit, and offer recovery after a lost response. Existing users must not be forced to resubmit legal details or contacts. Validate saved entity updates through exactly-one-row returned data and authenticated readback; zero/multiple rows are not success.
6. **Repair first-action dependencies only after separate scenario approval.** For `table`, replace non-demo local-only terminal creation with the existing persisted structure workflow or an explicit link to it; preserve demo isolation. For `fixed`, `open_amount`, `table`, `delivery`, review the non-FOP-to-TOV rule and seller snapshot compatibility before changing legal-form propagation. Keep legacy orders/links readable and financial calculations unchanged. Retest available scenarios; do not unlock delivery activation in this work.
7. **Run hosted acceptance on explicitly approved test identities/data.** Verify the actual Supabase project behind each host: `letsrealtalk.com` and production can share storage, so a test hostname alone is not isolation. Record test resource IDs, restrict cleanup to those IDs, and never use customer records. Require actual JWT save, reload, logout/login and first-action readback, plus cross-owner denial. No remote test writes until this scope is approved.
8. **Release separately.** Schema compatibility first, then compatible Worker/API, then UI, with explicit approval for each remote stage. Require root lint/check/unit/e2e/build gates and matching Worker dry-run; document failures rather than calling a partial pass release-ready. Use the approved production deployment entry point only. Smoke `/`, `/dashboard`, `/app`, `/conf/`, `/pay`, `/pay/`, `/corex` with expected assets, then authenticated workflows. A route returning 200 is insufficient acceptance.
9. **Record evidence and rollback.** For every process, record exact revision, environment, commands/results, live versus mocked evidence and residual risks. Roll back application/Worker artifacts if needed while retaining compatible additive columns and contact data; do not drop columns or delete created businesses as an automatic rollback. Preserve the prior legal-type values and review rollback compatibility with newly created self-employed records. Do not mark ANALYZING processes LOCKED until their own acceptance is complete.

### Acceptance Matrix

| Check | Required evidence |
| --- | --- |
| New owner, each supported legal form | One merchant and one confirmed initial entity, correct owner, normalized fields, contacts survive authenticated reload; no fake data. |
| Established owner | No forced onboarding, no duplicate or overwritten entity/terminal, unchanged invoice links, settings and integrations. |
| Partial/empty business | Correct next step, no write on login, explicit resume after failure. |
| Retry/concurrency | Double click, two tabs, response lost after commit: one logical initialization; mismatch reported without overwriting existing data. Real DB concurrency test in addition to mocks. |
| Auth lifecycle | Cold start, SPA navigation, token refresh, immediate sign-out and delayed account-A result after account-B sign-in; no stale state/Realtime or duplicate subscriptions. |
| Authorization | Missing/expired/forged bearer and owner-A access to owner-B IDs rejected; zero-row mutation not reported as saved; no secrets in logs. |
| Contacts | Create/edit/reload/clear; omitted values preserved, explicit clearing persists; invalid values rejected on server as well as UI. |
| First invoice/POS | Available direct fixed/open-amount flows with valid recipient; table with persisted matching terminal, verified saved order and public link; no mandatory template. Existing cancel/status/TTL regressions pass. |
| Responsive interaction | Two steps, back/retry, keyboard/error focus, disabled pending action, contact hydration and both initially expanded settings sections at desktop/mobile. |
| Registry | Nonempty authority restored from verified blob; all affected processes have current scoped evidence and honest remaining limitations. |

Current acceptance result: **NOT READY for a claim of fully working new-user onboarding or complete Dashboard operation.** Local contact UI evidence remains valid within its synthetic scope. Full functionality requires the separate implementation and hosted acceptance above; team-member access and delivery activation are not silently included.