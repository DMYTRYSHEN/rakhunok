const CHECKOUT_ROUTE = /^\/(?:o|t|tag|pos|pay|checkout)\/([a-zA-Z0-9-]{3,36})\/?$/i;
const CHECKOUT_SHELL_PATHS = new Set(['/checkout', '/checkout/', '/checkout/index.html']);
const PUBLIC_API_PREFIXES = ['/api/v1/checkout/', '/api/v1/banks', '/api/v1/logos'];

function notFound() {
	return new Response('Not Found', {
		status: 404,
		headers: {
			'Cache-Control': 'no-store',
			'Content-Type': 'text/plain; charset=utf-8',
			'X-Robots-Tag': 'noindex'
		}
	});
}

function isPublicApiPath(pathname) {
	return PUBLIC_API_PREFIXES.some((prefix) =>
		prefix.endsWith('/') ? pathname.startsWith(prefix) : pathname === prefix || pathname.startsWith(`${prefix}/`)
	);
}

function resolveCheckoutId(url) {
	const routeMatch = url.pathname.match(CHECKOUT_ROUTE);
	if (routeMatch) return routeMatch[1];
	if (!CHECKOUT_SHELL_PATHS.has(url.pathname)) return null;
	return url.searchParams.get('id') || url.searchParams.get('order_id');
}

function isCheckoutUiPath(pathname) {
	return CHECKOUT_SHELL_PATHS.has(pathname) || CHECKOUT_ROUTE.test(pathname) || pathname.startsWith('/checkout/');
}

function serializeForInlineScript(value) {
	return JSON.stringify(value)
		.replace(/</g, '\\u003c')
		.replace(/>/g, '\\u003e')
		.replace(/&/g, '\\u0026')
		.replace(/\u2028/g, '\\u2028')
		.replace(/\u2029/g, '\\u2029');
}

async function fetchCheckoutShell(request, env, url) {
	const assetUrl = new URL('/checkout/index.html', url.origin);
	let assetResponse = await env.ASSETS.fetch(new Request(assetUrl, request));
	if (assetResponse.status >= 300 && assetResponse.status < 400) {
		const location = assetResponse.headers.get('Location');
		if (location) {
			assetResponse = await env.ASSETS.fetch(new Request(new URL(location, url.origin), request));
		}
	}
	const orderId = resolveCheckoutId(url);

	if (request.method !== 'GET' || !orderId || !assetResponse.ok) return assetResponse;

	const apiUrl = new URL(`/api/v1/checkout/${encodeURIComponent(orderId)}`, url.origin);
	const apiResponse = await env.API.fetch(new Request(apiUrl, { headers: { Accept: 'application/json' } }));
	if (!apiResponse.ok) return assetResponse;

	const order = await apiResponse.json();
	const injection = `<script>window.__INITIAL_ORDER__=${serializeForInlineScript(order)};</script>`;
	const headers = new Headers(assetResponse.headers);
	headers.delete('Content-Length');
	headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
	headers.set('Content-Type', 'text/html; charset=utf-8');
	headers.set('X-Edge-Hydration', 'HIT');

	return new Response((await assetResponse.text()).replace('<head>', `<head>${injection}`), {
		status: assetResponse.status,
		headers
	});
}

export async function routeCheckoutRequest(request, env) {
	const url = new URL(request.url);

	if (isPublicApiPath(url.pathname)) return env.API.fetch(request);
	if (!isCheckoutUiPath(url.pathname)) return notFound();

	if (url.pathname.startsWith('/checkout/') && !CHECKOUT_SHELL_PATHS.has(url.pathname)) {
		return env.ASSETS.fetch(request);
	}

	return fetchCheckoutShell(request, env, url);
}

export default {
	async fetch(request, env) {
		try {
			return await routeCheckoutRequest(request, env);
		} catch (error) {
			console.error(JSON.stringify({
				message: 'checkout worker request failed',
				error: error instanceof Error ? error.message : String(error),
				path: new URL(request.url).pathname
			}));
			return new Response('Internal Server Error', { status: 500 });
		}
	}
};