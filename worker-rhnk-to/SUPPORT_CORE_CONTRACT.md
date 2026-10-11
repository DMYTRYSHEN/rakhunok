# Local Support Core Contract

Scope: this document describes the original standalone synthetic kernel only.
The later actual Dashboard route, dedicated HTTP handler and prepared SQL boundary
are tracked in [the current integration checkpoint](../docs/CLIENT_SUPPORT_MODE_PLAN.md).
They do not use this kernel as their authorization boundary. The feature migration
has not been applied, no support role granted and no support deployment performed.
Real writes and executable isolated sandbox remain unimplemented.

Historical kernel status: local kernel with synthetic unit tests only. No HTTP route, deployment
configuration, real identity verifier, database adapter, role grant or customer UI.
No Axiom or external telemetry. The kernel is not a deployable authentication service.

Entry: `createSupportCore` in `support-core.js`. Methods: `open`, `overview`, `end`.
Validation: `node --test worker-rhnk-to/support-core.test.mjs`.

## Trusted Adapters

`auth.authenticate(credential)` must return a freshly verified actor or null:
`userId`, `sessionId`, `aal`, `active`, `stepUpAt`, `expiresAt`.
Times are epoch milliseconds. It must verify token signature, expected project
issuer/audience, expiry and actual session revocation. `stepUpAt` must come from
verified MFA evidence, not the token issuance time or user-editable metadata.
This contract is not implemented by decoding a JWT or accepting a request body.

`store.hasRole(actorId)` must consult current server-controlled eligibility,
including the support kill switch. It must not trust stale JWT roles or cache
revocation-sensitive decisions. `ownsMerchant(targetId, merchantId)` must use
authoritative ownership. Membership semantics are not supported by this kernel.

`store.openAudited(session, event)` must atomically recheck role, auth-session
binding and merchant ownership; reject existing active sessions for the actor;
then persist the support session and opening event in one transaction. True means
durably committed. No partial session may survive an audit failure. Concurrency
must be enforced by the database, not a check-before-insert in application memory.
The local test fixture only models this contract; it proves no database locking.

`store.getSession(id)` returns a detached session snapshot or undefined.
`store.appendAudit(event)` acknowledges durable persistence with true. The adapter
must recheck session/actor eligibility when recording read admission; race-sensitive
authorization belongs at the data access boundary as well as in the kernel.
`store.revokeAudited(id, actor, event)` atomically verifies the actor binding,
revokes idempotently and records the event; false must not be reported as success.
All other failures must be sanitized; raw database errors are never returned.

`reads.overview({sessionId, actorId, authSessionId, requestId, targetId, merchantId})`
returns only scoped summary values:
boolean onboardingComplete/merchantActive and nonnegative safe-integer
entityCount/terminalCount. It must not accept arbitrary resource names, SQL,
queries, URLs, or forwarded client tokens. It must independently enforce the
authorized read context, including the active session, current role and request's
audit admission, before reading customer rows. No customer write capability is
exposed through this adapter.

## Kernel Guarantees And Limits

- UUID identities, distinct actor/target, AAL2, active auth and current role checks.
- Opening requires MFA evidence less than five minutes old; support lifetime is
  capped at 15 minutes and the verified actor token expiry. No silent renewal.
- Input accepts targetId, merchantId and a bounded uppercase reason code only.
  Free-text explanations/incident reports need a separate sanitized contract.
- Read admission is audited before invoking the read adapter. Role, ownership,
  auth-session binding and expiry are checked again before release, including
  after completion audit. An adapter must still enforce transaction-level checks.
- Only an explicit summary allowlist escapes; credentials/requisites are excluded.
- Each audit event has a unique ID. Read admission/completion share a request ID.
  Completion means an authorized result was prepared, not acknowledged by a browser.
- Interrupted/revoked/invalid-snapshot reads can retain a started event without a
  completion; these are not successful reads. Denied-request audit and failed-read
  reconciliation remain HTTP/storage integration work, not implemented guarantees.
- Storage failures and competing opens currently fail closed with unavailable
  codes. A typed conflict/result contract is required before public HTTP mapping.

The test fixture's identities are synthetic inputs, including the planned admin
UID. No account was verified, authenticated, modified or granted a support role.

## Integration Gate

Before exposing this module, implement and test the identity and transactional
storage adapters, private schema grants/RLS, project/environment fencing, semantic
read authorization, denial auditing and rate limits. Add strict-origin bounded-body
HTTP handling with no-store responses and stable status mapping. Then obtain the
recorded Dashboard auth/shell approvals before adding the support UI/gateway.
Remote schema, role assignments and rhnk.to deployment need separate exact approval.
DAC7 and deferred rhnk_main compatibility remain unassessed for a support schema.