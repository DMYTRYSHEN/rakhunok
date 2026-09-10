# Project Guidelines

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