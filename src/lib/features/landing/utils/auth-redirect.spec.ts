import { describe, expect, it } from 'vitest';
import { getAuthRedirectUrl } from './auth-redirect';

describe('getAuthRedirectUrl', () => {
	it('does not redirect ordinary landing visits', () => {
		expect(getAuthRedirectUrl('https://rahunok.com', '#pricing', '/app/')).toBeNull();
	});

	it('forwards an auth hash to the stored return path', () => {
		expect(
			getAuthRedirectUrl('https://rahunok.com', '#access_token=token&expires_in=3600', '/app/')
		).toBe('https://rahunok.com/app/#access_token=token&expires_in=3600');
	});

	it('falls back to the dashboard path', () => {
		expect(getAuthRedirectUrl('https://rahunok.com', '#access_token=token', null)).toBe(
			'https://rahunok.com/dashboard/#access_token=token'
		);
	});
});
