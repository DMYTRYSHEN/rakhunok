import { handleMerchantOnboarding } from './merchant-onboarding.ts';

export async function routeOnboardingRequest(
	request: Request,
	env: Pick<OnboardingEnv, 'SUPABASE_URL' | 'SUPABASE_ANON_KEY'>
): Promise<Response> {
	const url = new URL(request.url);
	if (url.origin !== 'https://letsrealtalk.com' || url.pathname !== '/api/v1/merchant/onboarding') {
		return Response.json({ error: 'Not found' }, { status: 404 });
	}
	if (request.method !== 'POST') {
		return Response.json({ error: 'Method not allowed' }, { status: 405, headers: { Allow: 'POST' } });
	}
	const response = await handleMerchantOnboarding(request, {
		url: env.SUPABASE_URL, publishableKey: env.SUPABASE_ANON_KEY
	});
	const headers = new Headers(response.headers);
	headers.delete('Access-Control-Allow-Origin');
	headers.set('Cache-Control', 'no-store');
	return new Response(response.body, { status: response.status, headers });
}

export default {
	fetch: routeOnboardingRequest
} satisfies ExportedHandler<OnboardingEnv>;