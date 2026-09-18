import type { CheckoutScenarioConfig } from './checkout-scenario-config';

/**
 * Default checkout configuration per scenario type.
 *
 * When a merchant selects a scenario in the Dashboard constructor,
 * these defaults are applied automatically. The merchant can then
 * toggle individual flags on/off before creating the invoice.
 *
 * When apps/pay reads an order without certain config keys,
 * it falls back to these defaults based on `order.type`.
 */

const BASE_DEFAULTS: CheckoutScenarioConfig = {
	allow_loyalty: true,
	allow_promo: true,
	allow_roundup: true,
	allow_tips: false,
	allow_split: false,
	allow_bnpl: true,
	allow_upsell: true,
	allow_delivery: false,
	allow_compliance_card: false,
	allow_nps_review: true,
	show_other_banks: true,
	promo_discount: 4.0,
	cta_text: 'Перейти до оплати',
	theme: 'dark'
};

const SCENARIO_OVERRIDES: Record<string, Partial<CheckoutScenarioConfig>> = {
	fixed: {
		// Fixed invoice — full e-commerce checkout
	},

	open_amount: {
		allow_loyalty: false,
		allow_promo: false,
		allow_roundup: false,
		allow_bnpl: false,
		allow_upsell: false,
		allow_compliance_card: false,
		quick_amounts: [50, 100, 200, 500],
		cta_text: 'Перейти до оплати'
	},

	table: {
		allow_tips: true,
		allow_split: true,
		allow_bnpl: false,
		allow_compliance_card: true,
		tip_presets: [5, 10, 15, 20],
		cta_text: 'Перейти до оплати'
	},

	delivery: {
		allow_loyalty: false,
		allow_delivery: true,
		allow_bnpl: true,
		allow_upsell: false,
		allow_compliance_card: false,
		cta_text: 'Підтвердити замовлення'
	},

	tips: {
		allow_loyalty: false,
		allow_promo: false,
		allow_roundup: false,
		allow_bnpl: false,
		allow_upsell: false,
		allow_split: false,
		allow_delivery: false,
		allow_compliance_card: false,
		tip_presets: [20, 50, 100, 200],
		cta_text: 'Подякувати'
	},

	fuel_station: {
		allow_loyalty: false,
		allow_promo: true,
		allow_roundup: false,
		allow_tips: false,
		allow_split: false,
		allow_bnpl: false,
		allow_upsell: false,
		allow_delivery: false,
		allow_compliance_card: false,
		checkout_flow: {
			id: 'fuel_station',
			version: 1,
			invoice_type: 'open_amount'
		},
		flow_data: {
			policy: {
				allowed_input_modes: ['liters', 'amount'],
				default_input_mode: 'liters',
				require_connected_nozzle: true,
				price_change_policy: 'lock_quote',
				quote_ttl_seconds: 60
			}
		},
		cta_text: 'Перейти до оплати'
	},

	donation: {
		allow_loyalty: false,
		allow_promo: false,
		allow_roundup: false,
		allow_bnpl: false,
		allow_upsell: false,
		allow_split: false,
		allow_tips: false,
		allow_delivery: false,
		allow_compliance_card: false,
		quick_amounts: [100, 200, 500, 1000],
		cta_text: 'Задонатити'
	},

	recurring: {
		allow_loyalty: false,
		allow_promo: false,
		allow_roundup: false,
		allow_bnpl: false,
		allow_upsell: false,
		allow_split: false,
		allow_tips: false,
		allow_delivery: false,
		allow_compliance_card: false,
		cta_text: 'Підписатися'
	},

	rtp: {
		allow_loyalty: false,
		allow_promo: false,
		allow_roundup: false,
		allow_bnpl: false,
		allow_upsell: false,
		allow_split: false,
		allow_tips: false,
		allow_delivery: false,
		allow_compliance_card: false,
		cta_text: 'Оплатити запит'
	},

	// --- ⚙️ ENGINES ---
	engine_buy: {
		checkout_flow: { id: 'engine_buy', version: 1, invoice_type: 'fixed' },
		allow_loyalty: true,
		allow_promo: true,
		allow_delivery: true,
		allow_upsell: true,
		cta_text: 'Оплатити замовлення'
	},
	engine_order: {
		checkout_flow: { id: 'engine_order', version: 1, invoice_type: 'fixed' },
		allow_loyalty: true,
		allow_promo: true,
		allow_delivery: true,
		allow_upsell: true,
		cta_text: 'Замовити та оплатити'
	},
	engine_book: {
		checkout_flow: { id: 'engine_book', version: 1, invoice_type: 'fixed' },
		allow_loyalty: true,
		allow_promo: true,
		allow_delivery: false,
		allow_upsell: true,
		allow_split: false,
		cta_text: 'Забронювати (передоплата)'
	},
	engine_quote: {
		checkout_flow: { id: 'engine_quote', version: 1, invoice_type: 'fixed' },
		allow_loyalty: false,
		allow_promo: true,
		allow_delivery: false,
		cta_text: 'Оплатити рахунок'
	},
	engine_deliver: {
		checkout_flow: { id: 'engine_deliver', version: 1, invoice_type: 'delivery' },
		allow_loyalty: false,
		allow_promo: true,
		allow_delivery: true,
		allow_upsell: false,
		cta_text: 'Оплатити доставку'
	},
	engine_split: {
		checkout_flow: { id: 'engine_split', version: 1, invoice_type: 'table' },
		allow_split: true,
		allow_tips: true,
		allow_loyalty: true,
		cta_text: 'Сплатити свою частку'
	},

	// --- 🚀 VERTICALS ---
	vertical_food: {
		checkout_flow: { id: 'vertical_food', version: 1, invoice_type: 'delivery' },
		allow_loyalty: true,
		allow_promo: true,
		allow_delivery: true,
		allow_tips: true,
		allow_upsell: true,
		cta_text: 'Оплатити замовлення'
	},
	vertical_flowers: {
		checkout_flow: { id: 'vertical_flowers', version: 1, invoice_type: 'fixed' },
		allow_loyalty: true,
		allow_promo: true,
		allow_delivery: true,
		allow_tips: true,
		allow_upsell: true,
		cta_text: 'Замовити букет',
		flow_data: {
			shopName: 'Floris Квіти',
			tagline: 'Авторська флористика та свіжі букети',
			description: 'Свіжі квіти з швидкою доставкою по місту або самовивозом за 30 хвилин',
			contacts: {
				phone: '+380 67 444 55 66',
				instagram: '@floris.kyiv',
				telegram: '@floris_kyiv_bot',
				address: 'вул. Саксаганського, 42'
			},
			modes: {
				catalogEnabled: true,
				customOrderEnabled: true,
				inStorePayEnabled: true,
				catalogButtonText: 'Обрати готовий букет',
				customOrderButtonText: 'Індивідуальний букет',
				inStoreButtonText: 'Оплатити в магазині'
			},
			bouquets: [
				{
					id: 'bq_tenderness',
					name: 'Ніжність',
					category: 'Авторські',
					description: 'Французькі півонії, біла еустома, евкаліпт та ніжна маттіола',
					icon: '🌸',
					isAvailable: true,
					sizes: [
						{ id: 'standard', name: 'Стандартний', price: 900, isDefault: true },
						{ id: 'large', name: 'Великий (Пишний)', price: 1300 },
						{ id: 'vip', name: 'VIP Преміум', price: 1900 }
					]
				},
				{
					id: 'bq_roses_25',
					name: '25 червоних троянд Grand Prix',
					category: 'Монобукети',
					description: 'Класичні еквадорські оксамитові троянди 60 см у фірмовому крафті',
					icon: '🌹',
					isAvailable: true,
					sizes: [
						{ id: 'standard', name: 'Стандартний (60 см)', price: 1250, isDefault: true },
						{ id: 'large', name: 'Преміум (70 см)', price: 1850 }
					]
				},
				{
					id: 'bq_mix_box',
					name: 'Сезонний мікс у капелюшній коробці',
					category: 'Композиції',
					description: 'Гортензія, півонієподібні троянди, оксіпеталум та евкаліпт',
					icon: '💐',
					isAvailable: true,
					sizes: [
						{ id: 'standard', name: 'Стандарт (діаметр 22 см)', price: 1100, isDefault: true },
						{ id: 'large', name: 'Великий (діаметр 30 см)', price: 1650 }
					]
				}
			],
			addons: [
				{
					id: 'addon_postcard',
					name: 'Фірмова листівка з підписом від руки',
					price: 50,
					isPostcard: true,
					description: 'Каліграфічний теплий підпис флористом перед доставкою',
					icon: '✉️'
				},
				{
					id: 'addon_vase',
					name: 'Скляна дизайнерська ваза',
					price: 250,
					description: 'Ідеально підібрана за висотою букета, щоб квіти довше залишались свіжими',
					icon: '🏺'
				},
				{
					id: 'addon_box',
					name: 'Преміальне пакування та атласна стрічка',
					price: 80,
					description: 'Захисний вологостійкий аквабокс для тривалого транспортування',
					icon: '🎀'
				},
				{
					id: 'addon_sweets',
					name: 'Крафтові макаруни (6 шт)',
					price: 180,
					description: 'Свіжі десерти від шеф-кондитера у подарунковій коробці',
					icon: '🍬'
				}
			],
			pickupPoints: [
				{
					id: 'point_1',
					name: 'Салон Центр (Саксаганського)',
					address: 'вул. Саксаганського, 42',
					workingHours: '08:00 - 21:00'
				},
				{
					id: 'point_2',
					name: 'Студія Поділ (Спаська)',
					address: 'вул. Спаська, 12',
					workingHours: '09:00 - 20:00'
				}
			],
			deliveryZones: [
				{
					id: 'zone_a',
					name: 'Зона А (Центр, Печерськ, Шевченківський)',
					price: 150,
					eta: 'до 60 хв',
					description: 'Швидка доставка кур’єром салону'
				},
				{
					id: 'zone_b',
					name: 'Зона B (Оболонь, Позняки, Теремки, Академмістечко)',
					price: 250,
					eta: 'до 90 хв',
					description: 'Доставка по всьому місту'
				}
			],
			customOrder: {
				minBudget: 800,
				defaultBudget: 1500,
				palettes: [
					{ id: 'pastel', name: 'Ніжна пастельна', colors: ['#fce7f3', '#fed7aa', '#e0e7ff'] },
					{ id: 'bright', name: 'Яскрава соковита', colors: ['#f43f5e', '#f59e0b', '#8b5cf6'] },
					{ id: 'white', name: 'Білосніжна класика', colors: ['#ffffff', '#f1f5f9', '#86efac'] },
					{ id: 'passion', name: 'Пристрасна червона', colors: ['#991b1b', '#ef4444', '#fbcfe8'] }
				],
				flowerOptions: ['Півонії', 'Гортензії', 'Кущові троянди', 'Еустоми', 'Тюльпани', 'Евкаліпт']
			},
			approval: {
				autoApprovalEnabled: true,
				requireManualForCustom: true,
				requireManualOutOfZone: true,
				replacementPolicy: 'same_palette',
				telegramChat: '@floris_kyiv_bot',
				responseTimeNotice: 'до 10 хвилин'
			},
			payment: {
				depositType: 'full',
				depositValue: 100,
				paymentTimeoutMinutes: 30
			}
		}
	},
	vertical_auto: {
		checkout_flow: { id: 'vertical_auto', version: 1, invoice_type: 'fixed' },
		allow_loyalty: true,
		allow_promo: false,
		allow_delivery: false,
		allow_upsell: true,
		flow_data: {
			categories: [
				{ id: 'sedan', title: 'Легкове авто', subtitle: 'Седан, хетчбек', icon: '🚗', modifier: 1.0 },
				{ id: 'suv', title: 'Кросовер / SUV', subtitle: 'Позашляховик', icon: '🚙', modifier: 1.25 },
				{ id: 'van', title: 'Мікроавтобус', subtitle: 'Бус, комерційний', icon: '🚐', modifier: 1.5 }
			],
			services: [
				{ id: 'srv_1', name: 'Комплексний шиномонтаж (4 шт)', durationMinutes: 45, basePrice: 800 },
				{ id: 'srv_2', name: 'Балансування коліс', durationMinutes: 30, basePrice: 400 },
				{ id: 'srv_3', name: 'Діагностика ходової частини', durationMinutes: 30, basePrice: 350 },
				{ id: 'srv_4', name: 'Заміна мастила та фільтрів', durationMinutes: 40, basePrice: 450 }
			],
			schedule: {
				startHour: '09:00',
				endHour: '19:00',
				slotDurationMinutes: 45,
				workDays: 'mon_sat',
				depositAmount: 200,
				calendarSyncUrl: ''
			}
		},
		cta_text: 'Сплатити послуги'
	},
	vertical_beauty: {
		checkout_flow: { id: 'vertical_beauty', version: 1, invoice_type: 'fixed' },
		allow_loyalty: true,
		allow_promo: true,
		allow_tips: true,
		allow_upsell: true,
		flow_data: {
			studioName: 'Beauty Studio',
			title: 'Салон краси та стилю',
			description: 'Стрижки, догляд та фарбування',
			contacts: {
				phone: '+380 67 000 00 00',
				instagram: '@beauty.studio',
				address: 'вул. Хрещатик, 15'
			},
			modes: {
				bookingEnabled: true,
				inSalonPayEnabled: true,
				bookingButtonText: 'Записатися на візит',
				inSalonButtonText: 'Оплатити в салоні'
			},
			services: [
				{ id: 'srv_female', name: 'Жіноча стрижка', durationMinutes: 60, basePrice: 600 },
				{ id: 'srv_male', name: 'Чоловіча стрижка', durationMinutes: 45, basePrice: 400 },
				{ id: 'srv_child', name: 'Дитяча стрижка', durationMinutes: 30, basePrice: 350 }
			],
			questions: [
				{
					id: 'q_hair_length',
					title: 'Довжина волосся',
					hint: 'Тільки для жіночої стрижки',
					required: true,
					dependsOnServiceId: 'srv_female',
					options: [
						{ id: 'opt_short', title: 'Коротке волосся', extraPrice: 0 },
						{ id: 'opt_medium', title: 'Середнє волосся', extraPrice: 150 },
						{ id: 'opt_long', title: 'Довге волосся', extraPrice: 300 }
					]
				}
			],
			masters: [
				{ id: 'm_any', name: 'Будь-який вільний майстер', role: 'Спеціаліст', extraPrice: 0 },
				{ id: 'm_reg', name: 'Звичайний майстер', role: 'Стиліст', extraPrice: 0 },
				{ id: 'm_lead', name: 'Провідний майстер', role: 'Топ-стиліст', extraPrice: 200 }
			],
			addons: [
				{
					id: 'add_care',
					name: 'Догляд та маска для волосся',
					description: 'Глибоке відновлення та живлення',
					price: 250
				}
			],
			paymentModel: {
				type: 'percent',
				percentValue: 30,
				fixedAmount: 200
			},
			approval: {
				channel: 'telegram',
				responseTimeNotice: 'до 15 хвилин'
			}
		},
		cta_text: 'Підтвердити запис'
	},
	vertical_cleaning: {
		checkout_flow: { id: 'vertical_cleaning', version: 1, invoice_type: 'fixed' },
		allow_promo: true,
		allow_delivery: false,
		allow_tips: true,
		allow_upsell: true,
		cta_text: 'Замовити клінінг',
		flow_data: {
			companyName: 'Чистий Дім Клінінг',
			tagline: 'Професійний клінінг квартир, будинків та офісів',
			description: 'Генеральне та підтримувальне прибирання, миття вікон та хімчистка меблів',
			contacts: {
				phone: '+380 67 555 33 22',
				telegram: '@clean_kyiv_bot',
				viber: '+380675553322',
				address: 'м. Київ, вул. Васильківська, 14'
			},
			modes: {
				standardEnabled: true,
				customEstimateEnabled: true,
				finalPayEnabled: true,
				standardButtonText: 'Розрахувати прибирання',
				customButtonText: 'Складне прибирання',
				finalPayButtonText: 'Оплатити залишок'
			},
			propertyTypes: [
				{ id: 'apartment', label: 'Квартира', icon: '🏢' },
				{ id: 'house', label: 'Приватний будинок', icon: '🏡' },
				{ id: 'office', label: 'Офіс / Комерція', icon: '💼' }
			],
			packages: [
				{
					id: 'maintenance',
					name: 'Підтримувальне прибирання',
					description: 'Знепилення поверхонь, пилосос, вологе миття підлоги, дезінфекція санвузлів',
					pricePerSqMeter: 35,
					minPrice: 1200,
					icon: '✨',
					includedFeatures: [
						'Сухе та вологе прибирання підлоги',
						'Протирання відкритих поверхонь до 1.8 м',
						'Миття та дезінфекція сантехніки'
					],
					excludedFeatures: ['Миття вікон', 'Очищення стійкого жиру в духовці']
				},
				{
					id: 'general',
					name: 'Генеральне прибирання',
					description: 'Глибоке очищення від стелі до підлоги, миття кахлю на всю висоту, фасадів та дверей',
					pricePerSqMeter: 60,
					minPrice: 2400,
					icon: '🧼',
					includedFeatures: [
						'Глибоке знежирення кухонних зон',
						'Очищення кахлю, швів та вапняного нальоту',
						'Миття дверей, плінтусів, розеток, вимикачів'
					]
				},
				{
					id: 'post_construction',
					name: 'Після ремонту',
					description: 'Видалення дрібнодисперсного будівельного пилу, слідів скотчу, ґрунтовки, фарби та затирки',
					pricePerSqMeter: 85,
					minPrice: 3500,
					icon: '🏗️',
					requiresInspection: true,
					includedFeatures: [
						'Робота промисловими пилососами',
						'Спеціальні розчинники для фарби та цементу',
						'Миття всіх поверхонь у 3 етапи'
					]
				}
			],
			addons: [
				{
					id: 'addon_window',
					name: 'Стандартна віконна стулка (з обох боків)',
					price: 150,
					unitLabel: 'стулка',
					maxQty: 30,
					description: 'Склопакет, рама, підвіконня та відлив',
					icon: '🪟'
				},
				{
					id: 'addon_oven',
					name: 'Духовка всередині (видалення нагару)',
					price: 300,
					unitLabel: 'шт',
					maxQty: 3,
					description: 'Професійна антижирова термообробка',
					icon: '🍳'
				},
				{
					id: 'addon_fridge',
					name: 'Холодильник всередині',
					price: 250,
					unitLabel: 'шт',
					maxQty: 3,
					description: 'Миття поличок, контейнерів та дезодорація',
					icon: '🧊'
				},
				{
					id: 'addon_sofa',
					name: 'Хімчистка прямого дивана',
					price: 600,
					unitLabel: 'посадкове місце',
					maxQty: 5,
					description: 'Екстракторне видалення плям та запахів',
					icon: '🛋️'
				},
				{
					id: 'addon_microwave',
					name: 'Мікрохвильова піч всередині',
					price: 150,
					unitLabel: 'шт',
					maxQty: 3,
					description: 'Очищення від жиру та залишків їжі',
					icon: '🍽️'
				}
			],
			zones: [
				{
					id: 'zone_a',
					name: 'Зона А (в межах Києва)',
					extraFee: 0,
					description: 'Виїзд бригади включено у вартість'
				},
				{
					id: 'zone_b',
					name: 'Зона Б (Передмістя до 20 км)',
					extraFee: 200,
					description: 'Ірпінь, Буча, Вишгород, Бровари, Бориспіль, Вишневе'
				}
			],
			approval: {
				autoApprovalEnabled: true,
				requireManualForHeavyCondition: true,
				requireManualForPostConstruction: true,
				telegramChat: '@clean_kyiv_bot',
				responseTimeNotice: 'до 10-15 хвилин'
			},
			payment: {
				depositType: 'percent',
				depositValue: 30,
				allowPostPayRemaining: true
			}
		}
	},
	vertical_pets: {
		checkout_flow: { id: 'vertical_pets', version: 1, invoice_type: 'fixed' },
		allow_loyalty: true,
		allow_promo: true,
		allow_tips: true,
		allow_upsell: true,
		flow_data: {
			studioName: 'Happy Paws Грумінг',
			title: 'Салон краси та догляду для тварин',
			description: 'Комплексний грумінг, купання, експрес-линька та СПА-догляд',
			contacts: {
				phone: '+380 67 111 22 33',
				instagram: '@happypaws.groom',
				address: 'вул. Саксаганського, 42'
			},
			modes: {
				bookingEnabled: true,
				inSalonPayEnabled: true,
				bookingButtonText: 'Записати улюбленця',
				inSalonButtonText: 'Оплатити в салоні'
			},
			supportedPets: ['dog', 'cat'],
			weightTiers: [
				{ id: 'under_5', label: 'до 5 кг включно', maxWeightKg: 5, basePrice: 700 },
				{ id: '5_to_10', label: 'понад 5 до 10 кг включно', maxWeightKg: 10, basePrice: 900 },
				{ id: '10_to_20', label: 'понад 10 до 20 кг включно', maxWeightKg: 20, basePrice: 1200 }
			],
			services: [
				{
					id: 'srv_complex',
					name: 'Комплексний грумінг (купання + стрижка)',
					petTypes: ['dog', 'cat'],
					requiresCoatDetails: true,
					weightTierPrices: {
						under_5: 700,
						'5_to_10': 900,
						'10_to_20': 1200
					},
					durationMinutes: 90
				},
				{
					id: 'srv_bath',
					name: 'Купання та сушка',
					petTypes: ['dog', 'cat'],
					requiresCoatDetails: true,
					weightTierPrices: {
						under_5: 450,
						'5_to_10': 600,
						'10_to_20': 800
					},
					durationMinutes: 60
				},
				{
					id: 'srv_deshed',
					name: 'Експрес-линька / Вичісування',
					petTypes: ['dog', 'cat'],
					requiresCoatDetails: true,
					weightTierPrices: {
						under_5: 600,
						'5_to_10': 800,
						'10_to_20': 1100
					},
					durationMinutes: 75
				},
				{
					id: 'srv_nails',
					name: 'Стрижка кігтів та догляд лапок',
					petTypes: ['dog', 'cat'],
					requiresCoatDetails: false,
					weightTierPrices: {},
					fixedPrice: 150,
					durationMinutes: 15
				}
			],
			coatOptions: [
				{ id: 'short', label: 'Коротка шерсть', extraPrice: 0 },
				{ id: 'medium', label: 'Середня шерсть', extraPrice: 100 },
				{ id: 'long', label: 'Довга шерсть', extraPrice: 200 }
			],
			addons: [
				{
					id: 'add_spa',
					name: 'Додаткова доглядова процедура (СПА)',
					description: 'Гідромасажна ванна та шовкова маска',
					price: 150
				},
				{
					id: 'add_teeth',
					name: 'Ультразвукове чищення зубів',
					description: 'Гігієнічне зняття нальоту без наркозу',
					price: 250
				}
			],
			masters: [
				{
					id: 'm_natali',
					name: 'Топ-грумер Наталія',
					role: 'Стиліст котів та собак',
					extraPrice: 0,
					allowedPetTypes: ['dog', 'cat']
				},
				{
					id: 'm_oleg',
					name: 'Грумер Олег',
					role: 'Майстер великих порід',
					extraPrice: 100,
					allowedPetTypes: ['dog']
				}
			],
			autoApproval: {
				enabled: true,
				noticeText: 'Автопогодження діє для стандартних заявок без ковтунів'
			},
			paymentModel: {
				type: 'percent',
				percentValue: 30,
				fixedAmount: 200
			},
			approval: {
				channel: 'telegram',
				responseTimeNotice: 'до 15 хвилин'
			}
		},
		cta_text: 'Записати улюбленця'
	},
	vertical_rental: {
		checkout_flow: { id: 'vertical_rental', version: 1, invoice_type: 'fixed' },
		allow_promo: true,
		allow_delivery: true,
		allow_upsell: true,
		flow_data: {
			categories: [
				{ id: 'r_camp', title: 'Туризм та кемпінг', subtitle: 'Намети, спальники', icon: '⛺', modifier: 1.0 },
				{ id: 'r_water', title: 'Водний спорт', subtitle: 'Сапборди, байдарки', icon: '🏄', modifier: 1.2 }
			],
			services: [
				{ id: 'rent_1', name: 'Намет 2-місний туристичний', durationMinutes: 1440, basePrice: 350 },
				{ id: 'rent_2', name: 'Сапборд надувний у комплекті', durationMinutes: 1440, basePrice: 500 },
				{ id: 'rent_3', name: 'Спальний мішок демісезонний', durationMinutes: 1440, basePrice: 150 }
			],
			schedule: {
				startHour: '09:00',
				endHour: '19:00',
				slotDurationMinutes: 60,
				workDays: 'everyday',
				depositAmount: 500,
				calendarSyncUrl: ''
			}
		},
		cta_text: 'Оплатити оренду'
	},
	vertical_education: {
		checkout_flow: { id: 'vertical_education', version: 1, invoice_type: 'fixed' },
		allow_loyalty: false,
		allow_promo: true,
		allow_upsell: true,
		flow_data: {
			categories: [
				{ id: 'tutor_1', title: 'Марія — Англійська (B1-C1)', subtitle: 'Розмовна практика', icon: '👩‍🏫', modifier: 1.0 },
				{ id: 'tutor_2', title: 'Олександр — НМТ / IELTS', subtitle: 'Підготовка до іспитів', icon: '👨‍🏫', modifier: 1.25 }
			],
			services: [
				{ id: 'edu_1', name: 'Пробне заняття (45 хв)', durationMinutes: 45, basePrice: 250 },
				{ id: 'edu_2', name: 'Індивідуальний урок (60 хв)', durationMinutes: 60, basePrice: 500 },
				{ id: 'edu_3', name: 'Курс / Абонемент (8 уроків)', durationMinutes: 60, basePrice: 3600 }
			],
			schedule: {
				startHour: '10:00',
				endHour: '20:00',
				slotDurationMinutes: 60,
				workDays: 'everyday',
				depositAmount: 250,
				calendarSyncUrl: ''
			}
		},
		cta_text: 'Оплатити заняття'
	},
	vertical_services: {
		checkout_flow: { id: 'vertical_services', version: 1, invoice_type: 'fixed' },
		allow_promo: true,
		allow_tips: true,
		allow_upsell: true,
		flow_data: {
			categories: [
				{ id: 's_plumb', title: 'Сантехніка', subtitle: 'Крані, труби, сифони', icon: '🚰', modifier: 1.0 },
				{ id: 's_electr', title: 'Електрика', subtitle: 'Розетки, щитки, люстри', icon: '⚡', modifier: 1.2 }
			],
			services: [
				{ id: 's_1', name: 'Діагностика та дрібний ремонт', durationMinutes: 45, basePrice: 350 },
				{ id: 's_2', name: 'Встановлення або заміна змішувача', durationMinutes: 60, basePrice: 500 },
				{ id: 's_3', name: 'Монтаж розетки / вимикача', durationMinutes: 30, basePrice: 200 }
			],
			schedule: {
				startHour: '09:00',
				endHour: '19:00',
				slotDurationMinutes: 45,
				workDays: 'mon_sat',
				depositAmount: 200,
				calendarSyncUrl: ''
			}
		},
		cta_text: 'Сплатити послугу'
	},
	vertical_delivery: {
		checkout_flow: { id: 'vertical_delivery', version: 1, invoice_type: 'delivery' },
		allow_promo: true,
		allow_delivery: true,
		cta_text: 'Оплатити перевезення'
	},
	vertical_print: {
		checkout_flow: { id: 'vertical_print', version: 1, invoice_type: 'fixed' },
		allow_promo: true,
		allow_delivery: true,
		allow_upsell: true,
		cta_text: 'Оплатити друк'
	},
	vertical_gifts: {
		checkout_flow: { id: 'vertical_gifts', version: 1, invoice_type: 'fixed' },
		allow_promo: true,
		allow_delivery: true,
		allow_upsell: true,
		cta_text: 'Оплатити подарунок'
	}
};

/**
 * Returns the full set of checkout config defaults for a given scenario type.
 * Merges base defaults with scenario-specific overrides.
 */
export function getScenarioDefaults(scenarioType: string): CheckoutScenarioConfig {
	const overrides = SCENARIO_OVERRIDES[scenarioType] || {};
	return { ...BASE_DEFAULTS, ...overrides };
}

/**
 * Resolves the effective checkout config for an order:
 * 1. Start with base defaults for the scenario type
 * 2. Override with any explicit values from the order's scenario_config
 *
 * Used by apps/pay to get the final config.
 */
export function resolveCheckoutConfig(
	scenarioType: string,
	orderConfig?: Partial<CheckoutScenarioConfig> | Record<string, unknown> | null
): CheckoutScenarioConfig {
	const defaults = getScenarioDefaults(scenarioType);
	if (!orderConfig) return defaults;
	return { ...defaults, ...orderConfig } as CheckoutScenarioConfig;
}
