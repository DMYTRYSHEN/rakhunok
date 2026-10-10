import { recommendPoints } from '../../location-city.ts';
import { NovaPoshtaError, requireRef } from './np-api.ts';
import type { Warehouse } from './np-api.ts';

type Location = { latitude: number; longitude: number };
type Provider = { warehousesPage(cityRef: string, search: string, page: number): Promise<{ data: Warehouse[]; hasMore: boolean }> };

export async function nearbyPoints(cityRef: string, location: Location, weight: number, provider: Provider) {
	requireRef(cityRef);
	if (!Number.isFinite(location.latitude) || !Number.isFinite(location.longitude) ||
		location.latitude < 44 || location.latitude > 53 || location.longitude < 22 || location.longitude > 41 ||
		!Number.isFinite(weight) || weight <= 0 || weight > 10000) throw new NovaPoshtaError(400);
	const found: Warehouse[] = [];
	let hasMore = true;
	for (let page = 1; page <= 30 && hasMore; page += 1) {
		const result = await provider.warehousesPage(cityRef, '', page);
		found.push(...result.data);
		hasMore = result.hasMore;
	}
	const data = recommendPoints(found, location, weight);
	return { data, source: 'nova_poshta', hasMore };
}