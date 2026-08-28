import type { FlowScenario } from './types';

export type CorexLocale = 'uk' | 'en';

export const shellText = {
	uk: {
		backLabel: 'Повернутися до панелі Rahunok',
		mockMode: 'Макет',
		signOut: 'Вийти',
		back: 'Панель',
		kicker: 'Мапа системи Rahunok',
		title: 'Оглядач backend-процесів',
		lede: 'Простежуйте авторизацію, API-запити, операції з базою даних, сценарії рахунків, платіжні посилання та розгортання на інтерактивному полотні.',
		boundary: 'Межі системи',
		backend: 'Backend Rahunok',
		trace: 'Трасування архітектури',
		contracts: 'Реальні контракти · тестові дані',
		notConnected: 'Не підключено',
		deploy: 'Розгорнути',
		pause: 'Призупинити',
		rollback: 'Відкотити',
		environment: 'Середовище',
		preview: 'Перегляд / макет',
		mutation: 'Можливість змін',
		locked: 'Заблоковано',
		protectedDomain: 'Захищений домен',
		excluded: 'rakhunok.com · виключено',
		session: 'Сесія',
		user: 'Користувач Rahunok',
		language: 'Мова інтерфейсу'
	},
	en: {
		backLabel: 'Return to Rahunok dashboard', mockMode: 'Mock mode', signOut: 'Sign out', back: 'Dashboard', kicker: 'Rahunok system map', title: 'Backend flow explorer',
		lede: 'Trace login, API requests, database operations, invoice scenarios, payment links and deployment on one interactive canvas.', boundary: 'System boundary', backend: 'Rahunok backend', trace: 'Architecture trace', contracts: 'Real contracts · mock data', notConnected: 'Not connected', deploy: 'Deploy', pause: 'Pause', rollback: 'Rollback', environment: 'Environment', preview: 'Preview / mock', mutation: 'Mutation capability', locked: 'Locked', protectedDomain: 'Protected domain', excluded: 'rakhunok.com · excluded', session: 'Session', user: 'Rahunok user', language: 'Interface language'
	}
} as const;

export const canvasText = {
	uk: { journeys: 'Процеси Rahunok', trace: 'макет траси', passed: 'пройдено', active: 'активно', pending: 'очікує', processes: 'Процеси', find: 'Знайти процес', empty: 'Процесів не знайдено', canvas: 'Інтерактивна мапа процесу', catalog: 'Каталог процесів Rahunok', inspector: 'Інспектор вузла', entry: 'Точка входу', status: 'Статус', execution: 'Виконання', simulation: 'Симуляція', result: 'Результат', communication: 'Комунікація', noMutation: 'Без доступу до змін', noMutationDetail: 'Цей вузол не може викликати Cloudflare API.' },
	en: { journeys: 'Rahunok processes', trace: 'mock trace', passed: 'passed', active: 'active', pending: 'pending', processes: 'Processes', find: 'Find process', empty: 'No matching process', canvas: 'Interactive process map', catalog: 'Rahunok process catalog', inspector: 'Node inspector', entry: 'Scenario entry', status: 'Status', execution: 'Execution', simulation: 'Simulation', result: 'Result', communication: 'Communication', noMutation: 'No mutation access', noMutationDetail: 'This node cannot call Cloudflare APIs.' }
} as const;

export const statusText = {
	uk: { complete: 'Завершено', running: 'Виконується', waiting: 'Очікує', blocked: 'Заблоковано', failed: 'Помилка' },
	en: { complete: 'Complete', running: 'Running', waiting: 'Waiting', blocked: 'Locked', failed: 'Failed' }
} as const;

const categoryUk: Record<FlowScenario['category'], string> = {
	Access: 'Доступ', PWA: 'PWA', Invoices: 'Рахунки', Routing: 'Маршрути', Checkout: 'Checkout', Payments: 'Платежі', POS: 'POS', Dashboard: 'Панель', Delivery: 'Доставка', Operations: 'Операції'
};

const scenarioUk: Record<string, { label: string; title: string; description: string }> = {
	login: { label: 'Вхід Google', title: 'Google OAuth і відновлення сесії', description: 'PKCE-вхід, відновлення браузерної сесії, пошук мерчанта та гілки onboarding і помилок.' },
	onboarding: { label: 'Онбординг', title: 'Онбординг і перевірка мерчанта', description: 'Створення бізнес-профілю після входу з перевірками даних та авторизації.' },
	'pwa-boot': { label: 'Запуск PWA', title: 'PWA shell, офлайн-кеш та оновлення', description: 'Service worker для /app використовує network-first, резервний кеш shell та контрольовані оновлення.' },
	'create-table': { label: 'Рахунок столу', title: 'Створення рахунку столу', description: 'Типізований запит, JWT і merchant guard, розрахунок суми, запис та відповідь із посиланням.' },
	'create-delivery': { label: 'Рахунок доставки', title: 'Створення рахунку доставки', description: 'Типізований запит, JWT і merchant guard, розрахунок суми, запис та відповідь із посиланням.' },
	'short-routes': { label: 'Короткі URL', title: 'Визначення публічних і скорочених адрес', description: '/o, /t, /tag, /pos, /pay та /checkout визначають рахунок або багаторазовий термінал.' },
	'checkout-fixed': { label: 'Фіксований checkout', title: 'Checkout із фіксованою сумою', description: 'Завантаження публічної моделі, перевірка стану оплати та гілки offline/not-found.' },
	'checkout-open_amount': { label: 'Вільна сума', title: 'Checkout із вільною сумою', description: 'Завантаження публічної моделі, введення суми, перевірка стану та гілки помилок.' },
	'checkout-table': { label: 'Checkout столу', title: 'Checkout рахунку столу', description: 'Пошук активного рахунку столу, очікування POS та перевірка стану оплати.' },
	'checkout-delivery': { label: 'Checkout доставки', title: 'Checkout із доставкою', description: 'Завантаження замовлення, введення даних доставки, розрахунок та перевірка оплати.' },
	'bank-catalogue': { label: 'Каталог банків', title: 'Каталог банків, KV-кеш і fallback', description: 'Ліниве завантаження банків використовує upstream, 24-годинний edge-кеш і вбудований fallback.' },
	'payment-initiation': { label: 'Запуск платежу', title: 'Captcha, перевірка платежу і deep link банку', description: 'Checkout перевіряє стан оплати й передає клієнта в застосунок банку з web/NBU fallback.' },
	'webhook-status': { label: 'Webhook і статус', title: 'Webhook-підтвердження, polling і realtime', description: 'Серверне підтвердження зберігає стан платежу; checkout і панель отримують оновлення.' },
	'invoice-lifecycle': { label: 'Життєвий цикл', title: 'Перелік, перегляд, поширення і скасування рахунків', description: 'RLS-читання, журнал подій, lifecycle-дії та гілки ownership/not-found.' },
	realtime: { label: 'Realtime', title: 'Realtime-підписки та черга прихованої вкладки', description: 'Зміни PostgreSQL оновлюють лише відповідні ресурси панелі.' },
	'promo-delivery': { label: 'Промо і доставка', title: 'Розрахунок промо та збереження доставки', description: 'Окремі checkout endpoints перевіряють дані, перераховують суму й зберігають помилки.' },
	'api-errors': { label: 'Помилки API', title: 'Спільна модель помилок API та відновлення', description: 'Дерево рішень для auth, validation, missing state, conflict, offline і server failures.' },
	fixed: { label: 'Фіксований рахунок', title: 'Створення рахунку з фіксованою сумою', description: 'Як панель створює конкретний рахунок, Worker перевіряє payload, а PostgreSQL зберігає платіжний запис.' },
	open_amount: { label: 'Вільна сума', title: 'Створення посилання з вільною сумою', description: 'Як мерчант створює платіжне посилання, в якому клієнт визначає суму в checkout.' },
	'table-pos': { label: 'Стіл / POS', title: 'Життєвий цикл QR столу і POS-рахунку', description: 'Як багаторазова адреса термінала знаходить стіл і створює рахунок для клієнта.' },
	payment: { label: 'Оплата', title: 'Публічний checkout і підтвердження платежу', description: 'Від відкриття публічного URL до переходу в банк, webhook та realtime-оновлення панелі.' },
	deploy: { label: 'Розгортання', title: 'Build, review і захищене розгортання', description: 'Ізольований release pipeline. Керування змінами заблоковане до явного підтвердження готовності.' }
};

export function localizedScenario(scenario: FlowScenario, locale: CorexLocale) {
	return locale === 'uk' ? (scenarioUk[scenario.id] ?? scenario) : scenario;
}

export function localizedCategory(category: FlowScenario['category'], locale: CorexLocale) {
	return locale === 'uk' ? categoryUk[category] : category;
}