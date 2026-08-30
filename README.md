# Corex

`corex` is the clean Svelte 5 / SvelteKit migration target for the existing application in `../core`.

## Requirements

- Node.js `22.13+` (below 23), or Node.js `24+`
- npm 10+

## Local setup

```powershell
npm ci
npx playwright install chromium
npm run dev
```

The development server prints its local URL. Use `npm run build` to generate the static application in `build/` and `npm run preview` to inspect that build.

For production, configure `PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_ANON_KEY` in the
deployment environment or the ignored local `.env`, then run:

```powershell
npm run deploy:production
```

The command validates the public configuration, builds once, checks both Worker packages, and
deploys the root Worker before the Dashboard Worker so their HTML and `/_app` assets stay aligned.

Dashboard invoice and onboarding requests use the same-origin `/api` path. During local development, run the existing Worker in a second terminal so Vite can proxy those requests to port `8787`:

```powershell
npm run dev:worker
```

Keep Worker secrets in its ignored local secret file or Wrangler secret storage. Never place service-role keys or telemetry tokens in a tracked Wrangler configuration.

### Invoice database scenarios

`npm run test:invoice-db` provisions or updates one dedicated Auth user and merchant, then verifies fixed, itemized, delivery, and table invoices against the real Worker and database. Every created invoice is cancelled through the Worker and deleted during cleanup; the marked test merchant remains available for repeat runs.

The runner refuses to write unless `ALLOW_TEST_DATABASE_WRITES=1`, the declared project ref matches `TEST_SUPABASE_URL`, and the merchant email or name contains `test`, `staging`, or `qa`. Configure the `TEST_*` values from `.env.example` in the current terminal without committing credentials, start the Worker with `npm run dev:worker`, and then run:

```powershell
npm run test:invoice-db
```

Set `TEST_KEEP_ORDERS=1` only when retained test records are deliberately required for manual inspection.

## Validation

Run the complete local gate before opening a pull request:

```powershell
npm run lint
npm run check
npm run test:unit
npm run test:e2e
npm run build
```

## Structure

```text
src/
├─ lib/features/
│  └─ landing/       # Current migrated landing feature
└─ routes/            # Thin SvelteKit route composition
docs/
├─ BASELINE.md        # Legacy behavior inventory
├─ DASHBOARD_AUDIT.md # Dashboard behavior, UX, and Tailwind specification
├─ ROUTES.md          # Preserved URL contracts
├─ API_CONTRACT.md    # Existing backend boundary
└─ MIGRATION_PLAN.md  # Sequenced migration roadmap
```

Keep product domains independent as they are migrated:

- `features/landing`
- `features/dashboard`
- `features/checkout`
- `features/app`

Routes should compose these features instead of owning product behavior.

## First repository push

Create an empty remote repository without a generated README, license, or `.gitignore`, then run:

```powershell
git remote add origin <repository-url>
git branch -M main
git push -u origin main
```

Do not commit environment files or credentials. Local `.env*` files are ignored; add only sanitized examples such as `.env.example` when configuration is introduced.

## Migration constraints

The current production implementation remains in `../core` and is the behavioral reference. During migration:

- do not modify `../core/worker`;
- do not modify `../core/db` or the production Supabase schema;
- do not deploy with Wrangler;
- do not replace `../core/dist` until full parity is verified and explicitly approved;
- preserve existing URLs, API payloads, authentication, RLS behavior, polling, Realtime, QR generation, and bank deep links.

The canonical migration roadmap is [docs/MIGRATION_PLAN.md](docs/MIGRATION_PLAN.md).
