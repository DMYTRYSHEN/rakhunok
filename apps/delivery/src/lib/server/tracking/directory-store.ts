import type { Client } from '@libsql/client';
import type { Warehouse } from './np-api.ts';
import { recommendPoints } from '../../location-city.ts';

export class DirectoryStore {
	private client: Client;
	constructor(client: Client) { this.client = client; }
	async nearby(cityRef: string, location: { latitude: number; longitude: number }, weight: number): Promise<Warehouse[]> {
		const latitudeDelta = 180 / (Math.PI * 6371);
		const longitudeDelta = Math.min(180, latitudeDelta / Math.cos(location.latitude * Math.PI / 180));
		const result = await this.client.execute({
			sql: `SELECT ref, city_ref, name, address, number, category, status, type_ref, max_weight,
				latitude, longitude, schedule_json FROM delivery_directory_points
				WHERE carrier='nova_poshta' AND city_ref=? AND status='Working'
				AND category IN ('Branch', 'Warehouse', 'Postomat')
				AND (max_weight IS NULL OR max_weight=0 OR max_weight>=?)
				AND latitude BETWEEN ? AND ? AND longitude BETWEEN ? AND ?`,
			args: [cityRef, weight, location.latitude - latitudeDelta, location.latitude + latitudeDelta,
				location.longitude - longitudeDelta, location.longitude + longitudeDelta]
		});
		return recommendPoints(result.rows.map(row => ({
			ref: String(row.ref), cityRef: String(row.city_ref), name: String(row.name),
			address: String(row.address), number: String(row.number), category: String(row.category),
			status: String(row.status), typeRef: String(row.type_ref),
			maxWeight: row.max_weight === null ? null : Number(row.max_weight),
			latitude: row.latitude === null ? null : Number(row.latitude),
			longitude: row.longitude === null ? null : Number(row.longitude),
			schedule: JSON.parse(String(row.schedule_json))
		})), location, weight);
	}
	async save(points: Warehouse[]) {
		if (!points.length) return;
		const timestamp = new Date().toISOString();
		await this.client.batch(points.map(point => ({
			sql: `INSERT INTO delivery_directory_points
				(carrier, ref, city_ref, name, address, number, category, status, type_ref, max_weight,
				latitude, longitude, schedule_json, first_seen_at, updated_at)
				VALUES ('nova_poshta', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
				ON CONFLICT(carrier, ref) DO UPDATE SET
				city_ref=excluded.city_ref, name=excluded.name, address=excluded.address,
				number=excluded.number, category=excluded.category, status=excluded.status,
				type_ref=excluded.type_ref, max_weight=excluded.max_weight,
				latitude=excluded.latitude, longitude=excluded.longitude,
					schedule_json=excluded.schedule_json, updated_at=excluded.updated_at
				WHERE city_ref IS NOT excluded.city_ref OR name IS NOT excluded.name
					OR address IS NOT excluded.address OR number IS NOT excluded.number
					OR category IS NOT excluded.category OR status IS NOT excluded.status
					OR type_ref IS NOT excluded.type_ref OR max_weight IS NOT excluded.max_weight
					OR latitude IS NOT excluded.latitude OR longitude IS NOT excluded.longitude
					OR schedule_json IS NOT excluded.schedule_json`,
			args: [point.ref, point.cityRef, point.name, point.address, point.number, point.category,
				point.status, point.typeRef, point.maxWeight,
				point.latitude !== null && point.latitude > 0 && point.latitude <= 90 ? point.latitude : null,
				point.longitude !== null && point.longitude > 0 && point.longitude <= 180 ? point.longitude : null,
				JSON.stringify(point.schedule), timestamp, timestamp]
		})), 'write');
	}
}