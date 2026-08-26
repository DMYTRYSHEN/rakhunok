import type { SupabaseClient, User } from '@supabase/supabase-js';

export type Merchant = {
	id: string;
	name: string;
};

export type AuthState =
	| { status: 'loading' }
	| { status: 'guest' }
	| { status: 'ready'; user: User; merchant: Merchant }
	| { status: 'onboarding'; user: User }
	| { status: 'error'; message: string };

type MerchantRow = {
	id: string;
	business_name: string | null;
	display_name: string | null;
};

export function createAuthGateway(client: SupabaseClient) {
	return {
		async restore(): Promise<AuthState> {
			const sessionResult = await client.auth.getSession();
			if (sessionResult.error) {
				return { status: 'error', message: 'Не вдалося перевірити сесію.' };
			}

			const user = sessionResult.data.session?.user;
			if (!user) return { status: 'guest' };

			const merchantResult = await client
				.from('merchants')
				.select('id, business_name, display_name')
				.eq('user_id', user.id)
				.maybeSingle<MerchantRow>();

			if (merchantResult.error) {
				return { status: 'error', message: 'Не вдалося завантажити профіль бізнесу.' };
			}
			if (!merchantResult.data) return { status: 'onboarding', user };

			return {
				status: 'ready',
				user,
				merchant: {
					id: merchantResult.data.id,
					name:
						merchantResult.data.display_name ||
						merchantResult.data.business_name ||
						'Моя каса'
				}
			};
		},

		async signInWithGoogle(redirectTo: string): Promise<void> {
			const { error } = await client.auth.signInWithOAuth({
				provider: 'google',
				options: { redirectTo }
			});
			if (error) throw error;
		},

		async signOut(): Promise<void> {
			const { error } = await client.auth.signOut();
			if (error) throw error;
		},

		subscribe(onChange: () => void): () => void {
			const { data } = client.auth.onAuthStateChange((event) => {
				if (event !== 'INITIAL_SESSION') queueMicrotask(onChange);
			});
			return () => data.subscription.unsubscribe();
		}
	};
}

export type AuthGateway = ReturnType<typeof createAuthGateway>;