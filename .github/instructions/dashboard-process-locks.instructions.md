---
name: Dashboard Process Locks
description: "Use when analyzing or changing Dashboard routes, authentication, data gateways, Realtime, POS, invoices, settings, or developer credentials. Enforces the reviewed process registry and explicit approval boundaries."
applyTo:
  - "src/lib/features/dashboard/**"
  - "src/routes/dashboard/**"
---

# Dashboard Process Locks

- Read `docs/DASHBOARD_PROCESS_REGISTRY.md` before editing matched files.
- Identify the registered process IDs affected by the proposed change, including indirect effects
  through shared gateway, session, shell, and Realtime code.
- Do not change a process marked `LOCKED` while developing another module or process.
- If a locked invariant must change, stop before editing and request separate explicit approval.
  State the process ID, invariant, reason, affected files, risks, and validation plan.
- Treat approval as limited to the named process and scope. Do not infer permission for adjacent
  processes, refactors, schemas, APIs, RLS, authentication, or deployment.
- After analyzing or changing one process, update its registry record with conclusions, evidence,
  open risks, and final status.
- Keep unreviewed processes in analysis. Do not silently establish new contracts from assumptions.