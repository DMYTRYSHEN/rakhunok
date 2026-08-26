# Checkout architecture

## Goal

Keep the current checkout design and payment API while making the first useful
screen deterministic, fast, and extensible by scenario configuration.

## Runtime path

1. The Worker resolves the public route and injects `window.__INITIAL_ORDER__`.
2. The HTML paints a lightweight loading state immediately.
3. Injected data renders without a duplicate client-side order lookup.
4. Direct static/local requests hydrate from Supabase as a compatibility path.
5. Missing real orders render an explicit error; demo data requires `sc` or a
   `demo-*` ID.

## Scenario contract

`js/scenarios.js` contains JSON-compatible definitions. Each scenario declares:

- `screen`: initial UI screen;
- `pendingScreen`: optional waiting screen;
- `aliases`: accepted route/API names;
- `requiresAmount`: whether a zero amount means the scenario is not ready.

The Worker may inject additions as `window.__CHECKOUT_SCENARIOS__`. Definitions
contain data only; payment, delivery, and live-table behavior remains in tested
JavaScript handlers.

## Incremental migration

1. Done: loading/error shell, edge-data fast path, scenario registry, and removal
   of implicit demo financial data.
2. Done: order resolution uses the Worker checkout API; direct browser Supabase
   reads remain only for lazy table realtime updates.
3. In progress: bank data and reCAPTCHA now load only after payment interaction.
   Next, split table live updates, delivery, bank selection, and payment status
   into independently loaded controllers.
4. Next: remove the duplicate legacy `js/app.js` path after route-level regression
   coverage confirms that it is unused.