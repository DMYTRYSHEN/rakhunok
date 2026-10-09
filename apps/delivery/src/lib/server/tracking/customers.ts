import type { Client } from '@libsql/client';

export type Customer = { id: string; name: string; phone: string };
export class CustomerValidationError extends Error {}

export function customerDetails(name: unknown, phone: unknown) {
	if (typeof name !== 'string' || typeof phone !== 'string' || name.length > 150 || phone.length > 24) throw new CustomerValidationError();
	const normalizedName = name.trim().replace(/\s+/g, ' ');
	let normalizedPhone = phone.replace(/[ ()-]/g, '');
	if (/^0\d{9}$/.test(normalizedPhone)) normalizedPhone = `+38${normalizedPhone}`;
	if (/^380\d{9}$/.test(normalizedPhone)) normalizedPhone = `+${normalizedPhone}`;
	if (normalizedName.length < 3 || !/^[\p{L}\p{M}'\u2019 -]+$/u.test(normalizedName) || normalizedName.split(' ').length < 2 || !/^\+380\d{9}$/.test(normalizedPhone)) throw new CustomerValidationError();
	return { name: normalizedName, phone: normalizedPhone };
}

export class CustomerStore {
	private client: Client;
	constructor(client: Client) { this.client = client; }
	async list(owner: string): Promise<Customer[]> {
		const result = await this.client.execute({ sql: 'SELECT id, name, phone FROM delivery_customers WHERE owner_id = ? ORDER BY name, id', args: [owner] });
		return result.rows.map(row => ({ id: String(row.id), name: String(row.name), phone: String(row.phone) }));
	}
	async save(owner: string, name: unknown, phone: unknown, id?: string) {
		const details = customerDetails(name, phone);
		if (id) {
			const result = await this.client.execute({ sql: `UPDATE delivery_customers SET name = ?, phone = ? WHERE owner_id = ? AND id = ?
				AND NOT EXISTS (SELECT 1 FROM delivery_customers WHERE owner_id = ? AND phone = ? AND id <> ?)`, args: [details.name, details.phone, owner, id, owner, details.phone, id] });
			if (!result.rowsAffected) throw new CustomerValidationError();
		} else {
			await this.client.execute({ sql: 'INSERT INTO delivery_customers (owner_id, id, name, phone) VALUES (?, ?, ?, ?) ON CONFLICT(owner_id, phone) DO NOTHING', args: [owner, crypto.randomUUID(), details.name, details.phone] });
		}
	}
	async remove(owner: string, id: string) {
		await this.client.execute({ sql: 'DELETE FROM delivery_customers WHERE owner_id = ? AND id = ?', args: [owner, id] });
	}
}