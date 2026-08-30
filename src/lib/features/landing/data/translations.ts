export type Locale = 'uk' | 'en' | 'pl';

export interface SolutionModalData {
	id: string;
	indexLabel: string;
	tag: string;
	badge: string;
	heroTitle: string;
	heroSubtitle: string;
	heroHighlight: string;
	metrics: Array<{ value: string; label: string; sub?: string }>;
	highlights: Array<{ title: string; desc: string; icon: string; tag?: string }>;
	comparison: {
		title: string;
		desc: string;
		headers: [string, string, string];
		rows: Array<{ feature: string; competitor: string; rahunok: string; isAdvantage: boolean }>;
	};
	workflow: {
		title: string;
		steps: Array<{ step: string; title: string; desc: string }>;
	};
	cta: {
		title: string;
		desc: string;
		btn: string;
	};
}

export interface Translations {
	langName: string;
	brand: {
		name: string;
		tagline: string;
	};
	nav: {
		howItWorks: string;
		forBusiness: string;
		moneyFlow: string;
		pricing: string;
		faq: string;
		pos: string;
		account: string;
		tryPilot: string;
		calculateSavings: string;
	};
	hero: {
		eyebrowAudience: {
			business: string;
			personal: string;
		};
		eyebrowBadge: string;
		initialHeadlinePrefix: string;
		initialHeadlineAccent: string;
		finalHeadlineStart: string;
		finalHeadlineMiddle: string;
		finalHeadlineEnd: string;
		subhead: string;
		tryPilotBtn: string;
		calculateSavingsBtn: string;
		proof: {
			zeroHardware: { title: string; desc: string };
			instantSettlement: { title: string; desc: string };
			autoPrro: { title: string; desc: string };
		};
		dashboard: {
			title: string;
			navOverview: string;
			navPos: string;
			navInvoices: string;
			navManagement: string;
			navStructure: string;
			navRules: string;
			financialOverview: string;
			todayRevenue: string;
			successfulPayments: string;
			avgCheck: string;
			recentOperations: string;
			colTime: string;
			colPurpose: string;
			colStatus: string;
			colAmount: string;
			statusPaid: string;
			coffeeTable: string;
			lunchTable: string;
			dinnerTable: string;
			takeaway: string;
		};
		checkout: {
			time: string;
			appTitle: string;
			merchantName: string;
			tableBadge: string;
			statusWaiting: string;
			statusProcessing: string;
			statusPaid: string;
			securityBadge: string;
			noFeeBadge: string;
			allBanks: string;
			payAction: (bankName: string) => string;
			processingAction: (bankName: string) => string;
			readyAction: string;
			successTitle: string;
			successDesc: string;
			receiptFiscal: string;
			receiptOrder: string;
		};
		pipeline: {
			customer: string;
			theirBank: string;
			yourAccount: string;
			note: string;
		};
	};
	sandbox: {
		eyebrow: string;
		title: string;
		description: string;
		liveBadge: string;
		simulationMode: string;
		step1: {
			badge: string;
			small: string;
			title: string;
			presets: {
				coffee: string;
				lunch: string;
				dinner: string;
				services: string;
			};
			purposeLabel: string;
			purposePlaceholder: string;
			amountLabel: string;
			tableLabel: string;
			submitBtn: string;
		};
		step2: {
			badge: string;
			small: string;
			title: string;
			merchantName: string;
			noFee: string;
			allBanks: string;
			security: string;
			btnConfirm: (bankName: string) => string;
			btnChecking: (bankName: string) => string;
			btnSuccess: string;
			emptyTitle: string;
			emptyDesc: string;
		};
		step3: {
			badge: string;
			small: string;
			title: string;
			waitingStatus: string;
			processingStatus: string;
			successStatus: string;
			successDesc: (amount: string) => string;
			waitingDesc: string;
		};
		footerTags: string[];
	};
	calculator: {
		eyebrow: string;
		title: string;
		subtitle: string;
		turnoverLabel: string;
		avgCheckLabel: string;
		currentAcquiring: string;
		currentCost: string;
		rahunokCost: string;
		monthlyEconomy: string;
		annualEconomy: string;
		calculateNote: string;
	};
	scenarios: {
		eyebrow: string;
		title: string;
		merchantRole: string;
		payerRole: string;
		merchant: {
			eyebrow: string;
			title: string;
			intro: string;
			steps: Array<{ title: string; text: string }>;
		};
		payer: {
			eyebrow: string;
			title: string;
			intro: string;
			steps: Array<{ title: string; text: string }>;
		};
		stepProgress: (curr: number, total: number) => string;
	};
	planB: {
		eyebrow: string;
		title: string;
		subtitle: string;
		badge: string;
		emergencyFlowTitle: string;
		timelineNote: string;
		proofLabel: string;
		proofPoints: Array<{ value: string; label: string }>;
		availabilityNote: string;
		steps: Array<{
			icon: string;
			stepNumber: string;
			title: string;
			desc: string;
			tag: string;
		}>;
		resilienceCards: Array<{
			icon: string;
			title: string;
			desc: string;
			highlight: string;
		}>;
		ctaTitle: string;
		ctaSubtitle: string;
		ctaBtn: string;
		guaranteeText: string;
	};
	productSections: {
		architectureEyebrow: string;
		architectureTitle: string;
		architectureDesc: string;
		architectureSteps: Array<{ label: string; title: string; description: string }>;
		comparisonEyebrow: string;
		comparisonTitle: string;
		comparisonDesc: string;
		comparisonHeaders: [string, string, string];
		comparisonRows: Array<[string, string, string]>;
		solutionsEyebrow: string;
		solutionsTitle: string;
		solutionsDesc: string;
		solutions: Array<{ label: string; title: string; description: string }>;
		solutionModals: Array<SolutionModalData>;
		featuresEyebrow: string;
		featuresTitle: string;
		featuresDesc: string;
		features: Array<{ label: string; title: string; description: string }>;
	};
	trustAndPricing: {
		securityEyebrow: string;
		securityTitle: string;
		securityDesc: string;
		securityAssurances: string[];
		securityPipelineHeader: { label: string; title: string };
		securityPipeline: Array<{ label: string; title: string; desc: string }>;
		trustItems: Array<{ title: string; description: string }>;
		proofEyebrow: string;
		proofTitle: string;
		proofDesc: string;
		proofItems: Array<{ label: string; title: string; description: string }>;
		pricingEyebrow: string;
		pricingTitle: string;
		pricingDesc: string;
		pricingPlans: Array<{
			name: string;
			price: string;
			description: string;
			features: string[];
			cta: string;
			note: string;
			popular?: boolean;
		}>;
		faqEyebrow: string;
		faqTitle: string;
		faqDesc: string;
		faqItems: Array<{ question: string; answer: string }>;
		ctaEyebrow: string;
		ctaTitle: string;
		ctaDesc: string;
		ctaBtn: string;
	};
	footer: {
		description: string;
		navTitle: string;
		legalTitle: string;
		rights: string;
		terms: string;
		privacy: string;
		security: string;
	};
	modal: {
		badge: string;
		title: string;
		desc: string;
		nameLabel: string;
		phoneLabel: string;
		businessLabel: string;
		submitBtn: string;
		successTitle: string;
		successDesc: string;
		demoNotice: string;
		closeBtn: string;
	};
}

export const translations: Record<Locale, Translations> = {
	uk: {
		langName: 'Українська',
		brand: {
			name: 'Rahunok',
			tagline: 'Миттєві A2A платежі для бізнесу'
		},
		nav: {
			howItWorks: 'Як працює',
			forBusiness: 'Для бізнесу',
			moneyFlow: 'Рух коштів',
			pricing: 'Тарифи',
			faq: 'Питання',
			pos: 'Каса',
			account: 'Особистий кабінет',
			tryPilot: 'Спробувати пілот',
			calculateSavings: 'Розрахувати вигоду'
		},
		hero: {
			eyebrowAudience: {
				business: 'для бізнесу',
				personal: 'для тебе'
			},
			eyebrowBadge: 'A2A платежі нового покоління',
			initialHeadlinePrefix: 'Приймайте оплату. ',
			initialHeadlineAccent: 'Без термінала.',
			finalHeadlineStart: 'Оплата',
			finalHeadlineMiddle: ', що відчувається ',
			finalHeadlineEnd: 'природно.',
			subhead:
				'Прямі розрахунки з банківських додатків клієнтів на ваш IBAN. Без оренди POS-терміналів, без еквайрингового переплачування та із вбудованою фіскалізацією ПРРО.',
			tryPilotBtn: 'Спробувати пілот',
			calculateSavingsBtn: 'Розрахувати вигоду',
			proof: {
				zeroHardware: { title: '0 ₴ за термінал', desc: 'Смартфон замінює все' },
				instantSettlement: { title: 'Миттєво на IBAN', desc: 'Без посередників' },
				autoPrro: { title: 'ПРРО вбудовано', desc: 'Автофіскалізація' }
			},
			dashboard: {
				title: 'Rahunok Core',
				navOverview: 'Огляд',
				navPos: 'Каса',
				navInvoices: 'Рахунки',
				navManagement: 'Керування',
				navStructure: 'Структура',
				navRules: 'Правила',
				financialOverview: 'Фінансовий огляд',
				todayRevenue: 'Виручка сьогодні',
				successfulPayments: 'Успішні оплати',
				avgCheck: 'Середній чек',
				recentOperations: 'Останні транзакції',
				colTime: 'Час',
				colPurpose: 'Призначення',
				colStatus: 'Статус',
				colAmount: 'Сума',
				statusPaid: 'Зараховано',
				coffeeTable: 'Кава та круасан · Каса 1',
				lunchTable: 'Бізнес-ланч · Стіл 4',
				dinnerTable: 'Вечеря · Стіл 12',
				takeaway: 'Замовлення з собою'
			},
			checkout: {
				time: '9:41',
				appTitle: 'Rahunok Pay',
				merchantName: "Кав'ярня «Крапка»",
				tableBadge: 'Стіл 12 · Чек #1046',
				statusWaiting: 'Очікує вибору банку',
				statusProcessing: 'Обробка…',
				statusPaid: 'Оплачено ✓',
				securityBadge: 'Rahunok · NBU 003',
				noFeeBadge: 'Без комісії',
				allBanks: 'Усі банки',
				payAction: (b) => `Ви підтвердите платіж у ${b}`,
				processingAction: (b) => `Очікуємо ${b}…`,
				readyAction: 'Готово',
				successTitle: 'ОПЛАТУ ЗАРАХОВАНО',
				successDesc: 'Кошти миттєво перераховано на рахунок',
				receiptFiscal: '✓ ПРРО фіскалізовано #89421',
				receiptOrder: 'Замовлення #1046'
			},
			pipeline: {
				customer: 'КЛІЄНТ',
				theirBank: 'ЙОГО БАНК',
				yourAccount: 'ВАШ IBAN РАХУНОК',
				note: 'Одна безшовна дія для покупця. Повний контроль і фіскалізація для бізнесу.'
			}
		},
		sandbox: {
			eyebrow: 'Live Sandbox · тест без списання',
			title: 'Додайте Pay by Bank до будь-якого checkout.',
			description:
				'Вбудуйте у власний checkout, надішліть платіжне посилання або покажіть QR. Rahunok працює поверх вашого поточного сценарію, не змінюючи банківські рахунки.',
			liveBadge: 'LIVE A2A SANDBOX',
			simulationMode: 'Тестове середовище · Режим симуляції',
			step1: {
				badge: '01',
				small: 'Ваша каса або сайт',
				title: 'Створіть рахунок',
				presets: {
					coffee: 'Кава',
					lunch: 'Обід',
					dinner: 'Вечеря',
					services: 'Послуги'
				},
				purposeLabel: 'Призначення платежу',
				purposePlaceholder: 'Опис замовлення',
				amountLabel: 'Сума, ₴',
				tableLabel: 'Мітка / Стіл',
				submitBtn: 'Створити платіж'
			},
			step2: {
				badge: '02',
				small: 'Клієнтський досвід',
				title: 'Обирає свій банк',
				merchantName: "Кав'ярня «Крапка»",
				noFee: 'Без комісії',
				allBanks: 'Усі банки',
				security: 'Rahunok · NBU 003',
				btnConfirm: (b) => `Акцептувати у ${b}`,
				btnChecking: (b) => `Перевіряємо платіж у ${b}…`,
				btnSuccess: 'Оплату підтверджено ✓',
				emptyTitle: 'Checkout готовий',
				emptyDesc: 'Створіть платіж на першому кроці'
			},
			step3: {
				badge: '03',
				small: 'Сервер Rahunok',
				title: 'Підтверджує статус',
				waitingStatus: 'Очікуємо платіж',
				processingStatus: 'Обробка A2A Webhook…',
				successStatus: 'Verified SUCCESS',
				successDesc: (amt) => `${amt} зараховано на ваш IBAN. Чек фіскалізовано.`,
				waitingDesc:
					'Статус у касі та checkout оновлюється виключно після криптографічної перевірки банком.'
			},
			footerTags: [
				'Hosted Web Checkout',
				'Mobile SDK',
				'Payment Links',
				'Динамічний QR / NFC',
				'Єдиний API-контракт'
			]
		},
		calculator: {
			eyebrow: 'Фінансова аналітика',
			title: 'Порахуйте чисту економію на еквайрингу.',
			subtitle:
				'Порівняйте витрати класичного карткового еквайрингу 1.3-2% із прямими A2A розрахунками Rahunok.',
			turnoverLabel: 'Щомісячний оборот каси',
			avgCheckLabel: 'Середній чек замовлення',
			currentAcquiring: 'Класичний еквайринг (1.5%)',
			currentCost: 'Поточні витрати',
			rahunokCost: 'Витрати з Rahunok',
			monthlyEconomy: 'Чиста економія щомісяця',
			annualEconomy: 'Економія за 1 рік',
			calculateNote:
				'Розрахунок базується на середньоринкових тарифах банків України. Реальна економія залежить від структури платежів вашого бізнесу.'
		},
		scenarios: {
			eyebrow: 'Сценарії користування',
			title: 'Один платіж. Два бездоганні досвіди.',
			merchantRole: 'Каса (Мерчант)',
			payerRole: 'Чекаут (Клієнт)',
			merchant: {
				eyebrow: 'Для бізнесу та каси',
				title: 'Від суми до зарахування на IBAN.',
				intro:
					'Касир формує рахунок за 2 секунди у мобільній касі, а система сама фіксує зарахування без зайвих дій.',
				steps: [
					{ title: 'Вкажіть суму', text: 'Введіть суму на сенсорній касі або виберіть стіл.' },
					{
						title: 'Згенеруйте платіж',
						text: 'Каса миттєво створює замовлення з вашими IBAN реквізитами.'
					},
					{
						title: 'Покажіть QR / NFC',
						text: 'Клієнт сканує QR камерою або прикладає смартфон до мітки.'
					},
					{
						title: 'Отримайте SUCCESS',
						text: 'Каса отримує серверне підтвердження і фіскалізує чек.'
					}
				]
			},
			payer: {
				eyebrow: 'Для покупця',
				title: 'Від сканування до готового чека.',
				intro:
					'Жодного ручного введення 16 цифр картки, CVV чи номерів телефонів. Все в рідному додатку банку.',
				steps: [
					{
						title: 'Відкрийте оплату',
						text: 'Наведіть камеру смартфона на QR або торкніться NFC-мітки.'
					},
					{
						title: 'Оберіть свій банк',
						text: 'Оберіть застосунок: monobank, Приват24, Sense, Ощад чи інший.'
					},
					{
						title: 'Підтвердьте FaceID',
						text: 'Авторизуйте операцію у власному захищеному банківському додатку.'
					},
					{
						title: 'Отримайте чек',
						text: 'Миттєво отримайте підтвердження оплати та електронний фіскальний чек.'
					}
				]
			},
			stepProgress: (c, t) => `Крок ${c} із ${t}`
		},
		planB: {
			eyebrow: 'РЕЗЕРВНИЙ ПРИЙОМ ОПЛАТ · ПЛАН Б',
			title: 'Термінал не працює? Не зупиняйте продажі.',
			subtitle:
				'Заздалегідь підключіть резервний QR-прийом оплат. Під час збою відкрийте Rahunok на смартфоні та продовжуйте приймати платежі без додаткового обладнання.',
			badge: 'Готовність до збою',
			emergencyFlowTitle: 'Сценарій переходу на резервний канал',
			timelineNote: 'Підготуйте заздалегідь, активуйте під час збою',
			proofLabel: 'Показники резервного сценарію',
			proofPoints: [
				{ value: '≈ 5 хв', label: 'первинне підключення' },
				{ value: 'до 60 с', label: 'перехід на резерв' },
				{ value: '2,3 с', label: 'типовий SUCCESS на IBAN' },
				{ value: 'до 10 с', label: 'регуляторна межа НБУ' }
			],
			availabilityNote:
				'План Б працює, коли основний POS або каса недоступні, але смартфон має мобільний інтернет, а банк клієнта обробляє перекази.',
			steps: [
				{
					icon: 'ZapOff',
					stepNumber: '01',
					title: 'Основний POS недоступний',
					desc: 'Блекаут, атака на інфраструктуру, розряджений POS-термінал або виїзна локація.',
					tag: 'Точка недоступна'
				},
				{
					icon: 'Smartphone',
					stepNumber: '02',
					title: 'Активація за 60 секунд',
					desc: 'Підприємець відкриває Rahunok на будь-якому смартфоні (iOS/Android) або показує QR.',
					tag: 'Мобільна каса'
				},
				{
					icon: 'QrCode',
					stepNumber: '03',
					title: 'Клієнт платить у банку',
					desc: 'Покупець сканує QR та підтверджує FaceID у monobank, Приват24, Sense чи іншому банку.',
					tag: 'Open Banking A2A'
				},
				{
					icon: 'ShieldCheck',
					stepNumber: '04',
					title: 'SUCCESS на IBAN за 2,3 секунди',
					desc: 'Типовий статус платежу надходить за 2,3 секунди; регуляторна межа НБУ — не більше 10 секунд.',
					tag: 'Гроші на рахунку'
				},
				{
					icon: 'ReceiptText',
					stepNumber: '05',
					title: 'Фіскалізація чека',
					desc: 'Підключений ПРРО Checkbox або Вчасно.Каса формує електронний фіскальний чек для клієнта і ДПС.',
					tag: 'Підключений ПРРО'
				}
			],
			resilienceCards: [
				{
					icon: 'Clock',
					title: '0 ₴ абонплати за резерв',
					desc: 'Тримайте Rahunok як безкоштовну страховку. Жодних щомісячних платежів за оренду чи простій, якщо каса не використовується.',
					highlight: 'Безпечний резерв'
				},
				{
					icon: 'Building2',
					title: 'Без зміни вашого банку',
					desc: 'Кошти зараховуються безпосередньо на ваш існуючий IBAN у будь-якому банку України без відкриття нових рахунків.',
					highlight: 'Ваш діючий IBAN'
				},
				{
					icon: 'Signal',
					title: 'Оптимізовано для мобільної мережі',
					desc: 'QR-сценарій передає мінімум даних і не потребує окремого каналу зв’язку POS-термінала. Для оплати потрібен доступ до інтернету.',
					highlight: 'Мінімум трафіку'
				},
				{
					icon: 'Flame',
					title: 'Миттєвий переїзд точки',
					desc: 'Потрібно терміново перенести торгівлю на намет, генераторну локацію чи доставку? Ваша каса вже у кишені.',
					highlight: 'Мобільність'
				}
			],
			ctaTitle: 'Підготуйте План Б до того, як він знадобиться',
			ctaSubtitle:
				'Підключення та перевірка займають близько 5 хвилин. Перехід під час збою — до 60 секунд.',
			ctaBtn: 'Перевірити План Б на смартфоні',
			guaranteeText: 'Без візиту в банк · Без зміни рахунків · 0 ₴ за простій'
		},
		productSections: {
			architectureEyebrow: 'Архітектура процесу',
			architectureTitle: 'Як працює прямий платіж',
			architectureDesc:
				'Гроші більше не йдуть через кілька етапів посередників. Платіж рухається безпосередньо.',
			architectureSteps: [
				{
					label: '01',
					title: 'QR, NFC або link',
					description: 'Клієнт відкриває захищений платіжний сценарій зі смартфона.'
				},
				{
					label: '02',
					title: 'Native payment UX',
					description: 'Відкривається екран із сумою, продавцем і призначенням платежу.'
				},
				{
					label: '03',
					title: 'Вибір банку',
					description: 'Клієнт переходить у доступний банківський сценарій оплати.'
				},
				{
					label: '04',
					title: 'Authorization',
					description: 'Підтвердження відбувається на стороні банку клієнта.'
				},
				{
					label: '05',
					title: 'Server-confirmed success',
					description: 'Каса бачить SUCCESS лише після перевірки платежу backend-системою.'
				}
			],
			comparisonEyebrow: 'Порівняльний аналіз',
			comparisonTitle: 'Традиційний термінал чи Rahunok?',
			comparisonDesc:
				'Дізнайтеся, чому сучасні європейські та українські бізнеси переходять на Pay by Bank.',
			comparisonHeaders: ['Критерій', 'Класичний POS-термінал', 'Rahunok A2A'],
			comparisonRows: [
				['Окреме обладнання', 'Зазвичай потрібне (оренда)', 'Не обов’язкове (смартфон / QR)'],
				['QR та платіжні посилання', 'Залежить від банку', 'В єдиному інтерфейсі'],
				['Рахунки та замовлення', 'Окрема POS-система', 'Пов’язані з оплатою в реальному часі'],
				['Підтвердження оплати', 'Статус на терміналі', 'Миттєва перевірка backend'],
				['ПРРО та фіскалізація', 'Окрема інтеграція', 'Автоматично після SUCCESS'],
				['API та webhooks', 'Залежить від банку', 'Єдиний API-контракт']
			],
			solutionsEyebrow: 'Спеціалізовані рішення',
			solutionsTitle: 'Створено для будь-якої індустрії',
			solutionsDesc: 'Гнучкі сценарії для ресторанів, магазинів, сфери послуг та інтернет-бізнесу.',
			solutions: [
				{
					label: 'HoReCa',
					title: 'Кафе бачить, який столик уже оплатив.',
					description:
						'Створіть рахунок для столика, покажіть QR і отримайте підтвердження без біганини з терміналом.'
				},
				{
					label: 'Retail',
					title: 'Магазин приймає оплату зі звичайного смартфона.',
					description: 'Вкажіть суму, покажіть QR і одразу побачте, коли гроші підтверджені.'
				},
				{
					label: 'Послуги',
					title: 'Майстер надсилає рахунок просто в месенджер.',
					description:
						'Створіть посилання із сумою та призначенням. Клієнт оплатить тоді, коли йому зручно.'
				},
				{
					label: 'Online & API',
					title: 'Онлайн-бізнес додає оплату у свій звичний процес.',
					description: 'Підключіть API або готовий checkout до сайту, CRM чи власного застосунку.'
				}
			],
			solutionModals: [
				{
					id: 'horeca',
					indexLabel: '01',
					tag: 'HoReCa & Ресторани',
					badge: 'Сучасна альтернатива Expirenza та терміналам',
					heroTitle: 'Оплата за столиком за 3 секунди. Без монополії одного банку.',
					heroSubtitle:
						'Повноцінний ресторанний платіжний сценарій на базі Open Banking A2A. Гості сканують динамічний QR на столі або рахунку, обирають свій улюблений банк та миттєво підтверджують оплату через FaceID. Гроші та чайові миттєво зараховуються на ваш IBAN у будь-якому банку України.',
					heroHighlight:
						'0% карткового інтерчейнджу · Миттєве закриття чека в Poster/Syrve · Розділення чека та чайові офіціанту на окремий рахунок',
					metrics: [
						{
							value: '0%',
							label: 'Комісія за картковий еквайринг',
							sub: 'Замість 1.3–2% у монобанку та класичних банків'
						},
						{
							value: '0.3 с',
							label: 'Швидкість старту App Clip',
							sub: 'Жодної потреби завантажувати додатки'
						},
						{
							value: '100%',
							label: 'Підтримка банків України',
							sub: 'monobank, Приват24, Sense, А-Банк, ПУМБ тощо'
						},
						{
							value: '24/7',
							label: 'Пряме зарахування на IBAN',
							sub: 'Миттєво на ваш рахунок, навіть у неділю вночі'
						}
					],
					highlights: [
						{
							title: 'Розумний QR на столику та в чеку',
							desc: 'Гість сканує код камерою смартфона. Миттєво відкривається сума та склад замовлення з POS-системи без очікування офіціанта з терміналом.',
							icon: 'QrCode',
							tag: 'Native App Clip'
						},
						{
							title: 'Розділення рахунку (Split Bill)',
							desc: 'Компанія за столом може розбити чек на рівні частини або оплатити конкретні страви окремо без плутанини в касі.',
							icon: 'Split',
							tag: 'Гнучкий чекаут'
						},
						{
							title: 'Прямі безподаткові чайові',
							desc: 'Гість вказує відсоток чайових, які переказуються напряму на особисту картку/рахунок офіціанта без змішування з виручкою закладу.',
							icon: 'ReceiptText',
							tag: 'Tips on IBAN'
						},
						{
							title: 'Двостороння POS-інтеграція та ПРРО',
							desc: 'Автоматична синхронізація з Poster, Syrve (iiko), R-Keeper, Checkbox та Вчасно.Каса. Чек фіскалізується і закривається за 1 секунду.',
							icon: 'Server',
							tag: 'Auto-PRRO'
						}
					],
					comparison: {
						title: 'Чому Rahunok перевершує Expirenza та mono QR',
						desc: 'Порівняйте умови роботи з класичним монобанк-еквайрингом та відкритою інфраструктурою Rahunok.',
						headers: ['Критерій', 'Monobank (Expirenza / QR)', 'Rahunok A2A HoReCa'],
						rows: [
							{
								feature: 'Залежність від банку мерчанта',
								competitor: 'Обов’язковий рахунок ФОП/ТОВ у monobank',
								rahunok: 'Рахунок у БУДЬ-ЯКОМУ банку України',
								isAdvantage: true
							},
							{
								feature: 'Комісія за транзакцію',
								competitor: '1.3% – 1.5% від кожного чека',
								rahunok: '0% комісії платіжних систем / прозорий фікс',
								isAdvantage: true
							},
							{
								feature: 'Швидкість зарахування коштів',
								competitor: 'Наступного банківського дня',
								rahunok: 'Миттєво на IBAN (СЕП 24/7/365)',
								isAdvantage: true
							},
							{
								feature: 'Клієнти інших банків (Приват, Sense тощо)',
								competitor: 'Змушені вводити 16 цифр картки та CVV вручну',
								rahunok: 'Нативна оплата в додатку свого банку в 1 дотик',
								isAdvantage: true
							},
							{
								feature: 'Чайові офіціанту',
								competitor: 'Змішуються з транзакцією або вимагають mono',
								rahunok: 'Прямий A2A переказ на рахунок офіціанта',
								isAdvantage: true
							},
							{
								feature: 'Оренда терміналів',
								competitor: 'Фізичні POS або Tap-to-Phone тільки Android',
								rahunok: '0 ₴ витрат на обладнання (iOS + Android)',
								isAdvantage: true
							}
						]
					},
					workflow: {
						title: 'Як це працює у вашому закладі',
						steps: [
							{
								step: '1',
								title: 'Офіціант відкриває стіл',
								desc: 'Замовлення вноситься у вашу звичну POS (Poster, Syrve тощо). Стіл отримує актуальну суму.'
							},
							{
								step: '2',
								title: 'Гість сканує QR',
								desc: 'Гість наводить камеру на табличку зі столиком або передчек і бачить свій рахунок у нативному App Clip.'
							},
							{
								step: '3',
								title: 'Миттєвий розрахунок',
								desc: 'Гість підтверджує FaceID у застосунку свого банку. Каса автоматично закриває стіл та друкує фіскальний чек.'
							}
						]
					},
					cta: {
						title: 'Підключіть свій ресторан до Rahunok',
						desc: 'Безкоштовний тестовий пілот за 1 день. Інтегруємо з вашою POS-системою без зупинки роботи закладу.',
						btn: 'Підключити HoReCa пілот'
					}
				},
				{
					id: 'retail',
					indexLabel: '02',
					tag: 'Retail & Магазини',
					badge: 'Смартфон як каса замість терміналів mono та банків',
					heroTitle: 'Повноцінна каса в кожному смартфоні. 0 ₴ на оренду POS.',
					heroSubtitle:
						'Приймайте безготівкові платежі без фізичних банківських терміналів та без обмежень Tap to Phone (який не працює на iPhone). Касир генерує платіж у телефоні або показує QR на касовій стійці. Покупець сплачує у додатку будь-якого українського банку за 3 секунди.',
					heroHighlight:
						'Працює однаково на iOS та Android · Безпечніше за зчитування карток · Вбудований ПРРО з автоматичною відправкою чеків',
					metrics: [
						{
							value: '0 ₴',
							label: 'Оренда обладнання',
							sub: 'Замість 400–600 ₴/міс за кожен POS-термінал'
						},
						{
							value: '100%',
							label: 'Сумісність зі смартфонами',
							sub: 'Працює на будь-якому iPhone та Android'
						},
						{
							value: '1.2 с',
							label: 'Час авторизації платежу',
							sub: 'Миттєве підтвердження без збоїв зв’язку'
						},
						{
							value: '100%',
							label: 'Автофіскалізація чеків',
							sub: 'ПРРО Checkbox / Вчасно без додаткових пристроїв'
						}
					],
					highlights: [
						{
							title: 'Каса на будь-якому смартфоні',
							desc: 'Встановлювати додаткові громіздкі банківські додатки чи купувати Android з NFC не потрібно. Працює на iPhone співробітників через web-кабінет або бота.',
							icon: 'SmartphoneNfc',
							tag: 'iOS & Android'
						},
						{
							title: 'Динамічні та статичні QR-стійки',
							desc: 'Роздрукуйте фірмовий QR для торгової точки або виводьте динамічний QR з точною сумою на екран каси/планшета.',
							icon: 'QrCode',
							tag: 'Касова зона'
						},
						{
							title: 'Миттєвий захист від шахрайства',
							desc: 'Сервер перевіряє факт надходження грошей на ваш IBAN у реальному часі. Касир бачить анімований екран SUCCESS з номером транзакції.',
							icon: 'ShieldCheck',
							tag: 'Real-time Verify'
						},
						{
							title: 'Синхронізація з 1С / BAS / Торгсофт',
							desc: 'Інтеграція з обліковими системами та онлайн-касами для автоматичного списання залишків та формування звітності.',
							icon: 'Layers',
							tag: 'ERP Sync'
						}
					],
					comparison: {
						title: 'Порівняння з Терміналом у смартфоні від mono',
						desc: 'Чому Rahunok набагато зручніший та вигідніший для роздрібних торгових точок.',
						headers: ['Параметр', 'mono Термінал у смартфоні', 'Rahunok Retail A2A'],
						rows: [
							{
								feature: 'Підтримка iOS (iPhone)',
								competitor: 'Не підтримується (Tap to Phone тільки Android з NFC)',
								rahunok: 'Повна підтримка iPhone та Android (App Clip / QR)',
								isAdvantage: true
							},
							{
								feature: 'Комісія за кожну покупку',
								competitor: '1.3% стандартний еквайринг',
								rahunok: '0% інтерчейнджу, прямий A2A переказ',
								isAdvantage: true
							},
							{
								feature: 'Обслуговування карток інших банків',
								competitor: 'Потребує фізичного дотику NFC картки клієнта',
								rahunok: 'Клієнт сканує QR і платить у додатку свого банку',
								isAdvantage: true
							},
							{
								feature: 'Обов’язковий банк мерчанта',
								competitor: 'Тільки рахунок у monobank',
								rahunok: 'Будь-який банк (Приват, Ощад, ПУМБ, mono тощо)',
								isAdvantage: true
							},
							{
								feature: 'Фіскалізація ПРРО',
								competitor: 'Потрібні окремі модулі або ручний ввід',
								rahunok: 'Автоматична видача чека одразу після оплати',
								isAdvantage: true
							}
						]
					},
					workflow: {
						title: 'Простий процес продажу на касі',
						steps: [
							{
								step: '1',
								title: 'Введення суми',
								desc: 'Продавець вводить суму або сканує штрихкод товару на планшеті/смартфоні.'
							},
							{
								step: '2',
								title: 'Показ QR-коду',
								desc: 'Покупець сканує згенерований QR-код екрана або стаціонарної стійки.'
							},
							{
								step: '3',
								title: 'Чек та видача товару',
								desc: 'Кошти зараховані, на касі світиться зелений чек, клієнт отримує SMS/QR фіскальний чек.'
							}
						]
					},
					cta: {
						title: 'Обладнайте свої магазини сучасною касою',
						desc: 'Почніть приймати A2A оплати без терміналів уже сьогодні. Підключення займає до 24 годин.',
						btn: 'Підключити Retail'
					}
				},
				{
					id: 'services',
					indexLabel: '03',
					tag: 'Digital & Services',
					badge: 'Розумні платіжні посилання кращі за mono payment-link',
					heroTitle: 'Платіжні посилання з конверсією +35%. Без кинутих кошиків.',
					heroSubtitle:
						'Створюйте розумні PayLinks для відправки в Instagram Direct, Telegram, Viber або SMS. Посилання автоматично відкриває додаток банку клієнта з уже заповненими реквізитами. Жодного ручного вводу 16 цифр картки на сумнівних формах — покупець підтверджує платіж в 1 клік через FaceID.',
					heroHighlight:
						"Генерація посилань з CRM · Автоматичне створення ТТН Нової Пошти · Кур'єрський сценарій оплати при отриманні",
					metrics: [
						{
							value: '+35%',
							label: 'Зростання конверсії в оплату',
							sub: 'Завдяки відсутності форми вводу картки'
						},
						{
							value: '1 клік',
							label: 'Підтвердження FaceID/TouchID',
							sub: 'У рідному банківському застосунку клієнта'
						},
						{
							value: '0 сек',
							label: 'Автоматизація зміни статусу в CRM',
							sub: 'Миттєвий Webhook про успішну оплату'
						},
						{
							value: '100%',
							label: 'Безпека платежів',
							sub: 'Захищено за стандартом NBU Open Banking'
						}
					],
					highlights: [
						{
							title: 'Smart PayLinks у месенджерах',
							desc: 'Генеруйте персональні або багаторазові посилання на фіксовану чи вільну суму. Клієнт клікає — і одразу потрапляє у свій банк.',
							icon: 'Link',
							tag: '1-Click Checkout'
						},
						{
							title: 'Повна автоматизація з CRM',
							desc: 'KeyCRM, SalesDrive, KeepinCRM, Creatio. Створюйте рахунок прямо з картки клієнта; після оплати замовлення автоматично переходить у статус "Зібрати", генерується накладна Нової Пошти.',
							icon: 'Bot',
							tag: 'CRM Integrations'
						},
						{
							title: 'Оплата при доставці для кур’єрів',
							desc: 'Кур’єр показує динамічний QR на телефоні клієнту під час передачі посилки. Без терміналів, без решти та готівки.',
							icon: 'Send',
							tag: 'Кур’єрська доставка'
						},
						{
							title: 'Рекурентні платежі та підписки',
							desc: 'Автоматичні регулярні списання за сервіси, навчання, абонементи чи доступи до клубів з чітким банківським підтвердженням.',
							icon: 'ReceiptText',
							tag: 'Subscriptions'
						}
					],
					comparison: {
						title: 'Чому Smart PayLinks від Rahunok кращі за mono payment-link',
						desc: 'Порівняння платіжних посилань для інста-шопів, фрілансерів та сервісів.',
						headers: ['Можливість', 'mono payment-link / mini-site', 'Rahunok Smart PayLinks'],
						rows: [
							{
								feature: 'Оплата клієнтами без mono',
								competitor: 'Змушені вручну вводити повні дані картки (CVV, термін)',
								rahunok: 'Відкриває рідний банк клієнта (Приват24, Sense, А-Банк тощо)',
								isAdvantage: true
							},
							{
								feature: 'Комісія з продажу',
								competitor: '1.3% від суми платежу',
								rahunok: '0% комісія карток, прямий A2A переказ',
								isAdvantage: true
							},
							{
								feature: 'Виведення коштів',
								competitor: 'Зараховується тільки на рахунок ФОП у mono',
								rahunok: 'Прямий переказ на ваш IBAN у будь-якому банку',
								isAdvantage: true
							},
							{
								feature: 'Інтеграція з CRM та Новою Поштою',
								competitor: 'Обмежена або потребує сторонніх конекторів',
								rahunok: 'Готові модулі для KeyCRM, SalesDrive, автоматичні ТТН',
								isAdvantage: true
							},
							{
								feature: 'Кур’єрський режим для служб доставки',
								competitor: 'Немає спеціального швидкого QR-флоу кур’єра',
								rahunok: 'Вбудований інтерфейс для водіїв та кур’єрів',
								isAdvantage: true
							}
						]
					},
					workflow: {
						title: 'Як продавати в Instagram та месенджерах',
						steps: [
							{
								step: '1',
								title: 'Створення посилання',
								desc: 'Створіть посилання в кабінеті, CRM або через Telegram-бота за 5 секунд.'
							},
							{
								step: '2',
								title: 'Відправка клієнту',
								desc: 'Надішліть посилання в Direct або чат. Клієнт відкриває і обирає свій банк.'
							},
							{
								step: '3',
								title: 'Миттєве зарахування',
								desc: 'Гроші на вашому рахунку, статус замовлення оновлено, клієнт отримує фіскальний чек.'
							}
						]
					},
					cta: {
						title: 'Збільшіть продажі у ваших каналах',
						desc: 'Підключіть розумні посилання для прийому оплат у месенджерах та на сайтах за лічені хвилини.',
						btn: 'Створити перше PayLink'
					}
				},
				{
					id: 'api',
					indexLabel: '04',
					tag: 'API & Enterprise',
					badge: 'High-Load Open Banking Gateway замість карткового еквайрингу',
					heroTitle: 'Потужний A2A шлюз для масштабного бізнесу та маркетплейсів.',
					heroSubtitle:
						'Пряма інтеграція платіжної інфраструктури Open Banking у ваші мобільні додатки, веб-сервіси та ERP-системи. Пропускна здатність до 50 000 tps, надійні Webhooks з криптографічним підписом, спліт-виплати продавцям на маркетплейсах та єдиний кабінет для мереж юридичних осіб.',
					heroHighlight:
						'Latency < 120ms · White-label SDK для iOS та Android · Спліт-платежі на кілька IBAN одночасно',
					metrics: [
						{
							value: '50 000',
							label: 'Транзакцій на секунду (TPS)',
							sub: 'Високонавантажена розподілена архітектура'
						},
						{
							value: '< 120 мс',
							label: 'Швидкість доставки Webhook',
							sub: 'Миттєве сповіщення вашого бекенду'
						},
						{
							value: '99.99%',
							label: 'SLA доступності сервісу',
							sub: 'Резервовані дата-центри з захистом від збоїв'
						},
						{
							value: 'Multi-IBAN',
							label: 'Спліт-розрахунки маркетплейсів',
							sub: 'Авторозподіл коштів між мерчантами'
						}
					],
					highlights: [
						{
							title: 'RESTful API & Real-time Webhooks',
							desc: 'Простий, сучасний API за стандартами OpenAPI 3.0. Криптографічно захищені Webhook-події з автоматичними повторами при збоях.',
							icon: 'Webhook',
							tag: 'OpenAPI 3.0'
						},
						{
							title: 'White-Label SDK для iOS та Android',
							desc: 'Вбудовуйте платіжний флоу безпосередньо у власний мобільний додаток без редиректів у зовнішній браузер.',
							icon: 'Smartphone',
							tag: 'Mobile SDK'
						},
						{
							title: 'Маркетплейс Спліт (Split Settlement)',
							desc: 'Один платіж покупця автоматично розщеплюється на частини та виплачується на окремі рахунки продавців/постачальників без проміжних акумуляцій.',
							icon: 'Split',
							tag: 'Marketplace Engine'
						},
						{
							title: 'Multi-Entity & Корпоративна консоль',
							desc: 'Керуйте десятками юридичних осіб (ТОВ / ФОП) в єдиному дашборді з гнучкими ролями доступу, аудитом дій та експортом у SAP / 1C.',
							icon: 'Building2',
							tag: 'Enterprise Suite'
						}
					],
					comparison: {
						title: 'Чому корпоративні платформи обирають Rahunok API',
						desc: 'Порівняння API plata by mono з інфраструктурним шлюзом Rahunok A2A.',
						headers: [
							'Характеристика',
							'API plata by mono (еквайринг)',
							'Rahunok Enterprise A2A API'
						],
						rows: [
							{
								feature: 'Технологічна основа',
								competitor: 'Класичний картковий еквайринг (Visa / Mastercard)',
								rahunok: 'Прямий міжбанківський протокол Open Banking / СЕП-4',
								isAdvantage: true
							},
							{
								feature: 'Спліт-платежі для маркетплейсів',
								competitor: 'Обмежено або вимагає складних ручних транзакцій',
								rahunok: 'Автоматичний миттєвий спліт на необмежену кількість IBAN',
								isAdvantage: true
							},
							{
								feature: 'Вбудований White-Label SDK',
								competitor: 'Редирект на стандартну платіжну сторінку mono',
								rahunok: 'Повністю безшовний native UI у вашому застосунку',
								isAdvantage: true
							},
							{
								feature: 'Ліміти на суми операцій',
								competitor: 'Обмеження лімітами інтернет-оплат банківських карток',
								rahunok: 'Прямі банківські ліміти для рахунків B2B та B2C',
								isAdvantage: true
							},
							{
								feature: 'Персональний SLA та дедіковані сервери',
								competitor: 'Стандартні умови публічної оферти',
								rahunok: 'SLA 99.99%, виділені інстанси, 24/7 Enterprise підтримка',
								isAdvantage: true
							}
						]
					},
					workflow: {
						title: 'Швидка інтеграція за 3 кроки',
						steps: [
							{
								step: '1',
								title: 'Отримання API-ключів',
								desc: 'Зареєструйтеся в кабінеті розробника та згенеруйте тестові API-ключі в Sandbox.'
							},
							{
								step: '2',
								title: 'Інтеграція в коді',
								desc: 'Використовуйте готові SDK для Node.js, Python, PHP, Go або REST API з повною документацією.'
							},
							{
								step: '3',
								title: 'Запуск у прод',
								desc: 'Пройдіть верифікацію та почніть приймати миттєві платежі без посередників.'
							}
						]
					},
					cta: {
						title: 'Обговоріть Enterprise інтеграцію',
						desc: 'Наші інженери та платіжні архітектори допоможуть реалізувати індивідуальне рішення для вашої платформи.',
						btn: 'Замовити консультацію архітектора'
					}
				}
			],
			featuresEyebrow: 'Екосистема можливостей',
			featuresTitle: 'Усе необхідне для прийому оплат',
			featuresDesc: 'Повний набір інструментів від мобільної каси до відкритого API.',
			features: [
				{
					label: 'QR',
					title: 'Динамічні рахунки',
					description: 'Сума, замовлення, столик та призначення в одному коді.'
				},
				{
					label: 'NFC',
					title: 'Оплата дотиком',
					description: 'Миттєве відкриття чекауту через сумісну NFC-мітку.'
				},
				{
					label: 'LINK',
					title: 'Платіжні посилання',
					description: 'Надсилайте рахунки через Telegram, Viber, SMS чи CRM.'
				},
				{
					label: 'STATUS',
					title: 'Перевірка backend',
					description: 'Замовлення закривається виключно після підтвердження банком.'
				},
				{
					label: 'ПРРО',
					title: 'Фіскальний сценарій',
					description: 'Автоматичне формування чека після успішної транзакції.'
				},
				{
					label: 'DATA',
					title: 'Аналітика',
					description: 'Звіти по рахунках, виручці, касах та середньому чеку.'
				},
				{
					label: 'BOT',
					title: 'Telegram-каса',
					description: 'Створення рахунків і сповіщення про оплату в боті.'
				},
				{
					label: 'API',
					title: 'Інтеграції',
					description: 'REST API та Webhooks для швидкого підключення ваших систем.'
				}
			]
		},
		trustAndPricing: {
			securityEyebrow: 'Безпека та суверенітет коштів',
			securityTitle: 'Гроші йдуть прямо до вас. Без посередників.',
			securityDesc:
				'Rahunok не тримає кошти на транзитних рахунках. Оплата рухається напряму з банку покупця на ваш офіційний IBAN.',
			securityAssurances: [
				'Пряме A2A / SEPA зарахування на IBAN',
				'Авторизація виключно у власному банкінгу',
				'Сертифікований стандарт НБУ 003'
			],
			securityPipelineHeader: { label: 'Прямий A2A переказ', title: 'Zero-Custody Архітектура' },
			securityPipeline: [
				{
					label: 'Відправник',
					title: 'КЛІЄНТ',
					desc: 'Підтверджує платіж у своєму банківському додатку'
				},
				{ label: 'Авторизація', title: 'ЙОГО БАНК', desc: 'Перевіряє баланс та виконує переказ' },
				{
					label: 'Отримувач',
					title: 'ВАШ РАХУНОК',
					desc: 'Отримує кошти на свій офіційний IBAN рахунок'
				}
			],
			trustItems: [
				{
					title: 'Без окремого термінала',
					description:
						'Для QR оплати достатньо смартфона або друкованої мітки. Приймайте A2A платежі без оренди додаткового POS-обладнання.'
				},
				{
					title: 'Статус підтверджує backend',
					description:
						'Повернення з банківського застосунку саме по собі не закриває чек. PayByBank операція надійно верифікується сервером.'
				},
				{
					title: 'Кожна оплата на своєму місці',
					description:
						'Сума, замовлення, клієнт і підтверджений статус миттєвої оплати зібрані в єдиному інтерфейсі.'
				},
				{
					title: 'ПРРО після success',
					description:
						'Фіскалізація прямого платежу на IBAN запускається автоматично після успішного підтвердження транзакції.'
				}
			],
			proofEyebrow: 'Абсолютний контроль',
			proofTitle: 'Надійність банківського рівня',
			proofDesc: 'Створено з дотриманням регуляторних стандартів Національного банку України.',
			proofItems: [
				{
					label: '01',
					title: 'Тестовий сценарій',
					description: 'Перевірте рахунок, оплату, статус і чек до запуску в реальну експлуатацію.'
				},
				{
					label: '02',
					title: 'Звірка платежів',
					description: 'Кожна операція пов’язана з рахунком, сумою та криптографічним статусом.'
				},
				{
					label: '03',
					title: 'Прозорі обмеження',
					description: 'Доступні банки й умови фіксуються до підписання договору.'
				},
				{
					label: '04',
					title: 'Підтримка запуску',
					description: 'Наша команда допомагає провести перший тестовий платіж та інтеграцію.'
				}
			],
			pricingEyebrow: 'Прозоре ціноутворення',
			pricingTitle: 'Прості та чесні тарифи',
			pricingDesc: 'Обирайте план, який найкраще відповідає масштабу вашого бізнесу.',
			pricingPlans: [
				{
					name: 'Start',
					price: 'Безкоштовно',
					description: 'Для знайомства та тестування першої каси.',
					features: [
						'1 бізнес-профіль',
						'Базові QR-рахунки',
						'Платіжні посилання',
						'Історія операцій'
					],
					cta: 'Почати безкоштовно',
					note: 'Комісія та доступність методів уточнюються під час підключення.'
				},
				{
					name: 'Business',
					price: 'від 490 ₴/міс',
					description: 'Для активної торгової точки або ресторану.',
					features: [
						'Кілька кас і користувачів',
						'QR, NFC та посилання',
						'Підтверджені статуси',
						'Аналітика та підтримка',
						'Автоматичне ПРРО'
					],
					cta: 'Обрати Business',
					note: 'Від 490 ₴/міс + низька комісія відповідно до погоджених умов.',
					popular: true
				},
				{
					name: 'Platform',
					price: 'Індивідуально',
					description: 'Для мереж, франшиз, банків і платформ.',
					features: [
						'Багато точок і юросіб',
						'API та webhooks',
						'White-label сценарій',
						'Персональний менеджер'
					],
					cta: 'Обговорити пілот',
					note: 'Вартість залежить від обсягу операцій та вимог до інтеграції.'
				}
			],
			faqEyebrow: 'База знань',
			faqTitle: 'Часті запитання',
			faqDesc: 'Усе, що потрібно знати про роботу з сервісом Rahunok.',
			faqItems: [
				{
					question: 'Чи потрібен фізичний POS-термінал?',
					answer:
						'Ні, для прийому оплат через QR, NFC або посилання з сервісом Rahunok термінал не потрібен. Ви приймаєте миттєві платежі безпосередньо зі свого смартфона, без оренди додаткового обладнання.'
				},
				{
					question: 'Куди надходять гроші?',
					answer:
						'У моделі A2A (account-to-account) кошти переказуються напряму, це прямий платіж на IBAN вашого ФОП або ТОВ. Без посередників та затримок.'
				},
				{
					question: 'Чи потрібен рахунок ФОП або ТОВ?',
					answer:
						'Так, для прийому оплат PayByBank необхідні реквізити зареєстрованого суб’єкта господарювання та сумісний бізнес-рахунок.'
				},
				{
					question: 'Які банки підтримуються?',
					answer:
						'Перелік залежить від активних партнерських інтеграцій. Ми працюємо над тим, щоб миттєва оплата була доступна для клієнтів більшості популярних банків.'
				},
				{
					question: 'Як працює QR?',
					answer:
						'QR оплата для бізнесу працює просто: клієнт сканує код, який відкриває захищений екран із сумою, продавцем і призначенням для зручної Pay by Bank авторизації.'
				},
				{
					question: 'Що буде, якщо клієнт не завершив оплату?',
					answer:
						'Рахунок у системі Rahunok залишиться в очікуванні, скасується або отримає статус помилки. Ви завжди контролюєте стан кожного платежу.'
				},
				{
					question: 'Як Rahunok підтверджує успішну оплату?',
					answer:
						'Для надійності статус кожної миттєвої оплати перевіряється нашим сервером через доступний API, webhook або механізм звірки. Це гарантує успішний прямий платіж на IBAN.'
				},
				{
					question: 'Як працює ПРРО?',
					answer:
						'Одразу після успішно підтвердженого A2A платежу дані автоматично передаються у ваш налаштований ПРРО-сервіс для фіскалізації чека.'
				},
				{
					question: 'Чи потрібно клієнту встановлювати застосунок?',
					answer:
						'Не обов’язково: для PayByBank оплат зазвичай використовується стандартний банківський застосунок клієнта, web checkout або мобільний браузер без додаткових завантажень.'
				},
				{
					question: 'Чи працює це на iPhone та Android?',
					answer:
						'Так, наша QR оплата без термінала та NFC сценарії чудово працюють на обох платформах, забезпечуючи зручний клієнтський досвід.'
				},
				{
					question: 'Яка комісія?',
					answer:
						'Комісія за A2A платежі зазвичай значно нижча за класичний еквайринг і залежить від тарифу Rahunok, банку, способу оплати та договору.'
				},
				{
					question: 'Як підключитися?',
					answer:
						'Залиште контакти на сайті Rahunok, вкажіть тип бізнесу, і ми допоможемо налаштувати касу для прийому оплат без термінала та провести перший тест.'
				}
			],
			ctaEyebrow: 'Наступний крок для вашого бізнесу',
			ctaTitle: 'Готові відмовитись від терміналів і зменшити витрати?',
			ctaDesc:
				'Підключіть тестовий пілот за 1 день та почніть приймати миттєві A2A платежі вже сьогодні.',
			ctaBtn: 'Підключити Rahunok'
		},
		footer: {
			description: 'Сучасна платіжна інфраструктура A2A оплат для бізнесу в Україні.',
			navTitle: 'Навігація',
			legalTitle: 'Юридична інформація',
			rights: 'Усі права захищено.',
			terms: 'Умови використання',
			privacy: 'Політика конфіденційності',
			security: 'Безпека платежів'
		},
		modal: {
			badge: 'Швидкий старт',
			title: 'Підключити пілот Rahunok',
			desc: 'Залиште контакти, і наш спеціаліст зв’яжеться з вами для налаштування тестового середовища.',
			nameLabel: 'Ваше ім’я',
			phoneLabel: 'Номер телефону',
			businessLabel: 'Назва компанії або закладу',
			submitBtn: 'Надіслати заявку',
			successTitle: 'Демо-форма спрацювала',
			successDesc: 'Ми зв’яжемося з вами найближчим часом для запуску пілота.',
			demoNotice:
				'Це демонстраційна форма без мережевого запиту. Контактні дані нікуди не надсилаються.',
			closeBtn: 'Закрити'
		}
	},
	en: {
		langName: 'English',
		brand: {
			name: 'Rahunok',
			tagline: 'Instant A2A Payments for Business'
		},
		nav: {
			howItWorks: 'How it works',
			forBusiness: 'For Business',
			moneyFlow: 'Money Flow',
			pricing: 'Pricing',
			faq: 'FAQ',
			pos: 'POS App',
			account: 'Dashboard',
			tryPilot: 'Try Pilot',
			calculateSavings: 'Calculate ROI'
		},
		hero: {
			eyebrowAudience: {
				business: 'for business',
				personal: 'for you'
			},
			eyebrowBadge: 'Next-Gen A2A Payments',
			initialHeadlinePrefix: 'Accept payments. ',
			initialHeadlineAccent: 'Without terminals.',
			finalHeadlineStart: 'Payment',
			finalHeadlineMiddle: ', that feels ',
			finalHeadlineEnd: 'natural.',
			subhead:
				'Direct account-to-account payments from your customers’ mobile banking apps straight to your IBAN. No hardware rentals, no interchange bloat, and automated fiscalization.',
			tryPilotBtn: 'Try Pilot',
			calculateSavingsBtn: 'Calculate ROI',
			proof: {
				zeroHardware: { title: '$0 for terminal', desc: 'Smartphone is all you need' },
				instantSettlement: { title: 'Direct to IBAN', desc: 'Zero middlemen' },
				autoPrro: { title: 'Built-in Fiscalization', desc: 'Instant digital receipts' }
			},
			dashboard: {
				title: 'Rahunok Core',
				navOverview: 'Overview',
				navPos: 'POS',
				navInvoices: 'Invoices',
				navManagement: 'Management',
				navStructure: 'Structure',
				navRules: 'Rules',
				financialOverview: 'Financial Overview',
				todayRevenue: "Today's Revenue",
				successfulPayments: 'Completed Payments',
				avgCheck: 'Average Check',
				recentOperations: 'Recent Transactions',
				colTime: 'Time',
				colPurpose: 'Purpose',
				colStatus: 'Status',
				colAmount: 'Amount',
				statusPaid: 'Settled',
				coffeeTable: 'Coffee & Croissant · POS 1',
				lunchTable: 'Business Lunch · Table 4',
				dinnerTable: 'Dinner · Table 12',
				takeaway: 'Takeaway Order'
			},
			checkout: {
				time: '9:41',
				appTitle: 'Rahunok Pay',
				merchantName: "Coffee Shop 'Krapka'",
				tableBadge: 'Table 12 · Bill #1046',
				statusWaiting: 'Waiting for bank selection',
				statusProcessing: 'Processing…',
				statusPaid: 'Paid ✓',
				securityBadge: 'Rahunok · NBU 003',
				noFeeBadge: 'Zero Fee',
				allBanks: 'All Banks',
				payAction: (b) => `Confirm payment in ${b}`,
				processingAction: (b) => `Waiting for ${b}…`,
				readyAction: 'Done',
				successTitle: 'PAYMENT RECEIVED',
				successDesc: 'Funds transferred instantly to your account',
				receiptFiscal: '✓ Fiscal Receipt #89421',
				receiptOrder: 'Order #1046'
			},
			pipeline: {
				customer: 'CUSTOMER',
				theirBank: 'THEIR BANK',
				yourAccount: 'YOUR IBAN ACCOUNT',
				note: 'One seamless action for your customer. Full financial control & fiscalization for your business.'
			}
		},
		sandbox: {
			eyebrow: 'Live Sandbox · zero charge test',
			title: 'Add Pay by Bank to any checkout experience.',
			description:
				'Embed inside your checkout, send payment links, or display dynamic QR codes. Rahunok runs on top of your workflow without changing your bank accounts.',
			liveBadge: 'LIVE A2A SANDBOX',
			simulationMode: 'Test Environment · Simulation Mode',
			step1: {
				badge: '01',
				small: 'Your POS or Website',
				title: 'Generate invoice',
				presets: {
					coffee: 'Coffee',
					lunch: 'Lunch',
					dinner: 'Dinner',
					services: 'Services'
				},
				purposeLabel: 'Payment Purpose',
				purposePlaceholder: 'Order description',
				amountLabel: 'Amount, ₴',
				tableLabel: 'Tag / Table',
				submitBtn: 'Create Invoice'
			},
			step2: {
				badge: '02',
				small: 'Customer Experience',
				title: 'Selects bank',
				merchantName: "Coffee Shop 'Krapka'",
				noFee: 'Zero Fee',
				allBanks: 'All Banks',
				security: 'Rahunok · NBU 003',
				btnConfirm: (b) => `Confirm payment in ${b}`,
				btnChecking: (b) => `Verifying payment in ${b}…`,
				btnSuccess: 'Payment confirmed ✓',
				emptyTitle: 'Checkout Ready',
				emptyDesc: 'Create an invoice in step one'
			},
			step3: {
				badge: '03',
				small: 'Rahunok Server',
				title: 'Verifies Status',
				waitingStatus: 'Awaiting payment',
				processingStatus: 'Processing A2A Webhook…',
				successStatus: 'Verified SUCCESS',
				successDesc: (amt) => `${amt} settled directly to your IBAN. Receipt fiscalized.`,
				waitingDesc:
					'Status is updated only after cryptographic backend confirmation from the bank.'
			},
			footerTags: [
				'Hosted Web Checkout',
				'Mobile SDK',
				'Payment Links',
				'Dynamic QR / NFC',
				'Unified API Contract'
			]
		},
		calculator: {
			eyebrow: 'Financial Analytics',
			title: 'Calculate your savings on card acquiring fees.',
			subtitle:
				'Compare traditional card acquiring (1.3-2.0%) with direct A2A settlements via Rahunok.',
			turnoverLabel: 'Monthly Sales Turnover',
			avgCheckLabel: 'Average Order Check',
			currentAcquiring: 'Traditional Acquiring (1.5%)',
			currentCost: 'Current Fee Expenses',
			rahunokCost: 'Cost with Rahunok',
			monthlyEconomy: 'Net Monthly Savings',
			annualEconomy: 'Annual ROI Savings',
			calculateNote:
				'Calculation is based on average bank acquiring rates in Ukraine. Actual ROI depends on your payment volume and business structure.'
		},
		scenarios: {
			eyebrow: 'Usage Scenarios',
			title: 'One payment. Two flawless experiences.',
			merchantRole: 'Cashier (Merchant)',
			payerRole: 'Checkout (Customer)',
			merchant: {
				eyebrow: 'For Business & POS',
				title: 'From amount to IBAN settlement in seconds.',
				intro:
					'Cashier creates an invoice in 2 seconds on mobile POS, and the platform verifies settlement automatically.',
				steps: [
					{
						title: 'Enter Amount',
						text: 'Enter order total on touchscreen POS or select a table.'
					},
					{
						title: 'Generate Payment',
						text: 'POS instantly generates an order with your IBAN credentials.'
					},
					{
						title: 'Show QR / NFC',
						text: 'Customer scans QR with smartphone camera or taps NFC tag.'
					},
					{
						title: 'Receive SUCCESS',
						text: 'POS receives instant server confirmation and fiscalizes receipt.'
					}
				]
			},
			payer: {
				eyebrow: 'For Customer',
				title: 'From scan to receipt without typing card digits.',
				intro:
					'No typing 16 card numbers, CVVs, or phone numbers. Completed natively inside customer’s trusted bank app.',
				steps: [
					{
						title: 'Open Payment',
						text: 'Scan QR with phone camera or tap NFC tag on the counter.'
					},
					{
						title: 'Select Bank',
						text: 'Choose your banking app: monobank, Privat24, Sense, Oschad, etc.'
					},
					{
						title: 'Confirm via FaceID',
						text: 'Authorize operation securely inside your native bank app.'
					},
					{
						title: 'Get Digital Receipt',
						text: 'Instant payment confirmation and electronic fiscal receipt.'
					}
				]
			},
			stepProgress: (c, t) => `Step ${c} of ${t}`
		},
		planB: {
			eyebrow: 'BUSINESS CONTINUITY · PLAN B',
			title: 'Terminal down? Keep accepting payments.',
			subtitle:
				'Set up backup QR payments in advance. During an outage, open Rahunok on a smartphone and keep accepting payments without extra hardware.',
			badge: 'Outage ready',
			emergencyFlowTitle: 'Switching to the backup payment channel',
			timelineNote: 'Prepare in advance, activate during an outage',
			proofLabel: 'Backup scenario metrics',
			proofPoints: [
				{ value: '≈ 5 min', label: 'initial setup' },
				{ value: 'up to 60 s', label: 'backup activation' },
				{ value: '2.3 s', label: 'typical IBAN SUCCESS' },
				{ value: 'up to 10 s', label: 'NBU regulatory limit' }
			],
			availabilityNote:
				'Plan B works when the primary POS or register is unavailable, provided the smartphone has mobile internet and the customer’s bank is processing transfers.',
			steps: [
				{
					icon: 'ZapOff',
					stepNumber: '01',
					title: 'POS Terminal Down or Offline',
					desc: 'Blackout, infrastructure disruption, dead battery on card terminal, or outdoor pop-up stand.',
					tag: 'POS Outage'
				},
				{
					icon: 'Smartphone',
					stepNumber: '02',
					title: 'Activate in 60 Seconds',
					desc: 'Merchant launches Rahunok on any smartphone (iOS/Android) or presents a printed counter QR.',
					tag: 'Instant Mobile POS'
				},
				{
					icon: 'QrCode',
					stepNumber: '03',
					title: 'Customer Pays in Bank App',
					desc: 'Customer scans QR and confirms with FaceID in monobank, Privat24, Sense, or their preferred bank.',
					tag: 'Open Banking A2A'
				},
				{
					icon: 'ShieldCheck',
					stepNumber: '04',
					title: 'IBAN SUCCESS in 2.3 Seconds',
					desc: 'A typical payment status arrives in 2.3 seconds; the NBU regulatory limit is no more than 10 seconds.',
					tag: 'Direct Settle'
				},
				{
					icon: 'ReceiptText',
					stepNumber: '05',
					title: 'Fiscal Receipt',
					desc: 'A connected Checkbox or Vchasno.Kasa PRRO generates the electronic fiscal receipt for the customer and tax authority.',
					tag: 'Connected PRRO'
				}
			],
			resilienceCards: [
				{
					icon: 'Clock',
					title: '0 ₴ Inactivity & Standby Fees',
					desc: 'Keep Rahunok as free insurance. Zero monthly rental fees or maintenance costs when standby POS is not in active use.',
					highlight: 'Zero Cost Standby'
				},
				{
					icon: 'Building2',
					title: 'No Need to Change Your Bank',
					desc: 'Funds settle directly to your existing business IBAN at any bank in Ukraine with zero new account paperwork.',
					highlight: 'Your Existing IBAN'
				},
				{
					icon: 'Signal',
					title: 'Optimized for Mobile Networks',
					desc: 'The QR flow transfers minimal data and does not rely on a separate POS connection. Internet access is required to pay.',
					highlight: 'Minimal Data'
				},
				{
					icon: 'Flame',
					title: 'Instant Pop-up Relocation',
					desc: 'Need to move sales to an emergency generator location, outdoor market, or delivery vehicle? Your cash register is already in your pocket.',
					highlight: 'Ultra Mobile'
				}
			],
			ctaTitle: 'Prepare Plan B Before You Need It',
			ctaSubtitle:
				'Setup and verification take about 5 minutes. Switching during an outage takes up to 60 seconds.',
			ctaBtn: 'Test Plan B on My Phone',
			guaranteeText: 'No bank visits · No account switching · 0 ₴ standby cost'
		},
		productSections: {
			architectureEyebrow: 'Process Architecture',
			architectureTitle: 'How Direct Payment Works',
			architectureDesc:
				'Money no longer goes through multiple layers of intermediaries. The payment moves directly.',
			architectureSteps: [
				{
					label: '01',
					title: 'QR, NFC or link',
					description: 'Customer opens a secure payment scenario from their smartphone.'
				},
				{
					label: '02',
					title: 'Native payment UX',
					description: 'A screen opens with the amount, merchant, and payment purpose.'
				},
				{
					label: '03',
					title: 'Bank selection',
					description: 'Customer proceeds to the available banking payment app.'
				},
				{
					label: '04',
					title: 'Authorization',
					description: "Confirmation happens on the customer's bank side."
				},
				{
					label: '05',
					title: 'Server-confirmed success',
					description: 'The cashier sees SUCCESS only after the backend verifies the payment.'
				}
			],
			comparisonEyebrow: 'Comparative Analysis',
			comparisonTitle: 'Traditional POS Terminal vs Rahunok',
			comparisonDesc: 'Discover why modern businesses are switching to Pay by Bank solutions.',
			comparisonHeaders: ['Feature', 'Legacy POS Terminal', 'Rahunok A2A'],
			comparisonRows: [
				[
					'Dedicated Hardware',
					'Required (monthly rental fee)',
					'Optional (smartphone or QR sticker)'
				],
				['QR & Payment Links', 'Bank dependent / fragmented', 'Unified in a single dashboard'],
				['Invoices & Orders', 'Separate POS hardware system', 'Real-time sync with order context'],
				['Payment Confirmation', 'Terminal beep / slow slip', 'Instant cryptographic server check'],
				['Receipt Fiscalization', 'Separate complex setup', 'Automated after SUCCESS webhook'],
				['API & Webhooks', 'Limited or bank proprietary', 'Modern REST API & Webhooks']
			],
			solutionsEyebrow: 'Specialized Solutions',
			solutionsTitle: 'Tailored for Every Industry',
			solutionsDesc:
				'Flexible payment workflows for restaurants, retail, service providers, and online platforms.',
			solutions: [
				{
					label: 'HoReCa',
					title: 'Restaurants know instantly which table paid.',
					description:
						'Generate table invoices, show QR on bill, and receive instant confirmation without waiting for card terminals.'
				},
				{
					label: 'Retail',
					title: 'Stores accept payments using standard smartphones.',
					description: 'Enter order total, show QR, and immediately see when funds are confirmed.'
				},
				{
					label: 'Services',
					title: 'Specialists send invoices directly into messengers.',
					description:
						'Generate a payment link with order details. Customers pay conveniently from anywhere.'
				},
				{
					label: 'Online & API',
					title: 'E-commerce integrates Pay by Bank seamlessly.',
					description:
						'Connect our checkout SDK or REST API to your store, CRM, or custom application.'
				}
			],
			solutionModals: [
				{
					id: 'horeca',
					indexLabel: '01',
					tag: 'HoReCa & Restaurants',
					badge: 'Modern Alternative to Expirenza & POS Terminals',
					heroTitle: 'Pay-at-table in 3 seconds. No single-bank lock-in.',
					heroSubtitle:
						'Complete restaurant payment architecture powered by Open Banking A2A. Guests scan dynamic QR on bill, select their favorite banking app, and confirm payment in seconds via FaceID. Funds and waiter tips settle immediately onto your corporate IBAN at any bank in Ukraine.',
					heroHighlight:
						'0% card interchange fees · Real-time bill closing in Poster/Syrve · Split bill & direct waiter tips on IBAN',
					metrics: [
						{
							value: '0%',
							label: 'Card acquiring interchange',
							sub: 'Instead of 1.3–2% with monobank and traditional acquirers'
						},
						{
							value: '0.3s',
							label: 'App Clip launch speed',
							sub: 'Zero app installations required'
						},
						{
							value: '100%',
							label: 'Ukrainian bank support',
							sub: 'monobank, Privat24, Sense, A-Bank, PUMB, etc.'
						},
						{
							value: '24/7',
							label: 'Direct IBAN settlement',
							sub: 'Immediate funds availability even on weekends'
						}
					],
					highlights: [
						{
							title: 'Smart Table & Bill QR Codes',
							desc: 'Guests scan using native camera. Instant order overview synchronized with your POS system with no waiter terminal runaround.',
							icon: 'QrCode',
							tag: 'Native App Clip'
						},
						{
							title: 'Flexible Bill Splitting (Split Bill)',
							desc: 'Dining groups can easily split the total evenly or pay for specific items individually without cashier friction.',
							icon: 'Split',
							tag: 'Smart Checkout'
						},
						{
							title: 'Tax-Free Direct Waiter Tips',
							desc: "Guests select custom tip percentages routed directly to the waiter's personal card/IBAN without mixing with restaurant revenue.",
							icon: 'ReceiptText',
							tag: 'Tips on IBAN'
						},
						{
							title: 'Two-Way POS & Fiscalization',
							desc: 'Live integration with Poster, Syrve (iiko), R-Keeper, Checkbox, and Vchasno. Automatic fiscal receipt emission upon payment.',
							icon: 'Server',
							tag: 'Auto-PRRO'
						}
					],
					comparison: {
						title: 'Why Rahunok Outperforms Expirenza & mono QR',
						desc: 'Compare traditional mono acquiring constraints against the open payment infrastructure of Rahunok.',
						headers: ['Feature', 'Monobank (Expirenza / QR)', 'Rahunok A2A HoReCa'],
						rows: [
							{
								feature: 'Merchant bank lock-in',
								competitor: 'Strictly requires monobank corporate account',
								rahunok: 'Compatible with ANY bank account in Ukraine',
								isAdvantage: true
							},
							{
								feature: 'Transaction commission',
								competitor: '1.3% – 1.5% per bill',
								rahunok: '0% card interchange fee / transparent fix',
								isAdvantage: true
							},
							{
								feature: 'Settlement turnaround',
								competitor: 'Next business day delay',
								rahunok: 'Real-time onto IBAN (24/7/365)',
								isAdvantage: true
							},
							{
								feature: 'Customers with other banks',
								competitor: 'Forced to manually enter 16-digit card numbers & CVV',
								rahunok: '1-tap native flow in their own banking app',
								isAdvantage: true
							},
							{
								feature: 'Waiter tips processing',
								competitor: 'Mixed into merchant batch or requires mono',
								rahunok: 'Direct peer-to-peer A2A transfer to waiter',
								isAdvantage: true
							},
							{
								feature: 'Hardware costs',
								competitor: 'Physical POS terminal or Android-only tap',
								rahunok: '0 ₴ hardware cost (iOS + Android)',
								isAdvantage: true
							}
						]
					},
					workflow: {
						title: 'How It Operates in Your Venue',
						steps: [
							{
								step: '1',
								title: 'Waiter opens table',
								desc: 'Order is created in your standard POS (Poster, Syrve, etc.) with live amount.'
							},
							{
								step: '2',
								title: 'Guest scans QR',
								desc: 'Guest points camera at table stand or printed bill to inspect order in App Clip.'
							},
							{
								step: '3',
								title: 'Instant Settlement',
								desc: 'Guest authorizes FaceID in banking app. POS automatically closes table and generates fiscal receipt.'
							}
						]
					},
					cta: {
						title: 'Launch Rahunok in Your Restaurant',
						desc: '1-day pilot deployment with zero POS downtime. Free testing environment.',
						btn: 'Connect HoReCa Pilot'
					}
				},
				{
					id: 'retail',
					indexLabel: '02',
					tag: 'Retail & Stores',
					badge: 'Smartphone POS Replacing Monobank & Legacy Terminals',
					heroTitle: 'A full-featured POS in every phone. 0 ₴ terminal rental.',
					heroSubtitle:
						'Accept cardless instant payments without heavy physical terminals and without Tap to Phone restrictions (which do not work on iPhones). Cashiers generate payment QR in seconds on phone or counter screen. Customers pay in their bank app in under 3 seconds.',
					heroHighlight:
						'Identical seamless flow on iOS & Android · Zero card skimming risks · Built-in digital PRRO fiscal receipts',
					metrics: [
						{
							value: '0 ₴',
							label: 'Hardware rental cost',
							sub: 'Save 400–600 ₴/mo on each terminal'
						},
						{
							value: '100%',
							label: 'Smartphone compatibility',
							sub: 'Native on all iPhones and Androids'
						},
						{
							value: '1.2s',
							label: 'Payment authorization speed',
							sub: 'Instant verification with no terminal lag'
						},
						{
							value: '100%',
							label: 'Automated digital receipts',
							sub: 'Checkbox / Vchasno PRRO integration'
						}
					],
					highlights: [
						{
							title: 'Turn Any Smartphone into Cashier POS',
							desc: 'No heavy banking software or specialized Android hardware needed. Operates seamlessly on staff iPhones via responsive web and bot.',
							icon: 'SmartphoneNfc',
							tag: 'iOS & Android'
						},
						{
							title: 'Dynamic & Static QR Stands',
							desc: 'Print branded counter QR displays or render dynamic bill QRs with exact order totals on cashier tablet screens.',
							icon: 'QrCode',
							tag: 'Countertop'
						},
						{
							title: 'Real-Time Anti-Fraud Verification',
							desc: 'Cryptographic backend verification ensures funds have reached your IBAN before goods are handed over. Instant visual feedback.',
							icon: 'ShieldCheck',
							tag: 'Instant Callback'
						},
						{
							title: 'Accounting & ERP Synchronization',
							desc: 'Pre-built connectors for 1C, BAS, Torgsoft, and cloud inventory tools for real-time stock deductions.',
							icon: 'Layers',
							tag: 'ERP Sync'
						}
					],
					comparison: {
						title: 'Compared to Monobank Tap to Phone',
						desc: 'Why Rahunok provides a superior and more cost-effective setup for retail outlets.',
						headers: ['Feature', 'mono Tap to Phone', 'Rahunok Retail A2A'],
						rows: [
							{
								feature: 'iPhone (iOS) support',
								competitor: 'Not supported (Tap to Phone requires Android NFC)',
								rahunok: 'Full native support for iPhone and Android',
								isAdvantage: true
							},
							{
								feature: 'Transaction fee',
								competitor: '1.3% card acquiring commission',
								rahunok: '0% card network interchange fee',
								isAdvantage: true
							},
							{
								feature: 'Cards from other banks',
								competitor: 'Requires physical card tapping',
								rahunok: 'Scans QR and opens customer’s preferred bank app',
								isAdvantage: true
							},
							{
								feature: 'Merchant bank exclusivity',
								competitor: 'Only monobank corporate accounts',
								rahunok: 'Any Ukrainian bank (Privat, Oschad, PUMB, mono, etc.)',
								isAdvantage: true
							},
							{
								feature: 'PRRO fiscalization',
								competitor: 'Requires separate third-party manual steps',
								rahunok: 'Automated receipt generation on every payment',
								isAdvantage: true
							}
						]
					},
					workflow: {
						title: 'Simple Counter Checkout Flow',
						steps: [
							{
								step: '1',
								title: 'Enter amount',
								desc: 'Cashier inputs amount or scans product barcodes on tablet or phone.'
							},
							{
								step: '2',
								title: 'Display QR',
								desc: 'Customer scans dynamic QR code on screen or countertop stand.'
							},
							{
								step: '3',
								title: 'Receipt & Handover',
								desc: 'Payment verified instantly. Green receipt confirmation shown and digital fiscal receipt emitted.'
							}
						]
					},
					cta: {
						title: 'Equip Your Stores with Modern Checkout',
						desc: 'Start accepting terminal-free A2A payments today. Setup takes less than 24 hours.',
						btn: 'Connect Retail'
					}
				},
				{
					id: 'services',
					indexLabel: '03',
					tag: 'Digital & Services',
					badge: 'Smart PayLinks Outperforming mono payment-link',
					heroTitle: 'Payment links with +35% higher checkout conversion.',
					heroSubtitle:
						'Generate smart PayLinks to share on Instagram Direct, Telegram, WhatsApp, or SMS. Links automatically launch the customer’s native banking app with pre-filled payment details. No manual 16-digit card typing — instant 1-click FaceID authorization.',
					heroHighlight:
						'Automated generation via CRM · Instant Nova Poshta tracking creation · Courier on-delivery QR checkout',
					metrics: [
						{
							value: '+35%',
							label: 'Checkout conversion boost',
							sub: 'Eliminates friction of typing card details'
						},
						{
							value: '1 click',
							label: 'FaceID/TouchID confirmation',
							sub: 'Within the customer’s trusted bank app'
						},
						{
							value: '0 sec',
							label: 'CRM status sync latency',
							sub: 'Instant webhook order updates'
						},
						{
							value: '100%',
							label: 'Payment integrity & security',
							sub: 'Compliant with NBU Open Banking standards'
						}
					],
					highlights: [
						{
							title: 'Smart Messenger PayLinks',
							desc: 'Generate single-use or reusable links for fixed or custom amounts. One click takes the customer directly to their banking app.',
							icon: 'Link',
							tag: '1-Click Checkout'
						},
						{
							title: 'End-to-End CRM Automation',
							desc: 'KeyCRM, SalesDrive, KeepinCRM, Creatio. Create invoices directly inside customer cards; auto-update status to "Paid" and emit Nova Poshta labels.',
							icon: 'Bot',
							tag: 'CRM Integration'
						},
						{
							title: 'On-Delivery Driver & Courier Checkout',
							desc: 'Couriers present dynamic QR on their smartphone at the doorstep. Customers pay via their bank with zero cash handling.',
							icon: 'Send',
							tag: 'Courier Delivery'
						},
						{
							title: 'Recurring Billing & Subscriptions',
							desc: 'Automated recurring charges for SaaS, courses, memberships, and service subscriptions with bank confirmation.',
							icon: 'ReceiptText',
							tag: 'Subscriptions'
						}
					],
					comparison: {
						title: 'Why Smart PayLinks Surpass mono payment-link',
						desc: 'Comparing payment links for Instagram shops, freelance professionals, and service businesses.',
						headers: ['Capability', 'mono payment-link / mini-site', 'Rahunok Smart PayLinks'],
						rows: [
							{
								feature: 'Customers without monobank',
								competitor: 'Forced to manually type 16 digits, expiry & CVV',
								rahunok: 'Opens their native bank app (Privat24, Sense, A-Bank)',
								isAdvantage: true
							},
							{
								feature: 'Sales commission',
								competitor: '1.3% per payment link',
								rahunok: '0% card fee, direct A2A transfer',
								isAdvantage: true
							},
							{
								feature: 'Payout destination',
								competitor: 'Strictly monobank corporate account',
								rahunok: 'Direct payout to your IBAN at any bank',
								isAdvantage: true
							},
							{
								feature: 'CRM & Shipping Automation',
								competitor: 'Limited manual webhook setup',
								rahunok: 'Plug-and-play modules for KeyCRM, SalesDrive & Nova Poshta',
								isAdvantage: true
							},
							{
								feature: 'Courier on-the-go mode',
								competitor: 'No specialized delivery driver flow',
								rahunok: 'Built-in courier QR flow for delivery teams',
								isAdvantage: true
							}
						]
					},
					workflow: {
						title: 'How to Sell in Social Media & Messengers',
						steps: [
							{
								step: '1',
								title: 'Generate link',
								desc: 'Create link inside your CRM, web dashboard, or Telegram bot in 5 seconds.'
							},
							{
								step: '2',
								title: 'Send to buyer',
								desc: 'Share link in Direct or chat. Buyer opens link and selects their bank.'
							},
							{
								step: '3',
								title: 'Instant settlement',
								desc: 'Funds settle in your account, order status updates, buyer gets digital receipt.'
							}
						]
					},
					cta: {
						title: 'Boost Conversions Across All Channels',
						desc: 'Deploy smart payment links for social commerce and service billing in minutes.',
						btn: 'Create First PayLink'
					}
				},
				{
					id: 'api',
					indexLabel: '04',
					tag: 'API & Enterprise',
					badge: 'High-Load Open Banking Gateway Replacing Card Acquiring',
					heroTitle: 'High-throughput A2A payment gateway for platforms & marketplaces.',
					heroSubtitle:
						'Direct Open Banking integration for mobile apps, e-commerce platforms, and ERPs. Up to 50,000 TPS capacity, sub-second signed webhooks, automated marketplace split settlements, and unified multi-entity corporate consoles.',
					heroHighlight:
						'Latency < 120ms · White-label SDK for iOS & Android · Multi-IBAN marketplace payouts',
					metrics: [
						{
							value: '50 000',
							label: 'Transactions per second (TPS)',
							sub: 'Distributed high-availability infrastructure'
						},
						{
							value: '< 120ms',
							label: 'Webhook delivery latency',
							sub: 'Instant cryptographic server notification'
						},
						{
							value: '99.99%',
							label: 'Guaranteed service SLA',
							sub: 'Multi-datacenter redundant deployment'
						},
						{
							value: 'Multi-IBAN',
							label: 'Marketplace split engine',
							sub: 'Automated fund routing across merchants'
						}
					],
					highlights: [
						{
							title: 'RESTful API & Real-Time Webhooks',
							desc: 'Clean OpenAPI 3.0 standards. Signed event payloads with automated retry policies and comprehensive developer documentation.',
							icon: 'Webhook',
							tag: 'OpenAPI 3.0'
						},
						{
							title: 'White-Label SDK for iOS & Android',
							desc: 'Embed native bank checkout directly inside your mobile application with zero third-party browser redirects.',
							icon: 'Smartphone',
							tag: 'Mobile SDK'
						},
						{
							title: 'Marketplace Split Settlements',
							desc: 'Single customer cart payments are split and settled directly onto respective merchant IBANs with zero intermediary balance holding.',
							icon: 'Split',
							tag: 'Marketplace Engine'
						},
						{
							title: 'Multi-Entity Corporate Console',
							desc: 'Manage dozens of legal entities (LLC / Sole Proprietorships) with granular RBAC permissions, audit logs, and SAP/1C exports.',
							icon: 'Building2',
							tag: 'Enterprise Suite'
						}
					],
					comparison: {
						title: 'Why Platforms Choose Rahunok Enterprise API',
						desc: 'Comparing traditional card acquiring APIs with Rahunok Open Banking Infrastructure.',
						headers: ['Feature', 'API plata by mono (Card Gateway)', 'Rahunok Enterprise A2A API'],
						rows: [
							{
								feature: 'Core technology',
								competitor: 'Card network acquiring (Visa / Mastercard)',
								rahunok: 'Direct interbank Open Banking / SEP-4 protocol',
								isAdvantage: true
							},
							{
								feature: 'Marketplace split payouts',
								competitor: 'Complex manual or restricted merchant routing',
								rahunok: 'Instant automated splits across unlimited IBANs',
								isAdvantage: true
							},
							{
								feature: 'White-Label in-app checkout',
								competitor: 'Redirects to mono hosted payment page',
								rahunok: 'Fully embedded native UI within your app',
								isAdvantage: true
							},
							{
								feature: 'Transaction limits',
								competitor: 'Capped by personal online card limits',
								rahunok: 'Direct high-limit B2B & B2C account transfers',
								isAdvantage: true
							},
							{
								feature: 'Enterprise SLA & support',
								competitor: 'Standard public offer terms',
								rahunok: '99.99% SLA, dedicated cluster, 24/7 architect support',
								isAdvantage: true
							}
						]
					},
					workflow: {
						title: 'Fast Integration in 3 Steps',
						steps: [
							{
								step: '1',
								title: 'Obtain API Keys',
								desc: 'Register in developer portal and generate sandbox testing credentials.'
							},
							{
								step: '2',
								title: 'Integrate SDKs',
								desc: 'Use official libraries for Node.js, Python, PHP, Go or direct REST endpoints.'
							},
							{
								step: '3',
								title: 'Launch in Production',
								desc: 'Pass verification and process direct account-to-account transactions.'
							}
						]
					},
					cta: {
						title: 'Discuss Enterprise Architecture',
						desc: 'Our payment architects will design a bespoke integration tailored to your platform requirements.',
						btn: 'Schedule Architecture Call'
					}
				}
			],
			featuresEyebrow: 'Ecosystem Features',
			featuresTitle: 'Everything You Need to Accept Payments',
			featuresDesc: 'Comprehensive tooling from mobile cashier app to open developer APIs.',
			features: [
				{
					label: 'QR',
					title: 'Dynamic Invoices',
					description: 'Amount, order, table, and reference in one QR code.'
				},
				{
					label: 'NFC',
					title: 'Tap to Pay',
					description: 'Instant checkout opening via contactless NFC tags.'
				},
				{
					label: 'LINK',
					title: 'Payment Links',
					description: 'Share invoices via Telegram, WhatsApp, email, or SMS.'
				},
				{
					label: 'STATUS',
					title: 'Backend Verification',
					description: 'Orders close strictly after bank-verified callback.'
				},
				{
					label: 'FISCAL',
					title: 'Digital Receipts',
					description: 'Automated fiscalization reporting to tax authorities.'
				},
				{
					label: 'DATA',
					title: 'Analytics',
					description: 'Real-time reports on sales, revenue, and cashier metrics.'
				},
				{
					label: 'BOT',
					title: 'Telegram Bot',
					description: 'Create bills and get instant transaction alerts in Telegram.'
				},
				{
					label: 'API',
					title: 'Integrations',
					description: 'Developer-friendly REST API and webhooks for custom setups.'
				}
			]
		},
		trustAndPricing: {
			securityEyebrow: 'Security & Custody',
			securityTitle: 'Money goes straight to you. No middlemen.',
			securityDesc:
				"Rahunok doesn't hold funds in transit accounts. Payments flow directly from the buyer's bank to your official IBAN.",
			securityAssurances: [
				'Direct A2A / SEPA transfer to IBAN',
				"Authorized solely in user's own banking app",
				'Certified NBU 003 standard'
			],
			securityPipelineHeader: { label: 'Direct A2A Transfer', title: 'Zero-Custody Architecture' },
			securityPipeline: [
				{
					label: 'Sender',
					title: 'CUSTOMER',
					desc: 'Confirms payment securely in their banking app'
				},
				{
					label: 'Authorization',
					title: 'THEIR BANK',
					desc: 'Checks balance and executes the transfer'
				},
				{
					label: 'Recipient',
					title: 'YOUR ACCOUNT',
					desc: 'Receives funds instantly on your official IBAN'
				}
			],
			trustItems: [
				{
					title: 'No hardware needed',
					description:
						'A smartphone or printed QR tag is all you need to accept payments without terminal rent.'
				},
				{
					title: 'Server-verified status',
					description:
						'Returning from a bank app does not close the invoice. Verification happens cryptographically on backend.'
				},
				{
					title: 'Every payment in context',
					description: 'Amount, order, table, and confirmed status unified in one clean interface.'
				},
				{
					title: 'Auto fiscalization',
					description:
						'Digital fiscal receipts are generated immediately upon confirmed transaction success.'
				}
			],
			proofEyebrow: 'Absolute Control',
			proofTitle: 'Bank-Grade Compliance & Security',
			proofDesc: 'Built in full compliance with National Bank of Ukraine regulatory standards.',
			proofItems: [
				{
					label: '01',
					title: 'Sandbox Environment',
					description: 'Test invoicing, payment UX, webhooks, and receipts before going live.'
				},
				{
					label: '02',
					title: 'Payment Reconciliation',
					description: 'Every single transaction is linked to invoice ID, amount, and timestamp.'
				},
				{
					label: '03',
					title: 'Transparent Terms',
					description: 'Supported banks and terms are agreed upon upfront with zero hidden fees.'
				},
				{
					label: '04',
					title: 'Launch Support',
					description:
						'Our engineering team helps you conduct your first test payment and integration.'
				}
			],
			pricingEyebrow: 'Transparent Pricing',
			pricingTitle: 'Simple & Fair Subscription Plans',
			pricingDesc: 'Choose the plan tailored to your business volume and growth stage.',
			pricingPlans: [
				{
					name: 'Start',
					price: 'Free',
					description: 'For testing and launching your first cash register.',
					features: [
						'1 business profile',
						'Basic QR invoices',
						'Payment links',
						'Transaction history'
					],
					cta: 'Start Free',
					note: 'Commission and bank availability agreed during onboarding.'
				},
				{
					name: 'Business',
					price: 'from $15/mo',
					description: 'For active retail stores, cafes, and restaurants.',
					features: [
						'Multiple POS registers & team seats',
						'QR, NFC & links',
						'Real-time verified webhooks',
						'Analytics & priority support',
						'Automated fiscalization'
					],
					cta: 'Choose Business',
					note: 'Low transaction fees based on monthly processing volume.',
					popular: true
				},
				{
					name: 'Platform',
					price: 'Custom',
					description: 'For retail chains, franchises, and enterprise platforms.',
					features: [
						'Multi-entity & multi-location',
						'Full API & Webhooks',
						'White-label checkout',
						'Dedicated account manager'
					],
					cta: 'Discuss Pilot',
					note: 'Custom pricing tailored to processing volume and SLA requirements.'
				}
			],
			faqEyebrow: 'Knowledge Base',
			faqTitle: 'Frequently Asked Questions',
			faqDesc: 'Everything you need to know about accepting payments with Rahunok.',
			faqItems: [
				{
					question: 'Do I need a physical POS terminal?',
					answer:
						'No, accepting payments via QR, NFC or links with Rahunok does not require a terminal. You accept instant payments directly from your smartphone, without renting extra equipment.'
				},
				{
					question: 'Where does the money go?',
					answer:
						'In the A2A (account-to-account) model, funds are transferred directly. It is a direct payment to your corporate IBAN. No intermediaries and no delays.'
				},
				{
					question: 'Do I need a corporate account?',
					answer:
						'Yes, accepting PayByBank payments requires the details of a registered business entity and a compatible business bank account.'
				},
				{
					question: 'Which banks are supported?',
					answer:
						'The list depends on active partner integrations. We are working to ensure instant payment is available for customers of most popular banks.'
				},
				{
					question: 'How does QR work?',
					answer:
						'QR payment for business works simply: the client scans the code, which opens a secure screen with the amount, merchant, and purpose for convenient Pay by Bank authorization.'
				},
				{
					question: 'What happens if the customer does not complete the payment?',
					answer:
						'The invoice in the Rahunok system will remain pending, get cancelled, or receive an error status. You always control the status of every payment.'
				},
				{
					question: 'How does Rahunok confirm successful payment?',
					answer:
						'For reliability, the status of every instant payment is verified by our server via an available API, webhook, or reconciliation mechanism. This guarantees a successful direct payment to your IBAN.'
				},
				{
					question: 'How does PRRO work?',
					answer:
						'Immediately after a successfully confirmed A2A payment, the data is automatically transmitted to your configured PRRO service to fiscalize the receipt.'
				},
				{
					question: 'Does the customer need to install an app?',
					answer:
						'Not necessarily: PayByBank payments typically use the customer’s standard banking app, a web checkout, or a mobile browser without any extra downloads.'
				},
				{
					question: 'Does it work on iPhone and Android?',
					answer:
						'Yes, our terminal-less QR payment and NFC scenarios work perfectly on both platforms, providing a seamless customer experience.'
				},
				{
					question: 'What is the commission?',
					answer:
						'The commission for A2A payments is usually significantly lower than classic acquiring and depends on your Rahunok plan, bank, payment method, and agreement.'
				},
				{
					question: 'How to connect?',
					answer:
						'Leave your contacts on the Rahunok website, specify your business type, and we will help set up your checkout to accept payments without a terminal and run the first test.'
				}
			],
			ctaEyebrow: 'Next Step for Your Business',
			ctaTitle: 'Ready to ditch card terminals and reduce payment fees?',
			ctaDesc:
				'Launch a pilot integration in 1 day and start accepting instant account-to-account payments today.',
			ctaBtn: 'Get Started with Rahunok'
		},
		footer: {
			description: 'Next-generation A2A payment infrastructure for modern business.',
			navTitle: 'Navigation',
			legalTitle: 'Legal',
			rights: 'All rights reserved.',
			terms: 'Terms of Service',
			privacy: 'Privacy Policy',
			security: 'Payment Security'
		},
		modal: {
			badge: 'Fast Onboarding',
			title: 'Launch a Rahunok Pilot',
			desc: 'Leave your contact details and our team will get in touch to set up your test sandbox.',
			nameLabel: 'Your Name',
			phoneLabel: 'Phone Number',
			businessLabel: 'Company or Brand Name',
			submitBtn: 'Submit Request',
			successTitle: 'Demo form completed',
			successDesc: 'Our specialist will contact you shortly to activate your pilot.',
			demoNotice:
				'This is a demo form with no network request. Your contact details are not sent anywhere.',
			closeBtn: 'Close'
		}
	},
	pl: {
		langName: 'Polski',
		brand: {
			name: 'Rahunok',
			tagline: 'Błyskawiczne płatności A2A dla biznesu'
		},
		nav: {
			howItWorks: 'Jak to działa',
			forBusiness: 'Dla Biznesu',
			moneyFlow: 'Przepływ środków',
			pricing: 'Cennik',
			faq: 'FAQ',
			pos: 'Aplikacja Kasa',
			account: 'Panel klienta',
			tryPilot: 'Wypróbuj pilotaż',
			calculateSavings: 'Oblicz oszczędności'
		},
		hero: {
			eyebrowAudience: {
				business: 'dla biznesu',
				personal: 'dla Ciebie'
			},
			eyebrowBadge: 'Płatności A2A nowej generacji',
			initialHeadlinePrefix: 'Przyjmuj płatności. ',
			initialHeadlineAccent: 'Bez terminala.',
			finalHeadlineStart: 'Płatność',
			finalHeadlineMiddle: ', która jest ',
			finalHeadlineEnd: 'naturalna.',
			subhead:
				'Bezpośrednie rozliczenia z aplikacji bankowych klientów prosto na Twój numer rachunku IBAN. Bez dzierżawy terminali POS, bez wysokich prowizji kartowych i z wbudowaną fiskalizacją.',
			tryPilotBtn: 'Wypróbuj pilotaż',
			calculateSavingsBtn: 'Oblicz oszczędności',
			proof: {
				zeroHardware: { title: '0 zł za terminal', desc: 'Wystarczy zwykły smartfon' },
				instantSettlement: { title: 'Prosto na IBAN', desc: 'Bez pośredników' },
				autoPrro: { title: 'Wbudowana fiskalizacja', desc: 'Natychmiastowe paragony' }
			},
			dashboard: {
				title: 'Rahunok Core',
				navOverview: 'Przegląd',
				navPos: 'Kasa',
				navInvoices: 'Rachunki',
				navManagement: 'Zarządzanie',
				navStructure: 'Struktura',
				navRules: 'Reguły',
				financialOverview: 'Przegląd finansowy',
				todayRevenue: 'Dzisiejszy utarg',
				successfulPayments: 'Udane płatności',
				avgCheck: 'Średni rachunek',
				recentOperations: 'Ostatnie transakcje',
				colTime: 'Czas',
				colPurpose: 'Tytuł płatności',
				colStatus: 'Status',
				colAmount: 'Kwota',
				statusPaid: 'Rozliczono',
				coffeeTable: 'Kawa i rogalik · Kasa 1',
				lunchTable: 'Lunch biznesowy · Stolik 4',
				dinnerTable: 'Kolacja · Stolik 12',
				takeaway: 'Zamówienie na wynos'
			},
			checkout: {
				time: '9:41',
				appTitle: 'Rahunok Pay',
				merchantName: "Kawiarnia 'Krapka'",
				tableBadge: 'Stolik 12 · Rachunek #1046',
				statusWaiting: 'Oczekiwanie na wybór banku',
				statusProcessing: 'Przetwarzanie…',
				statusPaid: 'Opłacono ✓',
				securityBadge: 'Rahunok · NBU 003',
				noFeeBadge: 'Bez prowizji',
				allBanks: 'Wszystkie banki',
				payAction: (b) => `Potwierdź płatność w ${b}`,
				processingAction: (b) => `Oczekiwanie na ${b}…`,
				readyAction: 'Gotowe',
				successTitle: 'PŁATNOŚĆ PRZYJĘTA',
				successDesc: 'Środki przekazane natychmiast na Twoje konto',
				receiptFiscal: '✓ Paragon fiskalny #89421',
				receiptOrder: 'Zamówienie #1046'
			},
			pipeline: {
				customer: 'KLIENT',
				theirBank: 'JEGO BANK',
				yourAccount: 'TWOJE KONTO IBAN',
				note: 'Jedno płynne działanie dla klienta. Pełna kontrola finansowa i fiskalizacja dla firmy.'
			}
		},
		sandbox: {
			eyebrow: 'Live Sandbox · test bez opłat',
			title: 'Dodaj Pay by Bank do dowolnego procesu checkout.',
			description:
				'Zintegruj w swoim sklepie, wyślij link do zapłaty lub pokaż kod QR. Rahunok działa na Twojej strukturze, bez konieczności zmiany kont bankowych.',
			liveBadge: 'LIVE A2A SANDBOX',
			simulationMode: 'Środowisko testowe · Tryb symulacji',
			step1: {
				badge: '01',
				small: 'Twoja kasa lub strona WWW',
				title: 'Wygeneruj rachunek',
				presets: {
					coffee: 'Kawa',
					lunch: 'Obiad',
					dinner: 'Kolacja',
					services: 'Usługi'
				},
				purposeLabel: 'Tytuł płatności',
				purposePlaceholder: 'Opis zamówienia',
				amountLabel: 'Kwota, ₴',
				tableLabel: 'Stolik / Znacznik',
				submitBtn: 'Utwórz rachunek'
			},
			step2: {
				badge: '02',
				small: 'Doświadczenie klienta',
				title: 'Wybiera swój bank',
				merchantName: "Kawiarnia 'Krapka'",
				noFee: 'Bez prowizji',
				allBanks: 'Wszystkie banki',
				security: 'Rahunok · NBU 003',
				btnConfirm: (b) => `Potwierdź płatność w ${b}`,
				btnChecking: (b) => `Weryfikacja płatności w ${b}…`,
				btnSuccess: 'Płatność potwierdzona ✓',
				emptyTitle: 'Checkout gotowy',
				emptyDesc: 'Utwórz rachunek w pierwszym kroku'
			},
			step3: {
				badge: '03',
				small: 'Serwer Rahunok',
				title: 'Weryfikuje status',
				waitingStatus: 'Oczekiwanie na płatność',
				processingStatus: 'Przetwarzanie Webhook A2A…',
				successStatus: 'Verified SUCCESS',
				successDesc: (amt) => `${amt} zaksięgowano na Twoim koncie IBAN. Paragon wystawiony.`,
				waitingDesc:
					'Status w kasie aktualizuje się wyłącznie po kryptograficznym potwierdzeniu przez bank.'
			},
			footerTags: [
				'Hosted Web Checkout',
				'Mobile SDK',
				'Payment Links',
				'Dynamiczny QR / NFC',
				'Jednolite API'
			]
		},
		calculator: {
			eyebrow: 'Analityka finansowa',
			title: 'Oblicz czyste oszczędności na prowizjach.',
			subtitle:
				'Porównaj koszty tradycyjnego acquirungu kart (1.3-2.0%) z bezpośrednimi płatnościami A2A Rahunok.',
			turnoverLabel: 'Miesięczny obrót kasy',
			avgCheckLabel: 'Średnia wartość paragonu',
			currentAcquiring: 'Tradycyjny acquirung (1.5%)',
			currentCost: 'Aktualne koszty prowizji',
			rahunokCost: 'Koszty z Rahunok',
			monthlyEconomy: 'Miesięczna oszczędność',
			annualEconomy: 'Roczna oszczędność',
			calculateNote:
				'Kalkulacja oparta na średnich stawkach rynkowych. Rzeczywiste oszczędności zależą od struktury płatności Twojego biznesu.'
		},
		scenarios: {
			eyebrow: 'Scenariusze użycia',
			title: 'Jedna płatność. Dwa doskonałe doświadczenia.',
			merchantRole: 'Kasa (Sprzedawca)',
			payerRole: 'Checkout (Klient)',
			merchant: {
				eyebrow: 'Dla biznesu i kasy',
				title: 'Od kwoty do zaksięgowania na koncie IBAN.',
				intro:
					'Kasjer generuje rachunek w 2 sekundy w mobilnej kasie, a system automatycznie potwierdza wpływ środków.',
				steps: [
					{ title: 'Podaj kwotę', text: 'Wpisz kwotę na ekranie dotykowym lub wybierz stolik.' },
					{
						title: 'Wygeneruj płatność',
						text: 'Kasa natychmiast tworzy zamówienie z Twoim numerem IBAN.'
					},
					{
						title: 'Pokaż QR / NFC',
						text: 'Klient skanuje kod QR aparatem telefonu lub przykłada smartfon.'
					},
					{
						title: 'Otrzymaj SUCCESS',
						text: 'Kasa otrzymuje potwierdzenie z serwera i rejestruje paragon.'
					}
				]
			},
			payer: {
				eyebrow: 'Dla klienta',
				title: 'Od skanowania do paragonu bez wpisywania numeru karty.',
				intro:
					'Bez wpisywania 16 cyfr karty, kodów CVV czy numerów telefonów. Wszystko w aplikacji bankowej.',
				steps: [
					{
						title: 'Otwórz płatność',
						text: 'Zeskanuj kod QR aparatem lub zbliż telefon do tagu NFC.'
					},
					{
						title: 'Wybierz bank',
						text: 'Wybierz swoją aplikację bankową: monobank, Privat24, Sense itp.'
					},
					{
						title: 'Potwierdź FaceID',
						text: 'Zatwierdź transakcję bezpiecznie w aplikacji swojego banku.'
					},
					{
						title: 'Odbierz paragon',
						text: 'Błyskawiczne potwierdzenie i elektroniczny paragon fiskalny.'
					}
				]
			},
			stepProgress: (c, t) => `Krok ${c} z ${t}`
		},
		planB: {
			eyebrow: 'PLAN AWARYJNY DLA BIZNESU · PLAN B',
			title: 'Terminal nie działa? Nie zatrzymuj sprzedaży.',
			subtitle:
				'Skonfiguruj wcześniej rezerwowe płatności QR. Podczas awarii otwórz Rahunok na smartfonie i nadal przyjmuj płatności bez dodatkowego sprzętu.',
			badge: 'Gotowość na awarię',
			emergencyFlowTitle: 'Przejście na rezerwowy kanał płatności',
			timelineNote: 'Przygotuj wcześniej, aktywuj podczas awarii',
			proofLabel: 'Parametry scenariusza rezerwowego',
			proofPoints: [
				{ value: '≈ 5 min', label: 'pierwsza konfiguracja' },
				{ value: 'do 60 s', label: 'przejście na rezerwę' },
				{ value: '2,3 s', label: 'typowy SUCCESS na IBAN' },
				{ value: 'do 10 s', label: 'limit regulacyjny NBU' }
			],
			availabilityNote:
				'Plan B działa, gdy główny POS lub kasa są niedostępne, ale smartfon ma internet mobilny, a bank klienta realizuje przelewy.',
			steps: [
				{
					icon: 'ZapOff',
					stepNumber: '01',
					title: 'Awaria kasy lub brak zasilania',
					desc: 'Blackout, zakłócenia infrastruktury, rozładowany terminal POS lub punkt mobilny.',
					tag: 'Punkt offline'
				},
				{
					icon: 'Smartphone',
					stepNumber: '02',
					title: 'Aktywacja w 60 sekund',
					desc: 'Sprzedawca uruchamia Rahunok na dowolnym smartfonie (iOS/Android) lub pokazuje kod QR.',
					tag: 'Mobilna kasa'
				},
				{
					icon: 'QrCode',
					stepNumber: '03',
					title: 'Klient płaci w aplikacji banku',
					desc: 'Klient skanuje kod QR i potwierdza transakcję FaceID w swojej aplikacji bankowej.',
					tag: 'Open Banking A2A'
				},
				{
					icon: 'ShieldCheck',
					stepNumber: '04',
					title: 'SUCCESS na IBAN w 2,3 sekundy',
					desc: 'Typowy status płatności dociera w 2,3 sekundy; limit regulacyjny NBU wynosi maksymalnie 10 sekund.',
					tag: 'Środki na koncie'
				},
				{
					icon: 'ReceiptText',
					stepNumber: '05',
					title: 'Paragon fiskalny',
					desc: 'Podłączony system PRRO generuje elektroniczny paragon fiskalny dla klienta i urzędu.',
					tag: 'Podłączony PRRO'
				}
			],
			resilienceCards: [
				{
					icon: 'Clock',
					title: '0 ₴ opłat abonamentowych za rezerwę',
					desc: 'Utrzymuj Rahunok jako darmowe ubezpieczenie. Zero opłat za wynajem terminala, gdy kasa nie jest używana.',
					highlight: 'Darmowa rezerwa'
				},
				{
					icon: 'Building2',
					title: 'Bez zmiany Twojego banku',
					desc: 'Środki trafiają bezpośrednio na Twój istniejący rachunek IBAN w dowolnym banku bez otwierania nowych kont.',
					highlight: 'Twój obecny IBAN'
				},
				{
					icon: 'Signal',
					title: 'Zoptymalizowany dla sieci mobilnej',
					desc: 'Proces QR przesyła minimum danych i nie wymaga osobnego łącza terminala POS. Do płatności potrzebny jest internet.',
					highlight: 'Minimum danych'
				},
				{
					icon: 'Flame',
					title: 'Błyskawiczne przeniesienie punktu',
					desc: 'Musisz szybko przenieść sprzedaż w inne miejsce lub do namiotu z agregatem? Kasa jest już w kieszeni.',
					highlight: 'Mobilność'
				}
			],
			ctaTitle: 'Przygotuj Plan B, zanim będzie potrzebny',
			ctaSubtitle:
				'Konfiguracja i test zajmują około 5 minut. Przejście podczas awarii — do 60 sekund.',
			ctaBtn: 'Przetestuj Plan B na smartfonie',
			guaranteeText: 'Bez wizyt w banku · Bez zmiany kont · 0 ₴ kosztów gotowości'
		},
		productSections: {
			architectureEyebrow: 'Architektura procesu',
			architectureTitle: 'Jak działa bezpośrednia płatność',
			architectureDesc:
				'Pieniądze nie przechodzą już przez wielu pośredników. Płatność trafia bezpośrednio.',
			architectureSteps: [
				{
					label: '01',
					title: 'QR, NFC lub link',
					description: 'Klient otwiera bezpieczny proces płatności ze swojego smartfona.'
				},
				{
					label: '02',
					title: 'Native payment UX',
					description: 'Otwiera się ekran z kwotą, sprzedawcą i tytułem płatności.'
				},
				{
					label: '03',
					title: 'Wybór banku',
					description: 'Klient przechodzi do dostępnej aplikacji bankowej.'
				},
				{
					label: '04',
					title: 'Autoryzacja',
					description: 'Potwierdzenie odbywa się po stronie banku klienta.'
				},
				{
					label: '05',
					title: 'Server-confirmed success',
					description: 'Kasa widzi SUCCESS dopiero po weryfikacji płatności przez backend.'
				}
			],
			comparisonEyebrow: 'Analiza porównawcza',
			comparisonTitle: 'Tradycyjny terminal POS czy Rahunok?',
			comparisonDesc: 'Zobacz, dlaczego nowoczesne firmy przechodzą na płatności Pay by Bank.',
			comparisonHeaders: ['Kryterium', 'Klasyczny terminal POS', 'Rahunok A2A'],
			comparisonRows: [
				[
					'Dodatkowe urządzenia',
					'Wymagane (miesięczna dzierżawa)',
					'Opcjonalne (smartfon lub kod QR)'
				],
				[
					'Kody QR i linki płatnicze',
					'Zależne od banku / rozproszone',
					'Zintegrowane w jednym panelu'
				],
				[
					'Rachunki i zamówienia',
					'Oddzielny system POS',
					'Połączone z płatnością w czasie rzeczywistym'
				],
				['Potwierdzenie płatności', 'Wydruk z terminala', 'Błyskawiczna weryfikacja na serwerze'],
				['Fiskalizacja i paragony', 'Oddzielna integracja', 'Automatyczna po statusie SUCCESS'],
				['API i Webhooks', 'Ograniczone lub brak', 'Nowoczesne i otwarte REST API']
			],
			solutionsEyebrow: 'Dedykowane rozwiązania',
			solutionsTitle: 'Stworzone dla każdej branży',
			solutionsDesc:
				'Elastyczne scenariusze dla gastronomii, handlu detalicznego, usług i e-commerce.',
			solutions: [
				{
					label: 'HoReCa',
					title: 'Restauracja od razu wie, który stolik zapłacił.',
					description:
						'Stwórz rachunek dla stolika, pokaż kod QR i odbierz potwierdzenie bez biegania z terminalem.'
				},
				{
					label: 'Retail',
					title: 'Sklep przyjmuje płatności zwykłym smartfonem.',
					description:
						'Podaj kwotę, pokaż kod QR i natychmiast zobacz potwierdzenie wpływu środków.'
				},
				{
					label: 'Usługi',
					title: 'Specjalista wysyła rachunek bezpośrednio w komunikatorze.',
					description: 'Wygeneruj link do płatności. Klient opłaci rachunek w dogodnym momencie.'
				},
				{
					label: 'Online & API',
					title: 'E-commerce wdraża Pay by Bank w kilka minut.',
					description:
						'Podłącz nasz checkout SDK lub REST API do swojego sklepu, CRM lub aplikacji.'
				}
			],
			solutionModals: [
				{
					id: 'horeca',
					indexLabel: '01',
					tag: 'HoReCa & Restauracje',
					badge: 'Nowoczesna alternatywa dla terminali i systemów mono',
					heroTitle: 'Płatność przy stoliku w 3 sekundy. Bez uzależnienia od jednego banku.',
					heroSubtitle:
						'Kompletna architektura płatności restauracyjnych oparta na Open Banking A2A. Goście skanują dynamiczny kod QR na rachunku, wybierają swoją ulubioną aplikację bankową i zatwierdzają płatność FaceID. Środki i napiwki trafiają natychmiast na Twój rachunek IBAN w dowolnym banku.',
					heroHighlight:
						'0% prowizji interchange · Zamknięcie rachunku w Poster/Syrve w czasie rzeczywistym · Podział rachunku i napiwki na IBAN',
					metrics: [
						{
							value: '0%',
							label: 'Prowizja interchange kart',
							sub: 'Zamiast 1.3–2% w tradycyjnym acquiringu'
						},
						{
							value: '0.3s',
							label: 'Czas uruchomienia App Clip',
							sub: 'Bez instalacji zbędnych aplikacji'
						},
						{
							value: '100%',
							label: 'Wsparcie banków',
							sub: 'monobank, Privat24, Sense, A-Bank, PUMB i inne'
						},
						{
							value: '24/7',
							label: 'Wypłata prosto na IBAN',
							sub: 'Środki dostępne od razu, także w weekendy'
						}
					],
					highlights: [
						{
							title: 'Inteligentny kod QR przy stoliku',
							desc: 'Gość skanuje kod aparatem. Widzi podsumowanie zamówienia z systemu POS bez czekania na kelnera z terminalem.',
							icon: 'QrCode',
							tag: 'Native App Clip'
						},
						{
							title: 'Podział rachunku (Split Bill)',
							desc: 'Grupa gości może podzielić rachunek po równo lub zapłacić za poszczególne pozycje bez zamieszania przy kasie.',
							icon: 'Split',
							tag: 'Smart Checkout'
						},
						{
							title: 'Bezpośrednie napiwki kelnerskie',
							desc: 'Gość wybiera procent napiwku, który trafia bezpośrednio na konto kelnera bez mieszania z przychodem lokalu.',
							icon: 'ReceiptText',
							tag: 'Tips on IBAN'
						},
						{
							title: 'Dwukierunkowa integracja z POS',
							desc: 'Integracja z Poster, Syrve (iiko), R-Keeper, Checkbox i Vchasno. Automatyczna fiskalizacja i zamknięcie stolika w 1 sekundę.',
							icon: 'Server',
							tag: 'Auto-PRRO'
						}
					],
					comparison: {
						title: 'Dlaczego Rahunok przewyższa Expirenza i mono QR',
						desc: 'Porównaj ograniczenia klasycznego acquiringu z otwartą infrastrukturą Rahunok.',
						headers: ['Kryterium', 'Monobank (Expirenza / QR)', 'Rahunok A2A HoReCa'],
						rows: [
							{
								feature: 'Konto bankowe firmy',
								competitor: 'Wymagane konto firmowe wyłącznie w monobank',
								rahunok: 'Konto w DOWOLNYM banku',
								isAdvantage: true
							},
							{
								feature: 'Prowizja transakcyjna',
								competitor: '1.3% – 1.5% od każdego rachunku',
								rahunok: '0% prowizji kartowej / stały przejrzysty model',
								isAdvantage: true
							},
							{
								feature: 'Czas księgowania środków',
								competitor: 'Kolejny dzień roboczy',
								rahunok: 'Natychmiast na IBAN (24/7/365)',
								isAdvantage: true
							},
							{
								feature: 'Klienci innych banków',
								competitor: 'Muszą ręcznie wpisywać 16 cyfr karty i kod CVV',
								rahunok: 'Natywna płatność jednym dotknięciem w ich banku',
								isAdvantage: true
							},
							{
								feature: 'Napiwki dla obsługi',
								competitor: 'Wypłacane łącznie z utargiem lokalu',
								rahunok: 'Bezpośredni transfer A2A na konto kelnera',
								isAdvantage: true
							},
							{
								feature: 'Dzierżawa terminali',
								competitor: 'Fizyczny terminal lub Tap to Phone tylko na Android',
								rahunok: '0 zł kosztów sprzętowych (iOS + Android)',
								isAdvantage: true
							}
						]
					},
					workflow: {
						title: 'Jak to działa w Twojej restauracji',
						steps: [
							{
								step: '1',
								title: 'Kelner otwiera stolik',
								desc: 'Zamówienie trafia do systemu POS (Poster, Syrve itp.) z aktualną kwotą.'
							},
							{
								step: '2',
								title: 'Gość skanuje kod QR',
								desc: 'Gość kieruje aparat na stand stolika lub paragon i widzi zamówienie w App Clip.'
							},
							{
								step: '3',
								title: 'Błyskawiczne rozliczenie',
								desc: 'Gość potwierdza płatność FaceID w aplikacji banku. System POS automatycznie zamyka rachunek.'
							}
						]
					},
					cta: {
						title: 'Podłącz swoją restaurację do Rahunok',
						desc: 'Wdrożenie pilotażowe w 1 dzień bez przestojów w pracy lokalu. Bezpłatne testy.',
						btn: 'Uruchom HoReCa Pilot'
					}
				},
				{
					id: 'retail',
					indexLabel: '02',
					tag: 'Retail & Sklepy',
					badge: 'Smartfon jako kasa zamiast terminali mono i bankowych',
					heroTitle: 'Pełnoprawna kasa w każdym smartfonie. 0 zł za terminal.',
					heroSubtitle:
						'Przyjmuj płatności bezgotówkowe bez fizycznych terminali i bez ograniczeń Tap to Phone (które nie działają na iPhone). Kasjer generuje kod QR na telefonie lub ekranie kasy. Klient płaci w aplikacji bankowej w mniej niż 3 sekundy.',
					heroHighlight:
						'Działa identycznie na iOS i Android · Zero ryzyka skimmingu · Wbudowane e-paragony',
					metrics: [
						{
							value: '0 zł',
							label: 'Koszt dzierżawy terminala',
							sub: 'Oszczędzaj 400–600 ₴/mies. na każdym punkcie'
						},
						{
							value: '100%',
							label: 'Kompatybilność ze smartfonami',
							sub: 'Działa na każdym iPhone i Android'
						},
						{
							value: '1.2s',
							label: 'Czas autoryzacji płatności',
							sub: 'Natychmiastowe potwierdzenie bez opóźnień'
						},
						{
							value: '100%',
							label: 'Automatyczna fiskalizacja',
							sub: 'Integracja z e-kasami i paragonami online'
						}
					],
					highlights: [
						{
							title: 'Kasa w dowolnym smartfonie',
							desc: 'Bez skomplikowanych aplikacji bankowych i bez konieczności kupowania Androida z NFC. Działa na iPhone pracowników.',
							icon: 'SmartphoneNfc',
							tag: 'iOS & Android'
						},
						{
							title: 'Dynamiczne i statyczne standy QR',
							desc: 'Wydrukuj firmowy stand QR lub wyświetlaj dynamiczny kod QR z dokładną kwotą na ekranie tabletu kasowego.',
							icon: 'QrCode',
							tag: 'Strefa kasy'
						},
						{
							title: 'Weryfikacja antyfraudowa w czasie rzeczywistym',
							desc: 'Serwer weryfikuje wpływ środków na IBAN zanim towar zostanie wydany. Błyskawiczny status wizualny SUCCESS.',
							icon: 'ShieldCheck',
							tag: 'Real-time Verify'
						},
						{
							title: 'Synchronizacja z systemami ERP i magazynem',
							desc: 'Gotowe integracje z 1C, BAS, Torgsoft oraz systemami chmurowymi do automatycznego zdejmowania stanów.',
							icon: 'Layers',
							tag: 'ERP Sync'
						}
					],
					comparison: {
						title: 'Porównanie z Terminalem w smartfonie mono',
						desc: 'Dlaczego Rahunok jest wygodniejszym i tańszym rozwiązaniem dla handlu detalicznego.',
						headers: ['Parametr', 'mono Terminal w smartfonie', 'Rahunok Retail A2A'],
						rows: [
							{
								feature: 'Wsparcie dla iPhone (iOS)',
								competitor: 'Brak (Tap to Phone wymaga Androida z NFC)',
								rahunok: 'Pełne wsparcie dla iPhone i Android (App Clip / QR)',
								isAdvantage: true
							},
							{
								feature: 'Prowizja od każdej sprzedaży',
								competitor: '1.3% prowizji acquiringowej',
								rahunok: '0% opłat interchange, bezpośredni przelew A2A',
								isAdvantage: true
							},
							{
								feature: 'Obsługa kart innych banków',
								competitor: 'Wymaga fizycznego przyłożenia karty klienta',
								rahunok: 'Klient skanuje kod QR i płaci w swojej aplikacji banku',
								isAdvantage: true
							},
							{
								feature: 'Wyłączność bankowa',
								competitor: 'Tylko konto firmowe w monobank',
								rahunok: 'Dowolny bank (Privat, Oschad, PUMB, mono itd.)',
								isAdvantage: true
							},
							{
								feature: 'Fiskalizacja e-paragonów',
								competitor: 'Wymaga dodatkowych zewnętrznych modułów',
								rahunok: 'Automatyczne wystawienie paragonu od razu po płatności',
								isAdvantage: true
							}
						]
					},
					workflow: {
						title: 'Prosty proces sprzedaży przy kasie',
						steps: [
							{
								step: '1',
								title: 'Wprowadzenie kwoty',
								desc: 'Sprzedawca wpisuje kwotę lub skanuje kody kreskowe na tablecie/smartfonie.'
							},
							{
								step: '2',
								title: 'Prezentacja kodu QR',
								desc: 'Klient skanuje wygenerowany kod QR z ekranu lub standu na ladzie.'
							},
							{
								step: '3',
								title: 'Paragon i wydanie towaru',
								desc: 'Płatność potwierdzona natychmiast. Na kasie pojawia się zielony ekran, a klient otrzymuje e-paragon.'
							}
						]
					},
					cta: {
						title: 'Wyposaż swoje sklepy w nowoczesną kasę',
						desc: 'Zacznij przyjmować płatności A2A bez terminali już dziś. Podłączenie zajmuje do 24 godzin.',
						btn: 'Podłącz Retail'
					}
				},
				{
					id: 'services',
					indexLabel: '03',
					tag: 'Digital & Usługi',
					badge: 'Inteligentne linki płatnicze lepsze niż mono payment-link',
					heroTitle: 'Linki do płatności z konwersją wyższą o +35%. Bez porzuconych koszyków.',
					heroSubtitle:
						'Generuj inteligentne linki PayLinks do wysyłki na Instagramie, Telegramie, WhatsAppie lub przez SMS. Link automatycznie otwiera aplikację bankową klienta z uzupełnionymi danymi przelewu. Koniec z uciążliwym wpisywaniem numerów kart — płatność w 1 kliknięcie FaceID.',
					heroHighlight:
						'Generowanie z poziomu CRM · Błyskawiczne tworzenie listów przewozowych · Płatności przy odbiorze dla kurierów',
					metrics: [
						{
							value: '+35%',
							label: 'Wzrost konwersji płatności',
							sub: 'Dzięki rezygnacji z formularzy kart płatniczych'
						},
						{
							value: '1 klik',
							label: 'Autoryzacja FaceID/TouchID',
							sub: 'W zaufanej aplikacji bankowej klienta'
						},
						{
							value: '0 sek',
							label: 'Automatyczna zmiana statusu w CRM',
							sub: 'Natychmiastowe powiadomienie Webhook'
						},
						{
							value: '100%',
							label: 'Bezpieczeństwo transakcji',
							sub: 'Zgodność ze standardami NBU Open Banking'
						}
					],
					highlights: [
						{
							title: 'Inteligentne linki w komunikatorach',
							desc: 'Twórz jednorazowe lub wielorazowe linki na stałą lub dowolną kwotę. Jedno kliknięcie przenosi klienta prosto do jego banku.',
							icon: 'Link',
							tag: '1-Click Checkout'
						},
						{
							title: 'Pełna automatyzacja z CRM',
							desc: 'KeyCRM, SalesDrive, KeepinCRM, Creatio. Wystawiaj rachunki bezpośrednio z karty klienta z automatyczną zmianą statusu na "Opłacone".',
							icon: 'Bot',
							tag: 'CRM Integration'
						},
						{
							title: 'Płatność przy doręczeniu dla kurierów',
							desc: 'Kurier pokazuje dynamiczny kod QR na telefonie podczas wydawania paczki. Bezgotówkowo, bez wydawania reszty.',
							icon: 'Send',
							tag: 'Dostawa kurierska'
						},
						{
							title: 'Płatności cykliczne i subskrypcje',
							desc: 'Automatyczne płatności okresowe za usługi, kursy, dostęp do platform z bezpośrednim potwierdzeniem bankowym.',
							icon: 'ReceiptText',
							tag: 'Subskrypcje'
						}
					],
					comparison: {
						title: 'Dlaczego Smart PayLinks od Rahunok przewyższają mono payment-link',
						desc: 'Porównanie linków płatniczych dla sklepów na Instagramie, freelancerów i firm usługowych.',
						headers: ['Możliwość', 'mono payment-link / mini-site', 'Rahunok Smart PayLinks'],
						rows: [
							{
								feature: 'Klienci bez aplikacji mono',
								competitor: 'Muszą ręcznie wpisywać numer karty, datę i CVV',
								rahunok: 'Otwiera ich własną aplikację bankową (Privat24, Sense itd.)',
								isAdvantage: true
							},
							{
								feature: 'Prowizja od sprzedaży',
								competitor: '1.3% od kwoty transakcji',
								rahunok: '0% prowizji kartowej, bezpośredni przelew A2A',
								isAdvantage: true
							},
							{
								feature: 'Wypłata utargu',
								competitor: 'Tylko na konto firmowe w monobank',
								rahunok: 'Bezpośredni przelew na Twój IBAN w dowolnym banku',
								isAdvantage: true
							},
							{
								feature: 'Integracja z CRM i logistyką',
								competitor: 'Ograniczona, wymaga dodatkowych wtyczek',
								rahunok: 'Gotowe integracje z KeyCRM, SalesDrive i firmami kurierskimi',
								isAdvantage: true
							},
							{
								feature: 'Aplikacja dla kurierów',
								competitor: 'Brak dedykowanego szybkiego trybu QR dla kierowców',
								rahunok: 'Wbudowany interfejs kurierski do płatności w terenie',
								isAdvantage: true
							}
						]
					},
					workflow: {
						title: 'Jak sprzedawać w mediach społecznościowych',
						steps: [
							{
								step: '1',
								title: 'Wygenerowanie linku',
								desc: 'Stwórz link w panelu, CRM lub przez bota na Telegramie w 5 sekund.'
							},
							{
								step: '2',
								title: 'Wysyłka do klienta',
								desc: 'Prześlij link na czacie. Klient klika i wybiera swój bank.'
							},
							{
								step: '3',
								title: 'Księgowanie wpłaty',
								desc: 'Środki natychmiast na Twoim koncie, status zamówienia zaktualizowany.'
							}
						]
					},
					cta: {
						title: 'Zwiększ sprzedaż we wszystkich kanałach',
						desc: 'Wdróż inteligentne linki płatnicze w komunikatorach i na stronach www w kilka minut.',
						btn: 'Stwórz pierwszy PayLink'
					}
				},
				{
					id: 'api',
					indexLabel: '04',
					tag: 'API & Enterprise',
					badge: 'Wysokowydajna bramka Open Banking zamiast klasycznego acquiringu',
					heroTitle: 'Wydajna bramka A2A dla platform, marketplace’ów i dużego biznesu.',
					heroSubtitle:
						'Bezpośrednia integracja infrastruktury Open Banking z aplikacjami mobilnymi, platformami e-commerce i systemami ERP. Przepustowość do 50 000 TPS, kryptograficznie podpisane webhooki, automatyczne rozliczenia split dla marketplace’ów i centralny panel dla wielu podmiotów.',
					heroHighlight:
						'Opóźnienie < 120ms · White-label SDK dla iOS i Android · Płatności split na wiele rachunków IBAN',
					metrics: [
						{
							value: '50 000',
							label: 'Transakcji na sekundę (TPS)',
							sub: 'Rozproszona infrastruktura wysokiej dostępności'
						},
						{
							value: '< 120ms',
							label: 'Czas doręczenia Webhooka',
							sub: 'Błyskawiczne powiadomienie Twojego backendu'
						},
						{
							value: '99.99%',
							label: 'Gwarantowane SLA dostępności',
							sub: 'Nadmiarowość w wielu centrach danych'
						},
						{
							value: 'Multi-IBAN',
							label: 'Silnik rozliczeń Split',
							sub: 'Automatyczny podział środków między sprzedawców'
						}
					],
					highlights: [
						{
							title: 'RESTful API & Real-Time Webhooks',
							desc: 'Przejrzysty standard OpenAPI 3.0. Podpisane kryptograficznie zdarzenia z automatycznymi ponowieniami i kompletną dokumentacją.',
							icon: 'Webhook',
							tag: 'OpenAPI 3.0'
						},
						{
							title: 'White-Label SDK dla iOS i Android',
							desc: 'Wbuduj natywny proces płatności bezpośrednio w swoją aplikację mobilną bez przekierowań do przeglądarek.',
							icon: 'Smartphone',
							tag: 'Mobile SDK'
						},
						{
							title: 'Rozliczenia Split dla Marketplace’ów',
							desc: 'Jedna płatność klienta jest automatycznie dzielona i przelewana bezpośrednio na rachunki poszczególnych sprzedawców.',
							icon: 'Split',
							tag: 'Marketplace Engine'
						},
						{
							title: 'Multi-Entity & Panel Korporacyjny',
							desc: 'Zarządzaj dziesiątkami spółek i jednoosobowych działalności w jednym panelu z uprawnieniami RBAC i eksportem do SAP / 1C.',
							icon: 'Building2',
							tag: 'Enterprise Suite'
						}
					],
					comparison: {
						title: 'Dlaczego platformy wybierają Rahunok Enterprise API',
						desc: 'Porównanie klasycznych API acquiringowych z otwartą bramką Rahunok A2A.',
						headers: ['Cecha', 'API plata by mono (Acquiring kart)', 'Rahunok Enterprise A2A API'],
						rows: [
							{
								feature: 'Podstawa technologiczna',
								competitor: 'Acquiring kart płatniczych (Visa / Mastercard)',
								rahunok: 'Bezpośredni protokół Open Banking / SEP-4',
								isAdvantage: true
							},
							{
								feature: 'Płatności split na marketplace',
								competitor: 'Skomplikowane lub ograniczone rozliczenia ręczne',
								rahunok: 'Natychmiastowy automatyczny split na nielimitowaną liczbę IBAN',
								isAdvantage: true
							},
							{
								feature: 'White-Label in-app checkout',
								competitor: 'Przekierowanie na stronę płatności mono',
								rahunok: 'W pełni natywny interfejs UI w Twojej aplikacji',
								isAdvantage: true
							},
							{
								feature: 'Limity kwotowe transakcji',
								competitor: 'Ograniczone limitami płatności internetowych na kartach',
								rahunok: 'Bezpośrednie wysokie limity przelewów B2B i B2C',
								isAdvantage: true
							},
							{
								feature: 'Dedykowane SLA i wsparcie',
								competitor: 'Standardowe warunki regulaminowe',
								rahunok: 'SLA 99.99%, dedykowane instancje, wsparcie architekta 24/7',
								isAdvantage: true
							}
						]
					},
					workflow: {
						title: 'Szybka integracja w 3 krokach',
						steps: [
							{
								step: '1',
								title: 'Pobranie kluczy API',
								desc: 'Zarejestruj się w portalu dewelopera i wygeneruj klucze testowe w Sandbox.'
							},
							{
								step: '2',
								title: 'Wdrożenie SDK',
								desc: 'Skorzystaj z bibliotek dla Node.js, Python, PHP, Go lub bezpośredniego REST API.'
							},
							{
								step: '3',
								title: 'Start na produkcji',
								desc: 'Przejdź weryfikację i zacznij przyjmować bezpośrednie płatności bez pośredników.'
							}
						]
					},
					cta: {
						title: 'Porozmawiaj o architekturze Enterprise',
						desc: 'Nasi architekci płatności pomogą zaprojektować dedykowane rozwiązanie dla Twojej platformy.',
						btn: 'Umów konsultację techniczną'
					}
				}
			],
			featuresEyebrow: 'Ekosystem możliwości',
			featuresTitle: 'Wszystko, czego potrzebujesz do przyjmowania płatności',
			featuresDesc: 'Kompleksowy zestaw narzędzi od mobilnej kasy po otwarte API programistyczne.',
			features: [
				{
					label: 'QR',
					title: 'Rachunki dynamiczne',
					description: 'Kwota, zamówienie, stolik i tytuł w jednym kodzie QR.'
				},
				{
					label: 'NFC',
					title: 'Płatność zbliżeniowa',
					description: 'Natychmiastowe otwarcie płatności przez tag NFC.'
				},
				{
					label: 'LINK',
					title: 'Linki płatnicze',
					description: 'Wysyłaj rachunki przez Telegram, SMS lub e-mail.'
				},
				{
					label: 'STATUS',
					title: 'Weryfikacja serwera',
					description: 'Zamknięcie rachunku wyłącznie po potwierdzeniu z banku.'
				},
				{
					label: 'FISKAL',
					title: 'Elektroniczne paragony',
					description: 'Automatyczne raportowanie fiskalne po udanej płatności.'
				},
				{
					label: 'DATA',
					title: 'Analityka',
					description: 'Raporty sprzedaży, utargu i średniego paragonu w czasie rzeczywistym.'
				},
				{
					label: 'BOT',
					title: 'Bot Telegram',
					description: 'Twórz rachunki i otrzymuj powiadomienia na czacie.'
				},
				{
					label: 'API',
					title: 'Integracje',
					description: 'REST API i Webhooki do szybkiej integracji z Twoim systemem.'
				}
			]
		},
		trustAndPricing: {
			securityEyebrow: 'Bezpieczeństwo i środki',
			securityTitle: 'Pieniądze trafiają prosto do Ciebie. Bez pośredników.',
			securityDesc:
				'Rahunok nie przetrzymuje środków na kontach tranzytowych. Płatność przechodzi bezpośrednio z banku klienta na Twój oficjalny numer IBAN.',
			securityAssurances: [
				'Bezpośredni przelew A2A / SEPA na IBAN',
				'Autoryzacja wyłącznie we własnej aplikacji bankowej',
				'Certyfikowany standard NBU 003'
			],
			securityPipelineHeader: {
				label: 'Bezpośredni przelew A2A',
				title: 'Architektura Zero-Custody'
			},
			securityPipeline: [
				{
					label: 'Nadawca',
					title: 'KLIENT',
					desc: 'Potwierdza płatność w swojej aplikacji bankowej'
				},
				{ label: 'Autoryzacja', title: 'JEGO BANK', desc: 'Sprawdza saldo i realizuje przelew' },
				{
					label: 'Odbiorca',
					title: 'TWÓJ RACHUNEK',
					desc: 'Otrzymuje środki na oficjalne konto IBAN'
				}
			],
			trustItems: [
				{
					title: 'Bez osobnego terminala',
					description:
						'Do przyjmowania płatności wystarczy smartfon lub wydrukowany kod QR. Bez kosztów dzierżawy sprzętu.'
				},
				{
					title: 'Status potwierdza serwer',
					description:
						'Powrót z aplikacji bankowej nie zamyka rachunku. Weryfikacja następuje kryptograficznie na backendzie.'
				},
				{
					title: 'Każda płatność na swoim miejscu',
					description:
						'Kwota, zamówienie, klient i potwierdzony status zebrane w jednym przejrzystym panelu.'
				},
				{
					title: 'Automatyczna fiskalizacja',
					description:
						'Rejestracja paragonu następuje automatycznie po otrzymaniu potwierdzenia transakcji.'
				}
			],
			proofEyebrow: 'Pełna kontrola',
			proofTitle: 'Niezawodność standardu bankowego',
			proofDesc: 'Zbudowane zgodnie ze standardami regulacyjnymi i wymogami bezpieczeństwa.',
			proofItems: [
				{
					label: '01',
					title: 'Środowisko Sandbox',
					description:
						'Przetestuj fakturowanie, płatność, webhooki i paragony przed wdrożeniem produkcyjnym.'
				},
				{
					label: '02',
					title: 'Uzgadnianie płatności',
					description: 'Każda transakcja jest powiązana z numerem zamówienia, kwotą i statusem.'
				},
				{
					label: '03',
					title: 'Przejrzyste warunki',
					description: 'Dostępne banki i warunki prowizyjne ustalamy z góry bez ukrytych opłat.'
				},
				{
					label: '04',
					title: 'Wsparcie wdrożeniowe',
					description: 'Nasz zespół inżynierów pomaga przeprowadzić pierwszą transakcję testową.'
				}
			],
			pricingEyebrow: 'Przejrzysty cennik',
			pricingTitle: 'Proste i uczciwe plany abonamentowe',
			pricingDesc: 'Wybierz plan dopasowany do skali i tempa rozwoju Twojej firmy.',
			pricingPlans: [
				{
					name: 'Start',
					price: 'Za darmo',
					description: 'Do przetestowania i uruchomienia pierwszej kasy.',
					features: [
						'1 profil firmowy',
						'Podstawowe kody QR',
						'Linki płatnicze',
						'Historia transakcji'
					],
					cta: 'Rozpocznij za darmo',
					note: 'Prowizje i dostępność metod ustalane podczas wdrożenia.'
				},
				{
					name: 'Business',
					price: 'od 59 zł/mies.',
					description: 'Dla aktywnego sklepu, kawiarni lub restauracji.',
					features: [
						'Wiele kas i użytkowników',
						'Kody QR, NFC i linki',
						'Weryfikacja w czasie rzeczywistym',
						'Analityka i wsparcie priorytetowe',
						'Automatyczna fiskalizacja'
					],
					cta: 'Wybierz Business',
					note: 'Niska prowizja transakcyjna dopasowana do obrotu.',
					popular: true
				},
				{
					name: 'Platform',
					price: 'Indywidualnie',
					description: 'Dla sieci handlowych, franczyz i platform.',
					features: [
						'Wiele punktów i podmiotów prawnych',
						'Pełne API i Webhooks',
						'Własny branding (White-label)',
						'Dedykowany opiekun konta'
					],
					cta: 'Omów pilotaż',
					note: 'Cena dostosowana do wolumenu transakcji i wymagań SLA.'
				}
			],
			faqEyebrow: 'Baza wiedzy',
			faqTitle: 'Często zadawane pytania',
			faqDesc: 'Wszystko, co musisz wiedzieć o przyjmowaniu płatności z Rahunok.',
			faqItems: [
				{
					question: 'Czy potrzebuję fizycznego terminala POS?',
					answer:
						'Nie, przyjmowanie płatności przez QR, NFC lub linki z Rahunok nie wymaga terminala. Przyjmujesz płatności natychmiastowe bezpośrednio ze swojego smartfona, bez wynajmowania dodatkowego sprzętu.'
				},
				{
					question: 'Gdzie trafiają pieniądze?',
					answer:
						'W modelu A2A (account-to-account) środki są przesyłane bezpośrednio. To bezpośrednia płatność na firmowy IBAN. Bez pośredników i opóźnień.'
				},
				{
					question: 'Czy potrzebuję konta firmowego?',
					answer:
						'Tak, przyjmowanie płatności PayByBank wymaga danych zarejestrowanego podmiotu gospodarczego oraz kompatybilnego konta firmowego.'
				},
				{
					question: 'Jakie banki są obsługiwane?',
					answer:
						'Lista zależy od aktywnych integracji partnerskich. Pracujemy nad tym, aby natychmiastowe płatności były dostępne dla klientów większości popularnych banków.'
				},
				{
					question: 'Jak działa QR?',
					answer:
						'Płatność QR dla biznesu jest prosta: klient skanuje kod, co otwiera bezpieczny ekran z kwotą, nazwą sprzedawcy i tytułem dla wygodnej autoryzacji Pay by Bank.'
				},
				{
					question: 'Co się stanie, jeśli klient nie dokończy płatności?',
					answer:
						'Rachunek w systemie Rahunok pozostanie w oczekiwaniu, zostanie anulowany lub otrzyma status błędu. Zawsze masz kontrolę nad statusem każdej płatności.'
				},
				{
					question: 'Jak Rahunok potwierdza udaną płatność?',
					answer:
						'Dla pewności status każdej natychmiastowej płatności jest weryfikowany przez nasz serwer poprzez API, webhook lub mechanizm uzgodnień. Gwarantuje to udaną bezpośrednią płatność na Twój IBAN.'
				},
				{
					question: 'Jak działa kasa fiskalna (PRRO)?',
					answer:
						'Natychmiast po udanym potwierdzeniu płatności A2A, dane są automatycznie przesyłane do skonfigurowanej usługi fiskalnej w celu wystawienia paragonu.'
				},
				{
					question: 'Czy klient musi instalować aplikację?',
					answer:
						'Niekoniecznie: płatności PayByBank zazwyczaj korzystają ze standardowej aplikacji bankowej klienta, bramki webowej lub mobilnej przeglądarki bez dodatkowych aplikacji.'
				},
				{
					question: 'Czy to działa na iPhonie i Androidzie?',
					answer:
						'Tak, nasze płatności QR bez terminala i scenariusze NFC działają doskonale na obu platformach, zapewniając płynne doświadczenie klienta.'
				},
				{
					question: 'Jaka jest prowizja?',
					answer:
						'Prowizja za płatności A2A jest zazwyczaj znacznie niższa niż w klasycznym acquiringu i zależy od planu Rahunok, banku, metody płatności oraz umowy.'
				},
				{
					question: 'Jak się podłączyć?',
					answer:
						'Zostaw swoje dane na stronie Rahunok, podaj typ biznesu, a my pomożemy skonfigurować Twoją kasę do przyjmowania płatności bez terminala i przeprowadzić pierwszy test.'
				}
			],
			ctaEyebrow: 'Następny krok dla Twojej firmy',
			ctaTitle: 'Gotowy zrezygnować z terminali i obniżyć koszty prowizji?',
			ctaDesc:
				'Uruchom pilotaż w 1 dzień i zacznij przyjmować bezpośrednie płatności A2A już dziś.',
			ctaBtn: 'Dołącz do Rahunok'
		},
		footer: {
			description: 'Nowoczesna infrastruktura płatności A2A dla biznesu.',
			navTitle: 'Nawigacja',
			legalTitle: 'Informacje prawne',
			rights: 'Wszelkie prawa zastrzeżone.',
			terms: 'Regulamin',
			privacy: 'Polityka prywatności',
			security: 'Bezpieczeństwo'
		},
		modal: {
			badge: 'Szybki start',
			title: 'Uruchom pilotaż Rahunok',
			desc: 'Zostaw swoje dane kontaktowe, a nasz doradca skontaktuje się z Tobą w celu konfiguracji konta testowego.',
			nameLabel: 'Imię i nazwisko',
			phoneLabel: 'Numer telefonu',
			businessLabel: 'Nazwa firmy lub lokalu',
			submitBtn: 'Wyślij zgłoszenie',
			successTitle: 'Formularz demonstracyjny wypełniony',
			successDesc: 'Skontaktujemy się z Tobą wkrótce, aby uruchomić środowisko testowe.',
			demoNotice:
				'To formularz demonstracyjny bez żądania sieciowego. Dane kontaktowe nie są nigdzie wysyłane.',
			closeBtn: 'Zamknij'
		}
	}
};
