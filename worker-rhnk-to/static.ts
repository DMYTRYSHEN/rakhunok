interface Env {
	ASSETS: Fetcher;
	BASE_PATH: string;
	ROOT_REDIRECT?: string;
	API?: Fetcher;
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);
		const base = env.BASE_PATH;
		if (url.pathname === '/' && env.ROOT_REDIRECT && (request.method === 'GET' || request.method === 'HEAD')) {
			url.pathname = env.ROOT_REDIRECT;
			return Response.redirect(url.toString(), 302);
		}
		if (url.pathname !== base && !url.pathname.startsWith(`${base}/`)) {
			return new Response('Not Found', { status: 404 });
		}
		if (env.API && url.pathname.startsWith(`${base}/api/`)) {
			return env.API.fetch(request);
		}
		if (request.method !== 'GET' && request.method !== 'HEAD') {
			return new Response('Method Not Allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
		}
		url.pathname = url.pathname.slice(base.length) || '/';
		return env.ASSETS.fetch(new Request(url, request));
	}
} satisfies ExportedHandler<Env>;