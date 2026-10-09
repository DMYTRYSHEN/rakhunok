import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import type { Client, InStatement } from '@libsql/client';

export class CredentialVaultError extends Error {
	constructor() {
		super('Credential vault unavailable');
	}
}

export function requireNovaPoshtaKey(value: unknown): string {
	if (typeof value !== 'string' || !/^[a-f0-9]{32}$/i.test(value)) {
		throw new Error('Invalid carrier credential');
	}
	return value;
}

function requireOwner(ownerId: string): void {
	if (typeof ownerId !== 'string' || !ownerId.trim()) throw new CredentialVaultError();
}

export type CredentialCarrier = 'nova_poshta' | 'ukrposhta' | 'meest';

export function requireCarrierKey(carrier: CredentialCarrier, value: unknown): string {
	if (carrier === 'nova_poshta') return requireNovaPoshtaKey(value);
	if (!['ukrposhta', 'meest'].includes(carrier) || typeof value !== 'string' ||
		!value.length || value.length > 1024 || !/^[\x21-\x7e]+$/.test(value)) throw new Error('Invalid carrier credential');
	return value;
}

export class CredentialVault {
	private readonly client: Client;
	private readonly configuration: () => string | undefined;

	constructor(client: Client, configuration: () => string | undefined) {
		this.client = client;
		this.configuration = configuration;
	}

	private encryptionKey(): Buffer {
		const encoded = this.configuration();
		if (typeof encoded !== 'string' || !/^[A-Za-z0-9+/]{43}=$/.test(encoded)) throw new CredentialVaultError();
		const key = Buffer.from(encoded, 'base64');
		if (key.length !== 32 || key.toString('base64') !== encoded) throw new CredentialVaultError();
		return key;
	}

	assertReady(): void {
		this.encryptionKey();
	}

	private async execute(statement: InStatement) {
		try {
			return await this.client.execute(statement);
		} catch {
			throw new CredentialVaultError();
		}
	}

	private aad(ownerId: string, carrier: CredentialCarrier): Buffer {
		return Buffer.from(JSON.stringify([ownerId, carrier, 1]), 'utf8');
	}

	async getPersonalNovaPoshtaKey(ownerId: string): Promise<string | undefined> {
		return this.get(ownerId, 'nova_poshta');
	}

	async get(ownerId: string, carrier: CredentialCarrier = 'nova_poshta'): Promise<string | undefined> {
		requireOwner(ownerId);
		const result = await this.execute({
			sql: 'SELECT ciphertext, version, nonce, tag FROM delivery_carrier_credentials WHERE owner_id = ? AND carrier = ?',
			args: [ownerId, carrier]
		});
		const row = result.rows[0];
		if (!row) return undefined;
		try {
			if (row.version !== 1) throw new CredentialVaultError();
			const nonce = Buffer.from(String(row.nonce), 'base64');
			const tag = Buffer.from(String(row.tag), 'base64');
			const ciphertext = Buffer.from(String(row.ciphertext), 'base64');
			if (nonce.length !== 12 || tag.length !== 16 || ciphertext.length < 1 || ciphertext.length > 1024) throw new CredentialVaultError();
			const decipher = createDecipheriv('aes-256-gcm', this.encryptionKey(), nonce);
			decipher.setAAD(this.aad(ownerId, carrier));
			decipher.setAuthTag(tag);
			return requireCarrierKey(carrier, Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8'));
		} catch {
			throw new CredentialVaultError();
		}
	}

	async metadata(ownerId: string, carrier: CredentialCarrier = 'nova_poshta'): Promise<{ configured: boolean; ready: boolean }> {
		this.assertReady();
		const configured = (await this.get(ownerId, carrier)) !== undefined;
		return { configured, ready: configured };
	}

	async save(ownerId: string, value: string, carrier: CredentialCarrier = 'nova_poshta'): Promise<void> {
		requireOwner(ownerId);
		const plaintext = requireCarrierKey(carrier, value);
		const nonce = randomBytes(12);
		const cipher = createCipheriv('aes-256-gcm', this.encryptionKey(), nonce);
		cipher.setAAD(this.aad(ownerId, carrier));
		const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
		const now = new Date().toISOString();
		await this.execute({
			sql: `INSERT INTO delivery_carrier_credentials
				(owner_id, carrier, ciphertext, version, nonce, tag, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
				ON CONFLICT(owner_id, carrier) DO UPDATE SET ciphertext = excluded.ciphertext,
				version = excluded.version, nonce = excluded.nonce, tag = excluded.tag, updated_at = excluded.updated_at`,
			args: [ownerId, carrier, ciphertext.toString('base64'), 1, nonce.toString('base64'),
				cipher.getAuthTag().toString('base64'), now, now]
		});
	}

	async delete(ownerId: string, carrier: CredentialCarrier = 'nova_poshta'): Promise<void> {
		requireOwner(ownerId);
		this.assertReady();
		await this.execute({
			sql: 'DELETE FROM delivery_carrier_credentials WHERE owner_id = ? AND carrier = ?',
			args: [ownerId, carrier]
		});
	}
}