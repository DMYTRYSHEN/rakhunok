import { error, fail } from '@sveltejs/kit';
import { authenticate } from '#lib/server/tracking/auth.ts';
import { authConfig } from '#lib/server/tracking/config.ts';
import { trackingRuntime } from '#lib/server/tracking/runtime.ts';
import { validTrackingInput } from '#lib/server/tracking/carriers.ts';
import { normalizeTrackingNumber, suggestCarrier } from '#lib/carrier-detection.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent }) => {
	const { userId } = await parent();
	try {
		return { shipments: await trackingRuntime().store.list(userId) };
	} catch {
		error(503, 'Сховище відправлень недоступне. Перевірте конфігурацію та міграцію бази.');
	}
};

export const actions: Actions = {
	create: async ({ request }) => {
		const user = await authenticate(request, authConfig());
		const form = await request.formData();
		const number = normalizeTrackingNumber(String(form.get('trackingNumber') ?? ''));
		const carrier = form.get('carrier') || suggestCarrier(number);
		if (!validTrackingInput(carrier, number)) {
			return fail(400, { message: 'Оберіть перевізника та введіть коректний номер накладної.' });
		}
		let shipment;
		try {
			shipment = await trackingRuntime().store.create(user.id, carrier, number);
		} catch {
			return fail(503, { message: 'Не вдалося зберегти відправлення.' });
		}
		try {
			const updated = await trackingRuntime().service.refresh(shipment.id, user.id);
			const checked = updated?.trackingState === 'active' || updated?.trackingState === 'completed';
			return { shipmentId: shipment.id, message: checked
				? 'Відправлення додано. Дані перевізника отримано.'
				: 'Відправлення збережено. Поточний стан перевірки вказано в деталях.' };
		} catch {
			return { shipmentId: shipment.id, message: 'Відправлення збережено, але перша перевірка недоступна. Повторіть оновлення пізніше.' };
		}
	},
	refresh: async ({ request }) => {
		const user = await authenticate(request, authConfig());
		const id = String((await request.formData()).get('id') ?? '');
		try {
			const { store, service } = trackingRuntime();
			if (!await store.get(id, user.id)) return fail(404, { message: 'Відправлення не знайдено.' });
			const shipment = await service.refresh(id, user.id);
			if (!shipment) return fail(409, { message: 'Перевірка вже виконується або відстеження призупинене.' });
			return { message: shipment.trackingState === 'active' || shipment.trackingState === 'completed'
				? 'Дані перевізника оновлено.' : `Перевірку виконано: ${shipment.trackingState}.` };
		} catch {
			return fail(503, { message: 'Не вдалося виконати перевірку. Попередні дані збережено.' });
		}
	},
	delete: async ({ request }) => {
		const user = await authenticate(request, authConfig());
		const id = String((await request.formData()).get('id') ?? '');
		try {
			if (!await trackingRuntime().store.delete(id, user.id)) return fail(404, { message: 'Відправлення не знайдено.' });
			return { message: 'Відправлення видалено зі списку.' };
		} catch {
			return fail(503, { message: 'Не вдалося видалити відправлення.' });
		}
	}
};