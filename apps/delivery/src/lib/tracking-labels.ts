import type { Shipment as StoredShipment } from '#lib/server/tracking/store.ts';

export type Shipment = StoredShipment;
export type Carrier = Shipment['carrier'];

export const carrierLabels: Record<Carrier, string> = {
	nova_poshta: 'Нова пошта', ukrposhta: 'Укрпошта', meest: 'Meest'
};

export const statusLabels: Record<Shipment['deliveryStatus'], string> = {
	unknown: 'Статус невідомий', label_created: 'Накладну створено', accepted: 'Прийнято перевізником',
	in_transit: 'У дорозі', customs: 'Митне оформлення', ready_for_pickup: 'Готово до отримання',
	out_for_delivery: 'Передано кур’єру', delivered: 'Доставлено', delivery_attempt_failed: 'Невдала спроба доставки',
	refused: 'Відмова від отримання', return_in_transit: 'Повертається відправнику', returned: 'Повернено',
	cancelled: 'Скасовано', lost: 'Втрату підтверджено', damaged: 'Пошкодження підтверджено', exception: 'Проблема доставки'
};

export const stateLabels: Record<Shipment['trackingState'], string> = {
	pending: 'Очікує перевірки', active: 'Відстеження активне', needs_carrier: 'Уточніть перевізника',
	needs_verification: 'Потрібна додаткова перевірка', not_found: 'Перевізник не знайшов відправлення',
	rate_limited: 'Ліміт запитів перевізника', provider_unavailable: 'Перевізник тимчасово недоступний',
	access_denied: 'Доступ до перевізника відсутній. Потрібне налаштування сервісу',
	unsupported: 'Відстеження не підтримується', paused: 'Відстеження призупинено',
	completed: 'Відстеження завершено', expired: 'Термін відстеження минув'
};

export function formatTime(value: string | null): string {
	if (!value || !Number.isFinite(Date.parse(value))) return '—';
	return new Intl.DateTimeFormat('uk-UA', {
		timeZone: 'Europe/Kyiv', day: '2-digit', month: '2-digit', year: 'numeric',
		hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
	}).format(new Date(value));
}

export function hasCheckFailure(shipment: Shipment): boolean {
	return !['active', 'pending', 'paused', 'completed'].includes(shipment.trackingState)
		|| Boolean(shipment.lastCheckedAt && shipment.lastSuccessAt
			&& Date.parse(shipment.lastCheckedAt) > Date.parse(shipment.lastSuccessAt));
}