# Merchant payment solution

Status: descriptive Demo blueprint; not a published or executable Live solution.

The first solution covers merchant onboarding, recipient details, invoice creation
with checkout parameters, customer payment, authenticated confirmation and optional
merchant notification. Corex composes existing domain operations; it does not replace
their authorization or financial authority.

## Confirmed product decisions (2026-09-23)

- Incoming payment evidence will arrive through webhooks from multiple banks.
  A-Bank is the first provider. Each bank requires its own reviewed authentication
  and payload adapter before normalization into a common payment-evidence contract.
- Merchant notification channels are Telegram and an outgoing merchant webhook.
  Both are in scope; neither is a substitute for the incoming bank webhook.
- Notifications are optional. The proposed configuration supports neither channel,
  either channel, or both, with independent delivery records and retry policies.
- The user's third answer repeated the notification channels rather than selecting
  an invoice scenario. The pilot scenario is still unconfirmed; `fixed` remains a
  recommendation, not approval to modify it or any other payment scenario.

## Integration contracts to establish

The A-Bank webhook is a provider-specific ingress, not a generic public command to
mark an invoice paid. A user-supplied payload example is recorded below by structure,
without copying account or transaction identifiers. Obtain the bank's actual webhook
specification before implementing verification: authentication/signature rules, signed
bytes, event and transaction identity, payment status semantics, recipient fields,
retry behavior and acknowledgement requirements. Do not infer these from BankLink
deeplink settings or invent a signature header. Keep secrets out of this document.

Resolve tenant and environment through trusted bank-connection configuration, not
untrusted payload claims. Authenticate before accepting evidence, preserve provider
identity during normalization and scope replay protection to the provider and
connection. Only authoritative reconciliation may produce a confirmed-payment event.

The outgoing merchant webhook is a separate proposed contract: versioned event
payload, stable event ID across retries, authenticated signature, attempt timestamp,
secret rotation and receiver deduplication guidance. Verify destination ownership
and enforce outbound URL/redirect policy before activation. A successful HTTP
acknowledgement means receiver acceptance, not proof of downstream business work.

Telegram requires an authorized merchant-to-chat binding and server-side bot
credentials. Provider acceptance does not prove the merchant read the message.
When both channels are enabled, one channel's failure must not resend a successful
delivery to the other or change the financial state. Ambiguous Telegram outcomes
must remain visible; exactly-once delivery is not guaranteed.

## A-Bank payload evidence (2026-09-23)

The supplied JSON has `result`, an envelope `timestamp`, `payments[]`, `request_ref`
and `response_ref`. The user confirmed that this is an incoming bank webhook,
that A-Bank status `70` denotes completed successful credit according to the
recipient bank. The user's latest correction supersedes the earlier mapping:
`purpose` will contain the invoice's `short_id`, not the application's `payment_id`.
The UUID-shaped purpose in the original sample is not representative of this target
contract; synthetic fixtures must use a valid invoice `short_id` instead.
These are user-confirmed integration semantics, not independently verified bank
documentation or proof that a particular HTTP request originated from the bank.
`result: "ok"` is not evidence that every payment settled. One example cannot
establish required fields, nullability, limits or all supported status values.

| Observed field                                      | Proposed treatment pending provider documentation                                                                                                                                                                                         |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `payments[].id`                                     | Candidate bank payment identity; preserve as a lossless identifier and confirm uniqueness scope.                                                                                                                                          |
| `bill_id`                                           | Candidate bank bill reference; do not assume it is the local invoice ID.                                                                                                                                                                  |
| `status`                                            | User-confirmed A-Bank mapping: `70` means completed successful credit at the recipient bank. Preserve the raw value; do not apply this mapping to other banks or bypass authentication and reconciliation.                                |
| `credit_iban`, `credit_okpo`, `credit_name`         | Recipient evidence; reconcile against the persisted actual recipient snapshot, not current merchant settings or name alone.                                                                                                               |
| `purpose`                                           | User-confirmed invoice `short_id`. Validate against the invoice reference format and match exactly to a persisted invoice within the authorized bank-connection scope; do not fall back to `payment_id`, invoice UUID or bank payment ID. |
| `currency`, `sum`                                   | Candidate original payment currency and amount. If `sum` is documented in major UAH units, `1.01` normalizes exactly to 101 minor units. Use decimal-safe validation, not floating-point equality or silent rounding.                     |
| `sum_uah`                                           | Preserve separately; do not substitute it for original amount/currency without documented conversion semantics.                                                                                                                           |
| `code`, `uetr`, `uetr_date`                         | Additional reconciliation references; uniqueness and availability need confirmation.                                                                                                                                                      |
| `created`, `changed`, payment `timestamp`           | Preserve source values; ISO-like strings lack timezone offsets, and numeric timestamp units/meaning require confirmation. Do not infer delivery freshness from transaction time alone.                                                    |
| `request_ref`, `response_ref`, envelope `timestamp` | Envelope correlation candidates, not proven transaction or event deduplication keys.                                                                                                                                                      |
| `debit_iban`, `debit_okpo`, `debit_name`            | Sensitive payer data; exclude from routine logs, Telegram and outgoing merchant webhooks unless explicitly required and authorized.                                                                                                       |

The proposed A-Bank success path is: authenticate the request, validate each payment,
resolve `purpose` against the persisted invoice `short_id`, require status
`70`, reconcile amount/currency/actual recipient and eligible invoice state, then
atomically record confirmation and durable notification intents. Missing, ambiguous
or unauthorized mappings must not fall back to guessing from amount or payer name.
An unknown status must not use the success path or regress an already paid invoice.

The bank's `payments[].id`, the application's `payment_id` and the invoice's
`short_id` are different identity namespaces. Use only `short_id` for this purpose
mapping. Confirm how the bank receives and preserves `short_id` in `purpose`
for the selected checkout path before activation; this document does not change
existing invoice references, visible purposes or payment instructions.

Distinguish payment identity from event/update identity: a payment may appear again
with another status. Deduplicating only by payment ID could discard a later valid
confirmation. Determine provider update identity and ordering before implementing
replay handling; atomically guard the final invoice transition separately.

For batches, resolve each payment within the authenticated bank connection and
verify its recipient and invoice mapping independently. An unmatched item must not
be assigned to a merchant using a client-supplied tenant ID. Define durable receipt,
item-level outcomes and bank acknowledgement/retry semantics before enabling ingress.

The sample and confirmed semantics are suitable for synthetic Demo fixtures, not
proof of a settled local invoice. The status mapping is documented only; no runtime
adapter, financial mutation or notification is activated by recording it.

## Implemented slice

- The process picker places `Шлях мерчанта · Demo` first, with two canvas journeys:
  `merchant-payment-demo` and `terminal-cash-order-demo`. The first shows the full
  merchant journey, including rejected evidence, payment reconciliation and
  independently optional Telegram and outgoing webhook branches.
- `terminal-cash-order-demo` starts with a cash-desk business-order draft, then
  shows the payable invoice and checkout link, customer bank handoff, incoming
  A-Bank webhook authentication and reconciliation, proposed atomic confirmation,
  and an optional outgoing merchant webhook. Untrusted or unmatched events do not
  reach paid; notification delivery is independent of payment status.
- Dashboard POS selects a table or cash desk for a terminal-specific local draft.
  Submitting a positive amount on an active point without another pending order
  creates a pending TABLE-type invoice with fixed `terminal_id`. The board groups
  `pending`, `preparing` and `ready` as unpaid. For an unpaid order, the existing
  actions are cash payment (mark paid with `CASH`) or confirmed cancellation
  (mark `cancelled`); there is no separate server-side unassign action. Once
  cancelled or paid, a new draft can use that point without changing the old
  invoice's terminal identity. Table expiry uses the merchant-configured TTL;
  cash desk (`kasa`) orders have no expiry.
- The bank and outgoing merchant webhook branches remain proposed integration,
  not Dashboard POS actions. The Demo does not send a bank webhook when a cashier
  selects cash or cancellation. Actual availability of a reusable table/tag link
  and expiry enforcement require their own contract review.
- Every node in both journeys is a non-executable Demo preview. Selecting or
  cloning a scenario does not connect a bank, confirm an invoice or send a webhook.
- `src/lib/features/corex/merchant-payment-flow.ts` describes the journey using the
  existing Flow schema. Its process UUIDs are fixtures, not deployed process bindings.
- `payment-basic` omits external notifications. `payment-notification` enables them.
- Existing delivery and loyalty variants remain descriptive and unchanged in scope.
- Projector tests verify the stage order and optional participant filtering. They do
  not establish payment verification, message delivery or runtime idempotency.

## Ownership and lifecycle

| Stage            | Authority                                          | Completion evidence                                               |
| ---------------- | -------------------------------------------------- | ----------------------------------------------------------------- |
| Onboarding       | Existing authenticated Dashboard operations        | Stored merchant identity and access                               |
| Recipient setup  | Existing seller/settings operations                | Server-validated configuration revision                           |
| Invoice creation | Authoritative invoice API/RPC                      | Persisted reference, amount, recipient and checkout configuration |
| Checkout         | Pay                                                | Payment authorization handoff, still pending                      |
| Confirmation     | Reviewed provider adapter and settlement authority | Authenticated evidence reconciled atomically against the invoice  |
| Notification     | Authorized channel adapter                         | Independent delivery status and provider reference                |

Onboarding and recipient setup are reusable prerequisites, not operations repeated
for every invoice. Each payable invoice has its own correlated execution and pinned
configuration. Updating merchant settings must not reinterpret an existing invoice.

Checkout parameters may select supported presentation and scenario options. They
must not override server-owned amount, recipient, reference or payment status.
Initial Live scope should use one concrete fixed-amount invoice; this is a proposal,
not approval to change any existing scenario.

Confirmation must authenticate the provider, deduplicate transaction/event identity
and reconcile reference, amount, currency, recipient and eligible invoice state.
Browser returns, bank application launches and unsigned callbacks are not evidence
of success. Unknown or mismatched evidence stays unresolved and observable.

Notification failure never changes a paid invoice back to unpaid. No configured
channel means notification is skipped. A failed channel has bounded retries and an
operator-visible final failure. Ambiguous external effects require reconciliation;
do not promise exactly-once delivery when the provider has no idempotency mechanism.

## Next implementation slices

1. Isolated Demo execution: fixture adapters for success, rejected evidence, timeout,
   duplicate evidence and failed notification; no external writes or credentials.
2. Live binding resolution: replace fixture IDs with server-resolved published
   versions; reject missing, cross-tenant or wrong-environment dependencies.
3. Trusted orchestration: reuse onboarded merchant context, create/link invoice runs,
   consume durable authenticated events and preserve generation/version identities.
4. Provider integration: establish the A-Bank webhook contract, then implement its
   verification and reconciliation with focused database and Worker integration
   tests. Keep provider adapters extensible without enabling unreviewed banks.
5. Notification adapters: implement Telegram and outgoing merchant webhooks with
   verified destinations and server-side credentials; test each channel independently
   and both together, separately from financial state.
6. Product activation: expose configuration and run history through existing Corex
   and product surfaces, with role checks, release approval and observable failures.

## Acceptance tests before Live activation

- Two merchants cannot read, bind, run or notify through each other's resources.
- Demo cannot invoke Live mutations; Test cannot resolve production credentials.
- Incomplete onboarding or recipient settings prevent new invoice creation.
- Valid checkout options preserve server financial authority and old invoice links.
- Payment handoff leaves the invoice pending; unauthenticated or mismatched evidence
  cannot mark it paid or enqueue a success notification.
- Duplicate evidence and concurrent delivery attempts do not duplicate financial
  transitions; notification retries obey the selected provider's effect contract.
- Crashes around commit, workflow creation, external send and acknowledgement are
  recoverable without falsely claiming success.
- Cancelled/expired invoices, late evidence and amount/currency/recipient mismatches
  follow explicitly approved domain rules rather than generic workflow decisions.
- Disabled, delivered, retrying and failed notifications are distinguishable.
- Unknown banks, invalid authentication and wrong-connection evidence are rejected;
  equal event IDs from different bank connections do not collide or cross tenants.
- A-Bank contract tests cover empty/multi-item batches, repeated payments with status
  changes, unknown statuses, invalid or unknown `short_id` purposes, UUID purposes
  rejected without a `payment_id` fallback, missing fields, unsafe numeric
  IDs, invalid amount precision, currency mismatch and ambiguous timestamp formats.
  Authenticated A-Bank status `70` with a matching persisted `short_id`, amount,
  currency, recipient and eligible invoice state follows the success path. The same
  payload without valid authentication or with any mismatch cannot mark an invoice
  paid. Other banks do not inherit A-Bank's status mapping.
- Telegram-only, webhook-only, both-channel and disabled configurations are covered.
  A failed channel does not repeat the other channel's successful delivery.
- Merchant webhook signatures, stable event IDs, retries, secret rotation and unsafe
  destination rejection follow the agreed outgoing contract.
- Invalid Telegram chat bindings are rejected; ambiguous send outcomes are not
  reported as proven delivery or merchant acknowledgement.
- Version changes do not mutate active executions or persisted invoice snapshots.
- Browser refresh/reconnect preserves the correlated timeline without synthetic data.

## Approval boundaries and open decisions

No Dashboard, Pay, Merchant App, Worker payment behavior, schema or deployment is
changed by this blueprint. `CROSS-APP-INVOICE-SCENARIOS-001` and other process locks
remain authoritative; previous narrow unlocks do not authorize this entire solution.

Before Live integration, approve the exact invoice scenario and behavior scope,
obtain the A-Bank webhook specification to validate the supplied example, and establish
the outgoing merchant webhook contract and authorized Telegram binding. Provider
and channel selection do not authorize changes to financial behavior. Remote
migrations and every production deployment require separate authorization. Start
with isolated local/Test fixtures.
