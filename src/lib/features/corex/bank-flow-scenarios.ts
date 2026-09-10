import type { FlowEdge, FlowNode, FlowScenario } from './types';

type NodeInput = Omit<FlowNode, 'kind' | 'position'> & {
	kind?: FlowNode['kind'];
	x: number;
	y?: number;
};

function node({ x, y = 220, kind = 'action', ...value }: NodeInput): FlowNode {
	return { ...value, kind, position: { x, y } };
}

function edge(source: string, target: string, label?: string, tone?: FlowEdge['tone']): FlowEdge {
	return { id: `${source}-${target}-${label ?? 'next'}`, source, target, label, tone };
}

/**
 * 1. PrivatBank AutoClient 3.0 Statement Polling
 */
export const bankSyncPrivatbankScenario: FlowScenario = {
	id: 'bank-sync-privatbank',
	category: 'Banking',
	label: 'ПриватБанк Sync',
	title: 'ПриватБанк Автоклієнт: Polling виписки та зіставлення',
	description:
		'Періодичне вичитування виписки через AutoClient 3.0, пагінація followId, нормалізація доказів та переведення інвойсу в PAID.',
	entrypoint: 'CRON */1 * * * * (Account Scheduler)',
	nodes: [
		node({
			id: 'pb-scheduler',
			eyebrow: 'Планувальник',
			title: 'Тригер опитування',
			detail: 'Воркер запускає опитування за розкладом або за кнопкою «Перевірити зараз».',
			status: 'complete',
			meta: 'Account-level lease',
			layer: 'worker',
			kind: 'trigger',
			x: 40
		}),
		node({
			id: 'pb-token-resolve',
			eyebrow: 'Безпека',
			title: 'Розшифрування токена',
			detail: 'Токен Автоклієнта дешифрується через WebCrypto AES-GCM-256 з захищеного сховища.',
			status: 'complete',
			meta: 'AES-GCM-256',
			layer: 'auth',
			x: 340
		}),
		node({
			id: 'pb-api-fetch',
			eyebrow: 'ПриватБанк API',
			title: 'GET /api/proxy/transactions',
			detail: 'Запит виписки за IBAN із лімітом 1 rps та пагінацією followId.',
			status: 'running',
			meta: 'Egress Proxy · 1 req/s',
			layer: 'worker',
			request: 'GET /api/proxy/transactions?acc={IBAN}&startDate={d}&endDate={d}',
			x: 640
		}),
		node({
			id: 'pb-filter-credit',
			eyebrow: 'Фільтр операцій',
			title: 'TRANTYPE == "C" && PR_PR == "r"',
			detail: 'Відбір виключно проведених кредитових надходжень. Списання та холди відсікаються.',
			status: 'complete',
			meta: 'Фільтр проводки',
			layer: 'worker',
			kind: 'decision',
			x: 940
		}),
		node({
			id: 'pb-normalize',
			eyebrow: 'Універсальний SPI',
			title: 'Нормалізація в копійки',
			detail: 'Формування детермінованого URN (REF+REFN) та переведення SUM у цілі копійки BIGINT.',
			status: 'complete',
			meta: 'amount_minor · URN',
			layer: 'worker',
			x: 1240
		}),
		node({
			id: 'pb-matching',
			eyebrow: 'Двигун зіставлення',
			title: 'Matching Engine',
			detail: 'Звірка IBAN отримувача, суми та референсу замовлення (#RAH-XXXX) у призначенні.',
			status: 'running',
			meta: 'Strict + Tolerant Match',
			layer: 'worker',
			kind: 'decision',
			x: 1540
		}),
		node({
			id: 'pb-commit-paid',
			eyebrow: 'Транзакція БД',
			title: 'Переведення в PAID + Outbox',
			detail: 'Атомарне оновлення статусу замовлення, збереження URN доказу та створення події в Outbox.',
			status: 'waiting',
			meta: 'Postgres Transaction',
			layer: 'database',
			operation: 'UPDATE orders SET status="paid" + INSERT outbox',
			x: 1840,
			y: 120
		}),
		node({
			id: 'pb-unmatched-queue',
			eyebrow: 'Диспетчер розбіжностей',
			title: 'Ручна перевірка',
			detail: 'Сума зійшлася, але призначення без референсу або недоплата. Передано оператору.',
			status: 'waiting',
			meta: 'Manual Review Queue',
			layer: 'database',
			operation: 'INSERT unmatched_evidences',
			x: 1840,
			y: 360
		}),
		node({
			id: 'pb-pos-notify',
			eyebrow: 'Каса / Клієнт',
			title: 'Сповіщення каси (SSE / Webhook)',
			detail: 'Фізична каса чи сайт отримує підтвердження успішної оплати без перезавантаження.',
			status: 'waiting',
			meta: 'Realtime SSE',
			layer: 'browser',
			kind: 'terminal',
			x: 2140,
			y: 120
		})
	],
	edges: [
		edge('pb-scheduler', 'pb-token-resolve'),
		edge('pb-token-resolve', 'pb-api-fetch'),
		edge('pb-api-fetch', 'pb-filter-credit'),
		edge('pb-filter-credit', 'pb-normalize', 'проводка проведена', 'success'),
		edge('pb-normalize', 'pb-matching'),
		edge('pb-matching', 'pb-commit-paid', 'повний збіг (100%)', 'success'),
		edge('pb-matching', 'pb-unmatched-queue', 'нерозпізнано / різниця', 'danger'),
		edge('pb-commit-paid', 'pb-pos-notify', 'доставка події', 'success')
	]
};

/**
 * 2. A-Bank aBusiness Real-time Webhook
 */
export const bankWebhookABankScenario: FlowScenario = {
	id: 'bank-webhook-a-bank',
	category: 'Banking',
	label: 'А-Банк Webhook',
	title: 'А-Банк аБізнес: Ed25519 Webhook та миттєве зарахування',
	description:
		'Миттєве отримання транзакції через Webhook А-Банку, перевірка підпису Ed25519, нормалізація доказів та оновлення рахунку.',
	entrypoint: 'POST /api/v1/bank-webhook/a-bank',
	nodes: [
		node({
			id: 'ab-ingress',
			eyebrow: 'Шлюз банку',
			title: 'Вхідний Webhook А-Банку',
			detail: 'А-Банк відправляє сповіщення про зарахування коштів у реальному часі.',
			status: 'complete',
			meta: 'HTTPS Ingress',
			layer: 'worker',
			kind: 'trigger',
			x: 40
		}),
		node({
			id: 'ab-crypto-guard',
			eyebrow: 'Криптографія',
			title: 'Ed25519 Signature Guard',
			detail: 'Верифікація підпису x-req-signature (64 байти HEX 128) та перевірка x-req-ts (<10 сек).',
			status: 'complete',
			meta: 'RFC 8032 · Ed25519',
			layer: 'auth',
			kind: 'decision',
			x: 340
		}),
		node({
			id: 'ab-dedupe',
			eyebrow: 'Дедуплікація',
			title: 'Захист від дублікатів',
			detail: 'Перевірка композитного ключа (id + bill_id). Якщо подія вже була — миттєвий HTTP 200.',
			status: 'complete',
			meta: 'Idempotent Guard',
			layer: 'worker',
			x: 640
		}),
		node({
			id: 'ab-normalize',
			eyebrow: 'Нормалізатор',
			title: 'Приведення до URN та копійок',
			detail: 'Сума 3450.0 грн перетворюється у 345000n, формується єдиний доказ NormalizedBankEvidence.',
			status: 'running',
			meta: 'BIGINT amount_minor',
			layer: 'worker',
			x: 940
		}),
		node({
			id: 'ab-matching',
			eyebrow: 'Зіставлення',
			title: 'Звірка з відкритим рахунком',
			detail: 'Пошук активного замовлення за кодом #RAH-XXXX у полі purpose та порівняння суми.',
			status: 'running',
			meta: 'Match Engine',
			layer: 'worker',
			kind: 'decision',
			x: 1240
		}),
		node({
			id: 'ab-paid',
			eyebrow: 'Статус замовлення',
			title: 'status: paid + Outbox Dispatch',
			detail: 'Рахунок позначено оплаченим, подія payment.confirmed записана в чергу доставки.',
			status: 'waiting',
			meta: 'Transactional Commit',
			layer: 'database',
			operation: 'UPDATE orders SET status="paid"',
			x: 1540
		}),
		node({
			id: 'ab-pos-ack',
			eyebrow: 'Каса / ПРРО',
			title: 'Видача чека на касі',
			detail: 'Касовий термінал отримує подію через SSE і друкує фіскальний чек покупцю.',
			status: 'waiting',
			meta: 'SSE Stream to POS',
			layer: 'browser',
			kind: 'terminal',
			x: 1840
		})
	],
	edges: [
		edge('ab-ingress', 'ab-crypto-guard'),
		edge('ab-crypto-guard', 'ab-dedupe', 'підпис валідний', 'success'),
		edge('ab-dedupe', 'ab-normalize'),
		edge('ab-normalize', 'ab-matching'),
		edge('ab-matching', 'ab-paid', 'рахунок знайдено', 'success'),
		edge('ab-paid', 'ab-pos-ack', 'доставка події', 'success')
	]
};

/**
 * 3. Monobank Corporate StatementItem Webhook
 */
export const bankWebhookMonobankScenario: FlowScenario = {
	id: 'bank-webhook-monobank',
	category: 'Banking',
	label: 'Monobank Corporate',
	title: 'Monobank Corporate API: StatementItem та закриття рахунку',
	description:
		'Отримання події StatementItem від Monobank у цілих копійках, дедуплікація URN та закриття інвойсу.',
	entrypoint: 'POST /api/v1/bank-webhook/monobank',
	nodes: [
		node({
			id: 'mono-webhook',
			eyebrow: 'Monobank Push',
			title: 'StatementItem Webhook',
			detail: 'Monobank шле POST-запит з новою транзакцією одразу після зарахування на рахунок.',
			status: 'complete',
			meta: 'Webhook Event',
			layer: 'worker',
			kind: 'trigger',
			x: 40
		}),
		node({
			id: 'mono-ecdsa',
			eyebrow: 'Безпека',
			title: 'Перевірка публічним ключем',
			detail: 'Верифікація заголовка X-Sign за допомогою публічного ключа банку (/api/merchant/pubkey).',
			status: 'complete',
			meta: 'ECDSA Verification',
			layer: 'auth',
			x: 340
		}),
		node({
			id: 'mono-parse',
			eyebrow: 'Парсинг даних',
			title: 'Нативні копійки (amount)',
			detail: 'Monobank передає суму напряму в копійках (500000 = 5 000.00 грн). Жодних перетворень float.',
			status: 'running',
			meta: 'Native minor units',
			layer: 'worker',
			x: 640
		}),
		node({
			id: 'mono-match',
			eyebrow: 'Двигун зіставлення',
			title: 'Звірка з інвойсом',
			detail: 'Точний збіг референсу в описі (description) з номером рахунку #RAH-5500.',
			status: 'running',
			meta: 'Matching Engine',
			layer: 'worker',
			kind: 'decision',
			x: 940
		}),
		node({
			id: 'mono-paid',
			eyebrow: 'Транзакційний Outbox',
			title: 'Оновлення інвойсу в PAID',
			detail: 'Фіксація зарахування в системному реєстрі та формування підписаної події для мерчанта.',
			status: 'waiting',
			meta: 'Postgres Transaction',
			layer: 'database',
			x: 1240
		}),
		node({
			id: 'mono-done',
			eyebrow: 'Мерчант',
			title: 'Оновлення Dashboard та каси',
			detail: 'Realtime оновлення статусу на екрані оплати та надсилання сповіщення на касу.',
			status: 'waiting',
			meta: 'Order Completed',
			layer: 'browser',
			kind: 'terminal',
			x: 1540
		})
	],
	edges: [
		edge('mono-webhook', 'mono-ecdsa'),
		edge('mono-ecdsa', 'mono-parse', 'підпис валідний', 'success'),
		edge('mono-parse', 'mono-match'),
		edge('mono-match', 'mono-paid', 'збіг суми й номера', 'success'),
		edge('mono-paid', 'mono-done', 'успішно оплачено', 'success')
	]
};

/**
 * 4. Reconciliation & Manual Review Exception Queue
 */
export const bankReconciliationRecoveryScenario: FlowScenario = {
	id: 'bank-reconciliation-recovery',
	category: 'Banking',
	label: 'Диспетчер розбіжностей',
	title: 'Звірка нерозпізнаних платежів та ручне підтвердження',
	description:
		'Обробка платежів з друкарськими помилками в призначенні, недоплатами/переплатами, сторно та ручне підтвердження оператором.',
	entrypoint: 'POST /api/v1/reconciliation/manual-match',
	nodes: [
		node({
			id: 'rec-unmatched',
			eyebrow: 'Банківське зарахування',
			title: 'Нерозпізнане надходження',
			detail: 'Гроші зайшли на рахунок, але клієнт не вказав референс або помилився в номері.',
			status: 'complete',
			meta: 'Bank Evidence',
			layer: 'worker',
			kind: 'trigger',
			x: 40
		}),
		node({
			id: 'rec-classifier',
			eyebrow: 'Аналіз розбіжності',
			title: 'Класифікатор причини',
			detail: 'Визначення типу проблеми: друкарська помилка в призначенні, недоплата, переплата чи сторно.',
			status: 'complete',
			meta: 'Typo / Amount mismatch',
			layer: 'worker',
			kind: 'decision',
			x: 340
		}),
		node({
			id: 'rec-manual-queue',
			eyebrow: 'Dashboard мерчанта',
			title: 'Черга ручної звірки',
			detail: 'Мерчант бачить суму, ПІБ платника та призначення в таблиці «Потребує перевірки».',
			status: 'running',
			meta: 'Operator Review Screen',
			layer: 'browser',
			x: 640
		}),
		node({
			id: 'rec-operator-action',
			eyebrow: 'Дія оператора',
			title: 'Ручна прив’язка до замовлення',
			detail: 'Оператор обирає потрібне замовлення зі списку та тисне «Підтвердити оплату вручну».',
			status: 'waiting',
			meta: 'Audited Action',
			layer: 'auth',
			kind: 'action',
			x: 940
		}),
		node({
			id: 'rec-reconcile-commit',
			eyebrow: 'Аудит та транзакція',
			title: 'Прив’язка доказу до замовлення',
			detail: 'Замовлення переходить у status: paid із позначкою confirmation_source: "manual_audit".',
			status: 'waiting',
			meta: 'Audited DB Commit',
			layer: 'database',
			operation: 'UPDATE orders SET status="paid", audit_actor="operator_1"',
			x: 1240
		}),
		node({
			id: 'rec-resolved',
			eyebrow: 'Фінал',
			title: 'Питання врегульовано',
			detail: 'Товар видано клієнту, бухгалтерія мерчанта отримує зведений акт звірки.',
			status: 'waiting',
			meta: 'Resolved & Dispatched',
			layer: 'browser',
			kind: 'terminal',
			x: 1540
		})
	],
	edges: [
		edge('rec-unmatched', 'rec-classifier'),
		edge('rec-classifier', 'rec-manual-queue', 'не збігається референс', 'danger'),
		edge('rec-manual-queue', 'rec-operator-action'),
		edge('rec-operator-action', 'rec-reconcile-commit', 'оператор підтвердив', 'success'),
		edge('rec-reconcile-commit', 'rec-resolved', 'звірено', 'success')
	]
};

export const bankFlowScenarios: FlowScenario[] = [
	bankSyncPrivatbankScenario,
	bankWebhookABankScenario,
	bankWebhookMonobankScenario,
	bankReconciliationRecoveryScenario
];
