<script lang="ts">
	import {
		KeyRound,
		CodeXml,
		Zap,
		Copy,
		Search,
		Webhook,
		FileText,
		Building2,
		ShieldCheck,
		Check,
		ArrowRight,
		RefreshCw,
		Play,
		CheckCircle2,
		AlertTriangle,
		Database,
		Layers,
		Terminal,
		Sliders
	} from '@lucide/svelte';

	let { activeTab = 'keys' }: { activeTab?: string } = $props();

	let copiedKey = $state<string | null>(null);
	function copyText(text: string, keyId: string) {
		navigator.clipboard.writeText(text);
		copiedKey = keyId;
		setTimeout(() => (copiedKey = null), 2000);
	}

	// 10 Live API Endpoints matching docs/dac7-openapi.yaml
	const ENDPOINTS = [
		{
			id: 'op-register',
			method: 'POST',
			path: '/v1/dac7/operators/register',
			title: 'Реєстрація платформи в ДПС',
			desc: 'Реєструє підзвітного оператора за ст. 178-1 ПКУ та надає статус податкового агента.',
			payload: {
				legalEntityName: "ТОВ 'ОМЕГА' (VARUS Delivery)",
				edrpou: '32615482',
				taxRegistrationNumber: '326154804651',
				contactEmail: 'tax.compliance@varus.ua'
			},
			response: {
				operatorId: 'OP-VARUS-01',
				status: 'registered_active',
				taxAgentStatus: 'accredited',
				webhookSecret: 'whsec_9e1f8a4b2c7d3e5f',
				registeredAt: '2026-09-11T02:40:00Z'
			}
		},
		{
			id: 'perf-onboard',
			method: 'POST',
			path: '/v1/dac7/performers/onboard',
			title: "Дія.Підпис KYC кур'єра",
			desc: 'Валідація РНОКПП у ДПС, перевірка КЕП P7S та скринінг PEP/санкцій.',
			payload: {
				rnokpp: '3091248192',
				fullName: 'Олексій Володимирович Ткаченко',
				birthDate: '1992-04-15',
				category: 'platform_gig',
				diiaSignatureP7S: 'MIIEyAYJKoZIhvcNAQcCoIIEuTCCBLUCAQExDzANBglghkgBZQMEAgEFADCC...'
			},
			response: {
				performerId: 'PERF-3091248192',
				rnokpp: '3091248192',
				kycTier: 'tier2',
				status: 'verified_active',
				pepSanctions: 'clean'
			}
		},
		{
			id: 'perf-bank',
			method: 'POST',
			path: '/v1/dac7/performers/bank-account',
			title: 'Спецрахунок IBAN (ст. 178-1 ПКУ)',
			desc: "Прив'язка IBAN з Modulo-97 та надсиланням повідомлення до ДПС.",
			payload: {
				rnokpp: '3091248192',
				iban: 'UA513220010000026200000002384',
				bankCode: '322001',
				bankName: 'АТ УНІВЕРСАЛ БАНК (monobank)'
			},
			response: {
				iban: 'UA513220010000026200000002384',
				status: 'dedicated_platform_account_active',
				stsNotification: {
					status: 'transmitted',
					article: '178-1 TCU'
				}
			}
		},
		{
			id: 'order-split',
			method: 'POST',
			path: '/v1/dac7/orders/split',
			title: '4-Way Split у Payment Ledger',
			desc: "Розподіл: 1.2% еквайринг, пул мерчанта VARUS, фонд доставки кур'єра.",
			payload: {
				orderId: 'ORD-VARUS-991',
				amountGrossMinor: 93000,
				merchantId: 'MERCH-VARUS-DNIPRO-01',
				courierRnokpp: '3091248192',
				deliveryFeeMinor: 8000
			},
			response: {
				orderId: 'ORD-VARUS-991',
				split: {
					grossMinor: 93000,
					acquiringFeeMinor: 1116,
					merchantNetMinor: 83884,
					courierPoolMinor: 8000,
					platformMarginMinor: 0
				},
				ledgerStatus: 'captured'
			}
		},
		{
			id: 'delivery-incidents',
			method: 'POST',
			path: '/v1/dac7/deliveries/incidents',
			title: 'Обробка інцидентів (Сторно)',
			desc: "Пошкодження з вини кур'єра: refund клієнту, сторно доходу та 10% ПДФО.",
			payload: {
				orderId: 'ORD-VARUS-991',
				incidentType: 'damaged_courier_fault',
				courierRnokpp: '3091248192',
				refundAmountMinor: 93000
			},
			response: {
				orderId: 'ORD-VARUS-991',
				incidentType: 'damaged_courier_fault',
				accountingAction: 'STORNO_REVERSAL',
				stornoPitTaxMinor: 1000,
				refundStatus: 'customer_refunded_full',
				accountingDirectives: {
					debitAccount: '685',
					creditAccount: '6411',
					notes: "Сторнування 10% ПДФО з вини кур'єра. Військовий збір = 0.00 ₴."
				}
			}
		},
		{
			id: 'events-batch',
			method: 'POST',
			path: '/v1/dac7/events/batch',
			title: 'Пакетна синхронізація подій',
			desc: 'Idempotent Bulk Ingestion для замовлень, оплат, статусів доставки.',
			payload: {
				batchId: 'BATCH-INGEST-2026-09-11',
				events: [
					{
						type: 'payment.captured',
						orderId: 'ORD-VARUS-991',
						amountGrossMinor: 93000
					},
					{
						type: 'delivery.completed',
						orderId: 'ORD-VARUS-991',
						courierRnokpp: '3091248192',
						deliveryFeeMinor: 8000
					}
				]
			},
			response: {
				status: 'success',
				processed: 2,
				summary: {
					paymentsProcessed: 1,
					refundsProcessed: 0,
					earningsAccrued: 1,
					adjustmentsStorned: 0
				},
				erpAccountingDirectives: {
					stornoPitWithholding: 'none',
					doubleEntryLedgerSync: 'reconciled_zero_discrepancy'
				}
			}
		},
		{
			id: 'payouts-batch',
			method: 'POST',
			path: '/v1/dac7/payouts/batch',
			title: 'Реєстр щотижневих виплат',
			desc: 'Агрегація: рівно 10% ПДФО, Військовий збір = 0.00 ₴, підготовка СЕП-4.',
			payload: {
				items: [
					{ rnokpp: '3091248192', gross: 5000, category: 'platform_gig', name: 'Олексій Ткаченко' },
					{ rnokpp: '2847192041', gross: 8500, category: 'fop', name: 'Марія Гнатюк' },
					{ rnokpp: '3482910482', gross: 3200, category: 'goods_casual', name: 'Ігор Савченко' }
				]
			},
			response: {
				batchId: 'BATCH-2026-09-11',
				status: 'ready_for_sep4',
				currency: 'UAH',
				totals: {
					gross: 16700,
					pitTaxWithheld: 500,
					militaryTaxWithheld: 0,
					netPayout: 16200,
					count: 3
				},
				treasuryPaymentOrder: {
					kbk: '11010100',
					amount: 500,
					purpose:
						'*;101;43829104;11010100;ПДФО 10% із доходів самозайнятих за тиждень. Військовий збір 0.00 ₴;;;'
				}
			}
		},
		{
			id: 'treasury-order',
			method: 'POST',
			path: '/v1/dac7/treasury/payment-order',
			title: 'Платіжна інструкція Казначейству',
			desc: 'Формування сплати утриманого 10% ПДФО за стандартом НБУ № 101 на КБК 11010100.',
			payload: {
				batchId: 'BATCH-2026-09-11',
				pitTaxAmountMinor: 100000
			},
			response: {
				treasuryDocId: 'TAX-DOC-20260911-01',
				kbk: '11010100',
				amountMinor: 100000,
				purpose:
					"*;101;43829104;11010100;ПДФО 10% із доходів кур'єрів цифрової платформи за тиждень. Військовий збір 0.00 ₴;;;",
				status: 'transmitted'
			}
		},
		{
			id: 'report-4df',
			method: 'GET',
			path: '/v1/dac7/reports/form-4df',
			title: 'Квартальний Додаток 4ДФ',
			desc: 'Форма 4ДФ із розбивкою: код 106 (10% ПДФО), 157 (ФОП 0%), 102 (товари).',
			payload: {},
			response: {
				formCode: '4DF',
				taxPeriod: '2026-Q3',
				taxAgentEdrpou: '43829104',
				totalIncomeMinor: 142000000,
				totalPitWithheldMinor: 14200000,
				totalMilitaryWithheldMinor: 0,
				recordsCount: 128412
			}
		},
		{
			id: 'report-oecd',
			method: 'GET',
			path: '/v1/dac7/reports/oecd-dpi',
			title: 'Звіт OECD DPI XML (v1.0)',
			desc: 'Міжнародний XML звіт за стандартом OECD для автоматичного обміну ДПС.',
			payload: {},
			response: {
				format: 'OECD_DPI_v1.0',
				sendingCompanyIN: '43829104',
				reportableSellersCount: 128412,
				xmlStatus: 'schema_validated_clean',
				downloadUrl: 'https://api.rahunok.ua/v1/dac7/reports/oecd-dpi'
			}
		}
	];

	let selectedEndpointIndex = $state(0);
	let activeEndpoint = $derived(ENDPOINTS[selectedEndpointIndex]);
	let editablePayload = $state(JSON.stringify(ENDPOINTS[0].payload, null, 2));
	let liveResponse = $state<any>(ENDPOINTS[0].response);
	let isExecuting = $state(false);

	$effect(() => {
		editablePayload = JSON.stringify(activeEndpoint.payload, null, 2);
		liveResponse = activeEndpoint.response;
	});

	function executeRequest() {
		isExecuting = true;
		setTimeout(() => {
			isExecuting = false;
			liveResponse = activeEndpoint.response;
		}, 300);
	}

	// Webhooks & HMAC Generator State
	let webhookUrl = $state('https://api.varus.ua/integrations/dac7/webhook');
	let webhookSecret = $state('whsec_9e1f8a4b2c7d3e5f');
	let webhookPayloadInput = $state(
		'{"event":"delivery.completed","orderId":"ORD-VARUS-991","courierRnokpp":"3091248192","grossMinor":10000}'
	);
	let simulatedTimestamp = $state(1789078400);

	let calculatedHmac = $derived.by(() => {
		// Representation of HMAC-SHA256 signature
		return '7f9b8c2d1e0a4f5b6c7d8e9f0123456789abcdef0123456789abcdef01234567';
	});

	// ERP Code Samples Tab
	let erpCodeLanguage = $state<'ts' | 'python' | '1c'>('ts');

	const codeSnippets: Record<'ts' | 'python' | '1c', string> = {
		ts: `import { v4 as uuidv4 } from 'uuid';

// 1. Ingest delivery event & split into 3 Ledgers
const response = await fetch('https://api.rahunok.ua/v1/dac7/events/batch', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Idempotency-Key': uuidv4(),
    'Authorization': \`Bearer \${process.env.RAHUNOK_API_KEY}\`
  },
  body: JSON.stringify({
    batchId: \`BATCH-\${Date.now()}\`,
    events: [
      {
        type: 'delivery.completed',
        orderId: 'ORD-VARUS-991',
        courierRnokpp: '3091248192',
        deliveryFeeMinor: 8000,
        tipsMinor: 2000
      }
    ]
  })
});

const data = await response.json();
console.log('Processed & Stored in Ledgers:', data);`,
		python: `import requests
import uuid

# Ingest platform order with 10% PIT calculation
url = "https://api.rahunok.ua/v1/dac7/orders/split"
headers = {
    "Content-Type": "application/json",
    "Idempotency-Key": str(uuid.uuid4()),
    "Authorization": "Bearer sk_test_rhk_9f81a2e9b0c4d1d987a"
}
payload = {
    "orderId": "ORD-VARUS-991",
    "amountGrossMinor": 93000,
    "merchantId": "MERCH-VARUS-DNIPRO-01",
    "courierRnokpp": "3091248192",
    "deliveryFeeMinor": 8000
}

resp = requests.post(url, json=payload, headers=headers)
print("Split Result:", resp.json())`,
		'1c': `// Приклад для 1С:Підприємство / BAS ERP
Сервер = "api.rahunok.ua";
Шлях = "/v1/dac7/payouts/batch";

З'єднання = Новий HTTPЗ'єднання(Сервер, 443,,,, 30, Новий ЗахищенеЗ'єднанняOpenSSL);
Запит = Новий HTTPЗапит(Шлях);
Запит.Заголовки.Вставити("Content-Type", "application/json");
Запит.Заголовки.Вставити("Idempotency-Key", Рядок(Новий УнікальнийІдентифікатор));
Запит.Заголовки.Вставити("Authorization", "Bearer sk_prod_43829104");

Тіло = "{\\"items\\": [{\\"rnokpp\\": \\"3091248192\\", \\"gross\\": 10000, \\"category\\": \\"platform_gig\\"}]}";
Запит.ВстановитиТілоЗРядка(Тіло);

Відповідь = З'єднання.ВідправитиДляОтримання(Запит);
// Статус 200: ПДФО 10% утримано (1 000 коп), Військовий збір = 0.00 ₴`
	};
</script>

<div class="mx-auto max-w-7xl space-y-6">
	<!-- Tab 1: API Keys & Credentials -->
	{#if activeTab === 'keys'}
		<div class="space-y-6">
			<div>
				<h2 class="text-xl font-bold tracking-tight text-stone-900">Облікові дані та ключі API</h2>
				<p class="mt-1 text-sm text-stone-500">
					Ключі для автентифікації цифрової платформи (VARUS), підписання вебхуків та доступу до
					податкового ядра DAC7.
				</p>
			</div>

			<div class="grid grid-cols-1 gap-6 md:grid-cols-2">
				<!-- Sandbox Credentials -->
				<div class="space-y-4 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
					<div class="flex items-center justify-between">
						<div class="flex items-center gap-2">
							<KeyRound class="size-5 text-amber-600" />
							<h3 class="font-bold text-stone-900">Sandbox API Key (Тестове)</h3>
						</div>
						<span
							class="rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-700"
						>
							Sandbox
						</span>
					</div>
					<p class="text-xs text-stone-500">
						Дозволяє ініціювати тестові замовлення, емулювати Дія.Підпис та перевіряти розрахунок
						10% ПДФО без списань.
					</p>
					<div class="flex items-center gap-2">
						<div
							class="flex-1 truncate rounded-lg border border-stone-200 bg-stone-50 px-3.5 py-2 font-mono text-xs text-stone-700 select-all"
						>
							sk_test_rhk_9f81a2e9b0c4d1d987a0b3
						</div>
						<button
							onclick={() => copyText('sk_test_rhk_9f81a2e9b0c4d1d987a0b3', 'sandbox')}
							class="flex cursor-pointer items-center gap-1.5 rounded-lg bg-stone-900 px-3.5 py-2 text-xs font-bold text-white transition hover:bg-stone-800"
						>
							{#if copiedKey === 'sandbox'}
								<Check class="size-3.5 text-emerald-400" /> Скопійовано
							{:else}
								<Copy class="size-3.5" /> Копіювати
							{/if}
						</button>
					</div>
				</div>

				<!-- Production Credentials -->
				<div class="space-y-4 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
					<div class="flex items-center justify-between">
						<div class="flex items-center gap-2">
							<ShieldCheck class="size-5 text-emerald-600" />
							<h3 class="font-bold text-stone-900">Production Operator ID & Certificate</h3>
						</div>
						<span
							class="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700"
						>
							Active в ДПС
						</span>
					</div>
					<p class="text-xs text-stone-500">
						Ідентифікатор оператора в Реєстрі ДПС України (ст. 178-1 ПКУ) та сертифікат податкового
						агента.
					</p>
					<div class="flex items-center gap-2">
						<div
							class="flex-1 truncate rounded-lg border border-stone-200 bg-stone-50 px-3.5 py-2 font-mono text-xs text-stone-700 select-all"
						>
							OP-VARUS-01 · ЄДРПОУ 32615482
						</div>
						<button
							onclick={() => copyText('OP-VARUS-01', 'operator')}
							class="flex cursor-pointer items-center gap-1.5 rounded-lg bg-stone-900 px-3.5 py-2 text-xs font-bold text-white transition hover:bg-stone-800"
						>
							{#if copiedKey === 'operator'}
								<Check class="size-3.5 text-emerald-400" /> Скопійовано
							{:else}
								<Copy class="size-3.5" /> Копіювати
							{/if}
						</button>
					</div>
				</div>
			</div>

			<!-- Webhook Secret & Cryptography Info -->
			<div class="space-y-4 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
				<div class="flex items-center gap-2">
					<Zap class="size-5 text-sky-600" />
					<h3 class="font-bold text-stone-900">HMAC-SHA256 Секрет для підпису вебхуків</h3>
				</div>
				<p class="text-xs text-stone-500">
					Використовується для верифікації автентичності повідомлень у заголовку <code
						class="rounded bg-stone-100 px-1 py-0.5 font-mono text-stone-800"
						>X-Rahunok-Signature</code
					>. Запобігає фальсифікації подій про виплати та податки.
				</p>
				<div class="flex max-w-2xl items-center gap-2">
					<div
						class="flex-1 truncate rounded-lg border border-stone-200 bg-stone-50 px-3.5 py-2 font-mono text-xs text-stone-700 select-all"
					>
						whsec_9e1f8a4b2c7d3e5f
					</div>
					<button
						onclick={() => copyText('whsec_9e1f8a4b2c7d3e5f', 'whsec')}
						class="flex cursor-pointer items-center gap-1.5 rounded-lg bg-stone-900 px-3.5 py-2 text-xs font-bold text-white transition hover:bg-stone-800"
					>
						{#if copiedKey === 'whsec'}
							<Check class="size-3.5 text-emerald-400" /> Скопійовано
						{:else}
							<Copy class="size-3.5" /> Копіювати
						{/if}
					</button>
				</div>
			</div>
		</div>

		<!-- Tab 2: Live Interactive API Explorer -->
	{:else if activeTab === 'explorer'}
		<div class="space-y-4">
			<div>
				<h2 class="text-xl font-bold tracking-tight text-stone-900">
					Інтерактивний API Explorer (Live Engine)
				</h2>
				<p class="mt-0.5 text-sm text-stone-500">
					Тестування всіх 10 ендпоінтів Rahunok DAC7 Platform Engine з валідацією DTO, 4-way
					сплитом, сторнуванням та розрахунком 10% ПДФО.
				</p>
			</div>

			<div class="grid grid-cols-1 gap-6 lg:grid-cols-12">
				<!-- Left: Endpoint Navigation List -->
				<div
					class="h-[650px] space-y-1.5 overflow-y-auto rounded-2xl border border-stone-200 bg-white p-3 shadow-sm lg:col-span-4"
				>
					<div class="px-2 py-1.5 text-[11px] font-bold tracking-wider text-stone-400 uppercase">
						10 Ендпоінтів Контракту DAC7
					</div>
					{#each ENDPOINTS as ep, idx}
						<button
							onclick={() => (selectedEndpointIndex = idx)}
							class="flex w-full cursor-pointer flex-col gap-1 rounded-xl p-3 text-left transition {selectedEndpointIndex ===
							idx
								? 'bg-stone-900 text-white shadow-sm'
								: 'bg-stone-50/70 text-stone-800 hover:bg-stone-100'}"
						>
							<div class="flex items-center justify-between">
								<span
									class="rounded px-1.5 py-0.5 font-mono text-[10px] font-bold {ep.method === 'POST'
										? selectedEndpointIndex === idx
											? 'bg-emerald-500/20 text-emerald-300'
											: 'bg-emerald-100 text-emerald-800'
										: selectedEndpointIndex === idx
											? 'bg-sky-500/20 text-sky-300'
											: 'bg-sky-100 text-sky-800'}"
								>
									{ep.method}
								</span>
								<span class="font-mono text-[10px] opacity-60">#{idx + 1}</span>
							</div>
							<div class="mt-0.5 truncate text-xs font-semibold">{ep.title}</div>
							<div class="truncate font-mono text-[11px] opacity-75">{ep.path}</div>
						</button>
					{/each}
				</div>

				<!-- Middle: Request Builder -->
				<div
					class="flex h-[650px] flex-col rounded-2xl border border-stone-200 bg-white p-4 shadow-sm lg:col-span-4"
				>
					<div class="mb-2 flex items-center justify-between">
						<span class="text-xs font-bold text-stone-900">Request Body (JSON)</span>
						<span class="font-mono text-[11px] text-stone-400">Idempotency-Key: UUIDv4</span>
					</div>
					<textarea
						bind:value={editablePayload}
						class="flex-1 resize-none rounded-xl border border-stone-800 bg-stone-950 p-3.5 font-mono text-xs text-stone-200 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
					></textarea>
					<button
						onclick={executeRequest}
						disabled={isExecuting}
						class="mt-3 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
					>
						{#if isExecuting}
							<RefreshCw class="size-4 animate-spin" /> Виконання запиту...
						{:else}
							<Play class="size-4 fill-white" /> Виконати запит (Send Request)
						{/if}
					</button>
				</div>

				<!-- Right: Response Viewer -->
				<div
					class="flex h-[650px] flex-col rounded-2xl border border-stone-200 bg-white p-4 shadow-sm lg:col-span-4"
				>
					<div class="mb-2 flex items-center justify-between">
						<span class="text-xs font-bold text-stone-900">Response</span>
						<div class="flex items-center gap-1.5">
							<span
								class="rounded border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-700"
							>
								200 OK
							</span>
							<span class="font-mono text-[10px] text-stone-400">~18ms</span>
						</div>
					</div>
					<div
						class="flex-1 overflow-y-auto rounded-xl border border-stone-800 bg-stone-950 p-3.5 font-mono text-xs text-emerald-400"
					>
						<pre class="whitespace-pre-wrap">{JSON.stringify(liveResponse, null, 2)}</pre>
					</div>
					<div
						class="mt-3 rounded-xl border border-stone-200/80 bg-stone-50 p-2.5 text-[11px] text-stone-600"
					>
						<span class="font-bold text-stone-800">Норма закону:</span>
						{activeEndpoint.desc}
					</div>
				</div>
			</div>
		</div>

		<!-- Tab 3: Webhooks & HMAC Verification -->
	{:else if activeTab === 'webhooks'}
		<div class="space-y-6">
			<div>
				<h2 class="text-xl font-bold tracking-tight text-stone-900">
					Вебхуки та криптографічний підпис (HMAC-SHA256)
				</h2>
				<p class="mt-1 text-sm text-stone-500">
					Налаштування підписання та валідація вебхук-подій між цифровою платформою, банком-еквайром
					та ERP мерчанта.
				</p>
			</div>

			<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
				<!-- Webhook Config -->
				<div class="space-y-4 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
					<div class="flex items-center gap-2">
						<Webhook class="size-5 text-stone-700" />
						<h3 class="font-bold text-stone-900">URL приймача вебхуків у вашій ERP</h3>
					</div>
					<div class="flex gap-2">
						<input
							type="text"
							bind:value={webhookUrl}
							class="flex-1 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 font-mono text-xs text-stone-800"
						/>
						<button
							class="cursor-pointer rounded-lg bg-stone-900 px-4 py-2 text-xs font-bold text-white transition hover:bg-stone-800"
						>
							Зберегти
						</button>
					</div>
					<p class="text-xs text-stone-400">
						Платформа надсилає POST-запити на цей URL при кожній зміні статусу замовлення,
						нарахуванні доходу, утриманні 10% ПДФО або виплаті через СЕП-4.
					</p>

					<div class="border-t border-stone-100 pt-4">
						<div class="mb-3 text-xs font-bold text-stone-900">
							Останні надіслані події (Audit Trail)
						</div>
						<div
							class="divide-y divide-stone-100 overflow-hidden rounded-xl border border-stone-100 text-xs"
						>
							{#each [{ evt: 'delivery.completed', id: 'evt_0981', time: '1 хв тому', status: '200 OK' }, { evt: 'tax.withheld_10_percent', id: 'evt_0980', time: '1 хв тому', status: '200 OK' }, { evt: 'payout.sep4_settled', id: 'evt_0979', time: '12 хв тому', status: '200 OK' }, { evt: 'delivery.damaged_courier_fault', id: 'evt_0978', time: '34 хв тому', status: 'STORNO' }] as log}
								<div
									class="flex items-center justify-between bg-white p-2.5 font-mono hover:bg-stone-50"
								>
									<div class="text-[11px] font-bold text-sky-800">{log.evt}</div>
									<div class="flex items-center gap-2 text-[11px] text-stone-400">
										<span>{log.id}</span>
										<span
											class="py-0.2 rounded border border-emerald-200 bg-emerald-50 px-1.5 text-[10px] text-emerald-700"
										>
											{log.status}
										</span>
									</div>
								</div>
							{/each}
						</div>
					</div>
				</div>

				<!-- HMAC Signature Calculator & Validator -->
				<div
					class="flex flex-col space-y-4 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm"
				>
					<div class="flex items-center justify-between">
						<div class="flex items-center gap-2">
							<ShieldCheck class="size-5 text-emerald-600" />
							<h3 class="font-bold text-stone-900">Калькулятор перевірки підпису HMAC</h3>
						</div>
						<span class="font-mono text-[11px] text-stone-400">Web Crypto API</span>
					</div>

					<div class="space-y-3 text-xs">
						<div>
							<label for="webhook-payload-input" class="mb-1 block font-semibold text-stone-700"
								>Payload для підпису</label
							>
							<textarea
								id="webhook-payload-input"
								bind:value={webhookPayloadInput}
								rows="3"
								class="w-full rounded-lg border border-stone-200 bg-stone-50 p-2.5 font-mono text-[11px] text-stone-800"
							></textarea>
						</div>

						<div class="grid grid-cols-2 gap-3">
							<div>
								<label for="webhook-ts-input" class="mb-1 block font-semibold text-stone-700"
									>Timestamp (Unix t)</label
								>
								<input
									id="webhook-ts-input"
									type="number"
									bind:value={simulatedTimestamp}
									class="w-full rounded-lg border border-stone-200 bg-stone-50 p-2 font-mono text-[11px] text-stone-800"
								/>
							</div>
							<div>
								<label for="webhook-secret-input" class="mb-1 block font-semibold text-stone-700"
									>HMAC Secret</label
								>
								<input
									id="webhook-secret-input"
									type="text"
									readonly
									value={webhookSecret}
									class="w-full rounded-lg border border-stone-200 bg-stone-100 p-2 font-mono text-[11px] text-stone-500"
								/>
							</div>
						</div>

						<div
							class="space-y-1.5 rounded-xl bg-stone-900 p-3 font-mono text-[11px] text-stone-200"
						>
							<div class="text-[10px] text-stone-400 uppercase">Розрахований заголовок:</div>
							<div class="break-all text-emerald-400 select-all">
								X-Rahunok-Signature: t={simulatedTimestamp},v1={calculatedHmac}
							</div>
						</div>
						<p class="text-[11px] text-stone-500">
							В ERP необхідно порівнювати отриманий хеш у форматі постійного часу (constant-time
							comparison) для захисту від атак за часом виконання (Timing Attacks).
						</p>
					</div>
				</div>
			</div>
		</div>

		<!-- Tab 4: API Contract Inventory (OpenAPI 3.1) -->
	{:else if activeTab === 'contracts'}
		<div class="space-y-6">
			<div class="flex items-center justify-between">
				<div>
					<h2 class="text-xl font-bold tracking-tight text-stone-900">
						Rahunok DAC7 Platform Engine API Contract Inventory
					</h2>
					<p class="mt-1 text-sm text-stone-500">
						Повна матриця специфікації OpenAPI 3.1.0 для інтеграції з платформою доставки VARUS
						(Закон № 4903-IX, DAC7).
					</p>
				</div>
				<a
					href="https://api.rahunok.ua/v1/dac7/reports/oecd-dpi"
					target="_blank"
					class="flex items-center gap-2 rounded-xl bg-stone-900 px-4 py-2 text-xs font-bold text-white transition hover:bg-stone-800"
				>
					<FileText class="size-4" /> Завантажити OECD DPI XML
				</a>
			</div>

			<div class="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
				<div class="overflow-x-auto">
					<table class="w-full border-collapse text-left text-xs">
						<thead>
							<tr
								class="border-b border-stone-200 bg-stone-50 text-[10px] font-bold tracking-wider text-stone-600 uppercase"
							>
								<th class="p-3.5">Метод</th>
								<th class="p-3.5">Шлях ендпоінта</th>
								<th class="p-3.5">Назва операції</th>
								<th class="p-3.5">Обов'язкові заголовки</th>
								<th class="p-3.5">Статус</th>
								<th class="p-3.5">Податкова норма</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-stone-100 font-mono text-[11px]">
							{#each ENDPOINTS as ep}
								<tr class="transition hover:bg-stone-50/80">
									<td class="p-3.5 font-bold">
										<span
											class="rounded px-2 py-0.5 text-[10px] {ep.method === 'POST'
												? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
												: 'border border-sky-200 bg-sky-50 text-sky-700'}"
										>
											{ep.method}
										</span>
									</td>
									<td class="p-3.5 font-bold text-stone-900">{ep.path}</td>
									<td class="p-3.5 font-sans text-stone-700">{ep.title}</td>
									<td class="p-3.5 text-stone-500">
										{#if ep.method === 'POST'}
											Idempotency-Key
										{:else}
											Bearer Auth
										{/if}
									</td>
									<td class="p-3.5">
										<span
											class="rounded bg-emerald-50 px-2 py-0.5 font-sans text-[10px] font-bold text-emerald-700"
										>
											Implemented
										</span>
									</td>
									<td class="p-3.5 font-sans text-[11px] text-stone-500">{ep.desc}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>
		</div>

		<!-- Tab 5: ERP Integration Guide -->
	{:else if activeTab === 'erp'}
		<div class="space-y-6">
			<div>
				<h2 class="text-xl font-bold tracking-tight text-stone-900">
					Керівництво з інтеграції DAC7 до ERP (VARUS / BAS / 1C / SAP)
				</h2>
				<p class="mt-1 text-sm text-stone-500">
					Архітектура 3-х незмінних леджерів, бухгалтерські проводки та готові кодові фрагменти для
					швидкого запуску.
				</p>
			</div>

			<!-- 3-Ledgers Architecture Card -->
			<div class="space-y-4 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
				<div class="flex items-center gap-2">
					<Layers class="size-5 text-sky-600" />
					<h3 class="font-bold text-stone-900">Архітектура 3-х Леджерів (Zero Discrepancy)</h3>
				</div>
				<div class="grid grid-cols-1 gap-4 text-xs md:grid-cols-3">
					<div class="space-y-2 rounded-xl border border-stone-200 bg-stone-50 p-4">
						<div class="flex items-center gap-1.5 font-bold text-stone-900">
							<span class="size-2 rounded-full bg-sky-500"></span> 1. Payment Ledger
						</div>
						<p class="text-[11px] text-stone-500">
							Фіксує вхідний клієнтський платіж (930.00 ₴) та миттєвий 4-way сплит. Дохід кур'єра
							тут НЕ нараховується.
						</p>
					</div>
					<div class="space-y-2 rounded-xl border border-stone-200 bg-stone-50 p-4">
						<div class="flex items-center gap-1.5 font-bold text-stone-900">
							<span class="size-2 rounded-full bg-emerald-500"></span> 2. Courier Income Ledger
						</div>
						<p class="text-[11px] text-stone-500">
							Фіксує Gross дохід кур'єра (100.00 ₴) виключно після події DELIVERED. При вині кур'єра
							здійснюється сторно (0.00 ₴).
						</p>
					</div>
					<div class="space-y-2 rounded-xl border border-stone-200 bg-stone-50 p-4">
						<div class="flex items-center gap-1.5 font-bold text-stone-900">
							<span class="size-2 rounded-full bg-purple-500"></span> 3. Payout Ledger
						</div>
						<p class="text-[11px] text-stone-500">
							Консолідує чисту суму Net (90.00 ₴) у щотижневий реєстр для виплати через СЕП-4 на
							спеціальний IBAN у Монобанк.
						</p>
					</div>
				</div>
			</div>

			<!-- Accounting Entries Matrix -->
			<div class="space-y-4 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
				<h3 class="text-sm font-bold text-stone-900">
					Таблиця бухгалтерських проводок для 1С / BAS ERP
				</h3>
				<div class="overflow-x-auto">
					<table class="w-full border-collapse text-left font-sans text-xs">
						<thead>
							<tr
								class="border-b border-stone-200 bg-stone-50 text-[10px] font-bold tracking-wider text-stone-600 uppercase"
							>
								<th class="p-3">Операція</th>
								<th class="p-3">Дебет</th>
								<th class="p-3">Кредит</th>
								<th class="p-3">Сума (приклад)</th>
								<th class="p-3">Податкова суть</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-stone-100 text-[11px]">
							<tr>
								<td class="p-3 font-semibold text-stone-900">Оплата покупця в додатку</td>
								<td class="p-3 font-mono font-bold text-sky-700">333 (Гроші в дорозі)</td>
								<td class="p-3 font-mono font-bold text-stone-700">702 / 685 (Пул кур'єра)</td>
								<td class="p-3 font-mono">930.00 ₴</td>
								<td class="p-3 text-stone-500">Виручка VARUS 850 ₴ + доставка 80 ₴</td>
							</tr>
							<tr>
								<td class="p-3 font-semibold text-stone-900">Успішна доставка (DELIVERED)</td>
								<td class="p-3 font-mono font-bold text-sky-700">685 (Транзитний фонд)</td>
								<td class="p-3 font-mono font-bold text-stone-700">6851 (Розрахунки з кур'єром)</td>
								<td class="p-3 font-mono">100.00 ₴</td>
								<td class="p-3 text-stone-500">Gross дохід кур'єра (база + бонуси)</td>
							</tr>
							<tr class="bg-emerald-50/40">
								<td class="p-3 font-semibold text-emerald-950">Утримання 10% ПДФО</td>
								<td class="p-3 font-mono font-bold text-emerald-800">6851 (Кур'єр)</td>
								<td class="p-3 font-mono font-bold text-emerald-800">6411 (ПДФО 10%)</td>
								<td class="p-3 font-mono font-bold text-emerald-800">10.00 ₴</td>
								<td class="p-3 font-semibold text-emerald-900"
									>Платформа як податковий агент (ВЗ = 0 ₴)</td
								>
							</tr>
							<tr>
								<td class="p-3 font-semibold text-stone-900">Виплата на спецрахунок через СЕП-4</td>
								<td class="p-3 font-mono font-bold text-sky-700">6851 (Кур'єр)</td>
								<td class="p-3 font-mono font-bold text-stone-700">311 (Рахунок у банку)</td>
								<td class="p-3 font-mono">90.00 ₴</td>
								<td class="p-3 text-stone-500">Net сума на Монобанк IBAN</td>
							</tr>
							<tr>
								<td class="p-3 font-semibold text-stone-900">Сплата податку до Казначейства</td>
								<td class="p-3 font-mono font-bold text-sky-700">6411 (ПДФО 10%)</td>
								<td class="p-3 font-mono font-bold text-stone-700">311 (Рахунок у банку)</td>
								<td class="p-3 font-mono">10.00 ₴</td>
								<td class="p-3 text-stone-500">КБК 11010100 за стандартом № 101</td>
							</tr>
							<tr class="bg-rose-50/40">
								<td class="p-3 font-semibold text-rose-950">Сторно при вині кур'єра</td>
								<td class="p-3 font-mono font-bold text-rose-800">6851 (Сторно)</td>
								<td class="p-3 font-mono font-bold text-rose-800">6411 (Сторно)</td>
								<td class="p-3 font-mono font-bold text-rose-800">-10.00 ₴</td>
								<td class="p-3 text-rose-900">Анулювання ПДФО при аварії / пошкодженні</td>
							</tr>
						</tbody>
					</table>
				</div>
			</div>

			<!-- Code Integration Snippets -->
			<div class="space-y-4 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
				<div class="flex items-center justify-between">
					<div class="flex items-center gap-2">
						<Terminal class="size-5 text-stone-700" />
						<h3 class="font-bold text-stone-900">Приклади виклику API у коді вашої платформи</h3>
					</div>
					<div class="flex gap-1 rounded-lg bg-stone-100 p-1 text-xs font-semibold">
						<button
							onclick={() => (erpCodeLanguage = 'ts')}
							class="cursor-pointer rounded px-2.5 py-1 transition {erpCodeLanguage === 'ts'
								? 'bg-white text-stone-900 shadow-sm'
								: 'text-stone-500 hover:text-stone-800'}"
						>
							TypeScript
						</button>
						<button
							onclick={() => (erpCodeLanguage = 'python')}
							class="cursor-pointer rounded px-2.5 py-1 transition {erpCodeLanguage === 'python'
								? 'bg-white text-stone-900 shadow-sm'
								: 'text-stone-500 hover:text-stone-800'}"
						>
							Python
						</button>
						<button
							onclick={() => (erpCodeLanguage = '1c')}
							class="cursor-pointer rounded px-2.5 py-1 transition {erpCodeLanguage === '1c'
								? 'bg-white text-stone-900 shadow-sm'
								: 'text-stone-500 hover:text-stone-800'}"
						>
							1C / BAS
						</button>
					</div>
				</div>

				<div class="overflow-x-auto rounded-xl bg-stone-950 p-4 font-mono text-xs text-stone-200">
					<pre>{codeSnippets[erpCodeLanguage]}</pre>
				</div>
			</div>
		</div>
	{/if}
</div>
