interface Env {
	ASSETS: Fetcher;
}

const PUBLIC_FILES = new Set(['/favicon.ico', '/robots.txt']);
const DOCS_SPEC_PATH = '/docs/openapi.yaml';
const orderCache = new Map<string, { data: Record<string, unknown>; expires: number }>();

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

	if (request.method === 'OPTIONS') {
		return new Response(null, {
			headers: {
				'Access-Control-Allow-Origin': '*',
				'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
				'Access-Control-Allow-Headers': '*'
			}
		});
	}

	if (url.pathname.startsWith('/api/v1/checkout/')) {
		const orderId = url.pathname.slice('/api/v1/checkout/'.length).replace(/\/events$/, '').replace(/\/$/, '');
		const isEvents = url.pathname.endsWith('/events');

		if (isEvents) {
			return Response.json({ events: [] }, {
				headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
			});
		}

		if (orderId) {
			const cached = orderCache.get(orderId);
			if (cached && cached.expires > Date.now()) {
				return Response.json(cached.data, {
					headers: {
						'Content-Type': 'application/json',
						'Access-Control-Allow-Origin': '*',
						'X-Edge-Cache': 'HIT'
					}
				});
			}

			const supabaseUrl = 'https://mwaeazabpvbxqfrceogr.supabase.co';
			const supabaseAnonKey = 'sb_publishable_BOyIBn3I0As0hP_0NutVtg_9ddFdyDk';

			try {
				const res = await fetch(
					`${supabaseUrl}/rest/v1/orders?id=eq.${encodeURIComponent(orderId)}&select=*,merchants(*)`,
					{
						headers: {
							apikey: supabaseAnonKey,
							'Content-Type': 'application/json'
						}
					}
				);
				if (res.ok) {
					const rows = (await res.json()) as Array<Record<string, any>>;
					if (rows.length > 0) {
						const row = rows[0];
						const merchant = row.merchants;
						const orderPayload = {
							id: row.id,
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
							merchant: merchant
								? {
										business_name: merchant.business_name,
										display_name: merchant.display_name || merchant.business_name,
										iban: merchant.iban,
										tax_id: merchant.tax_id
									}
								: undefined,
							created_at: row.created_at,
							expires_at: row.expires_at
						};
						orderCache.set(orderId, { data: orderPayload, expires: Date.now() + 60000 });
						if (row.short_id) {
							orderCache.set(row.short_id, { data: orderPayload, expires: Date.now() + 60000 });
						}
						return Response.json(orderPayload, {
							headers: {
								'Content-Type': 'application/json',
								'Access-Control-Allow-Origin': '*'
							}
						});
					}
				}
			} catch {}
			return Response.json(
				{ error: 'Order not found' },
				{
					status: 404,
					headers: { 'Access-Control-Allow-Origin': '*' }
				}
			);
		}
	}

	const ALIAS_ROUTE = /^\/(?:o|t|tag|pos)\/([a-zA-Z0-9_-]+)\/?$/i;
	const aliasMatch = url.pathname.match(ALIAS_ROUTE);
	if (aliasMatch) {
		const identifier = aliasMatch[1];
		const supabaseUrl = 'https://mwaeazabpvbxqfrceogr.supabase.co';
		const supabaseAnonKey = 'sb_publishable_BOyIBn3I0As0hP_0NutVtg_9ddFdyDk';
		const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);
		const query = isUuid
			? `id=eq.${encodeURIComponent(identifier)}`
			: `or=(short_id.eq.${encodeURIComponent(identifier)},order_number.eq.${encodeURIComponent(identifier)})`;
		try {
			const res = await fetch(
				`${supabaseUrl}/rest/v1/orders?${query}&select=id&limit=1`,
				{
					headers: { apikey: supabaseAnonKey, 'Content-Type': 'application/json' }
				}
			);
			if (res.ok) {
				const rows = (await res.json()) as Array<{ id: string }>;
				if (rows[0]?.id) {
					return Response.redirect(`${url.origin}/pay/${rows[0].id}`, 302);
				}
			}
		} catch {}
		return Response.redirect(`${url.origin}/pay/${identifier}`, 302);
	}

	if (
		url.pathname === '/pay' ||
		url.pathname.startsWith('/pay/') ||
		url.pathname.startsWith('/checkout')
	) {
		try {
			const targetUrl = new URL(request.url);
			targetUrl.protocol = 'http:';
			targetUrl.hostname = 'localhost';
			targetUrl.port = '5174';

			const reqHeaders = new Headers(request.headers);
			reqHeaders.delete('host');

			const orderIdMatch = url.pathname.match(/\/(?:pay|checkout)\/([a-zA-Z0-9-]{3,36})/i);
			const orderId = orderIdMatch ? orderIdMatch[1] : null;

			// Fetch shell from dev server and order from Supabase/cache in PARALLEL
			const shellPromise = fetch(targetUrl.toString(), {
				method: request.method,
				headers: reqHeaders,
				body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
				redirect: 'manual'
			});

			let orderPromise: Promise<Record<string, unknown> | null> = Promise.resolve(null);
			if (orderId && orderId !== 'index' && !orderId.startsWith('@')) {
				const cached = orderCache.get(orderId);
				if (cached && cached.expires > Date.now()) {
					orderPromise = Promise.resolve(cached.data);
				} else {
					const supabaseUrl = 'https://mwaeazabpvbxqfrceogr.supabase.co';
					const supabaseAnonKey = 'sb_publishable_BOyIBn3I0As0hP_0NutVtg_9ddFdyDk';
					const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId);
					const query = isUuid
						? `id=eq.${encodeURIComponent(orderId)}`
						: `or=(short_id.eq.${encodeURIComponent(orderId)},order_number.eq.${encodeURIComponent(orderId)})`;

					orderPromise = fetch(
						`${supabaseUrl}/rest/v1/orders?${query}&select=*,merchants(*)&limit=1`,
						{ headers: { apikey: supabaseAnonKey, 'Content-Type': 'application/json' } }
					)
						.then(async (res) => {
							if (!res.ok) return null;
							const rows = (await res.json()) as Array<Record<string, any>>;
							if (!rows.length) return null;
							const row = rows[0];
							const merchant = row.merchants;
							const payload = {
								id: row.id,
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
								merchant: merchant
									? {
											business_name: merchant.business_name,
											display_name: merchant.display_name || merchant.business_name,
											iban: merchant.iban,
											tax_id: merchant.tax_id
										}
									: undefined,
								created_at: row.created_at,
								expires_at: row.expires_at
							};
							orderCache.set(orderId, { data: payload, expires: Date.now() + 60000 });
							if (row.short_id) {
								orderCache.set(row.short_id, { data: payload, expires: Date.now() + 60000 });
							}
							return payload;
						})
						.catch(() => null);
				}
			}

			const [payDevRes, order] = await Promise.all([shellPromise, orderPromise]);

			const contentType = payDevRes.headers.get('content-type') || '';
			if (payDevRes.ok && contentType.includes('text/html')) {
				let html = await payDevRes.text();
				if (order) {
					const serialized = JSON.stringify(order)
						.replace(/</g, '\\u003c')
						.replace(/>/g, '\\u003e')
						.replace(/&/g, '\\u0026');
					const injection = `<script>window.__INITIAL_ORDER__=${serialized};</script>`;
					html = html.replace('<head>', `<head>${injection}`);
				}

				const resHeaders = new Headers(payDevRes.headers);
				resHeaders.delete('content-length');
				resHeaders.set('content-type', 'text/html; charset=utf-8');
				resHeaders.set('Cache-Control', 'no-cache, no-store, must-revalidate');

				return new Response(html, {
					status: payDevRes.status,
					headers: resHeaders
				});
			}

			if (payDevRes.status !== 404 || contentType.includes('text/html')) {
				return payDevRes;
			}
		} catch {}
	}

	if (url.pathname === '/api/v1/orders' || url.pathname.startsWith('/api/v1/orders')) {
		if (request.method === 'POST') {
			try {
				const body = (await request.json()) as Record<string, unknown>;
				const authHeader = request.headers.get('Authorization') || '';
				const supabaseUrl = 'https://mwaeazabpvbxqfrceogr.supabase.co';
				const supabaseAnonKey = 'sb_publishable_BOyIBn3I0As0hP_0NutVtg_9ddFdyDk';

				let merchantId = body.merchant_id as string | undefined;
				if (!merchantId && authHeader) {
					try {
						const merchantRes = await fetch(
							`${supabaseUrl}/rest/v1/merchants?select=id&limit=1`,
							{
								headers: {
									apikey: supabaseAnonKey,
									Authorization: authHeader,
									'Content-Type': 'application/json'
								}
							}
						);
						if (merchantRes.ok) {
							const merchants = (await merchantRes.json()) as Array<{ id: string }>;
							merchantId = merchants[0]?.id;
						}
					} catch {}
				}

				const baseAmount = Number(body.amount || body.base_amount || 0);
				const deliveryFee = Number(body.delivery_fee || 0);
				const totalAmount = baseAmount + deliveryFee;
				const orderNumber = String(body.order_number || `RHK-${Date.now().toString().slice(-6)}`);
				const title = String(body.title || `Рахунок ${orderNumber}`);
				const type = (body.type as string) || 'fixed';
				const newOrderId = crypto.randomUUID();

				if (merchantId && authHeader) {
					const insertPayload: Record<string, unknown> = {
						id: newOrderId,
						merchant_id: merchantId,
						type,
						order_number: orderNumber,
						title,
						description: body.description ? String(body.description) : null,
						base_amount: baseAmount,
						delivery_fee: deliveryFee,
						total_amount: totalAmount,
						status: type === 'table' ? 'preparing' : 'pending',
						table_number: body.table_number ? parseInt(String(body.table_number), 10) : null,
						terminal_id: body.terminal_id ? String(body.terminal_id) : null,
						currency: 'UAH'
					};
					if (body.scenario_config) {
						insertPayload.scenario_config = body.scenario_config;
					}

					try {
						const insertRes = await fetch(`${supabaseUrl}/rest/v1/orders`, {
							method: 'POST',
							headers: {
								apikey: supabaseAnonKey,
								Authorization: authHeader,
								'Content-Type': 'application/json',
								Prefer: 'return=representation'
							},
							body: JSON.stringify(insertPayload)
						});

						if (insertRes.ok) {
							const [insertedOrder] = (await insertRes.json()) as Array<{ id: string }>;
							if (insertedOrder?.id) {
								return Response.json(
									{
										success: true,
										order: {
											...insertedOrder,
											share_url: `${url.origin}/pay/${insertedOrder.id}`
										}
									},
									{
										headers: {
											'Content-Type': 'application/json',
											'Access-Control-Allow-Origin': '*'
										}
									}
								);
							}
						}
					} catch {}
				}

				const shareUrl = `${url.origin}/pay/${newOrderId}`;
				return Response.json(
					{
						success: true,
						order: {
							id: newOrderId,
							...body,
							share_url: shareUrl,
							status: type === 'table' ? 'preparing' : 'pending',
							created_at: new Date().toISOString()
						}
					},
					{
						headers: {
							'Content-Type': 'application/json',
							'Access-Control-Allow-Origin': '*'
						}
					}
				);
			} catch {
				return Response.json({ error: 'Invalid JSON payload' }, { status: 400 });
			}
		}
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