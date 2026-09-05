// =========================================================
// NBU QR Generator & Bank Router — Standard Version 003 (ISO ICT)
// Exact match with Rahunok / НБУ 003 (ФОП/ТОВ) specifications
// =========================================================

export interface NbuQrInput {
  amount: number;
  recipientName: string;
  recipientIban: string;
  recipientTaxId: string;
  purpose: string;
  orderNumber?: string;
  encoding?: '1' | '2';
}

export interface NbuQrOutput {
  rawString: string;
  base64UrlPayload: string;
  standardQrUrl: string;
  previewText: string;
}

export function utf8ToBase64Url(str: string): string {
  if (typeof TextEncoder !== 'undefined') {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(str);
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }

  return btoa(unescape(encodeURIComponent(str)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Generates official NBU QR Payload according to v003 standard (ICT Instant Credit Transfer)
 */
export function generateNbuQrPayload(input: NbuQrInput): NbuQrOutput {
  const cleanRecipient = (input.recipientName || 'ФОП ДМИТРИШЕН').trim().substring(0, 140);
  const cleanIban = (input.recipientIban || 'UA12345678987654321345562').replace(/\s+/g, '').toUpperCase();
  const cleanTaxId = (input.recipientTaxId || '11212121212').trim();
  const cleanPurpose = (input.purpose || 'Оплата замовлення').trim().substring(0, 420);
  const orderRef = input.orderNumber ? input.orderNumber.trim() : `RHK_${Date.now().toString(36).toUpperCase()}`;
  const formattedAmount = input.amount > 0 ? `UAH${input.amount.toFixed(2)}` : '';

  const now = new Date();
  const tsCreation =
    String(now.getFullYear()).slice(-2) +
    String(now.getMonth() + 1).padStart(2, '0') +
    String(now.getDate()).padStart(2, '0') +
    String(now.getHours()).padStart(2, '0') +
    String(now.getMinutes()).padStart(2, '0') +
    String(now.getSeconds()).padStart(2, '0');

  // 7 days expiration for QR
  const expDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const tsExpiry =
    String(expDate.getFullYear()).slice(-2) +
    String(expDate.getMonth() + 1).padStart(2, '0') +
    String(expDate.getDate()).padStart(2, '0') +
    '235959';

  const fields = [
    'BCD',                                                                           // Line 1: Service Tag
    '003',                                                                           // Line 2: Version
    input.encoding || '1',                                                           // Line 3: Coding (1 = UTF-8)
    'ICT',                                                                           // Line 4: Function (Instant Credit Transfer)
    '',                                                                              // Line 5: BIC / MFO
    cleanRecipient,                                                                  // Line 6: Payee Name
    cleanIban,                                                                       // Line 7: Payee IBAN
    formattedAmount,                                                                 // Line 8: Amount
    cleanTaxId,                                                                      // Line 9: Payee Tax ID (ЄДРПОУ/РНОКПП)
    'OTHR/GDDS',                                                                     // Line 10: Category code
    orderRef,                                                                        // Line 11: Document / Order Number
    cleanPurpose,                                                                    // Line 12: Purpose text
    '?<InstrForCdtrAgt><InstrInf>MerchID:01234-TermId:43210</InstrInf></InstrForCdtrAgt>', // Line 13: Terminal instructions
    'FFFF',                                                                          // Line 14: Checksum
    tsExpiry,                                                                        // Line 15: Expiry (YYMMDDhhmmss)
    tsCreation                                                                       // Line 16: Creation (YYMMDDhhmmss)
  ];

  const rawString = fields.join('\n') + '\n';
  const base64UrlPayload = utf8ToBase64Url(rawString);
  const standardQrUrl = `https://qr.bank.gov.ua/${base64UrlPayload}`;

  return {
    rawString,
    base64UrlPayload,
    standardQrUrl,
    previewText: `${cleanRecipient} | ${cleanIban} | ${formattedAmount}`
  };
}

export function buildBankRedirect(bankCode: string, payload: string, os = 'desktop'): { redirectUrl: string; fallbackUrl: string } {
  const code = (bankCode || '').toUpperCase();
  let redirectUrl = `https://qr.bank.gov.ua/${payload}`;
  let fallbackUrl = 'https://qr.bank.gov.ua/';

  switch (code) {
    case 'MONO':
    case 'UNJS':
      redirectUrl = `https://mbnk.app/qr/${payload}`;
      fallbackUrl = 'https://send.monobank.ua/';
      break;
    case 'PBAN':
      redirectUrl = `https://www.privat24.ua/rd/send_qr/nbu/${payload}`;
      fallbackUrl = 'https://next.privat24.ua/pay/';
      break;
    case 'TASB':
      redirectUrl =
        os === 'android'
          ? `intent://bank.gov.ua/qr/${payload}#Intent;scheme=https;package=ua.izibank.app;end`
          : `izibank://bank.gov.ua/qr/${payload}`;
      fallbackUrl = 'https://apps.apple.com/ua/app/izibank/id1527341829';
      break;
    case 'SENS':
      redirectUrl = `https://app.sensebank.ua/gkR4?code=${payload}`;
      fallbackUrl = 'https://sensebank.ua';
      break;
    case 'ABUA':
      redirectUrl = `https://abank24.page.link/qr/${payload}`;
      fallbackUrl = 'https://a-bank.com.ua';
      break;
    case 'FUIB':
      redirectUrl = `https://mobile-app.pumb.ua/qr.bank.gov.ua/${payload}`;
      fallbackUrl = 'https://pumb.ua';
      break;
    case 'AVAL':
      redirectUrl = `https://my-raif.apps.raiffeisen.ua/qr?payload=${payload}`;
      fallbackUrl = 'https://raiffeisen.ua';
      break;
    case 'GLBU':
      redirectUrl = `https://gpls.app/qr/${payload}`;
      fallbackUrl = 'https://globusplus.com.ua';
      break;
    case 'NOVA':
      redirectUrl =
        os === 'android'
          ? `intent://bank.gov.ua/qr/${payload}#Intent;scheme=https;package=ua.novapay.novapaymobile;end`
          : `novapay-mobile://bank.gov.ua/qr/${payload}`;
      fallbackUrl = 'https://novapay.ua';
      break;
    default:
      redirectUrl = `https://qr.bank.gov.ua/${payload}`;
      fallbackUrl = 'https://qr.bank.gov.ua/';
  }

  return { redirectUrl, fallbackUrl };
}
