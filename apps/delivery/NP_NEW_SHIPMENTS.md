# Nova Poshta New Shipments

## Scope And Current State

Business goal: prepare an order once, issue exactly one express waybill after
confirmation, obtain official documents, hand over all parcels and track delivery
and payment exceptions from the same shipment record.

This document specifies the next implementation phase. The existing wizard only
validates branch/locker routes and estimates price/date. It does not persist a
draft, create an NP document, print an official label or book a courier. Local
draft printouts must never be represented as an NP express waybill.

## Account And Sender Setup

- Use only the authenticated owner's encrypted NP credential for account data,
  estimates, issuance and print retrieval. Remove the preparation action's shared
  environment-key path before enabling issuance. No silent shared-key fallback.
- Load available sender counterparties, contacts, phones and addresses from that
  account. Select a default sender and origin, but allow multiple authorized
  sender profiles. A valid key alone is not a fully configured sender profile.
- Validate selected references against the same account on the server. Never
  trust arbitrary sender, contact or document references supplied by a browser.
- Refresh account choices when a credential is replaced. Existing documents must
  not silently become printable through a different account's credential.
- Separate owner and staff permissions for issuance, viewing personal data,
  printing, cancellation and managing credentials. Until team authorization is
  implemented, all operations remain strictly personal-owner scoped.

## Preparation Workflow

1. Create a persistent, owner-scoped draft with an internal order reference.
   Restore it after navigation or failure; version it to prevent stale-tab edits.
2. Select sender profile, dispatch date and branch/locker or address route.
   GPS suggestions remain optional, with manual alternatives and explicit consent.
3. Enter recipient name, normalized phone and destination. Support person and
   organization flows only after their individual NP contracts are verified.
   Reuse account contacts where appropriate; do not create duplicates on retries.
4. Describe cargo, type, declared value and every seat's weight and dimensions.
   Recheck the selected point's working status, total/per-seat limits, dimensions,
   locker restrictions and route availability on the server before submission.
5. Choose delivery payer and supported payment method. Offer third-party payer,
   packaging, return documents and other services only when account and route
   capabilities have been verified; never silently substitute unsupported values.
6. Treat cash on delivery separately from delivery charges and declared value.
   Capture collection amount, return-money payer and supported settlement details.
   Show fees and account eligibility; delivery does not mean funds were settled.
7. Show final recipient, route, cargo, services, payer and current estimate.
   Distinguish estimates from the final provider amount. Require an explicit
   confirmation before making carrier-side writes.

Keep phone/address retention bounded and access controlled. Persist only data
needed for fulfillment, support and audit; do not store full raw API responses.

## Issuance And Recovery

- Model draft, ready, submitting, issued, rejected, outcome-unknown and cancelled
  separately from parcel delivery status. Printing also has its own status.
- Persist an issuance attempt and immutable payload fingerprint before the NP
  request. Bind a unique idempotency token to owner, draft and draft version;
  concurrent clicks/tabs must not make duplicate carrier requests.
- Verify the official creation contract for each supported route, including
  warehouse, locker-origin, locker-destination and address variants. A generic
  WarehouseWarehouse estimate is not proof that all these issuance payloads work.
- On confirmed success, persist the NP document Ref, TTN, returned dates/costs and
  supported per-seat identifiers, then attach tracking to the same owner.
- On timeout, disconnect or local-save failure after a possible NP write, mark
  outcome-unknown. Do not automatically issue again. Reconcile against the
  account's document list/details using verified fields; multiple or uncertain
  matches require operator review. Do not assume NP supports idempotency headers.
- A failed print or tracking enrollment must not recreate the document. Make
  local follow-up operations independently retryable after issuance is recorded.
- Cancellation/editing must use verified eligibility and explicit confirmation.
  Never interpret local deletion as cancellation at NP. Retain an audit record.

## Official Express-Waybill Printing

Verified on 2026-10-09 against the official
[Express waybill printed form](https://developers.novaposhta.ua/view/model/a3fe2fdd-8512-11ec-8ced-005056b2dbe1/method/a4583ee4-8512-11ec-8ced-005056b2dbe1).

The documented service is `https://my.novaposhta.ua/orders/printDocument`.
Examples accept an express-waybill number or Ref through `orders[]`, `type/pdf`
or `type/html`, with `apiKey` in the URL path. The page also documents a
comma-separated `orders` path for multiple waybills. It does not establish a
batch limit or all paper/thermal formats; verify these separately before coding.

Required product behavior:

- After successful issuance, provide distinct actions for official express
  waybill PDF, per-seat marking and repeat printing. Keep local draft printing
  visually and functionally separate. Never manufacture an official barcode.
- Download the original provider PDF through an authenticated same-origin server
  endpoint, using a saved local shipment ID. Resolve its issued Ref and owning
  account server-side. An arbitrary tracked TTN is not print authorization.
- Do not send a provider print URL containing the key to the browser, redirect
  to it, include it in logs/traces/errors, or load it in an iframe. Redact outbound
  URLs in HTTP instrumentation as well as application logs.
- Allow only the fixed provider HTTPS host/path and validated identifiers. Reject
  redirects, impose a timeout and streaming size limit, validate PDF content type
  and signature, and reject HTML login/error pages masquerading as success.
- Return private/no-store responses, nosniff, a safe PDF filename and explicit
  disposition. Do not inject carrier HTML into our origin. Offer browser print
  from the retrieved PDF; never assume a printer silently accepted a job.
- Retry printing independently. Expired/revoked keys, unavailable PDFs and
  provider errors leave the issued shipment intact and show a recoverable error.
- Batch selection must authorize every document and group by owning carrier
  account. Reject mixed unauthorized selections before contacting NP. Set batch
  size only after verification and report per-document failures without reissue.

## Marking, Registers And Handover

The express-waybill page states: with register-based handover, marking goes on
every seat; without a register, the express-waybill form goes on the first seat
and marking on subsequent seats. Therefore a single PDF action is insufficient
for multi-seat fulfillment.

- Verify the separate official marking and register contracts, available formats,
  dimensions and page order. Expose only supported formats, with original size
  preserved for thermal and office-printer workflows.
- Show seat count and a printable document for every required seat. Test that
  multi-seat labels belong to the correct shipment and are not missing/duplicated.
- Support selecting issued documents, creating an NP register, printing its
  official form and changing membership only while NP permits it. Maintain a
  distinction between local selection and a confirmed carrier register.
- Treat courier pickup as a separate booking with its own confirmation, pickup
  window and status. Creating a TTN does not book a courier or confirm handover.
- Track returns, redirection and permitted edits as explicit provider operations,
  with eligibility checks and cost confirmation, not automatic local changes.

## SMB Operations And Priorities

- Release gate: persistent drafts, personal sender setup, verified initial route,
  reliable issuance/reconciliation, official PDF/required markings and tracking.
- Next: document batches/registers, runtime polling, storage/deadline alerts,
  delivery exceptions and return workflows. No inferred pre-enrollment history.
- Then: team permissions, import with row-level validation, order-system API,
  signed retryable webhooks, customer notifications with consent and settlement
  reconciliation for cash on delivery. Static integration tabs are not support.
- Display readiness honestly. Address routes, cash on delivery and extra services
  remain unavailable until their contracts and acceptance cases pass.

## Acceptance And Rollout Gates

- Unit/contract tests: sender/contact ownership, route/locker/dimension limits,
  service compatibility, monetary precision and invalid carrier responses.
- Durable workflow tests: double click, two tabs, process interruption, timeout
  after provider creation, failed persistence, ambiguous reconciliation and
  repeat submission after successful issuance. No silent duplicate documents.
- Security tests: anonymous/cross-owner access, forged document references,
  credential replacement, secret-free page/redirect/log output, no-store headers,
  malicious redirects, oversized PDF and HTML-instead-of-PDF responses.
- Browser tests: draft restore, confirmation, rejected/unknown issuance states,
  successful TTN with independent print retry, mobile layout and batch failures.
- Approved live acceptance: owner's real account, explicitly approved test
  issuance, comparison with the NP cabinet, readable official PDF and marking
  for each seat, verified cancellation where permitted. Do not run carrier writes
  merely to test connectivity. Never collect credentials through chat.
- Storage: implement versioned local libSQL migrations and recovery tests first.
  No Supabase objects are currently changed. If shared/cloud storage is selected,
  assess each intended database separately, including rhnk.to; approve remote
  migration targets and deployment independently. Never copy business data or keys.

Definition of done: a user can issue an approved shipment once, recover its result
after interruption, retrieve the correct official documents without exposing
their key, and follow the same shipment through handover and tracking. A prepared
payload, local print template or mocked test alone does not meet this gate.