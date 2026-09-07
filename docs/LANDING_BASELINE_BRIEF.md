# Baseline redesign — source of truth

Local-only iteration, 2026-09-07. Preserve original dark glass, Manrope,
lime brand, blue/violet fluid light and dashboard/phone composition. Do not
import the original global CSS or reintroduce simulated fiscal receipts.

## Frozen information architecture / copy map

1. [ОБОВ'ЯЗКОВО] Header: Продукт / Рішення / Можливості / Вигода / Безпека / Тарифи. CTA: Спробувати пілот.
2. [СКОРОТИТИ] Hero: «Оплата, що відчувається природно». Pay by Bank для щоденної роботи. QR, NFC та посилання — без окремого POS-термінала. Product mockup; no architecture prose.
3. [СКОРОТИТИ] Stats: 0 ₴ за окремий термінал; 3 способи відкрити рахунок; до 10 с — миттєвий переказ СЕП, не SLA Rahunok.
4. [ОБОВ'ЯЗКОВО] Live demo: «Один рахунок. Три прості кроки». UI labels only: Створити рахунок / Демо-оплата / Підтвердження сервера. Explicit local simulation.
5. [СКОРОТИТИ] Industries: HoReCa / Retail / Послуги / Online–API. One selected story and a different product surface per tab.
6. [ОБОВ'ЯЗКОВО] Features: QR / NFC / Link / Status / ПРРО / Аналітика / Bot / API. Short existing reviewed descriptions, conditional integration note.
7. [ОБОВ'ЯЗКОВО] POS comparison: equipment, customer action, settlement, fees, confirmation, fiscalisation. Neutral comparison, no blanket card-rail claims. Mobile cards.
8. [ОБОВ'ЯЗКОВО] ROI: «Порахуйте різницю. На ваших умовах». Current cost minus subscription and transaction fees; negative results preserved. Equal turnover, excluded integration/bank fees stated.
9. [СКОРОТИТИ] Plan B: «Коли термінал підводить, робота триває». QR/link fallback; mobile internet, bank availability and prior setup required. Not offline payments.
10. [ОБОВ'ЯЗКОВО] Security: «Гроші — між банками. Контроль — у вас». Only full architecture explanation: customer bank → business IBAN; Rahunok invoice/status path separate from funds. Confirmed payment precedes fulfilment and configured PRRO.
11. [ОБОВ'ЯЗКОВО] Pricing: Start / Business / Platform. Existing reviewed plans in UAH in every locale; fees and availability qualified.
12. [СКОРОТИТИ] FAQ: 12 practical questions, existing reviewed content; no second architecture diagram.
13. [ОБОВ'ЯЗКОВО] Final CTA: «Почнемо з вашого бізнесу». Warm original industry photo; pilot email and dashboard secondary action. No fake form success.
14. [ОБОВ'ЯЗКОВО] Footer: original company, identifier, address, phone, email, year. Existing Diia.City assertion retained as original content, not newly certified.

[ВИДАЛИТИ ЯК ДУБЛЬ] Separate role walkthrough, five-step prose payment flow,
trust strip and proof ledger. Original files remain available for rollback.

## Microcopy / implementation authority

`src/lib/features/landing/baseline/copy.ts` is the immutable build copy source.
Reviewed shared FAQ/features/pricing remain in studio-copy and refresh-copy.
Primary: Спробувати пілот → mailto:rahunok@rahunok.com.
Secondary: Розрахувати вигоду → #calculator; Відкрити кабінет → /dashboard/.
Demo: Створити рахунок / Підтвердити демо-оплату / Новий рахунок.
Badges: 0 ₴ за термінал / На ваш IBAN / ПРРО за налаштуванням.

## Claims ledger

- 2.3s removed: no dated production benchmark found.
- Universal 0 subscription removed: Business starts at 490 UAH/month.
- SEP 10s source: https://bank.gov.ua/ua/payments/sep (checked 2026-09-07).
  Applies to supported instant SEP transfers, not total checkout latency.
- PRRO conditional: frontend receipt rendering does not prove fiscal registration.
- Company copied verbatim: RAHUNOK, Limited Liability Company, 45679768,
  03019 9a, str Gareth Jones, Kyiv, Ukraine; +380 67 669 60 60;
  rahunok@rahunok.com. Legal identity/Diia.City require owner verification before publication.
- No Terms/Privacy document was found in original footer. Do not fabricate links.

## Design system

Authority: `baseline/tokens.css`. Dark-first ink canvas, lime primary, blue/violet
ambient lights, mint success, amber pending, warm sand human/trust panel.
Manrope only; bold 800/tight headings, neutral 400–600 body. All component colors
and fonts use these tokens. 24px product/card radius, pill controls, restrained
glass borders. Product-in-product is shared by hero, demo and industry tabs.
Pending uses a labelled pulse; success draws a check. Reduced motion removes
animation; manual pause disables ambient motion. No autoplay state changes.

Build order: copy/IA → tokens → independent section and widget work → QA.