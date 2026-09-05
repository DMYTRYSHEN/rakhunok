interface Env {
	ASSETS: Fetcher;
	API?: Fetcher;
}

function isConfPath(pathname: string): boolean {
	return pathname === '/conf' || pathname.startsWith('/conf/');
}

function isConfApiPath(pathname: string): boolean {
	return pathname === '/conf/api' || pathname.startsWith('/conf/api/');
}

export default {
	async fetch(request, env): Promise<Response> {
		const url = new URL(request.url);

		if (!isConfPath(url.pathname)) {
			return new Response('Not Found', {
				status: 404,
				headers: {
					'Cache-Control': 'no-store',
					'Content-Type': 'text/plain; charset=utf-8',
					'X-Robots-Tag': 'noindex'
				}
			});
		}

		if (isConfApiPath(url.pathname)) {
			if (!env.API) {
				return Response.json({ error: 'API service is not configured' }, { status: 503 });
			}
			url.pathname = url.pathname.slice('/conf'.length);
			return env.API.fetch(new Request(url, request));
		}

		url.pathname = url.pathname === '/conf' || url.pathname === '/conf/'
			? '/'
			: url.pathname.slice('/conf'.length);
		return env.ASSETS.fetch(new Request(url, request));
	}
} satisfies ExportedHandler<Env>;
