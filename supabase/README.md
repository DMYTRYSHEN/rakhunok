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