import * as env from '$app/env/private';
import { error } from '@sveltejs/kit';
import { publicTracking, PublicTrackingError } from '#lib/server/tracking/public-tracking.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, url, setHeaders }) => {
	setHeaders({ 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer', 'X-Robots-Tag': 'noindex, nofollow' });
	try {
		return { tracking: await publicTracking.lookup(params.trackingNumber, {
			UKRPOSHTA_TRACKING_TOKEN: env.UKRPOSHTA_TRACKING_TOKEN,
			MEEST_TRACKING_TOKEN: env.MEEST_TRACKING_TOKEN
		}, url.searchParams.get('carrier') ?? undefined) };
	} catch (failure) {
		if (failure instanceof PublicTrackingError) error(400, 'Некоректний номер накладної.');
		throw failure;
	}
};