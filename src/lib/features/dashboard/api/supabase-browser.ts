import { createClient } from '@supabase/supabase-js';
import { getSupabaseBrowserConfig } from './config';
import { createDashboardGateway, type DashboardGateway } from './dashboard-gateway';

let gateway: DashboardGateway | null = null;

export function getDashboardGateway(): DashboardGateway | null {
	if (gateway) return gateway;

	const config = getSupabaseBrowserConfig();
	if (!config) return null;

	const client = createClient(config.url, config.anonKey, {
		auth: {
			persistSession: true,
			autoRefreshToken: true,
			detectSessionInUrl: true
		}
	});

	gateway = createDashboardGateway(client);
	return gateway;
}
