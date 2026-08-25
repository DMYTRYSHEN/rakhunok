# Existing Worker API Contract

## Rule

The active handlers in `../core/worker/src` are the API source of truth. Corex may add typed clients and tests, but must not change routes, methods, payloads, headers, status values, or authentication semantics during frontend migration.

## Public Endpoints

```text
GET  /api
GET  /api/v1/health
GET  /api/v1/auth/config
POST /api/v1/auth/demo-session
GET  /api/v1/banks
GET  /api/v1/banks/:code
GET  /api/v1/logos
GET  /api/v1/checkout/:id
POST /api/v1/checkout/:id/event
GET  /api/v1/checkout/:id/events
POST /api/v1/checkout/:id/initiate
POST /api/v1/checkout/:id/pay
GET  /api/v1/checkout/:id/status
POST /api/v1/checkout/:id/apply-promo
POST /api/v1/checkout/:id/delivery
POST /api/v1/webhooks/simulate
POST /api/v1/webhooks/:bankCode
```

Webhook endpoints are listed for completeness and are not browser client responsibilities.

## Authenticated Merchant Endpoints

These routes require the current Supabase bearer JWT behavior:

```text
GET   /api/v1/merchant/me
PUT   /api/v1/merchant/me
POST  /api/v1/merchant/onboarding
GET   /api/v1/orders
POST  /api/v1/orders
GET   /api/v1/orders/:id
PATCH /api/v1/orders/:id
GET   /api/v1/stats/summary
```

## Edge Checkout Contract

For checkout routes, the Worker can serve the checkout asset after injecting:

```js
window.__INITIAL_ORDER__;
window.__INITIAL_BANKS__;
```

Legacy checkout also checks `window.__INITIAL_TERMINAL__`. Corex must read injected values before issuing duplicate requests.

## Direct Supabase Browser Contract

POS and dashboard behavior currently depends on browser-side Supabase Auth, PostgREST, RLS, and Realtime. The migration must preserve this trust boundary. Do not move these calls into privileged SvelteKit server code.

Observed tables include:

```text
merchants
business_entities
terminals
bank_accounts
orders
order_events
```

The checked-in SQL is incomplete relative to runtime usage. Types must initially reflect observed Worker/frontend responses and should not be used to modify production schema.

## Local API Rule

Corex application code should use relative `/api/v1/...` URLs. The SvelteKit/Vite development server will proxy `/api` to `http://localhost:8787`; production continues to use the same-origin Worker routes.

## Known Contract Mismatches

- Landing calls `/api/leads`, but the active Worker has no matching route.
- OpenAPI documents and active Worker routes are not fully aligned.
- Legacy code and checked-in SQL disagree on some status values and fields.
- Both `rakhunok.com` and `letsrealtalk.com` appear in legacy URL generation.

Record these mismatches in tests and migration notes. Do not silently correct them by changing Worker or Supabase.
