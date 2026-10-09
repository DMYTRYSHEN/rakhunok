import { fail } from '@sveltejs/kit';
import { authenticate, AuthError } from '#lib/server/tracking/auth.ts';
import { authConfig } from '#lib/server/tracking/config.ts';
import { novaPoshtaApi } from '#lib/server/tracking/np-api.ts';
import { prepareShipment, ShippingValidationError } from '#lib/server/tracking/np-shipping.ts';
import { getPersonalNovaPoshtaKey } from '#lib/server/tracking/credential-runtime.ts';
import { issueNovaPoshta } from '#lib/server/tracking/np-issuance.ts';
import { defaultSenderAccount } from '#lib/server/tracking/np-sender-defaults.ts';
import { shipmentForm } from '#lib/server/tracking/np-http.ts';
import { trackingRuntime } from '#lib/server/tracking/runtime.ts';
import type { IssuedDocument } from '#lib/server/tracking/np-document-store.ts';
import type { Sender, SenderContact } from '#lib/server/tracking/np-issuance.ts';
import type { Customer } from '#lib/server/tracking/customers.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent, request, setHeaders }) => {
	await parent();
	setHeaders({ 'Cache-Control': 'no-store' });
	const owner = await authenticate(request, authConfig());
	let documents: IssuedDocument[] = [];
	let senders: Sender[] = [];
	let contacts: SenderContact[] = [];
	let defaultSenderRef = '';
	let defaultContactRef = '';
	let defaultsWarning = '';
	let accountError = '';
	let documentsError = '';
	let customers: Customer[] = [];
	let customersError = '';
	try { customers = await trackingRuntime().customers.list(owner.id); }
	catch { customersError = 'База клієнтів недоступна. Введіть одержувача вручну.'; }
	try { documents = await trackingRuntime().documents.list(owner.id); }
	catch { documentsError = 'Журнал ЕН недоступний. Оформлення заблоковано до відновлення сховища.'; }
	try {
		const key = await getPersonalNovaPoshtaKey(owner.id);
		if (!key) accountError = 'Додайте особистий ключ Нової пошти в інтеграціях.';
		else {
			({ senders, contacts, defaultSenderRef, defaultContactRef, defaultsWarning } = await defaultSenderAccount(trackingRuntime().senderDefaults, owner.id, key, novaPoshtaApi));
			if (!senders.length) accountError = 'У кабінеті Нової пошти немає доступного відправника.';
		}
	} catch { accountError = 'Не вдалося перевірити обліковий запис Нової пошти. Перевірте ключ в інтеграціях.'; }
	return { senders, contacts, defaultSenderRef, defaultContactRef, defaultsWarning, documents, accountError, documentsError, customers, customersError, attemptId: crypto.randomUUID() };
};

function action(issue: boolean): Actions[string] {
	return async ({ request, url }) => {
		try {
			const owner = await authenticate(request, authConfig());
			const key = await getPersonalNovaPoshtaKey(owner.id);
			if (!key) return fail(409, { message: 'Додайте особистий ключ Нової пошти в інтеграціях.', field: 'senderRef', result: null, issued: null });
			let input: Record<string, unknown>;
			try { input = await shipmentForm(request, url); }
			catch { return fail(400, { message: 'Некоректна або завелика форма.', field: '', result: null, issued: null }); }
			if (!issue) {
				const result = await prepareShipment(novaPoshtaApi, input, key);
				return { message: 'Розраховано. Накладну ще не оформлено.', field: '', result, issued: null };
			}
			const runtime = trackingRuntime();
			const issued = await issueNovaPoshta({ api: novaPoshtaApi, store: runtime.documents, key, owner: owner.id }, input);
			let message = issued.state === 'issued' ? 'Експрес-накладну оформлено.' : 'Результат оформлення не підтверджено. Не створюйте повторну ЕН; перевірте документи в кабінеті Нової пошти.';
			if (issued.state === 'issued' && issued.trackingNumber) {
				try { await runtime.customers.save(owner.id, input.recipientName, input.recipientPhone); }
				catch { message += ' ЕН оформлена, але клієнта не вдалося зберегти в базі.'; }
				try { await runtime.store.create(owner.id, 'nova_poshta', issued.trackingNumber); }
				catch { message += ' Не вдалося додати трекінг. ЕН збережена в журналі нижче.'; }
			}
			return { message, field: '', result: null, issued };
		} catch (caught) {
			if (caught instanceof ShippingValidationError) return fail(400, {
				message: caught.field === 'route' ? 'Оформлення наразі доступне між відділеннями. Для поштомата доступний розрахунок.' : 'Перевірте відправника, контакт, дані вантажу та підтвердження оформлення.',
				field: caught.field, result: null, issued: null
			});
			return fail(caught instanceof AuthError ? caught.status : 503, { message: issue ? 'Не вдалося отримати результат. Перевірте журнал ЕН і кабінет Нової пошти перед повторною спробою.' : 'Нова пошта або сховище тимчасово недоступні. Перевірте інтеграцію.', field: '', result: null, issued: null });
		}
	};
}

export const actions: Actions = {
	prepare: action(false),
	issue: action(true)
};