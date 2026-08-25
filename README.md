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
