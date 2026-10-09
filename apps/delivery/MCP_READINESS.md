# Delivery MCP Readiness

The application has a local read-only MCP prototype using the official SDK.
Stdio transport, initialize negotiation, tools/list and tools/call are tested.
It is not yet a production-ready remote MCP server. See MCP_LOCAL.md for setup,
explicit local consent, token handling and current limitations.

Reusable foundations: normalized NP, Ukrposhta and Meest tracking,
owner-scoped shipment storage and refresh leases, encrypted personal carrier
credentials, bounded transports and privacy-safe output. Browser authentication
is not authorization for an MCP client; a carrier token is not an MCP credential.

## Implemented Local Scope

Tools: list_shipments, get_shipment, get_tracking and find_np_points.
Strict bounded schemas, SQL pagination and structured errors are implemented.
Owners are resolved on every call from the privately configured local session,
never caller-supplied owner IDs. No carrier secrets or raw provider payloads are
accepted or returned. Only find_np_points contacts the public NP directory.
Refresh is not exposed: it writes stored state even when
the carrier request is read-only and requires separate authorization.

Remote launch needs client/audience validation, per-tool scopes, explicit user
consent and revocation, origin policy, distributed rate limits, privacy-safe
audit logs, protocol and cross-owner tests. Use the official MCP SDK.

Shipment creation and labels need verified carrier issuance contracts, durable
versioned drafts, explicit confirmation bound to current draft/quote,
idempotency and recovery from uncertain writes. Contacts/templates are not yet
durable and should not be exposed as production tools.

## Local Setup And Carrier Boundaries

Personal keys are entered at `/business/integrations` in the carrier tab,
never stored in localStorage. NP is validated with a read-only provider call.
Ukrposhta and Meest are saved but not marked provider-verified. Meest renewal
is manual; documented token lifetime is 24 hours.

Private runtime requires `DELIVERY_TURSO_DATABASE_URL` and
`DELIVERY_CREDENTIAL_ENCRYPTION_KEY` (canonical base64 of 32 random bytes).
Keep these in private local configuration, never PUBLIC_ or VITE_ variables.
Do not send the encryption key through chat. Apply migrations 001 through 005
only to a dedicated local tracking database using `migrate-local.mjs`.
Production configuration and remote migrations remain unapproved.

SAT publishes an HTTP authenticated production endpoint: do not send keys until
HTTPS is confirmed. Delivery Auto publishes an API/key cabinet, but the exact
tracking contract and account access still require verification.

Sources:
- https://www.sat.ua/api/trackingget/
- https://www.sat.ua/clients/api/registration/
- https://m.delivery-auto.com/en/Home/API
- https://m.delivery-auto.com/en/Account/ApiKey
- https://wiki.meest-group.com/api/ua/v3.0/openAPI

Tests use mocks and disposable databases, not live carrier credentials.
No deployment, Supabase write or remote migration is part of this work.