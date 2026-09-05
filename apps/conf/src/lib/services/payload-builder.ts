import type { BankEntry, TestFormData, PayloadResult, BankUrls } from '../types';

// ==========================================
// WIN-1251 ENCODING TABLE
// ==========================================
const WIN1251_TABLE: Record<number, number> = {};
for (let i = 0; i <= 0x1F; i++) WIN1251_TABLE[0x0410 + i] = 0xC0 + i; // А-Я
for (let i = 0; i <= 0x1F; i++) WIN1251_TABLE[0x0430 + i] = 0xE0 + i; // а-я
WIN1251_TABLE[0x0404] = 0xAA; // Є
WIN1251_TABLE[0x0454] = 0xBA; // є
WIN1251_TABLE[0x0406] = 0xB2; // І
WIN1251_TABLE[0x0456] = 0xB3; // і
WIN1251_TABLE[0x0407] = 0xAF; // Ї
WIN1251_TABLE[0x0457] = 0xBF; // ї
WIN1251_TABLE[0x0490] = 0xA5; // Ґ
WIN1251_TABLE[0x0491] = 0xB4; // ґ
WIN1251_TABLE[0x2116] = 0xB9; // №
WIN1251_TABLE[0x0401] = 0xA8; // Ё
WIN1251_TABLE[0x0451] = 0xB8; // ё
WIN1251_TABLE[0xAB] = 0xAB;   // «
WIN1251_TABLE[0xBB] = 0xBB;   // »
WIN1251_TABLE[0x201E] = 0x84; // „
WIN1251_TABLE[0x201C] = 0x93; // “
WIN1251_TABLE[0x201D] = 0x94; // ”
WIN1251_TABLE[0x2018] = 0x91; // ‘
WIN1251_TABLE[0x2019] = 0x92; // ’
WIN1251_TABLE[0x2013] = 0x96; // –
WIN1251_TABLE[0x2014] = 0x97; // —
WIN1251_TABLE[0x2026] = 0x85; // …

export function utf8ToWin1251(str: string): Uint8Array {
    const bytes: number[] = [];
    for (let i = 0; i < str.length; i++) {
        const code = str.charCodeAt(i);
        if (code < 0x80) {
            bytes.push(code);
        } else if (WIN1251_TABLE[code] !== undefined) {
            bytes.push(WIN1251_TABLE[code]);
        } else {
            bytes.push(0x3F); // '?'
        }
    }
    return new Uint8Array(bytes);
}

export function uint8ArrayToBase64Url(bytes: Uint8Array): string {
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function utf8ToBase64Url(str: string): string {
    return btoa(unescape(encodeURIComponent(str)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

export function generateTestPayload(
    bank: Partial<BankEntry>,
    data: TestFormData,
    overrides?: Record<number, string>
): PayloadResult {
    const {
        recipient = 'ФОП ДМИТРИШЕН',
        iban = 'UA12345678987654321345562',
        amount = '11.00',
        recipientCode = '11212121212',
        purpose = 'Оплата за товари/послуги',
        function: func = bank.nbu_function || 'ICT',
        isoCategory = 'OTHR',
        isoPurpose = 'GDDS',
        reference = 'RHK-TEST-001',
        display = '',
        lockFields = 'FFFF',
        validUntil: customValidUntil = ''
    } = data;

    const enc = bank.encoding || '1'; // '1' = UTF-8, '2' = Win1251
    const ver = bank.nbu_version || '003';

    let fields: string[] = [];

    if (ver === '003') {
        const now = new Date();
        const yy = String(now.getFullYear()).slice(-2);
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');
        const hh = String(now.getHours()).padStart(2, '0');
        const min = String(now.getMinutes()).padStart(2, '0');
        const ss = String(now.getSeconds()).padStart(2, '0');
        const createdAt = `${yy}${mm}${dd}${hh}${min}${ss}`;
        const validUntil = customValidUntil || `${yy}1231235959`;

        const sanitizeQuotes = (str: string) => str ? String(str).replace(/[„“”]/g, '"') : '';
        const safeRecipient = sanitizeQuotes(recipient);
        const safePurpose = sanitizeQuotes(purpose);
        const safeDisplay = sanitizeQuotes(display);

        fields = [
            'BCD',
            '003',
            enc,
            func,
            '',
            safeRecipient,
            iban.replace(/\s+/g, ''),
            `UAH${Number(amount || 0).toFixed(2)}`,
            recipientCode,
            `${isoCategory}/${isoPurpose}`,
            reference,
            safePurpose,
            safeDisplay,
            lockFields,
            validUntil,
            createdAt,
            '' // RFU
        ];
    } else {
        // v002
        fields = [
            'BCD',
            '002',
            enc,
            func,
            recipient,
            iban.replace(/\s+/g, ''),
            amount,
            recipientCode,
            isoCategory,
            reference,
            purpose,
            display
        ];
    }

    if (overrides) {
        Object.entries(overrides).forEach(([idxStr, val]) => {
            const idx = parseInt(idxStr, 10);
            if (idx >= 0 && idx < fields.length && val !== undefined) {
                fields[idx] = val;
            }
        });
    }

    const payloadStr = fields.join('\n');
    let encodedPayload = '';

    if (enc === '2') {
        const bytes = utf8ToWin1251(payloadStr);
        encodedPayload = uint8ArrayToBase64Url(bytes);
    } else {
        encodedPayload = utf8ToBase64Url(payloadStr);
    }

    // Estimate raw size in bytes
    const encoder = new TextEncoder();
    const rawBytes = enc === '2' ? utf8ToWin1251(payloadStr) : encoder.encode(payloadStr);

    return {
        fields,
        payloadStr,
        encodedPayload,
        rawSize: rawBytes.length,
        encodedSize: encodedPayload.length
    };
}

export function buildBankUrls(bank: Partial<BankEntry>, encodedPayload: string): BankUrls {
    const isUniversalLinkValid = bank.universal_link && bank.universal_link.startsWith('https://');

    let web_https = bank.domain_prefix ? `${bank.domain_prefix}${encodedPayload}` : '';
    if (!web_https && bank.universal_link) {
        web_https = `${bank.universal_link}${encodedPayload}`;
    }

    let android_intent: string | null = null;
    if (bank.universal_link2 && bank.universal_link2.includes('{payload}')) {
        android_intent = bank.universal_link2.replace('{payload}', encodedPayload);
    } else if (bank.universal_link2) {
        android_intent = `${bank.universal_link2}${encodedPayload}`;
    } else if (bank.android_package) {
        android_intent = `intent://bank.gov.ua/qr/${encodedPayload}#Intent;scheme=https;package=${bank.android_package};end`;
    }

    let ios_universal: string | null = null;
    if (isUniversalLinkValid) {
        if (bank.url_template && bank.url_template.includes('{payload}')) {
            ios_universal = bank.url_template.replace('{payload}', encodedPayload);
        } else {
            ios_universal = `${bank.universal_link}${encodedPayload}`;
        }
    }

    let ios_scheme: string | null = null;
    if (bank.ios_scheme) {
        ios_scheme = `${bank.ios_scheme}://bank.gov.ua/qr/${encodedPayload}`;
    }

    return {
        ios_universal,
        ios_scheme,
        android_intent,
        web_https: web_https || null
    };
}
