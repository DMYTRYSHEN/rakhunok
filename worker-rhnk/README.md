# rhnk.pp.ua release

The Wrangler configs in this directory target only `rhnk.pp.ua` and share
the existing Supabase project. They do not provide data isolation from
`letsrealtalk.com` or `rakhunok.com`. Do not copy production secrets or route
bindings from another environment without checking their ownership.

`rhnk-landing` owns the apex Custom Domain. `rhnk-web` has no public trigger;
product Workers reach it through the `API` service binding. The merchant-key
API is disabled on `rhnk-web` until its database migrations and server secret
are separately approved and configured. Do not assign the apex to `rhnk-web`.

## Release gates

1. Confirm the Cloudflare zone `rhnk.pp.ua` is Active in account
  `753ff9292511c16a281c5cfa8e105c63`. Preserve the Landing apex Custom
  Domain. Deploy `rhnk-web` before Workers with the `API` service binding.
2. Review the complete current source diff, especially `worker/src/index.ts`,
   against the intended release. The new API Worker uses that live source,
   not an isolated snapshot. Verify all required bindings and secrets, and
   confirm that bank callbacks and Telegram webhooks remain owned by their
   current domains. Do not add a Corex cron against the shared database.
3. Run `npm run build`, `node worker-rhnk/prepare.mjs`,
   `npm run build:pay`, `npm run build:app`, and `npm run build:conf` before
   checking or deploying Workers. Conf assets are `apps/conf/dist`; never
   replace the shared `build` directory with them.
4. Run `npm run check`, `npm run check:pay`, `npm run check:app`,
   `npm run check:conf`, the relevant Worker and application tests, and a
  Wrangler `deploy --dry-run --config worker-rhnk/<config>` for each target
  config. Repeat the full build and matching dry-run after changing
   shared assets. Build output and dry-runs alone are not release approval.
5. Conf requires a Google session followed by the browser-only code `777` on
  each page load. The code is not server authorization: shared `banklink` RLS
  currently permits writes by any authenticated Supabase user. This is a
  known limitation of publishing Conf without additional protection.
  Telegram sign-in in App is allowed on the test origin and `rhnk.pp.ua`;
  verify the exact new-domain Supabase redirect before deploying App. Test
  both Telegram sign-in and linking in a system browser on `rhnk.pp.ua`;
  the in-app browser handoff must copy the new-domain App URL.
6. Before deployment, test unauthenticated private-order reads and all
   required authentication, payment, and workflow paths against a safe
   environment. Do not change fixed, open_amount, table, or delivery invoice
   semantics under this domain setup. Deploy only the new-domain Workers;
   do not run `rakhunok:deploy` or repoint existing-domain routes.

## External configuration

- In Google Cloud Console, open the existing OAuth 2.0 **Web application**
  client `71189835004-89bcpnuhv5lb7d01tdp40oqo61beun1b.apps.googleusercontent.com`.
  Add `https://rhnk.pp.ua` to **Authorized JavaScript origins**, preserving
  existing origins. Keep the Supabase callback
  `https://mwaeazabpvbxqfrceogr.supabase.co/auth/v1/callback` in
  **Authorized redirect URIs**. No `rhnk.pp.ua/auth/callback` is needed for
  the current Google ID-token flow.
- In Supabase Authentication > URL Configuration, leave the shared Site URL
  unchanged. Add the exact redirect `https://rhnk.pp.ua/app/` for Telegram
  OAuth on the new origin. Do not widen redirect wildcards or rotate project
  keys merely to add an origin. Confirm it is saved in the redirect allowlist
  before publishing `rhnk-app`; the frontend cannot set this configuration.
- In Cloudflare DNS > Records and Workers & Pages > Routes, check for existing
  apex records or routes before deploying. Landing's apex Custom Domain manages
  DNS and TLS. Add the narrower product Worker Routes using
  the respective Wrangler configs; all `API` bindings must point to
  `rhnk-web`, never to a production or test-domain Worker.

## Post-deployment checks

Verify `https://rhnk.pp.ua/`, `/dashboard`, `/app`, `/pay`, `/pay/`,
`/corex`, and `/conf/` respond with expected assets. Verify anonymous private-order
requests are rejected, Google login completes, intended invoice links open,
and the three pre-existing domains still route correctly. New Worker/route
rollback does not roll back writes to the shared Supabase database.