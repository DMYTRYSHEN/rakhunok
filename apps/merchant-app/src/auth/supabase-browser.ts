import { createClient } from '@supabase/supabase-js';
import { createAuthGateway, type AuthGateway } from './auth-gateway';
import { createMerchantDataGateway, type MerchantDataGateway } from '../data/merchant-data-gateway';

let gateway: AuthGateway | null | undefined;
let dataGateway: MerchantDataGateway | null | undefined;
let browserClient: ReturnType<typeof createClient> | null | undefined;

function getBrowserClient() {
	if (browserClient !== undefined) return browserClient;

	const url = import.meta.env.PUBLIC_SUPABASE_URL?.trim();
	const anonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY?.trim();
	if (!url || !anonKey) return (browserClient = null);

	return (browserClient = createClient(url, anonKey, {
		auth: {
			persistSession: true,
			autoRefreshToken: true,
			detectSessionInUrl: true
		}
	}));
}

export async function getAuthGateway(): Promise<AuthGateway | null> {
	if (gateway !== undefined) return gateway;
	const client = getBrowserClient();
	if (!client) return (gateway = null);
	gateway = createAuthGateway(client);
	return gateway;
}

export async function getMerchantDataGateway(): Promise<MerchantDataGateway | null> {
	if (dataGateway !== undefined) return dataGateway;
	const client = getBrowserClient();
	if (!client) return (dataGateway = null);
	return (dataGateway = createMerchantDataGateway(client));
}