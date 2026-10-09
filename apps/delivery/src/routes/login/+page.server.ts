import { createHash, randomBytes } from 'node:crypto';
import * as env from '$app/env/private';
import { resolve } from '$app/paths';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ cookies, url }) => {
	const nonce = randomBytes(32).toString('base64url');
	cookies.set('delivery_google_nonce', nonce, {
		path: new URL(resolve('/(public)'), url).pathname, httpOnly: true, secure: url.protocol === 'https:', sameSite: 'strict', maxAge: 600
	});
	return {
		clientId: env.DELIVERY_GOOGLE_CLIENT_ID ?? '',
		message: url.searchParams.get('auth') === 'failed' ? 'Не вдалося увійти. Спробуйте знову.' : '',
		nonce: createHash('sha256').update(nonce).digest('hex'),
		configured: Boolean(env.DELIVERY_GOOGLE_CLIENT_ID && env.DELIVERY_SUPABASE_URL && env.DELIVERY_SUPABASE_PUBLISHABLE_KEY)
	};
};