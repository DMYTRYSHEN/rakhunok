import { authenticate } from '#lib/server/tracking/auth.ts';
import { authConfig } from '#lib/server/tracking/config.ts';
import { getPersonalNovaPoshtaKey } from '#lib/server/tracking/credential-runtime.ts';
import { novaPoshtaApi } from '#lib/server/tracking/np-api.ts';
import { senderAccount } from '#lib/server/tracking/np-issuance.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ request, url }) => {
	const headers = { 'Cache-Control': 'no-store' };
	try {
		const owner = await authenticate(request, authConfig());
		const key = await getPersonalNovaPoshtaKey(owner.id);
		if (!key) return Response.json({ error: 'Personal key required' }, { status: 409, headers });
		return Response.json(await senderAccount(novaPoshtaApi, key, url.searchParams.get('sender') ?? undefined), { headers });
	} catch { return Response.json({ error: 'Account unavailable' }, { status: 503, headers }); }
};