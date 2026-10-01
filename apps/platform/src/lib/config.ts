export type PlatformConfig = {
	supabaseUrl: string;
	supabaseKey: string;
	googleClientId: string;
};

export function readPlatformConfig(env: Record<string, unknown>): PlatformConfig {
	const read = (key: string) => typeof env[key] === 'string' ? env[key].trim() : '';
	return {
		supabaseUrl: read('PUBLIC_SUPABASE_URL'),
		supabaseKey: read('PUBLIC_SUPABASE_PUBLISHABLE_KEY') || read('PUBLIC_SUPABASE_ANON_KEY'),
		googleClientId: read('PUBLIC_GOOGLE_CLIENT_ID')
	};
}