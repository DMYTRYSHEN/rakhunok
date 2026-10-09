import { resolve } from '$app/paths';
import { error, redirect } from '@sveltejs/kit';
import { signOut, tokenFromRequest } from '#lib/server/tracking/auth.ts';
import { authConfig } from '#lib/server/tracking/config.ts';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, cookies, url }) => {
	if (request.headers.get('origin') !== url.origin) error(403, 'Invalid origin');
	const token = tokenFromRequest(request);
	try {
		if (token) await signOut(token, authConfig());
	} finally {
		cookies.delete('delivery_session', { path: new URL(resolve('/(public)'), url).pathname });
	}
	redirect(303, resolve('/(public)'));
};