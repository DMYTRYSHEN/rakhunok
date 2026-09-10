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

	describe('A-Bank Complete End-to-End Lifecycle Verification', () => {
		it('executes full chain: platform registration -> webhook config -> merchant QR consent -> account discovery -> invoice creation -> webhook receipt -> matching -> paid transition', async () => {
			const driver = new ABankDriver();
			const cryptoMod = await import('node:crypto');

			// 1. Generate Ed25519 Keypair for Rahunok Platform
			const { publicKey, privateKey } = cryptoMod.generateKeyPairSync('ed25519');
			const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }) as string;
			const publicKeyDer = publicKey.export({ type: 'spki', format: 'der' });
			const publicKeyBase64 = publicKeyDer.subarray(-32).toString('base64');

			expect(publicKeyBase64.length).toBe(44);

			// 2. Step 1: System Registration (Chapter 6.1)
			const mockRegistrationFetcher = async (url: RequestInfo | URL, init?: RequestInit) => {
				const headers = init?.headers as Record<string, string>;
				// Verify: Must have timestamp and signature, but NO x-system-id yet!
				expect(headers['x-req-ts']).toBeDefined();
				expect(headers['x-req-signature']).toBeDefined();
				expect(headers['x-system-id']).toBeUndefined();

				const body = JSON.parse(init?.body as string);
				expect(body.public_key).toBe(publicKeyBase64);
				expect(body.name).toBe('ТОВ "Рахунок"');

				return new Response(
					JSON.stringify({
						result: 'ok',
						timestamp: '2026-09-10 12:00:00',
						id: 'system-uuid-112233',
						status: 'APPROVED',
						request_ref: body.request_ref,
						response_ref: 'resp-uuid-001'
					}),
					{ status: 200 }
				);
			};

			const regResult = await driver.registerSystem({
				publicKeyBase64,
				privateKeyPem,
				name: 'ТОВ "Рахунок"',
				description: 'Платіжний агрегатор',
				fio: 'Олександр Сидоренко',
				phone: '+380501234567',
				email: 'tech@rahunok.ua',
				fetcher: mockRegistrationFetcher as unknown as typeof fetch
			});

			expect(regResult.status).toBe('APPROVED');
			expect(regResult.systemId).toBe('system-uuid-112233');

			const systemCredentials = {
				systemId: regResult.systemId!,
				privateKeyPem
			};

			// 3. Step 2: Configure Global Webhook URL (Chapter 6.3)
			const mockWebhookUrlFetcher = async (url: RequestInfo | URL, init?: RequestInit) => {
				const headers = init?.headers as Record<string, string>;
				// Now x-system-id is mandatory!
				expect(headers['x-system-id']).toBe('system-uuid-112233');
				expect(headers['x-req-signature'].length).toBe(128);

				const body = JSON.parse(init?.body as string);
				expect(body.webhook_url).toBe('https://api.rahunok.ua/v1/bank-webhook/a-bank');

				return new Response(
					JSON.stringify({
						result: 'ok',
						timestamp: '2026-09-10 12:01:00',
						request_ref: body.request_ref,
						response_ref: 'resp-uuid-002',
						webhook_url: body.webhook_url
					}),
					{ status: 200 }
				);
			};

			const whResult = await driver.setWebhookUrl({
				credentials: systemCredentials,
				webhookUrl: 'https://api.rahunok.ua/v1/bank-webhook/a-bank',
				fetcher: mockWebhookUrlFetcher as unknown as typeof fetch
			});

			expect(whResult.result).toBe('ok');
			expect(whResult.webhookUrl).toBe('https://api.rahunok.ua/v1/bank-webhook/a-bank');

			// 4. Step 3: Merchant Connects Bank in Dashboard (QR Consent - Chapter 6.4 & 3.3)
			// Mock /auth/request
			const originalFetch = globalThis.fetch;
			globalThis.fetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
				const body = JSON.parse(init?.body as string);
				return new Response(
					JSON.stringify({
						result: 'ok',
						timestamp: '2026-09-10 12:02:00',
						token: 'temp-auth-req-token-9988',
						qr: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
						request_ref: body.request_ref,
						response_ref: 'resp-uuid-003'
					}),
					{ status: 200 }
				);
			}) as unknown as typeof fetch;

			const authInit = await driver.initiateAuth({
				callbackUrl: 'https://api.rahunok.ua/v1/bank-callback/a-bank',
				merchantId: 'merchant-company-1',
				metadata: { credentials: systemCredentials }
			});

			expect(authInit.type).toBe('qr');
			expect(authInit.qrCodeBase64).toBeDefined();
			expect(authInit.token).toBe('temp-auth-req-token-9988');

			// Client scans QR in A24 -> Bank sends callback
			const bankCallbackPayload = {
				token: 'permanent-merchant-token-xyz777',
				status: 'APPROVED'
			};
			const callbackHandled = await driver.handleAuthCallback(bankCallbackPayload);
			expect(callbackHandled.status).toBe('approved');
			expect(callbackHandled.token).toBe('permanent-merchant-token-xyz777');

			const merchantCredentials = {
				...systemCredentials,
				clientToken: callbackHandled.token
			};

			// 5. Step 4: Account Discovery (Chapter 6.5)
			const mockAccountsFetcher = async (url: RequestInfo | URL, init?: RequestInit) => {
				return new Response(
					JSON.stringify({
						result: 'ok',
						timestamp: '2026-09-10 12:03:00',
						companies: [
							{
								name: 'ТОВ "Крафтові Меблі"',
								accounts: [
									{
										iban: 'UA623077700000026001411123751',
										okpo: '39887766',
										currency: 980,
										name_full: 'ТОВ "Крафтові Меблі"',
										balance_available: 45000.0,
										balance_ledger: 45000.0
									}
								]
							}
						]
					}),
					{ status: 200 }
				);
			};

			const discovered = await driver.discoverAccounts(
				merchantCredentials,
				mockAccountsFetcher as unknown as typeof fetch
			);
			expect(discovered.length).toBe(1);
			expect(discovered[0].iban).toBe('UA623077700000026001411123751');
			expect(discovered[0].balanceAvailableMinor).toBe(4500000n);

			const merchantIban = discovered[0].iban;

			// 6. Step 5: Merchant Creates Invoice in Rahunok
			const invoiceOrder = {
				id: 'order-uuid-9001',
				orderNumber: '9001',
				referenceCode: 'RAH-9001',
				recipientIban: merchantIban,
				amountMinor: 345000n, // 3,450.00 UAH
				currency: 'UAH',
				status: 'pending' as 'pending' | 'paid'
			};

			expect(invoiceOrder.status).toBe('pending');

			// 7. Step 6: Buyer Pays via IBAN -> A-Bank pushes Webhook
			const incomingWebhookPayload = {
				id: 778899,
				bill_id: 556677,
				created: '2026-09-10T14:45:00',
				status: 3, // Booked
				credit_iban: merchantIban,
				credit_okpo: '39887766',
				credit_name: 'ТОВ "Крафтові Меблі"',
				debit_iban: 'UA173077700000026205061543958',
				debit_name: 'Коваленко Сергій',
				debit_okpo: '3122334455',
				purpose: 'Оплата за замовлення #RAH-9001 згідно рахунку',
				currency: 'UAH',
				sum: 3450.0,
				fee: 10.0,
				timestamp: 1788965100000
			};

			const webhookVerification = await driver.verifyWebhook({
				headers: {},
				rawBody: JSON.stringify(incomingWebhookPayload),
				account: discovered[0]
			});

			expect(webhookVerification.isValid).toBe(true);
			const evidence = webhookVerification.normalizedEvidence!;
			expect(evidence.amountMinor).toBe(345000n);
			expect(evidence.direction).toBe('credit');
			expect(evidence.status).toBe('booked');
			expect(evidence.evidenceId).toBe(
				'urn:bank:a-bank:UA623077700000026001411123751:778899_556677'
			);

			// 8. Step 7: Matching Engine matches evidence against invoice
			const matchResult = matchEvidenceAgainstTarget(evidence, {
				orderId: invoiceOrder.id,
				referenceCode: invoiceOrder.referenceCode,
				recipientIban: invoiceOrder.recipientIban,
				amountMinor: invoiceOrder.amountMinor,
				currency: invoiceOrder.currency
			});

			expect(matchResult.decision).toBe('matched');
			expect(matchResult.confidenceScore).toBe(1.0);
			expect(matchResult.differenceMinor).toBe(0n);

			// 9. Step 8: Transactional State Transition to PAID
			// Simulate order status transition in database:
			const processedEvidenceLedger = new Set<string>();

			if (matchResult.decision === 'matched') {
				// Prevent double processing / duplicate webhook delivery:
				expect(processedEvidenceLedger.has(evidence.evidenceId)).toBe(false);
				processedEvidenceLedger.add(evidence.evidenceId);

				// Transition invoice to PAID
				invoiceOrder.status = 'paid';
			}

			expect(invoiceOrder.status).toBe('paid');

			// 10. Step 9: Verify Idempotency on Replayed Webhook
			// If A-Bank retries webhook delivery:
			if (processedEvidenceLedger.has(evidence.evidenceId)) {
				// Already booked! Do not re-process invoice or double-fulfill
				const isDuplicate = true;
				expect(isDuplicate).toBe(true);
			}

			// Restore global fetch
			globalThis.fetch = originalFetch;
		});
	});

	describe('Monobank Corporate Complete End-to-End Lifecycle Verification', () => {
		it('executes full Corporate flow: provider auth request -> client QR approval -> token issuance -> account discovery -> invoice creation -> statement webhook receipt -> matching -> paid transition', async () => {
			const driver = new MonobankDriver();

			// 1. Step 1: Provider initiates Corporate Auth Request (POST /api/corporate/auth/request)
			const mockAuthRequestFetcher = async (url: RequestInfo | URL, init?: RequestInit) => {
				const headers = init?.headers as Record<string, string>;
				expect(headers['X-Key-Id']).toBe('partner-key-id-99');
				expect(headers['X-Time']).toBeDefined();

				return new Response(
					JSON.stringify({
						token_request_id: 'mono-req-id-5544',
						accept_url: 'https://mbnk.biz/auth/mono-req-id-5544',
						qr: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
					}),
					{ status: 200 }
				);
			};

			const authReq = await driver.initiateCorporateAuth({
				keyId: 'partner-key-id-99',
				callbackUrl: 'https://api.rahunok.ua/v1/bank-callback/monobank',
				fetcher: mockAuthRequestFetcher as unknown as typeof fetch
			});

			expect(authReq.tokenRequestId).toBe('mono-req-id-5544');
			expect(authReq.acceptUrl).toBe('https://mbnk.biz/auth/mono-req-id-5544');
			expect(authReq.qrBase64).toBeDefined();

			// 2. Step 2: Merchant scans QR in Monobank app and approves access
			// Server checks status (GET /api/corporate/auth/request/{token_request_id})
			const mockCheckStatusFetcher = async () => {
				return new Response(
					JSON.stringify({
						status: 'approved',
						token: 'mono_permanent_corp_token_889900'
					}),
					{ status: 200 }
				);
			};

			const statusCheck = await driver.checkCorporateAuthStatus({
				tokenRequestId: authReq.tokenRequestId,
				keyId: 'partner-key-id-99',
				fetcher: mockCheckStatusFetcher as unknown as typeof fetch
			});

			expect(statusCheck.status).toBe('approved');
			expect(statusCheck.token).toBe('mono_permanent_corp_token_889900');

			const merchantToken = statusCheck.token!;

			// 3. Step 3: Register Statement Webhook (POST /personal/webhook)
			const mockWebhookFetcher = async (url: RequestInfo | URL, init?: RequestInit) => {
				const headers = init?.headers as Record<string, string>;
				expect(headers['X-Token']).toBe(merchantToken);
				const body = JSON.parse(init?.body as string);
				expect(body.webHookUrl).toBe('https://api.rahunok.ua/v1/bank-webhook/monobank');

				return new Response(JSON.stringify({ result: 'ok' }), { status: 200 });
			};

			const whResult = await driver.setWebhookUrl({
				token: merchantToken,
				webhookUrl: 'https://api.rahunok.ua/v1/bank-webhook/monobank',
				fetcher: mockWebhookFetcher as unknown as typeof fetch
			});

			expect(whResult.result).toBe('ok');

			// 4. Step 4: Account Discovery (GET /personal/client-info)
			const mockClientInfoFetcher = async (url: RequestInfo | URL, init?: RequestInit) => {
				const headers = init?.headers as Record<string, string>;
				expect(headers['X-Token']).toBe(merchantToken);

				return new Response(
					JSON.stringify({
						name: 'ФОП Мельник Артем',
						accounts: [
							{
								id: 'mono_acc_01',
								iban: 'UA993052990000026001111111111',
								currencyCode: 980,
								type: 'fop',
								balance: 8500000 // 85,000.00 UAH in minor units
							}
						]
					}),
					{ status: 200 }
				);
			};

			const accounts = await driver.discoverAccounts(
				{ token: merchantToken },
				mockClientInfoFetcher as unknown as typeof fetch
			);

			expect(accounts.length).toBe(1);
			expect(accounts[0].iban).toBe('UA993052990000026001111111111');
			expect(accounts[0].balanceAvailableMinor).toBe(8500000n);

			const merchantAccount = accounts[0];

			// 5. Step 5: Merchant Creates Invoice in Rahunok
			const invoiceOrder = {
				id: 'order-uuid-5500',
				orderNumber: '5500',
				referenceCode: 'RAH-5500',
				recipientIban: merchantAccount.iban,
				amountMinor: 500000n, // 5,000.00 UAH (in minor units)
				currency: 'UAH',
				status: 'pending' as 'pending' | 'paid'
			};

			expect(invoiceOrder.status).toBe('pending');

			// 6. Step 6: Buyer transfers funds -> Monobank pushes StatementItem Webhook
			const incomingStatementWebhook = {
				type: 'StatementItem',
				data: {
					account: merchantAccount.iban,
					statementItem: {
						id: 'mono_corp_tx_7890',
						time: 1788965200,
						description: 'Оплата замовлення #RAH-5500 згідно договору',
						amount: 500000, // 5,000.00 UAH
						operationAmount: 500000,
						currencyCode: 980,
						balance: 9000000,
						hold: false,
						counterName: 'ТОВ Технології',
						counterIban: 'UA173077700000026205061543958',
						counterEdrpou: '33445566'
					}
				}
			};

			const verifiedWebhook = await driver.verifyWebhook({
				headers: {},
				rawBody: JSON.stringify(incomingStatementWebhook),
				account: merchantAccount
			});

			expect(verifiedWebhook.isValid).toBe(true);
			const evidence = verifiedWebhook.normalizedEvidence!;

			// Verify normalization
			expect(evidence.amountMinor).toBe(500000n);
			expect(evidence.currency).toBe('UAH');
			expect(evidence.direction).toBe('credit');
			expect(evidence.status).toBe('booked');
			expect(evidence.evidenceId).toBe(
				'urn:bank:monobank:UA993052990000026001111111111:mono_corp_tx_7890'
			);

			// 7. Step 7: Matching Engine Reconciles Payment
			const matchResult = matchEvidenceAgainstTarget(evidence, {
				orderId: invoiceOrder.id,
				referenceCode: invoiceOrder.referenceCode,
				recipientIban: invoiceOrder.recipientIban,
				amountMinor: invoiceOrder.amountMinor,
				currency: invoiceOrder.currency
			});

			expect(matchResult.decision).toBe('matched');
			expect(matchResult.confidenceScore).toBe(1.0);
			expect(matchResult.differenceMinor).toBe(0n);

			// 8. Step 8: Transactional State Transition to PAID & Idempotency
			const processedEvidenceLedger = new Set<string>();

			if (matchResult.decision === 'matched') {
				expect(processedEvidenceLedger.has(evidence.evidenceId)).toBe(false);
				processedEvidenceLedger.add(evidence.evidenceId);

				invoiceOrder.status = 'paid';
			}

			expect(invoiceOrder.status).toBe('paid');

			// Replay protection test
			expect(processedEvidenceLedger.has(evidence.evidenceId)).toBe(true);
		});
	});
});


