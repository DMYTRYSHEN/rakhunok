import type { Client } from '@libsql/client';
import { documentHash } from './np-document-store.ts';
import { requireRef } from './np-api.ts';
import { senderAccount } from './np-issuance.ts';
import { ShippingValidationError } from './np-shipping.ts';
import type { SenderContact } from './np-issuance.ts';

export async function defaultSenderAccount(store: NovaPoshtaSenderDefaults, owner: string, key: string, api: Parameters<typeof senderAccount>[0]) {
	const saved = await store.get(owner, key);
	let account = await senderAccount(api, key);
	let contacts: SenderContact[] = [];
	if (saved && account.senders.some(sender => sender.ref === saved.senderRef)) {
		account = await senderAccount(api, key, saved.senderRef);
		contacts = account.contacts;
		if (contacts.some(contact => contact.ref === saved.contactRef)) {
			return { ...account, defaultSenderRef: saved.senderRef, defaultContactRef: saved.contactRef, defaultsWarning: '' };
		}
	}
	return { senders: account.senders, contacts: [] as SenderContact[], defaultSenderRef: '', defaultContactRef: '',
		defaultsWarning: saved ? 'Збережений відправник або контакт недоступний. Оновіть налаштування відправника.' : '' };
}

export class NovaPoshtaSenderDefaults {
	private client: Client;
	constructor(client: Client) { this.client = client; }
	async get(owner: string, key: string) {
		const result = await this.client.execute({
			sql: 'SELECT sender_ref, contact_ref FROM delivery_np_sender_defaults WHERE owner_id = ? AND credential_hash = ?',
			args: [owner, documentHash(key)]
		});
		const row = result.rows[0];
		return row ? { senderRef: String(row.sender_ref), contactRef: String(row.contact_ref) } : null;
	}
	async save(owner: string, key: string, senderRef: string, contactRef: string, api: Parameters<typeof senderAccount>[0]) {
		requireRef(senderRef); requireRef(contactRef);
		const account = await senderAccount(api, key, senderRef);
		if (!account.contacts.some(contact => contact.ref === contactRef)) throw new ShippingValidationError('contactRef');
		await this.client.execute({
			sql: `INSERT INTO delivery_np_sender_defaults (owner_id, credential_hash, sender_ref, contact_ref)
				VALUES (?, ?, ?, ?) ON CONFLICT(owner_id) DO UPDATE SET
				credential_hash = excluded.credential_hash, sender_ref = excluded.sender_ref, contact_ref = excluded.contact_ref`,
			args: [owner, documentHash(key), senderRef, contactRef]
		});
	}
	async clear(owner: string) {
		await this.client.execute({ sql: 'DELETE FROM delivery_np_sender_defaults WHERE owner_id = ?', args: [owner] });
	}
}