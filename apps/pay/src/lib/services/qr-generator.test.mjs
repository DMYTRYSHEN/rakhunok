import assert from 'node:assert/strict';
import test from 'node:test';
import { buildBankRedirect } from './qr-generator.ts';

test('Monobank uses its universal link on every operating system', () => {
	const universalLink = 'https://mbnk.app/qr/cGF5bG9hZA_-';

	for (const os of ['ios', 'android', 'desktop']) {
		assert.deepEqual(buildBankRedirect('MONO', 'cGF5bG9hZA_-', os), {
			redirectUrl: universalLink,
			fallbackUrl: universalLink
		});
	}
});
