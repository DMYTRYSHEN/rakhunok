import { trackingConfig } from './config.ts';
import { createClient } from '@libsql/client';
import { CredentialVault, CredentialVaultError } from './credential-vault.ts';

let store: CredentialVault | undefined;

export function credentialRuntime(): { store: CredentialVault } {
	if (!store) {
		const config = trackingConfig();
		if (!config.url) throw new CredentialVaultError();
		try {
			store = new CredentialVault(createClient({
				url: config.url,
				authToken: config.authToken
			}), () => config.encryptionKey);
		} catch {
			throw new CredentialVaultError();
		}
	}
	return { store };
}

export async function getPersonalNovaPoshtaKey(ownerId: string): Promise<string | undefined> {
	return credentialRuntime().store.getPersonalNovaPoshtaKey(ownerId);
}