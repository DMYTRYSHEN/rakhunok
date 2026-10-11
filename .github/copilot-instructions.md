# Project Guidelines

## RHNK Database And Schema Changes

- The Supabase project for `rhnk.to` is `rhnk_main`, project ref
  `mvytjhaujcewqfyivwxf`, API URL `https://mvytjhaujcewqfyivwxf.supabase.co`.
  Treat this as a separate database, not an alias of the existing shared project
  `mwaeazabpvbxqfrceogr`. Existing `worker-rhnk` configs target `rhnk.pp.ua`, not `rhnk.to`.
- For every database-dependent feature or change, explicitly assess compatibility with
  the `rhnk.to` database: tables, columns, relationships, constraints, indexes, views,
  functions/RPCs, triggers, grants, RLS, Storage policies, and Realtime publications.
  Do not consider a schema change complete only because it works against the old database.
- Keep schema changes reproducible in version-controlled migrations. Check the target
  project's migration history and schema drift before applying them. Validate on a local
  database or dedicated development branch first; never reset the remote database to test.
  Candidate SQL is not an approved migration and must not be applied automatically.
- Before any remote write, verify the exact project ref and the approved operation scope.
  Approval to provision `rhnk.to` does not authorize writes to other projects, changes to
  locked invoice scenarios, or future production deployments. Do not automatically apply
  migrations to every environment; report pending migrations per target explicitly.
- Schema replication does not authorize copying users, sessions, business/payment data,
  secrets, Storage objects, cron jobs, or external webhooks. Review required reference data
  separately and keep environment-specific integrations disabled until configured.
- For `rhnk.to`, use its own public URL/key in frontend builds and its own server secrets.
  Inspect hardcoded project references as well as environment variables; never silently
  fall back to the old project. Never expose service-role/secret keys to browser code.
- After approved schema changes, verify object and relationship parity, relevant RPCs,
  constraints and cross-tenant/anonymous access tests, run Supabase security advisors,
  and regenerate affected types. Distinguish prepared, applied, and verified migrations
  in the completion report; disclose any unverified or unapplied changes.

## Production Deployment Safety

- Treat `rakhunok.com` as production and `letsrealtalk.com` as the development and test domain.
  Each domain uses separate Workers with overlapping route specificity.
- Do not run any production deployment without explicit user approval for that deployment.
- Deploy production only through `npm run rakhunok:deploy` or the scripts in `worker-rakhunok`.
  Keep development and test deployments in `worker` scoped to `letsrealtalk.com`.
- Before deploying Landing, Dashboard, or Corex to either domain, run the root `npm run build`
  and the matching dry-run. Never deploy those Workers from a partial `build` directory.
- Conf's canonical assets are `apps/conf/dist`. Do not replace the root `build` directory with
  Conf artifacts.
- After any production route or Worker deployment, smoke-test `/`, `/dashboard`, `/app`, `/conf/`,
  `/pay`, `/pay/`, and `/corex` on the target domain. Do not report success until all return HTTP
  200 and load their expected page assets.
- Preserve both exact and wildcard routes where a bare path must work, for example `/pay` and
  `/pay/*`.