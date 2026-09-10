/**
 * A-Bank (аБізнес Open API) Driver
 * Specification: A-Bank Open API with Ed25519 signatures, QR-consent & transaction webhooks
 */

import type { BankConnectorDriver } from '../driver.ts';
import { buildEvidenceId, toMinorUnits } from '../driver.ts';
import type {
	BankCapabilities,
	BoundAccount,
	BankSyncWindow,
	BankSyncResult,
	BankAuthInitParams,
	BankAuthInitResult,
	BankWebhookVerificationResult,
	CredentialsValidationResult,
	NormalizedBankEvidence
} from '../types.ts';

export interface ABankCredentials {
	systemId: string; // UUID of registered system
	privateKeyPem: string; // Ed25519 private key in PEM or PKCS#8 format
	clientToken?: string; // Merchant authorization token (UUID)
	baseUrl?: string;
}

export interface RawABankPayment {
	id: number; // ID in ABusiness
	bill_id?: number; // ID in Bank Core
	created: string; // "2024-03-15T10:30:00"
	changed?: string;
	status: number;
	credit_iban: string;
	credit_okpo?: string;
	credit_name?: string;
	debit_iban: string;
	debit_okpo?: string;
	debit_name?: string;
	purpose: string;
	code?: string;
	currency: string;
	sum: number;
	sum_uah?: number;
	fee?: number;
	timestamp?: number; // Epoch milliseconds
	[key: string]: unknown;
}

export const aBankCapabilities: BankCapabilities = {
	authType: 'qr_consent',
	syncMode: 'hybrid', // Real-time Webhook + Statement polling
	paginationType: 'date_window',
	rateLimit: {
		maxRps: 5,
		windowSeconds: 1,
		scope: 'platform'
	},
	supportedCurrencies: ['UAH', 'USD', 'EUR'],
	requiresEgressAllowlist: false,
	supportsAccountDiscovery: true,
	supportsBalanceCheck: true,
	supportsWebhookRegistration: true
};

/**
 * Sign data using Ed25519 according to A-Bank specification:
 * Signature = Ed25519.sign(privateKey, 8_bytes_big_endian(timestamp) + utf8(body))
 */
export async function signABankRequest(
	timestamp: number,
	requestBody: string,
	privateKeyPem: string
): Promise<string> {
	// Dynamically load node:crypto or use global crypto
	const cryptoMod = await import('node:crypto');
	const privateKey = cryptoMod.createPrivateKey(privateKeyPem);

	const timestampBuffer = Buffer.alloc(8);
	timestampBuffer.writeBigInt64BE(BigInt(timestamp));

	const bodyBuffer = Buffer.from(requestBody, 'utf-8');
	const dataToSign = Buffer.concat([timestampBuffer, bodyBuffer]);

	const signature = cryptoMod.sign(null, dataToSign, privateKey);
	return signature.toString('hex');
}

export class ABankDriver implements BankConnectorDriver {
	readonly id = 'a-bank';
	readonly name = 'А-Банк (аБізнес Open API)';
	readonly capabilities = aBankCapabilities;

	private readonly defaultBaseUrl = 'https://open-api.a-bank.com.ua/abusiness';

	private getBaseUrl(creds: ABankCredentials): string {
		return (creds.baseUrl || this.defaultBaseUrl).replace(/\/+$/, '');
	}

	async validateCredentials(credentials: unknown): Promise<CredentialsValidationResult> {
		const creds = credentials as Partial<ABankCredentials>;
		if (!creds?.systemId || typeof creds.systemId !== 'string') {
			return { valid: false, error: 'Потрібно вказати systemId (UUID)' };
		}
		if (!creds?.privateKeyPem || typeof creds.privateKeyPem !== 'string') {
			return { valid: false, error: 'Потрібно надати приватний ключ Ed25519 (PEM)' };
		}
		return { valid: true };
	}

	async initiateAuth(params: BankAuthInitParams): Promise<BankAuthInitResult> {
		const creds = params.metadata?.credentials as ABankCredentials | undefined;
		if (!creds) {
			throw new Error('Креденшали системи А-Банку не передані для ініціалізації авторизації');
		}

		const timestamp = Date.now();
		const requestRef = `auth-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
		const bodyObj = {
			request_ref: requestRef,
			callback_url: params.callbackUrl
		};
		const bodyStr = JSON.stringify(bodyObj);
		const signature = await signABankRequest(timestamp, bodyStr, creds.privateKeyPem);

		const url = `${this.getBaseUrl(creds)}/auth/request`;
		const res = await fetch(url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'x-system-id': creds.systemId,
				'x-req-ts': timestamp.toString(),
				'x-req-signature': signature
			},
			body: bodyStr
		});

		if (!res.ok) {
			const err = await res.text().catch(() => '');
			throw new Error(`А-Банк помилка /auth/request (${res.status}): ${err}`);
		}

		const data = (await res.json()) as {
			result: string;
			token?: string;
			qr?: string;
		};

		return {
			type: 'qr',
			token: data.token,
			qrCodeBase64: data.qr,
			instructions: [
				'Відкрийте мобільний застосунок А24 для бізнесу',
				'Відскануйте QR-код для надання згоди на читання виписки',
				'Після підтвердження статус зміниться на APPROVED автоматично'
			]
		};
	}

	async discoverAccounts(credentials: unknown, fetcher: typeof fetch = fetch): Promise<BoundAccount[]> {
		const creds = credentials as ABankCredentials;
		if (!creds.clientToken) {
			throw new Error('Для отримання рахунків А-Банку потрібен авторизований clientToken');
		}

		const timestamp = Date.now();
		const bodyStr = JSON.stringify({
			request_ref: `acc-${Date.now()}`,
			token: creds.clientToken
		});
		const signature = await signABankRequest(timestamp, bodyStr, creds.privateKeyPem);

		const url = `${this.getBaseUrl(creds)}/accounts-list/old`;
		const res = await fetcher(url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'x-system-id': creds.systemId,
				'x-req-ts': timestamp.toString(),
				'x-req-signature': signature
			},
			body: bodyStr
		});

		if (!res.ok) {
			const err = await res.text().catch(() => '');
			throw new Error(`А-Банк помилка /accounts-list/old (${res.status}): ${err}`);
		}

		const data = (await res.json()) as {
			result: string;
			companies?: Array<{
				name: string;
				accounts: Array<{
					iban: string;
					okpo?: string;
					account?: string;
					currency?: number;
					name_full?: string;
					balance_available?: number;
					balance_ledger?: number;
				}>;
			}>;
		};

		const result: BoundAccount[] = [];
		for (const comp of data.companies || []) {
			for (const acc of comp.accounts || []) {
				result.push({
					iban: acc.iban,
					currency: acc.currency === 980 || !acc.currency ? 'UAH' : String(acc.currency),
					name: acc.name_full || comp.name,
					okpo: acc.okpo,
					accountNumber: acc.account,
					isActive: true,
					balanceAvailableMinor:
						acc.balance_available != null ? toMinorUnits(acc.balance_available) : undefined,
					balanceLedgerMinor:
						acc.balance_ledger != null ? toMinorUnits(acc.balance_ledger) : undefined,
					raw: acc
				});
			}
		}

		return result;
	}

	async fetchStatement(params: {
		account: BoundAccount;
		credentials: unknown;
		window: BankSyncWindow;
		fetcher?: typeof fetch;
	}): Promise<BankSyncResult> {
		const creds = params.credentials as ABankCredentials;
		const fetcher = params.fetcher || fetch;
		if (!creds.clientToken) {
			throw new Error('clientToken обов’язковий для виписки А-Банку');
		}

		// Format: yyyy-MM-dd HH:mm:ss
		const formatDateTime = (d: Date) => {
			const pad = (n: number) => n.toString().padStart(2, '0');
			return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
				d.getHours()
			)}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
		};

		const timestamp = Date.now();
		const bodyObj = {
			request_ref: `stmt-${Date.now()}`,
			token: creds.clientToken,
			iban: params.account.iban,
			date_from: formatDateTime(params.window.from),
			date_to: formatDateTime(params.window.to)
		};
		const bodyStr = JSON.stringify(bodyObj);
		const signature = await signABankRequest(timestamp, bodyStr, creds.privateKeyPem);

		const url = `${this.getBaseUrl(creds)}/payments-list`;
		const res = await fetcher(url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'x-system-id': creds.systemId,
				'x-req-ts': timestamp.toString(),
				'x-req-signature': signature
			},
			body: bodyStr
		});

		if (!res.ok) {
			const err = await res.text().catch(() => '');
			throw new Error(`А-Банк помилка /payments-list (${res.status}): ${err}`);
		}

		const data = (await res.json()) as {
			result: string;
			payments?: RawABankPayment[];
		};

		const list = Array.isArray(data.payments) ? data.payments : [];
		// Only credit transactions where our account is credit_iban
		const records = list
			.filter((p) => p.credit_iban === params.account.iban)
			.map((p) => this.normalizeTransaction(p, params.account));

		return {
			records,
			hasMore: false
		};
	}

	normalizeTransaction(raw: unknown, account: BoundAccount): NormalizedBankEvidence {
		const tx = raw as RawABankPayment;
		const bankTxId = `${tx.id}_${tx.bill_id || ''}`.replace(/_+$/, '');
		const evidenceId = buildEvidenceId(this.id, account.iban, bankTxId);

		const bookingIso = tx.timestamp
			? new Date(tx.timestamp).toISOString()
			: tx.created
			? new Date(tx.created).toISOString()
			: new Date().toISOString();

		return {
			evidenceId,
			bankId: this.id,
			accountId: account.iban,
			bankTxId,
			amountMinor: toMinorUnits(tx.sum),
			currency: tx.currency || account.currency || 'UAH',
			direction: 'credit',
			status: tx.status === 3 ? 'booked' : 'pending',
			purpose: tx.purpose || '',
			bookingDate: bookingIso,
			counterparty: {
				name: tx.debit_name,
				okpo: tx.debit_okpo,
				iban: tx.debit_iban
			},
			feeMinor: tx.fee != null ? toMinorUnits(tx.fee) : undefined,
			rawPayload: tx
		};
	}

	async verifyWebhook(params: {
		headers: Headers | Record<string, string | string[] | undefined>;
		rawBody: Uint8Array | string;
		secret?: string;
		account?: BoundAccount;
	}): Promise<BankWebhookVerificationResult> {
		try {
			const bodyString =
				typeof params.rawBody === 'string'
					? params.rawBody
					: new TextDecoder('utf-8').decode(params.rawBody);

			const parsed = JSON.parse(bodyString) as Record<string, unknown>;
			const payment = (('payment' in parsed && parsed.payment ? parsed.payment : parsed) as unknown) as RawABankPayment;

			if (!payment?.id || !payment?.credit_iban) {
				return {
					isValid: false,
					reason: 'Невалідний payload вебхука А-Банку (відсутній id або credit_iban)'
				};
			}

			const targetAccount: BoundAccount = params.account || {
				iban: payment.credit_iban,
				currency: payment.currency || 'UAH',
				name: payment.credit_name || 'Рахунок А-Банк',
				isActive: true
			};

			const normalized = this.normalizeTransaction(payment, targetAccount);

			return {
				isValid: true,
				bankEventId: String(payment.id),
				normalizedEvidence: normalized,
				rawEvent: payment
			};
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : String(err);
			return {
				isValid: false,
				reason: `Помилка парсингу вебхука: ${message}`
			};
		}
	}

	/**
	 * Register system in A-Bank (Chapter 6.1)
	 * Note: Signature uses public_key from body, no x-system-id header.
	 */
	async registerSystem(params: {
		publicKeyBase64: string;
		privateKeyPem: string;
		name: string;
		description: string;
		fio: string;
		phone: string;
		email: string;
		logoBase64?: string;
		baseUrl?: string;
		fetcher?: typeof fetch;
	}): Promise<{ systemId?: string; status: string; responseRef: string }> {
		const fetcher = params.fetcher || fetch;
		const timestamp = Date.now();
		const requestRef = `reg-${Date.now()}`;
		const bodyObj: Record<string, unknown> = {
			public_key: params.publicKeyBase64,
			name: params.name,
			description: params.description,
			fio: params.fio,
			phone: params.phone,
			email: params.email,
			request_ref: requestRef
		};
		if (params.logoBase64) {
			bodyObj.logo = params.logoBase64;
		}
		const bodyStr = JSON.stringify(bodyObj);
		const signature = await signABankRequest(timestamp, bodyStr, params.privateKeyPem);

		const baseUrl = (params.baseUrl || this.defaultBaseUrl).replace(/\/+$/, '');
		const res = await fetcher(`${baseUrl}/registration`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'x-req-ts': timestamp.toString(),
				'x-req-signature': signature
			},
			body: bodyStr
		});

		if (!res.ok) {
			const err = await res.text().catch(() => '');
			throw new Error(`А-Банк помилка /registration (${res.status}): ${err}`);
		}

		const data = (await res.json()) as {
			result: string;
			id?: string;
			status: string;
			response_ref: string;
		};

		return {
			systemId: data.id,
			status: data.status,
			responseRef: data.response_ref
		};
	}

	/**
	 * Configure webhook URL in A-Bank (Chapter 6.3)
	 */
	async setWebhookUrl(params: {
		credentials: ABankCredentials;
		webhookUrl?: string;
		fetcher?: typeof fetch;
	}): Promise<{ result: string; webhookUrl?: string }> {
		const fetcher = params.fetcher || fetch;
		const timestamp = Date.now();
		const requestRef = `wh-${Date.now()}`;
		const bodyObj: Record<string, string> = {
			request_ref: requestRef
		};
		if (params.webhookUrl) {
			bodyObj.webhook_url = params.webhookUrl;
		}
		const bodyStr = JSON.stringify(bodyObj);
		const signature = await signABankRequest(timestamp, bodyStr, params.credentials.privateKeyPem);

		const url = `${this.getBaseUrl(params.credentials)}/registration/webhook-url`;
		const res = await fetcher(url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'x-system-id': params.credentials.systemId,
				'x-req-ts': timestamp.toString(),
				'x-req-signature': signature
			},
			body: bodyStr
		});

		if (!res.ok) {
			const err = await res.text().catch(() => '');
			throw new Error(`А-Банк помилка /registration/webhook-url (${res.status}): ${err}`);
		}

		const data = (await res.json()) as {
			result: string;
			webhook_url?: string;
		};

		return {
			result: data.result,
			webhookUrl: data.webhook_url
		};
	}

	/**
	 * Handle incoming authorization callback from A-Bank (Chapter 3.3)
	 */
	async handleAuthCallback(payload: unknown): Promise<{
		token: string;
		status: 'approved' | 'rejected' | 'pending';
		metadata?: Record<string, unknown>;
	}> {
		const data = payload as { token?: string; status?: string };
		if (!data?.token) {
			throw new Error('Відсутній токен у callback відповіді А-Банку');
		}

		const statusStr = (data.status || '').toUpperCase();
		const status: 'approved' | 'rejected' | 'pending' =
			statusStr === 'APPROVED' ? 'approved' : statusStr === 'REJECTED' ? 'rejected' : 'pending';

		return {
			token: data.token,
			status,
			metadata: { raw: data }
		};
	}
}
