import { TELEGRAM_PROVIDER } from './telegram-session';

type Fence = { current: () => boolean; accessToken?: string };
export type SessionStorage = {
	getItem(key: string): string | null;
	setItem(key: string, value: string): void;
	removeItem(key: string): void;
};
type Attempt = { fence: Fence; active: boolean; dispatched: boolean; baseline: string | null; token?: string };

/** Uses a synchronous storage boundary: no await between final check and write. */
export function createTelegramTransport(url: string, fetcher: typeof fetch = fetch, persistence?: {
	storage: SessionStorage; key: string;
}) {
	const endpoint = new URL('auth/v1/token', `${url.replace(/\/$/, '')}/`);
	const attempts = new Map<string, Attempt>();
	const commits = new Map<string, Attempt>();
	const expired = () => new Error('Telegram account context expired.');
	const check = (attempt: Attempt) => {
		if (!attempt.active || !attempt.fence.current()
			|| (persistence && persistence.storage.getItem(persistence.key) !== attempt.baseline)) throw expired();
	};
	const storage: SessionStorage | undefined = persistence && {
		getItem: (key) => persistence.storage.getItem(key),
		removeItem: (key) => persistence.storage.removeItem(key),
		setItem(key, value) {
			// auth-js clones sessions before serializing; object identity cannot scope a write.
			// Match only the access token consumed from this Telegram response, not a global flag.
			const token = key === persistence.key ? JSON.parse(value)?.access_token : undefined;
			const attempt = typeof token === 'string' ? commits.get(token) : undefined;
			if (attempt) check(attempt);
			persistence.storage.setItem(key, value);
		}
	};
	return {
		storage,
		register(nonce: string, fence: Fence) {
			if (attempts.size) throw new Error('Telegram attempt already active.');
			const attempt: Attempt = { fence, active: true, dispatched: false,
				baseline: persistence?.storage.getItem(persistence.key) ?? null };
			attempts.set(nonce, attempt);
			return () => {
				attempt.active = false;
				attempts.delete(nonce);
				if (attempt.token) commits.delete(attempt.token);
			};
		},
		fetch: ((input, init) => {
			const target = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
			if (target.origin === endpoint.origin && target.pathname === endpoint.pathname
				&& target.searchParams.get('grant_type') === 'id_token' && typeof init?.body === 'string') {
				const body = JSON.parse(init.body);
				if (body.provider === TELEGRAM_PROVIDER) {
					const attempt = attempts.get(body.nonce);
					const fence = attempt?.fence;
					const bearer = new Headers(init.headers).get('authorization');
					if (!attempt || attempt.dispatched || !fence?.current() || (body.link_identity === true
						? !fence.accessToken || bearer !== `Bearer ${fence.accessToken}`
						: fence.accessToken !== undefined)) {
						throw new Error('Telegram account context expired.');
					}
					// One network dispatch per nonce, even if a caller retries internally.
					check(attempt);
					attempt.dispatched = true;
					const response = fetcher(input, init);
					return response.then(async (result) => {
						check(attempt);
						// Fetch resolves on headers, not on body completion. Never hand the
						// original, potentially deferred stream/json() to auth-js.
						const bytes = await result.arrayBuffer();
						check(attempt);
						const guard = (response: Response): Response => {
							const json = response.json.bind(response);
							const clone = response.clone.bind(response);
							response.json = async () => {
								check(attempt);
								const data = await json();
								check(attempt);
								if (response.ok && typeof data?.access_token === 'string') {
									attempt.token = data.access_token;
									commits.set(data.access_token, attempt);
								}
								return data;
							};
							response.clone = () => { check(attempt); return guard(clone()); };
							return response;
						};
						return guard(new Response([204, 205, 304].includes(result.status) ? null : bytes, {
							status: result.status, statusText: result.statusText, headers: result.headers
						}));
					});
				}
			}
			return fetcher(input, init);
		}) as typeof fetch
	};
}

export type TelegramTransport = ReturnType<typeof createTelegramTransport>;