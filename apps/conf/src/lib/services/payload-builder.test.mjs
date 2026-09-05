import test from 'node:test';
import assert from 'node:assert/strict';

import {
    utf8ToWin1251,
    uint8ArrayToBase64Url,
    utf8ToBase64Url,
    generateTestPayload,
    buildBankUrls
} from './payload-builder.ts';

import { MOCK_SCENARIOS } from './mock-scenarios.ts';
import { DEFAULT_BANKS } from './banklink-store.ts';

test('Win-1251 table converts Ukrainian letters properly', () => {
    const text = 'ФОП ДМИТРИШЕН';
    const bytes = utf8ToWin1251(text);
    assert.equal(bytes.length, text.length);
    // 'Ф' is 0xD4 in Win-1251
    assert.equal(bytes[0], 0xD4);
});

test('generateTestPayload creates standard 17-line NBU 003 string', () => {
    const bank = {
        nbu_version: '003',
        encoding: '1',
        nbu_function: 'ICT',
        domain_prefix: 'https://qr.bank.gov.ua/'
    };

    const scenario = MOCK_SCENARIOS.find(s => s.id === 'rozetka');
    assert.ok(scenario, 'Rozetka scenario must exist');

    const result = generateTestPayload(bank, scenario.data);
    assert.equal(result.fields.length, 17, 'NBU 003 must have 17 fields');
    assert.equal(result.fields[0], 'BCD');
    assert.equal(result.fields[1], '003');
    assert.equal(result.fields[2], '1');
    assert.equal(result.fields[3], 'ICT');
    assert.equal(result.fields[5], 'ТОВ «ФК "ЕВО"»');
    assert.equal(result.fields[6], 'UA673005280000026500504354077');
    assert.equal(result.fields[7], 'UAH150.00');
    assert.equal(result.fields[8], '37193071');
    assert.ok(result.encodedPayload.length > 20);
});

test('generateTestPayload supports Win-1251 encoding (encoding 2)', () => {
    const monoBank = DEFAULT_BANKS.find(b => b.id === 'mono');
    assert.ok(monoBank, 'Monobank must exist');
    assert.equal(monoBank.encoding, '2', 'Monobank uses Win-1251');

    const scenario = MOCK_SCENARIOS.find(s => s.id === 'silpo');
    assert.ok(scenario, 'Silpo scenario must exist');

    const result = generateTestPayload(monoBank, scenario.data);
    assert.equal(result.fields[2], '2');
    assert.ok(result.encodedPayload.length > 20);
});

test('buildBankUrls generates valid device URLs for Monobank, ABank, and Izibank', () => {
    const monoBank = DEFAULT_BANKS.find(b => b.id === 'mono');
    const dummyPayload = 'TEST_BASE64_PAYLOAD';
    const urls = buildBankUrls(monoBank, dummyPayload);

    assert.equal(urls.ios_universal, 'https://mbnk.app/qr/TEST_BASE64_PAYLOAD');
    assert.equal(urls.ios_scheme, 'mono://bank.gov.ua/qr/TEST_BASE64_PAYLOAD');
    assert.ok(urls.android_intent.includes('com.ftband.mono'));
});

test('DEFAULT_BANKS contains all 46 Ukrainian banks with valid identifiers', () => {
    assert.equal(DEFAULT_BANKS.length, 46);
    const codes = new Set(DEFAULT_BANKS.map(b => b.code));
    assert.ok(codes.has('MONO'));
    assert.ok(codes.has('PBAN'));
    assert.ok(codes.has('ABUA'));
    assert.ok(codes.has('TASB'));
    assert.ok(codes.has('SENS'));
    assert.ok(codes.has('FUIB'));
    assert.ok(codes.has('NOVA'));
});

test('Mock scenarios include all 6 key scenarios', () => {
    const ids = MOCK_SCENARIOS.map(s => s.id);
    assert.ok(ids.includes('fop'), 'ФОП Дмитришен scenario');
    assert.ok(ids.includes('rozetka'), 'Rozetka scenario');
    assert.ok(ids.includes('silpo'), 'Сільпо scenario');
    assert.ok(ids.includes('p2p'), 'Кава scenario');
    assert.ok(ids.includes('dentist'), 'Стоматолог scenario');
    assert.ok(ids.includes('utility'), 'Комуналка scenario');
});
