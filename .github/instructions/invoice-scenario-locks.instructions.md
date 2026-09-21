---
name: Locked Invoice Scenarios
description: 'Use when analyzing or changing fixed, open_amount, table, or delivery invoice and checkout behavior across Dashboard, Pay, merchant app, shared contracts, or Worker APIs. Requires separate explicit approval.'
applyTo:
  - 'src/lib/features/dashboard/**'
  - 'src/routes/dashboard/**'
  - 'src/lib/features/shared/**'
  - 'apps/pay/**'
  - 'apps/merchant-app/**'
  - 'worker/src/**'
---

# Locked Invoice Scenarios

The cross-application process `CROSS-APP-INVOICE-SCENARIOS-001` in
`docs/DASHBOARD_PROCESS_REGISTRY.md` is `LOCKED` for these established scenarios:

- `fixed`
- `open_amount`
- `table`
- `delivery`

Before editing an applicable file, determine whether the change can affect any locked scenario
directly or indirectly through routing, defaults, validation, amounts, terminal or delivery data,
API payloads, persistence, checkout resolution, rendering, payment entry, status handling, or links.

- Do not make such a change without separate, explicit user approval that names the affected
  scenario or scenarios and the intended behavior change.
- Approval for template readiness, a new scenario, refactoring, styling, dependencies, deployment,
  or another process does not unlock these scenarios.
- If a locked change appears necessary, stop before editing and state the affected scenario,
  invariant, reason, files and applications involved, compatibility risk, and validation plan.
- Preserve direct Dashboard invoice creation and Merchant POS behavior independently of optional
  checkout-template selection.
- Preserve backward compatibility for existing persisted orders and public links. Do not reinterpret
  stored scenario identity, amount authority, terminal identity, delivery data, expiry, or status.
- Do not describe `delivery` as production-ready while the recorded Worker persistence blocker remains.
- After an explicitly approved change, update the registry with the exact temporary unlock scope,
  evidence, residual risks, and final lock status.

Read both this instruction and the Dashboard process lock when both apply. The stricter boundary wins.
