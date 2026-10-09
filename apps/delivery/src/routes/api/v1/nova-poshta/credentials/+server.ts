import { authenticate } from '#lib/server/tracking/auth.ts';
import { authConfig } from '#lib/server/tracking/config.ts';
import { credentialRuntime } from '#lib/server/tracking/credential-runtime.ts';
import { createCredentialHandler } from '#lib/server/tracking/credential-api.ts';
import type { RequestHandler } from './$types';

const handle = createCredentialHandler({
	authenticate: request => authenticate(request, authConfig()),
	runtime: credentialRuntime
});

export const GET: RequestHandler = ({ request, url }) => handle(request, url);
export const POST: RequestHandler = ({ request, url }) => handle(request, url);
export const DELETE: RequestHandler = ({ request, url }) => handle(request, url);