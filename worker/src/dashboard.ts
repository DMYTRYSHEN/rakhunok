interface Env {
	ASSETS: Fetcher;
	API?: Fetcher;
}

function isDashboardPath(pathname: string): boolean {
	return pathname === '/dashboard' || pathname.startsWith('/dashboard/');
}

function isDashboardApiPath(pathname: string): boolean {
	return pathname === '/dashboard/api' || pathname.startsWith('/dashboard/api/');
}

function isDashboardAsset(pathname: string): boolean {
	return pathname.startsWith('/_app/') || pathname === '/favicon.ico';
}

export default {
	async fetch(request, env): Promise<Response> {
		const url = new URL(request.url);

		if (isDashboardApiPath(url.pathname)) {
			if (!env.API) {
				return Response.json({ error: 'Dashboard API is unavailable.' }, { status: 503 });
			}
			url.pathname = url.pathname.slice('/dashboard'.length);
			return env.API.fetch(new Request(url, request));
		}

		if (isDashboardPath(url.pathname)) {
			url.pathname = '/200';
			return env.ASSETS.fetch(new Request(url, request));
		}

		if (isDashboardAsset(url.pathname)) {
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
} satisfies ExportedHandler<Env>;