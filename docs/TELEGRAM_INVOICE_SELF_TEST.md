# Telegram invoice self-test — local implementation

## Local activation update — 2026-09-14

User separately authorized local configuration and one real test, using the same recipient
as existing Telegram message templates. Local loopback Worker 8787 now runs through the
Git-ignored `.dev.vars.telegram-local.mjs` launcher: existing credentials are read locally,
Supabase public settings mapped in memory, and the approved actor/chat fixed server-side.
No deployment or tracked secret configuration changes were made.

Readiness POST without bearer returned 401 after settings validation. The shared authenticated
browser subsequently showed **Telegram прийняв картку** for the user's selected invoice,
with repeat-send disabled. The user completed that interaction while setup was finishing;
the agent did not issue another send. Telegram acceptance is not proof of receipt/read/payment.
The earlier activation notes below describe the pre-activation checkpoint. Local sending
depends on this launcher remaining running; deployed environments are still not configured.

## User flow

Dashboard → Public page → Telegram message modal → **+ Виставити рахунок**.
Select an existing pending fixed UAH invoice, inspect its amount/purpose, and explicitly
choose **Надіслати собі в Telegram**. The classic fixed-invoice creation link is provided;
after creating an invoice, return and refresh the list. This composer does not create orders.

Telegram receives a branded 1000×600 emerald PNG with the canonical invoice number,
exact amount, legal recipient, Kyiv issue/expiry dates, original logo and local QR.
The authenticated read-only preview uses the same canonical metadata; send revalidates it.
The QR and inline **Відкрити рахунок** button use the same trusted short checkout URL.
Expiry shown is min(invoice expiry, server now + 72 hours), a presentation limit only:
the stored invoice expiry is not changed. The caption states this limitation. This is sendPhoto,
not Telegram Payments, Apple Cash, Apple Pay, or arbitrary HTML rendered by Telegram.

## Historical pre-activation checkpoint

At this checkpoint no deployment, remote configuration, real order creation or Telegram message was performed.
The endpoint fails closed until the API Worker has all required settings:

| Setting | Purpose |
| --- | --- |
| `TELEGRAM_INVOICE_SELF_TEST_ENABLED` | Exactly `true`; absent/other values disable delivery |
| `TELEGRAM_INVOICE_TEST_USER_ID` | One verified Supabase auth user UUID |
| `TELEGRAM_INVOICE_TEST_CHAT_ID` | Operator-verified positive private Telegram chat ID |
| `TELEGRAM_INVOICE_PUBLIC_ORIGIN` | Exactly `https://letsrealtalk.com` for test or `https://rakhunok.com` for production |
| `TELEGRAM_BOT_TOKEN` | Bot credential; configure securely, never in browser code |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY` | Existing trusted Supabase configuration |

Operator must independently verify that the configured chat belongs to the intended tester
and that the tester started the bot. Local profile verification is not sufficient proof.
Dashboard assets and the API Worker both require separately approved rollout. Do not deploy
the entire dirty working tree indiscriminately. Local Vite forwards to port 8787; no Worker
was listening there during the browser validation. No authenticated end-to-end live send
has been certified.

## Contract and boundaries

- Browser POST `/dashboard/api/v1/telegram/invoices/send`; Dashboard forwards to
  `/api/v1/telegram/invoices/send`. Bearer plus body containing **only** `order_id`.
- Server verifies Supabase identity, configured test user, canonical order ownership and
  merchant owner using caller-JWT reads. No service-role bypass or client recipient/amount/URL.
- Requires fixed, pending, unexpired UAH invoice, no split/partial payment and exact cents:
  base + delivery − discount = total. Server constructs the checkout URL.
- No invoice/payment mutation, automatic retry, bank integration or buyer messaging.
- Success means Telegram accepted the message, not read receipt or payment confirmation.
- Ambiguous delivery requires checking the chat before an explicitly confirmed retry.
  Sent/uncertain invoice IDs survive modal/composer reopen within the same keyed public-page
  instance. Reload/navigation/account changes reset this memory. No durable deduplication,
  outbox or rate limiter exists: repeated requests can send duplicates.
- Invoice state may change after verification; image is a snapshot, checkout remains authority.
- Demo uses synthetic data without feature API requests, callbacks, real payment links or
  feature storage writes. Existing SDK startup may perform a temporary storage capability probe.
- Legacy notification/verification endpoints remain separate and are not secured by this work.
  General buyer delivery needs verified opt-in/chat binding and durable delivery controls.

## Local evidence

- Final redesign: 438 Worker tests and 217 focused client/proxy/scope/gateway tests passed;
  Svelte check zero errors/warnings. QR decoding verified at full and half image size.
- Authenticated read-only local preview returned 200 with canonical legal recipient and short URL.
  No additional Telegram send, deployment or invoice mutation during redesign validation.
- Backend: 356 tests passed across Telegram, index/writes, Dashboard, Checkout and Corex suites.
- Focused client + gateway: 103 tests passed; Telegram client contributes 72.
- Direct Svelte check: zero errors/warnings; official Svelte autofixer clean for integration.
- Full-page demo Chromium at 1440/390px: no API calls, remote attempts, page errors or overflow.
- Synthetic reopen tests cover successful-send lock, invoice-specific uncertainty, confirmation
  reset and keyed-account reset. No real credentials, sends or external calls used.
- Full frontend suite previously reported one pre-existing stale public-page draft expectation;
  it was not silently changed as part of this feature.
