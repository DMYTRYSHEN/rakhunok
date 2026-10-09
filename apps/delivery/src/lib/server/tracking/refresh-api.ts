import { AuthError } from './auth.ts';
import type { Shipment } from './store.ts';

type Dependencies = {
	authenticate: (request: Request) => Promise<{ id: string }>;
	refresh: (id: string, ownerId: string) => Promise<Shipment | null>;
};

export function createRefreshHandler(dependencies: Dependencies) {
	return async (request: Request, url: URL, id: string): Promise<Response> => {
		const respond = (body: unknown, status = 200) => Response.json(body, {
			status, headers: { 'Cache-Control': 'no-store' }
		});
		if (request.headers.get('origin') !== url.origin) {
			return respond({ error: { code: 'INVALID_ORIGIN', message: 'Invalid origin' } }, 403);
		}
		try {
			const user = await dependencies.authenticate(request);
			if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
				return respond({ error: { code: 'INVALID_ID', message: 'Invalid shipment id' } }, 400);
			}
			const shipment = await dependencies.refresh(id, user.id);
			if (!shipment) {
				return respond({ error: { code: 'REFRESH_UNAVAILABLE', message: 'Shipment unavailable or already being checked' } }, 409);
			}
			return respond({ data: {
				id: shipment.id, carrier: shipment.carrier, trackingNumber: shipment.trackingNumber,
				trackingState: shipment.trackingState, deliveryStatus: shipment.deliveryStatus,
				providerStatusCode: shipment.providerStatusCode, providerStatusLabel: shipment.providerStatusLabel,
				lastCheckedAt: shipment.lastCheckedAt, lastSuccessAt: shipment.lastSuccessAt
			} });
		} catch (caught) {
			return respond({ error: { code: caught instanceof AuthError ? caught.code : 'REFRESH_FAILED', message: 'Shipment check failed' } },
				caught instanceof AuthError ? caught.status : 503);
		}
	};
}