# Telegram App sessions — test App deployed

## Identity wizard test deployment — 2026-09-14

- User-authorized App-only deployment: `letsrealtalk-app`, version
  `e386104d-63ac-444a-bb9b-ecb1b72b5b1a`, route `letsrealtalk.com/app*`.
  Previous rollback version: `3352ef7e-5871-4144-8799-3afb8b1876c1`.
- Three-step account guidance in login/profile/onboarding; four starting situations,
  truthful reverse-linking limitation, no authentication actions inside the wizard.
  Native fieldset uses block layout and a full-width legend to avoid narrow-screen
  vertical text. Existing direct Telegram build flags/client ID and Google retained.
- 186 App tests and 24 offline Chromium scenarios pass; App check reports zero
  errors/warnings. Build and scoped Wrangler dry-run succeeded.
- Live HTML, service worker, JS and CSS match local build bytes. Clean Chromium
  at 320px completed all three wizard steps and closed it; legend is one horizontal
  line (286px wide, 19.5px high). Non-GET/HEAD requests blocked during this smoke.
- All 14 protected non-App Worker versions verified unchanged after deployment.
  No production deployment, shared Auth/SQL changes, or payment contract changes.
- Git save scope: App source/public, both account-guidance browser harness scripts,
  and this document. Generated build folders and unrelated dirty work excluded.
  Local commit only: main already contains a prior unpublished unrelated commit;
  pushing main would publish that work too. Real iPhone and real Telegram linking
  remain outside this UI deployment's verification.

## Callback accepted — 2026-09-14

User reported adding the exact `https://letsrealtalk.com/app/` Allowed URL.
Rechecked the deployed App in clean Chromium using its real official SDK button:
popup origin `https://oauth.telegram.org`, path `/auth`, redirect URI exactly
`https://letsrealtalk.com/app/`. It now displays **Log in with Telegram**, requested
Name/Username/Profile Photo, **Continue with Telegram**, and phone-login choice.
The earlier `redirect_uri required` rejection is resolved. Non-GET/HEAD browser
requests were blocked; no number, consent, token exchange or session was submitted.
No rebuild/deploy/config change was needed. Real iPhone consent branding and
Google-account linking/same-business session verification remain user acceptance.

## Direct test deployment — 2026-09-14, callback configuration pending

- Deployed only `letsrealtalk-app`, version
  `3352ef7e-5871-4144-8799-3afb8b1876c1`; previous rollback version
  `a853c5b1-2c89-411c-a923-92585d18c855`. Route remains `letsrealtalk.com/app*`.
- Build used enabled=true, mode=direct and public Login client ID `8802087245`,
  obtained from the existing provider's non-followed authorize redirect. No secret
  was read or changed. Existing Google configuration and API binding preserved.
- 168 tests passed, check zero errors/warnings, build and dry-run passed. Live
  HTML/SW/JS/CSS match local bytes. All 14 other tracked Worker versions unchanged.
- Synthetic invalid ID-token probe returned HTTP400 `Bad ID token`; this establishes
  routing into token validation, not successful login or administrative settings.
- Clean Chromium opened the real official SDK popup with
  `redirect_uri=https://letsrealtalk.com/app/`. Telegram returned HTTP200 with
  `redirect_uri required`, despite the parameter being present. Root callback
  `https://letsrealtalk.com/` displays the login page; `/app/` and `/app` do not.
- BLOCKER: user must explicitly add **`https://letsrealtalk.com/app/`** in this
  bot's Login Widget Allowed URLs, retaining existing origin and Supabase callback.
  Current evidence confirms the root is accepted, not the exact App callback.
  BotFather cannot be edited through the available tools. Do not change SDK URL
  semantics or silently fall back to the Supabase-hostname redirect flow.
- Google remains available; cancel restores its button. Direct Telegram remains
  pending the callback correction and real user consent. Actual iPhone consent
  domain/session/linking have not been verified. Known Telegram embedded browsers
  show external-browser guidance; this is not automatic Mini App authentication.
- No production deployment, paid domain/service, SQL, or shared Auth setting change.

## Direct Login SDK — local implementation, not deployed (2026-09-14)

Historical local implementation record; the deployment and remaining blocker are
recorded above. No Supabase setting, secret or SQL was changed in this phase.

Build variables supplied by the parent build process:

- `PUBLIC_TELEGRAM_AUTH_ENABLED=true`; absent/other values keep Telegram disabled.
- `PUBLIC_TELEGRAM_AUTH_MODE=direct`; absent also means direct; unknown values fail closed.
- `PUBLIC_TELEGRAM_CLIENT_ID`: the numeric **public Telegram Login client ID**.
  It is not a client secret or bot token. No credential discovery was performed.
- Preserve existing `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY` and
  `PUBLIC_GOOGLE_CLIENT_ID`. Runtime origin must remain exactly `https://letsrealtalk.com`.
- Explicit rollback only: `PUBLIC_TELEGRAM_AUTH_MODE=redirect` selects the existing
  Supabase OAuth redirect flow and needs no frontend Telegram client ID. Failure or
  cancellation in direct mode never triggers redirect automatically.

The official `https://oauth.telegram.org/js/telegram-login.js` is preloaded, along
with a new cryptographic 256-bit raw nonce. The SDK receives its SHA256 lowercase
hex digest; Supabase receives the raw nonce through `signInWithIdToken` or the
ID-token `linkIdentity` overload, always with `provider: 'custom:telegram'`.
Nonce checking is never disabled. SDK decoded user data is not authorization data.
Supabase remains responsible for signature, issuer, audience, expiry and nonce checks.

The inspected SDK builds `redirect_uri` from `location.origin + location.pathname`
(normally `https://letsrealtalk.com/app/`), rather than the Supabase callback. User
reports adding the site origin to BotFather Allowed URLs; verify acceptance and
the displayed consent domain with a real login. No paid/custom domain is required.
Hosted custom-provider client ID/audience, `skip_nonce_check=false`, email-optional
support and manual linking remain activation prerequisites, not verified by mocks.

SDK load is bounded to 15 seconds; popup consent to 120 seconds. `auth()` is invoked
synchronously from the click after preparation. Closing/canceling the popup, malformed
callbacks, account changes and late callbacks fail closed. Each retry gets a new nonce.
The once-per-document loader is retained because the SDK has no global unload API.
No `.tg-auth-button` delegated handler is used, avoiding duplicate submissions.

The App checks the captured account/revision before exchange; the custom fetch guard
also checks after auth-js internal awaits and requires the exact captured linking
bearer. It permits one network dispatch per nonce and rejects stale network responses.
Other providers and data requests pass through unchanged. After dispatch, cancellation
cannot roll back server linking: the UI stays busy until the SDK settles and does not
silently retry. Cross-tab changes after network response acceptance / during SDK
session persistence are now guarded as described below. Refresh and inspect the
current identity after an uncertain network outcome before attempting again.

### Narrow reviewer remediation (local only, 2026-09-14)

- Inspected installed `@supabase/auth-js` 2.112.4: both ID-token methods await
  `_request` → response JSON → session transform → `_saveSession` → notification.
  `_saveSession` clones/serializes the session and awaits the public storage adapter.
  Header-only fencing did not protect this path.
- Telegram token responses are fully buffered under the attempt fence before a
  reconstructed Response is returned. Its JSON consumption (including clones) is
  checked before and after parsing. The returned access token binds the persistence
  guard to that Telegram attempt only; no global "block all Auth writes" flag.
- The browser client uses the public `auth.storage` adapter, same default Supabase
  key and localStorage (memory fallback if unavailable). Before a matching Telegram
  session write, it checks the revision and original stored bytes synchronously,
  then writes without an await. Storage bytes detect B even before its auth event
  arrives. Exceptions stop auth-js before stale success notifications. No private
  auth-js patch, split userStorage, Google fetch alteration or Google write blocking.
- Real installed SDK regressions cover both sign-in and linking with a delayed
  stream, deferred reconstructed `Response.json()`, and a switch at the public
  storage boundary after SDK parsing/cloning/serialization. B remains persisted,
  no stale success event fires. Valid Telegram commits and concurrent Google writes
  also pass. These are not controller-only mocks.
- Official Telegram source inspected at
  https://oauth.telegram.org/js/telegram-login.js, SHA256
  `d39ccc2b14e8347778f5a7a1a6e53780268058894f6543832ae2f837149b749f`.
  Public methods are init/open/auth/close. `init` stores options/auth callback; it
  provides no native readiness promise/event. Native support arrives asynchronously
  via `oauth_supported`; calling auth earlier chooses popup. Native result fetching
  uses the current global callback after its await; close cannot cancel that fetch.
- Consequently direct Telegram login/link is external-browser-only. Known Telegram
  bridge/Mini App/UA/launch-parameter environments fail closed before SDK loading,
  after preparation and again at click. No private Login fields are read or written.
  UI instructs Telegram menu → Open in Safari/browser, with clean-URL copy/manual
  fallback (no tokens/query/hash). Plain external Safari remains allowed. A global
  WeakSet serializes controllers sharing the official popup SDK. Native login is
  intentionally not offered, avoiding native late-result reassignment on retries.

Remaining boundaries, not reasons to leave the reproduced race unfixed:

- A synchronous localStorage compare/write is not a distributed compare-and-swap
  across independent browser processes. A write between that comparison and write,
  an unseen A→B→identical-A transition, or a change after commit/before notification
  is not fully serialized here. This implementation blocks the reproduced awaited
  body/persistence window; it does not claim all cross-tab scheduling is solved.
  Cooperative browser locking/versioned storage would be a broader follow-up.
- Native host detection relies on observable public host signals. An unmarked
  embedded browser cannot be reliably identified; a newly injected host bridge
  after the click is outside this check. No real iOS/Android consent was tested.
- Server linking already dispatched may complete despite rejecting its local
  response. This does not roll back server identities or revoke issued sessions.
- The guard assumes the inspected auth-js flow and a synchronous storage adapter
  without separate userStorage. Re-run integrated regressions on SDK upgrades;
  do not replace storage with asynchronous persistence without redesigning commit.
- No deployment, provider setting change, SQL, secret change or real login occurred.

Remediation validation: **168 App tests / 14 files passed** (previous baseline 143),
App Svelte/TypeScript check **0 errors / 0 warnings**, isolated production build
passed (238 modules). Official Svelte MCP reports no issues/suggestions for the
new guidance component and the changed App integration excerpt (not a fresh
whole-App MCP audit). Offline real Chromium exercised the compiled guidance:
Safari instructions, clean-URL clipboard success, and manual fallback on clipboard
denial. It did not perform real provider consent or certify native-device behavior.

Browser acceptance (requires separately approved deployment and real user consent):

1. HTTPS site origin allowlisted; CSP permits the Telegram SDK/popup; COOP is absent
   or `same-origin-allow-popups`, not `same-origin`. Popup blocking must show failure,
   not navigate to the redirect fallback.
2. Google sign-in → Profile → link Telegram → verify the same Supabase UUID/business.
   Then logout → Telegram sign-in → refresh → verify the same account/business.
   Guest Telegram sign-in before linking may create a separate onboarding account.
3. Test cancel, blocked popup, duplicate click, account switch, existing identity,
   expired/invalid nonce and provider failure. No tokens/nonces in URLs or logging.
4. Verify external desktop/Safari popup login; Telegram mobile/WebView must show
  external-browser guidance and must not start direct auth. Native auth is disabled.

Local validation: 143 App tests across 12 files passed (`test:app`), `check:app`
reported zero errors/warnings, isolated App production build passed. The complete
App component was sent to official Svelte MCP: findings concern pre-existing unkeyed
loops/effects/date usage, not the Telegram edits; those unrelated sections were preserved.
Windows test invocation requires consistent canonical `D:/` drive casing.
An enabled-mode synthetic build also passed an offline Chromium App smoke: SDK
preparation/click, hashed nonce, cancel with zero Auth requests, one ID-token
exchange and generic rejection. All network requests were intercepted and PWA
registration mocked; no real provider login, popup consent or session was issued.

## Test activation — 2026-09-14

- User reported completing BotFather/Supabase setup and explicitly authorized step 3:
  deploy only the test App. Provider administrative settings remain independently
  unverified; the earlier non-followed authorize probe confirmed Telegram routing,
  callback, scopes and PKCE, not a successful code exchange.
- Built only merchant App with `PUBLIC_TELEGRAM_AUTH_ENABLED=true` in the build
  process environment, then restored that environment. Future builds must explicitly
  supply this flag; default local builds remain disabled.
- Deployed `letsrealtalk-app` version `a853c5b1-2c89-411c-a923-92585d18c855`
  at `https://letsrealtalk.com/app/`, using the App-specific config's historically
  named `production` environment. This is NOT the rakhunok production Worker.
- Previous test App version: `7cc1c2ed-a427-4c8c-983f-227ca85b38a8`.
- Existing API service binding and route preserved. No Auth configuration, secret,
  SQL, payment API, other Worker or production deployment changed by this operation.
- 108 App tests passed; typecheck zero errors/warnings; build and Wrangler dry-run
  passed. Live HTML, SW and all JS/CSS assets match the local build byte-for-byte.
  Browser shows enabled Telegram login and the existing Google login button.
- MCP post-deploy check confirmed all 14 other tracked test/production/shared
  Worker versions unchanged. No real login/linking or business writes performed.
- Pre-deploy review added two narrow guards: PWA controller changes reload only
  after an explicit update request in this tab; create/cancel mutations compare
  the captured user ID and generation after token acquisition, before dispatch.
  Request payloads and already-dispatched outcomes remain unchanged.
- Next: user signs in with Google, links Telegram from Profile, then tests logout,
  Telegram sign-in, same business access and page refresh. Do not start with guest
  Telegram sign-in for an existing unlinked business account.

2026-09-14: user explicitly authorized the Telegram session mechanism and required
changes to the shared Supabase Auth project. This supersedes the earlier proof-only
restriction, but does not authorize production frontend/Worker deployment.

## Implemented locally

- Genuine Supabase `custom:telegram` OAuth sign-in, using the App singleton with
  `flowType: 'pkce'`, SDK callback detection, persistence and automatic refresh.
- Explicit authenticated `linkIdentity` action for existing email-bearing accounts.
  Existing business users must sign in through Google, then link Telegram in Profile.
  Guest Telegram sign-in may create a separate user and lead to onboarding.
- Provider identities are used for UI status only. Merchant access still uses
  `merchants.user_id = session.user.id` and existing RLS. No notification-column
  matching, fabricated emails, admin impersonation, custom JWT or token store.
- Fixed callback `https://letsrealtalk.com/app/`; no user-controlled redirect.
  Entry is disabled unless `PUBLIC_TELEGRAM_AUTH_ENABLED=true` AND the browser
  origin is exactly `https://letsrealtalk.com`. This frontend gate is a rollout
  guard, not an authorization boundary for the shared Auth service.
- Callback errors display generic text rather than provider-controlled descriptions.
  Service worker excludes OAuth code/error URLs and App API traffic from caching.
- Google ID-token/nonce exchange remains unchanged. LAN HTTP login remains disabled.

This is Telegram OIDC consent login, **not automatic Mini App initData exchange**.
The older HMAC proof harness remains unwired and cannot issue sessions.

## Activation prerequisites — setup reference

1. In BotFather, configure the bot's **Telegram Login / Login Widget** client.
   Obtain its Login client ID and client secret (ordinary bot token is not enough).
   Register the exact Supabase callback in Allowed URLs:
   `https://mwaeazabpvbxqfrceogr.supabase.co/auth/v1/callback`.
   Enter secrets only in the provider's secure admin configuration, never chat,
   frontend environment variables, source control, or browser console.
2. In Supabase Authentication custom OAuth providers, verify hosted support/quota
   and create the OIDC provider with identifier `custom:telegram`, name `Telegram`,
   issuer `https://oauth.telegram.org`, scopes `openid profile`, `email_optional=true`,
   `pkce_enabled=true`, `skip_nonce_check=false`, and the BotFather Login credentials.
   Discovery: `https://oauth.telegram.org/.well-known/openid-configuration`.
   Telegram has no email claim or separate UserInfo endpoint; do not invent either.
   Supported administrative endpoint is `/auth/v1/admin/custom-providers`, not SQL
   writes to Auth internals. Preserve all existing Google/provider settings.
3. Enable **Manual Linking** and append the exact App redirect URL above to the
   existing Supabase redirect allowlist. Do not replace the allowlist or Site URL.
   Shared Auth configuration affects the project, including production clients.
4. Only after configuration, enable the public feature flag for a separately
   approved **test App deployment**. Never deploy `worker-rakhunok` or use the
   all-production deployment script for this task.
5. Verify real consent/cancel, existing Google account linking (same Supabase UUID
   and merchant), duplicate identity rejection, new-user onboarding, refresh,
   logout and Telegram mobile-browser redirect return on HTTPS. No business writes
   are required to verify authentication.

No provider credentials were available during the initial implementation. The user
subsequently reported configuring the provider; the test deployment is recorded above.
No real login has been verified. Automated SDK mocks do not prove hosted activation.

References: https://supabase.com/docs/guides/auth/custom-oauth-providers and
https://core.telegram.org/bots/telegram-login.

## Local validation

- App: 74 tests passed; type checks zero errors/warnings; production build passed.
- Existing independent Mini App proof suite: 42 tests passed.
- Full Svelte MCP checks run after changes; remaining App loop/effect suggestions
  concern existing unrelated code. LoginOptions has no findings.
- LAN browser: Telegram button and accurate inactive-provider explanation verified;
  Google retains secure-context guidance. No genuine OAuth login was attempted.
- App account-change generation fences now suppress stale UI completions and clear
  old invoice/voice/preview dialogs on logout or identity changes. Six helper tests
  cover fencing; mounted-App/live account switching is still unverified. The fences
  now also bind mutation token acquisition to the captured user and generation.
  Same-account auth refresh can suppress pending UI results; refresh history
  before retrying an uncertain order. Existing backend/RLS remains authoritative.