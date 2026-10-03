import test from 'node:test';
import assert from 'node:assert/strict';
import { generateNbuPayload, isValidUkrainianIban, validateNbuInput } from '../src/nbu.ts';

const validInput = {
  recipientName: 'ТОВ "ЕВО"',
  recipientTaxId: '37193071',
  recipientIban: 'UA673005280000026500504354077',
  amount: '150.00',
  purpose: 'Оплата за товари/послуги'
};

test('validates Ukrainian IBAN check digits', () => {
  assert.equal(isValidUkrainianIban(validInput.recipientIban), true);
  assert.equal(isValidUkrainianIban('UA673005280000026500504354078'), false);
  assert.equal(isValidUkrainianIban('GB673005280000026500504354077'), false);
});

test('builds Conf-compatible 17-line NBU v003 ICT payload and official QR URL', () => {
  const result = generateNbuPayload(validInput, new Date(2026, 8, 29, 12, 34, 56));
  assert.equal(result.fields.length, 17);
  assert.equal(result.fields[0], 'BCD');
  assert.equal(result.fields[1], '003');
  assert.equal(result.fields[2], '1');
  assert.equal(result.fields[3], 'ICT');
  assert.equal(result.fields[5], 'ТОВ "ЕВО"');
  assert.equal(result.fields[6], validInput.recipientIban);
  assert.equal(result.fields[7], 'UAH150.00');
  assert.equal(result.fields[8], validInput.recipientTaxId);
  assert.equal(result.fields[9], 'OTHR/GDDS');
  assert.equal(result.fields[13], 'FFFF');
  assert.equal(result.fields[15], '260929123456');
  assert.equal(result.raw.split('\n').length, 17);
  assert.match(result.qrUrl, /^https:\/\/qr\.bank\.gov\.ua\/[A-Za-z0-9_-]+$/);
  assert.equal(Buffer.from(result.encoded, 'base64url').toString('utf8'), result.raw);
});

test('rejects invalid beneficiary identifiers and malformed amounts', () => {
  assert.equal(validateNbuInput({ ...validInput, recipientTaxId: '123456789' })?.field, 'recipientTaxId');
  assert.equal(validateNbuInput({ ...validInput, recipientIban: 'UA123' })?.field, 'recipientIban');
  assert.equal(validateNbuInput({ ...validInput, amount: '0' })?.field, 'amount');
});

test('allows an open amount when the payer chooses the value', () => {
  const result = generateNbuPayload({ ...validInput, amount: '' }, new Date(2026, 8, 29, 12, 34, 56));
  assert.equal(result.fields[7], '');
});