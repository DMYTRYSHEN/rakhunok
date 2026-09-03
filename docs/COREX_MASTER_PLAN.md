# Corex master implementation plan

Updated: 2026-09-01

This is the canonical delivery plan for Corex. The detailed Cloudflare comparison lives in [CLOUDFLARE_WORKFLOWS_PARITY.md](./CLOUDFLARE_WORKFLOWS_PARITY.md); this document controls implementation priority and completion.

## Goal

Corex becomes the primary control plane for building and operating processes, domains, redirects, database effects, Workers, triggers, and durable executions. Product users work through Corex rather than composing raw Cloudflare or database operations.

Corex must cover the useful capabilities of Cloudflare Workflows, its visualizer, and its management API while adding the domain controls expected from Temporal and Corezoid:

- visual no-code process authoring;
- trusted validation and compilation;
- immutable versions and controlled publication;
- durable execution, retries, waits, events, approvals, and subprocesses;
- domains, routes, redirects, schedules, and public triggers;
- database and Worker orchestration;
- authenticated operations, audit, observability, and reconciliation;
- recovery from partial failure across the active database adapter, Cloudflare, and external systems.

The required lifecycle is:

`draft -> validate -> persist/version -> publish -> execute -> inspect`

Browser commands express narrow intent. Account IDs, credentials, Workflow instance IDs, script/class names, resolved versions, protected routes, descendant runs, and infrastructure decisions remain server-controlled.

## Status legend

- `Done`: implemented and covered by executable tests.
- `In progress`: a production path exists, but a required reliability, UI, or integration part remains.
- `Planned`: not yet implemented.
- `Blocked`: requires an explicit external decision or unavailable environment.

## P0: mandatory production foundation

All ten P0 epics are required before Corex is treated as the production control plane. Work proceeds in dependency order, with focused executable validation after every slice.

### P0.1 Trusted process definition lifecycle - Done

- Canonical editable `draftDefinition`.
- Structural and security validation in the browser and trusted server path.
- Optimistic draft revision checks.
- Server reload and compile before publication.
- Immutable published versions and restore-to-new-draft behavior.
- Server-resolved immutable version when a run or subprocess starts.

Exit criteria:

- Invalid, stale, or browser-authored executable definitions cannot publish or run.
- Published definitions cannot be mutated in place.
- Validation, compilation, version, and restore tests remain green.

### P0.2 Durable execution engine - In progress

Covered:

- HTTP, transform, condition, typed switch with a mandatory default route, relative and absolute sleep, external event wait, approval, subprocess, success, and explicit failure nodes.
- Bounded deterministic loops with explicit structured back edges and loop-targeted `break`.
- Reusable local functions execute in serial and parallel branch regions of the same workflow without subprocess creation. Trusted compilation resolves each isolated declaration body and matching return, calls map a safe input path into function context, branch-local frame stacks isolate concurrent callers, and direct or indirect recursion is bounded to 64 active call frames per execution region.
- Executable blocks run isolated bodies from serial flows or parallel branches in the same workflow without subprocesses or artificial attempts. Blocks may nest while preserving each continuation boundary, and their bodies may contain bounded parallel fork/join regions. Trusted compilation resolves explicit body and continuation edges, validation rejects external entry and non-converging exits, and the editor inserts each complete protected region atomically.
- Deterministic recursive parallel fork/join with isolated branch contexts, configured result ordering, and recorded top-level `starts`/`resolves` indices. Existing short branch-path durable identities remain byte-for-byte stable; identities above the 500-character persistence limit retain a readable prefix and use a deterministic SHA-256 suffix over the complete structured branch path, step, and visit.
- Explicit failure terminals with validated public error codes/messages and one sanitized `run_failed` lifecycle event.
- Durable lifecycle events, sanitized failures, retry configuration, and bounded subprocess depth.
- Serial and parallel-branch HTTP retries persist idempotent attempt identity, duration, retry policy, branch-qualified durable names, and bounded sanitized response or error metadata for owner-scoped inspection.
- Successful serial, parallel, and compensation HTTP actions remain metadata-only by default. Definitions may opt into owner-scoped inline JSON response output up to 16 KiB with up to 20 validated child JSON paths redacted before persistence; oversized JSON and non-JSON responses remain metadata-only without failing or replaying the action, and the run inspector renders captured values.
- Successful serial and parallel HTTP actions may opt into bounded external JSON response output up to 10 MiB. Redaction is applied before the optional object-store port receives the payload, object keys are deterministic SHA-256 references over complete structured attempt identity, and non-JSON, oversized, unavailable-storage, or failed-storage cases fall back to response metadata without replaying or failing the completed action. Compensation HTTP actions retain their existing bounded metadata semantics.
- Transform, condition, switch, loop, break, serial relative/absolute waits, external event waits, approvals, and subprocesses persist deterministic attempt identity, visit, duration, and outcome without storing process context; transform, event-wait, approval, and subprocess failures are sanitized.
- Transform, condition, switch, loop, and break nodes inside supported parallel branches persist branch-qualified attempt identity and visit; parallel transform failures are sanitized.
- Successful serial, parallel, and compensation transforms default to a structural output descriptor and UTF-8 serialized byte count. Definitions may opt into owner-scoped inline output up to 16 KiB with up to 20 validated child JSON paths redacted before persistence; oversized values fall back to metadata without failing execution, and the run inspector renders captured values.
- Serial and parallel transforms may opt into bounded external JSON output up to 10 MiB. Redaction is applied before the optional object-store port receives the payload, object keys are deterministic SHA-256 references over structured attempt identity, step-attempt rows retain only bounded reference metadata, and unavailable storage falls back to metadata without replaying or failing the transform. The Worker has an R2-compatible adapter, but no preview or production bucket binding has been provisioned or configured yet.
- External transform and HTTP JSON output retrieval is authenticated and owner-scoped by complete attempt identity. The control plane resolves the authoritative object key from the owned step-attempt row before R2 access, missing descriptors and objects remain opaque, responses are private and non-cacheable, and the run inspector loads the bounded payload only after an explicit user action.
- Successful subprocess actions default to a structural descriptor for child business output and its UTF-8 serialized byte count. Definitions may opt into owner-scoped inline business output up to 16 KiB with up to 20 validated child JSON paths redacted before persistence; oversized values fall back to metadata, and correlation envelopes are never captured as business output.
- Successful serial and parallel subprocess actions may opt into bounded external business output up to 10 MiB. Redaction is applied before the optional object-store port receives only the child business value, deterministic object references use the complete parent attempt identity, and unavailable or failed storage falls back to metadata without failing the completed child invocation. Correlation envelopes remain excluded from stored business output.
- Successful control-flow and timer attempts persist an explicit no-output descriptor, while event and approval results remain redacted by default. Every complete attempt therefore satisfies the database output invariant without exposing process data.
- Relative and absolute durable waits execute in serial and parallel branches with stable branch-qualified identities and explicit no-output attempt descriptors.
- External-event waits execute in serial and parallel branches with replay-stable internal event types, branch-qualified attempt telemetry, deterministic configured result ordering, and active-wait cleanup on success or timeout.
- External-event definitions may opt into owner-scoped inline payload output up to 16 KiB with up to 20 validated child JSON paths redacted before persistence. Oversized payloads fall back to structural metadata, while the unredacted payload continues into process context; waits without a policy remain redacted.
- External-event delivery accepts an optional validated step identity and atomically resolves exactly one active registry entry for the current execution generation. Registry identity includes step and visit, so concurrent waits do not depend on lifecycle insertion order. The untargeted serial contract remains backward compatible; the targeted migration is local and not yet applied remotely.
- Successfully completed external-event waits can register isolated HTTP or transform compensation in serial and parallel branches. The rollback input is the pre-wait context, the rollback output is the received payload, branch identities remain qualified, and timeouts never register a completed rollback checkpoint.
- Approvals execute in serial and parallel branches. Parallel approvals atomically register exact task and active-wait identities by execution generation, step, and visit; decisions target an explicit task ID, route through the registered internal event type, and expire pending tasks during wait cleanup. The migration is local and not yet applied remotely.
- Approval definitions may opt into owner-scoped inline validated decision output up to 16 KiB or bounded external output up to 10 MiB, with up to 20 child JSON paths redacted before persistence. Routing envelopes are never captured, the original decision remains available to process context, unavailable storage falls back to metadata, and approvals without a policy remain redacted.
- Successfully completed approvals can register isolated HTTP or transform compensation in serial and parallel branches. The rollback input is the pre-approval context, the rollback output is the validated decision, approved and rejected routing remains unchanged, branch identities remain qualified, and invalid decisions or timeouts never register a completed rollback checkpoint.
- Successfully completed relative and absolute durable waits can register isolated HTTP or transform compensation in serial and parallel branches. The rollback input is the pre-wait context, timer handlers receive no business output, branch identities remain qualified, and failed sleeps never register a completed rollback checkpoint.
- Subprocesses execute in serial and parallel branches with generation/step/visit invocation identity, child-run callback correlation, configured branch result ordering, and branch-local durable termination on timeout. The bounded persistence key is a SHA-256 digest of the invocation identity.
- Correlated child completion callbacks and timeout cleanup.
- HTTP actions support deterministic compensation routes in serial and parallel execution. Compiled handlers register as Cloudflare rollback callbacks with isolated action input, bounded output/error context, independent retry and timeout policy, and owner-scoped per-handler attempt inspection.
- Serial and parallel HTTP actions may also register an isolated transform compensation handler. Its rollback envelope is limited to the captured action input, bounded action output, and normalized error; telemetry stores only structural output metadata or a sanitized transform failure code with branch-qualified identity where applicable.
- Serial and parallel deterministic transform actions may register isolated HTTP or transform compensation with the same bounded rollback envelope, sanitized telemetry, independent HTTP retry/timeout policy, and branch-qualified identity.
- Serial and parallel subprocess actions may register isolated HTTP or transform compensation after correlated child completion. Timed-out or errored children never register the rollback checkpoint; HTTP handlers retain independent retry, timeout, and idempotency policy, while compensation telemetry preserves generation, step, visit, and branch-qualified durable identity.
- The P0.2 compensation matrix is complete and intentionally finite: HTTP actions, deterministic transforms, completed subprocesses, completed external-event waits, completed approvals, relative waits, and absolute waits may register either HTTP or transform handlers. Control-flow nodes have no external side effect to compensate; additional sources or handler types require a separately scoped feature.
- Archived terminal leaf runs are eligible for automatic purge after 30 days. A service-role-only leased job snapshots authoritative external-output keys, blocks active waits and every undelivered or dead-letter outbox row, deletes R2 objects in retry-safe bounded batches, and only then deletes the run while retaining the purge tombstone. Parent runs become eligible after their terminal children are removed.
- The 10 MiB maximum for external JSON output is an intentional P0.2 safety contract. It keeps redaction and persistence bounded; streaming JSON redaction and multipart object upload are future capabilities, not P0.2 exit criteria.

Critical gaps:

- Preview and production R2 buckets and `COREX_OUTPUTS` bindings are not provisioned. External output therefore keeps its metadata fallback until the infrastructure gate is approved and configured.
- Remaining node-specific output policies outside the bounded transform, HTTP JSON, subprocess business-output, external-event payload, and approval decision slices require separate scope.

Exit criteria:

- Every supported graph construct compiles deterministically and survives replay.
- The runtime and visual graph preserve step, branch, attempt, and subprocess identity.
- Cloudflare visualizer constructs are covered or have a documented safer Corex equivalent.

### P0.3 Reliable command and event delivery - Done

Covered:

- Transactional outbox schema, leasing, claim tokens, `SKIP LOCKED`, bounded retries, sanitized failures, and scheduled draining.
- Durable recursive Workflow termination intents.
- Approval decisions commit their task transition and Workflow event atomically through the outbox.
- Generic external events use caller UUIDs, exact replay equality, conflict detection, owner-scoped run locking, reserved namespace protection, and transactional outbox enqueue.
- Child terminal transitions enqueue parent callbacks atomically with stable semantic keys.
- Dispatcher support for `workflow_event` and `parent_callback` delivery.
- Delivery attempts dead-letter after a bounded eighth failure, operator retry is owner-scoped and service-role-only, and aggregate outbox health is available through a trusted RPC.
- Stale queued runs are leased with claim tokens and bounded retries, then repaired only when their stable Cloudflare Workflow instance ID reports `unknown`; reconciliation health is exposed through a trusted RPC.
- Generic events resolve exactly one active durable-wait registry entry before enqueue and deliver through its replay-stable internal type; approvals retain exact active-wait resolution through their task lifecycle. Delayed duplicates therefore cannot satisfy a later wait.

Critical gaps:

- No remaining critical gaps are known for the current command and event subset; real PostgreSQL race coverage remains tracked in P0.8.

Exit criteria:

- No accepted command or event is lost when a Worker fails after the database commit.
- Delivery is at-least-once while process effects remain idempotent.
- Direct best-effort `sendEvent()` is not the only delivery path anywhere.

### P0.4 Published triggers, domains, routes, and redirects - In progress

Covered:

- Domain-neutral HTTP trigger publication is pinned to an immutable process version. Active method/path claims are atomic, collision-safe, private to the service role, and retain immutable trigger history.
- HTTP trigger deactivation and rollback lock the owned process, restore an exact previously published trigger, and reject stale versions or occupied routes.
- Lifecycle commands require a caller UUID, persist an owner-scoped request ledger before mutation, replay the original result exactly, and reject mismatched request reuse.
- Owner-scoped environments and route namespaces are server-created and immutable to browser roles. Existing HTTP trigger state is backfilled into the `default` environment and namespace without introducing hostname or domain configuration.
- Active routes derive environment and owner identity from their immutable published trigger. Composite foreign keys reject cross-owner or cross-environment route claims.
- A server-side protected-path policy prevents publication over Corex, API, application, asset, checkout, dashboard, documentation, payment, framework, root, and ACME/system routes. Publication reports a stable sanitized forbidden error.
- Active route mutations update a durable desired/observed reconciliation registry. Claims use leases and fencing tokens, failures use bounded retries and dead letters, and aggregate reconciliation health is service-role-only.
- The scheduled Worker reconciliation port is vendor-neutral and runs only when an adapter binding is actually configured. Exact desired fingerprints fence successful observations; missing adapters cannot create false observed state.
- Webhook, schedule, internal-event, and queue trigger descriptors have an immutable, owner-scoped publication registry pinned to a published process version. Registration validates kind-specific configuration, rejects secret-bearing metadata, replays exact requests, and reports conflicting descriptor reuse.
- Canonical process definitions support HTTP, schedule, and typed event entry nodes under the same single-trigger graph invariants. Compilation emits a discriminated trigger descriptor, and publication atomically registers schedule, queue, or internal-event metadata against the immutable version without claiming external platform activation.
- Owner-scoped environments and route namespaces can be allocated idempotently through service-role-only control-plane operations. Keys are normalized and validated, namespace allocation verifies exact environment ownership, and no hostname or domain semantics are introduced.
- Non-default environments and route namespaces can be retired without deleting immutable route history. Default resources are protected, active routes block namespace retirement, active namespaces block environment retirement, and allocation cannot silently reactivate retired resources.
- Public work is explicitly scoped to an adapter-neutral domain target selected for one owner environment. Hostnames are normalized and globally collision-safe, selection is immutable and owner-scoped, and `rakhunok.com` plus every subdomain is permanently protected before any DNS or provider activation.
- HTTP publication uses an explicit active environment and route namespace, requires that environment to have a selected domain target, and pins the target ID into the immutable published trigger descriptor. The legacy implicit `default/default` publish signature is no longer executable by the service role.
- Environment, namespace, domain registration, and immutable domain selection are composed by one service-role-only transactional operation that returns the explicit publish target without performing verification or provider activation.

Critical gaps:

- Activation of published non-HTTP trigger descriptors through concrete platform adapters.
- Environment promotion and public namespace lifecycle beyond owner-scoped domain-neutral allocation and retirement.
- Verified domain ownership; registration, selection, and publication pinning alone do not claim DNS control or activation.
- A concrete Cloudflare route, custom-domain, DNS, Worker, and schedule adapter behind the Corex control plane.
- Real PostgreSQL concurrency coverage for route mutation, lease expiry, stale claims, and desired-state replacement.
- Redirect creation, ordering, loop detection, collision checks, preview, rollback, and audit.
- Request authentication/signatures, schema validation, rate limits, body limits, replay protection, and trigger idempotency.
- Safe handling of custom hostnames and certificates when that later capability is authorized.

Exit criteria:

- Publishing can activate a collision-free trigger without browser access to Cloudflare credentials.
- Deactivate and rollback restore the previous known-good route state.
- A reconciliation job detects and repairs or reports Cloudflare drift.
- No Corex operation can claim or mutate protected domains or neighboring application routes.

### P0.5 Run operations and Cloudflare management parity - In progress

Covered:

- Authenticated single-run start and typed event commands.
- Recursive idempotent cancellation with descendant locking and durable termination.
- Owner-scoped run history and lifecycle events.
- Run inspector cancellation for active runs with pending and accepted/error feedback followed by durable state refresh.
- Idempotent pause and resume requests persist audited outbox intents; the dispatcher reconciles Cloudflare `waitingForPause`, `paused`, and `running` states before committing the visible run state.
- Run inspector pause/resume controls expose mutually exclusive pending states, refresh durable history after acceptance, and preserve cancellation while pause convergence is pending.
- Idempotent same-instance restart from the beginning or an exact Cloudflare `{ name, count, type }` step persists an audited outbox intent while retaining the immutable published process version.
- Restarted executions use a monotonically increasing generation across events, waits, approvals, callbacks, read models, and inspector history so stale execution data cannot satisfy the new generation.
- Explicit rollback is separate from cancellation: an idempotent service-role command persists `rolling_back`, dispatches Cloudflare rollback once, polls ambiguous platform state without consuming retry budget, and records the terminal rollback outcome.
- Rollback request replay returns the current durable run state and outcome rather than reopening or redispatching a completed rollback.
- Archive is separate from cancellation, rollback, retention purge, and destructive deletion: an idempotent service-role command marks only terminal runs as archived, preserves their execution status and history, emits an audited lifecycle event, and never calls Workflow or enqueues delivery work.
- Archived runs remain visible in owner-scoped history and cannot re-enter an active execution status.
- Automatic retention purge is separate from archive and privileged destructive deletion: archived terminal leaf runs age for 30 days, leased service-role jobs delete their snapshotted external objects before database finalization, protected delivery/wait state blocks claims, failures retry, and purge tombstones survive run deletion.
- Process retirement is an irreversible, idempotent owner-scoped lifecycle command distinct from run archive and destructive deletion. It preserves versions, runs, events, and audit history, withdraws active routes through desired-absent reconciliation, and blocks future publish, rollback reactivation, and run creation at the database boundary.
- The editor exposes retirement with explicit confirmation, preserves the selected process and its version/run history, and switches retired definitions to read-only while disabling save, validate, publish, run, and version restore controls.
- Owner-scoped run history supports bounded status/date/identifier filtering, ascending or descending stable ordering, and deterministic compound-cursor pagination by creation time and run ID.
- Workflow definitions use an owner-scoped bounded list with name/slug search, lifecycle filtering, stable updated-time and ID ordering, deterministic compound-cursor pagination, and selection-preserving incremental loading in the editor.
- The persisted, Worker, command, and inspector contracts cover the complete run-state vocabulary: `queued`, `running`, `waiting`, `waiting_for_pause` (`waitingForPause` at the Cloudflare boundary), `paused`, `rolling_back`, `complete`, `errored`, and `terminated`. Browser reads reject unknown persisted states, and shared active/terminal subsets control valid run actions.
- Caller-defined UUIDs map to stable owner-scoped Workflow instance IDs, and starts accept only the documented Cloudflare location hints.
- Authenticated batch create, terminate, and delete commands are bounded to 100 items, idempotent by owner and request ID, execute asynchronously through leased operation items, and expose sanitized progress and per-item outcomes.
- Privileged process deletion requires a current elevated grant, a retired owner-scoped process, no legal hold, no active route, and no active run. Cleanup is bounded to 99 run items plus one transactionally guarded finalizer; permanent cleanup failure terminalizes the dependent finalizer instead of leaving the operation pending.

Critical gaps:

- No remaining critical gaps are known for the current run-operation and Cloudflare management subset; remote migration and deployment remain separately approval-gated.

Exit criteria:

- Every mutating operation is authenticated, authorized, idempotent, audited, redacted, and reconciled.
- Long-running batch operations expose progress and per-item failures.
- Destructive deletion requires elevated authorization and cannot be confused with cancellation.

### P0.6 Inspection, live state, and visual parity - In progress

Covered:

- Editable graph, validation markers, run selection, ordered lifecycle timeline, inputs, outputs, and sanitized errors.
- Immutable version history.
- Active-run cancellation is available in the inspector and exposes its in-flight operation state without hiding the selected run timeline.
- The inspector exposes explicit rollback separately from cancellation, prevents conflicting controls and events while rollback is active, and displays sanitized rollback success or failure details from the durable read model.
- The inspector archives eligible terminal runs without hiding them, prevents conflicting lifecycle controls while the request is active, and displays durable archive metadata after refresh.
- The inspector shows owner-scoped HTTP attempts with durable identity, duration, retry policy, status, content type, byte count, or sanitized error code. Raw response bodies remain hidden by default; opt-in JSON responses up to 16 KiB are rendered inline, while oversized or non-JSON responses stay metadata-only.
- The editor exposes metadata-only, bounded inline, or bounded external storage for transform, HTTP JSON, subprocess business-output, and external-event payloads, with per-node byte limits and child JSON-path redaction. The inspector renders captured values without exposing callback correlation envelopes.
- Pure deterministic projectors generate escaped Mermaid source for definition topology and ordered run sequences from trusted Corex read models without exposing persisted identifiers or accepting arbitrary Mermaid input.
- The standalone process diagram renders definition topology and selected-run sequence views from the trusted projectors through a local Mermaid dependency with strict security settings. The renderer sanitizes the generated SVG before mounting it and remains independent from the editable canvas and compiler.
- Declarative cross-process Flow definitions compose actors, executable processes, external systems, and ordered responsibility handoffs into one business journey. Scenario capabilities derive variants such as payment-only, delivery, and delivery-with-loyalty from the same Flow while omitting inactive stages and participants.
- Trusted owner-scoped Flow resolution rejects missing, unpublished, or cross-owner process references and pins every executable participant to an exact immutable process-version ID before publication.
- Local Flow persistence stores mutable authored drafts separately from immutable resolved publication snapshots, with optimistic revisions, compound owner constraints, owner-scoped RLS, and a typed draft/version gateway. The migration remains local and unapplied remotely.
- Service-role-only Flow publication locks the authored draft, verifies its optimistic revision, resolves every process participant from authoritative published process rows, and creates idempotent current or monotonically increasing immutable Flow versions.
- Cross-process correlation persists an idempotent business Flow execution pinned to one immutable Flow version and scenario, then links existing process runs only when their owner, process, and immutable process version match the resolved participant. Browser access is read-only.

Critical gaps:

- Stable read-only DAG and graph projection for each published version.
- Trusted server orchestration that starts Flow executions and links process runs through the service-role-only correlation operations, plus an authoring UI for participants, ordered stages, scenarios, and capability gates.
- Ordered actual-event projection across correlated runs, including optional stages, waits, retries, failures, compensation, and alternative branches.
- Extended standalone diagram coverage for waits, retries, subprocesses, terminal states, empty states, and Mermaid render failures.
- Runtime overlays for active, waiting, retrying, paused, failed, completed, and rolled-back paths.
- Collapsed and expanded nested conditions, loops, blocks, functions, and parallel lanes.
- Full step output retrieval beyond bounded transform, HTTP JSON, subprocess business-output, external-event payload, and approval decision values, including reusable redaction profiles and policies for other step kinds.
- External-object or streaming strategy for outputs that should not be stored inline.
- Resumable live event subscription with cursor and event filters.
- Workflow/version diff and run comparison.
- Search and filters across processes, runs, events, and operation jobs.

Exit criteria:

- An operator can explain the current and historical execution path without opening Cloudflare Dashboard.
- Operators can open the standalone diagram for the active draft, an immutable published version, or a selected run without loading executable code from a CDN or accepting arbitrary Mermaid source.
- Refresh or reconnect does not lose live events.
- Graph, timeline, and full step details share stable identities.

### P0.7 Connector and data-plane safety - In progress

Covered:

- HTTPS-only HTTP actions, public-target checks, timeout/retry bounds, idempotency key support, response-size limits, and sanitized upstream errors.

Critical gaps:

- DNS rebinding-resistant egress validation at connection time.
- Redirect revalidation and redirect-count limits.
- Explicit allow/deny policy for hosts, ports, methods, and content types.
- Credential references from a server-side secret store, never raw browser values.
- Per-connector rate limits, concurrency, circuit breaking, and budgets.
- Typed database, D1, KV, R2, Queue, Hyperdrive, Worker service, email, bank, and custom-function connectors.
- Transaction and idempotency rules for database mutations.
- Input/output schemas, mapping previews, fixtures, redaction, and bounded persistence.

Exit criteria:

- Connectors cannot reach private or metadata networks through redirects or DNS changes.
- Secrets do not enter definitions, logs, events, or browser responses.
- Every side-effecting connector documents and tests its idempotency behavior.

### P0.8 Database, lifecycle, and reconciliation - In progress

Covered:

- Local migrations for process control, approvals, subprocesses, cancellation, and outbox delivery.
- RLS-oriented browser access and service-role-only mutation RPCs.
- Observable, repeatable DB-to-Workflow reconciliation for stale queued root and subprocess runs, with lease protection and create-only-on-`unknown` duplicate prevention.
- Pause/resume lifecycle intents use leased outbox delivery and atomic platform-state reconciliation; `waitingForPause` releases its lease without consuming retry budget, and cancellation/child cleanup treat pause convergence as active.
- Restart persistence, generation rollover, and stale-generation isolation have static SQL contract coverage; transactional race behavior still requires execution against a real PostgreSQL runtime.
- Rollback persistence uses a leased outbox intent with a durable platform-accepted marker, terminal outcome validation, current-state idempotent replay, and static SQL contract coverage; transactional race behavior still requires execution against a real PostgreSQL runtime.
- Archive persistence uses a direct transactional service-role RPC with owner/request replay equality, row locking, durable audit events, status preservation, and a database constraint that keeps archived runs terminal; it has static SQL contract coverage and no Workflow/outbox side effects.

Critical gaps:

- Execute all migrations against local Supabase/PostgreSQL, not only static SQL contracts.
- Concurrency tests for cancellation, subprocess creation, repeated commands, leases, stale claims, and event replay.
- Detect and report or repair Workflow instances without valid DB runs when a safe enumerable Workflow inventory is available.
- Retention policy for successful and errored instances, events, step outputs, outbox records, and operation jobs.
- Account and per-workflow concurrency limits, maximum step limits, quotas, and backpressure.
- Safe retention purge jobs, destructive-delete authorization, legal-hold handling, and referential-integrity checks.
- Schema/API compatibility and forward-only migration policy.

Exit criteria:

- Local integration tests prove owner isolation, RLS, atomicity, idempotency, and race behavior on real PostgreSQL.
- Reconciliation is repeatable, observable, and cannot create duplicate execution.
- Retention and purge preserve required audit records.

### P0.9 Security, testing, and operations - In progress

Covered:

- Focused Worker and unit suites, Wrangler dry-runs, sanitized errors, narrow browser commands, and Cloudflare observability configuration.
- Corex browser, domain, generator, and Worker source/test paths pass ESLint and Prettier with zero Svelte diagnostics.

Critical gaps:

- Outside the Corex scope, the strict repository lint gate still has an authored-code baseline of 80 ESLint errors and 96 Prettier failures across the landing page, dashboard, merchant app, checkout scripts, and shared scripts. Generated bundles, local agent metadata, Supabase temp state, and generated Worker declarations are excluded; this external debt remains blocking for the repository-wide gate but is not part of the Corex remediation scope.
- Authenticated browser E2E for author, save, validate, publish, run, event, approval, cancellation, and inspection.
- Failure injection across database commit, Workflow creation, event send, callback, timeout, cancellation, and outbox acknowledgement.
- Structured logs, correlation IDs, metrics, traces, dashboards, alerts, and operator runbooks.
- Rate limits, payload limits, per-owner quotas, abuse controls, and cost guards.
- Roles and permissions for author, publisher, operator, approver, infrastructure admin, and destructive-operation admin.
- Secret rotation and Cloudflare token-scope verification.
- Backup, restore, incident recovery, and data export.
- Compatibility contracts against the current Cloudflare OpenAPI surface.

Exit criteria:

- `npm run lint` passes with both formatting and ESLint checks green; generated artifacts remain excluded rather than manually edited.
- P0 workflows pass local database, Worker integration, browser E2E, and failure-injection suites.
- Alerts cover stuck runs, outbox backlog, reconciliation drift, error-rate spikes, and quota pressure.
- No deployment or remote migration occurs without explicit authorization and a recorded release gate.

### P0.10 Persistence portability and database adapters - Planned

The current Supabase/PostgreSQL implementation remains the reference production adapter. This epic introduces an explicit persistence boundary so Corex can add Turso/libSQL and other databases without changing process, command, inspector, or Worker contracts.

Deliverables:

- A vendor-neutral persistence port for process definitions, immutable versions, runs, lifecycle events, waits, approvals, subprocesses, command/event outboxes, leases, reconciliation, audit, and retention operations.
- A Supabase/PostgreSQL adapter behind that port, preserving the existing RPC, RLS, transaction, locking, and service-role behavior rather than replacing it.
- Adapter capability profiles for transactions, row locking, compare-and-swap, isolation, server-side authorization, change feeds, JSON, generated values, and migration behavior.
- A Turso/libSQL compatibility adapter whose application-layer transactions, tenant authorization, optimistic concurrency, leases, and idempotency provide the same externally observable Corex guarantees.
- Backend selection through trusted server configuration and dependency injection; process definitions and browser payloads cannot select credentials or bypass the configured adapter.
- Backend-specific forward-only migrations and schema-version compatibility checks, with no runtime attempt to execute PostgreSQL SQL against libSQL or vice versa.
- A shared persistence contract suite covering owner isolation, atomic command acceptance, replay equality, generation isolation, outbox claiming, lease expiry, stale claims, rollback reconciliation, and retention integrity for every supported adapter.
- Failure-injection and concurrency suites per adapter; an adapter remains experimental until its capability gaps and degraded guarantees are explicit and accepted.
- ADRs for the persistence port, capability negotiation, tenancy enforcement outside PostgreSQL RLS, and consistency requirements that adapters may not weaken.

Exit criteria:

- Corex business logic, API contracts, Workflow orchestration, and inspector read models do not import a Supabase or database-specific client directly.
- Supabase remains fully supported and passes the shared adapter suite without behavioral regression.
- Turso/libSQL passes the shared contract suite for its declared production capability profile before it can be enabled outside local or preview environments.
- Unsupported database capabilities fail closed during startup or publication; Corex never silently downgrades atomicity, authorization, idempotency, or audit guarantees.
- Adding another database requires a new adapter, migrations, capability declaration, and contract-suite implementation rather than changes throughout Corex domain code.

## P1: complete platform capability

P1 begins after all P0 exit criteria pass.

### P1.1 System best-practices and ADR catalog for AI flow design - Planned

Deliverables:

- Versioned ADRs recording context, decisions, rejected alternatives, invariants, risks, and implementation evidence.
- Curated flow patterns for durable commands, idempotency, retries, waits, approvals, subprocesses, compensation, rollback, reconciliation, and connector safety.
- Explicit anti-patterns with failure modes and approved alternatives; raw chat transcripts are supporting evidence, not authoritative guidance.
- Machine-readable pattern metadata with applicability, constraints, Cloudflare and database-adapter compatibility, verification date, and lifecycle status.
- Executable flow examples and eval fixtures that test generated graphs against compiler, policy, replay, security, and recovery invariants.
- Retrieval rules that prefer current verified guidance, preserve provenance, and exclude deprecated or unverified advice from generation context.
- Human review and promotion workflow for moving guidance through `proposed`, `verified`, and `deprecated` states.

Exit criteria:

- AI flow generation and review consume the versioned catalog rather than relying on conversation history or undocumented assumptions.
- Every verified pattern links to implementation evidence and executable tests; stale platform assumptions carry a review date or are excluded.
- Generated flows are evaluated against deterministic compilation, safety, idempotency, and rollback/recovery rules before publication.
- Conflicting guidance is resolved through an ADR and cannot silently coexist as active generation policy.

### Remaining P1 epics

1. Full node catalog: database, D1, KV, R2, Queue, Hyperdrive, email, Worker service, bank, storage, and custom functions.
2. Environment promotion across local, preview, staging, and production with definition, route, binding, and secret diffs.
3. Process templates, reusable modules, organization libraries, imports, exports, and generated TypeScript.
4. OpenAPI and documentation ingestion into a typed intermediate process graph with explicit assumptions.
5. AI-assisted generation, repair, test generation, and visual diff with mandatory human review, grounded in the P1.1 catalog.
6. Advanced schedules, calendars, time zones, missed-run policy, and backfill.
7. Advanced operations: retry from failure, replay, fork from history, compensating runs, and bulk remediation.
8. Multi-user collaboration, comments, review requests, approvals, ownership transfer, and audit export.
9. Operational analytics for throughput, duration, queue time, retries, failures, connector health, and cost.
10. Cloudflare account settings, workflow configuration, deployed-version metadata, DAG, graph, and live event adapters available through trusted Corex APIs.

## P2: differentiated orchestration platform

1. Multi-tenant organizations, projects, environments, policy inheritance, and delegated administration.
2. Domain purchase and broad DNS/certificate lifecycle after a separate security and billing review.
3. Cross-region and provider-independent execution adapters where Cloudflare alone is insufficient.
4. Long-running business calendars, SLAs, escalations, and human work queues.
5. Process simulation, deterministic dry-run, fixtures, time travel, and capacity planning.
6. Marketplace for connectors, process templates, policies, and organization modules.
7. Governance: separation of duties, compliance retention, legal hold, signed releases, and provenance.
8. Compatibility adapters for Temporal/Corezoid concepts and migration tooling without weakening Corex guarantees.

## Cross-cutting rules

- Work only inside `D:\svetle\corex`; never modify `D:\svetle\core`.
- Preserve exact 5px horizontal page margins.
- Use `http://localhost:5173/corex` for local browser verification.
- Never deploy or apply remote Supabase migrations without explicit authorization.
- Do not expose Cloudflare, Supabase, Turso, or other database service credentials to the browser.
- Prefer local bindings and trusted adapters over direct browser access to management APIs.
- Keep database-specific clients, SQL, authorization mechanisms, and migration code inside their persistence adapters; shared domain code depends only on the persistence port.
- Treat Supabase/PostgreSQL as the reference adapter, not as the only supported database contract.
- Do not claim adapter parity from API shape alone; prove transaction, tenancy, idempotency, lease, reconciliation, and failure semantics with the shared contract suite.
- Keep accepted commands durable and idempotent across retries and partial failures.
- Preserve user changes in a dirty worktree and avoid unrelated refactors.
- Re-read user-modified Svelte files before editing and validate Svelte changes with the official Svelte tools.

## Definition of complete

Corex is complete for the stated product goal when:

- all ten P0 epics satisfy their exit criteria;
- every Cloudflare Workflows parity row is covered or has an approved safer Corex equivalent;
- process authors can build, validate, publish, trigger, operate, and inspect without leaving Corex;
- infrastructure administrators can manage authorized domains, routes, redirects, schedules, Workers, and retention through audited Corex controls;
- database and connector effects are typed, idempotent, observable, and recoverable;
- local integration, browser E2E, failure-injection, security, and compatibility suites pass;
- production activation remains an explicit separately authorized action.
