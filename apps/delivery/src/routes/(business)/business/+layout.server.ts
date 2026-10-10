import { resolve } from '$app/paths';
import { error, redirect } from '@sveltejs/kit';
import { authenticatedProfile, AuthError } from '#lib/server/tracking/auth.ts';
import { authConfig } from '#lib/server/tracking/config.ts';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ request }) => {
	try {
		const user = await authenticatedProfile(request, authConfig());
		return { userId: user.id, displayName: user.displayName };
	} catch (caught) {
		if (!(caught instanceof AuthError)) throw caught;
		if (caught.status === 401 || caught.code === 'AUTH_CONFIG')
			redirect(303, new URL(resolve('/login'), request.url).pathname);
		error(503, 'Сервіс авторизації тимчасово недоступний.');
	}
};