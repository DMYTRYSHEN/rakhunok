/**
 * Monobank Driver (Corporate API & Acquiring API)
 * Official API: https://api.monobank.ua/docs/
 */

import type { BankConnectorDriver } from '../driver.ts';
import { buildEvidenceId } from '../driver.ts';
import type {
	BankCapabilities,
	BoundAccount,
	BankSyncWindow,
	BankSyncResult,
	BankWebhookVerificationResult,
	CredentialsValidationResult,
	NormalizedBankEvidence
} from '../types.ts';

export interface MonobankCredentials {
	token: string; // Acquiring X-Token or Corporate Client Token
	kind?: 'acquiring' | 'corporate' | 'personal';
	baseUrl?: string;
}

export interface RawMonoStatementItem {
	id: string;
	time: number; // Unix timestamp in seconds
	description: string;
	mcc?: number;
	originalMcc?: number;
	amount: number; // In minor units (kopiiky)! E.g. -10050 or 50000
	operationAmount?: number;
	currencyCode: number; // 980 for UAH
	commissionRate?: number;
	cashbackAmount?: number;
	balance?: number;
	hold?: boolean;
	receiptId?: string;
	counterEdrpou?: string;
	counterIban?: string;
	counterName?: string;
	[key: string]: unknown;
}

export interface RawMonoAcquiringItem {
	invoiceId: string;
	status: 'created' | 'processing' | 'hold' | 'success' | 'failure' | 'reversed' | 'expired';
	amount: number; // Minor units (kopiiky)
	ccy: number; // 980
	createdDate: string;
	modifiedDate: string;
	reference?: string;
	destination?: string;
	[key: string]: unknown;
}

export const monobankCapabilities: BankCapabilities = {
	authType: 'static_token',
	syncMode: 'hybrid', // Push Webhook + Pull Statement
	paginationType: 'date_window',
	rateLimit: {
		maxRps: 1,
		windowSeconds: 1,
		scope: 'token'
	},
	supportedCurrencies: ['UAH', 'USD', 'EUR'],
	requiresEgressAllowlist: false,
	supportsAccountDiscovery: true,
	supportsBalanceCheck: true,
	supportsWebhookRegistration: true
};

export class MonobankDriver implements BankConnectorDriver {
	readonly id = 'monobank';
	readonly name = 'Monobank (Corporate / Acquiring)';
	readonly capabilities = monobankCapabilities;

	private readonly defaultBaseUrl = 'https://api.monobank.ua';

	private getBaseUrl(creds: MonobankCredentials): string {
		return (creds.baseUrl || this.defaultBaseUrl).replace(/\/+$/, '');
	}

	private resolveCurrency(code: number): string {
		switch (code) {
			case 980:
				return 'UAH';
			case 840:
				return 'USD';
			case 978:
				return 'EUR';
			default:
				return String(code);
		}
	}

	async validateCredentials(credentials: unknown): Promise<CredentialsValidationResult> {
		const creds = credentials as Partial<MonobankCredentials>;
		if (!creds?.token || typeof creds.token !== 'string' || creds.token.trim().length < 10) {
			return { valid: false, error: 'Токен Monobank має бути непорожнім рядком' };
		}
		return { valid: true };
	}

	async discoverAccounts(credentials: unknown, fetcher: typeof fetch = fetch): Promise<BoundAccount[]> {
		const creds = credentials as MonobankCredentials;
		const url = `${this.getBaseUrl(creds)}/personal/client-info`;

		try {
			const res = await fetcher(url, {
				headers: { 'X-Token': creds.token }
			});

			if (!res.ok) {
				const errText = await res.text().catch(() => '');
				throw new Error(`Monobank повернув статус ${res.status}: ${errText}`);
			}

			const data = (await res.json()) as {
				name?: string;
				accounts?: Array<{
					id: string;
					iban?: string;
					currencyCode: number;
					type: string;
					balance: number;
				}>;
			};

			const list = Array.isArray(data.accounts) ? data.accounts : [];
			return list.map((a) => ({
				iban: a.iban || a.id,
				currency: this.resolveCurrency(a.currencyCode),
				name: `${data.name || 'Monobank'} (${a.type})`,
				isActive: true,
				balanceAvailableMinor: BigInt(a.balance),
				raw: a
			}));
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : String(err);
			throw new Error(`Помилка отримання рахунків Monobank: ${message}`);
		}
	}

	async fetchStatement(params: {
		account: BoundAccount;
		credentials: unknown;
		window: BankSyncWindow;
		fetcher?: typeof fetch;
	}): Promise<BankSyncResult> {
		const creds = params.credentials as MonobankCredentials;
		const fetcher = params.fetcher || fetch;

		const fromSec = Math.floor(params.window.from.getTime() / 1000);
		const toSec = Math.floor(params.window.to.getTime() / 1000);

		// If acquiring: /api/merchant/statement
		if (creds.kind === 'acquiring') {
			const url = `${this.getBaseUrl(creds)}/api/merchant/statement?from=${fromSec}&to=${toSec}`;
			const res = await fetcher(url, {
				headers: { 'X-Token': creds.token }
			});

			if (!res.ok) {
				const err = await res.text().catch(() => '');
				throw new Error(`Monobank Acquiring помилка виписки ${res.status}: ${err}`);
			}

			const data = (await res.json()) as { list?: RawMonoAcquiringItem[] };
			const list = Array.isArray(data.list) ? data.list : [];
			const records = list
				.filter((i) => i.status === 'success')
				.map((i) => this.normalizeTransaction(i, params.account));

			return { records, hasMore: false };
		}

		// Otherwise personal/corporate statement: /personal/statement/{account}/{from}/{to}
		const accountId = encodeURIComponent(params.account.iban);
		const url = `${this.getBaseUrl(creds)}/personal/statement/${accountId}/${fromSec}/${toSec}`;

		const res = await fetcher(url, {
			headers: { 'X-Token': creds.token }
		});

		if (!res.ok) {
			const err = await res.text().catch(() => '');
			throw new Error(`Monobank помилка виписки ${res.status}: ${err}`);
		}

		const list = (await res.json()) as RawMonoStatementItem[];
		const rawItems = Array.isArray(list) ? list : [];

		// Only credit transactions (positive amount)
		const records = rawItems
			.filter((item) => item.amount > 0)
			.map((item) => this.normalizeTransaction(item, params.account));

		return {
			records,
			hasMore: rawItems.length >= 500
		};
	}

	normalizeTransaction(raw: unknown, account: BoundAccount): NormalizedBankEvidence {
		const item = raw as Record<string, unknown>;

		// Branch 1: Acquiring invoice item
		if ('invoiceId' in item) {
			const acq = item as unknown as RawMonoAcquiringItem;
			const bankTxId = acq.invoiceId;
			const evidenceId = buildEvidenceId(this.id, account.iban, bankTxId);

			return {
				evidenceId,
				bankId: this.id,
				accountId: account.iban,
				bankTxId,
				amountMinor: BigInt(acq.amount), // Already in minor units!
				currency: this.resolveCurrency(acq.ccy || 980),
				direction: 'credit',
				status: acq.status === 'success' ? 'booked' : 'pending',
				purpose: acq.destination || acq.reference || '',
				bookingDate: acq.modifiedDate || acq.createdDate || new Date().toISOString(),
				counterparty: {},
				rawPayload: acq
			};
		}

		// Branch 2: Standard Statement item
		const stmt = item as unknown as RawMonoStatementItem;
		const bankTxId = stmt.id || String(stmt.time);
		const evidenceId = buildEvidenceId(this.id, account.iban, bankTxId);
		const bookingIso = new Date(stmt.time * 1000).toISOString();

		return {
			evidenceId,
			bankId: this.id,
			accountId: account.iban,
			bankTxId,
			amountMinor: BigInt(Math.abs(stmt.amount)), // In minor units
			currency: this.resolveCurrency(stmt.currencyCode || 980),
			direction: stmt.amount >= 0 ? 'credit' : 'debit',
			status: stmt.hold ? 'pending' : 'booked',
			purpose: stmt.description || '',
			bookingDate: bookingIso,
			counterparty: {
				name: stmt.counterName,
				iban: stmt.counterIban,
				okpo: stmt.counterEdrpou
			},
			rawPayload: stmt
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

			const parsed = JSON.parse(bodyString) as {
				type?: string;
				data?: {
					account?: string;
					statementItem?: RawMonoStatementItem;
					invoiceId?: string;
					status?: string;
					amount?: number;
					ccy?: number;
				};
			};

			if (!parsed?.data) {
				return { isValid: false, reason: 'Відсутнє поле data у вебхуку Monobank' };
			}

			const accountIban = parsed.data.account || params.account?.iban || 'monobank_account';
			const targetAccount: BoundAccount = params.account || {
				iban: accountIban,
				currency: 'UAH',
				name: 'Monobank Account',
				isActive: true
			};

			if (parsed.data.statementItem) {
				const normalized = this.normalizeTransaction(parsed.data.statementItem, targetAccount);
				return {
					isValid: true,
					bankEventId: parsed.data.statementItem.id,
					normalizedEvidence: normalized,
					rawEvent: parsed
				};
			}

			if (parsed.data.invoiceId) {
				const normalized = this.normalizeTransaction(parsed.data, targetAccount);
				return {
					isValid: true,
					bankEventId: parsed.data.invoiceId,
					normalizedEvidence: normalized,
					rawEvent: parsed
				};
			}

			return { isValid: false, reason: 'Невідомий тип події Monobank' };
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : String(err);
			return { isValid: false, reason: `Помилка парсингу вебхука Monobank: ${message}` };
		}
	}

	/**
	 * Initiate Corporate Auth Request (https://api.monobank.ua/docs/corporate.html)
	 */
	async initiateCorporateAuth(params: {
		keyId: string;
		callbackUrl?: string;
		baseUrl?: string;
		fetcher?: typeof fetch;
	}): Promise<{ tokenRequestId: string; acceptUrl: string; qrBase64?: string }> {
		const fetcher = params.fetcher || fetch;
		const baseUrl = (params.baseUrl || this.defaultBaseUrl).replace(/\/+$/, '');
		const url = `${baseUrl}/api/corporate/auth/request`;

		const res = await fetcher(url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'X-Key-Id': params.keyId,
				'X-Time': Math.floor(Date.now() / 1000).toString()
			},
			body: JSON.stringify({ callback: params.callbackUrl })
		});

		if (!res.ok) {
			const err = await res.text().catch(() => '');
			throw new Error(`Monobank Corporate помилка /auth/request (${res.status}): ${err}`);
		}

		const data = (await res.json()) as {
			token_request_id: string;
			accept_url: string;
			qr?: string;
		};

		return {
			tokenRequestId: data.token_request_id,
			acceptUrl: data.accept_url,
			qrBase64: data.qr
		};
	}

	/**
	 * Check Corporate Auth Request Status
	 */
	async checkCorporateAuthStatus(params: {
		tokenRequestId: string;
		keyId: string;
		baseUrl?: string;
		fetcher?: typeof fetch;
	}): Promise<{ status: 'processing' | 'approved' | 'rejected'; token?: string }> {
		const fetcher = params.fetcher || fetch;
		const baseUrl = (params.baseUrl || this.defaultBaseUrl).replace(/\/+$/, '');
		const url = `${baseUrl}/api/corporate/auth/request/${params.tokenRequestId}`;

		const res = await fetcher(url, {
			method: 'GET',
			headers: {
				'X-Key-Id': params.keyId,
				'X-Time': Math.floor(Date.now() / 1000).toString()
			}
		});

		if (!res.ok) {
			const err = await res.text().catch(() => '');
			throw new Error(`Monobank Corporate помилка перевірки статусу (${res.status}): ${err}`);
		}

		const data = (await res.json()) as {
			status: 'processing' | 'approved' | 'rejected';
			token?: string;
		};

		return data;
	}

	/**
	 * Set Webhook URL for statement notifications
	 */
	async setWebhookUrl(params: {
		token: string;
		webhookUrl: string;
		baseUrl?: string;
		fetcher?: typeof fetch;
	}): Promise<{ result: string }> {
		const fetcher = params.fetcher || fetch;
		const baseUrl = (params.baseUrl || this.defaultBaseUrl).replace(/\/+$/, '');
		const url = `${baseUrl}/personal/webhook`;

		const res = await fetcher(url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'X-Token': params.token
			},
			body: JSON.stringify({ webHookUrl: params.webhookUrl })
		});

		if (!res.ok) {
			const err = await res.text().catch(() => '');
			throw new Error(`Monobank помилка встановлення webhook (${res.status}): ${err}`);
		}

		return { result: 'ok' };
	}
}
