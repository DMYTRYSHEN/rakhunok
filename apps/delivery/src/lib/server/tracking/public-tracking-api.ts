import { PublicTrackingError } from './public-tracking.ts';
import type { PublicTrackingResult } from './public-tracking.ts';

export function createPublicTrackingHandler(lookup: (number: string, carrier?: string) => Promise<PublicTrackingResult>) {
	return async (number: string, url: URL): Promise<Response> => {
		const headers = {
			'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer',
			'X-Robots-Tag': 'noindex, nofollow', 'Access-Control-Allow-Origin': '*'
		};
		try {
			if (url.searchParams.getAll('carrier').length > 1) throw new PublicTrackingError();
			const result = await lookup(number, url.searchParams.get('carrier') ?? undefined);
			const status = result.trackingState === 'rate_limited' ? 429 :
				['provider_unavailable', 'access_denied'].includes(result.trackingState) ? 503 : 200;
			return Response.json({ data: {
				carrier: result.carrier, trackingNumber: result.trackingNumber,
				trackingState: result.trackingState, deliveryStatus: result.deliveryStatus,
				checkedAt: result.checkedAt, providerStatusCode: result.providerStatusCode
			} }, { status, headers: status === 429 ? { ...headers, 'Retry-After': '60' } : headers });
		} catch (caught) {
			return Response.json({ error: {
				code: caught instanceof PublicTrackingError ? 'INVALID_TRACKING_INPUT' : 'TRACKING_UNAVAILABLE',
				message: caught instanceof PublicTrackingError ? 'Invalid tracking number or carrier' : 'Tracking unavailable'
			} }, { status: caught instanceof PublicTrackingError ? 400 : 503, headers });
		}
	};
}