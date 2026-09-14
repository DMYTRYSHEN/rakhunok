import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createTelegramLogin, createTelegramNonce, createTelegramSdkLoader, type TelegramSdk, type TelegramConfig } from './telegram-login';

const config = { origin: 'https://letsrealtalk.com', enabled: 'true', clientId: '123456789', mode: 'direct' };
const user = { id: 'account-a', email: 'synthetic@example.test', identities: [] };
function fixture(initial: object | null = null, overrides: Partial<TelegramConfig> = {}) {
	let session = initial;
	let event: (event: string) => void = () => {};
	let callback: Parameters<TelegramSdk['auth']>[1] = () => {};
	const auth = {
		getSession: vi.fn(async () => ({ data: { session }, error: null })),
		onAuthStateChange: vi.fn((listener) => { event = listener; return { data: { subscription: { unsubscribe: vi.fn() } } }; }),
		signInWithIdToken: vi.fn(async (_credentials: unknown) => ({ error: null })),
		linkIdentity: vi.fn(async (_credentials: unknown) => ({ error: null })),
		signInWithOAuth: vi.fn(async () => ({ error: null }))
	};
	const sdk = { auth: vi.fn((_options, cb) => { callback = cb; }), close: vi.fn() };
	const dependencies = { loadSdk: vi.fn(async () => sdk), createNonce: vi.fn(createTelegramNonce), isInApp: vi.fn(() => false) };
	const login = createTelegramLogin({ auth } as unknown as SupabaseClient, { ...config, ...overrides }, dependencies);
	let status = '';
	login.subscribe((next) => { status = next; });
	return { login, auth, sdk, dependencies, status: () => status, result: (result: Parameters<typeof callback>[0]) => callback(result), switch: (next: object | null) => { session = next; event('SIGNED_IN'); } };
}
afterEach(() => vi.useRealTimers());
describe('direct Telegram Login', () => {
	it('fails closed before SDK load when native readiness is unavailable', async () => {
		const f = fixture();
		f.dependencies.isInApp.mockReturnValue(true);
		await f.login.prepare();
		expect(f.status()).toBe('external-required');
		expect(f.dependencies.loadSdk).not.toHaveBeenCalled();
		expect(f.dependencies.createNonce).not.toHaveBeenCalled();
		await expect(f.login.start('signin', null)).rejects.toThrow();
		expect(f.sdk.auth).not.toHaveBeenCalled();
		expect(f.auth.signInWithOAuth).not.toHaveBeenCalled();
		f.login.dispose();
	});
	it('rechecks Telegram environment on click after external preparation', async () => {
		const f = fixture();
		await f.login.prepare();
		f.dependencies.isInApp.mockReturnValue(true);
		await expect(f.login.start('signin', null)).rejects.toThrow('system browser');
		expect(f.status()).toBe('external-required');
		expect(f.sdk.auth).not.toHaveBeenCalled();
		f.login.dispose();
	});
	it('serializes the document SDK across separate controller instances', async () => {
		const a = fixture();
		const b = fixture();
		b.dependencies.loadSdk.mockResolvedValue(a.sdk);
		await Promise.all([a.login.prepare(), b.login.prepare()]);
		const pending = a.login.start('signin', null);
		await expect(b.login.start('signin', null)).rejects.toThrow('already active');
		b.login.dispose();
		expect(a.sdk.close).not.toHaveBeenCalled();
		a.login.cancel();
		await expect(pending).rejects.toThrow();
		a.login.dispose();
	});
	it('generates fresh 256-bit raw nonces and lowercase SHA256 hex', async () => {
		const a = await createTelegramNonce();
		const b = await createTelegramNonce();
		expect(a.raw).toMatch(/^[a-f0-9]{64}$/);
		expect(a.raw).not.toBe(b.raw);
		expect(a.hashed).toBe(createHash('sha256').update(a.raw).digest('hex'));
	});
	it('opens synchronously after preload, sends hashed nonce to SDK and raw nonce only to Supabase', async () => {
		const f = fixture();
		await f.login.prepare();
		const pending = f.login.start('signin', null);
		expect(f.sdk.auth).toHaveBeenCalledOnce();
		f.result({ id_token: 'synthetic-token' });
		f.result({ id_token: 'duplicate-token' });
		await pending;
		expect(f.auth.signInWithIdToken).toHaveBeenCalledOnce();
		const credentials = f.auth.signInWithIdToken.mock.calls[0][0] as { nonce: string };
		expect(credentials).toEqual({ provider: 'custom:telegram', token: 'synthetic-token', nonce: expect.any(String) });
		expect(f.sdk.auth.mock.calls[0][0]).toEqual({ client_id: 123456789, scope: ['profile'], nonce: createHash('sha256').update(credentials.nonce).digest('hex') });
		expect(f.auth.linkIdentity).not.toHaveBeenCalled();
		expect(f.auth.signInWithOAuth).not.toHaveBeenCalled();
		f.login.dispose();
	});
	it('uses the ID-token link overload for the captured existing email account', async () => {
		const f = fixture({ user });
		await f.login.prepare();
		const pending = f.login.start('link', user.id);
		f.result({ id_token: 'synthetic-token' });
		await pending;
		expect(f.auth.linkIdentity).toHaveBeenCalledWith({ provider: 'custom:telegram', token: 'synthetic-token', nonce: expect.any(String) });
		expect(f.auth.signInWithIdToken).not.toHaveBeenCalled();
		f.login.dispose();
	});
	it.each([
		{ user: { ...user, identities: [{ provider: 'custom:telegram' }] } },
		{ user: { ...user, is_anonymous: true } },
		{ user: { ...user, email: undefined } },
		null
	])('rejects already-linked or incompatible accounts without exchange', async (session) => {
		const f = fixture(session);
		await f.login.prepare();
		const pending = f.login.start('link', user.id);
		f.result({ id_token: 'synthetic-token' });
		await expect(pending).rejects.toThrow();
		expect(f.auth.linkIdentity).not.toHaveBeenCalled();
		f.login.dispose();
	});
	it.each([{ error: 'popup_closed' }, { error: 'PRIVATE_PROVIDER_ERROR' }, {}, { id_token: '' }])('fails closed on cancellation/malformed result', async (result) => {
		const f = fixture();
		await f.login.prepare();
		const pending = f.login.start('signin', null);
		f.result(result);
		await expect(pending).rejects.toThrow('Telegram authorization not completed.');
		expect(f.auth.signInWithIdToken).not.toHaveBeenCalled();
		expect(f.auth.signInWithOAuth).not.toHaveBeenCalled();
		expect(f.sdk.close).toHaveBeenCalled();
		f.login.dispose();
	});
	it('explicit cancel, duplicate start and late callback never exchange', async () => {
		const f = fixture();
		await f.login.prepare();
		const pending = f.login.start('signin', null);
		await expect(f.login.start('signin', null)).rejects.toThrow();
		f.login.cancel();
		f.result({ id_token: 'late-token' });
		await expect(pending).rejects.toThrow();
		expect(f.auth.signInWithIdToken).not.toHaveBeenCalled();
		f.login.dispose();
	});
	it('bounds blocked popup/no callback to two minutes and ignores late results', async () => {
		const f = fixture();
		await f.login.prepare();
		vi.useFakeTimers();
		const pending = f.login.start('signin', null);
		const rejected = expect(pending).rejects.toThrow();
		await vi.advanceTimersByTimeAsync(120_000);
		await rejected;
		f.result({ id_token: 'late-token' });
		expect(f.auth.signInWithIdToken).not.toHaveBeenCalled();
		f.login.dispose();
	});
	it.each(['signin', 'link'] as const)('fences %s on account change during popup, including switch back', async (mode) => {
		const f = fixture(mode === 'link' ? { user } : null);
		await f.login.prepare();
		const pending = f.login.start(mode, mode === 'link' ? user.id : null);
		f.switch({ user: { ...user, id: 'account-b' } });
		f.switch(mode === 'link' ? { user } : null);
		f.result({ id_token: 'late-token' });
		await expect(pending).rejects.toThrow();
		expect(f.auth.linkIdentity).not.toHaveBeenCalled();
		expect(f.auth.signInWithIdToken).not.toHaveBeenCalled();
		f.login.dispose();
	});
	it('fences an account switch while the pre-exchange session read awaits', async () => {
		const f = fixture({ user });
		await f.login.prepare();
		const pending = f.login.start('link', user.id);
		let release!: (value: { data: { session: object }; error: null }) => void;
		f.auth.getSession.mockImplementationOnce(() => new Promise((resolve) => { release = resolve; }));
		f.result({ id_token: 'synthetic-token' });
		f.switch({ user: { ...user, id: 'account-b' } });
		release({ data: { session: { user } }, error: null });
		await expect(pending).rejects.toThrow();
		expect(f.auth.linkIdentity).not.toHaveBeenCalled();
		f.login.dispose();
	});
	it('does not replace an existing session with guest sign-in', async () => {
		const f = fixture({ user });
		await f.login.prepare();
		const pending = f.login.start('signin', null);
		f.result({ id_token: 'synthetic-token' });
		await expect(pending).rejects.toThrow();
		expect(f.auth.signInWithIdToken).not.toHaveBeenCalled();
		f.login.dispose();
	});
	it('does not fall back after SDK failure or ID-token rejection', async () => {
		const f = fixture();
		f.dependencies.loadSdk.mockRejectedValueOnce(new Error('SDK failed'));
		await f.login.prepare();
		expect(f.status()).toBe('error');
		await expect(f.login.start('signin', null)).rejects.toThrow();
		expect(f.auth.signInWithOAuth).not.toHaveBeenCalled();
		f.login.dispose();
		const g = fixture();
		await g.login.prepare();
		g.auth.signInWithIdToken.mockRejectedValueOnce(new Error('bad nonce'));
		const pending = g.login.start('signin', null);
		g.result({ id_token: 'synthetic-token' });
		await expect(pending).rejects.toThrow();
		expect(g.auth.signInWithOAuth).not.toHaveBeenCalled();
		g.login.dispose();
	});
	it.each([{ origin: 'https://rakhunok.com' }, { origin: 'https://letsrealtalk.com.evil.test' }, { enabled: undefined }, { clientId: undefined }, { mode: 'invalid' }])('rejects invalid build/origin configuration before SDK I/O', async (override) => {
		const f = fixture(null, override);
		await f.login.prepare();
		expect(f.status()).toBe('error');
		expect(f.dependencies.loadSdk).not.toHaveBeenCalled();
		f.login.dispose();
	});
	it('redirect is explicit and loads no SDK/nonce', async () => {
		const f = fixture(null, { mode: 'redirect', clientId: undefined });
		await f.login.prepare();
		await f.login.start('signin', null);
		await f.login.prepare();
		expect(f.status()).toBe('ready');
		expect(f.auth.signInWithOAuth).toHaveBeenCalledOnce();
		expect(f.dependencies.loadSdk).not.toHaveBeenCalled();
		expect(f.dependencies.createNonce).not.toHaveBeenCalled();
		f.login.dispose();
	});
	it('dispose cancels popup and unsubscribes', async () => {
		const f = fixture();
		await f.login.prepare();
		const pending = f.login.start('signin', null);
		f.login.dispose();
		f.result({ id_token: 'late-token' });
		await expect(pending).rejects.toThrow();
		expect(f.auth.onAuthStateChange.mock.results[0].value.data.subscription.unsubscribe).toHaveBeenCalledOnce();
		expect(f.auth.signInWithIdToken).not.toHaveBeenCalled();
	});
	it('pending preload cannot publish readiness after disposal', async () => {
		const f = fixture();
		let release!: (sdk: typeof f.sdk) => void;
		f.dependencies.loadSdk.mockImplementationOnce(() => new Promise((resolve) => { release = resolve; }));
		const pending = f.login.prepare();
		await Promise.resolve();
		f.login.dispose();
		release(f.sdk);
		await pending;
		expect(f.status()).not.toBe('ready');
		await expect(f.login.start('signin', null)).rejects.toThrow();
	});
	it('prepares a fresh nonce after cancellation and ignores the old callback', async () => {
		const f = fixture();
		await f.login.prepare();
		const first = f.login.start('signin', null);
		const oldCallback = f.sdk.auth.mock.calls[0][1];
		f.login.cancel();
		await expect(first).rejects.toThrow();
		await f.login.prepare();
		const second = f.login.start('signin', null);
		oldCallback({ id_token: 'stale' });
		expect(f.auth.signInWithIdToken).not.toHaveBeenCalled();
		expect(f.sdk.auth.mock.calls[0][0].nonce).not.toBe(f.sdk.auth.mock.calls[1][0].nonce);
		f.result({ id_token: 'new' });
		await second;
		f.login.dispose();
	});
	it('own auth event during exchange completes without enabling a concurrent retry', async () => {
		const f = fixture();
		await f.login.prepare();
		f.auth.signInWithIdToken.mockImplementationOnce(async () => {
			expect(f.status()).toBe('exchanging');
			f.switch({ user });
			f.login.cancel();
			await expect(f.login.start('signin', null)).rejects.toThrow();
			return { error: null };
		});
		const pending = f.login.start('signin', null);
		f.result({ id_token: 'new' });
		await pending;
		f.login.dispose();
	});
});

describe('SDK loader lifecycle', () => {
	function loaderFixture() {
		const script = { onload: null as null | (() => void), onerror: null as null | (() => void), remove: vi.fn(), src: '', async: false };
		const appendChild = vi.fn();
		const sdk = { auth: vi.fn(), close: vi.fn() };
		let loaded = false;
		const load = createTelegramSdkLoader({ createElement: () => script, head: { appendChild } } as unknown as Document, () => loaded ? sdk : undefined);
		return { script, appendChild, sdk, load, finish: () => { loaded = true; script.onload?.(); } };
	}
	it('deduplicates concurrent loads and removes handlers/timer on success', async () => {
		vi.useFakeTimers();
		const f = loaderFixture();
		const a = f.load();
		expect(f.load()).toBe(a);
		expect(f.appendChild).toHaveBeenCalledOnce();
		expect(f.script.src).toBe('https://oauth.telegram.org/js/telegram-login.js');
		f.finish();
		expect(await a).toBe(f.sdk);
		expect(f.script.onload).toBeNull();
		expect(f.script.onerror).toBeNull();
		expect(vi.getTimerCount()).toBe(0);
	});
	it.each(['error', 'timeout'] as const)('cleans failed %s without duplicate script injection', async (kind) => {
		vi.useFakeTimers();
		const f = loaderFixture();
		const a = f.load();
		const rejected = expect(a).rejects.toThrow('SDK unavailable');
		if (kind === 'error') f.script.onerror?.();
		else await vi.advanceTimersByTimeAsync(15_000);
		await rejected;
		expect(f.script.remove).toHaveBeenCalledOnce();
		expect(f.load()).toBe(a);
		expect(vi.getTimerCount()).toBe(0);
	});
});