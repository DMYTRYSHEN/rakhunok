import { resolve } from '$app/paths';
import { error, redirect } from '@sveltejs/kit';
import { authenticate, AuthError } from '#lib/server/tracking/auth.ts';
import { authConfig } from '#lib/server/tracking/config.ts';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ request }) => {
	try {
		const user = await authenticate(request, authConfig());
		return { userId: user.id };
	} catch (caught) {
		if (!(caught instanceof AuthError)) throw caught;
		if (caught.status === 401 || caught.code === 'AUTH_CONFIG') redirect(303, resolve('/login'));
		error(503, 'Сервіс авторизації тимчасово недоступний.');
	}
};