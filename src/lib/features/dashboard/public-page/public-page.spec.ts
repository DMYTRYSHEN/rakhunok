import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	PUBLIC_PAGE_STORAGE_KEY,
	loadPublicPageConfig,
	normalizePublicSlug,
	validatePublicSlug
} from './public-page';

describe('public page configuration', () => {
	afterEach(() => vi.unstubAllGlobals());

	it('normalizes a human-entered identifier into a conservative slug', () => {
		expect(normalizePublicSlug('  My_Shop -- Kyiv  ')).toBe('my-shop-kyiv');
	});

	it('rejects short, malformed, and reserved identifiers', () => {
		expect(validatePublicSlug('ab')).toContain('щонайменше');
		expect(validatePublicSlug('my_shop')).toContain('латинські');
		expect(validatePublicSlug('dashboard')).toContain('зарезервовано');
		expect(validatePublicSlug('my-shop-24')).toBeNull();
	});

	it('sanitizes a stored draft', () => {
		const getItem = vi.fn((key: string) =>
			key === PUBLIC_PAGE_STORAGE_KEY
				? JSON.stringify({ slug: ' MY SHOP ', displayName: 'My shop', description: 'Послуги' })
				: null
		);
		vi.stubGlobal('localStorage', { getItem });

		expect(loadPublicPageConfig()).toEqual({
			slug: 'my-shop',
			displayName: 'My shop',
			description: 'Послуги'
		});
	});
});