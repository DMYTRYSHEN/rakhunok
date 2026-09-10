import type { FlowEdge, FlowNode, FlowScenario } from './types';

type NodeInput = Omit<FlowNode, 'kind' | 'position'> & {
	kind?: FlowNode['kind'];
	x: number;
	y?: number;
};

function node({ x, y = 240, kind = 'action', ...value }: NodeInput): FlowNode {
	return { ...value, kind, position: { x, y } };
}

function edge(source: string, target: string, label?: string, tone?: FlowEdge['tone']): FlowEdge {
	return { id: `${source}-${target}`, source, target, label, tone };
}

export const dac7PlatformFlowScenario: FlowScenario = {
	id: 'dac7-platform-varus',
	category: 'Operations',
	label: 'DAC7 та VARUS (Повний цикл)',
	title: 'Complete DAC7 & VARUS 3-Ledger Compliance Flow',
	description:
		"Наскрізний життєвий цикл цифрової платформи доставки: реєстрація платформи в ДПС, онбординг та Дія.Підпис KYC кур'єра, відкриття спецрахунку IBAN, клієнтський платіж, незмінний 4-way сплит, диспетчеризація, сторнування інцидентів, 10% ПДФО (ВЗ 0.00 ₴), СЕП-4 виплати, сплата до Казначейства та OECD DPI XML звітність.",
	entrypoint: 'POST /events/batch',
	nodes: [
		node({
			id: 'platform-sts-registration',
			eyebrow: 'ДПС України (Реєстр)',
			title: 'Platform Operator STS Registration',
			detail:
				'Реєстрація оператора цифрової платформи (VARUS/РАХУНОК) у Реєстрі підзвітних операторів ДПС за Законом № 4903-IX (ст. 178-1 ПКУ). Набуття статусу податкового агента.',
			status: 'complete',
			meta: 'ЄДРПОУ: 43829104 · ДПС Ознака #106',
			layer: 'external',
			request: 'POST /v1/dac7/operators/register',
			kind: 'trigger',
			x: 40,
			y: 240
		}),
		node({
			id: 'platform-credentials-setup',
			eyebrow: 'Security & Integrations',
			title: 'API Credentials & HMAC Secret',
			detail:
				'Генерація Ed25519 сертифікатів, API-токенів та налаштування симетричного ключа HMAC-SHA256 для підписання вебхуків між цифровою платформою, банком та ERP мерчанта.',
			status: 'complete',
			meta: 'HMAC-SHA256 · Ed25519',
			layer: 'auth',
			operation: 'setupOperatorCredentials()',
			input: 'operatorId: OP-VARUS-01',
			output: 'status: ACTIVE, webhookSecret: set',
			x: 360,
			y: 240
		}),
		node({
			id: 'courier-diia-kyc',
			eyebrow: 'Дія.Підпис (KYC Tier-2)',
			title: 'Courier Diia.Signature KYC',
			detail:
				"Ідентифікація самозайнятого кур'єра через Дія.Підпис. Верифікація РНОКПП (3091248192), ПІБ, КЕП P7S, перевірка за базами PEP та санкційними списками РНБО.",
			status: 'complete',
			meta: 'Tier-2 KYC · P7S Clean',
			layer: 'auth',
			operation: 'verifyDiiaSession()',
			input: 'rnokpp: 3091248192',
			output: 'kyc: VERIFIED, pep: CLEAN',
			x: 680,
			y: 240
		}),
		node({
			id: 'courier-bank-dedicated-iban',
			eyebrow: 'Банк зі спецрежимом',
			title: 'Open Dedicated IBAN Account',
			detail:
				"Відкриття поточного рахунку кур'єра зі спецрежимом (IBAN) у банку-партнері (Монобанк). Автоматичне електронне повідомлення банку до ДПС про відкриття рахунку за ст. 178-1 ПКУ.",
			status: 'complete',
			meta: 'IBAN UA51322001... · ДПС Notified',
			layer: 'external',
			operation: 'openDedicatedIbanAccount()',
			input: 'rnokpp: 3091248192, bank: Monobank',
			output: 'iban: UA513220010000026200000002384',
			x: 1000,
			y: 240
		}),
		node({
			id: 'courier-digital-contract',
			eyebrow: 'Електронна оферта',
			title: 'Sign Digital Platform Terms',
			detail:
				'Підписання публічного договору приєднання з платформою через Дія.Підпис / КЕП. Юридична згода на утримання 10% ПДФО платформою та передачу звітності DAC7 до ДПС.',
			status: 'complete',
			meta: 'QES Signed · Legal Consent',
			layer: 'database',
			operation: 'signPlatformAgreement()',
			input: 'agreementId: AGR-2026-09-91, qes: valid',
			output: 'courierStatus: ACTIVE_ONBOARDED',
			x: 1320,
			y: 240
		}),
		node({
			id: 'varus-client-checkout',
			eyebrow: 'VARUS Checkout',
			title: 'Client Order & Payment Ingress',
			detail:
				'Клієнт замовляє кошик продуктів (850 ₴ товари VARUS + 80 ₴ вартість доставки = 930 ₴ загалом). Миттєва безконтактна оплата Apple Pay / Google Pay / карткою.',
			status: 'complete',
			meta: '930.00 ₴ · UAH Gross',
			layer: 'browser',
			request: 'POST /checkout/pay',
			input: 'orderId: ORD-VARUS-991, gross: 93000',
			output: 'paymentAuthorized: true',
			x: 1640,
			y: 240
		}),
		node({
			id: 'payment-ledger-split',
			eyebrow: 'Payment Ledger (Леджер 1)',
			title: 'Immutable Real-time 4-Way Split',
			detail:
				"Створення незмінного запису в Payment Ledger. Автоматичний сплит коштів: 1.2% еквайринг (11.16 ₴), 850 ₴ мерчант VARUS, 80 ₴ пул доставки кур'єра, маржа платформи.",
			status: 'complete',
			meta: 'Split: 11.16₴ | 850₴ | 80₴',
			layer: 'worker',
			operation: 'recordPaymentLedgerSplit()',
			input: 'orderId: ORD-VARUS-991, amount: 93000',
			output: 'status: captured, splitId: SPLIT-817',
			x: 1960,
			y: 240
		}),
		node({
			id: 'logistics-dispatch-assigned',
			eyebrow: 'Dispatch Engine',
			title: 'Logistics Dispatch & Tracking',
			detail:
				"Алгоритм підбирає найближчого самозайнятого кур'єра Олексія Ткаченка. Перехід статусів: ASSIGNED -> ACCEPTED -> IN_DELIVERY. Перевірка геозони та часового слоту.",
			status: 'complete',
			meta: 'RHK-9E71AB3 · IN_DELIVERY',
			layer: 'worker',
			operation: 'dispatchLogisticsOrder()',
			input: 'courier: 3091248192, store: VARUS-Kyiv-14',
			output: 'deliveryStatus: IN_DELIVERY',
			x: 2280,
			y: 240
		}),
		node({
			id: 'reassignment-split-router',
			eyebrow: 'Reassignment Router',
			title: 'Vehicle Breakdown Split (Поломка)',
			detail:
				"Позаштатна ситуація під час рейсу: поломка кур'єра 1. Система перепризначає замовлення на кур'єра 2: Кур'єр 1 (забір 20 ₴, ПДФО 2 ₴) + Кур'єр 2 (довіз 80 ₴, ПДФО 8 ₴).",
			status: 'complete',
			meta: 'Split x2 · Modulo 97',
			layer: 'worker',
			operation: 'splitReassignedOrder()',
			input: 'courier1: 2000, courier2: 8000',
			output: 'status: REASSIGNED_SPLIT',
			x: 2600,
			y: 80
		}),
		node({
			id: 'incident-damage-storno',
			eyebrow: 'Dispute Engine (Сторно)',
			title: 'Damage / Loss Reversal (Сторно)',
			detail:
				"Позаштатна ситуація: кур'єр пошкодив або не довіз товар. Автоматичне повернення клієнту (930 ₴), коригування винагороди кур'єра до 0 ₴ та сторно 10% ПДФО (Дт 685 - Кт 6411).",
			status: 'complete',
			meta: 'Storno: 10% PIT · 0.00 ₴',
			layer: 'worker',
			operation: 'handleIncidentStorno()',
			input: 'fault: COURIER, refund: 93000',
			output: 'status: ADJUSTED_STORNO',
			x: 2600,
			y: 400
		}),
		node({
			id: 'delivery-completed-proof',
			eyebrow: 'Courier App / Handover',
			title: 'Delivery Completed (DELIVERED)',
			detail:
				"Фізичне вручення замовлення клієнту. Кур'єр фіксує успішне завершення у мобільному застосунку із захищеним геоштампом (GPS pin) та часовою міткою.",
			status: 'complete',
			meta: 'DELIVERED · GPS Validated',
			layer: 'external',
			operation: 'confirmDelivery()',
			input: 'orderId: ORD-VARUS-991',
			output: 'deliveredAt: 2026-09-11T12:30:00Z',
			x: 2600,
			y: 240
		}),
		node({
			id: 'courier-income-accrual',
			eyebrow: 'Courier Income Ledger (Леджер 2)',
			title: 'Accrue Courier Earnings (Gross)',
			detail:
				'Створення події доходу в Courier Income Ledger: 80 ₴ базова доставка + 20 ₴ кілометраж = 100.00 ₴ Gross дохід. Дохід визнається виключно після події DELIVERED.',
			status: 'complete',
			meta: 'Gross: 100.00 ₴ · Accrued',
			layer: 'database',
			operation: 'accrueCourierIncome()',
			input: 'gross_income: 10000, orderId: ORD-VARUS-991',
			output: 'event: income.accrued',
			x: 2920,
			y: 240
		}),
		node({
			id: 'pit-10-tax-withholding',
			eyebrow: 'Tax Agent (Закон № 4903-IX)',
			title: 'Withhold 10% PIT (ВЗ = 0.00 ₴)',
			detail:
				'Платформа виконує функції податкового агента. Розрахунок податку: рівно 10% ПДФО (10.00 ₴). Військовий збір НЕ діє (0.00 ₴). Контроль річного ліміту 834 МЗП (7 211 598 ₴).',
			status: 'complete',
			meta: 'ПДФО 10%: 10.00 ₴ · ВЗ: 0.00 ₴',
			layer: 'worker',
			operation: 'calculatePlatformTax()',
			input: 'gross: 10000, pitRate: 0.10, militaryRate: 0.00',
			output: 'pitTax: 1000, militaryTax: 0, net: 9000',
			x: 3240,
			y: 240
		}),
		node({
			id: 'weekly-batch-compiler',
			eyebrow: 'Payout Ledger (Леджер 3)',
			title: 'Compile Weekly Payout Batch',
			detail:
				"Консолідація чистої винагороди Net (90.00 ₴) у щотижневий п'ятничний платіжний реєстр BATCH-2026/09 для перерахування на спеціальний IBAN кур'єра в Монобанк.",
			status: 'complete',
			meta: 'Net: 90.00 ₴ · Payout Ledger',
			layer: 'worker',
			operation: 'compilePayoutBatch()',
			input: 'batchId: BATCH-2026-09-11',
			output: 'status: scheduled, count: 128412',
			x: 3560,
			y: 240
		}),
		node({
			id: 'bank-sep4-transfer',
			eyebrow: 'НБУ СЕП-4 (ISO 20022)',
			title: 'Instant IBAN Bank Settlement',
			detail:
				"Автоматична виплата на рахунок кур'єра зі спецрежимом через СЕП-4 НБУ (24/7/365, пакет pain.001) із контролем валідності IBAN за алгоритмом Modulo 97.",
			status: 'complete',
			meta: 'Монобанк · СЕП-4 24/7',
			layer: 'external',
			operation: 'executeSepTransfer()',
			input: 'iban: UA513220010000026200000002384, amount: 9000',
			output: 'bankRef: SEP-92817491, status: SETTLED',
			x: 3880,
			y: 140
		}),
		node({
			id: 'treasury-tax-transfer',
			eyebrow: 'Державне казначейство',
			title: 'Transfer 10% PIT to KBK 11010100',
			detail:
				'Формування платіжної інструкції на перерахування утриманого ПДФО 10% до Казначейства на КБК 11010100 за стандартом НБУ № 101: *;101;43829104;11010100;;;.',
			status: 'complete',
			meta: 'КБК: 11010100 · Стандарт № 101',
			layer: 'external',
			operation: 'settleTreasuryTax()',
			input: 'kbk: 11010100, amount: 1000',
			output: 'treasuryDoc: TAX-2026-09, status: PAID',
			x: 3880,
			y: 340
		}),
		node({
			id: 'state-reporting-form4df',
			eyebrow: 'ДПС України (Додаток 4ДФ)',
			title: 'Quarterly Tax Return Form 4DF',
			detail:
				'Квартальний звіт про доходи: ознака 106 (10% ПДФО для платформних самозайнятих), 157 (0% податкового утримання для ФОП), 102 (разові продажі). Електронна подача до ДПС.',
			status: 'complete',
			meta: 'Форма 4ДФ · Ознаки 106/157/102',
			layer: 'worker',
			operation: 'generateForm4dfXml()',
			input: 'quarter: Q3-2026, sellers: 128412',
			output: 'xmlDoc: 4DF_2026_Q3.xml, status: validated',
			x: 4200,
			y: 140
		}),
		node({
			id: 'oecd-dpi-xml-export',
			eyebrow: 'Міжнародний обмін OECD DAC7',
			title: 'OECD DPI XML Export for STS',
			detail:
				'Генерація фінального XML за стандартом OECD DPI v1.0 для міжнародного автоматичного обміну: блоки <PersonalServices>, <SaleOfGoods>, <ImmovableProperty>, <Entity>.',
			status: 'complete',
			meta: 'OECD DPI XML v1.0',
			layer: 'worker',
			operation: 'generateDac7XmlReport()',
			input: 'fiscalYear: 2026, format: DPI_OECD_v1.0',
			output: 'xmlDoc: OECD_DPI_REPORT_2026.xml',
			kind: 'terminal',
			x: 4200,
			y: 340
		})
	],
	edges: [
		edge('platform-sts-registration', 'platform-credentials-setup', 'реєстрація в ДПС', 'default'),
		edge('platform-credentials-setup', 'courier-diia-kyc', 'платформа активна', 'default'),
		edge('courier-diia-kyc', 'courier-bank-dedicated-iban', 'РНОКПП підтверджено', 'default'),
		edge(
			'courier-bank-dedicated-iban',
			'courier-digital-contract',
			'спецрахунок відкрито',
			'default'
		),
		edge(
			'courier-digital-contract',
			'varus-client-checkout',
			"кур'єр готовий до замовлень",
			'default'
		),
		edge('varus-client-checkout', 'payment-ledger-split', 'оплата 930.00 ₴', 'default'),
		edge(
			'payment-ledger-split',
			'logistics-dispatch-assigned',
			'4-way сплит і диспетчеризація',
			'default'
		),
		edge('logistics-dispatch-assigned', 'reassignment-split-router', 'поломка в дорозі', 'danger'),
		edge(
			'reassignment-split-router',
			'delivery-completed-proof',
			"кур'єр 2 завершив довіз",
			'default'
		),
		edge(
			'logistics-dispatch-assigned',
			'incident-damage-storno',
			'пошкодження / недовіз',
			'danger'
		),
		edge('logistics-dispatch-assigned', 'delivery-completed-proof', 'доставка клієнту', 'default'),
		edge('incident-damage-storno', 'courier-income-accrual', 'сторнування доходу (0 ₴)', 'danger'),
		edge(
			'delivery-completed-proof',
			'courier-income-accrual',
			'DELIVERED (100.00 ₴ Gross)',
			'success'
		),
		edge(
			'courier-income-accrual',
			'pit-10-tax-withholding',
			'розрахунок 10% ПДФО (0% ВЗ)',
			'default'
		),
		edge('pit-10-tax-withholding', 'weekly-batch-compiler', 'Net 90.00 ₴ до виплати', 'default'),
		edge('pit-10-tax-withholding', 'treasury-tax-transfer', '10.00 ₴ ПДФО до бюджету', 'success'),
		edge('weekly-batch-compiler', 'bank-sep4-transfer', 'СЕП-4 реєстр виплат', 'success'),
		edge('weekly-batch-compiler', 'state-reporting-form4df', 'квартальна 4ДФ (код 106)', 'default'),
		edge('state-reporting-form4df', 'oecd-dpi-xml-export', 'річний OECD DPI XML', 'success')
	]
};
