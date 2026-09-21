import type { CheckoutTemplateScenario } from '$lib/features/shared/checkout-scenario-config';

export type ScenarioGroup = 'core' | 'engine' | 'vertical';
export type ScenarioReadiness = 'available' | 'testing' | 'preview';

export type ScenarioCapability = {
	id: CheckoutTemplateScenario;
	label: string;
	group: ScenarioGroup;
	readiness: ScenarioReadiness;
};

export const SCENARIO_CAPABILITIES = [
	{ id: 'fixed', label: 'Фіксована сума', group: 'core', readiness: 'available' },
	{ id: 'table', label: 'HoReCa · Стіл', group: 'core', readiness: 'available' },
	{ id: 'delivery', label: 'Доставка', group: 'core', readiness: 'testing' },
	{ id: 'tips', label: 'Чайові', group: 'core', readiness: 'available' },
	{ id: 'open_amount', label: 'Вільна сума', group: 'core', readiness: 'available' },
	{ id: 'fuel_station', label: 'АЗС · Пальне', group: 'core', readiness: 'testing' },
	{ id: 'engine_buy', label: 'Buy · Товар і кошик', group: 'engine', readiness: 'preview' },
	{ id: 'engine_order', label: 'Order · Вибір і опції', group: 'engine', readiness: 'preview' },
	{ id: 'engine_book', label: 'Book · Послуга і слот', group: 'engine', readiness: 'preview' },
	{ id: 'engine_quote', label: 'Quote · Розрахунок ціни', group: 'engine', readiness: 'preview' },
	{ id: 'engine_deliver', label: 'Deliver · Логістика', group: 'engine', readiness: 'preview' },
	{ id: 'engine_split', label: 'Split · Спільний рахунок', group: 'engine', readiness: 'preview' },
	{ id: 'vertical_food', label: 'Кафе і доставка їжі', group: 'vertical', readiness: 'preview' },
	{ id: 'vertical_flowers', label: 'Квіти', group: 'vertical', readiness: 'preview' },
	{ id: 'vertical_auto', label: 'СТО і шиномонтаж', group: 'vertical', readiness: 'preview' },
	{ id: 'vertical_beauty', label: 'Салон краси', group: 'vertical', readiness: 'preview' },
	{ id: 'vertical_cleaning', label: 'Клінінг', group: 'vertical', readiness: 'preview' },
	{ id: 'vertical_pets', label: 'Грумінг і ветклініка', group: 'vertical', readiness: 'preview' },
	{ id: 'vertical_rental', label: 'Оренда і прокат', group: 'vertical', readiness: 'preview' },
	{ id: 'vertical_education', label: 'Освіта і тренери', group: 'vertical', readiness: 'preview' },
	{ id: 'vertical_services', label: 'Майстри і ремонт', group: 'vertical', readiness: 'preview' },
	{ id: 'vertical_delivery', label: 'Мікроперевезення', group: 'vertical', readiness: 'preview' },
	{ id: 'vertical_print', label: 'Друкарня', group: 'vertical', readiness: 'preview' },
	{ id: 'vertical_gifts', label: 'Подарунки', group: 'vertical', readiness: 'preview' },
	{ id: 'vertical_events', label: 'Події і квитки', group: 'vertical', readiness: 'preview' },
	{ id: 'vertical_fitness', label: 'Фітнес і абонементи', group: 'vertical', readiness: 'preview' }
] as const satisfies readonly ScenarioCapability[];

const capabilityById = new Map(
	SCENARIO_CAPABILITIES.map((capability) => [capability.id, capability])
);

export function getScenarioCapability(id: string): ScenarioCapability | null {
	return capabilityById.get(id as CheckoutTemplateScenario) ?? null;
}

export function canCreateCheckoutLink(id: string, demo = false): boolean {
	return demo || getScenarioCapability(id)?.readiness === 'available';
}
