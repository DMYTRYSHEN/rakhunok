export default {
	async fetch(request: Request, env: { ASSETS: Fetcher }): Promise<Response> {
		const pathname = new URL(request.url).pathname;
		if (pathname === '/promo' || pathname === '/promo/') {
			return Response.redirect(new URL('/', request.url).toString(), 302);
		}
		if (pathname === '/' || pathname === '/index.html' || pathname === '/__data.json' || pathname.startsWith('/_app/') ||
			pathname.startsWith('/images/') || pathname === '/favicon.ico' || pathname === '/favicon.svg' ||
			pathname === '/robots.txt') {
			return env.ASSETS.fetch(request);
		}
		return new Response('Not Found', { status: 404 });
	}
} satisfies ExportedHandler<{ ASSETS: Fetcher }>;