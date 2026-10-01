import type { Locale } from './translations';

export const ecosystemCopy = {
	uk: {
		eyebrow: 'ПЛАТІЖНА ЕКОСИСТЕМА ДЛЯ УКРАЇНИ',
		headline: 'Між вашим бізнесом і знайомим банком.',
		intro:
			'Ви виставляєте рахунок. Покупець платить у своєму банку. За столиком, на касі чи онлайн.',
		heroJourney: ['Рахунок від бізнесу', 'Переказ у банку', 'Перевірка надходження'],
		primary: 'Підключити бізнес',
		secondary: 'Знайти свій банк',
		rolesTitle: 'Одна екосистема. Кожен на своєму місці.',
		rolesIntro:
			'Не новий банк і не ще один гаманець. Rahunok поєднує інструменти бізнесу з оплатою через банківські застосунки.',
		roles: [
			{
				name: 'Для бізнесу',
				title: 'Виставляйте рахунки. Керуйте роботою.',
				text: 'App для каси, Dashboard для команди. Створюйте рахунки, передавайте QR або посилання та відстежуйте їхні статуси.',
				action: 'Переглянути сценарій',
				href: '#how-it-works',
				product: 'APP + DASHBOARD'
			},
			{
				name: 'Для покупця',
				title: 'Знайомий банк. Зручний шлях до оплати.',
				text: 'Відкрийте рахунок у Rahunok Pay, оберіть доступний банк і підтвердьте переказ у його застосунку.',
				action: 'Банківські застосунки',
				href: '#banks',
				product: 'PAY'
			},
			{
				name: 'Для платформ',
				title: 'Ваш продукт. Пов’язаний платіжний процес.',
				text: 'Інтегруйте рахунки й платіжні посилання у власний сервіс. Контракти API та умови підключення — для вашого сценарію.',
				action: 'Відкрити документацію',
				href: '/docs/',
				product: 'API + COREX'
			}
		],
		banksEyebrow: 'БАНКІВСЬКІ ЗАСТОСУНКИ',
		banksTitle: 'Ваш банк уже знайомий. Знайдіть його тут.',
		banksIntro: 'Активні застосунки з каталогу Rahunok для переходу до оплати.',
		banksNote:
			'Наявність у каталозі не означає партнерства з банком. Доступність конкретного переказу, комісії та підтвердження залежать від банку й налаштувань пілота.',
		search: 'Назва банку',
		clear: 'Очистити пошук',
		empty: 'За цією назвою нічого не знайдено.',
		unavailable:
			'Каталог тимчасово недоступний. Перевірте його за посиланням або зверніться до команди.',
		source: 'Джерело: каталог банків',
		count: 'застосунків у каталозі',
		flowTitle: 'Рахунок пов’язує. Банк переказує.',
		flowSteps: [
			'Бізнес створює рахунок',
			'Покупець підтверджує в банку',
			'Бізнес перевіряє надходження'
		],
		flowNote:
			'Відкриття банківського застосунку ще не означає оплату. Видача замовлення — після перевірки надходження; фіскалізація — через підключений ПРРО.',
		casesTitle: 'Там, де відбувається ваше життя.',
		casesIntro: 'Один підхід до рахунків. Різні щоденні сценарії.',
		cases: ['За столиком', 'Біля каси', 'За послугу', 'У вашому сервісі'],
		caseText: [
			'QR-рахунок для гостя кафе чи ресторану.',
			'Рахунок зі смартфона продавця.',
			'Платіжне посилання для клієнта.',
			'Рахунки та посилання через API.'
		],
		caseAlt: [
			'Ілюстрація QR-оплати в закладі',
			'Ілюстрація смартфона на касі',
			'Ілюстрація платіжного посилання',
			'Ілюстрація цифрової платіжної інтеграції'
		],
		demo: 'Демонстраційний сценарій. Без реальних переказів.',
		faq: 'Важливе — до першої оплати.',
		pilotLabel: 'ПІЛОТ ДЛЯ ВАШОГО БІЗНЕСУ',
		pilotTitle: 'Почнімо з одного рахунку.',
		pilotText:
			'Разом визначимо сценарій, доступні банки, інтеграції та вартість. Усі умови — до запуску реальних оплат.',
		pricing: 'Індивідуальні умови пілота',
		nav: ['Екосистема', 'Банки', 'Як працює', 'Вартість', 'Питання']
	},
	en: {
		eyebrow: 'A PAYMENT ECOSYSTEM FOR UKRAINE',
		headline: 'Between your business and a familiar bank.',
		intro:
			'You send the invoice. Your customer pays in their bank. At the table, at checkout or online.',
		heroJourney: ['Business invoice', 'Bank transfer', 'Receipt verified'],
		primary: 'Connect your business',
		secondary: 'Find your bank',
		rolesTitle: 'One ecosystem. A place for everyone.',
		rolesIntro:
			'Not a new bank or another wallet. Rahunok connects business tools with payment through banking apps.',
		roles: [
			{
				name: 'For businesses',
				title: 'Send invoices. Run your business.',
				text: 'App for checkout, Dashboard for your team. Create invoices, share QR codes or links, and track their status.',
				action: 'Explore the journey',
				href: '#how-it-works',
				product: 'APP + DASHBOARD'
			},
			{
				name: 'For customers',
				title: 'A familiar bank. A convenient way to pay.',
				text: 'Open an invoice in Rahunok Pay, choose an available bank and confirm the transfer in its app.',
				action: 'Browse banking apps',
				href: '#banks',
				product: 'PAY'
			},
			{
				name: 'For platforms',
				title: 'Your product. A connected payment flow.',
				text: 'Integrate invoices and payment links into your service. API contracts and connection terms for your use case.',
				action: 'Read the documentation',
				href: '/docs/',
				product: 'API + COREX'
			}
		],
		banksEyebrow: 'BANKING APPS',
		banksTitle: 'A bank you know. Find it here.',
		banksIntro: 'Active apps in the Rahunok directory for payment handoff.',
		banksNote:
			'A directory listing does not imply a bank partnership. Transfer availability, fees and confirmation depend on the bank and pilot configuration.',
		search: 'Bank name',
		clear: 'Clear search',
		empty: 'No banks match this name.',
		unavailable: 'The directory is temporarily unavailable. Open the source or contact our team.',
		source: 'Source: bank directory',
		count: 'apps in the directory',
		flowTitle: 'Rahunok connects. The bank transfers.',
		flowSteps: [
			'The business creates an invoice',
			'The customer confirms in their bank',
			'The business checks receipt of funds'
		],
		flowNote:
			'Opening a banking app is not payment confirmation. Fulfil orders after checking receipt of funds; fiscalisation requires a connected fiscal service.',
		casesTitle: 'Where everyday life happens.',
		casesIntro: 'One approach to invoices. Different everyday moments.',
		cases: ['At the table', 'At checkout', 'For a service', 'In your platform'],
		caseText: [
			'A QR invoice for a café or restaurant guest.',
			'An invoice from the seller’s phone.',
			'A payment link for your customer.',
			'Invoices and payment links through the API.'
		],
		caseAlt: [
			'Illustration of QR payment at a venue',
			'Illustration of a phone at checkout',
			'Illustration of a payment link',
			'Illustration of a digital payment integration'
		],
		demo: 'Illustrative journey. No real transfers.',
		faq: 'Before your first payment.',
		pilotLabel: 'A PILOT FOR YOUR BUSINESS',
		pilotTitle: 'Start with one invoice.',
		pilotText:
			'Together, define the use case, available banks, integrations and pricing. Agree every term before real payments begin.',
		pricing: 'Tailored pilot terms',
		nav: ['Ecosystem', 'Banks', 'How it works', 'Pricing', 'Questions']
	},
	pl: {
		eyebrow: 'EKOSYSTEM PŁATNICZY DLA UKRAINY',
		headline: 'Między Twoją firmą a znajomym bankiem.',
		intro:
			'Ty wystawiasz rachunek. Klient płaci w swoim banku. Przy stoliku, przy kasie lub online.',
		heroJourney: ['Rachunek od firmy', 'Przelew w banku', 'Sprawdzenie wpływu'],
		primary: 'Podłącz swoją firmę',
		secondary: 'Znajdź swój bank',
		rolesTitle: 'Jeden ekosystem. Miejsce dla każdego.',
		rolesIntro:
			'Nie nowy bank ani kolejny portfel. Rahunok łączy narzędzia firmy z płatnościami przez aplikacje bankowe.',
		roles: [
			{
				name: 'Dla firm',
				title: 'Wystawiaj rachunki. Zarządzaj firmą.',
				text: 'App dla kasy, Dashboard dla zespołu. Twórz rachunki, udostępniaj QR lub linki i śledź statusy.',
				action: 'Zobacz scenariusz',
				href: '#how-it-works',
				product: 'APP + DASHBOARD'
			},
			{
				name: 'Dla klientów',
				title: 'Znany bank. Wygodna droga do płatności.',
				text: 'Otwórz rachunek w Rahunok Pay, wybierz dostępny bank i potwierdź przelew w jego aplikacji.',
				action: 'Aplikacje bankowe',
				href: '#banks',
				product: 'PAY'
			},
			{
				name: 'Dla platform',
				title: 'Twój produkt. Połączony proces płatności.',
				text: 'Zintegruj rachunki i linki płatnicze ze swoim serwisem. Kontrakty API i warunki podłączenia dla Twojego scenariusza.',
				action: 'Dokumentacja',
				href: '/docs/',
				product: 'API + COREX'
			}
		],
		banksEyebrow: 'APLIKACJE BANKOWE',
		banksTitle: 'Bank, który znasz. Znajdź go tutaj.',
		banksIntro: 'Aktywne aplikacje z katalogu Rahunok do przejścia do płatności.',
		banksNote:
			'Obecność w katalogu nie oznacza partnerstwa z bankiem. Dostępność przelewu, opłaty i potwierdzenie zależą od banku i konfiguracji pilotażu.',
		search: 'Nazwa banku',
		clear: 'Wyczyść wyszukiwanie',
		empty: 'Nie znaleziono banku o tej nazwie.',
		unavailable: 'Katalog jest chwilowo niedostępny. Otwórz źródło lub skontaktuj się z zespołem.',
		source: 'Źródło: katalog banków',
		count: 'aplikacji w katalogu',
		flowTitle: 'Rahunok łączy. Bank przelewa.',
		flowSteps: [
			'Firma tworzy rachunek',
			'Klient potwierdza w banku',
			'Firma sprawdza wpływ środków'
		],
		flowNote:
			'Otwarcie aplikacji bankowej nie potwierdza płatności. Wydaj zamówienie po sprawdzeniu wpływu; fiskalizacja wymaga podłączonej usługi.',
		casesTitle: 'Tam, gdzie toczy się codzienne życie.',
		casesIntro: 'Jedno podejście do rachunków. Różne codzienne sytuacje.',
		cases: ['Przy stoliku', 'Przy kasie', 'Za usługę', 'W Twoim serwisie'],
		caseText: [
			'Rachunek QR dla gościa kawiarni lub restauracji.',
			'Rachunek ze smartfona sprzedawcy.',
			'Link do płatności dla klienta.',
			'Rachunki i linki przez API.'
		],
		caseAlt: [
			'Ilustracja płatności QR w lokalu',
			'Ilustracja telefonu przy kasie',
			'Ilustracja linku płatniczego',
			'Ilustracja cyfrowej integracji płatniczej'
		],
		demo: 'Scenariusz demonstracyjny. Bez prawdziwych przelewów.',
		faq: 'Przed pierwszą płatnością.',
		pilotLabel: 'PILOTAŻ DLA TWOJEJ FIRMY',
		pilotTitle: 'Zacznijmy od jednego rachunku.',
		pilotText:
			'Wspólnie określimy scenariusz, banki, integracje i cenę. Wszystkie warunki przed uruchomieniem płatności.',
		pricing: 'Indywidualne warunki pilotażu',
		nav: ['Ekosystem', 'Banki', 'Jak to działa', 'Koszt', 'Pytania']
	}
} satisfies Record<Locale, object>;
