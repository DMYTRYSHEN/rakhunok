import { authenticate } from '#lib/server/tracking/auth.ts';
import { authConfig } from '#lib/server/tracking/config.ts';
import { getPersonalNovaPoshtaKey } from '#lib/server/tracking/credential-runtime.ts';
import { trackingRuntime } from '#lib/server/tracking/runtime.ts';
import { documentPdf } from '#lib/server/tracking/np-http.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ request, params, url }) => documentPdf(request, params.id, url.searchParams.get('format') ?? 'waybill', {
	authenticate: request => authenticate(request, authConfig()),
	key: getPersonalNovaPoshtaKey,
	printable: (owner, id, key) => trackingRuntime().documents.printable(owner, id, key)
});