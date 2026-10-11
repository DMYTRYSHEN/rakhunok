# Isolated Onboarding Acceptance

## Permission And Target

Latest explicit approval, 2026-10-04, supersedes the earlier execution restriction for a separate
shared-target rollout: apply only the reviewed private-contact/onboarding migration to DAC7,
connect only Dashboard onboarding to the new handler, deploy letsrealtalk.com Dashboard and verify.
Do not change customer businesses, public recipient policies, other payment/API routes or deploy
rakhunok.com. Do not run this document's isolated fixture runner on DAC7. Real new-owner setup
requires user-entered details and confirmation. The isolated workflow below remains isolated-only.

The user selected preparation only and an isolated database, with two test accounts entered
directly in the browser. No migration or test writes to shared DAC7
(`mwaeazabpvbxqfrceogr`) are authorized. No Worker deployment is authorized.
The test domain is not data isolation: its current Worker uses shared DAC7 and KV resources.

Required before execution:

- An explicitly approved isolated Supabase project or branch, its project ref and publishable key.
- A compatible baseline containing Auth, merchants and business_entities with reviewed owner RLS,
  required constraints, grants and public active-recipient reads. An empty database is insufficient.
- Two dedicated test owner UUIDs: one with no merchant and one with exactly one merchant.
- Reviewed migration history and target schema; no customer records or production data copied.

Creating a hosted project/branch requires separate organization and cost confirmation.
Rejecting one known shared ref is a guard, not proof that another project is isolated.

## Migration Preparation

## Account Verification - 2026-10-04

The user corrected the account roles: new/unconfigured owner is
`f527f6c9-3eb6-4de4-adbe-f64bd41eae6f`; existing owner is
`4917dc24-e6d9-4870-b40d-a504504d4a5b`.
The subsequent instruction permits cautious checks on the current database; this is not
treated as explicit approval for shared-schema migration, deployment or fixture deletion.

A read-only DAC7 query confirmed both Auth users exist. The new owner has zero merchants
and zero business entities. The existing owner has one active merchant with onboarding
completed and three active entities (one self_employed, two tov), each with populated name,
tax ID and IBAN. Presence is not validation of those legal/payment values.
The contacts relation and both new RPCs remain absent. No rows were changed.
The opened test-domain Dashboard is signed out and offers Google login; real JWT/browser
acceptance requires the user to sign in directly or share an authenticated tab.
Do not use the isolated fixture runner on these shared/customer accounts or remove its
shared-project guard. Any shared-target test writes and additive migration require an
explicitly bounded alternative plan; do not seed synthetic legal details into the new account.

## Candidate Preparation

The only onboarding candidate is [merchant-onboarding.sql](../supabase/candidates/merchant-onboarding.sql).
It is unapplied, single-use and outside migration history. It creates owner-only contacts,
widens the merchant legal-form constraint, adds the contact-owner FK index, and defines
the two SECURITY INVOKER RPCs. It does not remove existing public recipient policies,
backfill existing businesses or activate membership.

Supabase CLI and Docker are unavailable locally. No migration timestamp was invented.
Once the approved isolated baseline and CLI are available, discover the current migration
commands through `supabase migration --help` and `supabase migration new --help`, generate
the migration with `supabase migration new merchant_onboarding_private_contacts`, and review
the candidate in that generated artifact. Apply only this reviewed migration to the isolated
target, not the unrelated control-plane migrations in this repository.

Confirm target constraints, RLS, explicit grants, function EXECUTE permissions and the
PostgREST one-to-one relation after applying. Run security/performance advisors there.
Preserve the contact relation and widened legal forms on application rollback; never drop
contact data or delete real businesses as an automatic rollback.

## Real JWT Runner

Set these environment variables in the local terminal:

```powershell
$env:ONBOARDING_TEST_PROJECT = '<approved-isolated-ref>'
$env:ONBOARDING_TEST_URL = 'https://<approved-isolated-ref>.supabase.co'
$env:ONBOARDING_TEST_KEY = '<isolated-sb_publishable-key>'
$env:ONBOARDING_NEW_OWNER_ID = '<approved-new-test-owner-uuid>'
$env:ONBOARDING_EXISTING_OWNER_ID = '<approved-existing-test-owner-uuid>'
$env:ONBOARDING_ALLOW_TEST_WRITES = 'yes'
node --experimental-strip-types scripts/onboarding-jwt-acceptance.mjs
```

Enter credentials directly in the two opened browser forms. Never place passwords or JWTs
in chat, environment examples, source files or recorded browser artifacts. Sessions remain
in memory; tracing, screenshots and storage-state files are not enabled.

The runner verifies server identity, checks the account roles before writes, calls the local
actual Worker handler with a real JWT against the isolated backend, and tests RPC saves plus
fresh PostgREST embedded reads. It checks new-owner initialization, parallel retries after
initial creation, an existing owner's new fixture entity, contact preservation/clearing,
cross-owner denial, anonymous contact denial and unchanged public recipient access.
It does not edit the existing owner's original business.

Cleanup attempts every known fixture using exact entity/merchant ID and owner filters and
requires the same returned ID. Failure reports only outstanding IDs/owners, never raw errors
or credentials. A committed request with a lost or malformed response can leave an unknown
fixture: inspect the two approved test owners in the isolated database before retrying.
Do not use blanket deletion or point this runner at customer accounts.

## Evidence And Remaining Gates

- Local candidate transaction/RLS tests: 5/5. These use synthetic PGlite Auth roles, not JWTs.
- Runner safety/cleanup tests: 3/3; runner ESLint passes. These do not prove hosted acceptance.
- Root build passes; both test-domain Worker dry-runs pass packaging without upload.
- API dry-run warns that top-level D1 is not inherited into `env.production`.
- Dashboard dry-run confirms `API` targets `rahunok`, not `letsrealtalk-web`.

No isolated target or test UUIDs have been supplied, so hosted migration and JWT acceptance
have not run. The current gateway requires the new relation before UI rollout. Do not deploy
the changed UI against the old schema. Packaging is not backend availability or routing proof.
Any binding correction requires its own reviewed scope and target approval.

Remaining separate evidence: simultaneous first-creation concurrency, uncertain-commit
reconciliation, full Dashboard reload/logout-login, deployed-route integration and first
invoice/POS action. Four legal forms by four invoice scenarios have local snapshot coverage,
not hosted checkout certification. Payment runtime, VAT hints and delivery activation are
unchanged. Two pre-existing team-method ESLint findings and full-repository release gates
remain unresolved; this is not a release-ready assessment.