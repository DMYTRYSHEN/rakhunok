# letsrealtalk.com Worker

This directory owns an isolated Cloudflare Static Assets Worker for the `corex` build.

## Safety boundary

- The default Worker is `letsrealtalk-web-preview` and has no custom domain.
- The production Worker is `letsrealtalk-web` and is selected only with `--env production`.
- The only configured production route is `letsrealtalk.com/*` in the `letsrealtalk.com` zone.
- This configuration contains no `rakhunok.com` route, Worker name, binding, or secret.
- Do not use configuration files from `../core/worker` or `../../core/worker` here.
- Deployment scripts are intentionally absent so production commands always require an explicit environment.

## Validate locally

```powershell
npm install
npm run build
npm run check
npm run check:production
```

The two check commands are Wrangler dry runs and do not publish anything.

## Production route

The landing is deployed to `letsrealtalk-web`; its active version is attached to the existing proxied apex with a Worker Route:

```powershell
npx wrangler triggers deploy --env production
```

Verify `/` and `/robots.txt` return `200`, while non-landing paths such as `/corex` and `/dashboard` return `404`.

## Rollback

In Cloudflare, open `letsrealtalk-web` > **Settings** > **Domains & Routes** and remove only the `letsrealtalk.com/*` Worker Route. Do not delete or alter the apex A/AAAA records. Removing the route restores traffic to the existing origin behind those records.