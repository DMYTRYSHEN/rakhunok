import { boundedJson } from './carriers.ts';

export class NovaPoshtaError extends Error {
	status: number;
	constructor(status: number) {
		super('Nova Poshta request failed');
		this.status = status;
	}
}

export type City = { ref: string; name: string; area: string };
export type Warehouse = {
	ref: string; cityRef: string; name: string; address: string; number: string;
	category: string; status: string; typeRef: string; maxWeight: number | null;
	latitude: number | null; longitude: number | null;
	schedule: Record<string, string>;
};

function object(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(value: unknown, limit = 400): string {
	return typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, limit) : '';
}

function numeric(value: unknown): number | null {
	if (typeof value !== 'number' && typeof value !== 'string' || value === '') return null;
	const parsed = Number(value);
	return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function requireRef(value: string): string {
	if (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value)) throw new NovaPoshtaError(400);
	return value;
}

function query(value: string): string {
	const normalized = value.trim();
	if (normalized.length < 2 || normalized.length > 100) throw new NovaPoshtaError(400);
	return normalized;
}

export class NovaPoshtaApi {
	private transport: typeof fetch;
	private cache = new Map<string, { expires: number; data: unknown }>();

	constructor(transport: typeof fetch = (input, init) => fetch(input, init)) {
		this.transport = transport;
	}

	async call(modelName: string, calledMethod: string, methodProperties: Record<string, unknown>, apiKey?: string): Promise<Record<string, unknown>[]> {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), 8000);
		try {
			const response = await this.transport('https://api.novaposhta.ua/v2.0/json/', {
				method: 'POST', redirect: 'manual', signal: controller.signal,
				headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
				body: JSON.stringify({ ...(apiKey ? { apiKey } : {}), modelName, calledMethod, methodProperties })
			});
			if (!response.ok || response.redirected) {
				void response.body?.cancel().catch(() => {});
				throw new NovaPoshtaError(response.status === 429 ? 429 : response.status === 401 || response.status === 403 ? 403 : 503);
			}
			const payload = await boundedJson(response, controller.signal);
			if (!object(payload) || payload.success !== true || !Array.isArray(payload.data) ||
				!Array.isArray(payload.errors) || payload.errors.length > 0 ||
				Array.isArray(payload.errorCodes) && payload.errorCodes.length > 0 ||
				payload.data.length > 500 || !payload.data.every(object)) throw new NovaPoshtaError(503);
			return payload.data;
		} catch (caught) {
			if (caught instanceof NovaPoshtaError) throw caught;
			throw new NovaPoshtaError(503);
		} finally {
			clearTimeout(timeout);
		}
	}

	private async cached<Result>(key: string, load: () => Promise<Result>): Promise<Result> {
		const found = this.cache.get(key);
		if (found && found.expires > Date.now()) return structuredClone(found.data) as Result;
		const data = await load();
		if (this.cache.size >= 200) this.cache.delete(this.cache.keys().next().value!);
		this.cache.set(key, { expires: Date.now() + 12 * 60 * 60 * 1000, data });
		return structuredClone(data);
	}

	async cities(search: string, page = 1): Promise<City[]> {
		return (await this.citiesPage(search, page)).data;
	}

	async citiesPage(search: string, page = 1): Promise<{ data: City[]; hasMore: boolean }> {
		const searchText = query(search);
		this.page(page);
		return this.cached(`cities:${searchText}:${page}`, async () => {
			const data = await this.call('Address', 'getCities', { FindByString: searchText, Page: String(page), Limit: '20' });
			return { hasMore: data.length >= 20, data: data.map(item => ({ ref: text(item.Ref, 36), name: text(item.Description), area: text(item.AreaDescription) }))
				.filter(item => item.ref && item.name) };
		});
	}

	async warehouses(cityRef: string, search = '', page = 1): Promise<Warehouse[]> {
		return (await this.warehousesPage(cityRef, search, page)).data;
	}

	async warehousesPage(cityRef: string, search = '', page = 1): Promise<{ data: Warehouse[]; hasMore: boolean }> {
		requireRef(cityRef);
		this.page(page);
		if (search.length > 100) throw new NovaPoshtaError(400);
		return this.cached(`warehouses:${cityRef}:${search.trim()}:${page}`, async () => {
			const data = await this.call('Address', 'getWarehouses', {
				CityRef: cityRef, FindByString: search.trim(), Page: String(page), Limit: '20', Language: 'UA'
			});
			return { hasMore: data.length >= 20, data: data.filter(item => item.CityRef === cityRef).map(item => ({
				ref: text(item.Ref, 36), cityRef, name: text(item.Description), address: text(item.ShortAddress),
				number: text(item.Number, 20), category: text(item.CategoryOfWarehouse, 40),
				status: text(item.WarehouseStatus, 40), typeRef: text(item.TypeOfWarehouse, 36),
				maxWeight: numeric(item.PlaceMaxWeightAllowed), latitude: numeric(item.Latitude), longitude: numeric(item.Longitude),
				schedule: object(item.Schedule) ? Object.fromEntries(Object.entries(item.Schedule)
					.filter(([day, hours]) => /^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)$/.test(day) && typeof hours === 'string')
					.map(([day, hours]) => [day, text(hours, 40)])) : {}
			})).filter(item => item.ref && item.name) };
		});
	}

	private page(page: number) {
		if (!Number.isSafeInteger(page) || page < 1 || page > 1000) throw new NovaPoshtaError(400);
	}
}

export const novaPoshtaApi = new NovaPoshtaApi();