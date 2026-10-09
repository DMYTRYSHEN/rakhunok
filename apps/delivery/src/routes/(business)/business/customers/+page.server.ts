import { fail } from '@sveltejs/kit';
import { authenticate, AuthError } from '#lib/server/tracking/auth.ts';
import { authConfig } from '#lib/server/tracking/config.ts';
import { shipmentForm } from '#lib/server/tracking/np-http.ts';
import { trackingRuntime } from '#lib/server/tracking/runtime.ts';
import { CustomerValidationError, type Customer } from '#lib/server/tracking/customers.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent, request, setHeaders }) => {
	await parent();
	setHeaders({ 'Cache-Control': 'no-store' });
	const owner = await authenticate(request, authConfig());
	try { return { customers: await trackingRuntime().customers.list(owner.id), customersError: '' }; }
	catch { return { customers: [] as Customer[], customersError: 'База клієнтів тимчасово недоступна.' }; }
};

export const actions: Actions = {
	default: async ({ request, url, setHeaders }) => {
		setHeaders({ 'Cache-Control': 'no-store' });
		let values = { id: '', name: '', phone: '' };
		try {
			const owner = await authenticate(request, authConfig());
			let input: Record<string, unknown>;
			try { input = await shipmentForm(request, url); }
			catch { return fail(400, { message: 'Некоректний запит.', values }); }
			values = { id: typeof input.id === 'string' ? input.id : '', name: typeof input.name === 'string' ? input.name : '', phone: typeof input.phone === 'string' ? input.phone : '' };
			const store = trackingRuntime().customers;
			if (input.intent === 'delete' && values.id) await store.remove(owner.id, values.id);
			else if (input.intent === 'save') await store.save(owner.id, values.name, values.phone, values.id || undefined);
			else throw new CustomerValidationError();
			return { message: input.intent === 'delete' ? 'Клієнта видалено.' : 'Клієнта збережено. Наявний запис із цим телефоном не дублюється.', values: { id: '', name: '', phone: '' } };
		} catch (error) {
			return fail(error instanceof AuthError ? error.status : error instanceof CustomerValidationError ? 400 : 503, { message: error instanceof CustomerValidationError ? 'Перевірте ім’я й телефон. Телефон може вже належати іншому запису.' : 'Не вдалося змінити базу клієнтів.', values });
		}
	}
};