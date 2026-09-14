import { afterEach, describe, expect, it, vi } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { createTelegramTransport } from './telegram-transport';

const url = 'https://synthetic.supabase.co';
const key = 'telegram-persistence-test';
const session = (id: string, token = id) => ({ access_token: token, refresh_token: `refresh-${id}`,
	expires_in: 3600, expires_at: 4102444800, token_type: 'bearer', user: { id, email: `${id}@example.test` } });
function deferred<T>() {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((done) => { resolve = done; });
	return { promise, resolve };
}
afterEach(() => vi.restoreAllMocks());

async function fixture(mode: 'signin' | 'link', fetcher: typeof fetch) {
	const values = new Map<string, string>();
	if (mode === 'link') values.set(key, JSON.stringify(session('account-a')));
	const storage = {
		getItem: (name: string) => values.get(name) ?? null,
		setItem: vi.fn((name: string, value: string) => { values.set(name, value); }),
		removeItem: (name: string) => { values.delete(name); }
	};
	let current = true;
	const transport = createTelegramTransport(url, fetcher, { storage, key });
	const client = createClient(url, 'synthetic-anon', { global: { fetch: transport.fetch },
		auth: { storage: transport.storage, storageKey: key, autoRefreshToken: false, detectSessionInUrl: false } });
	await client.auth.getSession();
	const events: string[] = [];
	const { data: { subscription } } = client.auth.onAuthStateChange((event) => { if (event !== 'INITIAL_SESSION') events.push(event); });
	const unregister = transport.register('nonce', { current: () => current, accessToken: mode === 'link' ? 'account-a' : undefined });
	return {
		client, transport, storage, values, events,
		switchAccount(notify = true) { values.set(key, JSON.stringify(session('account-b'))); if (notify) current = false; },
		start() {
			const credentials = { provider: 'custom:telegram', token: 'synthetic', nonce: 'nonce' };
			return mode === 'link' ? client.auth.linkIdentity(credentials) : client.auth.signInWithIdToken(credentials);
		},
		cleanup() { unregister(); subscription.unsubscribe(); }
	};
}

describe('installed auth-js Telegram response and session commit fencing', () => {
	it.each(['signin', 'link'] as const)('%s buffers a headers-ready, delayed body before exposing it to auth-js', async (mode) => {
		let controller!: ReadableStreamDefaultController<Uint8Array>;
		const entered = deferred<void>();
		const response = new Response(new ReadableStream<Uint8Array>({ start(c) { controller = c; } }));
		const originalJson = vi.spyOn(response, 'json');
		const arrayBuffer = response.arrayBuffer.bind(response);
		vi.spyOn(response, 'arrayBuffer').mockImplementation(() => { entered.resolve(); return arrayBuffer(); });
		const f = await fixture(mode, vi.fn(async () => response));
		const pending = f.start();
		await entered.promise;
		f.switchAccount();
		controller.enqueue(new TextEncoder().encode(JSON.stringify(session('account-a', 'telegram-token'))));
		controller.close();
		expect((await pending).error?.message).toContain('context expired');
		expect(originalJson).not.toHaveBeenCalled();
		expect(JSON.parse(f.values.get(key)!).user.id).toBe('account-b');
		expect(f.storage.setItem).not.toHaveBeenCalled();
		expect(f.events).toEqual([]);
		f.cleanup();
	});

	it.each(['signin', 'link'] as const)('%s rejects deferred reconstructed response.json after account B change', async (mode) => {
		const entered = deferred<void>();
		const release = deferred<void>();
		const json = Response.prototype.json;
		vi.spyOn(Response.prototype, 'json').mockImplementation(async function(this: Response) {
			const parsed = await json.call(this);
			entered.resolve();
			await release.promise;
			return parsed;
		});
		const f = await fixture(mode, vi.fn(async () => Response.json(session('account-a', 'telegram-token'))));
		const pending = f.start();
		await entered.promise;
		f.switchAccount();
		release.resolve();
		expect((await pending).error?.message).toContain('context expired');
		expect(f.storage.setItem).not.toHaveBeenCalled();
		expect(JSON.parse(f.values.get(key)!).user.id).toBe('account-b');
		expect(f.events).toEqual([]);
		f.cleanup();
	});

	it.each(['signin', 'link'] as const)('%s rejects a switch after JSON consumption, immediately before SDK persistence', async (mode) => {
		const f = await fixture(mode, vi.fn(async () => Response.json(session('account-a', 'telegram-token'))));
		// Interpose at the PUBLIC adapter boundary, not a mocked auth method or private SDK field.
		// The actual SDK has already awaited JSON, transformed, cloned and serialized A.
		const setItem = f.transport.storage!.setItem.bind(f.transport.storage);
		vi.spyOn(f.transport.storage!, 'setItem').mockImplementation((name, value) => {
			if (name === key && JSON.parse(value).access_token === 'telegram-token') f.switchAccount();
			setItem(name, value);
		});
		await expect(f.start()).rejects.toThrow('context expired');
		expect(f.storage.setItem).not.toHaveBeenCalled();
		expect(JSON.parse(f.values.get(key)!).user.id).toBe('account-b');
		expect(f.events).toEqual([]);
		f.cleanup();
	});

	it('detects storage changing to B even before the cross-tab auth notification arrives', async () => {
		const f = await fixture('link', vi.fn(async () => Response.json(session('account-a', 'telegram-token'))));
		const setItem = f.transport.storage!.setItem.bind(f.transport.storage);
		vi.spyOn(f.transport.storage!, 'setItem').mockImplementation((name, value) => {
			f.switchAccount(false);
			setItem(name, value);
		});
		await expect(f.start()).rejects.toThrow('context expired');
		expect(f.storage.setItem).not.toHaveBeenCalled();
		expect(f.events).toEqual([]);
		f.cleanup();
	});

	it.each(['signin', 'link'] as const)('%s persists and emits its own event when the attempt is current', async (mode) => {
		const f = await fixture(mode, vi.fn(async () => Response.json(session('account-a', 'telegram-token'))));
		expect((await f.start()).error).toBeNull();
		expect(JSON.parse(f.values.get(key)!).access_token).toBe('telegram-token');
		expect(f.storage.setItem).toHaveBeenCalledOnce();
		expect(f.events).toEqual([mode === 'link' ? 'USER_UPDATED' : 'SIGNED_IN']);
		f.cleanup();
	});

	it('allows actual Google SDK persistence while a stale Telegram attempt is still registered', async () => {
		const f = await fixture('link', vi.fn(async () => Response.json(session('account-b', 'google-token'))));
		f.switchAccount();
		expect((await f.client.auth.signInWithIdToken({ provider: 'google', token: 'synthetic' })).error).toBeNull();
		expect(JSON.parse(f.values.get(key)!).access_token).toBe('google-token');
		expect(f.events).toEqual(['SIGNED_IN']);
		f.cleanup();
	});
});