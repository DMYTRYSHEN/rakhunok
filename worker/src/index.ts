interface Env {
	ASSETS: Fetcher;
}

const PUBLIC_FILES = new Set(['/favicon.ico', '/robots.txt']);

function isLandingAsset(pathname: string): boolean {
	return pathname.startsWith('/_app/') || PUBLIC_FILES.has(pathname);
}

export default {
	async fetch(request, env): Promise<Response> {
		const url = new URL(request.url);

		if (url.pathname === '/') {
			url.pathname = '/200';
			return env.ASSETS.fetch(new Request(url, request));
		}

		if (isLandingAsset(url.pathname)) {
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