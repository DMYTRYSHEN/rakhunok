import { hashToken } from '@tma.js/init-data-node/web';

export const MAX_INIT_DATA_BYTES = 8192;
export const TELEGRAM_AUTH_MAX_AGE_SECONDS = 300;
const FUTURE_SKEW_SECONDS = 30;
const encoder = new TextEncoder();

/** Identity proof only: never a Supabase session or authorization decision. */
export type VerifiedTelegramProof = Readonly<{
	provider: 'telegram-mini-app';
	telegramUserId: string;
	botId: string;
	authDate: number;
	expiresAt: number;
}>;

export class TelegramProofError extends Error {
	constructor() {
		super('Invalid Telegram proof');
		this.name = 'TelegramProofError';
	}
}

function invalid(): never {
	throw new TelegramProofError();
}

function parseStrict(raw: string): Map<string, string> {
	if (!raw || raw.length > MAX_INIT_DATA_BYTES || encoder.encode(raw).length > MAX_INIT_DATA_BYTES) invalid();
	const fields = new Map<string, string>();
	for (const pair of raw.split('&')) {
		const separator = pair.indexOf('=');
		if (separator < 1 || fields.size >= 32) invalid();
		let key: string;
		let value: string;
		try {
			key = decodeURIComponent(pair.slice(0, separator).replace(/\+/g, ' '));
			value = decodeURIComponent(pair.slice(separator + 1).replace(/\+/g, ' '));
		} catch {
			invalid();
		}
		// Reject ambiguous canonical strings, including encoded duplicate names.
		if (!/^[a-z][a-z0-9_]*$/.test(key) || fields.has(key) || /[\r\n\0]/.test(value)) invalid();
		fields.set(key, value);
	}
	return fields;
}

/** Server-only. No I/O, persistence, account lookup, replay consumption, or session issuance. */
export async function verifyTelegramInitData(
	raw: string,
	config: Readonly<{ botId: string; botToken: string }>,
	nowSeconds = Math.floor(Date.now() / 1000)
): Promise<VerifiedTelegramProof> {
	if (!/^[1-9]\d*$/.test(config.botId) || !Number.isSafeInteger(Number(config.botId)) ||
		!config.botToken.startsWith(`${config.botId}:`) || config.botToken.length <= config.botId.length + 1 ||
		!Number.isSafeInteger(nowSeconds) || nowSeconds <= 0) invalid();
	const fields = parseStrict(raw);
	const hash = fields.get('hash') ?? '';
	const date = fields.get('auth_date') ?? '';
	if (!/^[0-9a-f]{64}$/.test(hash) || !/^[1-9]\d*$/.test(date)) invalid();
	const authDate = Number(date);
	if (!Number.isSafeInteger(authDate) || authDate > nowSeconds + FUTURE_SKEW_SECONDS ||
		nowSeconds >= authDate + TELEGRAM_AUTH_MAX_AGE_SECONDS) invalid();
	// HMAC excludes only hash. Telegram's optional signature remains signed data.
	const checkString = [...fields.entries()]
		.filter(([key]) => key !== 'hash')
		.sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
		.map(([key, value]) => `${key}=${value}`).join('\n');
	const secret = await hashToken(config.botToken);
	const key = await crypto.subtle.importKey('raw', secret, { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
	const signature = Uint8Array.from(hash.match(/../g)!, (byte) => Number.parseInt(byte, 16));
	// WebCrypto verify instead of the library's ordinary string-equality comparison.
	if (!await crypto.subtle.verify('HMAC', key, signature, encoder.encode(checkString))) invalid();
	let user: unknown;
	try { user = JSON.parse(fields.get('user') ?? ''); } catch { invalid(); }
	if (!user || typeof user !== 'object' || Array.isArray(user)) invalid();
	const candidate = user as Record<string, unknown>;
	if (typeof candidate.id !== 'number' || !Number.isSafeInteger(candidate.id) || candidate.id <= 0 ||
		(candidate.is_bot !== undefined && candidate.is_bot !== false)) invalid();
	return Object.freeze({
		provider: 'telegram-mini-app', telegramUserId: String(candidate.id), botId: config.botId,
		authDate, expiresAt: authDate + TELEGRAM_AUTH_MAX_AGE_SECONDS
	});
}