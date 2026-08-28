# Corex Worker rollout

## Scope

- Source UI: `src/lib/features/corex`.
- Production URL: `https://letsrealtalk.com/corex`.
- Preview Worker: `letsrealtalk-corex-preview`.
- Production Worker: `letsrealtalk-corex`.
- Static bundle: root `build` output.
- Authentication: existing Supabase browser session.
- Merchant API: existing `/dashboard/api/*` route owned by `letsrealtalk-dashboard`.

The Worker serves only `/corex`, `/corex/*`, and the shared build assets required by the preview. It does not proxy APIs or own dashboard, merchant app, checkout, landing, or `rakhunok.com` routes.

## Validation and preview

1. Run `npm run check` and `npm run test:unit`.
2. Build the shared application with `npm run build`.
3. Run `npm --prefix worker run test:corex`.
4. Validate packaging with `npm --prefix worker run check:corex` and `check:corex:production`.
5. Deploy preview with `npm --prefix worker run deploy:corex:preview`.
6. Verify guest login, OAuth callback to `/corex/`, authenticated rendering, locale persistence, flow navigation, and sign-out.
7. Confirm `/dashboard`, `/app`, `/pay`, `/checkout`, and `/` remain outside Corex ownership.

## Production gate

Deploy with `npm --prefix worker run deploy:corex:production` only after preview approval. Smoke-test `/corex` plus all neighboring production surfaces. Roll back the `letsrealtalk-corex` version if authentication, assets, or routing regress.