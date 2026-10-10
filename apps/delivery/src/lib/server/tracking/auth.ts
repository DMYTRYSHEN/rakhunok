export type AuthConfig = {
	SUPABASE_URL?: string;
	SUPABASE_PUBLISHABLE_KEY?: string;
};

type AuthCode = 'AUTH_CONFIG' | 'AUTH_REQUIRED' | 'AUTH_INVALID' | 'AUTH_UNAVAILABLE';
type AuthDetail = 'transport' | 'timeout' | 'response_url' | 'response_status' | 'response_type' | 'response_size' | 'response_body' | 'response_json' | 'session' | 'identity';

const messages: Record<AuthCode, string> = {
	AUTH_CONFIG: 'Authentication is not configured.',
	AUTH_REQUIRED: 'Authentication is required.',
	AUTH_INVALID: 'Authentication is invalid.',
	AUTH_UNAVAILABLE: 'Authentication service is unavailable.'
};

export class AuthError extends Error {
	readonly status: 401 | 503;
	readonly code: AuthCode;
	readonly detail?: AuthDetail;

	constructor(code: AuthCode, detail?: AuthDetail) {
		super(messages[code]);
		this.name = 'AuthError';
		this.code = code;
		this.detail = detail;
		this.status = code === 'AUTH_CONFIG' || code === 'AUTH_UNAVAILABLE' ? 503 : 401;
	}
}

const MAX_TOKEN_LENGTH = 8192;
const MAX_RESPONSE_BYTES = 65536;
const TIMEOUT_MS = 5000;

function validToken(value: unknown): value is string {
	return typeof value === 'string' && value.length > 0 && value.length <= MAX_TOKEN_LENGTH &&
		/^[A-Za-z0-9._~+/-]+=*$/.test(value);
}

function settings(config: AuthConfig): { origin: string; key: string } {
	const raw = config?.SUPABASE_URL;
	const key = config?.SUPABASE_PUBLISHABLE_KEY;
	if (typeof raw !== 'string' || raw.length > 2048 || !/^https:\/\/[^/?#\\\s]+\/?$/.test(raw) ||
		typeof key !== 'string' || key.length > 1024 || !/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) {
		throw new AuthError('AUTH_CONFIG');
	}
	try {
		const url = new URL(raw);
		if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' ||
			url.search || url.hash || raw.includes('@')) throw new AuthError('AUTH_CONFIG');
		return { origin: url.origin, key };
	} catch {
		throw new AuthError('AUTH_CONFIG');
	}
}

export function tokenFromRequest(request: Request): string | null {
	const authorization = request.headers.get('authorization');
	if (authorization !== null) {
		if (authorization.length > MAX_TOKEN_LENGTH + 7) throw new AuthError('AUTH_INVALID');
		const match = /^Bearer ([^\s]+)$/i.exec(authorization);
		if (!match || !validToken(match[1])) throw new AuthError('AUTH_INVALID');
		return match[1];
	}
	const cookies = request.headers.get('cookie');
	if (cookies === null) return null;
	if (cookies.length > 16384) throw new AuthError('AUTH_INVALID');
	const matches = cookies.split(';').map(value => value.trim()).filter(value =>
		value === 'delivery_session' || value.startsWith('delivery_session='));
	if (matches.length === 0) return null;
	if (matches.length !== 1) throw new AuthError('AUTH_INVALID');
	try {
		const token = decodeURIComponent(matches[0].slice('delivery_session='.length));
		if (!validToken(token)) throw new AuthError('AUTH_INVALID');
		return token;
	} catch {
		throw new AuthError('AUTH_INVALID');
	}
}

function record(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function identity(value: unknown): { id: string } {
	if (!record(value)) throw new AuthError('AUTH_UNAVAILABLE', 'identity');
	if (value.is_anonymous === true) throw new AuthError('AUTH_INVALID');
	if (typeof value.id !== 'string' ||
		!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.id) ||
		(value.is_anonymous !== undefined && value.is_anonymous !== false)) {
		throw new AuthError('AUTH_UNAVAILABLE', 'identity');
	}
	return { id: value.id };
}

async function provider(
	configured: { origin: string; key: string },
	path: string,
	init: RequestInit,
	transport: typeof fetch,
	empty = false
): Promise<unknown> {
	const controller = new AbortController();
	let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
	let response: Response | undefined;
	let timer: ReturnType<typeof setTimeout> | undefined;
	let stage: AuthDetail = 'transport';
	const deadline = new Promise<never>((_resolve, reject) => {
		timer = setTimeout(() => {
			reject(new AuthError('AUTH_UNAVAILABLE', 'timeout'));
			controller.abort();
		}, TIMEOUT_MS);
	});
	const operation = async () => {
		response = await transport(`${configured.origin}/auth/v1/${path}`, {
			...init,
			headers: { apikey: configured.key, Accept: 'application/json', ...init.headers },
			redirect: 'manual',
			credentials: 'omit',
			cache: 'no-store',
			signal: controller.signal
		});
		if (controller.signal.aborted) {
			void response.body?.cancel().catch(() => {});
			throw new AuthError('AUTH_UNAVAILABLE', 'timeout');
		}
		if (response.redirected || (response.url && response.url !== `${configured.origin}/auth/v1/${path}`)) {
			throw new AuthError('AUTH_UNAVAILABLE', 'response_url');
		}
		if ([400, 401, 403, 422].includes(response.status)) throw new AuthError('AUTH_INVALID');
		if (response.status !== (empty ? 204 : 200)) throw new AuthError('AUTH_UNAVAILABLE', 'response_status');
		if (empty) return undefined;
		if (!/^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type') ?? '')) {
			throw new AuthError('AUTH_UNAVAILABLE', 'response_type');
		}
		const length = response.headers.get('content-length');
		if (length !== null && (!/^\d+$/.test(length) || Number(length) > MAX_RESPONSE_BYTES)) {
			throw new AuthError('AUTH_UNAVAILABLE', 'response_size');
		}
		if (!response.body) throw new AuthError('AUTH_UNAVAILABLE', 'response_body');
		stage = 'response_body';
		reader = response.body.getReader();
		const chunks: Uint8Array[] = [];
		let size = 0;
		while (true) {
			const chunk = await reader.read();
			if (chunk.done) break;
			size += chunk.value.byteLength;
			if (size > MAX_RESPONSE_BYTES) throw new AuthError('AUTH_UNAVAILABLE', 'response_size');
			chunks.push(chunk.value);
		}
		const bytes = new Uint8Array(size);
		let offset = 0;
		for (const chunk of chunks) {
			bytes.set(chunk, offset);
			offset += chunk.byteLength;
		}
		stage = 'response_json';
		return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as unknown;
	};
	try {
		return await Promise.race([operation(), deadline]);
	} catch (error) {
		throw error instanceof AuthError ? error : new AuthError('AUTH_UNAVAILABLE', stage);
	} finally {
		clearTimeout(timer);
		controller.abort();
		if (reader) void reader.cancel().catch(() => {});
		else if (response?.body) void response.body.cancel().catch(() => {});
	}
}

async function verifiedUser(
	request: Request,
	config: AuthConfig,
	transport: typeof fetch
): Promise<Record<string, unknown>> {
	const configured = settings(config);
	const token = tokenFromRequest(request);
	if (!token) throw new AuthError('AUTH_REQUIRED');
	const user = await provider(configured, 'user', {
		method: 'GET', headers: { Authorization: `Bearer ${token}` }
	}, transport);
	identity(user);
	return user as Record<string, unknown>;
}

export async function authenticate(
	request: Request,
	config: AuthConfig,
	transport: typeof fetch = fetch
): Promise<{ id: string }> {
	return identity(await verifiedUser(request, config, transport));
}

export async function authenticatedProfile(
	request: Request,
	config: AuthConfig,
	transport: typeof fetch = fetch
): Promise<{ id: string; displayName: string }> {
	const user = await verifiedUser(request, config, transport);
	const metadata = record(user.user_metadata) ? user.user_metadata : {};
	const displayName = [metadata.full_name, metadata.name].find(value =>
		typeof value === 'string' && value.trim().length > 0 && value.trim().length <= 200 &&
		!/[\u0000-\u001f\u007f]/.test(value));
	return { ...identity(user), displayName: typeof displayName === 'string' ? displayName.trim() : 'Користувач' };
}

export async function signIn(
	email: string,
	password: string,
	config: AuthConfig,
	transport: typeof fetch = fetch
): Promise<{ accessToken: string; expiresIn: number }> {
	const configured = settings(config);
	if (typeof email !== 'string' || email.length > 320 || !/^[^\s@]+@[^\s@]+$/.test(email) ||
		typeof password !== 'string' || password.length === 0 || password.length > 4096) {
		throw new AuthError('AUTH_INVALID');
	}
	const result = await provider(configured, 'token?grant_type=password', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ email, password })
	}, transport);
	if (!record(result) || !validToken(result.access_token) || result.token_type !== 'bearer' ||
		typeof result.expires_in !== 'number' || !Number.isSafeInteger(result.expires_in) ||
		result.expires_in <= 0 || result.expires_in > 604800) throw new AuthError('AUTH_UNAVAILABLE', 'session');
	identity(result.user);
	return { accessToken: result.access_token, expiresIn: result.expires_in };
}

export async function signInWithGoogle(
	idToken: string,
	nonce: string,
	config: AuthConfig,
	transport: typeof fetch = fetch
): Promise<{ accessToken: string; expiresIn: number }> {
	const configured = settings(config);
	if (!validToken(idToken) || typeof nonce !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(nonce)) {
		throw new AuthError('AUTH_INVALID');
	}
	const result = await provider(configured, 'token?grant_type=id_token', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ provider: 'google', id_token: idToken, nonce })
	}, transport);
	if (!record(result) || !validToken(result.access_token) || result.token_type !== 'bearer' ||
		typeof result.expires_in !== 'number' || !Number.isSafeInteger(result.expires_in) ||
		result.expires_in <= 0 || result.expires_in > 604800) throw new AuthError('AUTH_UNAVAILABLE', 'session');
	identity(result.user);
	return { accessToken: result.access_token, expiresIn: result.expires_in };
}

export async function signOut(
	token: string,
	config: AuthConfig,
	transport: typeof fetch = fetch
): Promise<void> {
	const configured = settings(config);
	if (!validToken(token)) throw new AuthError('AUTH_INVALID');
	await provider(configured, 'logout?scope=local', {
		method: 'POST', headers: { Authorization: `Bearer ${token}` }
	}, transport, true);
}