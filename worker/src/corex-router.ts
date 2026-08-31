function isCorexPath(pathname: string): boolean {
	return pathname === '/corex' || pathname.startsWith('/corex/');
}

function isCorexAsset(pathname: string): boolean {
	return pathname.startsWith('/_app/') || pathname === '/favicon.ico';
}

interface CorexRouterEnv {
	ASSETS: {
		fetch(request: Request): Promise<Response>;
	};
}

export interface CorexPublishCommand {
	accessToken: string;
	processId: string;
	expectedRevision: number;
}

export interface CorexStartCommand {
	accessToken: string;
	processId: string;
	input: unknown;
}

export interface CorexSignalCommand {
	accessToken: string;
	runId: string;
	type: string;
	payload: unknown;
}

export interface CorexControlPlane {
	publish(command: CorexPublishCommand): Promise<{ id: string; version: number }>;
	start(command: CorexStartCommand): Promise<{ id: string; workflowInstanceId: string; status: string }>;
	signal(command: CorexSignalCommand): Promise<{ accepted: true }>;
}

const PUBLISH_PATH = /^\/corex\/api\/processes\/([0-9a-f-]+)\/publish$/i;
const RUN_PATH = /^\/corex\/api\/processes\/([0-9a-f-]+)\/runs$/i;
const RUN_EVENT_PATH = /^\/corex\/api\/runs\/([0-9a-f-]+)\/events$/i;
const MAX_COMMAND_BYTES = 4 * 1024;
const MAX_RUN_COMMAND_BYTES = 64 * 1024;
const EVENT_TYPE = /^[A-Za-z_][A-Za-z0-9_-]{0,99}$/;

function jsonResponse(body: unknown, status: number): Response {
	return Response.json(body, {
		status,
		headers: { 'Cache-Control': 'no-store' }
	});
}

function readAccessToken(request: Request): string | undefined {
	const authorization = request.headers.get('Authorization');
	return authorization?.startsWith('Bearer ') && authorization.length > 7
		? authorization.slice(7)
		: undefined;
}

async function readCommandBody(request: Request, maxBytes: number): Promise<unknown> {
	const declaredLength = Number(request.headers.get('Content-Length') ?? 0);
	if (declaredLength > maxBytes) throw Object.assign(new Error(), { status: 413 });
	const rawBody = await request.text();
	if (new TextEncoder().encode(rawBody).byteLength > maxBytes) {
		throw Object.assign(new Error(), { status: 413 });
	}
	try {
		return JSON.parse(rawBody);
	} catch {
		throw Object.assign(new Error(), { status: 400 });
	}
}

async function routeCorexPublish(
	request: Request,
	processId: string,
	controlPlane?: CorexControlPlane
): Promise<Response> {
	if (request.method !== 'POST') {
		return new Response(null, { status: 405, headers: { Allow: 'POST', 'Cache-Control': 'no-store' } });
	}
	const accessToken = readAccessToken(request);
	if (!accessToken) return jsonResponse({ error: 'Authentication required.' }, 401);
	if (!controlPlane) return jsonResponse({ error: 'Corex control plane is unavailable.' }, 503);

	let body: unknown;
	try {
		body = await readCommandBody(request, MAX_COMMAND_BYTES);
	} catch (error) {
		const status = typeof error === 'object' && error !== null && 'status' in error ? Number(error.status) : 400;
		return jsonResponse({ error: status === 413 ? 'Request body is too large.' : 'A JSON request body is required.' }, status);
	}
	if (
		typeof body !== 'object' ||
		body === null ||
		Array.isArray(body) ||
		Object.keys(body).some((key) => key !== 'expectedRevision') ||
		!Number.isSafeInteger((body as { expectedRevision?: unknown }).expectedRevision) ||
		Number((body as { expectedRevision: number }).expectedRevision) < 1
	) {
		return jsonResponse({ error: 'Only a positive expectedRevision is accepted.' }, 400);
	}

	try {
		const published = await controlPlane.publish({
			accessToken,
			processId,
			expectedRevision: (body as { expectedRevision: number }).expectedRevision
		});
		return jsonResponse(published, 201);
	} catch (error) {
		const status = typeof error === 'object' && error !== null && 'status' in error ? Number(error.status) : 500;
		if (status === 401) return jsonResponse({ error: 'Authentication required.' }, 401);
		if (status === 409) return jsonResponse({ error: 'The draft revision changed.' }, 409);
		return jsonResponse({ error: 'Could not publish the process.' }, 502);
	}
}

async function routeCorexRun(
	request: Request,
	processId: string,
	controlPlane?: CorexControlPlane
): Promise<Response> {
	if (request.method !== 'POST') {
		return new Response(null, { status: 405, headers: { Allow: 'POST', 'Cache-Control': 'no-store' } });
	}
	const accessToken = readAccessToken(request);
	if (!accessToken) return jsonResponse({ error: 'Authentication required.' }, 401);
	if (!controlPlane) return jsonResponse({ error: 'Corex control plane is unavailable.' }, 503);

	let body: unknown;
	try {
		body = await readCommandBody(request, MAX_RUN_COMMAND_BYTES);
	} catch (error) {
		const status = typeof error === 'object' && error !== null && 'status' in error ? Number(error.status) : 400;
		return jsonResponse({ error: status === 413 ? 'Request body is too large.' : 'A JSON request body is required.' }, status);
	}
	if (
		typeof body !== 'object' ||
		body === null ||
		Array.isArray(body) ||
		Object.keys(body).some((key) => key !== 'input') ||
		!Object.hasOwn(body, 'input')
	) {
		return jsonResponse({ error: 'Only input is accepted.' }, 400);
	}

	try {
		const run = await controlPlane.start({
			accessToken,
			processId,
			input: (body as { input: unknown }).input
		});
		return jsonResponse(run, 202);
	} catch (error) {
		const status = typeof error === 'object' && error !== null && 'status' in error ? Number(error.status) : 500;
		if (status === 401) return jsonResponse({ error: 'Authentication required.' }, 401);
		if (status === 404) return jsonResponse({ error: 'Published process not found.' }, 404);
		if (status === 422) return jsonResponse({ error: 'Published process is not executable.' }, 422);
		if (status === 503) return jsonResponse({ error: 'Corex runtime is unavailable.' }, 503);
		return jsonResponse({ error: 'Could not start the process.' }, 502);
	}
}

async function routeCorexRunEvent(
	request: Request,
	runId: string,
	controlPlane?: CorexControlPlane
): Promise<Response> {
	if (request.method !== 'POST') {
		return new Response(null, { status: 405, headers: { Allow: 'POST', 'Cache-Control': 'no-store' } });
	}
	const accessToken = readAccessToken(request);
	if (!accessToken) return jsonResponse({ error: 'Authentication required.' }, 401);
	if (!controlPlane) return jsonResponse({ error: 'Corex control plane is unavailable.' }, 503);

	let body: unknown;
	try {
		body = await readCommandBody(request, MAX_RUN_COMMAND_BYTES);
	} catch (error) {
		const status = typeof error === 'object' && error !== null && 'status' in error ? Number(error.status) : 400;
		return jsonResponse({ error: status === 413 ? 'Request body is too large.' : 'A JSON request body is required.' }, status);
	}
	if (
		typeof body !== 'object' || body === null || Array.isArray(body) ||
		Object.keys(body).some((key) => key !== 'type' && key !== 'payload') ||
		!EVENT_TYPE.test(String((body as { type?: unknown }).type ?? '')) ||
		!Object.hasOwn(body, 'payload')
	) {
		return jsonResponse({ error: 'Only a valid event type and payload are accepted.' }, 400);
	}

	try {
		const result = await controlPlane.signal({
			accessToken,
			runId,
			type: (body as { type: string }).type,
			payload: (body as { payload: unknown }).payload
		});
		return jsonResponse(result, 202);
	} catch (error) {
		const status = typeof error === 'object' && error !== null && 'status' in error ? Number(error.status) : 500;
		if (status === 401) return jsonResponse({ error: 'Authentication required.' }, 401);
		if (status === 404) return jsonResponse({ error: 'Run not found.' }, 404);
		if (status === 409) return jsonResponse({ error: 'The run cannot accept events.' }, 409);
		if (status === 503) return jsonResponse({ error: 'Corex runtime is unavailable.' }, 503);
		return jsonResponse({ error: 'Could not send the event.' }, 502);
	}
}

export async function routeCorexRequest(
	request: Request,
	env: CorexRouterEnv,
	controlPlane?: CorexControlPlane
): Promise<Response> {
	const url = new URL(request.url);
	const publishMatch = PUBLISH_PATH.exec(url.pathname);
	if (publishMatch) return routeCorexPublish(request, publishMatch[1], controlPlane);
	const runMatch = RUN_PATH.exec(url.pathname);
	if (runMatch) return routeCorexRun(request, runMatch[1], controlPlane);
	const runEventMatch = RUN_EVENT_PATH.exec(url.pathname);
	if (runEventMatch) return routeCorexRunEvent(request, runEventMatch[1], controlPlane);

	if (isCorexPath(url.pathname)) {
		url.pathname = '/200';
		return env.ASSETS.fetch(new Request(url, request));
	}

	if (isCorexAsset(url.pathname)) return env.ASSETS.fetch(request);

	return new Response('Not Found', {
		status: 404,
		headers: {
			'Cache-Control': 'no-store',
			'Content-Type': 'text/plain; charset=utf-8',
			'X-Robots-Tag': 'noindex'
		}
	});
}
