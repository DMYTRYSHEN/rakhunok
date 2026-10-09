import { createHash } from 'node:crypto';
import type { Client } from '@libsql/client';

export function documentHash(value: string): string {
	return createHash('sha256').update(value).digest('hex');
}

export type IssuedDocument = {
	id: string; state: 'submitting' | 'issued' | 'outcome_unknown';
	documentRef: string | null; trackingNumber: string | null; createdAt: string;
};

export class NovaPoshtaDocumentStore {
	private client: Client;
	constructor(client: Client) { this.client = client; }
	async begin(owner: string, id: string, payload: Record<string, unknown>, key: string) {
		const fingerprint = documentHash(JSON.stringify(payload));
		const inserted = await this.client.execute({
			sql: `INSERT INTO delivery_np_documents (id, owner_id, fingerprint, credential_hash, state, created_at)
				VALUES (?, ?, ?, ?, 'submitting', ?) ON CONFLICT DO NOTHING`,
			args: [id, owner, fingerprint, documentHash(key), new Date().toISOString()]
		});
		const rows = await this.client.execute({
			sql: 'SELECT id, fingerprint FROM delivery_np_documents WHERE owner_id = ? AND (id = ? OR fingerprint = ?)',
			args: [owner, id, fingerprint]
		});
		if (rows.rows.length !== 1 || rows.rows[0].fingerprint !== fingerprint) throw new Error('Document conflict');
		return { started: inserted.rowsAffected === 1, id: String(rows.rows[0].id) };
	}
	async finish(owner: string, id: string, documentRef: string | null, trackingNumber: string | null) {
		await this.client.execute({
			sql: `UPDATE delivery_np_documents SET state = ?, document_ref = ?, tracking_number = ?
				WHERE owner_id = ? AND id = ? AND state = 'submitting'`,
			args: [documentRef && trackingNumber ? 'issued' : 'outcome_unknown', documentRef, trackingNumber, owner, id]
		});
	}
	async list(owner: string): Promise<IssuedDocument[]> {
		const rows = await this.client.execute({
			sql: 'SELECT id, state, document_ref, tracking_number, created_at FROM delivery_np_documents WHERE owner_id = ? ORDER BY created_at DESC LIMIT 100',
			args: [owner]
		});
		return rows.rows.map(row => ({ id: String(row.id), state: row.state as IssuedDocument['state'],
			documentRef: row.document_ref === null ? null : String(row.document_ref),
			trackingNumber: row.tracking_number === null ? null : String(row.tracking_number), createdAt: String(row.created_at) }));
	}
	async get(owner: string, id: string): Promise<IssuedDocument> {
		const rows = await this.client.execute({
			sql: 'SELECT id, state, document_ref, tracking_number, created_at FROM delivery_np_documents WHERE owner_id = ? AND id = ?',
			args: [owner, id]
		});
		const row = rows.rows[0];
		if (!row) throw new Error('Document unavailable');
		return { id: String(row.id), state: row.state as IssuedDocument['state'],
			documentRef: row.document_ref === null ? null : String(row.document_ref),
			trackingNumber: row.tracking_number === null ? null : String(row.tracking_number), createdAt: String(row.created_at) };
	}
	async printable(owner: string, id: string, key: string): Promise<string | null> {
		const rows = await this.client.execute({
			sql: `SELECT document_ref FROM delivery_np_documents
				WHERE owner_id = ? AND id = ? AND state = 'issued' AND credential_hash = ?`,
			args: [owner, id, documentHash(key)]
		});
		return rows.rows[0] ? String(rows.rows[0].document_ref) : null;
	}
}