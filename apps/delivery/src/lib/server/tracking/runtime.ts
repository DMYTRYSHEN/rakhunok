import * as env from '$app/env/private';
import { createClient } from '@libsql/client';
import { track } from './carriers.ts';
import { TrackingStore } from './store.ts';
import { TrackingService } from './service.ts';
import { credentialRuntime } from './credential-runtime.ts';
import { NovaPoshtaDocumentStore } from './np-document-store.ts';
import { NovaPoshtaSenderDefaults } from './np-sender-defaults.ts';
import { CustomerStore } from './customers.ts';

let instance: { store: TrackingStore; service: TrackingService; documents: NovaPoshtaDocumentStore; senderDefaults: NovaPoshtaSenderDefaults; customers: CustomerStore } | undefined;

export function trackingRuntime() {
	if (instance) return instance;
	if (!env.DELIVERY_TURSO_DATABASE_URL) throw new Error('Tracking database is not configured');
	const client = createClient({
		url: env.DELIVERY_TURSO_DATABASE_URL,
		authToken: env.DELIVERY_TURSO_AUTH_TOKEN
	});
	const store = new TrackingStore(client);
	const service = new TrackingService(store, async (carrier, number, ownerId) => {
		const key = await credentialRuntime().store.get(ownerId, carrier);
		return track(carrier, number, {
			NOVA_POSHTA_API_KEY: carrier === 'nova_poshta' ? key : undefined,
			UKRPOSHTA_TRACKING_TOKEN: carrier === 'ukrposhta' ? key : undefined,
			MEEST_TRACKING_TOKEN: carrier === 'meest' ? key : undefined
		});
	});
	instance = { store, service, documents: new NovaPoshtaDocumentStore(client), senderDefaults: new NovaPoshtaSenderDefaults(client), customers: new CustomerStore(client) };
	return instance;
}