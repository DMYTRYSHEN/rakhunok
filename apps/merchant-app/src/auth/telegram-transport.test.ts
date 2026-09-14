import { describe, expect, it, vi } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { createTelegramTransport } from './telegram-transport';

const url = 'https://synthetic.supabase.co';
const endpoint = `${url}/auth/v1/token?grant_type=id_token`;
const request = (link = true, bearer = 'account-a') => ({
	method: 'POST', headers: { Authorization: `Bearer ${bearer}` },
	body: JSON.stringify({ provider: 'custom:telegram', nonce: 'nonce', link_identity: link })
});

describe('Telegram network fence', () => {
	it('rejects switched bearer, stale revision and missing attempts before fetch', () => {
		const fetcher = vi.fn();
		const transport = createTelegramTransport(url, fetcher);
		expect(() => transport.fetch(endpoint, request())).toThrow();
		const unregister = transport.register('nonce', { current: () => true, accessToken: 'account-a' });
		expect(() => transport.fetch(endpoint, request(true, 'account-b'))).toThrow();
		unregister();
		transport.register('nonce', { current: () => false, accessToken: 'account-a' });
		expect(() => transport.fetch(endpoint, request())).toThrow();
		expect(fetcher).not.toHaveBeenCalled();
	});
	it('dispatches once and rejects a response after account switch', async () => {
		let current = true;
		let release!: (response: Response) => void;
		const fetcher = vi.fn(() => new Promise<Response>((resolve) => { release = resolve; }));
		const transport = createTelegramTransport(url, fetcher);
		transport.register('nonce', { current: () => current, accessToken: 'account-a' });
		const pending = transport.fetch(endpoint, request());
		expect(() => transport.fetch(endpoint, request())).toThrow();
		current = false;
		release(new Response('{}'));
		await expect(pending).rejects.toThrow();
		expect(fetcher).toHaveBeenCalledOnce();
	});
	it('leaves Google and unrelated requests unchanged', async () => {
		const response = new Response('{}');
		const fetcher = vi.fn(async () => response);
		const transport = createTelegramTransport(url, fetcher);
		const init = { body: JSON.stringify({ provider: 'google' }) };
		expect(await transport.fetch(endpoint, init)).toBe(response);
		expect(fetcher).toHaveBeenCalledWith(endpoint, init);
	});
	it('guards JSON consumption and clones even after a buffered response was returned', async () => {
		let current = true;
		const transport = createTelegramTransport(url, async () => Response.json({ access_token: 'synthetic' }));
		transport.register('nonce', { current: () => current, accessToken: 'account-a' });
		const response = await transport.fetch(endpoint, request());
		const clone = response.clone();
		current = false;
		await expect(response.json()).rejects.toThrow('context expired');
		await expect(clone.json()).rejects.toThrow('context expired');
		expect(() => response.clone()).toThrow('context expired');
	});
	it('unregister invalidates an already returned response, and allows a fresh attempt', async () => {
		const transport = createTelegramTransport(url, async () => Response.json({}));
		const unregister = transport.register('nonce', { current: () => true, accessToken: 'account-a' });
		const response = await transport.fetch(endpoint, request());
		expect(() => transport.register('another', { current: () => true })).toThrow('already active');
		unregister();
		await expect(response.json()).rejects.toThrow('context expired');
		expect(() => transport.register('another', { current: () => true })).not.toThrow();
	});
	it('guards the installed linkIdentity internal storage await, not just controller mocks', async () => {
		let release!: (value: string) => void;
		let block = false;
		const session = (id: string) => JSON.stringify({ access_token: id, refresh_token: 'synthetic', expires_at: 4102444800, user: { id, email: 'synthetic@example.test' } });
		const storage = {
			getItem: () => block ? new Promise<string>((resolve) => { release = resolve; }) : session('account-a'),
			setItem: vi.fn(), removeItem: vi.fn()
		};
		const fetcher = vi.fn(async () => new Response('{}'));
		const transport = createTelegramTransport(url, fetcher);
		const client = createClient(url, 'synthetic-anon', {
			auth: { storage, storageKey: 'telegram-transport-test', autoRefreshToken: false, detectSessionInUrl: false },
			global: { fetch: transport.fetch }
		});
		await client.auth.getSession();
		transport.register('nonce', { current: () => true, accessToken: 'account-a' });
		block = true;
		const pending = client.auth.linkIdentity({ provider: 'custom:telegram', token: 'synthetic', nonce: 'nonce' });
		release(session('account-b'));
		expect((await pending).error?.message).toBe('Telegram account context expired.');
		expect(fetcher).not.toHaveBeenCalled();
	});
});