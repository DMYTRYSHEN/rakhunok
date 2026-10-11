# Local Client Support Tool

## Existing Supabase Backend

The user explicitly selected the existing shared project `mwaeazabpvbxqfrceogr`
on 2026-10-05. Do not create a local database, a second project or a paid branch
for this support workflow. This selection supersedes the earlier separate-project
assumption for support only; it does not authorize remote SQL, grants or deployment.

Subsequent explicit approval on 2026-10-05 authorized the support migration and
operator configuration in this project only. Migration
`supabase/migrations/20261005172522_support_customer_context.sql` is now applied;
its SQL matches the recorded remote migration (trimmed, LF-normalized MD5
`4f55bb9d6866f9524d3f6f01a85f1d25`). The confirmed operator
`4917dc24-e6d9-4870-b40d-a504504d4a5b` has `enabled=true`, `can_write=true`.
This grants all implemented support capabilities, not a global administrator role:
customer reads and only `settings.table_ttl` writes, with mandatory MFA, elevation,
review and confirmation. Payment authority and ordinary invoice behavior are unchanged.

Run `npm run dev:support` alongside the frontend on port 5173. The real support
API binds to `127.0.0.1:8791`, accepts only the localhost/127.0.0.1 frontend origins,
and forwards the original administrator JWT to the selected project's dispatcher.
It uses a publishable key, never a service-role key. No database is provisioned.
The frontend public Supabase URL was verified to match the same project.

Post-application checks confirmed four private RLS tables, eight indexes, fifteen
constraints and no support Realtime publication. Anonymous RPC calls, authenticated
calls without a valid session, and direct authenticated table reads are denied.
Eight SQL/HTTP tests pass; the renamed migration was retested separately. Generated
public types include `support_dispatch({p_action: string, p_input: Json}): Json`;
there is no existing generated Database type file to replace. Security advisors added
only four expected informational no-policy findings for the deny-by-default private
tables; existing warnings are unchanged. See
[RLS advisor guidance](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).
No customer contexts, operations or customer-data mutations were created during setup.
Real MFA and authenticated customer end-to-end verification remain pending.
`/health` reports the local server only, not database readiness. No Worker deployment
or changes to the separate `mvytjhaujcewqfyivwxf` project were performed.

Transport validation: eight local adapter and existing HTTP security tests pass.
The running API returns HTTP 200 at `/health`; unauthenticated bootstrap through
Vite returns HTTP 401 for both frontend origins. Exact frontend Host values
preserved by Vite are allowlisted; arbitrary hosts and origins remain forbidden.

## Synthetic Prototype

Run the VS Code task `Client Support local demo`, or:

```sh
node worker-rhnk-to/support-local-server.mjs
```

Open `http://127.0.0.1:5188`. Set `SUPPORT_LOCAL_PORT` before starting to use another
port. The server binds to loopback only and rejects other Host/Origin values.
Never deploy this server or expose it through a tunnel.

## Available Workflows

- Select the synthetic Demo Atelier business, workspace and support reason.
- Sandbox permits local invoice creation and settings changes.
- Live simulation enters read-only and requires a separate demo elevation.
- Create `fixed`, `open_amount`, `table`, or `delivery` invoices, review the
  server-normalized payload and confirm it explicitly within two minutes.
- Change the synthetic IBAN, prefix, next number and lifetime with revision checks.
- Inspect per-session audit entries; committed operations include their UUID and digest.
- Exit support to revoke the local session. Switching workspace requires exit first.
- Reload the page without losing the current local session.

Records and audit are stored together in an atomically replaced JSON file at
`<OS temporary directory>/corex-support-local/state.json`. They survive server
restart, but sessions and prepared operations do not. OS temporary files are not
permanent archival storage. A single server process owns this local store; there
is no multi-process locking. Do not run two instances against the same file.
Duplicate commit requests return the original result. A file-write failure leaves
the in-memory transaction uncommitted. Exit does not undo committed invoices or
settings. Lost responses can be retried using the same operation ID.

## Explicit Boundaries

This is an executable local workflow prototype, not production support access.
Both workspaces contain synthetic data; `live` is only a simulation. The displayed
administrator UID is an unverified demo identity, not a granted account. Demo
elevation is not real MFA. No Supabase connection, customer credentials, payment,
notification, Axiom export, remote migration or deployment is used.

The local invoice model demonstrates support controls but does not replace or
prove parity with production invoice RPCs, terminal coordination, VAT rules,
delivery persistence or payment processing. Production integration still needs
verified administrator auth/MFA, private role grants, independently assessed
database migrations/RLS for each target, transactional database adapters, actual
invoice/settings domain gateways and Dashboard integration. Existing Dashboard
SDK sessions and locked invoice runtimes are unchanged.

## Validation

```sh
node --test worker-rhnk-to/support-core.test.mjs worker-rhnk-to/support-operation-policy.test.mjs worker-rhnk-to/support-local-model.test.mjs worker-rhnk-to/support-local-server.test.mjs worker-rhnk-to/support-local.browser.test.mjs
```

The browser suite uses the repository's installed Playwright Chromium. It verifies
all four scenarios, settings, audit, reload, sandbox/live isolation, confirmation,
cancellation, exit and 375px layout without external requests or console errors.