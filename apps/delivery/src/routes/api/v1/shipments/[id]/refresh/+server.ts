import { authenticate } from '#lib/server/tracking/auth.ts';
import { authConfig } from '#lib/server/tracking/config.ts';
import { trackingRuntime } from '#lib/server/tracking/runtime.ts';
import { createRefreshHandler } from '#lib/server/tracking/refresh-api.ts';
import type { RequestHandler } from './$types';

const handle = createRefreshHandler({
	authenticate: request => authenticate(request, authConfig()),
	refresh: (id, ownerId) => trackingRuntime().service.refresh(id, ownerId)
});

export const POST: RequestHandler = ({ request, url, params }) => handle(request, url, params.id);