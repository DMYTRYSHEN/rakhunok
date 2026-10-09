import { defineEnvVars } from '@sveltejs/kit/env';

export const variables = defineEnvVars({
	DELIVERY_SUPABASE_URL: { schema: (value) => value },
	DELIVERY_SUPABASE_PUBLISHABLE_KEY: { schema: (value) => value },
	DELIVERY_GOOGLE_CLIENT_ID: { schema: (value) => value },
	DELIVERY_TURSO_DATABASE_URL: { schema: (value) => value },
	DELIVERY_TURSO_AUTH_TOKEN: { schema: (value) => value },
	DELIVERY_CREDENTIAL_ENCRYPTION_KEY: { schema: (value) => value },
	NOVA_POSHTA_API_KEY: { schema: (value) => value },
	UKRPOSHTA_TRACKING_TOKEN: { schema: (value) => value },
	MEEST_TRACKING_TOKEN: { schema: (value) => value }
});