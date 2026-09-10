export type PaymentProviderId = 'tranzzo';
export type ProviderOnboardingStatus = 'not-started' | 'in-review' | 'approved';
export type WalletMethodId = 'apple-pay' | 'google-pay';

export type BankConnectionId = 'privatbank' | 'a-bank' | 'monobank';
export type BankConnectionStatus = 'disconnected' | 'pending_consent' | 'connected' | 'error';

export interface BankAccountConfig {
	iban: string;
	bankId: BankConnectionId;
	currency: string;
	name: string;
	isActive: boolean;
	lastSyncedAt?: string;
	balanceFormatted?: string;
}

export interface BankIntegrationConfig {
	bankId: BankConnectionId;
	status: BankConnectionStatus;
	accounts: BankAccountConfig[];
	tokenOrRef?: string;
	autoSync: boolean;
	lastCheckAt?: string;
	errorMessage?: string;
}

export type PaymentMethodsConfig = {
	provider: PaymentProviderId;
	onboardingStatus: ProviderOnboardingStatus;
	posId: string;
	requestedWallets: WalletMethodId[];
	banks?: Record<BankConnectionId, BankIntegrationConfig>;
	selectedDirectBanks?: BankConnectionId[];
};

export const PAYMENT_METHODS_STORAGE_KEY = 'rahunok.payment-methods.v1';
export const BANK_CONNECTIONS_STORAGE_KEY = 'rahunok.bank-connections.v1';

export const defaultBankConnections: Record<BankConnectionId, BankIntegrationConfig> = {
	privatbank: {
		bankId: 'privatbank',
		status: 'connected',
		autoSync: true,
		lastCheckAt: '2 хв тому',
		accounts: [
			{
				iban: 'UA623077700000026001411123751',
				bankId: 'privatbank',
				currency: 'UAH',
				name: 'Основний рахунок ФОП (Приват24)',
				isActive: true,
				lastSyncedAt: '2 хв тому',
				balanceFormatted: '54 280.00 ₴'
			}
		]
	},
	'a-bank': {
		bankId: 'a-bank',
		status: 'connected',
		autoSync: true,
		lastCheckAt: '5 хв тому',
		accounts: [
			{
				iban: 'UA173077700000026205061543958',
				bankId: 'a-bank',
				currency: 'UAH',
				name: 'ТОВ Ромашка (аБізнес)',
				isActive: true,
				lastSyncedAt: '5 хв тому',
				balanceFormatted: '120 450.00 ₴'
			}
		]
	},
	monobank: {
		bankId: 'monobank',
		status: 'disconnected',
		autoSync: true,
		accounts: []
	}
};

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
		const result: PaymentMethodsConfig = {
			provider: 'tranzzo',
			onboardingStatus: status,
			posId: typeof stored.posId === 'string' ? stored.posId : '',
			requestedWallets: status === 'approved' ? requestedWallets : []
		};
		if (stored.banks) {
			result.banks = stored.banks;
		}
		if (stored.selectedDirectBanks) {
			result.selectedDirectBanks = stored.selectedDirectBanks;
		}
		return result;
	} catch {
		return { ...defaultPaymentMethodsConfig };
	}
}

export function savePaymentMethodsConfig(config: PaymentMethodsConfig) {
	localStorage.setItem(PAYMENT_METHODS_STORAGE_KEY, JSON.stringify(config));
}

export function loadBankConnections(): Record<BankConnectionId, BankIntegrationConfig> {
	if (typeof localStorage === 'undefined') return { ...defaultBankConnections };
	try {
		const stored = localStorage.getItem(BANK_CONNECTIONS_STORAGE_KEY);
		if (!stored) return { ...defaultBankConnections };
		return JSON.parse(stored);
	} catch {
		return { ...defaultBankConnections };
	}
}

export function saveBankConnections(banks: Record<BankConnectionId, BankIntegrationConfig>) {
	if (typeof localStorage === 'undefined') return;
	localStorage.setItem(BANK_CONNECTIONS_STORAGE_KEY, JSON.stringify(banks));
}
