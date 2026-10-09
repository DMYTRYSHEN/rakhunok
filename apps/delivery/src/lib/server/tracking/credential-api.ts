import { AuthError } from './auth.ts';
import { NovaPoshtaApi } from './np-api.ts';
import { requireCarrierKey, requireNovaPoshtaKey } from './credential-vault.ts';
import type { CredentialCarrier, CredentialVault } from './credential-vault.ts';

class CredentialRequestError extends Error {
	readonly status: number;
	constructor(status: number) {
		super('Credential request rejected');
		this.status = status;
	}
}

async function readKey(request: Request, carrier: CredentialCarrier): Promise<string> {
	if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
		throw new CredentialRequestError(415);
	}
	const declared = request.headers.get('content-length');
	if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > 2048)) {
		throw new CredentialRequestError(413);
	}
	const reader = request.body?.getReader();
	if (!reader) throw new CredentialRequestError(400);
	let timeout: ReturnType<typeof setTimeout> | undefined;
	const deadline = new Promise<never>((_resolve, reject) => {
		timeout = setTimeout(() => reject(new CredentialRequestError(408)), 5000);
	});
	try {
		const chunks: Uint8Array[] = [];
		let size = 0;
		while (true) {
			const part = await Promise.race([reader.read(), deadline]);
			if (part.done) break;
			size += part.value.byteLength;
			if (size > 2048) throw new CredentialRequestError(413);
			chunks.push(part.value);
		}
		const body: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)));
		if (typeof body !== 'object' || body === null || Array.isArray(body) ||
			Object.keys(body).length !== 1 || !Object.hasOwn(body, 'key')) throw new CredentialRequestError(400);
		return requireCarrierKey(carrier, (body as { key: unknown }).key);
	} catch (caught) {
		if (caught instanceof CredentialRequestError) throw caught;
		throw new CredentialRequestError(400);
	} finally {
		clearTimeout(timeout);
		void reader.cancel().catch(() => {});
	}
}

export async function validatePersonalNovaPoshtaKey(key: string, transport: typeof fetch = fetch): Promise<void> {
	await new NovaPoshtaApi(transport).call('Counterparty', 'getCounterparties', {
		CounterpartyProperty: 'Sender', Limit: '1', Page: '1'
	}, requireNovaPoshtaKey(key));
}

export function createCredentialHandler(dependencies: {
	authenticate: (request: Request) => Promise<{ id: string }>;
	runtime: () => { store: CredentialVault };
	validate?: (key: string) => Promise<void>;
	carrier?: CredentialCarrier;
}) {
	const carrier = dependencies.carrier ?? 'nova_poshta';
	const carrierArgs: [CredentialCarrier] | [] = dependencies.carrier ? [carrier] : [];
	return async (request: Request, url: URL): Promise<Response> => {
		const headers = { 'Cache-Control': 'no-store' };
		try {
			if (!['GET', 'POST', 'DELETE'].includes(request.method)) throw new CredentialRequestError(405);
			if (request.method !== 'GET' && request.headers.get('origin') !== url.origin) throw new CredentialRequestError(403);
			const owner = await dependencies.authenticate(request);
			const { store } = dependencies.runtime();
			store.assertReady();
			if (request.method === 'GET') {
				const metadata = await store.metadata(owner.id, ...carrierArgs);
				let verified = false;
				if (carrier === 'nova_poshta' && metadata.ready) {
					const savedKey = await store.getPersonalNovaPoshtaKey(owner.id);
					if (savedKey) {
						try {
							await (dependencies.validate ?? validatePersonalNovaPoshtaKey)(savedKey);
							verified = true;
						} catch {
							return Response.json({ ...metadata, ready: false, verified: false }, { headers });
						}
					}
				}
				return Response.json({ ...metadata, ready: carrier === 'nova_poshta' ? verified : metadata.ready, verified }, { headers });
			}
			if (request.method === 'DELETE') {
				await store.delete(owner.id, ...carrierArgs);
				return Response.json({ configured: false, ready: false, verified: false }, { headers });
			}
			const key = await readKey(request, carrier);
			const validate = dependencies.validate ?? (carrier === 'nova_poshta' ? validatePersonalNovaPoshtaKey : undefined);
			if (validate) await validate(key);
			await store.save(owner.id, key, ...carrierArgs);
			return Response.json({ configured: true, ready: true, verified: !!validate }, { headers });
		} catch (caught) {
			const status = caught instanceof AuthError || caught instanceof CredentialRequestError ? caught.status : 503;
			return Response.json({ error: { message: 'Credential request failed' } }, { status, headers });
		}
	};
}