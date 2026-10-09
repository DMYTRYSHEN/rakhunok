# Delivery: Global Solutions Review

Status: research and proposed product decisions, not implemented integrations. No carrier write, database migration, external account connection or deployment is authorized here.

## Scope And Evidence

Review of six established shipping products using their official product pages and selected API documentation. This is a workflow benchmark, not an independently tested ranking of the world's best services. Availability, commercial terms and features vary by market, contract and plan. Ukrainian operator support must be verified separately.

Product-page evidence establishes advertised workflows, not API guarantees, measured savings or reliability. Detailed API behavior below is grounded only in the linked EasyPost, Shippo and MCP documentation. No paid accounts, competitor dashboards or end-to-end carrier transactions were tested.

## Comparative Findings

| Solution | Evidence and useful pattern | Decision for Delivery | Boundary |
| --- | --- | --- | --- |
| [EasyPost](https://www.easypost.com/) | Shipping API, address verification, rates, labels and tracking; shipment docs separate rating from buying | Reusable parties/parcel input, explicit quote selection, issuance result and official label | Their address validation coverage, label formats and pricing are not Ukrainian carrier guarantees |
| [Shippo](https://docs.goshippo.com/docs/shipments/shipments/) | Shipment creation retrieves rates; documented webhook events cover tracking, transactions and asynchronous batches | Shared shipment services, event ingestion and item-level batch outcomes | Webhooks are not necessarily real-time; polling frequency depends on the carrier |
| [Sendcloud](https://www.sendcloud.com/) | Advertised own carrier contracts, service points, manual/API shipping, shipping rules, tracking and returns | Personal carrier connection, eligible point selection, saved defaults and later deterministic rules | Platform rates and geographic service-point coverage require separate agreements |
| [ShipStation](https://www.shipstation.com/) | Advertised centralized fulfillment, rate shopping, workflow automation, labels and integrations | Compact operational list, repeat shipment, later validated imports and batch printing | Do not import warehouse/inventory complexity into the initial single-shipment workflow |
| [AfterShip](https://www.aftership.com/tracking) | Advertised normalized statuses, exception management, estimated dates, branded tracking and notifications | Actionable attention queue, source-preserving status normalization, consented event notifications | Do not copy their status counts or represent estimated dates as promises |
| [nShift](https://www.nshift.com/) | Advertised modular checkout, delivery, tracking, returns, carrier rules and PUDO/locker ecosystem | Capability-gated lifecycle and route/parcel-aware point selection | Returns, audit and enterprise integrations are separate later modules |

## Verified API Lessons

- [EasyPost Shipments](https://docs.easypost.com/docs/shipments): origin, destination and parcel produce rates; carrier accounts can restrict rating. A separate buy operation selects a rate and returns tracking code and postage label. EasyPost also documents one-call buy, but Delivery will not use that as a default agent workflow. These documented operations alone do not establish an end-to-end idempotency guarantee for Delivery.
- [Shippo Shipments](https://docs.goshippo.com/docs/shipments/shipments/): a shipment object requires origin, destination and parcels and retrieves available rates. This supports a shared draft/quote model, not an assumption that all carrier APIs use the same objects.
- [Shippo Webhooks](https://docs.goshippo.com/docs/tracking/webhooks/): tracking, transaction and asynchronous batch event types; prompt 2XX acknowledgement and bounded retries. Durable ingestion, deduplication and reconciliation are therefore Delivery requirements, not optional UI refinements.
- [MCP Security](https://modelcontextprotocol.io/specification/2025-11-25/basic/security_best_practices): audience-specific authorization, no token passthrough, per-request verification, least privilege and appropriate per-client consent. A session identifier is not authentication.

Shippo's product homepage extraction was interrupted by a tracking redirect; its row uses shipping/webhook documentation rather than unverifiable homepage claims. The documentation also advertises a hosted shipping MCP with per-user OAuth. This is evidence that agent access is a product surface, not a reason to connect Delivery to that service or assume local carrier support.

## Selected Product Decisions

### Fast Repeat Shipping

Keep the current four-step wizard, with a planned fast path for an owner's saved sender, recipient and package template. A phone number searches only that owner's consented contacts. Missing or ambiguous parties require clarification. Editing a route, parcel, payment or account invalidates the previous quote and review.

Templates contain package/route/payment defaults, not live prices, keys or approval to issue. Applying a template revalidates current carrier references, dimensions and service availability. A repeat shipment creates a new draft rather than copying an issued document or tracking number.

### Eligible Services Before Cheapest Services

First filter by route, point type, parcel limits, account permissions and requested payment/service options. Then compare like-for-like quotes with currency, payer, known fees, verification time and estimated delivery source. Missing fees stay explicitly unknown. Without complete comparable quotes, do not label a service cheapest or invent savings.

Use rules that explain why a service is recommended. Keep original carrier service identifiers and extension fields alongside common fields. Cash-on-delivery amount and declared value are distinct; COD, pickup booking, returns and cancellation require their own verified capabilities. A nearest point is not necessarily suitable, open or available. Geolocation requires consent; distance is straight-line unless a routing service actually provides a route.

### Tracking As An Operational Workflow

Keep carrier delivery state separate from synchronization health. A timeout preserves the last confirmed state and marks it stale; it never becomes a lost/delayed parcel event. Preserve operator code, event time, observation time and normalization version in owner-authorized evidence, not unrestricted public output.

An attention item needs a reason, evidence time and feasible next action: pickup deadline where supplied, failed delivery, return, or stale synchronization. Do not infer a deadline or loss from absent data. Unknown carrier codes remain unknown until mapped and tested.

Plan webhooks where the operator actually supports them; otherwise bounded adaptive polling with backoff, jitter and terminal-state policy. Authenticate ingress using that provider's verified mechanism, durably accept before acknowledgement, deduplicate and handle out-of-order events. Notify only after an accepted semantic change, with consent, preferences, quiet hours and delivery deduplication. Public tracking retains its minimal data allowlist.

### Official Labels And Later Batches

Official label availability follows confirmed issuance, not preparation. Printer format and size are capability-specific; PDF/ZPL support is not assumed. Reprinting an existing authorized label must not issue another shipment. Protect label access because labels contain private information.

Only after single issuance is reliable, add import preview, validation, per-item confirmation, independent idempotency keys, partial-success reporting and retry of confirmed failures only. A timeout with unknown issuance outcome must enter reconciliation rather than blind retry. Inventory, customs, insurance, invoice audit and automated returns are deferred pending actual demand and verified APIs.

### Web And MCP Share Authority

The browser, API and first-party MCP call the same owner-scoped services. Start with discovery and read-only tracking; expose preparation only after shared validation works. Future issuance needs server-enforced confirmation of the exact draft and quote, not an assistant's claim that the user approved.

Keep MCP authorization separate from carrier keys; derive owner from verified identity, never a tool argument. Scope access by operation and client, support revocation, and return only required fields. Do not accept a browser Google ID token as an MCP bearer without a separately validated authorization design. Treat contact text, carrier messages and imported data as untrusted data, not tool instructions.

## Delivery Gaps And Acceptance Gates

These extend the order in [CONCEPT.md](CONCEPT.md); they do not change approval boundaries.

| Phase | Work and dependency | Discriminating acceptance check |
| --- | --- | --- |
| 1. Reliable preparation | Finish wizard acceptance; provision local vault and owner-key use | Changing route/parcel invalidates review; revoked key fails closed; no carrier issuance in preparation |
| 2. Repeat shipping | Persist owner contacts/templates and capability registry | Other owner cannot read/apply defaults; obsolete point is rejected; phone ambiguity prompts clarification |
| 3. First real issuance | Versioned draft/quote review, explicit confirmation, operation ledger, official labels | Double submit does not duplicate; ambiguous timeout reconciles; reprint does not issue; expired review is rejected |
| 4. Useful tracking | Scheduler/queue, supported webhook ingress, attention and notifications | Duplicate/out-of-order event causes no duplicate notification; provider outage preserves delivery state; public output stays minimal |
| 5. Multiple operators | Independently verify Ukrposhta directory, account, quote and issuance contracts | Unsupported feature stays unavailable; comparisons use equivalent inputs and visible unknown fees |
| 6. Agent and volume access | Authenticated read-only MCP first, then gated writes; batches after single-item reliability | Wrong audience/client/owner denied; changed draft cannot reuse confirmation; batch partial failure never retries a successful item |

Read-only MCP may be developed before later volume features once the shared services and authorization pass their own gates. No AI model, competitor SDK or third-party aggregator is required merely to expose Delivery's MCP.

## Measures, Not Claims

Baseline locally before setting targets: repeat-shipment preparation time, corrections per draft, invalid-point selections, quote freshness, unresolved issuance outcomes, synchronization lag and actionable attention resolution. Measure carrier event-to-observation separately from notification delivery latency. Do not advertise savings, delivery reliability scores or predicted dates without adequate evidence.

## Recommended Position

A Ukrainian-first shipping workspace with convenient branch/locker selection, personal carrier accounts, reusable defaults and a safe shared web/MCP workflow. Prioritize correct single-shipment issuance and useful tracking over carrier counts or autonomous bulk automation. The white, compact design already matches this operational direction; this review introduces requirements, not new live functionality.