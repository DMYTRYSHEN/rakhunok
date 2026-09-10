import { describe, it, expect } from 'vitest';
import {
	buildEvidenceId,
	toMinorUnits,
	fromMinorUnits,
	defaultBankRegistry,
	PrivatBankDriver,
	ABankDriver,
	MonobankDriver,
	matchEvidenceAgainstTarget,
	referenceMatches,
	signABankRequest,
	type BoundAccount,
	type ExpectedPaymentTarget
} from './index.ts';

describe('Universal Bank Connectors', () => {
	const testAccount: BoundAccount = {
		iban: 'UA623077700000026001411123751',
		currency: 'UAH',
		name: 'ТОВ "Мерчант"',
		okpo: '12345678',
		isActive: true
	};

	describe('Utilities & Currency Precision', () => {
		it('converts decimal amounts to integer minor units without floating point drift', () => {
			expect(toMinorUnits(100.5)).toBe(10050n);
			expect(toMinorUnits('120.75')).toBe(12075n);
			expect(toMinorUnits('0.01')).toBe(1n);
			expect(toMinorUnits('5000')).toBe(500000n);
			expect(toMinorUnits('1250,99')).toBe(125099n);
		});

		it('formats minor units to readable decimal string', () => {
			expect(fromMinorUnits(10050n)).toBe('100.50');
			expect(fromMinorUnits(1n)).toBe('0.01');
			expect(fromMinorUnits(500000n)).toBe('5000.00');
			expect(fromMinorUnits(-250n)).toBe('-2.50');
		});

		it('builds canonical, deterministic URN evidence IDs', () => {
			const id1 = buildEvidenceId('privatbank', 'UA623077700000026001411123751', 'REF123_456');
			expect(id1).toBe('urn:bank:privatbank:UA623077700000026001411123751:REF123_456');

			// Case and whitespace insensitivity
			const id2 = buildEvidenceId('PrivatBank ', ' ua623077700000026001411123751 ', 'REF123_456');
			expect(id2).toBe(id1);
		});
	});

	describe('Registry & Capabilities', () => {
		it('registers all pilot banks by default', () => {
			expect(defaultBankRegistry.has('privatbank')).toBe(true);
			expect(defaultBankRegistry.has('a-bank')).toBe(true);
			expect(defaultBankRegistry.has('monobank')).toBe(true);

			const list = defaultBankRegistry.list();
			expect(list.length).toBeGreaterThanOrEqual(3);
		});

		it('reports correct capabilities for PrivatBank', () => {
			const caps = defaultBankRegistry.getCapabilities('privatbank');
			expect(caps).toBeDefined();
			expect(caps?.authType).toBe('static_token');
			expect(caps?.syncMode).toBe('polling_only');
			expect(caps?.requiresEgressAllowlist).toBe(true);
			expect(caps?.rateLimit.maxRps).toBe(1);
		});

		it('reports correct capabilities for A-Bank', () => {
			const caps = defaultBankRegistry.getCapabilities('a-bank');
			expect(caps).toBeDefined();
			expect(caps?.authType).toBe('qr_consent');
			expect(caps?.syncMode).toBe('hybrid');
			expect(caps?.supportsWebhookRegistration).toBe(true);
		});

		it('reports correct capabilities for Monobank', () => {
			const caps = defaultBankRegistry.getCapabilities('monobank');
			expect(caps).toBeDefined();
			expect(caps?.supportsWebhookRegistration).toBe(true);
		});
	});

	describe('PrivatBank Driver', () => {
		const driver = new PrivatBankDriver();

		it('validates credentials properly', async () => {
			const valid = await driver.validateCredentials({ token: 'test_token_1234567890' });
			expect(valid.valid).toBe(true);

			const invalid = await driver.validateCredentials({ token: 'short' });
			expect(invalid.valid).toBe(false);
		});

		it('normalizes incoming credit transaction correctly', () => {
			const raw = {
				TRANTYPE: 'C',
				PR_PR: 'r',
				REF: 'P12345',
				REFN: '001',
				SUM: '1450.50',
				CCY: 'UAH',
				OSND: 'Оплата рахунку RAH-4812 від ФОП Шевченко',
				AUT_CNTR_NAM: 'ФОП Шевченко Т.Г.',
				AUT_CNTR_CRF: '1234567890',
				AUT_CNTR_ACC: 'UA993052990000026001111111111',
				AUT_CNTR_MFO: '305299',
				DATE_TIME_DAT_OD_TIM_P: '10.09.2026 14:30:00'
			};

			const normalized = driver.normalizeTransaction(raw, testAccount);

			expect(normalized.evidenceId).toBe('urn:bank:privatbank:UA623077700000026001411123751:P12345_001');
			expect(normalized.amountMinor).toBe(145050n);
			expect(normalized.currency).toBe('UAH');
			expect(normalized.direction).toBe('credit');
			expect(normalized.status).toBe('booked');
			expect(normalized.counterparty.name).toBe('ФОП Шевченко Т.Г.');
			expect(normalized.counterparty.okpo).toBe('1234567890');
		});
	});

	describe('A-Bank Driver & Ed25519 Cryptography', () => {
		const driver = new ABankDriver();

		it('normalizes A-Bank payments-list transactions', () => {
			const raw = {
				id: 887766,
				bill_id: 11223344,
				created: '2026-09-10T14:30:00',
				status: 3,
				credit_iban: testAccount.iban,
				credit_okpo: testAccount.okpo,
				debit_iban: 'UA173077700000026205061543958',
				debit_name: 'Іваненко І.І.',
				debit_okpo: '3344556677',
				purpose: 'Оплата замовлення #RAH-4812',
				currency: 'UAH',
				sum: 2500.0,
				fee: 12.5,
				timestamp: 1788964200000
			};

			const normalized = driver.normalizeTransaction(raw, testAccount);

			expect(normalized.evidenceId).toBe('urn:bank:a-bank:UA623077700000026001411123751:887766_11223344');
			expect(normalized.amountMinor).toBe(250000n);
			expect(normalized.feeMinor).toBe(1250n);
			expect(normalized.direction).toBe('credit');
			expect(normalized.status).toBe('booked');
			expect(normalized.counterparty.name).toBe('Іваненко І.І.');
		});

		it('generates valid 128-hex character Ed25519 signature', async () => {
			const cryptoMod = await import('node:crypto');
			const { privateKey } = cryptoMod.generateKeyPairSync('ed25519');
			const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }) as string;

			const timestamp = 1779962973407;
			const body = JSON.stringify({ request_ref: 'test-ref-123' });

			const signature = await signABankRequest(timestamp, body, privateKeyPem);

			expect(typeof signature).toBe('string');
			expect(signature.length).toBe(128); // 64 bytes = 128 hex chars
			expect(/^[0-9a-f]{128}$/.test(signature)).toBe(true);
		});

		it('verifies incoming A-Bank webhook', async () => {
			const webhookBody = JSON.stringify({
				id: 998877,
				credit_iban: testAccount.iban,
				sum: 350.0,
				currency: 'UAH',
				purpose: 'Оплата замовлення RAH-4812',
				debit_name: 'Петренко'
			});

			const res = await driver.verifyWebhook({
				headers: {},
				rawBody: webhookBody,
				account: testAccount
			});

			expect(res.isValid).toBe(true);
			expect(res.bankEventId).toBe('998877');
			expect(res.normalizedEvidence?.amountMinor).toBe(35000n);
			expect(res.normalizedEvidence?.purpose).toBe('Оплата замовлення RAH-4812');
		});
	});

	describe('Monobank Driver', () => {
		const driver = new MonobankDriver();

		it('normalizes native statement items in minor units (kopiiky)', () => {
			const raw = {
				id: 'mono_tx_991122',
				time: 1788964200,
				description: 'Оплата рахунку RAH-4812',
				amount: 50000, // 500.00 UAH in minor units
				currencyCode: 980,
				counterName: 'ТОВ Партнер',
				counterIban: 'UA993052990000026001111111111'
			};

			const normalized = driver.normalizeTransaction(raw, testAccount);

			expect(normalized.evidenceId).toBe('urn:bank:monobank:UA623077700000026001411123751:mono_tx_991122');
			expect(normalized.amountMinor).toBe(50000n);
			expect(normalized.currency).toBe('UAH');
			expect(normalized.direction).toBe('credit');
			expect(normalized.status).toBe('booked');
		});

		it('normalizes acquiring invoice statement items', () => {
			const raw = {
				invoiceId: 'inv_mono_123',
				status: 'success' as const,
				amount: 120000, // 1200.00 UAH
				ccy: 980,
				createdDate: '2026-09-10T14:00:00Z',
				modifiedDate: '2026-09-10T14:02:00Z',
				reference: 'RAH-4812',
				destination: 'Оплата замовлення #RAH-4812'
			};

			const normalized = driver.normalizeTransaction(raw, testAccount);

			expect(normalized.evidenceId).toBe('urn:bank:monobank:UA623077700000026001411123751:inv_mono_123');
			expect(normalized.amountMinor).toBe(120000n);
			expect(normalized.status).toBe('booked');
			expect(normalized.purpose).toBe('Оплата замовлення #RAH-4812');
		});
	});

	describe('Payment Matching Engine', () => {
		const targetInvoice: ExpectedPaymentTarget = {
			orderId: 'order-101',
			invoiceId: 'inv-202',
			referenceCode: 'RAH-4812',
			recipientIban: testAccount.iban,
			amountMinor: 150000n, // 1500.00 UAH
			currency: 'UAH'
		};

		it('identifies strict exact match with perfect confidence', () => {
			const evidence = {
				evidenceId: 'urn:test:1',
				bankId: 'privatbank',
				accountId: testAccount.iban,
				bankTxId: 'tx1',
				amountMinor: 150000n,
				currency: 'UAH',
				direction: 'credit' as const,
				status: 'booked' as const,
				purpose: 'Оплата згідно рахунку № RAH-4812 від 10.09.2026',
				bookingDate: '2026-09-10T14:30:00Z',
				counterparty: { name: 'Клієнт' }
			};

			const result = matchEvidenceAgainstTarget(evidence, targetInvoice);
			expect(result.decision).toBe('matched');
			expect(result.confidenceScore).toBe(1.0);
			expect(result.differenceMinor).toBe(0n);
		});

		it('handles # prefix variation in payment references', () => {
			expect(referenceMatches('Оплата #RAH-4812', 'RAH-4812')).toBe(true);
			expect(referenceMatches('Оплата RAH-4812', '#RAH-4812')).toBe(true);
			expect(referenceMatches('Оплата замовлення 4812-A', '4812-A')).toBe(true);
		});

		it('flags underpaid transactions with exact difference', () => {
			const evidence = {
				evidenceId: 'urn:test:2',
				bankId: 'privatbank',
				accountId: testAccount.iban,
				bankTxId: 'tx2',
				amountMinor: 140000n, // 1400.00 UAH instead of 1500.00
				currency: 'UAH',
				direction: 'credit' as const,
				status: 'booked' as const,
				purpose: 'Оплата RAH-4812',
				bookingDate: '2026-09-10T14:30:00Z',
				counterparty: { name: 'Клієнт' }
			};

			const result = matchEvidenceAgainstTarget(evidence, targetInvoice);
			expect(result.decision).toBe('underpaid');
			expect(result.differenceMinor).toBe(-10000n); // Short by 100 UAH (10000 kopiiky)
		});

		it('flags overpaid transactions with exact difference', () => {
			const evidence = {
				evidenceId: 'urn:test:3',
				bankId: 'privatbank',
				accountId: testAccount.iban,
				bankTxId: 'tx3',
				amountMinor: 160000n, // 1600.00 UAH instead of 1500.00
				currency: 'UAH',
				direction: 'credit' as const,
				status: 'booked' as const,
				purpose: 'Оплата RAH-4812 з чайовими',
				bookingDate: '2026-09-10T14:30:00Z',
				counterparty: { name: 'Клієнт' }
			};

			const result = matchEvidenceAgainstTarget(evidence, targetInvoice);
			expect(result.decision).toBe('overpaid');
			expect(result.differenceMinor).toBe(10000n); // Over by 100 UAH
		});

		it('rejects payments with mismatched recipient account', () => {
			const evidence = {
				evidenceId: 'urn:test:4',
				bankId: 'privatbank',
				accountId: 'UA993052990000026009999999999', // Different IBAN
				bankTxId: 'tx4',
				amountMinor: 150000n,
				currency: 'UAH',
				direction: 'credit' as const,
				status: 'booked' as const,
				purpose: 'Оплата RAH-4812',
				bookingDate: '2026-09-10T14:30:00Z',
				counterparty: { name: 'Клієнт' }
			};

			const result = matchEvidenceAgainstTarget(evidence, targetInvoice);
			expect(result.decision).toBe('wrong_recipient');
		});

		it('flags transactions with exact amount but unreadable purpose as ambiguous for manual review', () => {
			const evidence = {
				evidenceId: 'urn:test:5',
				bankId: 'privatbank',
				accountId: testAccount.iban,
				bankTxId: 'tx5',
				amountMinor: 150000n, // Exact amount
				currency: 'UAH',
				direction: 'credit' as const,
				status: 'booked' as const,
				purpose: 'Переказ власних коштів без номера', // No code!
				bookingDate: '2026-09-10T14:30:00Z',
				counterparty: { name: 'Клієнт' }
			};

			const result = matchEvidenceAgainstTarget(evidence, targetInvoice);
			expect(result.decision).toBe('ambiguous');
			expect(result.confidenceScore).toBe(0.4);
		});
	});
});
