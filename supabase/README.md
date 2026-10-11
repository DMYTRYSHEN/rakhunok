# Corex control-plane migrations

This directory contains reviewable migrations for the new Corex control plane. They are not part of the legacy parity schema in `../core/db` and must not be applied to production implicitly.

Before applying a migration:

1. Link or create a dedicated Supabase development branch.
2. Review table ownership, RLS policies, grants, and advisor output.
3. Apply the migration to the development branch and generate TypeScript types.
4. Run ownership, revision-conflict, and immutable-version tests.
5. Promote through an explicit release approval.

The browser uses the authenticated user's JWT and RLS. Service-role credentials must never be exposed to the Corex client.

Draft saves use owner-scoped RLS, column-level update grants, and an expected-revision filter. Publication is server-only: the server must load the saved draft, validate and compile that exact revision, then call `corex_publish_process` with the process ID, owner ID, and expected revision. The publish function never accepts a definition from its caller.

## RHNK bootstrap status (2026-10-04)

Target: `rhnk_main` (`mvytjhaujcewqfyivwxf`), dedicated to `rhnk.to`.
The existing shared project `mwaeazabpvbxqfrceogr` is a read-only schema
reference for this work, not a deployment target. `worker-rhnk` currently
configures `rhnk.pp.ua`, not `rhnk.to`.

Status: **inventory only; no bootstrap migration prepared, applied, or verified**.
The target was ACTIVE_HEALTHY on PostgreSQL 17, with no public tables and no
recorded migrations. This does not mean it has no public functions: security
advisors reported `public.rls_auto_enable()` as SECURITY DEFINER executable by
both `anon` and `authenticated`. Review its definition, purpose, event-trigger
dependencies, and grants before deciding on remediation:
[anonymous execution](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable),
[authenticated execution](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).
No grants were changed during inventory.

Read-only catalog counts in the existing project's public schema:

| Object | Count |
| --- | ---: |
| Tables | 67 |
| Foreign keys | 116 |
| Indexes | 160 |
| RLS policies | 57 |
| Functions | 78 |
| Views and materialized views | 0 |
| Non-internal triggers | 16 |

These are inventory counts, not a complete schema export or parity proof.
No tables were returned for the source's `supabase_realtime` publication.
Other custom schemas, grants, extensions, sequences/types, Storage policies,
Auth hooks, and external integrations still require inventory.

### Replay blockers

- The legacy `core/db` path referenced above is absent from this workspace.
  No CREATE TABLE for `merchants`, `orders`, or `business_entities` was found
  in the local Supabase SQL files. For example, the merchant API key migration
  already requires `public.merchants(id)`.
- Remote and local histories differ. Remote-only names include
  `restrict_kso_rpc_access`, `align_kso_checkout_function`,
  `business_settings_drafts_v2_isolated`, `terminal_checkout_read_isolated`,
  and `merchant_onboarding_private_contacts`. Several Corex migrations have
  different remote timestamps. Match reviewed contents, not filenames alone.
- Local checkout authority/access-boundary migrations are not evidence of
  the deployed contract. Applying every local file would promote changes,
  not merely recreate the existing schema. Candidate SQL is also not an
  approved bootstrap source.
- Supabase CLI, Docker, psql, and pg_dump were not found in PATH. A local
  replay was not possible with the discovered tools. This does not establish
  that they are absent from every installation directory.

### Required bootstrap sequence

1. Obtain a schema-only export of the existing database using supported
	Supabase/PostgreSQL tooling. Do not export users, sessions, merchant/payment
	rows, secrets, Storage objects, or migration-history data as application data.
	Inspect SQL bodies for embedded credentials or environment-specific values
	before checking the export into version control.
2. Review application objects and dependencies, including custom Auth/Storage
	policies and hooks separately from managed schemas. Review default grants:
	target defaults can grant privileges absent from the source dump. Do not
	copy cron jobs or external webhooks; review any required reference rows
	separately. Preserve locked invoice and Dashboard behavior.
3. Create a reviewed version-controlled baseline in an isolated migration
	lineage for the new environment. Do not append a full snapshot to the old
	delta chain or mark unrelated historical files as applied. Reconcile
	remote-only changes and local pending changes explicitly.
4. Restore into local Supabase or a dedicated development branch first.
	Branch creation requires organization/cost confirmation. Validate object
	definitions, foreign keys, constraints, indexes, triggers, functions,
	grants/RLS, and owner/cross-tenant/anonymous access, not just object counts.
5. Confirm target ref and release scope, then apply only the validated
	baseline to `mvytjhaujcewqfyivwxf`. Recheck migration history and schema
	drift immediately before applying. Never reset a remote database to test.
6. Run advisors and parity/access checks, regenerate affected types, and
	report prepared/applied/verified status plus pending changes per target.
	Auth provider settings, public keys/server secrets, removal of hardcoded
	old-project references, and Worker deployment are separate readiness gates.

See [Supabase schema dump guidance](https://supabase.com/docs/reference/cli/supabase-db-dump)
and [local development workflow](https://supabase.com/docs/guides/local-development/cli-workflows).
The repository-wide ongoing-change rules are in
[copilot-instructions.md](../.github/copilot-instructions.md).

### Docker-free tooling prepared (2026-10-05)

- Portable PostgreSQL clients are installed outside the repository at
	`%LOCALAPPDATA%\CorexTools\postgresql-17.11\pgsql\bin` on this workstation.
	`pg_dump`, `pg_restore`, `psql`, and `pg_isready` each passed `--version`
	and reported PostgreSQL 17.11. No server service or global PATH was changed.
- The official EDB Windows archive was obtained through
	<https://sbp.enterprisedb.com/getfile.jsp?fileid=1260616>.
	Its SHA-256 is
	`80379B2C04D51C30225532E0AE04509899141E9957ED096FE749D7FD9DF8F82F`.
	This is a recorded download fingerprint, not an independently verified
	publisher checksum. The client executables report Authenticode NotSigned.
- The read-only source project reports PostgreSQL 17.6.1.166, compatible
	with this pg_dump major version. Its direct database hostname did not
	resolve from this workstation. Obtain the exact Session pooler connection
	parameters from the source project's Connect dialog; do not guess the host
	or put database passwords in chat, command arguments, or tracked files.
- The user confirmed the empty `rhnk_main` project as the intended schema
	creation target. No additional paid project or branch has been created.
	Tool preparation does not establish schema replay or access-test coverage:
	no bootstrap export or migration has been prepared, applied, or verified.