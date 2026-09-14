import { createClient } from '@supabase/supabase-js';
import { createAuthGateway, type AuthGateway } from './auth-gateway';
import { createTelegramTransport } from './telegram-transport';
import { createMerchantDataGateway, type MerchantDataGateway } from '../data/merchant-data-gateway';

let gateway: AuthGateway | null | undefined;
let dataGateway: MerchantDataGateway | null | undefined;
let browserClient: ReturnType<typeof createClient> | null | undefined;
let telegramTransport: ReturnType<typeof createTelegramTransport> | undefined;

function getBrowserClient() {
	if (browserClient !== undefined) return browserClient;

	const url = import.meta.env.PUBLIC_SUPABASE_URL?.trim();
	const anonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY?.trim();
	if (!url || !anonKey) return (browserClient = null);

	// Preserve Supabase's default key and localStorage/memory fallback. Telegram's
	// final session guard requires a synchronous store, not an async adapter.
	const storageKey = `sb-${new URL(url).hostname.split('.')[0]}-auth-token`;
	let storage: import('./telegram-transport').SessionStorage;
	try {
		const probe = `__telegram_storage_probe_${crypto.randomUUID()}`;
		window.localStorage.setItem(probe, probe);
		window.localStorage.removeItem(probe);
		storage = window.localStorage;
	} catch {
		const values = new Map<string, string>();
		storage = { getItem: (key) => values.get(key) ?? null,
			setItem: (key, value) => { values.set(key, value); }, removeItem: (key) => { values.delete(key); } };
	}
	telegramTransport = createTelegramTransport(url, fetch, { storage, key: storageKey });
	return (browserClient = createClient(url, anonKey, {
		global: { fetch: telegramTransport.fetch },
		auth: {
			storageKey,
			storage: telegramTransport.storage,
			flowType: 'pkce',
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
	gateway = createAuthGateway(client, telegramTransport);
	return gateway;
}

export async function getMerchantDataGateway(): Promise<MerchantDataGateway | null> {
	if (dataGateway !== undefined) return dataGateway;
	const client = getBrowserClient();
	if (!client) return (dataGateway = null);
	return (dataGateway = createMerchantDataGateway(client, fetch, import.meta.env.DEV ? '' : '/app'));
}