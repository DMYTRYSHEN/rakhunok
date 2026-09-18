import {
	CHECKOUT_TEMPLATE_SCENARIOS,
	isCheckoutTemplateScenario,
	type CheckoutScenarioConfig,
	type CheckoutTemplateScenario
} from '$lib/features/shared/checkout-scenario-config';
import { resolveCheckoutConfig } from '$lib/features/shared/checkout-scenario-defaults';

export { CHECKOUT_TEMPLATE_SCENARIOS, isCheckoutTemplateScenario };
export type { CheckoutTemplateScenario };
export type CheckoutPreviewStep = 'checkout' | 'payment' | 'success';

export interface CheckoutPreviewModel {
	scenario: CheckoutTemplateScenario;
	config: CheckoutScenarioConfig;
	merchantName: string;
	contextLabel: string;
	amount: number;
	isOpenAmount: boolean;
	quickAmounts: number[];
	tipPresets: number[];
	ctaText: string;
}

const SCENARIO_PRESENTATION: Record<
	CheckoutTemplateScenario,
	Pick<CheckoutPreviewModel, 'merchantName' | 'contextLabel' | 'amount'>
> = {
	// Legacy
	fixed: { merchantName: 'Rahunok Market', contextLabel: 'Замовлення #1048', amount: 1240 },
	table: { merchantName: 'Кав’ярня Центральна', contextLabel: 'Столик 12', amount: 860 },
	delivery: {
		merchantName: 'Rahunok Market',
		contextLabel: 'Замовлення з доставкою',
		amount: 1240
	},
	tips: { merchantName: 'Кав’ярня Центральна', contextLabel: 'Чайові офіціанту', amount: 100 },
	open_amount: { merchantName: 'Rahunok', contextLabel: 'Введіть суму до сплати', amount: 0 },
	fuel_station: { merchantName: 'Rahunok АЗС', contextLabel: 'Колонка · пальне · об’єм', amount: 1190 },

	// Engines
	engine_buy: { merchantName: 'Магазин одягу', contextLabel: 'Кошик замовлення', amount: 1850 },
	engine_order: { merchantName: 'Кондитерська Майстерня', contextLabel: 'Індивідуальне замовлення', amount: 950 },
	engine_book: { merchantName: 'Запис на послугу', contextLabel: 'Бронювання часу', amount: 300 },
	engine_quote: { merchantName: 'Калькулятор вартості', contextLabel: 'Розрахунок послуги', amount: 1450 },
	engine_deliver: { merchantName: 'Служба доставки', contextLabel: 'Доставка замовлення', amount: 450 },
	engine_split: { merchantName: 'Ресторан «Друзі»', contextLabel: 'Спільний рахунок (розподіл)', amount: 600 },

	// Verticals
	vertical_food: { merchantName: 'Піцерія Bella', contextLabel: 'Піца & Напої', amount: 540 },
	vertical_flowers: { merchantName: 'Floris Квіти', contextLabel: 'Букет півоній + листівка', amount: 1100 },
	vertical_auto: { merchantName: 'СТО Профі Авто', contextLabel: 'Запис на шиномонтаж / ТО', amount: 800 },
	vertical_beauty: { merchantName: 'Beauty Bar', contextLabel: 'Стрижка & Догляд', amount: 650 },
	vertical_cleaning: { merchantName: 'Чистий Дім', contextLabel: 'Генеральне прибирання', amount: 1600 },
	vertical_pets: { merchantName: 'Happy Paws Грумінг', contextLabel: 'Комплексний догляд собаки', amount: 750 },
	vertical_rental: { merchantName: 'Active Rent', contextLabel: 'Оренда спорядження', amount: 900 },
	vertical_education: { merchantName: 'English Pro School', contextLabel: 'Пакет 4 занять', amount: 2000 },
	vertical_services: { merchantName: 'Майстер на годину', contextLabel: 'Сантехнічні роботи', amount: 500 },
	vertical_delivery: { merchantName: 'Експрес Кур’єр', contextLabel: 'Доставка по місту', amount: 180 },
	vertical_print: { merchantName: 'Print Hub', contextLabel: 'Друк поліграфії', amount: 850 },
	vertical_gifts: { merchantName: 'Gift Box Studio', contextLabel: 'Подарунковий бокс', amount: 1250 },
	vertical_events: { merchantName: 'Cinema & Concert Hall', contextLabel: 'Сеанс · Зал 1 · Квитки', amount: 910 }
};

export function buildCheckoutPreviewModel(
	scenario: CheckoutTemplateScenario,
	config?: Partial<CheckoutScenarioConfig> | null
): CheckoutPreviewModel {
	const resolved = resolveCheckoutConfig(scenario, config);
	return {
		scenario,
		config: resolved,
		...SCENARIO_PRESENTATION[scenario],
		isOpenAmount: scenario === 'open_amount',
		quickAmounts: resolved.quick_amounts ?? [],
		tipPresets: resolved.tip_presets ?? [],
		ctaText: resolved.cta_text?.trim() || 'Перейти до оплати'
	};
}
