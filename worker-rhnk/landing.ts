export default {
	async fetch(request: Request, env: { ASSETS: Fetcher }): Promise<Response> {
		const pathname = new URL(request.url).pathname;
		if (pathname === '/' || pathname === '/index.html' || pathname === '/__data.json' || pathname.startsWith('/_app/') ||
			pathname.startsWith('/images/') || pathname === '/favicon.ico' ||
			pathname === '/robots.txt') {
			return env.ASSETS.fetch(request);
		}
		return new Response('Not Found', { status: 404 });
	}
} satisfies ExportedHandler<{ ASSETS: Fetcher }>;