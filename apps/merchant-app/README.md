# Rahunok Merchant App

Standalone Svelte 5 PWA served from the canonical `/app/` path. The same build runs as an installable PWA, a regular mobile web app, and inside Telegram WebApp when that host API is available.

## Commands

Run these from `corex`:

```sh
npm run dev:app
npm run check:app
npm run test:app
npm run build:app
```

The production artifact is emitted to `apps/merchant-app/dist` and keeps its JavaScript and CSS bundles separate from the main site.

## Current scope

- Fixed, table, and free-amount UI flows
- Safe addition and subtraction calculator
- Optional Telegram host initialization and haptics
- Installable PWA with standard and maskable PNG icons
- Network-first service worker with navigation-only offline shell fallback
- User-controlled service worker updates and visible offline state
- No Supabase dependency in the initial bundle
- No financial writes until session, merchant ownership, and exact-once submission are wired

The service worker does not cache `/api/` or authentication requests. A waiting worker is activated only after the user accepts the in-app update prompt, avoiding an automatic reload during payment entry. Telegram `initData` must be validated by a trusted backend before it can establish identity.