import * as env from '$app/env/private';
import { publicTracking } from '#lib/server/tracking/public-tracking.ts';
import { createPublicTrackingHandler } from '#lib/server/tracking/public-tracking-api.ts';
import type { RequestHandler } from './$types';

const handle = createPublicTrackingHandler((number, carrier) => publicTracking.lookup(number, {
	UKRPOSHTA_TRACKING_TOKEN: env.UKRPOSHTA_TRACKING_TOKEN,
	MEEST_TRACKING_TOKEN: env.MEEST_TRACKING_TOKEN
}, carrier));

export const GET: RequestHandler = ({ params, url }) => handle(params.ttn, url);