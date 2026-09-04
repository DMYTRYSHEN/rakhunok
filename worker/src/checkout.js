const CHECKOUT_ROUTE = /^\/(?:o|t|tag|pos|pay|checkout)\/([a-zA-Z0-9-]{3,36})\/?$/i;
const CHECKOUT_SHELL_PATHS = new Set([
	'/checkout',
	'/checkout/',
	'/checkout/index.html',
	'/pay',
	'/pay/',
	'/pay/index.html'
]);
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
	return (
		CHECKOUT_SHELL_PATHS.has(pathname) ||
		CHECKOUT_ROUTE.test(pathname) ||
		pathname.startsWith('/checkout/') ||
		pathname.startsWith('/pay/')
	);
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
	const isPay = url.pathname.startsWith('/pay');
	const defaultShell = isPay ? '/pay/index.html' : '/checkout/index.html';
	const assetUrl = new URL(defaultShell, url.origin);
	let assetResponse = await env.ASSETS.fetch(new Request(assetUrl, request));
	if (assetResponse.status >= 300 && assetResponse.status < 400) {
		const location = assetResponse.headers.get('Location');
		if (location) {
			assetResponse = await env.ASSETS.fetch(new Request(new URL(location, url.origin), request));
		}
	}
	if (!assetResponse.ok) {
		const fallbacks = ['/index.html', '/pay/index.html', '/checkout/index.html'];
		for (const fallback of fallbacks) {
			if (fallback === defaultShell) continue;
			const fallbackRes = await env.ASSETS.fetch(new Request(new URL(fallback, url.origin), request));
			if (fallbackRes.ok) {
				assetResponse = fallbackRes;
				break;
			}
		}
	}
	const orderId = resolveCheckoutId(url);

	if (request.method !== 'GET' || !orderId || !assetResponse.ok) return assetResponse;

	let order = null;
	let cacheHit = false;

	// 1. Ultra-fast Edge Memory path (Cloudflare Workers KV)
	if (env.ORDERS_KV) {
		try {
			const cached = await env.ORDERS_KV.get(`order:${orderId}`, 'json');
			if (cached) {
				order = cached;
				cacheHit = true;
			}
		} catch (kvErr) {
			console.warn('ORDERS_KV lookup error:', kvErr);
		}
	}

	// 2. If KV cache miss, query backend service binding
	if (!order && env.API) {
		const apiUrl = new URL(`/api/v1/checkout/${encodeURIComponent(orderId)}`, url.origin);
		const apiResponse = await env.API.fetch(new Request(apiUrl, { headers: { Accept: 'application/json' } }));
		if (apiResponse.ok) {
			order = await apiResponse.json();
			// Populate Edge KV for subsequent sub-5ms requests
			if (env.ORDERS_KV && order) {
				const ttl = order.expires_at
					? Math.max(300, Math.floor((new Date(order.expires_at).getTime() - Date.now()) / 1000))
					: 259200;
				env.ORDERS_KV.put(`order:${orderId}`, JSON.stringify(order), {
					expirationTtl: Math.min(Math.max(ttl, 300), 604800)
				}).catch(() => {});
			}
		}
	}

	if (!order) return assetResponse;

	const injection = `<script>window.__INITIAL_ORDER__=${serializeForInlineScript(order)};</script>`;
	const html = await assetResponse.text();
	const headers = new Headers(assetResponse.headers);
	headers.delete('Content-Length');
	headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
	headers.set('Content-Type', 'text/html; charset=utf-8');
	headers.set('X-Edge-Hydration', 'HIT');
	headers.set('X-Edge-Cache', cacheHit ? 'HIT' : 'MISS');

	// Early hints / HTTP/3 server preload Link header
	const scriptMatch = html.match(/<script[^>]+src=["']([^"']+)["']/i);
	const cssMatch = html.match(/<link[^>]+rel=["']stylesheet["'][^>]+href=["']([^"']+)["']/i);
	const fontMatches = [...html.matchAll(/<link[^>]+rel=["']preload["'][^>]+href=["']([^"']+\.woff2)["'][^>]*>/gi)];
	const linkParts = [];
	if (scriptMatch) linkParts.push(`<${scriptMatch[1]}>; rel=modulepreload; as=script`);
	if (cssMatch) linkParts.push(`<${cssMatch[1]}>; rel=preload; as=style`);
	for (const fm of fontMatches) {
		linkParts.push(`<${fm[1]}>; rel=preload; as=font; type=font/woff2; crossorigin`);
	}
	if (linkParts.length > 0) {
		headers.set('Link', linkParts.join(', '));
	}

	return new Response(html.replace('<head>', `<head>${injection}`), {
		status: assetResponse.status,
		headers
	});
}

export async function routeCheckoutRequest(request, env) {
	const url = new URL(request.url);

	if (isPublicApiPath(url.pathname)) return env.API.fetch(request);
	if (!isCheckoutUiPath(url.pathname)) return notFound();

	if (
		!CHECKOUT_ROUTE.test(url.pathname) &&
		((url.pathname.startsWith('/checkout/') && !CHECKOUT_SHELL_PATHS.has(url.pathname)) ||
			(url.pathname.startsWith('/pay/') && !CHECKOUT_SHELL_PATHS.has(url.pathname)))
	) {
		const res = await env.ASSETS.fetch(request);
		if (res.status === 404 && (url.pathname.startsWith('/pay/') || url.pathname.startsWith('/checkout/'))) {
			const prefix = url.pathname.startsWith('/pay/') ? '/pay' : '/checkout';
			const stripped = url.pathname.slice(prefix.length);
			const retryUrl = new URL(stripped + url.search, url.origin);
			const retryRes = await env.ASSETS.fetch(new Request(retryUrl, request));
			if (retryRes.ok) return retryRes;
		}
		return res;
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