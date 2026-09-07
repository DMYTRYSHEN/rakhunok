# Landing refresh — local preview

Baseline: `6b4b28409d5161c4703e5796146686e94c642f45`.
Exact pre-edit backup: `D:\svetle\corex-landing-backup-20260907-192031`.

Only the root route was modified; the original `LandingPage.svelte`, its components,
translations and `landing.css` are unchanged. The refresh uses `RefreshedLanding.svelte`,
`refresh.css`, `data/refresh-copy.ts` and `utils/cost-comparison.ts`.

To roll back on request, restore `src/routes/+page.svelte` from the backup's
`+page.svelte`. This switches back to the original landing and stylesheet, including
its original theme behavior and metadata. The new, unused files can remain or be
removed separately. Do not reset the repository or overwrite deployment changes.

No deployment, database migration, dashboard behavior or payment API was changed.

## Studio iteration

The richer Apple-inspired iteration uses `StudioLanding.svelte`, `studio.css`,
`studio/*` and `data/studio-copy.ts`. Both previous landing component trees remain
unchanged. The light refresh route is backed up in
`D:\svetle\corex-landing-refresh-backup-20260907\+page.svelte`.
Restore that route for the light refresh, or the original backup above for the
original landing. Do not reset unrelated changes. No remote deployment is included.

## Baseline iteration — 2026-09-07

The `/promo` route uses `BaselineLanding.svelte` and `baseline/*`: fourteen
sections, original dark/lime visual foundation, three-step local sandbox,
industry tabs and a full-cost ROI calculator. Copy and design decisions are
recorded in `LANDING_BASELINE_BRIEF.md`; colors and typography live in
`baseline/tokens.css`. Prior component trees remain available unchanged.

The Studio route backup is
`D:\svetle\corex-landing-studio-backup-20260907\+page.svelte`.
Restore that route for Studio or the original backup above for the original.
Only restore on request; never reset unrelated deployment work.

Claims: the NBU's ten-second figure applies to eligible instant SEP transfers,
not Rahunok checkout latency. Fiscal integrations and bank availability require
confirmation. Sandbox interactions make no payment requests. Existing company
details are preserved and still require owner verification before publication.

Local QA: production build, landing unit tests, official Svelte component
validation, UK/EN/PL layouts at 320/375/768/1440px, sandbox progression/reset,
keyboard tabs/menu, ROI invalid/negative cases, FAQ, reduced-motion and pause.
No deployment, auth/payment API, dashboard or database changes are included.

## Route split — 2026-09-07

At the user's request, `/` is restored to the exact initial route from
`corex-landing-backup-20260907-192031` (verified equal after line-ending
normalization). The latest Baseline version remains available at `/promo`.
Its image import accounts for the deeper route, and canonical/Open Graph URLs
include `/promo`. Existing production hostname configuration is unchanged.
Both routes pass the local static production build and Svelte checks.