import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ibanBank, normalizePhone, normalizeWebsite, validContactEmail } from './onboarding.ts';

test('bank comes from a checksum-valid IBAN, never from a default', () => {
	assert.deepEqual(ibanBank('UA663052990000026007123456789'), { code: '305299', name: '\u041f\u0440\u0438\u0432\u0430\u0442\u0411\u0430\u043d\u043a' });
	assert.equal(ibanBank('UA003052990000026007123456789'), null);
	assert.equal(ibanBank('UA90ABC2990000026007123456789'), null);
});

test('contact normalization accepts local phones and optional websites', () => {
	assert.equal(normalizePhone('067 123-45-67'), '+380671234567');
	assert.equal(normalizePhone('+380 (67) 123-45-67'), '+380671234567');
	assert.equal(normalizePhone('123'), null);
	assert.equal(normalizeWebsite('example.com'), 'https://example.com/');
	assert.equal(normalizeWebsite(''), '');
	assert.equal(normalizeWebsite('javascript://example.com'), null);
	assert.equal(normalizeWebsite('https://user:password@example.com'), null);
	assert.equal(validContactEmail('owner@example.com'), true);
	assert.equal(validContactEmail('owner@'), false);
});