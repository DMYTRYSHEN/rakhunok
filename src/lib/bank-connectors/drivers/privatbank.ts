/**
 * PrivatBank AutoClient 3.0 Driver
 * Official API for Legal Entities & Sole Proprietors (Приват24 для бізнесу)
 */

import type { BankConnectorDriver } from '../driver.ts';
import { buildEvidenceId, toMinorUnits } from '../driver.ts';
import type {
	BankCapabilities,
	BoundAccount,
	BankSyncWindow,
	BankSyncResult,
	CredentialsValidationResult,
	NormalizedBankEvidence
} from '../types.ts';

export interface PrivatBankCredentials {
	token: string;
	clientId?: string;
	baseUrl?: string;
}

export interface RawPrivatTransaction {
	TRANTYPE: 'C' | 'D' | string; // 'C' = Credit, 'D' = Debit
	PR_PR: 'r' | 'e' | 'b' | string; // 'r' = recorded/booked
	REF: string;
	REFN: string;
	SUM: string | number;
	CCY: string;
	OSND: string; // Payment reference
	AUT_CNTR_NAM?: string;
	AUT_CNTR_CRF?: string; // OKPO / EDRPOU
	AUT_CNTR_ACC?: string; // Counterparty IBAN
	AUT_CNTR_MFO?: string;
	DATE_TIME_DAT_OD_TIM_P?: string; // Booking time, e.g. "18.12.2019 14:50:57"
	[key: string]: unknown;
}

export const privatBankCapabilities: BankCapabilities = {
	authType: 'static_token',
	syncMode: 'polling_only',
	paginationType: 'cursor',
	rateLimit: {
		maxRps: 1, // PrivatBank AutoClient strictly limits to 1 request/sec per token
		windowSeconds: 1,
		scope: 'token'
	},
	supportedCurrencies: ['UAH', 'USD', 'EUR'],
	requiresEgressAllowlist: true,
	supportsAccountDiscovery: true,
	supportsBalanceCheck: true,
	supportsWebhookRegistration: false
};

export class PrivatBankDriver implements BankConnectorDriver {
	readonly id = 'privatbank';
	readonly name = 'ПриватБанк (Автоклієнт 3.0)';
	readonly capabilities = privatBankCapabilities;

	private readonly defaultBaseUrl = 'https://acp.privatbank.ua/api';

	private getBaseUrl(creds: PrivatBankCredentials): string {
		return (creds.baseUrl || this.defaultBaseUrl).replace(/\/+$/, '');
	}

	private getHeaders(creds: PrivatBankCredentials): Record<string, string> {
		const headers: Record<string, string> = {
			Accept: 'application/json',
			'User-Agent': 'Rahunok-Corex/1.0',
			token: creds.token
		};
		if (creds.clientId) {
			headers.id = creds.clientId;
		}
		return headers;
	}

	async validateCredentials(credentials: unknown): Promise<CredentialsValidationResult> {
		const creds = credentials as Partial<PrivatBankCredentials>;
		if (!creds?.token || typeof creds.token !== 'string' || creds.token.trim().length < 10) {
			return {
				valid: false,
				error: 'Токен ПриватБанку повинен містити не менше 10 символів'
			};
		}
		return { valid: true };
	}

	async discoverAccounts(credentials: unknown, fetcher: typeof fetch = fetch): Promise<BoundAccount[]> {
		const creds = credentials as PrivatBankCredentials;
		const url = `${this.getBaseUrl(creds)}/proxy/accounts`;

		try {
			const res = await fetcher(url, {
				method: 'GET',
				headers: this.getHeaders(creds)
			});

			if (!res.ok) {
				const errorText = await res.text().catch(() => '');
				throw new Error(`ПриватБанк повернув статус ${res.status}: ${errorText}`);
			}

			const data = (await res.json()) as {
				accounts?: Array<{
					acc?: string;
					currency?: string;
					name?: string;
					balance?: string | number;
					[key: string]: unknown;
				}>;
			};

			const list = Array.isArray(data.accounts) ? data.accounts : [];
			return list
				.filter((a) => a.acc && a.acc.startsWith('UA'))
				.map((a) => ({
					iban: a.acc!,
					currency: a.currency || 'UAH',
					name: a.name || `Рахунок ${a.acc}`,
					isActive: true,
					balanceAvailableMinor: a.balance != null ? toMinorUnits(a.balance) : undefined,
					raw: a
				}));
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : String(err);
			throw new Error(`Помилка отримання рахунків ПриватБанку: ${message}`);
		}
	}

	async fetchStatement(params: {
		account: BoundAccount;
		credentials: unknown;
		window: BankSyncWindow;
		fetcher?: typeof fetch;
	}): Promise<BankSyncResult> {
		const creds = params.credentials as PrivatBankCredentials;
		const fetcher = params.fetcher || fetch;
		const iban = params.account.iban.trim();

		// Format dates to dd-MM-yyyy expected by PrivatBank
		const formatDate = (d: Date) => {
			const day = d.getDate().toString().padStart(2, '0');
			const month = (d.getMonth() + 1).toString().padStart(2, '0');
			const year = d.getFullYear();
			return `${day}-${month}-${year}`;
		};

		const startDate = formatDate(params.window.from);
		const endDate = formatDate(params.window.to);

		let url = `${this.getBaseUrl(creds)}/proxy/transactions?acc=${encodeURIComponent(
			iban
		)}&startDate=${startDate}&endDate=${endDate}&limit=${params.window.limit || 100}`;

		if (params.window.cursor) {
			url += `&followId=${encodeURIComponent(params.window.cursor)}`;
		}

		const res = await fetcher(url, {
			method: 'GET',
			headers: this.getHeaders(creds)
		});

		if (!res.ok) {
			const text = await res.text().catch(() => '');
			throw new Error(`ПриватБанк помилка виписки ${res.status}: ${text}`);
		}

		const data = (await res.json()) as {
			transactions?: RawPrivatTransaction[];
			followId?: string;
			hasMore?: boolean;
		};

		const rawTransactions = Array.isArray(data.transactions) ? data.transactions : [];
		const records = rawTransactions
			.filter((tx) => tx.TRANTYPE === 'C' && (tx.PR_PR === 'r' || !tx.PR_PR))
			.map((tx) => this.normalizeTransaction(tx, params.account));

		return {
			records,
			nextCursor: data.followId || undefined,
			hasMore: Boolean(data.hasMore || (data.followId && rawTransactions.length >= 100))
		};
	}

	normalizeTransaction(raw: unknown, account: BoundAccount): NormalizedBankEvidence {
		const tx = raw as RawPrivatTransaction;
		const compositeTxId = `${tx.REF || ''}_${tx.REFN || ''}`.trim() || 'unknown';
		const evidenceId = buildEvidenceId(this.id, account.iban, compositeTxId);

		let bookingIso = new Date().toISOString();
		if (tx.DATE_TIME_DAT_OD_TIM_P) {
			// Format: "18.12.2019 14:50:57" -> ISO
			const match = tx.DATE_TIME_DAT_OD_TIM_P.match(
				/^(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2}):(\d{2})/
			);
			if (match) {
				const [, d, m, y, h, min, s] = match;
				bookingIso = new Date(`${y}-${m}-${d}T${h}:${min}:${s}Z`).toISOString();
			}
		}

		return {
			evidenceId,
			bankId: this.id,
			accountId: account.iban,
			bankTxId: compositeTxId,
			amountMinor: toMinorUnits(tx.SUM),
			currency: (tx.CCY || account.currency || 'UAH').toUpperCase(),
			direction: tx.TRANTYPE === 'C' ? 'credit' : 'debit',
			status: tx.PR_PR === 'r' ? 'booked' : 'pending',
			purpose: tx.OSND || '',
			bookingDate: bookingIso,
			counterparty: {
				name: tx.AUT_CNTR_NAM,
				okpo: tx.AUT_CNTR_CRF,
				iban: tx.AUT_CNTR_ACC,
				mfo: tx.AUT_CNTR_MFO
			},
			rawPayload: tx
		};
	}
}
