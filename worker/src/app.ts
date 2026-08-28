interface Env {
	ASSETS: Fetcher;
	API: Fetcher;
}

function isAppPath(pathname: string): boolean {
	return pathname === '/app' || pathname.startsWith('/app/');
}

function isAppApiPath(pathname: string): boolean {
	return pathname === '/app/api' || pathname.startsWith('/app/api/');
}

export default {
	async fetch(request, env): Promise<Response> {
		const url = new URL(request.url);

		if (!isAppPath(url.pathname)) {
			return new Response('Not Found', {
				status: 404,
				headers: {
					'Cache-Control': 'no-store',
					'Content-Type': 'text/plain; charset=utf-8',
					'X-Robots-Tag': 'noindex'
				}
			});
		}

		if (isAppApiPath(url.pathname)) {
			url.pathname = url.pathname.slice('/app'.length);
			return env.API.fetch(new Request(url, request));
		}

		url.pathname = url.pathname === '/app' || url.pathname === '/app/'
			? '/'
			: url.pathname.slice('/app'.length);
		return env.ASSETS.fetch(new Request(url, request));
	}
} satisfies ExportedHandler<Env>;