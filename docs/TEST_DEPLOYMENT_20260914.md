# Follow-up: isolated Telegram backend

The earlier Telegram-backend limitation is superseded by deployment of private
`letsrealtalk-telegram` (`39648953-3f19-4e2b-93d8-d98e42adee22`) and the updated test
Dashboard (`97ce07cd-3121-402e-8047-2b4bc6eea22c`). No frontend assets changed.

Only the two Telegram invoice endpoints use the new Service Binding; other API requests
still use unchanged `rahunok`. The private Worker has no public routes and both workers.dev
and preview URLs are disabled. Its secrets are limited to the public Supabase configuration,
bot token, and approved self-test actor/chat; there is no service-role key.

Validation: 279 tests passed; live preview/send without authorization return JSON 401,
Dashboard public-page returns 200, existing merchant API still returns its expected 401.
Authenticated card preview was not verified because the shared browser is signed out.
No Telegram message was sent. Google authentication status is unchanged by this rollout.

Remote comparison confirmed all six production Worker versions, shared API, and the other
three deployed test components unchanged. All 17 production routes (including IDs) and all
17 test route mappings remain unchanged; Telegram has zero public routes in either zone.

# Test deployment — 2026-09-14

## Deployed existing Workers

Only the following four Workers were deployed, at 100% of traffic:

| Application | Worker | Active version |
| --- | --- | --- |
| Dashboard | letsrealtalk-dashboard | ec3dc348-9a0e-48b6-ae7b-ef7975954cf7 |
| Pay | letsrealtalk-checkout | 3de49991-79cc-435d-8d75-a82cd0000022 |
| Conf | letsrealtalk-conf | a19b2571-99b5-4809-b40b-1a0b0b384e99 |
| Corex | letsrealtalk-corex | 759ef304-90eb-4926-9233-a439323d89e1 |

Dashboard and Corex used their isolated Wrangler configs. Checkout and Conf used
their existing `production` environments, which target **letsrealtalk**, not
rakhunok. All deployments used `--keep-vars`. No new preview Workers were created.
The working tree, including existing uncommitted changes, was built; this is not
a claim that deployment contents equal only commit c26f5eb.

## Verification

- All four builds and all four Wrangler dry runs passed.
- 22 isolated-build/handler tests passed, zero failures.
- Dashboard and Corex artifact guards each found 9 entry assets, 218 generated
  files, and the complete 18-route graph.
- Live `/dashboard`, `/corex`, `/pay`, `/conf` returned HTTP 200. Their directly
  referenced local JS/CSS assets returned 200 with non-HTML content types
  (9, 9, 4, and 2 assets respectively).
- All 17 rakhunok.com Worker routes, including IDs and mappings, matched the
  predeployment snapshot. All six production Worker active versions matched.
- Shared `rahunok` remained on version
  `752bf8ce-5189-454a-95d0-17d6f3353c7a`.
- Test web, app, and terminal-read active versions were unchanged. All 17 test
  route mappings were preserved; Wrangler regenerated IDs for deployed routes.
- Cloudflare read-back verified all 14 expected active Worker versions.
- No real-order checkout requests, payment operations, or Telegram sends were
  performed as part of the smoke checks.

## Google authentication — incomplete acceptance

The deployed Dashboard renders the Google Identity Services button. A browser
reload produced no page exceptions or HTTP >=400 responses before interaction.
Clicking the button in the VS Code integrated browser failed to open the Google
popup (`GSI_LOGGER: Failed to open popup window`). No account login, consent, or
Supabase token exchange was completed. This does not establish a Google origin
allowlist error, nor does button rendering establish successful authentication.

The Google request uses origin `https://letsrealtalk.com`. The Google Console
allowlist was not inspected. Existing auth lifecycle code was not changed.

Remaining manual acceptance: open https://letsrealtalk.com/dashboard in ordinary
Chrome/Safari, complete Google login, reload, and confirm session restoration.
On a real phone, also open the link from Telegram. Google can reject embedded
WebViews; use Telegram's **Open in browser** action and complete login in the
external browser. External-browser session storage is separate from Telegram's.
No native Telegram-WebView login guarantee is made.

Reference: https://developers.google.com/identity/protocols/oauth2/policies#use-secure-browsers

## Scope limitations

- This isolates Worker deployments/routes, **not data**. Supabase, shared API,
  and some KV remain shared. Existing Corex every-minute schedule and its
  `corex-process-production` Workflow were preserved; scheduled processing can
  affect shared database records. Production uses `rakhunok-corex-process`.
- Telegram invoice UI is deployed, but real preview/send is unavailable because
  the shared API lacks the new backend endpoints/configuration. The shared API
  was intentionally not deployed under this test-only request.
- HTTP/static-asset checks do not certify payment correctness or authenticated
  business workflows.

Local build, dry-run, deployment, and test output is under `test-results/`.