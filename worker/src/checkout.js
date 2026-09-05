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
				if (order.short_id && order.short_id !== orderId) {
					env.ORDERS_KV.put(`order:${order.short_id}`, JSON.stringify(order), {
						expirationTtl: Math.min(Math.max(ttl, 300), 604800)
					}).catch(() => {});
				}
			}
		}
	}

	// 3. Resilient fallback: direct Supabase query if service binding was cold/missed
	if (!order) {
		try {
			const supabaseUrl = 'https://mwaeazabpvbxqfrceogr.supabase.co';
			const supabaseAnonKey = 'sb_publishable_BOyIBn3I0As0hP_0NutVtg_9ddFdyDk';
			const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId);
			const query = isUuid
				? `id=eq.${encodeURIComponent(orderId)}`
				: `or=(short_id.eq.${encodeURIComponent(orderId)},order_number.eq.${encodeURIComponent(orderId)})`;
			const sbRes = await fetch(
				`${supabaseUrl}/rest/v1/orders?${query}&select=*,merchants(*),business_entities(*)&limit=1`,
				{ headers: { apikey: supabaseAnonKey, 'Content-Type': 'application/json' } }
			);
			if (sbRes.ok) {
				const rows = await sbRes.json();
				if (rows && rows.length > 0) {
					const row = rows[0];
					const be = row.business_entities;
					const m = row.merchants;
					order = {
						id: row.id,
						short_id: row.short_id,
						merchant_id: row.merchant_id,
						type: row.type || 'fixed',
						order_number: row.order_number,
						title: row.title,
						description: row.description,
						amount: row.base_amount,
						base_amount: row.base_amount,
						discount_amount: row.discount_amount || 0,
						delivery_fee: row.delivery_fee || 0,
						total_amount: row.total_amount,
						currency: row.currency || 'UAH',
						status: row.status,
						table_number: row.table_number,
						terminal_id: row.terminal_id,
						scenario_config: row.scenario_config || {},
						share_url: row.share_url,
						merchant: be ? {
							business_name: be.business_name || be.display_name || m?.business_name || 'ФОП ДМИТРИШЕН',
							display_name: be.display_name || be.business_name || m?.display_name || m?.business_name || 'BARCODE',
							iban: be.iban || m?.iban || 'UA12345678987654321345562',
							tax_id: be.tax_id || m?.tax_id || '11212121212',
							bank_name: be.bank_name || m?.bank_name || 'А-Банк'
						} : (m ? {
							business_name: m.business_name || 'ФОП ДМИТРИШЕН',
							display_name: m.display_name || m.business_name || 'BARCODE',
							iban: m.iban || 'UA12345678987654321345562',
							tax_id: m.tax_id || '11212121212',
							bank_name: m.bank_name || 'А-Банк'
						} : null),
						created_at: row.created_at,
						expires_at: row.expires_at
					};
					if (env.ORDERS_KV && order) {
						env.ORDERS_KV.put(`order:${orderId}`, JSON.stringify(order), { expirationTtl: 300 }).catch(() => {});
						if (row.short_id && row.short_id !== orderId) {
							env.ORDERS_KV.put(`order:${row.short_id}`, JSON.stringify(order), { expirationTtl: 300 }).catch(() => {});
						}
					}
				}
			}
		} catch (e) {
			console.warn('Direct Supabase order fallback failed:', e);
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