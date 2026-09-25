import { describe, expect, it } from 'vitest';
import { loadBankDirectory, parseBanks, parseLogo } from './bank-directory';

describe('landing bank directory', () => {
	it('keeps active unique banks without claiming verified partnership', () => {
		expect(
			parseBanks([
				{ id: 'sensebank', name: 'Sense Bank', active: true, verified: false },
				{ id: 'sensebank', name: 'Duplicate', active: true },
				{ id: 'off', name: 'Inactive', active: false },
				{ id: '', name: 'Invalid', active: true },
				null
			])
		).toEqual([{ id: 'sensebank', name: 'Sense Bank', logo: null }]);
	});
	it('accepts only valid HTTPS logo URLs', () => {
		expect(parseLogo({ logo: 'https://example.com/logo.webp' })).toBe(
			'https://example.com/logo.webp'
		);
		expect(parseLogo({ logo: 'javascript:alert(1)' })).toBeNull();
		expect(parseLogo({ logo: 'https://user:password@example.com/image' })).toBeNull();
		expect(parseLogo({})).toBeNull();
	});
	it('keeps a bank visible when its detail request fails', async () => {
		const fetcher: typeof fetch = async (input) =>
			String(input).endsWith('/banks')
				? Response.json([{ id: 'mono', name: 'monobank', active: true }])
				: new Response(null, { status: 503 });
		expect(await loadBankDirectory(fetcher)).toEqual({
			banks: [{ id: 'mono', name: 'monobank', logo: null }],
			unavailable: false
		});
	});
	it('returns an explicit unavailable state for an invalid catalogue', async () => {
		const fetcher: typeof fetch = async () => Response.json({ error: 'unavailable' });
		expect(await loadBankDirectory(fetcher)).toEqual({ banks: [], unavailable: true });
	});
});
