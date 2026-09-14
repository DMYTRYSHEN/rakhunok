# Isolated Telegram invoice PNG renderer

Integration API: import `renderInvoicePng` and optional type
`TelegramInvoiceRenderData` from `worker/src/telegram-invoice-renderer.ts`.
The function accepts `{ amount, reference, recipient, issuedAt,
displayExpiresAt, checkoutUrl }` and returns `Promise<Blob>` (`image/png`).

- `amount`: exact ungrouped decimal UAH string, e.g. `12580.00`; up to 14
  integer digits. Rendering uses grouping and a Ukrainian decimal comma.
- `reference`: authoritative RHK reference, not an invented identifier.
- `recipient`: authoritative legal ФОП/ТОВ name. Two lines, measured wrapping
  and ellipsis. Latin and Cyrillic (including all Ukrainian letters) are
  supported; unsupported scripts/emoji use a visible `?` fallback.
- Dates: ISO date or ISO timestamp with explicit timezone; displayed in
  `Europe/Kyiv`. Invalid calendar dates are rejected. Both dates are required.
- `checkoutUrl`: shortest **already verified** absolute HTTP(S) checkout URL.
  The exact supplied bytes are encoded; the renderer never guesses `/o/`
  aliases, removes query parameters, resolves redirects or contacts shorteners.
  Caller remains responsible for trusted checkout origin and route selection.
  Credentials/fragments/whitespace and URLs over 512 characters are rejected.
  QR error correction M, integer modules at least 3px, minimum four-module
  quiet zone, dark ink on white, no logo overlays.

## Assets and runtime

1000×600 dark emerald card. Offline 96px Manrope alpha glyph atlas, coverage
downsampling, original user-supplied `logo – копія.svg` geometry, mint tint.
The generated shared module exports `TELEGRAM_LOGO_SVG` verbatim for frontend
reuse in the canonical invoice preview.

Regenerate with `node scripts/generate-telegram-invoice-art.mjs` from the root.
The generator uses the four existing Pay Manrope WOFF2 subsets, fontkit and
sharp. Generated artwork is checked in: no production generation step needed.
Manrope copyright and SIL OFL 1.1 accompany the atlas. Source hashes are tested.

Only `qrcode` is a new runtime dependency (root package). Native sharp and
fontkit are development-only. Runtime uses typed-array compositing and Web
CompressionStream/DecompressionStream. No network, DOM, native modules, font
loading or WASM. Request buffers and streams are not shared across requests.

## Local validation

Run `node --experimental-strip-types --test worker/src/telegram-invoice-renderer.test.mjs`.
Tests verify CRC-valid PNG, actual jsQR decoding, 500px-wide resize decoding,
quiet zone, Ukrainian coverage, maximum amount/long legal names, Kyiv dates,
input rejection, source hashes and two concurrent real workerd requests with
outbound fetch blocked. Workerd uses the existing compatibility date and no
Node compatibility flag. The browser bundle is approximately 181 KB unminified.

Synthetic previews are generated under `test-results/telegram-renderer/`:
`invoice.png` and `invoice-long.png`. These contain no customer information.

The invoice handler and composer now integrate this renderer and canonical preview.
Deployment and additional actual Telegram sends were not performed for the redesign.