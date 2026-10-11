import type { ServiceItem, EcosystemCategoryTab } from './types';

export const CATEGORIES: EcosystemCategoryTab[] = [
	{ id: 'all', label: 'Уся екосистема' },
	{ id: 'core', label: 'Головні портали' },
	{ id: 'payments', label: 'Платіжний досвід' },
	{ id: 'merchant', label: 'Інструменти бізнесу' },
	{ id: 'automation', label: 'Процесне ядро' },
	{ id: 'logistics', label: 'Логістика & B2B' },
	{ id: 'next_step', label: 'Наступні кроки (4)' }
];

export const SERVICES: ServiceItem[] = [
	{
		id: 'landing',
		index: '01',
		title: 'RAHUNOK',
		tagline: 'Перше знайомство без компромісів',
		subtitle: 'Головний публічний портал платформи',
		category: 'Головні портали',
		categoryId: 'core',
		badge: 'Apex',
		status: 'live',
		essence: 'Бездоганна вітрина фінтех-інновацій. Прямі розрахунки без застарілих банківських посередників.',
		keyMetric: '0.8%',
		metricLabel: 'Комісія замість 2%',
		description:
			'Публічний портал, де складне стає очевидним. Інтерактивна симуляція чекауту, наочний калькулятор прямої економії та вхід через Google Identity без паролів чи зайвих форм.',
		features: [
			'Миттєва симуляція клієнтського чекауту',
			'Розрахунок чистої маржинальності бізнесу',
			'Галузеві архітектури: HoReCa, АЗС, сервіси',
			'Абсолютно плавний досвід першого знайомства'
		],
		tags: ['SvelteKit', 'Apex Domain', 'Google OAuth'],
		paths: {
			prod: 'https://rhnk.to/',
			staging: 'https://rhnk.pp.ua/',
			local: 'http://localhost:5173/'
		},
		icon: 'Globe',
		accentColor: '#2563eb',
		roleInFlow: 'Точка входу та концептуальний центр екосистеми'
	},
	{
		id: 'dashboard',
		index: '02',
		title: 'Merchant Dashboard',
		tagline: 'Створення рахунку в два дотики',
		subtitle: 'Операційний простір підприємця',
		category: 'Інструменти бізнесу',
		categoryId: 'merchant',
		badge: 'Головний кабінет',
		status: 'live',
		essence: 'Простір, де все підпорядковано швидкості: ввів суму, двічі натиснув Enter — рахунок створено.',
		keyMetric: '2 × Enter',
		metricLabel: 'Клавіатурний UX без мишки',
		description:
			'Позбавлений зайвого шуму інтерфейс для щоденної роботи. Автоматичне призначення QR 003, підтримка ФОП і ТОВ, пряме зарахування на власний IBAN та безшовний імпорт номенклатури з Excel.',
		features: [
			'Автофокус на сумі та створення рахунку без мишки',
			'Шість бізнес-сценаріїв під будь-яку модель продажів',
			'Розумний конструктор імпорту з таблиць XLSX',
			'Автоматичний вибір Direct Mode та No-VAT'
		],
		tags: ['SvelteKit', 'Supabase', 'Excel Engine'],
		paths: {
			prod: 'https://rhnk.to/dashboard',
			staging: 'https://rhnk.pp.ua/dashboard',
			local: 'http://localhost:5173/dashboard'
		},
		icon: 'LayoutDashboard',
		accentColor: '#0284c7',
		roleInFlow: 'Ініціація рахунків, фінансовий реєстр та аналітика'
	},
	{
		id: 'pay',
		index: '03',
		title: 'Pay Checkout',
		tagline: 'Чиста швидкість розрахунку',
		subtitle: 'Адаптивний екран оплати для покупця',
		category: 'Платіжний досвід',
		categoryId: 'payments',
		badge: 'Клієнтський чекаут',
		status: 'live',
		essence: 'Швидкість має значення. Сторінка чекауту з’являється швидше, ніж користувач кліпне оком.',
		keyMetric: '< 5 мс',
		metricLabel: 'Відгук із Cloudflare Edge KV',
		description:
			'Платіжний досвід, очищений від усього зайвого. Прямі посилання (deeplinks) у Monobank, Privat24, Sense та А-Банк. Підтримка чайових персоналу, розбиття чека та благодійного округлення.',
		features: [
			'Суб-5мс доставка даних через Edge KV Cache',
			'Миттєве відкриття банківського застосунку в 1 клік',
			'Естетика тонких ліній у світлій та темній темах',
			'Вільна сума, донати та чайові офіціанту'
		],
		tags: ['Svelte 5', 'Cloudflare KV', 'Deeplinks'],
		paths: {
			prod: 'https://rhnk.to/pay',
			staging: 'https://rhnk.pp.ua/pay',
			local: 'http://localhost:5174/'
		},
		icon: 'CreditCard',
		accentColor: '#059669',
		roleInFlow: 'Фінальне перетворення наміру на підтверджену оплату'
	},
	{
		id: 'merchant-app',
		index: '04',
		title: 'Merchant POS App',
		tagline: 'Каса, що живе у вашій кишені',
		subtitle: 'Мобільний термінал та Telegram WebApp',
		category: 'Інструменти бізнесу',
		categoryId: 'merchant',
		badge: 'Mobile / POS',
		status: 'live',
		essence: 'Фізичний банківський термінал більше не потрібен. Лише смартфон і природний жест пальця.',
		keyMetric: '0 грн',
		metricLabel: 'Витрат на оренду POS-обладнання',
		description:
			'Тактильний інтерфейс для виїзної торгівлі, кур’єрів та закладів. Інноваційна «рідка оплата» з фізикою пружного свайпу. Миттєво працює в браузері як PWA або прямо всередині Telegram.',
		features: [
			'Тактильна фізика сенсорного свайпу підтвердження',
			'Повна інтеграція з Telegram WebApp екосистемою',
			'Миттєвий динамічний QR для сканування гостем',
			'Автономна робота без встановлення з App Store'
		],
		tags: ['Svelte 5', 'Telegram WebApp', 'Liquid Physics'],
		paths: {
			prod: 'https://rhnk.to/app',
			staging: 'https://rhnk.pp.ua/app',
			local: 'http://localhost:5176/'
		},
		icon: 'Smartphone',
		accentColor: '#06b6d4',
		roleInFlow: 'Мобільна точка продажу в руках персоналу'
	},
	{
		id: 'corex',
		index: '05',
		title: 'Corex Engine',
		tagline: 'Невидима симфонія бізнес-процесів',
		subtitle: 'Розподілений процесор операцій та AI',
		category: 'Процесне ядро',
		categoryId: 'automation',
		badge: 'Workflow Core',
		status: 'live',
		essence: 'Кожна операція — це чіткий математичний граф станів. Безпечний, передбачуваний, незламний.',
		keyMetric: '100%',
		metricLabel: 'Імутабельність аудиту подій',
		description:
			'Серце платформи, що керує життєвим циклом платежу від народження до фіскалізації. Візуальні діаграми процесів, тайм-аут контроль, AI-воркери для компенсацій та режим Time-Travel дебагу.',
		features: [
			'Інтерактивна візуалізація машини скінченних станів',
			'Time-Travel відтворення кроків для повного аудиту',
			'AI-воркери автоматичного виправлення винятків',
			'Компенсаційні транзакції при збоях зовнішніх API'
		],
		tags: ['TypeScript', 'State Machine', 'D1 Execution'],
		paths: {
			prod: 'https://rhnk.to/corex',
			staging: 'https://rhnk.pp.ua/corex',
			local: 'http://localhost:5173/corex'
		},
		icon: 'Cpu',
		accentColor: '#7c3aed',
		roleInFlow: 'Надійне проведення складних багатоетапних транзакцій'
	},
	{
		id: 'delivery',
		index: '06',
		title: 'Delivery Hub',
		tagline: 'Логістика як природне продовження чека',
		subtitle: 'Шлюз Нової Пошти та Meest',
		category: 'Логістика & B2B',
		categoryId: 'logistics',
		badge: 'Логістика',
		status: 'live',
		essence: 'Вибір відділення та розрахунок вартості доставки прямо під час оплати рахунку.',
		keyMetric: '1 км',
		metricLabel: 'Точність GPS-підбору поштоматів',
		description:
			'Інтерактивна гео-карта поштоматів та відділень. Розумне локальне кешування довідників у браузері, автоматичне додавання вартості доставки до рахунку та генерація експрес-накладних.',
		features: [
			'GPS-локація найближчих поштоматів за 1 клік',
			'Нульове навантаження на мережу завдяки local cache',
			'Єдиний чек: товар + доставка в одній транзакції',
			'MCP-інтерфейс для інтеграції з AI-асистентами'
		],
		tags: ['Turso LibSQL', 'Leaflet Maps', 'Nova Poshta'],
		paths: {
			prod: 'https://rhnk.to/delivery',
			staging: 'https://rhnk.pp.ua/delivery',
			local: 'http://localhost:5181/'
		},
		icon: 'Truck',
		accentColor: '#ea580c',
		roleInFlow: 'Автоматизація фізичної доставки та вибору відділень'
	},
	{
		id: 'qr',
		index: '07',
		title: 'QR Studio',
		tagline: 'Геометрія точного зчитування',
		subtitle: 'Генератор динамічних та векторних кодів',
		category: 'Платіжний досвід',
		categoryId: 'payments',
		badge: 'QR 003',
		status: 'live',
		essence: 'Фізичний код, який ніколи не застаріває. Змінюйте суму та призначення — наклейка на столі залишається.',
		keyMetric: 'QR 003',
		metricLabel: 'Національний стандарт НБУ',
		description:
			'Студія створення інтелектуальних платіжних QR-кодів. Довговічні динамічні коди для закладів, NFC-мітки, векторний експорт високої чіткості для друку та художні коди з логотипами.',
		features: [
			'Динамічні URL: зміна суми без передруку наклейки',
			'Векторні формати SVG та PDF для преміального друку',
			'Character Snow/JPEG — стилізовані брендовані коди',
			'100% сумісність з банківськими сканерами України'
		],
		tags: ['Cloudflare Workers', 'Vector SVG', 'NFC Tag'],
		paths: {
			prod: 'https://rhnk.to/qr',
			staging: 'https://rhnk.pp.ua/qr',
			local: 'http://localhost:5180/'
		},
		icon: 'QrCode',
		accentColor: '#db2777',
		roleInFlow: 'Фізичний міст між простором покупця та цифровим чеком'
	},
	{
		id: 'support',
		index: '08',
		title: 'Support Console',
		tagline: 'Емпатія на рівні інженерії',
		subtitle: 'Сервіс клієнтської підтримки та емуляції',
		category: 'Інструменти бізнесу',
		categoryId: 'merchant',
		badge: 'Консоль підтримки',
		status: 'live',
		essence: 'Бачити систему очима клієнта. Безпечне моделювання помилок без доступу до приватних паролів.',
		keyMetric: '0 ризику',
		metricLabel: 'Ізольований тестовий контекст',
		description:
			'Інструмент підтримки нового покоління. Оператор вводить UUID мерчанта та миттєво потрапляє в його кабінет у захищеному режимі емуляції, виявляючи помилки налаштувань за лічені секунди.',
		features: [
			'Миттєвий перехід під контекст клієнта за його ID',
			'Тестове створення рахунку для перевірки контрактів',
			'Діагностика статусу онбордингу та реквізитів',
			'Яскравий захисний банер режиму підтримки'
		],
		tags: ['SvelteKit', 'Support RPC', 'Security Isolation'],
		paths: {
			prod: 'https://rhnk.to/dashboard/support',
			staging: 'https://rhnk.pp.ua/dashboard/support',
			local: 'http://localhost:5173/dashboard/support'
		},
		icon: 'Headphones',
		accentColor: '#d97706',
		roleInFlow: 'Миттєва діагностика та допомога підприємцям'
	},
	{
		id: 'platform',
		index: '09',
		title: 'Platform DAC7',
		tagline: 'Масштаб без регуляторного тертя',
		subtitle: 'B2B маркетплейс та податковий шлюз',
		category: 'Логістика & B2B',
		categoryId: 'logistics',
		badge: 'Compliance',
		status: 'live',
		essence: 'Податкова прозорість європейського рівня для маркетплейсів, агрегаторів та платформ.',
		keyMetric: 'DAC7',
		metricLabel: 'Європейська директива звітності',
		description:
			'Платформний модуль для бізнесу з сотнями суб-мерчантів. Автоматизований збір даних, валідація ЄДРПОУ/РНОКПП, масові сплит-виплати на банківські картки та автоматичний експорт звітів.',
		features: [
			'Повний цикл верифікації за вимогами директиви DAC7',
			'Автоматична перевірка коректності податкових номерів',
			'Сплит-виплати багатьом продавцям платформи',
			'Формування регламентних звітів у XML та CSV'
		],
		tags: ['Svelte 5', 'PapaParse', 'Tax Compliance'],
		paths: {
			prod: 'https://rhnk.to/platform',
			staging: 'https://rhnk.pp.ua/platform',
			local: 'http://localhost:5178/'
		},
		icon: 'Building2',
		accentColor: '#1e40af',
		roleInFlow: 'Правова та податкова прозорість для великих агрегаторів'
	},
	{
		id: 'conf',
		index: '10',
		title: 'Bank Connectors',
		tagline: 'Нерозривний зв’язок із банками',
		subtitle: 'Шлюз синхронізації банківських виписок',
		category: 'Головні портали',
		categoryId: 'core',
		badge: 'Bank Sync',
		status: 'live',
		essence: 'Прямий пульс банківських рахунків. Кожна гривня зіставляється з рахунком у реальному часі.',
		keyMetric: 'Live Sync',
		metricLabel: 'Синхронізація виписок через Open API',
		description:
			'Інженерна консоль управління банківськими шлюзами. Підключення API ПриватБанку, Монобанку, А-Банку, автоматична звірка призначень платежів та безпечне зберігання токенів доступу.',
		features: [
			'Пряма інтеграція з Bank Open API України',
			'Автоматичне зіставлення платежу з відкритим рахунком',
			'Моніторинг життєздатності банківських шлюзів',
			'Захищене сховище клієнтських банківських токенів'
		],
		tags: ['Svelte 5', 'Supabase', 'Bank Webhooks'],
		paths: {
			prod: 'https://rhnk.to/conf',
			staging: 'https://rhnk.pp.ua/conf',
			local: 'http://localhost:5179/'
		},
		icon: 'Landmark',
		accentColor: '#0f766e',
		roleInFlow: 'Отримання авторитетного підтвердження зарахування коштів'
	},
	{
		id: 'worker-api',
		index: '11',
		title: 'API Gateway',
		tagline: 'Фундамент, на якому стоїть усе',
		subtitle: 'Розподілений бекенд на Cloudflare Edge',
		category: 'Головні портали',
		categoryId: 'core',
		badge: 'Edge Core',
		status: 'live',
		essence: 'Глобальна мережа, що обробляє запити біля самого користувача. Надійно. Миттєво. Без збоїв.',
		keyMetric: '30+ API',
		metricLabel: 'Типізованих OpenAPI операцій',
		description:
			'Глобальна серверна шина на Cloudflare Workers та Supabase Postgres. Сувора валідація контрактів, українські повідомлення про помилки з HTTP 422, ідемпотентність та криптографічні підписи.',
		features: [
			'30+ суворо типізованих контрактів OpenAPI v3',
			'Мапінг помилок 22023 українською мовою замість 503',
			'Суб-10мс глобальна затримка на Cloudflare Edge',
			'Автоматична ініціалізація платіжних профілів'
		],
		tags: ['TypeScript', 'Cloudflare Workers', 'Postgres RPC'],
		paths: {
			prod: 'https://rhnk.to/api/v1/health',
			staging: 'https://rhnk.pp.ua/api/v1/health',
			local: 'http://localhost:8787/api/v1/health'
		},
		icon: 'Network',
		accentColor: '#c2410c',
		roleInFlow: 'Серверне ядро валідації та надійного проведення даних'
	},
	{
		id: 'unified-mobile-app',
		index: '12',
		title: 'RAHUNOK One',
		tagline: 'Майбутнє, що розгортається без встановлення',
		subtitle: 'Єдиний нативний мобільний застосунок, App Clips та Open Banking',
		category: 'Платіжний досвід',
		categoryId: 'payments',
		badge: 'В активній розробці · Next Step',
		status: 'in_development',
		isNextStep: true,
		essence: 'Справжня магія мобільної оплати: Apple App Clips та Android Instant Apps запускаються за 0 секунд при скануванні QR чи дотику NFC, а Open Banking проводить пряме списання A2A без посередників.',
		keyMetric: '0 сек',
		metricLabel: 'До першої оплати через App Clips & A2A',
		description:
			'Наступний флагманський крок платформи RAHUNOK. Єдиний нативний мобільний застосунок нового покоління для клієнтів і мерчантів: скануйте динамічний QR або торкніться NFC-мітки, щоб миттєво відкрити картку Apple App Clip без встановлення з App Store, або перейдіть у повнофункціональний застосунок із прямою інтеграцією Open Banking (A2A перекази з банку в банк за стандартами НБУ та PSD2).',
		features: [
			'Apple App Clips та Android Instant Apps: миттєва сплата без завантаження додатку',
			'Open Banking (A2A): пряма авторизація банківського рахунку та списання без карткових комісій',
			'Розумний QR та NFC: оплата в один дотик смартфона з тактильним підтвердженням',
			'Уніфікований профіль: перемикання між кабінетом мерчанта та гаманцем клієнта в 1 свайп'
		],
		tags: ['Apple App Clips', 'Open Banking PSD2', 'Instant Apps', 'NFC & QR', 'A2A Payments'],
		paths: {
			prod: 'https://rhnk.to/app',
			staging: 'https://rhnk.pp.ua/app',
			local: 'http://localhost:5176/'
		},
		icon: 'Sparkles',
		accentColor: '#2563eb',
		roleInFlow: 'Наступне покоління нативних оплат: App Clips у клієнта, миттєва каса у мерчанта, Open Banking у банках'
	},
	{
		id: 'ai-mcp',
		index: '13',
		title: 'RAHUNOK AI MCP',
		tagline: 'Природна мова для керування фінансами',
		subtitle: 'Власний сервер Model Context Protocol для ШІ-агентів',
		category: 'Процесне ядро',
		categoryId: 'automation',
		badge: 'В розробці · Next Step',
		status: 'in_development',
		isNextStep: true,
		essence: 'ШІ-агенти отримують офіційний фінансовий протокол. Керування рахунками, виписками та доставкою з Claude, Cursor чи ChatGPT без витоку ключів.',
		keyMetric: 'MCP 1.0',
		metricLabel: 'Офіційний протокол для автономних ШІ',
		description:
			'Власний MCP-сервер платформи RAHUNOK. Надає автономним мовним моделям та агентам структуровані інструменти (Tools) та контекстні ресурси (Resources) для створення рахунків природною мовою («вистави рахунок на 5000 грн за консультацію»), звірки виписок, перевірки статусів замовлень та безпечної оркестрації платежів.',
		features: [
			'Типізовані AI Tools для створення, пошуку та скасування рахунків через ШІ',
			'Безпечні ресурси (Resources) для читання виписок без відкриття чутливих токенів',
			'Пряма сумісність з Claude Desktop, Cursor, Gemini, Antigravity та ботами',
			'Політики безпеки з двофакторним підтвердженням великих операцій'
		],
		tags: ['Model Context Protocol', 'AI Agents', 'Claude MCP', 'Cursor Tooling', 'FinTech AI'],
		paths: {
			prod: 'https://rhnk.to/api/mcp',
			staging: 'https://rhnk.pp.ua/api/mcp',
			local: 'http://localhost:8787/mcp'
		},
		icon: 'Bot',
		accentColor: '#8b5cf6',
		roleInFlow: 'Інтелектуальний інтерфейс: ШІ-агенти створюють та контролюють рахунки через стандартизовані інструменти'
	},
	{
		id: 'audit-logs',
		index: '14',
		title: 'Audit Logs & Telemetry',
		tagline: 'Абсолютна прозорість кожного байту',
		subtitle: 'Централізований журнал подій, аудит та телеметрія',
		category: 'Головні портали',
		categoryId: 'core',
		badge: 'В розробці · Next Step',
		status: 'in_development',
		isNextStep: true,
		essence: 'Імутабельний криптографічний аудит-лог кожної дії. Повна відповідність вимогам банківського нагляду НБУ та внутрішньої безпеки.',
		keyMetric: '100% Audit',
		metricLabel: 'Імутабельність запису кожної дії',
		description:
			'Виділений сервіс аудиту та обсервабіліті всього життєвого циклу транзакцій платформи. Фіксує таймлайн створення рахунків, вхідні вебхуки банків із сирими payload, виклики операторів підтримки у Support Console, помилки валідації 22023, латентність Cloudflare Edge та будь-які зміни банківських реквізитів.',
		features: [
			'Імутабельний Append-Only журнал подій із захистом від підробки записів',
			'Realtime-стрімінг помилок та аномалій банківських шлюзів',
			'Повний аудит сесій операторів підтримки у Support Console',
			'Експорт структурованих звітів для фінансового моніторингу та регуляторів'
		],
		tags: ['Audit Trail', 'Observability', 'Realtime Logs', 'Compliance Security', 'Telemetry'],
		paths: {
			prod: 'https://rhnk.to/dashboard/logs',
			staging: 'https://rhnk.pp.ua/dashboard/logs',
			local: 'http://localhost:5173/dashboard/logs'
		},
		icon: 'FileText',
		accentColor: '#0284c7',
		roleInFlow: 'Гарантія безпеки, розслідування інцидентів та беззаперечний доказ кожної операції'
	},
	{
		id: 'billing-ledger',
		index: '15',
		title: 'Billing & Operations Ledger',
		tagline: 'Бездоганна математика тарифів та виплат',
		subtitle: 'Движок обліку операцій, розрахунку комісій та актів',
		category: 'Інструменти бізнесу',
		categoryId: 'merchant',
		badge: 'В розробці · Next Step',
		status: 'in_development',
		isNextStep: true,
		essence: 'Автоматичний розрахунок комісій до копійки в реальному часі. Баланс мерчанта, списання за доставку, сплит-виплати та юридичні акти.',
		keyMetric: '0.01 грн',
		metricLabel: 'Точність обліку операцій у Real-time',
		description:
			'Спеціалізований білінговий леджер платформи RAHUNOK. Автоматично веде облік кожної проведеної транзакції, нараховує прозору комісію 0.8%, списує вартість поштових накладних Нової Пошти, відстежує квоти API, формує реєстри для бухгалтерських систем та генерує юридично чисті електронні акти виконаних робіт.',
		features: [
			'Автоматичне нарахування комісії мерчанта (0.8%) у реальному часі',
			'Облік супутніх сервісів: доставка посилок, сповіщення, API-квоти',
			'Генерація щомісячних фінансових звітів та актів виконаних робіт',
			'Автоматичний сплит-розподіл коштів між мерчантом та платформою'
		],
		tags: ['Billing Ledger', 'Fee Calculation', 'Financial Accounting', 'Auto Acts', 'Clearing'],
		paths: {
			prod: 'https://rhnk.to/dashboard/billing',
			staging: 'https://rhnk.pp.ua/dashboard/billing',
			local: 'http://localhost:5173/dashboard/billing'
		},
		icon: 'Receipt',
		accentColor: '#16a34a',
		roleInFlow: 'Фінансовий кліринг: розрахунок вартості послуг, комісій та формування актів'
	}
];
