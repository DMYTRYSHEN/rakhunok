# Route Compatibility Matrix

| Public URL                | Legacy behavior                                                                        | Corex target                        | Constraint                                    |
| ------------------------- | -------------------------------------------------------------------------------------- | ----------------------------------- | --------------------------------------------- |
| `/`                       | Worker currently redirects to `/dashboard/`; `core/Index.html` is the intended landing | Landing page                        | Do not change Worker routing during migration |
| `/app/`                   | Merchant POS/PWA                                                                       | `src/routes/app/+page.svelte`       | Preserve PWA and direct refresh behavior      |
| `/checkout/?id=:id`       | Public payer checkout                                                                  | `src/routes/checkout/+page.svelte`  | Preserve query and `order_id` fallback        |
| `/o/:id`                  | Short checkout alias                                                                   | `src/routes/o/[id]/+page.svelte`    | Preserve old links and QR codes               |
| `/t/:id`                  | Table alias                                                                            | `src/routes/t/[id]/+page.svelte`    | Preserve table resolution                     |
| `/tag/:id`                | NFC/tag alias                                                                          | `src/routes/tag/[id]/+page.svelte`  | Preserve tag identifiers                      |
| `/pos/:id`                | POS checkout alias                                                                     | `src/routes/pos/[id]/+page.svelte`  | Preserve identifier semantics                 |
| `/pay/:id`                | Legacy payment alias/redirect                                                          | `src/routes/pay/[id]/+page.svelte`  | Preserve existing shared URLs                 |
| `/dashboard/`             | Merchant cabinet                                                                       | `src/routes/dashboard/+page.svelte` | Preserve Auth return path                     |
| `/corex/`                 | New authenticated deployment subproduct                                                | `src/routes/corex/+page.svelte`     | Mock/read-only; target letsrealtalk.com only  |
| `/doc/`                   | API documentation                                                                      | `src/routes/doc/+page.svelte`       | Preserve static documentation                 |
| `/doc`, `/docs`, `/docs/` | Redirect to `/doc/`                                                                    | Compatibility routes                | Do not alter production redirect yet          |

## Checkout Identifier Precedence

The Corex checkout resolver must reproduce the observed legacy precedence and then be covered by unit tests:

1. Route parameter for a known checkout alias.
2. `id` query parameter.
3. `order_id` query parameter.
4. Recognized hash identifier.
5. Approved legacy localStorage fallback.
6. Explicit demo behavior only in a documented local/demo mode.

## Local Development

- Corex frontend origin: chosen by the SvelteKit dev server.
- Existing Worker origin: `http://localhost:8787`.
- `/api` should be proxied locally so application code can keep production-relative API paths.
- No production route or Cloudflare configuration change is part of the scaffold phase.
