import { createHash, randomBytes } from 'node:crypto';
import * as env from '$app/env/private';
import { resolve } from '$app/paths';
import { redirect } from '@sveltejs/kit';
import { AuthError, authenticate, signInWithGoogle } from '#lib/server/tracking/auth.ts';
import { authConfig } from '#lib/server/tracking/config.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ cookies, url, request }) => {
	let guestHistoryEnabled = !cookies.get('delivery_session') && !request.headers.has('authorization');
	if (!guestHistoryEnabled) {
		try { await authenticate(request, authConfig()); }
		catch (failure) {
			guestHistoryEnabled = failure instanceof AuthError && ['AUTH_INVALID', 'AUTH_REQUIRED'].includes(failure.code);
		}
	}
	const nonce = randomBytes(32).toString('base64url');
	cookies.set('delivery_google_nonce', nonce, {
		path: new URL(resolve('/(public)'), url).pathname, httpOnly: true, secure: url.protocol === 'https:', sameSite: 'strict', maxAge: 600
	});
	return {
		guestHistoryEnabled,
		clientId: env.DELIVERY_GOOGLE_CLIENT_ID ?? '',
		message: url.searchParams.get('auth') === 'failed' ? 'Не вдалося увійти. Спробуйте знову.' : '',
		nonce: createHash('sha256').update(nonce).digest('hex'),
		configured: Boolean(env.DELIVERY_GOOGLE_CLIENT_ID && env.DELIVERY_SUPABASE_URL && env.DELIVERY_SUPABASE_PUBLISHABLE_KEY)
	};
};

export const actions: Actions = {
	default: async ({ request, cookies, url }) => {
		const path = new URL(resolve('/(public)'), url).pathname;
		const nonce = cookies.get('delivery_google_nonce');
		cookies.delete('delivery_google_nonce', { path });
		const failedLogin = `${resolve('/(public)')}?auth=failed`;
		if (!nonce || Number(request.headers.get('content-length') ?? 0) > 16384) {
			redirect(303, failedLogin);
		}
		const credential = (await request.formData()).get('credential');
		if (typeof credential !== 'string') redirect(303, failedLogin);
		try {
			const session = await signInWithGoogle(credential, nonce, authConfig());
			cookies.set('delivery_session', session.accessToken, {
				path, httpOnly: true, secure: url.protocol === 'https:', sameSite: 'lax', maxAge: session.expiresIn
			});
		} catch (error) {
			if (!(error instanceof AuthError)) throw error;
			redirect(303, failedLogin);
		}
		redirect(303, resolve('/(business)/business'));
	}
};