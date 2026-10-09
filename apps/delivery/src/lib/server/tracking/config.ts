import * as env from '$app/env/private';

export function authConfig() {
	return {
		SUPABASE_URL: env.DELIVERY_SUPABASE_URL,
		SUPABASE_PUBLISHABLE_KEY: env.DELIVERY_SUPABASE_PUBLISHABLE_KEY
	};
}