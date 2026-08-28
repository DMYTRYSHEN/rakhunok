# letsrealtalk.com Worker

This directory owns an isolated Cloudflare Static Assets Worker for the `corex` build.

## Safety boundary

- The default Worker is `letsrealtalk-web-preview` and has no custom domain.
- The production Worker is `letsrealtalk-web` and is selected only with `--env production`.
- The only configured production Custom Domain is `letsrealtalk.com`.
- This configuration contains no `rakhunok.com` route, Worker name, binding, or secret.
- Do not use configuration files from `../core/worker` or `../../core/worker` here.
- Deployment scripts are intentionally absent until an explicit readiness review.

## Validate locally

```powershell
npm install
npm run build
npm run check
npm run check:production
```

The two check commands are Wrangler dry runs and do not publish anything.

Deployment commands will be added only after readiness review and explicit approval. Until then, use the dry-run checks above to validate both environments.