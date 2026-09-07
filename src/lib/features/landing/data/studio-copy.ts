import type { Locale } from './translations';
import { refreshCopy } from './refresh-copy';

export const studioCopy = {
	uk: {
		nav: ['Продукт', 'Екосистема', 'Рішення', 'Аналітика'],
		eyebrow: 'RAHUNOK · BUSINESS PAYMENT PLATFORM',
		title: 'Оплата — простіша.',
		accent: 'Бізнес — під контролем.',
		intro:
			'Від першого QR-рахунку до мережі торгових точок. Оплати, каси та фінансова картина — в одному продуманому просторі.',
		product: 'Один платіж. Дві сторони. Повна картина.',
		productText:
			'Спробуйте оплату в телефоні. Подивіться, як змінюються рахунок і показники в кабінеті. Усе тут — безпечна локальна демонстрація.',
		demo: 'Інтерактивний продукт',
		demoData: 'Демонстраційні дані',
		overview: 'Огляд бізнесу',
		today: 'Сьогодні',
		week: 'Тиждень',
		revenue: 'Обсяг оплат',
		payments: 'Оплачені рахунки',
		average: 'Середній чек',
		recent: 'Останні рахунки',
		customer: 'Призначення',
		status: 'Статус',
		amount: 'Сума',
		allLocations: 'Усі точки',
		terminal: 'Каса · Тераса',
		choose: 'Оберіть банк',
		pay: 'Підтвердити демо-оплату',
		reset: 'Новий демо-рахунок',
		paid: 'Оплату показано',
		awaiting: 'Очікує',
		confirmed: 'Оплачено',
		phoneNote: 'Демо · без списання коштів',
		bankNote: 'Банки наведені як приклад інтерфейсу, не як гарантія доступності інтеграцій.',
		ecosystem: 'Екосистема можливостей.',
		ecosystemAccent: 'Усе працює разом.',
		ecosystemText:
			'Оберіть можливість. Побачте її місце в процесі — від створення рахунку до звірки й обліку.',
		selected: 'У платіжному процесі',
		connection: 'Доступність і умови інтеграцій перевіряються перед підключенням.',
		features: [
			[
				'QR',
				'Рахунок в одному скануванні',
				'Покажіть код на екрані каси або додайте його до замовлення. Клієнт бачить продавця, суму та призначення.',
				'Рахунок → QR → екран оплати'
			],
			[
				'NFC',
				'Один дотик до рахунку',
				'Сумісна NFC-мітка може відкривати платіжне посилання. Це не безконтактний картковий термінал.',
				'Мітка → посилання → checkout'
			],
			[
				'LINK',
				'Оплата там, де ваш клієнт',
				'Надішліть рахунок у чаті, листі або разом із підтвердженням замовлення. Без ручного переписування реквізитів.',
				'Замовлення → посилання → клієнт'
			],
			[
				'STATUS',
				'Статус, на який можна спиратися',
				'Перевіряйте рахунок і надходження коштів. Відкриття банківського застосунку саме по собі не підтверджує оплату.',
				'Банк → звірка → статус рахунку'
			],
			[
				'ПРРО',
				'Платіж і фіскалізація',
				'Підключайте фіскальний процес окремо. Платіжне підтвердження не замінює чек ПРРО.',
				'Підтвердження → налаштований ПРРО → чек'
			],
			[
				'DATA',
				'Цифри складаються в картину',
				'Аналізуйте історію рахунків, обсяг оплат і роботу кас. На цій сторінці всі операційні показники — демонстраційні.',
				'Рахунки → історія → аналітика'
			],
			[
				'BOT',
				'Ще один робочий інтерфейс',
				'Сценарій касира в Telegram — додатковий канал роботи, доступність якого потрібно погодити для вашого бізнесу.',
				'Касир → бот → рахунок'
			],
			[
				'API',
				'Частина вашої системи',
				'Побудуйте власний сценарій через документовані API. Доступ, події та правила звірки узгоджуються під час інтеграції.',
				'Ваша система → API → платіжний процес'
			]
		],
		solutions: 'Ваш бізнес. Ваш сценарій.',
		solutionsText: 'Не один шаблон на всіх. Подивіться, як рахунок вписується у ваш робочий день.',
		workflow: 'Як це працює',
		cases: [
			[
				'HoReCa',
				'Менше очікування. Більше гостинності.',
				'Рахунок за столиком, оплата з телефона гостя та зрозумілий статус для персоналу.',
				'Створіть рахунок для столика',
				'Гість відкриває QR і підтверджує переказ',
				'Офіціант перевіряє оплату та закриває замовлення'
			],
			[
				'Retail',
				'Ваша каса. Без зайвого обладнання.',
				'Смартфон або браузер як робоче місце касира — від невеликого магазину до кількох точок.',
				'Касир вводить суму покупки',
				'Покупець відкриває рахунок через QR',
				'Касир перевіряє надходження та видає товар'
			],
			[
				'Services',
				'Від домовленості — до оплати.',
				'Консультації, записи, готові замовлення й доставка. Рахунок у тому самому чаті, де ваш клієнт.',
				'Сформуйте рахунок за послугу',
				'Надішліть посилання клієнту',
				'Перевірте статус перед виконанням замовлення'
			],
			[
				'Online / API',
				'Ваш продукт. Єдиний платіжний процес.',
				'Поєднайте рахунки з власним сайтом, CRM або мережею. Почніть із документації та перевірки контрактів.',
				'Узгодьте метод оплати й API-доступ',
				'Інтегруйте створення рахунків та checkout',
				'Налаштуйте звірку і перевірте обробку подій'
			]
		],
		planB: 'План Б, який варто мати заздалегідь.',
		planBText:
			'Термінал недоступний? Покажіть QR або надішліть посилання. Сценарій потребує інтернету, доступного банку та попереднього налаштування — це не офлайн-оплата.',
		analytics: 'Фінансова аналітика.',
		analyticsAccent: 'Рішення, яке можна порахувати.',
		analyticsText:
			'Рухайте повзунки. Змінюйте умови. Порівнюйте повну вартість, а не тільки відсоток комісії.',
		monthly: 'За місяць',
		annual: 'За рік',
		sample: 'Приклад умов — не тарифна оферта',
		presets: ['Кав’ярня', 'Магазин', 'Мережа'],
		projection: 'Накопичена різниця за 12 місяців',
		negative: 'За цих умов Rahunok дорожчий',
		rentUnit: 'Оренда одного термінала, ₴/міс',
		terminals: 'Кількість терміналів',
		assumptions: 'Умови для порівняння',
		faq: 'Є запитання. Є відповіді.',
		faqText: 'Від першого рахунку до щоденних операцій.',
		extraFaq: [
			[
				'Чи потрібен фізичний POS-термінал?',
				'Для рахунку за QR або посиланням окремий картковий термінал не потрібен. Потрібні пристрій із браузером, інтернет і налаштований прийом оплат.'
			],
			[
				'Куди надходять гроші?',
				'Реквізити отримувача задаються для бізнесу. Строк і спосіб зарахування залежать від активного платіжного методу та банку. Перевіряйте реквізити перед початком роботи.'
			],
			[
				'Чи потрібен рахунок ФОП або ТОВ?',
				'Для бізнес-оплат потрібні дані зареєстрованого суб’єкта господарювання та сумісний бізнес-рахунок. Умови доступності перевіряються при підключенні.'
			],
			[
				'Як працюють QR і NFC?',
				'QR відкриває екран рахунку. Сумісна NFC-мітка може відкривати посилання на нього. NFC-мітка не приймає банківські картки як термінал.'
			],
			[
				'Чи працює це на iPhone та Android?',
				'Веб-екран рахунку адаптований до мобільного браузера. Перехід у банк залежить від пристрою, встановленого застосунку та доступної інтеграції.'
			],
			[
				'Що робити при втраті зв’язку?',
				'Не видавайте замовлення на підставі скриншота. Після відновлення інтернету перевірте рахунок і фактичне зарахування. Не створюйте повторний платіж без звірки.'
			],
			[
				'Як діяти з поверненням або подвійною оплатою?',
				'Звірте ідентифікатори рахунків і банківські надходження. Далі використовуйте погоджений із банком або провайдером процес повернення; не вважайте скасування рахунку поверненням грошей.'
			]
		],
		final: 'Наступний розділ вашого бізнесу.',
		finalText: 'Почніть з одного рахунку. Побудуйте процес, який зростатиме разом із вами.',
		motion: 'Анімація фону'
	},
	en: {
		nav: ['Product', 'Ecosystem', 'Solutions', 'Analytics'],
		eyebrow: 'RAHUNOK · BUSINESS PAYMENT PLATFORM',
		title: 'Payments made simpler.',
		accent: 'Business in focus.',
		intro:
			'From your first QR invoice to multiple locations. Payments, checkouts and financial insight — in one considered workspace.',
		product: 'One payment. Both sides. The full picture.',
		productText:
			'Try paying on the phone. Watch the invoice and dashboard respond. Everything here is a safe local demonstration.',
		demo: 'Interactive product',
		demoData: 'Illustrative data',
		overview: 'Business overview',
		today: 'Today',
		week: 'Week',
		revenue: 'Payment volume',
		payments: 'Paid invoices',
		average: 'Average payment',
		recent: 'Recent invoices',
		customer: 'Description',
		status: 'Status',
		amount: 'Amount',
		allLocations: 'All locations',
		terminal: 'Checkout · Terrace',
		choose: 'Choose a bank',
		pay: 'Confirm demo payment',
		reset: 'New demo invoice',
		paid: 'Payment demonstrated',
		awaiting: 'Pending',
		confirmed: 'Paid',
		phoneNote: 'Demo · no money moved',
		bankNote: 'Banks illustrate the interface, not guaranteed integration availability.',
		ecosystem: 'An ecosystem of possibilities.',
		ecosystemAccent: 'Better together.',
		ecosystemText:
			'Select a capability to see its place in the process, from invoice creation to reconciliation.',
		selected: 'In the payment process',
		connection: 'Integration availability and terms must be checked before onboarding.',
		features: [
			[
				'QR',
				'One scan to your invoice',
				'Display a code at checkout or include it with an order. The customer sees the merchant, amount and purpose.',
				'Invoice → QR → payment screen'
			],
			[
				'NFC',
				'A tap to open the invoice',
				'A compatible NFC tag can open a payment link. It is not a contactless card terminal.',
				'Tag → link → checkout'
			],
			[
				'LINK',
				'Where your customers are',
				'Send invoices in a chat, email or order confirmation. No manual copying of bank details.',
				'Order → link → customer'
			],
			[
				'STATUS',
				'A status you can act on',
				'Check the invoice and incoming funds. Opening a banking app alone does not prove payment.',
				'Bank → reconciliation → invoice status'
			],
			[
				'FISCAL',
				'Payments and fiscal receipts',
				'Configure fiscalisation separately. Payment confirmation is not a fiscal receipt.',
				'Confirmation → configured fiscal service → receipt'
			],
			[
				'DATA',
				'See the bigger picture',
				'Explore invoice history, payment volume and checkouts. All operational metrics on this page are illustrative.',
				'Invoices → history → analytics'
			],
			[
				'BOT',
				'Another way to work',
				'A Telegram cashier workflow is an additional channel whose availability must be agreed for your business.',
				'Cashier → bot → invoice'
			],
			[
				'API',
				'Part of your own system',
				'Build around documented APIs. Access, events and reconciliation rules are agreed during integration.',
				'Your system → API → payment flow'
			]
		],
		solutions: 'Your business. Your way.',
		solutionsText: 'Not one template for everyone. See how invoicing fits into your working day.',
		workflow: 'How it works',
		cases: [
			[
				'HoReCa',
				'Less waiting. More hospitality.',
				'Table invoices, payment from the guest’s phone and a clear status for your team.',
				'Create an invoice for the table',
				'The guest opens the QR and confirms the transfer',
				'Staff check the payment and close the order'
			],
			[
				'Retail',
				'Your checkout. Less hardware.',
				'A smartphone or browser as a cashier workspace, from a small shop to multiple locations.',
				'The cashier enters the purchase amount',
				'The customer opens the QR invoice',
				'The cashier verifies receipt before handing over goods'
			],
			[
				'Services',
				'From conversation to payment.',
				'Consultations, appointments, completed orders and delivery. An invoice in the same chat as your customer.',
				'Create an invoice for your service',
				'Send your customer the link',
				'Check the status before fulfilment'
			],
			[
				'Online / API',
				'Your product. One payment flow.',
				'Connect invoices to your site, CRM or network. Start with documentation and contract validation.',
				'Agree a payment method and API access',
				'Integrate invoices and checkout',
				'Configure reconciliation and test event handling'
			]
		],
		planB: 'A plan B, before you need it.',
		planBText:
			'Terminal unavailable? Show a QR code or send a link. Internet, an available bank and prior setup are required — this is not offline payment.',
		analytics: 'Financial analytics.',
		analyticsAccent: 'A decision you can calculate.',
		analyticsText:
			'Move the sliders. Adjust the terms. Compare total costs, not just a commission percentage.',
		monthly: 'Monthly',
		annual: 'Annually',
		sample: 'Example terms — not a pricing offer',
		presets: ['Café', 'Shop', 'Network'],
		projection: 'Cumulative difference over 12 months',
		negative: 'Rahunok costs more under these terms',
		rentUnit: 'Rent per terminal, UAH/mo',
		terminals: 'Number of terminals',
		assumptions: 'Comparison assumptions',
		faq: 'Good questions. Clear answers.',
		faqText: 'From the first invoice to daily operations.',
		extraFaq: [
			[
				'Do I need a physical POS terminal?',
				'QR and payment links do not require a separate card terminal. You need a browser device, internet and configured payment acceptance.'
			],
			[
				'Where do the funds go?',
				'Recipient details are configured for the business. Settlement method and time depend on the payment integration and bank. Verify details before use.'
			],
			[
				'Do I need a business account?',
				'Business payments require registered business details and a compatible business account. Eligibility is checked during onboarding.'
			],
			[
				'How do QR and NFC work?',
				'QR opens the invoice screen. A compatible NFC tag can open its link. An NFC tag does not accept bank cards as a terminal.'
			],
			[
				'Does it work on iPhone and Android?',
				'The invoice screen adapts to mobile browsers. Bank handoff depends on the device, installed app and available integration.'
			],
			[
				'What happens if connectivity is lost?',
				'Do not fulfil an order based on a screenshot. When online again, verify the invoice and incoming funds. Reconcile before attempting another payment.'
			],
			[
				'What about refunds or duplicate payments?',
				'Match invoice identifiers against incoming bank transfers. Follow the agreed bank or provider refund process; cancelling an invoice does not refund money.'
			]
		],
		final: 'Your business. Its next chapter.',
		finalText: 'Start with one invoice. Build a process that grows with you.',
		motion: 'Background animation'
	},
	pl: {
		nav: ['Produkt', 'Ekosystem', 'Rozwiązania', 'Analityka'],
		eyebrow: 'RAHUNOK · BUSINESS PAYMENT PLATFORM',
		title: 'Płatności prostsze.',
		accent: 'Biznes pod kontrolą.',
		intro:
			'Od pierwszego rachunku QR do sieci placówek. Płatności, kasy i obraz finansów — w jednej przemyślanej przestrzeni.',
		product: 'Jedna płatność. Dwie strony. Pełny obraz.',
		productText:
			'Wypróbuj płatność na telefonie. Obserwuj rachunek i panel. Wszystko tutaj jest bezpieczną lokalną demonstracją.',
		demo: 'Interaktywny produkt',
		demoData: 'Dane demonstracyjne',
		overview: 'Przegląd firmy',
		today: 'Dzisiaj',
		week: 'Tydzień',
		revenue: 'Wartość płatności',
		payments: 'Opłacone rachunki',
		average: 'Średnia płatność',
		recent: 'Ostatnie rachunki',
		customer: 'Opis',
		status: 'Status',
		amount: 'Kwota',
		allLocations: 'Wszystkie punkty',
		terminal: 'Kasa · Taras',
		choose: 'Wybierz bank',
		pay: 'Potwierdź płatność demo',
		reset: 'Nowy rachunek demo',
		paid: 'Płatność pokazana',
		awaiting: 'Oczekuje',
		confirmed: 'Opłacono',
		phoneNote: 'Demo · bez pobierania środków',
		bankNote: 'Banki ilustrują interfejs, nie gwarantują dostępności integracji.',
		ecosystem: 'Ekosystem możliwości.',
		ecosystemAccent: 'Razem działa lepiej.',
		ecosystemText:
			'Wybierz funkcję i zobacz jej miejsce w procesie — od rachunku do uzgodnienia płatności.',
		selected: 'W procesie płatności',
		connection: 'Dostępność integracji i warunki należy sprawdzić przed podłączeniem.',
		features: [
			[
				'QR',
				'Rachunek w jednym skanowaniu',
				'Pokaż kod przy kasie lub dołącz do zamówienia. Klient widzi sprzedawcę, kwotę i tytuł.',
				'Rachunek → QR → ekran płatności'
			],
			[
				'NFC',
				'Dotknij, aby otworzyć rachunek',
				'Zgodny tag NFC może otworzyć link do płatności. To nie terminal kart zbliżeniowych.',
				'Tag → link → checkout'
			],
			[
				'LINK',
				'Tam, gdzie Twój klient',
				'Wyślij rachunek w czacie, e-mailu lub potwierdzeniu zamówienia. Bez przepisywania danych.',
				'Zamówienie → link → klient'
			],
			[
				'STATUS',
				'Status do dalszych działań',
				'Sprawdź rachunek i wpływ środków. Samo otwarcie aplikacji bankowej nie potwierdza płatności.',
				'Bank → uzgodnienie → status'
			],
			[
				'FISKAL',
				'Płatności i fiskalizacja',
				'Skonfiguruj fiskalizację oddzielnie. Potwierdzenie płatności nie zastępuje paragonu.',
				'Potwierdzenie → usługa fiskalna → paragon'
			],
			[
				'DATA',
				'Pełny obraz w liczbach',
				'Analizuj historię rachunków, płatności i kasy. Wszystkie wskaźniki na tej stronie są demonstracyjne.',
				'Rachunki → historia → analityka'
			],
			[
				'BOT',
				'Jeszcze jeden interfejs pracy',
				'Scenariusz kasjera w Telegramie to dodatkowy kanał, którego dostępność wymaga uzgodnienia.',
				'Kasjer → bot → rachunek'
			],
			[
				'API',
				'Część Twojego systemu',
				'Korzystaj z udokumentowanych API. Dostęp, zdarzenia i uzgodnienia ustalane są podczas integracji.',
				'Twój system → API → płatności'
			]
		],
		solutions: 'Twój biznes. Twój scenariusz.',
		solutionsText:
			'Nie jeden szablon dla wszystkich. Zobacz, jak rachunek pasuje do Twojego dnia pracy.',
		workflow: 'Jak to działa',
		cases: [
			[
				'HoReCa',
				'Mniej czekania. Więcej gościnności.',
				'Rachunek przy stoliku, płatność telefonem gościa i czytelny status dla personelu.',
				'Utwórz rachunek dla stolika',
				'Gość otwiera QR i potwierdza przelew',
				'Personel sprawdza płatność i zamyka zamówienie'
			],
			[
				'Retail',
				'Twoja kasa. Mniej sprzętu.',
				'Smartfon lub przeglądarka jako stanowisko kasjera — od sklepu do wielu punktów.',
				'Kasjer wpisuje kwotę zakupu',
				'Klient otwiera rachunek QR',
				'Kasjer sprawdza wpływ przed wydaniem towaru'
			],
			[
				'Services',
				'Od rozmowy do płatności.',
				'Konsultacje, wizyty, zamówienia i dostawa. Rachunek w tym samym czacie co klient.',
				'Utwórz rachunek za usługę',
				'Wyślij klientowi link',
				'Sprawdź status przed realizacją'
			],
			[
				'Online / API',
				'Twój produkt. Jeden proces płatności.',
				'Połącz rachunki ze stroną, CRM lub siecią. Zacznij od dokumentacji i weryfikacji kontraktów.',
				'Uzgodnij metodę i dostęp API',
				'Zintegruj rachunki i checkout',
				'Skonfiguruj uzgodnienia i przetestuj zdarzenia'
			]
		],
		planB: 'Plan B, zanim będzie potrzebny.',
		planBText:
			'Terminal niedostępny? Pokaż QR lub wyślij link. Potrzebny jest internet, dostępny bank i wcześniejsza konfiguracja — to nie płatność offline.',
		analytics: 'Analityka finansowa.',
		analyticsAccent: 'Decyzja, którą można policzyć.',
		analyticsText:
			'Przesuwaj suwaki. Zmieniaj warunki. Porównuj pełne koszty, nie tylko procent prowizji.',
		monthly: 'Miesięcznie',
		annual: 'Rocznie',
		sample: 'Przykładowe warunki — nie oferta cenowa',
		presets: ['Kawiarnia', 'Sklep', 'Sieć'],
		projection: 'Skumulowana różnica w ciągu 12 miesięcy',
		negative: 'W tych warunkach Rahunok kosztuje więcej',
		rentUnit: 'Wynajem terminala, UAH/mies.',
		terminals: 'Liczba terminali',
		assumptions: 'Założenia porównania',
		faq: 'Dobre pytania. Jasne odpowiedzi.',
		faqText: 'Od pierwszego rachunku do codziennej pracy.',
		extraFaq: [
			[
				'Czy potrzebny jest terminal POS?',
				'QR i linki nie wymagają osobnego terminala kart. Potrzebne są przeglądarka, internet i skonfigurowane płatności.'
			],
			[
				'Gdzie trafiają środki?',
				'Dane odbiorcy ustalane są dla firmy. Sposób i czas księgowania zależą od integracji i banku. Sprawdź dane przed rozpoczęciem.'
			],
			[
				'Czy potrzebne jest konto firmowe?',
				'Płatności biznesowe wymagają danych zarejestrowanej firmy i zgodnego konta firmowego. Warunki sprawdzane są przy podłączeniu.'
			],
			[
				'Jak działają QR i NFC?',
				'QR otwiera ekran rachunku. Zgodny tag NFC może otworzyć link. Tag nie przyjmuje kart jak terminal.'
			],
			[
				'Czy działa na iPhone i Android?',
				'Ekran rachunku dostosowuje się do przeglądarki mobilnej. Przejście do banku zależy od urządzenia, aplikacji i integracji.'
			],
			[
				'Co w razie utraty połączenia?',
				'Nie realizuj zamówienia na podstawie zrzutu ekranu. Po odzyskaniu internetu sprawdź rachunek i wpływ. Uzgodnij dane przed ponowną płatnością.'
			],
			[
				'Co ze zwrotami lub podwójną płatnością?',
				'Porównaj identyfikatory rachunków z przelewami. Stosuj uzgodniony proces zwrotu banku lub dostawcy; anulowanie rachunku nie zwraca pieniędzy.'
			]
		],
		final: 'Kolejny rozdział Twojej firmy.',
		finalText: 'Zacznij od jednego rachunku. Zbuduj proces, który rośnie z Tobą.',
		motion: 'Animacja tła'
	}
};

export function getStudioFaq(locale: Locale) {
	return [...refreshCopy[locale].faq, ...studioCopy[locale].extraFaq];
}
