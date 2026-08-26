# Dashboard readiness

Verified against the current Corex UI, dashboard gateway, checked-in SQL, and migration documents on 2026-08-26.

## Product model

Rahunok combines three product contours without copying their implementation:

- **Square POS:** locations, terminals, shifts, staff roles, cashier-scoped operations, and live order state.
- **Revolut:** a stable financial identity at `https://rahunok.com/@handle` and simple payment requests.
- **Expirenza:** a rich public business profile with verification data, social accounts, contacts, and payment entry points.

## Current capability matrix

| Area | Read | Write | Current source | UI state |
| --- | --- | --- | --- | --- |
| Session and merchant | Ready | Sign-in only | Supabase Auth and `merchants` | Active |
| Overview | Ready | Not available | Supabase orders and terminals | Read-only |
| Invoices | Ready | Not available | Supabase `orders` | Read-only; cancel/create remain unavailable |
| Invoice events | Ready | Not available | Worker API, then Supabase fallback | Read-only |
| POS board | Ready | Not available | Supabase terminals/orders plus Realtime/polling | Read-only; cart submit remains unavailable |
| Business structure | Ready except bank accounts | Not available | Merchant, business entities, terminals | Entity and terminal CRUD use existing RLS; bank-account writes locked pending deployed schema |
| Bank accounts | Not ready | Not available | No confirmed contract | No synthetic account; add is locked |
| Invoice rules | Browser-local | Browser-local draft | Versioned localStorage | Preview/configuration only |
| Payment methods | Browser-local | Browser-local draft | Versioned localStorage | Does not activate Tranzzo or wallets |
| Public profile | Browser-local | Browser-local draft | Versioned localStorage | `@handle` publishing and copy are locked |
| Team and cashiers | Not ready | Not available | No membership contract | Visible planned module; invite is locked |
| Theme and table TTL | Browser-local | No runtime effect | localStorage | Controls with no runtime consumer are locked |

`?demo=1` replaces financial datasets with fixtures. It must never be used to infer production write readiness.

## Write-readiness decision

The dashboard reads merchant-scoped invoices, events, entities, terminals, and active POS orders through existing contracts. Invoice create/cancel, POS create/cash/cancel, merchant naming, business entity CRUD, and terminal CRUD are operational with single-request guards. Bank-account writes remain unavailable until the deployed schema is verified.

Writes remain disabled until all of the following are verified against the deployed environment:

1. The deployed tables and columns match a versioned contract.
2. Every mutation has an explicit gateway method and typed result.
3. RLS is tested for owner, manager, cashier, and unrelated users.
4. Idempotency and audit events are defined for financial mutations.
5. Worker and direct-Supabase ownership boundaries are explicit.

## Team and cashier backend contract

The current `merchants.user_id` ownership model assumes one owner and cannot authorize staff. Frontend role switches or localStorage roles must never grant access.

The future backend needs concepts equivalent to:

- `business_memberships`: user, merchant, role, status, invited/accepted timestamps.
- `business_locations`: merchant-owned operating locations.
- `member_location_assignments`: locations a staff member can access.
- `member_terminal_assignments`: optional terminal restrictions.
- `shifts`: cashier, terminal, opened/closed timestamps, opening/closing totals.
- RLS policies that derive access from active membership and assignments.

Minimum roles are `owner`, `manager`, and `cashier`. The cashier role should be able to operate only assigned locations/terminals and must not see provider secrets, ownership settings, or unrelated businesses.

## Public `@handle` backend contract

The canonical public identity is `https://rahunok.com/@handle`. The browser draft is not a reservation.

Publishing requires:

- a unique, case-insensitive handle stored server-side;
- reserved-name enforcement and rename history/redirect policy;
- a public resolver for `/@handle`;
- business/profile publication status;
- verified social links rather than arbitrary trust badges;
- explicit visibility controls for legal details, contacts, and payment methods;
- abuse reporting and moderation states.

The public page can then aggregate verified business identity, social accounts, locations, contacts, products/services, payment links, and reviews or service feedback where legally appropriate.

## Next backend-safe sequence

1. Capture a sanitized deployed-schema fixture and verify current RLS before enabling writes.
2. Design memberships, locations, assignments, and shifts; test owner/manager/cashier isolation.
3. Add typed gateway mutations for one narrow workflow, preferably creating a draft POS order.
4. Add audit events and idempotency, then unlock only that UI action.
5. Implement handle reservation and the public resolver separately from the payment path.