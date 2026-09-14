import type { SupabaseClient, Session } from '@supabase/supabase-js';
import type { TelegramTransport } from './telegram-transport';
import { isTelegramInApp } from './telegram-environment';
import { hasTelegramIdentity, TELEGRAM_PROVIDER, telegramSessionAvailable, startTelegramSession } from './telegram-session';

export type TelegramSdk = {
	auth(options: { client_id: number; scope: string[]; nonce: string }, callback: (result: { id_token?: string; error?: string }) => void): void;
	close(): void;
};
export type TelegramConfig = { origin: string; enabled?: string; mode?: string; clientId?: string };
export type TelegramStatus = 'loading' | 'ready' | 'busy' | 'exchanging' | 'error' | 'external-required';
const scriptUrl = 'https://oauth.telegram.org/js/telegram-login.js';
// The official SDK owns a global popup/callback slot, shared across controllers.
const sdkOwners = new WeakSet<TelegramSdk>();

/** One SDK per document: it installs global listeners and offers no unload API. */
export function createTelegramSdkLoader(doc: Document, readSdk: () => TelegramSdk | undefined) {
	let pending: Promise<TelegramSdk> | undefined;
	return () => {
		const existing = readSdk();
		if (typeof existing?.auth === 'function' && typeof existing.close === 'function') return Promise.resolve(existing);
		if (pending) return pending;
		pending = new Promise<TelegramSdk>((resolve, reject) => {
			const script = doc.createElement('script');
			const cleanup = () => {
				clearTimeout(timer);
				script.onload = null;
				script.onerror = null;
			};
			const fail = () => {
				cleanup();
				script.remove();
				reject(new Error('Telegram SDK unavailable.'));
			};
			const timer = setTimeout(fail, 15_000);
			script.onload = () => {
				const sdk = readSdk();
				if (typeof sdk?.auth !== 'function' || typeof sdk.close !== 'function') return fail();
				cleanup();
				resolve(sdk);
			};
			script.onerror = fail;
			script.src = scriptUrl;
			script.async = true;
			doc.head.appendChild(script);
		});
		// A timed-out script may still execute: never inject a duplicate in this document.
		return pending;
	};
}

let browserLoader: ReturnType<typeof createTelegramSdkLoader> | undefined;
function loadSdk() {
	browserLoader ??= createTelegramSdkLoader(document, () =>
		(window as unknown as { Telegram?: { Login?: TelegramSdk } }).Telegram?.Login);
	return browserLoader();
}

export async function createTelegramNonce() {
	const raw = Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) => byte.toString(16).padStart(2, '0')).join('');
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
	return { raw, hashed: Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('') };
}

/** Preload SDK AND nonce before enabling the click; auth() then opens synchronously. */
export function createTelegramLogin(client: SupabaseClient, config: TelegramConfig, dependencies: {
	loadSdk: () => Promise<TelegramSdk>;
	createNonce: typeof createTelegramNonce;
	isInApp?: () => boolean;
} = {
	loadSdk,
	createNonce: createTelegramNonce
}, transport?: TelegramTransport) {
	let disposed = false;
	let revision = 0;
	let sdk: TelegramSdk | undefined;
	let nonce: Awaited<ReturnType<typeof createTelegramNonce>> | undefined;
	let preparing: Promise<void> | undefined;
	let active: { cancel: () => void } | undefined;
	let status: TelegramStatus = 'loading';
	const listeners = new Set<(status: TelegramStatus) => void>();
	const publish = (next: TelegramStatus) => {
		status = next;
		if (!disposed) listeners.forEach((listener) => listener(next));
	};
	const allowed = () => telegramSessionAvailable(config.origin, config.enabled)
		&& (config.mode === undefined || config.mode === 'direct' || config.mode === 'redirect');
	const inApp = dependencies.isInApp ?? isTelegramInApp;
	const { data: { subscription } } = client.auth.onAuthStateChange((event) => {
		if (event !== 'INITIAL_SESSION') {
			revision++;
			// No async Auth calls inside Supabase's event callback/lock.
			active?.cancel();
		}
	});
	function prepare(): Promise<void> {
		if (disposed) return Promise.resolve();
		if (active) return Promise.resolve();
		if (preparing) return preparing;
		publish('loading');
		preparing = Promise.resolve().then(async () => {
			try {
				if (!allowed()) throw new Error('Telegram disabled.');
				if (config.mode !== 'redirect') {
					// Public init() does not signal oauth_supported readiness. Do not
					// load/start native auth or guess readiness with a timer.
					if (inApp()) { publish('external-required'); return; }
					const id = Number(config.clientId);
					if (!config.clientId || !/^\d+$/.test(config.clientId) || !Number.isSafeInteger(id) || id <= 0) throw new Error('Invalid client ID.');
					const loaded = await Promise.all([dependencies.loadSdk(), dependencies.createNonce()]);
					if (disposed) return;
					if (inApp()) { publish('external-required'); return; }
					[sdk, nonce] = loaded;
				}
				publish('ready');
			} catch {
				publish('error');
			} finally {
				preparing = undefined;
			}
		});
		return preparing;
	}
	function validate(session: Session | null, mode: 'signin' | 'link', expectedUserId: string | null) {
		if ((session?.user.id ?? null) !== expectedUserId) throw new Error('Account changed.');
		if (mode === 'signin' && session) throw new Error('Use linking.');
		if (mode === 'link' && (!session?.user.email || session.user.is_anonymous || hasTelegramIdentity(session.user))) throw new Error('Account cannot be linked.');
	}
	function start(mode: 'signin' | 'link', expectedUserId: string | null): Promise<void> {
		if (disposed || active || status !== 'ready' || !allowed()) return Promise.reject(new Error('Telegram not ready.'));
		if ((mode === 'link') !== Boolean(expectedUserId)) return Promise.reject(new Error('Invalid account context.'));
		if (config.mode !== 'redirect') {
			if (inApp()) { publish('external-required'); return Promise.reject(new Error('Open in a system browser.')); }
			if (!sdk || sdkOwners.has(sdk)) return Promise.reject(new Error('Telegram already active.'));
			sdkOwners.add(sdk);
		}
		const capturedRevision = revision;
		const attemptNonce = nonce;
		nonce = undefined;
		publish('busy');
		let settled = false;
		let submitted = false;
		let callbackReceived = false;
		let timer: ReturnType<typeof setTimeout>;
		const current = () => !disposed && !settled && capturedRevision === revision;
		const close = () => { try { sdk?.close(); } catch { /* No provider error data exposed. */ } };
		const completion = new Promise<void>((resolve, reject) => {
			const fail = () => { if (!settled) { settled = true; close(); reject(new Error('Telegram authorization not completed.')); } };
			active = { cancel: () => { if (!submitted) fail(); } };
			timer = setTimeout(fail, 120_000);
			const checkSession = async () => {
				const result = await client.auth.getSession();
				if (!current() || result.error) throw new Error('Session changed.');
				validate(result.data.session, mode, expectedUserId);
				return result.data.session;
			};
			const exchange = async (token: string) => {
				const session = await checkSession();
				if (!current() || !attemptNonce) throw new Error('Attempt expired.');
				// No await between this fence and the SDK call. Supabase validates signature,
				// issuer, audience, expiry and SHA256(raw nonce), never SDK user claims.
				submitted = true;
				publish('exchanging');
				clearTimeout(timer);
				close();
				const credentials = { provider: TELEGRAM_PROVIDER, token, nonce: attemptNonce.raw };
				const unregister = transport?.register(attemptNonce.raw, {
					current,
					accessToken: mode === 'link' ? session?.access_token : undefined
				});
				try {
					const result = mode === 'link'
						? await client.auth.linkIdentity(credentials)
						: await client.auth.signInWithIdToken(credentials);
					if (result.error) throw new Error('Telegram exchange failed.');
				} finally { unregister?.(); }
				settled = true;
				resolve();
			};
			if (config.mode === 'redirect') {
				void checkSession().then(async () => {
					if (!current()) throw new Error('Attempt expired.');
					await startTelegramSession(client, mode, config.origin, config.enabled, current, expectedUserId);
					settled = true;
					resolve();
				}).catch(fail);
				return;
			}
			if (!sdk || !attemptNonce) return fail();
			// Deliberately NO await before auth(): preserves the browser user gesture.
			try {
				sdk.auth({ client_id: Number(config.clientId), scope: ['profile'], nonce: attemptNonce.hashed }, (result) => {
					if (!current() || callbackReceived) return;
					callbackReceived = true;
					if (!result || result.error || typeof result.id_token !== 'string' || !result.id_token.trim()) return fail();
					void exchange(result.id_token).catch(fail);
				});
				// Also catch account/identity changes before consent, without delaying popup.
				void checkSession().catch(fail);
			} catch { fail(); }
		});
		return completion.finally(() => {
			clearTimeout(timer);
			if (sdk) sdkOwners.delete(sdk);
			active = undefined;
			if (!disposed) void prepare();
		});
	}
	return {
		prepare,
		start,
		cancel: () => active?.cancel(),
		subscribe(listener: (status: TelegramStatus) => void) { listeners.add(listener); listener(status); return () => { listeners.delete(listener); }; },
		dispose() { disposed = true; revision++; active?.cancel(); nonce = undefined; subscription.unsubscribe(); listeners.clear(); }
	};
}