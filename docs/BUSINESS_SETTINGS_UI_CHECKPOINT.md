# Business settings UI — checkpoint 2026-09-08

This page preserves the historical UI/local persistence checkpoint. The later separately authorized
DAC7 migration and Dashboard-only deployment are recorded in the
[2026-09-09 rollout evidence](BUSINESS_SETTINGS_ROLLOUT_20260909.md). The full normal root build
subsequently passed after the authorized local Wrangler 8787 stop. Production smoke remains ongoing;
authenticated real-JWT browser save has not been tested. Earlier no-deploy/no-remote statements below
describe those earlier phases, not the current rollout state.

## Restore point

- Source: `D:\svetle\corex`.
- File snapshot: `D:\svetle\corex-ui-checkpoint-20260908-144741`.
- Base HEAD: `ae9f2036b840d26f9933bbd858422b4fa2232f64`.
- Snapshot includes tracked and non-ignored untracked files, including pre-existing local changes.
- All copied file hashes verified before UI edits. No Git reset, commit, push or deployment.
- Ignored dependencies, build caches, secrets and local database state are not backed up.
- To restore, compare/copy affected source files from the snapshot; remove only files introduced
  by this UI slice. Do not reset unrelated checkout, landing, gateway or deployment work.

## Approved product model

- Business/brand contains legal sellers (TOV/FOP); VAT is independent of legal form.
- Each seller has independent invoice rules and a separate provider seller identifier.
- Business has one active acceptance mode: direct or financial company.
- Financial-company recipient details never replace the legal seller's own details.
- No fallback to another seller's provider ID or a different payment route.
- Structure owns identity/tax information; invoice-rules owns numbering/purpose drafts;
  payment-methods owns acceptance and seller connections.
- Issued invoice/attempt snapshots, server numbering, provider verification and settlement
  status ingestion require a subsequent backend slice.

## This implementation scope

Local UI prototype with explicitly labelled, user/merchant/demo-scoped browser drafts.
No automatic migration of legacy global settings. No new settings applied to real invoice
payloads, payment routing, QR serialization or terminal TTL. No schema/remote changes.
Existing merchant is displayed as business context; existing entities are legal sellers.
Additional persisted business/brand hierarchy remains a backend prerequisite.
Provider references are drafts, never proof of activation; no secret input fields.
Existing card/wallet onboarding stays disabled.

## Local validation — continuation 2026-09-08

- `npm run check`: 0 Svelte/TypeScript errors, 0 warnings.
- `npm run test:unit`: 374 tests passed across 38 files.
- Five Chromium scenarios passed using `playwright.business-ui.config.ts` against the
  existing localhost:5173 Vite server: independent seller VAT/rules/provider IDs with reload,
  unsaved-navigation guard and cross-tab conflict, mobile widths, draft-only invoice preview,
  and the existing Device Event Gateway view.
- Fixed seller-list-driven workspace remounts that discarded unsaved drafts.
- Fixed Svelte interpolation of regex quantifiers in all three HTML pattern attributes;
  quoted attribute values had converted `{4}` to `4` and blocked valid form submission.
- Invoice draft preview refreshes on scoped storage events and window focus; it never changes
  the actual invoice fields or payment payload.
- Full build was attempted but adapter-static could not remove `build` (Windows EBUSY).
  Existing local Wrangler processes were left running. No successful full-build claim;
  deployment remains prohibited until a clean full build and separate approval.
- No commit, push, remote schema changes, payment activation or deployment in this continuation.

## Historical pre-rollout persistence continuation — 2026-09-08

The initial local-only scope above is historical. Account-mode UI now uses an atomic Supabase
RPC repository; demo remains local. At this checkpoint, SQL existed only as a candidate and was not
installed remotely; an account connected to a database without these RPCs shows an explicit
unavailable-schema error.
Finance-company purpose rules are editable and preview-only. No existing payment behavior changed.
Evidence: 395 unit tests, 202 PGlite tests, 5 focused browser scenarios, Svelte check 0/0.
Real PostgreSQL concurrency subsequently passed: 216 tests on a separate clean local cluster.
Remote rollout was still approval-gated at this checkpoint; see the
[persistence documentation](BUSINESS_SETTINGS_PERSISTENCE.md) for the subsequent authorized rollout,
contract and continuing limitations.

## Error-page design entry points (unchanged)

- No custom root SvelteKit error boundary exists yet. A future root `src/routes/+error.svelte`
  can provide branded 404 and application error screens; fallback fatal HTML is a separate layer.
- Dashboard loading/failures: `src/lib/features/dashboard/auth/DashboardStateScreen.svelte`.
- Pay loading/not-found/offline visuals: `apps/pay/src/lib/components/StateScreen.svelte`;
  payment status visuals: `apps/pay/src/lib/components/StatusScreen.svelte`.
- Worker-level responses are separate from Svelte screens. Designing these pages must preserve
  HTTP status codes and distinguish not-found, denied, offline and server failure.
- Error pages were inspected, not redesigned in this UI slice.