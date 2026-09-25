interface Env {
	ASSETS: Fetcher;
}

const publicPaths = ['/robots.txt', '/favicon.ico', '/200.html'];

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);
		const path = url.pathname;
		if (request.method !== 'GET' && request.method !== 'HEAD') {
			return new Response('Method not allowed', { status: 405 });
		}
		if (path === '/robots.txt') {
			return new Response('User-agent: *\nDisallow: /\n', {
				headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Robots-Tag': 'noindex, nofollow' }
			});
		}
		if (path !== '/' && !path.startsWith('/_app/') && !path.startsWith('/images/landing/') && !publicPaths.includes(path)) {
			return new Response('Not found', { status: 404, headers: { 'X-Robots-Tag': 'noindex, nofollow' } });
		}
		const assetUrl = new URL(path === '/' ? '/' : path, url);
		const response = await env.ASSETS.fetch(new Request(assetUrl, request));
		const headers = new Headers(response.headers);
		headers.set('X-Robots-Tag', 'noindex, nofollow');
		return new Response(response.body, { status: response.status, headers });
	}
} satisfies ExportedHandler<Env>;