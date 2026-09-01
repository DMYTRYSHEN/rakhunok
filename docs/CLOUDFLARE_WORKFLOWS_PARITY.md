# Corex and Cloudflare Workflows parity

Reviewed against the Cloudflare Workflows documentation and OpenAPI schema on 2026-09-01.

Corex is not intended to duplicate the Cloudflare dashboard. It must provide a domain-oriented process builder and control plane while retaining access to every useful Cloudflare Workflows capability through a trusted server-side adapter. A Cloudflare API operation being available through MCP does not make it safe to expose directly to the browser.

## Product bar

Corex can be described as better than the Cloudflare Workflows visualizer only when both statements are true:

1. Corex covers the Cloudflare visualizer and management API capabilities listed below, either natively or through an audited server-side Cloudflare adapter.
2. Corex preserves its additional guarantees: visual authoring, trusted validation, immutable published definitions, owner isolation, idempotent commands, durable delivery, approvals, subprocess lineage, domain triggers, and a searchable audit history.

The required lifecycle remains:

`draft -> validate -> persist/version -> publish -> execute -> inspect`

## Visualizer parity

The Cloudflare visualizer is a beta, read-only diagram generated from deployed JavaScript or TypeScript. Corex already exceeds it by allowing graph editing, validation, immutable publishing, execution, and inspection. Structural parity is not complete until the graph model and runtime cover every visualizer construct.

| Cloudflare construct         | Corex status | Required work                                                                                      |
| ---------------------------- | ------------ | -------------------------------------------------------------------------------------------------- |
| StartNode                    | Covered      | Keep one validated entry point.                                                                    |
| StepDo                       | Covered      | HTTP, transform, approval bookkeeping, and subprocess actions use durable steps.                   |
| StepSleep                    | Covered      | Keep duration validation and runtime inspection.                                                   |
| StepWaitForEvent             | Covered      | Finish transactional event delivery through the outbox.                                            |
| IfNode                       | Covered      | Keep explicit true and false branches.                                                             |
| StepSleepUntil               | Missing      | Add an absolute-time wait node and compiler/runtime support.                                       |
| SwitchNode                   | Missing      | Add typed cases, default routing, and validation.                                                  |
| LoopNode and BreakNode       | Missing      | Add bounded deterministic loops and visible iteration history.                                     |
| ParallelNode                 | Missing      | Add deterministic fork/join semantics and starts/resolves ordering.                                |
| TryNode                      | Missing      | Add catch/finally routes and rollback inspection.                                                  |
| BlockNode                    | Partial      | Visual grouping exists in the product direction but is not an executable graph primitive.          |
| FunctionDef and FunctionCall | Partial      | Subprocesses provide reusable published processes, but local function definitions are not modeled. |

Corex must also add collapsed nested views and runtime overlays showing active, waiting, retrying, completed, failed, and rolled-back paths. These are more useful to process operators than a static deployed-code diagram.

## REST API parity

Cloudflare currently exposes 22 Workflows endpoints. `Covered` means Corex provides the equivalent user outcome, not necessarily a one-to-one public route.

| Cloudflare API capability        | Corex status | Corex requirement                                                                                                                                       |
| -------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| List and search workflows        | Partial      | Process listing exists; add search, pagination, aggregate run counts, schedules, and last-triggered metadata.                                           |
| Get workflow details             | Covered      | Keep owner-scoped process, draft, publication, and runtime metadata.                                                                                    |
| Create or modify workflow        | Partial      | Corex publishes immutable domain definitions; add a privileged adapter for Cloudflare workflow configuration when generated deployments are introduced. |
| Delete workflow                  | Missing      | Add retire/archive first; destructive deletion must be separately authorized and audited.                                                               |
| Get and update account retention | Missing      | Add success/error retention policy with bounded values and an explicit admin permission.                                                                |
| List instances                   | Partial      | Run history exists; add cursor pagination, status/date filters, and full Cloudflare-compatible states.                                                  |
| Create one instance              | Covered      | Authenticated run creation resolves the immutable published version server-side. Add location and per-run retention only if required.                   |
| Batch-create instances           | Missing      | Add bounded, idempotent batch start with per-item results and limits.                                                                                   |
| Get instance status and logs     | Partial      | Run events and sanitized errors exist; add attempts, durations, retry state, rollback state, and richer filtering.                                      |
| Get full step output by attempt  | Partial      | Step payloads exist; add attempt identity, full-output retrieval, size policy, and stream/external-object handling.                                     |
| Subscribe to instance events     | Missing      | Add resumable server-driven streaming with cursor and event filters. Do not expose service credentials.                                                 |
| Send event                       | Partial      | Typed authenticated events exist; add stable caller event IDs and transactional outbox delivery.                                                        |
| Pause instance                   | Missing      | Add audited, idempotent pause with `waitingForPause` reconciliation.                                                                                    |
| Resume instance                  | Missing      | Add audited, idempotent resume and state reconciliation.                                                                                                |
| Restart instance                 | Missing      | Add restart from the beginning or `{ name, count, type }`, with immutable version and lineage rules.                                                    |
| Terminate instance with rollback | Partial      | Recursive cancellation and durable termination exist; expose the UI command and record rollback progress/outcome.                                       |
| Delete instance state            | Missing      | Add retention-driven purge and a privileged audited delete command. Termination and deletion remain distinct.                                           |
| Batch-terminate instances        | Partial      | Recursive process-tree cancellation exists; add bounded selection/filter batches and asynchronous job status.                                           |
| Batch-delete instances           | Missing      | Add a privileged asynchronous purge job with dry-run, limits, and audit records.                                                                        |
| Get bulk-termination job status  | Missing      | Add operation resources with progress, failures, retry, and completion state.                                                                           |
| List and get deployed versions   | Covered      | Immutable Corex versions and restore-to-draft exist; add version diff.                                                                                  |
| Get version DAG and graph        | Partial      | Editable definition graphs exist; add stable read-only version DAG/graph projections and runtime overlays.                                              |

## Cloudflare configuration parity

The create/modify API also exposes configuration that is not represented by a single endpoint row:

- Workflow concurrency limit.
- Maximum step limit.
- Cron schedules and next scheduled instance.
- Default success and error retention.
- Per-instance retention.
- Instance location hints.
- Caller-defined instance IDs within Cloudflare constraints.

Corex must model these as validated policies. Browser commands submit intent only; the server resolves account IDs, script/class names, Workflow bindings, protected domains, and Cloudflare credentials.

## Corex advantages that must not regress

- A real no-code process editor instead of a read-only diagram of deployed source.
- Trusted server-side parsing and compilation of persisted drafts.
- Immutable publication and subprocess resolution pinned to published versions.
- Domain-level HTTP actions, transformations, conditions, approvals, and subprocesses.
- Owner-scoped run control and audit records backed by database policy.
- Idempotent run cancellation across complete subprocess lineages.
- Transactional outbox delivery and reconciliation across database and Cloudflare boundaries.
- Controlled public trigger routing, collision checks, protected-route checks, deactivate, rollback, and reconciliation. This remains required P0 work.
- A unified view across domains, routes, database effects, Workers, and process runs rather than a Workflow-only view.

## Delivery order

1. Finish reliable outbox delivery for approvals, external events, and parent callbacks.
2. Implement published HTTP and scheduled trigger registration with Cloudflare route reconciliation.
3. Add pause, resume, restart, rollback progress, and the existing cancel action to the run inspector.
4. Add instance filters, cursor pagination, attempts, full step output, and resumable live events.
5. Add retention, concurrency, step limits, schedules, location hints, and batch operations.
6. Add sleep-until, switch, bounded loops, parallel fork/join, try/catch, blocks, and reusable functions.
7. Add lifecycle cleanup, destructive-operation approvals, metrics, alerts, limits, and retention jobs.
8. Prove parity with executable database, Worker integration, browser E2E, failure-injection, and Cloudflare adapter contract tests.

## Release gates

Do not claim complete Cloudflare Workflows parity until:

- Every row above is `Covered` or explicitly documented as intentionally unsupported with a safer Corex equivalent.
- Every mutating command has authentication, authorization, idempotency, audit, redaction, and retry/reconciliation tests.
- Cloudflare credentials and account identifiers never cross into browser-authored commands.
- Destructive commands distinguish terminate, rollback, retire, archive, and delete.
- A generated or imported process can round-trip through version DAG, execution timeline, and step attempts without losing identity.
- Local integration tests exercise the real migration and Workflow adapter contracts.
- Preview browser tests pass at `http://localhost:5173/corex` with the existing 5px page margins unchanged.

## Sources

- Cloudflare Workflows visualizer: https://developers.cloudflare.com/workflows/build/visualizer/
- Cloudflare Workflows REST API: https://developers.cloudflare.com/api/resources/workflows/
- Cloudflare OpenAPI schema queried through the Cloudflare MCP server on 2026-09-01.
