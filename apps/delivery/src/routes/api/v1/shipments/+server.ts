import { json } from '@sveltejs/kit';
import { authenticate, AuthError } from '#lib/server/tracking/auth.ts';
import { authConfig } from '#lib/server/tracking/config.ts';
import { trackingRuntime } from '#lib/server/tracking/runtime.ts';
import { validTrackingInput } from '#lib/server/tracking/carriers.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ request }) => {
	try {
		const user = await authenticate(request, authConfig());
		return json({ data: await trackingRuntime().store.list(user.id) }, { headers: { 'Cache-Control': 'no-store' } });
	} catch (caught) {
		return json({ error: { message: 'Список відправлень недоступний.' } }, {
			status: caught instanceof AuthError ? caught.status : 503,
			headers: { 'Cache-Control': 'no-store' }
		});
	}
};

export const POST: RequestHandler = async ({ request, url }) => {
	if (request.headers.get('origin') !== url.origin) return json({ error: { message: 'Invalid origin' } }, { status: 403 });
	try {
		const user = await authenticate(request, authConfig());
		const body = await request.json().catch(() => null);
		const carrier = body?.carrier ?? body?.carrier_hint;
		const number = typeof body?.tracking_number === 'string' ? body.tracking_number.trim().toUpperCase() : '';
		if (!validTrackingInput(carrier, number)) {
			return json({ error: { message: 'Invalid carrier or tracking number' } }, { status: 400 });
		}
		return json({ data: await trackingRuntime().store.create(user.id, carrier, number) }, {
			status: 201, headers: { 'Cache-Control': 'no-store' }
		});
	} catch (caught) {
		return json({ error: { message: 'Не вдалося додати відправлення.' } }, {
			status: caught instanceof AuthError ? caught.status : 503,
			headers: { 'Cache-Control': 'no-store' }
		});
	}
};