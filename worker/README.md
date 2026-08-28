# letsrealtalk.com Worker

This directory owns an isolated Cloudflare Static Assets Worker for the `corex` build.

## Safety boundary

- The default Worker is `letsrealtalk-web-preview` and has no custom domain.
- The production Worker is `letsrealtalk-web` and is selected only with `--env production`.
- The only configured production route is `letsrealtalk.com/*` in the `letsrealtalk.com` zone.
- The dashboard uses the separate `letsrealtalk-dashboard` Worker configured by `wrangler.dashboard.jsonc`.
- Its production route is `letsrealtalk.com/dashboard*`; the Worker rejects paths outside `/dashboard` and `/dashboard/` with `404`.
- Dashboard API requests use `/dashboard/api/v1/*` and are forwarded through the `API` service binding to the existing `rahunok` Worker, which remains responsible for JWT authorization and invoice data.
- This configuration contains no `rakhunok.com` route, Worker name, binding, or secret.
- Do not use configuration files from `../core/worker` or `../../core/worker` here.
- Deployment scripts are intentionally absent so production commands always require an explicit environment.

## Validate locally

```powershell
npm install
npm run build
npm run check
npm run check:production
npm run check:dashboard
npm run check:dashboard:production
```

The two check commands are Wrangler dry runs and do not publish anything.

## Production route

The landing is deployed to `letsrealtalk-web`; its active version is attached to the existing proxied apex with a Worker Route:

```powershell
npx wrangler triggers deploy --env production
```

Verify `/` and `/robots.txt` return `200`, while non-landing paths such as `/corex` and `/dashboard` return `404`.

## Dashboard production route

Deploy the same build to the landing Worker first so its shared `/_app/*` assets match, then deploy the dashboard Worker:

```powershell
npx wrangler deploy --env production
npx wrangler deploy --config wrangler.dashboard.jsonc --env production
```

Verify `/dashboard`, `/dashboard?demo=1`, and nested dashboard routes return `200`. An unauthenticated `POST /dashboard/api/v1/orders` must return `401` JSON from the API Worker. `/dashboard-anything` must return `404`.

## Rollback

In Cloudflare, open `letsrealtalk-web` > **Settings** > **Domains & Routes** and remove only the `letsrealtalk.com/*` Worker Route. Do not delete or alter the apex A/AAAA records. Removing the route restores traffic to the existing origin behind those records.

To roll back only the dashboard, open `letsrealtalk-dashboard` > **Settings** > **Domains & Routes** and remove only the `letsrealtalk.com/dashboard*` Worker Route. Do not remove the `letsrealtalk.com/*` landing route, modify the `rahunok` Worker, or change DNS records.