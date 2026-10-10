import * as env from '$app/env/private';
import { getRequestEvent } from '$app/server';

export function trackingConfig() {
	const bindings = getRequestEvent().platform?.env;
	return {
		url: bindings?.DELIVERY_TURSO_DATABASE_URL ?? env.DELIVERY_TURSO_DATABASE_URL,
		authToken: bindings?.DELIVERY_TURSO_AUTH_TOKEN ?? env.DELIVERY_TURSO_AUTH_TOKEN,
		encryptionKey: bindings?.DELIVERY_CREDENTIAL_ENCRYPTION_KEY ?? env.DELIVERY_CREDENTIAL_ENCRYPTION_KEY
	};
}

export function authConfig() {
	return {
		SUPABASE_URL: env.DELIVERY_SUPABASE_URL,
		SUPABASE_PUBLISHABLE_KEY: env.DELIVERY_SUPABASE_PUBLISHABLE_KEY
	};
}