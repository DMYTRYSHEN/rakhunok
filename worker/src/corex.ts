interface Env {
	ASSETS: Fetcher;
}

function isCorexPath(pathname: string): boolean {
	return pathname === '/corex' || pathname.startsWith('/corex/');
}

function isCorexAsset(pathname: string): boolean {
	return pathname.startsWith('/_app/') || pathname === '/favicon.ico';
}

export async function routeCorexRequest(request: Request, env: Env): Promise<Response> {
	const url = new URL(request.url);

	if (isCorexPath(url.pathname)) {
		url.pathname = '/200';
		return env.ASSETS.fetch(new Request(url, request));
	}

	if (isCorexAsset(url.pathname)) {
		return env.ASSETS.fetch(request);
	}

	return new Response('Not Found', {
		status: 404,
		headers: {
			'Cache-Control': 'no-store',
			'Content-Type': 'text/plain; charset=utf-8',
			'X-Robots-Tag': 'noindex'
		}
	});
}

export default {
	async fetch(request, env): Promise<Response> {
		return routeCorexRequest(request, env);
	}
} satisfies ExportedHandler<Env>;