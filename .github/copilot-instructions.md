# Project Guidelines

## Production Deployment Safety

- Treat `letsrealtalk.com` as a shared production domain. Landing, Dashboard, Corex, Conf, App,
  and Checkout use separate Workers with overlapping route specificity.
- Do not run any production deployment without explicit user approval for that deployment.
- Before deploying Landing, Dashboard, or Corex, run the root `npm run build` and the matching
  production dry-run. Never deploy those Workers from a partial `build` directory.
- Deploy Conf only through `npm run worker:deploy:conf:production`; its canonical assets are
  `apps/conf/dist`. Do not replace the root `build` directory with Conf artifacts.
- After any production route or Worker deployment, smoke-test `/`, `/dashboard`, `/app`, `/conf/`,
  `/pay`, `/pay/`, and `/corex`. Do not report success until all return HTTP 200 and load their
  expected page assets.
- Preserve both exact and wildcard routes where a bare path must work, for example `/pay` and
  `/pay/*`.