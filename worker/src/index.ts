interface Env {
	ASSETS: Fetcher;
}

const PUBLIC_FILES = new Set(['/favicon.ico', '/robots.txt']);
const DOCS_SPEC_PATH = '/docs/openapi.yaml';

function isLandingAsset(pathname: string): boolean {
	return pathname.startsWith('/_app/') || PUBLIC_FILES.has(pathname);
}

export async function routeWebRequest(request: Request, env: Env): Promise<Response> {
	const url = new URL(request.url);

	if (url.pathname === '/') {
		url.pathname = '/200';
		return env.ASSETS.fetch(new Request(url, request));
	}

	if (url.pathname === '/docs') {
		url.pathname = '/docs/';
		return Response.redirect(url, 308);
	}

	if (url.pathname === '/docs/') {
		return env.ASSETS.fetch(request);
	}

	if (url.pathname === DOCS_SPEC_PATH || isLandingAsset(url.pathname)) {
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
	fetch: routeWebRequest
} satisfies ExportedHandler<Env>;