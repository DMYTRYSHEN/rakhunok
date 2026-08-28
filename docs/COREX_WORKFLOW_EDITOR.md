# Corex Workflow Editor Blueprint

Corex is a visual authoring and observability layer for Rahunok processes. Its generated runtime target is Cloudflare Workflows TypeScript, not a proprietary execution engine. Until a separate readiness review approves mutations, the editor remains a local/mock authoring surface and cannot publish, pause, resume, restart, terminate, or roll back production instances.

## Product direction

- Use the Rahunok dashboard shell: Manrope, light neutral page chrome, compact controls, and shared spacing/radius conventions.
- Use a dense dark editor workspace inspired by the supplied Flow Orchestrator reference and Corezoid: node palette on the left, dotted canvas in the center, configuration and run inspector on the right.
- Preserve technical strings such as API paths, event types, payload keys, SQL operations, IDs, and HTTP codes.
- Default UI language is Ukrainian; English is selected in the header and persisted locally.
- `rakhunok.com` is always excluded from deployment. Any future deploy integration must be separately approved and restricted to `letsrealtalk.com`.

## Cloudflare-compatible graph model

The editor must represent the node types parsed by the Cloudflare Workflows visualizer:

- `StartNode`
- `StepDo`
- `StepSleep`
- `StepSleepUntil`
- `StepWaitForEvent`
- `IfNode`
- `SwitchNode`
- `LoopNode`
- `ParallelNode`
- `TryNode`
- `BlockNode`
- `FunctionDef`
- `FunctionCall`
- `BreakNode`

Nested conditions, loops, blocks, and functions need collapsed and expanded views. Parallel layout is derived from `starts` and `resolves` execution indices. A graph node ID is an editor identity; a Cloudflare step name is a deterministic runtime cache key and must be validated separately.

### No-code node catalog

The client-facing palette extends the visualizer syntax with higher-level composable nodes for A2A payment and backend processes:

- Triggers: Webhook/API, schedule, and internal event/queue.
- Routing: condition, switch, loop, parallel fork/join, and deterministic A/B router.
- Durable waits: sleep, sleep-until, wait-for-event, and human approval.
- Data: database read/write, KV get/set, and data transform.
- Integrations: HTTP request and child Workflow invocation.
- Resilience: per-node retry/timeout/rollback and try/catch blocks.
- Terminators: successful return and explicit abort/failure.

These are editor primitives, not all native `WorkflowStep` methods. Code generation must lower them to supported Cloudflare constructs:

| Editor node | Generated runtime construct |
| --- | --- |
| Webhook/API | Worker `fetch` handler validates input and calls `env.WORKFLOW.create()` |
| Schedule | Workflow binding `schedules`, or a Worker `scheduled` handler |
| Event | Queue, Durable Object, Worker, or Workflow binding calls `create()` |
| Condition / Switch / Loop | Native deterministic JavaScript control flow around awaited steps |
| Parallel | `Promise.all()` over deterministic, uniquely named steps |
| A/B Router | Allocation calculated and persisted in `step.do()`, then deterministic branching |
| Human Approval | `step.waitForEvent()` plus an authenticated dashboard action calling `instance.sendEvent()` |
| DB / KV / HTTP / Transform | Granular `step.do()` callback using the configured binding or `fetch()` |
| Invoke Sub-Flow | `step.do()` calling another Workflow binding's `create()`; child runs independently |
| Success | Return a serializable value from `run()` |
| Abort / Fail | Throw `NonRetryableError` for an intentional non-retryable failure, or propagate an error |

There is no current `step.run()` or `step.doWhile()` API. The compiler must emit `step.do()` and native JavaScript loops. Retry policy is an inspector capability on durable action nodes rather than a standalone executable node.

## Node configuration contract

Every durable action node should expose:

- Deterministic step name, description, and generated TypeScript preview.
- Input expression/schema and serializable output schema.
- Binding or connector selection: HTTP, Worker service, Workflow, Supabase/Postgres, D1, KV, R2, Queue, Hyperdrive, email, bank, webhook, or custom function.
- `step.do()` retry limit, delay, fixed/linear/exponential backoff, dynamic delay hook, and timeout capped at 30 minutes.
- Optional rollback handler with independent retries and timeout.
- Idempotency strategy and idempotency-key source for side effects.
- Error routes for retryable, non-retryable, timeout, validation, conflict, and catch behavior.
- Data mapping, secret/binding references, test fixture, logs, and redacted input/output samples.

Trigger nodes additionally expose HTTP method/path and input schema, cron expression, or event source. Data and integration nodes select a binding, operation, resource, schemas, and idempotency key. Human approval requires an event type, timeout, authorized role, audit metadata, and explicit rejection route.

Wait nodes expose duration/date or event `type` and timeout. Event types must match `^[a-zA-Z0-9_][a-zA-Z0-9-_]*$`. Conditions must be based on immutable event payload or persisted step output. Non-stream step output is limited to 1 MiB; larger structured output should be stored externally, while supported byte streams need separate handling.

## Editor surfaces

1. Workflow selector, draft/version state, validation, import, and protected publish command.
2. Searchable node palette grouped into Cloudflare steps, control flow, connectors, data, and structure.
3. Pan/zoom canvas with minimap, connection labels, branch labels, nested group collapse, parallel lanes, and validation markers.
4. Inspector tabs for settings, data mapping, generated code, tests, and execution history.
5. Run timeline showing instance status, attempts, `starts`/`resolves`, duration, logs, errors, input/output, and rollback outcome.
6. AI dock accepting a prompt, pasted text, URL, OpenAPI specification, Markdown/PDF documentation, or existing Worker source.

## AI generation pipeline

Documentation ingestion must never deploy directly. The intended pipeline is:

1. Ingest and classify sources, preserving source references.
2. Extract triggers, actors, API contracts, schemas, conditions, side effects, timeouts, and failure paths.
3. Produce an intermediate typed workflow graph with explicit unknowns and confidence.
4. Run static rules: determinism, awaited steps, serializable state, idempotency, granular steps, event-type syntax, timeout/output limits, binding availability, secret references, and unreachable branches.
5. Generate TypeScript `WorkflowEntrypoint`, tests, Wrangler binding changes, and a visual diff.
6. Require human review of assumptions and generated code.
7. Run local tests and a non-mutating preview.
8. Only after an explicit readiness gate may a separate deploy subsystem request approval for `letsrealtalk.com`.

Prompt-to-deploy must therefore remain a staged, reviewable workflow, never a single unguarded action.

## Instance operations reserved for later integration

- Create one or batch instances with unique IDs, params, and retention settings.
- Read status and output.
- Send typed events to waiting instances.
- Pause and resume.
- Restart from the beginning or from a selected step name/count/type.
- Terminate with optional rollback.
- Display queued, running, paused, waiting, waiting-for-pause, errored, terminated, complete, and unknown states.

These controls must use scoped server-side bindings or APIs, audit every action, redact secrets, and remain unavailable in the current mock implementation.

## Sources reviewed

- Cloudflare Workflows Visualizer: https://developers.cloudflare.com/workflows/build/visualizer/
- Workers API: https://developers.cloudflare.com/workflows/build/workers-api/
- Events and parameters: https://developers.cloudflare.com/workflows/build/events-and-parameters/
- Rules of Workflows: https://developers.cloudflare.com/workflows/build/rules-of-workflows/
- Trigger Workflows: https://developers.cloudflare.com/workflows/build/trigger-workflows/

Reviewed against documentation available on 2026-08-28. Cloudflare's visualizer is beta and currently supports TypeScript and JavaScript Workers; non-default bundlers may produce unexpected diagrams and Python Workflows are not supported.