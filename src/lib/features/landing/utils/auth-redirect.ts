const DEFAULT_AUTH_REDIRECT = '/dashboard/';

export function getAuthRedirectUrl(
	origin: string,
	hash: string,
	storedRedirect: string | null
): string | null {
	if (!hash.includes('access_token=')) return null;

	return `${origin}${storedRedirect || DEFAULT_AUTH_REDIRECT}${hash}`;
}
