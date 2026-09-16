import type { SupabaseClient, User } from '@supabase/supabase-js';

export const TELEGRAM_PROVIDER = 'custom:telegram' as const;

/** UI feedback only; authorization remains Supabase + owner-scoped RLS. */
export function hasTelegramIdentity(user: Pick<User, 'identities'>): boolean {
	return user.identities?.some((identity) => identity.provider === TELEGRAM_PROVIDER || identity.provider === 'telegram') ?? false;
}

export function telegramCallbackError(href: string): string {
	const url = new URL(href);
	const hash = new URLSearchParams(url.hash.slice(1));
	return ['error', 'error_code', 'error_description'].some((key) => url.searchParams.has(key) || hash.has(key))
		? 'Авторизацію не завершено. Якщо ви скасували вхід, спробуйте знову. Для прив’язки Telegram спочатку увійдіть через Google.'
		: '';
}

export function telegramSessionAvailable(origin: string, enabled: string | undefined): boolean {
	return enabled === 'true' && origin === 'https://letsrealtalk.com';
}

/** Supabase owns OAuth state, identity verification, callback and session persistence. */
export async function startTelegramSession(
	client: SupabaseClient,
	mode: 'signin' | 'link',
	origin: string,
	enabled: string | undefined,
	isCurrent: () => boolean = () => true,
	expectedUserId?: string | null
): Promise<void> {
	if (!telegramSessionAvailable(origin, enabled)) throw new Error('Telegram sign-in is not enabled on this origin.');
	const { data: { session }, error: sessionError } = await client.auth.getSession();
	if (sessionError) throw sessionError;
	if (!isCurrent() || (expectedUserId !== undefined && (session?.user.id ?? null) !== expectedUserId)) throw new Error('Account changed.');
	if (mode === 'link' && (!session?.user.email || session.user.is_anonymous)) {
		throw new Error('Sign in to the existing email account before linking Telegram.');
	}
	if (mode === 'link' && session && hasTelegramIdentity(session.user)) {
		throw new Error('Telegram is already linked to this account.');
	}
	if (mode === 'signin' && session) throw new Error('Use account linking while signed in.');
	const credentials = {
		provider: TELEGRAM_PROVIDER,
		options: { redirectTo: 'https://letsrealtalk.com/app/', scopes: 'openid profile' }
	};
	const { error } = mode === 'link'
		? await client.auth.linkIdentity(credentials)
		: await client.auth.signInWithOAuth(credentials);
	if (error) throw error;
}