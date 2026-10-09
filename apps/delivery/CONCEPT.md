# Delivery: Unified Shipping Workspace

Status: local product concept. No deployment, remote migration or carrier write is authorized by this document.

## Global Benchmark Decisions

The [global solutions review](GLOBAL_SOLUTIONS_REVIEW.md) compares EasyPost, Shippo, Sendcloud, ShipStation, AfterShip and nShift using official sources. It is a workflow benchmark, not an independently tested ranking or proof of Ukrainian carrier coverage.

Adopt saved defaults and repeat-shipment drafts; filter eligible services before comparing prices; retain quote provenance and freshness; separate issuance from preparation and reprinting; build an actionable attention queue with synchronization health separate from delivery state. Add event-driven notifications only after durable ingestion, deduplication, consent and supported carrier synchronization exist. Keep batches, returns and warehouse features behind separate capability and reliability gates.

These are selected product requirements, not currently implemented features. The current capability table below remains the implementation baseline. See the review for source evidence, deferred features and measurable acceptance checks.

## Design System

One white workspace for public tracking and business shipping. Manrope typography, graphite primary actions, neutral borders, 8px controls, 44px minimum action targets. Unframed page sections and compact rows rather than nested cards. Color communicates carrier identity and delivery health, not decorative branding. Desktop sidebar and mobile bottom navigation expose the same working areas.

Shared tokens live in src/app.css. Public tracking, business lists, shipping steps and pickup-point directories share these tokens. Every operation must expose loading, empty, unavailable and error states without fabricated data.

## One Workflow, Multiple Operators

The user's task is shipping, not navigating separate carrier products:

1. Select a saved sender and recipient, or enter missing fields.
2. Select a template or define cargo, dimensions and payment.
3. Compare only verified eligible services, pickup points, quotes and dates.
4. Review the exact carrier, addresses, parties, price and requested operation.
5. Explicitly confirm issuance; then obtain the official carrier label.
6. Track the shipment in the same list with normalized status and original carrier evidence.

Adding an existing waybill is separate from issuing a new one. A preparation result and draft label must never be presented as a created waybill.

## Capability Registry

Each carrier adapter needs explicit capabilities: tracking, cities, branches, lockers, address delivery, quote, estimated date, issuance, cancellation and official labels. A capability is enabled only after authentication, adapter implementation and tests confirm it. Unsupported features are unavailable, not silently routed through another operator.

Current local implementation:

| Operator | Tracking | Directory | Quote/date | Issuance/official labels |
| --- | --- | --- | --- | --- |
| Nova Poshta | Implemented | Cities, branches, lockers | Read-only preparation | Not implemented |
| Ukrposhta | Requires configured tracking token | Not implemented | Not implemented | Not implemented |
| Other couriers | Not connected | Not connected | Not connected | Not connected |

Rates and dates retain their operator source and verification time. Carrier outages do not become delivery events. Comparison requires real quotes for the same cargo and route.

## Saved Data And Credentials

Owner-scoped contacts and templates are the next persistence slice. Templates hold reusable route/cargo/payment defaults and references, not credentials. Revalidate directory references and parcel limits when applying a template. Resolve contacts only within the authenticated owner's address book and consented data.

The credential vault backend exists; provisioning, migration, management UI and shipping integration remain pending. Use an owner's encrypted carrier key server-side. Never return keys to the browser or an MCP response. An invalid personal key must not silently fall back to a shared service key for issuance.

Phone numbers can identify an owner's saved contact, but do not grant access to arbitrary carrier customer data. Multiple matches or missing address/name fields require user clarification. Never enumerate customers by phone.

## First-Party MCP

Proposed authenticated tool contract, not an implemented MCP endpoint:

- delivery.list_carriers: verified capabilities and connection metadata.
- delivery.search_points: carrier/city/type/query with bounded pagination.
- delivery.resolve_contact: owner-scoped saved contact lookup; minimal fields.
- delivery.list_templates and delivery.apply_template: owner-scoped defaults and revalidation.
- delivery.prepare_shipment: normalize input, validate route/cargo and request read-only quotes.
- delivery.review_shipment: immutable preparation version, missing fields and quote freshness.
- delivery.confirm_shipment: separately authorized issuance, not callable until the write workflow exists.
- delivery.get_label: official label for an owner-accessible issued waybill only.
- delivery.track_shipment: owner-scoped status; public tracking uses a separate minimal allowlist.

The web wizard and MCP must call the same application services. MCP is another interface, not a second business implementation. No write tools enabled by default. Bind confirmation to owner, exact draft version, operation and expiry; enforce idempotency and reconcile uncertain carrier responses before retrying. Model text and carrier responses are untrusted input and cannot grant authority.

MCP authorization must verify each request, token audience, client and operation scope; derive the owner from verified identity rather than a tool argument. Carrier keys remain in the server vault and are never passed through as MCP credentials. A session ID or browser Google login alone is not an MCP authorization design. Support client-specific consent and revocation; changed drafts or expired quotes invalidate confirmation.

Before Cloudflare deployment: select the exact environment and approve deployment; verify adapter/runtime compatibility, authenticated MCP transport and authorization, distributed rate limits, bounded requests, encrypted secrets, redacted operational logs and cross-owner access tests. No Axiom dependency. Current per-instance public tracking limits are not distributed deployment protection.

## Acceptance Order

1. Complete desktop/mobile wizard acceptance, stale-result protection and draft-only print checks.
2. Provision the credential vault locally, then implement key management and owner-key usage.
3. Add reproducible owner-scoped contacts/templates persistence and access tests.
4. Implement operator capability registry and independently verify Ukrposhta APIs.
5. Add issuance persistence, confirmation, idempotency and official labels for one operator.
6. Add authenticated read-only MCP using the shared services; add write tools only after issuance gates pass.

Schema or Supabase changes require a separate compatibility assessment for rhnk.to; this concept does not select that database or authorize remote writes.