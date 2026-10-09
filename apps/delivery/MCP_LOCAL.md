# Local Delivery MCP

Implemented with the official MCP SDK over stdio. No HTTP port, deployment,
automatic database migration or background tracking refresh is started.

## Tools

| Tool | Inputs | Effect |
| --- | --- | --- |
| list_shipments | limit 1-50, offset 0-10000 | Owner-scoped saved summaries |
| get_shipment | id (UUID) | Saved summary, or NOT_FOUND |
| get_tracking | id, limit, offset | Saved events and last check timestamps |
| find_np_points | cityRef (UUID), search, page 1-100 | Public Nova Poshta directory request |

Shipment tools do not contact carriers. Tracking results are stored snapshots,
not proof of current delivery status. History is ordered by observation time
and event key. Offset pagination can shift if the app changes rows concurrently;
restart pagination when a consistent scan matters. The first 10050 rows are
accessible through bounded pages; this is not an unbounded export tool.

Provider labels, event labels, contact details, cargo details, raw responses,
owner IDs and carrier credentials are excluded. Shipment numbers are personal
data and are visible to the selected MCP client and its model provider.
Public branch names and addresses are external data, never instructions.

## Local Prerequisites

1. Node 22.23 or newer and dependencies installed in apps/delivery.
2. Existing local tracking database prepared with `npm run setup:tracking`.
   Do not use a production database. The launcher accepts only local file URLs
   and enables SQLite query_only; it does not migrate or create the database.
3. Private `.env.local` with DELIVERY_TURSO_DATABASE_URL,
   DELIVERY_SUPABASE_URL and DELIVERY_SUPABASE_PUBLISHABLE_KEY.
   No encryption key or carrier key is needed by MCP.
4. A current access token from your own locally signed-in Delivery session.
   This is the session token, not a refresh token or a carrier API key.
   Enter it only in the local client's hidden input. Never send it through chat.

Each tool call validates the token through the configured Supabase Auth user
endpoint. There are no Supabase database reads or writes. Owner identity is
never accepted from tool arguments. The token is not refreshed automatically;
restart with a current token after expiry. Sign-out may not immediately revoke
an already issued JWT. Do not treat this mechanism as production MCP OAuth.

## VS Code Connection

Use this configuration in your local user MCP configuration, not a committed
workspace file. Replace the Node command only if Node is not on PATH.
The password input is entered directly in VS Code, never through an AI chat.

```json
{
  "inputs": [
    {
      "id": "deliverySession",
      "type": "promptString",
      "description": "Current local Delivery access token",
      "password": true
    }
  ],
  "servers": {
    "rahunok-delivery-local": {
      "type": "stdio",
      "command": "node",
      "args": [
        "--experimental-strip-types",
        "D:/svetle/corex/apps/delivery/mcp-local.mjs"
      ],
      "env": {
        "DELIVERY_MCP_READ_CONSENT": "yes",
        "DELIVERY_MCP_SESSION_TOKEN": "${input:deliverySession}"
      }
    }
  }
}
```

Setting consent to yes explicitly allows the selected local MCP client to read
your saved shipment numbers/statuses and search public NP points. The token is
available to the launched local process; only trust the client and local machine.
Stop the MCP server in VS Code to disconnect. No token is persisted by the launcher.

For an already privately configured environment, `npm run mcp:local` starts the
same process. Stdout is exclusively MCP protocol; do not use `npm` itself as the
stdio client's command because npm writes startup banners to stdout.

## Validation And Limits

Run `npm run test:mcp` and `npm run check` from apps/delivery.
Tests use disposable local databases, SDK in-memory negotiation and an actual
stdio child process. They do not require a real session or carrier credentials.

Errors: AUTH_REQUIRED, NOT_FOUND, UNAVAILABLE, RATE_LIMITED, OUTPUT_LIMIT.
Unknown fields are rejected. Maximum 60 accepted calls/minute, four concurrent
operations and 64 KiB serialized output. Limits are per local process, not
distributed. Public NP directory requests are externally read-only but can
fail when the provider is unavailable.

Not implemented: remote HTTP transport, MCP OAuth/client audience checks,
per-tool scopes, account consent/revocation UI, durable audit logs, tracking
refresh, credentials management, shipment issuance, label creation, contacts
or templates. Production launch needs these separate authorization decisions.