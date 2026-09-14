# Telegram Mini App authentication — local proof stage

Historical proof-stage report. The user subsequently approved shared Auth changes
for real Telegram sessions; current implementation and activation blockers are in
[TELEGRAM_APP_SESSIONS.md](TELEGRAM_APP_SESSIONS.md). The proof harness below remains
unwired and still issues no sessions.

Status: **local only, not activated**, 2026-09-14. User explicitly chose verification
and tests without real session issuance. No deployment, Supabase provider change,
migration, account creation, message sending, or existing App auth modification.

## Implemented boundary

- `worker/src/telegram-auth-verifier.ts`: server-only Mini App `initData` HMAC
  verification. Uses pinned `@tma.js/init-data-node` 2.0.8 for official bot-key
  derivation and WebCrypto `verify` for signature comparison. The predecessor
  `@telegram-apps/init-data-node` is deprecated and is not retained.
- Maximum raw input 8192 bytes / 32 fields; strict URL decoding, unique decoded
  names, no canonical-string newlines/NUL. All fields except `hash` participate
  in HMAC, including optional `signature` (not the Ed25519 validation algorithm).
- Signed `auth_date`: maximum age 300 seconds, future skew at most 30 seconds.
  Requires a positive safe-integer user ID and rejects bot identities.
  JSON is decoded using standard `JSON.parse` after signature verification;
  it is not a lossless JSON-number or duplicate-member validator.
- Returns an immutable identity proof with Telegram ID, expected bot ID and
  validity window. No names, username, merchant ID, Supabase UUID or tokens.
- `worker/src/telegram-auth-local.ts`: **unwired function harness**, not a running
  endpoint. Intentionally no Wrangler deployment configuration or router import.
  Accepts only HTTP loopback POST `/app/api/auth/telegram`, exact matching Origin,
  no query string, `text/plain` raw initData and explicit local enable flag.
  Body reading has a byte limit, work budget and two-second timeout.
- Valid proof returns JSON503 `session_bridge_not_configured`, never login
  success. Invalid proof returns generic JSON401. Responses use `no-store`;
  no cookies, CORS access, logging, network calls or Supabase calls.
- Configuration is passed directly to the local harness: `TELEGRAM_AUTH_LOCAL_ENABLED`,
  `TELEGRAM_AUTH_BOT_ID`, `TELEGRAM_AUTH_BOT_TOKEN`. No real credentials are loaded
  by tests. Never expose a bot token in frontend variables or send initData in URLs.

## Validation

- `npm --prefix worker run test:telegram-auth:local`: **42 passed**. Synthetic
  fixtures signed independently with Node crypto; tampering, wrong bot, expiry,
  malformed/duplicate input, body streaming, origins and non-issuance covered.
- `npm run test:app`: **44 passed**.
- `npm run check:app`: **0 errors, 0 warnings**.
- Runtime dependency audit: **0 vulnerabilities**. Full worker audit still
  reports three existing high-severity entries in the Wrangler → Miniflare →
  sharp development chain; these existed before the new dependency. No unrelated
  toolchain update was performed. See https://github.com/advisories/GHSA-rgj7-g3m4-5g8c.

## Required before real login

1. Establish an isolated test Supabase Auth environment, or obtain explicit
   approval for shared Auth changes. Test and production currently share Auth.
2. Design and review a genuine supported Supabase session exchange, preserving
   SDK refresh/persistence and existing owner/RLS checks. Mini App initData is
   **not** a Supabase ID token. No handcrafted session/JWT or fabricated email.
3. Create a trusted unique Telegram-ID ↔ Supabase-user association through an
   explicit authenticated linking flow. Never link by username, name, guessed
   email or legacy notification/chat columns. Plan collisions, revocation and
   account recovery.
4. Add atomic durable replay consumption, rate limits and appropriate CSRF /
   request binding before session issuance. Current proof verification is
   intentionally stateless and **does not prevent replay**.
5. Add a separate private auth backend, not the invoice delivery Worker. Do not
   fall back to the shared API when authentication is unavailable.
6. Only then wire App's official Telegram SDK and raw `initData` transport,
   preserve Google browser login, and test actual mobile Telegram sessions,
   account switching, sign-out, refresh and service-worker cache exclusion.

The local App now displays a Telegram button with an explicit “not activated”
label. Clicking only expands the explanation; no SDK loading, network request,
session issuance or auth-state change occurs. Google initialization checks secure
context/WebCrypto first: HTTP LAN addresses show HTTPS/localhost guidance instead
of a misleading reload error. App tests after this UI change: **49 passed**;
App type check: **0 errors, 0 warnings**. Dashboard and production deployment
configurations remain unchanged.