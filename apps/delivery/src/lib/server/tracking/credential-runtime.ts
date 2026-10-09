import * as env from '$app/env/private';
import { createClient } from '@libsql/client';
import { CredentialVault, CredentialVaultError } from './credential-vault.ts';

let store: CredentialVault | undefined;

export function credentialRuntime(): { store: CredentialVault } {
	if (!store) {
		if (!env.DELIVERY_TURSO_DATABASE_URL) throw new CredentialVaultError();
		try {
			store = new CredentialVault(createClient({
				url: env.DELIVERY_TURSO_DATABASE_URL,
				authToken: env.DELIVERY_TURSO_AUTH_TOKEN
			}), () => env.DELIVERY_CREDENTIAL_ENCRYPTION_KEY);
		} catch {
			throw new CredentialVaultError();
		}
	}
	return { store };
}

export async function getPersonalNovaPoshtaKey(ownerId: string): Promise<string | undefined> {
	return credentialRuntime().store.getPersonalNovaPoshtaKey(ownerId);
}