# Checkout Worker rollout plan

## Prepared architecture

- Worker: `letsrealtalk-checkout-preview`; production name: `letsrealtalk-checkout`.
- Static source: `apps/checkout/dist` produced by `npm run build:checkout`.
- Backend calls use the `API -> rahunok` Service Binding.
- The Worker owns checkout UI aliases, checkout API calls, banks, and logos only.
- Edge hydration resolves the route identifier through `GET /api/v1/checkout/:id`, injects `window.__INITIAL_ORDER__`, and marks successful responses with `X-Edge-Hydration: HIT`.
- Hydrated HTML is `no-store`; static CSS, JS, images, and bundled bank data remain asset responses.

## Route ownership

| Surface | Routes |
| --- | --- |
| Checkout shell | `/checkout`, `/checkout/`, `/checkout/?id=...` |
| Order aliases | `/o/:id`, `/pay/:id` |
| Terminal aliases | `/t/:id`, `/tag/:id`, `/pos/:id` |
| Payment API | `/api/v1/checkout/*` |
| Checkout catalogs | `/api/v1/banks*`, `/api/v1/logos*` |

The broader `letsrealtalk-web` route remains the fallback. The checkout Worker rejects paths outside this matrix. `rakhunok.com` is not changed.

## Rollout

1. Run `npm run check:checkout`, `npm run test:checkout`, and `npm run build:checkout` from `corex`.
2. Run the Worker route tests: `node --test worker/src/checkout.test.mjs`.
3. Validate packaging with `npm --prefix worker run check:checkout`.
4. Deploy preview only: `npm --prefix worker run deploy:checkout:preview`.
5. Test demo, missing, UUID, short ID, order number, terminal, tag, POS, and pay alias flows on the preview URL. Confirm payment initiation and status polling use the Service Binding.
6. Compare mobile screenshots and network traces with the current checkout. Confirm no duplicate order GET when `X-Edge-Hydration: HIT` is present.
7. Deploy production with `npm --prefix worker run deploy:checkout:production` only after approval.
8. Smoke-test every route above plus `/`, `/app/`, `/dashboard`, and `rakhunok.com`. Roll back the checkout Worker version if any checkout regression appears.

## Remaining gates

- Validate real pending orders and bank deep links in an authorized test transaction.
- Verify terminal/table Realtime replacement on a live terminal.
- Decide whether `banks` and `logos` should remain owned by checkout if another frontend starts depending on the same apex routes.