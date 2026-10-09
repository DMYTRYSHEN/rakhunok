import { requireRef } from './np-api.ts';
import { prepareShipment, validatePreparation, buildEstimatePayload, ShippingValidationError } from './np-shipping.ts';
import type { NovaPoshtaDocumentStore } from './np-document-store.ts';

type Api = { call(model: string, method: string, properties: Record<string, unknown>, key?: string): Promise<Record<string, unknown>[]> };
export type Sender = { ref: string; name: string };
export type SenderContact = Sender & { phone: string };

async function accountRows(api: Api, method: string, properties: Record<string, unknown>, key: string) {
	const result: Record<string, unknown>[] = [];
	for (let page = 1; page <= 20; page++) {
		const rows = await api.call('Counterparty', method, { ...properties, Page: String(page), Limit: '100' }, key);
		result.push(...rows);
		if (rows.length < 100) return result;
	}
	throw new Error('Account list exceeds limit');
}

function safeText(value: unknown, limit: number): string {
	return typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, limit) : '';
}

export async function senderAccount(api: Api, key: string, senderRef?: string): Promise<{ senders: Sender[]; contacts: SenderContact[] }> {
	const rows = await accountRows(api, 'getCounterparties', { CounterpartyProperty: 'Sender' }, key);
	const senders = rows.map(row => ({ ref: requireRef(String(row.Ref)), name: safeText(row.Description, 200) }));
	if (!senderRef) return { senders, contacts: [] };
	if (!senders.some(sender => sender.ref === senderRef)) throw new ShippingValidationError('senderRef');
	const contacts = (await accountRows(api, 'getCounterpartyContactPersons', { Ref: senderRef }, key))
		.map(row => ({ ref: requireRef(String(row.Ref)), name: safeText(row.Description, 150), phone: safeText(row.Phones, 24) }))
		.filter(contact => /^(?:\+?380|0)\d{9}$/.test(contact.phone));
	return { senders, contacts };
}

export async function issueNovaPoshta(dependencies: { api: Api; store: NovaPoshtaDocumentStore; key: string; owner: string }, input: Record<string, unknown>, now = new Date()) {
	const { api, store, key, owner } = dependencies;
	if (input.confirm !== 'yes') throw new ShippingValidationError('confirm');
	const id = requireRef(String(input.attemptId));
	const senderRef = requireRef(String(input.senderRef));
	const contactRef = requireRef(String(input.contactRef));
	const preparation = validatePreparation(input);
	const name = preparation.recipientName.split(/\s+/);
	if (name.length < 2 || name.length > 3 || name.some(part => part.length > 36) || !/^[\u0400-\u04ff\u2019' -]+$/.test(preparation.recipientName)) throw new ShippingValidationError('recipientName');
	if (preparation.seats.some(seat => seat.weight < 0.1)) throw new ShippingValidationError('seats');
	const account = await senderAccount(api, key, senderRef);
	const contact = account.contacts.find(item => item.ref === contactRef);
	if (!contact) throw new ShippingValidationError('contactRef');
	const prepared = await prepareShipment(api, input, key, now);
	if (prepared.sender.category !== 'Warehouse' || prepared.recipient.category !== 'Warehouse') throw new ShippingValidationError('route');
	const attempt = await store.begin(owner, id, { ...preparation, senderRef, contactRef }, key);
	if (!attempt.started) return store.get(owner, attempt.id);
	try {
		const recipients = await api.call('Counterparty', 'save', {
			FirstName: name[1], MiddleName: name[2] ?? '', LastName: name[0], Phone: preparation.recipientPhone,
			CounterpartyType: 'PrivatePerson', CounterpartyProperty: 'Recipient'
		}, key);
		if (recipients.length !== 1) throw new Error('Invalid recipient response');
		const recipientRef = requireRef(String(recipients[0].Ref));
		const contacts = await accountRows(api, 'getCounterpartyContactPersons', { Ref: recipientRef }, key);
		const recipientContact = contacts.find(row => typeof row.Phones === 'string' && row.Phones.replace(/^\+/, '').replace(/^0/, '380') === preparation.recipientPhone.slice(1));
		if (!recipientContact) throw new Error('Recipient contact not confirmed');
		const date = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Kyiv', day: '2-digit', month: '2-digit', year: 'numeric' }).format(now).replaceAll('/', '.');
		const result = await api.call('InternetDocument', 'save', {
			...buildEstimatePayload(preparation, prepared.sender, prepared.recipient),
			DateTime: date, Description: preparation.description,
			Sender: senderRef, SenderAddress: preparation.senderWarehouseRef, ContactSender: contactRef, SendersPhone: contact.phone,
			Recipient: recipientRef, RecipientAddress: preparation.recipientWarehouseRef,
			ContactRecipient: requireRef(String(recipientContact.Ref)), RecipientsPhone: preparation.recipientPhone
		}, key);
		if (result.length !== 1 || !/^[25]\d{13}$/.test(String(result[0].IntDocNumber))) throw new Error('Invalid document response');
		const documentRef = requireRef(String(result[0].Ref));
		await store.finish(owner, id, documentRef, String(result[0].IntDocNumber));
	} catch {
		await store.finish(owner, id, null, null);
	}
	return store.get(owner, id);
}