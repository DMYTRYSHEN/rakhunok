# rhnk.to Shared-Database Release

The user approved this temporary release on 2026-10-05 using the OLD shared
Supabase project `mwaeazabpvbxqfrceogr`. Users and business data are shared with
existing domains. The new project `mvytjhaujcewqfyivwxf` is unchanged; its migration
remains pending and the repository's future database compatibility rules remain valid.

Cloudflare zone `7e8287296894992e305c858932803d6d` was verified Active in account
`753ff9292511c16a281c5cfa8e105c63`. New Workers use the `rhnk-to-` prefix and do not
replace existing Workers or routes. No new cron, queue consumer, webhook or Workflow
is enabled. API bindings target new private `rhnk-to-web` and `rhnk-to-corex-api`
services. A separate `rhnk-to-corex-process` Workflow is configured without cron.
The user separately approved sharing existing D1, R2 and KV resources without
modifying their existing data. Existing Worker configurations and secrets are untouched.

## Commands

From the repository root:

```sh
node worker-rhnk-to/release.mjs prepare
node worker-rhnk-to/release.mjs dry-run
node worker-rhnk-to/release.mjs deploy
```

Run `prepare` before each release. It checks the root app, builds the complete root
and all frontend products, prepares Landing assets, and dry-runs all targets.
`deploy` requires explicit approval for that release, repeats dry-runs, and uploads
only these new-domain Workers. Logs are ignored under `.release-logs`.
The user explicitly approved publishing Conf with its existing authentication on
2026-10-05. The current standalone build has Google/Supabase login but no verified
additional password gate. Wildcard sync admin IDs permit any non-anonymous authenticated
user; this release does not certify restricted administrator access.
Dashboard intentionally uses the complete root build: its handler rewrites unprefixed
assets to `/dashboard/_app/`. Corex serves its isolated build without stripping the
on-disk `/corex/_app/` prefix and forwards APIs to the new private Corex service.

## URLs

- `https://rhnk.to/`
- `https://rhnk.to/dashboard`
- `https://rhnk.to/app/`
- `https://rhnk.to/pay/`
- `https://rhnk.to/conf/`
- `https://rhnk.to/corex`
- `https://rhnk.to/platform/`
- `https://rhnk.to/qr/`
- `https://snapshot.rhnk.to/dac7/`
- `https://legacy.rhnk.to/checkout/`
- `https://qr.rhnk.to/v1/create-qr-code/?data=https%3A%2F%2Frhnk.to&format=svg`

## Known Limits

The new private backends have no provisioned server-secret bindings. Server operations
requiring service-role credentials and Corex execution are not certified. Generated
links use the new domain where handlers honor environment variables; remaining hardcoded
bank-logo links require separate review. Existing payment scenarios are unchanged
and `delivery` is not production-ready. Platform, DAC7 Snapshot and legacy Checkout
retain their existing demo limitations; deploying their UI does not provision APIs.

Google requires adding `https://rhnk.to` to the existing client's Authorized JavaScript
origins, keeping its old Supabase callback. Telegram additionally requires the exact
`https://rhnk.to/app/` Supabase redirect and a separately reviewed frontend origin change.
Do not change the shared Site URL or replace the existing bot webhook. Authenticated
flows remain unverified until these provider settings are confirmed.

Conf's browser code `777` is not server authorization. Existing shared BankLink RLS
permits authenticated writes; this deployment does not harden those policies.

## Deployment Evidence (2026-10-05)

All 13 new Workers deployed successfully, including Conf. Root checks, full root/Corex
builds, seven standalone product builds, four tests and 13 Wrangler dry-runs passed.
Existing Workers were not deployed or reconfigured. The separate Corex Workflow has
no cron. No server secrets or webhook were set. Compatibility date is `2026-10-04`.

Landing uses the `rhnk.to/*` Worker route because an existing apex DNS record prevented
Custom Domain assignment. No existing DNS records were deleted or changed. Public DNS
returns the correct Cloudflare nameservers but no apex A/AAAA answers. Current OAuth
lacks DNS permission. Check the apex record in Cloudflare DNS and enable proxy on the
existing origin record if applicable. For a Worker-only apex without an origin, a
proxied placeholder A record such as `192.0.2.1` is sufficient. Do not alter other domains.

Read-only `node worker-rhnk-to/smoke.mjs` reports nine apex DNS failures. Snapshot and
Legacy HTML return 200, Snapshot JS/CSS return correct content types, and QR Generator
returns 200 SVG. Apex pages, browser rendering, authenticated APIs and payment workflows
remain unverified. The separate `rhnk_main` database migration remains deferred.