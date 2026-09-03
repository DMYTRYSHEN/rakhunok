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
	COREX_OUTPUTS?: Pick<R2Bucket, 'get'>;
}

export interface CorexPublishCommand {
	accessToken: string;
	processId: string;
	expectedRevision: number;
	environmentId?: string;
	routeNamespace?: string;
}

export interface CorexConfigureDomainTargetCommand {
	accessToken: string;
	environmentKey: string;
	routeNamespace: string;
	hostname: string;
}

export type CorexDomainTarget = {
	environmentId: string;
	environmentKey: string;
	routeNamespace: string;
	domainTargetId: string;
	hostname: string;
	verificationStatus: 'pending' | 'verified' | 'failed';
};

export interface CorexDeactivateTriggerCommand {
	accessToken: string;
	processId: string;
	requestId: string;
	expectedVersion: number;
}

export interface CorexRollbackTriggerCommand extends CorexDeactivateTriggerCommand {
	targetVersion: number;
}

export type CorexTriggerLifecycleResult = {
	processId: string;
	version: number;
	active: boolean;
};

export type CorexLocationHint =
	'wnam' | 'enam' | 'sam' | 'weur' | 'eeur' | 'apac' | 'apac-ne' | 'apac-se' | 'oc' | 'afr' | 'me';

export interface CorexStartCommand {
	accessToken: string;
	processId: string;
	input: unknown;
	instanceId?: string;
	locationHint?: CorexLocationHint;
}

export interface CorexSignalCommand {
	accessToken: string;
	runId: string;
	eventId?: string;
	stepId?: string;
	type: string;
	payload: unknown;
}

export interface CorexCancelCommand {
	accessToken: string;
	runId: string;
	requestId: string;
}

export interface CorexLifecycleCommand extends CorexCancelCommand {
	action: 'pause' | 'resume';
}

export type CorexRestartFrom = {
	name: string;
	count?: number;
	type?: 'do' | 'sleep' | 'waitForEvent';
};

export interface CorexRestartCommand extends CorexCancelCommand {
	from?: CorexRestartFrom;
}

export type CorexRollbackCommand = CorexCancelCommand;
export type CorexArchiveCommand = CorexCancelCommand;

export interface CorexRetireProcessCommand {
	accessToken: string;
	processId: string;
	requestId: string;
}

export type CorexOperationKind = 'process_create' | 'run_terminate' | 'workflow_delete';

export type CorexOperationItem = {
	targetId: string;
	payload?: Record<string, unknown>;
};

export interface CorexSubmitOperationCommand {
	accessToken: string;
	requestId: string;
	kind: CorexOperationKind;
	items: CorexOperationItem[];
}

export interface CorexDeleteProcessCommand {
	accessToken: string;
	processId: string;
	requestId: string;
}

export interface CorexGetOperationCommand {
	accessToken: string;
	operationId: string;
}

export type CorexOperation = {
	id: string;
	kind: CorexOperationKind | 'process_delete';
	status: 'pending' | 'processing' | 'complete' | 'partial' | 'failed';
	itemCount: number;
	completedCount: number;
	failedCount: number;
	createdAt: string;
	startedAt: string | null;
	completedAt: string | null;
	items: Array<{
		targetId: string;
		status: 'pending' | 'processing' | 'complete' | 'failed';
		attempts: number;
		result: Record<string, unknown> | null;
		errorCode: string | null;
	}>;
};

export type CorexProcessRetirementResult = {
	id: string;
	lifecycle: 'retired';
	retiredAt: string;
	accepted: true;
};

export interface CorexStepAttemptOutputCommand {
	accessToken: string;
	runId: string;
	executionGeneration: number;
	stepId: string;
	visit: number;
	attempt: number;
}

export type CorexExternalOutputDescriptor = {
	key: string;
	bytes: number;
	contentType: 'application/json';
};

export interface CorexControlPlane {
	configureDomainTarget(command: CorexConfigureDomainTargetCommand): Promise<CorexDomainTarget>;
	publish(command: CorexPublishCommand): Promise<{ id: string; version: number }>;
	deactivateTrigger(command: CorexDeactivateTriggerCommand): Promise<CorexTriggerLifecycleResult>;
	rollbackTrigger(command: CorexRollbackTriggerCommand): Promise<CorexTriggerLifecycleResult>;
	start(
		command: CorexStartCommand
	): Promise<{ id: string; workflowInstanceId: string; status: string }>;
	signal(command: CorexSignalCommand): Promise<{ accepted: true }>;
	cancel(command: CorexCancelCommand): Promise<{ id: string; status: string; accepted: true }>;
	lifecycle(
		command: CorexLifecycleCommand
	): Promise<{ id: string; status: string; accepted: true }>;
	restart(
		command: CorexRestartCommand
	): Promise<{ id: string; status: string; executionGeneration: number; accepted: true }>;
	rollback(command: CorexRollbackCommand): Promise<{ id: string; status: string; accepted: true }>;
	archive(
		command: CorexArchiveCommand
	): Promise<{ id: string; status: string; archivedAt: string; accepted: true }>;
	retireProcess(command: CorexRetireProcessCommand): Promise<CorexProcessRetirementResult>;
	submitOperation(
		command: CorexSubmitOperationCommand
	): Promise<{ id: string; status: string; itemCount: number }>;
	deleteProcess(
		command: CorexDeleteProcessCommand
	): Promise<{ id: string; status: string; itemCount: number }>;
	getOperation(command: CorexGetOperationCommand): Promise<CorexOperation>;
	resolveStepAttemptOutput(
		command: CorexStepAttemptOutputCommand
	): Promise<CorexExternalOutputDescriptor>;
}

const PUBLISH_PATH = /^\/corex\/api\/processes\/([0-9a-f-]+)\/publish$/i;
const RETIRE_PROCESS_PATH = /^\/corex\/api\/processes\/([0-9a-f-]+)\/retire$/i;
const DELETE_PROCESS_PATH = /^\/corex\/api\/processes\/([0-9a-f-]+)\/delete$/i;
const OPERATIONS_PATH = '/corex/api/operations';
const OPERATION_PATH = /^\/corex\/api\/operations\/([0-9a-f-]+)$/i;
const DOMAIN_TARGET_PATH = '/corex/api/domain-target';
const DEACTIVATE_TRIGGER_PATH = /^\/corex\/api\/processes\/([0-9a-f-]+)\/trigger\/deactivate$/i;
const ROLLBACK_TRIGGER_PATH = /^\/corex\/api\/processes\/([0-9a-f-]+)\/trigger\/rollback$/i;
const RUN_PATH = /^\/corex\/api\/processes\/([0-9a-f-]+)\/runs$/i;
const RUN_EVENT_PATH = /^\/corex\/api\/runs\/([0-9a-f-]+)\/events$/i;
const RUN_CANCEL_PATH = /^\/corex\/api\/runs\/([0-9a-f-]+)\/cancel$/i;
const RUN_LIFECYCLE_PATH = /^\/corex\/api\/runs\/([0-9a-f-]+)\/(pause|resume)$/i;
const RUN_RESTART_PATH = /^\/corex\/api\/runs\/([0-9a-f-]+)\/restart$/i;
const RUN_ROLLBACK_PATH = /^\/corex\/api\/runs\/([0-9a-f-]+)\/rollback$/i;
const RUN_ARCHIVE_PATH = /^\/corex\/api\/runs\/([0-9a-f-]+)\/archive$/i;
const STEP_ATTEMPT_OUTPUT_PATH =
	/^\/corex\/api\/runs\/([0-9a-f-]+)\/attempts\/(\d+)\/([A-Za-z_][A-Za-z0-9_-]{0,99})\/(\d+)\/(\d+)\/output$/i;
const MAX_COMMAND_BYTES = 4 * 1024;
const MAX_RUN_COMMAND_BYTES = 64 * 1024;
const EVENT_TYPE = /^[A-Za-z_][A-Za-z0-9_-]{0,99}$/;
const STEP_ID = /^[A-Za-z_][A-Za-z0-9_-]{0,99}$/;
const ROUTE_NAMESPACE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const HOSTNAME = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const LOCATION_HINTS = new Set<CorexLocationHint>([
	'wnam',
	'enam',
	'sam',
	'weur',
	'eeur',
	'apac',
	'apac-ne',
	'apac-se',
	'oc',
	'afr',
	'me'
]);

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
		return new Response(null, {
			status: 405,
			headers: { Allow: 'POST', 'Cache-Control': 'no-store' }
		});
	}
	const accessToken = readAccessToken(request);
	if (!accessToken) return jsonResponse({ error: 'Authentication required.' }, 401);
	if (!controlPlane) return jsonResponse({ error: 'Corex control plane is unavailable.' }, 503);

	let body: unknown;
	try {
		body = await readCommandBody(request, MAX_COMMAND_BYTES);
	} catch (error) {
		const status =
			typeof error === 'object' && error !== null && 'status' in error ? Number(error.status) : 400;
		return jsonResponse(
			{ error: status === 413 ? 'Request body is too large.' : 'A JSON request body is required.' },
			status
		);
	}
	if (
		typeof body !== 'object' ||
		body === null ||
		Array.isArray(body) ||
		Object.keys(body).some(
			(key) => !['expectedRevision', 'environmentId', 'routeNamespace'].includes(key)
		) ||
		!Number.isSafeInteger((body as { expectedRevision?: unknown }).expectedRevision) ||
		Number((body as { expectedRevision: number }).expectedRevision) < 1 ||
		((body as { environmentId?: unknown }).environmentId !== undefined &&
			(typeof (body as { environmentId?: unknown }).environmentId !== 'string' ||
				!UUID.test((body as { environmentId: string }).environmentId))) ||
		((body as { routeNamespace?: unknown }).routeNamespace !== undefined &&
			(typeof (body as { routeNamespace?: unknown }).routeNamespace !== 'string' ||
				!ROUTE_NAMESPACE.test((body as { routeNamespace: string }).routeNamespace) ||
				(body as { routeNamespace: string }).routeNamespace.length > 63)) ||
		((body as { environmentId?: unknown }).environmentId === undefined) !==
			((body as { routeNamespace?: unknown }).routeNamespace === undefined)
	) {
		return jsonResponse({ error: 'The publish target is invalid.' }, 400);
	}
	const publishBody = body as {
		expectedRevision: number;
		environmentId?: string;
		routeNamespace?: string;
	};

	try {
		const published = await controlPlane.publish({
			accessToken,
			processId,
			expectedRevision: publishBody.expectedRevision,
			...(publishBody.environmentId
				? {
						environmentId: publishBody.environmentId,
						routeNamespace: publishBody.routeNamespace
					}
				: {})
		});
		return jsonResponse(published, 201);
	} catch (error) {
		const status =
			typeof error === 'object' && error !== null && 'status' in error ? Number(error.status) : 500;
		if (status === 401) return jsonResponse({ error: 'Authentication required.' }, 401);
		if (
			status === 409 &&
			typeof error === 'object' &&
			error !== null &&
			'code' in error &&
			error.code === 'route_conflict'
		) {
			return jsonResponse({ error: 'HTTP route is already in use.' }, 409);
		}
		if (status === 409) return jsonResponse({ error: 'The draft revision changed.' }, 409);
		return jsonResponse({ error: 'Could not publish the process.' }, 502);
	}
}

async function routeCorexDomainTarget(
	request: Request,
	controlPlane?: CorexControlPlane
): Promise<Response> {
	if (request.method !== 'POST') {
		return new Response(null, {
			status: 405,
			headers: { Allow: 'POST', 'Cache-Control': 'no-store' }
		});
	}
	const accessToken = readAccessToken(request);
	if (!accessToken) return jsonResponse({ error: 'Authentication required.' }, 401);
	if (!controlPlane) return jsonResponse({ error: 'Corex control plane is unavailable.' }, 503);

	let body: unknown;
	try {
		body = await readCommandBody(request, MAX_COMMAND_BYTES);
	} catch (error) {
		const status =
			typeof error === 'object' && error !== null && 'status' in error ? Number(error.status) : 400;
		return jsonResponse(
			{ error: status === 413 ? 'Request body is too large.' : 'A JSON request body is required.' },
			status
		);
	}
	if (typeof body !== 'object' || body === null || Array.isArray(body)) {
		return jsonResponse({ error: 'The domain target is invalid.' }, 400);
	}
	const target = body as Record<string, unknown>;
	const environmentKey =
		typeof target.environmentKey === 'string' ? target.environmentKey.trim().toLowerCase() : '';
	const routeNamespace =
		typeof target.routeNamespace === 'string' ? target.routeNamespace.trim().toLowerCase() : '';
	const hostname =
		typeof target.hostname === 'string'
			? target.hostname.trim().toLowerCase().replace(/\.$/, '')
			: '';
	if (
		Object.keys(target).some(
			(key) => !['environmentKey', 'routeNamespace', 'hostname'].includes(key)
		) ||
		!ROUTE_NAMESPACE.test(environmentKey) ||
		environmentKey.length > 63 ||
		!ROUTE_NAMESPACE.test(routeNamespace) ||
		routeNamespace.length > 63 ||
		!HOSTNAME.test(hostname) ||
		hostname.length > 253
	) {
		return jsonResponse({ error: 'The domain target is invalid.' }, 400);
	}

	try {
		return jsonResponse(
			await controlPlane.configureDomainTarget({
				accessToken,
				environmentKey,
				routeNamespace,
				hostname
			}),
			200
		);
	} catch (error) {
		const status =
			typeof error === 'object' && error !== null && 'status' in error ? Number(error.status) : 500;
		if (status === 401) return jsonResponse({ error: 'Authentication required.' }, 401);
		if (status === 403) return jsonResponse({ error: 'The domain is protected.' }, 403);
		if (status === 409) return jsonResponse({ error: 'The domain target conflicts.' }, 409);
		return jsonResponse({ error: 'Could not configure the domain target.' }, 502);
	}
}

async function routeCorexTriggerLifecycle(
	request: Request,
	processId: string,
	action: 'deactivate' | 'rollback',
	controlPlane?: CorexControlPlane
): Promise<Response> {
	if (request.method !== 'POST') {
		return new Response(null, {
			status: 405,
			headers: { Allow: 'POST', 'Cache-Control': 'no-store' }
		});
	}
	const accessToken = readAccessToken(request);
	if (!accessToken) return jsonResponse({ error: 'Authentication required.' }, 401);
	if (!controlPlane) return jsonResponse({ error: 'Corex control plane is unavailable.' }, 503);

	let body: unknown;
	try {
		body = await readCommandBody(request, MAX_COMMAND_BYTES);
	} catch (error) {
		const status =
			typeof error === 'object' && error !== null && 'status' in error ? Number(error.status) : 400;
		return jsonResponse(
			{ error: status === 413 ? 'Request body is too large.' : 'A JSON request body is required.' },
			status
		);
	}
	const allowedKeys =
		action === 'rollback'
			? ['requestId', 'expectedVersion', 'targetVersion']
			: ['requestId', 'expectedVersion'];
	if (
		typeof body !== 'object' ||
		body === null ||
		Array.isArray(body) ||
		Object.keys(body).some((key) => !allowedKeys.includes(key)) ||
		!UUID.test(String((body as { requestId?: unknown }).requestId ?? '')) ||
		!Number.isSafeInteger((body as { expectedVersion?: unknown }).expectedVersion) ||
		Number((body as { expectedVersion: number }).expectedVersion) < 1 ||
		(action === 'rollback' &&
			(!Number.isSafeInteger((body as { targetVersion?: unknown }).targetVersion) ||
				Number((body as { targetVersion: number }).targetVersion) < 1))
	) {
		return jsonResponse(
			{ error: 'Only a valid requestId and positive trigger versions are accepted.' },
			400
		);
	}

	try {
		const command = body as { requestId: string; expectedVersion: number; targetVersion?: number };
		const result =
			action === 'rollback'
				? await controlPlane.rollbackTrigger({
						accessToken,
						processId,
						requestId: command.requestId,
						expectedVersion: command.expectedVersion,
						targetVersion: command.targetVersion as number
					})
				: await controlPlane.deactivateTrigger({
						accessToken,
						processId,
						requestId: command.requestId,
						expectedVersion: command.expectedVersion
					});
		return jsonResponse(result, 200);
	} catch (error) {
		const status =
			typeof error === 'object' && error !== null && 'status' in error ? Number(error.status) : 500;
		if (status === 401) return jsonResponse({ error: 'Authentication required.' }, 401);
		if (status === 404) return jsonResponse({ error: 'Published trigger version not found.' }, 404);
		if (
			status === 409 &&
			typeof error === 'object' &&
			error !== null &&
			'code' in error &&
			error.code === 'route_conflict'
		) {
			return jsonResponse({ error: 'HTTP route is already in use.' }, 409);
		}
		if (status === 409)
			return jsonResponse({ error: 'The published trigger version changed.' }, 409);
		return jsonResponse({ error: `Could not ${action} the HTTP trigger.` }, 502);
	}
}

async function routeCorexRun(
	request: Request,
	processId: string,
	controlPlane?: CorexControlPlane
): Promise<Response> {
	if (request.method !== 'POST') {
		return new Response(null, {
			status: 405,
			headers: { Allow: 'POST', 'Cache-Control': 'no-store' }
		});
	}
	const accessToken = readAccessToken(request);
	if (!accessToken) return jsonResponse({ error: 'Authentication required.' }, 401);
	if (!controlPlane) return jsonResponse({ error: 'Corex control plane is unavailable.' }, 503);

	let body: unknown;
	try {
		body = await readCommandBody(request, MAX_RUN_COMMAND_BYTES);
	} catch (error) {
		const status =
			typeof error === 'object' && error !== null && 'status' in error ? Number(error.status) : 400;
		return jsonResponse(
			{ error: status === 413 ? 'Request body is too large.' : 'A JSON request body is required.' },
			status
		);
	}
	if (
		typeof body !== 'object' ||
		body === null ||
		Array.isArray(body) ||
		Object.keys(body).some((key) => !['input', 'instanceId', 'locationHint'].includes(key)) ||
		!Object.hasOwn(body, 'input')
	) {
		return jsonResponse({ error: 'Only input and supported instance options are accepted.' }, 400);
	}
	const startBody = body as { input: unknown; instanceId?: unknown; locationHint?: unknown };
	if (startBody.instanceId !== undefined && !UUID.test(String(startBody.instanceId))) {
		return jsonResponse({ error: 'Instance ID must be a UUID.' }, 400);
	}
	if (
		startBody.locationHint !== undefined &&
		(typeof startBody.locationHint !== 'string' ||
			!LOCATION_HINTS.has(startBody.locationHint as CorexLocationHint))
	) {
		return jsonResponse({ error: 'Location hint is not supported.' }, 400);
	}

	try {
		const run = await controlPlane.start({
			accessToken,
			processId,
			input: startBody.input,
			...(startBody.instanceId ? { instanceId: startBody.instanceId as string } : {}),
			...(startBody.locationHint
				? { locationHint: startBody.locationHint as CorexLocationHint }
				: {})
		});
		return jsonResponse(run, 202);
	} catch (error) {
		const status =
			typeof error === 'object' && error !== null && 'status' in error ? Number(error.status) : 500;
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
		return new Response(null, {
			status: 405,
			headers: { Allow: 'POST', 'Cache-Control': 'no-store' }
		});
	}
	const accessToken = readAccessToken(request);
	if (!accessToken) return jsonResponse({ error: 'Authentication required.' }, 401);
	if (!controlPlane) return jsonResponse({ error: 'Corex control plane is unavailable.' }, 503);

	let body: unknown;
	try {
		body = await readCommandBody(request, MAX_RUN_COMMAND_BYTES);
	} catch (error) {
		const status =
			typeof error === 'object' && error !== null && 'status' in error ? Number(error.status) : 400;
		return jsonResponse(
			{ error: status === 413 ? 'Request body is too large.' : 'A JSON request body is required.' },
			status
		);
	}
	if (
		typeof body !== 'object' ||
		body === null ||
		Array.isArray(body) ||
		Object.keys(body).some(
			(key) => key !== 'eventId' && key !== 'stepId' && key !== 'type' && key !== 'payload'
		) ||
		(Object.hasOwn(body, 'stepId') &&
			!STEP_ID.test(String((body as { stepId?: unknown }).stepId ?? ''))) ||
		!EVENT_TYPE.test(String((body as { type?: unknown }).type ?? '')) ||
		(String((body as { type?: unknown }).type ?? '')
			.toLowerCase()
			.startsWith('corex-') &&
			(body as { type?: unknown }).type !== 'corex-approval') ||
		((body as { type?: unknown }).type !== 'corex-approval' &&
			!UUID.test(String((body as { eventId?: unknown }).eventId ?? ''))) ||
		!Object.hasOwn(body, 'payload')
	) {
		return jsonResponse({ error: 'Only a valid event ID, type, and payload are accepted.' }, 400);
	}

	try {
		const result = await controlPlane.signal({
			accessToken,
			runId,
			...((body as { type: string }).type === 'corex-approval'
				? {}
				: {
						eventId: (body as { eventId: string }).eventId,
						...(Object.hasOwn(body, 'stepId')
							? { stepId: (body as { stepId: string }).stepId }
							: {})
					}),
			type: (body as { type: string }).type,
			payload: (body as { payload: unknown }).payload
		});
		return jsonResponse(result, 202);
	} catch (error) {
		const status =
			typeof error === 'object' && error !== null && 'status' in error ? Number(error.status) : 500;
		if (status === 401) return jsonResponse({ error: 'Authentication required.' }, 401);
		if (status === 404) return jsonResponse({ error: 'Run not found.' }, 404);
		if (status === 409) return jsonResponse({ error: 'The run cannot accept events.' }, 409);
		if (status === 503) return jsonResponse({ error: 'Corex runtime is unavailable.' }, 503);
		return jsonResponse({ error: 'Could not send the event.' }, 502);
	}
}

async function routeCorexRunCancel(
	request: Request,
	runId: string,
	controlPlane?: CorexControlPlane
): Promise<Response> {
	if (request.method !== 'POST') {
		return new Response(null, {
			status: 405,
			headers: { Allow: 'POST', 'Cache-Control': 'no-store' }
		});
	}
	const accessToken = readAccessToken(request);
	if (!accessToken) return jsonResponse({ error: 'Authentication required.' }, 401);
	if (!controlPlane) return jsonResponse({ error: 'Corex control plane is unavailable.' }, 503);

	let body: unknown;
	try {
		body = await readCommandBody(request, MAX_COMMAND_BYTES);
	} catch (error) {
		const status =
			typeof error === 'object' && error !== null && 'status' in error ? Number(error.status) : 400;
		return jsonResponse(
			{ error: status === 413 ? 'Request body is too large.' : 'A JSON request body is required.' },
			status
		);
	}
	if (
		typeof body !== 'object' ||
		body === null ||
		Array.isArray(body) ||
		Object.keys(body).some((key) => key !== 'requestId') ||
		!UUID.test(String((body as { requestId?: unknown }).requestId ?? ''))
	) {
		return jsonResponse({ error: 'Only a valid requestId is accepted.' }, 400);
	}

	try {
		const result = await controlPlane.cancel({
			accessToken,
			runId,
			requestId: (body as { requestId: string }).requestId
		});
		return jsonResponse(result, 202);
	} catch (error) {
		const status =
			typeof error === 'object' && error !== null && 'status' in error ? Number(error.status) : 500;
		if (status === 401) return jsonResponse({ error: 'Authentication required.' }, 401);
		if (status === 404) return jsonResponse({ error: 'Run not found.' }, 404);
		if (status === 409)
			return jsonResponse(
				{ error: 'Cancellation request conflicts with an existing command.' },
				409
			);
		return jsonResponse({ error: 'Could not cancel the run.' }, 502);
	}
}

async function routeCorexRunLifecycle(
	request: Request,
	runId: string,
	action: 'pause' | 'resume',
	controlPlane?: CorexControlPlane
): Promise<Response> {
	if (request.method !== 'POST') {
		return new Response(null, {
			status: 405,
			headers: { Allow: 'POST', 'Cache-Control': 'no-store' }
		});
	}
	const accessToken = readAccessToken(request);
	if (!accessToken) return jsonResponse({ error: 'Authentication required.' }, 401);
	if (!controlPlane) return jsonResponse({ error: 'Corex control plane is unavailable.' }, 503);

	let body: unknown;
	try {
		body = await readCommandBody(request, MAX_COMMAND_BYTES);
	} catch (error) {
		const status =
			typeof error === 'object' && error !== null && 'status' in error ? Number(error.status) : 400;
		return jsonResponse(
			{ error: status === 413 ? 'Request body is too large.' : 'A JSON request body is required.' },
			status
		);
	}
	if (
		typeof body !== 'object' ||
		body === null ||
		Array.isArray(body) ||
		Object.keys(body).some((key) => key !== 'requestId') ||
		!UUID.test(String((body as { requestId?: unknown }).requestId ?? ''))
	) {
		return jsonResponse({ error: 'Only a valid requestId is accepted.' }, 400);
	}

	try {
		const result = await controlPlane.lifecycle({
			accessToken,
			runId,
			requestId: (body as { requestId: string }).requestId,
			action
		});
		return jsonResponse(result, 202);
	} catch (error) {
		const status =
			typeof error === 'object' && error !== null && 'status' in error ? Number(error.status) : 500;
		if (status === 401) return jsonResponse({ error: 'Authentication required.' }, 401);
		if (status === 404) return jsonResponse({ error: 'Run not found.' }, 404);
		if (status === 409) return jsonResponse({ error: `The run cannot ${action}.` }, 409);
		return jsonResponse({ error: `Could not ${action} the run.` }, 502);
	}
}

function isRestartFrom(value: unknown): value is CorexRestartFrom {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
	const from = value as Record<string, unknown>;
	return (
		Object.keys(from).every((key) => ['name', 'count', 'type'].includes(key)) &&
		typeof from.name === 'string' &&
		from.name.length > 0 &&
		from.name.length <= 100 &&
		![...from.name].some((character) => {
			const codePoint = character.codePointAt(0) ?? 0;
			return codePoint <= 0x1f || codePoint === 0x7f;
		}) &&
		(!Object.hasOwn(from, 'count') ||
			(Number.isSafeInteger(from.count) && Number(from.count) > 0)) &&
		(!Object.hasOwn(from, 'type') || ['do', 'sleep', 'waitForEvent'].includes(String(from.type)))
	);
}

async function routeCorexRunRestart(
	request: Request,
	runId: string,
	controlPlane?: CorexControlPlane
): Promise<Response> {
	if (request.method !== 'POST') {
		return new Response(null, {
			status: 405,
			headers: { Allow: 'POST', 'Cache-Control': 'no-store' }
		});
	}
	const accessToken = readAccessToken(request);
	if (!accessToken) return jsonResponse({ error: 'Authentication required.' }, 401);
	if (!controlPlane) return jsonResponse({ error: 'Corex control plane is unavailable.' }, 503);

	let body: unknown;
	try {
		body = await readCommandBody(request, MAX_COMMAND_BYTES);
	} catch (error) {
		const status =
			typeof error === 'object' && error !== null && 'status' in error ? Number(error.status) : 400;
		return jsonResponse(
			{ error: status === 413 ? 'Request body is too large.' : 'A JSON request body is required.' },
			status
		);
	}
	if (
		typeof body !== 'object' ||
		body === null ||
		Array.isArray(body) ||
		Object.keys(body).some((key) => key !== 'requestId' && key !== 'from') ||
		!UUID.test(String((body as { requestId?: unknown }).requestId ?? '')) ||
		(Object.hasOwn(body, 'from') && !isRestartFrom((body as { from?: unknown }).from))
	) {
		return jsonResponse({ error: 'Only a valid requestId and restart step are accepted.' }, 400);
	}

	try {
		const command = body as { requestId: string; from?: CorexRestartFrom };
		const result = await controlPlane.restart({
			accessToken,
			runId,
			requestId: command.requestId,
			...(command.from ? { from: command.from } : {})
		});
		return jsonResponse(result, 202);
	} catch (error) {
		const status =
			typeof error === 'object' && error !== null && 'status' in error ? Number(error.status) : 500;
		if (status === 401) return jsonResponse({ error: 'Authentication required.' }, 401);
		if (status === 404) return jsonResponse({ error: 'Run not found.' }, 404);
		if (status === 409) return jsonResponse({ error: 'The run cannot restart.' }, 409);
		return jsonResponse({ error: 'Could not restart the run.' }, 502);
	}
}

async function routeCorexRunRollback(
	request: Request,
	runId: string,
	controlPlane?: CorexControlPlane
): Promise<Response> {
	if (request.method !== 'POST') {
		return new Response(null, {
			status: 405,
			headers: { Allow: 'POST', 'Cache-Control': 'no-store' }
		});
	}
	const accessToken = readAccessToken(request);
	if (!accessToken) return jsonResponse({ error: 'Authentication required.' }, 401);
	if (!controlPlane) return jsonResponse({ error: 'Corex control plane is unavailable.' }, 503);

	let body: unknown;
	try {
		body = await readCommandBody(request, MAX_COMMAND_BYTES);
	} catch (error) {
		const status =
			typeof error === 'object' && error !== null && 'status' in error ? Number(error.status) : 400;
		return jsonResponse(
			{ error: status === 413 ? 'Request body is too large.' : 'A JSON request body is required.' },
			status
		);
	}
	if (
		typeof body !== 'object' ||
		body === null ||
		Array.isArray(body) ||
		Object.keys(body).some((key) => key !== 'requestId') ||
		!UUID.test(String((body as { requestId?: unknown }).requestId ?? ''))
	) {
		return jsonResponse({ error: 'Only a valid requestId is accepted.' }, 400);
	}

	try {
		const result = await controlPlane.rollback({
			accessToken,
			runId,
			requestId: (body as { requestId: string }).requestId
		});
		return jsonResponse(result, 202);
	} catch (error) {
		const status =
			typeof error === 'object' && error !== null && 'status' in error ? Number(error.status) : 500;
		if (status === 401) return jsonResponse({ error: 'Authentication required.' }, 401);
		if (status === 404) return jsonResponse({ error: 'Run not found.' }, 404);
		if (status === 409) return jsonResponse({ error: 'The run cannot roll back.' }, 409);
		return jsonResponse({ error: 'Could not roll back the run.' }, 502);
	}
}

async function routeCorexRunArchive(
	request: Request,
	runId: string,
	controlPlane?: CorexControlPlane
): Promise<Response> {
	if (request.method !== 'POST') {
		return new Response(null, {
			status: 405,
			headers: { Allow: 'POST', 'Cache-Control': 'no-store' }
		});
	}
	const accessToken = readAccessToken(request);
	if (!accessToken) return jsonResponse({ error: 'Authentication required.' }, 401);
	if (!controlPlane) return jsonResponse({ error: 'Corex control plane is unavailable.' }, 503);

	let body: unknown;
	try {
		body = await readCommandBody(request, MAX_COMMAND_BYTES);
	} catch (error) {
		const status =
			typeof error === 'object' && error !== null && 'status' in error ? Number(error.status) : 400;
		return jsonResponse(
			{ error: status === 413 ? 'Request body is too large.' : 'A JSON request body is required.' },
			status
		);
	}
	if (
		typeof body !== 'object' ||
		body === null ||
		Array.isArray(body) ||
		Object.keys(body).some((key) => key !== 'requestId') ||
		!UUID.test(String((body as { requestId?: unknown }).requestId ?? ''))
	) {
		return jsonResponse({ error: 'Only a valid requestId is accepted.' }, 400);
	}

	try {
		const result = await controlPlane.archive({
			accessToken,
			runId,
			requestId: (body as { requestId: string }).requestId
		});
		return jsonResponse(result, 202);
	} catch (error) {
		const status =
			typeof error === 'object' && error !== null && 'status' in error ? Number(error.status) : 500;
		if (status === 401) return jsonResponse({ error: 'Authentication required.' }, 401);
		if (status === 404) return jsonResponse({ error: 'Run not found.' }, 404);
		if (status === 409) return jsonResponse({ error: 'The run cannot be archived.' }, 409);
		return jsonResponse({ error: 'Could not archive the run.' }, 502);
	}
}

async function routeCorexProcessRetirement(
	request: Request,
	processId: string,
	controlPlane?: CorexControlPlane
): Promise<Response> {
	if (request.method !== 'POST') {
		return new Response(null, {
			status: 405,
			headers: { Allow: 'POST', 'Cache-Control': 'no-store' }
		});
	}
	const accessToken = readAccessToken(request);
	if (!accessToken) return jsonResponse({ error: 'Authentication required.' }, 401);
	if (!controlPlane) return jsonResponse({ error: 'Corex control plane is unavailable.' }, 503);

	let body: unknown;
	try {
		body = await readCommandBody(request, MAX_COMMAND_BYTES);
	} catch (error) {
		const status =
			typeof error === 'object' && error !== null && 'status' in error ? Number(error.status) : 400;
		return jsonResponse(
			{ error: status === 413 ? 'Request body is too large.' : 'A JSON request body is required.' },
			status
		);
	}
	if (
		typeof body !== 'object' ||
		body === null ||
		Array.isArray(body) ||
		Object.keys(body).some((key) => key !== 'requestId') ||
		!UUID.test(String((body as { requestId?: unknown }).requestId ?? ''))
	) {
		return jsonResponse({ error: 'Only a valid requestId is accepted.' }, 400);
	}

	try {
		const result = await controlPlane.retireProcess({
			accessToken,
			processId,
			requestId: (body as { requestId: string }).requestId
		});
		return jsonResponse(result, 202);
	} catch (error) {
		const status =
			typeof error === 'object' && error !== null && 'status' in error ? Number(error.status) : 500;
		if (status === 401) return jsonResponse({ error: 'Authentication required.' }, 401);
		if (status === 404) return jsonResponse({ error: 'Process not found.' }, 404);
		if (status === 409) return jsonResponse({ error: 'The process cannot be retired.' }, 409);
		return jsonResponse({ error: 'Could not retire the process.' }, 502);
	}
}

function operationError(error: unknown, fallback: string): Response {
	const status =
		typeof error === 'object' && error !== null && 'status' in error ? Number(error.status) : 500;
	if (status === 401) return jsonResponse({ error: 'Authentication required.' }, 401);
	if (status === 403) return jsonResponse({ error: 'Elevated authorization required.' }, 403);
	if (status === 404) return jsonResponse({ error: 'Operation target not found.' }, 404);
	if (status === 409)
		return jsonResponse({ error: 'The operation conflicts with current state.' }, 409);
	if (status === 422)
		return jsonResponse({ error: 'The operation target is not executable.' }, 422);
	if (status === 423) return jsonResponse({ error: 'The process is under legal hold.' }, 423);
	return jsonResponse({ error: fallback }, 502);
}

async function routeCorexOperations(
	request: Request,
	controlPlane?: CorexControlPlane
): Promise<Response> {
	if (request.method !== 'POST') {
		return new Response(null, {
			status: 405,
			headers: { Allow: 'POST', 'Cache-Control': 'no-store' }
		});
	}
	const accessToken = readAccessToken(request);
	if (!accessToken) return jsonResponse({ error: 'Authentication required.' }, 401);
	if (!controlPlane) return jsonResponse({ error: 'Corex control plane is unavailable.' }, 503);

	let body: unknown;
	try {
		body = await readCommandBody(request, MAX_RUN_COMMAND_BYTES);
	} catch (error) {
		const status =
			typeof error === 'object' && error !== null && 'status' in error ? Number(error.status) : 400;
		return jsonResponse(
			{ error: status === 413 ? 'Request body is too large.' : 'A JSON request body is required.' },
			status
		);
	}
	if (typeof body !== 'object' || body === null || Array.isArray(body)) {
		return jsonResponse({ error: 'Invalid operation command.' }, 400);
	}
	const command = body as Record<string, unknown>;
	const items = command.items;
	if (
		Object.keys(command).some((key) => !['requestId', 'kind', 'items'].includes(key)) ||
		!UUID.test(String(command.requestId ?? '')) ||
		!['process_create', 'run_terminate', 'workflow_delete'].includes(String(command.kind)) ||
		!Array.isArray(items) ||
		items.length < 1 ||
		items.length > 100 ||
		items.some((item) => {
			if (typeof item !== 'object' || item === null || Array.isArray(item)) return true;
			const candidate = item as Record<string, unknown>;
			if (Object.keys(candidate).some((key) => !['targetId', 'payload'].includes(key))) return true;
			if (typeof candidate.targetId !== 'string' || !UUID.test(candidate.targetId)) return true;
			return (
				candidate.payload !== undefined &&
				(typeof candidate.payload !== 'object' ||
					candidate.payload === null ||
					Array.isArray(candidate.payload))
			);
		}) ||
		new Set(items.map((item) => (item as { targetId: string }).targetId)).size !== items.length
	) {
		return jsonResponse({ error: 'Invalid operation command.' }, 400);
	}
	if (
		command.kind === 'process_create' &&
		items.some((item) => {
			const payload = (item as { payload?: Record<string, unknown> }).payload ?? {};
			return (
				Object.keys(payload).some((key) => !['processId', 'input', 'locationHint'].includes(key)) ||
				!UUID.test(String(payload.processId ?? '')) ||
				(payload.locationHint !== undefined &&
					!LOCATION_HINTS.has(payload.locationHint as CorexLocationHint))
			);
		})
	) {
		return jsonResponse({ error: 'Invalid operation command.' }, 400);
	}

	try {
		const result = await controlPlane.submitOperation({
			accessToken,
			requestId: command.requestId as string,
			kind: command.kind as CorexOperationKind,
			items: items as CorexOperationItem[]
		});
		return jsonResponse(result, 202);
	} catch (error) {
		return operationError(error, 'Could not submit the operation.');
	}
}

async function routeCorexOperation(
	request: Request,
	operationId: string,
	controlPlane?: CorexControlPlane
): Promise<Response> {
	if (request.method !== 'GET') {
		return new Response(null, {
			status: 405,
			headers: { Allow: 'GET', 'Cache-Control': 'no-store' }
		});
	}
	const accessToken = readAccessToken(request);
	if (!accessToken) return jsonResponse({ error: 'Authentication required.' }, 401);
	if (!controlPlane) return jsonResponse({ error: 'Corex control plane is unavailable.' }, 503);
	try {
		return jsonResponse(await controlPlane.getOperation({ accessToken, operationId }), 200);
	} catch (error) {
		return operationError(error, 'Could not load the operation.');
	}
}

async function routeCorexProcessDeletion(
	request: Request,
	processId: string,
	controlPlane?: CorexControlPlane
): Promise<Response> {
	if (request.method !== 'POST') {
		return new Response(null, {
			status: 405,
			headers: { Allow: 'POST', 'Cache-Control': 'no-store' }
		});
	}
	const accessToken = readAccessToken(request);
	if (!accessToken) return jsonResponse({ error: 'Authentication required.' }, 401);
	if (!controlPlane) return jsonResponse({ error: 'Corex control plane is unavailable.' }, 503);
	let body: unknown;
	try {
		body = await readCommandBody(request, MAX_COMMAND_BYTES);
	} catch {
		return jsonResponse({ error: 'A JSON request body is required.' }, 400);
	}
	if (
		typeof body !== 'object' ||
		body === null ||
		Array.isArray(body) ||
		Object.keys(body).some((key) => key !== 'requestId') ||
		!UUID.test(String((body as { requestId?: unknown }).requestId ?? ''))
	) {
		return jsonResponse({ error: 'Only a valid requestId is accepted.' }, 400);
	}
	try {
		const result = await controlPlane.deleteProcess({
			accessToken,
			processId,
			requestId: (body as { requestId: string }).requestId
		});
		return jsonResponse(result, 202);
	} catch (error) {
		return operationError(error, 'Could not submit process deletion.');
	}
}

async function routeCorexStepAttemptOutput(
	request: Request,
	identity: {
		runId: string;
		executionGeneration: number;
		stepId: string;
		visit: number;
		attempt: number;
	},
	env: CorexRouterEnv,
	controlPlane?: CorexControlPlane
): Promise<Response> {
	if (request.method !== 'GET') {
		return new Response(null, {
			status: 405,
			headers: { Allow: 'GET', 'Cache-Control': 'no-store' }
		});
	}
	const accessToken = readAccessToken(request);
	if (!accessToken) return jsonResponse({ error: 'Authentication required.' }, 401);
	if (!controlPlane) return jsonResponse({ error: 'Corex control plane is unavailable.' }, 503);
	if (!env.COREX_OUTPUTS)
		return jsonResponse({ error: 'Step output storage is unavailable.' }, 503);

	try {
		const descriptor = await controlPlane.resolveStepAttemptOutput({ accessToken, ...identity });
		const object = await env.COREX_OUTPUTS.get(descriptor.key);
		if (!object) return jsonResponse({ error: 'Step output not found.' }, 404);
		return new Response(object.body, {
			headers: {
				'Cache-Control': 'private, no-store',
				'Content-Length': String(descriptor.bytes),
				'Content-Type': descriptor.contentType,
				'X-Content-Type-Options': 'nosniff'
			}
		});
	} catch (error) {
		const status =
			typeof error === 'object' && error !== null && 'status' in error ? Number(error.status) : 500;
		if (status === 401) return jsonResponse({ error: 'Authentication required.' }, 401);
		if (status === 404) return jsonResponse({ error: 'Step output not found.' }, 404);
		return jsonResponse({ error: 'Could not load the step output.' }, 502);
	}
}

export async function routeCorexRequest(
	request: Request,
	env: CorexRouterEnv,
	controlPlane?: CorexControlPlane
): Promise<Response> {
	const url = new URL(request.url);
	if (url.pathname === DOMAIN_TARGET_PATH) return routeCorexDomainTarget(request, controlPlane);
	if (url.pathname === OPERATIONS_PATH) return routeCorexOperations(request, controlPlane);
	const operationMatch = OPERATION_PATH.exec(url.pathname);
	if (operationMatch) return routeCorexOperation(request, operationMatch[1], controlPlane);
	const publishMatch = PUBLISH_PATH.exec(url.pathname);
	if (publishMatch) return routeCorexPublish(request, publishMatch[1], controlPlane);
	const retireProcessMatch = RETIRE_PROCESS_PATH.exec(url.pathname);
	if (retireProcessMatch)
		return routeCorexProcessRetirement(request, retireProcessMatch[1], controlPlane);
	const deleteProcessMatch = DELETE_PROCESS_PATH.exec(url.pathname);
	if (deleteProcessMatch)
		return routeCorexProcessDeletion(request, deleteProcessMatch[1], controlPlane);
	const deactivateTriggerMatch = DEACTIVATE_TRIGGER_PATH.exec(url.pathname);
	if (deactivateTriggerMatch)
		return routeCorexTriggerLifecycle(
			request,
			deactivateTriggerMatch[1],
			'deactivate',
			controlPlane
		);
	const rollbackTriggerMatch = ROLLBACK_TRIGGER_PATH.exec(url.pathname);
	if (rollbackTriggerMatch)
		return routeCorexTriggerLifecycle(request, rollbackTriggerMatch[1], 'rollback', controlPlane);
	const runMatch = RUN_PATH.exec(url.pathname);
	if (runMatch) return routeCorexRun(request, runMatch[1], controlPlane);
	const runEventMatch = RUN_EVENT_PATH.exec(url.pathname);
	if (runEventMatch) return routeCorexRunEvent(request, runEventMatch[1], controlPlane);
	const runCancelMatch = RUN_CANCEL_PATH.exec(url.pathname);
	if (runCancelMatch) return routeCorexRunCancel(request, runCancelMatch[1], controlPlane);
	const runLifecycleMatch = RUN_LIFECYCLE_PATH.exec(url.pathname);
	if (runLifecycleMatch)
		return routeCorexRunLifecycle(
			request,
			runLifecycleMatch[1],
			runLifecycleMatch[2].toLowerCase() as 'pause' | 'resume',
			controlPlane
		);
	const runRestartMatch = RUN_RESTART_PATH.exec(url.pathname);
	if (runRestartMatch) return routeCorexRunRestart(request, runRestartMatch[1], controlPlane);
	const runRollbackMatch = RUN_ROLLBACK_PATH.exec(url.pathname);
	if (runRollbackMatch) return routeCorexRunRollback(request, runRollbackMatch[1], controlPlane);
	const runArchiveMatch = RUN_ARCHIVE_PATH.exec(url.pathname);
	if (runArchiveMatch) return routeCorexRunArchive(request, runArchiveMatch[1], controlPlane);
	const outputMatch = STEP_ATTEMPT_OUTPUT_PATH.exec(url.pathname);
	if (outputMatch) {
		const coordinates = outputMatch
			.slice(2)
			.filter((_, index) => index !== 1)
			.map(Number);
		if (coordinates.some((value) => !Number.isSafeInteger(value) || value < 1)) {
			return jsonResponse({ error: 'Invalid step attempt identity.' }, 400);
		}
		return routeCorexStepAttemptOutput(
			request,
			{
				runId: outputMatch[1],
				executionGeneration: coordinates[0],
				stepId: outputMatch[3],
				visit: coordinates[1],
				attempt: coordinates[2]
			},
			env,
			controlPlane
		);
	}

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
