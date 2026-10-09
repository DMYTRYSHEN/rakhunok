import type { City, Warehouse } from './server/tracking/np-api.ts';

export function pointDistance(point: Pick<Warehouse, 'latitude' | 'longitude'>, location: { latitude: number; longitude: number }): number {
	if (point.latitude === null || point.longitude === null || !Number.isFinite(point.latitude) || !Number.isFinite(point.longitude) ||
		Math.abs(point.latitude) > 90 || Math.abs(point.longitude) > 180 || point.latitude === 0 && point.longitude === 0 ||
		!Number.isFinite(location.latitude) || !Number.isFinite(location.longitude) || Math.abs(location.latitude) > 90 || Math.abs(location.longitude) > 180) return Infinity;
	const radians = Math.PI / 180;
	const latitude = (point.latitude - location.latitude) * radians;
	const longitude = (point.longitude - location.longitude) * radians;
	const arc = Math.min(1, Math.max(0, Math.sin(latitude / 2) ** 2 + Math.cos(location.latitude * radians) * Math.cos(point.latitude * radians) * Math.sin(longitude / 2) ** 2));
	return 6371 * 2 * Math.atan2(Math.sqrt(arc), Math.sqrt(1 - arc));
}

export function recommendPoints(points: Warehouse[], location: { latitude: number; longitude: number }, weight: number): Warehouse[] {
	if (!Number.isFinite(weight) || weight <= 0) return [];
	return [...new Map(points.filter(point => point.status === 'Working' && ['Branch', 'Warehouse', 'Postomat'].includes(point.category) &&
		(point.maxWeight === null || point.maxWeight === 0 || point.maxWeight >= weight) && Number.isFinite(pointDistance(point, location)))
		.map(point => [point.ref, point])).values()].sort((first, second) => pointDistance(first, location) - pointDistance(second, location));
}

export function locationCityNames(value: unknown): string[] {
	if (!value || typeof value !== 'object') return [];
	const payload = value as Record<string, unknown>;
	if (payload.countryCode !== 'UA' || payload.lookupSource !== 'coordinates') return [];
	return [...new Set([payload.locality, payload.city].filter((name): name is string =>
		typeof name === 'string' && name.trim().length >= 2 && name.length <= 100).map(name => name.trim()))];
}

export function matchingLocationCity(cities: City[], name: string, area: string): City | null {
	const normalize = (value: string) => value.trim().toLocaleLowerCase('uk').replace(/['\u2019\u02bc]/g, "'");
	const matches = cities.filter(city => normalize(city.name) === normalize(name));
	if (matches.length === 1) return matches[0];
	const regional = matches.filter(city => city.area && normalize(city.area).replace(/\s+область$/, '') === normalize(area).replace(/\s+область$/, ''));
	return regional.length === 1 ? regional[0] : null;
}