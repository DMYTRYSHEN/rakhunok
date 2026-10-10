import { resolve } from '$app/paths';
import { redirect } from '@sveltejs/kit';
import { AuthError, authenticate, signInWithGoogle } from '#lib/server/tracking/auth.ts';
import { authConfig } from '#lib/server/tracking/config.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ cookies, request }) => {
	let guestHistoryEnabled = !cookies.get('delivery_session') && !request.headers.has('authorization');
	if (!guestHistoryEnabled) {
		try { await authenticate(request, authConfig()); }
		catch (failure) {
			guestHistoryEnabled = failure instanceof AuthError && ['AUTH_INVALID', 'AUTH_REQUIRED'].includes(failure.code);
		}
	}
	return { guestHistoryEnabled };
};

export const actions: Actions = {
	default: async ({ request, cookies, url }) => {
		const path = new URL(resolve('/(public)'), request.url).pathname;
		const nonce = cookies.get('delivery_google_nonce');
		cookies.delete('delivery_google_nonce', { path });
		const failedLogin = `${path}login?auth=failed`;
			if (!nonce) redirect(303, `${failedLogin}&reason=nonce_missing`);
			if (Number(request.headers.get('content-length') ?? 0) > 16384) {
				redirect(303, `${failedLogin}&reason=form_invalid`);
			}
		const credential = (await request.formData()).get('credential');
		if (typeof credential !== 'string') redirect(303, `${failedLogin}&reason=form_invalid`);
		try {
			const session = await signInWithGoogle(credential, nonce, authConfig());
			cookies.set('delivery_session', session.accessToken, {
				path, httpOnly: true, secure: url.protocol === 'https:', sameSite: 'lax', maxAge: session.expiresIn
			});
		} catch (error) {
			if (!(error instanceof AuthError)) throw error;
			redirect(303, `${failedLogin}&reason=${error.code}${error.detail ? `_${error.detail}` : ''}`);
		}
		redirect(303, `${path}business`);
	}
};