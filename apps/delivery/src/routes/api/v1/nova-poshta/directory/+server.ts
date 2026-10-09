import { json } from '@sveltejs/kit';
import { authenticate, AuthError } from '#lib/server/tracking/auth.ts';
import { authConfig } from '#lib/server/tracking/config.ts';
import { novaPoshtaApi, NovaPoshtaError } from '#lib/server/tracking/np-api.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ request, url }) => {
	const headers = { 'Cache-Control': 'no-store' };
	try {
		await authenticate(request, authConfig());
		const kind = url.searchParams.get('kind');
		const search = url.searchParams.get('q') ?? '';
		const page = Number(url.searchParams.get('page') ?? '1');
		if (kind !== 'cities' && kind !== 'warehouses') return json({ error: { message: 'Оберіть тип довідника.' } }, { status: 400, headers });
		const result = kind === 'cities' ? await novaPoshtaApi.citiesPage(search, page) :
			await novaPoshtaApi.warehousesPage(url.searchParams.get('cityRef') ?? '', search, page);
		return json({ ...result, page }, { headers });
	} catch (caught) {
		const status = caught instanceof AuthError || caught instanceof NovaPoshtaError ? caught.status : 503;
		return json({ error: { message: status === 400 ? 'Перевірте параметри пошуку.' : status === 429 ? 'Ліміт запитів Нової пошти. Спробуйте пізніше.' : 'Довідник недоступний.' } }, { status, headers });
	}
};