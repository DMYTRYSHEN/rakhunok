/**
 * Canonical types and interfaces for Universal Bank Connectors (Rahunok / Corex)
 */

export type BankId = 'privatbank' | 'a-bank' | 'monobank' | 'pumb' | 'raiffeisen' | 'sense' | string;

export type BankProductKind = 'autoclient' | 'corporate' | 'acquiring' | 'open_banking';

export type AuthType = 'static_token' | 'qr_consent' | 'oauth2' | 'mtls_cert';

export type SyncMode = 'polling_only' | 'webhook_only' | 'hybrid';

export type PaginationType = 'cursor' | 'page_number' | 'date_window';

export interface RateLimitConfig {
	maxRps: number;
	windowSeconds: number;
	scope: 'token' | 'account' | 'platform';
}

export interface BankCapabilities {
	authType: AuthType;
	syncMode: SyncMode;
	paginationType: PaginationType;
	rateLimit: RateLimitConfig;
	supportedCurrencies: string[];
	requiresEgressAllowlist: boolean;
	supportsAccountDiscovery: boolean;
	supportsBalanceCheck: boolean;
	supportsWebhookRegistration: boolean;
}

export interface BoundAccount {
	iban: string;
	currency: string;
	name: string;
	okpo?: string;
	accountNumber?: string;
	mfo?: string;
	isActive: boolean;
	balanceAvailableMinor?: bigint;
	balanceLedgerMinor?: bigint;
	raw?: unknown;
}

export type TransactionDirection = 'credit' | 'debit';

export type NormalizedEvidenceStatus = 'booked' | 'pending' | 'reversed' | 'rejected';

export interface CounterpartyInfo {
	name?: string;
	iban?: string;
	okpo?: string;
	mfo?: string;
	bankName?: string;
}

export interface NormalizedBankEvidence {
	/**
	 * Globally canonical unique identifier:
	 * e.g. "urn:bank:privatbank:UA123456...:REF123_REFN456"
	 */
	evidenceId: string;
	bankId: BankId;
	accountId: string; // Recipient IBAN
	bankTxId: string; // Native bank transaction ID (or composite)
	amountMinor: bigint; // Integer amount in minor units (e.g. 10050 = 100.50 UAH)
	currency: string; // ISO 4217 (e.g. 'UAH', 'USD', 'EUR')
	direction: TransactionDirection;
	status: NormalizedEvidenceStatus;
	purpose: string; // Payment reference / 'Призначення платежу'
	bookingDate: string; // ISO 8601 timestamp
	valueDate?: string;
	counterparty: CounterpartyInfo;
	feeMinor?: bigint;
	rawPayload?: unknown;
}

export interface BankSyncWindow {
	from: Date;
	to: Date;
	cursor?: string;
	limit?: number;
}

export interface BankSyncResult {
	records: NormalizedBankEvidence[];
	nextCursor?: string;
	hasMore: boolean;
	latestTimestamp?: number;
}

export interface BankAuthInitParams {
	callbackUrl: string;
	merchantId: string;
	metadata?: Record<string, unknown>;
}

export interface BankAuthInitResult {
	type: 'qr' | 'redirect' | 'manual_instructions';
	token?: string;
	qrCodeBase64?: string;
	redirectUrl?: string;
	expiresAt?: Date;
	instructions?: string[];
}

export interface BankWebhookVerificationResult {
	isValid: boolean;
	bankEventId?: string;
	normalizedEvidence?: NormalizedBankEvidence;
	rawEvent?: unknown;
	reason?: string;
}

export interface CredentialsValidationResult {
	valid: boolean;
	error?: string;
	details?: unknown;
}
