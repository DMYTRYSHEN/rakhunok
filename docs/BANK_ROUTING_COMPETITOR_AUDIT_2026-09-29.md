# Bank routing comparison: competitor pages, `D:\bankroute`, and `public.banklink`

**Research date:** 2026-09-29  
**Purpose:** preserve the observed bank-link routes and catalog differences for future routing review.  
**Change status:** read-only research; no database, local bank file, payment, or deployment changes.

## Executive summary

- Three competitor flows were reviewed: iPay QR, UPC Pay by Bank, and IBANoplata IBAN QR.
- iPay returned 12 supported bank routes; its observed URL templates were the same on iOS and Android. It marked PrivatBank, Globus, and Pravex unavailable for technical reasons and did not support nine other banks in the tested catalog.
- UPC returned 22 banks for iOS and 36 for Android on a fresh invoice. Its platform routes differ substantially: Android commonly returns an Android `intent://` URL with an app package, while iOS commonly returns a bank URL or scheme. The UPC bank-list codes are UPC-specific, not `public.banklink.code` values.
- IBANoplata's page offered 17 banks in its mobile UI. Its frontend configuration shows how it builds iOS and Android links from an NBU QR URL; the payment-creation POST was deliberately not called, so these are observed routing rules, not newly generated payment URLs.
- The `public.banklink` table has 46 rows. A read-only comparison with the local current CSV found 22 bank IDs with differences across 72 fields after normalizing empty/null values and booleans. The local individual bank files are duplicated and are not a single authoritative snapshot.
- Several material inconsistencies warrant a deliberate catalog review: Alliance's route construction, PUMB's iOS prefix, MTB and VST route/activation differences, MONO's inactive status despite competitor availability, UKRSIB's conflicting templates, and UGB's long dynamic value stored in a template field.

## Scope, sources, and safety

### Sources reviewed

- iPay QR button flow: `https://qr.ipay.ua/script/v2/uk/button.js?v=994812` and the resulting route templates.
- UPC Pay by Bank page: a new invoice was used after a previous test invoice had expired. The new invoice identifier and all payment payload data are intentionally omitted here.
- IBANoplata public IBAN QR page inspected on 2026-09-29. The page showed a payment amount and beneficiary information; those values are not repeated here.
- Local records under `D:\bankroute`, including individual bank files, `Supabase Snippet Fetch Bank Link Records.csv`, the older CSV, JSON snapshots, and SQL snapshots.
- Read-only query of `public.banklink` in Supabase project `mwaeazabpvbxqfrceogr` on 2026-09-29; 46 records.

### Interpretation rules

- `{payload}` denotes the payment payload and is a placeholder, not a literal value.
- `I(package)` in the UPC Android table means exactly:

  ```text
  intent://bank.gov.ua/qr/{payload}#Intent;scheme=https;package={package};end
  ```

- Where a provider returned a different route shape or extra Android intent fields, the full shape is shown.
- A link observed or configured by a page does not prove that the bank app is installed, opens successfully, accepts that payload, or completes a transfer.
- The emulation used Chromium with mobile UA/device signals. It was not a physical iPhone or Android device and did not validate native app handoff.
- No bank app was opened and no payment was confirmed. UPC links were collected through the site's own pre-navigation callback. IBANoplata's dynamic payment-creation POST was not called.
- Long/dynamic payment-bearing values are not reproduced. In particular, the live UGB `universal_link` value looked like a full payload-bearing URL rather than a template and is represented only by safe metadata below.

## iPay routes

The same templates were observed for its iOS and Android requests.

| Bank | iPay route template | Comparison notes |
|---|---|---|
| monobank | `https://mbnk.app/qr/{payload}` | Also appeared in UPC and IBANoplata, with different UPC nesting. |
| А-Банк | `https://link.a-bank.com.ua/custom?sys=qr&qr={payload}` | iPay route differs from UPC's Android intent and iOS scheme. |
| Raiffeisen | `https://my-raif.apps.raiffeisen.ua/qr?payload={payload}` | Matches the UPC iOS route shape. |
| OTP | `https://pay.otpbank.ua/qr/{payload}` | Matches UPC iOS; differs from IBANoplata's `otpbankua://payment/qr/…`. |
| Кредит Дніпро | `https://creditdnepr.com.ua/qr_code/?{payload}` | UPC iOS omitted the `?`; UPC Android used it. |
| Радабанк | `https://radabank.com.ua/qr_code/{payload}` | UPC Android used an app intent. |
| Alliance | `https://alb.ua/qr/{payload}` | Matches UPC iOS and differs from the current `banklink.url_template` path. |
| SenseBank | `https://superapp.sensebank.com.ua/mob/qr/{payload}` | Differs from UPC and IBANoplata routes. |
| VST / Банк Восток | `https://bv.onelink.me/K6yT/{payload}` | Differs from the current `banklink` universal link. |
| Credit Agricole | `https://caplusapp.credit-agricole.ua/fr/pay/{payload}` | Matches UPC iOS; IBANoplata uses another path. |
| Південний | `https://link.bank.com.ua/qr/{payload}` | Matches UPC iOS. |
| МТБ | `https://web.a115.mtb.ua/qr-nbu/{payload}` | Differs from UPC/IBANoplata transfer-to-IBAN route and current `banklink` host. |

iPay reported PrivatBank, Globus, and Pravex disabled for technical issues during that test. Nine other banks were reported unsupported. Do not interpret this as a universal capability statement or as bank certification.

## UPC routes

### Android: 36 banks

For rows marked `I(package)`, expand using the exact pattern in the Interpretation rules section.

| UPC bank | UPC code | Android route |
|---|---:|---|
| ПриватБанк | 901 | `I(ua.privatbank.ap24)` |
| Приват24 для бізнесу | 919 | `I(ua.privatbank.cb)` |
| Монобанк | 902 | `https://mbnk.app/qr/bank.gov.ua/qr/{payload}` |
| ABank | 903 | `I(ua.com.abank)` |
| ПУМБ | 904 | `I(com.fuib.android.spot.online)` |
| UKRSIB online 2.0 | 923 | `I(com.ukrsibbank.uso.android)` |
| UKRSIB business | 924 | `I(com.ukrsibbank.ukrsibbusiness)` |
| SenseBank | 905 | `https://superapp.sensebank.com.ua/mob/qr/{payload}` |
| УкрГазбанк | 906 | `I(com.ugb.app)` |
| ОТР | 907 | `I(ua.otpbank.android)` |
| VST | 908 | `I(com.vostok.bv)` |
| Власний Рахунок | 935 | `I(com.bank.vr)` |
| izibank | 909 | `intent://bank.gov.ua/qr/{payload}#Intent;scheme=https;action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;package=ua.izibank.app;end` |
| Credit Agricole | 910 | `I(ua.creditagricole.mobile.app)` |
| Кредобанк | 927 | `I(ua.android.kredobank.prod)` |
| МТБ | 920 | `https://web.a115.mtb.ua/transfer-to-iban-summ?transferType=QR_UPC&navigationStackModifier=REMOVE_ALL_EXCEPT_CURRENT&code={payload}` |
| Кредит Дніпро | 911 | `https://creditdnepr.com.ua/qr_code/?{payload}` |
| Ідеябанк | 912 | `I(ua.ideabank.obank)` |
| Правекс | 913 | `I(ua.com.pravex.online)` |
| Глобус | 914 | `I(com.t18.bone.personal.globus)` |
| Alliance | 936 | `I(ua.monvel.bankalliance)` |
| Банк Львів | 943 | `intent://bank.gov.ua/qr/bank.gov.ua/qr/{payload}#Intent;scheme=https;package=ua.com.cs.ifobs.mobile.lviv;action=android.intent.action.VIEW;category=android.intent.category.DEFAULT;category=android.intent.category.BROWSABLE;end` |
| Індустріалбанк | 942 | `I(ua.industrialbank.android)` |
| Радабанк | 915 | `I(com.radabank.rb24)` |
| Піреус | 921 | `I(ua.piraeusbank.mobile.app.pbu)` |
| Грант | 917 | `I(ua.grant.smart)` |
| МІБ | 941 | `I(ua.android.ibank.mib)` |
| Райффайзен | 918 | `I(ua.raiffeisen.myraif)` |
| Південний | 928 | `I(com.bank.pivdenny)` |
| Аккордбанк | 931 | `I(online.kapowai.accordbank)` |
| UnexBank | 932 | `https://my.unexbank.ua/nbu/qr/bank.gov.ua/qr/{payload}` |
| ComInBank | 934 | `I(ua.cominbank.android.cominbank)` |
| BIS24 | 939 | `I(ua.bis.bis24.bank.release)` |
| CAPIbank | 937 | `I(ua.com.ukrcapital.capi)` |
| NovaPay | 938 | `I(ua.novapay.novapaymobile)` |
| Банк 3/4 | 933 | `I(online.kapowai.bank34online)` |

### iOS: 22 banks

| UPC bank | UPC code | iOS route |
|---|---:|---|
| ПриватБанк | 901 | `https://privat24.ua/rd2/send_qr/{base64(https://bank.gov.ua/qr/{payload})}`. UPC base64-encodes the complete NBU URL. |
| Монобанк | 902 | `https://mbnk.app/qr/https://bank.gov.ua/qr/{payload}` |
| ABank | 903 | `abank24://bank.gov.ua/qr/{payload}` |
| UKRSIB online 2.0 | 923 | `https://online.ukrsibbank.com/ibank/new-app/qr?url=https://bank.gov.ua/qr/{payload}` |
| SenseBank | 905 | `https://app.sensebank.ua/gkR4?code={payload}` |
| ОТР | 907 | `https://pay.otpbank.ua/qr/{payload}` |
| VST | 908 | `https://bv.onelink.me/K6yT/{payload}` |
| Credit Agricole | 910 | `https://caplusapp.credit-agricole.ua/fr/pay/{payload}` |
| Кредобанк | 927 | `https://online.kredobank.com.ua/nbu_qr{payload}` |
| МТБ | 920 | `https://web.a115.mtb.ua/transfer-to-iban-summ?transferType=QR_UPC&navigationStackModifier=REMOVE_ALL_EXCEPT_CURRENT&code={payload}` |
| Кредит Дніпро | 911 | `https://creditdnepr.com.ua/qr_code/{payload}` |
| Ідеябанк | 912 | `https://api.ideabank.ua/PAYBYBANKServiceIN/payByBank?id={id}&token={payload}`; the returned `id` is dynamic and omitted. |
| Правекс | 913 | `https://online.pravex.ua/mobileapp/qr/{payload}` |
| Глобус | 914 | `https://gpls.app/qr/{payload}` |
| Alliance | 936 | `https://alb.ua/qr/{payload}` |
| Радабанк | 915 | `https://radabank.com.ua/qr_code/{payload}` |
| Грант | 917 | `smart://bank.gov.ua/qr/{payload}` |
| Райффайзен | 918 | `https://my-raif.apps.raiffeisen.ua/qr?payload={payload}` |
| Південний | 928 | `https://link.bank.com.ua/qr/{payload}` |
| Аккордбанк | 931 | `https://online.accordbank.com.ua/nbu/qr/{payload}` |
| UnexBank | 932 | `https://my.unexbank.ua/nbu/qr/{payload}` |
| Банк 3/4 | 933 | `https://online.bank34.ua/nbu/qr/{payload}` |

UPC's Android list additionally contained the following 14 banks that were not in its iOS list: Privat24 business, PUMB, UKRSIB business, UkrGasbank, Власний Рахунок, izibank, Банк Львів, Індустріалбанк, Піреус, МІБ, ComInBank, BIS24, CAPIbank, and NovaPay. Availability is scoped to this invoice/list response and may change.

## IBANoplata routes

The mobile UI showed 17 selectable banks. The table below reflects the frontend routing configuration found in its JavaScript bundle. It did not call the dynamic invoice/payment endpoint.

| Bank | iOS route | Android route |
|---|---|---|
| Mono | `mono://bank.gov.ua/qr/{payload}` | `intent://bank.gov.ua/qr/{payload}#Intent;scheme=https;package=com.ftband.mono;end` |
| Приват24 | `privat24://bank.gov.ua/qr/{payload}` | `intent://bank.gov.ua/qr/{payload}#Intent;scheme=https;package=ua.privatbank.ap24;end` |
| Privat24 for business | `p24business://bank.gov.ua/qr/{payload}` | `intent://bank.gov.ua/qr/{payload}#Intent;scheme=https;package=ua.privatbank.cb;end` |
| KredoBank | No direct iOS scheme configured | `intent://bank.gov.ua/qr/{payload}#Intent;scheme=https;package=ua.android.kredobank.prod;end` |
| Абанк | `abank24://bank.gov.ua/qr/{payload}` | `intent://bank.gov.ua/qr/{payload}#Intent;scheme=https;package=ua.com.abank;end` |
| ПУМБ | `https://mobile-app.pumb.ua/bank.gov.ua/qr/{payload}` | `intent://bank.gov.ua/qr/{payload}#Intent;scheme=https;package=com.fuib.android.spot.online;end` |
| Sense Bank | No direct iOS scheme configured | `intent://bank.gov.ua/qr/{payload}#Intent;scheme=https;package=ua.alfabank.mobile.android;end` |
| Ukrsibbank | `com.ukrsibbank.ukrsibonline.new://bank.gov.ua/qr/{payload}` | `intent://bank.gov.ua/qr/{payload}#Intent;scheme=https;package=com.ukrsibbank.uso.android;end` |
| Raiffeisen | `https://my-raif.apps.raiffeisen.ua/qr?payload={payload}` | `intent://bank.gov.ua/qr/{payload}#Intent;scheme=https;package=ua.raiffeisen.myraif;end` |
| Укргазбанк | `ecobank://bank.gov.ua/qr/{payload}` (constructed from configured scheme) | `intent://bank.gov.ua/qr/{payload}#Intent;scheme=https;package=com.ugb.app;end` |
| izibank | No direct iOS scheme configured | `intent://bank.gov.ua/qr/{payload}#Intent;scheme=https;package=ua.izibank.app;end` |
| Банк Кредит Дніпро | No direct iOS scheme configured | `intent://bank.gov.ua/qr/{payload}#Intent;scheme=https;package=com.creditdnepr.mb;end` |
| Глобус Банк | No direct iOS scheme configured | `intent://bank.gov.ua/qr/{payload}#Intent;scheme=https;package=com.t18.bone.personal.globus;end` |
| РАДАБАНК | `https://radabank.com.ua/qr_code/{payload}` | `intent://bank.gov.ua/qr/{payload}#Intent;scheme=https;package=com.radabank.rb24;end` |
| Креді Агріколь Банк | `https://caplusapp.credit-agricole.ua/qr/{payload}` | `intent://bank.gov.ua/qr/{payload}#Intent;scheme=https;package=ua.creditagricole.mobile.app;end` |
| ОТП БАНК | `otpbankua://payment/qr/{payload}` | `intent://bank.gov.ua/qr/{payload}#Intent;scheme=https;package=ua.otpbank.android;end` |
| Банк Восток | `vostok://bank.gov.ua/qr/{payload}` | `intent://bank.gov.ua/qr/{payload}#Intent;scheme=https;package=com.vostok.bv;end` |

IBANoplata's generic mobile pay path uses the base NBU URL and wraps it as an Android intent without a bank package. Its per-bank selection path uses the package/scheme or URL prefix above. These are separate routes. The page displayed “Банк невідомий” for its IBAN while still offering the listed banks; this is an observed UI state, not a conclusion about the beneficiary bank.

## Reconciliation with `public.banklink`

The table is a route catalog, not a proof that every app opens successfully. Exact query results were read-only. Highlights for banks observed on competitor pages:

| Bank | Competitor evidence | Current `banklink` | Assessment |
|---|---|---|---|
| Alliance | iPay and UPC iOS: `https://alb.ua/qr/{payload}`; UPC Android package `ua.monvel.bankalliance` | iOS URL has a trailing space; `url_template` is `https://alb.ua/qr/bank.gov.ua/{payload}`; Android `universal_link2` is an `android-app://` association URL | Template path and trailing whitespace disagree with observed iOS route. Local `ALLI`/`alliance` files have the older package `ua.alliancebank.mobile` and scheme `alliancebank`. |
| ПУМБ | UPC Android package `com.fuib.android.spot.online`; IBANoplata iOS prefix `https://mobile-app.pumb.ua/bank.gov.ua/qr/` | `universal_link` is `https://mobile-app.pumb.ua/https://bank.gov.ua/qr/`; `universal_link2` is an `android-app://` URL; no template | The iOS path differs by an extra embedded `https://`. The package matches. Local standalone `pumb` omits `universal_link2`, unlike the current CSV and database. |
| MONO | iPay `https://mbnk.app/qr/{payload}`; UPC and IBANoplata also list Mono with different URL wrapping | URL prefix/template exists, but `active=false`, `checked=false`, `verified=false` | Competitor availability and current catalog activation disagree. Do not infer catalog activation from a competitor's list. |
| МТБ | iPay: `/qr-nbu/{payload}` on `web.a115.mtb.ua`; UPC and IBANoplata: transfer-to-IBAN route on the same host | `web.mtbutils.softesis.com/transfer-to-iban-summ?...&code=`; `active=false`; `routing_mode=store_links` | Route host differs from observed UPC/IBANoplata. iPay is a separate observed path. No standalone local bank file was found. |
| VST / Банк Восток | iPay and UPC iOS: `https://bv.onelink.me/K6yT/{payload}`; UPC Android package `com.vostok.bv` | `https://bankvostok.page.link/qr/`; `active=false`, `checked=false`, `verified=false` | Package matches UPC Android; universal-link host/path differs from iPay/UPC. |
| ПриватБанк | UPC iOS wraps the full NBU URL in base64; UPC Android package `ua.privatbank.ap24`; IBANoplata iOS scheme `privat24` | `ios_scheme=privat24`, correct Android package, but no UPC-style iOS template | Database describes a scheme route, not UPC's base64 HTTPS route. |
| Privat24 business | UPC Android package `ua.privatbank.cb`; IBANoplata lists it | No separate matching `banklink` row/package was found | A distinct app route should not be conflated with retail Privat24. |
| SenseBank | iPay `superapp.sensebank.com.ua/mob/qr/`; UPC iOS and IBANoplata use `app.sensebank.ua/gkR4?code=` | `app.sensebank.ua/gkR4?code={payload}` with package `ua.alfabank.mobile.android` | Matches UPC/IBANoplata, differs from iPay. Local scheme `alfabank` differs from database `sensesuperapp`. |
| OTP | iPay and UPC iOS use `https://pay.otpbank.ua/qr/{payload}`; IBANoplata uses `otpbankua://payment/qr/…` | HTTPS URL matches iPay/UPC; `ios_scheme=otpbankua` | The bank URL and custom scheme are separate route forms; local current CSV has `ios_scheme=otpbank`, which differs from live table. |
| Кредит Дніпро | iPay and UPC Android use `qr_code/?{payload}`; UPC iOS uses `qr_code/{payload}` | `qr_code/?{payload}` | Matches the iPay/Android form, not UPC iOS; platform difference matters. |
| Креді Агріколь | iPay and UPC use `/fr/pay/{payload}`; IBANoplata uses `/qr/{payload}` | `/fr/pay/{payload}` | Matches iPay/UPC, differs from IBANoplata. |
| UKRSIB | UPC iOS uses `/qr?url=https://bank.gov.ua/qr/{payload}`; UPC Android package `com.ukrsibbank.uso.android`; IBANoplata has a separate scheme | Base `universal_link` uses `/qr/{payload}`; `url_template` contains UPC-like query URL but starts with a tab | Conflicting candidate templates; inspect the consuming code before selecting one. UPC also had a separate business app/package not represented as this retail row. |
| Ідеябанк | UPC iOS uses `…/payByBank?id={id}&token={payload}` and Android package `ua.ideabank.obank` | `obank://bank.gov.ua/qr/`; package matches | Configured iOS scheme differs from UPC's generated iOS route. UPC's `id` is dynamic. |
| Власний Рахунок | UPC Android package `com.bank.vr`; absent from UPC iOS list | `banklink` row `bvr` has that package and `routing_mode=intent`; no universal iOS route | Android package matches; the UPC iOS omission is not proof that the bank app itself lacks QR support. |
| Укргазбанк | UPC Android package `com.ugb.app`; IBANoplata constructs an `ecobank` iOS scheme | `ios_scheme=ecobank`, `verified=false`; live `universal_link` has length 420, no `{payload}`, begins `ecobank://https://qr.bank.gov.ua/…` | Treat the live value as a possible captured/dynamic URL, not a reusable template. Payload not disclosed. Local file uses a short scheme-style prefix. |
| UnexBank | UPC iOS `https://my.unexbank.ua/nbu/qr/{payload}`; Android adds `bank.gov.ua/qr/` after `/nbu/qr/` | iOS template matches; Android `universal_link2` is only an `android-app://` association URL | Android deep link shape observed on UPC differs from stored association field. |
| Глобус | UPC lists the bank on both platforms; iPay reported it technically unavailable | Matching HTTPS URL exists, but live `checked=true` | Competitor availability and iPay's temporary technical status differ; neither is a permanent health guarantee. |
| Правекс | UPC iOS HTTPS and Android app intent; iPay reported technical unavailability | iOS URL template exists; `checked=false` | Conflicting observations are time/provider-specific, not a reason to infer one universal status. |

### Platform route form is not interchangeable

UPC returned executable-looking Android `intent://…#Intent;scheme=https;package=…;end` strings. `banklink.universal_link2` commonly stores `android-app://…` association URLs. A matching package does not make these strings equivalent. The app consuming a field must be inspected before using one in a redirect.

## Local `D:\bankroute` versus live `banklink`

- The current local CSV has 46 records, like the live table. After normalizing `null`/empty values and boolean casing, 22 IDs still differ over 72 compared fields. IDs with differences: `abank24`, `accordbank`, `alliance`, `altbank`, `bank34`, `bvr`, `capibank`, `creditagricole`, `creditdnepr`, `globus`, `idea`, `mtb`, `myraif`, `NovaPay`, `otpbank`, `pivdenny`, `pravex`, `rada`, `sensebank`, `ukrgasbank`, `ukrsib-online`, `unex`.
- The differences include route values and status fields (`active`, `checked`, `verified`), not only formatting. For example, live `banklink` has current route changes for ABank, Alliance, Idea, MyRaif, NovaPay, OTP, Sense, UGB, and UKRSIB compared with the CSV snapshot.
- The `active=false` rows in live `banklink` are `altbank`, `apsb`, `asvi`, `bisbank`, `cominbank`, `crystal`, `izibank`, `kredo`, `lviv`, `mono`, `mtb`, `pinb`, `skyb`, `vostok`, and `winbank`. Several (including izibank, KredoBank, Mono, MTB, VST/Vostok, and Bank Lviv) appeared in at least one competitor's tested bank list. Availability on a third-party page does not itself authorize activation in our catalog.
- The individual local bank files include duplicate IDs under aliases/case variants (e.g. `ALLI` and `alliance`, `ABUA` and `abank24`). Six current table IDs had no standalone JSON-like file in the folder scan: `apsb`, `lviv`, `mtb`, `skyb`, `task`, and `unex`; some still occur in aggregate files.
- The older CSV contains stale or conflicting PUMB data: its `ios_scheme` field is `2G2BT pumb-online.app`, and it includes two competing template paths (`…/qr.bank.gov.ua/{payload}` and `…/bank.gov.ua/qr/{payload}`). Do not treat these as equivalent to the current database values.
- The local current CSV and local individual files are snapshots, not a write authority. No files or remote rows were changed during this audit.

## Follow-up review candidates

This is a research list, not approval to change routing or activate banks.

1. Confirm the intended semantics of `universal_link`, `universal_link2`, `url_template`, and `alternative_url` in every consumer; in particular, determine whether Android needs an `intent://` URL or an Android App Link.
2. Reconcile Alliance path construction and remove/validate the trailing whitespace at the data source only after a focused consumer-level test.
3. Resolve PUMB's iOS prefix (`mobile-app.pumb.ua/bank.gov.ua/qr/`) versus the current database prefix embedding `https://bank.gov.ua/qr/`; verify the exact iOS/Android consumer behavior before modifying the locked catalog.
4. Reconcile MTB's host and competing QR routes with an official/current bank route or a controlled, non-payment test. Review its inactive status separately.
5. Reconcile VST's `bv.onelink.me` versus `bankvostok.page.link` routes and temporary iPay/UPC availability.
6. Compare platform-specific route templates for Mono, OTP, Credit Dnipro, UKRSIB, and Idea rather than forcing one URL onto both platforms.
7. Quarantine/review the long UGB value and other fields without `{payload}`; do not reuse captured payment-bearing URLs as templates.
8. Refresh and explicitly timestamp the local snapshot, preserve canonical IDs, and separate `checked` (test evidence), `verified` (definition/owner), and `active` (selection policy) semantics.
9. Keep bank catalog, payment initiation, and invoice scenario changes separately approved. `BANK-CATALOG-READ-001` and established invoice scenarios remain locked; this audit changes neither.

## Evidence limits

- iPay and UPC routes are observations from the tested sessions/invoice context. They do not prove every bank app accepts the link or that the same list is returned for every user, account, or invoice.
- IBANoplata's bank selection configuration exposed route construction in the page bundle, but this audit intentionally did not call the dynamic payment creation endpoint. A newly generated per-bank link was therefore not verified there.
- No physical-device app launches, bank authentication, user consent, payment execution, settlement, or reconciliation was tested.
- No source code, Supabase data, D1/KV data, Worker route, or deployment was changed.