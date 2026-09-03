import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { createAuthGateway } from './auth-gateway';

const user = { id: 'user-1', email: 'cashier@example.com' } as User;

function createClient(options: { session?: boolean; merchant?: boolean; queryError?: boolean } = {}) {
	let authChange: ((event: string) => void) | undefined;
	const unsubscribe = vi.fn();
	const maybeSingle = vi.fn(async () => ({
		data: options.merchant ? { id: 'merchant-1', business_name: 'Кавʼярня', display_name: 'Каса №1' } : null,
		error: options.queryError ? new Error('query failed') : null
	}));
	const eq = vi.fn(() => ({ maybeSingle }));
	const select = vi.fn(() => ({ eq }));
	const from = vi.fn(() => ({ select }));
	const client = {
		auth: {
			getSession: vi.fn(async () => ({ data: { session: options.session ? { user } : null }, error: null })),
				signInWithIdToken: vi.fn(async () => ({ data: {}, error: null })),
			signOut: vi.fn(async () => ({ error: null })),
			onAuthStateChange: vi.fn((callback) => {
				authChange = callback;
				return { data: { subscription: { unsubscribe } } };
			})
		},
		from
	} as unknown as SupabaseClient;
	return { client, from, eq, emitAuthChange: (event: string) => authChange?.(event), unsubscribe };
}

describe('auth gateway', () => {
	it('exchanges a Google credential and nonce without an OAuth redirect', async () => {
		const { client } = createClient();
		await createAuthGateway(client).signInWithGoogleIdToken('google-credential', 'nonce');
		expect(client.auth.signInWithIdToken).toHaveBeenCalledWith({
			provider: 'google',
			token: 'google-credential',
			nonce: 'nonce'
		});
	});

	it('returns guest without querying merchants when there is no session', async () => {
		const { client, from } = createClient();
		expect(await createAuthGateway(client).restore()).toEqual({ status: 'guest' });
		expect(from).not.toHaveBeenCalled();
	});

	it('scopes merchant lookup to the authenticated user', async () => {
		const { client, eq } = createClient({ session: true, merchant: true });
		const state = await createAuthGateway(client).restore();
		expect(eq).toHaveBeenCalledWith('user_id', 'user-1');
		expect(state).toMatchObject({ status: 'ready', merchant: { id: 'merchant-1', name: 'Каса №1' } });
	});

	it('returns onboarding when the authenticated user has no merchant', async () => {
		const { client } = createClient({ session: true });
		expect(await createAuthGateway(client).restore()).toMatchObject({ status: 'onboarding', user });
	});

	it('returns an explicit error when merchant lookup fails', async () => {
		const { client } = createClient({ session: true, queryError: true });
		expect(await createAuthGateway(client).restore()).toEqual({
			status: 'error',
			message: 'Не вдалося завантажити профіль бізнесу.'
		});
	});

	it('notifies after auth changes and releases the subscription', async () => {
		const { client, emitAuthChange, unsubscribe } = createClient();
		const onChange = vi.fn();
		const stop = createAuthGateway(client).subscribe(onChange);

		emitAuthChange('INITIAL_SESSION');
		emitAuthChange('SIGNED_IN');
		await new Promise<void>((resolve) => queueMicrotask(resolve));

		expect(onChange).toHaveBeenCalledOnce();
		stop();
		expect(unsubscribe).toHaveBeenCalledOnce();
	});
});