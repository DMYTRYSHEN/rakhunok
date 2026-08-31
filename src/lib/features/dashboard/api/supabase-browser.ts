import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseBrowserConfig } from './config';
import { createDashboardGateway, type DashboardGateway } from './dashboard-gateway';

let gateway: DashboardGateway | null = null;
let client: SupabaseClient | null = null;

export function getSupabaseBrowserClient(): SupabaseClient | null {
	if (client) return client;

	const config = getSupabaseBrowserConfig();
	if (!config) return null;

	client = createClient(config.url, config.anonKey, {
		auth: {
			persistSession: true,
			autoRefreshToken: true,
			detectSessionInUrl: true
		}
	});
	return client;
}

export function getDashboardGateway(): DashboardGateway | null {
	if (gateway) return gateway;

	const browserClient = getSupabaseBrowserClient();
	if (!browserClient) return null;

	gateway = createDashboardGateway(browserClient, { eventsApiBase: '/dashboard' });
	return gateway;
}
