import { createClient } from '@supabase/supabase-js';
import type { PlatformConfig } from '../config';

export function createPlatformClient(config: PlatformConfig) {
	if (!config.supabaseUrl || !config.supabaseKey) return null;
	return createClient(config.supabaseUrl, config.supabaseKey, {
		auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
	});
}