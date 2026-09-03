import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	PAYMENT_METHODS_STORAGE_KEY,
	canRequestWallets,
	defaultPaymentMethodsConfig,
	loadPaymentMethodsConfig,
	validatePaymentMethodsConfig
} from './payment-methods';

describe('payment methods configuration', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('keeps wallets unavailable before Tranzzo approval and POS_ID', () => {
		expect(canRequestWallets(defaultPaymentMethodsConfig)).toBe(false);
		expect(
			validatePaymentMethodsConfig({
				...defaultPaymentMethodsConfig,
				onboardingStatus: 'approved'
			})
		).toContain('Додайте POS_ID з кабінету Tranzzo.');
	});

	it('allows wallet requests after approval and POS_ID', () => {
		const config = {
			...defaultPaymentMethodsConfig,
			onboardingStatus: 'approved' as const,
			posId: 'demo-pos-id',
			requestedWallets: ['apple-pay' as const, 'google-pay' as const]
		};

		expect(canRequestWallets(config)).toBe(true);
		expect(validatePaymentMethodsConfig(config)).toEqual([]);
	});

	it('drops wallet requests when a stored account is not approved', () => {
		const getItem = vi.fn((key: string) =>
			key === PAYMENT_METHODS_STORAGE_KEY
				? JSON.stringify({
						onboardingStatus: 'in-review',
						posId: 'pending-pos',
						requestedWallets: ['apple-pay', 'unknown-wallet']
					})
				: null
		);
		vi.stubGlobal('localStorage', { getItem });

		expect(loadPaymentMethodsConfig()).toEqual({
			provider: 'tranzzo',
			onboardingStatus: 'in-review',
			posId: 'pending-pos',
			requestedWallets: []
		});
	});
});
