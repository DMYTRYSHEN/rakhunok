import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { startTelegramSession, telegramCallbackError, telegramSessionAvailable } from './telegram-session';

function fixture(session: object | null = null) {
	const auth = {
		getSession: vi.fn(async () => ({ data: { session }, error: null })),
		signInWithOAuth: vi.fn(async () => ({ error: null })),
		linkIdentity: vi.fn(async () => ({ error: null }))
	};
	return { auth, client: { auth } as unknown as SupabaseClient };
}
describe('Telegram supported Supabase sessions', () => {
	it('does not render provider-controlled error descriptions', () => {
		const message = telegramCallbackError('https://letsrealtalk.com/app/?error_description=PRIVATE_TOKEN');
		expect(message).toContain('Авторизацію не завершено');
		expect(message).not.toContain('PRIVATE_TOKEN');
		expect(telegramCallbackError('https://letsrealtalk.com/app/#error=access_denied')).toBe(message);
		expect(telegramCallbackError('https://letsrealtalk.com/app/?code=synthetic')).toBe('');
	});
	it('rejects repeated linking without starting OAuth', async () => {
		const { client, auth } = fixture({ user: { email: 'synthetic@example.test', identities: [{ provider: 'custom:telegram' }] } });
		await expect(startTelegramSession(client, 'link', 'https://letsrealtalk.com', 'true')).rejects.toThrow('already linked');
		expect(auth.linkIdentity).not.toHaveBeenCalled();
	});
	it('propagates provider failures without substituting another login', async () => {
		const { client, auth } = fixture();
		auth.signInWithOAuth.mockRejectedValueOnce(new Error('provider unavailable'));
		await expect(startTelegramSession(client, 'signin', 'https://letsrealtalk.com', 'true')).rejects.toThrow('provider unavailable');
		expect(auth.linkIdentity).not.toHaveBeenCalled();
	});
	it.each(['https://rakhunok.com', 'http://localhost:5176', 'http://10.10.10.242:5176', 'https://letsrealtalk.com.evil.test'])('rejects non-test origin %s before I/O', async (origin) => {
		const { client, auth } = fixture();
		await expect(startTelegramSession(client, 'signin', origin, 'true')).rejects.toThrow();
		expect(auth.getSession).not.toHaveBeenCalled();
	});
	it('is disabled by default', () => {
		expect(telegramSessionAvailable('https://letsrealtalk.com', undefined)).toBe(false);
	});
	it('uses supported OAuth exchange with exact callback and no fake credentials', async () => {
		const { client, auth } = fixture();
		await startTelegramSession(client, 'signin', 'https://letsrealtalk.com', 'true');
		expect(auth.signInWithOAuth).toHaveBeenCalledWith({ provider: 'custom:telegram', options: { redirectTo: 'https://letsrealtalk.com/app/', scopes: 'openid profile' } });
		expect(auth.linkIdentity).not.toHaveBeenCalled();
	});
	it('links existing account instead of replacing session', async () => {
		const { client, auth } = fixture({ user: { email: 'synthetic@example.test', is_anonymous: false } });
		await startTelegramSession(client, 'link', 'https://letsrealtalk.com', 'true');
		expect(auth.linkIdentity).toHaveBeenCalledOnce();
		expect(auth.signInWithOAuth).not.toHaveBeenCalled();
	});
	it.each([null, { user: {} }, { user: { email: 'synthetic@example.test', is_anonymous: true } }])('rejects unauthenticated or incompatible link target', async (session) => {
		const { client, auth } = fixture(session);
		await expect(startTelegramSession(client, 'link', 'https://letsrealtalk.com', 'true')).rejects.toThrow();
		expect(auth.linkIdentity).not.toHaveBeenCalled();
	});
	it('never starts ordinary sign-in on top of existing account', async () => {
		const { client } = fixture({ user: { email: 'synthetic@example.test' } });
		await expect(startTelegramSession(client, 'signin', 'https://letsrealtalk.com', 'true')).rejects.toThrow();
	});
});