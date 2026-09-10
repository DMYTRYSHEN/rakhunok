/**
 * BankConnectorDriver: Universal SPI interface for bank adapters (PrivatBank, A-Bank, Monobank, etc.)
 */

import type {
	BankId,
	BankCapabilities,
	BoundAccount,
	BankSyncWindow,
	BankSyncResult,
	BankAuthInitParams,
	BankAuthInitResult,
	BankWebhookVerificationResult,
	CredentialsValidationResult,
	NormalizedBankEvidence
} from './types.ts';

export interface BankConnectorDriver {
	readonly id: BankId;
	readonly name: string;
	readonly capabilities: BankCapabilities;

	/**
	 * Validate credentials (token, API key, Ed25519 key, etc.)
	 */
	validateCredentials(credentials: unknown): Promise<CredentialsValidationResult>;

	/**
	 * Discover accounts available under these credentials
	 */
	discoverAccounts(credentials: unknown): Promise<BoundAccount[]>;

	/**
	 * Fetch bank statement for an account in a specified time window
	 */
	fetchStatement(params: {
		account: BoundAccount;
		credentials: unknown;
		window: BankSyncWindow;
		fetcher?: typeof fetch;
	}): Promise<BankSyncResult>;

	/**
	 * Normalize a raw bank transaction payload into canonical NormalizedBankEvidence
	 */
	normalizeTransaction(raw: unknown, account: BoundAccount): NormalizedBankEvidence;

	/**
	 * Optional: Verify and parse an incoming Webhook from the bank
	 */
	verifyWebhook?(params: {
		headers: Headers | Record<string, string | string[] | undefined>;
		rawBody: Uint8Array | string;
		secret?: string;
		account?: BoundAccount;
	}): Promise<BankWebhookVerificationResult>;

	/**
	 * Optional: Initiate auth consent (QR code generation, OAuth redirect, etc.)
	 */
	initiateAuth?(params: BankAuthInitParams): Promise<BankAuthInitResult>;

	/**
	 * Optional: Handle callback when merchant/client approves consent
	 */
	handleAuthCallback?(payload: unknown): Promise<{
		token: string;
		status: 'approved' | 'rejected' | 'pending';
		metadata?: Record<string, unknown>;
	}>;
}

/**
 * Utility: generate deterministic canonical evidence ID
 */
export function buildEvidenceId(bankId: string, accountIban: string, bankTxId: string): string {
	const sanitizedBank = bankId.trim().toLowerCase();
	const sanitizedIban = accountIban.trim().replace(/\s+/g, '').toUpperCase();
	const sanitizedTxId = bankTxId.trim();
	return `urn:bank:${sanitizedBank}:${sanitizedIban}:${sanitizedTxId}`;
}

/**
 * Utility: Convert decimal currency (float or string like "120.50") into integer minor units (kopiiky: 12050n)
 */
export function toMinorUnits(amount: number | string): bigint {
	if (typeof amount === 'number') {
		return BigInt(Math.round(amount * 100));
	}
	const cleaned = amount.trim().replace(',', '.');
	const parsed = parseFloat(cleaned);
	if (isNaN(parsed)) {
		throw new Error(`Invalid amount format: "${amount}"`);
	}
	return BigInt(Math.round(parsed * 100));
}

/**
 * Utility: Convert minor units (kopiiky) to human-readable string (e.g. 12050n -> "120.50")
 */
export function fromMinorUnits(minor: bigint): string {
	const sign = minor < 0n ? '-' : '';
	const abs = minor < 0n ? -minor : minor;
	const major = abs / 100n;
	const remainder = abs % 100n;
	const cents = remainder.toString().padStart(2, '0');
	return `${sign}${major}.${cents}`;
}
