export type PaymentProviderId = 'tranzzo';
export type ProviderOnboardingStatus = 'not-started' | 'in-review' | 'approved';
export type WalletMethodId = 'apple-pay' | 'google-pay';

export type PaymentMethodsConfig = {
	provider: PaymentProviderId;
	onboardingStatus: ProviderOnboardingStatus;
	posId: string;
	requestedWallets: WalletMethodId[];
};

export const PAYMENT_METHODS_STORAGE_KEY = 'rahunok.payment-methods.v1';

export const defaultPaymentMethodsConfig: PaymentMethodsConfig = {
	provider: 'tranzzo',
	onboardingStatus: 'not-started',
	posId: '',
	requestedWallets: []
};

export function canRequestWallets(config: PaymentMethodsConfig) {
	return config.onboardingStatus === 'approved' && config.posId.trim().length > 0;
}

export function validatePaymentMethodsConfig(config: PaymentMethodsConfig) {
	const issues: string[] = [];
	if (config.onboardingStatus === 'approved' && !config.posId.trim()) {
		issues.push('Додайте POS_ID з кабінету Tranzzo.');
	}
	if (!canRequestWallets(config) && config.requestedWallets.length > 0) {
		issues.push(
			'Apple Pay і Google Pay можна запитати після активації акаунта та додавання POS_ID.'
		);
	}
	return issues;
}

export function loadPaymentMethodsConfig(): PaymentMethodsConfig {
	if (typeof localStorage === 'undefined') return { ...defaultPaymentMethodsConfig };
	try {
		const stored = JSON.parse(
			localStorage.getItem(PAYMENT_METHODS_STORAGE_KEY) ?? '{}'
		) as Partial<PaymentMethodsConfig>;
		const status: ProviderOnboardingStatus = ['not-started', 'in-review', 'approved'].includes(
			stored.onboardingStatus ?? ''
		)
			? (stored.onboardingStatus as ProviderOnboardingStatus)
			: defaultPaymentMethodsConfig.onboardingStatus;
		const requestedWallets = Array.isArray(stored.requestedWallets)
			? stored.requestedWallets.filter(
					(method): method is WalletMethodId => method === 'apple-pay' || method === 'google-pay'
				)
			: [];
		return {
			provider: 'tranzzo',
			onboardingStatus: status,
			posId: typeof stored.posId === 'string' ? stored.posId : '',
			requestedWallets: status === 'approved' ? requestedWallets : []
		};
	} catch {
		return { ...defaultPaymentMethodsConfig };
	}
}

export function savePaymentMethodsConfig(config: PaymentMethodsConfig) {
	localStorage.setItem(PAYMENT_METHODS_STORAGE_KEY, JSON.stringify(config));
}
