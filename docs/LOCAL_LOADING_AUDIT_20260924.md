# Local Loading Audit - 2026-09-24

## Running Services

- Unified entry: http://localhost:5173
- Dashboard: /dashboard; Corex: /corex; App: /app/; Conf: /conf/; Pay: /pay/
- Worker: http://127.0.0.1:8787; GET /api/v1/health returned 200.
- Internal Vite ports: Pay 5174, App 5175, Conf 5176.
- Root Vite was started through createServer with an in-memory /app proxy override to 5175. No persistent configuration was changed. Normal npm run dev still uses the existing conflicting /app target of 5174.
- Bare /pay returns 404 from Vite's /pay/ base handling. /pay/ returns 200. Permanent routing changes remain proposed, not implemented.
- Root /api still targets letsrealtalk.com; /dashboard/api targets the local Worker. Local hosting does not imply all data traffic is local.

## Method And Limits

Chromium via Playwright, desktop 1440x900 and mobile-width 390x844. Cold browser cache was explicitly cleared for the final Dashboard, Corex and Pay runs and for the preceding App/Conf run. Warm measurements reused each context. Servers were already compiled for the final measurements. These are individual lab observations, not medians or p75, with no network or CPU throttling.

Navigation Timing, Paint Timing and PerformanceObserver supplied the measurements. LCP is the last observed candidate in the finite sampling window. CLS below is an observed load-window sum, not a full session-window implementation. No Chrome performance trace, Lighthouse score, INP, authenticated workspace timing, or real payment timing was collected. Mobile-width checks are not physical mobile-device benchmarks.

Initial root dev requests took 30-43 seconds before HTML while Vite compiled and re-optimized dependencies. Logs showed additional optimizer reloads for icons, Supabase, XYFlow and Mermaid. Earlier samples that captured only loading screens or crossed automatic reloads are excluded from the final table. An early text-based readiness predicate was unreliable; final Dashboard/Corex checks waited for the visible Rahunok login heading instead.

## Observed LCP

| Page | Desktop cold cache | Desktop warm cache | Mobile width, warm | Observed content |
| --- | ---: | ---: | ---: | --- |
| Dashboard | 2.216 s | 0.476 s | 0.416 s | Guest login |
| Corex | 1.724 s | 0.580 s | 0.572 s | Guest login |
| App | 6.528 s | 2.760 s | 2.664 s | Guest login |
| Conf | 2.728 s | 2.052 s | 1.756 s | Guest login |
| Pay /pay/ | 3.696 s | 1.292 s | 2.196 s | Invoice not found, no invoice ID |

All five slash-correct routes returned 200 with no pageerror in the final runs. No horizontal document overflow was observed. Observed layout shift sums were 0-0.0283. Google Identity button requests repeatedly returned 403; the integrated browser reported that the origin is not allowed for the configured client ID. Login functionality is not certified by this audit.

## Prioritized Proposals

1. **Make local startup deterministic.** Reserve 5174 for Pay, 5175 for App, 5176 for Conf and update the root App proxy accordingly. Add a reproducible start command and health checks. Normalize bare /pay without changing invoice-specific URLs. Current session-only overrides must not be mistaken for a permanent fix. Expected impact: eliminate routing failures; latency gain is not quantified.
2. **Reduce icon entry-point imports, high dev impact.** Dashboard fetched a 17,053 KiB decoded Hugeicons module plus a 6,876 KiB Lucide module before login. App and Conf fetched roughly 6,896/6,965 KiB Lucide modules. DashboardShell imports the Hugeicons package root; merchant AccountIdentityGuidance and several Conf components import the Lucide package root. Use supported per-icon entry points or a measured bundler strategy, preserving icons and behavior. These observed dev modules define the optimization opportunity, not guaranteed savings or production payload size. Production tree-shaking must be measured separately.
3. **Defer authenticated tools until needed, high impact candidate.** CorexPage statically imports ReleaseFlowCanvas, which imports XYFlow and the diagram/editor surface. A guest received a 1,026 KiB XYFlow module and a 722 KiB transformed canvas module. Conf App statically imports BankManager before authentication. Merchant App imports QR, voice and payment UI at startup. Split these at existing authorization/view boundaries and preserve session validation, rendering behavior and failure recovery. Measure before/after; exact savings are not established.
4. **Move root fonts off the external critical path, medium impact candidate.** One initial Google Fonts stylesheet request took 2.511 s. Corex explicitly loads external Manrope and Outfit stylesheets. Consider self-hosted subset WOFF2 and preload only actually critical weights. Pay already self-hosts/preloads Manrope; do not duplicate that work. The observed request duration is not a proven equal LCP saving.
5. **Render useful initial HTML without waiting for all JS.** Pay currently has an empty #app in index.html and requires module execution even to display the no-invoice state. Evaluate a small semantic loading shell or appropriate prerendering without inventing invoice data. Skeleton paint is not checkout readiness; instrument both separately. Authentication and invoice scenario changes require their own approval.
6. **Separate dev speed from release speed.** Validate production builds in an isolated local preview, then inspect compressed critical JS/CSS, cache headers and request waterfalls. Do not replace the running root build or deploy as part of this proposal. Consider Vite dependency warmup only after reducing the eager graph and reproducing optimizer reloads.
7. **Fix the local OAuth origin configuration separately.** Authorize the exact intended localhost origin with the provider owner; do not bypass auth or treat a rendered Google button as successful login. This is a functionality prerequisite, not a quantified performance optimization.

## Acceptance Targets

Suggested local warm-navigation target: useful shell within 100-200 ms, meaningful ready view within 500 ms where data dependencies permit. These are proposed budgets, not guarantees of instant loading. Production acceptance should use p75 LCP <= 2.5 s, INP <= 200 ms and CLS <= 0.1, separated by mobile/desktop and supplemented by authenticated ready-view timings. Reference: https://web.dev/articles/vitals.

## Implemented Loading Scope - 2026-09-24

The user separately approved loading-only changes for fixed, open_amount, table and delivery. No API, database, authentication contract, amount authority, status semantics, public links or scenario identity was changed by this performance scope. No deployment or commit was performed.

- Merchant login uses six per-icon Lucide entry points instead of its package barrel. Icons remain visually unchanged.
- Merchant payment UI loads after authentication; speech permission helpers load on profile entry or voice interaction, and the parser loads on voice interaction. Session and voice-attempt guards reject stale continuations. Permission/module failures expose retry feedback.
- Merchant QR imports qrcode only for a nonempty value. Detached-canvas rendering and effect cleanup prevent outdated asynchronous results from replacing the current QR.
- Pay waits for viewport detection before choosing its desktop/mobile graph. DesktopCheckout, the default OrderScenario and the first BankSheet opening load dynamically. BankSheet remains mounted after its first opening to preserve local state. Other scenario branches retain their existing identity.
- Desktop QR utilities load only for a current payable invoice with its required amount confirmed. Loading/error/retry states preserve the existing URL and expiry rules.
- Pay serves a small semantic HTML loading screen with refresh and noscript fallback, independent of external assets. It is removed after Svelte mounts; displaying it does not mean checkout is ready.

### Validation

- Merchant check: zero errors/warnings; unit tests: 215/215. Identity-guidance browser tests: 24/24.
- Pay check: zero errors and nine preexisting unused CSS selector warnings; unit tests: 238/238.
- Both app production builds pass and emit separate speech, voice-parser, payment UI, BankSheet, desktop/scenario and QR chunks. No Worker was deployed.
- `node --test scripts/lazy-loading.browser.test.mjs`: 11/11. Requires the local services above; optional `LAZY_TEST_ORIGIN` changes the entry origin. External hosts are blocked and API calls are stubbed, so this suite cannot initiate real payments.
- Browser coverage: absence of heavy guest/startup imports; four mobile renderer identities; first BankSheet load and retained instance on reopen; desktop open_amount QR gated by confirmation and removed on paid; no-JavaScript HTML at 320px; merchant QR decoding of the latest value during a delayed import, clearing and unmounting.
- Desktop fixture explicitly sets a future expiry because the existing demo fixture has no freshness timestamps. This is synthetic UI evidence, not persisted-order or backend readiness evidence.

Fresh isolated dev-browser decoded resource totals were approximately 4,325 KiB for App guest, 2,219 KiB for Pay mobile without an invoice, 2,364 KiB for Pay desktop without an invoice and 2,332 KiB for the mobile demo catalog. The earlier App observation was 11,626 KiB, but external/API conditions differ; these totals are not a controlled latency comparison or production transfer budget. The focused test confirms the unwanted startup imports are absent. No new comparable LCP, INP or production-network benchmark was collected.

Real OAuth, microphone hardware/permissions on physical devices, authenticated payment creation/completion and production chunk-failure recovery remain unverified. The existing delivery persistence blocker, local proxy conflict, bare /pay behavior and OAuth-origin configuration remain outside this scope.

## CSS Warning Cleanup - 2026-09-24

After separate user approval, removed seven unused CSS blocks from EventsTemplatePreview and
applied the existing Fitness Dumbbell/Sparkles color and spacing directly through their `style`
props, replacing two ineffective scoped selectors. No warnings were suppressed. Pay `check`
now reports **zero errors and zero warnings**; the nine warnings mentioned above describe the
earlier validation state. The changed icon markup also passes the Svelte autofixer without issues.
No payment logic or deployment was changed.

Preserve DASH-AUTH-001 invariants: no persistent merchant/session cache, no skipped ownership revalidation and no weakened authorization. DASH-SHELL-001 remains analyzing. Existing fixed/open_amount/table/delivery contracts remain unchanged. No deployment, remote configuration mutation, schema change or payment action was performed.