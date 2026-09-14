import { MAX_INIT_DATA_BYTES, TelegramProofError, verifyTelegramInitData } from './telegram-auth-verifier.ts';

export type LocalTelegramAuthEnv = Readonly<{
	TELEGRAM_AUTH_LOCAL_ENABLED?: string;
	TELEGRAM_AUTH_BOT_ID?: string;
	TELEGRAM_AUTH_BOT_TOKEN?: string;
}>;

function json(status: number, error: string): Response {
	return Response.json({ ok: false, error }, {
		status,
		headers: { 'Cache-Control': 'no-store', Pragma: 'no-cache', 'X-Content-Type-Options': 'nosniff' }
	});
}

/** Unwired local harness. Deliberately has no deploy config, session bridge or Supabase dependency. */
export async function handleLocalTelegramAuth(request: Request, env: LocalTelegramAuthEnv): Promise<Response> {
	const url = new URL(request.url);
	if (url.protocol !== 'http:' || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
		url.pathname !== '/app/api/auth/telegram' || url.search ||
		env.TELEGRAM_AUTH_LOCAL_ENABLED !== 'true') return json(404, 'not_found');
	if (request.method !== 'POST') return json(405, 'method_not_allowed');
	if (request.headers.get('Origin') !== url.origin) return json(403, 'origin_rejected');
	if (request.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase() !== 'text/plain') {
		return json(415, 'unsupported_media_type');
	}
	if (!env.TELEGRAM_AUTH_BOT_ID || !env.TELEGRAM_AUTH_BOT_TOKEN) return json(503, 'verification_unavailable');
	// Read incrementally, bounded even when Content-Length is missing or forged.
	let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
	try { reader = request.body?.getReader(); }
	catch { return json(400, 'invalid_request'); }
	if (!reader) return json(400, 'invalid_request');
	const bytes = new Uint8Array(MAX_INIT_DATA_BYTES);
	let size = 0;
	let chunks = 0;
	let timedOut = false;
	const deadline = Date.now() + 2000;
	const timer = setTimeout(() => {
		timedOut = true;
		void reader.cancel().catch(() => undefined);
	}, 2000);
	try {
		while (true) {
			const { value, done } = await reader.read();
			if (timedOut || Date.now() >= deadline) return json(408, 'request_timeout');
			if (done) break;
			if (++chunks > 16384) {
				void reader.cancel().catch(() => undefined);
				return json(400, 'invalid_request');
			}
			size += value.byteLength;
			if (size > MAX_INIT_DATA_BYTES) {
				void reader.cancel().catch(() => undefined);
				return json(413, 'payload_too_large');
			}
			bytes.set(value, size - value.byteLength);
		}
		let raw: string;
		try { raw = new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(0, size)); }
		catch { return json(400, 'invalid_request'); }
		await verifyTelegramInitData(raw, { botId: env.TELEGRAM_AUTH_BOT_ID, botToken: env.TELEGRAM_AUTH_BOT_TOKEN });
		// A valid Telegram identity MUST NOT become an authenticated App user here.
		return json(503, 'session_bridge_not_configured');
	} catch (error) {
		return error instanceof TelegramProofError ? json(401, 'invalid_telegram_proof') : json(503, 'verification_unavailable');
	} finally {
		clearTimeout(timer);
		reader.releaseLock();
	}
}