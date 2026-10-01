# DAC7 Dashboard Design Snapshot

Independent local copy of the earlier Dashboard-derived DAC7 interface, preserved
from `apps/platform/src/lib/dac7`. The current Platform application is unchanged.
Components are copied, not imported from Platform, so the designs can evolve separately.

## Local Use

From the repository root:

```sh
npm run dev:dac7
npm run check:dac7
npm run test:dac7
npm run build:dac7
```

Open `http://127.0.0.1:5194/dac7/`. The default role is `platform`.
Use `?role=seller`, `?role=business`, `?role=gov`, `?role=admin`,
`?role=dev`, `?role=sso` or `?role=passport` to inspect another cabinet.
Bare `/dac7` redirects to `/dac7/`, preserving query parameters.

## Boundaries

This preserves the earlier design and prototype behavior, not the newer Platform
E1-E7 workflows. It always supplies a null client to the legacy gateway and runs
in demo mode. No real authentication, filing or payments are enabled. Legacy tax
figures, legal copy, identity checks and successful payment states are illustrative,
not verified rules or evidence. Local role preferences are not authorization.

The dedicated local port isolates browser storage from Platform's local server.
Do not host both on the same origin without reviewing legacy storage keys.
Build output is confined to `apps/dac7/dist`. No Worker or deployment is configured.