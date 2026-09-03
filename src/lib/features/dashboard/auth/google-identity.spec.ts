import { createHash, webcrypto } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { createGoogleNonce } from './google-identity';

beforeAll(() => {
	Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
});

describe('createGoogleNonce', () => {
	it('returns a raw nonce and its SHA-256 hexadecimal digest', async () => {
		const nonce = await createGoogleNonce();

		expect(nonce.raw).toMatch(/^[A-Za-z0-9_-]{43}$/);
		expect(nonce.hashed).toMatch(/^[a-f0-9]{64}$/);
		expect(nonce.hashed).toBe(createHash('sha256').update(nonce.raw).digest('hex'));
	});
});
