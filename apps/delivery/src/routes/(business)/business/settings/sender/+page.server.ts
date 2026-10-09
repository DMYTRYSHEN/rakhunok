import { fail } from '@sveltejs/kit';
import { authenticate, AuthError } from '#lib/server/tracking/auth.ts';
import { authConfig } from '#lib/server/tracking/config.ts';
import { getPersonalNovaPoshtaKey } from '#lib/server/tracking/credential-runtime.ts';
import { novaPoshtaApi } from '#lib/server/tracking/np-api.ts';
import { defaultSenderAccount } from '#lib/server/tracking/np-sender-defaults.ts';
import { trackingRuntime } from '#lib/server/tracking/runtime.ts';
import { shipmentForm } from '#lib/server/tracking/np-http.ts';
import type { Sender, SenderContact } from '#lib/server/tracking/np-issuance.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent, request, setHeaders }) => {
	await parent();
	setHeaders({ 'Cache-Control': 'no-store' });
	const empty = { senders: [] as Sender[], contacts: [] as SenderContact[], defaultSenderRef: '', defaultContactRef: '', defaultsWarning: '' };
	try {
		const owner = await authenticate(request, authConfig());
		const key = await getPersonalNovaPoshtaKey(owner.id);
		if (!key) return { ...empty, accountError: 'Додайте особистий ключ Нової пошти в інтеграціях.' };
		return { ...await defaultSenderAccount(trackingRuntime().senderDefaults, owner.id, key, novaPoshtaApi), accountError: '' };
	} catch { return { ...empty, accountError: 'Не вдалося завантажити налаштування відправника. Повторіть спробу.' }; }
};

export const actions: Actions = {
	default: async ({ request, url, setHeaders }) => {
		setHeaders({ 'Cache-Control': 'no-store' });
		try {
			const owner = await authenticate(request, authConfig());
			let input: Record<string, unknown>;
			try { input = await shipmentForm(request, url); }
			catch { return fail(400, { message: 'Некоректний запит.', saved: false }); }
			const store = trackingRuntime().senderDefaults;
			if (input.intent === 'clear') {
				await store.clear(owner.id);
				return { message: 'Типового відправника скинуто.', saved: true };
			}
			if (input.intent !== 'save' || typeof input.senderRef !== 'string' || typeof input.contactRef !== 'string') {
				return fail(400, { message: 'Оберіть відправника та контакт.', saved: false });
			}
			const key = await getPersonalNovaPoshtaKey(owner.id);
			if (!key) return fail(409, { message: 'Додайте ключ Нової пошти в інтеграціях.', saved: false });
			await store.save(owner.id, key, input.senderRef, input.contactRef, novaPoshtaApi);
			return { message: 'Типового відправника збережено.', saved: true };
		} catch (caught) {
			return fail(caught instanceof AuthError ? caught.status : 503, { message: 'Не вдалося зберегти. Перевірте доступність відправника й контакту та повторіть спробу.', saved: false });
		}
	}
};