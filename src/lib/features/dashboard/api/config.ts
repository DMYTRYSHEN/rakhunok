import { env } from '$env/dynamic/public';

export type SupabaseBrowserConfig = {
	url: string;
	anonKey: string;
};

export function getSupabaseBrowserConfig(): SupabaseBrowserConfig | null {
	const url = env.PUBLIC_SUPABASE_URL?.trim();
	const anonKey = env.PUBLIC_SUPABASE_ANON_KEY?.trim();

	if (!url || !anonKey) return null;

	return { url, anonKey };
}
